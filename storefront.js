/* ============================================================
   JeweloraCraft — shared storefront logic
   Used by BOTH index.html and products.html. Every render/init
   call at the bottom is guarded by element existence so each
   page only wires up the parts of the UI it actually has.
   ============================================================ */

let products = DB.getProducts();
let categories = DB.getCategories();
let cart = DB.getCart();
let orders = DB.getOrders();

const urlParams = new URLSearchParams(location.search);
let activeCategory = urlParams.get("category") || "all";
let activeSub = urlParams.get("sub") || "";
let activeSort = urlParams.get("sort") || "featured";

const SORTS = {
  featured: ["Featured", null],
  "price-asc": ["Price: Low to High", (a, b) => a.discountPrice - b.discountPrice],
  "price-desc": ["Price: High to Low", (a, b) => b.discountPrice - a.discountPrice],
  "name-asc": ["Name: A to Z", (a, b) => a.name.localeCompare(b.name)],
  "name-desc": ["Name: Z to A", (a, b) => b.name.localeCompare(a.name)],
  discount: ["Biggest Discount", (a, b) => ((b.price - b.discountPrice) / (b.price || 1)) - ((a.price - a.discountPrice) / (a.price || 1))],
  newest: ["Newest First", null],
};
function setUrlParam(k, v) {
  const url = new URL(location.href);
  if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  history.replaceState(null, "", url);
}

/* ============================================================
   Rendering — category tiles (homepage) + footer links (both pages)
   ============================================================ */
/* Homepage shows only the categories the owner ticked "Show on homepage"
   in the warehouse (max 3). If none are ticked, the first 3 are shown. */
function homeCategories() {
  const picked = categories.filter(c => c.home);
  return (picked.length ? picked : categories).slice(0, 3);
}

/* ---------- Left slide-in menu (drawer) ---------- */
function subsOf(c) { return Array.isArray(c.subs) ? c.subs : []; }
function ensureDrawer() {
  let d = document.getElementById("sideMenu");
  if (d) return d;
  const path = location.pathname.split("/").pop() || "index.html";
  const home = path === "index.html" || path === "" ? "" : "index.html";
  document.body.insertAdjacentHTML("beforeend", `
    <div class="sm-backdrop" id="smBackdrop"></div>
    <aside class="side-menu" id="sideMenu" aria-hidden="true" aria-label="Site menu">
      <div class="sm-top">
        <a href="index.html" class="logo">Jewelora<span>Craft</span></a>
        <button class="sm-close" id="smClose" aria-label="Close menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
        </button>
      </div>
      <div class="sm-scroll">
        <nav class="sm-main">
          <a href="index.html">Home</a>
          <a href="products.html">Shop all</a>
          <a href="${home}#about">Our story</a>
          <a href="${home}#contact">Contact</a>
        </nav>
        <div class="sm-label">Shop by category</div>
        <div class="sm-cats" id="smCats"></div>
      </div>
      <div class="sm-foot">Free delivery across Pakistan on orders over PKR 10,000</div>
    </aside>`);
  return document.getElementById("sideMenu");
}
function openMenu() {
  ensureDrawer();
  document.body.classList.add("sm-open");
  document.getElementById("sideMenu").setAttribute("aria-hidden", "false");
  const b = document.getElementById("menuBtn"); if (b) b.setAttribute("aria-expanded", "true");
}
function closeMenu() {
  document.body.classList.remove("sm-open");
  const d = document.getElementById("sideMenu"); if (d) d.setAttribute("aria-hidden", "true");
  const b = document.getElementById("menuBtn"); if (b) b.setAttribute("aria-expanded", "false");
}
function renderCategoryBar() {
  ensureDrawer();
  // remove the old second navbar if a cached page still has it
  const old = document.getElementById("catBar"); if (old) old.remove();
  const box = document.getElementById("smCats");
  if (!box) return;
  const link = (c, s) => `products.html?category=${encodeURIComponent(c.id)}${s ? "&sub=" + encodeURIComponent(s.id) : ""}`;
  box.innerHTML = categories.map(c => {
    const subs = subsOf(c);
    return subs.length
      ? `<details class="sm-item"><summary><span>${esc(c.name)}</span><i class="sm-plus"></i></summary>
          <div class="sm-subs"><a href="${link(c)}">View all</a>${subs.map(s => `<a href="${link(c, s)}">${esc(s.name)}</a>`).join("")}</div></details>`
      : `<a class="sm-item sm-single" href="${link(c)}"><span>${esc(c.name)}</span></a>`;
  }).join("");
}

function renderCategories() {
  const grid = document.getElementById("categoryGrid");
  if (!grid) return;
  grid.innerHTML = homeCategories().map(c => `
    <a class="category-card" href="products.html?category=${encodeURIComponent(c.id)}">
      <img src="${c.image}" alt="${esc(c.name)}" loading="lazy">
      <div class="overlay-label">${esc(c.name)}</div>
    </a>
  `).join("");
}

function renderFooterCategoryLinks() {
  const footLinks = document.getElementById("footerCategoryLinks");
  if (!footLinks) return;
  footLinks.innerHTML = categories.slice(0, 6).map(c => `<a href="products.html?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("");
}

/* ============================================================
   Rendering — filter chips + product grids (products.html, and
   the "Trending Now" strip on the homepage)
   ============================================================ */
function renderFilters() {
  const row = document.getElementById("filterRow");
  if (!row) return;
  const chips = [{ id: "all", name: "All" }, ...categories];
  row.innerHTML = chips.map(c => `
    <button class="filter-chip ${activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">${esc(c.name)}</button>
  `).join("");
  row.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat; activeSub = "";
      setUrlParam("category", activeCategory === "all" ? "" : activeCategory);
      setUrlParam("sub", "");
      renderFilters(); renderProducts();
    });
  });

  // subcategory chips for the active category
  const subRow = document.getElementById("subFilterRow");
  if (subRow) {
    const cat = categories.find(c => c.id === activeCategory);
    const subs = cat ? subsOf(cat) : [];
    subRow.innerHTML = subs.length ? [{ id: "", name: "All " + cat.name }, ...subs].map(s => `
      <button class="filter-chip sm ${activeSub === s.id ? "active" : ""}" data-sub="${esc(s.id)}">${esc(s.name)}</button>
    `).join("") : "";
    subRow.querySelectorAll("[data-sub]").forEach(btn => btn.addEventListener("click", () => {
      activeSub = btn.dataset.sub; setUrlParam("sub", activeSub);
      renderFilters(); renderProducts();
    }));
  }

  // sort dropdown
  const sel = document.getElementById("sortSelect");
  if (sel) {
    sel.innerHTML = Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === activeSort ? "selected" : ""}>${v[0]}</option>`).join("");
    sel.onchange = () => { activeSort = sel.value; setUrlParam("sort", activeSort === "featured" ? "" : activeSort); renderProducts(); };
  }
}

function productCardHTML(p) {
  return `
    <div class="product-card">
      <a class="product-thumb" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy"></a>
      <div class="product-body">
        <div class="product-cat">${esc(categoryName(categories, p.category))}</div>
        <a class="product-name" href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a>
        <div class="price-row">
          <span class="price-now">${fmt(p.discountPrice)}</span>
          <span class="price-was">${fmt(p.price)}</span>
        </div>
        ${p.stock <= 6 ? `<div class="stock-low">${p.stock === 0 ? "Out of stock" : "Only " + p.stock + " left"}</div>` : ""}
        <button class="btn btn-outline btn-block btn-sm" data-add="${p.id}" ${p.stock === 0 ? "disabled" : ""}>${p.stock === 0 ? "Out of Stock" : "Add to Bag"}</button>
      </div>
    </div>
  `;
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  let list = activeCategory === "all" ? products.slice() : products.filter(p => p.category === activeCategory);
  if (activeSub) list = list.filter(p => p.subcategory === activeSub);
  if (activeSort === "newest") list.reverse();
  else if (SORTS[activeSort] && SORTS[activeSort][1]) list.sort(SORTS[activeSort][1]);
  const countEl = document.getElementById("resultCount");
  if (countEl) countEl.textContent = list.length + (list.length === 1 ? " product" : " products");
  grid.innerHTML = list.length ? list.map(productCardHTML).join("") : `<div class="empty-msg">No products in this category yet.</div>`;
  wireProductGrid(grid);
}

function renderTrending() {
  const grid = document.getElementById("trendingGrid");
  if (!grid) return;
  const list = products.filter(p => p.featured).slice(0, 6);
  grid.innerHTML = list.map(productCardHTML).join("");
  wireProductGrid(grid);
}

function wireProductGrid(grid) {
  grid.querySelectorAll("[data-add]").forEach(el => el.addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(el.dataset.add, null, 1);
  }));
}

/* ============================================================
   Cart
   ============================================================ */
function addToCart(id, size, qty) {
  const p = products.find(p => p.id === id);
  if (!p || p.stock === 0) return;
  const existing = cart.find(c => c.id === id && c.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id, size, qty });
  saveCart();
  renderCart();
  toast("Added to bag");
}

function changeQty(index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  saveCart();
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

function saveCart() { DB.setCart(cart); }

const validCart = () => cart.filter(c => products.some(p => p.id === c.id));
function cartTotal() {
  return cart.reduce((sum, c) => {
    const p = products.find(p => p.id === c.id);
    return sum + (p ? p.discountPrice * c.qty : 0);
  }, 0);
}

function renderCart() {
  const wrap = document.getElementById("cartItems");
  if (!wrap) return;
  document.getElementById("cartCount").textContent = validCart().reduce((n, c) => n + c.qty, 0);
  document.getElementById("cartTotal").textContent = fmt(cartTotal());

  if (validCart().length === 0) {
    wrap.innerHTML = `<div class="empty-msg">Your bag is empty.</div>`;
    return;
  }
  wrap.innerHTML = cart.map((c, i) => {
    const p = products.find(p => p.id === c.id);
    if (!p) return "";
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${esc(p.name)}">
        <div class="cart-item-info">
          <div class="name">${esc(p.name)}</div>
          <div class="sub">${esc(c.size || "")}</div>
          <div class="sub">${fmt(p.discountPrice)}</div>
          <div class="qty-row">
            <button data-dec="${i}">−</button>
            <span>${c.qty}</span>
            <button data-inc="${i}">+</button>
            <button class="remove-link" data-remove="${i}">Remove</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.querySelectorAll("[data-inc]").forEach(el => el.addEventListener("click", () => changeQty(+el.dataset.inc, 1)));
  wrap.querySelectorAll("[data-dec]").forEach(el => el.addEventListener("click", () => changeQty(+el.dataset.dec, -1)));
  wrap.querySelectorAll("[data-remove]").forEach(el => el.addEventListener("click", () => removeFromCart(+el.dataset.remove)));
}

/* ============================================================
   Checkout -> creates an order the warehouse's "New Orders"
   queue picks up
   ============================================================ */
const checkoutBtn = document.getElementById("checkoutBtn");
if (checkoutBtn) checkoutBtn.addEventListener("click", () => {
  if (cart.length === 0) { toast("Your bag is empty"); return; }
  location.href = "checkout.html";
});

/* ---------- Email notification (server function keeps the Resend key private) ---------- */
function sendNotify(payload) {
  try {
    return fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) {}
}

/* The checkout form now lives on its own page: checkout.html */

/* ---------- Newsletter (homepage only, stored locally) ---------- */
const newsletterForm = document.getElementById("newsletterForm");
if (newsletterForm) newsletterForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendNotify({ type: "subscribe", email: document.getElementById("newsletterEmail").value });
  e.target.reset();
  toast("Subscribed! Watch your inbox for new drops.");
});

/* ============================================================
   Overlays / drawers
   ============================================================ */
function openOverlay(id) { document.getElementById(id).classList.add("open"); }
function closeOverlay(id) { document.getElementById(id).classList.remove("open"); }

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeOverlay(btn.dataset.close));
});
document.querySelectorAll(".overlay").forEach(ov => {
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.classList.remove("open"); });
});

const cartBtn = document.getElementById("cartBtn");
if (cartBtn) cartBtn.addEventListener("click", () => openOverlay("cartOverlay"));

const menuBtn = document.getElementById("menuBtn");
if (menuBtn) menuBtn.addEventListener("click", () => { ensureDrawer(); openMenu(); });
document.addEventListener("click", (e) => {
  if (e.target.closest("#smClose") || e.target.id === "smBackdrop" || e.target.closest("#sideMenu a")) closeMenu();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

/* ============================================================
   Toast
   ============================================================ */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ============================================================
   Init — each call is a no-op on pages missing that element
   ============================================================ */
renderCategoryBar();
renderCategories();
renderFooterCategoryLinks();
renderFilters();
renderProducts();
renderTrending();
renderCart();

/* Live updates: re-render when the warehouse changes products/categories */
window.addEventListener("db-synced", () => {
  products = DB.getProducts();
  // drop bag items whose product no longer exists
  const kept = validCart();
  if (kept.length !== cart.length) { cart = kept; DB.setCart(cart); }
  categories = DB.getCategories();
  renderCategoryBar(); renderCategories(); renderFooterCategoryLinks(); renderFilters();
  renderProducts(); renderTrending(); renderCart();
});
