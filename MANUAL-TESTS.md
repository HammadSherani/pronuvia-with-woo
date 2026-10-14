# Pronuvia: Manual Testing Checklist

Staging par haath se test karne ki poori list: website registration se le kar order, shipping, return, refund, commission, wallet aur withdrawal tak. Har test ke saath **kaise karein** aur **kya hona chahiye**. Pass ho to ✓, fail ho to ✗ aur notes mein kya dekha.

- Kaun se system: **Pronuvia** (Next.js admin / rep / physician panel), **WP admin** (WooCommerce), **Stripe dashboard** (test mode), **email inbox** + Admin → Email Logs.
- "Dono jagah" = Pronuvia aur WP admin → WooCommerce → Orders, dono mein check karein.
- Tafseel ke liye: `PHASES.md` (har phase kya karta hai), `GO-LIVE.md` (live jaane ke qadam).

---

## 0. Tayari (testing se pehle)

| | Kya | Kaise |
|---|---|---|
| P1 | Admin login | `/login` par admin email / password |
| P2 | 2 sales reps | **Rep A**, **Rep B** (Admin → Sales Reps → New). Dono ka password set karein |
| P3 | 3 physicians | **Dr. A1** (Rep A ke neeche), **Dr. B1** (Rep B ke neeche), **Dr. X** (website se register, kisi rep ke bina; section 2 mein banega) |
| P4 | Wallet balance | Admin → Wallet Adjustment se Rep A ko $500, Admin → Physician Wallet Adjustment se Dr. A1 ko $500 (wallet orders ke liye) |
| P5 | Commission rates | Rep A: 10%, Dr. A1: 5%, Rep A ki upline commission Dr. A1 ke orders par: 3% (jo bhi aap ke system mein hai, likh lein; hisaab isi se check hoga) |
| P6 | Woo product | Kam se kam 1 product jis ke 2+ variations (size / color), price set, **Manage stock ON**, stock 50 |
| P7 | Coupons | Section 8 ke coupons (percentage, fixed, min amount, expiry, sirf rep, sirf physician) |
| P8 | Shipping zones | WP: New York, Rest of US, FedEx 2Day, Canada / Mexico, Rest of World (rates likh lein) |
| P9 | Stripe test cards | Kamyab: `4242 4242 4242 4242` · Decline: `4000 0000 0000 0002` · Paisa kam: `4000 0000 0000 9995` · 3D Secure: `4000 0025 0000 3155` (expiry koi bhi future date, CVC koi bhi 3 digit) |
| P10 | Email | Test users ke asli inbox, ya Admin → Email Logs mein dekhein |
| P11 | WP admin | WooCommerce → Orders, Products, Coupons, Settings tak pahunch |
| P12 | Dev server | `npx prisma generate` ke baad `npm run dev` (schema Phase 10 mein badla hai) |

---

## 1. Website (public pages)

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 001 | Home page | `/` kholein | Banners, sections, links bina error; mobile par bhi theek | |
| 002 | About page | `/about` | Content dikhe | |
| 003 | Contact page | `/contact` form bharein, bhejein | Success message; email / log bane | |
| 004 | Contact form khaali | Bina fields ke bhejein | Har zaroori field par error, kuch na bhejein | |
| 005 | Research list | `/research` | Research items ki list | |
| 006 | Research detail | Kisi item par click | Detail page khule | |
| 007 | Blog detail | `/blog/<slug>` (admin mein bana blog) | Blog dikhe, image ke saath | |
| 008 | Galat blog slug | `/blog/koi-galat-slug` | 404 page | |
| 009 | Terms page | `/terms` | Content dikhe | |
| 010 | Partnering Physician page | `/partnering-physician` | Registration form dikhe | |
| 011 | Website banners | Admin mein website banner banayein → home par dekhein | Naya banner home par | |
| 012 | Logged-out user dashboard URL | Logout karke `/admin/dashboard` kholein | Login page par bheje | |
| 013 | Unauthorized page | Rep login karke `/admin/orders` kholein | `/unauthorized` ya login, admin data na dikhe | |

## 2. Registration aur approval

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 014 | **User (physician) registration from website** | `/partnering-physician` form poora bharein (Dr. X) | "Registered / pending approval" message | |
| 015 | Registration email | 014 ke baad inbox / Email Logs | Physician ko registration email | |
| 016 | Admin ko pending dikhe | Admin → Approvals | Dr. X "Pending" list mein | |
| 017 | Duplicate email se registration | Wahi email dobara register | Error: email pehle se hai | |
| 018 | Galat email format | `abc@` jaisa email | Field error, form submit na ho | |
| 019 | Zaroori fields khaali | Naam / phone / practice khaali | Har field par error | |
| 020 | Form error ke baad values | Ek field galat rakh kar submit | Baqi likhi values form mein bachi rahein | |
| 021 | Pending physician login | Dr. X login ki koshish (password abhi set nahi) | Login na ho | |
| 022 | Approval detail | Approvals → Dr. X kholein | Saari registration info dikhe | |
| 023 | Approval edit | Approvals → Dr. X → Edit, phone badlein, save | Naya phone save | |
| 024 | **Approve physician** | Approvals → Dr. X → Approve | Status APPROVED, list se hat jaye | |
| 025 | Approval email + password link | 024 ke baad Dr. X ka inbox | Welcome / approval email, password set karne ka link | |
| 026 | Rep ko approval ki khabar | Rep ke neeche wale physician ko approve karein | Rep ko "doctor approved" email | |
| 027 | Password set link | 025 wala link kholein, naya password do baar | Password set, login page | |
| 028 | Password link dobara | Wahi link dobara kholein | Expired / invalid message | |
| 029 | Approved physician login | Dr. X naye password se login | Physician dashboard | |
| 030 | Woo customer bana | WP admin → Users / Customers | Dr. X ka Woo customer (email se) | |
| 031 | **Reject physician** | Ek naya registration → Approvals → Reject (reason ke saath) | Status REJECTED, login na ho | |
| 032 | Reject ka email | 031 ke baad | Physician ko rejection email (agar system bhejta hai) | |
| 033 | **Rep adds physician** | Rep A login → Physicians → New, form bharein | Physician PENDING, Rep A ke neeche | |
| 034 | Rep add ke emails | 033 ke baad | Physician ko registration email, Rep A ko "doctor signup" email | |
| 035 | Rep ki physician list | Rep A → Physicians | Naya physician "Pending" ke saath; filter (Pending / Approved) chale | |
| 036 | Admin adds physician | Admin → Physicians → New | Physician bane (approved / pending jaisa system kare), set-password email | |
| 037 | Admin adds sales rep | Admin → Sales Reps → New | Rep bane, set-password email, Woo customer | |

## 3. Login, password, account

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 038 | Admin login | Sahi email / password | Admin dashboard | |
| 039 | Rep login | Rep A | Sales dashboard | |
| 040 | Physician login | Dr. A1 | Physician dashboard | |
| 041 | Galat password | Sahi email, galat password | Error, login na ho | |
| 042 | Na-mojood email | Koi bhi naya email | Error (ye na bataye ke email hai ya nahi) | |
| 043 | Forgot password | `/forgot-password` email dalein | Reset link email | |
| 044 | Reset password | Link kholein, naya password | Naye password se login ho, purane se nahi | |
| 045 | Expired reset link | Purana / istemal shuda link | Invalid / expired message | |
| 046 | Logout | Logout dabayein | Login page; back button se dashboard data na dikhe | |
| 047 | Session ke baad URL | Logout ke baad `/sales/orders` | Login page | |
| 048 | Admin account | Admin → Account, email / password badlein | Badla hua save, naye se login | |
| 049 | Rep profile | Rep → Account, naam / phone badlein | Save, dobara kholne par naya | |
| 050 | Physician profile | Physician → Account, info badlein | Save | |
| 051 | Saved address | Rep / physician → Account / checkout par address save | Agli checkout par wahi address pehle se bhara | |
| 052 | Admin setup page | `/admin-setup` (galat token ke saath) | Naya admin na bane | |

## 4. Admin: sales reps aur physicians manage karna

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 053 | Reps list | Admin → Sales Reps | Saare reps, pagination | |
| 054 | Rep detail | Rep A kholein | Info, wallet, physicians, orders | |
| 055 | Rep edit | Rep A ka phone badlein | Save | |
| 056 | Rep commission badlein | Rep A commission 10% → 12% | Naya rate; **naye** orders par 12%, purane wahi | |
| 057 | Rep ke orders | Rep A → Orders tab | Sirf Rep A ke orders | |
| 058 | Reps export | Sales Reps → Export | File download, saare reps | |
| 059 | Rep delete | Ek test rep (bina orders) delete | List se hat jaye, login na ho | |
| 060 | Physicians list + filter | Admin → Physicians, filter lagayein | Sahi filter results | |
| 061 | Physician detail | Dr. A1 kholein | Info, rep, commission, wallet | |
| 062 | Physician edit | Dr. A1 ki practice / phone badlein | Save | |
| 063 | Doctor commission badlein | Dr. A1 5% → 6% | Naye orders par 6% | |
| 064 | Upline commission badlein | Dr. A1 ke liye rep ki upline 3% → 4% | Naye orders par Rep A ko 4% | |
| 065 | Rep badalna | Dr. A1 ko Rep B ke neeche karein (agar edit mein option hai) | Naye orders ki upline commission Rep B ko | |
| 066 | Physician ke orders | Dr. A1 → Orders | Sirf us ke orders | |
| 067 | Physician delete | Test physician (bina orders) delete | List se hat jaye | |
| 068 | Rep physician ki commission badle | Rep A → Physicians → Dr. A1 commission badlein (agar rep ko ijazat hai) | Save; had se zyada na ho sake | |

## 5. Shop aur products (WooCommerce se)

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 069 | Rep shop | Rep A → Shop | Woo ke products, image, price | |
| 070 | Physician shop | Dr. A1 → Shop | Wahi products | |
| 071 | Product detail | Kisi product par click | Images, description, variations | |
| 072 | Variation chunna | Size / color badlein | Price, SKU, stock us variation ke mutabiq | |
| 073 | Out of stock variation | WP mein ek variation stock 0 | Shop par "out of stock", cart mein na jaye | |
| 074 | Draft product | WP mein product Draft karein | Shop se gayab (thodi der / refresh baad) | |
| 075 | Naya product WP mein | WP mein naya product publish | Shop par aa jaye (cache: kuch der / webhook ke baad foran) | |
| 076 | Price badlein WP mein | WP mein price badlein | Shop / product page par naya price | |
| 077 | Category filter | Shop mein category chunein | Sirf us category ke products | |
| 078 | Search | Shop search mein naam | Sahi products | |
| 079 | Admin products page | Admin → Products | Woo products list; "Add / Edit" WP admin par le jaye | |
| 080 | Admin categories | Admin → Categories / Sub-categories | Woo categories; edit WP admin par | |
| 081 | Galat product URL | `/sales/shop/galat-slug` | 404 | |

## 6. Cart

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 082 | Add to cart | Product + variation + qty 2 → Add | Cart count badhe, item cart mein | |
| 083 | Do variations | Same product ke 2 variations | Cart mein 2 alag lines | |
| 084 | Qty badlein | Cart mein qty 2 → 3 | Line total aur subtotal update | |
| 085 | Item hatayein | Cart mein remove | Item hat jaye, total update | |
| 086 | Stock se zyada | Stock 5, qty 10 | Error / had 5 tak | |
| 087 | Cart refresh ke baad | Page refresh / logout-login | Cart bachi rahe (usi user ka) | |
| 088 | Users ka alag cart | Rep A cart bhar ke logout, Dr. A1 login | Dr. A1 ka cart alag | |
| 089 | Khaali cart checkout | Khaali cart se checkout URL | Checkout na ho / cart par wapas | |
| 090 | Price badla cart ke baad | Cart mein item, phir WP mein price badlein, checkout | Checkout naya (sahi) price dikhaye | |

## 7. Shipping (checkout par)

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 091 | New York address | Checkout, US / NY | New York zone ka rate | |
| 092 | Rest of US | US / TX | Rest of US rate | |
| 093 | FedEx 2Day option | US / TX, FedEx 2Day chunein | FedEx 2Day ka rate, total update | |
| 094 | FedEx 2Day New York mein | US / NY | NY zone mein FedEx 2Day hai to dikhe, warna na dikhe (WP setting ke mutabiq) | |
| 095 | Canada | CA / Ontario | Canada / Mexico rate | |
| 096 | Mexico | MX | Canada / Mexico rate | |
| 097 | Rest of world | DE (Germany) | Rest of World rate | |
| 098 | Country badalna | TX → Canada | Rate aur total foran badlein | |
| 099 | State zaroori | US chunein, state khaali | Error, order na ho | |
| 100 | ZIP / address khaali | Khaali fields | Field errors | |
| 101 | Free shipping | Agar WP mein free shipping (min amount / coupon) | Shart poori ho to $0 shipping | |
| 102 | Shipping WP mein badlein | WP mein Rest of US rate badlein | Checkout naya rate | |
| 103 | Admin behalf shipping | Admin → Order Behalf checkout | Wahi zones / rates | |

## 8. Coupons

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 104 | Coupon banana (admin) | Admin → Coupons → New: 10% | WP → Coupons mein bhi bane | |
| 105 | Percentage coupon | Checkout par 10% coupon | Subtotal ka 10% discount, total sahi | |
| 106 | Fixed coupon | $5 coupon | $5 kam | |
| 107 | Galat coupon | `NOTREAL` | "Invalid coupon" error | |
| 108 | Expired coupon | Expiry kal ki | Error | |
| 109 | Min order amount | Min $50 coupon, cart $20 | Error; cart $60 par chale | |
| 110 | Usage limit | Max uses 1 → ek order → dobara | Doosri baar error | |
| 111 | Inactive coupon | Admin mein inactive | Error | |
| 112 | Sirf rep coupon | "Kis ke liye: Rep" | Rep par chale, physician par error | |
| 113 | Sirf physician coupon | "Kis ke liye: Physician" | Physician par chale, rep par error | |
| 114 | Coupon hatana | Laga coupon remove | Discount hat jaye | |
| 115 | Coupon + shipping | Coupon ke saath shipping | Discount sirf items par; shipping wahi | |
| 116 | Coupon WP mein banaya | WP → Marketing → Coupons mein naya | Pronuvia checkout par chale | |
| 117 | Coupon order par | Coupon se order | Order detail + Woo order par coupon line + discount | |
| 118 | Coupon usage count | 117 ke baad | WP mein coupon usage +1 | |
| 119 | Coupon edit | Admin → Coupons, % badlein | Naya % checkout par | |

## 9. Order banana (checkout aur payment)

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 120 | **Order create from sales rep (card)** | Rep A: cart → checkout → card 4242 → Pay | "Order placed", order number (13xxx) | |
| 121 | **Order create from sales rep (wallet)** | Rep A: wallet se pay | Order; wallet se total kat jaye | |
| 122 | **Order create from physician (card)** | Dr. A1: card 4242 | Order bane | |
| 123 | **Order create from physician (wallet)** | Dr. A1: wallet | Order; Dr. A1 ke wallet se total kate | |
| 124 | **Order create from admin (on behalf of physician)** | Admin → Order Behalf → Dr. A1 → shop → cart → card | Order Dr. A1 ka, "placed by admin" | |
| 125 | Wallet kam | Wallet $10, order $50 | Error "insufficient balance", order na bane, wallet na kate | |
| 126 | Card decline | Card `4000 0000 0000 0002` | Error, order na bane | |
| 127 | Paisa kam (card) | `4000 0000 0000 9995` | Error, order na bane | |
| 128 | 3D Secure | `4000 0025 0000 3155`, popup mein Complete | Order bane | |
| 129 | 3D Secure fail | Wahi card, popup mein Fail | Order na bane | |
| 130 | Double click Pay | Pay do baar jaldi | Sirf **ek** order, ek charge | |
| 131 | Patient email | Checkout par patient email dalein | Order par patient email; confirmation patient ko | |
| 132 | Bina patient email | Khaali chhorein | Order bane; email physician / rep ko | |
| 133 | Order notes | Checkout notes likhein | Order detail par notes | |
| 134 | Price checkout ke beech badla | Checkout khula rakhein, WP mein price badlein, Pay | Mismatch error / naya total dikhe; galat amount charge na ho | |
| 135 | Stripe = order | 120 ke baad Stripe dashboard | Payment amount = order total, status succeeded | |
| 136 | Order number sequence | 3 order lagataar | Number 1-1 badhe, koi dohraya na jaye | |
| 137 | Deleted order ka number | Sab se naya order trash, naya order | Naya number **naya** ho, purana dobara na mile | |
| 138 | Confirmation email | 120 ke baad | Customer / patient ko 1 confirmation + team (sales1) ko 1 email | |
| 139 | Wallet transaction | 121 ke baad Rep → Wallet | DEBIT entry order number ke saath | |
| 140 | Woo stock kam | 120 (qty 2) ke baad WP product | Stock 2 kam | |
| 141 | Order rep ki list mein | Rep A → Orders | Naya order | |
| 142 | Order physician ki list mein | Dr. A1 → Orders | Naya order | |
| 143 | Rep ko physician ka order | Dr. A1 ka order → Rep A → Orders | Rep A ko bhi dikhe (upline) | |
| 144 | Doosre rep ko na dikhe | Rep B → Orders | Dr. A1 / Rep A ka order **na** dikhe | |

## 10. Order WooCommerce mein (sync)

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 145 | Woo mein order | 120 ke baad WP → Orders | Order "Processing", same total | |
| 146 | Woo order details | Woo order kholein | Items, variation, qty, shipping line, coupon, addresses, customer | |
| 147 | Payment method Woo mein | Card order / wallet order | "Credit card (Stripe)" + transaction id / "Wallet" | |
| 148 | Meta Woo mein | Woo order → custom fields | pronuvia_order_number, rep / physician id, commission, patient email | |
| 149 | Pronuvia par Woo link | Admin → order detail | "WooCommerce order #N ↗" link, sahi order khule | |
| 150 | Woo down ho to | (staging) Woo URL band / galat ho to order dein | Order phir bhi bane (paisa liya), "Not in WooCommerce yet"; baad mein khud chala jaye | |
| 151 | Atka order retry | 150 ke baad Woo theek, cron / naya order | Atka order Woo mein chala jaye, alert sales1 ko | |
| 152 | Deleted Woo customer | WP mein physician ka customer delete, phir us ka order | Order phir bhi Woo mein jaye (customer dobara jude) | |
| 153 | Physician order customer | Dr. A1 ka order | Woo order Dr. A1 ke customer par | |
| 154 | Totals milan | `/api/woo/reconcile` (admin login ke saath) | `issues` khaali | |

## 11. Admin: order management

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 155 | Orders list | Admin → Orders | Saare orders, status, total, pagination | |
| 156 | Status filter | "Pending" / "Completed" filter | Sahi orders | |
| 157 | Search order number | 13001 | Woh order | |
| 158 | Search Woo number | `#179` | Woh order | |
| 159 | Search patient naam | Patient ka first name | Us ke orders | |
| 160 | Search physician / rep | Dr. A1 / Rep A naam | Un ke orders | |
| 161 | Order detail | Order kholein | General, billing, shipping, items, totals, payment, commission | |
| 162 | **Order create and complete it** | Order → status "Completed" → Update | Pronuvia COMPLETED, Woo "Completed" | |
| 163 | **Order create and cancel it** | Naya order → status "Cancelled" | Pronuvia CANCELLED, Woo "Cancelled", Woo stock wapas | |
| 164 | Status Processing | Pending → Processing | Dono jagah Processing | |
| 165 | Status Shipped | → Shipped | Pronuvia SHIPPED, Woo Completed (Woo mein "shipped" nahi) | |
| 166 | Status Delivered | → Delivered | Pronuvia DELIVERED, Woo Completed | |
| 167 | Bulk complete | List mein 3 orders tick → Mark as Completed | Teeno dono jagah Completed | |
| 168 | Move to Trash | Order → Move to Trash → Confirm | Pronuvia se hat jaye, Woo trash mein (wahan se restore ho sakta hai) | |
| 169 | Private note | Notes → Private → likh kar add | Note dikhe, Woo order par private note, koi email nahi | |
| 170 | Patient note | Notes → Patient → bhejein | Woo par customer note, patient ko email | |
| 171 | Note delete | Note par × | Pronuvia aur Woo dono se hat jaye | |
| 172 | Shipping address edit | Edit address → city badlein → Save | Dono jagah naya address | |
| 173 | Billing address edit | Billing badlein | Dono jagah | |
| 174 | Patient email edit | Patient Email → Edit | Dono jagah naya | |
| 175 | Patient phone edit | Phone → Edit | Dono jagah | |
| 176 | Invoice | Order → Invoice / Print | Items, shipping, coupon, total, address sahi; print ho | |
| 177 | Packing list | Order → Packing list | Items, SKU, qty, address; FedEx 2Day ho to narangi chetawani | |
| 178 | Send email: New Order | Send order email → New Order | Email chali (Email Logs) | |
| 179 | Send email: Completed | → Completed Order | Email + status (jaisa panel kare) | |
| 180 | Send email: Cancelled | → Cancelled Order | Email + status | |
| 181 | Send email: Order Details | → Order Details | Email | |
| 182 | Orders Excel export | Admin / rep / physician orders export | File mein sahi orders | |
| 183 | Purana order (13000) | Phase 6 se pehle ka order kholein | Detail / invoice khule, Woo link na ho, error na ho | |

## 12. Shipping label aur fulfillment

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 184 | **Order create from sales rep and create shipment** | Rep A order → Admin → order → View / Add Shipment → "Open order in WooCommerce" → WP mein WooCommerce Shipping se label kharidein | Label ban jaye (asli postage kat'ti hai!) | |
| 185 | Label Pronuvia par | 184 ke baad Pronuvia shipment page "Refresh" | Label, carrier, service, tracking dikhe | |
| 186 | Status Shipped | 184 ke baad | Pronuvia SHIPPED, tracking order list mein | |
| 187 | Tracking email | 184 ke baad | Patient ko "order shipped" email tracking link ke saath, **sirf ek** | |
| 188 | Tracking link | Email / order page ka tracking link | Carrier ki tracking site sahi number ke saath | |
| 189 | 2 packages | Ek order ke 2 labels | Dono labels, 2 tracking emails, order par naya tracking | |
| 190 | Label refund | WP mein label refund | Pronuvia par "Refunded", tracking doosre label par | |
| 191 | Return label | Return mode (refunded order) → Create Return Label → WP | Return label dikhe, status na badle, email na jaye | |
| 192 | FedEx 2Day order | FedEx 2Day wala order → shipment page | "Buy a FedEx 2Day label" chetawani | |
| 193 | Address2 (Suite) | Apt / Suite wala order ka label | Label par address2 bhi | |
| 194 | Galat ZIP | Galat ZIP wala order, label | Plugin saaf error de, order kharab na ho | |
| 195 | Canada label | Canada order ka label | Customs form ke saath label | |
| 196 | Label size | 4x6 aur Letter (plugin settings) | Dono size print hon | |
| 197 | Purana label | Purane system ka label wala order | "Earlier labels" mein read-only | |
| 198 | Manual ship (bina label) | Status Shipped + tracking haath se (agar ship form hai) | Tracking email, Woo par tracking meta | |

## 13. Cancel

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 199 | Cancel before shipping | Pending order → Cancelled | Dono jagah Cancelled, stock wapas | |
| 200 | Cancel ke baad commission | 199 ka order, sweep chalayein | Commission credit **na** ho | |
| 201 | Cancel commission ke baad | Commission sweep ho chuki order cancel | Rep / physician wallet se commission kat jaye (clawback) | |
| 202 | WP admin se cancel | WP mein order Cancelled | Pronuvia order kholne par CANCELLED | |
| 203 | Coupon wapas | Coupon wala order cancel | WP coupon usage −1 | |
| 204 | Cancel ka paisa | Card order cancel | Paisa khud wapas **nahi** jata; refund alag se (section 14) | |
| 205 | Cancelled order list | Rep / physician orders | Cancelled dikhe | |

## 14. Refund aur return

> Card refunds sirf **Pronuvia admin** se karein (Process Refund → Via Stripe). WP admin se card refund par card mein paisa nahi jata.

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 206 | **Full refund via Stripe** | Card order → Process Refund → saare items → Via Stripe → Confirm | Stripe mein refund, Pronuvia REFUNDED, Woo Refunded, stock wapas | |
| 207 | Refund email | 206 ke baad | Patient ko refund email | |
| 208 | **Partial refund** | 3 qty mein se 1 → Via Stripe | Sirf $ of 1 item; status wahi; Woo refund 1 item | |
| 209 | Doosra partial | 208 ke baad baqi 2 refund | Order REFUNDED; total refund = order | |
| 210 | Shipping ke saath refund | "Include shipping fee" tick | Refund mein shipping bhi | |
| 211 | Shipping rakh kar full | Saare items, shipping nahi | Pronuvia REFUNDED; Woo apna status rakhe, shipping khud refund na kare | |
| 212 | Zyada refund | Baqi se zyada amount | Error | |
| 213 | **Wallet order refund** | Wallet order → Process Refund → "To wallet" | Paisa wallet mein wapas, wallet history CREDIT | |
| 214 | Card order wallet mein | Card order par "To wallet" | Option na dikhe / error | |
| 215 | Manual refund | "Manual" → amount | Record bane, Stripe mein kuch nahi | |
| 216 | **Return without money** | Items chunein, amount khaali | Woo $0 refund, stock wapas, wallet / card na badle | |
| 217 | **Order return (admin Return modal)** | Returns / return modal se order number se return | Return record, stock, commission sahi | |
| 218 | Refund commission se pehle | Refund, phir sweep | Sweep sirf bachi commission credit kare | |
| 219 | Refund commission ke baad | Swept order ka partial refund | Rep / physician wallet se hisse ki commission kate, current mahine mein | |
| 220 | Refunded order dobara | Poora refunded order par refund | Button chhupa / error | |
| 221 | WP admin se wallet order refund | WP → order → Refund (manual) | Pronuvia mein refund + wallet credit | |
| 222 | WP admin se card order refund | WP → card order → Refund | Pronuvia record + clawback; sales1 ko "Stripe se refund karein" alert | |
| 223 | WP mein status Refunded | WP → status Refunded | Pronuvia poora refund record, REFUNDED | |
| 224 | Refund list order par | Order detail | Refund #1, #2 amount ke saath | |
| 225 | Stripe dashboard refund | (sirf jaanch) Stripe dashboard se refund | Abhi Pronuvia / Woo mein **nahi** aata (go-live se pehle theek hoga) | |

## 15. Commission

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 226 | Rep apna order commission | Rep A order, subtotal $100 | Rep commission = 10% × (subtotal − discount) | |
| 227 | Physician order commission | Dr. A1 order $100 | Dr. A1 5%, Rep A upline 3% | |
| 228 | Coupon ke saath commission | $100, $10 coupon | Commission $90 par | |
| 229 | Shipping par commission nahi | Shipping wala order | Commission sirf items par | |
| 230 | Admin behalf commission | 124 wala order | Dr. A1 + Rep A ko commission | |
| 231 | Commission order par dikhe | Order detail | Rate aur amount | |
| 232 | Commission pending | Naya order, abhi sweep nahi | Wallet mein abhi credit nahi, "pending" | |
| 233 | Monthly sweep | Cron `/api/cron/manual-sweep` (CRON_SECRET header) ya mahine ki 1 | Pichle mahine ke orders ki commission wallets mein | |
| 234 | Sweep dobara | Sweep phir chalayein | Kuch dobara credit na ho | |
| 235 | Commission history | Admin → Commission History | Har credit / clawback ki entry | |
| 236 | Rep wallet history | Rep → Wallet | Commission CREDIT entries order ke saath | |
| 237 | Physician wallet history | Dr. A1 → Wallet | Wahi | |
| 238 | Cancelled / refunded skip | Sweep mein | Unki commission credit na ho | |
| 239 | Rate badalne ka asar | Rate badlein, purane orders | Purane orders ki commission wahi | |
| 240 | Commission report | Admin → Reports → Rep / Doctor commission | Numbers wallets se milein | |

## 16. Wallet aur wallet adjustment

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 241 | **Rep wallet credit (admin)** | Admin → Wallet Adjustment → Rep A, Credit $50, note | Balance +50, history entry note ke saath | |
| 242 | **Rep wallet debit** | Debit $20 | Balance −20 | |
| 243 | **Physician wallet credit** | Admin → Physician Wallet Adjustment → Dr. A1 +$50 | Balance +50 | |
| 244 | Physician wallet debit | −$20 | Balance −20 | |
| 245 | Note zaroori | Bina note | Error | |
| 246 | Galat amount | 0 / minus / text | Error | |
| 247 | Adjustment email | Credit / debit ke baad | User ko email (agar system bhejta hai) | |
| 248 | Wallet se order | Credit ke baad order wallet se | Balance kam | |
| 249 | Balance cent tak | Kai refund / commission ke baad | Balance 2 decimal (koi 5090.4699999 na ho) | |
| 250 | Minus balance | Clawback balance se zyada | Balance minus ho sakta hai, dikhe | |

## 17. Withdrawals aur payouts

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 251 | Bank details | Rep → Account, bank info (account / routing / type) | Save | |
| 252 | **Rep withdrawal request** | Rep → Withdrawals → New, amount | Request PENDING | |
| 253 | Balance se zyada | Balance se zyada amount | Error | |
| 254 | Bina bank details | Bank info khaali, request | Error / bank add karne ko kahe | |
| 255 | **Admin approve (rep)** | Admin → Withdrawals → request → Approve | APPROVED, balance kate, email | |
| 256 | Admin reject | Reject (reason) | REJECTED, balance wahi, email | |
| 257 | **Physician withdrawal** | Dr. A1 → Withdrawals → New | PENDING | |
| 258 | Admin approve (physician) | Admin → Physician Withdrawals → Approve | APPROVED, balance kate | |
| 259 | Bulk approve | Kai requests tick → bulk | Sab update | |
| 260 | Request delete | Admin delete | Hat jaye | |
| 261 | Notify add bank | Admin → "notify user to add bank" | User ko email | |
| 262 | Payout requests | Admin → Payout Requests | Auto-bani requests (auto-withdraw cron) | |
| 263 | Auto-withdraw cron | `/api/cron/auto-withdraw` (test period) | Sweep + payout requests, double na ho | |
| 264 | Payout notifications cron | `/api/cron/payout-notifications` | Emails, status SENT | |
| 265 | Withdrawal statement / PDF | Withdrawal detail → statement | Sahi orders, commission, total | |
| 266 | Pending request aur balance | Pending request ke baad clawback | Pending request ki amount balance ke mutabiq update | |

## 18. Rep aur physician panel

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 267 | Rep dashboard | Rep A dashboard | Sales, commission, orders ke numbers sahi | |
| 268 | Physician dashboard | Dr. A1 dashboard | Numbers sahi | |
| 269 | Rep orders filter | Status / date filter | Sahi | |
| 270 | Rep invoice | Order → Invoice | Khule, address Woo wala | |
| 271 | Doosre ka invoice URL | Rep A, Rep B ke order ka `/sales/invoice/<number>` | 404, data na dikhe | |
| 272 | Physician invoice | Apna invoice | Khule | |
| 273 | Physician doosre ka invoice | Doosre ka URL | 404 | |
| 274 | Rep orders export | Export | Sirf apne orders | |
| 275 | Physician orders export | Export | Sirf apne | |
| 276 | Downloads (rep) | Rep → Downloads | Files download hon | |
| 277 | Downloads (physician) | Physician → Downloads | Download | |
| 278 | Status update rep ko dikhe | Admin order Shipped → rep panel | Shipped + tracking | |

## 19. Admin dashboard aur reports

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 279 | Admin dashboard | Admin → Dashboard | Orders, sales, pending approvals ke numbers sahi | |
| 280 | Overall sales report | Reports → Overall Sales, date range | Har order, totals; orders list se milein | |
| 281 | Sales by product | Reports → By product | Qty / revenue; cancelled / refunded shamil na hon | |
| 282 | Returns report | Reports → Returns | Refunded / returned orders, amounts | |
| 283 | Rep commission report | Reports | Har rep ki commission, clawback | |
| 284 | Doctor commission report | Reports | Har doctor | |
| 285 | Overall commission | Reports | Order-wise commission | |
| 286 | Customer history | Reports → Customer history | Customer ke orders | |
| 287 | Report filters | Doctor / rep / product / status / date | Sahi filter | |
| 288 | Report export | Export / print | File sahi | |
| 289 | Woo se milan | Ek mahine ka total vs WP → Analytics | Milte hon | |

## 20. Emails

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 290 | Email Logs page | Admin → Email Logs | Har email SENT / FAILED ke saath | |
| 291 | Failed email | Email Logs mein FAILED | Error dikhe | |
| 292 | Order confirmation | Order | Patient (ya physician) ko, physician bcc, sales1 ko internal | |
| 293 | Tracking email | Label | Ek hi | |
| 294 | Refund email | Refund | Patient ko | |
| 295 | Patient note email | Patient note | Patient ko | |
| 296 | Approval email | Approve | Physician + rep | |
| 297 | Forgot password | Reset | Link | |
| 298 | Woo ki emails | WP Settings → Emails (ON / OFF faisle ke mutabiq) | OFF ho to Woo ki dohri emails na jayein | |
| 299 | Email links | Har email ka link | Sahi page (live par live domain) | |
| 300 | Test email | `/api/test-email` (admin) | Email pahunche | |

## 21. WP admin ↔ Pronuvia barabri

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 301 | WP mein status Completed | WP order → Completed | Pronuvia COMPLETED (order kholne / webhook par) | |
| 302 | WP mein address badla | WP order shipping address | Pronuvia naya address | |
| 303 | WP mein patient email meta | pronuvia_customer_email badlein | Pronuvia naya email | |
| 304 | Dono jagah badla | Pronuvia mein Shipped, phir WP mein Processing | Jo baad mein badla woh jeete | |
| 305 | WP mein order trash | WP order trash | Pronuvia order na badle | |
| 306 | WP stock badla | WP stock 0 | Shop "out of stock" | |
| 307 | WP coupon badla | WP coupon amount | Pronuvia checkout naya | |
| 308 | WP shipping badla | WP rate | Checkout naya | |
| 309 | Reconcile | `/api/woo/reconcile?days=30` | Koi `issues` nahi | |

## 22. Webhooks, crons, monitoring

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 310 | Webhooks setup | (live / public URL) `POST /api/woo/setup-webhooks` | Woo mein 4 webhooks Active | |
| 311 | Order webhook | WP mein status badlein, Pronuvia khole **bina** | Kuch second mein Pronuvia updated | |
| 312 | Product webhook | WP price badlein | Shop foran naya price | |
| 313 | Ghalat signature | (developer) galat signature se POST | 401 | |
| 314 | Woo order sync cron | `/api/cron/woo-order-sync` (CRON_SECRET) | `{ synced, refreshed }` | |
| 315 | Cron bina secret | Header ke bina | 401 | |
| 316 | Health | `/api/woo/health` (admin) | ok, USD | |
| 317 | Webhook disabled | WP → Webhooks status | Active ho (Disabled ho to dobara ON) | |

## 23. Content: banners, blogs, downloads

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 318 | Dashboard banner banana | Admin → Banners → New (image upload) | Rep / physician dashboard par dikhe | |
| 319 | Banner edit / delete | Edit, phir delete | Badle / hat jaye | |
| 320 | Website banner | Admin → Website Banners → New | Website home par | |
| 321 | Blog banana | Admin → Blogs → New | `/blog/<slug>` par | |
| 322 | Blog edit / delete | Edit / delete | Badle / 404 | |
| 323 | Downloads upload | Admin → Downloads, file upload | Rep / physician downloads mein | |
| 324 | Download delete | Delete | Gayab | |
| 325 | Image upload size / type | Badi / galat file | Error | |

## 24. Security aur permissions

| # | Test | Kaise karein | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 326 | Rep admin page | Rep login, `/admin/reports` | Na khule | |
| 327 | Physician sales page | Physician, `/sales/shop` | Na khule | |
| 328 | Rep physician page | Rep, `/physician/wallet` | Na khule | |
| 329 | Admin API bina login | Logout, `/api/woo/reconcile` | 401 | |
| 330 | Rep admin API | Rep login, `/api/woo/health` | 401 | |
| 331 | Doosre ka order URL | Rep A, admin order URL | Na khule | |
| 332 | Pending physician shop | Pending physician login | Na ho | |
| 333 | Rejected physician | Rejected login | Na ho | |
| 334 | Deleted user session | Logged-in rep ko admin delete | Agli request par logout / error | |
| 335 | Card details | Network tab / DB | Card number kahin save nahi (sirf Stripe) | |

## 25. Shuru se aakhir tak (poore flows)

| # | Flow | Qadam | Kya hona chahiye | ✓ |
|---|---|---|---|---|
| 336 | **Website physician: register → pehla order** | Website register → admin approve → email link se password → login → shop → card order | Order dono jagah, emails, Rep (agar hai) ko upline | |
| 337 | **Rep: order → label → complete** | Rep A card order → WP label → Pronuvia Shipped + tracking email → admin Completed | Dono jagah Completed, ek tracking email | |
| 338 | **Rep: order → complete → sweep → withdrawal** | 337 + sweep → Rep A wallet commission → withdrawal → admin approve | Har qadam par balance sahi | |
| 339 | **Physician wallet: order → refund to wallet** | Dr. A1 wallet order → admin refund "To wallet" | Balance wapas, Woo Refunded, stock wapas | |
| 340 | **Admin behalf → refund** | Admin behalf card order → full refund Via Stripe | Stripe refund, commission na mile / kate | |
| 341 | **Order → cancel** | Order → Cancelled | Dono jagah, stock wapas, commission nahi | |
| 342 | **Order → ship → return → refund** | Order → label → Shipped → return label → items wapas → refund | Return label, refund, stock, clawback | |
| 343 | **Coupon order → partial refund → commission** | Coupon order → sweep → 1 item refund | Discount ke hisaab se refund, sahi clawback | |
| 344 | **Rep adds doctor → doctor order → rep commission** | Rep A physician add → admin approve → doctor order → sweep | Rep A ko upline commission | |
| 345 | **Wallet adjust → wallet order** | Admin credit → user wallet order | Balance sahi | |
| 346 | **Canada order → label** | Canada address order → label customs ke saath | Sahi rate, label | |
| 347 | **FedEx 2Day order → label** | FedEx 2Day order → packing list → FedEx 2Day label | Chetawani, sahi label | |
| 348 | **WP admin se status → Pronuvia** | WP Completed / Cancelled / Refunded | Pronuvia sab sahi (clawback bhi) | |
| 349 | **Mahine ke aakhir ka chakkar** | Mahine mein orders + refunds → 1 tareekh cron → payout requests → approve | Commission − clawback, payout sahi | |
| 350 | **Live par pehla asli order** (go-live) | Chhota asli card order | Stripe, Woo, Pronuvia teeno total match; label; tracking email | |

---

**Note:** jo test fail ho, us ka number, screenshot aur order number note kar lein. Main usi se dekh lunga.
