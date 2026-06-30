import { describe, it, expect } from 'vitest';
import { normalizeOrgUrn } from './linkedin';

describe('normalizeOrgUrn', () => {
  it('accepte un URN déjà complet', () => {
    expect(normalizeOrgUrn('urn:li:organization:1234')).toBe('urn:li:organization:1234');
  });

  it('convertit un ID numérique brut', () => {
    expect(normalizeOrgUrn('1234')).toBe('urn:li:organization:1234');
  });

  it('extrait l’ID depuis une URL d’admin de Page', () => {
    expect(normalizeOrgUrn('https://www.linkedin.com/company/1234/admin/')).toBe('urn:li:organization:1234');
  });

  it('renvoie une chaîne vide pour une entrée non reconnue (ex. nom de vanité)', () => {
    expect(normalizeOrgUrn('https://www.linkedin.com/company/tenderwise/')).toBe('');
    expect(normalizeOrgUrn('')).toBe('');
    expect(normalizeOrgUrn('pas-un-urn')).toBe('');
  });
});
