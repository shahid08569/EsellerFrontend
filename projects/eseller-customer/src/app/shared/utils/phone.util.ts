import { COUNTRIES_DATA } from '../data/countries-states.data';

/** Dial codes longest-first so +971 wins over +97, etc. */
const DIAL_CODES = [...new Set(
  COUNTRIES_DATA.map((c) => c.phoneCode).filter((c): c is string => !!c)
)].sort((a, b) => b.length - a.length);

/**
 * Strip any country dial code (+92, +971, 0092, …) so the phone input
 * only holds the local number. Dial code is shown separately in the UI.
 */
export function toLocalPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  const compact = trimmed.replace(/[\s\-().]/g, '');

  for (const code of DIAL_CODES) {
    if (compact.startsWith(code)) {
      return compact.slice(code.length);
    }
    const digits = code.replace(/\D/g, '');
    if (digits && compact.startsWith('00' + digits)) {
      return compact.slice(2 + digits.length);
    }
  }

  // Generic international prefix not in our list
  const generic = compact.match(/^\+(\d{1,4})(\d{6,})$/);
  if (generic) return generic[2];

  // Leading +code with spaces already removed above; strip leftover "+NN "
  return trimmed.replace(/^\+\d{1,4}\s*/, '').trim();
}
