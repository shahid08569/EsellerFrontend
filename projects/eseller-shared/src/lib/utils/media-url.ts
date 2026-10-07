/**
 * Resolve relative upload paths to the API host (never fall back to localhost in prod).
 */
export function resolveMediaUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const raw = String(imageUrl).trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  const apiBase =
    (typeof window !== 'undefined'
      ? ((window as any).__ESELLER_API_URL__ as string | undefined)
      : undefined) ||
    'https://api.esellerglobal.com/api/v1';

  const host = apiBase.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.toLowerCase().startsWith('/uploads')) {
    return `${host}${path}`;
  }
  return `${host}/uploads${path}`;
}
