# 04 — Campaigns Tab

Screen: summary strip (~L998-1015) + `CampaignCard` (~L40-140). Backend: `adsService.getShopPromotionAnalytics(shopId)` (**no period parameter**, see R-01).

## 4.1 Summary strip
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| CMP-SUM-001 | "Active Ad Spend" | F6 | Label says *active* but UI sums **all** campaigns incl. paused/ended (R-21). Expected: either only LIVE or relabel "Total Ad Spend (period)" | P0 |
| CMP-SUM-002 | Attributed Revenue | Σ `c.revenue` | = Σ attributed order totals (cancelled excluded) = Overview promoted revenue (same period) | P0 |
| CMP-SUM-003 | "Overall ROAS" | UI shows blended `analytics.roas` (total shop revenue ÷ spend) beside campaign-only numbers (R-02) | = Σrevenue ÷ Σspend of the same campaigns | P0 |
| CMP-SUM-004 | Period scope | switch 7D→90D | strip values change if claimed period-scoped; else labeled "All-time" | P0 |
| CMP-SUM-005 | Zero | F0 | `₹0`, ROAS `0.00x` | P1 |
| CMP-SUM-006 | Summary vs Overview | spend/revenue/ROAS | identical definitions & values | P0 |

## 4.2 Campaign list
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| CMP-LST-001 | Empty state | F0 | "No Active Campaigns" + CTA to boost | P1 |
| CMP-LST-002 | Order | LIVE first, then recent | deterministic | P2 |
| CMP-LST-003 | Count equals Promotions screen | same campaigns (ids) | equal | P1 |
| CMP-LST-004 | Deleted product campaign | F6 deleted product | labeled, not LIVE, no broken image/NaN | P1 |
| CMP-LST-005 | Many campaigns (50) | | scroll perf, cap or paginate | P2 |

## 4.3 Campaign card metrics
| ID | Parameter | Formula | Test (F6 LIVE: budget 1000, spent 400, impr 2000, clk 100, conv 4, rev 2000) | Pass | Sev |
|----|-----------|---------|------|------|-----|
| CMP-CRD-001 | Title | productName; fallback string `'Weekend Curbside Handover 10%'` | missing name | **Hard-coded demo fallback must be removed** → "Untitled campaign" (R-22) | P0 |
| CMP-CRD-002 | Status chip | LIVE→"Active", HISTORY→"Completed" | PAUSED shows? | `state` has only LIVE/HISTORY → paused campaigns display "Completed" (R-23). Expect Paused/Ended/Out of budget | P0 |
| CMP-CRD-003 | Duration | start–end `toLocaleDateString` | ongoing = "Ongoing" | dates IST-correct (no off-by-one near midnight) | P1 |
| CMP-CRD-004 | Spent of Budget | | ₹400 of ₹1,000 | exact | P0 |
| CMP-CRD-005 | % budget reached | spent/budget | 40% | clamp 0–100; `budget=0` → 0 not NaN | P1 |
| CMP-CRD-006 | Progress bar min width | `Math.max(4, pct)` | spent 0 | bar shows 4% when 0% (**misleading**) → allow 0 | P2 |
| CMP-CRD-007 | Impressions | `formatNumber` k | 2000 → `2.0k` | 999 → `999`, 999,999 → `1000.0k` bug | P1 |
| CMP-CRD-008 | Clicks | | 100 | P0 |
| CMP-CRD-009 | CTR | clicks ÷ max(impr, clicks) | 5.00% | ≤100 | P0 |
| CMP-CRD-010 | Orders (conversions) | attributed orders | 4 | = count of orders with this `adCampaignId`, non-cancelled | P0 |
| CMP-CRD-011 | ROAS | revenue ÷ spent | 5.0x | 1 dp UI; spent 0 → `0.0x` | P0 |
| CMP-CRD-012 | CPC/CPA/CPM/CVR/AOV (if shown) | 400/100=4; 400/4=100; 400/2000*1000=200; 4/100=4%; 2000/4=500 | | exact to 2 dp | P1 |
| CMP-CRD-013 | Budget exhausted | spent ≥ budget | state = ended/out-of-budget; **never** overspend > budget (race) | P0 |
| CMP-CRD-014 | Targeting text | RADIUS → "Within N km"; cities list; else "All Local Areas" | each | correct, long list truncates | P2 |
| CMP-CRD-015 | Spend refunds | order returned → revenue reversed | revenue/ROAS drop | P0 |
| CMP-CRD-016 | Daily rollup vs lifetime | card shows lifetime totals while Overview shows period spend (R-01) | consistent or labeled | P0 |

## 4.4 Pause / Resume
| ID | Test | Pass | Sev |
|----|------|------|-----|
| CMP-ACT-001 | Pause LIVE | toast; state flips; impressions stop within 1 min (check ad serving endpoint excludes it) | P0 |
| CMP-ACT-002 | Resume | live again; budget not reset | P0 |
| CMP-ACT-003 | Resume ended campaign | blocked with reason (no budget / expired) | P0 |
| CMP-ACT-004 | Other seller's campaign id | API 403 | P0 |
| CMP-ACT-005 | Network fail | error toast; UI state unchanged (no optimistic lie) | P1 |
| CMP-ACT-006 | Double tap | single request | P2 |
| CMP-ACT-007 | Refetch after action | `loadData(true)` shows new state; Promotions screen cache invalidated; both agree | P1 |
| CMP-ACT-008 | Wallet side-effects | pausing doesn't charge; refund of unspent budget policy followed | P0 |
