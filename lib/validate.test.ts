import { describe, it, expect } from 'vitest';
import { str, requireField, requireEmail } from './validate';

describe('str', () => {
  it('coupe les espaces et tronque à la longueur max', () => {
    expect(str('  bonjour  ', 5)).toBe('bonjo');
    expect(str('  bonjour  ')).toBe('bonjour');
  });

  it('renvoie une chaîne vide pour les valeurs non-string', () => {
    expect(str(null)).toBe('');
    expect(str(undefined)).toBe('');
    expect(str(42)).toBe('');
  });
});

describe('requireField', () => {
  it('ajoute une erreur si la valeur est trop courte', () => {
    const errors: string[] = [];
    requireField('a', 'Le nom', errors, 2);
    expect(errors).toEqual(['Le nom est obligatoire.']);
  });

  it('n’ajoute pas d’erreur si la valeur respecte la longueur minimale', () => {
    const errors: string[] = [];
    requireField('Dupont', 'Le nom', errors, 2);
    expect(errors).toEqual([]);
  });
});

describe('requireEmail', () => {
  it('rejette un format invalide', () => {
    const errors: string[] = [];
    requireEmail('pas-un-email', 'Email', errors);
    expect(errors).toEqual(['Email doit être une adresse email valide.']);
  });

  it('accepte un email valide', () => {
    const errors: string[] = [];
    requireEmail('contact@tenderwise.fr', 'Email', errors);
    expect(errors).toEqual([]);
  });
});
