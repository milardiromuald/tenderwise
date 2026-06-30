import { queryOne } from '@/lib/db';
import { getActiveBackgrounds } from '@/lib/backgrounds';
import { extractQuality } from '@/lib/reviewQuality';
import ReviewClient from './ReviewClient';

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
  steps_log: string | null;
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ action?: string }>;
}) {
  const { token } = await params;
  // Action transmise par les boutons de l'e-mail de validation (?action=approve|reject).
  const sp = searchParams ? await searchParams : {};
  const initialAction = sp.action === 'approve' || sp.action === 'reject' ? sp.action : undefined;

  let review: ReviewData | null = null;
  try {
    review = await queryOne<ReviewData>(
      `SELECT r.id, r.article_id, r.status, r.subject, r.drive_link, r.image_url, r.is_test, r.steps_log,
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
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 20px', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: '#0f172a' }}>Lien invalide</h1>
        <p style={{ color: '#64748b' }}>Ce lien de validation n’existe pas ou a expiré.</p>
      </div>
    );
  }

  const backgrounds = await getActiveBackgrounds();
  const quality = extractQuality(review.steps_log);
  return <ReviewClient token={token} review={review} backgrounds={backgrounds} initialAction={initialAction} quality={quality} />;
}
