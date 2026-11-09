#!/usr/bin/env python3
"""Measure outline geometry on 100 retained public initial rasters only.

This prepares a future acquisition study, not an executable proposal or game
result. No family is instantiated, no SRC policy runs, and no game host is
loaded. Every measured outline comes from the unchanged pinned boxes function.
"""
from __future__ import annotations
import argparse
import ast
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
CORPUS = ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
OUTPUT = ROOT / 'docs/migration/native-campaigns-v52/candidate-selection.json'
FAMILY = 'agents/yf_arc3_v6/morphology_policy/outline_service/family.py'
POLICY = 'agents/yf_arc3_v6/morphology_policy/outline_service/outline.drm'
STRATEGY = 'agents/yf_arc3_v6/morphology_policy/strategy.drm'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def proof(path):
    return {'path': Path(path).relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': Path(path).stat().st_size}


def verify_source():
    manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    assert len(manifest) == 1786
    for name, entry in manifest.items():
        assert sha(SOURCE / name) == entry['sha256'], name
    return {name: entry['sha256'] for name, entry in sorted(manifest.items())}


def source_cold_guard():
    """Inspect the actual source guard without executing the family/proposer."""
    module = ast.parse((SOURCE / FAMILY).read_text())
    family = next(node for node in module.body if isinstance(node, ast.ClassDef) and node.name == 'OutlineService')
    initializer = next(node for node in family.body if isinstance(node, ast.FunctionDef) and node.name == '__init__')
    proposal = next(node for node in family.body if isinstance(node, ast.FunctionDef) and node.name == 'propose')
    null_control = [node for node in initializer.body if isinstance(node, ast.Assign)
                    and any(ast.unparse(target) == 'self.control' for target in node.targets)
                    and isinstance(node.value, ast.Constant) and node.value.value is None]
    guard = next(node for node in proposal.body if isinstance(node, ast.If))
    assert len(null_control) == 1
    assert ast.unparse(guard.test) == 'not self.control or remaining < 1'
    assert len(guard.body) == 1 and isinstance(guard.body[0], ast.Return) and isinstance(guard.body[0].value, ast.Constant) and guard.body[0].value.value is None
    record = next(node for node in family.body if isinstance(node, ast.FunctionDef) and node.name == 'record')
    eligibility = next(node for node in ast.walk(record) if isinstance(node, ast.Assign)
                       and any(isinstance(target, ast.Name) and target.id == 'eligible' for target in node.targets))
    assert ast.unparse(eligibility.value) == "[t for t in self.tracks.values() if t['interior_contrast'] and len(t['evidence']) >= 3]"
    unique = [node for node in ast.walk(record) if isinstance(node, ast.If) and ast.unparse(node.test) == 'len(eligible) == 1']
    assert len(unique) == 1
    return {'initialControl': None, 'coldProposalAdmissible': False,
            'verification': 'AST inspection of unchanged initializer, proposal guard and acquisition eligibility; no method executed.',
            'controlAcquisitionRequires': {
                'exactUniqueBeforeAndAfterOutlineSignature': True,
                'nonzeroAxisAlignedTranslation': True,
                'compatibilityWithDeclaredRevisableDirectionPrior': True,
                'observedInteriorContrast': True,
                'minimumDistinctObservationEvidenceRefs': 3,
                'uniqueEligibleTrack': True,
            },
            'historicalControlAtEpochBoundary': 'Only a unique currently matching signature can recall a conditional hypothesis; historical references are not current transition evidence.'}


def measure():
    verified_before = verify_source()
    sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
    from agents.yf_arc3_v6.morphology_policy.outline_service.family import boxes
    policy = json.loads((SOURCE / POLICY).read_text())['declarations'][0]['configuration']
    strategy = json.loads((SOURCE / STRATEGY).read_text())['declarations'][0]['configuration']
    entry = 'observed_outline_service'
    assert entry in strategy['factored_material_return']['ordered_subquestions']
    cold_guard = source_cold_guard()
    corpus = json.loads(gzip.decompress(CORPUS.read_bytes()))
    assert corpus['sourceCommit'] == COMMIT and corpus['actions'] == corpus['levelJumps'] == 0
    assert len(corpus['games']) == 100
    results = []
    for view in corpus['games']:
        packet = view['packet']; rows = packet['frame_rows']; obs = view['observation']
        assert packet['step_index'] == packet['levels_completed'] == 0
        raster_hash = hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()
        assert raster_hash[:16] == packet['frame_hash'] == obs['frame_hash']
        outlines = boxes(rows)
        counts = Counter(outline['signature'] for outline in outlines)
        unique = [outline for outline in outlines if counts[outline['signature']] == 1]
        directions = [action for action in policy['interface_prior']['directions'] if action in obs['available_action_refs']]
        results.append({
            'game': view['game'], 'observation_ref': obs['observation_ref'], 'frameDigest': raster_hash,
            'availableActionRefs': obs['available_action_refs'], 'outlines': outlines,
            'visualOutlineCount': len(outlines), 'uniqueSignatureOutlineCount': len(unique),
            'uniqueSignatureComponentRefs': [outline['component_ref'] for outline in unique],
            'declaredDirectionalInputsAvailable': directions,
            'declaredLocalInputAvailable': policy['interface_prior']['interaction'] in obs['available_action_refs'],
            'eligibleForControlAcquisitionStudy': bool(unique and directions),
            'coldEntryAdmissible': False, 'actionAuthorizedByThisEvidence': False,
        })
    imported = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename:
            continue
        path = Path(filename).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = path.relative_to(SOURCE).as_posix(); imported[relative] = sha(path)
            assert imported[relative] == verified_before[relative]
    verified_after = verify_source()
    assert verified_before == verified_after
    visual = [item['game'] for item in results if item['visualOutlineCount']]
    study = [item['game'] for item in results if item['eligibleForControlAcquisitionStudy']]
    return {
        'schema': 'logos-engine.v52.readonly-outline-candidate-selection.v1', 'sourceCommit': COMMIT,
        'sourceFilesVerifiedBeforeImport': len(verified_before), 'sourceFilesVerifiedAfterRun': len(verified_after),
        'sourceUnchanged': True, 'sourceHashes': dict(sorted(imported.items())),
        'explicitSourceFiles': {name: verified_before[name] for name in [FAMILY, POLICY, STRATEGY]},
        'generator': proof(Path(__file__)), 'corpus': {**proof(CORPUS), 'views': len(results), 'actions': 0, 'levelJumps': 0},
        'executionScope': {'gameHostsLoaded': 0, 'gameExecutions': 0, 'familiesInstantiated': 0,
                           'agentProposals': 0, 'srcWorkflowCalls': 0, 'acquisitionCalls': 0,
                           'dispatchedActions': 0, 'privateStatesRead': 0},
        'sourceFunctionsCalled': ['outline_service.family.boxes', 'V5 FrameGrid and detect_components consumed by boxes'],
        'declaredInterfacePrior': policy['interface_prior'], 'coldControlGuard': cold_guard,
        'results': results,
        'summary': {'views': len(results), 'viewsWithMeasuredOutlines': len(visual),
                    'viewsWithUniqueSignatureAndAvailableDeclaredDirection': len(study),
                    'coldEntryAdmissibleViews': 0, 'newGamesAttempted': 0, 'newLevelsCompleted': 0},
        'selection': {
            'entry': entry, 'group': 'factored_material_return', 'sourceDeclared': True,
            'visualCandidateGames': visual, 'controlAcquisitionStudyGames': study,
            'evaluationGame': None, 'successfulGame': None,
            'criterion': 'Retain all hollow rectangular outlines measured by unchanged source boxes, and separately identify unique current signatures with an available direction from the explicitly revisable interface prior. No game code participates in measurement or ordering.',
            'evaluationChoiceStatus': 'deferred_until_real_control_acquisition_is_observed',
            'status': 'visual_candidates_only_no_current_control_or_executed_action',
            'limitation': 'An initial hollow contour is not evidence that it is controlled. The cold source provider abstains until real public returns establish one eligible track. Geometry alone cannot identify a successful future game.',
            'nextTarget': 'Transfer exact outline transition acquisition, interior-contrast evidence, current control rebinding and its conditional locus/service measurements; then evaluate the integrated cold caller with actual public returns.',
            'followOnImplementationWritten': False,
        },
    }


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--verify', action='store_true'); args = parser.parse_args()
    result = measure()
    encoded = (json.dumps(result, indent=2, ensure_ascii=False) + '\n').encode()
    if args.verify:
        assert OUTPUT.read_bytes() == encoded, 'Retained candidate measurement differs from source recomputation'
    else:
        if OUTPUT.exists():
            raise FileExistsError(OUTPUT)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True); OUTPUT.write_bytes(encoded)
    print(json.dumps({'status': 'measured', 'mode': 'verify' if args.verify else 'create',
                      'output': OUTPUT.relative_to(ROOT).as_posix(), 'summary': result['summary'],
                      'evaluationGame': None, 'actions': 0}), flush=True)


if __name__ == '__main__':
    main()
