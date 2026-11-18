# 03 — Products Tab

Screen lines ~828-996. Backend: `topProducts` in `getShopAnalytics` (take 20 by lifetime `orderCount` then `viewCount`).

## 3.1 List scope & header
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| PRD-LST-001 | "N Active Items" count | F8 (25 products) | Count must equal products listed **and** match catalog active count; code shows only top-20 length labeled "Active Items" (R-16). Expect "Top 20 of 25" or full list | P0 |
| PRD-LST-002 | Period-relevant ranking | product A: lifetime 500 sales, 0 in window; product B: lifetime 5, 40 in window (F8) | B must appear in a 7D list. Current query ranks by lifetime → B may be dropped (R-17) | P0 |
| PRD-LST-003 | Inactive / deleted products | `isActive=false`, soft-deleted | excluded or labeled; never counted as active | P1 |
| PRD-LST-004 | Zero products | F0 | empty state with "Add product" CTA | P1 |
| PRD-LST-005 | Image fallback | no image / broken URL | placeholder icon, no layout shift | P2 |
| PRD-LST-006 | Rank badge (top 3) | `i<3` | badge reflects **current sort**, not revenue unless sorted by revenue | P1 |
| PRD-LST-007 | Long names | 120 chars, emoji, RTL, `%` `&` `<script>` | truncates, escaped, no overflow at 360px | P1 |
| PRD-LST-008 | Pagination / perf | 500 products | list capped with "show more" or virtualized, <100ms render | P2 |

## 3.2 Search
| ID | Test | Pass | Sev |
|----|------|------|-----|
| PRD-SRC-001 | name substring, case-insens | "shirt" matches "Cotton SHIRT" | P1 |
| PRD-SRC-002 | placeholder says "SKU or name" but code filters **name & category only** (R-18) — search a known SKU | SKU search works, or placeholder fixed | P1 |
| PRD-SRC-003 | whitespace only | no filtering | P2 |
| PRD-SRC-004 | no match | friendly empty state + clear button; count 0 | P1 |
| PRD-SRC-005 | special chars `( [ * \` | no regex crash | P1 |
| PRD-SRC-006 | search + sort combo | sorted within filtered set | P1 |
| PRD-SRC-007 | clear search | restores list & count | P2 |

## 3.3 Sort (GMV, Units, Views, CTR)
| ID | Sort | Test | Pass | Sev |
|----|------|------|------|-----|
| PRD-SRT-001 | GMV ↓ | revenue 900/500/500/0 | order correct, tie stable | P0 |
| PRD-SRT-002 | Units ↓ | | by `units` (period) not `orderCount` | P0 |
| PRD-SRT-003 | Views ↓ | `views || viewCount || impressions` fallback chain: a product with 0 period views falls back to **lifetime** views and sorts above (R-19) | period-only | P1 |
| PRD-SRT-004 | CTR ↓ | `parseFloat(ctr)` | numeric not lexical ("9.50" vs "10.20") | P0 |
| PRD-SRT-005 | Active pill state | tap each | one active; sort label arrow correct | P2 |
| PRD-SRT-006 | Sort changes re-rank badges | | ✔ | P2 |
| PRD-SRT-007 | Null/undefined metrics | missing `ctr` | treated 0, no NaN ordering | P1 |

## 3.4 Per-product metrics (card)
| ID | Parameter | Source | Test | Pass | Sev |
|----|-----------|--------|------|------|-----|
| PRD-MET-001 | GMV / "Item Price" | Σ orderItem.total in window, status ∉ CANCELLED/REFUNDED | F8 | = oracle; zero → shows **Item Price** (label switches, ensure clear) | P0 |
| PRD-MET-002 | Units Sold | Σ quantity in window | | = oracle; if 0 and lifetime>0, UI prints "N total" fallback — ensure wording "lifetime" (R-20) | P0 |
| PRD-MET-003 | Σ products GMV ≤ shop revenue | add all products | cannot exceed `totalRevenue` (item totals vs order total incl. fees/discount: document diff) | P0 |
| PRD-MET-004 | Views | `periodViews` = Σ ProductDailyAnalytics.detailViews | seed 12 | 12 | P1 |
| PRD-MET-005 | Impressions | daily impressions + ad impressions | seed | oracle; no double count of ad impressions already in daily rows | P1 |
| PRD-MET-006 | Click CTR | (periodViews + adClicks) ÷ max(impr, clicks) | F8 | 2 dp; ≤100 | P1 |
| PRD-MET-007 | CTR definition | mixes organic views and ad clicks while `clicks` field returned = adClicks only (R-07) | tooltip states formula | P1 |
| PRD-MET-008 | Wishlist "saved" | `_count.wishlistedBy` (all-time) | add/remove wishlist | live count; not period; label OK | P1 |
| PRD-MET-009 | In-cart count | `_count.cartItems` | add to cart as 2 buyers | 2 | P1 |
| PRD-MET-010 | Stock badge | `inStock` / quantity | qty 0, 3, 50, null | "Out of stock" / "Low" (≤ threshold) / "In stock"; null → "Unlimited"/hidden (not "Low") | P1 |
| PRD-MET-011 | Days of stock left | qty ÷ (units ÷ periodDays) | qty 10, 14 units in 7D → 5 days | `floor`; 0 stock → 0; no sales → null (UI hides, not "Infinity") | P1 |
| PRD-MET-012 | Low-stock threshold | per-product `lowStockThreshold` (SEL-10) | threshold 8, qty 7 | "Low" uses product threshold, not hard-coded 5 | P1 |
| PRD-MET-013 | Currency/number format | `₹`, K/M | big numbers | per 00 §E | P1 |
| PRD-MET-014 | Zero-sales product | | all zeros, no NaN, CTA like "Boost this product" optional | P1 |
| PRD-MET-015 | Product price vs historic | price changed mid-window | GMV uses order-time totals, not current price | P0 |
| PRD-MET-016 | Variants / bundles | if variants exist | rolled to parent consistently | P2 |
| PRD-MET-017 | Cancelled/returned units | cancel after delivery | units & GMV exclude | P0 |
| PRD-MET-018 | Tap card | navigates to product detail/edit with correct id | P2 |

## 3.5 Cross-checks
| ID | Test | Pass |
|----|------|------|
| PRD-XCK-001 | Σ units (all products, not just top 20) = Σ orderItem.qty in window | match |
| PRD-XCK-002 | Top product GMV in Products tab = same product in Manage Products "Orders" & Seller Orders filtering | match |
| PRD-XCK-003 | `views` here vs Manage Products card "Views" | same definition/scope or labeled lifetime vs period |
| PRD-XCK-004 | `Reach`/impressions here vs Manage Products "Reach" | same |
