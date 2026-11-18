# 07 — Known Risks (found by code review, 2026-11-19)

These are **hypotheses from reading the code**. The agent must first *reproduce* each with a fixture (write failing test), then fix, then re-run. Mark status in the table when done.

| ID | Sev | Class | Finding | Where | Fix direction | Status |
|----|-----|-------|---------|-------|---------------|--------|
| R-01 | P0 | MISLEADING | Campaign list/summary is **lifetime** (`getShopPromotionAnalytics(shopId)` has no window) while ad totals on Overview are period-scoped; also rollup-empty fallback silently swaps to lifetime campaign totals | shop.service `campaignsData`, L1353-1364 | Pass `since` into ads analytics (aggregate `AdDailyMetricRollup` in window) or label Campaigns tab "All-time"; remove silent fallback or flag `isLifetimeFallback` | open |
| R-02 | P0 | WRONG/MISLEADING | `roas = totalRevenue ÷ adSpend` (all orders incl. organic) shown as "Ad ROAS" and "Overall ROAS" → overstated | `safeRoas` L1432; UI `analytics.roas` | Expose `promotedRoas` as `roas`; keep blended only as clearly labeled secondary | open |
| R-03 | P0 | MISLEADING | Hero says "Verified showroom sales" but revenue includes unpaid/undelivered pipeline orders | UI L490 | Rename "Order value (placed)"; show Earned prominently | open |
| R-04 | P1 | MISLEADING | Growth shows `100.0` when prev=0 (new shop) | L1345-1349 | return `null` + UI "New" | open |
| R-05 | P0 | WRONG | Previous-period length = `max(1d, now − since)` ≈ (days−1)+fraction, not `days`; growth compares unequal windows. `prevPeriodStart = since − thatLength` | L1108-1109 | `prevSince = since − days·24h`, `prevUntil = since` | open |
| R-06 | P1 | INCONSISTENT | "Impressions" tile = shop views + ad impressions; funnel reach also adds `productImpressions`; traffic mix mixes views and impressions | L1368, L1448, L1387 | One definition `reach`; document; reuse variable | open |
| R-07 | P0 | MISLEADING | "Total Clicks" & "Store CTR" are **ad-only**; product `clicks` = adClicks while product CTR uses views+adClicks | L1449-1450, L1069-1099 | Rename to "Ad clicks / Ad CTR" or compute store-level from events | open |
| R-08 | P0 | WRONG | Statuses outside the 3 lists (e.g. returns, partial) vanish from breakdown, so Earned+Pipeline+Lost ≠ orders | L1245-1258 | `default` bucket + test against Prisma enum `OrderStatus` | open |
| R-09 | P1 | MISLEADING | `customerRetention` is all-time, ignores period; `abandonedCarts` is a snapshot; `missedOosViews` is today only | L1183-1193, L1136, L1194 | Label scope or window them | open |
| R-10 | P1 | WRONG | Abandoned "count" = CartItem rows but UI copy says "N shoppers" | L1136-1142, L1231 | `COUNT(DISTINCT ci."userId")` | open |
| R-11 | P1 | FRAGILE | `getDayLabel` uses browser-local date; data buckets are IST → label/day mismatch outside IST or near midnight | UI L366 | Derive labels from server (`weeklyLabels`) or format with `timeZone:'Asia/Kolkata'` | open |
| R-12 | P1 | WRONG? | `weeklyViews` adds `ShopAnalytics.views` **and** ad rollup views/impressions per day — possible double count | L964-980 | Confirm event model; sum once | open |
| R-13 | P0 | WRONG | `periodCartAdds = max(cartAdds, activeCartCount, cartCount(orderItems), orders)` – mixes unrelated counters, inflating funnel | L1377 | Use only event-based `totals.cartAdds`, then clamp to ≥ orders for monotonicity | open |
| R-14 | P1 | FRAGILE | `days` unvalidated: NaN→30, negative/huge accepted; cache keyed per value | shop.controller L131 | clamp 1–365, zod validate | open |
| R-15 | P0 | MISLEADING | Hard-coded "Top 5% Local Stores" caption on funnel | UI L773 | Remove or compute from real peer benchmark | open |
| R-16 | P0 | MISLEADING | Products tab "N Active Items" = length of top-20 array | UI ~L842 | show `activeProductsCount` + "Showing top 20" | open |
| R-17 | P0 | WRONG | Top products chosen by **lifetime** `orderCount/viewCount` then period metrics attached → products hot in period can be missing | L983-991 | Rank by period `orderItem` aggregate (groupBy first, then fetch top N) | open |
| R-18 | P1 | MISLEADING | Placeholder "SKU or name", filter by name/category only | UI L837 / L262 | add `sku` to payload and filter | open |
| R-19 | P1 | WRONG | Views sort falls back to lifetime `viewCount` when period views are 0 | UI L267 | use `periodViews` only | open |
| R-20 | P1 | MISLEADING | Units shows `orderCount "total"` fallback when period units=0 | UI L934 | show `0` for period; lifetime separately | open |
| R-21 | P0 | MISLEADING | "Active Ad Spend" sums all campaigns incl. ended | UI ~L1004 | filter `state==='LIVE'` or rename | open |
| R-22 | P0 | MISLEADING | Hard-coded demo title fallback `Weekend Curbside Handover 10%` | UI CampaignCard | neutral fallback | open |
| R-23 | P0 | WRONG | Paused campaigns shown as "Completed" (`state` only LIVE/HISTORY) | ads.service `state`, UI `statusLabel` | add `PAUSED`/`ENDED`/`OUT_OF_BUDGET` states | open |
| R-24 | P1 | INCONSISTENT | Keyword summary computed from filtered list | UI L361-363 | compute from `allKeywords` or label | open |
| R-25 | P0 | MISLEADING | Keywords silently fall back to all-time if period empty | L1402-1417 | return `{scope:'all_time'}` and show banner | open |
| R-26 | P2 | COSMETIC | Keyword CTR 2 dp from API vs 1 dp computed in UI | UI L1264 | one formatter | open |
| R-27 | P1 | FRAGILE | `fmt()` K/M rounding: 999,950 → `1000.0K` | UI `fmt` | switch unit when rounded ≥1000 | open |
| R-28 | P0 | MISLEADING | "Synced" button label static; failed fetch only `console.error` — user sees stale data as live | UI L395, L188 | error banner, last-updated timestamp | open |
| R-29 | P1 | FRAGILE | Client sorts keywords/products by `parseFloat(ctr)`; backend sorts nothing; payload strings vs numbers differ (`ctr` string in some, number in campaigns) | mixed | numeric everywhere | open |
| R-30 | P1 | FRAGILE | `orderStatusGroups` and revenue use `createdAt` of order, "Earned" should arguably use delivered date — a delivery next month counts in order month | L1152-1160 | decide & document (cash vs accrual) | open |
| R-31 | P1 | FRAGILE | SLA sample = last 250 orders, `statusHistory` JSON parsing; malformed rows ignored | L1171-1181 | validate + test | open |
| R-32 | P2 | FRAGILE | Cache 60s while UI says "Real-time" | L1490 | invalidate on order/ad events | open |

## Fix workflow per risk
1. Add failing assertion (jest in `server/tests/analytics/*.test.ts` or `test/seller/stats/scripts/`).
2. Smallest root-cause fix (backend first; frontend only for label/format).
3. `npm --prefix server run build`; `npm --prefix temp_github_repo run build`.
4. Re-run full suite 01–06 → update Status column + results file.
5. Commit per risk: `fix(stats): R-02 attribute ROAS to promoted revenue only`.
