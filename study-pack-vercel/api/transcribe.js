// Speech-to-text with Whisper. Pro and Plus (and owner). Vercel limits request bodies to ~4.5 MB.
import { who, incr, day } from "../lib/shared.js";
export const config = { api: { bodyParser: false } };
async function readBody(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > max) throw new Error("too_big"); chunks.push(c); }
  return Buffer.concat(chunks);
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const w = who(req);
  if (!w.owner && w.plan === "basic") return res.status(403).json({ error: "plan" });
  try {
    if (!w.owner && (await incr(`stt:${w.id}:${day()}`, 172800)) > 30) return res.status(429).json({ error: "limit" });
    const buf = await readBody(req, 4_400_000);
    const type = String(req.headers["content-type"] || "audio/mpeg").split(";")[0];
    const ext = /mp4|m4a|aac/.test(type) ? "m4a" : /wav/.test(type) ? "wav" : /webm/.test(type) ? "webm" : /ogg/.test(type) ? "ogg" : "mp3";
    const fd = new FormData();
    fd.append("file", new File([buf], "audio." + ext, { type }));
    fd.append("model", process.env.WHISPER_MODEL || "whisper-1");
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY }, body: fd });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: "upstream" });
    res.json({ text: d.text || "" });
  } catch (e) { res.status(e.message === "too_big" ? 413 : 500).json({ error: e.message === "too_big" ? "too_big" : "server" }); }
}
