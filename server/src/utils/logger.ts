const REDACTED_KEYS = new Set([
  'password',
  'otp',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'accountNumber',
  'panNumber',
  'ifscCode',
]);

export function redactSensitiveObject(input: any): any {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(redactSensitiveObject);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(input)) {
    if (REDACTED_KEYS.has(k) && v) {
      const s = String(v);
      out[k] = s.length > 4 ? `••••${s.slice(-4)}` : '••••';
    } else if (v && typeof v === 'object') {
      out[k] = redactSensitiveObject(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const logger = {
  info(msg: string, meta?: Record<string, any>) {
    const entry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      msg,
      ...(meta ? { meta: redactSensitiveObject(meta) } : {}),
    };
    console.log(JSON.stringify(entry));
  },
  warn(msg: string, meta?: Record<string, any>) {
    const entry = {
      level: 'warn',
      timestamp: new Date().toISOString(),
      msg,
      ...(meta ? { meta: redactSensitiveObject(meta) } : {}),
    };
    console.warn(JSON.stringify(entry));
  },
  error(msg: string, meta?: Record<string, any>) {
    const entry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      msg,
      ...(meta ? { meta: redactSensitiveObject(meta) } : {}),
    };
    console.error(JSON.stringify(entry));
  },
};

export default logger;
