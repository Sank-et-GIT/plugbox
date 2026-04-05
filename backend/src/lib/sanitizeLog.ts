const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'otp',
  'secret',
  'apiKey',
  'privateKey',
  'cvv',
  'cardNumber',
];

export function sanitizeLog(value: any): any {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map(sanitizeLog);
  if (typeof value !== 'object') return value;

  const out: Record<string, any> = {};

  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key)) {
      out[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeLog(val);
    } else {
      out[key] = val;
    }
  }

  return out;
}