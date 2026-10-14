import { evaluateGeoTarget, bidForObjective, normalizeCity } from '../ads.targeting';

const shop = { latitude: 18.5204, longitude: 73.8567, city: 'Pune' }; // Pune centre

describe('ads.targeting', () => {
  describe('RADIUS mode', () => {
    const listing = { geoMode: 'RADIUS' as const, targetRadiusKm: 2, targetCities: [] };

    it('serves buyer inside radius', () => {
      // ~1.1 km north
      const r = evaluateGeoTarget(listing, shop, { lat: 18.5304, lng: 73.8567 });
      expect(r.eligible).toBe(true);
      expect(r.distanceKm).toBeLessThan(2);
    });

    it('blocks buyer outside radius', () => {
      // ~5.5 km north
      const r = evaluateGeoTarget(listing, shop, { lat: 18.5704, lng: 73.8567 });
      expect(r.eligible).toBe(false);
    });

    it('blocks when buyer location unknown', () => {
      expect(evaluateGeoTarget(listing, shop, {}).eligible).toBe(false);
    });
  });

  describe('CITIES mode', () => {
    const listing = { geoMode: 'CITIES' as const, targetRadiusKm: 5, targetCities: ['pune', 'mumbai'] };

    it('serves buyer in targeted city (case/space insensitive)', () => {
      expect(evaluateGeoTarget(listing, shop, { lat: 18.5, lng: 73.8, city: '  PUNE ' }).eligible).toBe(true);
    });

    it('blocks buyer in other city', () => {
      expect(evaluateGeoTarget(listing, shop, { lat: 12.97, lng: 77.59, city: 'Bengaluru' }).eligible).toBe(false);
    });

    it('unknown buyer city: needs shop city targeted and buyer within 50km', () => {
      expect(evaluateGeoTarget(listing, shop, { lat: 18.53, lng: 73.86 }).eligible).toBe(true);
      expect(evaluateGeoTarget(listing, shop, { lat: 19.5, lng: 75.0 }).eligible).toBe(false);
    });

    it('empty city list never serves', () => {
      expect(evaluateGeoTarget({ geoMode: 'CITIES', targetCities: [] }, shop, { city: 'pune' }).eligible).toBe(false);
    });
  });

  it('normalizeCity collapses whitespace and case', () => {
    expect(normalizeCity('  Delhi   NCR ')).toBe('delhi ncr');
  });

  it('server-side bid differs per objective', () => {
    expect(bidForObjective('AWARENESS')).toBeLessThan(bidForObjective('TRAFFIC'));
    expect(bidForObjective('CONVERSIONS')).toBeGreaterThan(bidForObjective('TRAFFIC'));
  });
});
