import { linkedNodes, linkedOpenEnclosures, linkedPhaseSlots } from '../logos-engine/v6-linked-temporal-contact.ts';
import { temporalPatch } from '../logos-engine/v6-linked-temporal-common.ts';
import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { compareControlTrial } from './control-effect-next.ts';
import { sicNeedId } from './need-identity.ts';
import { singleStepDisplacement } from './observed-translation.ts';
import { maximumCommittedActions, unchangedOutside } from './plan-step.ts';
import { beginRecording, chooseRecording, linkedTransfers, needsTransferPulse, observeRecording, openSupports, recordingActor, replaySprites,
  transferForChoice, type Recording, type RecordingChoice, type RecordingScene } from './recorded-replay-access.ts';

export const replayAccessId = 'sic_replay_access';
export const verifyRemoteReplayId = 'sic_verify_remote_replay';
export const learnRemoteReplayId = 'sic_learn_remote_replay';
export { navigationPrimitives as replayAccessStrategies } from './navigation-primitives.ts';

type Body = { signature: string; start: NativePoint; size: NativePoint; floor: number; quantum: number; palette: number; mask: readonly NativePoint[] };
type Node = { position: NativePoint; peer_support: NativePoint[] };
type Scene = { body: Body; goal: NativePoint; nodes: Node[]; slots: NativeBox[]; transfer?: RecordingScene['transfer']; transfers?: RecordingScene['transfers'] };
type Changed = { pixel: NativePoint; before: number; after: number };
type State = { epoch: number; scene: Scene; controls: Record<string, NativePoint>; tried: string[]; samples: NativePoint[];
  node: Node | null; entered: Changed[]; restored: boolean; reversible: boolean; replay: string | null; ticks: number;
  evidence: string[]; count: number; stopped: boolean; phaseEvidence?: string; controlEvidence?: Record<string, string> };
type Walk = { from: NativePoint; to: NativePoint };
type Proposal = NativeProposal & { local: State; from: NativePoint; to: NativePoint | null; walk?: Walk[];
  intention: 'move' | 'probe' | 'replay'; needId: string };
type RecordedProposal = NativeProposal & { recordingChoice: RecordingChoice; needId: string };
type ReplayProposal = Proposal | RecordedProposal;
const isRecorded = (proposal: ReplayProposal): proposal is RecordedProposal => Object.hasOwn(proposal, 'recordingChoice');
const controls = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const minus = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const positionKey = (p: NativePoint) => p.join(',');
const box = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const ordinal = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const contains = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const valueAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function sceneAtStart(observation: NativeObservation, rows: NativeRows): Scene | null {
  const scenes: Scene[] = [];
  for (const entity of observation.entities) {
    const [x, y, r, b] = entity.bbox, w = r - x + 1, h = b - y + 1;
    if (Math.min(w, h) < 2 || Math.max(w, h) > 12 || entity.area < w * h * 0.75) continue;
    const floor = rows[y]?.[x - 1];
    if (floor === undefined || floor === entity.palette_value) continue;
    for (let quantum = Math.max(w, h) + 1; quantum <= 16; quantum++) {
      const body: Body = { signature: entity.signature, start: [x, y], size: [w, h], floor, quantum, palette: entity.palette_value, mask: entity.mask };
      const goals = linkedOpenEnclosures(observation, body, quantum);
      if (goals.length !== 1) continue;
      const nodes = linkedNodes(observation, body, quantum) as Node[];
      if (!nodes.length) continue;
      const slots = linkedPhaseSlots(observation, body, true) as NativeBox[] | null;
      if (slots && slots.length >= 2 && slots.length <= 4) scenes.push({ body, goal: goals[0]!, nodes, slots });
    }
  }
  const single = scenes.filter(scene => scene.slots.length === 2);
  const candidates = single.length ? single : scenes;
  if (candidates.length !== 1) return null;
  const scene = candidates[0]!, transfers = scene.slots.length > 2 ? linkedTransfers(observation, scene.body) : [];
  if (transfers.length === 1) return { ...scene, transfer: transfers[0]! };
  return transfers.length > 1 ? { ...scene, transfers } : scene;
}

function actorPosition(observation: NativeObservation, scene: Scene): NativePoint | null {
  const actors = observation.entities.filter(entity => entity.signature === scene.body.signature);
  return actors.length === 1 ? [actors[0]!.bbox[0], actors[0]!.bbox[1]] : null;
}

type Step = { to: NativePoint; delta: NativePoint };
function candidatePaths(rows: NativeRows, scene: Scene, from: NativePoint, special: readonly NativePoint[], transit: readonly NativePoint[] = []) {
  const { body } = scene, q = body.quantum, [w, h] = body.size;
  const grid: NativePoint[] = [[0, -q], [-q, 0], [q, 0], [0, q]];
  const pending = [from], paths = new Map<string, Step[]>([[positionKey(from), []]]);
  for (const origin of pending) for (const delta of grid) {
    const to = add(origin, delta), [x, y] = to, key = positionKey(to);
    if (x < 0 || y < 0 || x + w > rows[0]!.length || y + h > rows.length || paths.has(key)) continue;
    const clear = temporalPatch(rows, to, body.size).every(row => row.every(pixel => pixel === body.floor));
    const passable = transit.some(site => equal(site, to));
    if (!clear && !passable && !special.some(site => equal(site, to))) continue;
    paths.set(key, [...paths.get(positionKey(origin))!, { to, delta }]);
    if (clear || passable) pending.push(to);
  }
  return paths;
}

function peerBounds(points: readonly NativePoint[]): NativeBox | null {
  if (!points.length) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

async function proposeRecording(observation: NativeObservation, rows: NativeRows, current: Recording,
  decide: NativeProgramHandle, execution: NativeExecution | undefined, family: string): Promise<RecordedProposal | null> {
  const choice = chooseRecording(observation, rows, current);
  const from = recordingActor(observation, current.scene);
  if (!choice || !from || !observation.available_action_refs.includes(choice.command.action_ref)) return null;
  const { recording, destination } = choice, { scene } = recording;
  const ref = observation.observation_ref, mode = execution?.reasoningMode ?? 'exploration';
  const knownInteraction = choice.intent === 'commit';
  const pulseProbe = needsTransferPulse(choice) && !choice.entry;
  const shifts = recording.preparations ?? (recording.transferPlan && recording.preparation ? [recording.preparation] : []);
  const measuringShift = !recording.paths.length && shifts.some(item => !item.event && equal(item.node.position, destination));
  const probing = pulseProbe || !!measuringShift && equal(choice.expected, destination);
  const facts = { routeSupported: !knownInteraction && !probing, eligibleProbe: probing, knownInteraction, mode };
  const decision = await decide.run({ situation: facts }, { signal: execution?.signal });
  const strategy = knownInteraction ? 'P02' : probing ? 'P05' : 'P07';
  if (decision.result !== strategy) return null;
  const preparation = recording.preparation;
  const beforeFirstCommit = !!preparation && recording.paths.length === 0;
  const auxiliary = recording.lane?.points[recording.lane.index];
  const transfer = transferForChoice(choice) ?? scene.transfer;
  const situation = choice.entry && transfer && recording.transferPlan && equal(transfer.contact, recording.transferPlan.auxiliary.contact)
    ? 'Enter the linked frame while the independent carrier activates it'
    : choice.entry ? 'Step into the linked frame on the tick of the recorded activation'
    : pulseProbe ? 'Reach the linked contact and check whether it sends a pulse between the frames'
      : knownInteraction && recording.pendingPulse ? 'Record the timed pulse for a later carrier'
        : knownInteraction && !recording.paths.length && recording.preparations ? 'Record the shifts and the contact held at the end'
        : knownInteraction && beforeFirstCommit ? 'Record the shift along the route and the contact held at the end'
    : measuringShift ? 'Reach the contact linked to an obstruction and measure the shift'
    : beforeFirstCommit && !preparation.event ? 'Reach the contact linked to the solid obstruction and measure what it changes'
    : beforeFirstCommit ? 'Leave the shifted obstruction behind and reach a contact to hold'
    : knownInteraction ? 'Record the measured route that opened the passage'
    : auxiliary && recording.paths.length === scene.slots.length - 1 ? 'Cross while the independent carrier keeps the relevant passage open'
    : recording.node ? 'Reach another contact while checking the replayed paths'
      : 'Reach the receiver while the recorded contacts keep the passages open';
  const evidence: [string, ...string[]] = [ref, ...new Set([...recording.paths.flatMap(item => item.evidence), ...recording.evidence]
    .filter(item => item !== ref))];
  const parent = 'G_official_completion';
  const objective = { kind: 'coordinate_recorded_contributions_to_access_receiver', scope: ref.split(':revision:', 1)[0]!,
    subjects: ['carrier', 'recorded_contributions', 'open_receiver'], parentObjective: parent,
    satisfactionContract: 'official_progress_after_coordinated_replayed_contacts' };
  const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
  const id = 'recorded-replay:' + need.id, actions = [choice.command];
  return {
    status: 'proposed', kind: family, actions, needId: need.id, recordingChoice: choice,
    binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action: choice.command, expected_after: choice.expected }],
    sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
      edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
    sicSituationCard: { strategy, need: 'Keep the recorded contacts active while reaching the receiver', situation, evidence, agenda: [],
      mode, triggerCard: chooseLanding, actor: box(from, scene.body.size), target: box(destination, scene.body.size),
      remote: transfer?.channel ?? peerBounds(recording.node?.peer_support ?? []), slots: scene.slots,
      ...(auxiliary ? { externalCarriers: [box(auxiliary, scene.body.size)] } : {}),
      replayActors: replaySprites(observation, recording), replaySupports: [
        ...openSupports(recording), ...(scene.transfers ?? (scene.transfer ? [scene.transfer] : [])).flatMap(link => link.frames.map(point => box(point, scene.body.size))),
      ] },
    question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
    compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
    sicLocalDecision: { strategy, objective: { id, label: situation, parent }, need },
    bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation, preconditions: {},
      preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
  };
}

export function createSicVerifyRemoteReplay(family = verifyRemoteReplayId): NativeFamily<ReplayProposal> {
  const learns = family === learnRemoteReplayId;
  let state: State | null = null;
  let recording: Recording | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<ReplayProposal | null> {
      if (remaining < 1 || !controls.every(control => observation.available_action_refs.includes(control)) || observation.available_action_refs.includes('ACTION6')) return null;
      const epoch = observation.level_epoch;
      const previous = state?.epoch === epoch ? state : null;
      if (previous?.stopped || (previous?.count ?? 0) >= 72) return null;
      const running = recording?.epoch === epoch ? recording : null;
      if (running) return decide ? proposeRecording(observation, rows, running, decide, execution, family) : null;
      let scene = previous?.scene ?? sceneAtStart(observation, rows);
      if (!scene) return null;
      if (scene.slots.length > 2) {
        let current: Recording | null = null;
        if (recording?.epoch === epoch - 1 && !recording.stopped) {
          current = beginRecording(scene, epoch, recording.vectors, recording.phase, recording.evidence, rows, observation);
        } else if (state?.epoch === epoch - 1 && state.replay && !state.stopped && state.scene.body.quantum === scene.body.quantum) {
          const evidence = [state.phaseEvidence, ...Object.values(state.controlEvidence ?? {}), ...state.evidence]
            .filter((ref): ref is string => !!ref);
          current = beginRecording(scene, epoch, state.controls, state.replay, [...new Set(evidence)], rows, observation);
        }
        return current && decide ? proposeRecording(observation, rows, current, decide, execution, family) : null;
      }
      const from = actorPosition(observation, scene);
      if (!from) return null;
      const firstScene = scene;
      const motion = learns && !previous ? execution?.readPriorDirectionalScene?.(prior => {
        const { body } = firstScene;
        const candidates = geometricComponents(prior).filter(part => {
          const [x, y, right, bottom] = part.bbox;
          return part.color === body.palette && right - x + 1 === body.size[0] && bottom - y + 1 === body.size[1]
            && part.mask.length === body.mask.length && part.mask.every((pixel, i) => equal(pixel, body.mask[i]!));
        });
        if (candidates.length !== 1) return null;
        const [x, y] = candidates[0]!.bbox, start: NativePoint = [x, y];
        const delta = minus(from, start);
        return Math.abs(delta[0]) + Math.abs(delta[1]) === body.quantum && (!delta[0] || !delta[1])
          && firstScene.nodes.every(node => !equal(node.position, from)) ? { start, delta } : null;
      }) : null;
      if (learns && !previous && (!motion || motion.afterRef !== observation.observation_ref || motion.levelEpoch !== epoch)) return null;
      if (motion) scene = { ...scene, body: { ...scene.body, start: motion.scene.start } };
      const local: State = previous ?? { epoch: observation.level_epoch, scene, controls: {}, tried: [], samples: [from],
        node: null, entered: [], restored: false, reversible: false, replay: null, ticks: 0, evidence: [], count: 0, stopped: false };
      if (motion) {
        local.controls = { [motion.command]: motion.scene.delta };
        local.controlEvidence = { [motion.command]: motion.afterRef };
        local.evidence = [motion.beforeRef, motion.afterRef];
        local.samples = [motion.scene.start, from];
        local.count = 1;
      }
      const nodePositions = scene.nodes.map(node => node.position);
      const special = [...nodePositions, scene.goal];
      const completed = local.replay && local.ticks >= local.samples.length - 1;
      const hold = completed && local.node && local.entered.every(change => valueAt(rows, change.pixel) === change.after) ? [local.node.position] : [];
      const paths = candidatePaths(rows, scene, from, special, hold);
      const node = local.node ?? [...scene.nodes].filter(node => paths.has(positionKey(node.position))).sort((a, b) =>
        paths.get(positionKey(a.position))!.length - paths.get(positionKey(b.position))!.length || ordinal(a.position, b.position))[0] ?? null;
      if (!node) return null;
      const contact = node.position;
      const evidence: [string, ...string[]] = [observation.observation_ref, ...local.evidence.filter(ref => ref !== observation.observation_ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      let proposed: Step | null = null, replayAction: string | null = null, destination: NativePoint = contact;
      let path: Step[] = [];
      let situation = 'Test a nearby object with a visible link to a distant obstruction';
      if (local.replay) {
        destination = scene.goal;
        situation = 'Use the candidate replay to reach the open-rim destination';
        const approach: { prefix: Step[]; entry: Step }[] = [];
        const vectors = Object.values(local.controls);
        for (const [key, prefix] of paths) for (const delta of vectors) {
          const [x, y] = key.split(',').map(Number), origin = [x!, y!] as const, to = add(origin, delta);
          if (local.entered.some(change => contains(box(to, scene.body.size), change.pixel))) approach.push({ prefix, entry: { to, delta } });
        }
        approach.sort((a, b) => a.prefix.length - b.prefix.length);
        const current = approach[0];
        if (completed) {
          path = paths.get(positionKey(scene.goal)) ?? [];
          proposed = path[0] ?? current?.prefix[0] ?? current?.entry ?? null;
        }
        else if (current?.prefix.length) proposed = current.prefix[0]!;
        else {
          const offsets = vectors.flatMap(delta => {
            const to = add(from, delta), key = positionKey(to), rect = box(to, scene.body.size);
            return vectors.some(other => equal(other, minus(from, to))) && paths.get(key)?.length === 1
              && !local.entered.some(change => contains(rect, change.pixel)) ? [{ to, delta }] : [];
          }).sort((a, b) => ordinal(a.to, b.to));
          proposed = offsets[0] ?? null;
          situation = 'Make a reversible move and check whether the other piece continues replaying';
        }
      } else if (!local.entered.length) {
        path = paths.get(positionKey(contact)) ?? [];
        proposed = path[0] ?? null;
      }
      else if (!local.restored) {
        const departures = [...paths.values()].filter(route => route.length === 1 && !equal(route[0]!.to, contact)
          && temporalPatch(rows, route[0]!.to, scene.body.size).every(row => row.every(pixel => pixel === scene.body.floor)));
        proposed = departures[0]?.[0] ?? null;
        destination = proposed?.to ?? contact;
        situation = 'Leave the object to see whether the distant obstruction returns';
      } else if (!local.reversible) {
        proposed = paths.get(positionKey(contact))?.[0] ?? null;
        situation = 'Return to the object to verify that its distant effect repeats';
      } else {
        const unknown = controls.filter(input => !local.controls[input] && !local.tried.includes(positionKey(from) + ':' + input));
        if (unknown.length === 1) replayAction = unknown[0]!;
        situation = 'Test the remaining control while the distant passage is open';
      }
      const known = proposed && Object.entries(local.controls).find(([, delta]) => equal(delta, proposed!.delta))?.[0];
      const probe = !known && !replayAction ? controls.find(input => !local.controls[input] && !local.tried.includes(positionKey(from) + ':' + input)) : null;
      const input = known ?? replayAction ?? probe;
      if (!input) return null;
      const facts = { routeSupported: !!known, eligibleProbe: !!(replayAction || probe), knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      if (probe && execution?.observeControlTrialShadow) {
        compareControlTrial(probe, evidence[0], {
          observationRef: observation.observation_ref, availableActions: observation.available_action_refs, evidence,
          objectiveSupported: Boolean(node), subjectBound: Boolean(from), effectKnown: Boolean(local.controls[probe]),
          triedInContext: local.tried.includes(positionKey(from) + ':' + probe),
        }, { selected: decision?.result === 'P05', evidence }, { observe: execution.observeControlTrialShadow, family, remaining });
      }
      const strategy = facts.routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const intention = replayAction ? 'replay' : known ? 'move' : 'probe';
      const expected = known && proposed ? proposed.to : null;
      const parent = 'G_official_completion', ref = observation.observation_ref;
      const objective = { kind: 'use_repeated_remote_effect_to_gain_access', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'linked_occurrence', 'replay', 'open_receiver'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_verified_replay_access' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'replay-access:' + need.id, action = { action_ref: input, data: {} };
      const walk: Walk[] = [], commands: typeof action[] = [];
      let origin = from;
      if (intention === 'move') for (const step of path.slice(0, Math.min(remaining, maximumCommittedActions, 72 - local.count))) {
        const input = Object.entries(local.controls).find(([, delta]) => equal(delta, step.delta))?.[0];
        if (!input || equal(step.to, contact) || equal(step.to, scene.goal)
          || !temporalPatch(rows, step.to, scene.body.size).every(row => row.every(value => value === scene.body.floor))) break;
        walk.push({ from: origin, to: step.to });
        commands.push({ action_ref: input, data: {} });
        origin = step.to;
      }
      const actions = walk.length > 1 ? commands : [action];
      return { status: 'proposed', kind: family, actions, local: { ...local, node }, from, to: expected, intention, needId: need.id,
        ...(walk.length > 1 ? { walk } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: actions.map((action, index) => ({ action, expected_after: walk[index]?.to ?? expected })),
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Keep the distant passage open long enough to reach the receiver',
          situation, evidence, agenda: [], mode, triggerCard: chooseLanding,
          actor: box(from, scene.body.size), target: box(destination, scene.body.size), remote: peerBounds(node.peer_support), slots: scene.slots },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: situation, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && !isRecorded(proposal) && proposal.walk) {
        const { scene, epoch } = proposal.local, { from, to } = proposal.walk[index]!;
        const current = actorPosition(observation, scene);
        const admitted = epoch === observation.level_epoch && !!current && equal(current, from)
          && temporalPatch(packet.frame_rows, to, scene.body.size).every(row => row.every(value => value === scene.body.floor));
        return { admitted, reason: admitted ? 'replay_carrier_and_open_landing_confirmed' : 'replay_context_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_replay_and_carrier_bound' : 'replay_context_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isRecorded(proposal)) {
        const { recording: previous, intent } = proposal.recordingChoice;
        if (needsTransferPulse(proposal.recordingChoice)) {
          const observed = recordingActor(after, previous.scene);
          return { matched: observed && equal(observed, proposal.recordingChoice.expected) ? null : false, seal_prefix: true,
            reason: 'check_linked_activation_across_return_frames' };
        }
        const next = observeRecording(proposal.recordingChoice, after, first, second);
        const oldEffect = previous.preparation?.event, newEffect = next?.preparation?.event;
        const newShift = next?.preparations?.some((item, index) => item.event && !previous.preparations?.[index]?.event);
        const reason = !next ? 'recorded_replay_prediction_changed'
          : newShift || newEffect && !oldEffect ? 'remote_block_shift_observed'
            : newEffect?.retained && !oldEffect?.retained ? 'remote_shift_persists_after_departure'
              : intent === 'commit' && (previous.preparation || previous.preparations) ? 'rewind_restored_obstructions_and_recorded_contributions'
                : previous.paths.some(path => path.prepared?.tick === previous.path.length
                  || path.preparations?.some(event => event.tick === previous.path.length)) ? 'persistent_shift_reproduced_at_recorded_tick'
                  : 'recorded_contribution_reconciled';
        return { matched: !!next, seal_prefix: true, reason };
      }
      const { scene, node } = proposal.local, position = actorPosition(after, scene);
      const from = proposal.walk?.[index]?.from ?? proposal.from, to = proposal.walk?.[index]?.to ?? proposal.to;
      const openFloor = to && temporalPatch(second, from, scene.body.size).every(row => row.every(pixel => pixel === scene.body.floor));
      const matched = to && (!node || !equal(to, node.position)) && openFloor ? !!position && equal(position, to) : null;
      const stable = matched && index + 1 < proposal.actions.length && to
        && unchangedOutside(first, second, [box(from, scene.body.size), box(to, scene.body.size)]);
      return { matched, seal_prefix: !stable, reason: 'compare_replayed_motion_and_remote_return' };
    },
    record(before, after, command, first, second, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (isRecorded(proposal)) {
        const choice = proposal.recordingChoice, observed = observeRecording(choice, after, first, second, frames);
        recording = observed ?? { ...choice.recording, stopped: true };
        if (observed && needsTransferPulse(choice)) {
          return { events: [], reviewEvidence: choice.entry ? 'The recorded pulse coincided with entry and the carrier appeared in the linked frame.'
            : 'The contact produced a temporary animation between the two linked frames.' };
        }
        return { events: [] };
      }
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const from = proposal.walk?.[index]?.from ?? proposal.from, { intention } = proposal, scene = local.scene;
      const position = actorPosition(after, scene);
      const next: State = { ...local, count: local.count + 1, stopped: !position, tried: [...local.tried, positionKey(from) + ':' + command.action_ref],
        evidence: [...local.evidence.slice(-5), after.observation_ref] };
      if (!position) { state = next; return { events: [] }; }
      if (intention === 'replay') {
        next.replay = command.action_ref;
        next.stopped = !equal(position, scene.body.start) || equal(position, from);
        if (!next.stopped) next.phaseEvidence = after.observation_ref;
      } else {
        const moved = !equal(position, from);
        const delta = singleStepDisplacement(from, position, scene.body.quantum);
        if (delta) {
          next.controls = { ...local.controls, [command.action_ref]: delta };
          next.controlEvidence = { ...local.controlEvidence, [command.action_ref]: after.observation_ref };
        }
        if (local.replay) {
          next.ticks = local.ticks + Number(moved);
          const at = local.samples[Math.min(next.ticks, local.samples.length - 1)]!;
          const secondary = after.entities.filter(entity => entity.signature !== scene.body.signature
            && entity.bbox[2] - entity.bbox[0] + 1 === scene.body.size[0] && entity.bbox[3] - entity.bbox[1] + 1 === scene.body.size[1]
            && entity.mask.length === scene.body.mask.length && scene.body.mask.every(([x, y], i) => x === entity.mask[i]?.[0] && y === entity.mask[i]?.[1]));
          next.stopped = secondary.some(entity => !equal([entity.bbox[0], entity.bbox[1]], at));
        } else if (moved) {
          next.samples = [...local.samples, position];
          const node = local.node!;
          if (!local.entered.length && equal(position, node.position)) {
            next.entered = node.peer_support.flatMap(pixel => {
              const a = valueAt(first, pixel), b = valueAt(second, pixel);
              return a !== undefined && b !== undefined && a !== b ? [{ pixel, before: a, after: b }] : [];
            });
            next.stopped = !next.entered.length;
          } else if (local.entered.length && equal(from, node.position) && !local.restored) {
            next.restored = local.entered.every(change => valueAt(second, change.pixel) === change.before);
            next.stopped = !next.restored;
          } else if (local.restored && equal(position, node.position)) {
            next.reversible = local.entered.every(change => valueAt(second, change.pixel) === change.after);
            next.stopped = !next.reversible;
          }
        }
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state, ...(recording ? { recording } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      recording = structuredClone(value.recording as Recording | undefined) ?? null;
    },
  };
}
