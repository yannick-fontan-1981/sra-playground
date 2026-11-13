#!/usr/bin/env python3
"""Use the unchanged historical regression driver with streaming report output.

The original case admission, execution, seventeen comparisons and summary are
executed directly. Only REPLAY is replaced; the input inventory is extended to
bind this adapter, the writer, its serializer and the historical replay source.
The 1536 MiB Node heap setting remains explicit and is required, not increased.
"""
from __future__ import annotations

import hashlib
import importlib.util
import os
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[4]
SELF = Path(__file__).resolve()
PINS = {
    'scripts/run-recorded-public-regressions.py': 'df19dc88ff29e78a1cb5935d445644e96cc9fb1ef90b73d802cf51868d2b2c40',
    'scripts/compare-v54-regressions.py': 'f13fee083fda44ff4bd71ac46bc01cdce99eaccf9d6c691a2df7040e698b36c0',
    'scripts/replay-v53-public-regression.mjs': '4359e008db8dadaac17f6504199ff20c752f40f1666ba527f1cd5f16df100a9e',
    'docs/migration/lot10b-evidence/stream-evidence-json.mjs': '96ac2ddbaac8cc62126f6674301b2362301895f44ce90e5dbd1dec9fb6fc87ca',
}


def verify_pins():
    for relative, expected in PINS.items():
        actual = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError('Historical dependency changed: ' + relative)


def load_runner():
    verify_pins()
    source = ROOT / 'scripts/run-recorded-public-regressions.py'
    spec = importlib.util.spec_from_file_location('lot8a_original_recorded_regressions', source)
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    runner.REPLAY = 'docs/migration/lot8a-evidence/tools/replay-recorded-public-streaming.mjs'
    original_inventory = runner.execution_inputs

    def extended_inventory(manifest_path, source_manifest_path):
        inventory = original_inventory(manifest_path, source_manifest_path)
        extra = [SELF,
                 ROOT / 'docs/migration/lot8a-evidence/tools/write-streamed-evidence-gzip.mjs',
                 ROOT / 'docs/migration/lot10b-evidence/stream-evidence-json.mjs',
                 ROOT / 'scripts/replay-v53-public-regression.mjs']
        for path in extra:
            inventory[path.relative_to(ROOT).as_posix()] = runner.PROOF.sha(path)
        return inventory

    runner.execution_inputs = extended_inventory
    return runner


def main():
    if os.environ.get('NODE_OPTIONS') != '--max-old-space-size=1536':
        raise ValueError('Declare NODE_OPTIONS=--max-old-space-size=1536 for this unchanged-heap attempt')
    runner = load_runner()
    try:
        runner.main()
    finally:
        verify_pins()


if __name__ == '__main__':
    main()
