import { measureWordScene, wordFocus, wordGlyphs, wordVisitPlan, type WordRecord, type WordState } from '../logos-engine/v6-word-interface.ts';
import type { NativeCommand, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';

export const glyphEditingId = 'sic_glyph_editing';
export const verifySequenceEditsId = 'sic_verify_sequence_edits';
export const glyphEditingStrategies = {
  test_glyph_command: 'Test a command for local symbol editing or cursor movement',
  apply_glyph_route: 'Follow the measured edits toward the required symbol sequence',
  P05: 'Test a command for local symbol editing or cursor movement',
  P07: 'Follow the measured edits toward the required symbol sequence',
} as const;
type Scene = { editable: WordRecord; source: WordRecord; cursor: WordRecord[]; ink: number; target: string[]; rule_count: number;
  translation_stages?: number };
type Edit = [before: string, after: string];
type State = { epoch: number; scene: Scene; edits: Record<string, Edit[]>; directions: Record<string, number>;
  tried: string[]; blocked: string[]; count: number; evidence: string[] };
type WordLeg = { action: NativeCommand; before: WordState; after: WordState };
type Proposal = NativeProposal & { local: State; current: WordState; expected: WordState | null; needId: string;
  route?: readonly WordLeg[] };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const modulo = (a: number, n: number) => (a % n + n) % n;
const trialKey = (action: string, current: WordState) => JSON.stringify([action, current]);

function projectedEdit(current: WordState, action: string, edits: ReadonlyMap<string, ReadonlyMap<string, string>>,
  directions: ReadonlyMap<string, number>): WordState | null {
  const [word, at] = current;
  const shift = directions.get(action), rewrite = edits.get(action)?.get(word[at]!);
  return shift ? [word, modulo(at + shift, word.length)] : rewrite ? [word.map((glyph, i) => i === at ? rewrite : glyph), at] : null;
}

async function read(rows: NativeRows, scene: Scene): Promise<WordState | null> {
  const at = wordFocus(rows, scene.editable, scene.cursor);
  return at === null ? null : [await wordGlyphs(rows, scene.editable, scene.ink), at];
}

function closedCycle(edges: ReadonlyMap<string, string>, start: string) {
  const visited = new Set<string>();
  let node = start;
  while (edges.has(node) && !visited.has(node)) {
    visited.add(node);
    node = edges.get(node)!;
  }
  return visited.has(node);
}

export function createSicVerifySequenceEdits(): NativeFamily<Proposal> {
  let state: State | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifySequenceEditsId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const keys = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (!keys.length || observation.available_action_refs.includes('ACTION6') || remaining < 1) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? await measureWordScene(observation, rows, true) as Scene | null;
      if (!scene || (prior?.count ?? 0) >= 64) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, edits: {}, directions: {}, tried: [], blocked: [], count: 0, evidence: [] };
      const current = await read(rows, scene);
      if (!current || equal(current[0], scene.target)) return null;
      const [word, at] = current;
      const usable = keys.filter(action => !local.blocked.includes(trialKey(action, current)));
      const edits = new Map(usable.flatMap(action => local.edits[action] ? [[action, new Map(local.edits[action])]] as const : []));
      const directions = new Map(usable.flatMap(action => local.directions[action] ? [[action, local.directions[action]]] as const : []));
      const path = wordVisitPlan(word, scene.target, at, edits, directions), route = path?.[0];
      const test = usable.find(action => edits.has(action) && !closedCycle(edits.get(action)!, word[at]!))
        ?? usable.find(action => !local.tried.includes(action));
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const facts = { routeSupported: !!route, eligibleProbe: !!test, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      if (!decision) return null;
      const strategy = decision.result;
      if (strategy !== 'P07' && strategy !== 'P05') return null;
      const action = strategy === 'P07' ? route : test;
      if (!action) return null;
      const expected = projectedEdit(current, action, edits, directions);
      const command = { action_ref: action, data: {} }, label = glyphEditingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'rewrite_visible_symbol_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: ['typed_examples', 'editable_sequence'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_realizing_the_unique_derived_glyph_sequence' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `glyph-editing:${need.id}`, planned: WordLeg[] = [];
      if (strategy === 'P07') {
        let before = current;
        for (const name of path!.slice(0, Math.min(remaining, maximumCommittedActions, 64 - local.count))) {
          const after = projectedEdit(before, name, edits, directions);
          if (!after || local.blocked.includes(trialKey(name, before))) break;
          planned.push({ action: { action_ref: name, data: {} }, before, after });
          before = after;
        }
      }
      const actions = planned.length > 1 ? planned.map(leg => leg.action) : [command];
      const [left, top, , bottom] = scene.editable.box;
      const active = [left + at * scene.editable.size, top, left + (at + 1) * scene.editable.size - 1, bottom];
      const derivation = scene.translation_stages ? `The visible rules compose into ${scene.translation_stages} translations and yield one sequence.`
        : `${scene.rule_count} visible rules yield one sequence.`;
      const differences = word.filter((glyph, i) => glyph !== scene.target[i]).length;
      return { status: 'proposed', kind: verifySequenceEditsId, actions, local, current, expected, needId: need.id,
        ...(actions.length > 1 ? { route: planned } : {}),
        steps: actions.length > 1 ? planned.map(leg => ({ action: leg.action, expected_after: leg.after }))
          : [{ action: command, expected_after: null }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Find and enter the sequence implied by the example rules', mode, triggerCard: chooseLanding,
          situation: `${derivation} ${differences === 1 ? '1 slot differs.' : `${differences} slots differ.`}`,
          agenda: [], evidence, active, source: scene.source.box, editable: scene.editable.box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    async before(proposal, index, packet, observation) {
      if (index > 0 && proposal.route) {
        const admitted = proposal.binding?.level_epoch === observation.level_epoch
          && equal(await read(packet.frame_rows, proposal.local.scene), proposal.route[index]!.before);
        return { admitted, reason: admitted ? 'known_word_and_cursor_still_visible' : 'word_route_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'editable_word_bound' : 'editable_word_changed' };
    },
    async after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.route?.[index]?.after ?? proposal.expected;
      const matched = expected && equal(await read(second, proposal.local.scene), expected);
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: 'compare_local_edit_and_cursor_return' };
    },
    async record(before, after, issued, _first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = index > 0 && state?.epoch === proposal.local.epoch ? state : proposal.local;
      const current = proposal.route?.[index]?.before ?? proposal.current, next = await read(second, local.scene), action = issued.action_ref;
      const edits = { ...local.edits }, directions = { ...local.directions }, blocked = [...local.blocked];
      const [word, at] = current;
      if (next) {
        const [out, focus] = next, changed = word.flatMap((glyph, index) => out[index] !== glyph ? [index] : []);
        if (out.length === word.length && focus === at && changed.length === 1 && changed[0] === at) {
          delete directions[action];
          let edges = new Map(edits[action]);
          if (edges.has(word[at]!) && edges.get(word[at]!) !== out[at]) edges = new Map();
          edges.set(word[at]!, out[at]!);
          for (const [other, transitions] of Object.entries(edits)) {
            if (other === action) continue;
            const opposite = new Map(transitions);
            if (!closedCycle(opposite, out[at]!) || opposite.get(out[at]!) !== word[at]) continue;
            const inverse = new Map([...opposite].map(([a, b]) => [b, a]));
            if (inverse.size === opposite.size && [...edges].every(([a, b]) => inverse.get(a) === b)) edges = inverse;
          }
          edits[action] = [...edges];
        } else if (equal(word, out) && focus !== at) {
          const delta = modulo(focus - at, word.length);
          if (delta === 1 || delta === word.length - 1) {
            delete edits[action];
            directions[action] = delta === 1 ? 1 : -1;
          }
        } else blocked.push(trialKey(action, current));
      } else blocked.push(trialKey(action, current));
      state = { ...local, edits, directions, blocked, tried: [...new Set([...local.tried, action])], count: local.count + 1,
        evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
