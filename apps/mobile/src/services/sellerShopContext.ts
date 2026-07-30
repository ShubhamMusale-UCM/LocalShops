import shopService from './shopService';

type SellerShop = {
  id: string;
  name?: string;
  logo?: string;
  coverImage?: string;
  averageRating?: number;
  rating?: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000;

let cachedShop: SellerShop | null = null;
let cachedAt = 0;
let inFlight: Promise<SellerShop | null> | null = null;

const extractPrimaryShop = (payload: any): SellerShop | null => {
  const shops = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.shops)
      ? payload.shops
      : [];

  const first = shops[0];
  if (!first?.id) return null;

  return {
    id: String(first.id),
    name: first.name,
    logo: first.logo,
    coverImage: first.coverImage,
    averageRating: first.averageRating,
    rating: first.rating,
  };
};

export const getPrimarySellerShop = async (force = false): Promise<SellerShop | null> => {
  const now = Date.now();
  if (!force && cachedShop && now - cachedAt < CACHE_TTL_MS) {
    return cachedShop;
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    const response = await shopService.getMyShops();
    const primary = extractPrimaryShop(response?.data);
    cachedShop = primary;
    cachedAt = Date.now();
    return primary;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
};

export const clearPrimarySellerShopCache = () => {
  cachedShop = null;
  cachedAt = 0;
  inFlight = null;
};
