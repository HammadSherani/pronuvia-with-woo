# Go-live runbook: Pronuvia → headless WooCommerce

Live par jaane ka tarteeb-waar kaam. Har qadam tick karte jayein. Tafseel ke liye `PHASES.md`.

---

## 0. Live se pehle zaroori code kaam

- [x] **Saare order kaam WP admin se** (commission-work): Pronuvia admin mein order sirf dekhne ke liye (details, tracking, notes, commission, print). Status, refund, notes, emails, commission approve / reject / refund → WooCommerce order page
  - WP admin se card order ka refund → Pronuvia khud Stripe refund karta hai (ek hi dafa: idempotency key + Stripe refund ke metadata se)
  - Hifazatein: webhook band ho to cron khud ON kare + alert; `refreshRecentWooOrders` 7 din; Stripe refund fail → "Stripe refund pending" order page par, roz cron retry, pehli dafa alert
  - [ ] Abhi baqi: Stripe **dashboard** se kiye refunds (Stripe webhook `charge.refunded`) Pronuvia + Woo mein nahi aate: card refund **sirf WP admin se** karein
  - Woo mein refund karte waqt "Refund manually" use karein (Woo ka Stripe plugin nahi hai; paisa Pronuvia bhejta hai)
- [ ] `OrderRefund.stripeRefundError` naya field: koi index nahi chahiye
- [ ] Har phase ki "Aap ka apna test" wali line `PHASES.md` mein tick

## 1. WordPress / WooCommerce (live site)

- [ ] WooCommerce → Settings → General: **store ka poora address**, currency **USD**
- [ ] Products, variations, SKU, prices, stock, categories (staging jaise)
- [ ] Shipping zones + methods (New York, Rest of US, FedEx 2Day, Canada / Mexico, Rest of World). FedEx 2Day ke naam mein "FedEx 2Day" ya "fedex 2 day(s)" ho
- [ ] **WooCommerce Shipping**: account connect, **payment card**, **box sizes**, origin address
- [ ] Coupons (admin Coupons page se ya WP admin → Marketing → Coupons)
- [ ] Tax: sirf jahan lagana ho, rates banayein (abhi koi nahi)
- [ ] **Emails faisla** (WooCommerce → Settings → Emails): mashwara: New order, Processing order, Completed order, Refunded order, Customer note **band** (hamari emails Next.js se jati hain)
- [ ] **WP mein Stripe plugin nahi** (payment Next.js mein hai)
- [ ] REST API key (WooCommerce → Settings → Advanced → REST API): Read/Write, ek admin user ke naam
- [ ] HPOS ON (order links `admin.php?page=wc-orders&action=edit&id=` isi par chalte hain)
- [ ] Purana "product update" webhook (khaali delivery URL) hata dein
- [ ] **Pronuvia Order Number plugin** (WP par order number Pronuvia wala, e.g. 13045, Woo ID 570 ki jagah; Orders search mein bhi): Plugins → Add New → Upload `wordpress/pronuvia-order-number.zip` → Activate. Order ID (URL ka `id=570`) nahi badalta
- [ ] **Pronuvia Commissions plugin** (order page par doctor / rep commission Approve / Reject / Modify): Plugins → Add New → Upload `wordpress/pronuvia-commissions.zip` → Activate. Faisla order webhook se Pronuvia mein aata hai; sirf approved commission payout mein jati hai
  - **1.2.0**: commission Commission Payout mein payout approve hone tak WP par badli ja sakti hai (Approve / Reject / Modify jitni dafa, wallet farq ke saath). Payout approve → wo row lock, sirf Refund commission
  - Is release ke deploy par **pehle** backfill chalayein (purane, pehle se pay hue orders lock ho jayein), **phir** plugin 1.2.0 upload:
    `tsx --conditions=react-server --env-file=.env scripts/backfill-commission-paid-out.mts --dry` (list dekhein), phir bina `--dry`
- [ ] **Pronuvia SSO plugin** (dashboard se WP admin bina password): Plugins → Add New → Upload `wordpress/pronuvia-sso.zip` → Activate; `wp-config.php` mein `define( 'PRONUVIA_SSO_SECRET', '<WOO_SSO_SECRET wali value>' );`. Pronuvia admin aur WP admin user ka email ek hi ho (warna `define( 'PRONUVIA_SSO_USER', '<WP username>' );`)
- [ ] Optional (WP developer): hamara order number WP admin mein (Sequential Order Numbers / snippet), "Shipped" status, coupon par "Kis ke liye" field

## 2. Vercel environment (Production)

| Variable | Value |
|---|---|
| `DATABASE_URL` | live MongoDB |
| `SESSION_SECRET`, `ADMIN_SETUP_TOKEN` | live |
| `NEXT_PUBLIC_APP_URL` | `https://<live-domain>` |
| `WOO_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET` | live WP + REST key |
| `WOO_WEBHOOK_SECRET` | naya lamba random secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **live** keys (`sk_live_`, `pk_live_`) |
| `CRON_SECRET` | random |
| `WOO_SSO_SECRET` | random, wahi jo `wp-config.php` ke `PRONUVIA_SSO_SECRET` mein (khaali ho to WP links password maangenge) |
| `SENDGRID_API_KEY` (ya `SMTP_*`), `SMTP_FROM`, `MAIL_REPLY_TO` | live |
| `PAYOUT_TIMEZONE` | jaise abhi |
| `CLOUDINARY_*` | jaise abhi |

Hata sakte hain (code ab nahi padhta): `FEDEX_*`, `UPS_*`, `USPS_*`, `SHIP_FROM_*`.

## 3. Database

- [ ] Live MongoDB ka **backup** (mongodump / Atlas snapshot)
- [ ] `npx prisma generate` build mein chalta hai (`npm run build`)
- [ ] Do unique index haath se (Prisma Mongo par nahi banata), live DB par ek baar:
  ```js
  db.WooLabel.createIndex({ orderId: 1, labelId: 1 }, { unique: true, name: "WooLabel_orderId_labelId_key" })
  db.OrderRefund.createIndex({ wooRefundId: 1 }, { unique: true, name: "OrderRefund_wooRefundId_key", partialFilterExpression: { wooRefundId: { $type: "number" } } })
  ```
- [ ] Reps / approved physicians ke Woo customers: `POST /api/woo/sync-customers?dryRun=1`, phir bina `dryRun` (admin login ke saath)
- [ ] Purane orders (Phase 6 se pehle) Mongo mein hi rahenge, read-only (Woo link ke bina dikhte hain)

## 4. Deploy (cutover)

1. [ ] Order lena thodi der band (maintenance notice / sirf admin)
2. [ ] `develop` → `main` merge, Vercel production deploy
3. [ ] Admin login → `POST /api/woo/setup-webhooks` → Order updated + Product updated / created / deleted webhooks live URL par (jawab mein list)
4. [ ] `GET /api/woo/health` → ok, currency USD
5. [ ] Bahar ki cron (jaise cron-job.org) har 15 minute: `GET /api/cron/woo-order-sync` header `Authorization: Bearer <CRON_SECRET>` (Vercel Hobby cron din mein ek baar)
6. [ ] Pehla chhota **asli** order (card): Stripe, Woo, Pronuvia teeno mein total match; Woo order link; confirmation email
7. [ ] Us order ka label WP admin se → Pronuvia par tracking + patient email
8. [ ] Ordering dobara khol dein

## 5. Rollback

- Pichla Vercel deployment "Promote to Production" (Vercel → Deployments)
- Purana code Woo ke bina chalta hai: naye orders sirf Mongo mein jayenge. Woo mein bane orders WP admin mein rahenge.
- DB backup se restore sirf data kharab hone par

## 6. Monitoring (pehle 48 ghante, phir roz)

- [ ] `GET /api/woo/reconcile?days=2` (admin): total / status / refunded farq, Woo tak na pahunche orders, webhooks ka haal. Khaali `issues` = sab theek
- [ ] `sales1.pronuvia@gmail.com` par alerts: "could not be sent to WooCommerce", "total differs", "coupon not applied", "Stripe refund failed, will retry", "no card payment to refund", "WooCommerce order webhook was off"
- [ ] Admin → Email Logs: FAILED emails
- [ ] Woo → Settings → Advanced → Webhooks: status **Active** (Woo lagataar failures par band kar deta hai)
- [ ] Stripe dashboard: payments / refunds Pronuvia se milte hain
