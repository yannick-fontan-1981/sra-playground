import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, observedMechanicsGroup, resolveStrategyGraph } from './strategy-agenda.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';

export const remoteSupportRouteId = 'sic_remote_support_route';
export const learnRemoteAccessId = 'sic_learn_remote_access';
export const remoteSupportRouteStrategies = {
  test_supported_translation: 'Identify which piece moves across the visible support',
  test_remote_support_control: 'Test whether the control changes a distant passage',
  follow_supported_route: 'Move along a passage on the current layout',
  change_support_to_continue: 'Switch the passage layout to continue toward the target',
} as const;
const graph = compileStrategyGraph({ id: 'reach_target_across_switchable_supports', version: 1, order: 'FALLBACK',
  priorities: ['change_support_to_continue', 'follow_supported_route', 'test_remote_support_control', 'test_supported_translation'],
  strategies: {
    test_supported_translation: [{ fact: 'trial', expected: true, label: 'Two framed pieces and a uniquely measured group of remote controls are visible' }],
    test_remote_support_control: [{ fact: 'probe', expected: true, label: 'The moving piece is on stable support and a remote control has no observed effect yet' }],
    follow_supported_route: [{ fact: 'move', expected: true, label: 'The route starts with a movement across a measured support' }],
    change_support_to_continue: [{ fact: 'switch', expected: true, label: 'The route starts with a measured change of support and the piece can stay on its current cell' }],
  },
}, ['trial', 'probe', 'move', 'switch']);

type Strategy = keyof typeof remoteSupportRouteStrategies;
type Piece = { at: NativePoint; color: number; floor: number };
type Control = { box: NativeBox; color: number };
type Edit = readonly [x: number, y: number, before: number, after: number];
type Pad = { at: NativePoint; floor: number; pixels: number[] };
type Circuit = { button: Control; pads: [Pad, Pad]; pickups: Acquisition[] };
type Scene = { arena: NativeBox; panel: NativeBox; template: string; pitch: number; candidates: Piece[]; controls: Control[]; supports: number[];
  circuit?: Circuit };
type Transfer = { epoch: number; pitch: number; actor: number; target: number; controlColors: number[]; evidence: string[]; template?: string };
type Acquisition = { at: NativePoint; color: number; floor: number };
type State = { epoch: number; scene: Scene; actor: Piece | null; target: Piece | null; effects: (Edit[] | null)[];
  evidence: string[]; effectRefs?: (string | null)[]; stopped: boolean; count: number; recalled?: Transfer; triedAcquisitions?: string[];
  transferred?: boolean };
type Move = { command: NativeCommand; landing: NativePoint | null; floor: number | null; control: number | null; acquisition?: Acquisition;
  transfer?: Control };
type Proposal = NativeProposal & { strategy: Strategy; local: State; move: Move; needId: string };
const directions = [
  ['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0],
] as const;
const inside = (outer: NativeBox, inner: NativeBox) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const cell = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const pixelAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const controlTemplate = (part: ReturnType<typeof geometricComponents>[number]) =>
  JSON.stringify([width(part.bbox), height(part.bbox), part.mask]);

function uniform(rows: NativeRows, [x, y]: NativePoint, pitch: number): number | null {
  const value = pixelAt(rows, [x, y]);
  if (value === undefined || y + pitch > rows.length || x + pitch > rows[0]!.length) return null;
  for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) if (rows[y + dy]![x + dx] !== value) return null;
  return value;
}

const patch = (rows: NativeRows, [x, y]: NativePoint, pitch: number) => rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
const diagonalPad = (pixels: readonly number[]) => pixels.length === 4 && pixels[0] === pixels[3] && pixels[1] === pixels[2] && pixels[0] !== pixels[1];
const padVisible = (rows: NativeRows, pad: Pad, pitch: number) => {
  const actual = patch(rows, pad.at, pitch);
  return diagonalPad(actual) && actual.every(ink => pad.pixels.includes(ink));
};

function measureCircuit(rows: NativeRows, known: Transfer): Scene | null {
  const { pitch, template } = known;
  if (pitch !== 2 || !template) return null;
  const parts = geometricComponents(rows);
  const regions = parts.filter(part => !part.rectangular && part.area * 5 >= rows.length * rows[0]!.length);
  const scenes: Scene[] = [];
  for (const field of regions) for (const panel of regions) {
    if (field === panel || field.bbox[0] <= panel.bbox[2] && panel.bbox[0] <= field.bbox[2]) continue;
    const controls = parts.filter(part => inside(panel.bbox, part.bbox) && controlTemplate(part) === template
      && pixelAt(rows, center(part.bbox)) === part.color).map(part => ({ box: part.bbox, color: part.color }));
    if (controls.length < 3 || controls.length > 5 || new Set(controls.map(control => control.color)).size !== controls.length) continue;
    const actors = parts.filter(part => inside(field.bbox, part.bbox) && part.rectangular
      && width(part.bbox) === pitch && height(part.bbox) === pitch && part.color === known.actor);
    const targets = parts.filter(part => inside(field.bbox, part.bbox) && part.rectangular
      && width(part.bbox) === pitch && height(part.bbox) === pitch && part.color === known.target);
    if (actors.length !== 1 || targets.length !== 1) continue;
    const start = origin(actors[0]!.bbox), goal = origin(targets[0]!.bbox);
    const aligned = ([x, y]: NativePoint) => (x - start[0]) % pitch === 0 && (y - start[1]) % pitch === 0;
    if (!aligned(goal)) continue;
    const excluded = [field.color, known.actor, known.target];
    const floorAt = ([x, y]: NativePoint) => {
      const adjacent = directions.map(([, dx, dy]) => uniform(rows, [x + dx * pitch, y + dy * pitch], pitch));
      const colors = [...new Set(adjacent)].filter((ink): ink is number =>
        ink !== null && !excluded.includes(ink) && adjacent.filter(value => value === ink).length >= 2);
      return colors.length === 1 ? colors[0]! : null;
    };
    const actorFloor = floorAt(start), goalFloor = floorAt(goal);
    if (actorFloor === null || goalFloor === null || actorFloor !== goalFloor) continue;
    const terrain = parts.filter(part => part.rectangular && inside(field.bbox, part.bbox) && aligned(origin(part.bbox))
      && width(part.bbox) % pitch === 0 && height(part.bbox) % pitch === 0 && !excluded.includes(part.color));
    const supports = [...new Set([actorFloor, ...terrain.map(part => part.color)])];
    const [l,t,r,b] = field.bbox;
    const first = (anchor: number, from: number) => from + ((anchor - from) % pitch + pitch) % pitch;
    const markers: { at: NativePoint; inks: number[]; pixels: number[]; floor: number }[] = [];
    const pickups: Acquisition[] = [];
    for (let y = first(start[1], t); y + pitch - 1 <= b; y += pitch) {
      for (let x = first(start[0], l); x + pitch - 1 <= r; x += pitch) {
        const at: NativePoint = [x, y], pixels = patch(rows, at, pitch), inks = [...new Set(pixels)];
        if (inks.length !== 2 || inks.some(ink => excluded.includes(ink))) continue;
        if (diagonalPad(pixels)) {
          const floor = floorAt(at);
          if (floor === actorFloor && !inks.includes(floor)) markers.push({ at, inks, pixels, floor });
        } else if (pixels.filter(ink => ink === actorFloor).length === 1) {
          const color = inks.find(ink => ink !== actorFloor)!;
          if (!controls.some(control => control.color === color)) pickups.push({ at, color, floor: actorFloor });
        }
      }
    }
    const linked = controls.flatMap<Pick<Circuit, 'button' | 'pads'>>(button => {
      const endpoints = markers.filter(marker => marker.inks.includes(button.color));
      const [first, second] = endpoints;
      return endpoints.length === 2 && first && second && first.inks.every(ink => second.inks.includes(ink))
        ? [{ button, pads: [first, second] }] : [];
    });
    if (linked.length !== 1 || new Set(pickups.map(item => item.color)).size !== 1 || pickups.length > 4) continue;
    const { button, pads } = linked[0]!, other = controls.filter(control => control !== button);
    if (other.some(control => !supports.includes(control.color))) continue;
    scenes.push({ arena: field.bbox, panel: panel.bbox, template, pitch, supports,
      controls: other, candidates: [{ at: start, color: known.actor, floor: actorFloor }, { at: goal, color: known.target, floor: goalFloor }],
      circuit: { button, pads, pickups } });
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function measureScene(rows: NativeRows, recalled?: Transfer | null): Scene | null {
  const parts = geometricComponents(rows);
  const regions = parts.filter(part => !part.rectangular && part.area * 5 >= rows.length * rows[0]!.length);
  const scenes: Scene[] = [];
  for (const field of regions) for (const panel of regions) {
    if (field === panel || (field.bbox[0] <= panel.bbox[2] && panel.bbox[0] <= field.bbox[2])) continue;
    const controls = parts.filter(part => !part.rectangular && part.area >= 8 && inside(panel.bbox, part.bbox)
      && part.color !== panel.color && pixelAt(rows, center(part.bbox)) === part.color);
    if (controls.length < (recalled ? 1 : 2) || controls.length > (recalled ? 6 : 3)
      || new Set(controls.map(part => part.color)).size !== controls.length) continue;
    if (new Set(controls.map(controlTemplate)).size !== 1) continue;
    const pieces = parts.filter(part => part.rectangular && width(part.bbox) === height(part.bbox) && width(part.bbox) >= 2
      && (!recalled || (width(part.bbox) === recalled.pitch && [recalled.actor, recalled.target].includes(part.color)))
      && inside(field.bbox, part.bbox) && part.color !== field.color).flatMap(part => {
      const [x, y] = origin(part.bbox), pitch = width(part.bbox);
      const surrounds = directions.map(([, dx, dy]) => uniform(rows, [x + dx * pitch, y + dy * pitch], pitch));
      if (recalled) {
        const votes = new Map<number, number>();
        for (const value of surrounds) if (value !== null && value !== field.color && value !== recalled.actor && value !== recalled.target) {
          votes.set(value, (votes.get(value) ?? 0) + 1);
        }
        const winners = [...votes].filter(([, count]) => count >= 2);
        return winners.length === 1 ? [{ part, floor: winners[0]![0] }] : [];
      }
      return surrounds[0] !== null && surrounds[0] !== undefined && surrounds[0] !== field.color
        && surrounds.every(value => value === surrounds[0]) ? [{ part, floor: surrounds[0] }] : [];
    });
    if (pieces.length !== 2) continue;
    const [first, second] = pieces as [typeof pieces[number], typeof pieces[number]];
    const pitch = width(first.part.bbox);
    const candidates = pieces.map(({ part, floor }) => ({ at: origin(part.bbox), color: part.color, floor }));
    if (pitch !== width(second.part.bbox) || first.floor !== second.floor || first.part.color === second.part.color
      || candidates.some(({ at: [x, y] }) => (x - candidates[0]!.at[0]) % pitch || (y - candidates[0]!.at[1]) % pitch)) continue;
    const supports = new Set(parts.filter(part => part.rectangular && part.area >= pitch * pitch && inside(field.bbox, part.bbox)
      && width(part.bbox) % pitch === 0 && height(part.bbox) % pitch === 0
      && (part.bbox[0] - candidates[0]!.at[0]) % pitch === 0 && (part.bbox[1] - candidates[0]!.at[1]) % pitch === 0)
      .map(part => part.color));
    candidates.forEach(piece => supports.delete(piece.color));
    supports.delete(field.color);
    if (!controls.every(control => supports.has(control.color))) continue;
    scenes.push({ arena: field.bbox, panel: panel.bbox, template: controlTemplate(controls[0]!), pitch, candidates,
      controls: controls.map(control => ({ box: control.bbox, color: control.color })),
      supports: [...supports] });
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function remoteEdits(first: NativeRows, second: NativeRows, arena: NativeBox, control: Control, recalled: boolean, circuit = false) {
  const edits: Edit[] = [], [l, t, r, b] = arena;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    const before = first[y]![x]!, after = second[y]![x]!;
    if (before === after) continue;
    if (!recalled && before !== control.color && after !== control.color) return null;
    edits.push([x, y, before, after]);
  }
  if (recalled) {
    const colors = new Set(edits.flatMap(edit => [edit[2], edit[3]]));
    const [a] = colors, forward = edits.filter(edit => edit[2] === a).length;
    if (circuit && colors.size === 2 && colors.has(control.color) && edits.every(edit => edit[3] === control.color)) return edits;
    return colors.size === 2 && forward > 0 && forward < edits.length
      && (colors.has(control.color) || forward * 2 === edits.length) ? edits : null;
  }
  const countGained = edits.filter(edit => edit[3] === control.color).length;
  return edits.length > 0 && countGained * 2 === edits.length ? edits : null;
}

function sameEdits(actual: Edit[], expected: Edit[]) {
  const reversed = actual[0]?.[2] === expected[0]?.[3];
  return actual.length === expected.length && actual.every(([x, y, before, after], index) => {
    const [u, v, a, b] = expected[index]!;
    return x === u && y === v && (reversed ? before === b && after === a : before === a && after === b);
  });
}

function atPiece(rows: NativeRows, piece: Piece, pitch: number) {
  return uniform(rows, piece.at, pitch) === piece.color;
}

function controlCommand(control: Control): NativeCommand {
  const [x, y] = center(control.box);
  return { action_ref: 'ACTION6', data: { x, y } };
}

function searchRoute(rows: NativeRows, local: State, inputs: readonly NativeCommand[], remaining: number, acquisitions: Acquisition[] = []): Move | null {
  const { scene: { arena, pitch, supports, controls, circuit }, effects } = local;
  const actor = local.actor!, target = local.target!;
  const occupied = cell(actor.at, pitch);
  const editsAt = new Map<string, { bit: number; value: number }>();
  let knownMask = 0;
  for (const [i, edits] of effects.entries()) {
    if (!edits) continue;
    const bit = 1 << i;
    const current = edits.map(([x, y, before, after]) => {
      const value = inside(occupied, [x, y, x, y]) ? actor.floor : rows[y]![x];
      return value === before ? false : value === after ? true : null;
    });
    if (current.some(value => value === null || value !== current[0])) return null;
    const activationOnly = circuit && edits.every(edit => edit[3] === controls[i]!.color);
    if (!activationOnly || !current[0]) knownMask |= bit;
    for (const [x, y, before, after] of edits) {
      const key = `${x},${y}`;
      if (editsAt.has(key)) return null;
      editsAt.set(key, { bit, value: current[0] ? before : after });
    }
  }
  const passes = (at: NativePoint, mask: number) => {
    const footprint = cell(at, pitch);
    if (!inside(arena, footprint)) return null;
    if (same(at, target.at)) return target.floor;
    const pad = circuit?.pads.find(pad => same(at, pad.at));
    if (pad) return pad.floor;
    const marker = acquisitions.find(item => same(at, item.at));
    if (marker) return marker.floor;
    let first: number | undefined;
    for (let y = at[1]; y <= footprint[3]; y++) for (let x = at[0]; x <= footprint[2]; x++) {
      const edit = editsAt.get(`${x},${y}`);
      const value = edit && (mask & edit.bit) ? edit.value : same(at, actor.at) ? actor.floor : rows[y]![x]!;
      first ??= value;
      if (value !== first) return null;
    }
    return first !== undefined && supports.includes(first) ? first : null;
  };
  const options = directions.flatMap(([key, dx, dy]) => {
    const command = inputs.find(input => input.action_ref === key);
    return command ? [{ command, dx, dy }] : [];
  });
  type Position = { at: NativePoint; mask: number; first: Move | null; depth: number };
  const queue: Position[] = [{ at: actor.at, mask: 0, first: null, depth: 0 }];
  const seen = new Set([`${actor.at.join(',')}:0`]);
  for (const { at, mask, first, depth } of queue) {
    const acquisition = acquisitions.find(item => same(at, item.at));
    if (first && acquisition) return { ...first, acquisition };
    if (!acquisitions.length && same(at, target.at)) return first;
    if (depth >= remaining) continue;
    const add = (next: NativePoint, nextMask: number, move: Move) => {
      const key = `${next.join(',')}:${nextMask}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({ at: next, mask: nextMask, first: first ?? move, depth: depth + 1 });
    };
    for (const { command, dx, dy } of options) {
      const next: NativePoint = [at[0] + dx * pitch, at[1] + dy * pitch];
      const floor = passes(next, mask);
      if (floor !== null) add(next, mask, { command, landing: next, floor, control: null });
    }
    const here = circuit?.pads.findIndex(pad => same(at, pad.at)) ?? -1;
    if (circuit && here >= 0) {
      const landing = circuit.pads[1 - here]!;
      add(landing.at, mask, { command: controlCommand(circuit.button), landing: landing.at, floor: landing.floor,
        control: null, transfer: circuit.button });
    }
    for (const [index, control] of controls.entries()) {
      const bit = 1 << index, nextMask = mask ^ bit;
      const support = passes(at, mask);
      if ((knownMask & bit) && support !== null && support === passes(at, nextMask)) {
        add(at, nextMask, { command: controlCommand(control), landing: null, floor: null, control: index });
      }
    }
  }
  return null;
}

function acquisitionSites(rows: NativeRows, local: State): Acquisition[] {
  const { scene: { arena, pitch, controls, supports, circuit }, actor, recalled } = local;
  if (!recalled || !actor) return [];
  if (circuit) return circuit.pickups.filter(marker => !controls.some(control => control.color === marker.color)
    && !local.triedAcquisitions?.includes(marker.at.join(',')) && patch(rows, marker.at, pitch).includes(marker.color));
  const missing = recalled.controlColors.filter(color => !controls.some(control => control.color === color));
  if (!missing.length) return [];
  const phase = (from: number, at: number) => from + ((at - from) % pitch + pitch) % pitch;
  const candidates: Acquisition[] = [];
  for (let y = phase(arena[1], actor.at[1]); y + pitch - 1 <= arena[3]; y += pitch) {
    for (let x = phase(arena[0], actor.at[0]); x + pitch - 1 <= arena[2]; x += pitch) {
      const at: NativePoint = [x, y];
      if (same(at, actor.at) || local.triedAcquisitions?.includes(at.join(','))) continue;
      const colors = new Set(rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch)));
      const markers = missing.filter(color => colors.has(color));
      if (colors.size !== 2 || markers.length !== 1) continue;
      const [color] = markers, floor = [...colors].find(value => value !== color)!;
      if (supports.includes(floor)) candidates.push({ at, color: color!, floor });
    }
  }
  return candidates;
}

function newControls(rows: NativeRows, scene: Scene) {
  return geometricComponents(rows).filter(part => inside(scene.panel, part.bbox) && controlTemplate(part) === scene.template
    && pixelAt(rows, center(part.bbox)) === part.color && !scene.controls.some(control => control.color === part.color))
    .map(part => ({ box: part.bbox, color: part.color }));
}

function motionTrial(rows: NativeRows, scene: Scene, inputs: readonly NativeCommand[]): Move | null {
  const choices = directions.flatMap(([action, dx, dy]) => {
    const command = inputs.find(input => input.action_ref === action);
    if (!command) return [];
    const landing = scene.candidates.map(piece =>
      [piece.at[0] + dx * scene.pitch, piece.at[1] + dy * scene.pitch] as NativePoint);
    if (!landing.every((at, i) => uniform(rows, at, scene.pitch) === scene.candidates[i]!.floor)) return [];
    return [{ command, landing: null, floor: null, control: null }];
  });
  return choices[0] ?? null;
}

export function createSicRemoteSupportRoute(family = remoteSupportRouteId): NativeFamily<Proposal> {
  const learns = family === learnRemoteAccessId;
  let state: State | null = null;
  let transfer: Transfer | null = null;
  return {
    id: family,
    async proposeInGroup(group, observation, rows, inputs, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      if (learns || transfer?.epoch !== observation.level_epoch - 1) return null;
      const proposed = await this.propose(observation, rows, inputs, remaining, execution);
      return proposed?.local.scene.circuit ? proposed : null;
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const recalled = transfer?.epoch === observation.level_epoch - 1 ? transfer : null;
      if (prior?.stopped || (prior?.count ?? 0) >= 64) return null;
      if (learns && !prior && !recalled && !execution?.readDirectionalMotion) return null;
      const fresh = prior ? null : measureScene(rows);
      const revalidated = !prior && !fresh && recalled ? measureScene(rows, recalled) : null;
      const circuit = !prior && !fresh && !revalidated && recalled ? measureCircuit(rows, recalled) : null;
      const scene = prior?.scene ?? fresh ?? revalidated ?? circuit;
      if (!scene) return null;
      let local: State = prior ?? { epoch: observation.level_epoch, scene, actor: null, target: null,
        effects: scene.controls.map(() => null), evidence: (revalidated || circuit) && recalled ? recalled.evidence : [], stopped: false, count: 0,
        ...((revalidated || circuit) && recalled ? { recalled } : {}) };
      if ((revalidated || circuit) && recalled) {
        local = { ...local, actor: scene.candidates.find(piece => piece.color === recalled.actor)!,
          target: scene.candidates.find(piece => piece.color === recalled.target)!, effectRefs: scene.controls.map(() => null) };
      } else if (learns && !prior) {
        const motion = execution?.readDirectionalMotion?.();
        if (motion?.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch) return null;
        const candidates = scene.candidates.filter(piece => motion.translations.some(({ to, displacement, color }) =>
          color === piece.color && same(piece.at, origin(to)) && width(to) === scene.pitch && height(to) === scene.pitch
          && (displacement[0] === 0 || displacement[1] === 0) && Math.abs(displacement[0]) + Math.abs(displacement[1]) === scene.pitch));
        if (candidates.length !== 1) return null;
        local = { ...local, actor: candidates[0]!, target: scene.candidates.find(piece => piece !== candidates[0])!,
          evidence: [motion.beforeRef, motion.afterRef], effectRefs: scene.controls.map(() => null) };
      }
      const { actor, target } = local;
      if (actor && target && (!atPiece(rows, actor, scene.pitch) || !atPiece(rows, target, scene.pitch))) return null;
      const probe = local.effects.findIndex(effect => effect === null);
      const trial = !actor ? motionTrial(rows, scene, inputs) : null;
      const question = actor && probe !== -1 && scene.controls[probe]!.color !== actor.floor
        ? { command: controlCommand(scene.controls[probe]!), landing: null, floor: null, control: probe } : null;
      const limit = Math.min(remaining, 64 - local.count);
      let route = actor && target && probe === -1 ? searchRoute(rows, local, inputs, limit) : null;
      if (!route && actor && target && probe === -1 && local.recalled) {
        const markers = acquisitionSites(rows, local);
        if (markers.length) route = searchRoute(rows, local, inputs, limit, markers);
      }
      const ref = observation.observation_ref;
      const effectRef = route?.control == null ? null : local.effectRefs?.[route.control];
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(effectRef ? [effectRef] : [])].filter(item => item !== ref))];
      const normal = resolveStrategyGraph({ graph, mode: 'active', facts: {
        trial: { value: !!trial, evidence }, probe: { value: !!question, evidence },
        move: { value: !!route?.landing, evidence }, switch: { value: route?.control != null, evidence },
      }, planners: { test_supported_translation: () => trial, test_remote_support_control: () => question,
        follow_supported_route: () => route, change_support_to_continue: () => route } });
      if (!normal.selected) return null;
      const move = normal.selected.plan, parent = 'G_official_completion';
      const label = move.transfer ? (local.transferred ? 'Use the observed transfer between the two matching pads'
        : 'Test the matching control while standing on one of the two patterned pads')
        : move.acquisition ? 'Reach the marker to test whether it makes the missing control available'
        : remoteSupportRouteStrategies[normal.selected.id];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: move.command.action_ref, expected: move.landing, evidence };
      const primitive = learns ? resolveNavigationPrimitives({ mode, evidence, probe: route ? null : offer,
        access: route?.landing ? offer : null, interaction: route?.control != null ? offer : null }) : null;
      const strategy = primitive?.selected?.id ?? normal.selected.id;
      const goal = { kind: 'reach_target_on_switchable_support', scope: ref.split(':revision:', 1)[0]!, subjects: ['visible_support_and_controls'],
        parentObjective: parent, satisfactionContract: 'observe_official_progress_after_supported_navigation' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `${learns ? family : 'remote-support'}:${need.id}`, actions = [move.command];
      const control = move.transfer ?? (move.control === null ? null : scene.controls[move.control]!);
      const edits = move.control === null ? null : local.effects[move.control];
      const affectedSupport = edits?.length ? [
        Math.min(...edits.map(edit => edit[0])), Math.min(...edits.map(edit => edit[1])),
        Math.max(...edits.map(edit => edit[0])), Math.max(...edits.map(edit => edit[1])),
      ] : null;
      const pointBinding = control ? await ObservedInputDomain.makeLocusWitness(observation, rows, center(control.box), { reason: label, evidence }) : null;
      return { status: 'proposed', kind: family, actions, strategy: normal.selected.id, local, move, needId: need.id,
        steps: [{ action: move.command, expected_after: null, ...(pointBinding ? { point_binding: pointBinding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Reach the other piece by finding connected support', mode: learns ? mode : route ? 'solving' : 'exploration',
          situation: label, agenda: primitive?.entries ?? normal.entries, evidence, actor: actor ? cell(actor.at, scene.pitch) : null,
          target: target ? cell(target.at, scene.pitch) : null, control: control?.box ?? null,
          landing: move.landing ? cell(move.landing, scene.pitch) : null, affectedSupport,
          acquisition: move.acquisition ? cell(move.acquisition.at, scene.pitch) : null },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label: primitive?.selected ? navigationPrimitives[primitive.selected.id] : label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'support_route_observation_bound' : 'support_route_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const update = observeReturn(proposal, first, second);
      const { landing, acquisition } = proposal.move;
      if (proposal.move.transfer) return { matched: !update.stopped, seal_prefix: true,
        reason: update.stopped ? 'paired_pad_transfer_contradicted' : 'nonlocal_transfer_and_unchanged_terrain_confirmed' };
      if (!update.stopped && landing && acquisition && same(landing, acquisition.at)) {
        const matched = update.scene.controls.length > proposal.local.scene.controls.length;
        return { matched, seal_prefix: true, reason: matched ? 'new_control_appeared_on_contact' : 'expected_control_did_not_appear' };
      }
      return { matched: !update.stopped, seal_prefix: true,
        reason: update.stopped ? 'support_route_hypothesis_contradicted' : 'support_route_effect_observed' };
    },
    record(before, after, _command, first, second, proposal) {
      const { local } = proposal;
      if (after.levels_completed > before.levels_completed && local.actor && local.target) {
        transfer = { epoch: before.level_epoch, pitch: local.scene.pitch, actor: local.actor.color, target: local.target.color,
          controlColors: local.scene.controls.filter((_, i) => !!local.effects[i]).map(control => control.color),
          evidence: [before.observation_ref, after.observation_ref], template: local.scene.template };
        return { events: [], reviewEvidence: 'The measured controls made the supported route to the target possible.' };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const update = observeReturn(proposal, first, second);
      state = { ...update, count: update.count + 1, evidence: [...update.evidence.slice(-5), after.observation_ref] };
      const { control } = proposal.move;
      if (state.effectRefs && control !== null && !proposal.local.effects[control] && update.effects[control]) {
        state.effectRefs = state.effectRefs.map((ref, i) => i === control ? after.observation_ref : ref);
      }
      if (state.scene.controls.length > local.scene.controls.length) {
        return { events: [], reviewEvidence: 'Contact with the marker made the missing control visible.' };
      }
      return { events: [] };
    },
    state: () => ({ state, transfer }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      transfer = structuredClone(value.transfer as Transfer | null) ?? null;
    },
  };
}

function observeReturn({ local, move }: Proposal, first: NativeRows, second: NativeRows): State {
  const { scene: { arena, candidates, controls, pitch }, actor, target, effects } = local;
  const stopped = { ...local, stopped: true };
  if (!actor) {
    const direction = directions.find(([key]) => key === move.command.action_ref);
    if (!direction) return stopped;
    const [, dx, dy] = direction;
    const translated = candidates.flatMap((piece, index) => {
      const at: NativePoint = [piece.at[0] + dx * pitch, piece.at[1] + dy * pitch];
      return atPiece(second, { ...piece, at }, pitch) && !atPiece(second, piece, pitch) ? [{ index, at }] : [];
    });
    if (translated.length !== 1) return stopped;
    const { index, at } = translated[0]!, peer = candidates[1 - index]!;
    return atPiece(second, peer, pitch) ? { ...local, actor: { ...candidates[index]!, at }, target: peer } : stopped;
  }
  if (!target || !atPiece(second, target, pitch)) return stopped;
  if (move.control !== null) {
    const control = controls[move.control]!;
    const edit = remoteEdits(first, second, arena, control, !!local.recalled, !!local.scene.circuit);
    const expected = effects[move.control];
    if (!atPiece(second, actor, pitch) || !edit || (expected && !sameEdits(edit, expected))) return stopped;
    const supports = local.scene.circuit && !local.scene.supports.includes(control.color) && edit.some(entry => entry[3] === control.color)
      ? [...local.scene.supports, control.color] : local.scene.supports;
    return expected ? local : { ...local, scene: { ...local.scene, supports }, effects: effects.map((old, index) => index === move.control ? edit : old) };
  }
  if (!move.landing || move.floor === null) return stopped;
  const translated = { ...actor, at: move.landing, floor: move.floor };
  const circuit = local.scene.circuit, departed = circuit?.pads.find(pad => same(pad.at, actor.at));
  const restored = departed ? padVisible(second, departed, pitch) : uniform(second, actor.at, pitch) === actor.floor;
  if (!atPiece(second, translated, pitch) || !restored) return stopped;
  if (move.transfer) {
    const arrived = circuit?.pads.find(pad => same(pad.at, translated.at));
    if (!departed || !arrived || arrived === departed || !padVisible(first, arrived, pitch)) return stopped;
    const sourceBox = cell(departed.at, pitch), targetBox = cell(arrived.at, pitch);
    for (let y = arena[1]; y <= arena[3]; y++) for (let x = arena[0]; x <= arena[2]; x++) {
      const point: NativeBox = [x, y, x, y];
      if (!inside(sourceBox, point) && !inside(targetBox, point) && first[y]?.[x] !== second[y]?.[x]) return stopped;
    }
    return { ...local, actor: translated, transferred: true };
  }
  if (!move.acquisition || !same(translated.at, move.acquisition.at)) return { ...local, actor: translated };
  const discovered = newControls(second, local.scene).filter(control => control.color === move.acquisition!.color);
  if (discovered.length !== 1 || controls.length >= 6) return { ...local, actor: translated,
    triedAcquisitions: [...(local.triedAcquisitions ?? []), translated.at.join(',')] };
  return { ...local, actor: translated, scene: { ...local.scene, controls: [...controls, discovered[0]!] },
    effects: [...effects, null], ...(local.effectRefs ? { effectRefs: [...local.effectRefs, null] } : {}) };
}
