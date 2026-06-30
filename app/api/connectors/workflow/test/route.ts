import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getBaseUrl } from '@/lib/google';
import { runArticleWorkflow } from '@/lib/workflow';

/**
 * Lance le workflow en MODE TEST : article + image factices (aucun token Gemini),
 * mais Drive + e-mail + notification réels pour valider tout le circuit.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let subject = 'Test du workflow TenderWise';
  try {
    const body = await req.json();
    if (body?.subject) subject = String(body.subject);
  } catch { /* corps optionnel */ }

  const result = await runArticleWorkflow({
    subject,
    baseUrl: getBaseUrl(req),
    test: true,
    source: 'test',
    requestedBy: session.user.name,
  });

  return NextResponse.json(result);
}
