/** Normalise une valeur en chaîne, tronquée à `max` caractères. Jamais `undefined`/`null` côté DB. */
export function str(v: unknown, max = 255): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Ajoute une erreur si la valeur est trop courte (vide par défaut). */
export function requireField(value: string, label: string, errors: string[], min = 1): void {
  if (value.trim().length < min) errors.push(`${label} est obligatoire.`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ajoute une erreur si la valeur n'est pas une adresse email valide. */
export function requireEmail(value: string, label: string, errors: string[]): void {
  if (!EMAIL_RE.test(value)) errors.push(`${label} doit être une adresse email valide.`);
}
