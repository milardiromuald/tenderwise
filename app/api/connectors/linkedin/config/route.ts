import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setSetting } from '@/lib/settings';
import {
  getLinkedInStatus, getLinkedInOrgs, normalizeOrgUrn,
  fetchOrganizationName, getLinkedInToken,
} from '@/lib/linkedin';
import { encrypt } from '@/lib/encrypt';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const status = await getLinkedInStatus(req);
  return NextResponse.json(status);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // ── Identifiants OAuth : app « Compte personnel » ──
  if (body.clientId !== undefined) {
    await setSetting('linkedin_client_id', (body.clientId as string).trim());
  }
  if (body.clientSecret !== undefined) {
    const secret = (body.clientSecret as string).trim();
    await setSetting('linkedin_client_secret', secret ? encrypt(secret) : '');
  }

  // ── Identifiants OAuth : app « Page entreprise » (Community Management) ──
  if (body.orgClientId !== undefined) {
    await setSetting('linkedin_org_client_id', (body.orgClientId as string).trim());
  }
  if (body.orgClientSecret !== undefined) {
    const secret = (body.orgClientSecret as string).trim();
    await setSetting('linkedin_org_client_secret', secret ? encrypt(secret) : '');
  }

  // ── Sélection de la Page active (parmi celles dont le compte est admin) ──
  if (body.orgUrn !== undefined) {
    const urn = (body.orgUrn as string).trim();
    const orgs = await getLinkedInOrgs();
    const match = orgs.find(o => o.urn === urn);
    await setSetting('linkedin_org_urn',  urn);
    await setSetting('linkedin_org_name', match?.name || '');
  }

  // ── Saisie MANUELLE de la Page (repli si la détection auto ne renvoie rien) ──
  // Accepte URN, ID numérique ou URL admin. On résout le nom (jeton Page) et on
  // ajoute la Page à la liste pour qu'elle apparaisse dans le sélecteur.
  if (body.orgUrnManual !== undefined) {
    const urn = normalizeOrgUrn(String(body.orgUrnManual || ''));
    if (!urn) {
      return NextResponse.json(
        { error: 'Identifiant de Page non reconnu. Indiquez l’URN (urn:li:organization:1234), l’ID numérique, ou l’URL d’admin de la Page contenant l’ID.' },
        { status: 400 },
      );
    }
    let name = urn;
    try {
      const token = await getLinkedInToken('organization');
      if (token) name = await fetchOrganizationName(token, urn);
    } catch { /* nom non résolu — on garde l'URN/ID */ }
    const orgs = await getLinkedInOrgs();
    if (!orgs.some(o => o.urn === urn)) orgs.push({ urn, name });
    await setSetting('linkedin_orgs',     JSON.stringify(orgs));
    await setSetting('linkedin_org_urn',  urn);
    await setSetting('linkedin_org_name', name);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Déconnecte une connexion (jeton seul ; les identifiants OAuth sont conservés).
 *   DELETE ?which=person        → déconnecte le compte personnel
 *   DELETE ?which=organization  → déconnecte la Page entreprise (+ purge Pages)
 *   DELETE                      → déconnecte les DEUX (compat héritée)
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const which = req.nextUrl.searchParams.get('which');

  const clearPerson = async () => {
    await Promise.all([
      setSetting('linkedin_access_token',     ''),
      setSetting('linkedin_person_urn',       ''),
      setSetting('linkedin_email',            ''),
      setSetting('linkedin_name',             ''),
      setSetting('linkedin_token_expires_at', ''),
    ]);
  };

  const clearOrg = async () => {
    await Promise.all([
      setSetting('linkedin_org_access_token',     ''),
      setSetting('linkedin_org_token_expires_at', ''),
      // La liste des Pages et la sélection dépendent du jeton Page → purge.
      setSetting('linkedin_orgs',                 ''),
      setSetting('linkedin_org_urn',              ''),
      setSetting('linkedin_org_name',             ''),
    ]);
  };

  if (which === 'person')            await clearPerson();
  else if (which === 'organization') await clearOrg();
  else                               await Promise.all([clearPerson(), clearOrg()]);

  return NextResponse.json({ ok: true });
}
