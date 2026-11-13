#!/usr/bin/env python3
"""Compare saved public trajectories; execute neither an agent nor a game host."""
from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = 'tests/fixtures/v6-product-panel-original-public.json.gz'
CAMPAIGN = 'docs/migration/native-campaigns-v43/comb-three-levels.json'
TRACE = 'docs/migration/native-campaigns-v43/comb-public-trace.json.gz'
OUTPUT = 'docs/migration/native-campaigns-v43/comb-original-component-comparison.json'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def packed(value, *, sorted_keys=True):
    return json.dumps(value, sort_keys=sorted_keys, separators=(',', ':'), ensure_ascii=False).encode()


def exact(first, second):
    # Compare values, never only hashes. Object member order is immaterial;
    # arrays, scalar representations, fields and values remain exact.
    return packed(first) == packed(second)


def loaded(relative):
    raw = (ROOT / relative).read_bytes()
    return json.loads(gzip.decompress(raw) if relative.endswith('.gz') else raw)


def input_proof(relative):
    raw = (ROOT / relative).read_bytes()
    return {'path': relative, 'sha256': sha(raw), 'bytes': len(raw)}


def main():
    fixture, campaign, trace = loaded(FIXTURE), loaded(CAMPAIGN), loaded(TRACE)
    original = fixture
    left, right = original['packets'], trace['packets']
    assert len(left) == len(right) == len(campaign['actions']) + 1
    assert campaign['status'] == original['status'] == trace['status'] == 'passed'
    assert campaign['referenceCommit'] == fixture['sourceCommit']
    assert trace['sourceDigest'] == campaign['source']['digest']
    assert campaign['sourceUnchangedDuringRun'] is True
    assert original['sessionCount'] == campaign['final']['sessions'] == 1
    assert original['manualPrimingActions'] == 0 and not campaign['pythonAgentModules']
    assert original['targetLevels'] == campaign['targetLevels'] == 3
    manifest = loaded(f'reference/v6/{fixture["sourceCommit"]}/manifest.json')
    for relative, expected in fixture['sourceHashes'].items():
        assert manifest['files'][relative]['sha256'] == expected
        assert sha((ROOT / f'reference/v6/{fixture["sourceCommit"]}/source' / relative).read_bytes()) == expected
    assert sha((ROOT / fixture['generator']).read_bytes()) == fixture['generatorSha256']
    for relative, expected in campaign['source']['files'].items():
        assert sha((ROOT / relative).read_bytes()) == expected, relative
    assert exact(fixture['gameAssetHashes'], campaign['gameAssets'])
    for relative, expected in campaign['gameAssets'].items():
        assert sha((ROOT / 'public/python' / relative).read_bytes()) == expected
    fields = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
    checkpoints = []
    for index, (first, second) in enumerate(zip(left, right)):
        original_packet, native_packet = first['packet'], second['packet']
        assert set(original_packet) == set(native_packet) == set(fields)
        command_equal = exact(first['command'], second['command'])
        matched_fields = {field: exact(original_packet[field], native_packet[field]) for field in fields}
        packet_equal = exact(original_packet, native_packet)
        assert command_equal and packet_equal and all(matched_fields.values()), index
        # Campaign hashes use JSON.stringify insertion order. Check that
        # serialization separately from the canonical structural comparison.
        campaign_packet_hash = sha(packed(native_packet, sorted_keys=False))
        if index == 0:
            assert first['command'] is None and campaign_packet_hash == campaign['initial']['publicPacketSha256']
            for source, target in [('state', 'state'), ('level', 'level'), ('levels_completed', 'levelsCompleted')]:
                assert exact(native_packet[source], campaign['initial'][target])
        else:
            action = campaign['actions'][index - 1]
            assert action['sequence'] == index
            assert exact(action['command'], second['command'])
            assert action['publicPacketSha256'] == campaign_packet_hash
            assert action['frameHash'] == native_packet['frame_hash']
            assert action['animationFrames'] == len(native_packet['frame_packet'])
            for source, target in [('level', 'levelAfter'), ('levels_completed', 'completedAfter'), ('state', 'state')]:
                assert exact(native_packet[source], action[target])
            assert action['levelBefore'] == right[index - 1]['packet']['level']
            assert action['completedBefore'] == right[index - 1]['packet']['levels_completed']
        checkpoints.append({
            'actionIndex': index, 'command': second['command'], 'commandExact': command_equal,
            'fieldsExact': matched_fields, 'completePublicPacketExact': packet_equal,
            'originalStructuralSha256': sha(packed(original_packet)), 'nativeStructuralSha256': sha(packed(native_packet)),
            'nativeCampaignPacketSha256': campaign_packet_hash,
            'animationFrames': len(native_packet['frame_packet']),
            'level': native_packet['level'], 'levelsCompleted': native_packet['levels_completed'],
            'publicState': native_packet['state'],
            'originalAvailableActions': original_packet['available_action_refs'],
            'nativeAvailableActions': native_packet['available_action_refs'],
        })
    observed_boundaries = [
        {'levelsCompleted': right[index]['packet']['levels_completed'], 'actions': index,
         'levelActions': index - max([0] + [prior for prior in range(1, index)
             if right[prior]['packet']['levels_completed'] > right[prior - 1]['packet']['levels_completed']])}
        for index in range(1, len(right))
        if right[index]['packet']['levels_completed'] > right[index - 1]['packet']['levels_completed']
    ]
    native_boundaries = [{'levelsCompleted': item['levelsCompleted'], 'actions': item['totalActions'], 'levelActions': item['levelActions']} for item in campaign['boundaries']]
    assert exact(original['boundaries'], native_boundaries) and exact(native_boundaries, observed_boundaries)
    source_prefix_lengths = [len(item['steps']) for item in original['prefixes']]
    native_prefix_lengths = [item['acquiredActions'] for item in campaign['prefixes']]
    assert exact(source_prefix_lengths, native_prefix_lengths)
    assert exact([step['command'] for prefix in original['prefixes'] for step in prefix['steps']], [item['command'] for item in right[1:]])
    assert all(item['proposal']['kind'] == 'factor_product_experiment' for item in original['prefixes'])
    assert all(item['proposalKind'] == 'factor_product_experiment' and item['fieldSubquestion'] == 'product_panel_composition' for item in campaign['prefixes'])
    assert sum(source_prefix_lengths) == original['actions'] == campaign['final']['actions']
    final = right[-1]['packet']
    assert final['levels_completed'] == original['levelsCompleted'] == campaign['final']['levelsCompleted'] == 3
    assert final['state'] == original['state'] == campaign['final']['state'] == 'NOT_FINISHED'
    assert final['level'] == campaign['final']['level'] == 4
    output = {
        'schema': 'logos-engine.v43.original-product-component-comparison.v1',
        'status': 'passed_exact_public_trajectory',
        'inputs': {'originalComponentFixture': input_proof(FIXTURE), 'nativeCampaign': input_proof(CAMPAIGN), 'nativePublicTrace': input_proof(TRACE)},
        'generator': input_proof(str(Path(__file__).relative_to(ROOT))),
        'comparisonMethod': {
            'commands': 'Exact command JSON structure including action_ref and complete data; cross-checked against every campaign action. No substitution or command normalization.',
            'exactPublicFields': fields,
            'pixelAndAnimationPolicy': 'Every pixel value, row width, image height, animation length and frame ordering is compared exactly. No raster, animation, score or state normalization.',
            'objectKeyOrder': 'Only JSON object member order is immaterial. Arrays and scalar representations are retained. Equality is checked on complete canonical JSON values, not just hashes.',
            'publicActionDomain': 'Every saved available_action_refs array matches exactly, including order. No action-domain extension or projection is required.',
            'campaignPacketHashes': 'The native report JSON.stringify-style insertion-order packet hashes are separately reconstructed from the saved native trace and checked at every saved checkpoint.',
            'boundaries': 'Exact official completed-level/action projections, independently rederived from consecutive public score packets.',
            'prefixes': 'Exact executed action counts for every sealed prefix and the product-panel proposal kind. Full proposal metadata and retained caller states are outside this comparison.',
            'excludedSourceSuffix': None,
        },
        'sourceVerification': {
            'referenceCommit': fixture['sourceCommit'], 'sourceModified': False,
            'originalLoadedSourceFilesReverified': len(fixture['sourceHashes']),
            'originalGeneratorSha256Verified': fixture['generatorSha256'],
            'nativeSourceFilesReverified': len(campaign['source']['files']), 'nativeSourceDigest': campaign['source']['digest'],
            'nativeSourceUnchangedDuringRun': campaign['sourceUnchangedDuringRun'],
            'identicalOpaqueHostAssetHashes': campaign['gameAssets'],
        },
        'summary': {
            'actionsCompared': len(right) - 1, 'completePublicPacketsCompared': len(right),
            'animationFramesCompared': sum(len(item['packet']['frame_packet']) for item in right),
            'commandsExact': True, 'imagesExact': True, 'completeAnimationsExact': True,
            'availableActionDomainsExact': True, 'officialBoundariesExact': True, 'executedPrefixLengthsExact': True,
            'boundaries': native_boundaries, 'actionsPerLevel': [item['levelActions'] for item in campaign['boundaries']],
            'sealedPrefixes': len(native_prefix_lengths), 'prefixActionCounts': native_prefix_lengths,
            'levelsCompleted': 3, 'finalLevel': 4, 'finalState': final['state'],
        },
        'qualification': {
            'referenceScope': original['scope'],
            'nativeScope': 'Fresh native common caller with original product-panel transfer and explicitly recorded native coordination extensions.',
            'fullOriginalCallerParity': False,
            'reason': 'The reference run exercises the isolated original product-panel component. Matching its public trajectory does not compare full original cross-family caller selection or its retained state.',
            'newAgentOrGameRunDuringComparison': False, 'savedEvidenceOnly': True,
            'originalManualPrimingActions': original['manualPrimingActions'], 'originalSessions': original['sessionCount'],
            'nativeSessions': campaign['final']['sessions'], 'nativePythonAgentModules': campaign['pythonAgentModules'],
            'hiddenStateOrGameSourceRead': False, 'fullRetainedMemoryCompared': False,
            'fullProposalsCompared': False, 'identicalBudgetsClaimed': False, 'performanceComparisonClaimed': False,
            'completeGameWinClaimed': False,
        },
        'checkpoints': checkpoints,
    }
    (ROOT / OUTPUT).write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': OUTPUT, 'status': output['status'], **output['summary']}, indent=2))


if __name__ == '__main__':
    main()
