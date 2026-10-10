/* ============================================================
   PDF bill (jsPDF) - the JeweloraCraft invoice template.
   Used by the warehouse (share with PDF) and by bill.html (customer's Download PDF).
   Fonts come from invoice-fonts.js (Fraunces, IBM Plex Sans, IBM Plex Mono).
   Everything is measured in points on an A4 page.
   ============================================================ */
const PDF_BRAND = { name: "JeweloraCraft", tag: "Handcrafted Jewellery", foot1: "JEWELORACRAFT", foot2: "Handcrafted Jewellery" };

function pdfFmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function pdfItemCode(name) {
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "-";
  return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
}
function pdfRs(n) { return "Rs. " + Number(n || 0).toLocaleString("en-US"); }

function pdfRegisterFonts(doc) {
  if (!window.JC_FONTS) return false;
  const list = [
    ["Fraunces-500", "Fraunces", "normal"], ["Fraunces-600", "Fraunces", "bold"], ["Fraunces-700", "Fraunces7", "bold"],
    ["PlexSans-400", "PlexSans", "normal"],
    ["PlexMono-400", "PlexMono", "normal"], ["PlexMono-500", "PlexMono5", "normal"], ["PlexMono-700", "PlexMono", "bold"],
  ];
  try {
    list.forEach(([key, fam, style]) => { doc.addFileToVFS(key + ".ttf", window.JC_FONTS[key]); doc.addFont(key + ".ttf", fam, style); });
    return true;
  } catch (e) { return false; }
}

function buildInvoicePdf(inv, brand) {
  const B = Object.assign({}, PDF_BRAND, brand || {});
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const custom = pdfRegisterFonts(doc);

  /* fonts: [family, style]  (plain PDF fonts are only a fallback if invoice-fonts.js is missing) */
  const FONT = custom ? {
    serifBold: ["Fraunces", "bold"], serifMed: ["Fraunces", "normal"], serifHeavy: ["Fraunces7", "bold"],
    sans: ["PlexSans", "normal"], mono: ["PlexMono", "normal"], monoMed: ["PlexMono5", "normal"], monoBold: ["PlexMono", "bold"],
  } : {
    serifBold: ["times", "bold"], serifMed: ["times", "normal"], serifHeavy: ["times", "bold"],
    sans: ["helvetica", "normal"], mono: ["courier", "normal"], monoMed: ["courier", "normal"], monoBold: ["courier", "bold"],
  };
  const COL = {
    ink: [36, 28, 31], muted: [107, 94, 83], tag: [117, 88, 34], teal: [15, 110, 110], maroon: [108, 30, 60],
    code: [171, 171, 171], rule: [230, 220, 198], rowRule: [241, 234, 218], foot: [70, 63, 56], perf: [233, 233, 233], sub: [138, 131, 120],
  };

  const X0 = 65.5, X1 = 531.4, PAGE_W = 595.28;
  const COLQ = 288.6, COLP = 418.1, COLA = 525.3, NAME_X = 100.4, CODE_X = 74.2;

  /* helpers */
  const use = (f, size, color) => { doc.setFont(f[0], f[1]); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2]); };
  const width = (txt, ls) => doc.getTextWidth(txt) + (ls || 0) * Math.max(0, String(txt).length - 1);
  const put = (txt, x, y, align, ls) => {                       // align: "l" (default), "r", "c"
    const w = width(txt, ls);
    const px = align === "r" ? x - w : align === "c" ? x - w / 2 : x;
    doc.text(String(txt), px, y, ls ? { charSpace: ls } : undefined);
  };
  const hline = (y, color, lw, x0, x1) => { doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(lw); doc.line(x0 == null ? X0 : x0, y, x1 == null ? X1 : x1, y); };

  const lines = (inv.lines || []).map(l => ({ name: String(l.name || ""), size: String(l.size || ""), qty: Number(l.qty) || 1, unit: String(l.unit || "pc"), price: Number(l.price) || 0 }));
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = Number(inv.delivery) || 0, discount = Number(inv.discount) || 0;
  const total = Number(inv.total) || (subtotal - discount + delivery);

  /* ---------- header ---------- */
  use(FONT.serifBold, 15.5, COL.ink);   put(B.name, X0 - 0.3, 83.3);
  use(FONT.serifHeavy, 7.45, COL.tag);   put(String(B.tag).toUpperCase(), X0, 96.7, "l", 0.97);
  use(FONT.sans, 9.4, COL.muted);       put("Invoice No.", X0, 119.5);
  use(FONT.monoBold, 9.8, COL.ink);     put(String(inv.invoiceNo || ""), X0, 131.5);
  use(FONT.sans, 9.6, COL.muted);       put("Date: " + pdfFmtDate(inv.date), X0, 143.9);

  /* perforation */
  doc.setDrawColor(COL.perf[0], COL.perf[1], COL.perf[2]); doc.setLineWidth(0.5);
  for (let x = 68.9; x < X1 - 28; x += 15.76) doc.circle(x, 155, 2.1, "S");

  /* client */
  use(FONT.serifBold, 18.5, COL.ink);   put(String(inv.clientName || ""), X0 - 0.3, 200.5);
  let dy = 0;
  const contact = [inv.clientPhone, inv.clientAddress].filter(Boolean).join("  ·  ");
  if (contact) {
    use(FONT.sans, 8.8, COL.muted);
    const wrapped = doc.splitTextToSize(contact, X1 - X0);
    doc.text(wrapped, X0, 216.5);
    dy = 4 + 12.5 * wrapped.length;
  }

  /* ---------- table ---------- */
  const PITCH = 35.35;
  let y = 242.4 + dy;
  const tableHead = (hy) => {
    use(FONT.monoBold, 8.4, COL.ink);   put("ITEM", 71.3, hy, "l", 1.0); put("QUANTITY", COLQ, hy, "c", 1.0);
    use(FONT.monoBold, 8.4, COL.teal);  put("PRICE", 416.9, hy, "r", 1.0); put("AMOUNT", 524.7, hy, "r", 1.0);
    hline(hy + 9.45, COL.rule, 0.95);
  };
  tableHead(y);
  let base = y + 31.0;                                  // baseline of the first row
  lines.forEach((l, i) => {
    if (base > 770) { doc.addPage(); y = 70; tableHead(y); base = y + 31.0; }
    use(FONT.serifHeavy, 10.2, COL.code);  put(pdfItemCode(l.name), CODE_X, base);
    const nameY = l.size ? base - 3.4 : base;
    use(FONT.sans, 9.6, COL.ink);       put(l.name, NAME_X, nameY);
    if (l.size) { use(FONT.sans, 7.6, COL.sub); put(/^[\d.\/]+$/.test(l.size) || l.size.length <= 2 ? "Size: " + l.size : l.size, NAME_X, base + 6.4); }
    use(FONT.sans, 9.6, COL.ink);       put(l.qty + " " + l.unit, COLQ, base, "c");
    use(FONT.mono, 9.7, COL.teal);      put(pdfRs(l.price), COLP, base, "r"); put(pdfRs(l.price * l.qty), COLA, base, "r");
    if (i < lines.length - 1) hline(base + 13.9, COL.rowRule, 0.9);
    if (i < lines.length - 1) base += PITCH;
  });

  /* ---------- totals ---------- */
  if (base > 700) { doc.addPage(); base = 40; }
  const thick = base + 27.8;
  hline(thick, COL.ink, 1.45);
  let ty = thick + 23.0;
  const totalLine = (label, value) => {
    use(FONT.monoMed, 9.7, COL.ink);  const vw = width(value);  const vx = 530.8 - vw;  put(value, vx, ty);
    use(FONT.sans, 9.6, COL.muted);   put(label, vx - 20.8, ty, "r");
    ty += 17.3;
  };
  totalLine("Items Subtotal", pdfRs(subtotal));
  if (discount) totalLine("Discount", "− " + pdfRs(discount));
  if (delivery) totalLine("Delivery Charges", pdfRs(delivery));
  ty += 8.4;                                            // 25.7 from the previous line to the grand total
  use(FONT.serifMed, 18.0, COL.maroon); const gv = pdfRs(total); const gw = width(gv); const gx = 530.8 - gw; put(gv, gx, ty);
  use(FONT.sans, 9.8, COL.muted);       put("Total Price", gx - 20.8, ty, "r");

  /* ---------- footer ---------- */
  const fy = ty + 32.95;
  hline(fy, COL.rule, 0.8);
  use(FONT.serifBold, 9.85, COL.foot);
  const w1 = width(B.foot1), w2 = width(B.foot2), gap = 16.3;
  const fx = (X0 + X1) / 2 - (w1 + gap + w2) / 2;
  put(B.foot1, fx, fy + 21.4); put(B.foot2, fx + w1 + gap, fy + 21.4);

  return doc;
}
