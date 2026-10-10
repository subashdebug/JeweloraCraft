# New-item emails to newsletter subscribers

When someone types their email in the "Subscribe" box on the home page, it is saved in Firebase
(collection `subscribers`). When you add an item in the warehouse (Inventory > Add New Item) with
"Email this new item to newsletter subscribers" ticked, every subscriber gets an email with the
item name, price and a View item button.

## One-time setup

1. **Firestore rules** (Firebase console > Firestore > Rules). Add this inside `match /databases/{database}/documents { ... }`
   and use the SAME owner condition you already use for `orders`/`invoices` instead of `request.auth != null` if it is stricter:

       match /subscribers/{id} {
         allow create: if request.resource.data.keys().hasOnly(['email','date'])
                       && request.resource.data.email is string
                       && request.resource.data.email.size() < 200;
         allow read, update, delete: if request.auth != null;
       }

2. **Resend domain**: emails to the public can only be sent from a domain you verified in Resend
   (resend.com > Domains). The default `onboarding@resend.dev` sender only delivers to your own address.

3. **Cloudflare Pages > Settings > Variables and Secrets** (already used by the order emails):
   - `RESEND_API_KEY`  (secret)
   - `FROM_EMAIL`      e.g. `JeweloraCraft <hello@yourdomain.com>`   (must be on the verified domain)
   - `ADMIN_EMAIL`     your warehouse login email (only you can trigger the emails)

Then redeploy. The function is `functions/api/announce.js`.
