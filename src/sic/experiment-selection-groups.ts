import type { NativeSelectionGroup } from '../logos-engine/v6-native-types.ts';
import { evidencedPlanGroup, recurrentExperimentGroup } from './experiment-arbitration.ts';
import { observedPressureRecoveryGroup, projectedPublicEffectsGroup, publicInputExplorationId } from './public-input-exploration.ts';
import { compositionFamily, cycleGroup, exhaustedGroup, followCompositionGroup, composeAtReturnGroup } from './test-observed-compositions.ts';
import { preparedEffectsId } from './test-prepared-effects.ts';

export function planningGroupsWithExperiments(groups: readonly NativeSelectionGroup[]): NativeSelectionGroup[] {
  const projected = { id: projectedPublicEffectsGroup, families: [publicInputExplorationId] };
  return [projected, ...groups.map(group => {
    if (group.id !== observedPressureRecoveryGroup && group.id !== 'explore_available_inputs') return group;
    const entries = group.families.map((id, i) => ({ id, entry: group.entryPoints?.[i] ?? null }));
    if (group.id === observedPressureRecoveryGroup) {
      entries.push({ id: preparedEffectsId, entry: evidencedPlanGroup }, {id:compositionFamily,entry:followCompositionGroup});
    } else {
      const exploration = entries.findIndex(family => family.id === publicInputExplorationId);
      if (exploration < 0) throw Error('Missing public input exploration entry');
      entries.splice(exploration, 0,
        { id: preparedEffectsId, entry: recurrentExperimentGroup },
        { id: compositionFamily, entry: composeAtReturnGroup },
        { id: compositionFamily, entry: cycleGroup });
      entries.push({ id: preparedEffectsId, entry: exhaustedGroup }, { id: compositionFamily, entry: exhaustedGroup });
    }
    return { ...group, families: entries.map(x => x.id), entryPoints: entries.map(x => x.entry) };
  })];
}
