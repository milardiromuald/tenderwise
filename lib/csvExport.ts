/** Échappe une valeur pour un champ CSV (séparateur `;`, compatible Excel FR). */
function escapeCsvField(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Construit un CSV à partir d'un tableau typé et d'une liste de colonnes (clé + libellé). */
export function toCsv<T>(rows: T[], headers: { key: keyof T; label: string }[]): string {
  const head = headers.map((h) => escapeCsvField(h.label)).join(';');
  const lines = rows.map((r) => headers.map((h) => escapeCsvField(r[h.key])).join(';'));
  return [head, ...lines].join('\r\n');
}

const BOM = '﻿'; // pour qu'Excel détecte correctement l'encodage UTF-8 (accents)

/** Déclenche le téléchargement d'un fichier CSV côté navigateur. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
