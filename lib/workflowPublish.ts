import { query, execute } from './db';
import { createNotification } from './notifications';
import { shareArticleOnLinkedIn } from './linkedinShare';
import { emitWorkflowUpdate } from './workflowEvents';

/**
 * Publie les articles programmés dont la date d'échéance est atteinte.
 *
 * Appelée à la fois :
 *   - paresseusement, au chargement de GET /api/workflow (filet de sécurité) ;
 *   - par une vraie tâche planifiée via GET /api/cron/publish (recommandé).
 *
 * SÉCURITÉ CONCURRENCE : la mise en ligne se fait par un UPDATE atomique
 * « programme → publie » conditionné sur le statut courant. Seul le premier
 * appel concurrent voit `affectedRows === 1` et exécute la suite (notification,
 * partage LinkedIn). Les appels suivants (autres onglets admin, polling, cron
 * en parallèle) voient `affectedRows === 0` et passent leur tour — plus de
 * double-publication ni de double-notification.
 */
export async function publishDue(): Promise<number> {
  // `li_share` peut ne pas exister (schéma v2 non migré) → variante de repli.
  type Due = { id: number; article_id: number | null; titre: string | null; li_share?: number };
  let due: Due[];
  try {
    due = await query<Due>(
      `SELECT r.id, r.article_id, a.titre, r.li_share
         FROM article_reviews r LEFT JOIN articles a ON a.id = r.article_id
        WHERE r.status = 'programme' AND r.scheduled_at IS NOT NULL AND r.scheduled_at <= NOW()`,
    );
  } catch {
    due = await query<Due>(
      `SELECT r.id, r.article_id, a.titre
         FROM article_reviews r LEFT JOIN articles a ON a.id = r.article_id
        WHERE r.status = 'programme' AND r.scheduled_at IS NOT NULL AND r.scheduled_at <= NOW()`,
    );
  }

  let published = 0;
  for (const d of due) {
    // Claim atomique : garantit une seule publication même si plusieurs appels
    // concurrents ont sélectionné la même ligne ci-dessus.
    const claim = await execute(
      `UPDATE article_reviews SET status = 'publie', published_at = NOW()
        WHERE id = ? AND status = 'programme'`,
      [d.id],
    );
    if (claim.affectedRows !== 1) continue; // déjà publié par un autre appel

    published++;
    if (d.article_id) await execute('UPDATE articles SET statut = ? WHERE id = ?', ['publie', d.article_id]);
    await createNotification({
      type: 'success',
      title: `Article publié automatiquement : ${d.titre ?? ''}`,
      link: d.article_id ? `/admin/articles/${d.article_id}` : '',
    });

    // Partage LinkedIn programmé (si coché à la validation). Non bloquant.
    if (d.li_share) {
      const r = await shareArticleOnLinkedIn(d.id).catch(() => null);
      if (r && !r.skipped) {
        await createNotification(
          r.ok
            ? { type: 'success', title: `Partagé sur LinkedIn : ${d.titre ?? ''}`, link: r.url || '/admin/linkedin' }
            : { type: 'warning', title: `Partage LinkedIn échoué : ${d.titre ?? ''}`, message: r.error || '', link: '/admin/linkedin' },
        );
      }
    }
  }

  // Notifie l'UI temps réel (workflow / validation) si quelque chose a changé.
  if (published > 0) emitWorkflowUpdate();

  return published;
}
