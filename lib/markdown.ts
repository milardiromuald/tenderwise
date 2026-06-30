import { marked } from 'marked';

// L'application rend toujours le contenu d’article via dangerouslySetInnerHTML :
// le `contenu` stocké DOIT donc être du HTML. Or le prompt de rédaction (source
// unique) demande du Markdown (## titres, **gras**, listes, [liens](url)). On
// convertit donc le Markdown en HTML de façon déterministe, juste avant stockage.
//
// marked gère nativement un MÉLANGE Markdown + HTML : les balises HTML déjà
// présentes (ex. <h2>, <a> émis par le modèle) sont laissées intactes, et le
// Markdown restant (gras, listes, liens, paragraphes) est converti.
marked.setOptions({ gfm: true, breaks: false });

/**
 * Convertit le corps d’un article (Markdown, ou mélange Markdown/HTML) en HTML
 * propre. Les liens reçoivent target="_blank" rel="noopener" (ouverture nouvel
 * onglet, comportement attendu pour les sources officielles citées).
 */
export function articleContentToHtml(content: string): string {
  if (!content || !content.trim()) return '';
  let html = marked.parse(content.trim(), { async: false }) as string;
  // Ajoute target/rel aux liens qui n’en ont pas déjà (sources officielles).
  html = html.replace(/<a\s(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener" ');
  return html.trim();
}
