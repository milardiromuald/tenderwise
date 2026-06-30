import type { Metadata } from 'next';
import './globals.css';
import Providers from './Providers';
import CookieConsent from '@/components/CookieConsent';
import VisitTracker from '@/components/VisitTracker';
import { getAllSettings } from '@/lib/settings';

const SITE_URL = 'https://www.tenderwise.fr';

const DEFAULT_TITLE = 'TenderWise — AMO, Facility Management & Réhabilitation';
const DEFAULT_DESC = 'TenderWise accompagne investisseurs et propriétaires immobiliers en AMO : faisabilité, conduite d\'opération, facility management et gestion de patrimoine à Lyon.';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getAllSettings();
    const icons: Metadata['icons'] = {};

    if (settings.favicon_url) {
      icons.icon = settings.favicon_url;
      icons.shortcut = settings.favicon_url;
    }
    if (settings.apple_touch_icon_url) {
      icons.apple = settings.apple_touch_icon_url;
    }

    const title = settings.meta_title || DEFAULT_TITLE;
    const description = settings.meta_description || DEFAULT_DESC;
    const ogImage = settings.og_image || '/og-image.png';

    return {
      metadataBase: new URL(SITE_URL),
      title: { default: title, template: '%s — TenderWise' },
      description,
      keywords: 'AMO, assistance maîtrise ouvrage, facility management, réhabilitation immobilière, conduite opération, gestion patrimoine, Lyon, Villeurbanne',
      authors: [{ name: 'TenderWise', url: SITE_URL }],
      creator: 'TenderWise',
      publisher: 'TenderWise',
      robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
      alternates: { canonical: SITE_URL },
      openGraph: {
        type: 'website',
        locale: 'fr_FR',
        url: SITE_URL,
        siteName: 'TenderWise',
        title,
        description,
        images: [{ url: ogImage, width: 1200, height: 630, alt: 'TenderWise — AMO & Facility Management' }],
      },
      ...(Object.keys(icons).length > 0 ? { icons } : {}),
    };
  } catch {
    return {
      metadataBase: new URL(SITE_URL),
      title: { default: DEFAULT_TITLE, template: '%s — TenderWise' },
      description: DEFAULT_DESC,
      alternates: { canonical: SITE_URL },
    };
  }
}

function buildOrganizationSchema(settings: Record<string, string>) {
  const name        = settings.company_name || 'TenderWise';
  const email       = settings.contact_email || 'contact@tenderwise.fr';
  const phone       = settings.contact_phone?.trim();
  const address     = settings.contact_address || '54 Avenue Général Leclerc, 69100 Villeurbanne, France';
  const ogImage     = settings.og_image || `${SITE_URL}/og-image.png`;

  const addrParts = address.split(',').map(s => s.trim());

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name,
        legalName: 'TENDER WISE SAS',
        url: SITE_URL,
        description: 'Expert indépendant en Assistance à Maîtrise d\'Ouvrage (AMO), facility management et réhabilitation immobilière.',
        address: {
          '@type': 'PostalAddress',
          streetAddress: addrParts[0] || address,
          addressLocality: addrParts[1] || 'Villeurbanne',
          postalCode: addrParts[2] || '69100',
          addressCountry: 'FR',
        },
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          email,
          ...(phone ? { telephone: phone } : {}),
          availableLanguage: 'French',
        },
        areaServed: { '@type': 'Country', name: 'France' },
        knowsAbout: ['Assistance à Maîtrise d\'Ouvrage', 'Facility Management', 'Réhabilitation Immobilière', 'Gestion de Patrimoine', 'Conduite d\'Opération'],
        ...(settings.social_linkedin ? { sameAs: [settings.social_linkedin] } : {}),
      },
      {
        '@type': 'LocalBusiness',
        '@id': `${SITE_URL}/#localbusiness`,
        name,
        url: SITE_URL,
        image: ogImage,
        ...(phone ? { telephone: phone } : {}),
        email,
        priceRange: '€€€',
        address: {
          '@type': 'PostalAddress',
          streetAddress: addrParts[0] || address,
          addressLocality: addrParts[1] || 'Villeurbanne',
          postalCode: addrParts[2] || '69100',
          addressCountry: 'FR',
        },
        geo: { '@type': 'GeoCoordinates', latitude: 45.7676, longitude: 4.8718 },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '09:00',
          closes: '18:00',
        },
      },
    ],
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getAllSettings().catch(() => ({} as Record<string, string>));
  const organizationSchema = buildOrganizationSchema(settings);

  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Layout racine : la police est chargée pour tout le site, et le CSS
            référence les familles par leur nom littéral — next/font ne s’applique pas ici. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Open+Sans:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Bandeau cookies — monté au niveau racine pour couvrir TOUTES les pages
            publiques (la page d’accueil app/page.tsx n’utilise pas le layout (site)).
            Le composant s’auto-masque sur /admin et /review. */}
        <CookieConsent settings={settings} />
        <VisitTracker />
      </body>
    </html>
  );
}
