/**
 * Compliance & KYC Validation Utilities (SEL-6)
 */

const BASE36_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates Indian GSTIN structure and Mod-36 checksum
 * @param gstin 15-character GSTIN string
 */
export function validateGSTIN(gstin?: string | null): boolean {
  if (!gstin || typeof gstin !== 'string') return false;
  const clean = gstin.trim().toUpperCase();

  // 15 characters: 2-digit state code + 10-char PAN + 1 entity + 'Z' + 1 checksum
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) return false;

  // Validate state code (01-37, 97, 99)
  const stateCode = parseInt(clean.substring(0, 2), 10);
  if ((stateCode < 1 || stateCode > 37) && stateCode !== 97 && stateCode !== 99) {
    return false;
  }

  // Mod-36 checksum calculation
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charValue = BASE36_CHARS.indexOf(clean[i]);
    if (charValue === -1) return false;
    const multiplier = i % 2 === 0 ? 1 : 2;
    const product = charValue * multiplier;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const remainder = sum % 36;
  const checkCodeIndex = (36 - remainder) % 36;
  return BASE36_CHARS[checkCodeIndex] === clean[14];
}

/**
 * Validates Indian PAN format (5 letters + 4 digits + 1 letter)
 */
export function validatePAN(pan?: string | null): boolean {
  if (!pan || typeof pan !== 'string') return false;
  const clean = pan.trim().toUpperCase();
  // 4th char is entity type: C (Company), P (Person), H (HUF), F (Firm), A (AOP), T (Trust), B (BOI), L (Local), J (Artificial Juridical), G (Govt)
  const regex = /^[A-Z]{3}[CPHFATBLJG]{1}[A-Z]{1}[0-9]{4}[A-Z]{1}$/;
  return regex.test(clean);
}

/**
 * Validates FSSAI License Number (14 numeric digits)
 */
export function validateFSSAI(fssai?: string | null): boolean {
  if (!fssai || typeof fssai !== 'string') return false;
  const clean = fssai.trim();
  return /^[0-9]{14}$/.test(clean);
}

/**
 * Validates Indian Financial System Code (IFSC)
 */
export function validateIFSC(ifsc?: string | null): boolean {
  if (!ifsc || typeof ifsc !== 'string') return false;
  const clean = ifsc.trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(clean);
}

/**
 * Validates UPI Virtual Payment Address (VPA)
 */
export function validateUPI(upi?: string | null): boolean {
  if (!upi || typeof upi !== 'string') return false;
  const clean = upi.trim().toLowerCase();
  return /^[\w.-]+@[\w.-]+$/.test(clean);
}

/**
 * Mask sensitive KYC identifiers for public/client display
 * e.g. 27AAPFU0939F1ZV -> 27AAPFU****1ZV
 * e.g. ABCDE1234F -> ABCDE****F
 */
export function maskIdentifier(value: string, type: string): string {
  if (!value) return '';
  const clean = value.trim();
  if (type === 'GSTIN' && clean.length === 15) {
    return clean.slice(0, 7) + '****' + clean.slice(11);
  }
  if (type === 'PAN' && clean.length === 10) {
    return clean.slice(0, 5) + '****' + clean.slice(9);
  }
  if (type === 'FSSAI' && clean.length >= 10) {
    return clean.slice(0, 4) + '******' + clean.slice(-4);
  }
  if (type === 'BANK_ACCOUNT' && clean.length >= 6) {
    return '******' + clean.slice(-4);
  }
  if (type === 'UPI' && clean.includes('@')) {
    const parts = clean.split('@');
    const user = parts[0];
    const maskedUser = user.length > 3 ? user.slice(0, 2) + '***' + user.slice(-1) : '***';
    return `${maskedUser}@${parts[1]}`;
  }
  return clean.length > 4 ? clean.slice(0, 2) + '****' + clean.slice(-2) : '****';
}
