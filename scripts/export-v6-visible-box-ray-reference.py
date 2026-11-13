#!/usr/bin/env python3
"""Export the unchanged source box FIRST_HIT kernel, without any game host."""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']
def hashed(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    for path, item in MANIFEST.items():
        assert hashed(SOURCE / path) == item['sha256'], path
verify()
sys.path.insert(0, str(SOURCE))
from agents.yf_arc3_v5.capabilities.discrete_relay_optics import _first_hit, OpticalPrerequisite

def q(n, d=1): return [n, d]
def box(ref, values):
    return {'body_ref': ref, 'shape_ref': 'axis_aligned_closed_box', 'box_bounds': [q(n) for n in values]}
BASE = {'model_ref': 'finite_visible_boxes', 'receivers': [],
        'directions': [{'direction_ref': 'd', 'vector': [q(1), q(0)]}],
        'boundary_bounds': [q(0), q(0), q(20), q(20)],
        'intersection_law_ref': 'positive_analytic_ray_intersections_before_box_exit',
        'source_inside_receiver_law_ref': None, 'hit_tie_law_ref': None, 'receiver_tie_order': []}
RAY = {'origin': [q(5), q(5)], 'direction_ref': 'd', 'excluded_source_body_ref': None}
CASES = []
def add(name, receivers=None, direction=None, model_patch=None, ray_patch=None):
    model, ray = copy.deepcopy(BASE), copy.deepcopy(RAY)
    model['receivers'] = copy.deepcopy(receivers or [])
    if direction is not None: model['directions'][0]['vector'] = copy.deepcopy(direction)
    model.update(copy.deepcopy(model_patch or {})); ray.update(copy.deepcopy(ray_patch or {}))
    visits = []
    native = SimpleNamespace(**{**model, 'receivers': [SimpleNamespace(**item) for item in model['receivers']],
        'directions': [SimpleNamespace(**item) for item in model['directions']]})
    try: result = _first_hit(native, SimpleNamespace(**ray), SimpleNamespace(visit=lambda value: visits.append(copy.deepcopy(value))))
    except OpticalPrerequisite as error: result = {'rejected': True, 'cause': str(error)}
    CASES.append({'id': name, 'model': model, 'ray': ray, 'expected': result, 'visits': visits})

for index, direction in enumerate([(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(2,1),(-3,-2)]):
    for name, receivers in [
        ('empty', []), ('forward', [box('forward', [8,4,10,6])]),
        ('nearer-before-farther', [box('far', [13,4,15,6]), box('near', [8,4,10,6])]),
        ('outside-boundary', [box('outside', [21,4,25,6])]),
        ('corner', [box('corner', [8,8,10,10])]),
    ]: add(f'{index}:{name}', receivers, [q(n) for n in direction])
add('rational-direction', [box('receiver', [8,6,10,8])], [q(2,3),q(1,3)])
add('rational-origin', [box('receiver', [8,4,10,6])], ray_patch={'origin':[q(11,2),q(9,2)]})
add('excluded-source', [box('source',[4,4,6,6]),box('receiver',[8,4,10,6])], ray_patch={'excluded_source_body_ref':'source'})
add('inside-undeclared', [box('receiver',[4,4,6,6])])
add('inside-explicit-exit', [box('receiver',[4,4,6,6])], model_patch={'source_inside_receiver_law_ref':'first_positive_exit'})
add('tangent-closed-boundary', [box('receiver',[8,5,10,7])])
add('zero-width-contact', [box('receiver',[8,5,8,5])])
add('behind-ray', [box('receiver',[1,4,3,6])])
add('exit-zero', [], ray_patch={'origin':[q(20),q(5)]})
add('hit-exact-boundary', [box('receiver',[20,4,22,6])])
ties = [box('a',[8,4,10,6]),box('b',[8,3,10,7])]
add('tie-undeclared', ties)
add('tie-explicit', ties, model_patch={'hit_tie_law_ref':'declared_receiver_order','receiver_tie_order':['b','a']})
add('tie-duplicate-order', ties, model_patch={'hit_tie_law_ref':'declared_receiver_order','receiver_tie_order':['b','a','b']})
add('tie-incomplete-order', ties, model_patch={'hit_tie_law_ref':'declared_receiver_order','receiver_tie_order':['b']})
add('reversed-box', [box('receiver',[10,4,8,6])])
add('unsupported-shape', [{'body_ref':'triangle','shape_ref':'triangle','box_bounds':None}])
add('missing-first-impact-law', model_patch={'intersection_law_ref':None})
add('unknown-direction', ray_patch={'direction_ref':'unknown'})
add('zero-direction', direction=[q(0),q(0)])
add('outside-origin', ray_patch={'origin':[q(-1),q(5)]})
add('reversed-boundary', model_patch={'boundary_bounds':[q(20),q(0),q(0),q(20)]})
add('nonpositive-denominator', direction=[q(1,0),q(0)])
verify()
paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module,'__file__',None)}
hashes = {str(path.relative_to(SOURCE)):hashed(path) for path in paths if path.is_relative_to(SOURCE) and path.is_file()}
for path,value in hashes.items(): assert MANIFEST[path]['sha256'] == value
result = {'schema':'logos-engine.v6.visible-box-ray-reference.v1','sourceCommit':COMMIT,
          'generator':str(Path(__file__).relative_to(ROOT)),'generatorSha256':hashed(Path(__file__)),
          'sourceHashes':dict(sorted(hashes.items())),'pinnedSourceFilesVerifiedBeforeImport':len(MANIFEST),
          'sourceModified':False,'gameHostRun':False,
          'scope':'Exact axis_aligned_closed_box branch of _first_hit only; no disk interval or full optical state machine.',
          'cases':CASES}
destination=ROOT/'tests/fixtures/v6-visible-box-ray-reference.json.gz'
if destination.exists(): raise FileExistsError(destination)
destination.write_bytes(gzip.compress(json.dumps(result,sort_keys=True,separators=(',',':')).encode(),mtime=0))
print(json.dumps({'cases':len(CASES),'sourceFiles':len(hashes),'fixture':str(destination.relative_to(ROOT))}))
