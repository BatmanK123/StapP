import crypto from "node:crypto";

const SECRET = process.env.APP_SECRET;
export const PLAN_LIMIT = { basic: 5, pro: 10, plus: 20 };

export function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const s = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  return p + "." + s;
}

export function verify(tok) {
  if (!SECRET || typeof tok !== "string") return null;
  const [p, s] = tok.split(".");
  if (!p || !s) return null;
  const e = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  const a = Buffer.from(s), b = Buffer.from(e);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(p, "base64url").toString());
    return o.exp > Date.now() / 1000 ? o : null;
  } catch { return null; }
}

function isOwner(req) {
  const k = process.env.OWNER_KEY, h = req.headers["x-owner-key"];
  if (!k || !h) return false;
  const a = Buffer.from(String(h)), b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Who is calling? owner key > signed plan token > anonymous (by hashed IP, Basic plan)
export function who(req) {
  if (isOwner(req)) return { plan: "plus", id: "owner", owner: true };
  const t = verify((req.headers.authorization || "").replace(/^Bearer /, ""));
  if (t && t.k === "plan") return { plan: t.plan, id: t.cus, owner: false };
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const id = "ip:" + crypto.createHash("sha256").update(ip + SECRET).digest("hex").slice(0, 24);
  return { plan: "basic", id, owner: false };
}

async function redis(cmds) {
  const u = process.env.UPSTASH_REDIS_REST_URL, t = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!u || !t) throw new Error("redis_not_configured");
  const r = await fetch(u + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + t }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error("redis_error");
  return (await r.json()).map((x) => x.result);
}
export async function incr(key, ttl) {
  const [n] = await redis([["INCR", key], ["EXPIRE", key, ttl, "NX"]]);
  return Number(n);
}
export const day = () => new Date().toISOString().slice(0, 10); // limits reset at midnight UTC
export const origin = (req) => `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
