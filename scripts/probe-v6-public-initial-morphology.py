#!/usr/bin/env python3
"""Measure unchanged source predicates on opaque public initial screens only."""
from __future__ import annotations
import gzip
import json
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import zipfile

sys.dont_write_bytecode = True
from importlib.util import module_from_spec, spec_from_file_location
spec = spec_from_file_location('reduction_probe', Path(__file__).with_name('probe-v6-reduction-transport-original.py'))
helper = module_from_spec(spec)
spec.loader.exec_module(helper)
from common_reduction_transport import layout
from trace_field_observation import measure as trace_measure


def main():
    catalog = (helper.ROOT / 'src/games/catalog.ts').read_text()
    records = json.JSONDecoder().raw_decode(catalog[catalog.index('= [', catalog.index('const records:')) + 2:])[0]
    result = {'schema': 'logos-engine.v6.initial-public-morphology.v1', 'sourceCommit': helper.COMMIT,
              'scope': 'Read-only public initial screen discovery. No dispatched action, hidden state, authored path or game code is inspected.',
              'actions': 0, 'sourceHashes': helper.source_hashes(), 'games': []}
    with tempfile.TemporaryDirectory(prefix='initial-public-morphology-') as temporary:
        host = Path(temporary)
        for name in ('custom-games.zip', 'official-games.zip'):
            with zipfile.ZipFile(helper.ROOT / 'public/python' / name) as archive: archive.extractall(host)
        for name in ('game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py'):
            shutil.copy(helper.ROOT / 'public/python' / name, host / name)
        sys.path.insert(0, temporary)
        import game_bridge
        for entry in records:
            if entry['code'] in {'MEMO', 'TICT', 'HANO', 'ELAS', 'TU93', 'STCK', 'PIPE', 'COMB', 'THER', 'CATL'}: continue
            raw = json.loads(game_bridge.dispatch(json.dumps({'type': 'load', 'code': entry['code'], 'level': 1})))
            if 'error' in raw:
                result['games'].append({'game': entry['code'], 'loadError': raw['error']}); continue
            packet = helper.packet(raw, 0)
            observation, _ = helper.measure(SimpleNamespace(**packet), 1, 'initial-morphology-reference')
            reduction = layout(observation, packet['frame_rows'])
            trace = trace_measure(packet['frame_rows'])
            matched = {'game': entry['code'], 'reduction': reduction, 'trace': trace}
            if reduction or trace:
                matched.update(packet=packet, observation=observation)
                print(json.dumps({'game': entry['code'], 'reduction': bool(reduction), 'trace': bool(trace)}), flush=True)
            result['games'].append(matched)
    result['sourceHashes'] = helper.source_hashes()
    result['generatorSha256'] = helper.hashed(Path(__file__).read_bytes())
    target = helper.ROOT / 'tests/fixtures/v6-next-transfer-initial-public.json.gz'
    if target.exists(): raise FileExistsError(target)
    target.write_bytes(gzip.compress(json.dumps(result, sort_keys=True, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'output': str(target.relative_to(helper.ROOT)), 'screens': len(result['games']),
                      'matches': [{k: v for k, v in x.items() if k in ('game', 'reduction', 'trace')}
                                  for x in result['games'] if x.get('reduction') or x.get('trace')]}), flush=True)


if __name__ == '__main__': main()
