# Phases — Pronuvia → Headless WooCommerce (10 phases)

Saara commerce (products, stock, customers, shipping, coupons, cart totals, orders, labels, refunds) WooCommerce par jayega. Next.js mein sirf woh rahega jo Woo mein fit nahi hota: login aur 3 roles, physician approvals, downline, commission snapshot, monthly sweep, wallets, withdrawals, website/blog, aur reports ka UI.

| Phase | Kaam | Risk | Status |
| --- | --- | --- | --- |
| 1 | Foundation + security | Low | Done (WP: dummy products + store address pending) |
| 2 | Catalog (products, categories, stock) | Medium | Done (dummy products cleanup pending) |
| 3 | Customers + structured addresses | Medium | Done (merged into `develop`) |
| 4 | Shipping rates → Woo zones | High | Done on branch `phase-4-shipping` (your test pending) |
| 5 | Coupons + server-side totals | High | Done on branch `phase-5-coupons` (your test pending) |
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

- [x] Admin, sahi keys → health 200, currency USD, products count
- [x] Bina login / sales rep / physician → health 401
- [x] Galat secret → 401 (LiteSpeed cache off hone ke baad)
- [x] Bina key ke `/wp-json/wc/v3/settings/...` → 401 (pehle cache se data mil raha tha)
- [x] Woo site down ya galat URL → 503 + saaf message, page hang na ho
- [x] `WOO_URL` http:// → request bheje bina error
- [x] Build ke baad client bundle mein `ck_` / `cs_` / `WOO_CONSUMER` → 0 hits
- [x] Client component se Woo client import → build fail
- [x] Test routes bina admin login → 401 / 404

- [x] `/api/health` public → sirf up/down; admin → env + DB details

**Done kab:** Connection secure ho, cache masla khatam, test routes band.

**Kya bana (2026-10-07)**

- `lib/woo/client.ts` (server-only `wooFetch`: HTTPS check, 15s timeout, GET par 2 retries, `WooError`, optional Next.js cache), `lib/woo/health.ts`, `GET /api/woo/health` (sirf admin).
- `lib/auth/api-guard.ts` → `rejectUnlessAdmin()`. `/api/test-ups`, `/api/test-usps`, `/api/test-email`, `/api/shipping/rates` ab sirf admin. Pehle bina login ke UPS label kharida ja sakta tha aur kisi ko bhi email bheji ja sakti thi.
- `/api/health`: public ko sirf database up/down; pehle `DATABASE_URL` ke pehle 20 characters (username) bhi dikhte the.
- `.env` / `.env.example` mein `WOO_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET`, `WOO_WEBHOOK_SECRET`.
- Woo side: LiteSpeed REST cache off (bina key 401), currency USD.

**Note:** Host bilkul jawab na de to error ~33 second baad aata hai (har try par ~10s connect timeout, 3 tries). Saaf error milta hai, lekin page itni der rukta hai.

**Pending (WP developer):** 3 dummy "Google Pixel" products + "Smartphones" / "Google Pixel" categories delete; store address (street, city, ZIP) bharein; weight unit (lbs / kg) final.

**Pending (aap):** Vercel par bhi yehi 4 `WOO_*` env vars add karein.

---

## Phase 2: Catalog (products, categories, stock)

**Goal:** Products, sizes, stock aur categories ka source of truth WooCommerce ho. Teeno shops Woo se chalein.

**Faisla (2026-10-08):** Naya Mongo DB khali hai (sirf 1 admin), is liye Mongo → Woo migration (purane steps 1–4) ki zarurat nahi. Woo mein pehle se 7 asli products / 8 sizes hain; wahi source of truth hain.

**Steps**

1. `lib/woo/catalog.ts`: Woo products / variations / categories ko shop ke purane shape mein map karta hai (60s cache). Variation status mapping: disabled (private) → `inactive` (chhupa), meta `_pronuvia_status = discontinued` → `discontinued`, `outofstock` → `out_of_stock`, warna `in_stock`. Default size = Woo "default attribute". Simple product = ek size "Standard".
2. **Sales shop, physician shop, admin order-behalf shop** aur sales / physician product detail pages Woo se. Woo down ho to "temporarily unavailable".
3. Cart item mein `variationId`; checkout ke items JSON mein bhi. Purane cart items (Mongo ObjectId) load par khud hat jate hain.
4. `validateCartItemsAvailability` Woo se (hamesha taaza): product published, size mojood, status, aur tracked stock vs quantity (ek size kai lines par ho to total).
5. Admin: Products list Woo se (pagination ke saath, "Edit in WooCommerce"); Categories / Sub-Categories lists Woo se; product / category add / edit pages WP admin par redirect.
6. Admin "Create Order" product list aur Reports ka product filter Woo se.
7. Label kharidne par aur return par Mongo stock update ab sirf purane (Mongo id wale) items ke liye; Woo stock Phase 6 / 9 mein.

**Testing**

- [x] Teeno shops (sales rep, physician, admin behalf) → Woo ke products, categories, prices
- [x] Product detail (sales + physician) → sizes, prices, category, image (WP media)
- [x] Simple product → ek size "Standard", order validate hota hai
- [x] Disabled size → kisi shop mein nazar nahi aata, checkout par "no longer available"
- [x] `discontinued` size → crossed-out aur select nahi hota (purane UI ka design), checkout par "discontinued"
- [x] Out of stock size → select / add to cart disabled, checkout par "out of stock"
- [x] Draft product → teeno shops se gayab, detail page 404, checkout par "no longer available"
- [x] WP mein price badli → ~1 min mein teeno shops par nayi price
- [x] Stock 3, qty 5 → "Only 3 left"; 2 + 2 do lines par → bhi block; qty 3 → OK
- [x] Purana cart (Mongo id) → load par hat jata hai (filter logic tested; browser mein test baqi)
- [x] Purana Mongo id checkout tak pohanche → "no longer available"
- [x] Ghalat size → "no longer exists"
- [ ] Bina image product, aur lambi description → UI na toote  _(bina image tested; lambi description test nahi hui)_
- [x] Woo down → teeno shops + detail par "temporarily unavailable", admin lists par "Could not load", crash nahi
- [x] Admin products: status (Active / Draft), SKUs, sizes, out-of-stock label, pagination
- [x] Admin categories / sub-categories → Woo se, parent sahi
- [x] Add / edit pages → WP admin par redirect
- [x] Sales rep / physician → admin catalog pages par redirect (unauthorized)

**Done kab:** Teeno shops aur cart Woo IDs par chalein, saara data match ho.

**Notes**

- Woo down ho to admin "Create Order" page khulta hai lekin product list khali hoti hai (koi message nahi).
- Woo stock order par abhi kam nahi hota; Phase 6 mein hoga.
- Purani files (product / category forms, `actions/admin/products.ts` waghera) abhi rakhi hain; Phase 10 cleanup mein hatengi.

**Pending (WP developer):** dummy "Google Pixel" products abhi bhi shops mein dikh rahe hain.

---

## Phase 3: Customers + structured addresses

**Goal:** Har Sales Rep aur har APPROVED Physician ek Woo customer se link ho. Login Next.js mein hi rahega.

**Branch:** `phase-3-customers` (develop se), aap ke test ke baad merge hogi.

**Steps (kya bana, 2026-10-08)**

1. Prisma: `SalesRepresentative.wooCustomerId`, `PartneringPhysician.wooCustomerId` (`Int?`). `@unique` jaan-boojh kar nahi lagaya: MongoDB unique index khali values ko bhi duplicate ginta hai.
2. `lib/addresses/normalize.ts`: teeno saved formats (checkout `AddressData` JSON, admin rep form `{line1…}` JSON, physician columns) ko ek structured address mein badalta hai. Country / state name ya code dono se ISO code. Purana free text → address line 1.
3. `lib/woo/customers.ts`:
    1. `syncWooCustomer`: link nahi → email se dhoondo (mile to link + claim), warna naya customer. Link hai → update. Woo mein customer delete ho gaya ho → dobara link / create. Kabhi throw nahi karta.
    2. Physician sirf APPROVED par. PENDING / REJECTED → skip.
    3. Same email (rep + physician): pehla user owner (`pronuvia_user_id` meta), doosra sirf link hota hai aur owner ka data overwrite nahi karta.
    4. `scheduleWooCustomerSync` (response ke baad chalta hai), `getOrCreateWooCustomer` (checkout ke liye lazy, Phase 6), `syncAllWooCustomers` (backfill).
4. Sync in jagahon se: admin rep create / edit, admin physician create / edit, physician approval, rep profile, physician profile, dono "save checkout address". Delete par Woo customer nahi hatta.
5. Backfill: `POST /api/woo/sync-customers` (`?dryRun=1` = sirf report), sirf admin.
6. Purane string addresses ka alag converter nahi banaya: naya DB khali hai, aur normalizer purane text ko bhi handle karta hai.

**Testing**

- [x] Dry run → kuch nahi likha, "would create"
- [x] Rep, checkout JSON address → customer bana; billing aur shipping alag-alag sahi
- [x] Rep, admin-form JSON address → billing + shipping dono mein
- [x] Rep bina address → customer bana (naam / email)
- [x] Approved physician → customer bana; "California" / "United States" → CA / US, practice → company
- [x] Pending / Rejected physician → skip; pending → approved → customer bana
- [x] Pehle se mojood Woo email → link + claim, duplicate nahi
- [x] Rep + physician same email → physician "shared", rep ka data overwrite nahi hua
- [x] Woo down → "failed", user par asar nahi; Woo wapas aane par lazy getOrCreate se link
- [x] Address + email badla → Woo customer update
- [x] Woo mein customer delete → sync par naya customer
- [x] Dobara sync → "updated" / "shared", koi duplicate nahi
- [x] Backfill route bina admin → 401; dry run asli users ko nahi chhedta
- [ ] UI se: admin rep / physician create, approval, profile edit → Woo customer bane / update ho  _(sync logic test hua; server actions se browser mein aap test karenge)_
- [ ] Login (email + loginId), forgot / reset password → pehle jaise  _(code nahi badla; browser test baqi)_

**Done kab:** 100% active users ke paas `wooCustomerId` aur structured address ho.

**Pending**

- **WP developer:** WooCommerce → Settings → Emails → **"New account" email OFF** karein. Warna har naye rep / physician ko WooCommerce ka "account created" email (WordPress username ke saath) jayega.
- **Aap:** test ke baad backfill ek baar chalayein (pehle `?dryRun=1`) taa'ke 2 mojood users bhi link ho jayein.
- **Alag bug mila (fix baqi):** `loginId` ka unique index khali value ko bhi ginta hai, is liye sirf **ek** rep (aur ek physician) bina Login ID ke ban sakta hai. Doosre par "This Login ID is already in use." aata hai. Fix: DB mein partial unique index (aap ki ijazat se).

---

## Phase 4: Shipping rates → Woo zones

**Goal:** Checkout ke shipping options `ShippingRate` table ki jagah Woo shipping zones se aayein.

**Kya mila:** Mongo ki `ShippingRate` table khali thi (0 rules), is liye migration script ki zaroorat nahi padi. Woo par zones pehle se bane hain: New York $5, Rest of US $9.99, Canada / Mexico $19.99, Rest of World $34.99. Rates ab sirf WP admin (WooCommerce → Settings → Shipping) se manage honge.

**Kya bana**

1. `lib/woo/shipping.ts` → `quoteShipping(items, address)`: Woo Store API par guest cart (`Cart-Token`), items + address daal kar Woo ke rates wapas. Woo ka apna zone order lagta hai: pehla matching zone hi.
2. State code milan: hamari address list aur Woo ke codes kuch mulkon mein alag hain (Berlin "BE" vs Woo "DE-BE"). Woo ki state list (1 din cache) se code milaya jata hai, na mile to state khali (country zone phir bhi lagta hai).
3. Ghalat ZIP (jaise US mein "abc", ya Canada ke saath US ka zip) → "Please enter a valid ZIP / postal code", order block.
4. `actions/checkout/shipping-quote.ts` → `getShippingQuote` (login zaroori). `lib/shipping/use-shipping-quote.ts` hook teeno checkouts mein: country / state / ZIP badalne par naya quote (ZIP par 400ms wait), purana jawab kabhi naye address par nahi lagta.
5. Koi rate na ho, rates load ho rahe hon, ya error ho → Place Order band. Error par "Try again" button.
6. Admin "Shipping Rates" → WP shipping settings par redirect. Purana code hata diya: `lib/shipping/calculate.ts`, `actions/admin/shipping-rates.ts`, `components/admin/shipping-rates-client.tsx`. Prisma model `ShippingRate` Phase 10 cleanup mein hatega.

**Note:** Order par shipping ka naam Woo method ka title save hota hai ("New York", "Rest of US"). Label wala page "FedEx 2Day" naam dhoondta hai, is liye FedEx 2Day ka method WP mein isi naam se banayein. Cost abhi bhi client se server jaati hai; server par dobara hisaab Phase 5 mein.

**Testing**

- [x] ~~Har purana rule → Woo mein same~~ (purane rules the hi nahi)
- [x] NY → New York $5, TX → Rest of US $9.99, Canada → $19.99, Germany → Rest of World $34.99 (teeno checkouts)
- [x] Form order ke saath sahi cost + naam bhejta hai (rep, physician)
- [x] Germany + Berlin (Woo code `DE-BE`) → rate aata hai
- [x] Ghalat ZIP → saaf message, order block; sahi ZIP → rate wapas
- [x] Jis address ka koi method nahi → "No shipping available", Place Order band
- [x] Address badlein → options dobara load
- [x] Ek item do baar cart mein → quote theek
- [x] Woo down → "could not be loaded" + Try again, Place Order band
- [x] Admin Shipping Rates → WP shipping settings
- [ ] Local Pickup / Free shipping / FedEx 2Day → abhi Woo mein ye methods bane hi nahi; banayein to ek baar check karein
- [ ] Aap ka apna test: teeno checkouts par ek baar address badal kar dekhein

**Done kab:** Teeno checkouts ke rates 100% Woo se, purani table istemal mein nahi.

---

## Phase 5: Coupons + server-side totals

**Goal:** Coupons Woo mein hon, aur har total server par Woo calculate kare. Browser ki koi value trust nahi.

**Kya mila:** Mongo mein koi coupon nahi tha (0), aur Woo mein bhi nahi, is liye migration ki zaroorat nahi padi. Branch `phase-5-coupons` `phase-4-shipping` se nikli hai (Phase 4 abhi merge nahi hua tha).

**Kya bana**

1. `lib/woo/store-cart.ts` → `priceWooCart`: Woo Store API ka guest cart: items, address, coupon, chuna hua shipping rate. Woo subtotal, discount, har shipping option ki qeemat + tax, aur item tax deta hai. (Phase 4 ka `lib/woo/shipping.ts` isi mein badal gaya.)
2. `lib/woo/coupons.ts`: Woo jo check nahi kar sakta:
   - **Kis ke liye:** coupon meta `pronuvia_applicable_to` = ALL / SALES_REP / PHYSICIAN. Meta na ho to ALL (WP admin mein bana coupon sab ke liye). Admin "on behalf" ka order physician ka hai, is liye physician coupons lagte hain.
   - **Use limit:** Phase 6 tak Woo ka `usage_count` 0 rehta hai (order Woo mein nahi banta), is liye hamare orders se bhi gina jata hai (cancelled chhod kar). Dono mein jo zyada ho. Phase 6 ke baad bhi double nahi ginega.
   - Amount, minimum spend, expiry Woo khud check karta hai.
3. `lib/checkout/price-order.ts` → `priceOrder`: order ke waqt browser sirf items, address, shipping rate id, coupon code aur **dikhaya gaya total** bhejta hai. Server Woo se dobara hisaab karta hai. Total alag ho (WP mein price badla, ya kisi ne chhed-chhad ki) to order rukta hai: "The order total is now $X". Shipping option ab na mile ya coupon rad ho, to bhi order rukta hai.
4. **Card:** teeno payment-intent routes amount khud nikalte hain, browser ka `amountInCents` ab nahi chalta. Quote `CheckoutQuote` (Mongo) mein save hota hai, aur Stripe PaymentIntent par us ka `quoteId` hota hai. Payment ke baad order isi quote se banta hai, aur quote mita diya jata hai. PaymentIntent ka amount aur quote ka total cent tak milaya jata hai.
5. **Wallet:** balance check aur kati raqam dono server quote ke total se.
6. Checkout pages: subtotal, coupon, tax (sirf jab ho) aur total Woo se. Shipping option badalne par dobara request nahi jati (har option ki qeemat quote mein hoti hai). Coupon rad ho to Woo ka message dikhta hai aur coupon hat jata hai.
7. Admin Coupons page: wahi UI, data Woo mein (`actions/admin/coupons.ts`). Woo mein bhi WP admin → Marketing → Coupons se badal sakte hain. Coupon ka code edit nahi hota.
8. Order par naya field `taxAmount` (Woo ka tax). Purana `validate-coupon` action, Mongo `usedCount` ka hisaab aur `couponId` hata diye. Prisma model `Coupon` Phase 10 cleanup mein hatega.

**Raaste mein mile masle (theek kiye)**

- Woo REST `date_expires_gmt` ko likhte waqt nazar-andaz karta hai, aur `null` se expiry nahi hat'ti. Ab `date_expires` UTC (`…Z`) mein jata hai, aur `""` se expiry hat'ti hai.
- Woo ki coupon list draft (band) coupons sirf `status=any` par dikhati hai, aur `?code=` draft ko kabhi nahi dhoondhta. Admin list ab `status=any` se aati hai, aur code `search` se exact milaya jata hai.
- Woo ke messages mein `&#036;` jaise codes ab theek decode hote hain.

**Note:**
- Order khud abhi bhi Mongo mein banta hai; Woo order Phase 6 mein.
- WP mein tax ON hai lekin koi tax rate nahi, is liye tax $0. Rate banayein to checkout aur total mein khud aayega, `taxAmount` mein save hoga; invoice / email mein tax ki line abhi nahi hai.
- Card ka minimum Stripe $0.50 hai. Is se kam total (100% coupon + free shipping) sirf wallet se.
- Woo ka "per customer limit" aur "allowed emails" abhi kaam nahi karte (guest cart mein customer email nahi jata).

**Testing** (Stripe test mode, email band, sab test data aakhir mein saaf)

- [x] ~~Har purana coupon → Woo mein same~~ (purane coupons the hi nahi)
- [x] 10% coupon, $200 cart → $20 discount, total $185 (NY $5)
- [x] Fixed $25 coupon, $5 cart → discount $5, total minus nahi ($5 sirf shipping)
- [x] Min amount se kam cart → "The minimum spend for coupon … is $100.00"
- [x] Expired / band (draft) / limit khatam / ghalat code → error, total waisa hi
- [x] Physician-only coupon rep ke checkout par → rad; physician ke checkout par → lagta hai
- [x] Coupon + free shipping + NY rate → "Free shipping" option; free → $4.50, NY → $9.50
- [x] DevTools: purana `amountInCents`, total $1, price $0.01, banaya hua free shipping rate, physician coupon rep se → sab rad ya nazar-andaz; Stripe amount sahi
- [x] Wallet form mein total $0.01 → rad, wallet nahi kata
- [x] Quote ke baad WP mein price $5 → $6 → order rad, "total is now $11.00", summary naya total dikhata hai
- [x] Teeno checkouts mein screen ka total = server total = Stripe amount (cent tak); card order quote se bana
- [x] Wallet order + coupon → order par subtotal, discount, shipping, tax, total, coupon, Woo price + SKU, commission (subtotal − discount par), wallet theek se kata
- [x] Admin Coupons: Woo coupons list, naya coupon (fixed, min, physicians only, expiry) Woo mein sahi
- [ ] Admin Coupons: "Deactivate" button → Woo draft (C: drive bhar jane se UI test nahi chal saka)
- [ ] Aap ka apna test: teeno checkouts par coupon laga kar ek order

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
