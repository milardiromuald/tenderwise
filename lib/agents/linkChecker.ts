import type { AgentContext, LinkReport } from './context';

// Extrait les liens Markdown [texte](url) du contenu
function extractMarkdownLinks(markdown: string): Array<{ anchor: string; url: string }> {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const links: Array<{ anchor: string; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(markdown)) !== null) {
    links.push({ anchor: m[1].trim(), url: m[2].trim() });
  }
  return links;
}

// Vérifie si le numéro d'article cité dans le texte d'ancre est présent sur la page
// Ex: ancre "Article L. 1234-5 du Code du travail" → cherche "L. 1234-5" dans la page
function isReferenceFoundInPage(anchor: string, pageText: string): boolean {
  // Patterns de références légales françaises
  const patterns = anchor.match(/[LRDC]\.\s*\d[\d-]+|\d{3,}-\d+/g);
  if (!patterns || patterns.length === 0) {
    // Pas de numéro identifiable → on ne peut pas vérifier, on considère OK
    return true;
  }
  const normalized = pageText.replace(/\s+/g, ' ');
  return patterns.some(p => normalized.includes(p.replace(/\s+/g, ' ').trim()));
}

async function checkOneLink(anchor: string, url: string): Promise<LinkReport> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      method:   'GET',
      signal:   controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control':   'no-cache',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { url, anchor, status: 'broken', httpCode: res.status, foundInPage: false };
    }

    // Lire 80 Ko max pour éviter la saturation mémoire
    const html    = await res.text().then(t => t.slice(0, 80_000));
    const text    = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/\s+/g, ' ');

    // Détection des soft-404 courants (légifrance, journal-officiel…)
    const softNotFound = [
      'texte introuvable', 'page introuvable', 'résultat introuvable',
      'texte non trouvé', 'article non trouvé', '404', 'not found',
    ].some(p => text.toLowerCase().includes(p));

    if (softNotFound) {
      return { url, anchor, status: 'broken', httpCode: res.status, foundInPage: false };
    }

    const foundInPage = isReferenceFoundInPage(anchor, text);
    return { url, anchor, status: 'ok', httpCode: res.status, foundInPage };

  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    return {
      url,
      anchor,
      status:      'unverifiable',
      httpCode:    undefined,
      foundInPage: false,
    };
  }
}

export async function checkLinks(ctx: AgentContext): Promise<void> {
  const start = Date.now();

  if (!ctx.articleBrut?.contenu) {
    ctx.linksReport = [];
    ctx.steps.push({ agent: 'link-checker', ok: true, durationMs: 0, detail: 'Aucun contenu à vérifier' });
    return;
  }

  const rawLinks = extractMarkdownLinks(ctx.articleBrut.contenu);

  // Dédoublonnage par URL
  const seen    = new Set<string>();
  const unique  = rawLinks.filter(l => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });

  // Maximum 20 liens pour ne pas bloquer le pipeline
  const toCheck = unique.slice(0, 20);

  if (toCheck.length === 0) {
    ctx.linksReport = [];
    ctx.steps.push({ agent: 'link-checker', ok: true, durationMs: Date.now() - start, detail: 'Aucun lien à vérifier' });
    return;
  }

  const reports: LinkReport[] = [];
  for (const link of toCheck) {
    const report = await checkOneLink(link.anchor, link.url);
    reports.push(report);
    // Pause pour éviter le rate-limiting (surtout légifrance)
    await new Promise(r => setTimeout(r, 400));
  }

  ctx.linksReport = reports;

  const ok          = reports.filter(r => r.status === 'ok' && r.foundInPage).length;
  const broken      = reports.filter(r => r.status === 'broken' || (r.status === 'ok' && !r.foundInPage)).length;
  const unverifiable = reports.filter(r => r.status === 'unverifiable').length;

  ctx.steps.push({
    agent:      'link-checker',
    ok:         true,
    durationMs: Date.now() - start,
    detail:     `${toCheck.length} liens — ${ok} ✅ confirmés / ${broken} ❌ cassés / ${unverifiable} ⚠️ non vérifiables`,
  });
}
