import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {hash} from './sic-study-source-replay.mjs';

// Offline matched interventions. The public tape identifies one verified switch.
// The observer varies the first subject's walk, holds the click and continuation
// fixed, and reports the first divergence in the second subject or official state.
const [engineRoot,tapes,code,out] = process.argv.slice(2);
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
const poses = [{at:original,word:[]}], seen = new Set([original.join()]);
for (let i=0; i<poses.length && poses.length<34; i++) {
  const p = poses[i];
  if (p.word.length >= 12) continue;
  for (const id of directions) {
    const word = [...p.word,id], b = await prepare(word);
    if (!live(b)) continue;
    const l = await view(b), position = at(l,first);
    if (!position || !same(at(l,second),selected) || seen.has(position.join())) continue;
    seen.add(position.join());
    poses.push({word,at:position});
  }
}

// Start with every short continuation, then extend a common set of exploratory
// paths found from the reference placement. Apply exactly that set to each arm.
const words = ops.flatMap(a=>[[a],...ops.map(b=>[a,b])]);
const keys = new Set(words.map(w=>w.join())), explored = new Set([at(switched,moving).join()]);
const frontier = [[]];
for (let i=0; i<frontier.length && i<38; i++) {
  const word = frontier[i];
  if (word.length >= 12) continue;
  for (const id of ops) {
    const longer = [...word,id];
    if (!keys.has(longer.join())) {keys.add(longer.join());words.push(longer);}
    await start();
    let b = await act(select);
    for (const command of longer) {
      if (!live(b)) break;
      b = await act({id:command});
    }
    if (!live(b)) continue;
    const l = await view(b), position = at(l,moving);
    if (!position || !same(at(l,parked),original) || explored.has(position.join())) continue;
    explored.add(position.join());
    frontier.push(longer);
  }
}
const arms = [];
for (const pose of poses) {
  await prepare(pose.word);
  const l = await view(await act(select));
  if (!same(at(l,parked),pose.at) || !same(at(l,moving),selected)) continue;
  const outcomes = [];
  for (const word of words) {
    await prepare(pose.word);
    let b = await act(select), outcome;
    for (const id of word) {
      if (!b.availableActionIds.includes(id)) {outcome = 'unavailable'; break;}
      b = await act({id});
      if (!live(b)) {outcome = score(b) ? 'score' : b.state; break;}
      const l = await view(b);
      if (!same(at(l,parked),pose.at) || !at(l,moving)) {outcome = 'unresolved'; break;}
    }
    outcomes.push(outcome ?? at(await view(b),moving).join());
  }
  arms.push({pose,outcomes});
}
const summary = {code,level:run.start,commonPrefix:prefix.length,attempted:poses.length,confirmed:arms.length,
  suffixes:words.length,maxSuffix:Math.max(...words.map(w=>w.length)),equalLengthPairs:0,differentPairs:0,
  byLength:{},outcomes:{},scores:0,unresolved:0,examples:{}};
const isPosition = t => /^-?\d+,-?\d+$/.test(t);
for (const a of arms) {
  summary.scores += a.outcomes.filter(x=>x==='score').length;
  summary.unresolved += a.outcomes.filter(x=>x==='unresolved').length;
}
for (const [i,a] of arms.entries()) for (const b of arms.slice(i+1)) {
  if (a.pose.word.length !== b.pose.word.length) continue;
  summary.equalLengthPairs++;
  let changed = false;
  for (const [k,word] of words.entries()) {
    const left = a.outcomes[k], right = b.outcomes[k];
    if (left === right || [left,right].includes('unresolved')) continue;
    const positions = [left,right].every(isPosition);
    if (positions && same(left.split(',').map(Number),right.split(',').map(Number))) continue;
    changed = true;
    const kind = positions ? 'different_position' : [left,right].includes('unavailable') ? 'different_available_action' : 'different_official_state';
    summary.byLength[word.length] = 1+(summary.byLength[word.length]??0);
    summary.outcomes[kind] = 1+(summary.outcomes[kind]??0);
    const old = summary.examples[kind];
    if (!old || word.length < old.suffix.length || word.length === old.suffix.length && a.pose.word.length < old.preparations[0].length) {
      summary.examples[kind] = {preparations:[a.pose.word,b.pose.word],suffix:word,results:[left,right]};
    }
  }
  if (changed) summary.differentPairs++;
}
for (const example of Object.values(summary.examples)) {
  example.beforeLast = [];
  for (const preparation of example.preparations) {
    await prepare(preparation);
    let b = await act(select);
    for (const id of example.suffix.slice(0,-1)) {
      if (!live(b) || !b.availableActionIds.includes(id)) break;
      b = await act({id});
    }
    const l = live(b) ? await view(b) : null;
    example.beforeLast.push({second:l ? at(l,moving) : null,first:l ? at(l,parked) : null,state:b.state});
  }
}
await writeFile(out,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
