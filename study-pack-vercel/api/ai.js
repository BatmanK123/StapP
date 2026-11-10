// Secure proxy to the Anthropic API. Needs a valid pack ticket (or owner key); translations get a small daily allowance.
import { who, verify, incr, day } from "../lib/shared.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, images = [], json = false, kind } = req.body || {};
  if (typeof prompt !== "string" || prompt.length > 262144 || !Array.isArray(images) || images.length > 4)
    return res.status(400).json({ error: "bad_request" });
  const w = who(req);
  try {
    if (kind === "translate") {
      if (!w.owner && (await incr(`tr:${w.id}:${day()}`, 172800)) > 5) return res.status(429).json({ error: "limit" });
    } else if (!w.owner) {
      const tk = verify(req.headers["x-ticket"]);
      if (!tk || tk.k !== "ticket" || tk.id !== w.id) return res.status(402).json({ error: "no_ticket" });
      if ((await incr(`calls:${tk.t}`, 1200)) > 60) return res.status(429).json({ error: "limit" });
    }
    const content = [
      ...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })),
      { type: "text", text: json ? prompt + "\n\nReturn ONLY valid JSON. No code fences, no commentary." : prompt },
    ];
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-sonnet-5-5", max_tokens: 16000, messages: [{ role: "user", content }] }),
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: "upstream", detail: d.error && d.error.message });
    res.json({ text: (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("") });
  } catch { res.status(500).json({ error: "server" }); }
}
