# PLUG BHAI — VS Code / Antigravity setup

Yeh ZIP current website ka complete implemented source code hai: storefront, backend API, database schema/migrations, admin, logo/assets, supplier enquiry page aur tests. Original brief ke jo advanced features abhi incomplete hain, woh README.md mein listed hain. ZIP ko complete production-ready platform na samjhein.

## 1. Requirements

- Node.js 24 or newer, with npm.
- VS Code **ya** Antigravity; dono mein same project folder aur terminal commands use honge.
- Internet dependency installation ke liye.
- Python 3 sirf inventory concurrency test ke liye; website start karne ke liye zaroori nahi.

Terminal mein `node --version` aur `npm --version` chala kar installation verify karein. Node install karne ke baad editor/terminal dobara kholein.

## 2. ZIP extract aur folder open

ZIP extract karein. Us ke andar **plug-bhai** folder editor mein open karein — wahi folder jahan `package.json` aur `SETUP-GUIDE.md` hain. ZIP ke andar se directly files edit na karein.

VS Code mein File → Open Folder se folder khol sakte hain. Antigravity mein extracted project folder open karein; neeche diye commands us ke terminal mein bhi same hain. Editor-specific AI features required nahi hain.

## 3. Dependencies install

Project root ke terminal mein:

```sh
npx pnpm@11.25.0 install --frozen-lockfile
```

Agar npx pnpm install ki confirmation de, package name/version check karke allow karein. `node_modules` ZIP mein intentionally included nahi; yeh command locked versions download karti hai. `npm install` se lockfile replace mat karein.

## 4. Local environment aur database setup

```sh
npm run setup:local
```

Is command ke steps:

1. Portable execution profile select hota hai; Windows/macOS/Linux paths use hote hain.
2. `.dev.vars` missing ho to local-only `BOOTSTRAP_ENABLED=true` banata hai. Existing file overwrite nahi hoti.
3. Production build compile hota hai.
4. `drizzle/` ki SQL migrations filename order mein local D1 database par apply hoti hain.
5. Successful migration names `.wrangler/plug-bhai-migrations.json` mein record hote hain, taake dobara command chalane par repeat na hon.

D1 aur R2 local emulation use hoti hai: local setup ke liye PostgreSQL, MySQL, XAMPP, cloud database password ya payment credentials ki zaroorat nahi. Live Site ka database, orders, customer data aur uploaded R2 images is ZIP mein nahi hain. Local store demo data se start hota hai.

## 5. Website chalao

```sh
npm run dev
```

Browser mein terminal wala local URL kholo; default:

```text
http://localhost:5173
```

Terminal running rehna chahiye. Stop karne ke liye Ctrl+C. Agli baar aam tor par sirf `npm run dev` chahiye. Dependencies badlein to install; new migration aaye to setup dobara chalao.

## 6. Local admin login

```text
http://localhost:5173/admin
```

- **Sign in with ChatGPT** par click karne se portable development mode mein local test identity use hoti hai.
- Local test email: `seedy@sites.test`.
- Local test ID: `local_seedy`.
- Local test login ka password nahi hota. Yeh actual ChatGPT login ya production credentials nahi hain.
- **Set up my owner account** choose karo. First-owner setup ke baad products, supplier enquiries, orders aur settings manage kar sakte ho.
- Owner banne ke baad `.dev.vars` mein `BOOTSTRAP_ENABLED=false` kar do aur dev server restart kar do.

Yeh local mock authentication sirf loopback development ke liye hai. Is dev server ko internet/public tunnel par expose na karein. Hosted ChatGPT Site ka real login alag hai. Apna email/password system chahiye ho to production authentication development required hai; `.env` mein email/password likhne se system automatically nahi banega.

`npm start` built Worker preview hai; us mein portable mock sign-in nahi milta. Admin development ke liye `npm run dev` use karein.

## 7. Supplier commission feature

Public page path: `/suppliers`.

Supplier company/contact, product range, HTTPS catalog link, commission proposal (percentage / fixed PKR per sale / negotiable), fulfillment aur notes submit kar sakta hai. Contact consent required hai.

Admin → **Supplier enquiries** mein owner/manager proposals dekh kar New, Reviewing, Contacted, Approved, Declined status aur private notes save kar sakte hain. Enquiry submit karna contract acceptance nahi. Automatic product publication, email sending aur commission payouts included nahi hain.

Hosted Site public URL: https://plug-bhai-store.shzainaslam.chatgpt.site

## 8. Payments ka actual status

- COD: working order flow.
- Bank transfer: Store & homepage mein bank details add karke enable; manual verification.
- Cards / JazzCash / Easypaisa: visible, **Setup required**, disabled.
- API keys paste karne se in methods ki integration nahi banegi. Provider adapter, verified webhooks, merchant onboarding aur real testing abhi required hain.
- Secrets ko public Store settings, screenshots ya repository mein paste na karein.

## 9. Code kahan edit karna hai?

| File / folder | Purpose |
| --- | --- |
| `components/store.tsx` | Storefront, product/cart/checkout pages |
| `components/admin.tsx` | Admin interface |
| `components/suppliers.tsx` | Supplier form and admin enquiry review |
| `app/globals.css` | Colors, layout, responsive styles |
| `app/api/[...path]/route.ts` | Server endpoints and permissions |
| `db/schema.ts` | Database tables |
| `drizzle/*.sql` | Ordered SQL migrations |
| `lib/commerce.ts` | Roles, money, pricing, defaults |
| `lib/cart.ts` | One-unit cart quantity updates |
| `lib/suppliers.ts` | Supplier request validation |
| `lib/payments/index.ts` | Payment adapter boundary; online adapters absent |
| `lib/seed.ts` | Clearly marked demo products/pages |
| `public/plug-bhai-wordmark.png` | Current supplied logo |
| `.env.example` | Documented local configuration |

Product prices database mein **paisa** mein hain: Rs. 2,500 = 250000. Supplier fixed commission UI mein PKR enter hoti hai aur server paisa store karta hai. Percentage bhi two-decimal precision ke liye scaled integer mein store hota hai.

## 10. Tests

```sh
npm run typecheck
npm run test:api
```

Python installed ho to:

```sh
python3 tests/concurrency.py
```

Windows par agar command `py` hai:

```powershell
py -3 tests/concurrency.py
```

API tests isolated temporary SQLite use karte hain, aapka store data delete nahi karte. Current suite checkout, permission checks, cart decrement, payment blocking aur supplier proposals cover karti hai. Concurrency test one-stock-item ke liye 24 buyers simulate karta hai.

## 11. Antigravity AI ko dene ke liye project brief

```text
Open this existing PLUG BHAI project. Read SETUP-GUIDE.md and README.md first.
Preserve its Vinext/React/TypeScript and Cloudflare D1/R2 architecture.
Install with npx pnpm@11.25.0 install --frozen-lockfile, then run npm run setup:local.
Use npm run dev for the portable development sign-in.
Do not rewrite it as a static mockup or replace its database with localStorage.
Keep server-side authorization, integer money, stock transactions, supplier enquiry
privacy, cart quantity controls and the supplied logo intact.
Keep online payment methods disabled until real provider integration is implemented.
Do not publish it or change hosting/access without my instruction.
```

## 12. Troubleshooting

- **Missing package / vinext not found:** run dependency install in the folder containing `package.json`.
- **No such table:** stop dev server and run `npm run setup:local`.
- **Owner setup disabled:** local `.dev.vars` mein temporarily `BOOTSTRAP_ENABLED=true`, server restart, then claim owner. Existing owner remains protected.
- **Sign-in not working:** use localhost and `npm run dev`; avoid `npm start` for local mock auth.
- **Port in use:** stop the earlier dev process or run `npm run dev -- --port 5174`; use the printed URL.
- **Python not found:** skip concurrency test or install Python; app does not depend on it.
- **Local database reset:** `.wrangler/state` mein your test records/uploads stored hain. Backup ke baghair delete na karein. Agar intentionally reset karein to migration marker `.wrangler/plug-bhai-migrations.json` bhi reset karna hoga, phir setup run karein.
- **Old logo:** browser hard refresh and check that you extracted this updated ZIP.

## 13. Deployment and export notes

This is a Worker/D1/R2 application, not a PHP upload or plain static website. Independent hosting needs real D1/R2 bindings and trusted production authentication; the local identity mock is not production auth. Ordinary Vercel/Netlify static hosting does not automatically provide these bindings.

The original Site project ID was removed from this export's `.openai/hosting.json` to keep this independent copy from targeting the live project. The original deployed source remains unchanged except for the requested supplier feature. This package adds `setup:local`, the guide and safe export defaults.

Secrets, live customer/order records, hosted object uploads, `.git`, build caches and dependencies are excluded. All implemented application source, supplied logo, local product artwork, migrations, tests and dependency lockfile are included.

Validation limits: 43 API checks, source type checking, production compilation, and the exported setup script (all three local D1 migrations) passed in this Linux environment. No desktop-editor/browser automation is available here; your Windows/macOS editor setup and end-to-end browser flows still need local acceptance testing. See README.md for the original brief's remaining implementation gaps.

Public launch update: owner setup requires BOOTSTRAP_OWNER_EMAIL matching the trusted authenticated email. Local setup uses seedy@sites.test. Live owner signs in with their designated ChatGPT account. GitHub is a source mirror; pushes do not automatically deploy to Sites.
