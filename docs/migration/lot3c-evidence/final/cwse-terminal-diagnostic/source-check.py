#!/usr/bin/env python3
"""Read-only component diagnosis of an already retained public CWSE trajectory.

No game host, game implementation, solution, new campaign, or changed source is
used. The own ExposedReception state is restored only from captured real events.
This does not claim that the complete original caller would take this trajectory.
Run from repository root: python -B docs/migration/lot3c-evidence/final/cwse-terminal-diagnostic/source-check.py
"""
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path.cwd()
BASE = ROOT / 'docs/migration/lot3c-evidence/final'
OUT = BASE / 'cwse-terminal-diagnostic'
SOURCE = ROOT / 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source'
MANIFEST = json.loads((SOURCE.parent / 'manifest.json').read_text())['files']

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def verify_source():
    for name, entry in MANIFEST.items():
        assert sha(SOURCE / name) == entry['sha256'], name
    return len(MANIFEST)
def plain(value): return json.loads(json.dumps(value))
def read(name): return json.load(gzip.open(BASE / 'cwse-session' / name, 'rt'))

verified_before = verify_source()
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from exposed_reception_access import ExposedReceptionAccess, scene, large_scene, input_candidates
from reception_lattice_projection import small_scene
from target_tree import CompositionTargetTree
from terminal_composition import identity

campaign = read('cwse-campaign.json.gz')
trace = read('cwse-public-trace.json.gz')
packets = [entry['packet'] for entry in trace['packets']]
events = [event for prefix in campaign['prefixes'] for event in prefix['sharedSeries']['exposedReceptionAcquiredEvents']]
assert len(events) == 19
memory = ExposedReceptionAccess()
for event in copy.deepcopy(events): memory.apply_event(event)

def own_state():
    return plain({name: getattr(memory, name) for name in
                  ('reception_state', 'reception_controls', 'reception_models', 'reception_events')})
def observation(packet, retained):
    return {**retained, 'available_action_refs': packet['available_action_refs'], 'state': packet['state']}

measurements = []
for index in (19, 20, 21):
    packet = packets[index]
    assert identity(packet['frame_rows'])[:16] == packet['frame_hash']
    measurements.append({'sequence': index, 'frameHash': packet['frame_hash'],
                         'scene': plain(scene(packet['frame_rows'])),
                         'largeScene': plain(large_scene(packet['frame_rows'])),
                         'smallScene': plain(small_scene(packet['frame_rows']))})

exposed_prefix = campaign['prefixes'][-2]
assert exposed_prefix['id'] == 'prefix_evidence:13'
capture = exposed_prefix['outlineAcquisition']['nativeCheckpoint']['public_transition']
assert capture['before_rows'] == packets[19]['frame_rows']
assert capture['after_rows_sha256'] == identity(packets[20]['frame_rows'])
before = observation(packets[19], capture['before'])
after = observation(packets[20], capture['after'])
state_before = own_state()
returned = memory.record(before, capture['command'], after, packets[19]['frame_rows'], packets[20]['frame_rows'],
                         exposed_prefix['observedExposedReception']['proposal'], 7)
own_events = [event for event in returned if event.get('kind') == 'observed_exposed_reception']
assert own_events == []
assert own_state() == state_before

last_capture = campaign['prefixes'][-1]['outlineAcquisition']['nativeCheckpoint']['public_transition']
assert last_capture['after_rows_sha256'] == identity(packets[21]['frame_rows'])
current = observation(packets[21], last_capture['after'])
config = json.loads((SOURCE / 'agents/yf_arc3_v6/morphology_policy/strategy.drm').read_text())['declarations'][0]['configuration']['observed_composition_services']
remaining = campaign['budget']['levelActionCaps'][2] - sum(row['levelBefore'] == 3 for row in campaign['actions'])
config = {**config, 'remaining_level_actions': remaining}
inputs = input_candidates(packets[21]['frame_rows'], packets[21]['available_action_refs'])
proposal = memory.propose_graph(current, packets[21]['frame_rows'], inputs, min(16, remaining), config)
assert proposal['kind'] == 'exposed_reception'
assert own_state() == state_before
binding = CompositionTargetTree().bind(proposal, current, {'id': 'G_official_completion'})
assert binding['admitted'] is False and binding['reason'] == 'unbound_action_set'
assert proposal['actions'] == proposal['bundle_template']['actions']
assert current['observation_ref'] not in proposal['bundle_template']['evidence']

output = {
    'schema': 'logos-engine.v6.exposed-terminal-source-diagnostic.v1',
    'scope': 'Read-only component comparison on the retained public journal; no original full-caller trajectory claim.',
    'referenceCommit': SOURCE.parent.name,
    'sourceFilesVerifiedBefore': verified_before,
    'sourceFilesVerifiedAfter': verify_source(),
    'inputs': [{'path': str(path.relative_to(ROOT)), 'sha256': sha(path)} for path in
               (BASE / 'cwse-session/cwse-campaign.json.gz', BASE / 'cwse-session/cwse-public-trace.json.gz')],
    'retainedOwnEvents': len(events),
    'measurements': measurements,
    'lastExposedTransition': {'sequence': 20, 'before': before, 'after': after,
                              'ownEvents': own_events, 'ownStateUnchanged': own_state() == state_before},
    'terminalObservation': current,
    'remaining': remaining,
    'proposal': plain(proposal),
    'targetBinding': binding,
    'actionsEqualBundle': proposal['actions'] == proposal['bundle_template']['actions'],
    'currentObservationInBundleEvidence': current['observation_ref'] in proposal['bundle_template']['evidence'],
    'lastOwnEvidence': state_before['reception_state']['evidence'][-1],
    'conclusion': 'The retained Exposed source produces a current scene and action-bound proposal but reuses old state evidence. The unchanged source target tree rejects that proposal because its bundle evidence omits the current observation. The native component must be compared separately; this result establishes the same source-level provenance limitation without assuming full-caller parity.'
}
(OUT / 'source-result.json').write_text(json.dumps(output, indent=2, ensure_ascii=False) + '\n')
print(json.dumps({key: output[key] for key in ('retainedOwnEvents', 'targetBinding', 'actionsEqualBundle', 'currentObservationInBundleEvidence', 'lastOwnEvidence')}))
