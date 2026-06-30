import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { onWorkflowUpdate } from '@/lib/workflowEvents';

export const dynamic = 'force-dynamic';
// SSE requires Node.js runtime (not Edge) for EventEmitter + persistent connections
export const runtime = 'nodejs';

const enc = new TextEncoder();
const msg = (data: string) => enc.encode('data: ' + data + '\n\n');

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  let unsub: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Ping initial pour confirmer la connexion
      controller.enqueue(msg('ping'));

      // Abonnement aux evenements workflow
      unsub = onWorkflowUpdate(() => {
        try { controller.enqueue(msg('update')); }
        catch { /* stream ferme */ }
      });

      // Heartbeat toutes les 20s pour garder la connexion ouverte
      const hb = setInterval(() => {
        try { controller.enqueue(msg('ping')); }
        catch { clearInterval(hb); }
      }, 20_000);

      // Nettoyage quand le client se deconnecte
      req.signal.addEventListener('abort', () => {
        clearInterval(hb);
        unsub?.();
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // desactive le buffering nginx
    },
  });
}
