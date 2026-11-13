"""Bounded comparisons of public rooted-path prefix edits.

DRM assigns extension meaning and commitment. These measurements never infer
truncation, select a goal, copy old geometry, or release an action.
"""
from pydantic import Field

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, stable_digest
from .contracts import (
    BlockGridSceneDescription, VisualSceneDescription, TemporalTrackingResult,
)
from .rooted_prefix_observation import _geometry


class RootedPrefixExtensionInput(FrozenModel):
    schema_version: str = 'yf_arc3_v5.rooted_prefix_extension_input.v1'
    before_scene: VisualSceneDescription | BlockGridSceneDescription
    after_scene: VisualSceneDescription | BlockGridSceneDescription
    before_tracking: TemporalTrackingResult
    after_tracking: TemporalTrackingResult
    action_ref: str
    action_data: FrozenMap | None = None
    transition_ref: str
    context_epoch: int = Field(ge=1)
    contract: FrozenMap
    prior_rows: tuple[FrozenMap, ...] = Field(default=(), max_length=64)


class RootedPrefixExtensionMeasurements(FrozenModel):
    schema_version: str = 'yf_arc3_v5.rooted_prefix_extension_measurements.v1'
    descriptive_facts: FrozenMap


def measure_rooted_prefix_extension(value):
    empty = RootedPrefixExtensionMeasurements(descriptive_facts=FrozenMap({
        'extension_observation_rows': (), 'extension_law_rows': (),
    }))
    cfg = value.contract
    if not cfg or value.action_ref != cfg['point_action_ref'] or value.action_data is None:
        return empty
    frames = value.before_scene.frame, value.after_scene.frame
    components = tuple(tuple(t.component for t in tracking.entities)
                       for tracking in (value.before_tracking, value.after_tracking))
    if (any(f.width*f.height > cfg['maximum_frame_pixels'] for f in frames)
            or any(len(cs) > cfg['maximum_components'] for cs in components)):
        return empty
    geometries = tuple(_geometry(f, cs, cfg) for f, cs in zip(frames, components))
    if any(len(gs) != 1 for gs in geometries):
        return empty
    before, after = (gs[0] for gs in geometries)
    def geometry_key(g):
        return g['box'], g['pitch'], tuple(order for order, _ in g['chains']), g['counts']
    if geometry_key(before) != geometry_key(after):
        return empty
    x, y = value.action_data.get('x'), value.action_data.get('y')
    if type(x) is not int or type(y) is not int:
        return empty
    matches = tuple((i, ordinal) for i, (path, _) in enumerate(before['chains'])
                    for ordinal, cell in enumerate(path)
                    if before['centers'][cell] == (y, x))
    if len(matches) != 1:
        return empty
    index, ordinal = matches[0]
    old = tuple(n for _, n in before['chains'])
    new = tuple(n for _, n in after['chains'])
    if (not old[index] < ordinal+1 or new[index] != ordinal+1
            or any(a != b for j, (a, b) in enumerate(zip(old, new)) if j != index)):
        return empty
    token = stable_digest((value.transition_ref, value.action_ref, old, new, index, ordinal))
    evidence = (f'evidence.transition:{value.transition_ref}',)
    observation = FrozenMap({
        'extension_token': token, 'extension_observation_complete': True,
        'extension_operator_ref': value.action_ref, 'extension_transition_ref': value.transition_ref,
        'extension_context_epoch': value.context_epoch,
        'extension_geometry_digest': stable_digest(geometry_key(before)),
        'extension_selected_path_index': index, 'extension_selected_ordinal': ordinal,
        'extension_before_prefix': old[index], 'extension_after_prefix': new[index],
        'extension_other_paths_preserved': True, 'extension_evidence_refs': evidence,
    })
    # Compare every bounded retained observation. Distinct transition references
    # are witnesses, not a claim of statistical independence.
    witnesses = {}
    for prior in value.prior_rows:
        if (prior.get('operator_ref') == value.action_ref
                and prior.get('context_epoch') == value.context_epoch
                and prior.get('other_paths_preserved') is True
                and prior.get('geometry_digest') == observation['extension_geometry_digest']
                and prior.get('source_claim_ref') and prior.get('transition_ref')
                and type(prior.get('before_prefix')) is int
                and type(prior.get('selected_ordinal')) is int
                and prior['before_prefix'] < prior['selected_ordinal']+1
                and prior.get('after_prefix') == prior['selected_ordinal']+1):
            witnesses[prior['transition_ref']] = prior['source_claim_ref']
    laws = ()
    if (value.transition_ref in witnesses
            and 2 <= len(witnesses) <= cfg['maximum_support_transitions']):
        refs = tuple(sorted(witnesses))
        claims = tuple(witnesses[r] for r in refs)
        law_token = stable_digest((value.action_ref, refs))
        laws = (FrozenMap({
            'extension_token': law_token, 'extension_law_comparison_complete': True,
            'extension_operator_ref': value.action_ref,
            'extension_other_paths_preserved': True,
            'extension_support_transition_count': len(refs),
            'extension_support_transition_refs': refs,
            'extension_support_claim_refs': claims,
            'extension_evidence_refs': tuple('evidence.transition:'+r for r in refs),
        }),)
    return RootedPrefixExtensionMeasurements(descriptive_facts=FrozenMap({
        'extension_observation_rows': (observation,), 'extension_law_rows': laws,
    }))
