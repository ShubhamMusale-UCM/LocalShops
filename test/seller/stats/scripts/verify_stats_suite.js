const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../server/.env') });

const { PrismaClient } = require('@prisma/client');
const redis = require(path.resolve(__dirname, '../../../../server/dist/config/redis.js')).default;
const { ShopService } = require(path.resolve(__dirname, '../../../../server/dist/modules/shop/shop.service.js'));

const prisma = new PrismaClient();
const shopService = new ShopService();

const SHOP_ID = 'aeeaa1ce-79ce-4bd7-a842-6e63a8a95086';
const TIME_ZONE = 'Asia/Kolkata';

async function clearShopCache(shopId) {
  const patterns = [`shop:${shopId}:analytics*`, `shop:${shopId}:ads*`, `shop:${shopId}:daily-metrics`];
  for (const p of patterns) {
    const keys = await redis.keys(p);
    if (keys.length > 0) await redis.del(...keys);
  }
}

function approxEq(a, b, tol = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function checkNoBadValues(val, p = 'root') {
  if (val === undefined) throw new Error(`I12 failed: undefined at ${p}`);
  if (typeof val === 'number' && !Number.isFinite(val)) throw new Error(`I12 failed: non-finite number ${val} at ${p}`);
  if (typeof val === 'string' && (val === 'NaN' || val === 'Infinity' || val === '∞' || val === 'undefined')) {
    throw new Error(`I12 failed: bad string "${val}" at ${p}`);
  }
  if (Array.isArray(val)) {
    val.forEach((v, i) => checkNoBadValues(v, `${p}[${i}]`));
  } else if (val && typeof val === 'object' && !(val instanceof Date)) {
    for (const [k, v] of Object.entries(val)) {
      checkNoBadValues(v, `${p}.${k}`);
    }
  }
}

async function computeOracle(shopId, days) {
  const safeDays = Math.min(365, Math.max(1, Math.round(days)));
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
  const todayStart = new Date(`${todayStr}T00:00:00+05:30`);
  const since = safeDays === 1 ? todayStart : new Date(todayStart.getTime() - (safeDays - 1) * 86400000);
  const prevPeriodStart = new Date(since.getTime() - safeDays * 86400000);

  const [revRows] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total), 0)::float AS rev, COUNT(*)::int AS cnt
    FROM "Order"
    WHERE "shopId" = ${shopId}
      AND "createdAt" >= ${since}
      AND status::text NOT IN ('CANCELLED', 'REFUNDED')
  `;

  const [prevRows] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total), 0)::float AS rev, COUNT(*)::int AS cnt
    FROM "Order"
    WHERE "shopId" = ${shopId}
      AND "createdAt" >= ${prevPeriodStart}
      AND "createdAt" < ${since}
      AND status::text NOT IN ('CANCELLED', 'REFUNDED')
  `;

  const statusRows = await prisma.$queryRaw`
    SELECT status::text AS status, COALESCE(SUM(total), 0)::float AS amt, COUNT(*)::int AS cnt
    FROM "Order"
    WHERE "shopId" = ${shopId} AND "createdAt" >= ${since}
    GROUP BY status
  `;

  let earned = 0, earnedCnt = 0, pipeline = 0, pipelineCnt = 0, lost = 0, lostCnt = 0;
  for (const r of statusRows) {
    if (r.status === 'DELIVERED') {
      earned += r.amt;
      earnedCnt += r.cnt;
    } else if (r.status === 'CANCELLED' || r.status === 'REFUNDED') {
      lost += r.amt;
      lostCnt += r.cnt;
    } else {
      pipeline += r.amt;
      pipelineCnt += r.cnt;
    }
  }
  const totalPlaced = earnedCnt + pipelineCnt + lostCnt;
  const cancelRate = totalPlaced > 0 ? Number(((lostCnt / totalPlaced) * 100).toFixed(1)) : 0;

  const attrRows = await prisma.$queryRaw`
    SELECT ("adCampaignId" IS NOT NULL) AS is_promo, COALESCE(SUM(total), 0)::float AS amt, COUNT(*)::int AS cnt
    FROM "Order"
    WHERE "shopId" = ${shopId}
      AND "createdAt" >= ${since}
      AND status::text NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY is_promo
  `;
  let organicRev = 0, organicCnt = 0, promoRev = 0, promoCnt = 0;
  for (const r of attrRows) {
    if (r.is_promo) {
      promoRev += r.amt;
      promoCnt += r.cnt;
    } else {
      organicRev += r.amt;
      organicCnt += r.cnt;
    }
  }

  const [shopAnalyticsSum] = await prisma.$queryRaw`
    SELECT COALESCE(SUM(views), 0)::int AS views,
           COALESCE(SUM("productImpressions"), 0)::int AS prod_impr,
           COALESCE(SUM("productDetailViews"), 0)::int AS prod_views,
           COALESCE(SUM("cartAdds"), 0)::int AS cart_adds,
           COALESCE(SUM(calls), 0)::int AS calls,
           COALESCE(SUM("whatsappClicks"), 0)::int AS wa,
           COALESCE(SUM(directions), 0)::int AS dir
    FROM "ShopAnalytics"
    WHERE "shopId" = ${shopId} AND date >= ${since}::date
  `;
  // Note: Prisma passes Date gte: since directly on @db.Date; verify with same Date param in Prisma:
  const saRecords = await prisma.shopAnalytics.findMany({ where: { shopId, date: { gte: since } } });
  const sa = saRecords.reduce(
    (a, r) => ({
      views: a.views + r.views,
      prodImpr: a.prodImpr + (r.productImpressions || 0),
      prodViews: a.prodViews + (r.productDetailViews || 0),
      cartAdds: a.cartAdds + (r.cartAdds || 0),
      calls: a.calls + r.calls,
      wa: a.wa + r.whatsappClicks,
      dir: a.dir + r.directions,
    }),
    { views: 0, prodImpr: 0, prodViews: 0, cartAdds: 0, calls: 0, wa: 0, dir: 0 }
  );

  const pdaAgg = await prisma.productDailyAnalytics.aggregate({
    where: { shopId, date: { gte: since } },
    _sum: { impressions: true, detailViews: true, cartAdds: true },
  });

  const adRollupAgg = await prisma.adDailyMetricRollup.aggregate({
    where: { promotedListing: { shopId }, date: { gte: since } },
    _sum: { impressions: true, clicks: true, spend: true },
  });
  let adImpr = adRollupAgg._sum.impressions || 0;
  let adClicks = adRollupAgg._sum.clicks || 0;
  let adSpend = adRollupAgg._sum.spend || 0;

  if (adImpr === 0 && adClicks === 0 && adSpend === 0) {
    const inWin = await prisma.promotedListing.findMany({
      where: { shopId, startDate: { gte: since } },
    });
    for (const c of inWin) {
      adImpr += c.impressions || 0;
      adClicks += c.clicks || 0;
      adSpend += c.spent || 0;
    }
  }

  const orgImpr = Math.max(
    sa.views + sa.prodImpr,
    pdaAgg._sum.impressions || 0,
    pdaAgg._sum.detailViews || 0
  );
  const orgClicks = Math.max(sa.prodViews, pdaAgg._sum.detailViews || 0);
  const totalClicks = orgClicks + adClicks;
  const totalImpr = Math.max(orgImpr + adImpr, totalClicks);
  const storeCtr = totalImpr > 0 && totalClicks > 0 ? Math.min(100, (totalClicks / totalImpr) * 100).toFixed(2) : '0.00';
  const promotedRoas = adSpend > 0 ? (promoRev / adSpend).toFixed(2) : '0.00';
  const blendedRoas = adSpend > 0 ? (revRows.rev / adSpend).toFixed(2) : '0.00';

  const cartRows = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT ci."userId")::int AS shoppers_cnt,
           COUNT(ci.id)::int AS items_cnt,
           COALESCE(SUM(ci.quantity * p.price), 0)::float AS val
    FROM "CartItem" ci
    JOIN "Product" p ON p.id = ci."productId"
    WHERE p."shopId" = ${shopId}
  `;

  return {
    revenue: revRows.rev,
    orders: revRows.cnt,
    prevRevenue: prevRows.rev,
    prevOrders: prevRows.cnt,
    earned,
    earnedCnt,
    pipeline,
    pipelineCnt,
    lost,
    lostCnt,
    cancelRate,
    organicRev,
    organicCnt,
    promoRev,
    promoCnt,
    adImpr,
    adClicks,
    adSpend,
    totalImpr,
    totalClicks,
    storeCtr,
    promotedRoas,
    blendedRoas,
    leads: { calls: sa.calls, wa: sa.wa, dir: sa.dir, total: sa.calls + sa.wa + sa.dir },
    abandoned: cartRows[0],
  };
}

async function main() {
  const results = [];
  const record = (id, pass, detail) => {
    results.push({ id, verdict: pass ? 'PASS' : 'FAIL', detail });
    if (!pass) console.error(`❌ ${id}: ${detail}`);
    else console.log(`✅ ${id}: ${detail}`);
  };

  const shop = await prisma.shop.findUnique({ where: { id: SHOP_ID } });
  assert(shop, `Shop ${SHOP_ID} not found`);

  const periods = [1, 7, 30, 90];
  const outputs = {};

  await clearShopCache(SHOP_ID);

  for (const days of periods) {
    const oracle = await computeOracle(SHOP_ID, days);
    const api = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, days);
    outputs[days] = api;

    // 1. Oracle match checks
    const revOk = approxEq(api.totalRevenue, oracle.revenue) && api.ordersCount === oracle.orders;
    record(`ORA-${days}D-REV`, revOk, `rev=${api.totalRevenue} (exp ${oracle.revenue}), orders=${api.ordersCount} (exp ${oracle.orders})`);

    const prevOk = approxEq(api.previousRevenue, oracle.prevRevenue) && api.previousOrdersCount === oracle.prevOrders;
    record(`ORA-${days}D-PREV`, prevOk, `prevRev=${api.previousRevenue} (exp ${oracle.prevRevenue}), prevOrders=${api.previousOrdersCount} (exp ${oracle.prevOrders})`);

    const rb = api.revenueBreakdown;
    const rbOk =
      approxEq(rb.realizedRevenue, oracle.earned) &&
      rb.deliveredOrdersCount === oracle.earnedCnt &&
      approxEq(rb.pendingRevenue, oracle.pipeline) &&
      rb.pendingOrdersCount === oracle.pipelineCnt &&
      approxEq(rb.lostRevenue, oracle.lost) &&
      rb.lostOrdersCount === oracle.lostCnt &&
      approxEq(rb.cancellationRate, oracle.cancelRate, 0.1);
    record(`ORA-${days}D-RB`, rbOk, `earned=${rb.realizedRevenue}, pipe=${rb.pendingRevenue}, lost=${rb.lostRevenue}, cancel=${rb.cancellationRate}%`);

    const rs = api.revenueSplit;
    const rsOk =
      approxEq(rs.organicRevenue, oracle.organicRev) &&
      rs.organicOrders === oracle.organicCnt &&
      approxEq(rs.promotedRevenue, oracle.promoRev) &&
      rs.promotedOrders === oracle.promoCnt &&
      approxEq(rs.adSpend, oracle.adSpend) &&
      rs.promotedRoas === oracle.promotedRoas &&
      rs.blendedRoas === oracle.blendedRoas &&
      api.roas === oracle.promotedRoas;
    record(`ORA-${days}D-ROAS`, rsOk, `adSpend=${rs.adSpend}, roas=${api.roas}x, blended=${rs.blendedRoas}x`);

    const kpiOk =
      api.totalImpressions === oracle.totalImpr &&
      api.totalClicks === oracle.totalClicks &&
      api.ctr === oracle.storeCtr;
    record(`ORA-${days}D-KPI`, kpiOk, `impr=${api.totalImpressions} (exp ${oracle.totalImpr}), clk=${api.totalClicks} (exp ${oracle.totalClicks}), ctr=${api.ctr}% (exp ${oracle.storeCtr}%)`);

    const cartOk =
      api.abandonedCarts.count === oracle.abandoned.shoppers_cnt &&
      api.abandonedCarts.itemsCount === oracle.abandoned.items_cnt &&
      approxEq(api.abandonedCarts.value, oracle.abandoned.val);
    record(`ORA-${days}D-CART`, cartOk, `shoppers=${api.abandonedCarts.count}, items=${api.abandonedCarts.itemsCount}, val=${api.abandonedCarts.value}`);

    // 2. Programmatic Invariants I1..I12 per window
    const invChecks = [];
    invChecks.push(['I1', api.totalRevenue >= 0 && Number.isInteger(api.ordersCount) && api.ordersCount >= 0]);
    invChecks.push(['I2', api.ordersCount !== 0 || (api.totalRevenue === 0)]);
    invChecks.push(['I3', approxEq(rb.realizedRevenue + rb.pendingRevenue, api.totalRevenue) && rb.deliveredOrdersCount + rb.pendingOrdersCount === api.ordersCount]);
    invChecks.push(['I4', approxEq(rs.organicRevenue + rs.promotedRevenue, api.totalRevenue) && rs.organicOrders + rs.promotedOrders === api.ordersCount]);
    invChecks.push(['I5', Number(api.ctr) >= 0 && Number(api.ctr) <= 100 && Number(api.conversionRate) >= 0 && Number(api.conversionRate) <= 100 && rb.cancellationRate >= 0 && rb.cancellationRate <= 100]);
    const f = api.funnel.map(s => s.value);
    invChecks.push(['I6', f.length === 4 && f[0] >= f[1] && f[1] >= f[2] && f[2] >= f[3] && f[3] === api.ordersCount]);
    const tsSum = api.trafficSources.reduce((s, x) => s + x.pct, 0);
    invChecks.push(['I7', api.trafficSources.length === 0 || tsSum === 100]);
    const wkSum = api.weeklyRevenue.reduce((a, b) => a + b, 0);
    invChecks.push(['I8', api.weeklyRevenue.length === 7 && Array.isArray(api.weeklyLabels) && api.weeklyLabels.length === 7 && (days >= 7 ? wkSum <= api.totalRevenue + 0.01 : true)]);
    const topSum = api.topProducts.reduce((s, p) => s + p.revenue, 0);
    const prodFieldsOk = api.topProducts.every(p => p.units >= 0 && 'sku' in p && 'lowStockThreshold' in p);
    invChecks.push(['I10', topSum <= api.totalRevenue + 0.01 && prodFieldsOk]);
    const validStates = new Set(['LIVE', 'PAUSED', 'COMPLETED']);
    const campOk = api.campaigns.every(c => c.spent >= 0 && validStates.has(c.state) && 'isExpiredOrExhausted' in c);
    invChecks.push(['I11', campOk]);

    let noBad = true;
    try { checkNoBadValues(api); } catch (e) { noBad = false; }
    invChecks.push(['I12', noBad]);

    for (const [id, ok] of invChecks) {
      if (!ok) record(`INV-${days}D-${id}`, false, `Invariant ${id} failed on ${days}D`);
    }
    record(`INV-${days}D-ALL`, invChecks.every(([, ok]) => ok), `All per-period invariants passed (${invChecks.map(x => x[0]).join(',')})`);
  }

  // I9: Monotonic across periods
  const i9 =
    outputs[1].totalRevenue <= outputs[7].totalRevenue &&
    outputs[7].totalRevenue <= outputs[30].totalRevenue &&
    outputs[30].totalRevenue <= outputs[90].totalRevenue &&
    outputs[1].ordersCount <= outputs[7].ordersCount &&
    outputs[7].ordersCount <= outputs[30].ordersCount &&
    outputs[30].ordersCount <= outputs[90].ordersCount;
  record('INV-I9-MONOTONIC', i9, `1D(${outputs[1].totalRevenue}) <= 7D(${outputs[7].totalRevenue}) <= 30D(${outputs[30].totalRevenue}) <= 90D(${outputs[90].totalRevenue})`);

  // I13: Idempotency on cache-busted repeated call
  await clearShopCache(SHOP_ID);
  const call1 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 30);
  await clearShopCache(SHOP_ID);
  const call2 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 30);
  const idemOk = JSON.stringify(call1) === JSON.stringify(call2);
  record('INV-I13-IDEMPOTENT', idemOk, 'Cache-busted repeated 30D calls match byte-for-byte');

  // R-14: Edge clamping on days (0, -5, 99999)
  const dZero = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 0);
  const dNeg = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, -5);
  const dHuge = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 99999);
  const clampOk =
    JSON.stringify(dZero) === JSON.stringify(outputs[1]) &&
    JSON.stringify(dNeg) === JSON.stringify(outputs[1]) &&
    dHuge.totalRevenue >= outputs[90].totalRevenue;
  record('SEC-DAYS-CLAMP', clampOk, 'days<=1 clamps to 1D; huge days clamps safely to 365D without error');

  // I16 / G-SEC-003: Unauthorized owner blocked with 403
  let unauth403 = false;
  try {
    await shopService.getShopAnalytics(SHOP_ID, '00000000-0000-0000-0000-000000000000', 30);
  } catch (err) {
    unauth403 = err.statusCode === 403;
  }
  record('SEC-G-SEC-003', unauth403, 'Non-owner request throws 403');

  // R-25: keywordsScope flag present
  record('KWD-SCOPE', ['period', 'all_time'].includes(outputs[30].keywordsScope), `keywordsScope=${outputs[30].keywordsScope}`);

  // R-04: isNewRevenueGrowth flag present
  record('GRW-NEW-FLAG', typeof outputs[30].isNewRevenueGrowth === 'boolean', `isNewRevenueGrowth=${outputs[30].isNewRevenueGrowth}`);

  const failures = results.filter(r => r.verdict === 'FAIL');
  console.log(`\nSummary: ${results.length - failures.length}/${results.length} PASS, ${failures.length} FAIL`);

  await prisma.$disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
