import { API_BASE_URL } from './constants';

const DEFAULT_PRODUCT_PLACEHOLDER = 'https://placehold.co/400x400/F1F5F9/64748B?text=Product';

const getServerUrl = (): string => {
  return API_BASE_URL.replace(/\/api\/?$/, '');
};

export const sanitizeImageUrl = (input?: string | null): string | null => {
  if (!input || typeof input !== 'string') return null;

  let trimmed = input.trim().replace(/^['\"]+|['\"]+$/g, '');
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;

  // Let local device URIs (file://) or content:// pass for local testing and optimistic UI.
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) {
    return trimmed;
  }

  // Prepend server base URL if it's a relative uploads path
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const relative = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
    trimmed = `${getServerUrl()}${relative}`;
  } else if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    // Other relative path fallback
    const relative = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
    trimmed = `${getServerUrl()}${relative}`;
  }

  // Dynamically replace localhost, 127.0.0.1 or stale domains for local uploads with the active runtime server URL
  if (trimmed.includes('/uploads/')) {
    const serverUrl = getServerUrl();
    trimmed = trimmed.replace(/^https?:\/\/[^\/]+\/uploads\//, `${serverUrl}/uploads/`);
  } else if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    const serverUrl = getServerUrl();
    trimmed = trimmed
      .replace(/https?:\/\/localhost:\d+/g, serverUrl)
      .replace(/https?:\/\/127\.0\.0\.1:\d+/g, serverUrl);
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return trimmed;

    const hasAwsSignature =
      url.searchParams.has('X-Amz-Algorithm') ||
      url.searchParams.has('X-Amz-Credential') ||
      url.searchParams.has('X-Amz-Signature');

    // Signed links often expire; strip signature params to try public object URL first.
    if (hasAwsSignature) {
      url.search = '';
    }

    return url.toString();
  } catch {
    // If URL parsing throws but we constructed it, still return it.
    return trimmed;
  }
};

export const getProductImageUrl = (
  images?: Array<string | null | undefined>,
  fallback: string = DEFAULT_PRODUCT_PLACEHOLDER
): string => {
  if (!Array.isArray(images)) return fallback;

  for (const candidate of images) {
    const normalized = sanitizeImageUrl(candidate);
    if (normalized) return normalized;
  }

  return fallback;
};

export const getSingleImageUrl = (
  image?: string | null,
  fallback: string = DEFAULT_PRODUCT_PLACEHOLDER
): string => {
  return sanitizeImageUrl(image) || fallback;
};

