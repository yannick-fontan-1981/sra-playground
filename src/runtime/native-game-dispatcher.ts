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
        if (typeof request.code !== 'string' || !/^[a-z0-9]{4}$/i.test(request.code.trim())) throw new Error('Invalid game code.');
        const code = request.code.trim().toUpperCase();
        active = null; // A failed load must not send later actions to the previous game.
        const backend = code === 'SS01' ? await loadNative() : await (legacy ??= loadLegacy().catch(error => { legacy = undefined; throw error; }));
        const observation = await backend.dispatch({ ...request, code });
        active = backend;
        return observation;
      }
      if (!active) throw new Error('Load a game before sending actions.');
      return active.dispatch(request);
    },
  };
}
