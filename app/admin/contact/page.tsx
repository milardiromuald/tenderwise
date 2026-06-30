export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import ContactMessagesClient from './ContactMessagesClient';

interface MsgRow {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  societe: string | null;
  objet: string;
  message_preview: string;
  statut: 'nouveau' | 'lu' | 'archive';
  rgpd_consent: number;
  created_at: string;
}

interface CountRow { statut: string; c: number }

export default async function AdminContactPage() {
  const session = await getSession();
  if (!session) redirect('/admin/login');

  const [messages, countRows] = await Promise.all([
    query<MsgRow>(
      `SELECT id, nom, email, telephone, societe, objet,
              LEFT(message, 160) as message_preview,
              statut, rgpd_consent, created_at
       FROM contact_messages
       ORDER BY created_at DESC
       LIMIT 100`
    ),
    query<CountRow>(
      'SELECT statut, COUNT(*) as c FROM contact_messages GROUP BY statut'
    ),
  ]).catch(() => [[], []]);

  const counts: Record<string, number> = {};
  (countRows as CountRow[]).forEach((r) => { counts[r.statut] = Number(r.c); });

  return (
    <ContactMessagesClient
      initialMessages={messages as MsgRow[]}
      counts={counts}
    />
  );
}
