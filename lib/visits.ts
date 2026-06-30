/**
 * Analyse légère, sans dépendance, des métadonnées de visite :
 *   - user-agent → appareil (mobile/tablet/desktop), navigateur, OS
 *   - referrer   → source de trafic (google, social, direct, referral…)
 *
 * Conçu pour la mesure d'audience 1ʳᵉ partie (table site_visits).
 */

export interface UaInfo { device: 'mobile' | 'tablet' | 'desktop' | 'bot'; browser: string; os: string; }

export function parseUserAgent(ua: string): UaInfo {
  const s = ua || '';
  const low = s.toLowerCase();

  // Appareil
  let device: UaInfo['device'] = 'desktop';
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless/i.test(s)) device = 'bot';
  else if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(s)) device = 'tablet';
  else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(s)) device = 'mobile';

  // Navigateur (ordre important : Edge/Opera avant Chrome, Chrome avant Safari)
  let browser = 'Autre';
  if (/edg(e|a|ios)?\//i.test(s)) browser = 'Edge';
  else if (/opr\/|opera/i.test(s)) browser = 'Opera';
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung Internet';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/safari/i.test(s)) browser = 'Safari';
  else if (/msie|trident/i.test(s)) browser = 'Internet Explorer';

  // OS
  let os = 'Autre';
  if (/windows phone/i.test(s)) os = 'Windows Phone';
  else if (/windows/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(low)) os = 'iOS';
  else if (/mac os x|macintosh/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';

  return { device, browser, os };
}

export interface RefInfo { source: string; detail: string | null; }

const SEARCH_ENGINES: Record<string, string> = {
  google: 'google', bing: 'bing', 'duckduckgo': 'duckduckgo', yahoo: 'yahoo',
  ecosia: 'ecosia', qwant: 'qwant', yandex: 'yandex', baidu: 'baidu', brave: 'brave',
};
const SOCIALS_GENERIC = ['facebook', 'instagram', 'youtube', 'tiktok', 'pinterest', 'reddit', 'snapchat', 'whatsapp', 'telegram'];

/**
 * Détermine la source de trafic à partir du referrer et du hostname du site.
 * @param referrer URL de provenance (document.referrer)
 * @param selfHost hostname du site lui-même (pour exclure le trafic interne)
 */
export function parseReferrer(referrer: string, selfHost: string): RefInfo {
  if (!referrer) return { source: 'direct', detail: null };
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return { source: 'direct', detail: null }; }

  if (!host) return { source: 'direct', detail: null };
  if (selfHost && host === selfHost.replace(/^www\./, '')) return { source: 'internal', detail: host };

  for (const key of Object.keys(SEARCH_ENGINES)) {
    if (host.includes(key)) return { source: SEARCH_ENGINES[key], detail: host };
  }
  if (host.includes('linkedin')) return { source: 'linkedin', detail: host };
  for (const soc of SOCIALS_GENERIC) {
    if (host.includes(soc)) return { source: 'social', detail: host };
  }
  return { source: 'referral', detail: host };
}

