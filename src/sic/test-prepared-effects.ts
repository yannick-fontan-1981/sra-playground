import {canCompareAnotherPreparation,nextLocalLevel,revisitedChoice,stalledLocal} from './prospective-local-use.ts';
import { evidencedPlanGroup, recurrentExperimentGroup, hasExperimentOpportunity, mayPursueWitnessedEffect, witnessedObjective } from './experiment-arbitration.ts';
import {acceptPreviewCarry,carryPreviewBindings,newPreviewLearning,observePreviewBindings,visualLayout} from './witnessed-preview-transfer.ts';
import {repeatedFrameCommand} from './inverse-frame-experiment.ts';
import {offerCursorTrial,newCursorMemory,measuredReturnSelection} from './marked-cursor-selection.ts';
import {observeLandmarks,observeLandmarkAccess,proposeLandmark,refreshedSelection} from './paired-landmark-placement.ts';
import {informationPriority, type InformationPreference} from './information-preference.ts';
import {observedSituatedOperations,retainSituatedOperations} from './situated-preparation.ts';
import { newDelayedMemory } from './distinguishing-suffix.ts';
import {observeCueCondition} from './seek-missing-preview.ts';
import {observeRelativeMotion} from './relative-motion-learning.ts';
import {chooseRelativePlan,relativeReceipt} from './relative-motion-plan.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type {
  NativeFamily,
  NativeObservation,
  NativeCommand,
  NativeRows,
  NativeProposal,
} from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import {
  initialMemory,
  experimentCommand,
  selectExperiment,
  recordExperiment,
  type Experiment,
} from './preparation-experiments.ts';
import { sicNeedId } from './need-identity.ts';
import { exhaustedGroup } from './test-observed-compositions.ts';
export const preparedEffectsId = 'sic_test_prepared_effects';
import { freshCapabilities } from './derive-capabilities.ts';
import { newSpatialMemory } from './spatial-access.ts';
import {newFrontierMemory} from './experimental-frontier.ts';
import { newProjectionMemory } from './projected-affordances.ts';
type Offer = NativeProposal & { experiment: Experiment };
const labels: Record<Experiment['phase'], string> = {
  testLandmarkPlacement:'Test whether placing one subject first enables a second arrival while it stays there',
  selectMarkedCursor:'Test whether clicking a matching piece transfers the distinctive cursor mark',
  verifyMarkedCursor:'Measure whether the newly selected piece moves while the previous piece stays in place',
  advanceSelectedCursor:'Use the verified control to advance the selected subject while preserving the other placement',
  repairSelectedCursor:'Try another movement while the previously placed subject remains fixed',
  testConfiguration:'Combine two or more observed controls to test a configuration still unexplored',
  localCapacity:'Test a local change that should enable a new response at another site',
  seekTerminalContact:'Reach a visible contact observed immediately before an official completion',
  useRelativePlacement:'Change the relative positions of jointly controlled pieces to open a route to a scoring contact',
  seekMissingCue:'Explore an untested movement to look for the mark that enabled a previous action',
  positionForOperation:'Reach the relative position where a previous operation changed a visible feature',
  usePositionedOperation:'Test the previous operation at the reached position and inspect the feature',
  testScoringContact:'Test whether a measured move onto a single visible target completes the level',
  testMechanismMobility:'Test an untried control for moving a persistent part after a repeated return',
  reconfigureMechanism:'Test whether moving a mechanism opens access beyond a stagnant return',
  unreadIndicator:'Test a command while the possible arrival of this subject is displayed',
  witnessedPreview:'Test whether this subject reaches the indicated site using its witnessed action',
  occupancy:'Test where a prepared part allows another part to arrive and act',
  territorialAccess:'Test an access to a region beyond the measured walking boundary',
  activateResponse:'Test what a command can move after another component was repositioned',
  inverseFrame:'Place a learned reference to reach a predicted destination and continue from it',
  instrumentSite:'Test the control at a new spatial binding and compare what becomes reachable',
  transportControl: 'Test which component inherits a command when the original configuration is restored',
  placedExchange: 'Place a movable partner to reach and use a predicted destination',
  configuredTransfer: 'Test the predicted destination and next move after configuring two sites',
  conditionSetup: 'Place a partner where the observed spatial conditions predict a motion',
  conditionTrigger: 'Compare the predicted motion with the inactive control at the original placement',
  conditionUse: 'Test the predicted use of the newly reached location',
  delayedProbe: 'Test a matched control program after moving or changing its preparation',
  frontierRoute:'Return along witnessed edges to an unanswered experiment',
  frontierProbe:'Try a previously unmeasured control at its selected configuration',
  frontierConsequence: 'Exercise the use made available by the prepared landing',
  frontierUse:'Test the predicted continuation of the newly measured transition',
  projection: 'Test a projected arrangement, arrival and subsequent action',
  capabilityUse: 'Exercise the predicted new access furnished by the invented capability',
  capabilityStep: 'Test a new capability derived from witnessed operators',
  accessContinue: 'Exercise an untested command at the predicted destination',
  accessSetup: 'Arrange the measured bodies for a predicted destination',
  accessTrigger: 'Test the destination derived from this spatial configuration',
  prepare: 'Prepare a second condition for an action with a measured baseline',
  probe: 'Measure B after A from the matched starting scene',
  control: 'Measure B alone from the original starting scene',
  confirmControl: 'Predict and independently repeat the B-only control',
  confirmA: 'Recreate the preparation of the controlled experiment',
  confirmB: 'Test the prediction for B after the preparation',
  reuseA: 'Apply a verified preparation to reach an untested continuation',
  reuseB: 'Use the learned effect and check the predicted landing',
  route: 'Follow a witnessed transition to the controlled experiment',
  inverse: 'Test an inverse learned from public returns and verify the exact experimental origin',
  explore: 'Test a new continuation at the reached destination',
  position: 'Test an accessible arrangement with a visible landmark',
  positionB: 'Measure B at the reached arrangement',
  deriveControl: 'Measure the unprepared control at the proposed new site',
  deriveA: 'Recreate the learned change at the new site',
  deriveB: 'Test the derived prediction at the new site',
  carry: 'Move the changed object while preserving its measured state',
  carryB: 'Test the transported change against the control from this destination',
};
import {completionContacts} from './terminal-contact.ts';
import {exposedUnderParts} from './controlled-parts.ts';
export function createPreparedEffects(informationPreference?:InformationPreference,limits?:{maxDepth:number;maxNodes:number}): NativeFamily<Offer> {
  const comparePreparations=informationPreference?.mode==='active' &&
    informationPriority({strategy:'motion_contrast',distinctOutcomes:2},informationPreference)>0;
  const transferFooting=comparePreparations && informationPreference?.strategy==='transfer_registered_footing';
  const prepareJoint=transferFooting || comparePreparations && informationPreference?.strategy==='prepare_joint_arrivals';
  const reconsiderDestination=prepareJoint || comparePreparations && informationPreference?.strategy==='reclassify_displaced_goal';
  const testPartner=reconsiderDestination || comparePreparations && informationPreference?.strategy==='test_partner_preparation';
  const planAfterSelection=testPartner || comparePreparations && informationPreference?.strategy==='plan_after_selection';
  const seekAccess=planAfterSelection || comparePreparations && informationPreference?.strategy==='indicated_access';
  const prepareArrival=seekAccess || comparePreparations && informationPreference?.strategy==='paired_arrival';
  let m = initialMemory(0);
  function enter(o:NativeObservation){
    if(m.epoch===o.level_epoch)return;
    const carry=m.previewCarry,local=m.localCarry;m=initialMemory(o.level_epoch);m.localCapacity=nextLocalLevel(local);m.previewLearning=acceptPreviewCarry(carry,o);
  }
  function acquire(
    b: NativeObservation,
    a: NativeObservation,
    cmd: NativeCommand,
    rows: NativeRows,
    next: NativeRows,
    x?: Experiment
  ) {
    enter(b);
    if(!x?.relative && m.relativeMotion?.active)delete m.relativeMotion.active;
    const learning=m.previewLearning??=newPreviewLearning();
    if(a.levels_completed>b.levels_completed){const contacts=completionContacts(learning,b,a,visualLayout(b,rows),observedCommandKey(cmd));if(contacts.length)learning.terminal=contacts;}
    if(a.levels_completed>b.levels_completed&&m.localCapacity)m.localCarry=nextLocalLevel(m.localCapacity);
    const boundary=carryPreviewBindings(learning,b,a);
    if(boundary)m.previewCarry=boundary;
    if(b.level_epoch===a.level_epoch&&b.state===a.state&&b.levels_completed===a.levels_completed){
      const before=visualLayout(b,rows),after=visualLayout(a,next);
      const key=observedCommandKey(cmd);
      if(comparePreparations && /^ACTION[5-7]$/.test(key))
        retainSituatedOperations(learning,observedSituatedOperations(learning,b,a,before,after,key));
      observePreviewBindings(learning,b,a,before,after,key);
      if(comparePreparations){
        if(prepareArrival && b.available_action_refs.includes('ACTION6')){
          m.landmarkMemory=observeLandmarks(m.landmarkMemory,before,after,b.observation_ref);
          if(planAfterSelection)m.landmarkMemory.planAfterSelection=true;
          if(testPartner)m.landmarkMemory.testPartner=true;
          if(reconsiderDestination)m.landmarkMemory.reconsiderDestination=true;
          if(prepareJoint)m.landmarkMemory.prepareJoint=true;
          if(transferFooting)m.landmarkMemory.transferFooting=true;
        }
        if(seekAccess&&m.landmarkMemory)observeLandmarkAccess(m.landmarkMemory,before,after,b,a,rows,next,key,x?.landmark);
        observeCueCondition(learning,b,a,before,after,key);
        if(limits && learning.terminal?.length)observeRelativeMotion(m.relativeMotion??={models:{}},learning.terminal,b,a,rows,before,after,key,learning.partMotion);
      }
      exposedUnderParts(learning,b,a,rows,next,before,after);
    }
    if (!x && (b.level_epoch !== a.level_epoch || b.state !== a.state)) return null;
    return recordExperiment(m, b, a, cmd, rows, next, x);
  }
  return {
    id: preparedEffectsId,
    propose: () => null,
    proposeInSubquestion(_group, entry, observation, rows, inputs, remaining, execution) {
      return this.proposeInGroup!(entry, observation, rows, inputs, remaining, execution);
    },
    async proposeInGroup(group, o, rows, inputs, remaining) {
      enter(o);
      if(remaining<1)return null;
      const motorCount=o.available_action_refs.filter(ref=>/^ACTION[1-4]$/.test(ref)).length;
      const opening = !m.turns || (m.cursorSelection?.returns??0)>=2*Math.max(2,motorCount) ||
        (m.cursorSelection?.blocked?.length??0)>=2;
      const again = (!!m.cursorSelection?.motions.length || comparePreparations && !!m.cursorSelection?.oriented?.length) && (!m.cursorSelection?.verified
        || (m.cursorSelection.returns??0)>0 || !!m.cursorSelection.blocked?.length);
      const offeredCursor = group===recurrentExperimentGroup && (opening || again || m.cursorSelection?.pending) || group===evidencedPlanGroup && m.cursorSelection?.pending
        ? offerCursorTrial(m.cursorSelection??=newCursorMemory(),o,rows,!m.turns||!!m.configurationOpportunity,!opening,
          group===recurrentExperimentGroup ? informationPreference : undefined) : null;
      let placementSelection=offeredCursor;
      const previous=m.landmarkMemory?.previousControl;
      if(previous && !m.landmarkMemory?.active && !offeredCursor && !m.cursorSelection?.pending &&
        group===recurrentExperimentGroup && m.cursorSelection && informationPreference){
        const l=visualLayout(o,rows),actor=l[previous.moving],peer=l[previous.parked];
        if(actor?.length===1 && peer?.length===1 && peer[0]!.at.every((v,i)=>v===previous.at[i])){
          placementSelection=measuredReturnSelection(m.cursorSelection,o,rows,actor[0]!.box,peer[0]!.box,previous.ref,informationPreference);
        }
      }
      const landmark=prepareArrival && limits && m.landmarkMemory && (group===evidencedPlanGroup && (m.landmarkMemory.active||m.landmarkMemory.redirect) || group===recurrentExperimentGroup && placementSelection?.stage==='select')
        ? proposeLandmark(m.landmarkMemory,visualLayout(o,rows),o,rows,m.previewLearning?.partMotion??{},placementSelection,limits.maxNodes,seekAccess?limits.maxDepth:undefined):undefined;
      const cursor=landmark?.stage==='select_after_contact'?refreshedSelection(landmark,visualLayout(o,rows)):landmark?null:offeredCursor;
      if (!landmark && !cursor && !m.turns&&!m.localCapacity?.laws.length&&!Object.keys(m.previewLearning?.bindings??{}).length&&!m.previewLearning?.terminal?.length) return null;
      const missingCue=!!m.previewLearning?.cueSearch?.seeking;
      const justMovedLine=Object.values(m.relativeMotion?.models??{}).some(v=>v.contact?.latestDisplacement===o.observation_ref && !!v.contact?.freeWalk && !v.contact.contradicted);
      const repair=missingCue || justMovedLine || !!m.relativeMotion?.active || hasExperimentOpportunity(m);
      const relative=!cursor && repair && limits && group===evidencedPlanGroup && m.relativeMotion && m.previewLearning?.terminal?.length
        ? chooseRelativePlan(m.relativeMotion,visualLayout(o,rows),o,rows,Object.fromEntries(m.previewLearning.terminal.map(w=>[w.marker,w.after])),limits,!missingCue) : null;
      if (!landmark && !cursor && !relative && group === evidencedPlanGroup && !mayPursueWitnessedEffect(m)) return null;
      const localOpportunity=group===recurrentExperimentGroup && !!m.localCapacity &&
        (stalledLocal(m.localCapacity,o.frame_hash) || revisitedChoice(m.localCapacity,o.frame_hash) ||
          canCompareAnotherPreparation(m.localCapacity,o.frame_hash));
      const configurationOpportunity=(group===recurrentExperimentGroup || group===exhaustedGroup) &&
        !!m.configurationOpportunity && (m.configurations?.factors.length??0)>=2;
      if (!landmark && !cursor && group === recurrentExperimentGroup && !hasExperimentOpportunity(m) && !localOpportunity && !configurationOpportunity) return null;
      const available = [...inputs];
      for (const op of o.available_action_refs)
        if (op !== 'ACTION6' && !available.some((c) => c.action_ref === op))
          available.push({ action_ref: op, data: {} });
      const experiment:Experiment|null = landmark ? {phase:'testLandmarkPlacement',origin:-1,a:landmark.command,b:landmark.command,refs:[],
        rule:landmark.joint?'prepare_every_indicated_arrival_before_the_common_operation':landmark.partnerTest?'retry_a_blocked_movement_after_changing_the_partner_placement':'compare_two_arrivals_with_a_preserved_first_contact',landmark,...(cursor?{cursorTrial:cursor}:{})} : cursor ? {
        phase:cursor.stage==='select'?'selectMarkedCursor':cursor.stage==='advance'?'advanceSelectedCursor':cursor.stage==='reroute'?'repairSelectedCursor':'verifyMarkedCursor',origin:-1,a:cursor.command,b:cursor.command,
        rule:cursor.beyondReturn?'test_if_the_recovered_movement_extends_beyond_the_previous_site':cursor.stage==='reroute'?'test_another_motor_after_the_verified_step_stalls':cursor.stage==='advance'?'reuse_measured_control_preserving_the_parked_subject':
          cursor.stage==='verify'?'test_whether_the_same_input_moves_the_clicked_body_while_the_old_body_stays':
          cursor.contrast?'compare_which_subject_responds_to_a_witnessed_motor_after_selection':
          'a_distinctive_colored_mark_on_a_homologous_piece_may_identify_the_controlled_cursor',refs:[],cursorTrial:cursor,
      } : relative ? {phase:'useRelativePlacement',origin:-1,a:relative.op,b:relative.op,rule:'open_a_route_by_changing_a_relative_placement',refs:[],relative} : selectExperiment(m,o,available,group===exhaustedGroup,rows,localOpportunity,configurationOpportunity);
      if(!landmark&&!cursor&&group===recurrentExperimentGroup&&!hasExperimentOpportunity(m)&&!experiment?.localCapacity&&!experiment?.configurationTrial)return null;
      if (!experiment || (!landmark && !cursor && group === evidencedPlanGroup && !witnessedObjective(experiment))) return null;
      const { a, b, phase } = experiment;
      const key=experimentCommand(experiment);
      const command = available.find((c) => observedCommandKey(c) === key) ?? (cursor||landmark?.partnerTest||landmark?.joint||experiment.configurationTrial||experiment.localCapacity||experiment.frame||experiment.activation||experiment.territorial||experiment.occupancy||experiment.mechanism||experiment.unreadIndicator||experiment.witnessedPreview ? repeatedFrameCommand(key,o,rows) : null);
      if (!command) return null;
      const ref = o.observation_ref,
        label = cursor?.basis && cursor.stage==='select' ? 'Test a second subject at the scale of the observed movement' : experiment.frame?.plan.basis==='observed_preparation' ? 'Measure the response after a witnessed change of reference' : experiment.occupancy?.plan.preparedPreview ? 'Move the indicator to redirect the same action and measure the access it opens' : labels[phase],
        parent = 'G_official_completion';
      const positioned = experiment.terminalContact && 'operation' in experiment.terminalContact.witness
        ? experiment.terminalContact.witness : undefined;
      const evidence = [
        ...(positioned?.completionRef ? [positioned.completionRef] : []),
        ref,
        ...(cursor?.evidence??[]),
        ...(landmark?[landmark.pair.ref,landmark.firstRef,...landmark.selection.evidence,...(landmark.access?.ref?[landmark.access.ref]:[])]:[]),
        ...(experiment.cue?.evidence??[]),
        ...(relative?[relative.learned,relative.contrast,relative.contact,...(relative.motorEvidence?[relative.motorEvidence]:[])]:[]),
        ...(experiment.configurationTrial?.evidence??[]),
        ...(experiment.localCapacity?[experiment.localCapacity.ref,...(experiment.localCapacity.controlRef?[experiment.localCapacity.controlRef]:[])]:[]),
        ...(experiment.localCapacity?.observedPrefix?Object.values(experiment.localCapacity.observedPrefix):[]),
        ...(experiment.localCapacity?.analogousUseRef?[experiment.localCapacity.analogousUseRef]:[]),
        ...(experiment.occupancy?.plan.preparedPreview?.priorRead?[experiment.occupancy.plan.preparedPreview.priorRead.before,experiment.occupancy.plan.preparedPreview.priorRead.after]:[]),
        ...(experiment.witnessedPreview?[experiment.witnessedPreview.witness.before,experiment.witnessedPreview.witness.after]:[]),
        ...(experiment.mechanism?.plan.witnessRefs??[]),
        ...(experiment.terminalContact?[experiment.terminalContact.witness.before,experiment.terminalContact.witness.after]:[]),
        ...(experiment.terminalContact?.blockedGoal ? [experiment.terminalContact.blockedGoal.before,experiment.terminalContact.blockedGoal.after] : []),
        ...experiment.refs.map(
          (r) =>
            ref.split(':revision:', 1)[0] +
            ':revision:' +
            r +
            ':frame:' +
            m.scenes[m.revisionScene[r]!]!.split('|')[0]
        ),
      ];
      const question = {
        kind: 'test_prepared_effect',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: experiment.terminalContact?[experiment.terminalContact.witness.actor,experiment.terminalContact.witness.marker,experiment.terminalContact.op]:experiment.mobilityProbe ? [experiment.mobilityProbe.actor,...experiment.mobilityProbe.sites.map(s=>s.role),b] : experiment.mechanism ? [experiment.mechanism.plan.p,experiment.mechanism.plan.c,b] : experiment.unreadIndicator ? [experiment.unreadIndicator.cue.p,experiment.unreadIndicator.cue.r,b] : experiment.witnessedPreview ? [experiment.witnessedPreview.actor,experiment.witnessedPreview.indicator,b] : experiment.occupancy?.preview ? [experiment.occupancy.preview.indicator.role,...experiment.occupancy.preview.layout.map(v=>v.subject),b] : [a, b, experiment.rule, phase],
        parentObjective: parent,
        satisfactionContract: experiment.mobilityProbe ? 'compare_each_named_part_before_and_after_the_untried_control' : experiment.mechanism ? 'verify_the_displacement_of_the_named_mechanism_and_the_access_it_opens' : experiment.unreadIndicator||experiment.witnessedPreview||experiment.occupancy?.preview ? 'verify_the_future_layout_of_the_named_subjects_after_the_selected_action' : 'compare_the_public_effect_of_B_after_each_preparation',
      };
      if(phase==='testScoringContact')question.satisfactionContract='check_the_predicted_approach_and_then_measure_official_progress_at_contact';
      if(phase==='positionForOperation'||phase==='usePositionedOperation')
        question.satisfactionContract='test_the_previous_level_operation_at_its_observed_relative_position';
      if(relative){
        question.subjects=[relative.actor,relative.partner,relative.op];
        question.satisfactionContract='check_all_named_positions_then_replan_toward_the_scoring_contact';
      }
      if(experiment.cue){
        question.subjects=[experiment.cue.actor,experiment.cue.indicator,experiment.cue.operation];
        question.satisfactionContract='inspect_whether_the_required_mark_appears_after_the_untested_movement';
      }
      if(cursor){
        question.subjects=[cursor.source.box.join(','),cursor.target.box.join(','),String(cursor.ink)];
        question.satisfactionContract=cursor.stage==='select'
          ? cursor.contrast?'choose_between_previous_and_selected_subject_by_repeating_the_witnessed_command':'test_whether_the_distinctive_mark_transfers_to_the_clicked_peer'
          : cursor.stage==='reroute'?'verify_an_alternative_movement_with_the_previous_subject_still_parked':cursor.stage==='advance'?'verify_the_next_displacement_and_the_preserved_placement':'test_whether_the_new_cursor_moves_while_the_previous_one_stays';
      }
      if(landmark){
        question.subjects=[landmark.actor,landmark.peer,landmark.pair.role];
        question.satisfactionContract='verify_named_arrival_and_retained_partner_position';
      }
      const equation = experiment.equation?.claim;
      const capability = equation
        ? {
            unknown: 'effect of the proposed program',
            kind: equation.kind,
            roles: equation.roles,
            initial: equation.initial,
            goal: equation.goal,
            derived_effect: equation.effect,
            control: equation.control,
            program: equation.program,
            opportunity: equation.opportunity,
            choices: experiment.equation!.choices,
          }
        : null;
      const projected = experiment.projection?.plan;
      const link=experiment.transfer?.plan;
      const imagined = experiment.instrument?.plan ?? experiment.transport?.plan ?? experiment.exchange?.program ?? (link ? {role:link.role,entry:link.entry,exit:link.exit,placement:link.prepare,arrival:link.desired,subsequent:link.following,alternatives:link.alternatives} : projected ? { roles: projected.roles, placement: projected.steps[projected.arrival]!.from,
        arrival: projected.steps[projected.arrival]!.to, continuation: projected.steps[projected.arrival+1], control: projected.steps[projected.arrival]!.control ?? null, goals: projected.goals, alternatives: experiment.projection?.alternatives ?? [] } : experiment.access
        ? {
            chosen: {
              actor: experiment.access.card.law.actor,
              trigger: experiment.access.card.law.op,
              launch: experiment.access.card.launch,
              placement: experiment.access.card.anchorAt,
              destination: experiment.access.card.destination,
              interest: experiment.access.card.interest,
              score: experiment.access.card.score,
            },
            alternatives: experiment.access.alternatives,
          }
        : null);
      const need = { ...question, id: sicNeedId(question), status: 'assigned', evidence };
      const witness =
        command.action_ref === 'ACTION6'
          ? await ObservedInputDomain.makeLocusWitness(o, rows, [command.data.x!, command.data.y!], {
              reason: label,
              evidence,
            })
          : null;
      return {
        status: 'proposed',
        kind: preparedEffectsId,
        actions: [command],
        experiment,
        ...(cursor ? {cursorSelectionForecast:{...cursor,...(cursor.contrast||cursor.stage==='reroute'||cursor.beyondReturn?{
          decisionMode:cursor.stage==='advance'?'continue_verified_plan':'explore_competing_explanations',
        }:{})}} : {}),
        ...(landmark ? {landmarkForecast:{stage:landmark.stage,role:landmark.pair.role,home:landmark.home,other:landmark.other,
          from:landmark.from,expected:landmark.expected,guard:landmark.guard,basis:landmark.basis,...(landmark.returnRef?{verifiedReturnSource:landmark.returnRef}:{}),
          ...(landmark.joint?{joint:landmark.joint}:{}),...(landmark.displaced?{displacedDestination:landmark.displaced}:{}),...(landmark.partnerTest?{partnerTest:landmark.partnerTest}:{}),...(landmark.access?{access:landmark.access.mobile?{
            purpose:landmark.access.purpose,cue:landmark.access.cue,pivot:landmark.access.mobile.pivot,motion:landmark.access.mobile.motion,
            first:landmark.access.mobile.path[0],length:landmark.access.mobile.path.length,reads:landmark.access.mobile.path.filter(s=>s.read).length,examined:landmark.access.mobile.examined
          }:landmark.access}:{}),
          alternatives:['subject_approaches_with_partner_parked','approach_or_preservation_fails']}} : {}),
        ...(relative ? {relativePlacementForecast:relativeReceipt(relative)} : {}),
        ...(experiment.configurationTrial ? {configurationForecast:experiment.configurationTrial} : {}),
        ...(experiment.localCapacity ? {localCapacityForecast:experiment.localCapacity} : {}),
        ...(experiment.cue ? {cueSearchForecast:{...experiment.cue,decisionMode:'explore_competing_explanations',outcomes:['cue_becomes_visible','cue_remains_absent']}} : {}),
        ...(experiment.instrument ? { instrumentForecast: experiment.instrument.plan, instrumentPosition: experiment.instrument.predicted } : {}),
        ...(experiment.terminalContact ? {terminalContactForecast: {
          ...experiment.terminalContact,
          ...(positioned ? {decisionMode:'explore_competing_explanations',
            operation:positioned.operation,
            alternatives:['named_feature_changes_at_site','named_feature_remains_at_site'],
          } : {}),
        }} : {}),
        ...(experiment.mobilityProbe ? {mobilityForecast:experiment.mobilityProbe} : {}),
        ...(experiment.mechanism ? {mechanismForecast:experiment.mechanism} : {}),
        ...(experiment.unreadIndicator ? {indicatorProbeForecast:experiment.unreadIndicator} : {}),
        ...(experiment.witnessedPreview ? {witnessedPreviewForecast:experiment.witnessedPreview} : {}),
        ...(experiment.occupancy ? {occupancyForecast:experiment.occupancy} : {}),
        ...(experiment.occupancy?.preview ? {morphologicalPreview:experiment.occupancy.preview} : {}),
        ...(experiment.territorial ? {territoryForecast:experiment.territorial} : {}),
        ...(experiment.activation ? {activationForecast:experiment.activation} : {}),
        ...(experiment.frame ? {frameForecast:experiment.frame} : {}),
        ...(experiment.retained ? {retainedForecast: experiment.retained} : {}),
        ...(experiment.transport ? { transportForecast: experiment.transport.plan } : {}),
        ...(experiment.exchange ? { exchangeForecast: experiment.exchange.program } : {}),
        ...(imagined ? { spatial_forecast: imagined } : {}),
        ...(experiment.delayed ? { conditional_program: experiment.delayed } : {}),
        ...(experiment.frontier ? { reachable_experiment: experiment.frontier } : {}),
        ...(experiment.condition ? { conditional_placement: experiment.condition } : {}),
        ...(capability ? { capability_equation: capability } : {}),
        steps: [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: o.level_epoch },
        sicSituationCard: {
          strategy: phase,
          need: label,
          situation: label,
          mode: cursor?.stage==='advance' || relative?.purpose==='reach_scoring_contact' ? 'solving' : 'exploration',
          evidence,
          agenda: [],
        },
        compositions: [
          { id: need.id, observed: false, open_question: label, relations: ['contributes_to:' + parent] },
        ],
        question: {
          reason: label,
          hypothesis_refs: evidence,
          ...(imagined ? { spatial_forecast: imagined } : {}),
          ...(capability ? { capability_equation: capability } : {}),
        },
        route_refs: evidence,
        sicLocalDecision: { strategy: phase, objective: { id: need.id, label, parent }, need },
        bundle_template: {
          operation_key: 'OP18',
          composition_ref: need.id,
          objective_ref: parent,
          purpose: label,
          evidence,
          preconditions: {},
          preserve_refs: [],
          actions: [command],
          outcome_guard: { path: ['value'], contains: need.id },
        },
      };
    },
    before(p, i, _packet, o) {
      const admitted = i === 0 && p.binding?.observation_ref === o.observation_ref;
      return { admitted, reason: admitted ? 'matched_preparation_bound' : 'stale_preparation' };
    },
    after(_p, _i, b, a) {
      const won = a.levels_completed > b.levels_completed;
      return {
        matched: won ? true : null,
        seal_prefix: true,
        reason: won ? 'official_boundary' : 'measure_prepared_return',
      };
    },
    observePublicOutcome(b, a, c, r, n) {
      acquire(b, a, c, r, n);
    },
    record(b, a, c, r, n, p) {
      const outcome = acquire(b, a, c, r, n, p.experiment);
      return {
        events: outcome ? [{ kind: 'sic_preparation_outcome', epoch: b.level_epoch, ...outcome }] : [],
      };
    },
    state: () => m,
    restore(value) {
      m = structuredClone(value as typeof m);
      m.delayed ??= newDelayedMemory();
      m.frontier ??= {...newFrontierMemory(),lastEdge:m.turns,lastScene:m.turns};
      m.projection ??= newProjectionMemory();
      m.space ??= newSpatialMemory();
      m.equations ??= freshCapabilities();
    },
  };
}
