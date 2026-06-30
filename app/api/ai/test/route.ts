import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGeminiKey } from '@/lib/encrypt';
import { GoogleGenAI } from '@google/genai';

function parseError(err: unknown): { message: string; status?: number; retryAfter?: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const statusMatch = raw.match(/\[(\d{3})\s/);
  const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
  const retryMatch = raw.match(/"retryDelay"\s*:\s*"(\d+)s"/) || raw.match(/retry in (\d+)/i);
  const retryAfter = retryMatch ? parseInt(retryMatch[1]) : undefined;

  if (status === 429) {
    if (raw.includes('limit: 0')) return { message: 'Quota = 0 : activez "Generative Language API" sur console.cloud.google.com ou créez une clé sur aistudio.google.com', status, retryAfter };
    return { message: `Quota dépassé${retryAfter ? ` — réessayez dans ${retryAfter}s` : ''}`, status, retryAfter };
  }
  if (status === 404) return { message: 'Modèle non disponible pour cette clé API', status };
  if (status === 403) return { message: 'Clé API invalide ou révoquée', status };

  const clean = raw.replace(/\[\{[\s\S]*?\}\]/g, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { message: clean || 'Erreur inconnue', status };
}


export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { type, testKey } = await req.json();

  let apiKey = (testKey as string)?.trim() || '';
  if (!apiKey) apiKey = await getGeminiKey();
  if (!apiKey) return NextResponse.json({ success: false, type, error: 'Aucune clé API configurée.', ms: 0 }, { status: 400 });

  const t0 = Date.now();

  try {
    // Default client for text models (v1beta)
    const ai = new GoogleGenAI({ apiKey });

    switch (type) {

      case 'connection': {
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: 'Réponds uniquement par le mot "OK".',
        });
        return NextResponse.json({ success: true, type, result: (res.text ?? '').trim().slice(0, 50), ms: Date.now() - t0 });
      }

      case 'text': {
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: 'Rédige exactement 2 phrases courtes sur l\'IA dans l\'immobilier.',
        });
        const usage = res.usageMetadata;
        return NextResponse.json({
          success: true, type,
          result: (res.text ?? '').slice(0, 400),
          ms: Date.now() - t0,
          tokensIn:    usage?.promptTokenCount    ?? null,
          tokensOut:   usage?.candidatesTokenCount ?? null,
          totalTokens: (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
        });
      }

      case 'json_mode': {
        const res = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: 'Donne un titre court de test et un score de 10.',
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: { titre: { type: 'string' }, score: { type: 'integer' } },
              required: ['titre', 'score'],
            },
          },
        });
        return NextResponse.json({ success: true, type, result: (res.text ?? '').trim(), ms: Date.now() - t0 });
      }

      case 'tokens': {
        const sample = 'L\'intelligence artificielle transforme profondément le secteur immobilier. Les algorithmes de valorisation automatisée permettent désormais d\'estimer la valeur d\'un bien en quelques secondes, avec une précision comparable à celle d\'un expert humain.';
        const res = await ai.models.countTokens({ model: 'gemini-3.1-flash-lite', contents: sample });
        const total = res.totalTokens ?? 0;
        return NextResponse.json({
          success: true, type,
          result: `${total} tokens pour ${sample.length} caractères`,
          ms: Date.now() - t0,
          tokensCount: total,
          charCount:   sample.length,
          ratio:       total > 0 ? (sample.length / total).toFixed(1) : '?',
        });
      }

      case 'image': {
        // La génération d’image par IA est désactivée : les en-têtes sont
        // désormais composés à partir de fonds prédéfinis (Admin → Fonds d’en-tête).
        return NextResponse.json({
          success: true, type,
          result: 'Génération d’image par IA désactivée — les en-têtes utilisent des fonds prédéfinis + texte incrusté (aucune clé payante).',
          ms: Date.now() - t0,
        });
      }

      case 'models': {
        const checks = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
        const results = await Promise.all(
          checks.map(async (id) => {
            const t = Date.now();
            try {
              await ai.models.generateContent({ model: id, contents: 'Test' });
              return { id, available: true, ms: Date.now() - t };
            } catch (e) {
              return { id, available: false, ms: Date.now() - t, error: parseError(e).message.slice(0, 100) };
            }
          })
        );
        const available = results.filter(r => r.available).length;
        return NextResponse.json({ success: true, type, result: `${available}/${checks.length} modèles accessibles`, models: results, ms: Date.now() - t0 });
      }

      default:
        return NextResponse.json({ error: `Type inconnu: ${type}` }, { status: 400 });
    }

  } catch (err) {
    const parsed = parseError(err);
    return NextResponse.json({ success: false, type, error: parsed.message, status: parsed.status, retryAfter: parsed.retryAfter, ms: Date.now() - t0 }, { status: 500 });
  }
}
