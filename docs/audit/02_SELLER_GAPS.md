# 02 — Seller Side: Detailed Build Plan

Goal: turn "settings that save" into features that actually **act**. Each item: **Current → Target → Design → Steps → Acceptance**.

Shared prerequisite: move the runtime-created tables into Prisma (see Engineering doc ENG-4) so the models below get FKs and migrations.

---

## SEL-1 · Auto-confirm bookings enforced on the server

**Current:** `autoConfirmBookings` is stored; confirmation only happens if the seller's app is open and receives a socket event.

**Target:** the server decides, always, atomically.

**Design**
- Prisma model `ShopSettings` (1:1 with `Shop`): `autoConfirmBookings Boolean @default(false)`, `slotDurationMin Int @default(30)`, `maxPerSlot Int @default(2)`, `allowWalkIns Boolean`, `advanceNoticeMin Int`, `openingTime`, `closingTime`, `workingDays String[]`, notification toggles. Migrate data from `shop_extended_settings` JSON.
- In `OrderService.createOrder`, inside the existing transaction, after stock reservation:
  ```ts
  const settings = await tx.shopSettings.findUnique({ where: { shopId } });
  const status = settings?.autoConfirmBookings ? 'CONFIRMED' : 'PLACED';
  ```
  Write the `statusHistory` entry (`updatedBy: 'SYSTEM_AUTO_CONFIRM'`), and run the same stock-deduction code path used by manual confirm (extract `confirmOrderTx(tx, order)` and reuse in both places so behaviour can't diverge).
- Emit `shop:new-order` with `autoConfirmed: true`; push notification to buyer "Your hold is confirmed".
- Remove the client-side auto-confirm call from `SellerOrdersScreen` (keep only the toast).

**Steps:** schema + migration → service refactor → unit tests (default false keeps current tests valid; true → `CONFIRMED`; stock decremented once; concurrent orders don't oversell) → remove client hack.

**Acceptance:** with the app closed, a new order arrives already `CONFIRMED` when enabled; `PLACED` otherwise.

---

## SEL-2 · Real schedule engine: slots, capacity, notice, hours

**Current:** `slotDuration`, `maxPerSlot`, `advanceNotice`, `allowWalkIns`, opening hours are never enforced.

**Target:** buyers pick a pickup slot; server enforces capacity.

**Design**
- Order gets `pickupSlotStart DateTime?`, `pickupSlotEnd DateTime?`.
- `GET /api/shops/:id/slots?date=YYYY-MM-DD` computes slots from hours + duration, subtracts blocked/closed days, past-notice slots, and slots whose confirmed+placed count ≥ `maxPerSlot`. Compute in shop timezone (`Asia/Kolkata`) using `date-fns-tz`.
- `createOrder` validates the slot again **inside the transaction** using `SELECT … FOR UPDATE` on a `shop_slot_counters(shop_id, slot_start, booked)` row (upsert + conditional increment) to prevent double-booking races.
- `allowWalkIns=false` → hide "Visit now" option in buyer UI.
- Holiday/closure table `shop_closures(shop_id, date, reason)` + seller UI.
- Buyer UI: slot picker in checkout; seller UI: day schedule timeline.

**Acceptance:** two simultaneous requests for the last slot → exactly one succeeds; orders outside hours/notice are rejected with a clear error.

---

## SEL-3 · Scheduled notifications: reminders & daily digest

**Current:** "Booking Reminders" and "Daily Digest" toggles do nothing on their own; digest is on-demand only.

**Target:** jobs deliver them reliably.

**Design**
- Introduce a queue (BullMQ on the existing Redis) and a separate `worker` process (see ENG-9).
- **Reminder job:** when an order is confirmed with a slot, enqueue a delayed job `reminder:{orderId}` at `slotStart − 15 min` (cancel on cancel/reschedule). Worker checks `bookingAlerts` and sends FCM push to seller + buyer.
- **Digest job:** repeatable job per shop at 20:00 IST if `dailyDigest=true` (or per-shop configurable time). Builds the existing `getDailyDigestReport`, sends via WhatsApp Business Cloud API (approved utility template) with FCM fallback.
- WhatsApp: register Meta Business, verify number, create template `daily_digest` with variables (bookings, value, pending, low stock); store opt-in consent timestamp.
- Idempotency: job id = `digest:{shopId}:{yyyy-mm-dd}`; record in `notification_log` to avoid duplicates; retry with backoff (3 attempts).

**Acceptance:** toggle on → digest arrives at 20:00 without opening the app; toggle off → none; reminder fires 15 min before slot.

---

## SEL-4 · Closed-app new-order alert (push + custom sound)

**Current:** Web Audio chime works only while the app is foregrounded (and only after a user gesture).

**Target:** loud alert even when the app is killed.

**Steps**
1. Capacitor: `@capacitor/push-notifications` (FCM). Register token on login → `POST /users/fcm-token` (exists); store per device (`user_devices` table: token, platform, lastSeen); delete on logout and on FCM `UNREGISTERED`.
2. Server: `notification.service` sends **data + notification** messages with `android.priority: 'high'`, `channelId: 'new_orders'`, `sound: 'order_bell'`, TTL 60 s.
3. Android: create notification channel `new_orders` (importance HIGH, custom sound `res/raw/order_bell.mp3`, vibration pattern, `bypassDnd` only if user opts in). Channel sound can't be changed after creation — ship the final sound in the first release.
4. Battery: guide sellers to disable battery optimization (deep link `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` with explanation); optional foreground service "Store is open — listening for orders" for always-on shops.
5. Honour `soundAlerts`: server includes the sound in the payload only when enabled.
6. In-app foreground: keep Web Audio chime; unlock AudioContext on first tap (already needed).
7. Tap action deep-links to the order.

**Acceptance:** with the app swiped away, a placed order rings within ~3 s on a physical Android device (test on Xiaomi/Oppo — aggressive battery managers).

---

## SEL-5 · Payouts & settlements (Razorpay Route)

**Current:** bank/UPI details are stored; no money movement, ledger, or history.

**Target:** marketplace payouts compliant with RBI PA rules (funds flow through Razorpay, you never hold them).

**Design**
- Seller onboarding: Razorpay **Route** linked account (`POST /v2/accounts`) with legal name, PAN, bank/IFSC, business type; stakeholder + product configuration; store `razorpayAccountId` + `kycStatus` (`CREATED|NEEDS_CLARIFICATION|ACTIVATED|REJECTED`) updated via `account.*` webhooks.
- Penny-drop / IFSC verification via Razorpay fund-account validation before enabling payouts.
- Online orders: create Razorpay order with `transfers: [{ account, amount: total − commission − gst_on_commission, on_hold: 1, on_hold_until: pickup+T }]`; release hold when the order is `DELIVERED` (handed over). COD orders: commission billed through a seller ledger (negative balance, auto-deduct from next online payout).
- Tables: `settlements(id, shopId, periodStart, periodEnd, gross, commission, gst, refunds, adSpendDeduction, net, status, utr, paidAt)`, `ledger_entries` (double-entry style, immutable).
- Seller UI: Earnings screen (available, on hold, paid), settlement history, downloadable statement (PDF/CSV), commission invoice (GST).
- Admin: payout exceptions queue.

**Acceptance:** test-mode order → hold → release on handover → settlement row with UTR; ledger sums reconcile to Razorpay.

---

## SEL-6 · KYC / compliance verification

**Current:** GSTIN, FSSAI, PAN are accepted as free text; nothing is verified.

**Design**
- Server-side format validation first (GSTIN regex + checksum, PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`, FSSAI 14 digits, IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`, UPI `^[\w.-]+@[\w]+$`). Remove `.passthrough()` from `updateShopSchema`; return 422 with field errors.
- Provider API verification (Karza / Signzy / IDfy / Surepass): GSTIN (legal name, status Active), PAN (name match), FSSAI licence validity, bank account (penny-drop). Fuzzy-match returned legal name to `legalEntityName`.
- `shop_kyc` table: `type, value, status (PENDING|VERIFIED|FAILED|MANUAL_REVIEW), verifiedName, providerRef, verifiedAt, documentUrl`.
- Document upload (GST certificate, shop licence, cancelled cheque) → private S3 bucket with signed URLs, virus scan optional.
- Admin console: review queue, approve/reject with reason, notifies seller.
- Public "Verified" badge only when GST/PAN verified and admin-approved; badge feeds `Shop.isVerified`.
- Encrypt stored identifiers (Engineering doc ENG-5) and mask in UI.

**Acceptance:** wrong GSTIN rejected; valid one shows legal name and VERIFIED; badge appears only after approval.

---

## SEL-7 · CSV import v2 (reliable at scale)

**Current:** synchronous import, no preview, no SKU/duplicate handling (`skipDuplicates` does nothing without a unique key), no image validation.

**Design**
- Add `sku String?` to `Product`, unique `@@unique([shopId, sku])`. Upsert by SKU (update price/stock) → enables POS/Tally re-sync.
- Flow: `POST /products/shop/:id/bulk-import/preview` (parse, validate, return per-row result + counts, nothing written) → user confirms → `POST …/bulk-import` creates an `import_jobs` row and enqueues a worker job → `GET /import-jobs/:id` for progress (processed/total/errors). Cap file at 5 MB / 5,000 rows.
- Validation per row: required fields, numeric ranges, `mrp ≥ price`, category exists in taxonomy (suggest nearest), image URLs must be https and reachable (HEAD, timeout, size limit) — download & compress asynchronously; never block the request.
- Error report downloadable as CSV (row, column, message).
- Template includes `sku`, header aliases documented (Tally/Busy/Marg exports): maintain an alias map in one file.
- Use `createMany` in chunks of 500 in a transaction per chunk; per-chunk failure doesn't lose the rest.
- Replace the hard-coded FREE=1000 with plan limits from a single `PLAN_LIMITS` config (ENG-12).

**Acceptance:** re-uploading the same CSV updates rather than duplicates; a 5,000-row file imports without request timeout and shows progress.

---

## SEL-8 · Printing & dispatch slip

**Current:** `window.open` + `window.print()` — blocked by popup blockers / unreliable in Android WebView.

**Design:** server endpoint `GET /orders/:id/slip.pdf` (pdfkit or Puppeteer on the worker) with shop name, order number, QR (pickup code), items, buyer first name + masked phone, totals. In-app: download/share with `@capacitor/filesystem` + `@capacitor/share`; "Print" via the Android print framework plugin or share to a Bluetooth thermal printer app. QR is scanned by the seller app (`@capacitor-mlkit/barcode-scanning`) to complete handover — also prevents fraudulent "delivered" marking.

**Acceptance:** PDF opens on a device and prints to a standard printer.

---

## SEL-9 · Seller support desk & merchant network

**Support:** add `audience` (BUYER|SELLER) and `priority` + `slaDueAt` to `SupportTicket`; seller tickets get 4 h first-response SLA; agent inbox in admin console (assign, canned replies, status, internal notes); email/push on reply; satisfaction rating on close.

**Network:** decide the product intent first. Minimum viable: opt-in directory (`shop.networkOptIn`), category filter, "Connect" creates a mutual request (accept/decline) before exposing WhatsApp numbers (privacy). Later: B2B offers/wholesale board, city groups with moderation.

**Acceptance:** seller ticket shows priority and countdown to SLA; contact details never exposed without opt-in.

---

## SEL-10 · Seller operations backlog

| Item | Solution |
|---|---|
| Archived orders view | Add "Archived" tab with restore (`DELETE FROM shop_archived_orders`), plus CSV export of orders for accounting |
| Low-stock alerts | Nightly/real-time check `quantity <= lowStockThreshold` → push + digest line; per-product threshold |
| Variants/SKU UI | Use existing `ProductVariant` model; size/colour editor, per-variant stock |
| Analytics truthfulness | Remove `seller-local-shop` stub in `client.ts`; all charts from `/shops/:id/analytics` with empty states |
| Multi-staff roles | `ShopMember(shopId, userId, role: OWNER|MANAGER|COUNTER)`; permissions matrix (counter can handle orders, not payouts/KYC); invite by phone |
| GST invoices | Generate seller→buyer tax invoice PDF per delivered order with invoice-number sequence per shop per FY |

---

## Suggested sequencing (seller)

1. SEL-1 + SEL-2 (server enforcement) — 1 sprint
2. SEL-4 (push) + SEL-3 (jobs) — 1 sprint (needs worker from ENG-9)
3. SEL-6 (KYC) → SEL-5 (payouts) — 2 sprints (payouts depend on KYC)
4. SEL-7, SEL-8, SEL-9, SEL-10 — rolling
