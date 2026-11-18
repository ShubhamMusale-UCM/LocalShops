# 00 — Oracle & Fixtures

An **oracle** is an independent way to compute the right answer. Never validate the API with the API's own code.

## A. Time model (source of most bugs)
- Business timezone: **Asia/Kolkata (IST, +05:30)**. All day buckets are IST days.
- `todayStart` = today 00:00 IST. `since` = `todayStart − (days−1)·24h` (for `days=1`, `since=todayStart`).
  So "7D" = today + previous 6 IST days (**7 calendar days, inclusive of today**).
- Previous period (for growth %): intended to be the immediately preceding window of equal length.
- Order timestamps are UTC in DB; bucket with `AT TIME ZONE 'Asia/Kolkata'`.

## B. Metric definitions (what each number MUST mean)

| Metric | Definition | Included orders |
|--------|-----------|-----------------|
| Revenue (GMV) | Σ `Order.total` in window | status ∉ {CANCELLED, REFUNDED} (placed incl. pending) |
| Orders | count of the above | same |
| AOV | Revenue ÷ Orders (0 if no orders) | same |
| Earned | Σ total where status = DELIVERED | |
| In-pipeline | PLACED, CONFIRMED, PREPARING, READY_FOR_PICKUP, OUT_FOR_DELIVERY | |
| Lost | CANCELLED, REFUNDED | |
| Cancellation rate | Lost ÷ (Delivered+Pipeline+Lost) ×100, 1 dp | |
| Growth % | (Rev − PrevRev) ÷ PrevRev ×100, 1 dp; PrevRev=0 & Rev>0 → `100.0`; both 0 → `0.0` | |
| Ad impressions / clicks / spend | Σ `AdDailyMetricRollup` in window for shop's promoted listings | |
| Ad CTR | clicks ÷ max(impr, clicks) ×100, clamp 0–100, 2 dp; 0 if clicks=0 | |
| ROAS (attributed) | Σ revenue of orders with `adCampaignId` ÷ ad spend | |
| ROAS (blended) | total revenue ÷ ad spend — **not an ad metric**, see risk R-02 | |
| Funnel | Shop reach ≥ Product views ≥ Add-to-cart ≥ Orders (monotonic non-increasing) | |
| Repeat buyer rate | buyers with >1 order ÷ unique buyers ×100 | state the window used |
| Abandoned carts | CartItem rows for shop products (current snapshot) and Σ qty×price | snapshot, not windowed |

## C. Deterministic fixtures

Create with `server/scripts/` seeder (write `seed_stats_fixture.ts` on first use; keep idempotent, prefix ids `FX-`).
Use a dedicated fixture shop `FX-SHOP-A` + owner `FX-SELLER-A`. Second shop `FX-SHOP-B` (different owner) for isolation tests.

| Fixture | Purpose | Data |
|---------|---------|------|
| **F0 empty** | new seller | shop, 0 products, 0 orders, 0 ads, 0 analytics rows |
| **F1 single order** | smallest non-zero | 1 product ₹1,000, 1 DELIVERED order today 12:00 IST, qty 1 |
| **F2 mixed statuses** | revenue breakdown | today: 2 DELIVERED (₹500,₹700), 1 CONFIRMED ₹300, 1 PREPARING ₹200, 1 CANCELLED ₹900, 1 REFUNDED ₹400 |
| **F3 tz boundary** | day bucketing | orders at 23:59:59 IST, 00:00:00 IST, 18:29:59 UTC, 18:30:00 UTC on consecutive days |
| **F4 window edges** | period filter | one order per day for 100 days at ₹100 each, noon IST |
| **F5 growth** | growth % | prev window ₹1,000 / cur ₹1,500; prev ₹0 / cur ₹500; prev ₹500 / cur ₹0; both 0 |
| **F6 ads** | campaign math | 3 listings: LIVE (budget 1000, spent 400, impr 2000, clk 100, conv 4, rev 2000); PAUSED; ENDED (spent=budget); + 1 listing whose product was deleted |
| **F7 ad attribution** | organic vs promoted | 6 orders: 2 with `adCampaignId`, 4 without; ad spend ₹500 |
| **F8 products** | top products | 25 products, mixed lifetime vs in-window sales, 2 OOS, 1 with `quantity=null`, 1 with name containing `%` and unicode |
| **F9 keywords** | keyword tab | keywords: (a) 10 searches/3 clicks (b) 5/0 (c) 2/0 (d) 1/0 (e) 0/0-edge (f) mixed case `Shirt`/`shirt` (g) 30 distinct keywords (>25 cap) |
| **F10 funnel** | monotonic | ShopAnalytics views 100, productDetailViews 40, cartAdds 10, orders 3; plus case where cartAdds < orders |
| **F11 scale** | big numbers | revenue ₹12,34,56,789; impressions 12,34,567; orders 4,321 |
| **F12 isolation** | security | Shop-B data present; Seller-A must never see it |

## D. How to read both sides

**API (truth under test)**
```powershell
# get token via login flow in scripts or reuse test helper; then
Invoke-RestMethod "http://localhost:5000/api/shops/$shopId/analytics?days=30" -Headers @{Authorization="Bearer $token"}
```
Bypass 60s cache while testing: `redis-cli --scan --pattern "shop:*:analytics*" | xargs redis-cli del` or `npx ts-node server/clear_redis.ts`.

**Oracle SQL (Postgres)** – examples to adapt per case:
```sql
-- revenue & orders (7D example; replace :since with IST todayStart - 6d)
SELECT COALESCE(SUM(total),0) rev, COUNT(*) n FROM "Order"
WHERE "shopId"=:shop AND "createdAt">=:since AND status NOT IN ('CANCELLED','REFUNDED');

-- daily buckets in IST
SELECT TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') d, SUM(total), COUNT(*)
FROM "Order" WHERE "shopId"=:shop AND "createdAt">=:since AND status NOT IN ('CANCELLED','REFUNDED') GROUP BY d ORDER BY d;

-- status split
SELECT status, COUNT(*), SUM(total) FROM "Order" WHERE "shopId"=:shop AND "createdAt">=:since GROUP BY status;

-- ad totals
SELECT SUM(clicks), SUM(impressions), SUM(spend) FROM "AdDailyMetricRollup" r
JOIN "PromotedListing" l ON l.id=r."promotedListingId" WHERE l."shopId"=:shop AND r.date>=:since;

-- attributed
SELECT COUNT(*), SUM(total) FROM "Order" WHERE "shopId"=:shop AND "createdAt">=:since
 AND status NOT IN ('CANCELLED','REFUNDED') AND "adCampaignId" IS NOT NULL;
```
Table/column names must be verified against `server/prisma/schema.prisma` before use.

**UI** – drive via browser subagent at `http://localhost:5173`, seller login, open Stats tab. Capture:
1. Visible text of each card; 2. screenshot at 360×800 and 768×1024; 3. console errors; 4. network call params (`days`).

## E. Formatting rules the UI must follow
| Kind | Rule |
|------|------|
| Currency | `₹` + Indian grouping (`₹1,23,456`), no decimals ≥ ₹100 unless defined |
| Counts | `fmt()`: <1000 raw, `1.2K`, `1.2M` — K/M **must not round up to next unit** (999,950 → `1000.0K` bug) |
| Percent | 1–2 dp, always `%`, never `NaN%`, `Infinity%`, `-0.0%` |
| ROAS | `x` suffix, `0.00x` when no spend, never `∞`/`NaN` |
| Zero | show `0` / `₹0`, not blank, not `--` unless "no data" copy is deliberate |
