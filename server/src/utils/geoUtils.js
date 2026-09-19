"use strict";
/**
 * Geo-spatial utility functions for distance calculations
 * and bounding box queries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWithinRadius = exports.formatDistance = exports.getBoundingBox = exports.haversineDistance = void 0;
var EARTH_RADIUS_KM = 6371;
/**
 * Calculate distance between two points using Haversine formula
 */
var haversineDistance = function (lat1, lon1, lat2, lon2) {
    var dLat = toRadians(lat2 - lat1);
    var dLon = toRadians(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
};
exports.haversineDistance = haversineDistance;
/**
 * Calculate bounding box for a center point and radius (for DB queries)
 */
var getBoundingBox = function (latitude, longitude, radiusKm) {
    var latDelta = radiusKm / 111.32;
    var lngDelta = radiusKm / (111.32 * Math.cos(toRadians(latitude)));
    return {
        minLat: latitude - latDelta,
        maxLat: latitude + latDelta,
        minLng: longitude - lngDelta,
        maxLng: longitude + lngDelta,
    };
};
exports.getBoundingBox = getBoundingBox;
/**
 * Format distance for display
 */
var formatDistance = function (distanceKm) {
    if (distanceKm < 1) {
        return "".concat(Math.round(distanceKm * 1000), "m");
    }
    return "".concat(distanceKm.toFixed(1), "km");
};
exports.formatDistance = formatDistance;
/**
 * Check if a point is within a given radius from center
 */
var isWithinRadius = function (centerLat, centerLng, pointLat, pointLng, radiusKm) {
    return (0, exports.haversineDistance)(centerLat, centerLng, pointLat, pointLng) <= radiusKm;
};
exports.isWithinRadius = isWithinRadius;
var toRadians = function (degrees) { return degrees * (Math.PI / 180); };
