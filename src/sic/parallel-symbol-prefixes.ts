import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord,
  NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';

export const parallelSymbolPrefixesId = 'sic_verify_parallel_symbol_prefixes';

type Layout = { offset: number; inset: number; extent: number };
type Focus = { x: number; y: number; extent: number };
type SymbolCell = { box: NativeBox; value: string; backing: number };
type Strip = { rank: number; cells: SymbolCell[] };
type Witness = { glyph: string; ref: string };
type Calibration = { epoch: number; layout: Layout; clear: number; filled: number | null; commands: Record<string, Witness> };
type Retained = Calibration & { completed: number; boundary: string };
type State = { epoch: number; panels: NativeBox[]; refs: string[]; stopped: boolean };
type Proposal = NativeProposal & {
  local: State; needId: string; previous: number[]; projected: number[]; affected: number[]; layout: Retained;
};

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const directional = (ref: string) => /^ACTION[1-4]$/.test(ref);
const supportedInputs = (observation: NativeObservation) => observation.available_action_refs.filter(directional);
const symbolInterface = (observation: NativeObservation) => {
  const actions = observation.available_action_refs.filter(ref => ref !== 'ACTION7');
  return actions.length >= 3 && actions.every(directional);
};
const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((value, i) => value === b[i]);

function strips(observation: NativeObservation): NativeBox[] {
  return observation.entities.filter(({ bbox, area, mask }) => {
    const w = width(bbox), h = height(bbox);
    return w >= 2 * h && h >= 9 && area === 2 * (w + h) - 4
      && mask.every(([x, y]) => x === 0 || x === w - 1 || y === 0 || y === h - 1);
  }).map(entity => entity.bbox).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function focus(rows: NativeRows, [l, t, r, b]: NativeBox): Focus | null {
  let found: Focus | null = null;
  for (let y = t + 1; y < b - 2; y++) for (let x = l + 2; x < r - 2; x++) {
    const value = rows[y]?.[x];
    if (value === undefined || rows[y]?.[x - 1] === value) continue;
    let extent = 1;
    while (x + extent < r && rows[y]?.[x + extent] === value) extent++;
    if (extent < 5 || extent > 13 || extent % 2 === 0 || y + extent + 1 >= b) continue;
    let border = true;
    for (let i = 0; i < extent && border; i++) {
      border = rows[y + extent + 1]?.[x + i] === value && rows[y + i + 1]?.[x - 1] === value && rows[y + i + 1]?.[x + extent] === value;
    }
    if (!border) continue;
    if (found) return null;
    found = { x, y: y + 1, extent };
  }
  return found;
}

function readStrip(rows: NativeRows, panel: NativeBox, layout: Layout, clear: number, filled: number | null): Strip | null {
  const [l, t, r, b] = panel, { offset, inset, extent } = layout;
  const border = rows[t]?.[l];
  for (let x = l; x <= r; x++) if (rows[t]?.[x] !== border || rows[b]?.[x] !== border) return null;
  for (let y = t + 1; y < b; y++) if (rows[y]?.[l] !== border || rows[y]?.[r] !== border) return null;
  const active = focus(rows, panel), cells: SymbolCell[] = [], y = t + inset;
  if (active && (active.extent !== extent || active.y !== y)) return null;
  let padding = false;
  for (let x = l + offset; x + extent - 1 < r - 1; x += extent + 1) {
    const backing = rows[y]?.[x], glyph: string[] = [];
    if (backing === undefined || y + extent >= b) return null;
    for (let dy = 1; dy < extent - 1; dy++) for (let dx = 1; dx < extent - 1; dx++) {
      if (rows[y + dy]?.[x + dx] !== backing) glyph.push(dx + ',' + dy);
    }
    if (!glyph.length) {
      // Aligned strips can share a frame width even when their words differ in length.
      const blank = backing === clear && rows.slice(y, y + extent).every(row =>
        row.slice(x, x + extent).every(pixel => pixel === clear));
      if (!blank) return null;
      padding = true;
      continue;
    }
    if (padding) return null;
    cells.push({ box: [x, y, x + extent - 1, y + extent - 1], value: glyph.join('/'), backing });
  }
  const rank = active ? cells.findIndex(cell => cell.box[0] === active.x) : cells.length;
  if (!cells.length || cells.length > 12 || rank < 0 || (!active && filled === null)) return null;
  if (!cells.every((cell, i) => cell.backing === (i >= rank ? clear : filled ?? cells[0]?.backing)
    && (i >= rank || cell.backing !== clear))) return null;
  return { rank, cells };
}

function predictedRanks(rows: Strip[], glyph: string): { next: number[]; affected: number[] } {
  const affected = rows.flatMap(({ rank, cells }, i) => cells[rank]?.value === glyph ? [i] : []);
  const next = rows.map(({ rank, cells }, i) => affected.includes(i) ? rank + 1 : rank === cells.length || !affected.length ? rank : 0);
  return { next, affected };
}

// A command can advance several strips. Until the contrary is observed,
// require a path that still works if every conflicting open prefix is lost.
function nextCommand(rows: Strip[], learned: Retained, inputs: readonly NativeCommand[], remaining: number): NativeCommand | null {
  const covered = inputs.filter(command => learned.commands[command.action_ref]);
  const glyphs = new Set(covered.map(command => learned.commands[command.action_ref]!.glyph));
  if (rows.some(({ cells }) => cells.some(cell => !glyphs.has(cell.value)))) return null;
  const ranks = rows.map(row => row.rank), spans = rows.map(row => row.cells.length);
  const queue: { ranks: number[]; first: NativeCommand | null; distance: number }[] = [{ ranks, first: null, distance: 0 }];
  const seen = new Set([ranks.join(',')]);
  for (const item of queue) {
    if (same(item.ranks, spans)) return item.first;
    if (item.distance >= remaining || queue.length >= 4096) continue;
    const view = rows.map(({ cells }, i) => ({ cells, rank: item.ranks[i]! }));
    for (const command of covered) {
      const { next } = predictedRanks(view, learned.commands[command.action_ref]!.glyph), key = next.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ ranks: next, first: item.first ?? command, distance: item.distance + 1 });
    }
  }
  return null;
}

function readStrips(rows: NativeRows, panels: NativeBox[], model: Retained): Strip[] | null {
  const found = panels.map(panel => readStrip(rows, panel, model.layout, model.clear, model.filled));
  return found.every((row): row is Strip => row !== null) ? found : null;
}

function confirmedRanks(proposal: Proposal, rows: NativeRows): number[] | null {
  const view = readStrips(rows, proposal.local.panels, proposal.layout);
  if (!view) return null;
  const { previous, affected } = proposal;
  const ranks = view.map(({ rank }) => rank);
  return ranks.every((rank, i) => affected.includes(i) ? rank === previous[i]! + 1
    : previous[i] === view[i]!.cells.length ? rank === previous[i] : rank === previous[i] || rank === 0) ? ranks : null;
}

export function createSicVerifyParallelSymbolPrefixes(): NativeFamily<Proposal> {
  let calibration: Calibration | null = null;
  let retained: Retained | null = null;
  let state: State | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: parallelSymbolPrefixesId,
    async attachPrograms(registry) { choose = await registry.registerProgram(chooseLanding, {}, await landingModule()); },
    observePublicOutcome(before, after, command, first, second) {
      if (!directional(command.action_ref) || !symbolInterface(before)) return;
      const panels = strips(before);
      if (panels.length !== 1) return;
      const panel = panels[0]!, at = focus(first, panel);
      if (!at) return;
      const layout = { offset: (at.x - panel[0] - 1) % (at.extent + 1) + 1, inset: at.y - panel[1], extent: at.extent };
      const clear = first[at.y]?.[at.x];
      if (clear === undefined) return;
      const learned = calibration?.epoch === before.level_epoch ? calibration
        : { epoch: before.level_epoch, layout, clear, filled: null, commands: {} };
      if (clear !== learned.clear || layout.extent !== learned.layout.extent || layout.offset !== learned.layout.offset || layout.inset !== learned.layout.inset) return;
      const from = readStrip(first, panel, layout, clear, learned.filled);
      const cell = from?.cells[from.rank];
      if (!from || !cell) return;
      const advanced = after.levels_completed > before.levels_completed && from.rank === from.cells.length - 1;
      const view = advanced ? null : readStrip(second, panel, layout, clear, learned.filled);
      if (!advanced && (!view || view.rank !== from.rank + 1)) return;
      const previous = learned.commands[command.action_ref];
      if (previous && previous.glyph !== cell.value) {
        calibration = null;
        return;
      }
      calibration = { ...learned, filled: learned.filled ?? view?.cells[from.rank]?.backing ?? null,
        commands: { ...learned.commands, [command.action_ref]: { glyph: cell.value, ref: after.observation_ref } } };
      const inputs = supportedInputs(before);
      if (advanced && calibration.filled !== null && inputs.every(id => calibration!.commands[id])
        && new Set(inputs.map(id => calibration!.commands[id]!.glyph)).size === inputs.length) {
        retained = { ...calibration, completed: after.levels_completed, boundary: after.observation_ref };
      }
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !retained || retained.completed !== observation.levels_completed || !symbolInterface(observation)) return null;
      const layout = retained, prior = state?.epoch === observation.level_epoch ? state : null;
      const panels = prior?.panels ?? strips(observation);
      if (panels.length < 2 || panels.length > 4 || prior?.stopped) return null;
      const view = readStrips(rows, panels, layout);
      if (!view) return null;
      const command = nextCommand(view, layout, inputs, remaining);
      if (!command) return null;
      const proof = layout.commands[command.action_ref]!, { next: projected, affected } = predictedRanks(view, proof.glyph);
      const local = prior ?? { epoch: observation.level_epoch, panels, refs: [], stopped: false };
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref,
        ...new Set([layout.boundary, proof.ref, ...local.refs].filter(item => item !== ref))];
      const mode = execution?.reasoningMode ?? 'solving';
      const facts = { routeSupported: true, knownInteraction: false, eligibleProbe: false, mode };
      const decision = await choose?.run({ situation: facts }, { signal: execution?.signal });
      if (decision?.result !== 'P07') return null;
      const label = affected.length > 1 ? 'Use the shared symbol to extend both groups in one command'
        : 'Extend the group that keeps a path to completing every sequence';
      const parent = 'G_official_completion';
      const goal = { kind: 'finish_parallel_symbol_prefixes', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['open_symbol_groups', 'learned_input_symbols'], parentObjective: parent,
        satisfactionContract: 'observe_official_progress_after_all_symbol_groups_close' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `parallel-symbol-prefixes:${need.id}`, actions = [command];
      return { status: 'proposed', kind: parallelSymbolPrefixesId, local, needId: need.id, actions, layout, affected, projected,
        previous: view.map(({ rank }) => rank), steps: [{ action: command, expected_after: projected }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
          edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
        sicSituationCard: { strategy: 'P07', need: 'Complete every open symbol group', situation: label, agenda: [], mode,
          evidence, triggerCard: decision.receipt.workflow, panels, targets: affected.map(i => view[i]!.cells[view[i]!.rank]!.box) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: 'P07', objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label, evidence, actions,
          preconditions: {}, preserve_refs: [], outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'symbol_prefixes_bound' : 'symbol_prefixes_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const ranks = confirmedRanks(proposal, second);
      return { matched: ranks ? same(ranks, proposal.projected) : false, seal_prefix: true,
        reason: ranks ? same(ranks, proposal.projected) ? 'symbol_prefixes_confirmed' : 'open_prefix_preserved_replan'
          : 'symbol_prefix_advance_contradicted' };
    },
    record(before, after, _command, _first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        retained = { ...proposal.layout, completed: after.levels_completed, boundary: after.observation_ref };
        return { events: [] };
      }
      const ranks = before.level_epoch === after.level_epoch ? confirmedRanks(proposal, second) : null;
      state = { ...proposal.local, refs: [...proposal.local.refs.slice(-3), after.observation_ref], stopped: !ranks };
      return { events: [] };
    },
    state: () => ({ calibration, retained, state }),
    restore(value: NativeRecord) {
      calibration = structuredClone((value.calibration as Calibration | undefined) ?? null);
      retained = structuredClone((value.retained as Retained | undefined) ?? null);
      state = structuredClone((value.state as State | undefined) ?? null);
    },
  };
}
