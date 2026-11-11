#!/usr/bin/env python3
"""Prepare new owner-specific cost tools from the preserved 6A tools.

Only source text is written. No functional capture or cost measurement runs.
The empty SelectedRigid checkpoint contract is reviewed separately before use.
"""
from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
PARENT = ROOT / 'docs/migration/lot6a-evidence'
NAMES = ['capture-cost-owner-graphs.mjs', 'record-owner-source-inventory.mjs',
         'qualify-cost-owner-graphs.mjs', 'finalize-owner-cost-contract.py',
         'prepare-cost-protocol.py', 'check-cost-static-inputs.py',
         'consolidate-owner-costs.mjs', 'review-owner-costs.py',
         'record-cost-log-transport.py', 'write-cost-results.py', 'finalize-measured-cost.py']

def fp(path):
    raw = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

rows = []
for name in NAMES:
    source, target = PARENT / name, BASE / name
    text = source.read_text()
    for old, new in [('lot6a', 'lot6b'), ('lot6A', 'lot6B'),
                     ('PreviewPacking', 'SelectedRigid'), ('previewPacking', 'selectedRigid'),
                     ('preview_packing', 'selected_rigid'), ('v6-preview-packing', 'v6-selected-rigid')]:
        text = text.replace(old, new)
    text = re.sub(r'(?<![A-Za-z0-9_])6A(?![A-Za-z0-9_])', '6B', text)
    text = text.replace('v6-selected-rigid-calculus.ts', 'v6-selected-rigid-search.ts')
    text = text.replace('morphology_policy/selected_rigid/preview.drm', 'morphology_policy/strategy.drm')
    for parent_name in ['capture-cost-owner-graphs.mjs', 'record-owner-source-inventory.mjs', 'qualify-cost-owner-graphs.mjs']:
        text = text.replace('docs/migration/lot5b-evidence/' + parent_name, 'docs/migration/lot6a-evidence/' + parent_name)
    with target.open('x') as out:
        out.write(text)
    rows.append({'source': fp(source), 'initialAdaptation': fp(target)})
with (BASE / 'source-opening/cost-tools-initial-derivation.json').open('x') as out:
    json.dump({'schema': 'logos-engine.lot6b.cost-tools-text-derivation.v1',
               'status': 'draft_pending_selected_rigid_contract_review', 'measurementExecuted': False,
               'files': rows, 'generator': fp(Path(__file__))}, out, indent=2)
    out.write('\n')
print(json.dumps({'written': len(rows), 'measurementExecuted': False, 'status': 'draft'}))
