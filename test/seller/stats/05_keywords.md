# 05 — Keywords Tab

Screen ~L1036-1290. Backend: `SearchKeywordStat` grouped by keyword, `take: 25`, window = period (falls back to **all-time** if empty).

## 5.1 Summary strip (Total Searches / Search Clicks / Avg CTR)
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| KWD-SUM-001 | Total Searches | F9 | Σ searches of the **currently filtered** list (code sums `keywords`, the filtered array) — decide: summary should reflect all or filtered; label must say which (R-24) | P1 |
| KWD-SUM-002 | Search Clicks | | Σ clicks, same scope as above | P1 |
| KWD-SUM-003 | Avg CTR | Σclicks ÷ Σsearches ×100, 1 dp | 3/17 = 17.6% (weighted), **not** mean of row CTRs | P0 |
| KWD-SUM-004 | Zero searches | F0 | `0`, `0`, `0.0%` | P1 |
| KWD-SUM-005 | Cap of 25 | F9(g) 30 keywords | summary says "top 25" or sums all 30 from backend aggregate | P0 |
| KWD-SUM-006 | Period scope | switch period | changes; fallback to all-time must be disclosed (R-25) | P0 |

## 5.2 High-Demand Search Gaps
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| KWD-GAP-001 | Definition | `clicks===0 && searches>=2` | F9: (b) 5/0 and (c) 2/0 listed, (d) 1/0 not | P0 |
| KWD-GAP-002 | Ordering | by searches desc | (b) before (c) | P1 |
| KWD-GAP-003 | Max 8 shown + "see all" | 12 gaps | shows 8, count of total visible | P2 |
| KWD-GAP-004 | Computed on capped 25 | gap keyword outside top-25 by searches | cannot appear; acceptable? document | P2 |
| KWD-GAP-005 | Action hint | tap gap | suggests "Add product with this keyword" or copy; no dead tap | P2 |
| KWD-GAP-006 | None | no gaps | section hidden | P2 |
| KWD-GAP-007 | Meaning for low-literacy sellers | text simple (Hindi/regional-ready) | no jargon | P1 |

## 5.3 Search box
| ID | Test | Pass | Sev |
|----|------|------|-----|
| KWD-SRC-001 | substring, case-insens | `shirt` matches `Shirt` | P1 |
| KWD-SRC-002 | Clear (X) button | resets query | P2 |
| KWD-SRC-003 | no match | "No Keywords Found" + Reset Filters | P1 |
| KWD-SRC-004 | Unicode / Devanagari | `कुर्ता` matches | P1 |
| KWD-SRC-005 | Case duplicates | `Shirt` and `shirt` stored separately → duplicates in list (F9 f) | backend normalizes lowercase+trim on write/aggregate | P1 |

## 5.4 Quick filters (All / With Clicks / Zero Clicks / High Volume)
| ID | Test | Pass | Sev |
|----|------|------|-----|
| KWD-FLT-001 | Count badges equal filtered lengths | tap each: badge N == rows shown | P0 |
| KWD-FLT-002 | With Clicks | clicks>0 | P1 |
| KWD-FLT-003 | Zero Clicks | clicks===0 (includes searches 0/1) | P1 |
| KWD-FLT-004 | High Volume | searches ≥ 2 — threshold hard-coded; fine for small shops but document | P2 |
| KWD-FLT-005 | Filter + search + sort | combined correct | P1 |
| KWD-FLT-006 | Reset restores defaults (all, searches_desc, empty) | P1 |
| KWD-FLT-007 | Filter badge counts ignore search text | documented | P2 |

## 5.5 Sort (Most Searched / Most Clicked / Highest CTR / Lowest CTR / A–Z)
| ID | Test | Pass | Sev |
|----|------|------|-----|
| KWD-SRT-001 | each sort ordering with F9 | matches oracle incl. tie-breakers (see code `localeCompare`) | P1 |
| KWD-SRT-002 | CTR string parsing | `"10.00"` > `"9.50"` | P0 |
| KWD-SRT-003 | Lowest CTR (Gaps) | zero-CTR high-search first | P1 |
| KWD-SRT-004 | A–Z with unicode | locale stable | P2 |
| KWD-SRT-005 | Sheet open/close | outside click closes; selected shows check; focus returns | P2 |
| KWD-SRT-006 | Reset when filtered | `isKeywordFiltered` true when sort≠default | P2 |

## 5.6 Keyword row
| ID | Parameter | Test | Pass | Sev |
|----|-----------|------|------|-----|
| KWD-ROW-001 | Searches | = Σ stat rows in window | P0 |
| KWD-ROW-002 | Clicks | ≤ searches (clicks can't exceed searches) — if raw data violates, clamp/flag | P1 |
| KWD-ROW-003 | CTR | clicks/searches ×100, 2 dp from API; UI prints `kw.ctr` else computed 1 dp → **two precisions** (R-26) | consistent | P2 |
| KWD-ROW-004 | Long keyword | wraps/truncates | P2 |
| KWD-ROW-005 | Privacy | keywords contain no buyer identity | P0 |
| KWD-ROW-006 | Search recording | do a buyer search → keyword +1 searches; click product → +1 clicks, once per click (no double count on re-render) | P0 |
| KWD-ROW-007 | Shop attribution | keyword counted for shops whose products matched, not every shop | P1 |
| KWD-ROW-008 | Abuse | bot repeating search 1000× | rate limit / per-user per-day cap | P1 |
