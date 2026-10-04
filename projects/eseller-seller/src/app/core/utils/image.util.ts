import { environment } from '../../../environments/environment';

/**
 * Resolves any relative or partial image URL into a full URL served by the backend API.
 * Handles paths starting with `/uploads/`, `/shops/`, `/products/`, or relative paths,
 * as well as existing absolute HTTP/HTTPS or data URLs.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already an absolute URL or data/blob URI
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Extract host from environment.apiUrl (e.g. 'https://localhost:7127')
  const host = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // If already prefixed with /uploads/, return host + path
  if (path.startsWith('/uploads/')) {
    return `${host}${path}`;
  }

  // Otherwise prefix with /uploads (e.g. /shops/xxx -> /uploads/shops/xxx)
  return `${host}/uploads${path}`;
}
