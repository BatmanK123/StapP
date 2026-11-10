// Called once when someone presses "Create pack". Enforces the daily limit and returns a short-lived ticket.
import { who, sign, incr, day, PLAN_LIMIT } from "../lib/shared.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const w = who(req), limit = PLAN_LIMIT[w.plan];
  try {
    let used = 0;
    if (!w.owner) {
      used = await incr(`packs:${w.id}:${day()}`, 172800);
      if (used > limit) return res.status(429).json({ error: "limit", limit, used: limit, plan: w.plan });
    }
    const ticket = sign({ k: "ticket", id: w.id, t: Math.random().toString(36).slice(2), exp: Math.floor(Date.now() / 1000) + 900 });
    res.json({ ticket, used, limit: w.owner ? null : limit, plan: w.plan });
  } catch { res.status(500).json({ error: "server" }); }
}
