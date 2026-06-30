import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';
import { landingSlugs } from '@/lib/landings';

const SITE_URL = 'https://www.tenderwise.fr';

interface SlugRow { slug: string; date_publication?: string; created_at?: string; }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${SITE_URL}/expertise`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/qui-sommes-nous`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/realisations`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/carriere`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Cluster de landing pages SEO (AMO local/régional/national + pages métier)
  const landingRoutes: MetadataRoute.Sitemap = landingSlugs.map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: slug === 'amo-france' ? 0.9 : 0.85,
  }));

  try {
    const [articles, projects] = await Promise.all([
      query<SlugRow>(`SELECT slug, date_publication FROM articles WHERE statut = 'publie' ORDER BY date_publication DESC`),
      query<SlugRow>(`SELECT slug, created_at FROM projects WHERE statut = 'active' AND slug IS NOT NULL ORDER BY created_at DESC LIMIT 200`).catch(() => [] as SlugRow[]),
    ]);

    const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
      url: `${SITE_URL}/blog/${a.slug}`,
      lastModified: a.date_publication ? new Date(a.date_publication) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));

    const projetRoutes: MetadataRoute.Sitemap = projects.map((p) => ({
      url: `${SITE_URL}/realisations/${p.slug}`,
      lastModified: p.created_at ? new Date(p.created_at) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }));

    return [...staticRoutes, ...landingRoutes, ...articleRoutes, ...projetRoutes];
  } catch {
    return [...staticRoutes, ...landingRoutes];
  }
}
