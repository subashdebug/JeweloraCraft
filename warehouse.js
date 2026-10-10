/* ============================================================
   JeweloraCraft — Warehouse app
   A single-page dashboard (sidebar + views) for the store owner:
   dashboard overview, incoming orders, inventory, categories,
   manual invoicing, invoice history, monthly earnings, clients.
   Shares its data with the storefront via data.js / localStorage.
   ============================================================ */

const app = document.getElementById("app");

let products = DB.getProducts();
let categories = DB.getCategories();
let orders = DB.getOrders();
let invoices = DB.getInvoices();

const isCounted = i => !i.waStatus || i.waStatus === "confirmed";

const state = {
  authed: false,
  authReady: false,
  userEmail: "",
  view: "dashboard",
  viewingInvoiceId: null,
  invoiceDraft: { name: "", phone: "", address: "", lines: [] },
  gateError: "",
};

/* ============================================================
   LOGIN GATE
   ============================================================ */
function renderGate() {
  return `
    <div class="gate-wrap">
      <form id="gateForm" class="gate-card">
        <div class="gate-brand">Jewelora<span>Craft</span></div>
        <span class="gate-tag">Warehouse Access</span>
        <h2>Warehouse Login</h2>
        <p class="muted">Sign in with your warehouse email to manage orders, stock and invoices.</p>
        <label>Email<input type="email" id="gateUser" autocomplete="username" required></label>
        <label>Password
          <div class="pass-wrap">
            <input type="password" id="gatePass" autocomplete="current-password" required>
            <button type="button" class="pass-toggle" id="passToggle" aria-label="Show password">Show</button>
          </div>
        </label>
        ${state.gateError ? `<p class="gate-error">${esc(state.gateError)}</p>` : ""}
        <button type="submit" class="btn btn-gold btn-block">Enter Warehouse</button>
        <a href="index.html" class="back-to-store">&larr; Back to Store</a>
      </form>
    </div>
  `;
}

function showGate() {
  app.innerHTML = renderGate();
  document.getElementById("gateForm").addEventListener("submit", handleLogin);
  const pt = document.getElementById("passToggle"), pi = document.getElementById("gatePass");
  pt.addEventListener("click", () => {
    const show = pi.type === "password";
    pi.type = show ? "text" : "password";
    pt.textContent = show ? "Hide" : "Show";
    pt.setAttribute("aria-label", show ? "Hide password" : "Show password");
    pi.focus();
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("gateUser").value.trim().toLowerCase();
  const pass = document.getElementById("gatePass").value;
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; btn.textContent = "Signing in…";
  try {
    await JCFB.signIn(email, pass);      // onAuth callback below opens the dashboard
    state.gateError = "";
  } catch (err) {
    const bad = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"];
    state.gateError = bad.includes(err.code) ? "Incorrect email or password."
      : err.code === "auth/too-many-requests" ? "Too many attempts. Try again in a few minutes."
      : "Could not sign in. Check your internet and try again.";
    showGate();
  }
}

/* ============================================================
   SIDEBAR + LAYOUT
   ============================================================ */
function pendingOrders() { return orders.filter(o => ["pending", "awaiting"].includes(o.status)); }

function renderSidebar() {
  const pendingCount = pendingOrders().length;
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "orders", label: "New Orders", badge: pendingCount },
    { id: "inventory", label: "Inventory" },
    { id: "categories", label: "Categories" },
    { id: "new-invoice", label: "New Invoice" },
    { id: "invoices", label: "Invoice History" },
    { id: "earnings", label: "Monthly Earnings" },
    { id: "bulk-orders", label: "Multi-Client Orders" },
    { id: "clients", label: "Clients" },
  ];
  const buttons = navItems.map(n => {
    const active = state.view === n.id || (state.view === "invoice-view" && n.id === "invoices") || ((state.view === "bulk-invoice" || state.view === "bulk-view") && n.id === "bulk-orders");
    return `<button class="${active ? "active" : ""}" data-nav="${n.id}">${esc(n.label)}${n.badge ? `<span class="wh-badge">${n.badge}</span>` : ""}</button>`;
  }).join("");

  return `
    <div class="sidebar no-print">
      <div class="sidebar-brand">Jewelora<span>Craft</span><small>Warehouse</small></div>
      <div class="nav">${buttons}</div>
      <a href="index.html" class="back-to-store">&larr; Back to Store</a>
      <div class="sidebar-foot">${invoices.filter(isCounted).length} invoices billed<br>${products.length} items tracked</div>
      <div class="sidebar-auth-row">
        <button type="button" class="btn-link" id="changePasswordBtn">Reset Password</button>
        <button type="button" class="btn-link" id="logoutBtn">Logout</button>
        <button type="button" class="btn-link danger" id="eraseAllBtn">Erase all data</button>
      </div>
    </div>
  `;
}

function render() {
  if (!state.authReady) { app.innerHTML = `<div class="gate-wrap"><div class="gate-card"><div class="gate-brand">Jewelora<span>Craft</span></div><p class="muted">Loading…</p></div></div>`; return; }
  if (!state.authed) { showGate(); return; }
  let body = "";
  if (state.view === "dashboard") body = renderDashboard();
  else if (state.view === "orders") body = renderOrders();
  else if (state.view === "inventory") body = renderInventory();
  else if (state.view === "categories") body = renderCategories();
  else if (state.view === "new-invoice") body = renderNewInvoice();
  else if (state.view === "invoices") body = renderInvoiceHistory();
  else if (state.view === "invoice-view") body = renderInvoiceView();
  else if (state.view === "earnings") body = renderEarnings();
  else if (state.view === "clients") body = renderClients();
  else if (state.view === "bulk-orders") body = renderBulkList();
  else if (state.view === "bulk-invoice") body = renderBulkInvoice();
  else if (state.view === "bulk-view") body = renderBulkView();

  app.innerHTML = `${renderSidebar()}<div class="wh-main">${body}</div>`;
  bindGlobalEvents();
  bindViewEvents();
  bindExtras();
  bindCombos();
}

function goTo(view) { state.view = view; render(); }

function bindGlobalEvents() {
  app.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => { state.invFilter = null; goTo(btn.dataset.nav); }));
  const logout = document.getElementById("logoutBtn");
  if (logout) logout.addEventListener("click", () => { JCFB.signOut(); });
  const changePw = document.getElementById("changePasswordBtn");
  if (changePw) changePw.addEventListener("click", async () => {
    try { await JCFB.resetPassword(state.userEmail); toast("Password reset link sent to " + state.userEmail); }
    catch (err) { toast("Could not send the reset email"); }
  });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const stockValue = products.reduce((s, p) => s + p.stock * p.discountPrice, 0);
  const revenue = invoices.filter(isCounted).reduce((s, i) => s + i.total, 0);
  const lowStock = products.filter(p => p.stock <= 6);
  const recent = invoices.slice(0, 5);
  const pendingCount = pendingOrders().length;

  return `
    <div class="page-head">
      <div><h1>Dashboard</h1><p>Overview of stock and billing for JeweloraCraft.</p></div>
      <button class="btn btn-gold" data-nav="new-invoice">+ New Invoice</button>
    </div>

    <div class="wh-card dash-hero" data-nav="earnings">
      <div class="label">Total Revenue</div>
      <div class="dash-hero-value">${fmt(revenue)}</div>
      <div class="dash-hero-link muted">See Monthly Earnings →</div>
    </div>

    <div class="stat-grid">
      <div class="stat" data-nav="orders"><div class="label">New Orders</div><div class="value ${pendingCount ? "gold" : ""}">${pendingCount}</div></div>
      <div class="stat"><div class="label">Items Tracked</div><div class="value">${products.length}</div></div>
      <div class="stat"><div class="label">Stock Value</div><div class="value gold">${fmt(stockValue)}</div></div>
      <div class="stat" data-nav="invoices"><div class="label">Invoices Billed</div><div class="value">${invoices.filter(isCounted).length}</div></div>
    </div>

    <div class="wh-grid-2">
      <div class="wh-card">
        <h3>Recent Invoices</h3>
        ${recent.length ? `
          <table class="wh-table">
            <thead><tr><th>Client</th><th>Date</th><th>Total</th><th></th></tr></thead>
            <tbody>
              ${recent.map(inv => `
                <tr>
                  <td>${esc(inv.clientName)}<div class="muted">${esc(inv.invoiceNo)}</div></td>
                  <td>${fmtDate(inv.date)}</td>
                  <td class="num">${fmt(inv.total)}</td>
                  <td><button class="btn btn-outline btn-sm" data-view-invoice="${inv.id}">View</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : `<p class="muted">No invoices billed yet.</p>`}
      </div>
      <div class="wh-card">
        <h3>Low Stock</h3>
        ${lowStock.length ? `
          <table class="wh-table">
            <tbody>
              ${lowStock.map(p => `<tr><td>${esc(p.name)}</td><td><span class="pill low">${p.stock} left</span></td></tr>`).join("")}
            </tbody>
          </table>
        ` : `<p class="muted">All items are well stocked.</p>`}
      </div>
    </div>
  `;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ============================================================
   NEW ORDERS (from storefront checkouts)
   ============================================================ */
function waNumber(phone) {
  let n = String(phone || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "92" + n.slice(1);
  return n;
}
function orderCardHTML(o, showActions) {
  const c = o.customer || {};
  const itemsRows = (o.items || []).map(it => `
    <tr><td>${esc(it.name)}${it.size ? ` <span class="muted">(${esc(it.size)})</span>` : ""}</td><td>${it.qty}</td><td class="num">${fmt(it.price * it.qty)}</td></tr>
  `).join("");
  const statusPill = o.status === "billed" ? `<span class="pill ok">billed</span>`
    : o.status === "awaiting" ? `<span class="pill low">awaiting reply</span>`
    : o.status === "cancelled" ? `<span class="pill low">cancelled</span>`
    : o.status === "dismissed" ? `<span class="pill low">dismissed</span>`
    : `<span class="pill low">pending</span>`;
  let actions = "";
  if (o.status === "pending") actions = `
          <button class="btn btn-gold btn-sm" data-wa-order="${o.id}">💬 Send on WhatsApp</button>
          ${canSharePdf() ? `<button class="btn btn-outline btn-sm" data-wa-order="${o.id}" data-pdf="1">📎 Send with PDF</button>` : ""}
          <button class="btn btn-outline btn-sm" data-dismiss-order="${o.id}">Dismiss</button>`;
  else if (o.status === "awaiting") actions = `
          <span class="muted">⏳ Waiting for payment. Press Mark Confirmed when the payment screenshot arrives</span>
          <button class="btn btn-gold btn-sm" data-resend-wa="${o.invoiceId || ""}" data-order="${o.id}">🔁 Resend</button>
          ${canSharePdf() ? `<button class="btn btn-outline btn-sm" data-resend-wa="${o.invoiceId || ""}" data-order="${o.id}" data-pdf="1">📎 Resend with PDF</button>` : ""}
          <button class="btn btn-outline btn-sm" data-manual-wa="confirmed" data-inv="${o.invoiceId || ""}" data-order="${o.id}">Mark Confirmed</button>
          <button class="btn btn-outline btn-sm" data-manual-wa="cancelled" data-inv="${o.invoiceId || ""}" data-order="${o.id}">Mark Cancelled</button>`;

  const payBtn = (o.status === "billed" && o.invoiceId)
    ? `<div class="btn-row"><button class="btn btn-gold btn-sm" data-ship-wa="${o.invoiceId}" data-order="${o.id}">📦 Send Shipping Details</button></div>` : "";
  return `
    <div class="wh-card order-card">
      <div class="order-top">
        <div>
          <h3>${esc(c.name || "Unknown customer")} ${statusPill}</h3>
          <div class="muted">${esc(c.phone || "")}${c.address ? " · " + esc(c.address) : ""}</div>
          ${c.shipping ? `<div class="muted">Delivery: ${esc(c.shipping)} · Payment: ${esc(c.payment || "Online")}</div>` : ""}
        </div>
        <div class="order-total">
          <div class="muted">${fmtDateTime(o.date)}</div>
          <div class="value gold">${fmt(o.total)}</div>
        </div>
      </div>
      <table class="wh-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${itemsRows}</tbody></table>
      ${showActions && actions ? `<div class="btn-row">${actions}</div>` : ""}
      ${payBtn}
      <div class="btn-row" style="margin-top:8px;"><button class="btn btn-outline btn-sm" style="color:#E08A8A;" data-delete-order="${o.id}">🗑 Delete order</button></div>
    </div>
  `;
}

function renderOrders() {
  const pending = pendingOrders();
  const recentOther = orders.filter(o => o.status !== "pending").slice(0, 10);
  return `
    <div class="page-head"><div><h1>New Orders</h1><p>Press Send on WhatsApp: the invoice is saved and WhatsApp opens with the customer's number and the message ready (bill link + your account details). Press Send. When the payment screenshot comes, press Mark Confirmed.</p></div></div>
    <div class="wh-card">
      <h3>💳 Payment Details</h3>
      <p class="muted" style="margin-bottom:8px;">These details are added to every order's WhatsApp message (bank, account title, account number, Easypaisa / JazzCash). Save them here once.</p>
      <textarea id="payDetails" rows="4" style="width:100%;" placeholder="Bank: Meezan Bank&#10;Account Title: ...&#10;Account No: ...&#10;Easypaisa: 03xx xxxxxxx">${esc(getPayDetails())}</textarea>
      <div class="btn-row" style="margin-top:8px;"><button class="btn btn-gold btn-sm" id="savePayDetails">Save Payment Details</button></div>
    </div>
    ${orders.length ? `<div class="btn-row" style="margin:0 0 14px;"><button class="btn btn-outline btn-sm" style="color:#E08A8A;" id="deleteAllOrdersBtn">🗑 Delete all orders (${orders.length})</button></div>` : ""}
    ${pending.length ? pending.map(o => orderCardHTML(o, true)).join("")
      : `<div class="wh-empty">📦<h3>No new orders</h3><p>When a customer checks out on the store, it'll show up here instantly.</p></div>`}
    ${recentOther.length ? `<h3 class="wh-subhead">Recent Orders</h3>${recentOther.map(o => orderCardHTML(o, false)).join("")}` : ""}
  `;
}

/* PDF bill builder lives in invoice-pdf.js */


/* ============================================================
   WHATSAPP (free): one message with order details, the bill LINK,
   "pay to confirm" + your account details. Your own WhatsApp opens
   with the customer's number and the text ready — just press Send.
   The customer opens the link, sees the bill and downloads the PDF.
   Payment screenshot comes -> press Mark Confirmed -> shipping message.
   ============================================================ */
function waItemsText(lines) {
  return lines.map(l => `${l.name}${l.size ? " (" + l.size + ")" : ""} x${l.qty}`).join(", ");
}

/* the bill lives inside the link itself (no server needed) -> bill.html shows it + Download PDF */
function billLink(inv) {
  const day = String(inv.date || "").slice(0, 10).replace(/-/g, "");        // 20261004
  const o = {
    n: inv.invoiceNo, d: day, c: inv.clientName,
    l: inv.lines.map(l => [l.name, l.size || "", l.qty, l.price]),
    t: inv.total, v: Number(inv.delivery) || 0, x: Number(inv.discount) || 0,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(o));
  let bin = ""; bytes.forEach(by => { bin += String.fromCharCode(by); });
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const origin = /^https?:/.test(location.origin) ? location.origin : "";
  return origin + "/bill.html#" + b64;
}

/* ---- your account details, saved on this device ---- */
function getPayDetails() { try { return localStorage.getItem("jc_payment_details") || ""; } catch (e) { return ""; } }
function setPayDetails(t) { try { localStorage.setItem("jc_payment_details", t); } catch (e) {} }

/* withLink=false when the PDF itself is attached through the share sheet */
function waMessageText(inv, label, withLink) {
  const lines = [
    `Hello ${inv.clientName || ""},`,
    `Thank you for your order from JeweloraCraft.`,
    ``,
    `Order: ${label || inv.invoiceNo}`,
    `Invoice: ${inv.invoiceNo}`,
    `Items: ${waItemsText(inv.lines)}`,
    `Total: ${rs(inv.total)}`,
    ``,
  ];
  if (withLink !== false) lines.push(`Your bill (open the link and tap Download PDF):`, billLink(inv), ``);
  else lines.push(`Your bill is attached as a PDF.`, ``);
  lines.push(
    `To confirm your order, please pay ${rs(inv.total)} to this account:`,
    getPayDetails().trim(),
    ``,
    `After paying, send us the payment screenshot here. Once we receive the payment, your order is confirmed and we will send you the shipping details.`,
    ``,
    `To cancel the order, just reply "Cancel".`
  );
  return lines.join("\n");
}

function confirmMessageText(inv) {
  return [
    `Hello ${inv.clientName || ""},`,
    `We have received your payment and your order is confirmed.`,
    ``,
    `Invoice: ${inv.invoiceNo}`,
    `Total: ${rs(inv.total)}`,
    inv.clientAddress ? `Delivery address: ${inv.clientAddress}` : ``,
    ``,
    `Your order is being packed. We will send you the shipping and tracking details here soon.`,
    ``,
    `Thank you for shopping with JeweloraCraft.`,
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");
}

/* must run directly inside a click (no await before it) or the browser blocks the WhatsApp tab */
function openChat(inv, text, blockedHint) {
  const num = waNumber(inv.clientPhone);
  if (!num) { toast("This customer has no valid phone number."); return false; }
  const w = window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(text), "_blank");
  if (!w) toast(blockedHint || "Browser blocked WhatsApp — allow pop-ups for this site and press the button again.");
  return true;
}
function openWhatsApp(inv, label) {
  if (!getPayDetails().trim()) { toast("Please save your Payment Details (account number) on the Orders page first."); return false; }
  return openChat(inv, waMessageText(inv, label), "The browser blocked WhatsApp. Allow pop-ups for this site and press Resend.");
}
/* Real PDF attachment: the phone / computer share sheet. You pick WhatsApp and the customer, the PDF and the text are already in it.
   Only shown on devices that support sharing files. */
function canSharePdf() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(["x"], "a.pdf", { type: "application/pdf" })] })); }
  catch (e) { return false; }
}
function shareWithPdf(inv, label) {
  if (!getPayDetails().trim()) { toast("Please save your Payment Details (account number) on the Orders page first."); return false; }
  if (!window.jspdf) { toast("The PDF library did not load. Check your internet."); return false; }
  let file;
  try { file = new File([buildInvoicePdf(inv).output("blob")], inv.invoiceNo + ".pdf", { type: "application/pdf" }); }
  catch (e) { toast("Could not make the PDF: " + e.message); return false; }
  navigator.share({ files: [file], text: waMessageText(inv, label, false) })
    .catch(e => { if (!e || e.name !== "AbortError") toast("Sharing failed: " + ((e && e.message) || "unknown error")); });
  return true;
}
function openConfirmWhatsApp(inv) {
  return openChat(inv, confirmMessageText(inv), "Browser blocked WhatsApp — allow pop-ups and press 📦 Send Shipping Details.");
}
function findInvoice(invId, orderId) {
  return invoices.find(i => i.id === invId) || (orderId ? invoices.find(i => i.orderId === orderId) : null) || null;
}

function deductStock(lines) {
  lines.forEach(l => {
    const p = products.find(p => p.id === l.productId);
    if (p) p.stock = Math.max(0, p.stock - l.qty);
  });
  DB.setProducts(products);
}

/* customer answered (or owner marked it by hand) */
function applyWaStatus(inv, status) {
  if (!inv || inv.waStatus !== "awaiting") return false;
  inv.waStatus = status;
  if (status === "confirmed") deductStock(inv.lines);
  const order = inv.orderId && orders.find(o => o.id === inv.orderId);
  if (order) { order.status = status === "confirmed" ? "billed" : "cancelled"; DB.setOrders(orders); }
  DB.setInvoices(invoices);
  return true;
}

function manualWaStatus(invId, status, orderId) {
  const inv = findInvoice(invId, orderId);
  if (!inv) { toast("Invoice not found for this order."); return; }
  if (inv.waStatus !== "awaiting") { toast("This invoice is already " + (inv.waStatus || "billed") + "."); return; }
  if (status === "cancelled" && !confirm("Mark this as cancelled?")) return;
  applyWaStatus(inv, status);
  if (status === "confirmed") {
    if (openConfirmWhatsApp(inv)) toast("Confirmed — stock updated. Shipping message is ready in WhatsApp, press Send.");
  } else toast("Cancelled.");
  render();
}

function sendShipWa(invId, orderId) {
  const inv = findInvoice(invId, orderId);
  if (!inv) { toast("Invoice not found for this order."); return; }
  openConfirmWhatsApp(inv);
}

function resendWa(invId, orderId, withPdf) {
  const inv = findInvoice(invId, orderId);
  if (!inv) { toast("Invoice not found for this order."); return; }
  if (withPdf) shareWithPdf(inv, inv.orderId || inv.invoiceNo);
  else openWhatsApp(inv, inv.orderId || inv.invoiceNo);
}

/* New Orders: save invoice first, then open WhatsApp */
function sendOrderWa(orderId, withPdf) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const c = order.customer || {};
  if (!waNumber(c.phone)) { toast("This order has no phone number."); return; }
  const inv = {
    id: uid("INV"),
    invoiceNo: "JWC-INV-" + String(invoices.length + 1).padStart(4, "0"),
    date: new Date().toISOString(),
    clientName: c.name, clientPhone: c.phone, clientAddress: c.address,
    lines: order.items.filter(it => it.id !== "_shipping" && it.id !== "_discount")
      .map(it => ({ productId: it.id, name: it.name, size: it.size, qty: it.qty, price: it.price })),
    delivery: (order.items.find(it => it.id === "_shipping") || {}).price || 0,
    discount: -((order.items.find(it => it.id === "_discount") || {}).price || 0),
    total: order.total,
    source: "order", orderId: order.id, waStatus: "awaiting",
  };
  if (!getPayDetails().trim()) { toast("Please save your Payment Details (account number) on the Orders page first."); return; }
  invoices.unshift(inv); DB.setInvoices(invoices);          // 1) saved in warehouse first
  order.status = "awaiting"; order.invoiceId = inv.id; DB.setOrders(orders);
  if (withPdf) {                                             // 2a) share sheet with the PDF attached
    if (shareWithPdf(inv, order.id)) toast("Invoice saved. Choose WhatsApp and the customer, then press Send.");
  } else {                                                   // 2b) WhatsApp chat with the customer, message ready
    openWhatsApp(inv, order.id);
    toast("Invoice saved. WhatsApp is open, just press Send.");
  }
  goTo("orders");
}

async function removeOrders(ids) {
  try {
    if (window.JCFB && !JCFB.offline && JCFB.deleteDocs) await JCFB.deleteDocs("orders", ids);
  } catch (e) {
    console.error(e);
    toast("Could not delete from the cloud: " + (e && e.message ? e.message : e));
    return false;
  }
  const set = new Set(ids.map(String));
  orders = orders.filter(o => !set.has(String(o.id)));
  DB.setOrders(orders);
  return true;
}
async function deleteOrder(orderId) {
  const o = orders.find(o => o.id === orderId);
  if (!o) return;
  if (!confirm("Delete this order from " + ((o.customer || {}).name || "customer") + "? This cannot be undone.")) return;
  if (await removeOrders([orderId])) { toast("Order deleted"); render(); }
}
async function deleteAllOrders() {
  if (!orders.length) return;
  if (!confirm("Delete ALL " + orders.length + " orders? This cannot be undone.")) return;
  if (await removeOrders(orders.map(o => o.id))) { toast("All orders deleted"); render(); }
}
/* email every newsletter subscriber about a new item (sent by the /api/announce server function) */
async function announceItem(p) {
  try {
    if (!window.JCFB || JCFB.offline) throw new Error("Firebase is not available");
    const emails = await JCFB.getSubscribers();
    if (!emails.length) { toast("Item added. No subscribers to email yet."); return; }
    const idToken = await JCFB.token();
    const res = await fetch("/api/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken, emails,
        product: {
          name: p.name, price: p.discountPrice,
          oldPrice: p.price > p.discountPrice ? p.price : 0,
          image: /^https?:\/\//.test(p.image || "") ? p.image : "",
          url: location.origin + "/product.html?id=" + encodeURIComponent(p.id),
        },
        siteUrl: location.origin,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ("Server error " + res.status));
    toast("Email sent to " + data.sent + " subscriber" + (data.sent === 1 ? "" : "s") + ".");
  } catch (e) {
    console.error(e);
    toast("Item added, but the subscriber email failed: " + (e && e.message ? e.message : e));
  }
}
function dismissOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  order.status = "dismissed";
  DB.setOrders(orders);
  toast("Order dismissed");
  goTo("orders");
}

/* ============================================================
   INVENTORY
   ============================================================ */
function renderInventory() {
  return `
    <div class="page-head"><div><h1>Inventory</h1><p>Update stock levels and prices — changes reflect on the store instantly.</p></div></div>

    <form id="addItemForm" class="wh-card add-item-form">
      <h3>Add New Item</h3>
      <div class="form-row">
        <label>Name<input type="text" id="newItemName" required></label>
        <label>Category
          <select id="newItemCategory">${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>
        </label>
        <label>Subcategory
          <select id="newItemSub"></select>
        </label>
      </div>
      <div class="form-row">
        <label>Price (PKR)<input type="number" id="newItemPrice" min="0" required></label>
        <label>Stock<input type="number" id="newItemStock" min="0" required></label>
      </div>
      <label>Photo (optional)
        <input type="file" id="newItemImageFile" accept="image/*">
      </label>
      <p class="muted" style="margin:-8px 0 14px;font-size:.72rem;">Upload a photo from your device, or leave blank to use a placeholder — you can add one later from the table below.</p>
      <label style="display:flex;align-items:center;gap:8px;margin:0 0 14px;"><input type="checkbox" id="newItemNotify" checked style="width:auto;"> Email this new item to newsletter subscribers <span class="muted" id="subCount"></span></label>
      <button type="submit" class="btn btn-gold btn-sm">Add Item</button>
    </form>

    <input type="search" id="invenSearch" placeholder="Search items by name, code or category…" style="max-width:380px;margin-bottom:14px;">
    ${products.length ? "" : `<div class="wh-empty">💎<h3>No items yet</h3><p>Add your first item using the form above.</p></div>`}
    <table class="wh-table inventory-table">
      <thead><tr><th>Photo</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody id="invenBody">
        ${products.map(p => `
          <tr class="${p.stock <= 6 ? "row-low" : ""}" data-q="${esc((p.name + " " + (p.sku || "") + " " + categoryName(categories, p.category) + " " + (((categories.find(c => c.id === p.category) || {}).subs || []).find(s => s.id === p.subcategory) || {}).name).toLowerCase())}">
            <td>
              <img class="inv-thumb" src="${p.image}" alt="${esc(p.name)}">
              <input type="file" accept="image/*" class="inv-file-input" data-image-file="${p.id}">
              <button type="button" class="btn-link" data-change-image="${p.id}">Change</button>
            </td>
            <td>${esc(p.name)}<div class="muted">${esc(p.sku || "")}</div></td>
            <td>${esc(categoryName(categories, p.category))}${p.subcategory ? ` <span class="muted">› ${esc(((categories.find(c => c.id === p.category) || {}).subs || []).find(s => s.id === p.subcategory)?.name || p.subcategory)}</span>` : ""}</td>
            <td><input type="number" min="0" value="${p.discountPrice}" data-price="${p.id}"></td>
            <td><input type="number" min="0" value="${p.stock}" data-stock="${p.id}"></td>
            <td>
              <button type="button" class="btn-link" data-edit-item="${p.id}">Edit</button>
              <button class="btn-link danger" data-del-item="${p.id}">Remove</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function updateProductField(id, field, value) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  p[field] = Math.max(0, value);
  DB.setProducts(products);
}

/* ============================================================
   CATEGORIES
   ============================================================ */
/* fills a subcategory <select> based on the chosen category */
function fillSubSelect(catId, subId, selected) {
  const catEl = document.getElementById(catId), subEl = document.getElementById(subId);
  if (!catEl || !subEl) return;
  const c = categories.find(c => c.id === catEl.value);
  const subs = c && Array.isArray(c.subs) ? c.subs : [];
  subEl.innerHTML = `<option value="">— None —</option>` + subs.map(s => `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${esc(s.name)}</option>`).join("");
}

function renderCategories() {
  return `
    <div class="page-head"><div><h1>Categories</h1><p>Categories and their tile photos, shown on the storefront homepage and filter bar.</p></div></div>
    <form id="addCategoryForm" class="wh-card add-item-form">
      <h3>Add New Category</h3>
      <div class="form-row">
        <label>Name<input type="text" id="newCategoryName" placeholder="e.g. Anklets" required></label>
        <label>Photo (optional)<input type="file" id="newCategoryImageFile" accept="image/*"></label>
      </div>
      <button class="btn btn-gold btn-sm" type="submit">Add Category</button>
    </form>
    <p class="muted" style="margin:10px 0">All categories appear in the website menu bar. Tick <b>Show on homepage</b> for up to 3 of them (${categories.filter(c => c.home).length}/3 ticked) — only those appear as tiles on the homepage.</p>
    <ul class="wh-list cat-list">
      ${categories.map(c => {
        const count = products.filter(p => p.category === c.id).length;
        const subs = Array.isArray(c.subs) ? c.subs : [];
        return `
          <li class="cat-block">
            <div class="cat-head">
              <span class="cat-list-left">
                <img class="inv-thumb" src="${c.image}" alt="${esc(c.name)}">
                ${esc(c.name)} <span class="muted">(${count} items)</span>
              </span>
              <span class="cat-list-right">
                <label class="home-toggle"><input type="checkbox" data-home-cat="${c.id}" ${c.home ? "checked" : ""}> Show on homepage</label>
                <input type="file" accept="image/*" class="inv-file-input" data-cat-image-file="${c.id}">
                <button type="button" class="btn-link" data-rename-cat="${c.id}">Rename</button>
                <button type="button" class="btn-link" data-change-cat-image="${c.id}">Change Photo</button>
                <button class="del-cat" data-del-cat="${c.id}" title="Remove">✕</button>
              </span>
            </div>
            <div class="cat-subs">
              <span class="muted">Subcategories:</span>
              ${subs.map(s => `<span class="sub-pill">${esc(s.name)} <button type="button" data-del-sub="${c.id}|${s.id}" title="Remove">✕</button></span>`).join("")}
              <span class="sub-add">
                <input type="text" placeholder="Add subcategory" data-sub-input="${c.id}">
                <button type="button" class="btn btn-gold btn-sm" data-add-sub="${c.id}">Add</button>
              </span>
            </div>
          </li>
        `;
      }).join("")}
    </ul>
  `;
}

/* ============================================================
   NEW INVOICE (manual billing)
   ============================================================ */
function renderNewInvoice() {
  const d = state.invoiceDraft;
  const lineRows = d.lines.map((l, i) => `
    <tr>
      <td>${esc(l.name)}</td>
      <td>${l.qty}</td>
      <td class="num">${fmt(l.price)}</td>
      <td class="num">${fmt(l.price * l.qty)}</td>
      <td><button class="btn-link danger" data-remove-line="${i}">✕</button></td>
    </tr>
  `).join("");
  const total = d.lines.reduce((s, l) => s + l.price * l.qty, 0);

  return `
    <div class="page-head"><div><h1>New Invoice</h1><p>Create an invoice. If you enter a phone number, the customer gets a WhatsApp Confirm / Cancel message and the PDF bill is sent automatically once they confirm.</p></div></div>

    <div class="wh-card">
      <h3>Client Details</h3>
      <div class="form-row">
        <label>Name<input type="text" id="invClientName" value="${esc(d.name)}"></label>
        <label>Phone<input type="text" id="invClientPhone" value="${esc(d.phone)}"></label>
      </div>
      <label>Address<input type="text" id="invClientAddress" value="${esc(d.address)}"></label>
    </div>

    <div class="wh-card">
      <h3>Items</h3>
      <div class="form-row add-line-row">
        ${comboHTML("lineSearch", "lineProduct", "", "Item ka naam likhein…")}
        <input type="number" id="lineQty" min="1" value="1" style="max-width:90px;">
        <button type="button" class="btn btn-outline btn-sm" id="addLineBtn">Add Item</button>
      </div>
      ${d.lines.length ? `
        <table class="wh-table" style="margin-top:14px;">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th><th></th></tr></thead>
          <tbody>${lineRows}</tbody>
        </table>
        <div class="invoice-total-row">Total <strong>${fmt(total)}</strong></div>
        <button class="btn btn-gold" id="generateInvoiceBtn">Generate Invoice</button>
      ` : `<p class="muted" style="margin-top:14px;">No items added yet.</p>`}
    </div>
  `;
}

function addInvoiceLine() {
  const productSelect = document.getElementById("lineProduct");
  const qtyInput = document.getElementById("lineQty");
  const p = products.find(p => p.id === productSelect.value);
  const qty = Math.max(1, parseInt(qtyInput.value || "1", 10));
  if (!p) return;
  const existing = state.invoiceDraft.lines.find(l => l.productId === p.id);
  if (existing) existing.qty += qty;
  else state.invoiceDraft.lines.push({ productId: p.id, name: p.name, price: p.discountPrice, qty });
  render();
}

function generateInvoice() {
  const d = state.invoiceDraft;
  if (d.lines.length === 0) return;
  const total = d.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const invoice = {
    id: uid("INV"),
    invoiceNo: "JWC-INV-" + String(invoices.length + 1).padStart(4, "0"),
    date: new Date().toISOString(),
    clientName: (document.getElementById("invClientName").value || d.name || "Walk-in Customer"),
    clientPhone: (document.getElementById("invClientPhone").value || d.phone || ""),
    clientAddress: (document.getElementById("invClientAddress").value || d.address || ""),
    lines: d.lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, price: l.price })),
    total,
    source: "manual",
  };
  if (waNumber(invoice.clientPhone)) {
    // has a phone number -> save first, then WhatsApp; stock moves only after Mark Confirmed
    if (!getPayDetails().trim()) { toast("Please save your Payment Details (account number) on the Orders page first."); return; }
    invoice.waStatus = "awaiting";
    invoices.unshift(invoice); DB.setInvoices(invoices);
    openWhatsApp(invoice, invoice.invoiceNo);
    toast("Invoice saved. WhatsApp is open, just press Send.");
  } else {
    // walk-in without a number: bill straight away
    deductStock(invoice.lines);
    invoices.unshift(invoice); DB.setInvoices(invoices);
    toast("Invoice " + invoice.invoiceNo + " generated.");
  }
  state.invoiceDraft = { name: "", phone: "", address: "", lines: [] };
  state.viewingInvoiceId = invoice.id;
  goTo("invoice-view");
}
function renderInvoiceHistory() {
  return `
    <div class="page-head"><div><h1>Invoice History</h1><p>Every invoice billed, newest first.</p></div></div>
    ${invoices.length ? `
      <table class="wh-table">
        <thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${invoices.map(inv => `
            <tr>
              <td>${esc(inv.invoiceNo)}</td>
              <td>${esc(inv.clientName)}</td>
              <td>${fmtDate(inv.date)}</td>
              <td class="num">${fmt(inv.total)}</td>
              <td><button class="btn btn-outline btn-sm" data-view-invoice="${inv.id}">View</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `<div class="wh-empty">🧾<h3>No invoices yet</h3><p>Bill an order or create a manual invoice to see it here.</p></div>`}
  `;
}

const rs = n => "Rs. " + Number(n || 0).toLocaleString("en-US");
function itemCode(name) {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "—";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function renderInvoiceView() {
  const inv = invoices.find(i => i.id === state.viewingInvoiceId);
  if (!inv) return `<p class="muted">Invoice not found.</p><button class="btn btn-outline" data-nav="invoices">Back</button>`;
  const subtotal = inv.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = Number(inv.delivery) || 0, discount = Number(inv.discount) || 0;
  const rows = inv.lines.map(l => `
    <tr>
      <td><span class="iv-code">${esc(itemCode(l.name))}</span><span class="iv-name">${esc(l.name)}${l.size ? `<small>${esc(l.size)}</small>` : ""}</span></td>
      <td class="iv-qty">${l.qty} pc</td>
      <td class="iv-num iv-teal">${rs(l.price)}</td>
      <td class="iv-num iv-teal">${rs(l.price * l.qty)}</td>
    </tr>`).join("");
  return `
    <div class="page-head no-print"><div><h1>Invoice</h1><p>${esc(inv.invoiceNo)}</p></div>
      <div class="btn-row">
        <button class="btn btn-outline btn-sm" data-nav="invoices">Invoice History</button>
        <button class="btn btn-outline btn-sm" data-nav="new-invoice">+ New Invoice</button>
        ${inv.waStatus === "awaiting" ? `<span class="muted">⏳ Waiting for customer payment</span>
          <button class="btn btn-gold btn-sm" data-resend-wa="${inv.id}">🔁 Resend</button>
          ${canSharePdf() ? `<button class="btn btn-outline btn-sm" data-resend-wa="${inv.id}" data-pdf="1">📎 Resend with PDF</button>` : ""}
          <button class="btn btn-outline btn-sm" data-manual-wa="confirmed" data-inv="${inv.id}">Mark Confirmed</button>
          <button class="btn btn-outline btn-sm" data-manual-wa="cancelled" data-inv="${inv.id}">Mark Cancelled</button>` : ""}
        ${inv.waStatus === "confirmed" ? `<button class="btn btn-gold btn-sm" data-ship-wa="${inv.id}">📦 Send Shipping Details</button>` : ""}
        ${inv.waStatus === "cancelled" ? `<span class="pill low">cancelled by customer</span>` : ""}
        <button class="btn btn-gold btn-sm" id="printInvoiceBtn">Print / Save PDF</button>
      </div>
    </div>
    <div class="invoice-sheet iv">
      <div class="iv-brand">JeweloraCraft</div>
      <div class="iv-tag">Handcrafted Jewellery</div>
      <div class="iv-meta">
        <div class="iv-lbl">Invoice No.</div>
        <div class="iv-no">${esc(inv.invoiceNo)}</div>
        <div class="iv-lbl">Date: ${fmtDate(inv.date)}</div>
      </div>
      <div class="iv-perf"></div>
      <h2 class="iv-client">${esc(inv.clientName)}</h2>
      ${(inv.clientPhone || inv.clientAddress) ? `<div class="iv-contact">${esc(inv.clientPhone || "")}${inv.clientPhone && inv.clientAddress ? " · " : ""}${esc(inv.clientAddress || "")}</div>` : ""}
      <div class="iv-scroll">
        <table class="iv-table">
          <thead><tr><th>Item</th><th class="iv-c">Quantity</th><th class="iv-r iv-teal">Price</th><th class="iv-r iv-teal">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="iv-totals">
        <div class="iv-line"><span>Items Subtotal</span><b>${rs(subtotal)}</b></div>
        ${discount ? `<div class="iv-line"><span>Discount</span><b>− ${rs(discount)}</b></div>` : ""}
        ${delivery ? `<div class="iv-line"><span>Delivery Charges</span><b>${rs(delivery)}</b></div>` : ""}
        <div class="iv-line iv-grand"><span>Total Price</span><b>${rs(inv.total)}</b></div>
      </div>
      <div class="iv-foot"><b>JEWELORACRAFT</b><span>Handcrafted Jewellery</span></div>
    </div>
  `;
}

/* ============================================================
   MONTHLY EARNINGS
   ============================================================ */
function monthlyEarnings() {
  const map = {};
  invoices.filter(isCounted).forEach(inv => {
    const key = (inv.date || "").slice(0, 7);
    if (!key) return;
    if (!map[key]) map[key] = { key, total: 0, count: 0 };
    map[key].total += inv.total;
    map[key].count += 1;
  });
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}

function renderEarnings() {
  const months = monthlyEarnings();
  const max = Math.max(1, ...months.map(m => m.total));
  return `
    <div class="page-head"><div><h1>Monthly Earnings</h1><p>Revenue from all billed invoices, grouped by month.</p></div></div>
    ${months.length ? `
      <div class="wh-card">
        ${months.map(m => `
          <div class="earn-row">
            <div class="earn-month">${new Date(m.key + "-02").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
            <div class="earn-bar-wrap"><div class="earn-bar" style="width:${(m.total / max * 100).toFixed(1)}%"></div></div>
            <div class="earn-total">${fmt(m.total)}</div>
            <div class="earn-count muted">${m.count} invoice${m.count === 1 ? "" : "s"}</div>
          </div>
        `).join("")}
      </div>
    ` : `<div class="wh-empty">📈<h3>No earnings yet</h3><p>Billed invoices will show up here month by month.</p></div>`}
  `;
}

/* ============================================================
   CLIENTS
   ============================================================ */
function renderClients() {
  const map = {};
  invoices.filter(isCounted).forEach(inv => {
    const key = (inv.clientPhone || inv.clientName || "").toLowerCase();
    if (!map[key]) map[key] = { name: inv.clientName, phone: inv.clientPhone, total: 0, count: 0, last: inv.date };
    map[key].total += inv.total;
    map[key].count += 1;
    if (inv.date > map[key].last) map[key].last = inv.date;
  });
  const clients = Object.values(map).sort((a, b) => b.total - a.total);

  return `
    <div class="page-head"><div><h1>Clients</h1><p>Everyone who has been billed an invoice, ranked by spend.</p></div></div>
    ${clients.length ? `
      <table class="wh-table">
        <thead><tr><th>Client</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>Last Order</th></tr></thead>
        <tbody>
          ${clients.map(c => `
            <tr>
              <td>${esc(c.name)}</td>
              <td>${esc(c.phone || "—")}</td>
              <td>${c.count}</td>
              <td class="num">${fmt(c.total)}</td>
              <td>${fmtDate(c.last)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    ` : `<div class="wh-empty">🧑‍🤝‍🧑<h3>No clients yet</h3><p>Clients appear here after their first invoice is billed.</p></div>`}
  `;
}

/* ============================================================
   EDIT ITEM MODAL (full details, from Inventory)
   ============================================================ */
function openEditItemModal(id) {
  const p = products.find(p => p.id === id);
  if (!p) return;
  const wrap = document.createElement("div");
  wrap.className = "overlay open";
  wrap.id = "editItemOverlay";
  wrap.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="editItemClose">✕</button>
      <h3>Edit Item</h3>
      <div class="form-row">
        <label>Name<input type="text" id="editName" value="${esc(p.name)}" required></label>
        <label>Category
          <select id="editCategory">${categories.map(c => `<option value="${c.id}" ${c.id === p.category ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        </label>
        <label>Subcategory
          <select id="editSub"></select>
        </label>
      </div>
      <div class="form-row">
        <label>Price (PKR)<input type="number" id="editPrice" min="0" value="${p.discountPrice}" required></label>
        <label>Stock<input type="number" id="editStock" min="0" value="${p.stock}" required></label>
      </div>
      <div class="form-row">
        <label>Original Price (for strike-through, optional)<input type="number" id="editOldPrice" min="0" value="${p.price || p.discountPrice}"></label>
        <label>SKU<input type="text" id="editSku" value="${esc(p.sku || "")}"></label>
      </div>
      <label>Sizes / Variants (comma separated)<input type="text" id="editSizes" value="${esc((p.sizes || []).join(", "))}"></label>
      <label>Material<input type="text" id="editMaterial" value="${esc(p.material || "")}"></label>
      <label>Description<textarea id="editDesc" rows="3">${esc(p.desc || "")}</textarea></label>
      <label class="edit-featured-row"><input type="checkbox" id="editFeatured" ${p.featured ? "checked" : ""} style="width:auto;display:inline-block;margin:0 8px 0 0;">Show in "Trending Now" on the homepage</label>
      <button type="submit" class="btn btn-gold btn-block" id="editItemSave">Save Changes</button>
    </div>
  `;
  document.body.appendChild(wrap);
  fillSubSelect("editCategory", "editSub", p.subcategory);
  document.getElementById("editCategory").addEventListener("change", () => fillSubSelect("editCategory", "editSub", ""));
  document.getElementById("editItemClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.getElementById("editItemSave").addEventListener("click", (e) => {
    e.preventDefault();
    p.name = document.getElementById("editName").value.trim() || p.name;
    p.category = document.getElementById("editCategory").value;
    p.subcategory = document.getElementById("editSub").value;
    if (!p.subcategory) delete p.subcategory;
    p.discountPrice = Math.max(0, parseInt(document.getElementById("editPrice").value || "0", 10));
    p.stock = Math.max(0, parseInt(document.getElementById("editStock").value || "0", 10));
    p.price = Math.max(p.discountPrice, parseInt(document.getElementById("editOldPrice").value || "0", 10));
    p.sku = document.getElementById("editSku").value.trim();
    p.sizes = document.getElementById("editSizes").value.split(",").map(s => s.trim()).filter(Boolean);
    if (p.sizes.length === 0) p.sizes = ["One Size"];
    p.material = document.getElementById("editMaterial").value.trim();
    p.desc = document.getElementById("editDesc").value.trim();
    p.featured = document.getElementById("editFeatured").checked;
    DB.setProducts(products);
    wrap.remove();
    toast("Item updated");
    goTo("inventory");
  });
}

/* ============================================================
   CHANGE PASSWORD MODAL
   ============================================================ */
function openChangePasswordModal() {
  const wrap = document.createElement("div");
  wrap.className = "overlay open";
  wrap.id = "pwOverlay";
  wrap.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="pwClose">✕</button>
      <h3>Change Warehouse Password</h3>
      <form id="pwForm">
        <label>Current Password<input type="password" id="pwCurrent" required></label>
        <label>New Password<input type="password" id="pwNew" minlength="4" required></label>
        <label>Confirm New Password<input type="password" id="pwConfirm" minlength="4" required></label>
        <p class="form-error" id="pwError"></p>
        <button type="submit" class="btn btn-gold btn-block">Update Password</button>
      </form>
    </div>
  `;
  document.body.appendChild(wrap);
  document.getElementById("pwClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.getElementById("pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const current = document.getElementById("pwCurrent").value;
    const next = document.getElementById("pwNew").value;
    const confirm = document.getElementById("pwConfirm").value;
    const auth = DB.getAuth();
    const currentHash = await sha256Hex(current);
    if (currentHash !== auth.passwordHash) {
      document.getElementById("pwError").textContent = "Current password is incorrect.";
      return;
    }
    if (next !== confirm) {
      document.getElementById("pwError").textContent = "New passwords don't match.";
      return;
    }
    const newHash = await sha256Hex(next);
    DB.setAuth({ passwordHash: newHash });
    wrap.remove();
    toast("Password updated");
  });
}

/* ============================================================
   Toast
   ============================================================ */
let toastTimer;
function toast(msg) {
  let el = document.getElementById("whToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "whToast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ============================================================
   View-specific event binding (re-run after every render)
   ============================================================ */
function bindViewEvents() {
  // dashboard / invoice history / orders — view invoice
  app.querySelectorAll("[data-view-invoice]").forEach(btn => btn.addEventListener("click", () => {
    state.viewingInvoiceId = btn.dataset.viewInvoice;
    goTo("invoice-view");
  }));

  // orders
  app.querySelectorAll("[data-wa-order]").forEach(btn => btn.addEventListener("click", () => sendOrderWa(btn.dataset.waOrder, btn.dataset.pdf === "1")));
  app.querySelectorAll("[data-manual-wa]").forEach(btn => btn.addEventListener("click", () => manualWaStatus(btn.dataset.inv, btn.dataset.manualWa, btn.dataset.order)));
  app.querySelectorAll("[data-ship-wa]").forEach(btn => btn.addEventListener("click", () => sendShipWa(btn.dataset.shipWa, btn.dataset.order)));
  const savePay = document.getElementById("savePayDetails");
  if (savePay) savePay.addEventListener("click", () => { setPayDetails(document.getElementById("payDetails").value); toast("Payment details saved."); });
  app.querySelectorAll("[data-resend-wa]").forEach(btn => btn.addEventListener("click", () => resendWa(btn.dataset.resendWa, btn.dataset.order, btn.dataset.pdf === "1")));
  app.querySelectorAll("[data-delete-order]").forEach(btn => btn.addEventListener("click", () => deleteOrder(btn.dataset.deleteOrder)));
  const delAll = document.getElementById("deleteAllOrdersBtn");
  if (delAll) delAll.addEventListener("click", deleteAllOrders);
  app.querySelectorAll("[data-dismiss-order]").forEach(btn => btn.addEventListener("click", () => dismissOrder(btn.dataset.dismissOrder)));

  // inventory
  fillSubSelect("newItemCategory", "newItemSub", "");
  const newCatSel = document.getElementById("newItemCategory");
  if (newCatSel) newCatSel.addEventListener("change", () => fillSubSelect("newItemCategory", "newItemSub", ""));
  const addItemForm = document.getElementById("addItemForm");
  const subCountEl = document.getElementById("subCount");
  if (subCountEl && window.JCFB && JCFB.getSubscribers) JCFB.getSubscribers().then(l => { subCountEl.textContent = "(" + l.length + " subscriber" + (l.length === 1 ? "" : "s") + ")"; }).catch(() => {});
  if (addItemForm) addItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newItemName").value.trim();
    const category = document.getElementById("newItemCategory").value;
    const subcategory = document.getElementById("newItemSub").value;
    const price = Math.max(0, parseInt(document.getElementById("newItemPrice").value || "0", 10));
    const stock = Math.max(0, parseInt(document.getElementById("newItemStock").value || "0", 10));
    const fileInput = document.getElementById("newItemImageFile");
    if (!name) return;
    let image = "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900&auto=format&fit=crop";
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try { image = await fileToResizedDataURL(fileInput.files[0]); }
      catch (err) { toast("Could not read that photo, using a placeholder"); }
    }
    products.push({
      id: uid("prod"), name, category, ...(subcategory ? { subcategory } : {}), price, discountPrice: price, stock,
      sku: "JWC-" + uid("NEW"), sizes: ["One Size"], desc: "", material: "", featured: false,
      image,
    });
    DB.setProducts(products);
    const notifyBox = document.getElementById("newItemNotify");
    const newProduct = products[products.length - 1];
    toast("Item added");
    goTo("inventory");
    if (notifyBox && notifyBox.checked) announceItem(newProduct);
  });
  app.querySelectorAll("[data-price]").forEach(input => input.addEventListener("change", () => {
    updateProductField(input.dataset.price, "discountPrice", parseInt(input.value || "0", 10));
    toast("Price updated");
  }));
  app.querySelectorAll("[data-stock]").forEach(input => input.addEventListener("change", () => {
    updateProductField(input.dataset.stock, "stock", parseInt(input.value || "0", 10));
    toast("Stock updated");
  }));
  app.querySelectorAll("[data-edit-item]").forEach(btn => btn.addEventListener("click", () => openEditItemModal(btn.dataset.editItem)));
  app.querySelectorAll("[data-del-item]").forEach(btn => btn.addEventListener("click", () => {
    products = products.filter(p => p.id !== btn.dataset.delItem);
    DB.setProducts(products);
    toast("Item removed");
    goTo("inventory");
  }));

  // inventory — change an existing item's photo
  app.querySelectorAll("[data-change-image]").forEach(btn => btn.addEventListener("click", () => {
    const fileInput = app.querySelector(`[data-image-file="${btn.dataset.changeImage}"]`);
    if (fileInput) fileInput.click();
  }));
  app.querySelectorAll("[data-image-file]").forEach(input => input.addEventListener("change", async () => {
    const id = input.dataset.imageFile;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataURL(file);
      const p = products.find(p => p.id === id);
      if (p) { p.image = dataUrl; DB.setProducts(products); }
      toast("Photo updated");
      goTo("inventory");
    } catch (err) {
      toast("Could not read that photo");
    }
  }));

  // categories
  const addCategoryForm = document.getElementById("addCategoryForm");
  if (addCategoryForm) addCategoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("newCategoryName");
    const fileInput = document.getElementById("newCategoryImageFile");
    const name = input.value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (categories.some(c => c.id === id)) { toast("Category already exists"); return; }
    let image = "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=700&auto=format&fit=crop";
    if (fileInput && fileInput.files && fileInput.files[0]) {
      try { image = await fileToResizedDataURL(fileInput.files[0]); }
      catch (err) { toast("Could not read that photo, using a placeholder"); }
    }
    categories.push({ id, name, image });
    DB.setCategories(categories);
    toast("Category added");
    goTo("categories");
  });
  app.querySelectorAll("[data-change-cat-image]").forEach(btn => btn.addEventListener("click", () => {
    const fileInput = app.querySelector(`[data-cat-image-file="${btn.dataset.changeCatImage}"]`);
    if (fileInput) fileInput.click();
  }));
  app.querySelectorAll("[data-cat-image-file]").forEach(input => input.addEventListener("change", async () => {
    const id = input.dataset.catImageFile;
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataURL(file);
      const c = categories.find(c => c.id === id);
      if (c) { c.image = dataUrl; DB.setCategories(categories); }
      toast("Category photo updated");
      goTo("categories");
    } catch (err) {
      toast("Could not read that photo");
    }
  }));
  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  app.querySelectorAll("[data-home-cat]").forEach(cb => cb.addEventListener("change", () => {
    const c = categories.find(c => c.id === cb.dataset.homeCat);
    if (!c) return;
    if (cb.checked && categories.filter(x => x.home && x.id !== c.id).length >= 3) {
      cb.checked = false; toast("Only 3 categories can be shown on the homepage"); return;
    }
    c.home = cb.checked; DB.setCategories(categories);
    toast(c.home ? "Will show on homepage" : "Removed from homepage"); goTo("categories");
  }));
  app.querySelectorAll("[data-rename-cat]").forEach(btn => btn.addEventListener("click", () => {
    const c = categories.find(c => c.id === btn.dataset.renameCat);
    const name = c && prompt("New category name", c.name);
    if (!name || !name.trim()) return;
    c.name = name.trim(); DB.setCategories(categories); toast("Category renamed"); goTo("categories");
  }));
  app.querySelectorAll("[data-add-sub]").forEach(btn => btn.addEventListener("click", () => {
    const c = categories.find(c => c.id === btn.dataset.addSub);
    const input = app.querySelector(`[data-sub-input="${btn.dataset.addSub}"]`);
    const name = input && input.value.trim();
    if (!c || !name) return;
    c.subs = c.subs || [];
    const id = slug(name);
    if (!id || c.subs.some(s => s.id === id)) { toast("Subcategory already exists"); return; }
    c.subs.push({ id, name }); DB.setCategories(categories); toast("Subcategory added"); goTo("categories");
  }));
  app.querySelectorAll("[data-sub-input]").forEach(inp => inp.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); app.querySelector(`[data-add-sub="${inp.dataset.subInput}"]`).click(); }
  }));
  app.querySelectorAll("[data-del-sub]").forEach(btn => btn.addEventListener("click", () => {
    const [cid, sid] = btn.dataset.delSub.split("|");
    const c = categories.find(c => c.id === cid);
    if (!c) return;
    c.subs = (c.subs || []).filter(s => s.id !== sid);
    let changed = false;
    products.forEach(p => { if (p.category === cid && p.subcategory === sid) { delete p.subcategory; changed = true; } });
    if (changed) DB.setProducts(products);
    DB.setCategories(categories); toast("Subcategory removed"); goTo("categories");
  }));
  app.querySelectorAll("[data-del-cat]").forEach(btn => btn.addEventListener("click", () => {
    categories = categories.filter(c => c.id !== btn.dataset.delCat);
    DB.setCategories(categories);
    toast("Category removed");
    goTo("categories");
  }));

  // new invoice — keep typed client details in state across re-renders
  const invName = document.getElementById("invClientName");
  const invPhone = document.getElementById("invClientPhone");
  const invAddress = document.getElementById("invClientAddress");
  if (invName) invName.addEventListener("input", () => { state.invoiceDraft.name = invName.value; });
  if (invPhone) invPhone.addEventListener("input", () => { state.invoiceDraft.phone = invPhone.value; });
  if (invAddress) invAddress.addEventListener("input", () => { state.invoiceDraft.address = invAddress.value; });

  const addLineBtn = document.getElementById("addLineBtn");
  if (addLineBtn) addLineBtn.addEventListener("click", addInvoiceLine);
  app.querySelectorAll("[data-remove-line]").forEach(btn => btn.addEventListener("click", () => {
    state.invoiceDraft.lines.splice(+btn.dataset.removeLine, 1);
    render();
  }));
  const genBtn = document.getElementById("generateInvoiceBtn");
  if (genBtn) genBtn.addEventListener("click", generateInvoice);

  // invoice view
  const printBtn = document.getElementById("printInvoiceBtn");
  if (printBtn) printBtn.addEventListener("click", () => {
    const inv = invoices.find(i => i.id === state.viewingInvoiceId);
    const oldTitle = document.title;
    if (inv) document.title = inv.invoiceNo + " - " + inv.clientName;
    window.print();
    setTimeout(() => { document.title = oldTitle; }, 1000);
  });
}

/* ============================================================
   Init
   ============================================================ */
render();


/* ============================================================
   EXTRAS (ported from the reference): Multi-Client Orders,
   invoice search/filter, client + month drill-down
   ============================================================ */
state.invFilter = null;
state.bulkDraft = { productId: "", price: 0, rows: [] };
state.viewingBatch = null;

function batches() {
  const map = {};
  invoices.filter(i => i.bulkId).forEach(i => {
    const b = map[i.bulkId] || (map[i.bulkId] = { id: i.bulkId, item: i.lines[0].name, date: i.date, qty: 0, total: 0, invs: [] });
    b.qty += i.lines[0].qty; b.total += i.total; b.invs.push(i);
  });
  return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
}

function renderBulkList() {
  const list = batches();
  return `
    <div class="page-head"><div><h1>Multi-Client Orders</h1><p>Sell one item to many clients in a single batch — one invoice per client.</p></div>
      <button class="btn btn-gold btn-sm" id="newBulkBtn">+ New Multi-Client Order</button></div>
    ${list.length ? `<table class="wh-table"><thead><tr><th>Item</th><th>Date</th><th>Clients</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>
      ${list.map(b => `<tr><td>${esc(b.item)}</td><td>${fmtDate(b.date)}</td><td>${b.invs.length}</td><td>${b.qty}</td><td class="num">${fmt(b.total)}</td>
      <td><button class="btn btn-outline btn-sm" data-bulk-view="${b.id}">View</button> <button class="btn-link danger" data-bulk-del="${b.id}">Delete</button></td></tr>`).join("")}
    </tbody></table>` : `<div class="wh-empty">📦<h3>No multi-client orders yet</h3><p>Create one to bill several clients for the same item at once.</p></div>`}`;
}

function bulkTotals() {
  const d = state.bulkDraft;
  const qty = d.rows.reduce((s, r) => s + (r.qty || 0), 0);
  return { qty, amount: qty * d.price };
}

function renderBulkInvoice() {
  const d = state.bulkDraft;
  if (!d.productId && products.length) { d.productId = products[0].id; d.price = products[0].discountPrice; }
  const p = products.find(x => x.id === d.productId);
  const t = bulkTotals();
  return `
    <div class="page-head"><div><h1>New Multi-Client Order</h1><p>Pick an item, then list each client and their quantity.</p></div>
      <button class="btn btn-outline btn-sm" id="bulkCancel">Cancel</button></div>
    <div class="wh-card"><div class="form-row">
      <label>Item${comboHTML("bulkSearch", "bulkProduct", d.productId, "Item ka naam likhein…")}</label>
      <label>Unit price (PKR)<input type="number" id="bulkPrice" min="0" value="${d.price}"></label></div></div>
    <div class="wh-card"><h3>Clients</h3>
      <table class="wh-table"><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Qty</th><th></th></tr></thead><tbody>
      ${d.rows.map((r, i) => `<tr>
        <td><input data-brow="${i}" data-f="name" value="${esc(r.name)}"></td>
        <td><input data-brow="${i}" data-f="phone" value="${esc(r.phone)}"></td>
        <td><input data-brow="${i}" data-f="address" value="${esc(r.address)}"></td>
        <td><input type="number" min="1" data-brow="${i}" data-f="qty" value="${r.qty}" style="width:70px"></td>
        <td><button class="btn-link danger" data-brow-del="${i}">✕</button></td></tr>`).join("")}
      </tbody></table>
      <div class="btn-row"><button class="btn btn-outline btn-sm" id="bulkAddRow">+ Add Client</button></div>
      <div class="invoice-total-row">Total qty <strong id="bulkQty">${t.qty}</strong> / stock ${p ? p.stock : 0} &nbsp; Amount <strong id="bulkAmt">${fmt(t.amount)}</strong></div>
      <button class="btn btn-gold" id="bulkSave">Create ${d.rows.length || ""} Invoice${d.rows.length === 1 ? "" : "s"}</button></div>`;
}

function saveBulk() {
  const d = state.bulkDraft, p = products.find(x => x.id === d.productId);
  const rows = d.rows.filter(r => r.name.trim() && r.qty > 0);
  if (!p || !rows.length) return toast("Add at least one client with a name and quantity");
  const need = rows.reduce((s, r) => s + r.qty, 0);
  if (need > p.stock) return toast("Only " + p.stock + " in stock, you need " + need);
  const bulkId = uid("BULK"), now = new Date().toISOString();
  rows.forEach((r, i) => invoices.unshift({
    id: uid("INV") + i, invoiceNo: "JWC-INV-" + String(invoices.length + 1).padStart(4, "0"), date: now,
    clientName: r.name.trim(), clientPhone: r.phone.trim(), clientAddress: r.address.trim(),
    lines: [{ name: p.name, qty: r.qty, price: d.price }], total: r.qty * d.price, source: "bulk", bulkId, productId: p.id,
  }));
  p.stock -= need;
  DB.setProducts(products); DB.setInvoices(invoices);
  state.bulkDraft = { productId: "", price: 0, rows: [] };
  toast(rows.length + " invoices created");
  goTo("bulk-orders");
}

function deleteBatch(id) {
  const b = batches().find(x => x.id === id);
  if (!b || !confirm("Delete this batch and its " + b.invs.length + " invoices? Stock will be restored.")) return;
  b.invs.forEach(i => { const p = products.find(x => x.id === i.productId); if (p) p.stock += i.lines[0].qty; });
  invoices = invoices.filter(i => i.bulkId !== id);
  DB.setProducts(products); DB.setInvoices(invoices);
  toast("Batch deleted, stock restored");
  goTo("bulk-orders");
}

function renderBulkView() {
  const b = batches().find(x => x.id === state.viewingBatch);
  if (!b) return renderBulkList();
  return `<div class="page-head"><div><h1>${esc(b.item)}</h1><p>${fmtDate(b.date)} · ${b.invs.length} clients · ${b.qty} pcs · ${fmt(b.total)}</p></div>
    <button class="btn btn-outline btn-sm" data-nav="bulk-orders">← Back</button></div>
    <table class="wh-table"><thead><tr><th>Invoice</th><th>Client</th><th>Phone</th><th>Qty</th><th>Total</th><th></th></tr></thead><tbody>
    ${b.invs.map(i => `<tr><td>${esc(i.invoiceNo)}</td><td>${esc(i.clientName)}</td><td>${esc(i.clientPhone || "—")}</td><td>${i.lines[0].qty}</td><td class="num">${fmt(i.total)}</td>
    <td><button class="btn btn-outline btn-sm" data-view-invoice="${i.id}">View</button></td></tr>`).join("")}</tbody></table>`;
}

function renderInvoiceHistory() {
  const f = state.invFilter;
  const list = invoices.filter(i => !f || (f.month ? (i.date || "").startsWith(f.month) : (i.clientPhone || i.clientName || "").toLowerCase() === f.client));
  const label = f ? (f.month ? new Date(f.month + "-02").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : f.name) : "";
  return `
    <div class="page-head"><div><h1>Invoice History</h1><p>${f ? "Showing: " + esc(label) : "Every invoice billed, newest first."}</p></div>
      <div class="btn-row">
        ${f ? `<button class="btn btn-outline btn-sm" id="clearFilter">Show all</button>` : ""}
        <button class="btn btn-gold btn-sm" id="addInvoiceBtn">+ Add Invoice</button>
      </div></div>
    <input type="search" id="invSearch" placeholder="Search by invoice no., client or phone…" style="max-width:380px;margin-bottom:14px;">
    ${list.length ? `<table class="wh-table"><thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Total</th><th></th></tr></thead><tbody id="invBody">
      ${list.map(inv => `<tr data-q="${esc((inv.invoiceNo + " " + inv.clientName + " " + (inv.clientPhone || "")).toLowerCase())}">
        <td>${esc(inv.invoiceNo)}${inv.waStatus === "awaiting" ? ' <span class="pill low">awaiting</span>' : inv.waStatus === "cancelled" ? ' <span class="pill low">cancelled</span>' : ""}</td><td>${esc(inv.clientName)}</td><td>${fmtDate(inv.date)}</td><td class="num">${fmt(inv.total)}</td>
        <td><div class="btn-row" style="justify-content:flex-end;">
          <button class="btn btn-outline btn-sm" data-view-invoice="${inv.id}">View</button>
          <button class="btn btn-outline btn-sm" data-edit-invoice="${inv.id}">Edit</button>
          <button class="btn btn-outline btn-sm" style="color:#E08A8A;" data-del-invoice="${inv.id}">Delete</button>
        </div></td></tr>`).join("")}
    </tbody></table>` : `<div class="wh-empty">🧾<h3>No invoices found</h3><p>Nothing here yet. Press “+ Add Invoice” to create one.</p></div>`}`;
}

/* ---------- delete / edit an invoice (with stock kept in step) ---------- */
function restoreStock(lines) {
  lines.forEach(l => { const p = products.find(p => p.id === l.productId); if (p) p.stock += l.qty; });
  DB.setProducts(products);
}
function deleteInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const counted = isCounted(inv);
  if (!confirm("Delete invoice " + inv.invoiceNo + " (" + inv.clientName + ")?" + (counted ? "\nThe stock of its items will be added back." : "") + "\nThis cannot be undone.")) return;
  if (counted) restoreStock(inv.lines);
  invoices = invoices.filter(i => i.id !== id);
  DB.setInvoices(invoices);
  if (state.viewingInvoiceId === id) state.viewingInvoiceId = null;
  toast("Invoice " + inv.invoiceNo + " deleted.");
  render();
}

function openEditInvoiceModal(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const lines = inv.lines.map(l => ({ ...l }));
  const wrap = document.createElement("div");
  wrap.className = "overlay open";
  wrap.innerHTML = `
    <div class="modal" style="max-width:640px;">
      <button class="modal-close" id="eiClose">✕</button>
      <h3>Edit Invoice ${esc(inv.invoiceNo)}</h3>
      <div class="form-row">
        <label>Name<input type="text" id="eiName" value="${esc(inv.clientName)}"></label>
        <label>Phone<input type="text" id="eiPhone" value="${esc(inv.clientPhone || "")}"></label>
      </div>
      <label>Address<input type="text" id="eiAddress" value="${esc(inv.clientAddress || "")}"></label>
      <div class="form-row">
        <label>Date<input type="date" id="eiDate" value="${esc((inv.date || "").slice(0, 10))}"></label>
        <label>Delivery (PKR)<input type="number" min="0" id="eiDelivery" value="${Number(inv.delivery) || 0}"></label>
        <label>Discount (PKR)<input type="number" min="0" id="eiDiscount" value="${Number(inv.discount) || 0}"></label>
      </div>
      <h4 style="margin:14px 0 6px;">Items</h4>
      <div id="eiLines"></div>
      <div class="form-row add-line-row" style="margin-top:10px;">
        <select id="eiProduct">${products.length ? products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("") : `<option value="">No items in inventory</option>`}</select>
        <input type="number" id="eiQty" min="1" value="1" style="max-width:90px;">
        <button type="button" class="btn btn-outline btn-sm" id="eiAdd">Add Item</button>
      </div>
      <div class="invoice-total-row">Total <strong id="eiTotal"></strong></div>
      <p class="gate-error" id="eiError"></p>
      <button class="btn btn-gold btn-block" id="eiSave">Save Changes</button>
    </div>`;
  document.body.appendChild(wrap);
  const $ = x => wrap.querySelector("#" + x);
  const num = v => Math.max(0, Number(v) || 0);
  const subtotal = () => lines.reduce((s, l) => s + l.price * l.qty, 0);
  const total = () => Math.max(0, subtotal() - num($("eiDiscount").value) + num($("eiDelivery").value));
  function paint() {
    $("eiLines").innerHTML = lines.length ? `<table class="wh-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr></thead><tbody>
      ${lines.map((l, i) => `<tr><td>${esc(l.name)}${l.size ? ` <small class="muted">${esc(l.size)}</small>` : ""}</td>
        <td><input type="number" min="1" data-ei-qty="${i}" value="${l.qty}" style="width:70px;"></td>
        <td><input type="number" min="0" data-ei-price="${i}" value="${l.price}" style="width:100px;"></td>
        <td><button type="button" class="btn-link danger" data-ei-del="${i}">✕</button></td></tr>`).join("")}
      </tbody></table>` : `<p class="muted">No items. Add at least one.</p>`;
    $("eiTotal").textContent = fmt(total());
    wrap.querySelectorAll("[data-ei-qty]").forEach(el => el.addEventListener("input", () => { lines[+el.dataset.eiQty].qty = Math.max(1, parseInt(el.value, 10) || 1); $("eiTotal").textContent = fmt(total()); }));
    wrap.querySelectorAll("[data-ei-price]").forEach(el => el.addEventListener("input", () => { lines[+el.dataset.eiPrice].price = num(el.value); $("eiTotal").textContent = fmt(total()); }));
    wrap.querySelectorAll("[data-ei-del]").forEach(el => el.addEventListener("click", () => { lines.splice(+el.dataset.eiDel, 1); paint(); }));
  }
  paint();
  $("eiDiscount").addEventListener("input", () => $("eiTotal").textContent = fmt(total()));
  $("eiDelivery").addEventListener("input", () => $("eiTotal").textContent = fmt(total()));
  $("eiClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
  $("eiAdd").addEventListener("click", () => {
    const p = products.find(x => x.id === $("eiProduct").value);
    if (!p) return;
    const qty = Math.max(1, parseInt($("eiQty").value, 10) || 1);
    const ex = lines.find(l => l.productId === p.id && !l.size);
    if (ex) ex.qty += qty; else lines.push({ productId: p.id, name: p.name, qty, price: p.discountPrice });
    paint();
  });
  $("eiSave").addEventListener("click", () => {
    if (!lines.length) { $("eiError").textContent = "Add at least one item."; return; }
    const name = $("eiName").value.trim();
    if (!name) { $("eiError").textContent = "Client name is required."; return; }
    // keep stock in step: only invoices that already took stock off (billed / confirmed) change it
    if (isCounted(inv)) {
      const delta = {};
      inv.lines.forEach(l => { delta[l.productId] = (delta[l.productId] || 0) + l.qty; });
      lines.forEach(l => { delta[l.productId] = (delta[l.productId] || 0) - l.qty; });
      Object.keys(delta).forEach(pid => { const p = products.find(x => x.id === pid); if (p) p.stock = Math.max(0, p.stock + delta[pid]); });
      DB.setProducts(products);
    }
    inv.clientName = name;
    inv.clientPhone = $("eiPhone").value.trim();
    inv.clientAddress = $("eiAddress").value.trim();
    const day = $("eiDate").value;
    if (day && day !== (inv.date || "").slice(0, 10)) inv.date = new Date(day + "T12:00:00").toISOString();
    inv.delivery = num($("eiDelivery").value);
    inv.discount = num($("eiDiscount").value);
    inv.lines = lines.map(l => ({ ...l }));
    inv.total = total();
    DB.setInvoices(invoices);
    wrap.remove();
    toast("Invoice " + inv.invoiceNo + " updated.");
    render();
  });
}

/* ---------- erase everything (products, categories, orders, invoices) ---------- */
function openEraseAllModal() {
  const wrap = document.createElement("div");
  wrap.className = "overlay open";
  wrap.innerHTML = `
    <div class="modal">
      <button class="modal-close" id="eaClose">✕</button>
      <h3>Erase all warehouse data</h3>
      <p class="muted" style="margin-bottom:12px;">This permanently deletes <b>${products.length}</b> items, <b>${categories.length}</b> categories, <b>${orders.length}</b> orders and <b>${invoices.length}</b> invoices, from this device and from the cloud. It cannot be undone.</p>
      <label>Type <b>DELETE</b> to confirm<input type="text" id="eaText" autocomplete="off"></label>
      <p class="gate-error" id="eaErr"></p>
      <button class="btn btn-gold btn-block" id="eaGo" disabled style="margin-top:12px;">Erase everything</button>
    </div>`;
  document.body.appendChild(wrap);
  const t = wrap.querySelector("#eaText"), go = wrap.querySelector("#eaGo");
  t.addEventListener("input", () => { go.disabled = t.value.trim() !== "DELETE"; });
  wrap.querySelector("#eaClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
  go.addEventListener("click", async () => {
    go.disabled = true; go.textContent = "Erasing…";
    const err = wrap.querySelector("#eaErr");
    try {
      if (window.JCFB && !JCFB.offline && JCFB.eraseAll) await JCFB.eraseAll();   // wipe the cloud first
    } catch (e) {
      console.error(e);
      err.textContent = "Could not erase the cloud data: " + (e && e.message ? e.message : e) + " (check your internet / sign in again).";
      go.disabled = false; go.textContent = "Erase everything";
      return;
    }
    products = []; categories = []; orders = []; invoices = [];
    DB.setProducts(products); DB.setCategories(categories); DB.setOrders(orders); DB.setInvoices(invoices);
    try { ["products", "categories", "orders", "invoices"].forEach(n => localStorage.setItem("jc_fb_seeded_" + n, "1")); } catch (e) {}
    state.invFilter = null; state.viewingInvoiceId = null;
    wrap.remove();
    toast("All data erased. You can start fresh.");
    goTo("dashboard");
  });
}

function renderClients() {
  const map = {};
  invoices.filter(isCounted).forEach(inv => {
    const key = (inv.clientPhone || inv.clientName || "").toLowerCase();
    const c = map[key] || (map[key] = { key, name: inv.clientName, phone: inv.clientPhone, total: 0, count: 0, last: inv.date });
    c.total += inv.total; c.count++; if (inv.date > c.last) c.last = inv.date;
  });
  const clients = Object.values(map).sort((a, b) => b.total - a.total);
  return `
    <div class="page-head"><div><h1>Clients</h1><p>Everyone billed, ranked by spend. Click a client to see their invoices.</p></div></div>
    <input type="search" id="clientSearch" placeholder="Search clients…" style="max-width:380px;margin-bottom:14px;">
    ${clients.length ? `<table class="wh-table"><thead><tr><th>Client</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>Last Order</th></tr></thead><tbody id="clientBody">
      ${clients.map(c => `<tr data-q="${esc((c.name + " " + (c.phone || "")).toLowerCase())}" data-client="${esc(c.key)}" data-name="${esc(c.name)}" style="cursor:pointer">
        <td>${esc(c.name)}</td><td>${esc(c.phone || "—")}</td><td>${c.count}</td><td class="num">${fmt(c.total)}</td><td>${fmtDate(c.last)}</td></tr>`).join("")}
    </tbody></table>` : `<div class="wh-empty">🧑‍🤝‍🧑<h3>No clients yet</h3><p>Clients appear after their first invoice.</p></div>`}`;
}

function bindExtras() {
  const $ = id => document.getElementById(id), on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };
  const searcher = (inputId, bodyId) => { const i = $(inputId); if (i) i.addEventListener("input", () => {
    const q = i.value.trim().toLowerCase();
    document.querySelectorAll("#" + bodyId + " tr").forEach(r => r.style.display = r.dataset.q.includes(q) ? "" : "none"); }); };
  searcher("invSearch", "invBody"); searcher("clientSearch", "clientBody"); searcher("invenSearch", "invenBody");
  on("clearFilter", () => { state.invFilter = null; render(); });
  on("addInvoiceBtn", () => goTo("new-invoice"));
  on("eraseAllBtn", openEraseAllModal);
  document.querySelectorAll("[data-edit-invoice]").forEach(b => b.addEventListener("click", () => openEditInvoiceModal(b.dataset.editInvoice)));
  document.querySelectorAll("[data-del-invoice]").forEach(b => b.addEventListener("click", () => deleteInvoice(b.dataset.delInvoice)));
  document.querySelectorAll("#clientBody tr").forEach(r => r.addEventListener("click", () => {
    state.invFilter = { client: r.dataset.client, name: r.dataset.name }; goTo("invoices"); }));
  if (state.view === "earnings") {
    const ms = monthlyEarnings();
    document.querySelectorAll(".earn-row").forEach((r, i) => { r.style.cursor = "pointer"; r.title = "View invoices";
      r.addEventListener("click", () => { state.invFilter = { month: ms[i].key }; goTo("invoices"); }); });
  }
  if (state.view === "invoices" && !state.invFilter) { /* unfiltered */ }
  on("newBulkBtn", () => goTo("bulk-invoice"));
  on("bulkCancel", () => goTo("bulk-orders"));
  on("bulkAddRow", () => { state.bulkDraft.rows.push({ name: "", phone: "", address: "", qty: 1 }); render(); });
  on("bulkSave", saveBulk);
  const bp = $("bulkProduct");
  if (bp) bp.addEventListener("change", () => { const p = products.find(x => x.id === bp.value); state.bulkDraft.productId = p.id; state.bulkDraft.price = p.discountPrice; render(); });
  const pr = $("bulkPrice");
  if (pr) pr.addEventListener("input", () => { state.bulkDraft.price = Math.max(0, +pr.value || 0); $("bulkAmt").textContent = fmt(bulkTotals().amount); });
  document.querySelectorAll("[data-brow]").forEach(inp => inp.addEventListener("input", () => {
    const r = state.bulkDraft.rows[+inp.dataset.brow], f = inp.dataset.f;
    r[f] = f === "qty" ? Math.max(0, parseInt(inp.value, 10) || 0) : inp.value;
    if (f === "qty") { $("bulkQty").textContent = bulkTotals().qty; $("bulkAmt").textContent = fmt(bulkTotals().amount); } }));
  document.querySelectorAll("[data-brow-del]").forEach(b => b.addEventListener("click", () => { state.bulkDraft.rows.splice(+b.dataset.browDel, 1); render(); }));
  document.querySelectorAll("[data-bulk-view]").forEach(b => b.addEventListener("click", () => { state.viewingBatch = b.dataset.bulkView; goTo("bulk-view"); }));
  document.querySelectorAll("[data-bulk-del]").forEach(b => b.addEventListener("click", () => deleteBatch(b.dataset.bulkDel)));
}


/* ============================================================
   TYPE-AHEAD ITEM PICKER (replaces the old <select> dropdowns)
   ============================================================ */
function comboHTML(id, hiddenId, selectedId, placeholder) {
  const p = products.find(x => x.id === selectedId);
  return `<div class="combo"><input type="text" id="${id}" placeholder="${placeholder}" autocomplete="off" value="${p ? esc(p.name) : ""}">
    <input type="hidden" id="${hiddenId}" value="${p ? p.id : ""}"><div class="combo-list" id="${id}List" hidden></div></div>`;
}

function comboMatches(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return products.filter(p => {
    const hay = (p.name + " " + (p.sku || "") + " " + (p.category || "")).toLowerCase();
    return words.every(w => hay.includes(w));
  }).slice(0, 8);
}

function setupCombo(inputId, hiddenId, onPick) {
  const input = document.getElementById(inputId), hidden = document.getElementById(hiddenId), list = document.getElementById(inputId + "List");
  if (!input) return;
  let hits = [], idx = -1;
  const draw = () => {
    hits = comboMatches(input.value); idx = hits.length ? 0 : -1;
    list.innerHTML = hits.length ? hits.map((p, i) => `<div class="combo-opt ${i === idx ? "on" : ""}" data-i="${i}">
      <span>${esc(p.name)}</span><small>${fmt(p.discountPrice)} · stock ${p.stock}</small></div>`).join("") : `<div class="combo-empty">Koi item nahi mila</div>`;
    list.hidden = false;
  };
  const mark = () => list.querySelectorAll(".combo-opt").forEach((el, i) => el.classList.toggle("on", i === idx));
  const pick = p => { input.value = p.name; hidden.value = p.id; list.hidden = true; onPick(p); };
  input.addEventListener("focus", () => { input.select(); draw(); });
  input.addEventListener("input", () => { hidden.value = ""; draw(); });
  input.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 120));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); idx = (idx + 1) % hits.length; mark(); }
    else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); idx = (idx - 1 + hits.length) % hits.length; mark(); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[idx] && !list.hidden) pick(hits[idx]); }
    else if (e.key === "Escape") list.hidden = true;
  });
  list.addEventListener("mousedown", e => { e.preventDefault(); const o = e.target.closest(".combo-opt"); if (o) pick(hits[+o.dataset.i]); });
}

function bindCombos() {
  const qty = document.getElementById("lineQty");
  setupCombo("lineSearch", "lineProduct", () => { if (qty) { qty.focus(); qty.select(); } });
  setupCombo("bulkSearch", "bulkProduct", p => { state.bulkDraft.productId = p.id; state.bulkDraft.price = p.discountPrice; render(); });

  const add = document.getElementById("addLineBtn"), hid = document.getElementById("lineProduct");
  if (add) add.addEventListener("click", e => {
    if (!hid.value) { e.stopImmediatePropagation(); toast("Pehle list se item select karein"); document.getElementById("lineSearch").focus(); }
    else state.refocusSearch = true;
  }, true);
  if (qty) qty.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add.click(); } });
  if (state.refocusSearch && document.getElementById("lineSearch")) { state.refocusSearch = false; document.getElementById("lineSearch").focus(); }
}


/* ============================================================
   FIREBASE: sign-in state + live data from the cloud
   ============================================================ */
JCFB.onAuth(user => {
  state.authReady = true;
  const was = state.authed;
  state.authed = !!user;
  state.userEmail = user ? user.email : "";
  if (user) {
    products = DB.getProducts(); categories = DB.getCategories();
    orders = DB.getOrders(); invoices = DB.getInvoices();
  }
  if (was !== state.authed || !state.authed) render();
});
// if Firebase can't be reached, don't sit on "Loading…" forever
setTimeout(() => { if (!state.authReady) { state.authReady = true; state.gateError = "Cannot reach the server. Check your internet."; render(); } }, 7000);

window.addEventListener("db-synced", e => {
  const prevPending = new Set(orders.filter(o => o.status === "pending").map(o => o.id));
  products = DB.getProducts(); categories = DB.getCategories();
  orders = DB.getOrders(); invoices = DB.getInvoices();
  if (!state.authed) return;
  const fresh = orders.filter(o => o.status === "pending" && !prevPending.has(o.id));
  if (e.detail.name === "orders" && fresh.length && prevPending.size + fresh.length > 0 && state.seenOrders) toast("🛎️ New order received!");
  if (e.detail.name === "orders") state.seenOrders = true;
  const typing = document.querySelector(".modal-backdrop.open, .modal-overlay.open, .modal") || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
  if (!typing && (state.view === "dashboard" || state.view === "orders")) render();
  else {
    const navBtn = app.querySelector('[data-nav="orders"]');
    const n = orders.filter(o => o.status === "pending").length;
    if (navBtn) navBtn.innerHTML = "New Orders" + (n ? `<span class="wh-badge">${n}</span>` : "");
  }
});
window.addEventListener("jc-sync-error", () => toast("Could not save to the cloud. Check your internet."));
