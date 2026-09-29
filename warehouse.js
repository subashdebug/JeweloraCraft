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
        <p class="muted">Enter the admin password to manage orders, stock and invoices.</p>
        <label>Username<input type="text" id="gateUser" autocomplete="username" required></label>
        <label>Password<input type="password" id="gatePass" autocomplete="current-password" required></label>
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
}

async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById("gateUser").value.trim().toLowerCase();
  const pass = document.getElementById("gatePass").value;
  const auth = DB.getAuth();
  const hash = await sha256Hex(pass);
  if (user !== WAREHOUSE_USERNAME || hash !== auth.passwordHash) {
    state.gateError = "Incorrect username or password.";
    showGate();
    return;
  }
  state.gateError = "";
  state.authed = true;
  render();
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
    { id: "clients", label: "Clients" },
  ];
  const buttons = navItems.map(n => {
    const active = state.view === n.id || (state.view === "invoice-view" && n.id === "invoices");
    return `<button class="${active ? "active" : ""}" data-nav="${n.id}">${esc(n.label)}${n.badge ? `<span class="wh-badge">${n.badge}</span>` : ""}</button>`;
  }).join("");

  return `
    <div class="sidebar no-print">
      <div class="sidebar-brand">Jewelora<span>Craft</span><small>Warehouse</small></div>
      <div class="nav">${buttons}</div>
      <a href="index.html" class="back-to-store">&larr; Back to Store</a>
      <div class="sidebar-foot">${invoices.length} invoices billed<br>${products.length} items tracked</div>
      <div class="sidebar-auth-row">
        <button type="button" class="btn-link" id="changePasswordBtn">Change Password</button>
        <button type="button" class="btn-link" id="logoutBtn">Logout</button>
      </div>
    </div>
  `;
}

function render() {
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

  app.innerHTML = `${renderSidebar()}<div class="wh-main">${body}</div>`;
  bindGlobalEvents();
  bindViewEvents();
}

function goTo(view) { state.view = view; render(); }

function bindGlobalEvents() {
  app.querySelectorAll("[data-nav]").forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.nav)));
  const logout = document.getElementById("logoutBtn");
  if (logout) logout.addEventListener("click", () => { state.authed = false; render(); });
  const changePw = document.getElementById("changePasswordBtn");
  if (changePw) changePw.addEventListener("click", openChangePasswordModal);
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
        </div>
        <div class="order-total">
          <div class="muted">${fmtDateTime(o.date)}</div>
          <div class="value gold">${fmt(o.total)}</div>
        </div>
      </div>
      <table class="wh-table"><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${itemsRows}</tbody></table>
      ${showActions ? `
        <div class="btn-row">
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
    lines: order.items.map(it => ({ name: it.name, size: it.size, qty: it.qty, price: it.price })),
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
  goTo("orders");
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
        <select id="lineProduct">${products.map(p => `<option value="${p.id}">${esc(p.name)} — ${fmt(p.discountPrice)}</option>`).join("")}</select>
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

function renderInvoiceView() {
  const inv = invoices.find(i => i.id === state.viewingInvoiceId);
  if (!inv) return `<p class="muted">Invoice not found.</p><button class="btn btn-outline" data-nav="invoices">Back</button>`;
  const rows = inv.lines.map(l => `
    <tr><td>${esc(l.name)}${l.size ? ` <span class="muted">(${esc(l.size)})</span>` : ""}</td><td>${l.qty}</td><td class="num">${fmt(l.price)}</td><td class="num">${fmt(l.price * l.qty)}</td></tr>
  `).join("");
  return `
    <div class="page-head no-print"><div><h1>Invoice</h1><p>${esc(inv.invoiceNo)}</p></div>
      <div class="btn-row">
        <button class="btn btn-outline btn-sm" data-nav="invoices">Back</button>
        <button class="btn btn-gold btn-sm" id="printInvoiceBtn">Print</button>
      </div>
    </div>
    <div class="invoice-sheet">
      <div class="invoice-sheet-head">
        <div class="invoice-brand">Jewelora<span>Craft</span></div>
        <div class="invoice-meta">
          <div><strong>${esc(inv.invoiceNo)}</strong></div>
          <div>${fmtDate(inv.date)}</div>
        </div>
      </div>
      <div class="invoice-bill-to">
        <div class="label">Billed To</div>
        <div>${esc(inv.clientName)}</div>
        ${inv.clientPhone ? `<div>${esc(inv.clientPhone)}</div>` : ""}
        ${inv.clientAddress ? `<div>${esc(inv.clientAddress)}</div>` : ""}
      </div>
      <table class="wh-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="invoice-total-row"><span>Total</span><strong>${fmt(inv.total)}</strong></div>
      <div class="invoice-sheet-foot">JeweloraCraft — Handcrafted Gold Jewellery</div>
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
  if (printBtn) printBtn.addEventListener("click", () => window.print());
}

/* ============================================================
   Init
   ============================================================ */
showGate();
