#!/usr/bin/env python3
"""Add only the four unchanged original Source81 compiled workflows."""
from pathlib import Path
import hashlib
import json
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
manifest = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from agents.yf_arc3_v6.morphology_policy.reactive_contact.source81_policy import Source81Policy

def main():
    for name, row in manifest.items():
        assert hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() == row['sha256'], name
    policy = Source81Policy()
    path = ROOT / 'src/logos-engine/v6/programs.json'
    original = json.loads(path.read_text())
    updated = json.loads(path.read_text())
    entries = {}
    for attr in ['prepare_src', 'project_src', 'continue_src', 'revision_src']:
        program = getattr(policy, attr)
        entries[program.workflow_id] = {'entry': program.workflow_id,
            'module': program.module.model_dump(mode='json'),
            'transitiveSourceHash': program.entry.transitive_source_hash}
    assert len(entries) == 4
    for name, value in entries.items():
        assert name not in updated['programs'] or updated['programs'][name] == value
        updated['programs'][name] = value
    assert all(updated[k] == v for k, v in original.items() if k != 'programs')
    assert all(updated['programs'][k] == v for k, v in original['programs'].items())
    path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'added': sorted(entries), 'preservedPriorPrograms': len(original['programs']),
        'referenceCommit': COMMIT, 'moduleHash': policy.prepare_src.module.semantic_hash,
        'policyAttestations': policy.prepare_src.module.model_dump(mode='json')['authority_attestations']}))

if __name__ == '__main__':
    main()
