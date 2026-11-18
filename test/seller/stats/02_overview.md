# 02 — Overview Tab

Screen lines ~472-826. Backend: `getShopAnalytics`. Use fixtures from 00. Each case = **API vs oracle** AND **UI vs API**.

## 2.1 Hero card — Total GMV Revenue (`revenue`, `growth`, `orders`, `aov`)
| ID | Parameter | Formula / Source | Test | Pass | Sev |
|----|-----------|------------------|------|------|-----|
| OVR-REV-001 | Total revenue | Σ total, status ∉ CANCELLED/REFUNDED (`totalRevenue`) | F2 today | = 500+700+300+200 = ₹1,700 (cancelled ₹900 & refunded ₹400 excluded) | P0 |
| OVR-REV-002 | Revenue by period | same | F4 7/30/90 | matches G-PER-002..4 | P0 |
| OVR-REV-003 | Currency format | `fmtCur` | F11 | `₹12,34,56,789` Indian grouping, no overflow/truncation at 360px | P1 |
| OVR-REV-004 | Zero | F0 | `₹0` | P0 |
| OVR-REV-005 | Label claim | subtitle "Verified showroom sales & direct curbside holds" | F2 | Revenue includes unpaid/undelivered pipeline orders → label must not say "Verified"/"earned". Expect wording like "Placed order value" (R-03) | P0 |
| OVR-REV-006 | Includes delivery fee / tax? | order.total composition | order with delivery fee + discount | Decide & document: GMV = total paid by buyer. Discounts reduce, fee included? Must match seller's expectation of "sales" | P1 |
| OVR-REV-007 | Booking token orders | `bookingAmount`, `balanceAmount` | order token ₹500 of ₹2000 | revenue counts ₹2000 (order value), not token only; Earned only when DELIVERED | P1 |
| OVR-GRW-001 | Growth normal | F5 prev 1000/cur 1500 | `+50.0%` | P0 |
| OVR-GRW-002 | Prev 0, cur >0 | F5 | shows `100.0` — verify UI shows **"New"** not misleading +100% (R-04) | P1 |
| OVR-GRW-003 | Cur 0, prev >0 | F5 | `-100.0%`, red/down arrow | P0 |
| OVR-GRW-004 | Both 0 | F5 | `0.0%` neutral, not green up | P1 |
| OVR-GRW-005 | Prev window equals current length | compare `prevPeriodStart` | For 7D: prev = 7 IST days before `since`. **Code uses `now − since`, giving ≠ 7 days** (R-05). Oracle must use exact equal window | P0 |
| OVR-GRW-006 | Sign/arrow/color | up/down/zero | icon & color match sign; `-0.0` never shown | P1 |
| OVR-GRW-007 | Growth label | "vs previous N days" visible | text states comparison window | P1 |
| OVR-ORD-001 | Total orders | `ordersCount` | F2 | 4 (not 6) | P0 |
| OVR-ORD-002 | Orders vs Orders page | seller orders list filtered same dates, same statuses | equal | P0 |
| OVR-AOV-001 | AOV | Revenue ÷ Orders, rounded | F2 | 1700/4 = ₹425 | P0 |
| OVR-AOV-002 | AOV with 0 orders | F0 | `₹0`, no NaN | P0 |
| OVR-AOV-003 | AOV rounding | rev 1000 / 3 | ₹333 (round, not floor) consistent across tabs | P2 |

## 2.2 KPI tiles: Impressions, Total Clicks, Store CTR, Ad ROAS
| ID | Parameter | Source | Test | Pass | Sev |
|----|-----------|--------|------|------|-----|
| OVR-IMP-001 | Impressions | `totalImpressions` = shop `views` + ad impressions | F6 + ShopAnalytics views 100 | oracle = views + Σ ad impr. Verify it matches definition shown in the `reach` tooltip | P0 |
| OVR-IMP-002 | Include productImpressions? | backend omits `productImpressions` here but includes in funnel reach | F10 | Same concept ("reach") must have same number in tile & funnel top (R-06) | P1 |
| OVR-IMP-003 | "Discovery Rate" sub-label | UI text | n/a | Meaning explained; no fabricated % | P1 |
| OVR-CLK-001 | Total clicks | `totalClicks` = **ad clicks only** | F6 | Label says "Total Clicks" yet excludes organic clicks (R-07). Either rename "Ad Clicks" or add organic | P0 |
| OVR-CTR-001 | Store CTR | `ctr` = ad clicks ÷ ad impressions | F6: 100/2000 | 5.00% | P0 |
| OVR-CTR-002 | Mislabel | called "Store CTR" but is Ad CTR (R-07) | | label = "Ad CTR" or compute store-level | P0 |
| OVR-CTR-003 | clicks>impressions | seed clk 50 impr 10 | | ≤100%, equals 100.00 (safe clamp), no >100 | P1 |
| OVR-CTR-004 | clicks=0 | | `0.00%` | P1 |
| OVR-CTR-005 | UI guard | `overallCtr` only if clicks>0 && impr>0 | | consistent with API | P2 |
| OVR-ROAS-001 | Ad ROAS value | UI uses `analytics.roas` = **total revenue ÷ ad spend (blended)** | F7 spend 500, total ₹6,000, attributed ₹2,000 | Tile titled "Ad ROAS" must be **attributed ÷ spend = 4.00x**, not 12.00x (R-02) | P0 |
| OVR-ROAS-002 | No spend | spend 0 | `0.00x` (or "—" with "No ad spend") never `∞` | P1 |
| OVR-ROAS-003 | Spend but no sales | spend 500, attributed 0 | `0.00x` red/neutral + tip | P1 |
| OVR-ROAS-004 | Tooltip definitions | tap each tile | `MetricInfoModal`/tooltip text matches actual formula (`constants/metricDefinitions.ts`) | P1 |

## 2.3 Revenue Realization Breakdown
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-RB-001 | Earned (Delivered) ₹ & count | F2 | ₹1,200 / 2 orders | P0 |
| OVR-RB-002 | In Pipeline | F2 | ₹500 / 2 active | P0 |
| OVR-RB-003 | Lost to Cancel | F2 | ₹1,300 / 2 lost | P0 |
| OVR-RB-004 | Sum identity | Earned+Pipeline = totalRevenue; +Lost = gross placed | F2 | 1200+500 = 1700 ✔ ; 1700+1300 = 3000 | P0 |
| OVR-RB-005 | Cancellation rate | F2 | 2/6 = 33.3% | P0 |
| OVR-RB-006 | Other statuses | statuses not in any list (e.g. RETURN_REQUESTED, RETURNED, PARTIALLY_DELIVERED if exist in enum) | They must land in a bucket; Earned+Pipeline+Lost count == total orders in window (R-08) | P0 |
| OVR-RB-007 | Bar proportions | widths | proportional to ₹, sum 100%, min-width for tiny | P2 |
| OVR-RB-008 | Zero total | F0 | section hidden or "No orders yet" | P1 |
| OVR-RB-009 | Returns after delivery | order DELIVERED then return approved | Earned reduces or Lost increases; no double count | P0 |

## 2.4 Showroom & Walk-in Leads
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-LD-001 | Directions / WhatsApp / Calls | trigger each from buyer app once | each +1 in `ShopAnalytics` day row, shows after refresh | P1 |
| OVR-LD-002 | Total leads | sum of three | = calls+whatsapp+directions | P0 |
| OVR-LD-003 | Period scoped | F4-like 100 days of leads | follows period filter | P1 |
| OVR-LD-004 | Dedup / abuse | same buyer taps 20× in 1 min | rate limited or unique-per-day; document | P1 |
| OVR-LD-005 | Zero | F0 | `0 Total Leads` | P2 |
| OVR-LD-006 | IST day bucket | tap at 23:59 vs 00:01 IST | lands in correct IST day | P1 |

## 2.5 Sales Attribution & ROAS
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-AT-001 | Organic orders/revenue | F7 | 4 orders, Σ totals | P0 |
| OVR-AT-002 | Promoted orders/revenue | F7 | 2 orders, Σ totals | P0 |
| OVR-AT-003 | organic+promoted = total | | equals `totalRevenue` & `ordersCount` | P0 |
| OVR-AT-004 | Promoted ROAS | F7 | attributed ÷ 500 | P0 |
| OVR-AT-005 | Blended ROAS badge | | = total revenue ÷ spend; badge labeled "Blended" with tooltip | P1 |
| OVR-AT-006 | Percent shown | organic % | `Math.round(organicRev/total*100)`; organic%+promoted% = 100 (no 99/101) | P1 |
| OVR-AT-007 | Attribution trust | client-sent `campaignId` | cannot attribute a campaign belonging to another shop/product (security fix at order.service) — try forged id | P0 |
| OVR-AT-008 | Cancelled promoted order | | removed from promoted revenue | P0 |
| OVR-AT-009 | Spend window | spend counted only inside period | rollup date filter | P0 |
| OVR-AT-010 | Fallback spend | rollup empty → falls back to campaign lifetime summary (R-01) | numbers must not silently become lifetime when period=7D | P0 |

## 2.6 Abandoned Carts Alert
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-AC-001 | Count | 3 shoppers with 5 CartItem rows | `count` counts **shoppers** per copy "N shoppers" — API counts cart **rows** (R-10) | P1 |
| OVR-AC-002 | Value | Σ qty×price | oracle | P0 |
| OVR-AC-003 | Hide at zero | no carts | alert hidden | P2 |
| OVR-AC-004 | Stale carts | cart rows 90 days old | "abandoned" should have an age rule (e.g. >1h and <30d) — document | P1 |
| OVR-AC-005 | Ordered items | user ordered the item after carting | row removed / excluded | P0 |
| OVR-AC-006 | Price changes | product price changed | uses current price; note | P2 |
| OVR-AC-007 | Not period-scoped | change period | value unchanged; label says "right now" | P1 |

## 2.7 Revenue Velocity (Daily) chart — trailing 7 days
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-VEL-001 | 7 bars, oldest→today | F4 | 7 values each ₹100, last = today | P0 |
| OVR-VEL-002 | Bar labels (dates) | `getDayLabel` uses **browser local date** | device tz ≠ IST (set browser tz to UTC / America) | labels still equal IST days of data (R-11) | P1 |
| OVR-VEL-003 | Independent of period | change period | chart unchanged and titled "Last 7 days" | P1 |
| OVR-VEL-004 | tz boundary | F3 | order at 23:59:59 IST goes to that day; 00:00:00 IST goes to next | P0 |
| OVR-VEL-005 | Peak Day | highest bar | correct index/label; ties choose first or latest, deterministic | P1 |
| OVR-VEL-006 | All zero | | "No order velocity in trailing 7 days"; no div-by-zero bar heights | P1 |
| OVR-VEL-007 | Total shown | Σ weekly | equals Σ of the 7 oracle rows, not the period revenue | P1 |
| OVR-VEL-008 | Cancelled excluded | F2 | cancelled/refunded not in bars | P0 |
| OVR-VEL-009 | weeklyViews | `weeklyViews` sums ShopAnalytics views **plus** ad rollup views | possible double count (R-12). Seed one view event; expect +1 not +2 | P1 |
| OVR-VEL-010 | Big spike scale | one day ₹1,00,000 others ₹0 | other bars visible min height, spike capped | P2 |

## 2.8 Store Conversion Funnel
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-FN-001 | 4 stages order | labels | Shop Views, Product Views, Add to Cart, Orders Placed | P2 |
| OVR-FN-002 | Monotonic | F10 | v0 ≥ v1 ≥ v2 ≥ v3 always; if raw data violates, document which is clamped | P0 |
| OVR-FN-003 | Orders stage | = `ordersCount` | exact | P0 |
| OVR-FN-004 | Add to Cart | = max(cartAdds, current active cart rows, order items count, orders) — inflates with **orderItem count** and **current cart snapshot** (R-13) | F10 cartAdds=10: expect 10 (event-based), not max() of unrelated counters | P0 |
| OVR-FN-005 | Product Views | detail views in period | F10 → 40 (clamped ≥ orders) | P1 |
| OVR-FN-006 | Shop Views | reach | tooltip explains composition | P1 |
| OVR-FN-007 | Overall conv rate | `orders / stage0` UI uses funnel[3]/funnel[0] (2dp) vs API `conversionRate` | UI = API for same inputs | P1 |
| OVR-FN-008 | "Top 5% Local Stores" caption | hard-coded text | **Unverifiable claim** — remove or compute vs real benchmark (R-15) | P0 |
| OVR-FN-009 | Bar widths | relative to max, ≥ visible width | P2 |
| OVR-FN-010 | Drop-off % between stages | if shown, = 1 − next/prev | P1 |
| OVR-FN-011 | Zero | F0 | all 0, no NaN width | P1 |

## 2.9 Traffic Origin Mix
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-TR-001 | Organic vs Promoted % | views 80, ad impr 20 | 80% / 20% | P0 |
| OVR-TR-002 | Sum 100 | any | exactly 100 | P1 |
| OVR-TR-003 | Hide 0% segment | ad impr 0 | only Organic 100% | P2 |
| OVR-TR-004 | Mixes views with impressions | different units (R-06) | label clarifies "Reach by source" | P1 |
| OVR-TR-005 | None | F0 | section hidden / empty copy | P2 |

## 2.10 Additional API fields not rendered (verify even if no UI)
`activeProductsCount`, `conversionRate`, `previousOrdersCount`, `fulfillmentSla`, `customerRetention`, `missedOosViews`.
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| OVR-X-001 | activeProductsCount | counts `inStock:true` (not `isActive`) — name says active | align naming/logic | P1 |
| OVR-X-002 | fulfillmentSla | avg PLACED→CONFIRMED minutes, last ≤250 orders in window | F: 10m,20m,30m → 20, "Standard" | P1 |
| OVR-X-003 | SLA thresholds | ≤15 fast, ≤45 moderate, >45 slow | boundary 15/16/45/46 | P2 |
| OVR-X-004 | customerRetention | all-time unique/ repeat buyers, ignoring period (R-09) | label/scope | P1 |
| OVR-X-005 | missedOosViews | **today only** Redis hash | shown labeled "today" | P1 |
