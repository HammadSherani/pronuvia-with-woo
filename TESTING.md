# Testing checklist — Phase 1, 2, 3 (`develop` branch)

Har test browser mein karein. Har point: **kya karna hai → kya hona chahiye**. Pass ho to `[x]` laga dein; fail ho to neeche "Notes" mein likh dein.

---

## 0. Tayyari

- [ ] `develop` branch checkout karein, dev server **restart** karein (Prisma ka naya `wooCustomerId` field load ho)
- [ ] `.env` mein `WOO_URL`, `WOO_CONSUMER_KEY`, `WOO_CONSUMER_SECRET` hain
- [ ] WooCommerce mein kam se kam **ek asli variable product** (sizes ke saath) aur ek **simple product** ho
- [ ] Teen logins tayyar: **Admin**, **Sales Rep**, **Physician** (approved)
- [ ] Test ke liye ek **approved physician** ho (admin "Order on behalf" ke liye)

**API test karne ka tareeqa:** admin login ho kar browser ka DevTools → Console kholein aur likhein:

```js
await (await fetch("/api/woo/health")).json()
```

POST route ke liye: `await (await fetch("/api/...", { method: "POST" })).json()`

---

## 1. Phase 1 — Woo connection + security

### Woo health check

- [ ] Admin login → `/api/woo/health` → `ok: true`, `currency: "USD"`, `currencyOk: true`, `productCount` sahi
- [ ] Logout → `/api/woo/health` kholein → **401 Unauthorized**
- [ ] Sales Rep login → `/api/woo/health` → **401**
- [ ] Physician login → `/api/woo/health` → **401**

### Pehle khule routes ab band

- [ ] Logout → `/api/test-ups` → **401** (pehle is se asli UPS label kharida ja sakta tha)
- [ ] Logout → `/api/test-usps` → **401**
- [ ] Logout → `/api/test-email?to=apna@email.com` → **401**, koi email na aaye
- [ ] Logout → `/api/shipping/rates` par POST → **401**
- [ ] Sales Rep login → `/api/test-ups` → **401**

### `/api/health`

- [ ] Logout → `/api/health` → sirf `timestamp` aur `database` dikhe (koi env / DB detail nahi)
- [ ] Admin login → `/api/health` → env vars (✅ SET), `admin_count` dikhe

---

## 2. Phase 2 — Catalog (shops WooCommerce se)

### Teeno shops

- [ ] **Sales Rep** → `/sales/shop` → WooCommerce ke products, categories, prices dikhen
- [ ] **Physician** → `/physician/shop` → wahi products
- [ ] **Admin** → Physicians → kisi approved physician par "Order on behalf" → shop → wahi products
- [ ] Category buttons se filter → sahi products
- [ ] Search box mein product ka naam → sahi product

### Product detail page

- [ ] Sales Rep → kisi product par click → naam, image, sizes, price, category dikhen
- [ ] Physician → kisi product par click → same
- [ ] Ghalat URL (`/sales/shop/koi-ghalat-naam`) → "not found" page
- [ ] "Related products" mein usi category ke products

### Sizes / variants (WP admin mein change kar ke check karein; shop par ~1 minute lagta hai)

- [ ] Variable product ke saare sizes chips mein dikhen; default size pehle se select ho
- [ ] Do attributes wala product (jaise size + color) → chip "Small / Blue" jaisa dikhe
- [ ] WP mein ek variation **disable** karein → woh size shops se gayab
- [ ] WP mein ek variation ka stock **0** karein → size dikhe magar select / "Add to cart" na ho ("Out of Stock")
- [ ] WP mein product **Draft** karein → teeno shops se gayab, detail page "not found"
- [ ] WP mein price badlein → ~1 minute baad teeno shops par nayi price
- [ ] Simple product → ek size "Standard" dikhe, cart mein add ho
- [ ] Bina image product → placeholder icon, layout na toote
- [ ] Bahut lambi description wala product → detail page na toote
- [ ] Test ke baad WP mein saari values wapas theek karein

### Cart + checkout se pehle check

- [ ] Product cart mein add karein → cart page par sahi naam, size, SKU, price
- [ ] Cart mein item rakhein, phir WP mein us size ka stock 0 karein → checkout par **"... is out of stock and cannot be ordered."**
- [ ] WP mein stock 3 rakhein, cart mein qty 5 → checkout par **"Only 3 ... left in stock"**
- [ ] Wahi size do baar cart mein (2 + 2), stock 3 → bhi block ho
- [ ] Purana cart (Woo se pehle wala) → shop kholne par khud saaf ho jaye, checkout crash na ho

### Admin catalog pages

- [ ] Admin → **Products** → list WooCommerce se: SKU, sizes, category, price, qty, status (Active / Draft)
- [ ] "Edit in WooCommerce" → WP admin ka product edit page khule
- [ ] "Open WooCommerce" button → WP products list khule
- [ ] `/admin/products/new` kholein → WP "Add new product" par chala jaye
- [ ] Admin → **Categories** aur **Sub-Categories** → Woo categories dikhen, sub-category ke saath parent
- [ ] `/admin/categories/new` → WP categories page par chala jaye
- [ ] Admin → Orders → **Create Order** → product dropdown mein Woo products
- [ ] Admin → **Reports** → product filter mein Woo products
- [ ] Sales Rep / Physician `/admin/products` kholein → unauthorized

### Woo band ho to (optional: `.env` mein `WOO_URL` ghalat kar ke restart)

- [ ] Teeno shops → "The product catalogue is temporarily unavailable", crash nahi
- [ ] Admin Products / Categories → "Could not load ... from WooCommerce"
- [ ] Test ke baad `WOO_URL` theek karein aur restart

---

## 3. Form values fix (error par values nahi mitni chahiye)

Har form mein jaan-boojh kar error laayein (jaise pehle se istemal hua email / Login ID), phir check karein ke **baqi bhari hui fields khali na hon**:

- [ ] Admin → Add Medical Rep
- [ ] Admin → Edit Medical Rep
- [ ] Admin → Add Physician
- [ ] Admin → Edit Physician
- [ ] Website → Physician registration (terms tick kar ke)
- [ ] Sales Rep → Add Physician
- [ ] Sales Rep → Account / Profile edit
- [ ] Physician → Account edit
- [ ] Admin → Banner, Website Banner, Blog forms
- [ ] Bank details popup (dashboard)
- [ ] Har form mein **sahi data** se save → pehle jaisa success message / redirect
- [ ] Password / account number match na ho → wahi purana error, form submit na ho

---

## 4. Phase 3 — Woo customers

WP Admin → **Users** mein customer dekhein (username `pronuvia-sales-rep-...` / `pronuvia-physician-...`).

### Banna

- [ ] Admin → naya **Sales Rep** banayein (address ke saath) → WP Users mein customer bane; billing / shipping address sahi
- [ ] Admin → naya **Physician**, status **Approved** → customer bane, address + practice name (company)
- [ ] Admin → naya Physician, status **Pending** → customer **na** bane
- [ ] Approvals → us pending physician ko **Approve** → ab customer bane
- [ ] Approvals → kisi ko **Reject** → customer na bane
- [ ] Sales Rep → **Add Physician** (pending) → customer na bane; admin approve kare → bane
- [ ] Website registration (pending) → customer na bane; approve par bane

### Update

- [ ] Admin → rep ka naam / email / address edit → WP customer mein bhi badle
- [ ] Sales Rep → apna profile / address edit → WP customer update
- [ ] Physician → apna account / address edit → WP customer update
- [ ] Checkout par address save (rep / physician) → WP customer ka address update

### Khaas cases

- [ ] WP mein pehle se ek customer us email ke saath ho → naya rep bane to **naya customer na bane**, wahi link ho
- [ ] Rep aur physician **same email** → WP mein ek hi customer; physician ke edit se rep ka data na badle
- [ ] Rep / physician delete → WP customer **na** hate
- [ ] Woo band ho (`WOO_URL` ghalat) → naya rep phir bhi ban jaye (customer baad mein)

### Backfill (purane users ko link karna)

- [ ] Admin console: `await (await fetch("/api/woo/sync-customers?dryRun=1", { method: "POST" })).json()` → report aaye, kuch save na ho
- [ ] Phir bina `dryRun`: `await (await fetch("/api/woo/sync-customers", { method: "POST" })).json()` → mojood users link hon
- [ ] Dobara chalayein → sab "updated" / "shared", **koi duplicate customer nahi**
- [ ] Logout / Sales Rep se ye route → **401**

> Pehle WP developer se WooCommerce ki **"New account" email OFF** karwa lein, warna har naye customer ko WooCommerce ki email jayegi.

---

## 5. Login ID required (sales rep)

- [ ] Admin → Add Medical Rep → Login ID par **\*** dikhe
- [ ] Login ID khali → **"Login ID is required"**, baqi fields bhari rahein
- [ ] Login ID 2 characters / space wala → sahi error
- [ ] Pehle se istemal hua Login ID → "This Login ID is already in use."
- [ ] Do reps alag-alag Login ID ke saath → dono ban jayein
- [ ] Edit rep → Login ID khali chhod kar save → purana Login ID wahi rahe

---

## 6. Purani cheezein pehle jaisi (regression)

- [ ] Sales Rep login **email** se, aur **Login ID** se
- [ ] Physician login **email** se, aur **Login ID** se
- [ ] Admin login email se
- [ ] Ghalat password → "Invalid email or password."
- [ ] Forgot password → email aaye → reset link se naya password → login
- [ ] Sales Rep dashboard, orders, wallet, withdrawals pages khulen
- [ ] Physician dashboard, orders, wallet pages khulen
- [ ] Admin dashboard, orders, physicians, sales reps, approvals pages khulen
- [ ] Website pages (home, about, contact, blog, research) khulen

---

## Abhi jaan-boojh kar nahi hai (aage ke phases)

- Order par **Woo stock kam nahi hota** (Phase 6)
- Checkout ki shipping abhi purani "Shipping Rates" table se (Phase 4)
- Orders abhi bhi sirf MongoDB mein (Phase 6)

## Notes (fail hone wale tests yahan likhein)

-
