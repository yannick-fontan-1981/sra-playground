"""Exact scoped photo-window equality and immutable finite photo controls.

Photo/reference/control ownership and epistemic qualification are Source-bound.
The kernel never reads an oracle or chooses which experiment/candidate to use.
"""

from __future__ import annotations

from typing import ClassVar
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .indexed_panel_measurement_d import DPanelLayout, measure_panel_regions_d, measure_indexed_control_d


class FragmentPhoto(FrozenModel):
    photo_ref: Ref
    scene_ref: Ref
    film_revision_ref: Ref
    photo_index: int = Field(ge=0, le=4095)
    frame: FrameGrid
    evidence_ref: Ref
    content_support_ref: Ref
    content_kind_ref: Ref


class FragmentWindow(FrozenModel):
    window_ref: Ref
    photo_ref: Ref
    top: int = Field(ge=0)
    left: int = Field(ge=0)


class PhotoControlState(FrozenModel):
    scene_ref: Ref
    film_revision_ref: Ref
    reference_revision_ref: Ref
    current_index: int = Field(ge=0, le=4095)
    accepted_count: int = Field(default=0, ge=0)
    attempt_count: int = Field(default=0, ge=0)


class PhotoPrimitive(FrozenModel):
    primitive_ref: Ref
    kind_ref: Ref
    target_index: int | None = Field(default=None, ge=0, le=4095)


class PhotoWord(FrozenModel):
    word_ref: Ref
    primitives: tuple[PhotoPrimitive, ...] = Field(default=(), max_length=4096)


class PhotoInputBinding(FrozenModel):
    kind_ref: Ref
    index: int | None = Field(default=None, ge=0, le=4095)
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


class PhotoNativeTransform(FrozenModel):
    photo_ref: Ref
    scene_ref: Ref
    evidence_revision_ref: Ref
    geometry_status_ref: Ref
    native_row_origin: int
    native_column_origin: int
    row_scale: int = Field(ge=1, le=256)
    column_scale: int = Field(ge=1, le=256)
    action_ref: Ref
    row_payload_key: Ref
    column_payload_key: Ref
    payload_template: FrozenMap


class FragmentModel(FrozenModel):
    model_ref: Ref
    photo_count: int = Field(ge=1, le=4096)
    equality_law_ref: Ref | None
    palette_relation: tuple[tuple[int, int], ...] = Field(default=(), max_length=256)
    descriptive_distance_ref: Ref | None = None
    navigation_law_ref: Ref | None = None
    direct_seek_law_ref: Ref | None = None
    playback_law_ref: Ref | None = None
    playback_order: tuple[int, ...] = Field(default=(), max_length=4096)
    playback_includes_start: bool | None = None
    channel_retention_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    proposal_law_ref: Ref | None = None
    terminal_after_acceptance_ref: Ref | None = None
    required_acceptances: int | None = Field(default=None, ge=1)
    reset_state: PhotoControlState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class FragmentMemoryRecord(FrozenModel):
    """Source-bound content identity and exact current-scope dependencies.

    An index is descriptive only. Source declares the necessary equality axes;
    the kernel does not infer universal scope for a law or discard historical
    raw content when a dependency is no longer current.
    """
    record_ref: Ref
    content_record_ref: Ref
    content_digest: Ref
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    dependency_values: FrozenMap
    dependency_contract_ref: Ref
    raw_photo_ref: Ref | None = None
    raw_photo_content_digest: Ref | None = None
    photo_index: int | None = Field(default=None, ge=0, le=4095)


class FragmentFeedbackContract(FrozenModel):
    attempt_ref: Ref
    primitive_ref: Ref
    before: PhotoControlState
    after: PhotoControlState
    before_evidence_ref: Ref
    after_evidence_ref: Ref
    observation_domain_complete: bool
    official_before_score: int | None = Field(default=None, ge=0)
    official_after_score: int | None = Field(default=None, ge=0)
    official_completion: bool | None = None
    official_evidence_ref: Ref | None = None
    old_scene_binding_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)


_CASES = (
    ('measure_regions', ('MEASURE',)), ('ingest_packet', ('OBSERVE',)),
    ('read_photo_control', ('MEASURE',)), ('exact_candidates', ('MATCH',)),
    ('discriminants', ('COMPARE',)), ('transport_model', ('PREDICT',)),
    ('information_request', ('PROBE',)), ('compile_proposal', ('COMPILE',)),
    ('reconcile_feedback', ('RECONCILE',)), ('memory_scope', ('RETAIN',)),
    ('external_primitive', ('STEP',)),
)


class TemporalFragmentRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.temporal_fragment_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.temporal_fragment_match.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[FragmentModel, ...] = Field(default=(), max_length=32)
    state: PhotoControlState | None = None
    reference: FrameGrid | None = None
    reference_revision_ref: Ref | None = None
    photos: tuple[FragmentPhoto, ...] = Field(default=(), max_length=256)
    windows: tuple[FragmentWindow, ...] = Field(default=(), max_length=4096)
    primitive: PhotoPrimitive | None = None
    information_words: tuple[PhotoWord, ...] = Field(default=(), max_length=3)
    unseen_indices: tuple[int, ...] = Field(default=(), max_length=4096)
    current_question_ref: Ref | None = None
    bound_window: FragmentWindow | None = None
    candidate_evidence_revision_ref: Ref | None = None
    local_interior_point: tuple[int, int] | None = None
    preparation_word: PhotoWord | None = None
    post_preparation_observation_required: bool | None = None
    input_bindings: tuple[PhotoInputBinding, ...] = Field(default=(), max_length=4096)
    transforms: tuple[PhotoNativeTransform, ...] = Field(default=(), max_length=256)
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    frame_evidence_revision_ref: Ref | None = None
    observed_scene_ref: Ref | None = None
    panel_layouts: tuple[DPanelLayout, ...] = Field(default=(), max_length=32)
    permitted_geometry_status_refs: tuple[Ref, ...] = Field(default=(), max_length=2)
    prior_archive_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    acquired_packet_ref: Ref | None = None
    packet_owner_ref: Ref | None = None
    memory_items: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    memory_records: tuple[FragmentMemoryRecord, ...] = Field(default=(), max_length=4096)
    memory_owner_scope_values: FrozenMap = Field(default_factory=FrozenMap)
    feedback_contract: FragmentFeedbackContract | None = None


class FragmentPrerequisite(Exception):
    pass


def _memory_scope(request, budget):
    """Compare declared dependencies; return immutable proposals, never publish."""
    # Scope comparison has no model-prefix reuse; still reject stale resumes.
    d_resume_rows(request, ())
    if request.state is None:
        raise FragmentPrerequisite('CURRENT_MEMORY_SCENE_FILM_AND_REFERENCE_REQUIRED')
    if request.memory_items:
        raise FragmentPrerequisite('UNTYPED_MEMORY_ITEMS_REQUIRE_SOURCE_BINDING')
    if not request.memory_records:
        raise FragmentPrerequisite('SOURCE_BOUND_MEMORY_RECORDS_REQUIRED')
    if len(request.memory_records) > request.domain_bound:
        raise FragmentPrerequisite('MEMORY_RECORD_DOMAIN_BOUND')
    records = {}
    for record in request.memory_records:
        budget.visit()
        if record.record_ref in records:
            raise FragmentPrerequisite('MEMORY_RECORD_IDENTITY_NOT_UNIQUE')
        if not record.dependency_values or not record.dependency_contract_ref:
            raise FragmentPrerequisite('EXPLICIT_MEMORY_DEPENDENCY_CONTRACT_REQUIRED')
        records[record.record_ref] = record
    current = {
        'scene_ref': request.state.scene_ref,
        'film_revision_ref': request.state.film_revision_ref,
        'reference_revision_ref': request.state.reference_revision_ref,
        'evidence_revision_ref': request.scope.evidence_revision_ref,
        'model_revision_ref': request.scope.model_revision_ref,
        'model_refs': tuple(model.model_ref for model in request.models),
        'epoch': request.scope.epoch,
    }
    for field, value in sorted(request.memory_owner_scope_values.items()):
        if field not in ('game_ref', 'level_ref', 'session_ref'):
            raise FragmentPrerequisite('UNKNOWN_MEMORY_OWNER_SCOPE_AXIS')
        current[field] = value
    photos = {}
    for photo in request.photos:
        budget.visit()
        if photo.photo_ref in photos:
            raise FragmentPrerequisite('MEMORY_PHOTO_IDENTITY_NOT_UNIQUE')
        photos[photo.photo_ref] = photo
    rows = []
    for record_ref in sorted(records):
        record = records[record_ref]
        comparisons, missing = [], []
        for axis, expected in sorted(record.dependency_values.items()):
            budget.visit({'memory_records_examined': tuple(row['record_ref'] for row in rows),
                'pending_record_ref': record_ref, 'pending_dependency_axis': axis})
            present = axis in current
            actual = current.get(axis)
            if not present:
                missing.append(axis)
            comparisons.append(d_map({'axis': axis, 'present': present,
                'expected': expected, 'actual': actual,
                'equal': present and actual == expected}))
        photo = photos.get(record.raw_photo_ref) if record.raw_photo_ref is not None else None
        raw_required = record.raw_photo_ref is not None or record.raw_photo_content_digest is not None
        raw_present = (photo is not None and photo.content_kind_ref == 'acquired_photo_content'
            and record.raw_photo_content_digest is not None)
        raw_equal = False
        if raw_present:
            # Charge every pixel before hashing: no hidden unbounded content scan.
            for row in photo.frame.rows:
                for _ in row:
                    budget.visit({'pending_record_ref': record_ref,
                        'raw_photo_ref': photo.photo_ref, 'raw_content_comparison_pending': True})
            raw_equal = stable_digest(d_map(photo)) == record.raw_photo_content_digest
        if raw_required and not raw_present:
            missing.append('raw_photo_content')
        rows.append(d_map({'record_ref': record_ref,
            'content_record_ref': record.content_record_ref,
            'content_digest': record.content_digest,
            'evidence_refs': record.evidence_refs,
            'dependency_contract_ref': record.dependency_contract_ref,
            'dependency_comparisons': tuple(comparisons),
            'dependencies_present': not missing,
            'dependencies_equal': not missing and all(row['equal'] for row in comparisons),
            'missing_dependency_refs': tuple(missing),
            'raw_photo_ref': record.raw_photo_ref,
            'raw_content_required': raw_required,
            'raw_content_present': raw_present,
            'raw_content_equal': raw_equal,
            'raw_photo_scope_current_if_required': not raw_required or (photo is not None
                and photo.scene_ref == request.state.scene_ref
                and photo.film_revision_ref == request.state.film_revision_ref),
            'photo_index': record.photo_index,
            'index_is_not_film_or_photo_identity': True,
            'raw_content_unchanged': True,
            'retention_or_invalidation_not_selected': True}))
    return {'memory_scope_rows': tuple(rows),
        'source_record_refs': tuple(record.record_ref for record in request.memory_records),
        'current_scene_ref': request.state.scene_ref,
        'current_film_revision_ref': request.state.film_revision_ref,
        'current_reference_revision_ref': request.state.reference_revision_ref,
        'unrejected_model_refs': tuple(model.model_ref for model in request.models),
        'memory_publication_authorized': False,
        'feedback_does_not_replace_raw_photo': True,
        'cognitive_owner_publication_required': True}


def _photo(request, window):
    matches = tuple(photo for photo in request.photos if photo.photo_ref == window.photo_ref)
    if len(matches) != 1:
        raise FragmentPrerequisite('ACQUIRED_PHOTO_IDENTITY_NOT_UNIQUE')
    photo = matches[0]
    if photo.content_kind_ref != 'acquired_photo_content':
        raise FragmentPrerequisite('REFERENCE_OR_FEEDBACK_NOT_ADMISSIBLE_PHOTO_CONTENT')
    if request.state is not None and (photo.scene_ref != request.state.scene_ref or photo.film_revision_ref != request.state.film_revision_ref):
        raise FragmentPrerequisite('PHOTO_SCENE_OR_FILM_REVISION_NOT_CURRENT')
    return photo


def _compare_window(model, request, window, budget, *, differences=False):
    if request.reference is None or request.reference_revision_ref is None:
        raise FragmentPrerequisite('CURRENT_REFERENCE_CONTENT_OR_REVISION_MISSING')
    if request.state is not None and request.reference_revision_ref != request.state.reference_revision_ref:
        raise FragmentPrerequisite('REFERENCE_REVISION_NOT_CURRENT')
    photo = _photo(request, window)
    reference = request.reference
    if window.top + reference.height > photo.frame.height or window.left + reference.width > photo.frame.width:
        raise FragmentPrerequisite('REQUESTED_WINDOW_OUTSIDE_PHOTO_CONTENT')
    if model.equality_law_ref not in ('exact_palette_value', 'declared_palette_relation'):
        raise FragmentPrerequisite('COMPLETE_PIXEL_EQUALITY_LAW_MISSING')
    relation = frozenset(model.palette_relation)
    if model.equality_law_ref == 'declared_palette_relation' and not relation:
        raise FragmentPrerequisite('DECLARED_PALETTE_RELATION_MISSING')
    counterexamples, compared_pixel_count = [], 0
    for row in range(reference.height):
        for column in range(reference.width):
            try:
                budget.visit({'window_ref': window.window_ref, 'next_pixel': (row, column)})
            except DComputationInterrupted as error:
                raise DComputationInterrupted(error.cause, FrozenMap.overlay(error.frontier,
                    {'counterexample_pixels': tuple(counterexamples)})) from error
            expected = reference.rows[row][column]
            actual = photo.frame.rows[window.top + row][window.left + column]
            compared_pixel_count += 1
            equal = expected == actual if model.equality_law_ref == 'exact_palette_value' else (expected, actual) in relation
            if not equal:
                counterexamples.append((row, column, expected, actual))
                if not differences:
                    break
        if counterexamples and not differences:
            break
    return {'window_ref': window.window_ref, 'photo_ref': photo.photo_ref, 'photo_index': photo.photo_index,
        'photo_content_kind_ref': photo.content_kind_ref, 'photo_evidence_ref': photo.evidence_ref,
        'photo_content_support_ref': photo.content_support_ref,
        'photo_scene_ref': photo.scene_ref, 'photo_film_revision_ref': photo.film_revision_ref,
        'window_top': window.top, 'window_left': window.left,
        'reference_height': reference.height, 'reference_width': reference.width,
        'compared_pixel_count': compared_pixel_count, 'comparison_stopped_on_first_difference': not differences,
        'comparison_domain_pixel_count': reference.height * reference.width,
        'reference_revision_ref': request.reference_revision_ref, 'exact_match': not counterexamples,
        'counterexample_pixels': tuple(counterexamples), 'background_and_isolated_pixels_preserved': True}


def _transport(model, state, primitive, budget):
    budget.visit({'primitive_ref': primitive.primitive_ref})
    if not 0 <= state.current_index < model.photo_count:
        raise FragmentPrerequisite('CURRENT_PHOTO_OUTSIDE_CONTROL_DOMAIN')
    kind = primitive.kind_ref
    if kind == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise FragmentPrerequisite('INDEPENDENT_RESET_RESTORATION_LAW_MISSING')
        if not 0 <= model.reset_state.current_index < model.photo_count:
            raise FragmentPrerequisite('RESET_PHOTO_OUTSIDE_CONTROL_DOMAIN')
        return {'before_state': state, 'photo_primitive': primitive,
            'state': model.reset_state, 'commands': 1, 'navigation_steps': 0,
            'exposed_indices': (), 'debit': model.reset_cost, 'restoration_contract_ref': model.model_ref}
    costs = tuple(cost for ref, cost in model.input_costs if ref == kind)
    if len(costs) != 1 or costs[0] < 0:
        raise FragmentPrerequisite('EXACT_INPUT_COST_NOT_BOUND')
    index, exposure, navigation_steps = state.current_index, (), 0
    if kind in ('previous', 'next'):
        if model.navigation_law_ref != 'saturating_index_step':
            raise FragmentPrerequisite('SATURATING_NAVIGATION_LAW_MISSING')
        index = min(max(index + (-1 if kind == 'previous' else 1), 0), model.photo_count - 1)
        navigation_steps = abs(index - state.current_index)
        exposure = (index,)
    elif kind == 'seek':
        if model.direct_seek_law_ref != 'one_input_exact_index' or primitive.target_index is None:
            raise FragmentPrerequisite('DIRECT_SEEK_LAW_OR_TARGET_MISSING')
        if primitive.target_index >= model.photo_count:
            raise FragmentPrerequisite('INDEXED_SEEK_OUTSIDE_CONTROL_DOMAIN')
        index, exposure = primitive.target_index, (primitive.target_index,)
    elif kind == 'playback':
        if model.playback_law_ref != 'one_cycle_return_to_origin' or model.playback_includes_start is None:
            raise FragmentPrerequisite('OWNED_ONE_CYCLE_PLAYBACK_LAW_MISSING')
        if len(model.playback_order) != model.photo_count or set(model.playback_order) != set(range(model.photo_count)):
            raise FragmentPrerequisite('COMPLETE_ORDERED_PLAYBACK_DOMAIN_MISSING')
        offset = model.playback_order.index(index)
        exposure = (*model.playback_order[offset + 1:], *model.playback_order[:offset + 1])
        if model.playback_includes_start:
            exposure = (index, *exposure)
        navigation_steps = model.photo_count
    else:
        raise FragmentPrerequisite('CONTROL_PRIMITIVE_KIND_NOT_BOUND')
    if model.channel_retention_ref == 'final_only':
        observed = (index,)
    elif model.channel_retention_ref == 'all_intermediates':
        observed = exposure
    else:
        raise FragmentPrerequisite('ACTUAL_CHANNEL_FRAME_RETENTION_MISSING')
    if len(exposure) > budget.request.domain_bound:
        raise DComputationInterrupted('PLAYBACK_EXPOSURE_DOMAIN_BOUND', d_map({
            'primitive_ref': primitive.primitive_ref, 'exposure_count': len(exposure)}))
    for exposure_index, photo_index in enumerate(exposure):
        budget.visit({'primitive_ref': primitive.primitive_ref, 'exposure_index': exposure_index,
                      'photo_index': photo_index})
    return {'before_state': state, 'photo_primitive': primitive,
        'state': state.model_copy(update={'current_index': index}), 'commands': 1,
        'navigation_steps': navigation_steps, 'index_displacement': index - state.current_index,
        'exposed_indices': exposure, 'retained_indices': observed, 'debit': costs[0],
        'intermediate_action_choice_available': False}


def _word_image(model, state, word, request, budget):
    rows = []
    if len(set(item.primitive_ref for item in word.primitives)) != len(word.primitives):
        raise FragmentPrerequisite('PREPARATION_INPUT_OWNER_REUSED')
    for index, primitive in enumerate(word.primitives):
        if index >= request.depth_bound:
            raise DComputationInterrupted('PHOTO_WORD_DEPTH_BOUND', d_map({
                'word_ref': word.word_ref, 'next_primitive_index': index, 'state': state, 'trace': tuple(rows)}))
        row = _transport(model, state, primitive, budget)
        rows.append(d_map({'primitive_ref': primitive.primitive_ref, 'result': d_map(row)}))
        state = row['state']
    return {'state': state, 'trace': tuple(rows), 'commands': len(rows),
        'navigation_steps': sum(row['result']['navigation_steps'] for row in rows),
        'debit': sum(row['result']['debit'] for row in rows),
        'retained_indices': tuple(index for row in rows for index in row['result'].get('retained_indices', ())) }


def _ingest(request, budget):
    if not request.acquired_packet_ref or not request.packet_owner_ref or not request.observations:
        raise FragmentPrerequisite('SEALED_ACQUISITION_PACKET_SCOPE_MISSING')
    photos, feedback, order = [], [], -1
    for position, sample in enumerate(request.observations):
        budget.visit({'packet_position': position})
        if sample.get('sealed') is not True or sample.get('packet_ref') != request.acquired_packet_ref or sample.get('owner_ref') != request.packet_owner_ref:
            raise FragmentPrerequisite('SEALED_SINGLE_OWNER_PACKET_MISSING')
        frame_order = sample.get('frame_order')
        if type(frame_order) is not int or frame_order <= order:
            raise FragmentPrerequisite('STRICT_ORDERED_FRAME_PROVENANCE_MISSING')
        order = frame_order
        if sample.get('content_kind_ref') == 'acquired_photo_content':
            photo = FragmentPhoto.model_validate(sample.get('photo'))
            if sample.get('visible_selected_index') != photo.photo_index or not sample.get('selection_evidence_ref'):
                raise FragmentPrerequisite('FRAME_OWN_SELECTION_NOT_OBSERVED')
            if photo.content_kind_ref != 'acquired_photo_content' or sample.get('visible_scene_ref') != photo.scene_ref or sample.get('visible_film_revision_ref') != photo.film_revision_ref:
                raise FragmentPrerequisite('FRAME_OWN_PHOTO_SCENE_OR_FILM_CONTEXT_NOT_OBSERVED')
            photos.append(d_map({'photo': photo, 'frame_order': frame_order,
                'observed_visible_selected_index': sample['visible_selected_index'],
                'observed_visible_scene_ref': sample['visible_scene_ref'],
                'observed_visible_film_revision_ref': sample['visible_film_revision_ref'],
                'observed_content_kind_ref': sample['content_kind_ref'],
                'selection_evidence_ref': sample['selection_evidence_ref'],
                'packet_ref': request.acquired_packet_ref, 'already_archived': photo.photo_ref in request.prior_archive_refs}))
        else:
            feedback.append(d_map({'frame_order': frame_order, 'evidence_ref': sample.get('evidence_ref'),
                'content_kind_ref': sample.get('content_kind_ref'), 'feedback_cue_refs': sample.get('feedback_cue_refs', ())}))
    return {'proposed_photo_archive_delta': tuple(photos), 'feedback_samples': tuple(feedback),
        'acquisition_packet_ref': request.acquired_packet_ref, 'acquisition_owner_ref': request.packet_owner_ref,
        'acquisition_frame_count': len(request.observations),
        'observed_indices': tuple(sorted(set(row['photo']['photo_index'] for row in photos))),
        'stable_final_view': request.observations[-1].get('stable_final_view'),
        'duplicates_with_provenance_retained': True, 'archive_publication_authorized': False,
        'raw_packet_rejournal_authorized': False, 'inter_frame_act_authorized': False}


def _input_binding(request, primitive):
    matches = tuple(item for item in request.input_bindings if item.kind_ref == primitive.kind_ref
        and item.index == (primitive.target_index if primitive.kind_ref == 'seek' else None))
    if len(matches) != 1 or matches[0].evidence_revision_ref != request.scope.evidence_revision_ref:
        raise FragmentPrerequisite('CURRENT_NATIVE_INPUT_BINDING_NOT_UNIQUE')
    return d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload})


def _compile(model, request, budget):
    window = request.bound_window
    if window is None or request.state is None or request.reference is None:
        raise FragmentPrerequisite('BOUND_CANDIDATE_REFERENCE_AND_CURRENT_CONTROL_MISSING')
    if request.candidate_evidence_revision_ref != request.scope.evidence_revision_ref:
        raise FragmentPrerequisite('CANDIDATE_EVIDENCE_REVISION_NOT_CURRENT')
    match = _compare_window(model, request, window, budget)
    if not match['exact_match']:
        raise FragmentPrerequisite('BOUND_WINDOW_IS_NOT_AN_EXACT_CANDIDATE')
    state, external = request.state, ()
    if request.preparation_word is not None:
        image = _word_image(model, state, request.preparation_word, request, budget)
        state = image['state']
        external = tuple(_input_binding(request, primitive) for primitive in request.preparation_word.primitives)
    if request.post_preparation_observation_required is None:
        raise FragmentPrerequisite('POST_PREPARATION_OBSERVATION_DEPENDENCY_MISSING')
    if request.post_preparation_observation_required:
        return {'external_word': external, 'stops_before_submission': True,
                'expected_control_state': state, 'reference_revision_ref': request.reference_revision_ref}
    photo = _photo(request, window)
    if state.current_index != photo.photo_index:
        raise FragmentPrerequisite('MATCHING_REMEMBERED_PHOTO_NOT_ACTIVE')
    if state.scene_ref != photo.scene_ref or state.film_revision_ref != photo.film_revision_ref or state.reference_revision_ref != request.reference_revision_ref:
        raise FragmentPrerequisite('PREPARATION_INVALIDATED_CANDIDATE_SCENE_FILM_OR_REFERENCE')
    transforms = tuple(item for item in request.transforms if item.photo_ref == photo.photo_ref)
    if len(transforms) != 1 or request.local_interior_point is None:
        raise FragmentPrerequisite('PHOTO_NATIVE_TRANSFORM_OR_SOURCE_BOUND_INTERIOR_POINT_MISSING')
    transform = transforms[0]
    if transform.scene_ref != state.scene_ref or transform.evidence_revision_ref != request.scope.evidence_revision_ref or transform.geometry_status_ref not in request.permitted_geometry_status_refs:
        raise FragmentPrerequisite('CURRENT_OR_CERTIFIED_NATIVE_PHOTO_TRANSFORM_MISSING')
    row, column = request.local_interior_point
    if not window.top <= row < window.top + request.reference.height or not window.left <= column < window.left + request.reference.width:
        raise FragmentPrerequisite('PROPOSAL_POINT_OUTSIDE_EXACT_WINDOW')
    if transform.row_payload_key == transform.column_payload_key:
        raise FragmentPrerequisite('NATIVE_COORDINATE_KEYS_NOT_DISTINCT')
    point = (transform.native_row_origin + row * transform.row_scale,
             transform.native_column_origin + column * transform.column_scale)
    if len(external) + 1 > request.depth_bound:
        raise DComputationInterrupted('PROPOSAL_WORD_DEPTH_BOUND', d_map({
            'prepared_prefix': external, 'submission_not_compiled': True}))
    payload = FrozenMap.overlay(transform.payload_template,
        {transform.row_payload_key: point[0], transform.column_payload_key: point[1]})
    return {'external_word': (*external, d_map({'action_ref': transform.action_ref, 'payload': payload})),
        'reference_revision_ref': request.reference_revision_ref, 'active_photo_index': state.current_index,
        'native_point': point, 'point_color_not_used_as_acceptance': True,
        'frozen_prerequisites': request.scope.assumption_refs, 'release_authorized': False}


def _feedback(request, budget):
    if not request.observations or not request.acquired_packet_ref or not request.packet_owner_ref:
        raise FragmentPrerequisite('SEALED_FEEDBACK_PACKET_SCOPE_MISSING')
    contract = request.feedback_contract
    if contract is None or not contract.observation_domain_complete:
        raise FragmentPrerequisite('COMPLETE_ONE_ATTEMPT_FEEDBACK_CONTRACT_REQUIRED')
    if len(request.observations) > request.domain_bound:
        raise FragmentPrerequisite('FEEDBACK_SAMPLE_DOMAIN_BOUND')
    rows, order = [], -1
    kinds = ('ignored_click_evidence_ref', 'rejection_evidence_ref', 'accepted_region_evidence_ref',
        'new_scene_evidence_ref', 'completion_evidence_ref')
    evidence = {kind: [] for kind in kinds}
    for index, sample in enumerate(request.observations):
        budget.visit({'feedback_sample_index': index})
        if sample.get('sealed') is not True or sample.get('packet_ref') != request.acquired_packet_ref or sample.get('owner_ref') != request.packet_owner_ref:
            raise FragmentPrerequisite('SEALED_FEEDBACK_OWNER_MISSING')
        if sample.get('attempt_ref') != contract.attempt_ref or sample.get('primitive_ref') != contract.primitive_ref:
            raise FragmentPrerequisite('FEEDBACK_FRAMES_MUST_BELONG_TO_ONE_ATTEMPT_AND_INPUT')
        frame_order = sample.get('frame_order')
        if type(frame_order) is not int or frame_order <= order:
            raise FragmentPrerequisite('STRICT_ORDERED_FEEDBACK_FRAME_PROVENANCE_REQUIRED')
        order = frame_order
        for kind in kinds:
            budget.visit({'feedback_sample_index': index, 'evidence_kind': kind})
            ref = sample.get(kind)
            if ref is not None:
                if not isinstance(ref, str) or not ref:
                    raise FragmentPrerequisite('EXACT_FEEDBACK_EVIDENCE_REFERENCE_REQUIRED')
                if ref not in evidence[kind]:
                    evidence[kind].append(ref)
        rows.append(d_map({'sample_index': index, 'feedback_cue_refs': sample.get('feedback_cue_refs', ()),
            'frame_order': frame_order, 'attempt_ref': contract.attempt_ref, 'primitive_ref': contract.primitive_ref,
            'ignored_click_evidence_ref': sample.get('ignored_click_evidence_ref'),
            'rejection_evidence_ref': sample.get('rejection_evidence_ref'),
            'accepted_region_evidence_ref': sample.get('accepted_region_evidence_ref'),
            'new_scene_evidence_ref': sample.get('new_scene_evidence_ref'),
            'completion_evidence_ref': sample.get('completion_evidence_ref')}))
    before, after = contract.before, contract.after
    same_scene = before.scene_ref == after.scene_ref
    same_film = before.film_revision_ref == after.film_revision_ref
    same_reference = before.reference_revision_ref == after.reference_revision_ref
    attempt_delta = after.attempt_count - before.attempt_count
    accepted_delta = after.accepted_count - before.accepted_count
    # Flashes are observations of one input, not one input per frame.
    if same_scene and same_film and same_reference and (attempt_delta not in (0, 1) or accepted_delta not in (0, 1)):
        raise FragmentPrerequisite('CONTROL_COUNTERS_CONTRADICT_ONE_ATTEMPT')
    official_present = contract.official_evidence_ref is not None
    if (contract.official_completion is not None or contract.official_before_score is not None
            or contract.official_after_score is not None) and not official_present:
        raise FragmentPrerequisite('OFFICIAL_TRANSITION_EVIDENCE_REQUIRED')
    facts = d_map({'ignored_click_evidence_present': bool(evidence['ignored_click_evidence_ref']),
        'rejection_evidence_present': bool(evidence['rejection_evidence_ref']),
        'accepted_region_evidence_present': bool(evidence['accepted_region_evidence_ref']),
        'new_scene_evidence_present': bool(evidence['new_scene_evidence_ref']),
        'completion_evidence_present': bool(evidence['completion_evidence_ref']),
        'attempt_counter_delta': attempt_delta, 'accepted_counter_delta': accepted_delta,
        'same_scene': same_scene, 'same_film': same_film, 'same_reference': same_reference,
        'official_evidence_present': official_present, 'official_completion': contract.official_completion,
        'official_before_score': contract.official_before_score, 'official_after_score': contract.official_after_score,
        'one_attempt_frame_count': len(rows), 'input_count': 1,
        'final_ready_does_not_override_packet_evidence': True})
    return {'ordered_feedback_evidence': tuple(rows), 'attempt_owner_ref': request.packet_owner_ref,
        'feedback_contract': d_map(contract), 'feedback_descriptive_facts': facts,
        'before_control_state': d_map(before), 'after_control_state': d_map(after),
        'feedback_evidence_refs': tuple(dict.fromkeys((contract.before_evidence_ref, contract.after_evidence_ref,
            *(ref for kind in kinds for ref in evidence[kind]), *((contract.official_evidence_ref,) if official_present else ())))),
        'old_scene_binding_refs': contract.old_scene_binding_refs,
        'scene_binding_change_measured': not (same_scene and same_film and same_reference),
        'raw_photo_archive_unchanged': True, 'earlier_rejection_not_erased_by_final_ready': True,
        'canonical_mutation_authorized': False}


def _external(model, request, budget):
    if request.state is None or request.primitive is None:
        raise FragmentPrerequisite('CURRENT_CONTROL_AND_EXACT_PRIMITIVE_MISSING')
    primitive, state = request.primitive, request.state
    if primitive.kind_ref != 'proposal':
        row = _transport(model, state, primitive, budget)
        accepted = False
    else:
        if request.bound_window is None or request.local_interior_point is None or request.reference is None:
            raise FragmentPrerequisite('BOUND_PROPOSAL_WINDOW_AND_INTERIOR_POINT_MISSING')
        photo = _photo(request, request.bound_window)
        if photo.photo_index != state.current_index:
            raise FragmentPrerequisite('PROPOSAL_PHOTO_NOT_ACTIVE')
        if model.proposal_law_ref != 'full_reference_equality_at_active_window':
            raise FragmentPrerequisite('SUPPORTED_PROPOSAL_EQUALITY_LAW_MISSING')
        local_row, local_column = request.local_interior_point
        inside = request.bound_window.top <= local_row < request.bound_window.top + request.reference.height and request.bound_window.left <= local_column < request.bound_window.left + request.reference.width
        if not inside:
            raise FragmentPrerequisite('OUTSIDE_PROPOSAL_IGNORED_OR_REJECTED_LAW_MISSING')
        match = _compare_window(model, request, request.bound_window, budget)
        accepted = inside and match['exact_match']
        costs = tuple(cost for ref, cost in model.input_costs if ref == 'proposal')
        if len(costs) != 1 or costs[0] < 0:
            raise FragmentPrerequisite('ONE_PROPOSAL_ATTEMPT_COST_MISSING')
        following = state.model_copy(update={'attempt_count': state.attempt_count + 1,
            'accepted_count': state.accepted_count + int(accepted)})
        if accepted and model.terminal_after_acceptance_ref not in ('no_scene_installation', 'acceptance_quota_complete'):
            raise FragmentPrerequisite('POST_ACCEPTANCE_OR_NEW_SCENE_INSTALLATION_LAW_MISSING')
        if accepted and model.terminal_after_acceptance_ref == 'acceptance_quota_complete' and model.required_acceptances is None:
            raise FragmentPrerequisite('EXPLICIT_ACCEPTANCE_QUOTA_MISSING')
        complete = accepted and model.terminal_after_acceptance_ref == 'acceptance_quota_complete' and following.accepted_count >= model.required_acceptances
        row = {'state': following, 'debit': costs[0], 'commands': 1, 'navigation_steps': 0,
            'exposed_indices': (), 'accepted': accepted, 'complete': complete,
            'proposal_comparison': d_map(match), 'new_scene_not_invented': True}
    row.update({'automatic_pass_already_owned': True, 'cost_already_owned': True,
                'event_owner_ref': request.scope.event_owner_ref})
    row['event_ledger'] = (d_map({'owner_ref': request.scope.event_owner_ref,
        'primitive_ref': primitive.primitive_ref, 'input_kind': primitive.kind_ref, 'debit': row['debit'],
        'exposed_indices': row['exposed_indices'], 'accepted': accepted, 'complete': row.get('complete', False),
        'direct_automatic_cost_acceptance_owned': True}),)
    return row


def measure_temporal_fragment_match(request: TemporalFragmentRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if operation in ('measure_regions', 'read_photo_control'):
            if (not request.frame_ref or request.frame_epoch != request.scope.epoch
                    or request.frame_evidence_revision_ref != request.scope.evidence_revision_ref
                    or not request.observed_scene_ref
                    or any(layout.scene_ref != request.observed_scene_ref for layout in request.panel_layouts)):
                raise FragmentPrerequisite('CURRENT_PANEL_FRAME_IDENTITY_EPOCH_AND_EVIDENCE_REQUIRED')
            values = {'frame_ref': request.frame_ref,
                'panel_layout_alternatives': measure_panel_regions_d(request.observed_frame, request.panel_layouts, budget)
                    if operation == 'measure_regions' else measure_indexed_control_d(request.observed_frame, request.panel_layouts, budget),
                'scene_photo_proposal_and_calibration_not_selected': True}
            return d_result(request, 'OK', 'EXACT_SOURCE_BOUND_CURRENT_PANEL_MEASUREMENT',
                values=values, complete=True, examined=budget.examined)
        if operation == 'memory_scope':
            values = _memory_scope(request, budget)
        elif operation == 'ingest_packet':
            values = _ingest(request, budget)
        elif operation == 'reconcile_feedback':
            values = _feedback(request, budget)
        else:
            if not request.models:
                raise FragmentPrerequisite('SCOPED_FRAGMENT_MODELS_MISSING')
            rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
            for model in request.models[len(rows):]:
                current_model_ref = model.model_ref
                budget.visit()
                if operation in ('exact_candidates', 'discriminants'):
                    if len(set(window.window_ref for window in request.windows)) != len(request.windows):
                        raise FragmentPrerequisite('REQUESTED_WINDOW_IDENTITIES_NOT_UNIQUE')
                    if len(request.windows) > request.domain_bound:
                        raise DComputationInterrupted('PHOTO_WINDOW_DOMAIN_BOUND', d_map({'window_count': len(request.windows)}))
                    differences = operation == 'discriminants'
                    if differences and model.descriptive_distance_ref != 'hamming_pixel_count':
                        raise FragmentPrerequisite('DECLARED_DESCRIPTIVE_DISTANCE_MISSING')
                    matches = []
                    for window in request.windows:
                        result = _compare_window(model, request, window, budget, differences=differences)
                        if differences:
                            result['descriptive_distance'] = len(result['counterexample_pixels'])
                            result['acceptance_predicate_unchanged'] = True
                        matches.append(d_map(result))
                    exact = tuple(result['window_ref'] for result in matches if result['exact_match'])
                    row = {'window_results': tuple(matches), 'exact_window_refs': exact,
                        'covered_window_refs': tuple(window.window_ref for window in request.windows),
                        'unique_in_declared_window_domain': len(exact) == 1,
                        'absent_in_declared_window_domain': not exact}
                elif operation == 'transport_model':
                    if request.state is None or request.primitive is None:
                        raise FragmentPrerequisite('CURRENT_INDEX_AND_CONTROL_PRIMITIVE_MISSING')
                    row = _transport(model, request.state, request.primitive, budget)
                elif operation == 'information_request':
                    if request.state is None or not request.current_question_ref or not request.information_words:
                        raise FragmentPrerequisite('CURRENT_QUESTION_AND_SOURCE_REQUESTED_EXPERIMENTS_MISSING')
                    experiments = []
                    for word in request.information_words:
                        image = _word_image(model, request.state, word, request, budget)
                        exposed = frozenset(image['retained_indices'])
                        experiments.append(d_map({'word_ref': word.word_ref, 'image': d_map(image),
                            'exposes_unseen_indices': tuple(sorted(exposed & set(request.unseen_indices))),
                            'current_question_ref': request.current_question_ref,
                            'candidate_photo_refs_exposed': tuple(sorted(set(photo.photo_ref for photo in request.photos if photo.photo_index in exposed)))}))
                    row = {'experiment_results': tuple(experiments), 'experiment_selection_authorized': False}
                elif operation == 'compile_proposal':
                    row = _compile(model, request, budget)
                elif operation == 'external_primitive':
                    row = _external(model, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
                rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
            values = {'model_correlated_results': tuple(rows)}
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values=values, complete=True, examined=budget.examined)
    except (FragmentPrerequisite, DResumeMismatch) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
