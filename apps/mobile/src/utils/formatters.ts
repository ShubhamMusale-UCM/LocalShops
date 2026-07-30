/**
 * Format price in Indian Rupees
 */
export const formatPrice = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN')}`;
};

/**
 * Format price with MRP strikethrough info
 */
export const formatPriceWithDiscount = (price: number, mrp?: number | null) => ({
  price: formatPrice(price),
  mrp: mrp ? formatPrice(mrp) : null,
  discount: mrp ? `${Math.round(((mrp - price) / mrp) * 100)}% off` : null,
  saved: mrp ? formatPrice(mrp - price) : null,
});

/**
 * Format distance
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 0.1) return 'Nearby';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m away`;
  return `${distanceKm.toFixed(1)}km away`;
};

/**
 * Format rating
 */
export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

/**
 * Format count (1K, 2.5K, etc.)
 */
export const formatCount = (count: number): string => {
  if (count >= 10000) return `${(count / 1000).toFixed(0)}K`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

/**
 * Format relative time
 */
export const formatTimeAgo = (date: Date | string): string => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString('en-IN');
};

/**
 * Format order number
 */
export const formatOrderNumber = (orderNumber: string): string => {
  return `#${orderNumber}`;
};

/**
 * Format phone number for display
 */
export const formatPhone = (phone: string): string => {
  if (phone.length === 10) {
    return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
};

/**
 * Check if shop is currently open based on operating hours
 */
export const isShopOpen = (operatingHours: any): { isOpen: boolean; message: string } => {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[now.getDay()];
  const hours = operatingHours?.[today];

  if (!hours || hours.isClosed) {
    return { isOpen: false, message: 'Closed today' };
  }

  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    const minsLeft = closeMinutes - currentMinutes;
    if (minsLeft <= 60) {
      return { isOpen: true, message: `Closes in ${minsLeft}min` };
    }
    return { isOpen: true, message: `Open until ${hours.close}` };
  }

  if (currentMinutes < openMinutes) {
    return { isOpen: false, message: `Opens at ${hours.open}` };
  }

  return { isOpen: false, message: 'Closed for today' };
};
