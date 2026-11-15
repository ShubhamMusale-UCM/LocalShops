# 03 — Engineering Gaps: Detailed Solutions

Covers build/test/CI, data layer, security hardening, observability, scale, and code health.

---

## ENG-1 · Type-safe build + CI pipeline

**Problem:** backend `build` runs `sucrase` (no type-check); no CI; no Dockerfile.

**Solution**
1. Backend scripts:
   ```json
   "typecheck": "tsc --noEmit -p tsconfig.json",
   "build": "npm run typecheck && sucrase ./src -d ./dist --transforms typescript,imports",
   "lint": "eslint . --max-warnings=0"
   ```
   (Keep sucrase for speed but gate it on `tsc`.)
2. GitHub Actions `.github/workflows/ci.yml` (one for each repo):
   ```yaml
   on: [pull_request, push]
   jobs:
     backend:
       runs-on: ubuntu-latest
       services:
         postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: test }, ports: ['5432:5432'], options: --health-cmd pg_isready }
         redis:    { image: redis:7, ports: ['6379:6379'] }
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: npm }
         - run: npm ci
         - run: npx prisma migrate deploy
         - run: npm run lint && npm run typecheck && npm test -- --coverage
     frontend:
       steps: [checkout, setup-node, npm ci, "npx tsc --noEmit", "npm run lint", "npm run test", "npm run build"]
   ```
3. Branch protection: require CI + 1 review on `main`. Add Dependabot and `npm audit --omit=dev --audit-level=high` as a CI step; CodeQL for JS/TS.
4. Dockerfile (multi-stage, non-root):
   ```dockerfile
   FROM node:20-alpine AS build
   WORKDIR /app
   COPY package*.json ./ && RUN npm ci
   COPY . . && RUN npx prisma generate && npm run build
   FROM node:20-alpine
   WORKDIR /app
   ENV NODE_ENV=production
   COPY --from=build /app/dist ./dist
   COPY --from=build /app/node_modules ./node_modules
   COPY prisma ./prisma
   USER node
   CMD ["sh","-c","npx prisma migrate deploy && node dist/app.js"]
   ```
5. CD: build image → push registry → deploy to staging automatically, production on tag with manual approval.

**Done when:** a PR with a type error fails CI.

---

## ENG-2 · Test strategy (pyramid)

**Current:** 6 backend test files; 0 frontend tests; ad-hoc `scratch/*.cjs` scripts hitting a shared dev DB.

**Solution**
1. **Backend integration tests** with Jest + supertest against a throwaway Postgres (CI service container or Testcontainers). Setup: `prisma migrate deploy` + `prisma/seed.test.ts`; each test file wraps data in unique IDs and cleans up (or truncates between files).
2. Port the existing scripts into proper suites: `shop-settings.test.ts` (compliance/payout/ops persistence, 403 for non-owner, public endpoint never leaks private keys), `order-archive.test.ts` (single, bulk, idempotent, buyer unaffected), `csv-import.test.ts` (standard + Tally headers, invalid rows, empty file, limits), `auth-otp.test.ts` (attempt cap, expiry, resend cooldown), `payment-webhook.test.ts` (valid/invalid signature, duplicate event).
3. **Frontend:** Vitest + React Testing Library for components with logic (CSV modal, digest modal, payout form validation). **Playwright** E2E for: login → browse → hold item → seller accepts → buyer sees update; run on every PR against the staging stack (docker-compose).
4. **Contract:** generate an OpenAPI spec from zod schemas (`zod-to-openapi`) and a typed client for the frontend so API drift is a compile error rather than a runtime bug (this caused the `API_BASE_URL` / `setMyShops` style errors found during development).
5. Targets: backend ≥ 70% lines on `modules/{auth,order,payment,shop,wallet}`; zero flaky tests tolerated (quarantine + ticket).
6. **Never run tests against shared dev data.** The current E2E scripts mutate the first active shop. Add a guard: tests abort unless `DATABASE_URL` contains `_test`.

---

## ENG-3 · Remove dev-only/mocked paths from the frontend

**Problem:** `cls_mock_*` keys in `CartDrawer`, `ProductDetailModal`, `ShopModal`, `BuyerOrdersScreen`, `SearchResultsScreen`; `seller-local-shop` sentinel with hardcoded analytics (`revenue: 28450`) in `client.ts`; `Mock implementation` comments.

**Solution**
1. Inventory with `grep -rn "cls_mock_\|seller-local-shop\|Mock implementation" src`.
2. For each hit decide: delete, or gate behind `import.meta.env.DEV && localStorage.cls_demo === '1'`.
3. API client must surface real failures (return `{error}` and let UI show retry), never swap in fake success.
4. Add an ESLint `no-restricted-syntax`/custom rule (or CI grep) failing on those strings outside `__demo__/`.

---

## ENG-4 · Move runtime DDL into Prisma migrations

**Problem:** `user_alert_preferences`, `user_archived_orders`, `review_helpful_votes`, `shop_extended_settings`, `shop_archived_orders` are created by `CREATE TABLE IF NOT EXISTS` on request paths: unversioned, no FKs, DDL round-trip on every call, impossible to review.

**Solution**
```prisma
model ShopSettings {
  shopId String @id
  shop   Shop   @relation(fields: [shopId], references: [id], onDelete: Cascade)
  autoConfirmBookings Boolean @default(false)
  slotDurationMin Int @default(30)
  maxPerSlot Int @default(2)
  allowWalkIns Boolean @default(true)
  advanceNoticeMin Int @default(0)
  openingTime String?
  closingTime String?
  workingDays String[]
  soundAlerts Boolean @default(true)
  bookingAlerts Boolean @default(true)
  dailyDigest Boolean @default(false)
  updatedAt DateTime @updatedAt
}
model ShopPayoutAccount {            // encrypted columns, see ENG-5
  shopId String @id
  shop   Shop   @relation(fields: [shopId], references: [id], onDelete: Cascade)
  accountHolderEnc Bytes
  accountNumberEnc Bytes
  accountLast4 String
  ifscEnc Bytes
  upiIdEnc Bytes?
  bankName String
  razorpayAccountId String?
  kycStatus String @default("PENDING")
}
model ShopCompliance { shopId String @id  shop Shop @relation(fields:[shopId],references:[id],onDelete:Cascade)
  gstNumber String? panNumber String? fssaiNumber String? legalEntityName String?
  grievanceOfficerName String? grievanceEmail String? grievancePhone String? }
model ShopArchivedOrder { shopId String  orderId String  archivedAt DateTime @default(now())
  @@id([shopId, orderId])  @@index([shopId]) }
model UserArchivedOrder { userId String orderId String archivedAt DateTime @default(now()) @@id([userId, orderId]) }
model ReviewHelpfulVote { reviewId String userId String createdAt DateTime @default(now()) @@id([reviewId,userId]) }
model UserAlertPreference { userId String @id /* typed boolean columns */ }
```
**Migration steps (zero-downtime):** (1) add models, `prisma migrate dev --name settings_tables`; (2) one-off script copies rows from the old tables / JSONB into typed tables; (3) deploy code reading new tables (dual-read fallback for one release); (4) drop old tables in a later migration; (5) delete all `ensure…Table()` helpers.

Related fixes: replace `notIn` of archived IDs with `WHERE NOT EXISTS (SELECT 1 FROM "ShopArchivedOrder" a WHERE a."orderId" = o.id AND a."shopId" = o."shopId")` (Prisma: relation filter `archivedBy: { none: {} }`); fetch settings for many shops in one query (`findMany({ where: { shopId: { in: ids } } })`) to remove N+1.

---

## ENG-5 · Protect sensitive data (bank, PAN, IDs)

**Solution**
1. **Envelope encryption:** AES-256-GCM per-field with a data key from KMS (AWS KMS / GCP KMS); store `iv|tag|ciphertext`. Helper `encryptField(plain)`, `decryptField(buf)`; key rotation by key version prefix.
2. API returns masked values by default (`accountNumber: "••••••4321"`, `panNumber: "ABCDE••••F"`); full value only to the owner after OTP re-verification, short-lived (5 min) and audit-logged.
3. Logs/Sentry scrubbers drop `accountNumber|ifsc|pan|otp|token|authorization`.
4. DB: encrypted-at-rest volumes, restricted DB roles (app role cannot `DROP`), TLS to Postgres/Redis.
5. Public endpoints use explicit `select` allow-lists (see Release doc RB-1) — add a unit test enumerating the public response keys.

---

## ENG-6 · Input validation & API hardening

1. Remove `.passthrough()` from `updateShopSchema`; add strict server regex for GSTIN/PAN/IFSC/UPI/phone/pincode (client checks are UX only). Return `422 { errors: { field: message } }`.
2. Central error handler maps `ZodError` → 422, `AppError` → its status, unknown → 500 with a request ID (no stack in prod).
3. `helmet` CSP tuned for the web build; `express-mongo-sanitize`-style not needed, but cap body size (`json({limit:'1mb'})`), multipart limits (5 MB, mime allow-list: image/jpeg|png|webp, text/csv).
4. Rate limits per route class: auth (5/min/IP+phone), writes (60/min/user), CSV upload (5/hour/shop). Use Redis store so limits hold across instances.
5. Pagination caps everywhere (`limit ≤ 100`); search input length caps; ID params validated as UUID.
6. Authorization tests for every `:shopId`/`:orderId` route (owner vs other seller vs buyer) — table-driven test generated from the route list.
7. Access tokens: 15 min (already) + rotating refresh tokens stored hashed with device id; revoke on logout/password-equivalent events. Native app: store tokens with `@capacitor-community/secure-storage` (Keystore) instead of `localStorage`.

---

## ENG-7 · Logging, errors, tracing

1. Replace `morgan('dev')` + `morgan('combined')` + 27 `console.*` with **pino** (JSON), `pino-http` with request ID (`x-request-id`, propagated to client responses) and redaction paths.
2. Delete the `last_error.log` file write in `order.controller.ts:26`.
3. **Sentry**: `@sentry/node` (backend) and `@sentry/react` + `@sentry/capacitor` (app) with release tags, source-map upload in CI, user id (not phone) in context.
4. Metrics: `prom-client` (`http_request_duration_seconds`, `orders_created_total`, `otp_sent_total`, job durations) → Grafana/Cloud monitoring; alerts: 5xx rate > 2%, p95 > 1.5 s, queue depth, DB connections, disk, payment-webhook failures.
5. Uptime checks on `/api/health` (liveness) and new `/api/ready` (checks DB + Redis).

---

## ENG-8 · Audit log

Table `audit_log(id, actorId, actorRole, action, entityType, entityId, before JSONB, after JSONB, ip, userAgent, createdAt)`; write from a small `audit()` helper on: payout/KYC changes, shop settings, order status changes (including system auto-confirm), refunds, admin actions, account deletion. Never include secrets in `before/after` (store masked). Retain ≥ 1 year; read-only admin screen with filters.

---

## ENG-9 · Background jobs: separate worker + queue

**Problem:** cron-like jobs (telemetry sync, review sentiment, hold expiry, ads) run inside the API process → duplicated when scaled, die with the web server.

**Solution:** BullMQ on Redis. `src/worker.ts` entrypoint (own container) registers processors; the API only enqueues. Convert existing jobs to repeatable jobs with stable job IDs (dedupe). Standard retry policy (exponential backoff, 5 attempts, dead-letter queue + alert). Add Bull Board behind admin auth. Needed by: hold-expiry (release stock), digest/reminders, CSV import, payouts, account deletion, report generation.

**Hold expiry specifics:** order `holdExpiresAt`; delayed job `expire:{orderId}`; on fire, if still `PLACED/CONFIRMED` and unclaimed → `CANCELLED` (`cancelledBy: SYSTEM`), restore stock **only if it was deducted**, notify both parties. Idempotent via status check inside a transaction.

---

## ENG-10 · Storage & media

1. Production uploads → S3-compatible bucket (`config/s3.ts` already exists) + CDN (CloudFront/Cloudflare). Local `/uploads` only in dev; container disks are ephemeral.
2. Store **relative keys** in DB (not absolute URLs — the code already strips LAN hosts), build URLs from `CDN_BASE_URL`. Run a migration to normalise existing rows.
3. Generate responsive sizes (320/640/1080 WebP) at upload; `loading="lazy"` + `srcset`.
4. Private bucket + signed URLs for KYC documents.

---

## ENG-11 · Realtime & horizontal scale

1. Socket.IO: add `@socket.io/redis-adapter` so events reach clients connected to other instances; sticky sessions or websocket-only transport.
2. Authenticate sockets with the JWT on handshake and authorise `subscribeToShop` (only the shop owner/staff) — verify the current handler checks ownership.
3. Stateless API (no in-memory state); Redis for sessions/limits/cache; Postgres via PgBouncer; connection pool sized per instance.
4. **Load test** with k6: browse (read-heavy), hold flow (write contention on stock), seller dashboard polling; set SLOs (p95 < 500 ms reads, < 800 ms writes at 200 RPS) and capacity-plan from the results.
5. DB indexes: review slow query log; confirm composite indexes for `Order(shopId, status, createdAt)`, `Order(userId, createdAt)`, `Product(shopId, isActive)`, geo bounding-box queries (consider PostGIS + GiST for nearby search).

---

## ENG-12 · Single source for plans & limits

Centralise in `config/plans.ts` (`FREE`, `STARTER`, `PROFESSIONAL`, `PREMIUM`: products, images/product, ad credits, staff seats, CSV rows) consumed by product create, bulk import, subscription UI and billing. Replace the two duplicated literal maps in `product.service.ts`. Unit-test each limit boundary.

---

## ENG-13 · Frontend structure & performance

1. Split god-components (`ExploreScreen` 161 KB, `SellerPromotionsScreen` 117 KB, `SellerProfileScreen` 116 KB+, `BuyerOrdersScreen` 103 KB, `HomeScreen` 100 KB) into feature folders: container (data) + presentational components + hooks; extract modals (Digest, Merchant Network, CSV, Payout) into their own files.
2. Route-level code splitting (`React.lazy` + `Suspense`), `rollup-plugin-visualizer` in CI with a bundle budget (initial JS < 250 KB gz).
3. Data layer: adopt TanStack Query (cache, retries, de-dup, optimistic updates) to replace ad-hoc `dataCache` + manual loading flags.
4. State: keep Zustand stores; add selectors to avoid re-render storms; virtualise long lists (`react-virtuoso`).
5. Accessibility: lint with `eslint-plugin-jsx-a11y`; fix colour tokens in dark mode (the white-on-white cancel dialog came from a missing theme token) — add a Storybook/visual snapshot for dialogs in light+dark.
6. i18n: `react-i18next` with `en`, `hi`, `mr`; extract strings incrementally by screen.

---

## ENG-14 · Environments, secrets, data safety

1. Three environments: `dev`, `staging` (prod-like, seeded, real SMS sandbox, Razorpay test), `prod`. Separate DBs/Redis/buckets/Firebase projects.
2. Secrets in a manager (not `.env` files in repos); `.env.example` kept complete; CI uses OIDC to cloud, no long-lived keys.
3. **Backups:** managed Postgres with automated daily snapshots + PITR (7–14 days), monthly restore drill to staging with a documented RTO ≤ 1 h / RPO ≤ 15 min. Redis persistence (AOF) or treat as cache-only and verify nothing critical lives only in Redis (OTP, queues — queues need persistence).
4. Migration policy: forward-only, reviewed, run in CI against a snapshot; use expand/contract for breaking changes.
5. Release process: semver tags, changelog, staged rollout, feature flags (Unleash/GrowthBook/Firebase Remote Config) for risky features, and a documented rollback (previous image + backward-compatible schema).

---

## Execution order (engineering)

1. **Week 1:** ENG-1 (CI + typecheck), ENG-6 items 1–2, ENG-7 logging cleanup, ENG-3 inventory.
2. **Weeks 2–3:** ENG-4 (schema migrations) + ENG-5 (encryption) together, ENG-2 test harness with ported suites.
3. **Weeks 3–4:** ENG-9 (worker/queue + hold expiry), ENG-10 (S3/CDN), ENG-14 (staging, backups).
4. **Weeks 5–6:** ENG-11 (adapter, load test, indexes), ENG-12, ENG-7 metrics/alerts, ENG-8.
5. **Ongoing:** ENG-13 refactors per screen as features are touched.
