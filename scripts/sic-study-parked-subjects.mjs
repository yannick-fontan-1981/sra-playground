import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {hash} from './sic-study-source-replay.mjs';

// Rebind the two public subjects on either side of a witnessed control transfer.
export async function openParkedSubjects(engineRoot,tapes,code) {
  const runs = (await readFile(tapes,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const run = runs.find(r => r.code === code);
  const verification = run.preparation.find(p => p.result === 'new_cursor_moved_while_previous_cursor_stayed');
  assert.ok(verification);
  const index = verification.actionIndex - 1, verify = run.replayCommands[index];
  const select = run.replayCommands[index-1], prefix = run.replayCommands.slice(0,index-1);
  assert.equal(select.id,6);
  const {createGameDispatcher} = await import(pathToFileURL(resolve(engineRoot,'src/runtime/native-game-dispatcher.ts')));
  const engine = createGameDispatcher(() => {throw Error('Unexpected engine');});
  const act = c => engine.dispatch({type:'action',actionId:c.id,...(c.data ? {data:c.data} : {})});
  async function start() {
    let b = await engine.dispatch({type:'load',code,level:run.start});
    if (b.level !== run.start) b = await engine.dispatch({type:'selectLevel',level:run.start});
    for (const c of prefix) {
      assert.equal(hash(b).slice(0,16),c.from);
      b = await act(c);
      assert.equal(hash(b).slice(0,16),c.to);
    }
    return b;
  }
  const root = await start();
  const score = b => b.state === 'WIN' || b.levelsCompleted > root.levelsCompleted;
  const live = b => b.level === run.start && !score(b) && b.state === 'NOT_FINISHED';
  const ops = root.availableActionIds.filter(id => id !== 6);
  const directions = ops.filter(id => id >= 1 && id <= 4);
  const layouts = new Map();
  async function view(b) {
    const key = hash(b);
    if (!layouts.has(key)) {
      const o = await measureNativeObservation({frame_rows:b.frame,frame_hash:key,state:b.state,
        level:b.level,levels_completed:b.levelsCompleted,available_action_refs:b.availableActionIds.map(id=>'ACTION'+id)},0,'audit');
      layouts.set(key,visualLayout(o,b.frame));
    }
    return layouts.get(key);
  }
  const at = (l,k) => l[k]?.length === 1 ? l[k][0].at : null;
  // Centres are represented in half-pixels. A redraw can shift the visual centre by half a pixel.
  const same = (a,b) => a && b && a.every((v,i) => Math.abs(v-b[i]) <= 1);
  const [original,selected] = verify.observedSubjects.map(box => [box[0]+box[2],box[1]+box[3]]);
  const before = await view(root), switched = await view(await act(select)), checked = await view(await act(verify));
  const changedAt = (l,other,p,accept) => Object.keys(l).find(k => same(at(l,k),p) && !same(at(other,k),p) && accept(k));
  const first = changedAt(before,switched,original,()=>true);
  const second = changedAt(before,switched,selected,()=>true);
  const parked = changedAt(switched,before,original,k=>same(at(checked,k),original));
  const moving = changedAt(switched,before,selected,k=>at(checked,k) && !same(at(checked,k),selected));
  assert.ok(first && second && parked && moving,'Need two visible, independently rebound subjects');
  async function prepare(word) {
    let b = await start();
    for (const id of word) {
      if (!live(b)) break;
      b = await act({id});
    }
    return b;
  }
  return {run, prefix, verify, select, act, start, score, live, ops, directions, view, at, same, original, selected, switched, first, second, parked, moving, prepare};
}
