import type { NativeSelectionGroup } from '../logos-engine/v6-native-types.ts';
import { coveragePlanGroup, evidencedPlanGroup, recurrentExperimentGroup, transferredPreviewGroup } from './experiment-arbitration.ts';
import { observedPressureRecoveryGroup, projectedPublicEffectsGroup, publicInputExplorationId } from './public-input-exploration.ts';
import { compositionFamily, cycleGroup, exhaustedGroup, followCompositionGroup, composeAtReturnGroup } from './test-observed-compositions.ts';
import { preparedEffectsId } from './test-prepared-effects.ts';
import {fieldGroup} from './compose-field-relations.ts';
import { continueMarkedField, learnMarkedLatticeId, verifyMarkedLatticeId } from './marked-lattice.ts';
import { catalogueComparisonId, continueCatalogueViewsGroup } from './catalogue-comparison.ts';
import { continuePanelChainGroup, verifyPanelConfigurationId } from './panel-matching.ts';

export function planningGroupsWithExperiments(groups: readonly NativeSelectionGroup[], prioritizeCoverage = false, withdrawPrimaryFamily = true): NativeSelectionGroup[] {
  const projected = { id: projectedPublicEffectsGroup, families: [compositionFamily,publicInputExplorationId], entryPoints:[fieldGroup,null] };
  if(prioritizeCoverage){
    projected.families.unshift(preparedEffectsId);
    projected.entryPoints.unshift(coveragePlanGroup);
  }
  const shared = groups.map(group => {
    if (group.id !== observedPressureRecoveryGroup && group.id !== 'explore_available_inputs') return group;
    const entries = group.families.map((id, i) => ({ id, entry: group.entryPoints?.[i] ?? null }));
    if (group.id === observedPressureRecoveryGroup) {
      entries.push({ id: verifyMarkedLatticeId, entry: continueMarkedField }, { id: learnMarkedLatticeId, entry: continueMarkedField });
      entries.push({ id: catalogueComparisonId, entry: continueCatalogueViewsGroup });
      entries.push({ id: verifyPanelConfigurationId, entry: continuePanelChainGroup });
      entries.push({ id: preparedEffectsId, entry: evidencedPlanGroup }, {id:compositionFamily,entry:followCompositionGroup});
    } else {
      // A transferred relation with changed geometry still needs a local test.
      // Current slot, panel, catalogue and propagation plans get the same chance
      // to continue as motion plans before that independent revalidation.
      entries.unshift({ id: preparedEffectsId, entry: transferredPreviewGroup });
      const exploration = entries.findIndex(family => family.id === publicInputExplorationId);
      if (exploration < 0) throw Error('Missing public input exploration entry');
      entries.splice(exploration, 0,
        { id: compositionFamily, entry: fieldGroup },
        { id: preparedEffectsId, entry: recurrentExperimentGroup },
        { id: compositionFamily, entry: composeAtReturnGroup },
        { id: compositionFamily, entry: cycleGroup });
      entries.push({ id: preparedEffectsId, entry: exhaustedGroup }, { id: compositionFamily, entry: exhaustedGroup });
    }
    return { ...group, families: entries.map(x => x.id), entryPoints: entries.map(x => x.entry) };
  });
  // Full SIC tries its specialist groups before the independent exploration probes.
  const slot = withdrawPrimaryFamily ? 0 : shared.findIndex(group => group.id === 'explore_available_inputs');
  shared.splice(slot < 0 ? shared.length : slot, 0, projected);
  return shared;
}
