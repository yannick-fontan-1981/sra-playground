import type { NativeSelectionGroup } from '../logos-engine/v6-native-types.ts';
import { coveragePlanGroup, evidencedPlanGroup, recurrentExperimentGroup } from './experiment-arbitration.ts';
import { observedPressureRecoveryGroup, projectedPublicEffectsGroup, publicInputExplorationId } from './public-input-exploration.ts';
import { compositionFamily, cycleGroup, exhaustedGroup, followCompositionGroup, composeAtReturnGroup } from './test-observed-compositions.ts';
import { preparedEffectsId } from './test-prepared-effects.ts';
import {fieldGroup} from './compose-field-relations.ts';
import {finishSilentTest, startSilentTest} from './silent-input-experiment.ts';

export function planningGroupsWithExperiments(groups: readonly NativeSelectionGroup[],prioritizeCoverage=false, testSilentInputs=false): NativeSelectionGroup[] {
  const projected = { id: projectedPublicEffectsGroup, families: [compositionFamily,publicInputExplorationId], entryPoints:[fieldGroup,null] };
  if(testSilentInputs){
    projected.families.unshift(preparedEffectsId);
    projected.entryPoints.unshift(finishSilentTest);
  }
  if(prioritizeCoverage){
    projected.families.unshift(preparedEffectsId);
    projected.entryPoints.unshift(coveragePlanGroup);
  }
  return [projected, ...groups.map(group => {
    if (group.id !== observedPressureRecoveryGroup && group.id !== 'explore_available_inputs') return group;
    const entries = group.families.map((id, i) => ({ id, entry: group.entryPoints?.[i] ?? null }));
    if (group.id === observedPressureRecoveryGroup) {
      entries.push({ id: preparedEffectsId, entry: evidencedPlanGroup }, {id:compositionFamily,entry:followCompositionGroup});
    } else {
      const exploration = entries.findIndex(family => family.id === publicInputExplorationId);
      if (exploration < 0) throw Error('Missing public input exploration entry');
      entries.splice(exploration, 0,
        { id: compositionFamily, entry: fieldGroup },
        ...(testSilentInputs ? [{ id: preparedEffectsId, entry: startSilentTest }] : []),
        { id: preparedEffectsId, entry: recurrentExperimentGroup },
        { id: compositionFamily, entry: composeAtReturnGroup },
        { id: compositionFamily, entry: cycleGroup });
      entries.push({ id: preparedEffectsId, entry: exhaustedGroup }, { id: compositionFamily, entry: exhaustedGroup });
    }
    return { ...group, families: entries.map(x => x.id), entryPoints: entries.map(x => x.entry) };
  })];
}
