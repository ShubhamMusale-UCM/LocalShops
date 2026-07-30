export const validatePhone = (phone: string): boolean => /^[6-9]\d{9}$/.test(phone);
export const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validatePincode = (pincode: string): boolean => /^\d{6}$/.test(pincode);
export const validateGST = (gst: string): boolean => /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gst);
export const validateName = (name: string): boolean => name.trim().length >= 2;
export const validatePrice = (price: number): boolean => price > 0;
export const validateOTP = (otp: string): boolean => /^\d{6}$/.test(otp);
