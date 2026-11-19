import { measureReductionScene, reductionGeometry, reductionPacked, reductionPoint, retainedReductionScene, type ReductionScene }
  from '../logos-engine/v6-invited-reduction.ts';
import type { NativeCommand, NativeObservation, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { captureCellInk, captureInvitations, deriveCaptureRoute, measureCaptureEffect, type CaptureJump } from './invited-capture.ts';

type Cell = [number, number];
type Population = Parameters<typeof measureCaptureEffect>[0]['before'];
type CaptureMemory = {
  epoch: number;
  geometry: NativeRecord;
  bases: number[];
  focus: Cell | null;
  jumps: Record<string, CaptureJump[]>;
  tried: string[];
  population: number;
  evidence: string[];
  stopped: boolean;
};
export type CaptureRecollection = { epoch: number; geometry: NativeRecord | null; candidate?: CaptureMemory; proved?: CaptureMemory };
const key = (value: unknown) => JSON.stringify(value);
const packed = (scene: ReductionScene) => reductionPacked(scene.bodies) as Population;

function newScene(scene: ReductionScene, epoch: number, proved?: CaptureMemory): CaptureMemory {
  return { epoch, geometry: reductionGeometry(scene), population: scene.bodies.size,
    bases: [...new Set([...scene.cells].filter(([cell]) => !scene.bodies.has(cell)).map(([, pixels]) => captureCellInk(pixels)))],
    focus: null, jumps: proved?.jumps ?? {}, tried: [], evidence: proved?.evidence ?? [], stopped: false };
}

export async function acquireCaptureReturn(previous: CaptureRecollection | undefined, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows): Promise<CaptureRecollection | undefined> {
  if (command.action_ref !== 'ACTION6' || before.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return previous;
  const prior = previous?.epoch === before.level_epoch ? previous : undefined;
  if (prior && !prior.geometry) return prior;
  let local = prior?.candidate;
  const scene = local ? await retainedReductionScene(first, local.geometry) : await measureReductionScene(first);
  if (!scene || scene.bodies.size > 8) return prior ?? { epoch: before.level_epoch, geometry: null };
  local ??= newScene(scene, before.level_epoch);
  const record: CaptureRecollection = { epoch: before.level_epoch, geometry: local.geometry, candidate: local,
    ...(previous?.proved ? { proved: previous.proved } : {}) };
  if (after.levels_completed > before.levels_completed && Object.keys(local.jumps).length) {
    return { ...record, proved: { ...local, evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref] } };
  }
  if (before.level_epoch !== after.level_epoch || before.state !== after.state || first === second || before.frame_hash === after.frame_hash) return record;
  const point = [...scene.cells.keys()].map(cell => JSON.parse(cell) as Cell).find(cell => {
    const [x, y] = reductionPoint(scene, cell), half = Math.floor(scene.pitch / 2);
    return Math.abs(x - command.data.x!) <= half && Math.abs(y - command.data.y!) <= half;
  });
  if (!point) return record;
  const next = await retainedReductionScene(second, local.geometry);
  if (!next) return record;
  const read = packed(scene);
  if (scene.bodies.has(key(point)) && key(read) === key(packed(next)) &&
    key(captureInvitations(scene, local.bases)) !== key(captureInvitations(next, local.bases)) && captureInvitations(next, local.bases).length) {
    return { ...record, candidate: { ...local, focus: point } };
  }
  if (!local.focus || !captureInvitations(scene, local.bases).some(candidate => key(candidate) === key(point))) return record;
  const effect = measureCaptureEffect({ before: read, local: {}, move: { focus: local.focus, target: point, victim: null } }, next, local.focus);
  return effect ? { ...record, candidate: { ...local, focus: point, jumps: {
    ...local.jumps, [effect.rank]: [...local.jumps[effect.rank] ?? [], effect.jump],
  }, evidence: [...local.evidence.slice(-4), before.observation_ref, after.observation_ref] } } : record;
}

export async function projectRecalledCapture(recalled: CaptureMemory, prior: CaptureMemory | undefined, observation: NativeObservation,
  rows: NativeRows, remaining: number) {
  if (recalled.epoch !== observation.level_epoch - 1 || prior?.stopped) return null;
  const scene = prior ? await retainedReductionScene(rows, prior.geometry) : await measureReductionScene(rows);
  if (!scene || scene.bodies.size < 2 || scene.bodies.size > 8 || scene.pitch !== recalled.geometry.pitch
    || key(scene.mask) !== key(recalled.geometry.mask)) return null;
  const local = prior ?? newScene(scene, observation.level_epoch, recalled);
  const exposed = captureInvitations(scene, local.bases), from = packed(scene);
  const route = deriveCaptureRoute(scene, local, exposed, remaining);
  const available = (target: Cell) => !local.tried.includes(key([from, local.focus, target]));
  const found = route?.[0];
  const pending = [...scene.bodies.keys()].map(cell=>JSON.parse(cell) as Cell)
    .sort((a,b)=>a[1]-b[1]||a[0]-b[0]).find(point=>key(point)!==key(local.focus)&&available(point));
  const test = local.focus && exposed.find(available);
  const move = found && available(found.target) ? found
    : test ? { target: test, focus: local.focus!, victim: null }
    : pending ? { target: pending, focus: pending, victim: null } : null;
  if (!move) return null;
  return { local, move, evidence: local.evidence, before: from, selection: key(move.target) === key(move.focus),
    point: reductionPoint(scene, move.target), target: reductionPoint(scene, move.focus),
    ...(scene.bodies.size !== recalled.population && local.tried.length === 0
      ? { novelty: 'The new lattice has a different population to reduce' } : {}) };
}

export async function observeRecalledCapture(projection: NonNullable<Awaited<ReturnType<typeof projectRecalledCapture>>>,
  rows: NativeRows, after: NativeObservation) {
  const { local, selection, move, before } = projection, scene = await retainedReductionScene(rows, local.geometry);
  const effect = !selection && scene ? measureCaptureEffect({ before, local: {}, move }, scene, move.focus) : null;
  const selected = selection && !!scene && key(packed(scene)) === key(before) && captureInvitations(scene, local.bases).length > 0;
  const jumps = { ...local.jumps };
  if (effect) jumps[effect.rank] = [...(jumps[effect.rank] ?? []), effect.jump];
  const matched = selected || !!effect;
  return { matched, memory: { ...local, jumps, stopped: !scene || !selection && !effect && key(packed(scene)) !== key(before),
    focus: matched ? move.target : selection ? null : local.focus,
    tried: [...local.tried, key([before, local.focus, move.target])],
    evidence: matched ? [...local.evidence.slice(-4), after.observation_ref] : local.evidence } };
}
