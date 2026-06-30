import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Proxy applicatif (anciennement « middleware », renommé à partir de Next.js 16).
 *
 * Deux responsabilités :
 *
 * 1. Canonicalisation de l'hôte → www.tenderwise.fr (tout en amont).
 *    Le .htaccess CloudLinux/LiteSpeed ne redirige pas de façon fiable les
 *    requêtes servies par l'app Node (Passenger), laissant passer le domaine
 *    apex (tenderwise.fr). Or un flux OAuth ou une session démarré sur l'apex
 *    casse à la fois le redirect_uri LinkedIn et le cookie de session (scopé
 *    sur www). On force donc la canonicalisation ici, dans l'app.
 *
 * 2. Protection de toutes les routes /admin/* en amont du rendu.
 *    • Garantit qu'AUCUNE page admin n'est rendue sans session valide, même au
 *      retour-arrière navigateur.
 *    • `Cache-Control: no-store` retire les pages admin du bfcache.
 *    getToken (next-auth/jwt) est compatible Edge et respecte l'expiration du
 *    JWT, y compris l'expiration anticipée « 8 h » du mode sans « rester connecté ».
 */

const CANONICAL_HOST = 'www.tenderwise.fr';

export async function proxy(req: NextRequest) {
  // ── 1. Canonicalisation de l'hôte ──────────────────────────────────────────
  const host =
    req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    req.headers.get('host') ||
    '';

  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  if (host && host !== CANONICAL_HOST && !isLocal) {
    const url = req.nextUrl.clone();
    url.host     = CANONICAL_HOST;
    url.protocol = 'https:';
    url.port     = '';
    return NextResponse.redirect(url, 308);
  }

  // ── 2. Protection des routes /admin/* ───────────────────────────────────────
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthed = !!token;
  const isLoginPage = pathname === '/admin/login';

  // Page de connexion : un utilisateur déjà authentifié n'a rien à y faire.
  if (isLoginPage) {
    if (isAuthed) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  }

  // Toute autre route /admin/* sans session → redirection vers la connexion,
  // avec mémorisation de la destination voulue (?from=).
  if (!isAuthed) {
    const loginUrl = new URL('/admin/login', req.url);
    if (pathname !== '/admin') loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authentifié : on poursuit, mais on interdit la mise en cache de la page
  // (sécurité + correction du rendu partiel au retour arrière).
  const res = NextResponse.next();
  res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return res;
}

export const config = {
  // S'applique à tout le site (pour la canonicalisation), sauf assets statiques
  // et fichiers Next internes. La logique d'auth se limite à /admin en interne.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)'],
};
