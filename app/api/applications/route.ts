import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { execute, query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { ALLOWED_DOC_TYPES, ALLOWED_DOC_LABEL, MAX_DOC_SIZE_MB, validateDocMagic, safeFilename } from '@/lib/applications';
import { sendApplicationEmail } from '@/lib/mailer';

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  ).slice(0, 45);
}

function str(v: FormDataEntryValue | null, max = 255): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

interface ValidatedFile { filename: string; mime: string; size: number; buffer: Buffer; }

async function readFile(file: File | null, required: boolean): Promise<ValidatedFile | null | { error: string }> {
  if (!file || file.size === 0) {
    return required ? { error: 'Le CV est obligatoire.' } : null;
  }
  const ext = ALLOWED_DOC_TYPES[file.type];
  if (!ext) return { error: `Format non autorisé (${file.type || 'inconnu'}). Formats acceptés : ${ALLOWED_DOC_LABEL}.` };
  if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) return { error: `Fichier trop lourd (max ${MAX_DOC_SIZE_MB} Mo).` };
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validateDocMagic(buffer, file.type)) return { error: 'Le contenu du fichier ne correspond pas à son extension.' };
  return { filename: safeFilename(file.name, `document.${ext}`), mime: file.type, size: file.size, buffer };
}

/* ── POST (public) — dépôt d’une candidature ─────────────────────────────── */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!await checkRateLimit(`application:${ip}`, 5, 30 * 60 * 1000)) {
    return NextResponse.json({ success: false, errors: ['Trop de candidatures envoyées. Réessayez plus tard.'] }, { status: 429 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ success: false, errors: ['Données invalides.'] }, { status: 400 }); }

  // Honeypot anti-spam
  if (str(form.get('_hp'))) return NextResponse.json({ success: true });

  const nom       = str(form.get('nom'), 120);
  const prenom    = str(form.get('prenom'), 120);
  const email     = str(form.get('email'), 255);
  const telephone = str(form.get('telephone'), 50);
  const message   = str(form.get('message'), 4000);
  const jobIdRaw  = str(form.get('job_id'), 12);
  const jobTitle  = str(form.get('job_title'), 255);
  const consent   = form.get('rgpd_consent') === 'true' || form.get('rgpd_consent') === '1';

  const jobId = jobIdRaw && /^\d+$/.test(jobIdRaw) ? parseInt(jobIdRaw, 10) : null;

  /* Validation des champs obligatoires */
  const errors: string[] = [];
  if (nom.length < 2)    errors.push('Le nom est obligatoire.');
  if (prenom.length < 2) errors.push('Le prénom est obligatoire.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Adresse email valide obligatoire.');
  if (telephone.replace(/[^\d+]/g, '').length < 8) errors.push('Numéro de téléphone valide obligatoire.');
  if (!consent) errors.push('Le consentement au traitement de vos données est obligatoire.');

  /* Pièces jointes */
  const cv = await readFile(form.get('cv') as File | null, true);
  if (cv && 'error' in cv) errors.push(cv.error);
  const lm = await readFile(form.get('lm') as File | null, false);
  if (lm && 'error' in lm) errors.push(lm.error);

  if (errors.length > 0) {
    return NextResponse.json({ success: false, errors }, { status: 422 });
  }

  const cvFile = cv as ValidatedFile;
  const lmFile = (lm && !('error' in lm)) ? lm as ValidatedFile : null;

  try {
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 500);
    const result = await execute(
      `INSERT INTO job_applications
         (job_id, job_title, nom, prenom, email, telephone, message,
          cv_filename, cv_mime, cv_size, cv_data,
          lm_filename, lm_mime, lm_size, lm_data,
          rgpd_consent, rgpd_consent_date, ip_address, user_agent, statut, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?, ?, 'nouveau', NOW())`,
      [
        jobId, jobTitle || null, nom, prenom, email, telephone, message || null,
        cvFile.filename, cvFile.mime, cvFile.size, cvFile.buffer,
        lmFile?.filename || null, lmFile?.mime || null, lmFile?.size || null, lmFile?.buffer || null,
        ip, userAgent,
      ]
    );

    // Notification au recruteur (best-effort, avec pièces jointes) — ne bloque pas.
    sendApplicationEmail({
      id: result.insertId, nom, prenom, email, telephone, message, jobTitle: jobTitle || 'Candidature spontanée',
      attachments: [
        { filename: cvFile.filename, content: cvFile.buffer, contentType: cvFile.mime },
        ...(lmFile ? [{ filename: lmFile.filename, content: lmFile.buffer, contentType: lmFile.mime }] : []),
      ],
    }).catch((err) => console.error('[applications] notif email:', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/applications]', err);
    return NextResponse.json({ success: false, errors: ['Erreur serveur. Veuillez réessayer.'] }, { status: 500 });
  }
}

/* ── GET (admin) — liste des candidatures (sans les blobs) ────────────────── */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 1000);

  try {
    const rows = await query(
      `SELECT id, job_id, job_title, nom, prenom, email, telephone, message,
              cv_filename, cv_size, lm_filename, lm_size,
              rgpd_consent, rgpd_consent_date, ip_address, statut, created_at
         FROM job_applications
        ORDER BY created_at DESC
        LIMIT ${limit}`
    );
    const stats = await query<{ statut: string; c: number }>(
      'SELECT statut, COUNT(*) AS c FROM job_applications GROUP BY statut'
    );
    const counts: Record<string, number> = {};
    stats.forEach((s) => { counts[s.statut] = Number(s.c); });
    return NextResponse.json({ rows, counts });
  } catch (err) {
    console.error('[GET /api/applications]', err);
    return NextResponse.json({ rows: [], counts: {}, error: 'table_absente' });
  }
}
