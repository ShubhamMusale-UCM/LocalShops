# CityLocalShop — Production Readiness Audit

**Date:** 2026-11-15 · **Scope:** `temp_github_repo/` (React + Vite + Capacitor), `CityLocalShop/server/` (Express + Prisma + PostgreSQL + Redis). `CityLocalShop/apps/mobile` ignored per project rule.
**Method:** static scans of both repos + results of the buyer/seller verification suites. Items marked **(verify)** were not proven by a test or a full read and need a human check.

---

## 0. Executive Summary

Core buyer and seller workflows now persist to PostgreSQL and pass 55/55 scripted checks. The app is **not yet launch-ready**. Remaining risk clusters:

| Area | Status | Why |
|---|---|---|
| Release / Play Store | 🔴 Blocked | Capacitor points at a LAN dev server over cleartext, dev `appId`, `versionCode 1`, no signing/CI evidence |
| Security | 🔴 Blocked | Fallback JWT secrets, `CORS *`, OTP echoed in dev, plaintext bank data, no SMS provider confirmed |
| Payments / money | 🟠 High | Webhook handling exists but no reconciliation, payouts, or refund ledger proof |
| Quality | 🟠 High | 6 backend test files, 0 frontend tests, no CI, backend build skips type-check |
| Seller ops | 🟠 Medium | Several toggles save settings but nothing enforces them server-side |
| Compliance | 🟠 High | No privacy policy / account deletion / data-export evidence |
| Scale / observability | 🟡 Medium | No error tracking, structured logs, backups, or load test evidence |

**P0 count: 9 · P1 count: 14 · P2 count: 14**

---

## 1. Release Blockers — Publisher (Play Store / App Store)

| # | Pri | Finding | Evidence | Fix |
|---|---|---|---|---|
| PUB-1 | P0 | App loads from `http://192.168.1.34:5173` with `cleartext: true` — a release build would show a blank/broken app | `capacitor.config.ts` `server.url` | Remove `server` block for release; use env-gated dev config |
| PUB-2 | P0 | `usesCleartextTraffic="true"` and `allowMixedContent: true` | `AndroidManifest.xml`, capacitor config | HTTPS-only; network security config |
| PUB-3 | P0 | `appId = dev.cronbro.spatialstore` (old "spatial" branding, dev namespace) — immutable after first publish | `capacitor.config.ts`, `build.gradle` | Decide final package id **before** first upload |
| PUB-4 | P1 | `versionCode 1 / versionName 1.0`, no versioning pipeline | `build.gradle` | Automate versionCode from CI |
| PUB-5 | P1 | `allowBackup="true"` — tokens/localStorage can be extracted via backup | Manifest | Set `false` or add backup rules |
| PUB-6 | P1 | No evidence of release keystore, Play App Signing, AAB build | repo scan | Create signing flow, store secrets in CI |
| PUB-7 | P1 | Store listing assets missing: privacy policy URL, data-safety form, screenshots, content rating | — | Prepare before submission |
| PUB-8 | P1 | Only `INTERNET` permission declared; location (used for nearby shops) and notifications (Android 13 `POST_NOTIFICATIONS`) not declared **(verify)** | Manifest | Declare + add runtime rationale |
| PUB-9 | P2 | No iOS project evidence; if iOS is planned, Apple requires account deletion + Sign-in rules | — | Decide platform scope |
| PUB-10 | P2 | No deep links / App Links config for shared shop & product URLs | — | Add `assetlinks.json` |

---

## 2. Developer / Engineering

### 2.1 Security (backend)
| # | Pri | Finding | Evidence | Fix |
|---|---|---|---|---|
| DEV-1 | P0 | JWT secrets fall back to hardcoded strings if env missing — forged tokens possible | `auth/jwt.service.ts:3-4`, `auth.middleware.ts:27,78` | Crash on boot if `JWT_SECRET`/`JWT_REFRESH_SECRET` unset in production |
| DEV-2 | P0 | `CORS_ORIGIN \|\| '*'` plus a hardcoded `Access-Control-Allow-Origin: *` header | `app.ts` | Explicit origin allowlist |
| DEV-3 | P0 | Dev OTP returned in API response when `isDev`; no SMS gateway call found in auth module **(verify)** — real users cannot log in without one | `auth.service.ts:32` | Integrate MSG91/Twilio/Fast2SMS + DLT registration; gate dev echo on `NODE_ENV` strictly |
| DEV-4 | P0 | Bank account numbers, PAN, IFSC stored as plaintext JSONB in `shop_extended_settings`, returned unmasked | `shop.service.ts` | Field-level encryption (AES-GCM, KMS key), mask on read (`XXXX1234`) |
| DEV-5 | P1 | Server-side validation for new settings is loose: IFSC/UPI/PAN/GSTIN format only checked in the UI; `.passthrough()` on `updateShopSchema` | `shop.validator.ts` | Add regex validation server-side, remove passthrough |
| DEV-6 | P1 | `last_error.log` written synchronously from a controller; leaks stack data to disk | `order.controller.ts:26` | Remove; use logger |
| DEV-7 | P1 | `morgan('dev')` and `morgan('combined')` both registered; 27 `console.*` calls | `app.ts` | Single structured logger (pino) with request IDs, PII redaction |
| DEV-8 | P1 | Rate limiters exist, but no per-account lockout / OTP attempt cap evidence **(verify)** | `rateLimiter.middleware.ts` | Cap OTP verify attempts, add lockout |
| DEV-9 | P1 | File uploads stored on local disk (`/uploads`) with an S3 path present but unclear which is active | `imageProcessor.ts` | Object storage + CDN in production; ephemeral disks lose images on redeploy |
| DEV-10 | P2 | No CSRF concern for bearer auth, but tokens live in `localStorage` (XSS-exposed) | `client.ts` | Move to Capacitor secure storage on native |

### 2.2 Data & Schema
| # | Pri | Finding | Fix |
|---|---|---|---|
| DEV-11 | P1 | **Schema drift:** `user_alert_preferences`, `user_archived_orders`, `review_helpful_votes`, `shop_extended_settings`, `shop_archived_orders` are created at runtime via `CREATE TABLE IF NOT EXISTS` — not in Prisma schema/migrations. Each request pays a DDL round-trip, no FKs, no cascade on shop/user delete | Move all to `schema.prisma` + `prisma migrate`; add FKs and indexes |
| DEV-12 | P1 | `getShopOrders` loads all archived IDs and uses `notIn` — degrades as archives grow | Use `NOT EXISTS`/join or an `archivedByShopAt` column |
| DEV-13 | P1 | `getMyShops` does N+1 reads on `shop_extended_settings` | Single `WHERE shop_id = ANY($1)` query |
| DEV-14 | P2 | `getShopById` merges extended settings (including payout/PAN data) into the **public** `GET /api/shops/:id` response and its Redis cache | **Privacy leak** — strip private fields from public endpoint, keep only on `/settings`. *(Introduced in this session; fix first.)* |
| DEV-15 | P2 | Product limit raised to FREE=1000 to make CSV import work; `subscription` module's plan limits now inconsistent with the pricing story | Define real plan limits in one config |

> **DEV-14 is severity P0 in practice** — anonymous callers can read `bankName`, `accountNumber`, `panNumber` via `GET /api/shops/:id`. Treat as the first fix. (Listed under P2 only by grouping.)

### 2.3 Build, Test, CI/CD
| # | Pri | Finding | Evidence | Fix |
|---|---|---|---|---|
| DEV-16 | P0 | Backend `build` uses `sucrase` — **strips types without checking them**; a type error ships | `package.json` | Add `tsc --noEmit` step to CI |
| DEV-17 | P1 | No CI pipeline (`.github` absent), no Dockerfile | repo scan | GitHub Actions: lint → typecheck → test → build → deploy |
| DEV-18 | P1 | 6 backend test files (ads, checkout, product, returns, support); none for auth, shop settings, order archive, payment webhook, wallet | scan | Add coverage targets; port `scratch/*.cjs` E2E scripts into Jest/supertest against a test DB |
| DEV-19 | P1 | 0 frontend tests | scan | Vitest + RTL for critical flows; Playwright for checkout/hold |
| DEV-20 | P1 | E2E scripts in this session **write to the first active shop in the real dev DB** (compliance fields, test products, archived orders) | `scratch/e2e_seller_workflow_test.cjs` | Run against an isolated seeded DB; never against shared data |
| DEV-21 | P2 | God-components: `ExploreScreen` 161 KB, `SellerPromotionsScreen` 117 KB, `SellerProfileScreen` 116 KB+, `BuyerOrdersScreen` 103 KB | scan | Split by feature, lazy-load routes, add bundle budget |
| DEV-22 | P2 | 14 TODO/FIXME in frontend, 1 in backend | scan | Triage into tickets |

### 2.4 Leftover mock/dev paths in frontend
Still present (outside seller screens): `cls_mock_*` keys in `CartDrawer.tsx`, `ProductDetailModal.tsx`, `ShopModal.tsx`, `BuyerOrdersScreen.tsx`, `SearchResultsScreen.tsx`; `seller-local-shop` sentinel in `client.ts` (incl. hardcoded analytics: revenue 28450, orders 14) and in several seller guards. These can mask real API failures with fake data. Audit each, delete or gate behind `import.meta.env.DEV`.

### 2.5 Observability & Ops
| # | Pri | Finding | Fix |
|---|---|---|---|
| OPS-1 | P1 | No error tracking (no Sentry/Crashlytics in `package.json`) | Sentry (web + Android), source maps upload |
| OPS-2 | P1 | `/api/health` exists; no readiness probe separating DB/Redis state | Add `/ready` |
| OPS-3 | P1 | No backup/restore, PITR, or DR plan evidence | Managed Postgres with daily snapshots + restore drill |
| OPS-4 | P2 | Background jobs run in the API process (telemetry sync, review sentiment) — scale-out duplicates them | Separate worker + queue (BullMQ), leader lock |
| OPS-5 | P2 | No load test; Socket.IO scaling needs Redis adapter for >1 instance **(verify)** | k6 + `socket.io-redis-adapter` |
| OPS-6 | P2 | No staging environment, secrets management, or feature flags | Separate envs; flag remote config |

---

## 3. Seller Perspective — What Is Still Incomplete

| # | Pri | Gap | Detail |
|---|---|---|---|
| SEL-1 | P1 | **Auto-confirm bookings is client-side only.** Setting persists, but confirmation fires only when the seller's app is open and a socket event arrives | Enforce in `OrderService.createOrder` (default `false`, so existing tests stay valid) |
| SEL-2 | P1 | **Booking Reminders and Daily Digest toggles have no scheduler.** The digest is on-demand ("View Digest") — nothing is sent at evening time; no 15-min reminder job | Cron/queue job + WhatsApp Business API (or FCM) delivery |
| SEL-3 | P1 | **Slot duration / max per slot / walk-ins / advance notice are stored but never enforced** at checkout | Enforce in order creation + show slots in buyer UI |
| SEL-4 | P1 | **Payouts are settings only.** No settlement ledger, no T+1 transfer, no Razorpay Route linked-account onboarding/KYC, no payout history screen | Razorpay Route/RazorpayX integration, `payouts` table, statements |
| SEL-5 | P1 | **Sound alarm only works while app is foregrounded.** No FCM push for new orders when app is closed/backgrounded; Web Audio is blocked until a user gesture | FCM high-priority push + Android notification channel with custom sound; foreground service if needed |
| SEL-6 | P1 | GST/FSSAI/PAN accepted but **never verified** (no GSTN/FSSAI/PAN-API check); no "Verified" badge pipeline, no document upload | KYC provider (e.g., Karza/Signzy) + admin review queue |
| SEL-7 | P2 | Merchant Network is a shop list with WhatsApp links — no in-app chat, groups, or B2B offers | Define product intent before building |
| SEL-8 | P2 | Priority Seller Desk reuses buyer support tickets; no priority tagging/SLA/admin routing | Add `audience: SELLER`, priority field, SLA timers |
| SEL-9 | P2 | Printable label is a browser print popup — popup blockers and Android WebView may block `window.open` | Generate PDF server-side or use Capacitor print/share |
| SEL-10 | P2 | CSV import: no preview/dry-run, no image URLs validation, no duplicate detection (`skipDuplicates` has no unique key to act on), 500-row guidance not enforced, no async job for large files | Dry-run endpoint, SKU column + unique `(shopId, sku)`, background job |
| SEL-11 | P2 | Inventory: no SKU/variants UI, no low-stock alerts to seller, no bulk edit beyond API | Low-stock push + variants |
| SEL-12 | P2 | Seller analytics: verify all charts read live data (not the `seller-local-shop` stub) | Remove stub |
| SEL-13 | P2 | Multi-staff accounts / roles (owner vs counter staff) absent | RBAC per shop |
| SEL-14 | P2 | Seller order archive hides orders but there is no "Archived" view/restore or export for accounting | Archived tab + CSV export of orders/GST invoices |

---

## 4. User (Buyer) Perspective — What Is Still Incomplete

| # | Pri | Gap |
|---|---|---|
| USR-1 | P0 | Real login: SMS OTP provider required (see DEV-3). No social/email fallback |
| USR-2 | P0 | **Account deletion & data export** (Play Store policy + DPDP Act) — not found |
| USR-3 | P1 | **Online payment completeness**: confirm Razorpay checkout → webhook → order state → refund path end-to-end with real test keys; failed/abandoned payment recovery; idempotency keys |
| USR-4 | P1 | Push notifications for hold countdown, order accepted, ready-for-pickup. Alert preferences persist, but delivery pipeline (FCM token registration, server sends) needs proof **(verify)** |
| USR-5 | P1 | Hold expiry: confirm a server job releases stock and cancels unclaimed holds at timeout (not just a UI countdown) **(verify)** |
| USR-6 | P1 | Accessibility: no audit evidence (screen-reader labels, contrast in dark mode — the earlier white-on-white cancel dialog bug suggests theme gaps), font scaling |
| USR-7 | P2 | Localization: no i18n library; India launch likely needs Hindi/Marathi |
| USR-8 | P2 | Offline/poor-network UX: no service worker/cache strategy beyond `dataCache`; no retry/backoff UI |
| USR-9 | P2 | Search quality: no typo tolerance/synonyms/ranking evaluation; consider Postgres trigram or Meilisearch |
| USR-10 | P2 | Trust & safety: report listing/shop, block, review moderation UI for buyers (admin side exists) |
| USR-11 | P2 | Onboarding, empty states, and error states audited screen by screen — big components make regression likely |

---

## 5. Legal, Compliance & Business

| # | Pri | Item |
|---|---|---|
| LEG-1 | P0 | Privacy Policy, Terms, Refund/Return policy hosted at public URLs (store requirement) |
| LEG-2 | P1 | DPDP Act 2023: consent capture, purpose limitation, grievance officer (UI exists for sellers; need for the platform itself), retention policy, breach process |
| LEG-3 | P1 | GST: platform invoices/commission invoices, TCS (e-commerce operator) handling if payments flow through the platform |
| LEG-4 | P1 | RBI payment-aggregator rules: ensure funds flow through Razorpay Route (not held by you) |
| LEG-5 | P2 | Legal Metrology / FSSAI display rules for listings (copy exists; enforcement doesn't) |
| LEG-6 | P2 | Telecom: DLT registration for SMS/WhatsApp templates; WhatsApp Business API opt-in |

---

## 6. Admin / Support / Growth (the missing "company" side)

| # | Pri | Gap |
|---|---|---|
| ADM-1 | P1 | Admin API has overview/users/shops/flagged reviews/marketing push — but **no UI evidence** (verify whether an admin web app exists) and no actions: suspend shop/user, approve KYC, refund override, ticket handling |
| ADM-2 | P1 | Support tickets can be created; no agent inbox, assignment, SLA, or canned replies |
| ADM-3 | P1 | Audit log for sensitive actions (payout changes, shop settings, order cancels) |
| ADM-4 | P2 | Product analytics (funnels, retention) — only internal counters today |
| ADM-5 | P2 | Subscription/monetization: plans exist but billing, invoicing, and plan enforcement are unverified |
| ADM-6 | P2 | Ads module: budget refunds on early stop, fraud/click-spam protection, invoice for ad spend |

---

## 7. Prioritized Roadmap

### Sprint 0 — This week (stop-the-bleeding)
1. **DEV-14** remove payout/PAN/bank data from the public shop response + cache.
2. **DEV-1 / DEV-2** fail-fast on missing JWT secrets; lock CORS.
3. **PUB-1/2** remove LAN `server.url`; cleartext off for release.
4. **DEV-16** add `tsc --noEmit` to the build; **DEV-17** minimal CI.
5. **DEV-20** isolate test DB.

### Sprint 1–2 — Make it launchable
- SMS OTP provider (DEV-3), account deletion/data export (USR-2), policies (LEG-1).
- Move runtime tables into Prisma migrations (DEV-11); encrypt bank data (DEV-4); server-side validation (DEV-5).
- Sentry + structured logs (OPS-1, DEV-7); managed DB backups (OPS-3).
- Final `appId`, signing, AAB, Play Console internal testing (PUB-3/6/7).
- FCM push for orders + hold lifecycle (SEL-5, USR-4/5).

### Sprint 3–4 — Make it a business
- Razorpay Route onboarding + payouts + statements (SEL-4, LEG-4).
- Seller KYC verification + admin console (SEL-6, ADM-1/2/3).
- Enforce booking rules + auto-confirm server-side (SEL-1/3); scheduled digest/reminders (SEL-2).
- Test pyramid: Jest API suite, Vitest, Playwright (DEV-18/19).

### Later
- i18n, accessibility pass, search upgrade, multi-staff roles, variants/SKUs, load testing, worker separation, component decomposition.

---

## 8. Verified-Good (don't re-audit)

- Buyer: alert preferences, local credits ledger, clear cancelled orders, review helpful votes, GST invoice modal — persisted and tested (25 checks).
- Seller: compliance/payout/booking/alert persistence, CSV import (standard + Tally-style headers, empty-file 400), order archive (idempotent, ownership-guarded), daily digest data, support ticket flow — tested (30 checks incl. 403 guards).
- Frontend `tsc` and Vite production build pass; backend compiles.

> Note: "tested" means scripted API/static checks on a dev database, not load, penetration, or device testing.
