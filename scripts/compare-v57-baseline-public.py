#!/usr/bin/env python3
"""Compare two completed cold campaigns, including every public animation frame."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import gzip
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'scripts/compare-v54-reactive-public-evidence.py'
spec = importlib.util.spec_from_file_location('v57_baseline_contracts', HELPER)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)


def campaign(directory, stem):
    files = {name: directory / filename for name, filename in [
        ('campaign', stem + '-campaign.json.gz'), ('trace', stem + '-public-trace.json.gz'),
        ('execution', 'execution-' + stem + '.json')]}
    value, trace, execution = [shared.load(files[name]) for name in ['campaign', 'trace', 'execution']]
    assert value['status'] == trace['status'] == 'passed'
    assert value['sourceUnchangedDuringRun'] and value['pythonAgentModules'] == []
    assert execution['nativeSourceUnchanged'] and execution['executionCodeUnchanged']
    shared.check(execution['report'], shared.proof(files['campaign']), 'execution.report.bytes')
    shared.check(execution['trace'], shared.proof(files['trace']), 'execution.trace.bytes')
    journal = ROOT / execution['publicJournal']['path']
    shared.check(execution['publicJournal'], shared.proof(journal), 'execution.journal.bytes')
    shared.check([json.loads(line) for line in gzip.decompress(journal.read_bytes()).splitlines()],
                 trace['packets'], 'complete.actual.public.journal')
    assert len(value['actions']) == value['final']['actions'] == len(trace['packets']) - 1
    assert value['final']['sessions'] == 1 and value['initial']['level'] == 1 and value['initial']['levelsCompleted'] == 0
    return value, trace, {name: shared.proof(path) for name, path in files.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('game')
    parser.add_argument('baseline', type=Path)
    parser.add_argument('final', type=Path)
    args = parser.parse_args()
    baseline, final = args.baseline.resolve(), args.final.resolve()
    stem = args.game.lower()
    output = final / (stem + '-baseline-public-comparison.json')
    if output.exists():
        raise FileExistsError(output)
    old, old_trace, old_inputs = campaign(baseline, stem)
    new, new_trace, new_inputs = campaign(final, stem)
    assert old['game'] == new['game'] == args.game
    assert len(old_trace['packets']) == len(new_trace['packets'])
    packets = []
    for index, (first, second) in enumerate(zip(old_trace['packets'], new_trace['packets'])):
        shared.check(first, second, 'complete.public.packet.' + str(index))
        packets.append({'index': index, 'completePacketSha256': shared.digest(first),
                        'frameSha256': shared.digest(first['packet']['frame_rows']),
                        'animationSha256': shared.digest(first['packet']['frame_packet']),
                        'animationFrames': len(first['packet']['frame_packet']),
                        'command': first['command'], 'level': first['packet']['level'],
                        'levelsCompleted': first['packet']['levels_completed'], 'state': first['packet']['state']})
    keys = ['decisionRevision', 'acquiredActions', 'family', 'proposalKind', 'selectionGroup', 'materialSubquestion']
    prefix = lambda value: [{key: item.get(key) for key in keys} for item in value['prefixes']]
    shared.check(prefix(old), prefix(new), 'prefix.public.selection')
    final_keys = ['actions', 'levelsCompleted', 'level', 'state', 'status', 'reason', 'prefixes', 'sessions', 'operationCounts']
    shared.check({key: old['final'][key] for key in final_keys},
                 {key: new['final'][key] for key in final_keys}, 'completion.protocol')
    result = {'schema': 'logos-engine.v57.baseline-final-complete-public-comparison.v1',
              'status': 'passed', 'game': args.game, 'generatedAt': datetime.now(timezone.utc).isoformat(),
              'generator': shared.proof(Path(__file__)), 'sharedEvidenceContracts': shared.proof(HELPER),
              'inputs': {'baseline': old_inputs, 'final': new_inputs},
              'nativeSourceDigests': {'baseline': old['source']['digest'], 'final': new['source']['digest']},
              'nativeImplementations': {'baseline': old['final']['nativeImplementation'], 'final': new['final']['nativeImplementation']},
              'completePublicJournalsMatchedRespectiveReceipts': True,
              'completePublicTrajectoryExactlyEqual': True, 'prefixSelectionsExactlyEqual': True,
              'publicPackets': len(packets), 'animationFramesIncludingInitial': sum(p['animationFrames'] for p in packets),
              'physicalActions': len(new['actions']), 'prefixes': len(new['prefixes']), 'packetChecks': packets,
              'levelActions': [b['levelActions'] for b in new['boundaries']],
              'actionFamilies': dict(Counter(a['family'] for a in new['actions'])),
              'prefixSelections': prefix(new), 'baselineFinal': old['final'], 'frozenV57Final': new['final'],
              'qualification': 'Two independently executed cold common sessions have byte-equivalent canonical public values for every dispatched command, returned pixel, animation frame, level count and state. Actual receipts and complete passive journals are checked independently. Time, session namespace, graph identities and native implementation metadata are not equated. The final first-three-level success already existed on unchanged V56; it is not evidence that newly added V57 entries caused that success. No action or public packet from the baseline was supplied to the final live campaign.'}
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: result[key] for key in ['status', 'publicPackets', 'animationFramesIncludingInitial', 'physicalActions', 'prefixes', 'levelActions']}))


if __name__ == '__main__':
    main()
