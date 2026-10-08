import { environment } from '../../../environments/environment';

/**
 * Resolves any relative or partial image URL into a full URL served by the backend API.
 * Absolute / CDN / data URLs are returned as-is (never rewrite with /uploads/).
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already an absolute URL or data/blob URI — do not rewrite
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('//')
  ) {
    return trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  }

  const host = (environment.apiUrl || 'https://api.esellerglobal.com/api/v1')
    .replace(/\/api\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (path.toLowerCase().startsWith('/uploads')) {
    return `${host}${path}`;
  }

  return `${host}/uploads${path}`;
}
