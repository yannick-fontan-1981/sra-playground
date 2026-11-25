import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { spotPair } from '../src/sic/observed-actor-composition.ts';
import { observedSelectionHypotheses, selectionReturnFacts, witnessedSelection } from '../src/sic/observed-role-selection.ts';
import { newGame, targetGames } from './sic-l1-actor-frontier.mjs';

const copy = rows => rows.map(row => row.slice());
const key = at => at.join(',');
function observation(rows) {
  return { available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6'],
    entities: geometricComponents(rows).map(({color, bbox, area, rectangular}) =>
      ({ palette_value: color, bbox, area, rectangular })) };
}

function backing(rows) {
  const counts = new Map();
  const edge = [...rows[0], ...rows.at(-1), ...rows.flatMap(row => [row[0], row.at(-1)])];
  for (const color of edge) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

async function enter(code, prefix) {
  const engine = newGame();
  let current = await engine.dispatch({ type: 'load', code, level: 1 });
  for (const actionId of prefix) current = await engine.dispatch({ type: 'action', actionId });
  return { engine, current };
}

function vacancy(rows, hypothesis) {
  const { pitch, phase, floor } = hypothesis.shape;
  const result = [];
  for (let y = phase[1]; y + pitch <= rows.length; y += pitch) for (let x = phase[0]; x + pitch <= rows[0].length; x += pitch) {
    if (Array.from({ length: pitch }, (_, i) => rows[y + i].slice(x, x + pitch)).flat().every(value => value === floor)) {
      result.push([x, y]);
    }
  }
  return result;
}

export async function collectAnchors() {
  const anchors = [];
  const prefixes = [[], [1], [2], [3], [4], [1, 2], [2, 2], [3, 4], [4, 1], [2, 4]];
  for (const code of targetGames) {
    const seen = new Set();
    for (const prefix of prefixes) {
      const entry = await enter(code, prefix);
      const before = entry.current.frame;
      if (entry.current.state !== 'NOT_FINISHED') continue;
      const raw = JSON.stringify(before);
      if (seen.has(raw)) continue;
      seen.add(raw);
      for (const hypothesis of observedSelectionHypotheses(observation(before), before, backing(before))) {
        const { engine } = await enter(code, prefix);
        const { target: [x, y], shape: { pitch, inks, floor, backing } } = hypothesis;
        const center = (pitch - 1) / 2;
        const returned = await engine.dispatch({ type: 'action', actionId: 6, data: { x: x + center, y: y + center } });
        if (!witnessedSelection(hypothesis, before, returned.frame)) continue;
        const colors = Array.from({ length: 16 }, (_, i) => i).filter(ink =>
          ink !== floor && ink !== backing && !inks.includes(ink));
        const empty = vacancy(before, hypothesis).filter(at =>
          key(at) !== key(hypothesis.current) && key(at) !== key(hypothesis.target));
        if (empty.length < 2) continue;
        anchors.push({ code, prefix, hypothesis, before, after: returned.frame, colors, empty });
        break;
      }
    }
  }
  for (const code of targetGames) if (!anchors.some(anchor => anchor.code === code)) throw Error('No confirmed public selection for ' + code);
  return anchors;
}

function position([x, y], orientation) {
  if (orientation >= 4) x = 63 - x;
  for (let rotation = 0; rotation < orientation % 4; rotation++) [x, y] = [63 - y, x];
  return [x, y];
}

function orientedTile([x, y], pitch, orientation) {
  const first = position([x, y], orientation), last = position([x + pitch - 1, y + pitch - 1], orientation);
  return [Math.min(first[0], last[0]), Math.min(first[1], last[1])];
}

function transform(rows, spec) {
  if (!spec.orientation && !spec.palette) return rows;
  const result = Array.from({ length: 64 }, () => Array(64).fill(0));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const [u,v] = position([x,y],spec.orientation);
    result[v][u] = (rows[y][x] + spec.palette) % 16;
  }
  return result;
}

function editTile(rows, [x, y], pitch, edit) {
  for (let i = 0; i < pitch ** 2; i++) {
    const line = rows[y + Math.floor(i / pitch)];
    const px = x + i % pitch;
    line[px] = edit(line[px], i);
  }
}
function restoreTile(from, to, [x,y], pitch) {
  editTile(to, [x,y], pitch, (_, i) => from[y + Math.floor(i / pitch)][x + i % pitch]);
}

function sceneFor(anchor, spec) {
  const before = copy(anchor.before), after = copy(anchor.after);
  const { current, target, peer, active, shape: { pitch, mask, floor } } = anchor.hypothesis;
  const outlines = Array.from({ length: pitch ** 2 }, (_, i) => i).filter(i => !mask.includes(i));
  for (const [at, value] of [[current, spec.originLayer], [target, spec.peerLayer]]) {
    if (!value) continue;
    const hidden = outlines[(value - 1) % outlines.length];
    const color = anchor.colors[(value - 1) % anchor.colors.length];
    for (const rows of [before, after]) editTile(rows, at, pitch, (_, i) =>
      i === hidden ? color : mask.includes(i) ? _ : floor);
  }
  if (spec.decoy) {
    const at = anchor.empty[(spec.decoy * 7) % anchor.empty.length];
    const hue = anchor.colors[(spec.decoy + 2) % anchor.colors.length];
    for (const rows of [before, after]) editTile(rows, at, pitch, (value, i) => mask.includes(i) ? hue : value);
  }
  if (spec.returnType === 1) restoreTile(before, after, current, pitch);
  if (spec.returnType === 2) restoreTile(before, after, target, pitch);
  if (spec.returnType === 3) {
    const marker = mask.map(i => after[target[1] + Math.floor(i / pitch)][target[0] + i % pitch]).find(value => value !== peer);
    editTile(after, target, pitch, (value,i) => i === (pitch ** 2 - 1) / 2 ? marker ?? floor : mask.includes(i) ? peer : value);
  }
  if (spec.returnType === 4) restoreTile(after, before, target, pitch);
  if (spec.returnType === 5) {
    restoreTile(before, after, current, pitch);
    restoreTile(before, after, target, pitch);
  }
  if (spec.returnType === 6) {
    const excluded = new Set(Array.from({ length: pitch ** 2 }, (_,i) =>
      after[target[1] + Math.floor(i / pitch)][target[0] + i % pitch]));
    const impostor = anchor.colors.find(color => !excluded.has(color));
    editTile(after, target, pitch, (value,i) => mask.includes(i) && value === peer ? impostor ?? value : value);
  }
  return { before: transform(before,spec), after: transform(after,spec),
    target: orientedTile(target,pitch,spec.orientation), current: orientedTile(current,pitch,spec.orientation),
    ink: (peer+spec.palette)%16, active: (active+spec.palette)%16 };
}

export function generatedCases(anchors, count, stage, existing) {
  const results = [];
  const groups = targetGames.map(code => {
    const positions = anchors.flatMap((anchor,i) => anchor.code === code ? [i] : []);
    const first = Math.max(1, Math.floor(positions.length * 0.5));
    const second = Math.max(first + 1, Math.floor(positions.length * 0.75));
    return stage === 0 ? positions.slice(0,first) : stage === 1 ? positions.slice(first,second) : positions.slice(second);
  });
  let random = (0x7dbf134 + (stage + 1) * 7219) >>> 0;
  function pick(max) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    return (random >>> 0) % max;
  }
  for (let attempt = 0; results.length < count; attempt++) {
    if (attempt > count * 140) throw Error('Targeted scenario space exhausted');
    const ordinal = results.length;
    const group = groups[ordinal % groups.length];
    const anchor = group[pick(group.length)];
    const scenario = {
      anchor, code: anchors[anchor].code, task: ['recognition','verification','disambiguation'][Math.floor(ordinal/5)%3],
      originLayer: pick(6), peerLayer: pick(6), decoy: pick(12), returnType: pick(10)<6 ? 0 : 1+pick(6),
      orientation: pick(8), palette: pick(16),
    };
    if (scenario.task !== 'verification') scenario.returnType = 0;
    const { orientation, palette, ...causal } = scenario;
    const id = JSON.stringify(causal);
    if (existing.has(id)) continue;
    existing.add(id);
    results.push({ key:id, spec:scenario });
  }
  return results;
}

function witnessHypothesis(anchor, spec, scene) {
  const { pitch, mask, floor, backing } = anchor.hypothesis.shape;
  const dummy = orientedTile([0,0],pitch,spec.orientation);
  const transformed = mask.map(i => {
    const [x,y] = position([i % pitch,Math.floor(i/pitch)],spec.orientation);
    return (y - dummy[1]) * pitch + x - dummy[0];
  }).sort((a,b)=>a-b);
  return { shape:{ pitch, mask:transformed, floor:(floor+spec.palette)%16, backing:(backing+spec.palette)%16 },
    current:scene.current, target:scene.target, active:scene.active, peer:scene.ink };
}

export function assessSituation(anchors, spec, rule = null) {
  const anchor = anchors[spec.anchor];
  const scene = sceneFor(anchor,spec);
  if (spec.task === 'verification') {
    const facts = selectionReturnFacts(witnessHypothesis(anchor,spec,scene),scene.before,scene.after);
    return { expected: spec.returnType === 0, baseline: facts.peerSelected, facts,
      candidate: (rule?.requires ?? Object.keys(facts)).every(name => facts[name]) };
  }
  const observed = observation(scene.before);
  const strict = spotPair(observed,scene.before);
  const old = !!strict && strict.inks.includes(scene.ink) && strict.inks.includes(scene.active);
  const proposed = observedSelectionHypotheses(observed,scene.before,backing(scene.before));
  const index = proposed.findIndex(h => key(h.target) === key(scene.target) && h.peer === scene.ink && h.active === scene.active);
  if (spec.task === 'recognition') return { expected:true, baseline:old, candidate:old || index >= 0, hypotheses:proposed.length };
  const choices = proposed.map(hypothesis => ({
    mixed: Number(hypothesis.mixed),
    distance: Math.abs(hypothesis.current[0] - hypothesis.target[0]) + Math.abs(hypothesis.current[1] - hypothesis.target[1]),
    truePeer: hypothesis.peer === scene.ink && key(hypothesis.target) === key(scene.target),
  }));
  const rank = rule?.ranking ?? { mixed:1, distance:0 };
  const ordered = proposed.map((hypothesis,i)=>({ hypothesis, choice:choices[i] }))
    .sort((a,b)=>(b.choice.mixed-a.choice.mixed)*rank.mixed+(b.choice.distance-a.choice.distance)*rank.distance);
  let confirmed = false, clicks = 0;
  for (const { hypothesis } of ordered) {
    clicks++;
    let after = key(hypothesis.target) === key(scene.target) ? scene.after : scene.before;
    if (after === scene.before && spec.decoy % 2 === 1) {
      const { pitch, mask, floor, backing } = hypothesis.shape;
      const center = (pitch - 1) / 2;
      const arm = mask.find(i => (i % pitch === center) !== (Math.floor(i / pitch) === center));
      if (arm !== undefined && backing !== floor && backing !== hypothesis.peer) {
        after = copy(scene.before);
        editTile(after,hypothesis.target,pitch,(value,i)=>i===arm?backing:value);
      }
    }
    if (witnessedSelection(hypothesis,scene.before,after)) {
      confirmed = hypothesis.peer === scene.ink;
      break;
    }
  }
  return { expected:true, baseline:old, candidate:old || confirmed, clicks, hypotheses:proposed.length, choices };
}
