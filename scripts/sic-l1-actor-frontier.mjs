import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { createObservedActorComposition } from '../src/sic/observed-actor-composition.ts';

export const targetGames = ['SS08', 'SS09', 'SS10', 'SS11', 'SS12'];
export const newGame = () => createGameDispatcher(() => { throw Error('Targeted games must use the native dispatcher'); });
export async function publicObservation(game, revision) {
  const packet = { frame_rows: game.frame, frame_hash: await publicFrameHash(game.frame), level: game.level,
    levels_completed: game.levelsCompleted, state: game.state, available_action_refs: game.availableActionIds.map(id => 'ACTION' + id),
    palette: game.palette };
  return { packet, observed: await measureNativeObservation(packet, revision) };
}

export async function testActorFrontier(code, maxActions = 32) {
  const engine = newGame();
  const family = createObservedActorComposition();
  let game = await engine.dispatch({ type: 'load', code, level: 1 });
  let { packet, observed } = await publicObservation(game, 0);
  const actions = [];
  const execution = { yieldControl: async () => {}, signal: new AbortController().signal };
  let previous = null, stop = 'budget';
  while (actions.length < maxActions && game.levelsCompleted === 0 && game.state === 'NOT_FINISHED') {
    const proposal = await family.propose(observed, game.frame, [], maxActions - actions.length, execution);
    if (!proposal) { stop = 'no offer'; break; }
    const key = JSON.stringify([observed.frame_hash, proposal.offer.kind, proposal.actions[0]]);
    if (key === previous) { stop = 'repeated decision'; break; }
    previous = key;
    for (let index = 0; index < proposal.actions.length && actions.length < maxActions; index++) {
      const command = proposal.actions[index];
      const admitted = await family.before(proposal, index, packet, observed, execution);
      if (!admitted.admitted) { stop = admitted.reason; break; }
      const next = await engine.dispatch({ type: 'action', actionId: Number(command.action_ref.slice(6)), ...(command.data ? { data: command.data } : {}) });
      const current = await publicObservation(next, actions.length + 1);
      const result = await family.after(proposal,index,observed,current.observed,game.frame,next.frame,next.frames);
      await family.record(observed,current.observed,command,game.frame,next.frame,proposal,index,next.frames,execution);
      actions.push({ family:proposal.offer.kind, action:command.action_ref, matched:result.matched, reason:result.reason });
      game=next;
      ({ packet, observed }=current);
      if (result.seal_prefix || !result.matched || game.state !== 'NOT_FINISHED' || game.levelsCompleted > 0) break;
    }
  }
  return { code, won: game.levelsCompleted > 0 || game.state === 'WIN', state: game.state,
    actions: actions.length, stop, prefix: actions.slice(0, 9),
    strategies: Object.fromEntries([...new Set(actions.map(action=>action.family))]
      .map(name=>[name,actions.filter(action=>action.family===name).length])) };
}

if (import.meta.main) {
  const budget = Number(process.argv[2] ?? 32);
  for (const code of process.argv.slice(3).length ? process.argv.slice(3) : targetGames) {
    console.log(JSON.stringify(await testActorFrontier(code,budget)));
  }
}
