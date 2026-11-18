import type { GameObservation } from './browser-games.ts';

export type GameRequest =
  | { type: 'load'; code: string; level?: number }
  | { type: 'action'; actionId: number; data?: { x: number; y: number } }
  | { type: 'undo' | 'reset' | 'restart' | 'nextMerchant' }
  | { type: 'selectLevel'; level: number };
export interface GameBackend { dispatch(request: GameRequest): GameObservation | Promise<GameObservation> }

/** Route by game registry, never by an agent's knowledge. Legacy games retain their original bridge. */
export function createGameDispatcher(loadLegacy: () => Promise<GameBackend>, loadNative = async (): Promise<GameBackend> => {
  const { createSinkingStarBackend } = await import('../games/sinking-star.ts');
  return createSinkingStarBackend();
}): GameBackend {
  let active: GameBackend | null = null;
  let legacy: Promise<GameBackend> | undefined;
  return {
    async dispatch(request) {
      if (!request || typeof request !== 'object') throw new Error('Invalid game request.');
      if (request.type === 'load') {
        active = null; // A failed load must not send later actions to the previous game.
        if (typeof request.code !== 'string' || !/^[a-z0-9]{4}$/i.test(request.code.trim())) throw new Error('Invalid game code.');
        const code = request.code.trim().toUpperCase();
        let backend: GameBackend;
        switch (code) {
          case 'SS01':
            backend = await loadNative();
            break;
          case 'SS02': {
            const { createSs02Backend } = await import('../games/sinking-star-ss02.ts');
            backend = createSs02Backend();
            break;
          }
          case 'SS03': {
            const { createSs03Backend } = await import('../games/sinking-star-ss03.ts');
            backend = createSs03Backend();
            break;
          }
          case 'SS04': {
            const { createSs04Backend } = await import('../games/sinking-star-ss04.ts');
            backend = createSs04Backend();
            break;
          }
          case 'SS05': {
            const { createSs05Backend } = await import('../games/sinking-star-ss05.ts');
            backend = createSs05Backend();
            break;
          }
          default:
            backend = await (legacy ??= loadLegacy().catch(error => { legacy = undefined; throw error; }));
        }
        const observation = await backend.dispatch({ ...request, code });
        active = backend;
        return observation;
      }
      if (!active) throw new Error('Load a game before sending actions.');
      return active.dispatch(request);
    },
  };
}
