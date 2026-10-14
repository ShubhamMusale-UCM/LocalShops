import { haversineDistance } from '../../utils/geoUtils';

export type AdObjectiveType = 'AWARENESS' | 'TRAFFIC' | 'CONVERSIONS';

export interface BuyerContext {
  lat?: number;
  lng?: number;
  city?: string | null;
}

export interface TargetableListing {
  geoMode?: 'RADIUS' | 'CITIES' | null;
  targetRadiusKm?: number | null;
  targetCities?: string[] | null;
}

export const MAX_TARGET_RADIUS_KM = 200;
export const MIN_DAILY_BUDGET = 200;

export const normalizeCity = (city?: string | null): string =>
  (city || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Hard geo filter for a campaign.
 * RADIUS: buyer must be within targetRadiusKm of the shop.
 * CITIES: buyer's city must be in targetCities; if buyer city is unknown we fall back
 *         to the shop's own city being in the list AND buyer being within 50km (best effort).
 * Returns the buyer<->shop distance (km) when computable so callers can reuse it.
 */
export const evaluateGeoTarget = (
  listing: TargetableListing,
  shop: { latitude?: number | null; longitude?: number | null; city?: string | null },
  buyer: BuyerContext
): { eligible: boolean; distanceKm: number | null } => {
  const hasBuyerGeo = typeof buyer.lat === 'number' && typeof buyer.lng === 'number';
  const hasShopGeo = typeof shop.latitude === 'number' && typeof shop.longitude === 'number';
  const distanceKm =
    hasBuyerGeo && hasShopGeo
      ? haversineDistance(buyer.lat as number, buyer.lng as number, shop.latitude as number, shop.longitude as number)
      : null;

  const mode = listing.geoMode || 'RADIUS';

  if (mode === 'CITIES') {
    const cities = (listing.targetCities || []).map(normalizeCity).filter(Boolean);
    if (cities.length === 0) return { eligible: false, distanceKm };

    const buyerCity = normalizeCity(buyer.city);
    if (buyerCity) {
      return { eligible: cities.includes(buyerCity), distanceKm };
    }
    // Unknown buyer city: only serve if shop city is targeted and buyer is nearby.
    const shopCity = normalizeCity(shop.city);
    const nearby = distanceKm !== null && distanceKm <= 50;
    return { eligible: cities.includes(shopCity) && nearby, distanceKm };
  }

  // RADIUS mode
  if (distanceKm === null) return { eligible: false, distanceKm };
  const radius = Math.min(Math.max(listing.targetRadiusKm ?? 5, 1), MAX_TARGET_RADIUS_KM);
  return { eligible: distanceKm <= radius, distanceKm };
};

/** Server-controlled bid so the client cannot game the auction. */
export const bidForObjective = (objective: AdObjectiveType): number => {
  switch (objective) {
    case 'AWARENESS':
      return 3;
    case 'CONVERSIONS':
      return 8;
    case 'TRAFFIC':
    default:
      return 5;
  }
};
