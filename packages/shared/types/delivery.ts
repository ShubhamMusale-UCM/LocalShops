export interface DeliveryPartner {
  id: string;
  userId: string;
  vehicleType: 'BICYCLE' | 'BIKE' | 'CAR';
  vehicleNumber?: string | null;
  licenseNumber?: string | null;
  isAvailable: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  totalDeliveries: number;
  averageRating: number;
  totalEarnings: number;
  createdAt: Date;
  updatedAt: Date;

  // Joined
  userName?: string;
  userPhone?: string;
}

export interface DeliveryPartnerCreateInput {
  vehicleType: 'BICYCLE' | 'BIKE' | 'CAR';
  vehicleNumber?: string;
  licenseNumber?: string;
}

export interface DeliveryLocationUpdate {
  latitude: number;
  longitude: number;
}

export interface DeliveryTrackingEvent {
  orderId: string;
  deliveryPartnerId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  status: string;
}
