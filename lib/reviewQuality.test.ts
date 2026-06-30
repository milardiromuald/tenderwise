import { describe, it, expect } from 'vitest';
import { extractQuality } from './reviewQuality';

describe('extractQuality', () => {
  it('renvoie null si steps_log est vide ou absent', () => {
    expect(extractQuality(null)).toBeNull();
    expect(extractQuality('')).toBeNull();
    expect(extractQuality('[]')).toBeNull();
  });

  it('renvoie null si JSON invalide (ne doit jamais planter)', () => {
    expect(extractQuality('{not json')).toBeNull();
  });

  it('renvoie null si aucune étape "reviseur" n’a de detail', () => {
    const log = JSON.stringify([{ name: 'redacteur', ok: true }]);
    expect(extractQuality(log)).toBeNull();
  });

  it('extrait la dernière tentative du réviseur en cas de retry', () => {
    const log = JSON.stringify([
      { name: 'reviseur', ok: true, detail: 'Score 55/100 — retry requis' },
      { name: 'link-checker', ok: true, detail: '3 liens — 2 ✅ confirmés / 1 ❌ cassés / 0 ⚠️ non vérifiables' },
      { name: 'reviseur', ok: true, detail: 'Score 82/100 — approuvé ✅' },
    ]);
    const result = extractQuality(log);
    expect(result).toEqual({
      reviewDetail: 'Score 82/100 — approuvé ✅',
      reviewOk: true,
      linksDetail: '3 liens — 2 ✅ confirmés / 1 ❌ cassés / 0 ⚠️ non vérifiables',
    });
  });

  it('renvoie une chaîne vide pour linksDetail si l’étape link-checker est absente', () => {
    const log = JSON.stringify([{ name: 'reviseur', ok: true, detail: 'Score 90/100 — approuvé ✅' }]);
    expect(extractQuality(log)?.linksDetail).toBe('');
  });
});
