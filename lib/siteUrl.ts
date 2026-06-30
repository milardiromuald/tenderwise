/**
 * URL publique canonique du site (avec www).
 *
 * Centralise la constante autrefois codée en dur dans plusieurs fichiers
 * (lib/linkedinShare.ts, app/api/workflow/linkedin-preview). On réutilise la
 * même variable d'environnement que l'OAuth (GOOGLE_OAUTH_BASE_URL) pour rester
 * cohérent avec la canonicalisation www, avec repli sur le domaine de prod.
 */
export const SITE_URL: string = (
  process.env.SITE_URL ||
  process.env.GOOGLE_OAUTH_BASE_URL ||
  'https://www.tenderwise.fr'
).replace(/\/$/, '');
