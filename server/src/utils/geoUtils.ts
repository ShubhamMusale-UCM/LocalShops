/**
 * Geo-spatial utility functions for distance calculations
 * and bounding box queries.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two points using Haversine formula
 */
export const haversineDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Calculate bounding box for a center point and radius (for DB queries)
 */
export const getBoundingBox = (
  latitude: number,
  longitude: number,
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } => {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRadians(latitude)));

  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  };
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

/**
 * Check if a point is within a given radius from center
 */
export const isWithinRadius = (
  centerLat: number, centerLng: number,
  pointLat: number, pointLng: number,
  radiusKm: number
): boolean => {
  return haversineDistance(centerLat, centerLng, pointLat, pointLng) <= radiusKm;
};

const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
