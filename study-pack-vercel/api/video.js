// Turns a YouTube link into text using the video's captions. Plus (and owner) only.
import { YoutubeTranscript } from "youtube-transcript";
import { who, incr, day } from "../lib/shared.js";
function videoId(u) {
  try {
    const x = new URL(u);
    if (x.hostname === "youtu.be") return x.pathname.slice(1, 12);
    if (/(^|\.)youtube\.com$/.test(x.hostname)) {
      if (x.pathname === "/watch") return x.searchParams.get("v");
      const m = x.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {}
  return null;
}
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const w = who(req);
  if (!w.owner && w.plan !== "plus") return res.status(403).json({ error: "plan" });
  const id = videoId((req.body || {}).url);
  if (!id) return res.status(400).json({ error: "unsupported" });
  try {
    if (!w.owner && (await incr(`vid:${w.id}:${day()}`, 172800)) > 40) return res.status(429).json({ error: "limit" });
    const parts = await YoutubeTranscript.fetchTranscript(id);
    const text = decode(parts.map((p) => p.text).join(" ")).replace(/\s+/g, " ").trim().slice(0, 120000);
    if (!text) return res.status(404).json({ error: "no_captions" });
    res.json({ text });
  } catch { res.status(404).json({ error: "no_captions" }); }
}
