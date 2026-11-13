#!/usr/bin/env python3
"""Rank cold evaluation candidates using retained public geometry only.

The sole measurement input is the immutable v52 study of 100 public initial
rasters. This script imports no agent or game code, does not infer a control,
does not construct a proposal, and supplies no state or command to a runtime.
Its output selects an evaluation environment, never an action or a success.
"""
from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / 'docs/migration/native-campaigns-v52/candidate-selection.json'
INPUT_SHA256 = 'cab4e692688a63ee402f30fbbd74a5e63cd81e718bd1d3e556e214a7ff63f57a'
OUTPUT = ROOT / 'docs/migration/native-campaigns-v53/candidate-selection.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def proof(path):
    data = path.read_bytes()
    return {'path': path.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': digest(data)}


def measure():
    raw = INPUT.read_bytes()
    require(digest(raw) == INPUT_SHA256, 'The immutable v52 public measurement has changed')
    upstream = json.loads(raw)
    require(upstream['schema'] == 'logos-engine.v52.readonly-outline-candidate-selection.v1', 'Unexpected input schema')
    require(upstream['executionScope'] == {key: 0 for key in upstream['executionScope']}, 'Upstream study executed an agent or game')
    require(len(upstream['results']) == upstream['corpus']['views'] == 100, 'Incomplete public initial corpus')
    require(upstream['corpus']['actions'] == upstream['corpus']['levelJumps'] == 0, 'Input is not initial public evidence')
    require(proof(ROOT / upstream['corpus']['path']) == {key: upstream['corpus'][key] for key in ('path', 'bytes', 'sha256')}, 'Public corpus digest differs from the retained measurement')
    prior = upstream['declaredInterfacePrior']
    require(prior['status'] == 'declared_revisable_library_hypothesis_not_acquired_mapping', 'The interface prior has been promoted to an acquired mapping')
    directions = list(prior['directions'])
    results = []
    for index, measured in enumerate(upstream['results']):
        require(measured['coldEntryAdmissible'] is False and measured['actionAuthorizedByThisEvidence'] is False,
                'A geometric candidate must not authorize an action')
        outlines = measured['outlines']
        counts = Counter(outline['signature'] for outline in outlines)
        unique = [outline for outline in outlines if counts[outline['signature']] == 1]
        require([outline['component_ref'] for outline in unique] == measured['uniqueSignatureComponentRefs'],
                'Unique-signature inventory does not match the immutable measurement')
        available_directions = [action for action in directions if action in measured['availableActionRefs']]
        local_available = prior['interaction'] in measured['availableActionRefs']
        require(available_directions == measured['declaredDirectionalInputsAvailable'] and
                local_available == measured['declaredLocalInputAvailable'], 'Declared input inventory differs')
        # One pixel of enclosing rim on each side is the original route helper's
        # size relation. No reachability, floor, controlled role or movement is
        # inferred from that relation alone.
        pairs = []
        for outline in unique:
            targets = [target for target in outlines
                       if target['width'] == outline['width'] + 2 and
                       target['height'] == outline['height'] + 2]
            pairs.append({
                'outlineComponentRef': outline['component_ref'],
                'outlineSignature': outline['signature'],
                'sizeCompatibleEnclosureComponentRefs': [target['component_ref'] for target in targets],
                'sizeCompatibleEnclosureCount': len(targets),
                'exactlyOneSizeCompatibleEnclosure': len(targets) == 1,
                'currentlyExactInteriorFitComponentRefs': [target['component_ref'] for target in targets
                    if outline['bbox'] == [target['bbox'][0] + 1, target['bbox'][1] + 1,
                                           target['bbox'][2] - 1, target['bbox'][3] - 1]],
            })
        compatible = [pair for pair in pairs if pair['sizeCompatibleEnclosureCount'] > 0]
        unambiguous = [pair for pair in pairs if pair['exactlyOneSizeCompatibleEnclosure']]
        reasons = []
        if not unique:
            reasons.append('no_currently_unique_outline_signature')
        if not available_directions:
            reasons.append('no_available_direction_from_declared_revisable_prior')
        if not local_available:
            reasons.append('no_available_local_input_from_declared_revisable_prior')
        if not compatible:
            reasons.append('no_outline_with_size_compatible_enclosure')
        eligible = not reasons
        # Game labels, coordinates, palette values, exact-fit status and corpus
        # ordering are not ranking criteria. A tied best score stays unresolved.
        score = [int(bool(unambiguous)), len(available_directions), len(unambiguous)] if eligible else None
        results.append({
            **deepcopy(measured),
            'corpusIndex': index,
            'geometryStudy': {
                'uniqueOutlineEnclosureRelations': pairs,
                'outlinesWithAnySizeCompatibleEnclosure': len(compatible),
                'outlinesWithExactlyOneSizeCompatibleEnclosure': len(unambiguous),
                'eligibleForBoundedColdEvaluation': eligible,
                'exclusionReasons': reasons,
                'rankingScore': score,
                'acquiredControl': None,
                'reachableLocus': None,
                'preparedCommands': [],
            },
        })
    candidates = [result for result in results if result['geometryStudy']['eligibleForBoundedColdEvaluation']]
    ranked = sorted(candidates, key=lambda result: result['geometryStudy']['rankingScore'], reverse=True)
    best_score = ranked[0]['geometryStudy']['rankingScore'] if ranked else None
    best = [result for result in ranked if result['geometryStudy']['rankingScore'] == best_score]
    selected = best[0] if len(best) == 1 else None
    return {
        'schema': 'logos-engine.v53.readonly-outline-candidate-selection.v1',
        'generator': proof(Path(__file__).resolve()),
        'input': proof(INPUT),
        'upstreamProvenance': {
            'sourceCommit': upstream['sourceCommit'],
            'sourceHashes': upstream['sourceHashes'],
            'explicitSourceFiles': upstream['explicitSourceFiles'],
            'generator': upstream['generator'],
            'corpus': upstream['corpus'],
            'qualification': 'Source hashes and original measurements are inherited from the digest-verified v52 study; no source function is imported or executed by this script.',
        },
        'declaredInterfacePrior': prior,
        'coldControlGuard': upstream['coldControlGuard'],
        'criteria': {
            'base': 'Current unique outline signature, at least one available declared directional input, available declared local input, and another measured outline exactly two pixels larger in width and height.',
            'relationMeaning': 'Dimensions only. This is neither a current controlled role nor the original complete locus/route predicate.',
            'rankingDescendingLexicographic': [
                'presence_of_at_least_one_outline_with_exactly_one_size_compatible_enclosure',
                'number_of_available_declared_directional_inputs',
                'number_of_outlines_with_exactly_one_size_compatible_enclosure',
            ],
            'reason': 'Prefer less ambiguous enclosure geometry and broader declared directional input availability for evaluating the generic cold caller.',
            'tiePolicy': 'No automatic selection when several views share the best score; report every tied candidate.',
            'notUsedForRanking': ['game_name', 'palette_value', 'absolute_coordinate', 'exact_interior_fit', 'known_solution', 'future_frame', 'game_code'],
            'exactInteriorFit': 'Retained as descriptive initial geometry only, never as a ranking criterion or an action permission.',
        },
        'executionScope': {
            'gameHostsLoaded': 0, 'gameExecutions': 0, 'familiesInstantiated': 0,
            'agentProposals': 0, 'srcWorkflowCalls': 0, 'acquisitionCalls': 0,
            'dispatchedActions': 0, 'privateStatesRead': 0,
            'stateInjectedIntoAgent': 0, 'commandsInjectedIntoAgent': 0,
        },
        'results': results,
        'summary': {
            'views': len(results),
            'viewsWithMeasuredOutlines': sum(bool(row['outlines']) for row in results),
            'originalControlAcquisitionStudyCandidates': sum(row['eligibleForControlAcquisitionStudy'] for row in results),
            'geometryAndInputEvaluationCandidates': len(ranked),
            'coldEntryAdmissibleViews': 0, 'newGamesAttempted': 0, 'newLevelsCompleted': 0,
        },
        'selection': {
            'entry': 'observed_outline_service', 'group': 'factored_material_return',
            'originalVisualCandidates': upstream['selection']['visualCandidateGames'],
            'originalControlAcquisitionStudyCandidates': upstream['selection']['controlAcquisitionStudyGames'],
            'rankedEvaluationCandidates': [
                {'game': row['game'], 'corpusIndex': row['corpusIndex'], 'score': row['geometryStudy']['rankingScore']}
                for row in ranked
            ],
            'bestScoringCandidates': [row['game'] for row in best],
            'evaluationGame': selected['game'] if selected else None,
            'status': 'unique_geometry_rank_for_cold_evaluation' if selected else 'no_unique_geometry_rank',
            'successfulGame': None,
            'limitation': 'No currently acquired control or dispatched action exists in this study. A unique geometric rank does not predict learning, progress or success. Only a separate cold public-return campaign can establish those outcomes.',
            'runtimeUse': 'An external campaign may choose the environment named here. It must start with empty acquired memory and receive no outline, role, mapping, plan, command or state from this report.',
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare the checked-in report byte-for-byte without writing')
    args = parser.parse_args()
    result = measure()
    encoded = (json.dumps(result, ensure_ascii=False, indent=2) + '\n').encode()
    if args.check:
        require(OUTPUT.read_bytes() == encoded, 'The v53 report differs from this reproducible measurement')
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_bytes(encoded)
    print(json.dumps({'path': OUTPUT.relative_to(ROOT).as_posix(), 'sha256': digest(encoded),
                      'bytes': len(encoded), 'summary': result['summary'], 'selection': result['selection']['evaluationGame'],
                      'ranked': result['selection']['rankedEvaluationCandidates'], 'checkOnly': args.check}, indent=2))


if __name__ == '__main__':
    main()
