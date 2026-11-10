import Stripe from "stripe";
import { verify, origin } from "../lib/shared.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const r = verify((req.body || {}).refresh);
  if (!r || r.k !== "refresh") return res.status(401).json({ error: "bad_refresh" });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const s = await stripe.billingPortal.sessions.create({ customer: r.cus, return_url: origin(req) + "/" });
    res.json({ url: s.url });
  } catch { res.status(500).json({ error: "server" }); }
}
