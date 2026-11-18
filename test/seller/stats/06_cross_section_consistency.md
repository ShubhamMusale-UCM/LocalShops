# 06 — Cross-Section Consistency & Invariants

Run after 02–05. These catch bugs per-section tests miss. Evaluate on F2, F4, F6, F7, F10 with the **same period selected**.

## 6.1 Same metric, many places
| ID | Metric | Places that must agree | Pass |
|----|--------|------------------------|------|
| X-001 | Revenue | Overview hero = Σ weekly (when period=7D) = Σ product GMV (+fees/discounts reconciliation) = Seller Orders page total | within ±₹0.01 after documented reconciliation |
| X-002 | Orders | Overview = funnel Orders = Σ revenue-breakdown statuses (excl. lost) = Orders page count | equal |
| X-003 | Ad spend | Overview ROAS denominator = Campaign strip = Σ card spent = Promotions screen (same window) | equal |
| X-004 | Attributed revenue | Overview promoted revenue = Campaign strip Attributed Revenue = Σ card revenue | equal |
| X-005 | ROAS | Overview tile = Attribution promoted ROAS = Campaign strip "Overall" | one definition (attributed ÷ spend) |
| X-006 | Impressions | Overview tile = funnel top (or documented diff) = traffic mix base | equal or each labeled |
| X-007 | CTR | Overview "Store CTR" vs product CTR vs campaign CTR | names reflect different formulas; no two same-named differing |
| X-008 | AOV | Overview = Promotions/orders AOV | same rounding |
| X-009 | Wishlist/cart counts | Products tab vs Manage Products | equal |
| X-010 | Stats vs Dashboard | Seller Dashboard "today/this week revenue" cards vs Stats 1D/7D | equal |
| X-011 | Audience screen | follower/buyer counts vs Stats retention | consistent scope |

## 6.2 Invariants (assert programmatically in `scripts/stats_invariants.ts`)
```
I1  revenue >= 0, orders >= 0, all counts integers
I2  orders == 0  =>  revenue == 0 && aov == 0
I3  earned + pipeline == totalRevenue ; earned+pipeline+lost == gross placed
I4  organicRevenue + promotedRevenue == totalRevenue ; same for orders
I5  0 <= ctr <= 100 ; 0 <= conversionRate <= 100 ; 0 <= cancellationRate <= 100
I6  funnel[0] >= funnel[1] >= funnel[2] >= funnel[3] == ordersCount
I7  trafficSources pct sum == 100 (when non-empty)
I8  weeklyRevenue.length == 7 ; Σ weeklyRevenue <= totalRevenue(30D)
I9  period monotonic: rev(7D) <= rev(30D) <= rev(90D)  (same data)
I10 Σ topProducts.revenue <= totalRevenue (+ documented fee diff) ; each product units >= 0
I11 spent <= budget for every campaign ; spent >= 0 ; roas == revenue/spent when spent>0
I12 no field is NaN / Infinity / undefined / "∞" in JSON
I13 idempotent: two calls (cache bypassed) with no new events => identical JSON
I14 additive: placing one order of ₹X changes revenue by exactly +X, orders +1, nothing else decreases
I15 cancelling that order restores revenue/orders and raises lost counters
I16 shop isolation: response contains only this shop's ids
```

## 6.3 Mutation (event → number) tests
| ID | Action | Expected delta (after cache bust / socket) |
|----|--------|-------------------------------------------|
| M-001 | Buyer places order ₹800 organic | rev +800, orders +1, organic +, funnel orders +1, pipeline +800 |
| M-002 | Seller confirms → delivered | pipeline −800, earned +800, revenue unchanged |
| M-003 | Seller cancels | revenue −800, orders −1, lost +800 |
| M-004 | Buyer places via ad click | promotedOrders +1, campaign conversions +1, campaign revenue +, ROAS ↑ |
| M-005 | Refund after delivery | earned −, lost + , growth recomputed |
| M-006 | Add to cart (no order) | cartAdds +1, funnel cart +1, abandoned +1 |
| M-007 | Product detail view | periodViews +1 (once per view session) |
| M-008 | Ad impression / click | impressions +1 / clicks +1, spend per pricing model |
| M-009 | WhatsApp / call / directions tap | leads +1 |
| M-010 | Stock sells out | product tile "Out of stock", `missedOosViews` increments on later views |
| M-011 | Midnight IST rollover (fake clock) | "today" bar shifts, 7D window shifts by one day, caches key by day |
| M-012 | Concurrent 20 orders | totals equal Σ, no lost update |
