import { who } from "../lib/shared.js";
export default function handler(req, res) {
  const w = who(req);
  res.json({ owner: w.owner, plan: w.plan });
}
