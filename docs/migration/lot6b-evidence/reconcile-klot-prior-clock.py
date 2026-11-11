#!/usr/bin/env python3
"""Carry observed earlier public screening time into the existing KLOT clock.

This is a one-time correction of the incomplete first search, not a clock reset.
No source agent, game host, game engine, level or solution is imported or read.
"""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json

ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent

def fp(path):
    raw = path.read_bytes()
    return {'path': str(path.relative_to(ROOT)), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}

def write(path, value):
    with path.open('x') as out:
        json.dump(value, out, indent=2, ensure_ascii=False)
        out.write('\n')

clock_path = BASE / 'klot-case-clock.json'
clock = json.loads(clock_path.read_text())
assert clock['case'] == 'KLOT' and clock['active'] is None and clock['priorChargedSeconds'] == 0
assert len(clock['intervals']) == 1 and clock['intervals'][0]['label'] == 'prior-public-history-reconciliation'
write(BASE / 'source-opening/klot-clock-before-prior-correction.json', clock)
timed = [
    ('docs/migration/lot7b-evidence/candidate-selection.json', 'startedAt', 'finishedAt'),
    ('docs/migration/lot4c-evidence/candidate-selection.json', 'startedAt', 'finishedAt'),
    ('docs/migration/lot10a-evidence/diagnostic/initial-public-admission.json', 'startedAt', 'completedAt'),
]
charges = []
for name, first, last in timed:
    path = ROOT / name
    data = json.loads(path.read_text())
    rows = data.get('results', data.get('cases', []))
    row = next(x for x in rows if x.get('game') == 'KLOT')
    seconds = (datetime.fromisoformat(data[last].replace('Z', '+00:00')) - datetime.fromisoformat(data[first].replace('Z', '+00:00'))).total_seconds()
    assert seconds >= 0
    charges.append({'input': fp(path), 'startedAt': data[first], 'finishedAt': data[last],
                    'chargedSeconds': seconds, 'observedCaseRow': row,
                    'basis': 'Conservative allocation of the entire timed public corpus screening, including KLOT; no per-case duration is fabricated.'})
untimed = [
    'native-campaigns-v53/candidate-selection.json', 'native-campaigns-v52/candidate-selection.json',
    'native-campaigns-v55/ordered-reaction-candidate-selection.json', 'native-campaigns-v51/candidate-selection.json',
    'native-campaigns-v49/candidate-selection.json', 'native-campaigns-v51/framed-transfer-candidate-selection.json',
    'native-campaigns-v50/candidate-selection.json', 'native-campaigns-v57/initial-morphology.json',
    'native-campaigns-v57/initial-morphology-rerun.json',
    'lot3h-evidence/diagnostic/crossed-prefix-public-admission.json',
    'lot3g-evidence/diagnostic/framed-window-public-admission.json',
    'lot3f-evidence/diagnostic/reference-population-public-admission.json',
    'lot3e-evidence/diagnostic/reception-public-admission.json',
]
prior = sum(x['chargedSeconds'] for x in charges)
observation = {
    'schema': 'logos-engine.lot6b.case-prior-observation.v2', 'case': 'KLOT',
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'priorChargedSeconds': prior,
    'supersedesIncompleteObservation': fp(BASE / 'source-opening/klot-prior-observation.json'),
    'correction': 'The first filename-based search missed public corpus screening records. Its statement that the new document was the sole textual match was incorrect; the initial receipt is retained and superseded before any live attempt.',
    'historicalTimedScreenings': charges,
    'untimedPublicCorpusScreenings': [fp(ROOT / 'docs/migration' / name) for name in untimed],
    'retainedPriorLiveCampaignOrBlockedCaseClockFound': False,
    'qualification': 'Earlier records contain initial public geometry/admission screening, without dispatched KLOT actions or an observed blocked-case campaign. Full observed durations are carried conservatively where timestamps exist. Untimed corpus screening is disclosed, not assigned invented durations. All current case diagnostics and later attempts use this same retained cumulative clock.',
    'generator': fp(Path(__file__)),
}
observation_path = BASE / 'source-opening/klot-prior-observation-reconciled.json'
write(observation_path, observation)
clock['priorChargedSeconds'] = prior
clock['chargedSeconds'] = prior + sum(x['elapsedSeconds'] for x in clock['intervals'])
clock['remainingSeconds'] = clock['limitSeconds'] - clock['chargedSeconds']
clock['priorObservation'] = fp(observation_path)
clock['priorCorrection'] = fp(BASE / 'source-opening/klot-clock-before-prior-correction.json')
clock['updatedAt'] = datetime.now(timezone.utc).isoformat()
clock_path.write_text(json.dumps(clock, indent=2) + '\n')
print(json.dumps({key: clock[key] for key in ['case', 'priorChargedSeconds', 'chargedSeconds', 'remainingSeconds', 'active']}))
