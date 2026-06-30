import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

function buildCsp(isDev: boolean): string {
  return [
    "default-src 'self'",
    // Next.js injecte des scripts inline pour l’hydratation + JSON-LD via dangerouslySetInnerHTML.
    // React en mode développement (HMR, react-server-dom) a besoin de ‘unsafe-eval’ — ajouté en dev uniquement.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // Styles inline React + Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Fontes Google
    "font-src 'self' https://fonts.gstatic.com",
    // Images : domaines CDN Unsplash + uploads locaux
    "img-src 'self' data: blob: https: http:",
    // Requêtes XHR/fetch : API interne uniquement (ipapi.co appelé côté serveur, pas navigateur)
    "connect-src 'self'",
    // Partages réseaux sociaux via window.open (LinkedIn, X) — ne nécessite pas frame-src
    "frame-src 'none'",
    // Pas d’iframes de domaines tiers
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function buildSecurityHeaders(isDev: boolean) {
  return [
    // Content Security Policy
    { key: 'Content-Security-Policy', value: buildCsp(isDev) },
    // Empêche le clickjacking (iframes de domaines tiers)
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    // Empêche le MIME-sniffing
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Contrôle les informations envoyées au referrer
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Désactive les fonctionnalités navigateur inutilisées
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    // Force HTTPS pendant 2 ans (HSTS)
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    // Préchargement DNS
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ];
}

export default function config(phase: string): NextConfig {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  return {
    serverExternalPackages: ['mysql2', 'bcryptjs', 'nodemailer', 'sharp'],
    generateBuildId: async () => `build-${Date.now()}`,
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: '**' },
      ],
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: buildSecurityHeaders(isDev),
        },
      ];
    },
  };
}
