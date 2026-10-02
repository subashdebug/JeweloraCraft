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
function pendingOrders() { return orders.filter(o => o.status === "pending"); }

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
      <div class="sidebar-foot">${invoices.length} invoices billed<br>${products.length} items tracked</div>
      <div class="sidebar-auth-row">
        <button type="button" class="btn-link" id="changePasswordBtn">Reset Password</button>
        <button type="button" class="btn-link" id="logoutBtn">Logout</button>
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
  const revenue = invoices.reduce((s, i) => s + i.total, 0);
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
      <div class="stat" data-nav="invoices"><div class="label">Invoices Billed</div><div class="value">${invoices.length}</div></div>
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
function waLink(o) {
  const c = o.customer || {};
  let n = String(c.phone || "").replace(/\D/g, "");
  if (n.startsWith("0")) n = "92" + n.slice(1);
  const msg = `Assalam o Alaikum ${c.name || ""}! Thank you for ordering from JeweloraCraft.\nOrder ID: ${o.id}\nTotal: ${fmt(o.total)}\n\nPayment details:\n`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
}

function orderCardHTML(o, showActions) {
  const c = o.customer || {};
  const itemsRows = (o.items || []).map(it => `
    <tr><td>${esc(it.name)}${it.size ? ` <span class="muted">(${esc(it.size)})</span>` : ""}</td><td>${it.qty}</td><td class="num">${fmt(it.price * it.qty)}</td></tr>
  `).join("");
  const statusPill = o.status === "billed" ? `<span class="pill ok">billed</span>`
    : o.status === "dismissed" ? `<span class="pill low">dismissed</span>`
    : `<span class="pill low">pending</span>`;

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
      ${showActions ? `
        <div class="btn-row">
          <a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${waLink(o)}">💬 WhatsApp</a>
          <button class="btn btn-gold btn-sm" data-bill-order="${o.id}">Bill This Order</button>
          <button class="btn btn-outline btn-sm" data-dismiss-order="${o.id}">Dismiss</button>
        </div>
      ` : ""}
    </div>
  `;
}

function renderOrders() {
  const pending = pendingOrders();
  const recentOther = orders.filter(o => o.status !== "pending").slice(0, 10);
  return `
    <div class="page-head"><div><h1>New Orders</h1><p>Orders placed on the website land here — bill them or dismiss them.</p></div></div>
    ${pending.length ? pending.map(o => orderCardHTML(o, true)).join("")
      : `<div class="wh-empty">📦<h3>No new orders</h3><p>When a customer checks out on the store, it'll show up here instantly.</p></div>`}
    ${recentOther.length ? `<h3 class="wh-subhead">Recent Orders</h3>${recentOther.map(o => orderCardHTML(o, false)).join("")}` : ""}
  `;
}

function billOrder(orderId) {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const invoice = {
    id: uid("INV"),
    invoiceNo: "JWC-INV-" + String(invoices.length + 1).padStart(4, "0"),
    date: new Date().toISOString(),
    clientName: order.customer.name,
    clientPhone: order.customer.phone,
    clientAddress: order.customer.address,
    lines: order.items.filter(it => it.id !== "_shipping" && it.id !== "_discount").map(it => ({ name: it.name, size: it.size, qty: it.qty, price: it.price })),
    delivery: (order.items.find(it => it.id === "_shipping") || {}).price || 0,
    discount: -((order.items.find(it => it.id === "_discount") || {}).price || 0),
    total: order.total,
    source: "order",
  };
  order.items.forEach(it => {
    const p = products.find(p => p.id === it.id);
    if (p) p.stock = Math.max(0, p.stock - it.qty);
  });
  DB.setProducts(products);
  invoices.unshift(invoice);
  DB.setInvoices(invoices);
  order.status = "billed";
  DB.setOrders(orders);
  toast("Order billed — invoice " + invoice.invoiceNo + " created.");
  state.viewingInvoiceId = invoice.id;
  goTo("invoice-view");
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
      </div>
      <div class="form-row">
        <label>Price (PKR)<input type="number" id="newItemPrice" min="0" required></label>
        <label>Stock<input type="number" id="newItemStock" min="0" required></label>
      </div>
      <label>Photo (optional)
        <input type="file" id="newItemImageFile" accept="image/*">
      </label>
      <p class="muted" style="margin:-8px 0 14px;font-size:.72rem;">Upload a photo from your device, or leave blank to use a placeholder — you can add one later from the table below.</p>
      <button type="submit" class="btn btn-gold btn-sm">Add Item</button>
    </form>

    <table class="wh-table inventory-table">
      <thead><tr><th>Photo</th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
      <tbody>
        ${products.map(p => `
          <tr class="${p.stock <= 6 ? "row-low" : ""}">
            <td>
              <img class="inv-thumb" src="${p.image}" alt="${esc(p.name)}">
              <input type="file" accept="image/*" class="inv-file-input" data-image-file="${p.id}">
              <button type="button" class="btn-link" data-change-image="${p.id}">Change</button>
            </td>
            <td>${esc(p.name)}<div class="muted">${esc(p.sku || "")}</div></td>
            <td>${esc(categoryName(categories, p.category))}</td>
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
    <ul class="wh-list cat-list">
      ${categories.map(c => {
        const count = products.filter(p => p.category === c.id).length;
        return `
          <li>
            <span class="cat-list-left">
              <img class="inv-thumb" src="${c.image}" alt="${esc(c.name)}">
              ${esc(c.name)} <span class="muted">(${count} items)</span>
            </span>
            <span class="cat-list-right">
              <input type="file" accept="image/*" class="inv-file-input" data-cat-image-file="${c.id}">
              <button type="button" class="btn-link" data-change-cat-image="${c.id}">Change Photo</button>
              <button class="del-cat" data-del-cat="${c.id}" title="Remove">✕</button>
            </span>
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
    <div class="page-head"><div><h1>New Invoice</h1><p>Create a manual invoice for a walk-in or phone order.</p></div></div>

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
    lines: d.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price })),
    total,
    source: "manual",
  };
  d.lines.forEach(l => {
    const p = products.find(p => p.id === l.productId);
    if (p) p.stock = Math.max(0, p.stock - l.qty);
  });
  DB.setProducts(products);
  invoices.unshift(invoice);
  DB.setInvoices(invoices);

  state.invoiceDraft = { name: "", phone: "", address: "", lines: [] };
  toast("Invoice " + invoice.invoiceNo + " generated.");
  state.viewingInvoiceId = invoice.id;
  goTo("invoice-view");
}

/* ============================================================
   INVOICE HISTORY + VIEW
   ============================================================ */
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
function invoiceWaLink(inv) {
  let n = String(inv.clientPhone || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("0")) n = "92" + n.slice(1);
  const list = inv.lines.map(l => `• ${l.name}${l.size ? " (" + l.size + ")" : ""} × ${l.qty} = ${rs(l.price * l.qty)}`).join("\n");
  const msg = `Assalam o Alaikum ${inv.clientName}!\nYour JeweloraCraft invoice ${inv.invoiceNo}\n\n${list}\n\nTotal: ${rs(inv.total)}\n\nThank you for shopping with us!`;
  return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
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
  const wa = invoiceWaLink(inv);
  return `
    <div class="page-head no-print"><div><h1>Invoice</h1><p>${esc(inv.invoiceNo)}</p></div>
      <div class="btn-row">
        <button class="btn btn-outline btn-sm" data-nav="invoices">Invoice History</button>
        <button class="btn btn-outline btn-sm" data-nav="new-invoice">+ New Invoice</button>
        ${wa ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="${wa}">💬 Send on WhatsApp</a>` : ""}
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
  invoices.forEach(inv => {
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
  invoices.forEach(inv => {
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
  document.getElementById("editItemClose").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
  document.getElementById("editItemSave").addEventListener("click", (e) => {
    e.preventDefault();
    p.name = document.getElementById("editName").value.trim() || p.name;
    p.category = document.getElementById("editCategory").value;
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
  app.querySelectorAll("[data-bill-order]").forEach(btn => btn.addEventListener("click", () => billOrder(btn.dataset.billOrder)));
  app.querySelectorAll("[data-dismiss-order]").forEach(btn => btn.addEventListener("click", () => dismissOrder(btn.dataset.dismissOrder)));

  // inventory
  const addItemForm = document.getElementById("addItemForm");
  if (addItemForm) addItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newItemName").value.trim();
    const category = document.getElementById("newItemCategory").value;
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
      id: uid("prod"), name, category, price, discountPrice: price, stock,
      sku: "JWC-" + uid("NEW"), sizes: ["One Size"], desc: "", material: "", featured: false,
      image,
    });
    DB.setProducts(products);
    toast("Item added");
    goTo("inventory");
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
      ${f ? `<button class="btn btn-outline btn-sm" id="clearFilter">Show all</button>` : ""}</div>
    <input type="search" id="invSearch" placeholder="Search by invoice no., client or phone…" style="max-width:380px;margin-bottom:14px;">
    ${list.length ? `<table class="wh-table"><thead><tr><th>Invoice</th><th>Client</th><th>Date</th><th>Total</th><th></th></tr></thead><tbody id="invBody">
      ${list.map(inv => `<tr data-q="${esc((inv.invoiceNo + " " + inv.clientName + " " + (inv.clientPhone || "")).toLowerCase())}">
        <td>${esc(inv.invoiceNo)}</td><td>${esc(inv.clientName)}</td><td>${fmtDate(inv.date)}</td><td class="num">${fmt(inv.total)}</td>
        <td><button class="btn btn-outline btn-sm" data-view-invoice="${inv.id}">View</button></td></tr>`).join("")}
    </tbody></table>` : `<div class="wh-empty">🧾<h3>No invoices found</h3><p>Nothing matches this view yet.</p></div>`}`;
}

function renderClients() {
  const map = {};
  invoices.forEach(inv => {
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
  searcher("invSearch", "invBody"); searcher("clientSearch", "clientBody");
  on("clearFilter", () => { state.invFilter = null; render(); });
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
