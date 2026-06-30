import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { queryOne } from './db';
import { checkRateLimit } from './rateLimit';
import { logLoginAttempt } from './loginAudit';

// ─── Session durations ────────────────────────────────────────────────────────
const REMEMBER_MAX_AGE    = 10 * 24 * 60 * 60; // 10 days (seconds)
const NO_REMEMBER_MAX_AGE =  8 * 60 * 60;       //  8 hours (seconds) — "no remember me"

// ─── Dummy bcrypt hash for constant-time comparison when user doesn't exist ───
// Prevents timing side-channel that reveals whether a username exists
const DUMMY_HASH = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfMkGUqnHPR5mCkM2';

// ─── Extract client IP from request headers ───────────────────────────────────
function extractIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first.split(',')[0].trim().slice(0, 64);
  }
  return 'unknown';
}

// ─── NextAuth configuration ───────────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Identifiant', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
        remember: { label: 'Rester connecté', type: 'text' },
      },
      async authorize(credentials, req) {
        const username  = credentials?.username?.trim() ?? '';
        const password  = credentials?.password ?? '';
        const remember  = credentials?.remember === 'true';

        // Safely extract IP and User-Agent from the internal NextAuth req object
        const hdrs      = (req?.headers ?? {}) as Record<string, string | string[] | undefined>;
        const ip        = extractIp(hdrs);
        const userAgent = String(hdrs['user-agent'] ?? '').slice(0, 500);

        // ── Rate limiting ─────────────────────────────────────────────────────
        // Per-IP: max 5 attempts per 15 minutes
        // Per-username: max 10 attempts per 30 minutes (anti rotating-IP)
        const [ipOk, userOk] = await Promise.all([
          checkRateLimit(`login:ip:${ip}`, 5, 15 * 60_000),
          username
            ? checkRateLimit(`login:user:${username.toLowerCase()}`, 10, 30 * 60_000)
            : Promise.resolve(true),
        ]);

        if (!ipOk || !userOk) {
          await logLoginAttempt({ username, ip, userAgent, success: false, reason: 'rate_limited' });
          return null;
        }

        if (!username || !password) {
          await logLoginAttempt({ username, ip, userAgent, success: false, reason: 'missing_credentials' });
          return null;
        }

        try {
          const user = await queryOne<{
            id: number;
            username: string;
            password: string;
            role: string;
            is_active?: number | boolean;
          }>(
            'SELECT id, username, password, role, is_active FROM users WHERE username = ? LIMIT 1',
            [username]
          );

          // Always run bcrypt.compare — prevents timing attacks that reveal username existence
          const hashToCheck = user?.password ?? DUMMY_HASH;
          const isValid = await bcrypt.compare(password, hashToCheck);

          if (!user || !isValid) {
            await logLoginAttempt({ username, ip, userAgent, success: false, reason: !user ? 'unknown_user' : 'wrong_password' });
            return null;
          }

          if (user.is_active !== undefined && Number(user.is_active) === 0) {
            await logLoginAttempt({ username, ip, userAgent, success: false, reason: 'account_disabled' });
            return null;
          }

          await logLoginAttempt({ username, ip, userAgent, success: true, reason: 'ok' });

          return {
            id:       String(user.id),
            name:     user.username,
            email:    user.username,
            role:     user.role,
            remember: remember ? 'true' : 'false',
          } as { id: string; name: string; email: string; role: string; remember: string };
        } catch (err) {
          console.error('[auth] authorize error:', err);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: REMEMBER_MAX_AGE, // 10 days — JWT token lifetime ceiling
  },

  pages: { signIn: '/admin/login' },

  // NextAuth sets httpOnly, secure (prod), sameSite:lax and maxAge (from session.maxAge) by default.
  // No need to override the cookies block — doing so requires a `name` field that varies by env.

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { role?: string; remember?: string };
        token.role     = u.role;
        token.remember = u.remember;

        // "No remember me" → override JWT exp to 8 hours from now
        // The cookie persists 10 days but decode() will reject the expired JWT
        // effectively logging the user out after 8 hours of inactivity
        if (u.remember === 'false') {
          token.exp = Math.floor(Date.now() / 1000) + NO_REMEMBER_MAX_AGE;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET ??
    (() => { throw new Error('[FATAL] NEXTAUTH_SECRET is not set'); })(),
};

// ─── Server-side session helper ───────────────────────────────────────────────
export async function getSession(): Promise<{ user: { name: string; role: string } } | null> {
  const cookieStore = await cookies();
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const tokenCookie =
    cookieStore.get('next-auth.session-token') ??
    cookieStore.get('__Secure-next-auth.session-token');

  if (!tokenCookie?.value) return null;

  try {
    const decoded = await decode({ token: tokenCookie.value, secret });
    if (!decoded) return null;

    // Respect the exp claim — handles the "no remember me" early expiry
    if (decoded.exp && (decoded.exp as number) < Math.floor(Date.now() / 1000)) return null;

    return {
      user: {
        name: (decoded.name as string) ?? '',
        role: (decoded.role as string) ?? 'user',
      },
    };
  } catch {
    return null;
  }
}
