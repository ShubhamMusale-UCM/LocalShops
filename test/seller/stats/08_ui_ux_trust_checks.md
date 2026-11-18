# 08 — UI / UX / Trust Checks

Audience: shopkeepers in tier-2/3 cities — low analytics literacy, small phones, patchy network, often regional language.
**Principle:** a number is trusted only if (a) correct, (b) clearly named, (c) clearly dated, (d) understandable in 3 seconds.

## 8.1 Plain-language & meaning
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-LNG-001 | Jargon list (ROAS, CTR, AOV, GMV, CPA, Impressions, Funnel, Telemetry) | Each has a one-line plain explanation in tooltip/modal (`MetricInfoModal`) with a rupee example ("₹4 earned for every ₹1 spent") | P1 |
| UX-LNG-002 | Every card says **what period** | "Last 30 days", "Today", "All-time", "Right now" visible | P0 |
| UX-LNG-003 | Every % and ratio has direction cue | green/red + arrow + words (not color only) | P1 |
| UX-LNG-004 | Actionable next step | when metric weak (cancel rate high, SLA slow, abandoned carts, zero-click keywords) a one-tap suggestion | P2 |
| UX-LNG-005 | i18n readiness | strings extractable; numbers use `en-IN`; no hard-coded concatenation that breaks Hindi grammar | P2 |
| UX-LNG-006 | No unverifiable claims | no "Top 5% stores", "Verified", "Real-time" unless true | P0 |

## 8.2 Formatting
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-FMT-001 | Currency Indian grouping everywhere (hero, cards, campaigns, products) | ₹1,23,456 | P1 |
| UX-FMT-002 | Compact numbers consistent (`K`/`k`/`M` mix: `fmt` uses `K`, `formatNumber` uses `k`) | single helper | P2 |
| UX-FMT-003 | No NaN/undefined/Infinity/-0 anywhere (grep DOM text) | none | P0 |
| UX-FMT-004 | Dates `en-IN` or localized, IST | consistent | P2 |
| UX-FMT-005 | Mojibake: source shows `â‚¹`, `â€¢`, `â†“`, `â¤ï¸` in some files — verify rendered glyphs and file encoding UTF-8 | all render correctly | P0 |

## 8.3 Layout / device
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-LAY-001 | 320, 360, 390, 412, 768 widths | no horizontal scroll, no clipped text, tap targets ≥44px | P1 |
| UX-LAY-002 | Large font (system 130-200%) | layout holds, key numbers visible | P1 |
| UX-LAY-003 | Dark + light theme | contrast ≥ 4.5:1 for text; hard-coded hexes in `CampaignCard` (`#fff`, `#1a202c`, `#334155`) must respect dark mode | P1 |
| UX-LAY-004 | Safe areas (notch, bottom nav) | last card not hidden by bottom navbar (`pb-28`) | P1 |
| UX-LAY-005 | Card style parity | Apple-iOS card spec used on Manage Products (`rounded-[22px]`, dual shadow); Stats cards consistent | P2 |
| UX-LAY-006 | Long numbers | ₹12,34,56,789 fits hero | P1 |

## 8.4 Performance & network
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-PRF-001 | First paint with cache <300ms; fresh data <2s on 3G throttle | P1 |
| UX-PRF-002 | API p95 < 500ms with F11 scale (index review on `Order(shopId,createdAt)`, rollups) | P1 |
| UX-PRF-003 | No layout jump when data arrives | P2 |
| UX-PRF-004 | Offline: shows cached with "Offline • last updated …" | P0 |
| UX-PRF-005 | Capacitor Android WebView parity (not just desktop Chrome) | P1 |
| UX-PRF-006 | Animations obey `prefers-reduced-motion` | P2 |

## 8.5 Accessibility
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-A11Y-001 | Buttons have accessible names (Synced, period pills, tabs, sort) | P2 |
| UX-A11Y-002 | Charts have text equivalent (peak day, values) | P2 |
| UX-A11Y-003 | Focus order and visible focus ring | P2 |
| UX-A11Y-004 | Tooltips reachable by tap (not hover only) | P1 |

## 8.6 Security / privacy hygiene
| ID | Check | Pass | Sev |
|----|-------|------|-----|
| UX-SEC-001 | Network tab: only own shop data; no tokens in URLs | P0 |
| UX-SEC-002 | XSS: product/keyword names with `<img onerror>` render as text | P0 |
| UX-SEC-003 | Rate limit on analytics endpoint (refresh spam) | P1 |
