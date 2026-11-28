import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { witnessedObjective } from '../src/sic/experiment-arbitration.ts';
import type { Memory } from '../src/sic/preparation-experiments.ts';
import { offerTerminalContact } from '../src/sic/terminal-contact.ts';
import { newPreviewLearning, observePreviewBindings, visualLayout } from '../src/sic/witnessed-preview-transfer.ts';

const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];

async function scene(x: number, y: number, revision: number, rival = false) {
  const rows = Array.from({ length: 10 }, () => Array<number>(15).fill(0));
  const bodies = [[x,y,9], [7,3,4], ...(rival ? [[5,5,5]] : [])];
  for (const [left, top, ink] of bodies) {
    for (let dy=0; dy<2; dy++) for (let dx=0; dx<2; dx++) rows[top!+dy]![left!+dx]=ink!;
  }
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: await publicFrameHash(rows),
    level: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: inputs }, revision, 'cold-contact');
  return { rows, observation };
}

test('a measured adjacent goal remains an experiment and rival targets block its admission', async () => {
  const learn = newPreviewLearning();
  const available = new Set(inputs);
  let previous = await scene(1,3,0);
  const steps = [[3,3,'ACTION4'],[3,5,'ACTION2'],[3,3,'ACTION1'],[5,3,'ACTION4']] as const;
  const memory = { previewLearning: learn } as Memory;
  for (const [i,[x,y,operation]] of steps.entries()) {
    const next = await scene(x,y,i+1);
    observePreviewBindings(learn, previous.observation, next.observation,
      visualLayout(previous.observation, previous.rows), visualLayout(next.observation, next.rows), operation);
    if (i === 2) {
      assert.equal(offerTerminalContact(memory,3,next.observation,next.rows,available,'adjacent_hypothesis'),null);
    }
    previous = next;
  }
  assert.equal(offerTerminalContact(memory,4,previous.observation,previous.rows,available),null);
  const offer = offerTerminalContact(memory,4,previous.observation,previous.rows,available,'adjacent_hypothesis');
  assert.ok(offer);
  assert.equal(offer.phase,'testScoringContact');
  assert.equal(offer.a,'ACTION4');
  assert.equal(offer.terminalContact?.distance,1);
  assert.equal(witnessedObjective(offer),false);
  const ambiguous = await scene(5,3,5,true);
  assert.equal(offerTerminalContact(memory,5,ambiguous.observation,ambiguous.rows,available,'adjacent_hypothesis'),null);
});
