# Phases — Pronuvia → Headless WooCommerce (10 phases)

Saara commerce (products, stock, customers, shipping, coupons, cart totals, orders, labels, refunds) WooCommerce par jayega. Next.js mein sirf woh rahega jo Woo mein fit nahi hota: login aur 3 roles, physician approvals, downline, commission snapshot, monthly sweep, wallets, withdrawals, website/blog, aur reports ka UI.

| Phase | Kaam | Risk | Status |
| --- | --- | --- | --- |
| 1 | Foundation + security | Low | Not started |
| 2 | Catalog (products, categories, stock) | Medium | Store mein data ho chuka, code baqi |
| 3 | Customers + structured addresses | Medium | Not started |
| 4 | Shipping rates → Woo zones | High | Not started |
| 5 | Coupons + server-side totals | High | Not started |
| 6 | Checkout → Woo orders (3 checkouts, Card + Wallet) | Highest | Not started |
| 7 | Order management (admin + rep + physician) | High | Not started |
| 8 | Fulfillment + shipping labels | High | Not started |
| 9 | Refunds, returns, webhooks + commission sync | Highest | Not started |
| 10 | Reports, purana data, cleanup + go-live | High | Not started |

## Kaam ka rule

- Saara kaam **staging** par hoga: Woo staging site, alag Mongo DB (ya DB ka copy), Stripe test mode, carrier sandbox.
- Agla phase tabhi shuru hoga jab pichle phase ki saari testing tick ho jaye.
- Har test **teeno roles** ke liye chalana hai jahan lagu ho: Sales Rep, Physician, aur Admin "order on behalf".
- Live par sirf Phase 10 ke baad jayenge.

---

## Phase 1: Foundation + security

**Goal:** Next.js server WooCommerce se securely baat kar sake, aur pehle se khule security masle band hon.

**Steps**

1. `.env` (local + Vercel) mein `WOO_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET`, `WOO_WEBHOOK_SECRET`. Koi bhi `NEXT_PUBLIC_` nahi.
2. `lib/woo/client.ts`: server-only client (HTTPS check, timeout, GET retries, saaf errors), plus `lib/woo/health.ts` aur admin-only `GET /api/woo/health`.
3. WP developer se: LiteSpeed Cache → "Cache REST API" OFF, `/wp-json/` exclude, Purge All. Currency USD, store address, weight unit (lbs ya kg) final.
4. `/api/test-ups`, `/api/test-usps`, `/api/test-email`, `/api/shipping/rates` ko admin-only karein ya hata dein (abhi proxy `/api` check nahi karta).
5. WP admin mein dummy "Google Pixel" products aur categories delete.

**Testing**

- [ ] Admin, sahi keys → health 200, currency USD, products count
- [ ] Bina login / sales rep / physician → health 401
- [ ] Galat secret → 401 (LiteSpeed cache off hone ke baad)
- [ ] Bina key ke `/wp-json/wc/v3/settings/...` → 401 (pehle cache se data mil raha tha)
- [ ] Woo site down ya galat URL → 503 + saaf message, page hang na ho
- [ ] `WOO_URL` http:// → request bheje bina error
- [ ] Build ke baad client bundle mein `ck_` / `cs_` / `WOO_CONSUMER` → 0 hits
- [ ] Client component se Woo client import → build fail
- [ ] Test routes bina admin login → 401 / 404

**Done kab:** Connection secure ho, cache masla khatam, test routes band.

---

## Phase 2: Catalog (products, categories, stock)

**Goal:** Products, sizes, stock aur categories ka source of truth WooCommerce ho. Teeno shops Woo se chalein.

**Steps**

1. Migration route (`POST /api/woo/migrate-catalog`, `?dryRun=1`): Category → Woo category, SubCategory → child category, Product → variable product (attribute "Size"), variants → variations. Idempotent: parent SKU `PRN-P-<mongoId>`, variation SKU = variant SKU. (Store mein 7 products / 8 sizes pehle se hain, script inhein update karegi.)
2. Variant `status` mapping: `in_stock` → instock, `out_of_stock` → outofstock, `discontinued` / `inactive` → variation disabled (private).
3. Weight Mongo unit se store unit mein convert. Cost price, GTIN → variation meta.
4. Images: Cloudinary URLs seedha Woo ko; local `/uploads` ke liye WP Application Password.
5. `lib/woo/catalog.ts` (60s cache): **sales shop, physician shop, admin order-behalf shop** aur product detail pages Woo se.
6. Cart item mein `productId` = Woo product id, plus `variationId`. Purana localStorage cart version-check se clear ho.
7. `validateCartItemsAvailability` Woo se check kare (stock_status + stock quantity).
8. Admin products/categories pages: list Woo se, add/edit WP admin par redirect.

**Testing**

- [ ] Dry run → kuch nahi likha jata, report sahi counts dikhaye
- [ ] Mongo vs Woo: products, sizes, categories count barabar
- [ ] Har size ki price, stock, SKU, weight match
- [ ] Migration dobara → koi duplicate nahi
- [ ] `discontinued` size → kisi shop mein nazar na aaye
- [ ] `out_of_stock` size → dikhe magar select / add to cart na ho
- [ ] Draft / archived product → teeno shops mein gayab
- [ ] WP mein price badlein → ~1 min mein teeno shops par nayi price
- [ ] Purana cart (Mongo ids wala) → saaf ho jaye, checkout crash na ho
- [ ] Cart mein item, phir WP mein woh out of stock → checkout par saaf error
- [ ] Bina image product, aur lambi description → UI na toote
- [ ] Woo down → shops par "temporarily unavailable", crash nahi
- [ ] Migration route bina admin → 401

**Done kab:** Teeno shops aur cart Woo IDs par chalein, saara data match ho.

---

## Phase 3: Customers + structured addresses

**Goal:** Har Sales Rep aur Physician ek Woo customer se link ho. Address hamesha structured ho, string nahi.

**Steps**

1. Prisma: `SalesRepresentative.wooCustomerId`, `PartneringPhysician.wooCustomerId` (`Int? @unique`).
2. Woo customer banana: admin rep create, admin physician create, rep "add physician", website registration (approval par), `getOrCreateWooCustomer()` lazy fallback.
3. Profile / address / email update → Woo customer update. Delete → sirf unlink.
4. Address: `components/shared/address-fields.tsx` ka JSON format har jagah standard. Purane string addresses ka one-time converter (jo parse na ho woh list admin ko).
5. Email clash: pehle `GET /customers?email=`, mil jaye to link.
6. Backfill script saare reps + physicians ke liye.

**Testing**

- [ ] Admin naya rep / physician → Woo customer bane, ID save
- [ ] Rep "add physician" → Woo customer bane
- [ ] Website registration → approve hone par customer bane (pending / rejected par nahi)
- [ ] Pehle se maujood email → link, duplicate nahi
- [ ] Rep aur physician ka same email → clash rule ke mutabiq
- [ ] Woo down par rep create → rep bane, baad mein lazy link
- [ ] Profile / address update → Woo mein bhi update
- [ ] Backfill 2 baar → duplicates nahi
- [ ] Address converter: JSON, "City, ST 12345", ghalat format → sahi report
- [ ] Login (email + loginId), forgot / reset password → pehle jaise

**Done kab:** 100% active users ke paas `wooCustomerId` aur structured address ho.

---

## Phase 4: Shipping rates → Woo zones

**Goal:** Checkout ke shipping options `ShippingRate` table ki jagah Woo shipping zones se aayein.

**Steps**

1. Har `ShippingRate` rule → Woo zone: country-wide rule = country zone, state rules = state zone (upar order mein).
2. Methods: FLAT → Flat rate, FREE → Free shipping, LOCAL_PICKUP → Local pickup, FEDEX_2DAY → "FedEx 2Day" naam ka Flat rate. `isActive` false → method disabled.
3. One-time migration script + dry run. Iske baad rules WP admin se manage honge.
4. `getShippingQuote(items, address)` server action: Woo Store API cart (`Cart-Token`), items + address → rates.
5. Teeno checkouts `getShippingOptionsForCountry` ki jagah Woo rates use karein.
6. Admin "Shipping Rates" page → WP zones par redirect.

**Testing**

- [ ] Har purana rule → Woo mein same country / state / method / cost
- [ ] State rule wali state → state rate pehle, phir country-wide
- [ ] Bina state rule ki state → sirf country-wide
- [ ] Jis country ka koi rule nahi → "No shipping available", checkout block
- [ ] Local Pickup → $0, address phir bhi save
- [ ] FedEx 2Day → sahi cost aur naam order par save
- [ ] Inactive rule → option na dikhe
- [ ] US, Canada, ek international address → sahi options
- [ ] Address badlein → options dobara load
- [ ] Teeno checkouts (rep, physician, admin behalf) → same options
- [ ] Woo slow / down → loading, phir saaf error

**Done kab:** Teeno checkouts ke rates 100% Woo se, purani table istemal mein nahi.

---

## Phase 5: Coupons + server-side totals

**Goal:** Coupons Woo mein hon, aur har total server par Woo calculate kare. Browser ki koi value trust nahi.

**Steps**

1. `Coupon` → Woo coupon: PERCENTAGE → percent, FIXED → fixed_cart, `minOrderAmount` → minimum_amount, `maxUses` → usage_limit, `usedCount` → usage_count, `expiresAt` → date_expires, `isActive` false → draft.
2. `applicableTo` (ALL / SALES_REP / PHYSICIAN): coupon meta + Next.js server check (Woo mein roles nahi hain).
3. `getCheckoutQuote(items, address, shippingRateId, couponCode)`: Woo Store API se subtotal, discount, shipping, tax, total. Quote ID / hash save.
4. Teeno payment-intent routes (`create-payment-intent`, `physician-payment-intent`, `admin-behalf-payment-intent`) amount **server quote se** lein, client se nahi.
5. Wallet payment ka balance check bhi isi quote ke total se.
6. Admin coupons page → WP coupons par redirect (ya Woo-backed list).

**Testing**

- [ ] Har purana coupon → Woo mein same type / value / limits / expiry
- [ ] 10% coupon, $200 cart → $20 discount
- [ ] Fixed $25 coupon, $20 cart → total negative na ho
- [ ] Min amount se kam cart → saaf error
- [ ] Expired / inactive / limit khatam → error
- [ ] Physician-only coupon rep ke checkout par → reject
- [ ] Coupon + free shipping + state rate ek saath → sahi total
- [ ] DevTools se price / shipping / total / Stripe amount badlein → server ignore kare
- [ ] Quote ke baad WP mein price badle → payment se pehle naya quote
- [ ] Teeno checkouts mein screen ka total = Stripe amount (cent tak)

**Done kab:** Har total aur Stripe amount server quote se ho, coupons Woo mein.

---

## Phase 6: Checkout → Woo orders

**Goal:** Teeno checkouts (rep, physician, admin behalf) aur dono payments (Card, Wallet) ke baad order WooCommerce mein bane. Commission Next.js mein snapshot ho.

**Steps**

1. Card: Stripe verify → quote verify → Woo order: `customer_id`, `line_items` (variation ids), `shipping_lines`, `coupon_lines`, `set_paid: true`, `transaction_id`.
2. `meta_data`: `salesRepId`, `physicianId`, commission rates/amounts, `placedByAdmin`, `placedBySalesRep`, `stripePaymentIntentId`, customer email / phone.
3. Wallet: quote total → balance check → Woo order → wallet debit + `WalletTransaction`. Order fail = koi debit nahi.
4. Mongo `Order` patla record ban jaye: `wooOrderId`, order number, commission snapshot, `commissionPaid`, clawbacks. Monthly sweep isi par chalta rahe.
5. Order number: Woo order id ya Sequential Order Numbers plugin. 13000 wali sequence jaari rahe.
6. Idempotency: ek PaymentIntent = ek order (Mongo unique + pehle check). Payment ho gayi lekin Woo fail → `PENDING_SYNC` + retry + admin alert.
7. Stock **order par** kam ho (Woo khud karta hai), label par nahi.
8. Emails: order confirmation + internal notification ek hi jagah se (Next.js ya Woo), duplicate nahi.
9. `createOrderBySalesRep` / `createOrderFromCart` (bina payment) → hatayein ya naye flow par.

**Testing**

- [ ] Rep, card 4242 → Woo order paid, meta sahi, Mongo record, rep commission sahi
- [ ] Physician, card → physician % + upline rep % dono sahi
- [ ] Admin behalf, card → `placedByAdmin`, physician ke naam par order
- [ ] Rep wallet / physician wallet → order + debit + transaction entry
- [ ] Wallet balance kam → error, koi debit nahi
- [ ] Decline card (4000…0002) → koi order nahi
- [ ] 3D Secure card (4000…3155) → auth ke baad hi order
- [ ] Refresh / double click → sirf ek order
- [ ] Paid, Woo down → PENDING_SYNC, retry se order bane, admin alert
- [ ] Order ke baad Woo stock kam
- [ ] Coupon use → Woo coupon usage +1
- [ ] Discount ke baad commission base sahi (subtotal − discount)
- [ ] Commission rate baad mein badle → purane order ka snapshot same
- [ ] Ek order par ek hi confirmation email + ek internal email
- [ ] Stripe amount = Woo total = Mongo total

**Done kab:** Saare 6 raaste (3 checkouts × Card / Wallet) end-to-end chalein, koi duplicate ya bina order ka charge nahi.

---

## Phase 7: Order management (admin + rep + physician)

**Goal:** Saari order screens Woo orders se chalein.

**Steps**

1. Admin: orders list (search, status filter, pagination), detail, status change, bulk complete, delete → Woo API.
2. Status mapping: PENDING → pending, PROCESSING → processing, SHIPPED → custom status `shipped` (ya tracking plugin), DELIVERED / COMPLETED → completed, CANCELLED → cancelled, REFUNDED → refunded.
3. Order notes: private / customer → Woo order notes (`customer_note: true` email bhejta hai).
4. Edit order address → Woo order shipping / billing.
5. Invoice, packing list, "send order email" → Woo order data se.
6. Rep / physician: orders pages, invoice, Excel export → Woo (`customer` filter + meta).
7. Admin physician / rep detail ke "orders" tabs → Woo.

**Testing**

- [ ] Admin list: search order number / name, status filter, pagination sahi
- [ ] Status change → Woo + Mongo dono update, CANCELLED par commission sweep se bahar
- [ ] Bulk complete 10 orders → sab completed
- [ ] Private note → customer ko email nahi; customer note → email
- [ ] Address edit → invoice / packing list par naya address
- [ ] Invoice / packing list → items, discount, shipping, total sahi
- [ ] Rep sirf apne orders dekhe; Rep A, Rep B ka invoice URL → 403
- [ ] Physician sirf apne orders dekhe
- [ ] Excel export → Woo data, sahi columns
- [ ] Purane (Mongo) orders → ab bhi dikhen (Phase 10 tak read-only)

**Done kab:** Har order screen Woo se, permissions sahi.

---

## Phase 8: Fulfillment + shipping labels

**Goal:** Label kharidna aur tracking WooCommerce plugin se ho, custom FedEx / UPS / USPS code ki jagah. (Shipping errors ka bara hissa yahin hai.)

**Steps**

1. Plugin choose karein: **WooCommerce Shipping** (USPS / UPS / DHL) ya **ShipStation** (FedEx + UPS + USPS sab). FedEx chahiye to ShipStation.
2. Carrier accounts **production** credentials ke saath plugin mein (abhi teeno sandbox / test URLs par hain).
3. Label ke liye weight / dimensions products se (Phase 2), ship-from address store settings se.
4. Tracking number + carrier Woo order se → Next.js (webhook ya order meta), order "shipped" + customer email.
5. Return labels plugin se (ShipStation / UPS returns).
6. Admin order page ka custom shipping panel → "Create label in WooCommerce / ShipStation" link. Purane `Shipment` records read-only rahein.
7. Purana code (`lib/shipping/*`, `actions/admin/shipping.ts`, `/api/shipping/rates`) Phase 10 mein remove.

**Testing**

- [ ] US order → label bane, tracking Woo order par, Next.js par dikhe
- [ ] Har carrier (USPS, UPS, FedEx) ka ek label
- [ ] 4x6 aur Letter label size
- [ ] Apartment / Suite wala address (address2) → label par sahi
- [ ] Ghalat ZIP → carrier ka saaf error, order kharab na ho
- [ ] International (Canada) order → customs form ke saath label
- [ ] Local Pickup order → label ki zarurat nahi, seedha complete
- [ ] FedEx 2Day order → admin ko clear dikhe ke 2Day label lena hai
- [ ] Return label → order status na badle
- [ ] Ek order ke 2 packages → dono tracking numbers
- [ ] Tracking email customer ko jaye, duplicate nahi
- [ ] Purana order (custom label wala) → purana Shipment ab bhi dikhe

**Done kab:** Saare naye labels plugin se, koi custom carrier API call nahi.

---

## Phase 9: Refunds, returns, webhooks + commission sync

**Goal:** Woo mein jo bhi badle, Next.js tak pohanche. Refund / return par paisa aur commission sahi hon.

**Steps**

1. Webhooks: `order.created`, `order.updated`, `order.deleted`, `product.updated`, `coupon.updated` → `app/api/woo/webhook`, `X-WC-Webhook-Signature` verify, idempotent, out-of-order safe.
2. `product.updated` → catalog cache `revalidateTag`.
3. Refund flow (`refund-order-modal`, `return-order-modal`, `processReturn`): Stripe refund Next.js se (payment Next.js mein hua) → Woo refund record (`api_refund: false`, line items, restock) → `OrderRefund` + clawback.
4. Wallet order refund → wallet credit + `WalletTransaction`.
5. Clawback rules: sweep se pehle refund = commission kabhi credit na ho; sweep ke baad = `reverseOrderCommissionIfPaid`.
6. WP admin se seedha refund ho jaye → webhook se Next.js mein clawback.
7. Cron jobs (auto-withdraw, payout notifications, manual sweep) naye data ke saath verify.

**Testing**

- [ ] Galat signature → 401, kuch update nahi
- [ ] Same webhook 2 baar → ek hi effect
- [ ] Webhooks ulti tarteeb mein → purana status naye ko overwrite na kare
- [ ] Card order full refund → Stripe refund, Woo refunded, stock wapas, commission clawback
- [ ] Partial refund (1 item, qty 1 of 3) → proportional clawback
- [ ] Wallet order refund → wallet credit
- [ ] Sweep se pehle refund → commission credit na ho
- [ ] Sweep ke baad refund → reversal transaction, sahi period
- [ ] WP admin se refund → Next.js mein clawback aaye
- [ ] Return label + return → status / stock / commission sahi
- [ ] Monthly sweep (test period) → sirf eligible orders, double credit nahi
- [ ] Withdrawal request + statement PDF → naye orders sahi

**Done kab:** Har paisa / commission / stock change dono systems mein match kare.

---

## Phase 10: Reports, purana data, cleanup + go-live

**Goal:** Dashboards aur reports sahi hon, purana code hate, aur live launch.

**Steps**

1. Admin dashboard, reports (overall sales, by product, returns, rep / doctor commission, customer history) → Woo orders + Mongo commission data.
2. Purane Mongo orders: (a) read-only history rakhein, ya (b) Woo mein import karein (`_pronuvia_legacy` meta). Faisla reports ki zarurat dekh kar.
3. Cleanup: `Product`, `Category`, `SubCategory`, `ShippingRate`, `Coupon`, `Shipment` models + admin pages + `lib/shipping/*` + test routes hata dein (backup ke baad).
4. Vercel env: live Woo keys, live Stripe, webhook secret, crons check.
5. Go-live checklist: final catalog sync, order placement thodi der freeze, webhooks live URL par, rollback plan (purana deploy ready), monitoring (webhook failures, PENDING_SYNC, label errors).

**Testing**

- [ ] Dashboard ke numbers vs Woo Analytics vs purane reports (ek test mahina) → match
- [ ] Har report ka ek manual cross-check
- [ ] Purana order (migration se pehle) → invoice / detail khule
- [ ] Full E2E rep: login → shop → cart → coupon → shipping → card → label → complete → sweep → withdrawal
- [ ] Full E2E physician: wohi wallet ke saath
- [ ] Full E2E admin behalf + refund
- [ ] Website registration → approval → welcome email → login → pehla order
- [ ] Cleanup ke baad build + saare pages bina error
- [ ] Live par pehla chhota real order → Stripe, Woo, Mongo teeno match
- [ ] Pehle 48 ghante monitoring: koi PENDING_SYNC / webhook failure nahi

**Done kab:** Staging par saare E2E pass, live cutover, 48 ghante saaf monitoring.
