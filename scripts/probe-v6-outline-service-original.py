#!/usr/bin/env python3
"""Read-only original OutlineService study on retained public observations.

This program never opens a game host or dispatches an action. It measures the
initial public corpus and passively acquires already retained public returns.
Original Python, V5 helpers, DRM and SRC remain unchanged and byte-verified.
"""
from __future__ import annotations

import argparse
from collections import Counter
from collections.abc import Mapping
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
SOURCE_PREFIX = str(SOURCE) + '/'
# Reading an unmanifested preexisting .pyc would not establish execution of the
# verified source bytes. Redirect cache lookups to an empty disposable directory
# and disable writes; do not remove or alter any cache in the source checkout.
BYTECODE_LOOKUP = tempfile.TemporaryDirectory(prefix='outline-source-bytecode-lookup-')
sys.pycache_prefix = BYTECODE_LOOKUP.name
INITIAL = 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
SOURCE_READS = set()
EXECUTED = Counter()
PROFILE_CODES = {}
AUDIT_ACTIVE = False


def hashed(data):
    return hashlib.sha256(data).hexdigest()


def verify_source_manifest():
    entries = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
    result = {}
    for relative, item in sorted(entries.items()):
        actual = hashed((SOURCE / relative).read_bytes())
        assert actual == item['sha256'], relative
        result[relative] = actual
    return result


VERIFIED_SOURCE = verify_source_manifest()


def audit(event, arguments):
    if AUDIT_ACTIVE and event == 'open' and arguments and isinstance(arguments[0], str):
        path = Path(arguments[0])
        if path.is_absolute() and path.is_relative_to(SOURCE) and path.is_file():
            SOURCE_READS.add(path.relative_to(SOURCE).as_posix())


sys.addaudithook(audit)
AUDIT_ACTIVE = True
sys.path.insert(0, str(SOURCE))
from agents.yf_arc3_v6.morphology_policy.outline_service import family as source_family
from agents.yf_arc3_v6.morphology_policy.outline_service.family import OutlineService, boxes, same_box, digest
from agents.yf_arc3_v6.morphology_policy.outline_service.policy import OutlinePolicy
from agents.yf_arc3_v5.capabilities import BoundingBox, ComponentDescription, ComponentExtractionInput, FrameGrid, InteractionProbeInput, detect_components
from agents.yf_arc3_v5.capabilities.interaction import _compatible_control_zone_cell_routes, _compact_body_perimeter_marker_accompaniment
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, canonical_json


def plain(value):
    if hasattr(value, 'model_dump'):
        return plain(value.model_dump())
    if isinstance(value, Mapping):
        return {str(key): plain(child) for key, child in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(child) for child in value]
    if isinstance(value, (set, frozenset)):
        return [plain(child) for child in sorted(value)]
    if isinstance(value, SimpleNamespace):
        return plain(vars(value))
    return value


def source_profile(frame, event, arg):
    if event != 'call':
        return
    code = frame.f_code
    key = PROFILE_CODES.get(code)
    if key is None:
        filename = code.co_filename
        key = (filename[len(SOURCE_PREFIX):], code.co_firstlineno, code.co_qualname) if filename.startswith(SOURCE_PREFIX) else False
        PROFILE_CODES[code] = key
    if key is not False:
        EXECUTED[key] += 1


def source_footprint():
    imported = {}
    for module in list(sys.modules.values()):
        filename = getattr(module, '__file__', None)
        if not filename:
            continue
        path = Path(filename).resolve()
        if path.is_relative_to(SOURCE) and path.is_file():
            relative = path.relative_to(SOURCE).as_posix()
            imported[relative] = hashed(path.read_bytes())
    assert all(name in VERIFIED_SOURCE for name in SOURCE_READS), sorted(set(SOURCE_READS) - set(VERIFIED_SOURCE))
    accessed = {name: VERIFIED_SOURCE[name] for name in sorted(SOURCE_READS)}
    for name, value in imported.items():
        assert VERIFIED_SOURCE[name] == value, name
    return {'importedSourceFiles': dict(sorted(imported.items())), 'accessedSourceFiles': accessed,
            'executedSourceFunctions': [{'path': path, 'line': line, 'function': name, 'calls': count}
                                        for (path, line, name), count in sorted(EXECUTED.items())],
            'qualification': 'Imports, actually opened source files and observed Python call sites are distinct inventories. No imported package is thereby claimed to be wholly translated.'}


def proof(name):
    path = ROOT / name
    return {'path': name, 'sha256': hashed(path.read_bytes()), 'bytes': path.stat().st_size}


def read_json(name):
    path = ROOT / name
    if path.suffix == '.gz':
        with gzip.open(path, 'rt', encoding='utf-8') as stream:
            return json.load(stream)
    return json.loads(path.read_text())


def write_gzip_absent(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    with path.open('xb') as output:
        with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
            compressed.write(data)


def observation(packet, revision, namespace, epoch=None):
    epoch = packet['levels_completed'] + 1 if epoch is None else epoch
    return {'observation_ref': f'{namespace}:epoch:{epoch}:revision:{revision}:frame:{packet["frame_hash"]}',
            'level_epoch': epoch, 'levels_completed': packet['levels_completed'], 'frame_hash': packet['frame_hash'],
            'available_action_refs': packet['available_action_refs'], 'state': packet['state'], 'revision': revision}


def initial_study(family, empty):
    corpus = read_json(INITIAL)
    assert len(corpus['games']) == 100 and corpus['actions'] == corpus['levelJumps'] == 0
    result = []
    for index, item in enumerate(corpus['games']):
        family.restore(empty)
        rows, obs = item['packet']['frame_rows'], item['observation']
        contours = boxes(rows)
        counts = Counter(box['signature'] for box in contours)
        available_directions = sorted(set(obs['available_action_refs']) & set(family.config['interface_prior']['directions']))
        proposal = family.propose(obs, rows, [], 16)
        assert proposal is None and family.control is None
        result.append({'index': index, 'game': item['game'], 'observation_ref': obs['observation_ref'],
                       'frameHash': obs['frame_hash'], 'boxes': plain(contours), 'coldProposal': None,
                       'availableDeclaredDirections': available_directions,
                       'uniqueSignatures': [key for key, count in counts.items() if count == 1],
                       'state': plain(family.state())})
    return result


def retained_trace_study(family, empty):
    # All inputs are existing public traces. Duplicate historical attempts stay
    # separate; no checkpoint or later result seeds any provider state.
    traces = sorted((ROOT / 'docs/migration').glob('native-campaigns-v*/**/*public-trace.json.gz'))
    result = []
    for path in traces:
        value = read_json(path.relative_to(ROOT).as_posix())
        if 'packets' not in value or not value['packets']:
            continue
        family.restore(empty)
        namespace = 'outline-passive:' + path.parent.name + ':' + path.stem
        observed = [observation(item['packet'], index + 1, namespace) for index, item in enumerate(value['packets'])]
        changes, eligible_events = [], []
        for index in range(1, len(value['packets'])):
            first, second = value['packets'][index - 1], value['packets'][index]
            before = plain(family.state())
            acquired = family.record(observed[index - 1], observed[index], second['command'],
                                     first['packet']['frame_rows'], second['packet']['frame_rows'])
            after = plain(family.state())
            if before['tracks'] != after['tracks'] or before['control'] != after['control'] or acquired is not None:
                changes.append({'actionIndex': index, 'command': second['command'], 'acquired': plain(acquired),
                                'beforeState': before, 'afterState': after})
            if after['control'] is not None:
                measured = family.measure(observed[index], second['packet']['frame_rows'])
                proposal = family.propose(observed[index], second['packet']['frame_rows'], [], 16)
                eligible_events.append({'actionIndex': index, 'control': after['control'],
                                        'measurement': plain(measured), 'proposal': plain(proposal)})
        result.append({'input': proof(path.relative_to(ROOT).as_posix()), 'game': value.get('game'),
                       'publicPackets': len(value['packets']), 'passiveTransitions': len(value['packets']) - 1,
                       'sourceControlAcquired': bool(eligible_events), 'trackChanges': changes,
                       'eligibleEvents': eligible_events, 'finalState': plain(family.state())})
    return result


def main():
    global AUDIT_ACTIVE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='docs/migration/native-campaigns-v53/source-reference-public-study.json.gz')
    args = parser.parse_args()
    assert not (ROOT / args.output).exists(), 'Refusing overwrite'
    sys.setprofile(source_profile)
    family = OutlineService()
    empty = plain(family.state())
    initial = initial_study(family, empty)
    retained = retained_trace_study(family, empty)
    sys.setprofile(None)
    AUDIT_ACTIVE = False
    assert verify_source_manifest() == VERIFIED_SOURCE
    footprint = source_footprint()
    result = {'schema': 'logos-engine.v53.outline-source-public-study.v1', 'sourceCommit': COMMIT,
              'sourceFilesVerifiedBeforeImport': len(VERIFIED_SOURCE), 'sourceFilesVerifiedAfterStudy': len(VERIFIED_SOURCE),
              'sourceUnchanged': True, 'initialCorpus': proof(INITIAL), 'initial': initial, 'retainedTraces': retained,
              'sourceBytecodeCachesRead': False, 'sourceBytecodeCachesWritten': False,
              'summary': {'initialViews': len(initial), 'viewsWithOutlines': sum(bool(row['boxes']) for row in initial),
                          'coldAdmissibleProposals': 0, 'retainedTraces': len(retained),
                          'passiveTransitions': sum(row['passiveTransitions'] for row in retained),
                          'tracesWithAcquiredControl': sum(row['sourceControlAcquired'] for row in retained)},
              'footprint': footprint, 'generator': proof(Path(__file__).relative_to(ROOT).as_posix()),
              'scope': {'newHostSessions': 0, 'newDispatchedActions': 0, 'newCompletedLevels': 0,
                        'nativeExecution': False, 'sourceFunctionsReplaced': False,
                        'retainedResultsUsedAsColdMemory': False},
              'qualification': 'Passive original component study only. Retained actions were not selected by this provider; resulting hypothetical proposals were never dispatched. No new game success or full original caller parity is established.'}
    write_gzip_absent(args.output, result)
    print(json.dumps({'status': 'passed', 'output': args.output, **result['summary'],
                      'importedSourceModules': len(footprint['importedSourceFiles']),
                      'accessedSourceFiles': len(footprint['accessedSourceFiles'])}), flush=True)


if __name__ == '__main__':
    main()
