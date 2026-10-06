/**
 * Allows only relative in-app paths. Rejects absolute URLs, protocol-relative, and javascript: schemes.
 */
export function sanitizeAppPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  const lower = path.toLowerCase();
  if (lower.includes('://') || lower.startsWith('/javascript:') || lower.startsWith('/data:')) {
    return null;
  }
  return path;
}

/**
 * Collapse entity detail paths that apps don't route yet, keep list + query.
 * Also map chat deep-link aliases.
 */
export function normalizeNotificationPath(
  raw: string | null | undefined,
  mode: 'admin' | 'seller'
): string | null {
  const path = sanitizeAppPath(raw);
  if (!path) return null;

  const [routePart, qs = ''] = path.split('?');
  const params = new URLSearchParams(qs);

  // Chat: backend uses ?c= ; admin inbox uses targetId; seller uses support
  if (routePart === '/chat') {
    const conversationId = params.get('c') || params.get('targetId') || params.get('support');
    if (conversationId) {
      if (mode === 'admin') {
        return `/chat?targetId=${encodeURIComponent(conversationId)}`;
      }
      return `/chat?support=${encodeURIComponent(conversationId)}`;
    }
    return '/chat';
  }

  // Strip /resource/{guid} → /resource (no detail routes yet)
  const detailMatch = routePart.match(
    /^\/(sellers|customers|orders|products|shops)\/[0-9a-fA-F-]{36}$/
  );
  if (detailMatch) {
    const base = `/${detailMatch[1]}`;
    if (detailMatch[1] === 'shops' && mode === 'seller') return '/settings';
    if (detailMatch[1] === 'shops' && mode === 'admin') return '/shops';
    return base;
  }

  if (routePart === '/shops' && mode === 'seller') return '/settings';
  if (routePart === '/earnings' && mode === 'admin') return '/finance';

  return path;
}
