# 01 — Global Controls

Applies to every tab. Source: `SellerAnalyticsScreen.tsx` lines ~143-236, 401-470.

Columns: **ID | Check | Steps | Expected | Sev**

## 1.1 Period filter (7D / 30D / 90D / Custom)
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-PER-001 | Default is 30D | Fresh login → Stats | 30D pill active; request `?days=30` | P1 |
| G-PER-002 | 7D window math | F4, tap 7D | API/Orders = exactly 7 IST days incl. today (₹700, 7 orders). Compare to oracle | P0 |
| G-PER-003 | 30D window | F4, 30D | ₹3,000 / 30 orders | P0 |
| G-PER-004 | 90D window | F4, 90D | ₹9,000 / 90 orders | P0 |
| G-PER-005 | Custom 1 day | Custom=1 | only today's IST orders; `since=todayStart` | P0 |
| G-PER-006 | Custom 45 | Custom=45 | ₹4,500 / 45 orders | P0 |
| G-PER-007 | Custom empty/0/neg | clear input, type 0, -5, abc | falls back to ≥1 (UI) and API never receives NaN/0/neg; no crash | P1 |
| G-PER-008 | Custom huge | 99999 | API caps or handles (no 500, no 30s query). Expect cap (suggest ≤365) and UI tells user | P1 |
| G-PER-009 | Custom decimal | 7.5 | integer coerced; documented | P2 |
| G-PER-010 | Switch while loading | tap 7D→90D→7D quickly | final render matches final selection; no stale overwrite (ignoreFlag works) | P0 |
| G-PER-011 | Label honesty | every card title mentioning `(30D)` | title tracks selected period; "Custom" shows actual days | P1 |
| G-PER-012 | Pills reflect scope | Switch period | **Every** section number that claims to be period-based changes; list sections that do NOT (see R-01, R-09) and verify they are labeled "All-time"/"Today"/"Last 7 days" | P0 |
| G-PER-013 | Persistence | change period → switch tab → return | selection retained within session | P2 |
| G-PER-014 | API param validation | `?days=abc`, `0`, `-3`, `1e9`, missing | 200 with default or 400; never 500 | P1 |

## 1.2 Section tabs (Overview / Products / Campaigns / Keywords)
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-TAB-001 | Tab labels vs content | tap each | content matches label; active style correct | P2 |
| G-TAB-002 | No refetch storm | switch tabs 10× | 0 extra analytics requests (data shared) | P1 |
| G-TAB-003 | Scroll reset | scroll down, switch tab | new tab starts at top | P2 |
| G-TAB-004 | 4 tabs fit at 360px | UI | Overview, Products, Campaigns, Keywords all reachable (horizontal scroll ok), active underline correct | P1 |
| G-TAB-005 | Filters persist per tab | set product sort → other tab → back | defined behavior, no crash | P2 |

## 1.3 Refresh / "Synced" indicator
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-SYN-001 | Manual refresh | tap Synced | spinner; new request; values update | P1 |
| G-SYN-002 | Truthful status | stop backend, tap refresh | indicator must NOT claim "Synced"; show "Offline/Last updated hh:mm" | P0 |
| G-SYN-003 | Last-updated time | after load | shows real timestamp of data | P1 |
| G-SYN-004 | Double tap | tap twice quickly | one in-flight request (no duplicate/race) | P2 |

## 1.4 Cache & freshness
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-CAC-001 | Server cache TTL 60s | place order → fetch twice within 60s | first may be stale ≤60s; document; refresh after TTL correct | P1 |
| G-CAC-002 | Cache invalidation on order | create/cancel/deliver order | `shop:<id>:analytics*` cleared OR UI event `cls_orders_updated` triggers refetch that bypasses cache | P0 |
| G-CAC-003 | Cache key per period | 7D then 30D | different values, no cross-contamination | P0 |
| G-CAC-004 | Cache key explosion | request days=1..400 | bounded keys or capped days | P2 |
| G-CAC-005 | Client cache `dataCache` | reload app offline | shows last data **with "stale" marker** | P1 |
| G-CAC-006 | Shop switch | seller with 2 shops, switch | data swaps to new shop; no flash of old shop numbers | P0 |

## 1.5 Realtime
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-RT-001 | Order placed → stats | buyer places order while stats open | revenue/orders update ≤5s (socket `cls_orders_updated`) | P1 |
| G-RT-002 | Ad event → stats | impression/click | `shop:ad-analytics-updated` triggers refresh | P1 |
| G-RT-003 | Listener cleanup | leave & re-enter 20× | one listener only (no N× fetches) | P1 |
| G-RT-004 | Hidden tab | tabClass hidden | no fetch while hidden (code returns early) — verify returns when visible | P2 |

## 1.6 Auth & isolation
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-SEC-001 | No token | call API | 401 | P0 |
| G-SEC-002 | Buyer token | BUYER role | 403 | P0 |
| G-SEC-003 | Other seller's shop id | A token, B shop (F12) | 403, zero data leaked | P0 |
| G-SEC-004 | Nonexistent shop | random uuid | 404 | P1 |
| G-SEC-005 | Staff roles | MANAGER/COUNTER member of shop (SEL-10) | defined access: today API checks `ownerId` only → staff blocked; confirm product decision | P1 |
| G-SEC-006 | Response has no PII | inspect JSON | no phone/email of buyers | P0 |

## 1.7 Loading / empty / error
| ID | Check | Steps | Expected | Sev |
|----|-------|-------|----------|-----|
| G-STA-001 | Skeleton | throttle network | skeleton, not zeros-as-data | P1 |
| G-STA-002 | Empty shop F0 | open stats | every card shows 0 / "No data yet" copy that guides next step (e.g. "Add products") ; no NaN/Infinity/undefined | P0 |
| G-STA-003 | API 500 | force 500 | visible error + retry; not silent zeros | P0 |
| G-STA-004 | Timeout | 30s delay | timeout message | P1 |
| G-STA-005 | Partial data | API missing `revenueBreakdown` etc. | sections hide gracefully, no white screen | P1 |
| G-STA-006 | No active shop | activeShopId null | prompt to create/select shop | P1 |
