/** Homepage fallbacks when API has no category/brand media yet. */
export const CATEGORY_IMAGE_FALLBACK: Record<string, string> = {
  electronics:
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&h=400&q=80',
  'mobiles-tablets':
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=400&q=80',
  'computers-laptops':
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&h=400&q=80',
  fashion:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=400&h=400&q=80',
  'home-living':
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&h=400&q=80',
  'beauty-personal-care':
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&h=400&q=80',
  'sports-outdoors':
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=400&h=400&q=80',
  groceries:
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&h=400&q=80',
  'toys-kids':
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?auto=format&fit=crop&w=400&h=400&q=80',
  automotive:
    'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&h=400&q=80'
};

export const BRAND_LOGO_FALLBACK: Record<string, string> = {
  apple: 'https://cdn.simpleicons.org/apple/111111',
  samsung: 'https://cdn.simpleicons.org/samsung/1428A0',
  xiaomi: 'https://cdn.simpleicons.org/xiaomi/FF6900',
  sony: 'https://cdn.simpleicons.org/sony/000000',
  huawei: 'https://cdn.simpleicons.org/huawei/CF0A2C',
  nike: 'https://cdn.simpleicons.org/nike/111111',
  adidas: 'https://cdn.simpleicons.org/adidas/000000',
  anker: 'https://cdn.simpleicons.org/anker/00A0E9',
  asus: 'https://cdn.simpleicons.org/asus/000000',
  bosch: 'https://cdn.simpleicons.org/bosch/EA0016',
  canon: 'https://cdn.simpleicons.org/canon/D21235',
  dell: 'https://cdn.simpleicons.org/dell/007DB8',
  dyson: 'https://logo.clearbit.com/dyson.com',
  google: 'https://cdn.simpleicons.org/google/4285F4',
  hp: 'https://cdn.simpleicons.org/hp/0096D6',
  jbl: 'https://logo.clearbit.com/jbl.com',
  lenovo: 'https://cdn.simpleicons.org/lenovo/E2231A',
  lg: 'https://cdn.simpleicons.org/lg/A50034',
  logitech: 'https://cdn.simpleicons.org/logitech/00B8FC',
  microsoft: 'https://cdn.simpleicons.org/microsoft/737373',
  nintendo: 'https://cdn.simpleicons.org/nintendo/E60012',
  panasonic: 'https://cdn.simpleicons.org/panasonic/0057B8',
  philips: 'https://cdn.simpleicons.org/philips/0A5C99',
  razor: 'https://cdn.simpleicons.org/razer/00FF00',
  razer: 'https://cdn.simpleicons.org/razer/00FF00',
  tplink: 'https://cdn.simpleicons.org/tplink/DE1E1E',
  'tp-link': 'https://cdn.simpleicons.org/tplink/DE1E1E',
  ugreen: 'https://logo.clearbit.com/ugreen.com',
  'generic-unbranded': 'https://cdn.simpleicons.org/shopify/96BF48'
};

/** Initials avatar when source site has no brand image. */
export function brandInitialsAvatar(name?: string | null): string {
  const label = (name || 'Brand').trim() || 'Brand';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label.slice(0, 32))}&background=E11D48&color=ffffff&size=128&bold=true&format=png`;
}

export function categoryImageFallback(slug?: string | null, name?: string | null): string | null {
  const key = (slug || '').trim().toLowerCase();
  if (key && CATEGORY_IMAGE_FALLBACK[key]) return CATEGORY_IMAGE_FALLBACK[key];
  const fromName = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return CATEGORY_IMAGE_FALLBACK[fromName] || null;
}

export function brandLogoFallback(slug?: string | null, name?: string | null): string | null {
  const key = (slug || '').trim().toLowerCase();
  if (key && BRAND_LOGO_FALLBACK[key]) return BRAND_LOGO_FALLBACK[key];
  const fromName = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (fromName && BRAND_LOGO_FALLBACK[fromName]) return BRAND_LOGO_FALLBACK[fromName];
  // Partial match for names like "Apple Inc"
  for (const [k, url] of Object.entries(BRAND_LOGO_FALLBACK)) {
    if (fromName.includes(k) || key.includes(k)) return url;
  }
  return null;
}

/** Prefer API logo, then known brand CDN, never blank EG for named brands. */
export function resolveBrandLogoUrl(logoUrl?: string | null, slug?: string | null, name?: string | null): string {
  const resolved = (logoUrl || '').trim();
  if (resolved && !resolved.includes('picsum.photos')) {
    return resolved;
  }
  return brandLogoFallback(slug, name) || brandInitialsAvatar(name);
}
