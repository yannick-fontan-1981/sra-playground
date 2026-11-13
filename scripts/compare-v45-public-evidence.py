#!/usr/bin/env python3
"""Compare saved public evidence only. Never execute a solver or game here."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/migration/native-campaigns-v45'


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def load(path):
    raw = path.read_bytes()
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)
def proof(path): return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path), 'bytes': path.stat().st_size}
def packed(value): return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
def exact(a, b): return packed(a) == packed(b)
def packet_hash(packet): return hashlib.sha256(json.dumps(packet, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def native_trace(game, name):
    campaign_path = OUT / name; trace_path = OUT / f'{game.lower()}-public-trace.json.gz'
    campaign, trace = load(campaign_path), load(trace_path)
    source = load(OUT / 'source-manifest.json')
    assert campaign['status'] == trace['status'] == 'passed'
    assert campaign['game'] == trace['game'] == game
    assert campaign['source'] == source and campaign['sourceUnchangedDuringRun']
    assert trace['sourceDigest'] == source['digest'] and not campaign['pythonAgentModules']
    assert campaign['final']['sessions'] == 1 and not campaign['final']['fullV6Parity']
    assert campaign['final']['nativeImplementation'] == 'logos-engine.typescript.v6.native-migration/0.15.0'
    assert len(trace['packets']) == len(campaign['actions']) + 1
    assert packet_hash(trace['packets'][0]['packet']) == campaign['initial']['publicPacketSha256']
    for index, item in enumerate(trace['packets'][1:]):
        action = campaign['actions'][index]
        assert exact(item['command'], action['command']) and packet_hash(item['packet']) == action['publicPacketSha256']
        assert len(item['packet']['frame_packet']) == action['animationFrames']
        assert item['packet']['level'] == action['levelAfter'] and item['packet']['levels_completed'] == action['completedAfter']
    for path, expected in source['files'].items(): assert sha(ROOT / path) == expected, path
    return campaign, trace, campaign_path, trace_path


def compare_reduction():
    campaign, trace, campaign_path, trace_path = native_trace('LF52', 'lf52-three-levels.json')
    fixture_path = ROOT / 'tests/fixtures/v6-reduction-transport-lf52-original-public.json.gz'
    original = load(fixture_path)
    assert original['status'] == 'passed' and original['sourceModified'] is False
    assert original['manualPrimingActions'] == 0 and original['sessionCount'] == 1
    assert original['targetLevels'] == campaign['targetLevels'] == original['levelsCompleted'] == 3
    assert original['actions'] == 102 and campaign['final']['actions'] == 104
    assert len(original['packets']) == 103 and len(trace['packets']) == 105
    assert exact(original['gameAssetHashes'], campaign['gameAssets'])
    reference = ROOT / 'reference/v6' / original['sourceCommit']
    manifest = load(reference / 'manifest.json')['files']
    for path, expected in original['sourceHashes'].items():
        assert manifest[path]['sha256'] == expected and sha(reference / 'source' / path) == expected
    assert sha(ROOT / original['generator']) == original['generatorSha256']
    fields = ['frame_rows', 'frame_packet', 'level', 'levels_completed', 'state', 'step_index', 'available_action_refs', 'frame_hash']
    # The common caller makes two additional observed-effect inquiries. Keep
    # both in the complete native trace; do not call the trajectories equal.
    extra = []
    for prefix in campaign['prefixes']:
        if prefix['family'] == 'reduction_transport': continue
        assert prefix['family'] == 'pre_score_contact' and prefix['proposalKind'] == 'observed_effect_access'
        assert prefix['acquiredActions'] == 1
        extra.append(prefix['decisionRevision'])
    assert extra == [72, 78]
    aligned = [(i, item) for i, item in enumerate(trace['packets']) if i not in extra]
    assert len(aligned) == len(original['packets'])
    exact_commands = normalized_commands = 0
    checkpoints = []; packet_differences = []
    for index, (left, (native_index, right)) in enumerate(zip(original['packets'], aligned)):
        assert set(left['packet']) == set(right['packet']) == set(fields)
        differences = [key for key in fields if not exact(left['packet'][key], right['packet'][key])]
        if index <= 71: assert not differences and native_index == index
        if differences: packet_differences.append({'sourceIndex': index, 'nativeIndex': native_index, 'differentFields': differences})
        if exact(left['command'], right['command']):
            if index: exact_commands += 1
            command_mode = 'exact'
        else:
            # The browser transport adds an empty payload to a nonpoint action.
            # This is the sole allowed normalization, explicitly counted below.
            a, b = left['command'], right['command']
            assert set(a) == {'action_ref'} and a['action_ref'] != 'ACTION6'
            assert set(b) == {'action_ref', 'data'} and b['action_ref'] == a['action_ref'] and b['data'] == {}
            normalized_commands += 1; command_mode = 'absent_nonpoint_payload_to_empty_object'
        checkpoints.append({'sourceIndex': index, 'nativeIndex': native_index, 'completePublicPacketExact': not differences,
                            'differentFields': differences, 'commandComparison': command_mode,
                            'nativePublicPacketSha256': packet_hash(right['packet']), 'animationFrames': len(right['packet']['frame_packet'])})
    assert exact_commands == 42 and normalized_commands == 60
    reduction_prefixes = [p for p in campaign['prefixes'] if p['family'] == 'reduction_transport']
    assert [len(prefix['steps']) for prefix in original['prefixes']] == [prefix['acquiredActions'] for prefix in reduction_prefixes]
    assert len(reduction_prefixes) == 69 and len(campaign['prefixes']) == 71
    assert [b['levelActions'] for b in original['boundaries']] == [8, 40, 54]
    assert [b['levelActions'] for b in campaign['boundaries']] == [8, 40, 56]
    assert campaign['final']['state'] == 'NOT_FINISHED' and campaign['final']['levelsCompleted'] == 3
    animations = sum(len(item['packet']['frame_packet']) for item in trace['packets']); assert animations == 502
    assert len(packet_differences) == 31 and any('frame_rows' in d['differentFields'] for d in packet_differences)
    extras = [{'nativeIndex': i, 'command': trace['packets'][i]['command'],
               'publicPacketSha256': packet_hash(trace['packets'][i]['packet']),
               'animationFrames': len(trace['packets'][i]['packet']['frame_packet']),
               'returnedPixelsChanged': trace['packets'][i]['packet']['frame_rows'] != trace['packets'][i - 1]['packet']['frame_rows']}
              for i in extra]
    result = {'schema': 'logos-engine.v45.reduction-public-component-comparison.v1', 'status': 'passed',
              'comparisonConclusion': 'shared_prefix_with_explicit_caller_divergence', 'completeTrajectoryEquivalent': False,
              'inputs': {'sourceComponent': proof(fixture_path), 'nativeCampaign': proof(campaign_path), 'nativeTrace': proof(trace_path)},
              'generator': proof(Path(__file__)), 'nativeSourceDigest': campaign['source']['digest'],
              'summary': {'nativeCommands': 104, 'sourceComponentCommands': 102, 'nativeCompletePublicPackets': 105,
                          'nativeAnimationFramesIncludingInitial': animations, 'nativePrefixes': 71, 'reductionPrefixes': 69, 'boundaries': 3,
                          'sharedPrefixCommands': 71, 'sharedPrefixCompletePublicPackets': 72,
                          'alignedReductionCommands': 102, 'alignedRawExactCommands': exact_commands,
                          'alignedNormalizedNonpointEmptyPayloads': normalized_commands,
                          'differentAlignedPublicPackets': len(packet_differences), 'additionalCallerActions': 2},
              'sourceVerification': {'referenceCommit': original['sourceCommit'], 'sourceFiles': len(original['sourceHashes']), 'unchanged': True},
              'checkpoints': checkpoints, 'additionalCallerActions': extras, 'differentAlignedPackets': packet_differences,
              'qualification': 'The first 71 commands and 72 complete public packets match, with absent nonpoint data normalized to an empty object. The full native campaign has two additional real caller inquiries at actions 72 and 78, whose returned pixels change. Its 102 reduction-owned commands still match the isolated source command stream under that normalization, but 31 later aligned complete packets differ, including public images. No suffix image, step-index or protocol-field normalization is used to assert equality. Both complete native and isolated-source traces are retained. Source budget is 120 actions/180 seconds per level; native budget is 600 actions/360 active seconds. This is bounded component evidence with an explicit caller divergence, not complete original common-caller parity, identical trajectories, identical budgets or a speed benchmark.'}
    (OUT / 'lf52-original-component-comparison.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'LF52': result['summary']}))


def compare_labeled_prefix():
    after, trace, after_path, trace_path = native_trace('CATL', 'catl-six-levels.json')
    before_path = ROOT / 'docs/migration/native-campaigns-v44/catl-five-levels.json'
    before_trace_path = ROOT / 'docs/migration/native-campaigns-v44/catl-public-trace.json.gz'
    before, old_trace = load(before_path), load(before_trace_path)
    assert before['status'] == 'passed' and before['final']['actions'] == 40
    assert after['targetLevels'] == 6 and after['final']['levelsCompleted'] == 6 and after['final']['state'] == 'WIN'
    assert after['final']['actions'] == 48
    assert exact(old_trace['packets'], trace['packets'][:41])
    assert exact(before['gameAssets'], after['gameAssets'])
    assert [b['levelActions'] for b in after['boundaries']] == [8] * 6
    omit = lambda value, keys: {k: v for k, v in value.items() if k not in keys}
    assert exact([omit(a, ['executionMs']) for a in before['actions']], [omit(a, ['executionMs']) for a in after['actions'][:40]])
    omitted = ['graphChain', 'graphRevision', 'sharedSeries', 'labeledSequenceNativeComposition']
    assert exact([omit(p, omitted) for p in before['prefixes']], [omit(p, omitted) for p in after['prefixes'][:40]])
    assert all(p['labeledSequenceNativeComposition'] is None for p in after['prefixes'][:40])
    extended = after['prefixes'][40:]
    assert len(extended) == 8 and all(p['acquiredActions'] == 1 and p['labeledSequenceAgreement'] for p in extended)
    receipts = [p['labeledSequenceNativeComposition'] for p in extended]
    assert all(r['complete'] and r['candidateRootCount'] == r['examinedRootCount'] == 6400 and r['retainedRootCount'] == 2 for r in receipts)
    assert [r['reused'] for r in receipts] == [False] + [True] * 7
    result = {'schema': 'logos-engine.v45.catl-public-prefix-comparison.v1', 'status': 'passed',
              'inputs': {'before': proof(before_path), 'beforeTrace': proof(before_trace_path), 'after': proof(after_path), 'afterTrace': proof(trace_path)},
              'generator': proof(Path(__file__)), 'nativeSourceDigest': after['source']['digest'],
              'preservedPrefix': {'levels': 5, 'commands': 40, 'completePublicPackets': 41, 'prefixes': 40,
                                  'animationFramesIncludingInitial': sum(len(p['packet']['frame_packet']) for p in old_trace['packets']),
                                  'exactFullPacketsAndCommands': True, 'nativeCompositionUsed': False},
              'newSuffix': {'level': 6, 'commands': 8, 'officialState': 'WIN', 'fitComputations': 1, 'fitReuses': 7, 'receipts': receipts},
              'qualification': 'The complete first-five-level public trajectory is unchanged. Native graph chains and shared digests are not compared. v44 stopped at target5; v45 continues to target6, so final target-boundary caller closure and request counts intentionally differ. The new suffix is an actual native game result and is not claimed as original caller behavior.'}
    (OUT / 'catl-v44-prefix-comparison.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'CATL': {'preservedActions': 40, 'newActions': 8, 'state': 'WIN'}}))


if __name__ == '__main__':
    compare_reduction()
    compare_labeled_prefix()
