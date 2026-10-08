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
  bose: 'https://logo.clearbit.com/bose.com',
  canon: 'https://cdn.simpleicons.org/canon/D21235',
  cerave: 'https://logo.clearbit.com/cerave.com',
  coach: 'https://logo.clearbit.com/coach.com',
  columbia: 'https://logo.clearbit.com/columbia.com',
  dell: 'https://cdn.simpleicons.org/dell/007DB8',
  dyson: 'https://logo.clearbit.com/dyson.com',
  fossil: 'https://logo.clearbit.com/fossil.com',
  google: 'https://cdn.simpleicons.org/google/4285F4',
  gopro: 'https://cdn.simpleicons.org/gopro/000000',
  hm: 'https://cdn.simpleicons.org/hm/E50010',
  'h-m': 'https://cdn.simpleicons.org/hm/E50010',
  hp: 'https://cdn.simpleicons.org/hp/0096D6',
  jbl: 'https://logo.clearbit.com/jbl.com',
  lenovo: 'https://cdn.simpleicons.org/lenovo/E2231A',
  levis: 'https://logo.clearbit.com/levi.com',
  "levi's": 'https://logo.clearbit.com/levi.com',
  lg: 'https://cdn.simpleicons.org/lg/A50034',
  logitech: 'https://cdn.simpleicons.org/logitech/00B8FC',
  longchamp: 'https://logo.clearbit.com/longchamp.com',
  lovito: 'https://ui-avatars.com/api/?name=Lovito&background=111827&color=ffffff&size=128&bold=true&format=png',
  loreal: 'https://logo.clearbit.com/loreal.com',
  "l'oréal": 'https://logo.clearbit.com/loreal.com',
  mango: 'https://logo.clearbit.com/mango.com',
  maybelline: 'https://logo.clearbit.com/maybelline.com',
  microsoft: 'https://cdn.simpleicons.org/microsoft/737373',
  nespresso: 'https://logo.clearbit.com/nespresso.com',
  nikon: 'https://cdn.simpleicons.org/nikon/FFE100',
  nintendo: 'https://cdn.simpleicons.org/nintendo/E60012',
  oneplus: 'https://cdn.simpleicons.org/oneplus/F5010C',
  panasonic: 'https://cdn.simpleicons.org/panasonic/0057B8',
  philips: 'https://cdn.simpleicons.org/philips/0A5C99',
  polo: 'https://logo.clearbit.com/ralphlauren.com',
  'polo-ralph-lauren': 'https://logo.clearbit.com/ralphlauren.com',
  puma: 'https://cdn.simpleicons.org/puma/000000',
  razor: 'https://cdn.simpleicons.org/razer/00FF00',
  razer: 'https://cdn.simpleicons.org/razer/00FF00',
  sanrio: 'https://logo.clearbit.com/sanrio.com',
  'the-north-face': 'https://logo.clearbit.com/thenorthface.com',
  'under-armour': 'https://cdn.simpleicons.org/underarmour/1D1D1D',
  uniqlo: 'https://cdn.simpleicons.org/uniqlo/FF0000',
  'urban-outfitters': 'https://logo.clearbit.com/urbanoutfitters.com',
  ugreen: 'https://logo.clearbit.com/ugreen.com',
  tplink: 'https://cdn.simpleicons.org/tplink/DE1E1E',
  'tp-link': 'https://cdn.simpleicons.org/tplink/DE1E1E',
  zara: 'https://logo.clearbit.com/zara.com',
  'generic-unbranded': 'https://cdn.simpleicons.org/shopify/96BF48'
};

const CURATED_KEYS = new Set(Object.keys(BRAND_LOGO_FALLBACK).filter((k) => k !== 'generic-unbranded'));

function brandKey(slug?: string | null, name?: string | null): string {
  return (slug || name || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** True for real consumer brands — hides marketplace junk tags. */
export function isCuratedBrand(
  name?: string | null,
  slug?: string | null,
  logoUrl?: string | null
): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  // Junk marketplace tags / product fragments
  if (
    /[\[\]【】]|SG\s|SELLER|Ready\s?Stock|InStock|spot-free|Pcs\b|Piece\b|Colors\b|Disposable|Panties|Seamless|WITH STRAP|Fast shipping|Nipple|Opiobags|Crossbody|Nylon Bag|Travel Mini|Value Choice|mixshop|Zora|Anaya|HILDAR|ZANZEA|Hijab|Stereoscopic|Extremely Traditional|Fashionable|Imported|Joe Sir|Korean Style|Outside Bag|Pleated|Southeast Asia|Women's$|\$\d|\?\?/i.test(
      n
    )
  ) {
    return false;
  }

  const key = brandKey(slug, name);
  if (CURATED_KEYS.has(key)) return true;
  for (const k of CURATED_KEYS) {
    if (key === k || key.startsWith(k + '-') || key.endsWith('-' + k)) return true;
  }

  // Keep if already has a real CDN logo (not ui-avatars / picsum)
  const logo = (logoUrl || '').toLowerCase();
  if (logo && (logo.includes('simpleicons.org') || logo.includes('clearbit.com'))) return true;

  return false;
}

export function brandInitialsAvatar(name?: string | null): string {
  const label = (name || 'Brand').trim() || 'Brand';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label.slice(0, 32))}&background=111827&color=ffffff&size=128&bold=true&format=png`;
}

export function categoryImageFallback(slug?: string | null, name?: string | null): string | null {
  const key = (slug || '').trim().toLowerCase();
  if (key && CATEGORY_IMAGE_FALLBACK[key]) return CATEGORY_IMAGE_FALLBACK[key];
  const fromName = brandKey(null, name);
  return CATEGORY_IMAGE_FALLBACK[fromName] || null;
}

export function brandLogoFallback(slug?: string | null, name?: string | null): string | null {
  const key = brandKey(slug, name);
  if (key && BRAND_LOGO_FALLBACK[key]) return BRAND_LOGO_FALLBACK[key];
  for (const [k, url] of Object.entries(BRAND_LOGO_FALLBACK)) {
    if (k === 'generic-unbranded') continue;
    if (key.includes(k) || key.startsWith(k + '-')) return url;
  }
  return null;
}

export function resolveBrandLogoUrl(logoUrl?: string | null, slug?: string | null, name?: string | null): string {
  const resolved = (logoUrl || '').trim();
  if (resolved && !resolved.includes('picsum.photos') && !resolved.includes('ui-avatars.com')) {
    return resolved;
  }
  return brandLogoFallback(slug, name) || brandInitialsAvatar(name);
}
