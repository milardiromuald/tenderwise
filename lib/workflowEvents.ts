import { EventEmitter } from 'events';

// Emetteur global persistant (survit aux hot-reloads Next.js en dev grace au global)
declare global {
   
  var _twWorkflowEmitter: EventEmitter | undefined;
}

const emitter: EventEmitter = global._twWorkflowEmitter ?? new EventEmitter();
global._twWorkflowEmitter = emitter;
emitter.setMaxListeners(100);

/** Appele apres chaque ecriture en base dans le workflow */
export function emitWorkflowUpdate(): void {
  emitter.emit('update');
}

/** S abonne aux mises a jour. Retourne une fonction de desabonnement. */
export function onWorkflowUpdate(cb: () => void): () => void {
  emitter.on('update', cb);
  return () => emitter.off('update', cb);
}
