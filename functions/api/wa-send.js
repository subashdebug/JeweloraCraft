// Cloudflare Pages Function — sends the WhatsApp order-confirmation message
// (template with Confirm / Cancel quick-reply buttons) and uploads the PDF bill.
// Only the signed-in warehouse owner can call it. Secrets stay on the server.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const FALLBACK_FIREBASE_KEY = "AIzaSyDcKrK-FOPkxi4nqbBooilpJcBuVLByIuE"; // public web key, same as firebase-sync.js

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

const waNumber = (p) => {
  let n = String(p || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "92" + n.slice(1);
  return n;
};
// template variables can't contain new lines / tabs
const oneLine = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n) || "-";

export async function onRequestPost({ request, env }) {
  if (!(await requireOwner(request, env))) return json({ error: "Not allowed" }, 401);
  if (!env.WA_TOKEN || !env.WA_PHONE_ID || !env.WA_KV) {
    return json({ error: "WhatsApp is not set up yet (WA_TOKEN, WA_PHONE_ID, WA_KV missing)" }, 500);
  }

  let b;
  try { b = await request.json(); } catch (_) { return json({ error: "Invalid request" }, 400); }

  const ref = String(b.ref || "");
  if (!/^[A-Za-z0-9_-]{3,60}$/.test(ref)) return json({ error: "Invalid reference" }, 400);
  const phone = waNumber(b.phone);
  if (phone.length < 11 || phone.length > 15) return json({ error: "Invalid phone number" }, 400);
  if (!b.pdf || typeof b.pdf !== "string") return json({ error: "PDF missing" }, 400);

  const API = `https://graph.facebook.com/v21.0/${env.WA_PHONE_ID}`;
  const auth = { Authorization: `Bearer ${env.WA_TOKEN}` };

  // 1) upload the PDF bill to WhatsApp (attached to the confirmation message as its header)
  const bin = Uint8Array.from(atob(b.pdf), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([bin], { type: "application/pdf" }), `${oneLine(b.invoiceNo, 40)}.pdf`);
  const up = await fetch(`${API}/media`, { method: "POST", headers: auth, body: form });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || !upData.id) return json({ error: (upData.error && upData.error.message) || "Could not upload the PDF" }, 502);

  // 2) send the template message with Confirm / Cancel buttons
  const msg = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: env.WA_TEMPLATE || "order_confirmation",
      language: { code: env.WA_TEMPLATE_LANG || "en" },
      components: [
        {
          type: "header",
          parameters: [{ type: "document", document: { id: upData.id, filename: `${oneLine(b.invoiceNo, 40)}.pdf` } }],
        },
        {
          type: "body",
          parameters: [
            oneLine(b.name, 60),
            oneLine(b.orderLabel, 40),
            oneLine(b.items, 500),
            "PKR " + Number(b.total || 0).toLocaleString("en-US"),
          ].map((text) => ({ type: "text", text })),
        },
        { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: `C|${ref}` }] },
        { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: `X|${ref}` }] },
      ],
    },
  };
  const r = await fetch(`${API}/messages`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: (data.error && data.error.message) || "WhatsApp rejected the message" }, 502);

  // 3) remember what the webhook needs when the customer taps a button (30 days)
  await env.WA_KV.put(
    `meta:${ref}`,
    JSON.stringify({ phone, name: oneLine(b.name, 60), invoiceNo: oneLine(b.invoiceNo, 40), mediaId: upData.id }),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
  return json({ ok: true });
}
