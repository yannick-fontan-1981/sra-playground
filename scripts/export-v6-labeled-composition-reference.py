#!/usr/bin/env python3
"""Independently enumerate a declared binary grammar and evaluate pinned V5.

No game or native implementation is run. The public sixth-level packet saved
in v44 and synthetic labeled examples supply the inputs. All atomic/complement
literals remain eligible building blocks, even when individually refuted. Each
source request has at most 128 roots; only the union of every completed batch
describes the entire native extension's finite candidate domain.
"""
from __future__ import annotations

import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
LAYA = SOURCE / 'agents/yf_arc3_v6/laya_proto'
sys.path[:0] = [str(SOURCE), str(LAYA)]

from labeled_sequence_methods import infer, scope
from rooted_quota_methods import plain
from terminal_composition import identity
from agents.yf_arc3_v5.capabilities.labeled_predicate_induction_d import LabeledPredicateInductionRequestD, measure_labeled_predicate_induction_d

DIAGNOSIS = 'docs/migration/native-campaigns-v44/catl-next-level-diagnosis.json'


def sha(raw): return hashlib.sha256(raw).hexdigest()


def source_hashes():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)}
    paths.add(SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm')
    result = {}
    for path in paths:
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = str(path.relative_to(SOURCE)); result[relative] = sha(path.read_bytes())
            assert manifest[relative]['sha256'] == result[relative], relative
    return dict(sorted(result.items()))


def synthetic(name, positive, negative, query):
    """Mechanical measured-scene contracts, not raster or live-game claims."""
    panels = []
    for label, left, words in [(14, 1, positive), (15, 35, negative)]:
        panels.append({'bbox': [left, 1, left + 27, 40], 'label': label, 'scale': 2, 'pitch': 3,
                       'words': [{'values': list(values), 'boxes': [[left + 2 + 3 * x, 4 + 3 * y, left + 3 + 3 * x, 5 + 3 * y]
                                 for x in range(len(values))]} for y, values in enumerate(words)]})
    buttons = [{'label': 14, 'bbox': [40, 48, 47, 53], 'point': [43, 50]},
               {'label': 15, 'bbox': [53, 48, 60, 53], 'point': [56, 50]}]
    scene = {'panels': panels, 'buttons': buttons, 'palette': sorted(set(v for p in panels for w in p['words'] for v in w['values'])),
             'query': {'bbox': [1, 47, 32, 54], 'label': 6, 'scale': 3, 'pitch': 4,
                       'words': [{'values': list(query), 'boxes': [[3 + 4 * i, 49, 5 + 4 * i, 51] for i in range(len(query))]}]}}
    scene['context_ref'] = identity([panels, buttons])
    obs = {'level_epoch': 1, 'levels_completed': 0, 'observation_ref': 'native-binary-reference:' + name,
           'frame_hash': identity(scene)[:16], 'available_action_refs': ['ACTION6'], 'state': 'NOT_FINISHED'}
    cfg = {'features': [], 'comparisons': ['EQ', 'GE'], 'root_bound': 128,
           'question': 'Classify only by nonempty finite-domain agreement.', 'roles': ['labeled_examples', 'current_query', 'current_label_control']}
    return {'id': name, 'scene': scene, 'observation': obs, 'cfg': cfg,
            'qualification': 'Synthetic mechanical measured-scene contract; no raster, game source, action or solved-level claim.'}


def evaluate(case):
    scene, obs, cfg = copy.deepcopy(case['scene']), copy.deepcopy(case['observation']), copy.deepcopy(case['cfg'])
    atomic = plain(infer(scene, obs, time.perf_counter() + 600, cfg))
    assert atomic is not None
    assert atomic['induction']['status'] == 'COMPLETE'
    assert atomic['induction']['cause'] == 'MODEL_CONTRADICTION'
    assert atomic['induction']['values']['observation_compatible_version_space'] == []
    nodes = copy.deepcopy(atomic['grammar'])
    literals = sorted(node['node_ref'] for node in nodes)
    by_ref = {node['node_ref']: node for node in nodes}
    assert len(by_ref) == len(literals)
    for node in nodes:
        assert node['kind'] == 'ATOM' or node['kind'] == 'NOT' and by_ref[node['child_refs'][0]]['kind'] == 'ATOM'
    compositions = []
    for i, first in enumerate(literals):
        for second in literals[i + 1:]:
            children = [first, second]
            for operation in ['AND', 'OR']:
                ref = 'P_native_binary:' + identity([operation, children])
                compositions.append({'node_ref': ref, 'kind': operation, 'feature_ref': None,
                                     'comparator': None, 'value': None, 'child_refs': children})
    root_refs = [*literals, *(node['node_ref'] for node in compositions)]
    assert len(root_refs) == len(literals) ** 2 == len(set(root_refs))
    all_nodes = {**by_ref, **{node['node_ref']: node for node in compositions}}
    labels = [str(panel['label']) for panel in scene['panels']]
    examples = [{'example_ref': f"example:{panel['label']}:{index}", 'receipt_ref': obs['observation_ref'] + f"/example:{panel['label']}:{index}",
                 'label_ref': str(panel['label']), 'sealed': True, 'epoch': obs['level_epoch']}
                for panel in scene['panels'] for index, _word in enumerate(panel['words'])]
    assignments = [[row['model_ref'], feature['feature_ref'], feature['value']]
                   for row in [*atomic['training_cache']['training_features']['values']['model_feature_rows'],
                               *atomic['query_features']['values']['model_feature_rows']]
                   for feature in row['features']]
    base = {'scope': scope(obs, scene, 'independent_binary_reference'),
            'operation_ref': 'mechanics.visual_sequence.labeled_predicate_induction', 'mode_ref': 'PREDICT',
            'phase_ref': 'FINITE_LABELED_GRAMMAR', 'requested_result_type': 'DMechanicalResult',
            'node_bound': 100000, 'depth_bound': 128, 'domain_bound': 4096, 'time_bound_ms': 300000,
            'positive_label_ref': labels[0], 'negative_label_ref': labels[1], 'examples': examples,
            'models': [{'model_ref': scene['context_ref'], 'feature_values': assignments,
                        'submission_preconditions': [[label, True] for label in labels], 'measurement_complete': True}],
            'query_example_ref': 'current_query', 'grammar_domain_complete': True, 'assignment_domain_complete': True}
    batches, version, eliminations, predictions = [], [], [], []
    for index, start in enumerate(range(0, len(root_refs), 128)):
        roots = root_refs[start:start + 128]
        # Dependencies are supplied, but only this batch's roots are licensed.
        # No later batch is discarded after an early agreement or disagreement.
        grammar = [*nodes, *(all_nodes[ref] for ref in roots if ref not in by_ref)]
        request = LabeledPredicateInductionRequestD(**copy.deepcopy({**base, 'grammar': grammar, 'predicate_root_refs': roots}))
        result = plain(measure_labeled_predicate_induction_d(request).model_dump())
        assert result['status'] == 'COMPLETE' and result['domain_complete'] is True, (case['id'], index, result['cause'])
        values = result['values']
        observed = [row['predicate_ref'] for row in values['observation_compatible_version_space']]
        rejected = [row['predicate_ref'] for row in values['elimination_certificates']]
        assert set(observed + rejected) == set(roots) and len(observed) + len(rejected) == len(roots)
        assert all(row['observation_check_complete'] is True for row in values['observation_compatible_version_space'])
        version.extend(values['observation_compatible_version_space']); eliminations.extend(values['elimination_certificates']); predictions.extend(values['label_predictions'])
        batches.append({'index': index, 'request': plain(request.model_dump()), 'result': result})
    assert len(version) + len(eliminations) == len(root_refs) and len(predictions) == len(version)
    outcomes = sorted({(row['predicted_label_ref'], row['submission_precondition']) for row in predictions})
    assert all(row['predicted_label_ref'] is not None and row['submission_precondition'] is True for row in predictions)
    result = {**case, 'atomicResult': atomic,
              'domain': {'syntax': 'source literals plus one unordered distinct binary AND/OR layer', 'literalRefs': literals,
                         'rootRefs': root_refs, 'literalCount': len(literals), 'compositionCount': len(compositions), 'rootCount': len(root_refs),
                         'rootDefinitionsSha256': identity([all_nodes[ref] for ref in root_refs]), 'allRootsExamined': True},
              'batches': batches,
              'aggregate': {'compatibleVersionSpace': version, 'eliminationCertificates': eliminations, 'labelPredictions': predictions,
                            'outcomes': [list(item) for item in outcomes], 'robustAgreement': bool(version) and len(outcomes) == 1,
                            'allBatchesComplete': True, 'batchesEvaluated': len(batches), 'rootCount': len(root_refs),
                            'compatibleCount': len(version), 'eliminatedCount': len(eliminations), 'uniqueLawClaimed': False,
                            'classificationSubmissionAuthorized': False}}
    return result


def main():
    hashes_before = source_hashes()
    diagnosis = json.loads((ROOT / DIAGNOSIS).read_text())
    assert diagnosis['status'] == 'passed'
    policy = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['window_constraints']['labeled_sequence_composition']['labeled_sequence_question']
    cases = [
        synthetic('all_atoms_refuted_but_conjunction_fits', [[0, 1, 2]] * 2, [[0, 1], [0, 2], [0]], [2, 0, 1]),
        synthetic('all_atoms_refuted_but_disjunction_fits', [[0, 1, 2], [0, 1], [0, 2]], [[0]] * 2, [2, 0]),
        synthetic('equal_training_predictions_diverge_on_query', [[0, 1, 2, 3]] * 2, [[0, 2, 3], [0, 1], [0]], [0, 1, 2]),
        {'id': 'saved_public_catl_sixth_level', 'scene': diagnosis['measuredScene'], 'observation': diagnosis['inputs']['observation'], 'cfg': policy,
         'qualification': 'Saved public v44 packet after action 40; this source-only evaluator does not run a game, issue a command or claim a solved sixth level.'},
    ]
    evaluated = []
    for case in cases:
        item = evaluate(case); evaluated.append(item)
        print(json.dumps({'case': case['id'], 'roots': item['domain']['rootCount'], 'survivors': item['aggregate']['compatibleCount'],
                          'outcomes': item['aggregate']['outcomes'], 'robustAgreement': item['aggregate']['robustAgreement']}), flush=True)
    assert evaluated[0]['aggregate']['robustAgreement'] is True
    assert evaluated[1]['aggregate']['robustAgreement'] is True
    assert evaluated[2]['aggregate']['robustAgreement'] is False and len(evaluated[2]['aggregate']['outcomes']) == 2
    hashes_after = source_hashes(); assert all(hashes_after.get(k) == v for k, v in hashes_before.items())
    result = {'schema': 'logos-engine.v6.native-binary-labeled-source-reference.v1', 'sourceCommit': COMMIT,
              'sourceHashes': hashes_after, 'sourceModified': False,
              'generator': str(Path(__file__).relative_to(ROOT)), 'generatorSha256': sha(Path(__file__).read_bytes()),
              'inputs': [{'path': DIAGNOSIS, 'sha256': sha((ROOT / DIAGNOSIS).read_bytes())}],
              'qualification': {'gameHostRun': False, 'nativeImplementationRun': False,
                  'sourceEvaluator': 'Unmodified pinned measure_labeled_predicate_induction_d on complete batches of at most 128 roots.',
                  'grammarGeneration': 'Independent declared one-layer binary enumeration authored for the native extension; not a claim that the original source caller generates these composites.',
                  'wholeDomain': 'Every literal and unordered distinct AND/OR pair is included. Whole-domain agreement is derived only after all source batches complete; batch-local agreement is never promoted to global agreement.',
                  'projection': 'Every batch request/result is retained in full, including eliminations. Aggregate lists are their complete union.',
                  'solvedLevelsClaimed': False, 'currentQueryOnly': True, 'universalLawClaimed': False},
              'cases': evaluated}
    path = ROOT / 'tests/fixtures/v6-labeled-composition-reference.json.gz'
    path.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode(), mtime=0))
    print(json.dumps({'output': str(path.relative_to(ROOT)), 'sourceFilesVerified': len(hashes_after),
                      'cases': len(evaluated), 'sourceBatches': sum(len(item['batches']) for item in evaluated),
                      'roots': sum(item['domain']['rootCount'] for item in evaluated)}), flush=True)


if __name__ == '__main__': main()
