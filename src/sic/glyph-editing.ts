import { measureWordScene, wordFocus, wordGlyphs, wordVisitPlan, type WordRecord, type WordState } from '../logos-engine/v6-word-interface.ts';
import type { NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const glyphEditingId = 'sic_glyph_editing';
export const glyphEditingStrategies = {
  test_glyph_command: 'Test a command for local symbol editing or cursor movement',
  apply_glyph_route: 'Follow the measured edits toward the required symbol sequence',
} as const;
const graph = compileStrategyGraph({ id: 'derive_and_edit_required_glyphs', version: 1, order: 'FALLBACK',
  priorities: ['apply_glyph_route', 'test_glyph_command'],
  strategies: {
    test_glyph_command: [{ fact: 'trial', expected: true, label: 'A command can reveal another edit or cursor rule' }],
    apply_glyph_route: [{ fact: 'route', expected: true, label: 'Measured edits and cursor movements give a route to the derived sequence' }],
  },
}, ['trial', 'route']);
type Scene = { editable: WordRecord; source: WordRecord; cursor: WordRecord[]; ink: number; target: string[]; rule_count: number };
type Edit = [before: string, after: string];
type State = { epoch: number; scene: Scene; edits: Record<string, Edit[]>; directions: Record<string, number>;
  tried: string[]; blocked: string[]; count: number; evidence: string[] };
type Proposal = NativeProposal & { local: State; current: WordState; expected: WordState | null; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const modulo = (a: number, n: number) => (a % n + n) % n;
const trialKey = (action: string, current: WordState) => JSON.stringify([action, current]);

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

export function createSicGlyphEditing(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: glyphEditingId,
    async propose(observation, rows, _inputs, remaining) {
      const keys = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (!keys.length || observation.available_action_refs.includes('ACTION6') || remaining < 1) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const scene = prior?.scene ?? await measureWordScene(observation, rows) as Scene | null;
      if (!scene || (prior?.count ?? 0) >= 64) return null;
      const local = prior ?? { epoch: observation.level_epoch, scene, edits: {}, directions: {}, tried: [], blocked: [], count: 0, evidence: [] };
      const current = await read(rows, scene);
      if (!current || equal(current[0], scene.target)) return null;
      const [word, at] = current;
      const usable = keys.filter(action => !local.blocked.includes(trialKey(action, current)));
      const edits = new Map(usable.flatMap(action => local.edits[action] ? [[action, new Map(local.edits[action])]] as const : []));
      const directions = new Map(usable.flatMap(action => local.directions[action] ? [[action, local.directions[action]]] as const : []));
      const route = wordVisitPlan(word, scene.target, at, edits, directions)?.[0];
      const test = usable.find(action => edits.has(action) && !closedCycle(edits.get(action)!, word[at]!))
        ?? usable.find(action => !local.tried.includes(action));
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        route: { value: !!route, evidence }, trial: { value: !!test, evidence },
      }, planners: { apply_glyph_route: () => route ?? null, test_glyph_command: () => test ?? null } });
      if (!selected) return null;
      const strategy = selected.id, action = selected.plan, shift = directions.get(action), rewrite = edits.get(action)?.get(word[at]!);
      const expected: WordState | null = shift ? [word, modulo(at + shift, word.length)] : rewrite
        ? [word.map((glyph, i) => i === at ? rewrite : glyph), at] : null;
      const command = { action_ref: action, data: {} }, label = glyphEditingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'rewrite_visible_symbol_sequence', scope: ref.split(':revision:', 1)[0]!, subjects: ['typed_examples', 'editable_sequence'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_realizing_the_unique_derived_glyph_sequence' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `glyph-editing:${need.id}`, actions = [command];
      const [left, top, , bottom] = scene.editable.box;
      const active = [left + at * scene.editable.size, top, left + (at + 1) * scene.editable.size - 1, bottom];
      return { status: 'proposed', kind: glyphEditingId, actions, local, current, expected, needId: need.id,
        steps: [{ action: command, expected_after: null }], binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Find and enter the sequence implied by the example rules', mode: route ? 'solving' : 'exploration',
          situation: `${scene.rule_count} visible rules yield one sequence. ${word.filter((glyph, i) => glyph !== scene.target[i]).length} slots differ.`,
          agenda: entries, evidence, active, source: scene.source.box, editable: scene.editable.box },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'editable_word_bound' : 'editable_word_changed' };
    },
    async after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected && equal(await read(second, proposal.local.scene), proposal.expected);
      return { matched, seal_prefix: true, reason: 'compare_local_edit_and_cursor_return' };
    },
    async record(before, after, issued, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, current } = proposal, next = await read(second, local.scene), action = issued.action_ref;
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
