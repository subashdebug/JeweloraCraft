// Cloudflare Pages Function — sends emails through Resend.
// The API key is read from the RESEND_API_KEY secret and is
// NEVER exposed to the browser.


const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (v, n) => String(v ?? "").slice(0, n);

function orderEmail(o) {
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 50);
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(clip(i.name, 120))}${i.size ? `<br><small style="color:#777">${esc(clip(i.size, 60))}</small>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${esc(Number(i.qty) || 0)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">PKR ${esc(Number(i.price) || 0)}</td>
      </tr>`
    )
    .join("");
  const c = o.customer || {};
  return {
    subject: `New order ${clip(o.id, 40)} — PKR ${Number(o.total) || 0}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
      <h2 style="color:#B8922B">New JeweloraCraft order</h2>
      <p><b>Order ID:</b> ${esc(clip(o.id, 40))}</p>
      <p><b>Name:</b> ${esc(clip(c.name, 120))}<br>
         <b>Phone:</b> ${esc(clip(c.phone, 40))}<br>
         <b>Address:</b> ${esc(clip(c.address, 400))}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#f6f1e2"><th style="padding:8px;text-align:left">Item</th><th>Qty</th><th style="text-align:right;padding:8px">Price</th></tr>
        ${rows}
      </table>
      <h3 style="text-align:right">Total: PKR ${esc(Number(o.total) || 0)}</h3>
      <p style="color:#777;font-size:12px">Payment: Cash on Delivery</p>
    </div>`,
  };
}

function subscribeEmail(email) {
  return {
    subject: "New newsletter subscriber",
    html: `<div style="font-family:Arial,sans-serif"><h3>New subscriber</h3><p>${esc(clip(email, 200))}</p></div>`,
  };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export async function onRequestPost({ request, env }) {
  const key = env.RESEND_API_KEY;
  if (!key) return json({ error: "Email service not configured" }, 500);
  const TO_EMAIL = env.TO_EMAIL || "ranih8519@gmail.com";
  const FROM_EMAIL = env.FROM_EMAIL || "JeweloraCraft <onboarding@resend.dev>";

  let body;
  try { body = await request.json(); } catch (_) { return json({ error: "Invalid request" }, 400); }

  let mail;
  if (body.type === "order" && body.order && body.order.id) {
    mail = orderEmail(body.order);
  } else if (body.type === "subscribe" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email || "")) {
    mail = subscribeEmail(body.email);
  } else {
    return json({ error: "Invalid request" }, 400);
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [TO_EMAIL], subject: mail.subject, html: mail.html }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data.message || "Resend error" }, 502);
    return json({ ok: true });
  } catch (e) {
    return json({ error: "Could not reach email service" }, 502);
  }
}
