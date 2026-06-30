import { describe, it, expect } from 'vitest';
import { toCsv } from './csvExport';

describe('toCsv', () => {
  it('génère un en-tête et des lignes séparés par ;', () => {
    const csv = toCsv(
      [{ nom: 'Dupont', email: 'a@b.fr' }],
      [{ key: 'nom', label: 'Nom' }, { key: 'email', label: 'Email' }],
    );
    expect(csv).toBe('Nom;Email\r\nDupont;a@b.fr');
  });

  it('échappe les valeurs contenant un point-virgule, une virgule ou un guillemet', () => {
    const csv = toCsv(
      [{ nom: 'Dupont; "Le Grand"' }],
      [{ key: 'nom', label: 'Nom' }],
    );
    expect(csv).toBe('Nom\r\n"Dupont; ""Le Grand"""');
  });

  it('remplace les valeurs null/undefined par une chaîne vide', () => {
    const csv = toCsv(
      [{ nom: null, email: undefined }],
      [{ key: 'nom', label: 'Nom' }, { key: 'email', label: 'Email' }],
    );
    expect(csv).toBe('Nom;Email\r\n;');
  });

  it('ne produit que l’en-tête sur un tableau vide', () => {
    const csv = toCsv([], [{ key: 'nom', label: 'Nom' }]);
    expect(csv).toBe('Nom');
  });
});
