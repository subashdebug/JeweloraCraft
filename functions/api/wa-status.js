// Cloudflare Pages Function — lets the warehouse ask which customers have
// tapped Confirm / Cancel on WhatsApp. Owner only.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const FALLBACK_FIREBASE_KEY = "AIzaSyDcKrK-FOPkxi4nqbBooilpJcBuVLByIuE";

async function requireOwner(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!m) return false;
  const key = env.FIREBASE_API_KEY || FALLBACK_FIREBASE_KEY;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: m[1] }),
  });
  if (!r.ok) return false;
  const d = await r.json().catch(() => ({}));
  const u = d.users && d.users[0];
  if (!u) return false;
  if (env.ADMIN_EMAIL && String(u.email || "").toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return false;
  return true;
}

export async function onRequestGet({ request, env }) {
  if (!(await requireOwner(request, env))) return json({ error: "Not allowed" }, 401);
  if (!env.WA_KV) return json({ error: "WA_KV is not set up" }, 500);
  const refs = (new URL(request.url).searchParams.get("refs") || "")
    .split(",").map((r) => r.trim()).filter((r) => /^[A-Za-z0-9_-]{3,60}$/.test(r)).slice(0, 50);
  const results = {};
  await Promise.all(refs.map(async (ref) => {
    const v = await env.WA_KV.get(`wa:${ref}`, "json");
    if (v) results[ref] = v;
  }));
  return json({ results });
}
