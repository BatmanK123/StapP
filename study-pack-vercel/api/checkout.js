import Stripe from "stripe";
import { origin } from "../lib/shared.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const prices = { pro: process.env.STRIPE_PRICE_PRO, plus: process.env.STRIPE_PRICE_PLUS };
  const plan = (req.body || {}).plan;
  if (!prices[plan]) return res.status(400).json({ error: "bad_plan" });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const o = origin(req);
    const s = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: prices[plan], quantity: 1 }],
      success_url: `${o}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${o}/`,
      allow_promotion_codes: true,
    });
    res.json({ url: s.url });
  } catch { res.status(500).json({ error: "server" }); }
}
