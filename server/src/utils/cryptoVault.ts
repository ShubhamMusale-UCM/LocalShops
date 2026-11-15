import crypto from 'crypto';
import env from '../config/env';

const ENCRYPTION_PREFIX = 'enc:v1:';

function getKeyBuffer(): Buffer {
  return crypto.createHash('sha256').update(env.DATA_ENCRYPTION_KEY).digest();
}

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Returns a prefixed string: enc:v1:<ivHex>:<authTagHex>:<cipherHex>
 */
export function encryptSensitiveField(plaintext?: string | null): string | null | undefined {
  if (plaintext === undefined || plaintext === null || plaintext === '') return plaintext;
  const str = String(plaintext);
  if (str.startsWith(ENCRYPTION_PREFIX)) return str; // Already encrypted

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a field encrypted by encryptSensitiveField.
 * Gracefully returns legacy plaintext values so existing rows do not break during migration.
 */
export function decryptSensitiveField(stored?: string | null): string {
  if (!stored) return '';
  const str = String(stored);
  if (!str.startsWith(ENCRYPTION_PREFIX)) return str;

  try {
    const payload = str.slice(ENCRYPTION_PREFIX.length);
    const [ivHex, authTagHex, cipherHex] = payload.split(':');
    if (!ivHex || !authTagHex || !cipherHex) return '';

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getKeyBuffer(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

export function maskAccountNumber(accountNumber?: string | null): string {
  const clean = decryptSensitiveField(accountNumber).trim();
  if (!clean) return '';
  if (clean.length <= 4) return '••••';
  return `${'•'.repeat(Math.min(8, clean.length - 4))}${clean.slice(-4)}`;
}

export function maskPanNumber(pan?: string | null): string {
  const clean = decryptSensitiveField(pan).trim().toUpperCase();
  if (!clean) return '';
  if (clean.length < 10) return '••••••••••';
  return `${clean.slice(0, 2)}••••••${clean.slice(-2)}`;
}
