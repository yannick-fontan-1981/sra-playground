// Hypotheses use within-episode shape identities. Only the relational flags
// leave the projector for transfer to another game.
import { changedFootprints } from './source-contact-footprints.mjs';

const center = p => [0, 1].map(i => (p.bbox[i] + p.bbox[i + 2]) / 2);
const plus = (p, d) => p.map((v, i) => v + d[i]);
const span = p => [0, 1].map(i => p.bbox[i + 2] - p.bbox[i] + 1);
const contains = (p, size, q) => p.every((v, i) => Math.abs(v - q[i]) < size[i] / 2);
const zero = [0, 0];

export function observeEncounterMotion(memory, before, after, action) {
  for (const move of changedFootprints(before, after)) {
    const motors = memory.get(move.shape) ?? new Map();
    const samples = motors.get(action) ?? new Map();
    const vector = [move.dx, move.dy];
    samples.set(vector.join(), vector);
    motors.set(action, samples);
    memory.set(move.shape, motors);
  }
}

function displacement(motors, action) {
  const samples = motors?.get(action);
  return samples?.size === 1 ? samples.values().next().value : undefined;
}

export function projectEncounters(view, memory, a, b, bounds) {
  const predictions = [];
  for (const [shape, motors] of memory) {
    const actors = view.get(shape);
    if (actors?.size !== 1 || motors.size < 2) continue;
    const first = displacement(motors, a), second = displacement(motors, b);
    if (!first || !second) continue;
    const actor = actors.values().next().value, start = center(actor), size = span(actor);
    const middle = plus(start, first), end = plus(middle, second), alone = plus(start, second);
    const pitch = Math.max(...first.map(Math.abs), ...second.map(Math.abs));
    if (pitch > Math.max(...size) * 4 || [middle, end].some(p =>
      p.some((v, i) => v < (size[i] - 1) / 2 || v > bounds[i] - 1 - (size[i] - 1) / 2))) continue;
    for (const [peer, targets] of view) {
      if (peer === shape) continue;
      const peerMotors = memory.get(peer);
      // For a moving target, each predicted response must have been seen.
      // The identity of a moving copy among several is ambiguous.
      if (peerMotors && targets.size !== 1) continue;
      const da = peerMotors ? displacement(peerMotors, a) : zero;
      const db = peerMotors ? displacement(peerMotors, b) : zero;
      if (!da || !db) continue;
      for (const target of targets.values()) {
        const t = center(target), ts = span(target);
        if (Math.max(...ts) > 2 * pitch || ts[0] * ts[1] > 4 * size[0] * size[1]) continue;
        const t1 = plus(t, da), t2 = plus(t1, db);
        if (!contains(end, size, t2) || contains(start, size, t) || contains(middle, size, t1)
          || contains(alone, size, plus(t, db))) continue;
        const flags = ['contact', targets.size === 1 ? 'unique' : 'repeated',
          peerMotors ? 'moving' : 'unmoved', first[0] * second[0] + first[1] * second[1] === 0 ? 'turn' : 'collinear',
          size.every((v, i) => v === ts[i]) ? 'sameSize' : 'differentSize'];
        predictions.push({shape, peer, middle, t1, end, size, flags});
      }
    }
  }
  return predictions;
}

export function preparationVisible(view, prediction) {
  function found(shape, p) {
    return [...(view.get(shape)?.values() ?? [])].some(part => center(part).every((v, i) => v === p[i]));
  }
  return found(prediction.shape, prediction.middle) && found(prediction.peer, prediction.t1);
}

// Search in the joint coordinates of two roles. Each next gesture transports
// both coordinates by their measured displacements. Keep every checkpoint so
// that a real move can invalidate the plan before another command is issued.
export function encounterRoute(view, memory, dirs, bounds, horizon, flag, tried, used) {
  if (flag !== 'contact' && flag !== 'unique') return null;
  let best = null;
  for (const [shape, motors] of memory) {
    const actors = view.get(shape);
    if (actors?.size !== 1 || motors.size < 2) continue;
    const actor = actors.values().next().value, start = center(actor), size = span(actor);
    for (const [peer, targets] of view) {
      if (shape === peer || (flag === 'unique' && targets.size !== 1)) continue;
      const peerMotors = memory.get(peer);
      if (peerMotors && targets.size !== 1) continue;
      const moves = dirs.map(input => ({input, d:displacement(motors,input),
        dt:peerMotors ? displacement(peerMotors,input) : zero}))
        .filter(m => m.d && m.dt && Math.max(...m.d.map(Math.abs)) <= 4*Math.max(...size));
      if (!moves.length) continue;
      const pitch = Math.max(...moves.flatMap(m => m.d.map(Math.abs)));
      for (const target of targets.values()) {
        const t = center(target), ts = span(target);
        if (contains(start,size,t) || Math.max(...ts) > 2*pitch || ts[0]*ts[1] > 4*size[0]*size[1]) continue;
        const id = JSON.stringify([shape,peer,t]);
        if (tried.has(id)) continue;
        const limit = best?.steps.length ?? horizon;
        if (start.some((v,k) => Math.abs(v-t[k]) >= size[k]/2 + limit *
          Math.max(...moves.map(m => Math.abs(m.d[k]-m.dt[k]))))) continue;
        const queue = [{p:start,t,steps:[]}], seen = new Set([[...start,...t].join()]);
        for (let i=0; i<queue.length; i++) {
          const n = queue[i];
          if (n.steps.length >= (best?.steps.length ?? horizon)) break;
          for (const {input,d,dt} of moves) {
            if (n.steps.length === 0 && used.has(input)) continue;
            const p1 = plus(n.p,d), t1 = plus(n.t,dt);
            const inside = (v,sz) => v.every((x,k) => x >= (sz[k]-1)/2 && x <= bounds[k]-1-(sz[k]-1)/2);
            if (!inside(p1,size) || !inside(t1,ts)) continue;
            const pos = [...p1,...t1].join();
            if (seen.has(pos)) continue;
            seen.add(pos);
            const steps = [...n.steps,{input,middle:p1,t1}];
            if (contains(p1,size,t1)) {
              if (!best || steps.length < best.steps.length) best = {id,shape,peer,steps};
            } else if (steps.length < horizon) queue.push({p:p1,t:t1,steps});
          }
        }
      }
    }
  }
  return best;
}
