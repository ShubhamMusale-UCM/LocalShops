export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  DELIVERY_PARTNER = 'DELIVERY_PARTNER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  phone: string;
  email?: string | null;
  name: string;
  avatar?: string | null;
  role: UserRole;
  referralCode: string;
  referredBy?: string | null;
  isVerified: boolean;
  fcmToken?: string | null;

  // Location
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
  pincode?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface UserCreateInput {
  phone: string;
  name: string;
  email?: string;
  role?: UserRole;
  referralCode?: string;
  avatar?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  avatar?: string;
  fcmToken?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  pincode?: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface OTPRequest {
  phone: string;
}

export interface OTPVerifyRequest {
  phone: string;
  otp: string;
}
