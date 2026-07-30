export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  UPI = 'UPI',
  COD = 'COD',
  CARD = 'CARD',
  WALLET = 'WALLET',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
  total: number;

  // Joined
  productName?: string;
  productImage?: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  timestamp: Date;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  shopId: string;

  items: OrderItem[];

  // Pricing
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  total: number;

  // Status
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];

  // Delivery
  isDelivery: boolean;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryPartnerId?: string | null;
  estimatedDelivery?: Date | null;
  deliveredAt?: Date | null;

  // Payment
  paymentMethod: string;
  paymentStatus: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;

  // Communication
  buyerNote?: string | null;
  sellerNote?: string | null;

  createdAt: Date;
  updatedAt: Date;

  // Joined
  shopName?: string;
  userName?: string;
}

export interface OrderCreateInput {
  shopId: string;
  items: { productId: string; quantity: number }[];
  isDelivery?: boolean;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  paymentMethod: PaymentMethod;
  buyerNote?: string;
  couponCode?: string;
}
