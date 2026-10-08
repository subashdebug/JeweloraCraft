# WhatsApp (free: no Meta, no payment, no keys)

One-time:
1. Warehouse > New Orders > "Payment Details" box: write your bank / account title / account number (or Easypaisa / JazzCash) and press Save.
   It is saved in that browser. On another device, save it again.
2. Allow pop-ups for the website in your browser (needed so WhatsApp can open).

Every order, two ways to send:

A) "Send on WhatsApp" (works everywhere)
   - Saves the invoice, opens WhatsApp with the customer's number and the message ready.
   - The message has the order details, a bill link (customer opens it and taps "Download PDF") and your account details.
   - Press Send in WhatsApp.

B) "Send with PDF" (shows only on phones / browsers that can share files)
   - Saves the invoice and opens the share sheet with the PDF bill and the same message already in it.
   - Choose WhatsApp and the customer, then press Send. The PDF goes as a real attachment.
   - WhatsApp does not allow a website to pick the customer for you in this mode, so you choose the contact.

After that:
- Customer pays and sends the screenshot > press "Mark Confirmed" (stock goes down, order turns "billed", a short confirmation message opens in WhatsApp, press Send).
- Customer cancels > press "Mark Cancelled" (stock stays the same).
- Message needs to go again? Press "Resend" (or "Resend with PDF").

Files: bill.html (the page the customer's link opens) and invoice-pdf.js (PDF maker) must stay next to warehouse.html.

## Bill PDF / bill page files
Upload these along with the rest of the site:
- `bill.html` - the page the customer opens from the WhatsApp link (shows the bill + Download PDF button)
- `invoice-pdf.js` - builds the PDF in the JeweloraCraft invoice template
- `invoice-fonts.js` - fonts used by the PDF (Fraunces, IBM Plex)
