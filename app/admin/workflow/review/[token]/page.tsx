import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { getActiveBackgrounds } from '@/lib/backgrounds';
import ReviewClient from '@/app/review/[token]/ReviewClient';

export const dynamic = 'force-dynamic';

interface ReviewData {
  id: number;
  article_id: number | null;
  status: string;
  subject: string;
  drive_link: string;
  image_url: string;
  is_test: number;
  titre: string | null;
  extrait: string | null;
  contenu: string | null;
  statut: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  canonical_url: string | null;
  image_title: string | null;
  image_subtitle: string | null;
}

export default async function AdminReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const { token } = await params;

  let review: ReviewData | null = null;
  try {
    review = await queryOne<ReviewData>(
      `SELECT r.id, r.article_id, r.status, r.subject, r.drive_link, r.image_url, r.is_test,
              a.titre, a.extrait, a.contenu, a.statut,
              a.meta_title, a.meta_description, a.meta_keywords, a.canonical_url,
              a.image_title, a.image_subtitle
       FROM article_reviews r
       LEFT JOIN articles a ON a.id = r.article_id
       WHERE r.token = ? LIMIT 1`,
      [token],
    );
  } catch {
    review = null;
  }

  if (!review) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <a href="/admin/workflow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#004a99', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
          Retour au workflow
        </a>
        <p style={{ color: '#64748b' }}>Ce lien de validation est invalide ou a expire.</p>
      </div>
    );
  }

  const backgrounds = await getActiveBackgrounds();
  return <ReviewClient token={token} review={review} admin showNotifications={session.user.role === 'admin'} backgrounds={backgrounds} />;
}
