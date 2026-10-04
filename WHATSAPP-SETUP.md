# JeweloraCraft — Automatic WhatsApp Confirm / Cancel + PDF bill

## What happens
1. In the warehouse (New Orders, or New Invoice with a phone number) you press ONE button.
2. The customer gets a WhatsApp message with two buttons: **Confirm** and **Cancel**.
3. Customer taps **Confirm** -> the PDF bill is sent to them automatically, stock is deducted, the order turns "billed".
4. Customer taps **Cancel** -> a cancellation note is sent, the order turns "cancelled", stock is untouched.
(The warehouse page must be open to pick up the answer; it checks every 8 seconds.)

WhatsApp has no real "poll" for businesses. Tappable Confirm / Cancel buttons are the official equivalent.

## One-time setup (Meta WhatsApp Cloud API)
1. developers.facebook.com -> Create App -> type **Business** -> add the **WhatsApp** product.
2. Add/verify your business phone number. Note the **Phone number ID**.
3. Business Settings -> System users -> create one -> give it the WhatsApp account -> Generate token
   (permissions: whatsapp_business_messaging, whatsapp_business_management, never expires). This is **WA_TOKEN**.
4. App settings -> Basic -> **App Secret** = **WA_APP_SECRET**.
5. WhatsApp Manager -> Message templates -> Create template:
   - Name: `order_confirmation`   Category: **Utility**   Language: **English**
   - Body (exactly 4 variables):
     ```
     Assalam o Alaikum {{1}}! Thank you for ordering from JeweloraCraft.

     Order: {{2}}
     Items: {{3}}
     Total: {{4}}

     Please confirm your order.
     ```
   - Buttons -> **Quick reply** x2: `✅ Confirm Order` and `❌ Cancel Order`
   - Submit and wait for "Approved" (usually minutes to a few hours).
6. Cloudflare dashboard -> Workers & Pages -> KV -> create a namespace (e.g. `jc-wa`).
7. Pages project -> Settings -> Functions -> **KV namespace bindings**: variable name `WA_KV` -> that namespace.
8. Pages project -> Settings -> Variables and Secrets (production), add:
   `WA_TOKEN`, `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN` (any random text), `ADMIN_EMAIL` (your warehouse login email).
9. Redeploy the site (push to GitHub).
10. Meta app -> WhatsApp -> Configuration -> Webhook:
    - Callback URL: `https://YOUR-SITE/api/wa-webhook`
    - Verify token: the same text as `WA_VERIFY_TOKEN`
    - Subscribe to the **messages** field.

## Notes
- Until your number is out of test mode, you can only message numbers added as test recipients.
- Phone numbers starting with 0 are converted to 92... automatically.
- If WhatsApp fails you'll see the exact reason in a toast; use **Mark Confirmed / Mark Cancelled** to finish an order by hand.
