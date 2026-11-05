// Countries where market features are switched off. ISO 3166-1 alpha-2 codes, upper case.
// Starting list: the United States plus comprehensively sanctioned jurisdictions. Edit to taste.
export const RESTRICTED_COUNTRIES = ['US', 'CU', 'IR', 'KP', 'SY', 'RU', 'BY'];

// Unknown country (no IP geolocation and no usable browser locale) counts as restricted.
export function isRestricted(code) {
  if (!code) return true;
  return RESTRICTED_COUNTRIES.includes(code.toUpperCase());
}
