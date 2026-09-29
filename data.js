/* ============================================================
   JeweloraCraft — shared data & storage layer
   Loaded by BOTH index.html and warehouse.html so the two stay
   in sync: whatever the warehouse changes (stock, categories,
   prices, new items) is what the storefront shows, and whatever
   a customer orders on the storefront is what appears in the
   warehouse's New Orders queue.
   ============================================================ */

const LS = {
  PRODUCTS: "jc_products",
  CATEGORIES: "jc_categories",
  ORDERS: "jc_orders",
  INVOICES: "jc_invoices",
  CART: "jc_cart",
  AUTH: "jc_warehouse_auth",
};

const DEFAULT_CATEGORIES = [
  { id: "rings", name: "Rings", image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=700&auto=format&fit=crop" },
  { id: "bracelets", name: "Bracelets", image: "https://images.unsplash.com/photo-1611591475822-793540268571?q=80&w=700&auto=format&fit=crop" },
  { id: "necklaces", name: "Necklaces", image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=700&auto=format&fit=crop" },
  { id: "earrings", name: "Earrings", image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?q=80&w=700&auto=format&fit=crop" },
  { id: "jewellery-sets", name: "Jewellery Sets", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=700&auto=format&fit=crop" },
  { id: "jewellery-material", name: "Jewellery Material", image: "https://images.unsplash.com/photo-1531995811006-35cb42e1a022?q=80&w=700&auto=format&fit=crop" },
];

const DEFAULT_PRODUCTS = [
  { id: "prod-001", name: "Golden Pearl Ring", category: "rings", price: 3450, discountPrice: 2850, stock: 14, sku: "JWC-RNG-001", sizes: ["Size 6", "Size 7", "Size 8", "Adjustable"], desc: "Lustrous natural freshwater baroque pearl on a hand-hammered gold-plated band.", material: "22K Gold Plated Brass, Natural Pearl", featured: true, image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-002", name: "Crystal Stone Ring", category: "rings", price: 3200, discountPrice: 2600, stock: 8, sku: "JWC-RNG-002", sizes: ["Size 6", "Size 7", "Size 8"], desc: "Emerald-cut crystal centerpiece with micro-pavé crystal borders.", material: "Sterling Silver Core, Antique Gold Finish", featured: true, image: "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-003", name: "Royal Gold Bracelet", category: "bracelets", price: 6800, discountPrice: 5950, stock: 6, sku: "JWC-BRC-001", sizes: ["Small", "Medium", "Large"], desc: "Mughal-inspired filigree cuff, hand-embossed with a secure gold clasp.", material: "24K Dual-Dip Gold Vermeil on Brass", featured: true, image: "https://images.unsplash.com/photo-1611591475822-793540268571?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-004", name: "Handmade Charm Bracelet", category: "bracelets", price: 4200, discountPrice: 3500, stock: 12, sku: "JWC-BRC-002", sizes: ["7.0 in + 1.5 in Extender"], desc: "Lucky coins, teardrop pearls, and carved gold blossoms on soldered links.", material: "Gold Electroplated Alloy, Mini Pearls", featured: false, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-005", name: "Pearl Necklace", category: "necklaces", price: 8900, discountPrice: 7800, stock: 9, sku: "JWC-NCK-001", sizes: ["18 in", "20 in"], desc: "Hand-knotted cultured ivory pearls on silk, opulent filigree clasp.", material: "Freshwater Pearls, 18K Gold Plated Clasp", featured: true, image: "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-006", name: "Golden Pendant", category: "necklaces", price: 4600, discountPrice: 3900, stock: 18, sku: "JWC-NCK-002", sizes: ["18-20 in Adjustable"], desc: "Sunburst medallion with celestial motifs on a diamond-cut rope chain.", material: "22K Gold Finish on Brass", featured: true, image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-007", name: "Floral Earrings", category: "earrings", price: 3800, discountPrice: 3100, stock: 15, sku: "JWC-EAR-001", sizes: ["One Size"], desc: "Hand-textured gold jasmine blossoms with a champagne crystal drop.", material: "Matte Brushed Gold, Kundan Inlay", featured: true, image: "https://images.unsplash.com/photo-1630019852942-f89202989a59?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-008", name: "Crystal Earrings", category: "earrings", price: 3600, discountPrice: 2950, stock: 11, sku: "JWC-EAR-002", sizes: ["One Size"], desc: "Cascading chandelier drops in antique gold filigree prong frames.", material: "Faceted Crystals, 22K Gold Dipped Brass", featured: false, image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-009", name: "Premium Jewellery Set", category: "jewellery-sets", price: 18500, discountPrice: 15900, stock: 5, sku: "JWC-SET-001", sizes: ["Choker + Jhumkas + Ring"], desc: "Royal bridal choker, matching jhumka earrings, and a polki-studded ring.", material: "Polki & Kundan Stones, 24K Gold Polish", featured: true, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-010", name: "Handmade Chain", category: "necklaces", price: 3200, discountPrice: 2500, stock: 15, sku: "JWC-NCK-003", sizes: ["20 in", "22 in", "24 in"], desc: "Byzantine-style interlocking link chain, hand-woven ring by ring.", material: "Jewelers Brass, Anti-Tarnish Gold Coat", featured: false, image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-011", name: "Elegant Stone Bracelet", category: "bracelets", price: 4900, discountPrice: 4200, stock: 7, sku: "JWC-BRC-003", sizes: ["7.2 in + 1 in Ext"], desc: "Bezel-set rose quartz cabochons alternating with gold twist links.", material: "Natural Rose Quartz, 18K Gold Dipped Brass", featured: false, image: "https://images.unsplash.com/photo-1611591475822-793540268571?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-012", name: "Traditional Jewellery Set", category: "jewellery-sets", price: 14500, discountPrice: 12800, stock: 4, sku: "JWC-SET-002", sizes: ["Necklace + Earrings + Tikka"], desc: "Antique gold ceremonial set with carved peacocks and dangling jhumkis.", material: "Antique Matte Gold, Glass Stones, Seed Pearls", featured: true, image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-013", name: "Wire & Bead Bundle", category: "jewellery-material", price: 1850, discountPrice: 1450, stock: 25, sku: "JWC-MAT-001", sizes: ["Combo Pack"], desc: "3 spools of gold-plated craft wire plus 100 assorted brass bead caps.", material: "Gold Plated Copper Wire, Brass Beads", featured: false, image: "https://images.unsplash.com/photo-1531995811006-35cb42e1a022?q=80&w=900&auto=format&fit=crop" },
  { id: "prod-014", name: "Findings & Clasp Assortment", category: "jewellery-material", price: 1650, discountPrice: 1300, stock: 30, sku: "JWC-MAT-002", sizes: ["250 Piece Box"], desc: "Clasps, ear wires, head pins, crimp beads — the essentials, organized.", material: "Solid Brass, Gold Flash Coating", featured: false, image: "https://images.unsplash.com/photo-1531995811006-35cb42e1a022?q=80&w=900&auto=format&fit=crop" },
];

/* Pre-seeded so the warehouse works immediately with the password
   already shared with the store owner (admin123). Only the SHA-256
   hash is kept — see sha256Hex() below. Change it any time from
   the warehouse sidebar ("Change Password"). */
const DEFAULT_AUTH_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9"; // sha256("admin123")
const WAREHOUSE_USERNAME = "admin";

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function writeLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

const DB = {
  getProducts() {
    let list = readLS(LS.PRODUCTS, null);
    if (!list) { list = DEFAULT_PRODUCTS.map(p => ({ ...p })); writeLS(LS.PRODUCTS, list); }
    return list;
  },
  setProducts(list) { writeLS(LS.PRODUCTS, list); },

  getCategories() {
    let list = readLS(LS.CATEGORIES, null);
    if (!list) { list = DEFAULT_CATEGORIES.map(c => ({ ...c })); writeLS(LS.CATEGORIES, list); }
    return list;
  },
  setCategories(list) { writeLS(LS.CATEGORIES, list); },

  getOrders() { return readLS(LS.ORDERS, []); },
  setOrders(list) { writeLS(LS.ORDERS, list); },

  getInvoices() { return readLS(LS.INVOICES, []); },
  setInvoices(list) { writeLS(LS.INVOICES, list); },

  getCart() { return readLS(LS.CART, []); },
  setCart(list) { writeLS(LS.CART, list); },

  getAuth() { return readLS(LS.AUTH, { passwordHash: DEFAULT_AUTH_HASH }); },
  setAuth(obj) { writeLS(LS.AUTH, obj); },
};

/* ---------- generic helpers shared by both apps ---------- */
function fmt(n) { return "PKR " + Number(n || 0).toLocaleString(); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}
function uid(prefix) { return prefix + "-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random() * 90 + 10); }
function categoryName(categories, id) {
  const c = categories.find(c => c.id === id);
  return c ? c.name : id;
}

/* SHA-256 hashing for the warehouse password, with a plain-JS
   fallback for when the page is opened over plain file:// or http
   and crypto.subtle isn't available. */
function fallbackHashHex(text) {
  let str = "jc-salt-" + text, h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  for (let round = 0; round < 5000; round++) {
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c; h1 = (h1 * 16777619) >>> 0;
      h2 ^= c + round; h2 = (h2 * 2166136261) >>> 0;
    }
    str = h1.toString(16) + h2.toString(16);
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}
async function sha256Hex(text) {
  try {
    if (!window.crypto || !window.crypto.subtle) throw new Error("no subtle crypto");
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    return "fb:" + fallbackHashHex(text);
  }
}

/* Reads an image file the admin picks (e.g. from their phone/camera
   roll) and returns it as a resized, compressed data: URL — small
   enough to store in localStorage alongside the rest of the product
   data, with no server or upload service needed. */
function fileToResizedDataURL(file, maxDim, quality) {
  maxDim = maxDim || 700;
  quality = quality || 0.82;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
