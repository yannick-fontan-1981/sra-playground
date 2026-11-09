#!/usr/bin/env python3
"""Unchanged original OrderedReaction contracts on synthetic public rasters.

These component fixtures do not open a game or initialize a live campaign.
"""
from __future__ import annotations
import copy
import gzip
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e'
SOURCE = ROOT / 'reference/v6' / COMMIT / 'source'
sys.dont_write_bytecode = True
CACHE = tempfile.TemporaryDirectory(prefix='reaction-source-lookup-')
sys.pycache_prefix = CACHE.name
sys.path[:0] = [str(SOURCE), str(SOURCE / 'agents/yf_arc3_v6/laya_proto')]
from neutral_observer import measure
from agents.yf_arc3_v6.morphology_policy.ordered_reaction.family import OrderedReaction
from agents.yf_arc3_v6.morphology_policy.ordered_reaction import geometry

def plain(value):
    if hasattr(value, 'model_dump'): return plain(value.model_dump())
    if hasattr(value, 'items'): return {str(k): plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [plain(v) for v in value]
    if isinstance(value, (set, frozenset)): return [plain(v) for v in sorted(value)]
    return value

def raster(ring=(5, 1), *, translate=(0, 0), palette=None):
    palette = palette or {x: x for x in range(16)}
    dr, dc = translate
    rows = [[palette[0]] * 28 for _ in range(28)]
    def square(top, left, value, offsets):
        for r in range(3):
            for c in range(3): rows[top + r + dr][left + c + dc] = palette[8 if (r, c) in offsets else value]
    square(9, 1, 2, {(1, 2)})
    square(9, 5, 2, {(1, 2)})
    square(5, 9, 3, {(2, 1)})
    square(9, 9, 6, {(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)})
    square(13, 9, 4, {(2, 1)})
    square(17, 9, 5, {(1, 2)})
    if ring is not None:
        for r in range(3):
            for c in range(3): rows[ring[0] + r + dr][ring[1] + c + dc] = palette[7 if r in (0, 2) or c in (0, 2) else 0]
    return rows

def frames_for(rows, restore=True):
    first = copy.deepcopy(rows); first[10][7] = 2
    second = copy.deepcopy(first)
    for r, c in [(0, 0), (0, 2), (2, 0), (2, 2)]: second[9 + r][9 + c] = 9
    third = copy.deepcopy(second); third[7][10] = 3
    return [first, second, third] + ([copy.deepcopy(rows)] if restore else [])

def observation(rows, revision=1, epoch=1, available=None):
    packet = SimpleNamespace(frame_rows=rows,
        frame_hash=hashlib.sha256(json.dumps(rows, separators=(',', ':')).encode()).hexdigest()[:16],
        level=epoch, levels_completed=epoch - 1, state='NOT_FINISHED',
        available_action_refs=tuple(available if available is not None else ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5']))
    return measure(packet, revision, 'reaction:synthetic')[0]

cases = []
def family_case(name, operation, arguments, seed=None):
    family = OrderedReaction()
    if seed is not None: family.restore(copy.deepcopy(seed))
    row = {'id': name, 'operation': operation, 'arguments': plain(arguments), 'seedState': plain(family.state())}
    args = copy.deepcopy(arguments)
    if operation == 'before': args[2] = SimpleNamespace(**args[2])
    method = 'record' if operation == 'recordSource' else operation
    try: row['value'] = plain(getattr(family, method)(*args))
    except (ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
        row['error'] = {'name': type(error).__name__, 'message': str(error)}
    row['afterState'] = plain(family.state()); cases.append(row)
    return row

before_rows, rows = raster(), raster((5, 5))
before, current = observation(before_rows), observation(rows, 2)
family_case('cold_owner_abstains', 'propose', [before, before_rows, [], 16])
family_case('zero_budget_still_scopes', 'propose', [before, before_rows, [], 0])
acquired = family_case('observed_current_outline_translation', 'recordSource',
    [before, current, {'action_ref': 'ACTION4'}, before_rows, rows])['afterState']
assert acquired['control'] and not acquired['packets']
probe = family_case('current_control_process_proposal', 'propose', [current, rows, [], 16], acquired)
assert probe['value']['reaction_plan']['offer']['kind'] == 'probe'
proposal = probe['value']
family_case('current_control_all_offers', 'offers', [current, rows], acquired)

for label, later, action in [
    ('same_picture', rows, 'ACTION4'),
    ('opposite_translation', before_rows, 'ACTION4'),
    ('no_unique_outline', raster(None), 'ACTION4'),
    ('unknown_action_without_packet', rows, 'ACTION6'),
]:
    family_case(label, 'recordSource', [current, observation(later, 3), {'action_ref': action}, rows, later], acquired)

frames = frames_for(rows)
distributed = family_case('ordered_packet_even_when_final_picture_returns', 'recordSource',
    [current, observation(rows, 3), {'action_ref': 'ACTION5'}, rows, rows, None, 0, frames], acquired)['afterState']
assert len(distributed['packets']) == 1 and distributed['progress']['progress'] is False
family_case('duplicate_packet_keeps_distinct_cache', 'recordSource',
    [current, observation(rows, 4), {'action_ref': 'ACTION5'}, rows, rows, None, 0, frames], distributed)
cover = family_case('observed_incidence_cover_proposal', 'propose', [current, rows, [], 16], distributed)
assert cover['value']['reaction_plan']['offer']['kind'] == 'cover'
family_case('ordered_packet_measured_incidence', 'measurement', [rows], distributed)

for selected_name, chosen, seed in [('probe', proposal, acquired), ('cover', cover['value'], distributed)]:
    for label, obs, current_rows, index in [
        ('current', current, rows, 0),
        ('stale_revision', observation(rows, 9), rows, 0),
        ('stale_epoch', observation(rows, 2, 2), rows, 0),
        ('wrong_index', current, rows, 1),
        ('changed_raster', current, raster(None), 0),
        ('unavailable_input', {**current, 'available_action_refs': [a for a in current['available_action_refs'] if a != chosen['actions'][0]['action_ref']]}, rows, 0),
    ]:
        family_case(selected_name + '_before_' + label, 'before', [chosen, index, {'frame_rows': current_rows}, obs], seed)
    changed = copy.deepcopy(chosen); changed['actions'][0] = {'action_ref': 'ACTION6'}
    family_case(selected_name + '_bind_rejects_changed_input', 'bind', [changed, None], seed)
    changed = copy.deepcopy(chosen); changed['steps'][0]['expected_after'] = [999, 999]
    family_case(selected_name + '_bind_rejects_changed_prediction', 'bind', [changed, None], seed)
    for label, later in [('same', rows), ('arrived', raster((9, 5))), ('wrong', before_rows)]:
        family_case(selected_name + '_after_' + label, 'after', [chosen, 0, current, observation(later, 3), rows, later], seed)
    family_case(selected_name + '_selected_return_tracks_attempt', 'recordSource',
        [current, observation(rows, 3), chosen['actions'][0], rows, rows, chosen, 0, frames], seed)

protected_rows = raster((9, 5)); protected_obs = observation(protected_rows, 4)
protected = family_case('current_achieved_cover_proposal', 'propose', [protected_obs, protected_rows, [], 16], distributed)
assert protected['value']['reaction_plan']['offer']['kind'] == 'protected'
# The original continuation is reached through actual synthetic returns: an
# alternative process packet, a measured cover arrival, then new local progress.
alternative = family_case('alternative_process_packet', 'recordSource',
    [current, observation(rows, 3), {'action_ref': 'ACTION6'}, rows, rows, None, 0, frames], acquired)['afterState']
covered = family_case('measured_cover_arrival', 'recordSource',
    [observation(rows, 3), protected_obs, {'action_ref': 'ACTION2'}, rows, protected_rows], alternative)['afterState']
advance_first = copy.deepcopy(protected_rows); advance_first[10][3] = 2
advance_second = copy.deepcopy(advance_first)
for r, c in [(0, 0), (0, 2), (2, 0), (2, 2)]: advance_second[9 + r][9 + c] = 9
advance_third = copy.deepcopy(advance_second); advance_third[7][10] = 3
progress_obs = observation(advance_third, 5)
progress = family_case('actual_progress_under_retained_cover', 'recordSource',
    [protected_obs, progress_obs, {'action_ref': 'ACTION5'}, protected_rows, advance_third,
     None, 0, [advance_first, advance_second, advance_third]], covered)['afterState']
continued = family_case('observed_progress_continuation_proposal', 'propose', [progress_obs, advance_third, [], 16], progress)
assert continued['value']['reaction_plan']['offer']['kind'] == 'continue'
family_case('changed_picture_invalidates_prior_progress', 'propose', [observation(protected_rows, 6), protected_rows, [], 16], progress)
family_case('same_scope_keeps_evidence', 'scope', [current], distributed)
scoped = family_case('official_boundary_retains_history_only', 'recordSource',
    [current, observation(rows, 3, 2), {'action_ref': 'ACTION5'}, rows, rows, proposal, 0, frames], distributed)['afterState']
assert scoped['history'] and not scoped['control'] and not scoped['packets']
family_case('history_does_not_grant_new_scope_permit', 'propose', [observation(rows, 4, 2), rows, [], 16], scoped)
family_case('new_scope_without_packets_keeps_prior_history', 'scope', [observation(rows, 4, 3)], scoped)

# Current partial progress differs from a packet that returned to its first image.
progress_frames = frames_for(rows, False); progressed = progress_frames[-1]
family_case('ongoing_process_progress_retained', 'recordSource',
    [current, observation(progressed, 3), {'action_ref': 'ACTION5'}, rows, progressed, proposal, 0, progress_frames], acquired)
family_case('empty_animation_falls_back_to_returned_frame', 'recordSource',
    [current, observation(rows, 3), {'action_ref': 'ACTION5'}, rows, rows, proposal, 0, []], acquired)
wrong_lattice = copy.deepcopy(acquired); wrong_lattice['control'][0]['lattice'][0] = 8
family_case('foreign_lattice_control_cannot_authorize', 'offers', [current, rows], wrong_lattice)
for label, palette, translation in [
    ('palette_bijection', {x: (x + 3) % 16 for x in range(16)}, (0, 0)),
    ('translated_field', None, (1, 1)),
]:
    a, b = raster(palette=palette, translate=translation), raster((5, 5), palette=palette, translate=translation)
    item = family_case(label + '_acquisition', 'recordSource', [observation(a), observation(b, 2), {'action_ref': 'ACTION4'}, a, b])
    family_case(label + '_proposal', 'propose', [observation(b, 2), b, [], 16], item['afterState'])

# The live Kernel contract isolates a source proposal after synthetic measured
# control. Its seed is never supplied to a game or included in a campaign.
kernel_obs, kernel_after = observation(rows), observation(rows, 2)
kernel_family = OrderedReaction(); kernel_family.restore(copy.deepcopy(acquired))
kernel_proposal = kernel_family.propose(kernel_obs, rows, [], 16)
assert kernel_proposal and kernel_proposal['reaction_plan']['offer']['kind'] == 'probe'
kernel_record = kernel_family.record(kernel_obs, kernel_after, kernel_proposal['actions'][0], rows, rows, kernel_proposal, 0, frames)
kernel = {'qualification': 'Explicit synthetic post-control component state; no live game or campaign initialization.',
          'rows': rows, 'frames': frames, 'observation': kernel_obs, 'afterObservation': kernel_after,
          'seedState': acquired, 'proposal': plain(kernel_proposal), 'record': plain(kernel_record), 'afterState': plain(kernel_family.state())}

paths = {Path(module.__file__).resolve() for module in list(sys.modules.values()) if getattr(module, '__file__', None)
         and Path(module.__file__).resolve().is_relative_to(SOURCE)}
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/ordered_reaction').glob('*.drm'))
paths.update((SOURCE / 'agents/yf_arc3_v6/morphology_policy/ordered_reaction').glob('*.src'))
paths.update((SOURCE / 'agents/yf_arc3_v5/drm').glob('*.drm'))
payload = {'schema': 'logos-engine.v6.ordered-reaction-family-reference.v1', 'referenceCommit': COMMIT,
           'qualification': 'Unchanged original Python on synthetic public rasters and explicit component state. No game dispatch or solved-level claim.',
           'sourceHashes': {p.relative_to(SOURCE).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)},
           'cases': cases, 'kernelControlled': plain(kernel)}
out = ROOT / 'tests/fixtures/v6-ordered-reaction-family-reference.json.gz'
out.write_bytes(gzip.compress((json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n').encode(), mtime=0))
print(json.dumps({'path': out.relative_to(ROOT).as_posix(), 'cases': len(cases), 'bytes': out.stat().st_size,
                  'sha256': hashlib.sha256(out.read_bytes()).hexdigest()}))
