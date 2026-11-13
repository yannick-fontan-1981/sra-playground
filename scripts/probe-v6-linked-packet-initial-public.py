#!/usr/bin/env python3
"""Measure unchanged linked-packet predicates on opaque initial public screens.

The complete initial public rasters are retained so discovery is reproducible.
There are no actions, level jumps, private state reads or game-source inspections.
"""
from __future__ import annotations

import gzip
import json
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import zipfile

sys.dont_write_bytecode = True
spec = spec_from_file_location('trace_probe', Path(__file__).with_name('probe-v6-trace-field-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from linked_support_observation import scene
from linked_packet_access import target_marker


def main():
    catalog = (helper.ROOT / 'src/games/catalog.ts').read_text()
    records = json.JSONDecoder().raw_decode(catalog[catalog.index('= [', catalog.index('const records:')) + 2:])[0]
    result = {
        'schema': 'logos-engine.v6.linked-packet-initial-public.v1',
        'sourceCommit': helper.COMMIT,
        'scope': 'Initial public observations only, with unchanged source scene and distinct-marker predicates. No dispatched actions, private state or game code inspection.',
        'actions': 0, 'levelJumps': 0, 'games': [],
        'pinnedSourceFilesVerifiedBeforeImport': len(helper.VERIFIED_PINNED_SOURCE),
    }
    with tempfile.TemporaryDirectory(prefix='linked-packet-initial-public-') as temporary:
        host = Path(temporary)
        for name in ('custom-games.zip', 'official-games.zip'):
            with zipfile.ZipFile(helper.ROOT / 'public/python' / name) as archive:
                archive.extractall(host)
        for name in ('game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py'):
            shutil.copy(helper.ROOT / 'public/python' / name, host / name)
        sys.path.insert(0, temporary)
        import game_bridge
        for entry in records:
            request = {'type': 'load', 'code': entry['code'], 'level': 1}
            raw = json.loads(game_bridge.dispatch(json.dumps(request)))
            if 'error' in raw:
                result['games'].append({'game': entry['code'], 'request': request, 'loadError': raw['error']})
                continue
            packet = helper.packet(raw, 0)
            observation, _ = helper.measure(SimpleNamespace(**packet), 1, 'linked-packet-initial-reference')
            measurement = scene(packet['frame_rows'])
            target = target_marker(packet['frame_rows'], measurement) if measurement else None
            result['games'].append({'game': entry['code'], 'request': request,
                                   'packet': packet, 'observation': observation,
                                   'scene': measurement, 'target': target})
            if measurement:
                print(json.dumps({'game': entry['code'], 'objects': len(measurement['objects']),
                                  'controls': len(measurement['controls']), 'target': bool(target)}), flush=True)
    assert helper.verify_source_manifest() == helper.VERIFIED_PINNED_SOURCE
    result.update(sourceModified=False, sourceHashes=helper.source_hashes(),
                  generator=str(Path(__file__).relative_to(helper.ROOT)),
                  generatorSha256=helper.hashed(Path(__file__).read_bytes()),
                  gameAssetHashes={name: helper.hashed((helper.ROOT / 'public/python' / name).read_bytes())
                                   for name in ('custom-games.zip', 'official-games.zip', 'game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py')})
    target = helper.ROOT / 'tests/fixtures/v6-linked-packet-initial-public.json.gz'
    if target.exists(): raise FileExistsError(target)
    target.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(target.relative_to(helper.ROOT)), 'screens': len(result['games']),
                      'matches': [x['game'] for x in result['games'] if x.get('scene') and x.get('target')]}), flush=True)


if __name__ == '__main__': main()
