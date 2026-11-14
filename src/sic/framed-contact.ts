import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { morphologyPairs } from '../logos-engine/v6-morphology-measurements.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const framedContactId = 'sic_framed_contact';
export const framedContactStrategies = {
  locate_rigid_control: 'Identify the piece that moves with a direction',
  test_pattern_change: 'Test a contact that might change the motif',
  reach_matching_pattern: 'Approach the matching motif',
} as const;
const graph = compileStrategyGraph({ id: 'reach_a_framed_motif', version: 1, order: 'FALLBACK',
  priorities: ['reach_matching_pattern', 'test_pattern_change', 'locate_rigid_control'],
  strategies: {
    reach_matching_pattern: [{ fact: 'canReachPeer', expected: true, label: 'Aligned motifs and a route over the observed surface' }],
    test_pattern_change: [{ fact: 'canReachContrast', expected: true, label: 'A distinct surface can be tested from observed floor' }],
    locate_rigid_control: [{ fact: 'controlTrial', expected: true, label: 'A direction can be tested for unit translation' }],
  },
}, ['canReachPeer', 'canReachContrast', 'controlTrial']);
const directionVectors = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
type Direction = keyof typeof directionVectors;
type Body = { at: NativePoint; pitch: number; floor: number; colors: number[]; evidence: string };
type State = { epoch: number; body: Body | null; target: NativeBox | null; surface: NativeBox | null;
  trials: Direction[]; blocked: string[]; tested: string[]; count: number };
type Plan = { command: Direction; landing: NativePoint; target: NativePoint; contact: boolean };
type Proposal = NativeProposal & { action: Direction; plan: Plan | null; target: NativeBox | null; surface: NativeBox | null; needId: string };
const empty = (epoch = 0): State => ({ epoch, body: null, target: null, surface: null, trials: [], blocked: [], tested: [], count: 0 });
const pointKey = (point: NativePoint) => point.join(',');
const footprint = ([x, y]: NativePoint, pitch: number): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];
const pixelsAt = (rows: NativeRows, [x, y]: NativePoint, pitch: number) =>
  rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
const overlaps = (a: NativeBox, b: readonly number[]) => a[0] <= b[2]! && a[2] >= b[0]! && a[1] <= b[3]! && a[3] >= b[1]!;

function sameLanding(first: NativeRows, second: NativeRows, { at, pitch, floor, colors }: Body, landing: NativePoint): boolean {
  const prior = pixelsAt(first, at, pitch), vacancy = pixelsAt(second, at, pitch);
  const endpoint = pixelsAt(second, landing, pitch);
  if (endpoint.length !== prior.length) return false;
  if (endpoint.every((pixel, index) => pixel === prior[index]) && vacancy.some((pixel, index) => pixel !== prior[index])) return true;
  return vacancy.every(pixel => pixel === floor) && endpoint.some(pixel => colors.includes(pixel));
}

function measureTranslation(first: NativeRows, second: NativeRows, action: Direction, evidence: string): Body | null {
  const parts = (rows: NativeRows) => geometricComponents(rows).filter(part => part.area > 1 && part.area * 4 < rows.length * rows[0]!.length);
  const group = (rows: NativeRows) => {
    const byShape = new Map<string, ReturnType<typeof parts>>();
    for (const part of parts(rows)) {
      const key = JSON.stringify([part.color, part.mask]);
      const matches = byShape.get(key) ?? [];
      matches.push(part);
      byShape.set(key, matches);
    }
    return byShape;
  };
  const from = group(first), to = group(second);
  const [dx, dy] = directionVectors[action];
  const moving = [...from].flatMap(([key, old]) => {
    const next = to.get(key);
    if (old.length !== 1 || next?.length !== 1) return [];
    const a = old[0]!, b = next[0]!;
    const pitch = (b.bbox[0] - a.bbox[0]) * dx + (b.bbox[1] - a.bbox[1]) * dy;
    return pitch > 1 && b.bbox[0] === a.bbox[0] + dx * pitch && b.bbox[1] === a.bbox[1] + dy * pitch ? [{ a, pitch }] : [];
  });
  const fits = new Map<string, Body>();
  for (const { a, pitch } of moving) {
    for (const { a: peer, pitch: length } of moving) {
      if (length !== pitch) continue;
      const x = Math.min(a.bbox[0], peer.bbox[0]), y = Math.min(a.bbox[1], peer.bbox[1]);
      const box = footprint([x, y], pitch);
      const enclosed = moving.filter(item => item.pitch === pitch && item.a.bbox[0] >= x && item.a.bbox[1] >= y
        && item.a.bbox[2] <= box[2] && item.a.bbox[3] <= box[3]);
      if (enclosed.reduce((sum, item) => sum + item.a.area, 0) !== pitch * pitch) continue;
      const exposed = new Set(pixelsAt(second, [x, y], pitch));
      if (exposed.size !== 1) continue;
      const floor = [...exposed][0]!, colors = [...new Set(enclosed.map(item => item.a.color))];
      if (!colors.includes(floor)) fits.set(pointKey([x, y]), { at: [x + dx * pitch, y + dy * pitch], pitch, floor, colors, evidence });
    }
  }
  return fits.size === 1 ? [...fits.values()][0]! : null;
}

function route(rows: NativeRows, body: Body, surface: NativeBox, directions: readonly Direction[], target: NativeBox | null, aligned: boolean,
  local: State, remaining: number): Plan | null {
  const { at: start, pitch, floor } = body;
  const [left, top, right, bottom] = surface;
  const queue: { at: NativePoint; depth: number; first?: { command: Direction; landing: NativePoint } }[] = [{ at: start, depth: 0 }];
  const seen = new Set([pointKey(start)]);
  const candidates: { plan: Plan; distance: number; clean: number; depth: number; variety: number }[] = [];
  for (const current of queue) {
    if (current.depth >= remaining || queue.length > 256) break;
    for (const command of directions) {
      const [dx, dy] = directionVectors[command];
      const at: NativePoint = [current.at[0] + dx * pitch, current.at[1] + dy * pitch], key = pointKey(at);
      if (seen.has(key) || local.blocked.includes(key) || at[0] < left || at[0] + pitch - 1 > right || at[1] < 0
        || at[1] + pitch > rows.length || (!aligned && (at[1] < top || at[1] + pitch - 1 > bottom))) continue;
      const patch = pixelsAt(rows, at, pitch), clean = patch.filter(pixel => pixel === floor).length;
      const first = current.first ?? { command, landing: at };
      if (clean === patch.length) {
        seen.add(key);
        queue.push({ at, depth: current.depth + 1, first });
        continue;
      }
      const intersectsTarget = !!target && overlaps(footprint(at, pitch), target);
      const contact = aligned && intersectsTarget;
      if (local.tested.includes(`${contact}:${key}`)) continue;
      const varied = new Set(patch).size;
      if (!contact && (intersectsTarget || varied < 2 || (!clean && (aligned || varied < 3)))) continue;
      const distance = aligned && target ? Math.abs(at[0] + pitch / 2 - (target[0] + target[2] + 1) / 2)
        + Math.abs(at[1] + pitch / 2 - (target[1] + target[3] + 1) / 2) : 0;
      candidates.push({ plan: { ...first, target: at, contact }, distance, clean,
        depth: current.depth + 1, variety: varied });
    }
  }
  candidates.sort((a, b) => Number(b.plan.contact) - Number(a.plan.contact) || a.distance - b.distance
    || (!aligned ? b.variety - a.variety : 0) || a.depth - b.depth || b.clean - a.clean);
  return candidates[0]?.plan ?? null;
}

export function createSicFramedContact(): NativeFamily<Proposal> {
  let state = empty();
  return {
    id: framedContactId,
    async propose(observation, rows, inputs, remaining) {
      const local = state.epoch === observation.level_epoch ? state : empty(observation.level_epoch);
      const available = inputs.map(input => input.action_ref).filter((key): key is Direction => Object.hasOwn(directionVectors, key));
      if (remaining < 1 || local.count >= 32 || available.length !== 4) return null;
      const [pairs, parts] = await morphologyPairs(rows);
      if (pairs.length !== 1 || pairs[0]!.quarter_turns === null) return null;
      const pair = pairs[0]!, body = local.body, ref = observation.observation_ref;
      const surface = body ? local.surface ?? parts.filter(part => part.color === body.floor
        && overlaps([body.at[0] - 1, body.at[1] - 1, body.at[0] + body.pitch, body.at[1] + body.pitch], part.bbox))
        .sort((a, b) => b.area - a.area)[0]?.bbox ?? null : null;
      const peers = surface ? pair.sites.filter(site => site[0]! >= surface[0] && site[1]! >= surface[1]
        && site[2]! <= surface[2] && site[3]! <= surface[3]) : [];
      const retained = local.target && pair.sites.some(site => site.every((value, index) => value === local.target![index])) ? local.target : null;
      const target = retained ?? (peers.length === 1 ? peers[0] as unknown as NativeBox : null);
      const plan = body && surface ? route(rows, body, surface, available, target, pair.quarter_turns === 0 && !!target, local, remaining) : null;
      const trial = !body && available.find(key => !local.trials.includes(key));
      const command = inputs.find(input => input.action_ref === (plan?.command ?? trial));
      if (!command) return null;
      const action = command.action_ref as Direction;
      const evidence: [string, ...string[]] = body ? [ref, body.evidence] : [ref];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        canReachPeer: { value: plan?.contact === true, evidence },
        canReachContrast: { value: !!plan && !plan.contact, evidence },
        controlTrial: { value: !!trial, evidence },
      }, planners: { reach_matching_pattern: () => command, test_pattern_change: () => command, locate_rigid_control: () => command } });
      if (!selected) return null;
      const strategy = selected.id, label = framedContactStrategies[strategy], objective = 'G_official_completion';
      const goal = { kind: 'test_access_to_matching_motif', scope: ref.split(':revision:', 1)[0]!, subjects: pair.sites.map(site => site.join(',')),
        parentObjective: objective, satisfactionContract: 'observe_public_contact_and_official_progress' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `framed-contact:${need.id}`, actions = [command];
      return { status: 'proposed', kind: framedContactId, actions, action, plan, target, surface, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, mode: plan?.contact ? 'solving' : 'exploration', need: 'Find how to reach the matching motif',
          situation: label, evidence, agenda: entries, motifs: pair.sites,
          ...(body ? { controlledPiece: footprint(body.at, body.pitch) } : {}),
          ...(body && plan ? { addressedRegion: footprint(plan.target, body.pitch) } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'framed_contact_scope_bound' : 'framed_contact_scope_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      const scored = after.levels_completed > before.levels_completed;
      const body = state.body;
      const matched = !scored && proposal.plan && body ? sameLanding(first, second, body, proposal.plan.landing) : null;
      return { matched, seal_prefix: true, reason: scored ? 'official_boundary' : matched === false ? 'predicted_piece_did_not_leave'
        : 'observe_the_contact_or_displacement',
        ...(scored ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, _command, first, second, proposal) {
      if (after.level_epoch !== before.level_epoch || after.state !== before.state) return { events: [] };
      if (state.epoch !== before.level_epoch) state = empty(before.level_epoch);
      state.count++;
      state.target = proposal.target;
      state.surface = proposal.surface;
      if (!state.body) {
        state.trials.push(proposal.action);
        state.body = measureTranslation(first, second, proposal.action, after.observation_ref);
      } else if (proposal.plan) {
        const { plan } = proposal, { at, pitch } = state.body;
        const key = pointKey(plan.landing);
        if (key === pointKey(plan.target)) state.tested.push(`${plan.contact}:${key}`);
        const prior = pixelsAt(first, at, pitch), vacancy = pixelsAt(second, at, pitch);
        if (sameLanding(first, second, state.body, plan.landing)) state.body = { ...state.body, at: plan.landing, evidence: after.observation_ref };
        else {
          state.blocked.push(key);
          if (vacancy.some((pixel, index) => pixel !== prior[index])) state.body = null;
        }
      }
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}
