// Cloudflare Pages Function — receives WhatsApp events from Meta.
// When a customer taps Confirm  -> the PDF bill is sent to them automatically.
// When a customer taps Cancel   -> a short cancellation note is sent.
// The result is saved so the warehouse can pick it up (wa-status).

const ok = () => new Response("ok", { status: 200 });

async function validSignature(request, raw, secret) {
  const sig = (request.headers.get("x-hub-signature-256") || "").replace("sha256=", "");
  if (!sig) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// Meta calls this once when you save the webhook in the developer dashboard
export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && env.WA_VERIFY_TOKEN && q.get("hub.verify_token") === env.WA_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

async function sendMessage(env, to, payload) {
  const r = await fetch(`https://graph.facebook.com/v21.0/${env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, ...payload }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error((d.error && d.error.message) || "send failed");
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.WA_APP_SECRET || !env.WA_KV || !env.WA_TOKEN || !env.WA_PHONE_ID) return new Response("Not configured", { status: 500 });
  const raw = await request.text();
  if (!(await validSignature(request, raw, env.WA_APP_SECRET))) return new Response("Bad signature", { status: 401 });

  let body;
  try { body = JSON.parse(raw); } catch (_) { return ok(); }

  const messages = [];
  for (const e of body.entry || []) for (const c of e.changes || []) for (const m of (c.value && c.value.messages) || []) messages.push(m);

  for (const m of messages) {
    // template quick-reply => type "button"; in-chat buttons => interactive.button_reply
    const payload = (m.button && m.button.payload) || (m.interactive && m.interactive.button_reply && m.interactive.button_reply.id) || "";
    const [act, ref] = String(payload).split("|");
    if ((act !== "C" && act !== "X") || !/^[A-Za-z0-9_-]{3,60}$/.test(ref || "")) continue;

    const meta = await env.WA_KV.get(`meta:${ref}`, "json");
    if (!meta || String(m.from) !== String(meta.phone)) continue;      // unknown order or a different number
    if (await env.WA_KV.get(`wa:${ref}`)) continue;                    // already answered once — ignore repeats

    const status = act === "C" ? "confirmed" : "cancelled";
    const record = { status, at: new Date().toISOString() };
    try {
      if (act === "C") {
        await sendMessage(env, meta.phone, {
          type: "text",
          text: { body: `Shukriya ${meta.name}! ✅ Your order is confirmed (${meta.invoiceNo}). We will deliver it soon.` },
        });
      } else {
        await sendMessage(env, meta.phone, {
          type: "text",
          text: { body: `Your order has been cancelled. Thank you ${meta.name} — we hope to serve you again. 🌸` },
        });
      }
    } catch (e) {
      record.error = String(e.message || e).slice(0, 200);
    }
    await env.WA_KV.put(`wa:${ref}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
  }
  return ok();
}
