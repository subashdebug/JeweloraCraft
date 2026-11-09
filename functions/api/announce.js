// Cloudflare Pages Function — emails every newsletter subscriber about a new item.
// Only the warehouse owner can call it (checked with their Firebase login token).
// Needs these settings in Cloudflare: RESEND_API_KEY, FROM_EMAIL (a sender on a domain
// verified in Resend), ADMIN_EMAIL (your warehouse login email).

const FIREBASE_API_KEY = "AIzaSyDcKrK-FOPkxi4nqbBooilpJcBuVLByIuE"; // public web key (same as firebase-sync.js)

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v ?? "").slice(0, n);
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

function buildEmail(p, siteUrl) {
  const name = esc(clip(p.name, 140));
  const price = Number(p.price) || 0, old = Number(p.oldPrice) || 0;
  const link = safeUrl(p.url) || safeUrl(siteUrl);
  const img = safeUrl(p.image);
  return {
    subject: `New at JeweloraCraft: ${clip(p.name, 100)}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#0B0B0B;color:#F2F2F2;padding:28px;border-radius:12px">
      <h2 style="margin:0 0 4px;font-family:Georgia,serif;color:#fff">Jewelora<span style="color:#D4AF37">Craft</span></h2>
      <p style="color:#D4AF37;letter-spacing:.12em;font-size:12px;text-transform:uppercase;margin:0 0 18px">Just arrived</p>
      ${img ? `<img src="${esc(img)}" alt="${name}" style="width:100%;border-radius:10px;margin-bottom:16px">` : ""}
      <h3 style="margin:0 0 8px;font-size:20px">${name}</h3>
      <p style="margin:0 0 20px;font-size:16px"><b style="color:#D4AF37">PKR ${price.toLocaleString("en-US")}</b>${old > price ? ` <s style="color:#888">PKR ${old.toLocaleString("en-US")}</s>` : ""}</p>
      ${link ? `<a href="${esc(link)}" style="display:inline-block;background:#D4AF37;color:#1a1405;text-decoration:none;font-weight:bold;padding:12px 26px;border-radius:30px">View item</a>` : ""}
      <p style="color:#888;font-size:12px;margin-top:26px">You are getting this because you subscribed on our website. Reply to this email with “unsubscribe” and we will remove you.</p>
    </div>`,
  };
}

export async function onRequestPost({ request, env }) {
  const key = env.RESEND_API_KEY, admin = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!key) return json({ error: "Email service not configured (RESEND_API_KEY)" }, 500);
  if (!admin) return json({ error: "ADMIN_EMAIL is not set in Cloudflare" }, 500);
  const from = env.FROM_EMAIL;
  if (!from) return json({ error: "FROM_EMAIL is not set in Cloudflare (needs a verified domain in Resend)" }, 500);

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid request" }, 400); }

  // who is calling? check the Firebase login token
  let who = "";
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: body.idToken || "" }),
    });
    const d = await r.json();
    who = ((d.users && d.users[0] && d.users[0].email) || "").toLowerCase();
  } catch (_) {}
  if (!who || who !== admin) return json({ error: "Not allowed" }, 403);

  const p = body.product || {};
  if (!p.name) return json({ error: "Missing item" }, 400);
  const emails = [...new Set((Array.isArray(body.emails) ? body.emails : [])
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)))].slice(0, 1000);
  if (!emails.length) return json({ error: "No valid subscribers" }, 400);

  const mail = buildEmail(p, body.siteUrl);
  let sent = 0;
  try {
    for (let i = 0; i < emails.length; i += 100) {            // one separate email per person
      const chunk = emails.slice(i, i + 100).map((to) => ({ from, to: [to], subject: mail.subject, html: mail.html }));
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(chunk),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: d.message || "Resend error", sent }, 502);
      sent += chunk.length;
    }
  } catch (e) { return json({ error: "Could not reach email service", sent }, 502); }
  return json({ ok: true, sent });
}
