// Works out the real plan from Stripe and hands back a signed 1-hour plan token plus a long-lived refresh token.
import Stripe from "stripe";
import { sign, verify } from "../lib/shared.js";
async function planFor(stripe, cus) {
  const prices = { pro: process.env.STRIPE_PRICE_PRO, plus: process.env.STRIPE_PRICE_PLUS };
  const subs = await stripe.subscriptions.list({ customer: cus, status: "all", limit: 20 });
  let best = "basic";
  for (const s of subs.data) {
    if (!["active", "trialing"].includes(s.status)) continue;
    const pid = s.items.data[0] && s.items.data[0].price && s.items.data[0].price.id;
    if (pid === prices.plus) return "plus";
    if (pid === prices.pro) best = "pro";
  }
  return best;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const b = req.body || {};
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let cus;
    if (b.session_id) {
      const s = await stripe.checkout.sessions.retrieve(String(b.session_id));
      if (s.status !== "complete" || !s.customer) return res.status(402).json({ error: "unpaid" });
      cus = s.customer;
    } else {
      const r = verify(b.refresh);
      if (!r || r.k !== "refresh") return res.status(401).json({ error: "bad_refresh" });
      cus = r.cus;
    }
    const plan = await planFor(stripe, cus), now = Math.floor(Date.now() / 1000);
    res.json({ plan, token: sign({ k: "plan", plan, cus, exp: now + 3600 }), refresh: sign({ k: "refresh", cus, exp: now + 31536000 }) });
  } catch { res.status(500).json({ error: "server" }); }
}
