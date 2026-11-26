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
          case 'SS06': {
            const { createSs06Backend } = await import('../games/sinking-star-ss06.ts');
            backend = createSs06Backend();
            break;
          }
          case 'SS07': {
            const { createSs07Backend } = await import('../games/sinking-star-ss07.ts');
            backend = createSs07Backend();
            break;
          }
          case 'SS08': {
            const { createSs08Backend } = await import('../games/sinking-star-ss08.ts');
            backend = createSs08Backend();
            break;
          }
          case 'SS09': {
            const { createSs09Backend } = await import('../games/sinking-star-ss09.ts');
            backend = createSs09Backend();
            break;
          }
          case 'SS10': {
            const { createSs10Backend } = await import('../games/sinking-star-ss10.ts');
            backend = createSs10Backend();
            break;
          }
          case 'SS11': {
            const { createSs11Backend } = await import('../games/sinking-star-ss11.ts');
            backend = createSs11Backend();
            break;
          }
          case 'SS12': {
            const { createSs12Backend } = await import('../games/sinking-star-ss12.ts');
            backend = createSs12Backend();
            break;
          }
          case 'SS13': {
            const { createSs13Backend } = await import('../games/sinking-star-ss13.ts');
            backend = createSs13Backend();
            break;
          }
          case 'SS14': {
            const { createSs14Backend } = await import('../games/sinking-star-ss14.ts');
            backend = createSs14Backend();
            break;
          }
          case 'SS15': {
            const { createSs15Backend } = await import('../games/sinking-star-ss15.ts');
            backend = createSs15Backend();
            break;
          }
          case 'SS16': {
            const { createSs16Backend } = await import('../games/sinking-star-ss16.ts');
            backend = createSs16Backend();
            break;
          }
          case 'SS17': {
            const { createSs17Backend } = await import('../games/sinking-star-ss17.ts');
            backend = createSs17Backend();
            break;
          }
          case 'SS18': {
            const { createSs18Backend } = await import('../games/sinking-star-ss18.ts');
            backend = createSs18Backend();
            break;
          }
          case 'SS19': {
            const { createSs19Backend } = await import('../games/sinking-star-ss19.ts');
            backend = createSs19Backend();
            break;
          }
          case 'SS20': {
            const { createSs20Backend } = await import('../games/sinking-star-ss20.ts');
            backend = createSs20Backend();
            break;
          }
          case 'SS21': {
            const { createSs21Backend } = await import('../games/sinking-star-ss21.ts');
            backend = createSs21Backend();
            break;
          }
          case 'SS22': {
            const { createSs22Backend } = await import('../games/sinking-star-ss22.ts');
            backend = createSs22Backend();
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
