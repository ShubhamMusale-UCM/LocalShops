"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComparableProducts = exports.searchProducts = void 0;
var database_1 = require("../../config/database");
var geoUtils_1 = require("../../utils/geoUtils");
var normalizeSignedS3Url = function (value) {
    try {
        var url = new URL(value);
        var hasAwsSignature = url.searchParams.has('X-Amz-Algorithm') ||
            url.searchParams.has('X-Amz-Credential') ||
            url.searchParams.has('X-Amz-Signature');
        if (hasAwsSignature) {
            url.search = '';
            return url.toString();
        }
        return value;
    }
    catch (_a) {
        return value;
    }
};
var normalizeProductImages = function (product) {
    if (!Array.isArray(product.images))
        return product;
    var images = product.images
        .filter(function (item) { return typeof item === 'string'; })
        .map(function (item) { return item.trim(); })
        .filter(function (item) { return item.length > 0; })
        .map(function (item) { return (/^https?:\/\//i.test(item) ? normalizeSignedS3Url(item) : item); });
    return __assign(__assign({}, product), { images: images, image: images[0] || product.image || '' });
};
var isSponsoredActive = function (listing) {
    if (!listing)
        return false;
    var now = new Date();
    var start = listing.startDate ? new Date(listing.startDate) : null;
    var end = listing.endDate ? new Date(listing.endDate) : null;
    var withinWindow = (!start || start <= now) && (!end || end >= now);
    var hasBudget = typeof listing.budget === 'number' && typeof listing.spent === 'number'
        ? listing.spent < listing.budget
        : true;
    return Boolean(listing.isActive) && withinWindow && hasBudget;
};
/**
 * Full-text search with geo-spatial filtering
 */
var searchProducts = function (params) { return __awaiter(void 0, void 0, void 0, function () {
    var query, latitude, longitude, _a, radius, minPrice, maxPrice, category, subCategory, brand, inStock, _b, sort, _c, page, _d, limit, shopWhereBase, where, fuzzyMatches, fuzzyIds, hasGeo, bbox, orderBy, fetchWithWhere, _e, products, total, fallbackWhere, results, shopIds, today_1, keyword_1;
    var _f;
    return __generator(this, function (_g) {
        switch (_g.label) {
            case 0:
                query = params.query, latitude = params.latitude, longitude = params.longitude, _a = params.radius, radius = _a === void 0 ? 50 : _a, minPrice = params.minPrice, maxPrice = params.maxPrice, category = params.category, subCategory = params.subCategory, brand = params.brand, inStock = params.inStock, _b = params.sort, sort = _b === void 0 ? 'relevance' : _b, _c = params.page, page = _c === void 0 ? 1 : _c, _d = params.limit, limit = _d === void 0 ? 20 : _d;
                shopWhereBase = { isActive: true };
                where = {
                    isActive: true,
                    shop: __assign({}, shopWhereBase),
                };
                if (!query) return [3 /*break*/, 2];
                return [4 /*yield*/, database_1.default.$queryRaw(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      SELECT p.id FROM \"Product\" p\n      LEFT JOIN \"Shop\" s ON p.\"shopId\" = s.id\n      WHERE word_similarity(", ", p.name) >= 0.15 \n         OR word_similarity(", ", p.description) >= 0.15\n         OR word_similarity(", ", p.brand) >= 0.15\n         OR word_similarity(", ", s.name) >= 0.15\n         OR p.name ILIKE ", "\n         OR p.description ILIKE ", "\n         OR p.brand ILIKE ", "\n         OR s.name ILIKE ", "\n    "], ["\n      SELECT p.id FROM \"Product\" p\n      LEFT JOIN \"Shop\" s ON p.\"shopId\" = s.id\n      WHERE word_similarity(", ", p.name) >= 0.15 \n         OR word_similarity(", ", p.description) >= 0.15\n         OR word_similarity(", ", p.brand) >= 0.15\n         OR word_similarity(", ", s.name) >= 0.15\n         OR p.name ILIKE ", "\n         OR p.description ILIKE ", "\n         OR p.brand ILIKE ", "\n         OR s.name ILIKE ", "\n    "])), query, query, query, query, '%' + query + '%', '%' + query + '%', '%' + query + '%', '%' + query + '%')];
            case 1:
                fuzzyMatches = _g.sent();
                fuzzyIds = fuzzyMatches.map(function (m) { return m.id; });
                where.OR = [
                    { id: { in: fuzzyIds } },
                    { tags: { hasSome: query.toLowerCase().split(' ') } },
                ];
                _g.label = 2;
            case 2:
                hasGeo = latitude !== undefined && longitude !== undefined;
                if (hasGeo) {
                    bbox = (0, geoUtils_1.getBoundingBox)(latitude, longitude, radius);
                    where.shop = __assign(__assign({}, shopWhereBase), { latitude: { gte: bbox.minLat, lte: bbox.maxLat }, longitude: { gte: bbox.minLng, lte: bbox.maxLng } });
                }
                // Price filter
                if (minPrice !== undefined)
                    where.price = __assign(__assign({}, where.price), { gte: minPrice });
                if (maxPrice !== undefined)
                    where.price = __assign(__assign({}, where.price), { lte: maxPrice });
                // Category filter
                if (category)
                    where.category = category;
                if (subCategory)
                    where.subCategory = subCategory;
                if (brand)
                    where.brand = { contains: brand, mode: 'insensitive' };
                if (inStock !== undefined)
                    where.inStock = inStock;
                switch (sort) {
                    case 'price_asc':
                        orderBy = { price: 'asc' };
                        break;
                    case 'price_desc':
                        orderBy = { price: 'desc' };
                        break;
                    case 'rating':
                        orderBy = { averageRating: 'desc' };
                        break;
                    case 'popularity':
                        orderBy = { orderCount: 'desc' };
                        break;
                    case 'newest':
                        orderBy = { createdAt: 'desc' };
                        break;
                    case 'relevance':
                        orderBy = { createdAt: 'desc' };
                        break;
                    default: orderBy = { createdAt: 'desc' };
                }
                fetchWithWhere = function (effectiveWhere) { return Promise.all([
                    database_1.default.product.findMany({
                        where: effectiveWhere,
                        include: {
                            shop: {
                                select: {
                                    id: true, name: true, slug: true,
                                    latitude: true, longitude: true,
                                    averageRating: true, isVerified: true,
                                    isOpen: true, deliveryEnabled: true,
                                    logo: true, coverImage: true,
                                },
                            },
                            promotedListing: {
                                select: {
                                    id: true,
                                    isActive: true,
                                    startDate: true,
                                    endDate: true,
                                    budget: true,
                                    spent: true,
                                },
                            },
                        },
                        orderBy: orderBy,
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    database_1.default.product.count({ where: effectiveWhere }),
                ]); };
                return [4 /*yield*/, fetchWithWhere(where)];
            case 3:
                _e = _g.sent(), products = _e[0], total = _e[1];
                if (!(hasGeo && products.length === 0)) return [3 /*break*/, 5];
                fallbackWhere = __assign(__assign({}, where), { shop: __assign({}, shopWhereBase) });
                return [4 /*yield*/, fetchWithWhere(fallbackWhere)];
            case 4:
                _f = _g.sent(), products = _f[0], total = _f[1];
                _g.label = 5;
            case 5:
                results = products.map(function (product) {
                    var _a;
                    var normalized = normalizeProductImages(product);
                    var isSponsored = isSponsoredActive(product.promotedListing);
                    return __assign(__assign({}, normalized), { isSponsored: isSponsored, sponsoredListingId: isSponsored ? (_a = product.promotedListing) === null || _a === void 0 ? void 0 : _a.id : null, sponsoredPriority: isSponsored ? 1 : 0, shopDistance_km: hasGeo
                            ? (0, geoUtils_1.haversineDistance)(latitude, longitude, product.shop.latitude, product.shop.longitude)
                            : undefined });
                });
                // Ad impressions are now tracked via a dedicated POST /ads/impression endpoint
                // to avoid blocking search results and overcounting from API polling.
                // Sponsored listings are boosted for relevant searches.
                results.sort(function (a, b) { return (b.sponsoredPriority || 0) - (a.sponsoredPriority || 0); });
                // Sort by distance if requested and location available
                if (sort === 'distance' && hasGeo) {
                    results.sort(function (a, b) {
                        var sponsoredDiff = (b.sponsoredPriority || 0) - (a.sponsoredPriority || 0);
                        if (sponsoredDiff !== 0)
                            return sponsoredDiff;
                        return (a.shopDistance_km || 0) - (b.shopDistance_km || 0);
                    });
                }
                // Log search keyword stats
                if (query && query.trim().length > 0 && results.length > 0) {
                    shopIds = __spreadArray([], new Set(results.map(function (r) { return r.shopId; })), true);
                    today_1 = new Date();
                    today_1.setUTCHours(0, 0, 0, 0);
                    keyword_1 = query.trim().toLowerCase();
                    // Run async without awaiting to avoid blocking search response
                    Promise.all(shopIds.map(function (shopId) {
                        return database_1.default.searchKeywordStat.upsert({
                            where: {
                                shopId_keyword_date: {
                                    shopId: shopId,
                                    keyword: keyword_1,
                                    date: today_1,
                                }
                            },
                            update: { searches: { increment: 1 } },
                            create: { shopId: shopId, keyword: keyword_1, date: today_1, searches: 1, clicks: 0 },
                        });
                    })).catch(function (e) { return console.error('Error logging search keyword stats:', e); });
                }
                return [2 /*return*/, {
                        products: results,
                        pagination: {
                            page: page,
                            limit: limit,
                            total: total,
                            totalPages: Math.ceil(total / limit),
                        },
                    }];
        }
    });
}); };
exports.searchProducts = searchProducts;
/**
 * Get products from the same category or matching keywords at nearby shops for price comparison
 */
var getComparableProducts = function (productId_1, latitude_1, longitude_1) {
    var args_1 = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        args_1[_i - 3] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([productId_1, latitude_1, longitude_1], args_1, true), void 0, function (productId, latitude, longitude, radius) {
        var product, stopWords, rawWords, keywordConditions, orConditions, shopWhereBase, baseWhere, lat, lng, hasValidGeo, products, bbox, geoWhere;
        var _a, _b;
        if (radius === void 0) { radius = 25; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, database_1.default.product.findUnique({
                        where: { id: productId },
                        select: {
                            id: true,
                            name: true,
                            category: true,
                            brand: true,
                            tags: true,
                            shopId: true,
                            shop: { select: { latitude: true, longitude: true } }
                        },
                    })];
                case 1:
                    product = _c.sent();
                    if (!product)
                        return [2 /*return*/, []];
                    stopWords = new Set(['and', 'for', 'the', 'with', 'from', 'pack', 'size', 'original', 'item', 'best', 'shop']);
                    rawWords = product.name
                        .replace(/[^a-zA-Z0-9\s]/g, ' ')
                        .trim()
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(function (w) { return w.length >= 2 && !stopWords.has(w); });
                    keywordConditions = rawWords.length > 0
                        ? rawWords.map(function (word) { return ({ name: { contains: word, mode: 'insensitive' } }); })
                        : [{ name: { contains: product.name.trim(), mode: 'insensitive' } }];
                    orConditions = __spreadArray(__spreadArray(__spreadArray([], keywordConditions, true), (product.brand ? [{ brand: { equals: product.brand, mode: 'insensitive' } }] : []), true), (product.tags && product.tags.length > 0 ? [{ tags: { hasSome: product.tags } }] : []), true);
                    shopWhereBase = { isActive: true };
                    baseWhere = {
                        id: { not: productId },
                        shopId: { not: product.shopId },
                        isActive: true,
                        OR: orConditions,
                    };
                    lat = latitude || ((_a = product.shop) === null || _a === void 0 ? void 0 : _a.latitude);
                    lng = longitude || ((_b = product.shop) === null || _b === void 0 ? void 0 : _b.longitude);
                    hasValidGeo = lat != null && lng != null && !(lat === 0 && lng === 0);
                    products = [];
                    if (!hasValidGeo) return [3 /*break*/, 3];
                    bbox = (0, geoUtils_1.getBoundingBox)(lat, lng, radius);
                    geoWhere = __assign(__assign({}, baseWhere), { shop: __assign(__assign({}, shopWhereBase), { latitude: { gte: bbox.minLat, lte: bbox.maxLat }, longitude: { gte: bbox.minLng, lte: bbox.maxLng } }) });
                    return [4 /*yield*/, database_1.default.product.findMany({
                            where: geoWhere,
                            include: {
                                shop: {
                                    select: { id: true, name: true, slug: true, latitude: true, longitude: true, averageRating: true, logo: true, coverImage: true },
                                },
                            },
                            orderBy: { price: 'asc' },
                            take: 12,
                        })];
                case 2:
                    products = _c.sent();
                    _c.label = 3;
                case 3:
                    if (!(products.length === 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, database_1.default.product.findMany({
                            where: __assign(__assign({}, baseWhere), { shop: shopWhereBase }),
                            include: {
                                shop: {
                                    select: { id: true, name: true, slug: true, latitude: true, longitude: true, averageRating: true, logo: true, coverImage: true },
                                },
                            },
                            orderBy: { price: 'asc' },
                            take: 12,
                        })];
                case 4:
                    products = _c.sent();
                    _c.label = 5;
                case 5: return [2 /*return*/, products.map(function (item) {
                        var _a, _b;
                        var normalized = normalizeProductImages(item);
                        var itemLat = (_a = item.shop) === null || _a === void 0 ? void 0 : _a.latitude;
                        var itemLng = (_b = item.shop) === null || _b === void 0 ? void 0 : _b.longitude;
                        var itemHasGeo = itemLat != null && itemLng != null && !(itemLat === 0 && itemLng === 0);
                        return __assign(__assign({}, normalized), { shopDistance_km: hasValidGeo && itemHasGeo
                                ? (0, geoUtils_1.haversineDistance)(lat, lng, itemLat, itemLng)
                                : undefined });
                    })];
            }
        });
    });
};
exports.getComparableProducts = getComparableProducts;
var templateObject_1;
