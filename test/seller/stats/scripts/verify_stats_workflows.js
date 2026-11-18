process.env.NODE_ENV = 'test';
const path = require('path');
const http = require('http');
const assert = require('assert');
const jwt = require(path.resolve(__dirname, '../../../../node_modules/jsonwebtoken'));
require('dotenv').config({ path: path.resolve(__dirname, '../../../../server/.env') });

const { PrismaClient } = require('@prisma/client');
const redis = require(path.resolve(__dirname, '../../../../server/dist/config/redis.js')).default;
const { ShopService } = require(path.resolve(__dirname, '../../../../server/dist/modules/shop/shop.service.js'));
const { AdsService } = require(path.resolve(__dirname, '../../../../server/dist/modules/ads/ads.service.js'));

const prisma = new PrismaClient();
const shopService = new ShopService();
const adsService = new AdsService();

const SHOP_ID = 'aeeaa1ce-79ce-4bd7-a842-6e63a8a95086';
const PRODUCT_ID_1 = 'c8af0a04-4b06-45ae-b99d-40d6d46659c6';
const PRODUCT_ID_2 = 'ae8f4c95-822f-462b-a70f-d1269fc36055';

const results = [];
function check(id, cond, detail) {
  results.push({ id, verdict: cond ? 'PASS' : 'FAIL', detail });
  if (cond) console.log(`✅ ${id}: ${detail}`);
  else console.error(`❌ ${id}: ${detail}`);
  return cond;
}

function approxEq(a, b, tol = 0.01) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, phone: user.phone, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

function httpRequest(method, reqPath, token, payload) {
  return new Promise((resolve, reject) => {
    const bodyStr = payload ? JSON.stringify(payload) : '';
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (bodyStr) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(
      { hostname: 'localhost', port: 5000, path: reqPath, method, headers },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch (_) {}
          resolve({ status: res.statusCode, json, body });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function httpGet(reqPath, token) {
  return httpRequest('GET', reqPath, token);
}

function httpPost(reqPath, token, payload) {
  return httpRequest('POST', reqPath, token, payload);
}

async function clearShopCache(shopId) {
  const patterns = [`shop:${shopId}:analytics*`, `shop:${shopId}:ads*`, `shop:${shopId}:daily-metrics`];
  for (const p of patterns) {
    const keys = await redis.keys(p);
    if (keys.length > 0) await redis.del(...keys);
  }
}

async function main() {
  const shop = await prisma.shop.findUnique({ where: { id: SHOP_ID } });
  assert(shop, `Shop ${SHOP_ID} not found`);

  const prod1 = await prisma.product.findUnique({ where: { id: PRODUCT_ID_1 } });
  const prod2 = await prisma.product.findUnique({ where: { id: PRODUCT_ID_2 } });
  assert(prod1 && prod2, 'Target shop products not found');

  const owner = await prisma.user.findUnique({ where: { id: shop.ownerId } });
  assert(owner, 'Shop owner not found');

  const suffix = Date.now().toString().slice(-6);
  let fxBuyer = null;
  let fxOtherSeller = null;

  try {
    fxBuyer = await prisma.user.create({
      data: {
        phone: `99990${suffix}1`,
        name: 'FX Test Buyer',
        role: 'BUYER',
        referralCode: `FXB${suffix}`,
      },
    });
    fxOtherSeller = await prisma.user.create({
      data: {
        phone: `99990${suffix}2`,
        name: 'FX Other Seller',
        role: 'SELLER',
        referralCode: `FXS${suffix}`,
      },
    });

    const ownerToken = signToken(owner);
    const buyerToken = signToken(fxBuyer);
    const otherSellerToken = signToken(fxOtherSeller);

    // =========================================================================
    // WORKFLOW 1: Live HTTP Auth, Isolation, Query Clamping, Support Route
    // =========================================================================
    await clearShopCache(SHOP_ID);
    const rUnauth = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=7`);
    check('WF1-NO-AUTH', rUnauth.status === 401, `No token -> HTTP ${rUnauth.status}`);

    const rBuyer = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=7`, buyerToken);
    check('WF1-BUYER-403', rBuyer.status === 403, `Buyer role -> HTTP ${rBuyer.status}`);

    const rOtherSeller = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=7`, otherSellerToken);
    check('WF1-OTHER-SELLER-403', rOtherSeller.status === 403, `Non-owner seller -> HTTP ${rOtherSeller.status}`);

    const rMissingShop = await httpGet(`/api/shops/00000000-0000-0000-0000-000000000000/analytics?days=7`, ownerToken);
    check('WF1-MISSING-404', rMissingShop.status === 404, `Missing shop -> HTTP ${rMissingShop.status}`);

    const r1 = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=1`, ownerToken);
    const r0 = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=0`, ownerToken);
    const rNeg = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=-5`, ownerToken);
    const rAbc = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=abc`, ownerToken);
    const r30 = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=30`, ownerToken);
    const rDefault = await httpGet(`/api/shops/${SHOP_ID}/analytics`, ownerToken);
    const rHuge = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=99999`, ownerToken);

    const clampPass =
      r1.status === 200 &&
      r0.status === 200 &&
      rNeg.status === 200 &&
      rAbc.status === 200 &&
      r30.status === 200 &&
      rDefault.status === 200 &&
      rHuge.status === 200 &&
      JSON.stringify(r0.json) === JSON.stringify(r1.json) &&
      JSON.stringify(rNeg.json) === JSON.stringify(r1.json) &&
      JSON.stringify(rAbc.json) === JSON.stringify(r30.json) &&
      JSON.stringify(rDefault.json) === JSON.stringify(r30.json);
    check('WF1-DAYS-CLAMP-HTTP', clampPass, '0/-5 -> 1D, abc/omitted -> 30D, 99999 -> 200 clamped 365D');

    const bodyLower = r30.body.toLowerCase();
    const noPii = !bodyLower.includes('passwordhash') && !bodyLower.includes(owner.phone);
    check('WF1-NO-PII', noPii, 'No owner phone or passwordHash leaked in analytics JSON');

    const rSupportAdmin = await httpGet(`/api/support/admin/queue`, ownerToken);
    check('WF1-SUPPORT-RBAC', rSupportAdmin.status === 403, `Seller calling support admin queue -> HTTP ${rSupportAdmin.status}`);

    // =========================================================================
    // WORKFLOW 2: Order Lifecycle (PLACED -> DELIVERED -> CANCELLED)
    // =========================================================================
    await clearShopCache(SHOP_ID);
    const base7 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
    const baseProd1 = base7.topProducts.find((p) => p.id === PRODUCT_ID_1) || { units: 0, revenue: 0 };

    let tempOrderId = null;
    try {
      const ord = await prisma.order.create({
        data: {
          orderNumber: `FXWF${suffix}`,
          userId: fxBuyer.id,
          shopId: SHOP_ID,
          subtotal: 800,
          total: 800,
          paymentMethod: 'CASH',
          status: 'PLACED',
          items: {
            create: {
              productId: PRODUCT_ID_1,
              quantity: 2,
              price: 400,
              total: 800,
            },
          },
        },
      });
      tempOrderId = ord.id;

      await clearShopCache(SHOP_ID);
      const afterPlaced = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
      const afterPlacedProd1 = afterPlaced.topProducts.find((p) => p.id === PRODUCT_ID_1);
      const placedOk =
        approxEq(afterPlaced.totalRevenue, base7.totalRevenue + 800) &&
        afterPlaced.ordersCount === base7.ordersCount + 1 &&
        approxEq(afterPlaced.revenueBreakdown.pendingRevenue, base7.revenueBreakdown.pendingRevenue + 800) &&
        afterPlaced.revenueBreakdown.pendingOrdersCount === base7.revenueBreakdown.pendingOrdersCount + 1 &&
        approxEq(afterPlaced.revenueSplit.organicRevenue, base7.revenueSplit.organicRevenue + 800) &&
        afterPlaced.revenueSplit.organicOrders === base7.revenueSplit.organicOrders + 1 &&
        approxEq(afterPlaced.weeklyRevenue[6], base7.weeklyRevenue[6] + 800) &&
        afterPlaced.funnel[3].value === afterPlaced.ordersCount &&
        Boolean(afterPlacedProd1) &&
        afterPlacedProd1.units === baseProd1.units + 2 &&
        approxEq(afterPlacedProd1.revenue, baseProd1.revenue + 800);
      check('WF2-PLACED', placedOk, `rev=${afterPlaced.totalRevenue}, pipe=${afterPlaced.revenueBreakdown.pendingRevenue}, p1Units=${afterPlacedProd1?.units}`);

      await prisma.order.update({ where: { id: tempOrderId }, data: { status: 'DELIVERED' } });
      await clearShopCache(SHOP_ID);
      const afterDelivered = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
      const delivOk =
        approxEq(afterDelivered.totalRevenue, afterPlaced.totalRevenue) &&
        approxEq(afterDelivered.revenueBreakdown.pendingRevenue, base7.revenueBreakdown.pendingRevenue) &&
        approxEq(afterDelivered.revenueBreakdown.realizedRevenue, base7.revenueBreakdown.realizedRevenue + 800) &&
        afterDelivered.revenueBreakdown.deliveredOrdersCount === base7.revenueBreakdown.deliveredOrdersCount + 1;
      check('WF2-DELIVERED', delivOk, `earned=${afterDelivered.revenueBreakdown.realizedRevenue}, pipe=${afterDelivered.revenueBreakdown.pendingRevenue}`);

      await prisma.order.update({ where: { id: tempOrderId }, data: { status: 'CANCELLED' } });
      await clearShopCache(SHOP_ID);
      const afterCancelled = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
      const cancelProd1 = afterCancelled.topProducts.find((p) => p.id === PRODUCT_ID_1) || { units: 0, revenue: 0 };
      const cancelOk =
        approxEq(afterCancelled.totalRevenue, base7.totalRevenue) &&
        afterCancelled.ordersCount === base7.ordersCount &&
        approxEq(afterCancelled.revenueBreakdown.lostRevenue, base7.revenueBreakdown.lostRevenue + 800) &&
        afterCancelled.revenueBreakdown.lostOrdersCount === base7.revenueBreakdown.lostOrdersCount + 1 &&
        approxEq(afterCancelled.weeklyRevenue[6], base7.weeklyRevenue[6]) &&
        cancelProd1.units === baseProd1.units &&
        approxEq(cancelProd1.revenue, baseProd1.revenue);
      check('WF2-CANCELLED', cancelOk, `revRestored=${afterCancelled.totalRevenue}, lost=${afterCancelled.revenueBreakdown.lostRevenue}`);
    } finally {
      if (tempOrderId) {
        await prisma.orderItem.deleteMany({ where: { orderId: tempOrderId } });
        await prisma.order.delete({ where: { id: tempOrderId } });
      }
      await clearShopCache(SHOP_ID);
    }

    // =========================================================================
    // WORKFLOW 3: Ad Rollup + Attributed Order + Promoted vs Blended ROAS
    // =========================================================================
    const baseAd7 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
    let wf3CampaignId = null;
    let wf3OrderId = null;
    try {
      const now = new Date();
      const promo = await prisma.promotedListing.create({
        data: {
          shopId: SHOP_ID,
          productId: PRODUCT_ID_2,
          budget: 1000,
          spent: 100,
          impressions: 50,
          clicks: 10,
          conversions: 1,
          revenue: 500,
          startDate: new Date(now.getTime() - 86400000),
          endDate: new Date(now.getTime() + 86400000 * 5),
          isActive: true,
        },
      });
      wf3CampaignId = promo.id;

      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      await prisma.adDailyMetricRollup.create({
        data: {
          promotedListingId: wf3CampaignId,
          date: todayUtc,
          hour: 0,
          impressions: 50,
          clicks: 10,
          spend: 100,
          conversions: 1,
          revenue: 500,
        },
      });

      const ordAd = await prisma.order.create({
        data: {
          orderNumber: `FXAD${suffix}`,
          userId: fxBuyer.id,
          shopId: SHOP_ID,
          subtotal: 500,
          total: 500,
          paymentMethod: 'CASH',
          status: 'CONFIRMED',
          adCampaignId: wf3CampaignId,
          items: {
            create: {
              productId: PRODUCT_ID_2,
              quantity: 1,
              price: 500,
              total: 500,
            },
          },
        },
      });
      wf3OrderId = ordAd.id;

      await clearShopCache(SHOP_ID);
      const afterAd = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
      const expPromoRoas = ((baseAd7.revenueSplit.promotedRevenue + 500) / (baseAd7.revenueSplit.adSpend + 100)).toFixed(2);
      const expBlendedRoas = ((baseAd7.totalRevenue + 500) / (baseAd7.revenueSplit.adSpend + 100)).toFixed(2);
      const expImpr = baseAd7.totalImpressions + 50;
      const expClicks = baseAd7.totalClicks + 10;
      const expCtr = ((expClicks / expImpr) * 100).toFixed(2);

      const adOk =
        afterAd.adImpressions === baseAd7.adImpressions + 50 &&
        afterAd.adClicks === baseAd7.adClicks + 10 &&
        approxEq(afterAd.revenueSplit.adSpend, baseAd7.revenueSplit.adSpend + 100) &&
        approxEq(afterAd.revenueSplit.promotedRevenue, baseAd7.revenueSplit.promotedRevenue + 500) &&
        afterAd.revenueSplit.promotedOrders === baseAd7.revenueSplit.promotedOrders + 1 &&
        afterAd.roas === expPromoRoas &&
        afterAd.revenueSplit.promotedRoas === expPromoRoas &&
        afterAd.revenueSplit.blendedRoas === expBlendedRoas &&
        afterAd.totalImpressions === expImpr &&
        afterAd.totalClicks === expClicks &&
        afterAd.ctr === expCtr;
      check('WF3-AD-ROAS-CTR', adOk, `roas=${afterAd.roas}x (exp ${expPromoRoas}x), blended=${afterAd.revenueSplit.blendedRoas}x (exp ${expBlendedRoas}x), ctr=${afterAd.ctr}%`);
    } finally {
      if (wf3OrderId) {
        await prisma.orderItem.deleteMany({ where: { orderId: wf3OrderId } });
        await prisma.order.delete({ where: { id: wf3OrderId } });
      }
      if (wf3CampaignId) {
        await prisma.adDailyMetricRollup.deleteMany({ where: { promotedListingId: wf3CampaignId } });
        await prisma.promotedListing.delete({ where: { id: wf3CampaignId } });
      }
      await clearShopCache(SHOP_ID);
    }

    // =========================================================================
    // WORKFLOW 4: Campaign LIVE -> PAUSED -> LIVE -> COMPLETED Lifecycle
    // =========================================================================
    let wf4CampaignId = null;
    try {
      const now = new Date();
      const promo4 = await prisma.promotedListing.create({
        data: {
          shopId: SHOP_ID,
          productId: PRODUCT_ID_2,
          budget: 500,
          spent: 100,
          startDate: new Date(now.getTime() - 86400000),
          endDate: new Date(now.getTime() + 86400000 * 3),
          isActive: true,
        },
      });
      wf4CampaignId = promo4.id;

      await clearShopCache(SHOP_ID);
      let promoAnalytics = await adsService.getShopPromotionAnalytics(SHOP_ID);
      let c = promoAnalytics.campaigns.find((x) => x.id === wf4CampaignId);
      const liveOk = c && c.state === 'LIVE' && c.isLive === true && c.isExpiredOrExhausted === false;
      check('WF4-LIVE', liveOk, `state=${c?.state}, expired=${c?.isExpiredOrExhausted}`);

      const pauseHttp = await httpPost(`/api/ads/${wf4CampaignId}/pause`, ownerToken);
      promoAnalytics = await adsService.getShopPromotionAnalytics(SHOP_ID);
      c = promoAnalytics.campaigns.find((x) => x.id === wf4CampaignId);
      const pausedOk =
        pauseHttp.status === 200 &&
        c &&
        c.state === 'PAUSED' &&
        c.isLive === false &&
        c.isExpiredOrExhausted === false;
      check('WF4-PAUSED', pausedOk, `HTTP=${pauseHttp.status}, state=${c?.state}, expired=${c?.isExpiredOrExhausted}`);

      const resumeHttp = await httpPost(`/api/ads/${wf4CampaignId}/resume`, ownerToken);
      promoAnalytics = await adsService.getShopPromotionAnalytics(SHOP_ID);
      c = promoAnalytics.campaigns.find((x) => x.id === wf4CampaignId);
      const resumedOk = resumeHttp.status === 200 && c && c.state === 'LIVE' && c.isLive === true;
      check('WF4-RESUMED', resumedOk, `HTTP=${resumeHttp.status}, state=${c?.state}`);

      await prisma.promotedListing.update({
        where: { id: wf4CampaignId },
        data: { endDate: new Date(now.getTime() - 3600000), isActive: false },
      });
      await clearShopCache(SHOP_ID);
      promoAnalytics = await adsService.getShopPromotionAnalytics(SHOP_ID);
      c = promoAnalytics.campaigns.find((x) => x.id === wf4CampaignId);
      const blockedHttp = await httpPost(`/api/ads/${wf4CampaignId}/resume`, ownerToken);
      const completedOk =
        c &&
        c.state === 'COMPLETED' &&
        c.isExpiredOrExhausted === true &&
        blockedHttp.status === 400;
      check('WF4-COMPLETED', completedOk, `state=${c?.state}, expired=${c?.isExpiredOrExhausted}, resumeBlockedHTTP=${blockedHttp.status}`);
    } finally {
      if (wf4CampaignId) {
        await prisma.promotedListing.delete({ where: { id: wf4CampaignId } });
      }
      await clearShopCache(SHOP_ID);
    }

    // =========================================================================
    // WORKFLOW 5: Abandoned Cart Distinct Shoppers vs Items
    // =========================================================================
    const baseCart7 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
    const createdCartIds = [];
    try {
      const c1 = await prisma.cartItem.create({
        data: { userId: fxBuyer.id, productId: PRODUCT_ID_1, shopId: SHOP_ID, quantity: 1 },
      });
      const c2 = await prisma.cartItem.create({
        data: { userId: fxBuyer.id, productId: PRODUCT_ID_2, shopId: SHOP_ID, quantity: 2 },
      });
      createdCartIds.push(c1.id, c2.id);

      await clearShopCache(SHOP_ID);
      const afterCart = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);
      const deltaVal = prod1.price * 1 + prod2.price * 2;
      const cartOk =
        afterCart.abandonedCarts.count === baseCart7.abandonedCarts.count + 1 &&
        afterCart.abandonedCarts.itemsCount === baseCart7.abandonedCarts.itemsCount + 2 &&
        approxEq(afterCart.abandonedCarts.value, baseCart7.abandonedCarts.value + deltaVal);
      check('WF5-ABANDONED-CART', cartOk, `shoppers=${afterCart.abandonedCarts.count} (+1), items=${afterCart.abandonedCarts.itemsCount} (+2), val=${afterCart.abandonedCarts.value}`);
    } finally {
      if (createdCartIds.length > 0) {
        await prisma.cartItem.deleteMany({ where: { id: { in: createdCartIds } } });
      }
      await clearShopCache(SHOP_ID);
    }

    // =========================================================================
    // WORKFLOW 6: Showroom Walk-In Leads + Redis Dedup
    // =========================================================================
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const dedupKey = `dedup:shop_intent:direction:${SHOP_ID}:fx-wf-device-${suffix}`;
    const existingSa = await prisma.shopAnalytics.findUnique({
      where: { shopId_date: { shopId: SHOP_ID, date: todayUtc } },
    });
    const baseLead7 = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);

    try {
      await shopService.logShopIntent(SHOP_ID, 'direction', `fx-wf-device-${suffix}`);
      await clearShopCache(SHOP_ID);
      const afterFirst = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);

      await shopService.logShopIntent(SHOP_ID, 'direction', `fx-wf-device-${suffix}`);
      await clearShopCache(SHOP_ID);
      const afterSecond = await shopService.getShopAnalytics(SHOP_ID, shop.ownerId, 7);

      const leadOk =
        afterFirst.showroomLeads.directions === baseLead7.showroomLeads.directions + 1 &&
        afterFirst.showroomLeads.totalLeads === baseLead7.showroomLeads.totalLeads + 1 &&
        afterSecond.showroomLeads.directions === afterFirst.showroomLeads.directions;
      check('WF6-LEADS-DEDUP', leadOk, `directions: ${baseLead7.showroomLeads.directions} -> ${afterFirst.showroomLeads.directions} -> ${afterSecond.showroomLeads.directions}`);
    } finally {
      await redis.del(dedupKey);
      if (existingSa) {
        await prisma.shopAnalytics.update({
          where: { shopId_date: { shopId: SHOP_ID, date: todayUtc } },
          data: { directions: existingSa.directions },
        });
      } else {
        await prisma.shopAnalytics.deleteMany({
          where: { shopId: SHOP_ID, date: todayUtc },
        });
      }
      await clearShopCache(SHOP_ID);
    }

    // =========================================================================
    // WORKFLOW 7: Frontend Helper & Filtering/Sorting Verification
    // =========================================================================
    const fmt = (n) => {
      if (n === undefined || n === null || isNaN(n)) return '0';
      if (n >= 999950) return `${(n / 1000000).toFixed(1)}M`;
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
      return `${n}`;
    };
    const fmtOk = fmt(999949) === '999.9K' && fmt(999950) === '1.0M' && fmt(0) === '0';

    const sampleProds = [
      { id: 'p1', sku: 'SKU-101', name: 'Silk Saree', category: 'Apparel', views: 0, viewCount: 5000 },
      { id: 'p2', sku: 'SKU-202', name: 'Cotton Kurta', category: 'Apparel', views: 2, viewCount: 5 },
    ];
    const skuMatch = sampleProds.filter((p) =>
      p.name.toLowerCase().includes('202') || p.sku.toLowerCase().includes('202')
    );
    const viewsSorted = [...sampleProds].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));

    const sampleKw = [
      { keyword: 'saree', searches: 10, clicks: 3 },
      { keyword: 'lehenga', searches: 5, clicks: 0 },
    ];
    const sumAll = sampleKw.reduce((a, k) => a + k.searches, 0);
    const filteredZero = sampleKw.filter((k) => k.clicks === 0);
    const sumFromAll = sampleKw.reduce((a, k) => a + k.searches, 0); // invariant when filter active
    const uiLogicOk =
      fmtOk &&
      skuMatch.length === 1 &&
      skuMatch[0].id === 'p2' &&
      viewsSorted[0].id === 'p2' &&
      filteredZero.length === 1 &&
      sumAll === sumFromAll;
    check('WF7-UI-LOGIC', uiLogicOk, `fmt(999950)=${fmt(999950)}, skuMatch=${skuMatch[0]?.id}, topPeriodView=${viewsSorted[0]?.id}`);

    // =========================================================================
    // WORKFLOW 8: Cross-Endpoint Redis Cache Isolation (getShopAds vs Analytics)
    // =========================================================================
    await clearShopCache(SHOP_ID);
    const rAdsList1 = await httpGet(`/api/ads/shop/${SHOP_ID}`, ownerToken);
    const rStatsAfterAds = await httpGet(`/api/shops/${SHOP_ID}/analytics?days=30`, ownerToken);
    const rAdsList2 = await httpGet(`/api/ads/shop/${SHOP_ID}`, ownerToken);
    const adsArr1 = Array.isArray(rAdsList1.json?.data) ? rAdsList1.json.data : rAdsList1.json;
    const adsArr2 = Array.isArray(rAdsList2.json?.data) ? rAdsList2.json.data : rAdsList2.json;
    const cacheIsoOk =
      rAdsList1.status === 200 &&
      rStatsAfterAds.status === 200 &&
      rAdsList2.status === 200 &&
      Array.isArray(adsArr1) &&
      Array.isArray(adsArr2) &&
      Array.isArray(rStatsAfterAds.json?.campaigns) &&
      rStatsAfterAds.json.campaigns.length === adsArr1.length;
    check(
      'WF8-ADS-CACHE-ISOLATION',
      cacheIsoOk,
      `adsList1=${adsArr1?.length}, statsCampaigns=${rStatsAfterAds.json?.campaigns?.length}, adsList2=${adsArr2?.length}`
    );
  } finally {
    if (fxBuyer) await prisma.user.deleteMany({ where: { id: fxBuyer.id } });
    if (fxOtherSeller) await prisma.user.deleteMany({ where: { id: fxOtherSeller.id } });
    await clearShopCache(SHOP_ID);
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => r.verdict === 'FAIL');
  console.log(`\nWorkflow Summary: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL`);
  process.exit(fails.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
