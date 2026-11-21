import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import type {
  NativeBox,
  NativeCommand,
  NativeEntity,
  NativeFamily,
  NativeObservation,
  NativeProposal,
  NativeRecord,
  NativeRows,
} from '../logos-engine/v6-native-types.ts';
import { composeRewrites, effectSite, learnRewrites, observedRewrite, recordCompositionCoverage, type CompositionCoverage, type Rewrite } from './rewrite-composition.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import { sicNeedId } from './need-identity.ts';
import { actionRelation, type Step } from './composition-context.ts';
import {learnOperands,newOperandMemory,operandMatches,operandPlan,type OperandMemory,type OperandPlan} from './operand-composition.ts';
import {fieldGroup,fieldMatches,proposeFieldComposition,type FieldForecast} from './compose-field-relations.ts';
import learned from './source-composition-prior.json' with { type: 'json' };

export const compositionFamily = 'sic_test_observed_compositions';
export const cycleGroup = 'test_compositions_after_recurrent_returns';
export const exhaustedGroup = 'test_compositions_after_existing_strategies';
export const followCompositionGroup = 'continue_a_confirmed_composition_prefix';
export const composeAtReturnGroup = 'compose_effects_at_a_revisited_state';
export const compositionPrior: Readonly<Record<string, number>> = learned;
type Motion = { actor: string; op: string; dx: number; dy: number; evidence: string };
type Goal = { pair: string; actor: string; target: string; gap: number };
type State = {
  epoch: number;
  history: Step[];
  motions: Motion[];
  tests: Record<string, number>;
  active: Goal | null;
  trials: number;
  rewrites?:Rewrite[]; verifiedPrograms?:Rewrite[][]; attempted?:{origin:string;word:string}[]; pendingProgram?:ProgramTrial;
  coverage?:CompositionCoverage; completedGoals?:string[];
  operands?:OperandMemory;
  rejectedFields?:string[];
};
const initial = (epoch = 0): State => ({ epoch, history: [], motions: [], tests: {}, active: null, trials: 0 });
type ProgramTrial = { steps:Rewrite[]; index:number; origin:string; nextEffect?:string };
type Offer = NativeProposal & { goal: Goal | null; context: string; needId: string; trigger: string; program?:ProgramTrial; operand?:OperandPlan; fieldForecast?:FieldForecast };
function readyStep(step:Rewrite,rows:NativeRows) {
  const width=rows[0]!.length,value=(p:number)=>rows[Math.floor(p/width)]?.[p%width];
  return step.changes.every(([p,v])=>value(p)===v)&&(!step.guards||step.guards.every(([p,v])=>value(p)===v));
}
const gap = (a: NativeBox, b: NativeBox) =>
  Math.max(0, a[0] - b[2], b[0] - a[2]) + Math.max(0, a[1] - b[3], b[1] - a[3]);
const at = (entity: NativeEntity) => entity.signature + '@' + entity.position.join(',');
const scene = (o: NativeObservation) => o.frame_hash + '/' + o.available_action_refs.join(',');
const count = (history: Step[], test: (s: Step) => boolean) => history.reduce((n, s) => n + Number(test(s)), 0);

export function recordCompositionStep(
  state: State,
  before: NativeObservation,
  after: NativeObservation,
  cmd: NativeCommand
) {
  const key = observedCommandKey(cmd),
    history = state.history,
    source = scene(before),
    target = scene(after);
  const repeated = history.some((step) => step.key === key && step.source === source && step.target === target);
  const effect =
    source === target
      ? 'unchanged'
      : history.some((step) => step.source === target || step.target === target)
        ? 'return'
        : 'new';
  history.push({ source, target, key, repeated, effect, evidence: after.observation_ref });
  if (source === target || cmd.action_ref === 'ACTION6') return;
  const unique = new Map(after.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e]));
  for (const entity of before.entities) {
    const moved = !entity.identity_ambiguous && unique.get(entity.signature);
    if (!moved) continue;
    const dx = moved.position[0] - entity.position[0],
      dy = moved.position[1] - entity.position[1];
    if (!dx && !dy) continue;
    const existing = state.motions.find((m) => m.actor === entity.signature && m.op === key);
    const motion = { actor: entity.signature, op: key, dx, dy, evidence: after.observation_ref };
    if (!existing) state.motions.push(motion);
    else Object.assign(existing, motion);
  }
}

function orderedBefore(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return false;
}
export function chooseSequence(history: Step[], current: string, inputs: readonly NativeCommand[]) {
  const previous = history.at(-1),
    symbols = history.map((s) => s.key.split(':')[0]!);
  const contexts = new Map<string, number>();
  // Count continuations of suffixes ending at the current prefix, shortest first.
  // Length grows with experience, so a repeatedly exhausted pair can expose a longer experiment.
  const depth = Math.min(history.length, 1 + Math.floor(Math.log2(history.length + 1)));
  for (let i = 0; i < history.length; i++) {
    for (let n = 0; n <= Math.min(i, depth); n++) {
      if (n && symbols[i - n] !== symbols[symbols.length - n]) break;
      const k = n + '/' + symbols[i];
      contexts.set(k, (contexts.get(k) ?? 0) + 1);
    }
  }
  let best: { command: NativeCommand; score: number[] } | undefined;
  for (const command of inputs) {
    const key = observedCommandKey(command),
      op = command.action_ref;
    const here = history.filter((s) => s.source === current && s.key === key);
    const relation = actionRelation(previous?.key, key, history.at(-2)?.key);
    const rank = compositionPrior[(previous?.effect ?? 'start') + '/' + relation] ?? 0.5;
    const score = [Number(here.length > 0), here.length];
    for (let n = 1; n <= depth; n++) score.push(contexts.get(n + '/' + op) ?? 0);
    score.push(
      contexts.get('0/' + op) ?? 0,
      count(history, (s) => s.key === key),
      -rank
    );
    if (!best || orderedBefore(score, best.score)) best = { command, score };
  }
  return best?.command;
}
function relationTrial(state: State, observation: NativeObservation, inputs: readonly NativeCommand[]) {
  const ops = new Map(inputs.map((command) => [command.action_ref, command]));
  const candidates = observation.entities;
  let best: { command: NativeCommand; goal: Goal; score: number[]; evidence: string } | undefined;
  for (const motion of state.motions) {
    const actor = candidates.find((e) => !e.identity_ambiguous && e.signature === motion.actor);
    const command = ops.get(motion.op);
    if (!actor || !command) continue;
    const current = scene(observation);
    const known = state.history.filter((s) => s.source === current && s.key === motion.op);
    if (known.some((s) => s.effect === 'unchanged' || s.repeated)) continue;
    const moved: NativeBox = [
      actor.bbox[0] + motion.dx,
      actor.bbox[1] + motion.dy,
      actor.bbox[2] + motion.dx,
      actor.bbox[3] + motion.dy,
    ];
    for (const target of candidates) {
      if (actor === target) continue;
      const distance = gap(actor.bbox, target.bbox),
        next = gap(moved, target.bbox);
      if (distance === 0 || next >= distance) continue;
      const pair = actor.signature + '>' + at(target);
      const continued = state.active?.pair === pair && distance < state.active.gap;
      const score = [continued ? 0 : 1, state.tests[pair] ?? 0, Number(known.length > 0), next, distance];
      if (!best || orderedBefore(score, best.score))
        best = {
          command,
          score,
          goal: { pair, actor: actor.signature, target: at(target), gap: distance },
          evidence: motion.evidence,
        };
    }
  }
  return best;
}

export function createCompositionTrials(): NativeFamily<Offer> {
  let state = initial();
  const learn = (before: NativeObservation, after: NativeObservation, command: NativeCommand,first:NativeRows,second:NativeRows) => {
    if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed!==after.levels_completed)return;
    if (state.epoch !== before.level_epoch) state = initial(before.level_epoch);
    recordCompositionStep(state, before, after, command);
    const coverage=state.coverage??={};
    recordCompositionCoverage(coverage,first,observedCommandKey(command));
    recordCompositionCoverage(coverage,second);
    if(before.frame_hash!==after.frame_hash)learnRewrites(state.rewrites??=[],first,second,observedCommandKey(command),state.history.length);
    learnOperands(state.operands??=newOperandMemory(),before,after,first,second,observedCommandKey(command));
  };
  return {
    id: compositionFamily,
    propose: () => null,
    proposeInSubquestion(_group, entry, observation, rows, inputs, remaining, execution) {
      return this.proposeInGroup!(entry, observation, rows, inputs, remaining, execution);
    },
    async proposeInGroup(group, observation, rows, inputs, remaining) {
      if (group === fieldGroup && remaining > 0) return proposeFieldComposition(compositionFamily,observation,rows,
        state.epoch === observation.level_epoch ? state.rejectedFields ?? [] : []);
      if (state.epoch !== observation.level_epoch || !state.history.length || remaining < 1) return null;
      const history = state.history;
      const repeated = history.filter((s) => s.repeated && s.effect !== 'unchanged');
      const returns = history.filter((s) => s.effect === 'return');
      const recent = history.slice(-8);
      const replaying = repeated.length >= 3 && recent.some((s) => s.repeated && s.effect !== 'unchanged');
      const revisiting = returns.length >= 6 && recent.filter((s) => s.effect === 'return').length >= 2;
      const follow=group===followCompositionGroup;
      const returning=group===composeAtReturnGroup;
      const operands=state.operands,continuing=!!(operands?.pending||operands?.continueFrom);
      if(follow&&!state.pendingProgram&&!continuing)return null;
      if(returning && ((!state.rewrites?.length&&!operands?.rules.length) || !history.slice(0,-1).some(s=>s.source===scene(observation))))return null;
      if (group === cycleGroup && !replaying && !revisiting) return null;
      if (group !== cycleGroup && group !== exhaustedGroup && !follow && !returning) return null;
      const available = [...inputs];
      for (const op of observation.available_action_refs)
        if (op !== 'ACTION6' && !available.some((c) => c.action_ref === op))
          available.push({ action_ref: op, data: {} });
      const sequence = chooseSequence(history, scene(observation), available);
      let program=state.pendingProgram;
      if(program&&!readyStep(program.steps[program.index]!,rows))program=undefined;
      if(follow&&!program&&!continuing)return null;
      if(!program&&!operands?.pending&&state.rewrites?.length&&(returning||replaying||revisiting)){
        const blocked=new Set((state.attempted??[]).filter(p=>p.origin===observation.frame_hash).map(p=>p.word));
        const stalledInputs=new Set(history.filter(s=>s.source===scene(observation)&&s.effect==='unchanged').map(s=>s.key));
        const depth=Math.min(remaining-1,state.verifiedPrograms?.length?4:3);
        const proposed=composeRewrites(state.rewrites,rows,history.map(s=>s.key),observation.available_action_refs,blocked,
          {length:depth,limit:700,verified:state.verifiedPrograms,blocked:stalledInputs,coverage:state.coverage,
            requireContinuation:true,completed:new Set(state.completedGoals)});
        if(proposed?.continuation)program={steps:[...proposed.steps,proposed.continuation],index:0,origin:observation.frame_hash,
          nextEffect:effectSite(proposed.continuation)};
      }
      let operand=!program&&operands?operandPlan(operands,observation,rows,remaining):undefined;
      if(follow&&operand&&operands?.continueFrom&&!operands.pending&&operand.role!==operands.continueFrom)operand=undefined;
      const needed=program?.steps[program.index]?.op??operand?.steps[operand.index]?.input;
      let synthesized=needed?available.find(cmd=>observedCommandKey(cmd)===needed):undefined;
      if(needed&&!synthesized&&needed.startsWith('ACTION6:')&&observation.available_action_refs.includes('ACTION6')){
        const [x,y]=needed.slice(8).split(',').map(Number);
        if(Number.isInteger(x)&&Number.isInteger(y)&&rows[y!]?.[x!]!==undefined)synthesized={action_ref:'ACTION6',data:{x:x!,y:y!}};
      }
      if(!synthesized){program=undefined;operand=undefined;if(follow||returning)return null;}
      const relational = !program && !operand && (state.active || state.trials % 2 === 1) && relationTrial(state, observation, available);
      const command = synthesized ?? (relational ? relational.command : sequence),
        goal = relational ? relational.goal : null;
      if(!command)return null;
      const evidence = [
        ...new Set([
          observation.observation_ref,
          history.at(-1)!.evidence,
            ...(group === cycleGroup ? (replaying ? repeated.slice(-3) : returns.slice(-6)).map((s) => s.evidence) : []),
          ...(relational ? [relational.evidence] : []),
          ...(program?program.steps.map(s=>history[s.ref-1]!.evidence):[]),
          ...(operand?.sourceRefs??[]),
        ]),
      ];
      const context = actionRelation(history.at(-1)?.key, observedCommandKey(command), history.at(-2)?.key);
      const label = operand ? 'Produce the measured change at a new site while preserving the earlier result'
        : program ? 'Test whether this measured change establishes the conditions of the next operation'
        : goal
        ? 'Test whether an observed movement brings two visible components together'
        : 'Test an underexplored continuation of the observed action sequence';
      const parent = 'G_official_completion',
        ref = observation.observation_ref;
      const question = {
        kind: 'test_observed_composition',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: operand ? [operand.role,operand.target.join(),observedCommandKey(command)] : goal
          ? [goal.actor, goal.target, command.action_ref]
          : [context, observedCommandKey(command), history.at(-1)!.key],
        parentObjective: parent,
        satisfactionContract: operand?'new_site_transformed_and_earlier_sites_preserved':goal ? 'observe_change_in_pair_distance' : 'observe_the_composed_public_return',
      };
      const need = { ...question, id: sicNeedId(question), status: 'assigned', evidence };
      const preserved=operand?.kept.map((box,i)=>({id:'retained_operand_'+symbolicDigest([operand.role,box,operand.after]),box,
        refs:operand.keptRefs[i]!,value:operand.after}))??[];
      const witness =
        command.action_ref === 'ACTION6'
          ? await ObservedInputDomain.makeLocusWitness(observation, rows, [command.data.x!, command.data.y!], {
              reason: label,
              evidence,
            })
          : null;
      return {
        status: 'proposed',
        kind: compositionFamily,
        actions: [command],
        ...(program?{program,compositionForecast:{word:program.steps.map(s=>s.op),sources:program.steps.map(s=>s.ref),
          stage:program.index,origin:program.origin,changes:program.steps[program.index]!.changes.length}}:{}),
        ...(operand?{operand,operandForecast:{role:operand.role,...(operand.actor?{actor:operand.actor}:{}),target:operand.target,kept:operand.kept,
          before:operand.before,after:operand.after,correspondence:operand.correspondence,word:operand.steps.map(s=>s.input),
          ...(operand.steps[operand.index]!.at?{at:operand.steps[operand.index]!.at}:{}),index:operand.index}}:{}),
        goal,
        context,
        trigger: group,
        needId: need.id,
        steps: [{ action: command, expected_after: operand?{target:operand.target,
          target_value:operand.steps[operand.index]!.at?operand.before:operand.after,...(operand.steps[operand.index]!.at?{actor_position:operand.steps[operand.index]!.at}:{}),
          preserved_sites:operand.kept,preserved_value:operand.after}:program?{observed_changes:program.steps[program.index]!.changes}:null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: {
          strategy: 'test_composition',
          need: label,
          mode: 'exploration',
          situation: label,
          evidence,
          agenda: [],
          trigger: group,
        },
        compositions: [
          { id: need.id, observed: false, open_question: label, relations: ['contributes_to:' + parent] },
          ...preserved.map(w=>({id:w.id,role:'preserved_condition',observed:true,
            properties:{box:w.box,value:w.value},relations:['contributes_to:'+parent]})),
        ],
        question: { reason: label, hypothesis_refs: evidence },
        route_refs: evidence,
        sicLocalDecision: { strategy: 'test_composition', objective: { id: need.id, label, parent }, need },
        bundle_template: {
          operation_key: 'OP18',
          composition_ref: need.id,
          objective_ref: parent,
          purpose: label,
          evidence,
          preconditions: {},
          preserve_refs: preserved.map(w=>w.id),
          ...(preserved.length?{preservation_evidence:Object.fromEntries(preserved.map(w=>[w.id,{
            observation_ref:ref,witness_refs:w.refs,current_condition_measure:{box:w.box,value:w.value}}]))}:{}),
          actions: [command],
          outcome_guard: { path: ['value'], contains: need.id },
        },
      };
    },
    before(p, i, _packet, o) {
      const admitted = i === 0 && p.binding?.observation_ref === o.observation_ref;
      return { admitted, reason: admitted ? 'current_composition_bound' : 'composition_scope_changed' };
    },
    after(p, _i, b, a,first,second) {
      const won = a.levels_completed > b.levels_completed;
      const actor = p.goal && a.entities.find((e) => !e.identity_ambiguous && e.signature === p.goal!.actor);
      const target = p.goal && a.entities.find((e) => at(e) === p.goal!.target);
      const matched = won
        ? true
        : p.fieldForecast ? fieldMatches(p.fieldForecast,first,second)
        : p.operand ? operandMatches(p.operand,a,second)
        : p.program ? observedRewrite(p.program.steps[p.program.index]!,first,second)
        : p.goal
          ? actor && target
            ? gap(actor.bbox, target.bbox) < p.goal.gap
            : null
          : null;
      return {
        matched,
        seal_prefix: true,
        reason: won
          ? 'official_boundary'
          : p.fieldForecast ? (matched?'joint_field_relations_confirmed':'joint_field_relations_refuted')
          : p.operand ? (matched?'operand_and_preserved_sites_confirmed':'operand_or_preserved_site_refuted')
          : p.program ? (matched?'predicted_composition_effect':'composition_link_refuted') : matched === true
            ? 'objects_approached'
            : matched === false
              ? 'approach_refuted'
              : 'sequence_return_observed',
      };
    },
    record(b, a, command, first, second, p) {
      learn(b, a, command,first,second);
      let outcome:string|undefined;
      if (p.fieldForecast) {
        const won = a.levels_completed > b.levels_completed;
        const confirmed = !won && a.level_epoch===b.level_epoch && a.state===b.state && fieldMatches(p.fieldForecast,first,second);
        if (!won && !confirmed && state.epoch===b.level_epoch) state.rejectedFields=[...(state.rejectedFields??[]).slice(-63),p.fieldForecast.key];
        outcome=won?'official_completion':confirmed?'joint_field_relations_confirmed':'joint_field_relations_refuted';
      }
      if(state.operands){
        const operands=state.operands;
        delete operands.pending;delete operands.continueFrom;
        if(p.operand){
          const t=p.operand,won=a.levels_completed>b.levels_completed;
          const confirmed=!won&&a.level_epoch===b.level_epoch&&a.state===b.state&&operandMatches(t,a,second);
          if(confirmed&&t.index+1<t.steps.length)operands.pending={...t,index:t.index+1};
          else if(confirmed)operands.continueFrom=t.role;
          else if(!won)operands.rejected=[...operands.rejected.slice(-63),t.key];
          outcome=won?'official_completion':confirmed?'retained_operand_confirmed':'retained_operand_refuted';
        }
      }
      if(p.program){
        const {steps,index,origin}=p.program,word=steps.map(r=>r.op).join('/');
        if(!index)state.attempted=[...(state.attempted??[]).slice(-31),{origin,word:p.program.nextEffect?steps.slice(0,-1).map(s=>s.op).join('/'):word}];
        const matched=a.level_epoch===b.level_epoch&&a.levels_completed===b.levels_completed&&a.state===b.state
          && observedRewrite(steps[index]!,first,second);
        delete state.pendingProgram;
        if(matched&&index+1<steps.length){state.pendingProgram={...p.program,index:index+1};outcome='confirmed_prefix';}
        else if(matched){
          state.verifiedPrograms=[...(state.verifiedPrograms??[]).slice(-3),steps];
          if(p.program.nextEffect)state.completedGoals=[...new Set([...(state.completedGoals??[]).slice(-31),p.program.nextEffect])];
          outcome='confirmed_program';
        }else {
          if(index>=2)state.verifiedPrograms=[...(state.verifiedPrograms??[]).slice(-3),steps.slice(0,index)];
          outcome=a.levels_completed>b.levels_completed?'official_completion':'refuted_program';
        }
      }else delete state.pendingProgram;
      state.trials++;
      if (p.goal) state.tests[p.goal.pair] = (state.tests[p.goal.pair] ?? 0) + 1;
      state.active = p.goal;
      return {
        events: [{ kind: 'sic_composition_trial', context: p.context, trigger: p.trigger, relation: !!p.goal,
          ...(outcome?{result:outcome}: {}) }],
      };
    },
    observePublicOutcome(b, a, c,first,second) {
      learn(b, a, c,first,second);
      delete state.pendingProgram;
      if(state.operands){delete state.operands.pending;delete state.operands.continueFrom;}
      state.active = null;
    },
    state: () => state,
    restore(value: NativeRecord) {
      state = structuredClone(value as State);
    },
  };
}
