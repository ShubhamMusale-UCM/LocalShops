# Seller Stats Page — Agent Test Suite

> **Why this exists:** Stats is the most trust-critical screen in the seller app. A seller in a tier-2/3 city makes
> stocking, pricing and ad-spend decisions from these numbers. A wrong number is worse than no number.
> This suite tells an AI agent *exactly* how to prove each number is right, and what to do when it is not.

**Screen under test:** `temp_github_repo/src/screens/seller/SellerAnalyticsScreen.tsx` (Performance & Stats)
**Endpoint:** `GET /api/shops/:id/analytics?days=N` → `shopService.getShopAnalytics` (`CityLocalShop/server/src/modules/shop/shop.service.ts`)
**Campaign data:** `adsService.getShopPromotionAnalytics` (`server/src/modules/ads/ads.service.ts`)

## Files (run in this order)

| # | File | Scope |
|---|------|-------|
| 00 | [00_oracle_and_fixtures.md](00_oracle_and_fixtures.md) | Ground-truth formulas, deterministic seed data, SQL oracle, how to call API/UI |
| 01 | [01_global_controls.md](01_global_controls.md) | Period pills, Custom days, section tabs, refresh/Synced, cache, realtime, auth, empty/error states |
| 02 | [02_overview.md](02_overview.md) | Every card/chart on the Overview tab |
| 03 | [03_products.md](03_products.md) | Products tab: search, sort, per-product metrics |
| 04 | [04_campaigns.md](04_campaigns.md) | Campaigns tab: summary strip, campaign card, pause/resume |
| 05 | [05_keywords.md](05_keywords.md) | Keywords tab: summary, gaps, filters, sort |
| 06 | [06_cross_section_consistency.md](06_cross_section_consistency.md) | Same metric must match everywhere; invariants |
| 07 | [07_known_risks.md](07_known_risks.md) | Suspected defects found by code review — **start fixes here** |
| 08 | [08_ui_ux_trust_checks.md](08_ui_ux_trust_checks.md) | Labels, units, formatting, a11y, low-literacy clarity, theme/viewport |

## Agent Protocol (mandatory loop)

```
for each test case:
  1. SEED   – load the fixture named in the case (00_oracle).
  2. ORACLE – compute expected value independently (SQL / script), NOT by reading the app's own code path.
  3. ACT    – read API JSON; then read the rendered UI (browser subagent / screenshot / DOM text).
  4. COMPARE– API == oracle, and UI text == formatted API value.
  5. VERDICT– PASS | FAIL | BLOCKED. Record in results/<date>_run.md with evidence (values seen).
  6. ON FAIL– classify (see below) → fix smallest root cause → re-run that case + the whole file + 06 → commit.
```

### Failure classification
| Class | Meaning | Action |
|-------|---------|--------|
| **WRONG** | Number is mathematically wrong vs oracle | Fix backend formula (P0) |
| **MISLEADING** | Number right but label/scope lies (e.g. lifetime shown as "30D") | Fix label or scope (P0/P1) |
| **INCONSISTENT** | Same metric differs between sections | Single source of truth (P1) |
| **FRAGILE** | Breaks on edge input (0, null, huge, tz boundary) | Guard + test (P1) |
| **COSMETIC** | Format/alignment only | P2 |

### Severity
- **P0** – money / orders / ROAS / growth % wrong or mislabeled. Block release.
- **P1** – funnel, CTR, counts, filters wrong; stale data without indicator.
- **P2** – formatting, ordering ties, copy.

### Rules for the agent
1. **Never "fix" the test to match the app.** Only change expected values if the *oracle formula* in 00 is proven wrong, and say why.
2. Money is compared **to the paisa** (±0.01). Percentages to **2 dp as the API emits**, UI may round — document rounding rule.
3. Every fix needs a regression assertion (jest in `server/tests/` or a script in `test/seller/stats/scripts/`).
4. After any backend change: `npm --prefix server run build`, flush analytics cache (`shop:<id>:analytics*`), re-run suite.
5. After any frontend change: `npm --prefix temp_github_repo run build` and re-verify in browser at 360px width, light + dark.
6. Frontend target is `temp_github_repo/` only. Never touch `CityLocalShop/apps/mobile`.
7. Payment settlement flow (SEL step 5) is out of scope.

## Result log
Create `test/seller/stats/results/YYYY-MM-DD_run.md` with a table: `ID | verdict | expected | api | ui | note`.
