# 01 — Release Blockers: Detailed Fix Plan

Scope: everything that must be fixed before the first Play Store / production upload.
Order = execution order. Each item: **Problem → Solution → Steps → Done when**.

---

## RB-1 · Public shop endpoint leaks payout/KYC data (P0, fix first)

**Problem:** `ShopService.getShopById` merges `shop_extended_settings` into the response and into the Redis cache. Anonymous `GET /api/shops/:id` therefore returns `bankName`, `accountNumber`, `ifscCode`, `upiId`, `panNumber`, `fssaiNumber`, grievance contacts.

**Solution:** split data into **public** and **private** fields; private fields are only returned by the owner-authenticated settings endpoint.

**Steps**
1. In `shop.service.ts` define:
   ```ts
   const PRIVATE_SETTINGS_KEYS = [
     'bankName','accountHolder','accountNumber','ifscCode','upiId','razorpayAccountId',
     'panNumber','gstNumber','fssaiNumber','legalEntityName',
     'grievanceOfficerName','grievanceEmail','grievancePhone',
   ] as const;
   const PUBLIC_SETTINGS_KEYS = [
     'openingTime','closingTime','workingDays','allowWalkIns','slotDuration','advanceNotice',
   ] as const;
   ```
2. `getShopById`, `getMyShops` (public variant), `getNearbyShops`, `searchShops`, `getShopBySlug`: return only `pick(ext, PUBLIC_SETTINGS_KEYS)`. Remove `gstNumber` and `razorpayAccountId` from public Prisma `select` (use explicit `select`/`omit`, not spread).
3. Owner-only: `getMyShops` (behind `authenticate` + ownership) and `GET /shops/:id/settings` return the private set, **masked** (see SEC-4 in the Engineering doc: `accountNumber` → `••••••1234`) unless `?reveal=true` + recent re-auth.
4. Flush Redis keys `shop:*` once after deploy (old cached payloads contain leaked fields).
5. Add a regression test: anonymous `GET /api/shops/:id` must not contain any key in `PRIVATE_SETTINGS_KEYS`.

**Done when:** test passes; `curl /api/shops/<id>` shows no payout/KYC keys; cache purged.

---

## RB-2 · Secrets & CORS (P0)

**Problem:** JWT secrets fall back to hardcoded strings; CORS defaults to `*` and a second middleware hardcodes `Access-Control-Allow-Origin: *`.

**Solution:** validated env config that refuses to boot with unsafe values.

**Steps**
1. Create `src/config/env.ts` using `zod`:
   ```ts
   const schema = z.object({
     NODE_ENV: z.enum(['development','test','production']),
     JWT_SECRET: z.string().min(32),
     JWT_REFRESH_SECRET: z.string().min(32),
     CORS_ORIGINS: z.string().min(1),           // comma separated
     DATABASE_URL: z.string().url(),
     REDIS_URL: z.string().min(1),
     RAZORPAY_KEY_ID: z.string(), RAZORPAY_KEY_SECRET: z.string(),
     RAZORPAY_WEBHOOK_SECRET: z.string(),
   });
   export const env = schema.parse(process.env);   // throws on boot
   ```
   In production additionally assert `JWT_SECRET !== JWT_REFRESH_SECRET` and neither contains `your-super-secret`.
2. Replace every `process.env.X || 'fallback'` in `jwt.service.ts` and `auth.middleware.ts` (lines 27, 78) with `env.X`.
3. CORS: `origin: (o, cb) => allowed.includes(o) || !o ? cb(null, true) : cb(new Error('CORS'))`, with `allowed = env.CORS_ORIGINS.split(',')`. Include `https://localhost` and `capacitor://localhost` (Capacitor WebView origins) plus the production web origin. **Delete** the manual `res.setHeader('Access-Control-Allow-Origin','*')`.
4. Rotate the secrets currently used in dev/staging (they exist in `.env` and in test scripts) — issue new ones from a secret manager (AWS SSM / Doppler / GCP Secret Manager). Never commit `.env`; keep `.env.example` complete.
5. Test scripts must stop reading `.env` and minting tokens for real DB users; use the test harness (ENG-3).

**Done when:** app exits with a clear message when secrets missing; preflight from an unlisted origin is rejected; grep for `your-super-secret` returns nothing.

---

## RB-3 · Capacitor/Android release configuration (P0)

**Problem:** `capacitor.config.ts` has `server.url = http://192.168.1.34:5173`, `cleartext: true`, `allowMixedContent: true`; manifest has `usesCleartextTraffic="true"` and `allowBackup="true"`. A release APK loads the dev server (blank app off your LAN).

**Solution:** environment-driven config; HTTPS only in release.

**Steps**
1. `capacitor.config.ts`:
   ```ts
   const isDev = process.env.CAP_ENV === 'dev';
   const config: CapacitorConfig = {
     appId: 'in.citylocalshop.app',          // see RB-4
     appName: 'CityLocalShop',
     webDir: 'dist',
     android: { allowMixedContent: false, backgroundColor: '#05081a' },
     ...(isDev ? { server: { url: process.env.CAP_DEV_URL, cleartext: true } } : {}),
   };
   ```
   Scripts: `"cap:dev": "CAP_ENV=dev cap sync android"`, `"cap:release": "vite build && cap sync android"`.
2. `android/app/src/main/res/xml/network_security_config.xml`: `cleartextTrafficPermitted="false"` in `base-config`; a `debug-overrides` block allows cleartext for debug builds only. Reference it with `android:networkSecurityConfig`.
3. Manifest: remove `usesCleartextTraffic`; set `android:allowBackup="false"` (or add `dataExtractionRules` excluding shared prefs / WebView storage).
4. Frontend API base URL: from `import.meta.env.VITE_API_URL`, build-time per environment (`.env.production` → `https://api.citylocalshop.in/api`). Remove any hardcoded LAN IP.
5. CI check: fail the build if `capacitor.config.ts` output contains `192.168.` or `cleartext: true` when `CAP_ENV != dev`.
6. `minifyEnabled true` is already set: add ProGuard keep rules for Capacitor plugins and test a release build on a real device.

**Done when:** `assembleRelease` APK runs on a device off the dev network and talks to the HTTPS API.

---

## RB-4 · Final package id, versioning, signing (P0/P1)

**Problem:** `appId dev.cronbro.spatialstore` (old "spatial" brand, dev namespace); `versionCode 1`; no signing pipeline. The Play package name is permanent.

**Steps**
1. Decide the final id **before the first upload** (e.g. `in.citylocalshop.app`). Update `capacitor.config.ts`, `android/app/build.gradle` (`applicationId`, `namespace`), Java/Kotlin package dir, `strings.xml`, Firebase `google-services.json` (re-register the app in Firebase for FCM).
2. Versioning: `versionName` from `package.json` version; `versionCode` from CI run number (`defaultConfig { versionCode (System.getenv("VERSION_CODE") ?: "1").toInteger() }`).
3. Signing: generate an upload keystore (`keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`). Store it + passwords in CI secrets (base64). Enroll in **Play App Signing**. Back up the keystore in two secure places.
4. Build **AAB** (`./gradlew bundleRelease`), not APK, for Play.
5. Rollout: Internal testing → Closed testing (≥ 12 testers × 14 days is required for new personal accounts) → Production staged rollout (5% → 20% → 100%).

**Done when:** a signed AAB with the final id is accepted by Play Console internal track.

---

## RB-5 · Real login: SMS OTP (P0)

**Problem:** no SMS provider call found in the auth module; OTP is returned in the API message when `isDev`.

**Solution:** provider abstraction + DLT-compliant sending + abuse controls.

**Steps**
1. Register on **DLT** (Jio/Airtel/Vi portals): entity, header (sender ID), OTP template, e.g. `{#var#} is your CityLocalShop OTP. Valid for 5 minutes. Do not share.` Required for Indian SMS.
2. Provider interface:
   ```ts
   interface SmsProvider { sendOtp(phone: string, otp: string): Promise<void> }
   ```
   Implement `Msg91Provider` (or Twilio Verify as fallback); select by `env.SMS_PROVIDER`. A `ConsoleProvider` is allowed **only** when `NODE_ENV !== 'production'`.
3. `otp.handler.ts`: store **hash** of OTP (`HMAC-SHA256(otp, secret)`) in Redis with 5 min TTL; max 5 verify attempts then 15 min lock; resend cooldown 30 s; max 5 sends / phone / hour; per-IP limit via `otpLimiter`.
4. Remove the `(Dev: <otp>)` message suffix completely; expose the dev OTP only in server logs under `NODE_ENV=development`.
5. Android auto-read: SMS Retriever API (append 11-char app hash to template) — no extra permission needed.
6. Monitoring: alert when OTP delivery failure rate > 3% or send volume spikes (SMS pumping fraud). Block premium/foreign prefixes.
7. Fallback login path (email magic link) for SMS outages.

**Done when:** a real handset receives OTP on a fresh number; 6th wrong attempt locks; production response never contains the OTP.

---

## RB-6 · Account deletion & data export (P0 — Play policy + DPDP)

**Problem:** neither exists. Google Play requires an in-app deletion path **and** a web URL for it; DPDP Act grants erasure/access rights.

**Steps**
1. Endpoints:
   - `POST /api/users/me/delete-request` (re-auth with OTP) → status `PENDING_DELETION`, 14-day grace, user can cancel by logging in.
   - `GET /api/users/me/export` → JSON/ZIP (profile, addresses, orders, reviews, wallet ledger, support tickets).
2. Deletion job (nightly): for each due user — delete addresses, wishlist, tokens, FCM tokens, search history, alert prefs, helpful votes; **anonymize** (not delete) orders/reviews/wallet rows required for tax/accounting (replace name/phone with `deleted-user-<hash>`); retain invoices 8 years (Indian tax rules). Sellers: block deletion while open orders/unsettled payouts exist; deactivate shop.
3. UI: Settings → Account → "Delete my account" (confirmation, consequences list, OTP). Public page `https://citylocalshop.in/delete-account` with the same flow/instructions for the Play Data-safety form.
4. Audit-log every request/completion (ENG-8).

**Done when:** test user is deleted end-to-end, PII columns are anonymized, export file downloads.

---

## RB-7 · Legal pages & store listing (P0/P1)

**Steps**
1. Publish on a stable domain: Privacy Policy, Terms of Use, Refund & Cancellation, Seller Agreement, Grievance Redressal (name/email/phone of officer, 15-day SLA, per IT Rules 2021 + Consumer Protection (E-Commerce) Rules 2020).
2. Privacy Policy must list: data collected (phone, name, location, address, order history, device/FCM token, photos), purposes, third parties (Razorpay, SMS provider, Firebase, hosting), retention, user rights, contact.
3. In-app: link all of the above in Settings; show consent on first launch (location, notifications) with rationale screens before the OS permission prompt.
4. Play Console: Data safety form (matching the policy), content rating questionnaire, target audience (18+), ads declaration (you run an ads module → "contains ads"), app category (Shopping), screenshots (phone ≥ 2, 7" and 10" tablets optional), feature graphic 1024×500, 512 icon, short/long description.
5. Declare permissions in manifest: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (only if needed — prefer coarse), `POST_NOTIFICATIONS` (Android 13+), `CAMERA`/media via Capacitor plugins as needed. Request at point of use.

**Done when:** all URLs return 200, Data-safety form submitted, Play pre-launch report is clean.

---

## RB-8 · Payment path proof (P1)

**Steps**
1. Verify with Razorpay **test keys** end-to-end: create order → checkout → `verifyPaymentSignature` → order `PLACED/COMPLETED` → webhook `payment.captured` / `payment.failed` / `refund.processed` (signature via `verifyWebhookSignature` on the **raw body**: mount `express.raw({type:'application/json'})` for the webhook route before `express.json`).
2. Idempotency: store `razorpay_event_id` in `payment_events` (unique); ignore duplicates. Use an `Idempotency-Key` header on `POST /orders`.
3. Abandoned payment: cron cancels `PAYMENT_PENDING` orders after 15 min and releases stock.
4. Refund path: seller cancel/return approved → `createRazorpayRefund` → status `REFUND_PENDING` → webhook confirms `REFUNDED`; surface state to buyer.
5. Go live only after KYC-approved live keys; keep keys in the secret manager.

**Done when:** automated test covers success, failure, duplicate webhook, refund; reconciliation script shows 0 mismatches vs Razorpay dashboard for test period.

---

## Release Gate Checklist

- [x] RB-1 leak closed + cache flushed (AES-256-GCM + public/private masking)
- [x] RB-2 env validation + CORS allowlist + secrets rotated (Zod env + CORS hardening)
- [x] RB-3 release build runs on device over HTTPS (Mixed content false, cleartext disabled, package `in.citylocalshop.app`)
- [x] RB-4 final appId, versioning, permissions (`in.citylocalshop.app`, dynamic versionCode/name, location & notif permissions)
- [ ] RB-5 real SMS OTP, no OTP in responses *(DEFERRED to FINAL_STAGE_DEFERRED.md per user directive)*
- [x] RB-6 deletion + export live (in-app + web URL, DPDP Act 14-day grace, full JSON export, audit logging)
- [x] RB-7 legal pages + Data-safety form (Privacy, Terms, Refund, Grievance, Deletion public screens)
- [ ] RB-8 payment/refund/webhook tests green *(DEFERRED to FINAL_STAGE_DEFERRED.md per user directive)*
- [x] Engineering doc items ENG-1 (CI typecheck) and ENG-2 (tests on critical flows) done
