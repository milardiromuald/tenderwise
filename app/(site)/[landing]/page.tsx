import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import LandingPageView from '@/components/LandingPage';
import { getLanding, landingSlugs, landingMetadata } from '@/lib/landings';

// Seuls les slugs connus du cluster sont servis ; tout autre segment → 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return landingSlugs.map((landing) => ({ landing }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ landing: string }> }
): Promise<Metadata> {
  const { landing } = await params;
  return landingMetadata(landing);
}

export default async function LandingRoute(
  { params }: { params: Promise<{ landing: string }> }
) {
  const { landing } = await params;
  const data = getLanding(landing);
  if (!data) notFound();
  return <LandingPageView data={data} />;
}
