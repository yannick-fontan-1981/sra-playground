"""Indexed finite visual programs; exact rasters, clocks and answer controls.

Source binds the supplied grammar, masks, model alternatives and proposal. This
kernel never credits a unique generating law from one right answer.
"""

from __future__ import annotations

from collections import deque
from typing import ClassVar, Literal
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .indexed_panel_measurement_d import DPanelLayout, measure_panel_regions_d, measure_indexed_control_d


class SequencePanelLayout(FrozenModel):
    question_ref: Ref
    panels: DPanelLayout
    missing_index: int = Field(ge=0, le=4095)
    proposal_regions: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=256)


class SequenceRowControls(FrozenModel):
    panels: DPanelLayout
    question_indices: tuple[tuple[int, Ref], ...] = Field(min_length=1, max_length=256)


class SequenceSlot(FrozenModel):
    slot_ref: Ref
    index: int = Field(ge=0, le=4095)
    raster: FrameGrid | None
    evidence_ref: Ref
    content_status_ref: Ref


class SequenceFeatureMask(FrozenModel):
    binding_ref: Ref
    feature_ref: Ref
    slot_ref: Ref
    evidence_ref: Ref
    mask: tuple[tuple[int, int], ...] = Field(max_length=4096)
    measurement_ref: Literal['shape_mask', 'palette_histogram', 'pixel_count',
        'row_min', 'column_min', 'height', 'width', 'fill_numerator',
        'bounding_area', 'centroid_row_fraction', 'centroid_column_fraction']


class SequenceFeatureDecomposition(FrozenModel):
    decomposition_ref: Ref
    evidence_revision_ref: Ref
    method_ref: Literal['palette_layers', 'equal_value_components', 'source_masks']
    connectivity: Literal[4, 8]
    mask_bindings: tuple[SequenceFeatureMask, ...] = Field(default=(), max_length=4096)


class SequenceClock(FrozenModel):
    clock_ref: Ref
    law_ref: Ref
    period: int | None = Field(default=None, ge=1, le=4096)
    residue: int | None = Field(default=None, ge=0, le=4095)
    phase: int = 0


class FeatureProgram(FrozenModel):
    program_ref: Ref
    feature_ref: Ref
    clock_ref: Ref
    law_ref: Ref
    cycle_values: tuple[int | Ref, ...] = Field(default=(), max_length=4096)
    cycle_origin: int = Field(default=0, ge=0)
    start: int | None = None
    step: int | None = None
    increment_step: int | None = None
    lower: int | None = None
    upper: int | None = None
    model_assignments: FrozenMap = Field(default_factory=FrozenMap)


class RasterInstruction(FrozenModel):
    instruction_ref: Ref
    kind_ref: Ref
    lag: int = Field(default=1, ge=1, le=4096)
    second_lag: int | None = Field(default=None, ge=1, le=4096)
    quarter_turns: int = Field(default=0, ge=0, le=3)
    row_delta: int = 0
    column_delta: int = 0
    clipping_law_ref: Ref | None = None
    palette_map: tuple[tuple[int, int], ...] = Field(default=(), max_length=256)


class FeatureLayer(FrozenModel):
    layer_ref: Ref
    feature_ref: Ref
    value: int | Ref
    raster: FrameGrid
    mask: tuple[tuple[int, int], ...] = Field(default=(), max_length=65536)
    model_assignments: FrozenMap = Field(default_factory=FrozenMap)


class SequenceModel(FrozenModel):
    model_ref: Ref
    clocks: tuple[SequenceClock, ...] = Field(default=(), max_length=64)
    feature_programs: tuple[FeatureProgram, ...] = Field(default=(), max_length=64)
    raster_instructions: tuple[RasterInstruction, ...] = Field(default=(), max_length=64)
    background_value: int | None = Field(default=None, ge=0, le=255)
    render_height: int | None = Field(default=None, ge=1, le=256)
    render_width: int | None = Field(default=None, ge=1, le=256)
    feature_layers: tuple[FeatureLayer, ...] = Field(default=(), max_length=4096)
    render_order: tuple[Ref, ...] = Field(default=(), max_length=64)
    overlap_law_ref: Ref | None = None
    exact_comparison_law_ref: Ref | None = None
    navigation_law_ref: Ref | None = None
    click_law_ref: Ref | None = None
    next_row_law_ref: Ref | None = None
    accepted_persistence_law_ref: Ref | None = None
    completion_law_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    reset_state: 'SequenceControlState | None' = None
    reset_cost: int | None = Field(default=None, ge=0)


class SequenceProposal(FrozenModel):
    proposal_ref: Ref
    question_ref: Ref
    evidence_revision_ref: Ref
    raster: FrameGrid


class SequenceControlState(FrozenModel):
    question_order: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    active_question_ref: Ref | None
    focused_proposal_ref: Ref | None
    accepted_question_refs: tuple[Ref, ...] = Field(default=(), max_length=256)
    attempt_count: int = Field(default=0, ge=0)


class SequenceAnswerBinding(FrozenModel):
    question_ref: Ref
    proposal_ref: Ref | None = None
    kind_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


SequenceModel.model_rebuild()


_CASES = (
    ('layout_measure', ('MEASURE',)), ('feature_factorization', ('MEASURE',)),
    ('clock_partition', ('DOMAIN',)), ('transition_fit', ('FIT',)),
    ('raster_recurrence', ('FIT', 'PREDICT')), ('missing_term_composition', ('COMPOSE',)),
    ('proposal_match', ('MATCH',)), ('answer_commitment', ('COMPILE',)),
    ('answer_reconciliation', ('RECONCILE',)), ('hypothesis_discrimination', ('PROBE', 'COMPARE')),
    ('external_primitive', ('STEP',)),
)


class VisualSequenceRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.visual_sequence_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.visual_sequence.{operation}', mode) for operation, modes in _CASES for mode in modes)
    models: tuple[SequenceModel, ...] = Field(default=(), max_length=32)
    slots: tuple[SequenceSlot, ...] = Field(default=(), max_length=4096)
    missing_index: int | None = Field(default=None, ge=0, le=4095)
    question_ref: Ref | None = None
    proposals: tuple[SequenceProposal, ...] = Field(default=(), max_length=256)
    feature_observations: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    predicted_rasters: tuple[tuple[Ref, FrameGrid], ...] = Field(default=(), max_length=32)
    discrimination_indices: tuple[int, ...] = Field(default=(), max_length=4096)
    control_state: SequenceControlState | None = None
    action_kind: Ref | None = None
    target_question_ref: Ref | None = None
    bound_proposal_ref: Ref | None = None
    prediction_evidence_refs: tuple[tuple[Ref, Ref, Ref], ...] = Field(default=(), max_length=32)
    answer_bindings: tuple[SequenceAnswerBinding, ...] = Field(default=(), max_length=1024)
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    frame_evidence_revision_ref: Ref | None = None
    observed_scene_ref: Ref | None = None
    question_panel_layouts: tuple[SequencePanelLayout, ...] = Field(default=(), max_length=32)
    row_control_layouts: tuple[SequenceRowControls, ...] = Field(default=(), max_length=32)
    feature_decompositions: tuple[SequenceFeatureDecomposition, ...] = Field(default=(), max_length=32)


class SequencePrerequisite(Exception):
    pass


def _layout_measure(request, budget):
    if (request.observed_frame is None or not request.frame_ref or not request.observed_scene_ref
            or request.frame_epoch != request.scope.epoch
            or request.frame_evidence_revision_ref != request.scope.evidence_revision_ref
            or not request.question_panel_layouts or not request.row_control_layouts):
        raise SequencePrerequisite('CURRENT_SEQUENCE_FRAME_SCENE_AND_SOURCE_PANEL_LAYOUTS_REQUIRED')
    if max(len(request.question_panel_layouts), len(request.row_control_layouts),
            len(request.answer_bindings)) > request.domain_bound:
        raise DComputationInterrupted('SEQUENCE_LAYOUT_DOMAIN_BOUND', d_map())
    question_refs = {candidate.question_ref for candidate in request.question_panel_layouts}
    layout_refs = tuple(candidate.panels.layout_ref for candidate in request.question_panel_layouts)
    control_refs = tuple(candidate.panels.layout_ref for candidate in request.row_control_layouts)
    if len(set(layout_refs)) != len(layout_refs) or len(set(control_refs)) != len(control_refs):
        raise SequencePrerequisite('UNIQUE_SEQUENCE_LAYOUT_ALTERNATIVES_REQUIRED')
    if any(binding.question_ref not in question_refs for binding in request.answer_bindings):
        raise SequencePrerequisite('NATIVE_BINDING_QUESTION_NOT_IN_CURRENT_LAYOUT_DOMAIN')
    questions = []
    for candidate in request.question_panel_layouts:
        panels = candidate.panels
        if panels.scene_ref != request.observed_scene_ref:
            raise SequencePrerequisite('QUESTION_PANEL_LAYOUT_NOT_CURRENT_SCENE')
        regions = {region.region_ref: region for region in panels.regions}
        if any(slot.region_ref not in regions or regions[slot.region_ref].purpose_ref != 'QUESTION_CARD' for slot in panels.slots):
            raise SequencePrerequisite('ORDERED_SEQUENCE_SLOTS_MUST_BE_QUESTION_CARDS_NOT_PROPOSALS')
        gaps = tuple(slot for slot in panels.slots if slot.content_status_ref == 'MISSING')
        if len(gaps) != 1 or gaps[0].index != candidate.missing_index:
            raise SequencePrerequisite('EXPLICIT_ORIGINAL_MISSING_SLOT_INDEX_REQUIRED')
        if (len({ref for ref, _ in candidate.proposal_regions}) != len(candidate.proposal_regions)
                or len({ref for _, ref in candidate.proposal_regions}) != len(candidate.proposal_regions)
                or any(region_ref not in regions or regions[region_ref].purpose_ref != 'PROPOSAL' for region_ref, _ in candidate.proposal_regions)):
            raise SequencePrerequisite('UNIQUE_SEPARATE_PROPOSAL_REGION_IDENTITIES_REQUIRED')
        measured = measure_panel_regions_d(request.observed_frame, (panels,), budget)[0]
        by_region = {region['region_ref']: region for region in measured['regions']}
        slots = []
        for slot in measured['ordered_slots']:
            budget.visit({'question_ref': candidate.question_ref, 'original_index': slot['index']})
            content = by_region[slot['region_ref']]
            raster = content['local_raster'] if slot['content_status_ref'] == 'VISIBLE' and content['sampling_compatible'] else None
            slots.append(d_map({'slot_ref': slot['slot_ref'], 'index': slot['index'],
                'source_content_status_ref': slot['content_status_ref'], 'raster': raster,
                'measured_panel': content, 'unknown_or_missing_not_black_content': raster is None}))
        proposal_regions = tuple(d_map({'proposal_ref': proposal_ref, 'question_ref': candidate.question_ref,
            'measured_panel': by_region[region_ref]}) for region_ref, proposal_ref in candidate.proposal_regions)
        bindings = tuple(binding for binding in request.answer_bindings if binding.question_ref == candidate.question_ref)
        proposal_refs = {proposal_ref for _, proposal_ref in candidate.proposal_regions}
        if any(binding.evidence_revision_ref != request.scope.evidence_revision_ref
                or binding.proposal_ref is not None and binding.proposal_ref not in proposal_refs
                for binding in bindings):
            raise SequencePrerequisite('CURRENT_NATIVE_QUESTION_PROPOSAL_BINDINGS_REQUIRED')
        questions.append(d_map({'question_ref': candidate.question_ref, 'layout_ref': panels.layout_ref,
            'ordered_original_slots': tuple(slots), 'missing_index': candidate.missing_index,
            'separate_proposal_regions': proposal_regions, 'native_input_bindings': bindings,
            'native_click_supports': measured['native_click_supports'], 'measured_regions': measured['regions'],
            'cards_after_gap_remain_constraints': True, 'question_proposal_or_completion_not_selected': True}))
    controls = []
    for candidate in request.row_control_layouts:
        if candidate.panels.scene_ref != request.observed_scene_ref:
            raise SequencePrerequisite('ACTIVE_ROW_CONTROL_NOT_CURRENT_SCENE')
        indices = dict(candidate.question_indices)
        row_questions = tuple(question_ref for _, question_ref in candidate.question_indices)
        if (len(indices) != len(candidate.question_indices)
                or len(set(row_questions)) != len(indices)
                or set(indices) != {slot.index for slot in candidate.panels.slots}
                or any(question_ref not in question_refs for question_ref in row_questions)):
            raise SequencePrerequisite('COMPLETE_ROW_INDEX_TO_QUESTION_BINDING_REQUIRED')
        measured = measure_indexed_control_d(request.observed_frame, (candidate.panels,), budget)[0]
        active = measured['current_active_index']
        controls.append(d_map({'layout_ref': candidate.panels.layout_ref, 'measured_row_markers': measured,
            'current_active_question_ref': indices[active] if active is not None else None,
            'possible_active_question_refs': tuple(indices[index] for index in measured['possible_active_indices']),
            'archived_question_or_accepted_receipt_not_current_row_mark': True}))
    budget.finish()
    return {'frame_ref': request.frame_ref, 'question_layout_alternatives': tuple(questions),
        'current_row_control_alternatives': tuple(controls), 'visual_roles_and_missing_slot_meaning_source_owned': True}


def _validate_slots(request):
    if not request.slots or len(set(slot.index for slot in request.slots)) != len(request.slots):
        raise SequencePrerequisite('ORIGINAL_SLOT_SEQUENCE_OR_UNIQUE_INDICES_MISSING')
    if len(set(slot.slot_ref for slot in request.slots)) != len(request.slots):
        raise SequencePrerequisite('SLOT_IDENTITIES_NOT_UNIQUE')
    for slot in request.slots:
        if slot.content_status_ref not in ('observed_raster', 'explicit_missing', 'masked_unknown'):
            raise SequencePrerequisite('SLOT_CONTENT_STATUS_NOT_QUALIFIED')
        if slot.content_status_ref == 'observed_raster' and slot.raster is None:
            raise SequencePrerequisite('OBSERVED_SLOT_RASTER_MISSING')
        if slot.content_status_ref in ('explicit_missing', 'masked_unknown') and slot.raster is not None:
            raise SequencePrerequisite('UNKNOWN_SLOT_WAS_FILLED_WITH_GUESSED_CONTENT')
    # Never renumber positions after an interior gap.
    return tuple(sorted(request.slots, key=lambda slot: slot.index))


def _feature_mask_description(raster, mask, budget):
    if len(set(mask)) != len(mask):
        raise SequencePrerequisite('FEATURE_MASK_REPEATS_NATIVE_PIXEL')
    histogram, row_runs, values = {}, [], []
    top = left = bottom = right = None
    row_sum = column_sum = 0
    for row, column in sorted(mask):
        budget.visit({'feature_native_pixel': (row, column)})
        if not 0 <= row < raster.height or not 0 <= column < raster.width:
            raise SequencePrerequisite('FEATURE_MASK_OUTSIDE_EXACT_CARD_RASTER')
        value = raster.rows[row][column]
        top = row if top is None else min(top, row)
        bottom = row if bottom is None else max(bottom, row)
        left = column if left is None else min(left, column)
        right = column if right is None else max(right, column)
        row_sum += row
        column_sum += column
        histogram[value] = histogram.get(value, 0) + 1
        values.append((row, column, value))
        if row_runs and row_runs[-1][0] == row and row_runs[-1][2] + 1 == column:
            row_runs[-1] = (row, row_runs[-1][1], column)
        else:
            row_runs.append((row, column, column))
    if mask:
        shape = []
        for row, column in sorted(mask):
            budget.visit({'normalized_mask_pixel': (row, column)})
            shape.append((row - top, column - left))
        support = set(mask)
        boundary = []
        for row, column in sorted(mask):
            for dr, dc in ((-1, 0), (0, -1), (0, 1), (1, 0)):
                budget.visit({'feature_boundary_pixel': (row, column), 'offset': (dr, dc)})
                if (row + dr, column + dc) not in support:
                    boundary.append((row, column, dr, dc))
        height, width = bottom - top + 1, right - left + 1
        bounds = top, left, bottom, right
    else:
        top = left = None
        height = width = 0
        bounds, shape, boundary = None, (), []
    return d_map({'native_mask': tuple(sorted(mask)), 'shape_mask': tuple(shape),
        'palette_histogram': tuple(sorted(histogram.items())), 'exact_mask_pixels': tuple(values),
        'pixel_count': len(mask), 'row_min': top, 'column_min': left,
        'height': height, 'width': width, 'native_bounds': bounds,
        'fill_numerator': len(mask), 'bounding_area': height * width,
        'centroid_row_fraction': (row_sum, len(mask)) if mask else None,
        'centroid_column_fraction': (column_sum, len(mask)) if mask else None,
        'row_runs': tuple(row_runs), 'exposed_four_neighbor_edges': tuple(boundary)})


def _feature_pixel_groups(raster, decomposition, budget):
    by_value = {}
    for row in range(raster.height):
        for column in range(raster.width):
            budget.visit({'card_pixel': (row, column)})
            by_value.setdefault(raster.rows[row][column], []).append((row, column))
    if decomposition.method_ref == 'palette_layers':
        return tuple(tuple(by_value[value]) for value in sorted(by_value))
    groups = []
    offsets = ((-1, 0), (0, -1), (0, 1), (1, 0))
    if decomposition.connectivity == 8:
        offsets = (*offsets, (-1, -1), (-1, 1), (1, -1), (1, 1))
    for value in sorted(by_value):
        unseen = set(by_value[value])
        for origin in by_value[value]:
            if origin not in unseen:
                continue
            queue, component = deque((origin,)), []
            unseen.remove(origin)
            while queue:
                point = queue.popleft()
                component.append(point)
                for dr, dc in offsets:
                    budget.visit({'component_pixel': point, 'offset': (dr, dc)})
                    neighbor = point[0] + dr, point[1] + dc
                    if neighbor in unseen:
                        unseen.remove(neighbor)
                        queue.append(neighbor)
            groups.append(tuple(sorted(component)))
    return tuple(groups)


def _feature_factorization(request, budget):
    if not request.question_ref or not request.feature_decompositions:
        raise SequencePrerequisite('CURRENT_QUESTION_AND_EXPLICIT_DECOMPOSITION_DOMAIN_REQUIRED')
    slots = _validate_slots(request)
    if max(len(slots), len(request.feature_decompositions)) > request.domain_bound:
        raise DComputationInterrupted('FEATURE_DECOMPOSITION_DOMAIN_BOUND', d_map())
    if len({row.decomposition_ref for row in request.feature_decompositions}) != len(request.feature_decompositions):
        raise SequencePrerequisite('UNIQUE_FEATURE_DECOMPOSITION_IDENTITIES_REQUIRED')
    slot_refs = {slot.slot_ref for slot in slots}
    alternatives, partitions, feature_tracks, unresolved_tracks = [], {}, [], []
    for decomposition in request.feature_decompositions:
        if decomposition.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise SequencePrerequisite('FEATURE_DECOMPOSITION_EVIDENCE_REVISION_STALE')
        bindings = decomposition.mask_bindings
        if len(bindings) > request.domain_bound:
            raise DComputationInterrupted('FEATURE_MASK_BINDING_DOMAIN_BOUND', d_map())
        if any(len(binding.mask) > request.domain_bound for binding in bindings):
            raise DComputationInterrupted('FEATURE_MASK_PIXEL_DOMAIN_BOUND', d_map())
        if (len({binding.binding_ref for binding in bindings}) != len(bindings)
                or len({(binding.feature_ref, binding.slot_ref) for binding in bindings}) != len(bindings)
                or any(binding.slot_ref not in slot_refs or not binding.evidence_ref for binding in bindings)):
            raise SequencePrerequisite('UNIQUE_SOURCE_FEATURE_BINDINGS_AND_RASTER_PROVENANCE_REQUIRED')
        if (decomposition.method_ref == 'source_masks') != bool(bindings):
            raise SequencePrerequisite('NAMED_MASK_DECOMPOSITION_REQUIRES_ONLY_ITS_EXPLICIT_BINDINGS')
        measurement_by_feature = {}
        for binding in bindings:
            previous = measurement_by_feature.setdefault(binding.feature_ref, binding.measurement_ref)
            if previous != binding.measurement_ref:
                raise SequencePrerequisite('SOURCE_FEATURE_TRACK_CHANGES_MEASUREMENT_MEANING')
        cards = []
        for slot in slots:
            if not slot.evidence_ref:
                raise SequencePrerequisite('EXACT_CARD_RASTER_PROVENANCE_REQUIRED')
            if slot.raster is None:
                unresolved_tracks.extend(d_map({'decomposition_ref': decomposition.decomposition_ref,
                    'sample_ref': binding.binding_ref, 'feature_ref': binding.feature_ref,
                    'slot_ref': slot.slot_ref, 'slot_index': slot.index,
                    'measurement_ref': binding.measurement_ref, 'evidence_ref': binding.evidence_ref,
                    'missing_raster_content_status_ref': slot.content_status_ref})
                    for binding in bindings if binding.slot_ref == slot.slot_ref)
                cards.append(d_map({'slot_ref': slot.slot_ref, 'original_index': slot.index,
                    'content_status_ref': slot.content_status_ref, 'unmeasured': True}))
                continue
            raster = slot.raster
            if raster.height * raster.width > request.domain_bound:
                raise DComputationInterrupted('FEATURE_CARD_PIXEL_DOMAIN_BOUND', d_map({'slot_ref': slot.slot_ref}))
            native_bindings = tuple(binding for binding in bindings if binding.slot_ref == slot.slot_ref)
            masks = tuple(binding.mask for binding in native_bindings) if bindings else _feature_pixel_groups(raster, decomposition, budget)
            descriptions = tuple(_feature_mask_description(raster, mask, budget) for mask in masks)
            membership = {}
            for description in descriptions:
                identity = stable_digest(description['native_mask'])
                for point in description['native_mask']:
                    budget.visit({'partition_pixel': point})
                    membership.setdefault(point, []).append(identity)
            partitions[(decomposition.decomposition_ref, slot.slot_ref)] = membership
            for binding, description in zip(native_bindings, descriptions):
                feature_tracks.append(d_map({'decomposition_ref': decomposition.decomposition_ref,
                    'sample_ref': binding.binding_ref, 'feature_ref': binding.feature_ref,
                    'slot_index': slot.index, 'slot_ref': slot.slot_ref,
                    'measurement_ref': binding.measurement_ref, 'value': description[binding.measurement_ref],
                    'evidence_ref': binding.evidence_ref, 'raster_evidence_ref': slot.evidence_ref,
                    'exact_mask': description['native_mask']}))
            cards.append(d_map({'slot_ref': slot.slot_ref, 'original_index': slot.index,
                'raster_evidence_ref': slot.evidence_ref, 'exact_raster': raster,
                'descriptions': descriptions, 'all_palette_values_preserved_in_exact_raster': True,
                'small_components_and_background_not_removed_from_exact_raster': True}))
        alternatives.append(d_map({'decomposition_ref': decomposition.decomposition_ref,
            'method_ref': decomposition.method_ref, 'connectivity': decomposition.connectivity,
            'ordered_cards': tuple(cards), 'identity_across_cards_not_inferred': True}))
    distinctions = []
    refs = tuple(row.decomposition_ref for row in request.feature_decompositions)
    for first_index, first in enumerate(refs):
        for second in refs[first_index + 1:]:
            for slot in slots:
                if slot.raster is None:
                    continue
                a, b = partitions[(first, slot.slot_ref)], partitions[(second, slot.slot_ref)]
                pixels = []
                for row in range(slot.raster.height):
                    for column in range(slot.raster.width):
                        point = row, column
                        budget.visit({'decomposition_pair': (first, second), 'slot_ref': slot.slot_ref, 'pixel': point})
                        if tuple(sorted(a.get(point, ()))) != tuple(sorted(b.get(point, ()))):
                            pixels.append((row, column, slot.raster.rows[row][column]))
                distinctions.append(d_map({'first_decomposition_ref': first, 'second_decomposition_ref': second,
                    'slot_ref': slot.slot_ref, 'original_index': slot.index, 'exact_discriminating_pixels': tuple(pixels)}))
    palette_by_value = {}
    for slot in slots:
        if slot.raster is None:
            continue
        masks = {}
        for row in range(slot.raster.height):
            for column in range(slot.raster.width):
                budget.visit({'palette_track_pixel': (row, column), 'slot_ref': slot.slot_ref})
                masks.setdefault(slot.raster.rows[row][column], []).append((row, column))
        for value, mask in sorted(masks.items()):
            palette_by_value.setdefault(value, {})[slot.slot_ref] = _feature_mask_description(slot.raster, tuple(mask), budget)
    palette_tracks = tuple(d_map({'native_palette_value': value,
        'samples': tuple(d_map({'slot_ref': slot.slot_ref, 'original_index': slot.index,
            'raster_evidence_ref': slot.evidence_ref,
            'description': by_slot.get(slot.slot_ref),
            'absence_observed': slot.raster is not None and slot.slot_ref not in by_slot,
            'raster_unknown': slot.raster is None}) for slot in slots),
        'literal_palette_correspondence_not_object_identity': True})
        for value, by_slot in sorted(palette_by_value.items()))
    budget.finish()
    return {'question_ref': request.question_ref, 'decomposition_alternatives': tuple(alternatives),
        'feature_tracks': tuple(feature_tracks), 'unresolved_feature_tracks': tuple(unresolved_tracks),
        'literal_palette_tracks': palette_tracks, 'unresolved_decomposition_refs': refs,
        'partition_discriminating_pixels': tuple(distinctions), 'final_exact_raster_verification_required': True,
        'mask_identity_marker_meaning_and_program_selection_source_owned': True}


def _rank(clock, index):
    if clock.law_ref in ('global_card_rank', 'concurrent_subobject_rank'):
        return index + clock.phase
    if clock.law_ref == 'interleaved_occurrence_rank':
        if clock.period is None or clock.residue is None or clock.residue >= clock.period:
            raise SequencePrerequisite('INTERLEAVED_CLOCK_PERIOD_OR_RESIDUE_MISSING')
        if index % clock.period != clock.residue:
            return None
        return (index - clock.residue) // clock.period + clock.phase
    raise SequencePrerequisite('SUPPLIED_CLOCK_LAW_UNSUPPORTED')


def _value(program, rank):
    if rank is None:
        return None
    if rank < 0:
        raise SequencePrerequisite('NEGATIVE_CLOCK_RANK_UNSUPPORTED')
    if program.law_ref == 'finite_cyclic_value':
        if not program.cycle_values or program.cycle_origin >= len(program.cycle_values):
            raise SequencePrerequisite('FINITE_CYCLE_OR_ORIGIN_MISSING')
        return program.cycle_values[(program.cycle_origin + rank) % len(program.cycle_values)]
    if program.start is None or program.step is None:
        raise SequencePrerequisite('NUMERIC_TRANSFORMATION_PARAMETERS_MISSING')
    if program.law_ref == 'arithmetic_value':
        return program.start + rank * program.step
    if program.law_ref == 'cumulative_arithmetic_increment':
        if program.increment_step is None:
            raise SequencePrerequisite('CUMULATIVE_INCREMENT_LAW_MISSING')
        return program.start + rank * program.step + rank * (rank - 1) // 2 * program.increment_step
    if program.law_ref == 'reflected_bounded_value':
        if program.lower is None or program.upper is None or program.upper < program.lower:
            raise SequencePrerequisite('BOUNCE_BOUNDS_MISSING')
        span = program.upper - program.lower
        if span == 0:
            return program.lower
        unwrapped = program.start + rank * program.step - program.lower
        phase = unwrapped % (2 * span)
        return program.lower + (phase if phase <= span else 2 * span - phase)
    raise SequencePrerequisite('SUPPLIED_TRANSFORMATION_FAMILY_UNSUPPORTED')


def _clock_for(model, program):
    clocks = tuple(clock for clock in model.clocks if clock.clock_ref == program.clock_ref)
    if len(clocks) != 1:
        raise SequencePrerequisite('FEATURE_CLOCK_NOT_UNIQUE')
    return clocks[0]


def _clock_domain(model, request, budget):
    slots = _validate_slots(request)
    if not model.clocks:
        raise SequencePrerequisite('EVIDENCED_CANDIDATE_CLOCKS_MISSING')
    if len(model.clocks) * len(slots) > request.domain_bound:
        raise DComputationInterrupted('CLOCK_RANK_DOMAIN_BOUND', d_map({'clock_count': len(model.clocks), 'slot_count': len(slots)}))
    rows = []
    for clock in model.clocks:
        ranks = []
        for slot in slots:
            budget.visit({'clock_ref': clock.clock_ref, 'slot_index': slot.index})
            ranks.append((slot.index, _rank(clock, slot.index)))
        rows.append(d_map({'clock_ref': clock.clock_ref, 'law_ref': clock.law_ref,
            'rank_by_original_slot': tuple(ranks), 'phase': clock.phase}))
    return {'clock_domains': tuple(rows), 'interleaved_and_concurrent_clocks_not_equated': True}


def _fit_features(model, request, budget):
    if not request.feature_observations or not model.feature_programs:
        raise SequencePrerequisite('OBSERVED_FEATURES_AND_SUPPLIED_PROGRAMS_MISSING')
    results = []
    slots = {slot.index: slot for slot in _validate_slots(request)}
    for program in model.feature_programs:
        clock = _clock_for(model, program)
        constraints, missing = [], []
        observations = tuple(sample for sample in request.feature_observations if sample.get('feature_ref') == program.feature_ref)
        if not observations:
            raise SequencePrerequisite('PROGRAM_FEATURE_OBSERVATIONS_MISSING')
        for sample in observations:
            budget.visit({'program_ref': program.program_ref, 'sample_ref': sample.get('sample_ref')})
            if type(sample.get('slot_index')) is not int or not sample.get('evidence_ref') or 'value' not in sample:
                raise SequencePrerequisite('INDEXED_OBSERVED_FEATURE_PROVENANCE_MISSING')
            if sample['slot_index'] not in slots or slots[sample['slot_index']].raster is None:
                raise SequencePrerequisite('FEATURE_NOT_GROUNDED_IN_OBSERVED_ORIGINAL_SLOT')
            rank = _rank(clock, sample['slot_index'])
            if rank is None:
                missing.append((sample['slot_index'], 'OBSERVATION_NOT_ON_SUPPLIED_TRACK_CLOCK'))
                continue
            predicted = _value(program, rank)
            constraints.append((sample['slot_index'], rank, predicted, sample['value'], predicted == sample['value']))
        results.append(d_map({'program_ref': program.program_ref, 'feature_ref': program.feature_ref,
            'clock_ref': clock.clock_ref, 'constraints': tuple(constraints), 'unresolved_constraints': tuple(missing),
            'consistent_on_examined_constraints': all(row[-1] for row in constraints) and not missing,
            'model_assignments': program.model_assignments}))
    return {'program_fits': tuple(results), 'grammar_induction_or_unique_law_not_claimed': True}


def _raster_at(request, index, budget):
    slots = tuple(slot for slot in request.slots if slot.index == index)
    if len(slots) != 1 or slots[0].raster is None or slots[0].content_status_ref != 'observed_raster':
        raise SequencePrerequisite('LAGGED_CARD_RASTER_NOT_OBSERVED')
    raster = slots[0].raster
    if raster.height * raster.width > request.domain_bound:
        raise DComputationInterrupted('LAGGED_RASTER_PIXEL_DOMAIN_BOUND', d_map({'slot_index': index}))
    for row in raster.rows:
        for _ in row:
            budget.visit()
    return raster.rows


def _counted_pixel(budget, value):
    budget.visit()
    return value


def _raster_program(model, request, index, budget):
    if not model.raster_instructions:
        raise SequencePrerequisite('ORDERED_RASTER_PROGRAM_MISSING')
    if len(model.raster_instructions) > request.depth_bound:
        raise DComputationInterrupted('RASTER_PROGRAM_DEPTH_BOUND', d_map({'instruction_count': len(model.raster_instructions)}))
    value = None
    for instruction in model.raster_instructions:
        budget.visit({'instruction_ref': instruction.instruction_ref, 'target_index': index})
        kind = instruction.kind_ref
        if kind == 'load_lagged_card':
            value = _raster_at(request, index - instruction.lag, budget)
            continue
        if value is None:
            raise SequencePrerequisite('RASTER_OPERATION_INPUT_NOT_BOUND')
        height, width = len(value), len(value[0])
        if height * width > request.domain_bound:
            raise DComputationInterrupted('RASTER_PIXEL_DOMAIN_BOUND', d_map({'height': height, 'width': width}))
        if kind == 'rotate_quarter_turns':
            for _ in range(instruction.quarter_turns):
                value = tuple(tuple(_counted_pixel(budget, value[height - 1 - row][column]) for row in range(height)) for column in range(width))
                height, width = width, height
        elif kind == 'reflect_horizontal':
            value = tuple(tuple(_counted_pixel(budget, pixel) for pixel in reversed(row)) for row in value)
        elif kind == 'reflect_vertical':
            value = tuple(tuple(_counted_pixel(budget, pixel) for pixel in row) for row in reversed(value))
        elif kind == 'palette_replacement':
            mapping = dict(instruction.palette_map)
            if len(mapping) != len(instruction.palette_map):
                raise SequencePrerequisite('PALETTE_MAP_NOT_FUNCTIONAL')
            value = tuple(tuple(_counted_pixel(budget, mapping.get(pixel, pixel)) for pixel in row) for row in value)
        elif kind == 'translated_raster':
            if model.background_value is None or instruction.clipping_law_ref not in ('clip_to_declared_canvas', 'reject_support_loss'):
                raise SequencePrerequisite('TRANSLATION_BACKGROUND_OR_CLIPPING_LAW_MISSING')
            output = [[model.background_value] * width for _ in range(height)]
            for row in range(height):
                for column in range(width):
                    budget.visit()
                    rr, cc = row + instruction.row_delta, column + instruction.column_delta
                    if 0 <= rr < height and 0 <= cc < width:
                        output[rr][cc] = value[row][column]
                    elif instruction.clipping_law_ref == 'reject_support_loss' and value[row][column] != model.background_value:
                        raise SequencePrerequisite('TRANSLATION_LOSES_REQUIRED_RASTER_SUPPORT')
            value = tuple(tuple(row) for row in output)
        elif kind in ('union_lagged_support', 'difference_lagged_support', 'xor_lagged_support'):
            if instruction.second_lag is None or model.background_value is None:
                raise SequencePrerequisite('SECOND_RASTER_OPERAND_OR_MASK_BACKGROUND_MISSING')
            other = _raster_at(request, index - instruction.second_lag, budget)
            if len(other) != height or any(len(row) != width for row in other):
                raise SequencePrerequisite('RASTER_OPERANDS_DIFFER_IN_SHAPE')
            output = []
            for row in range(height):
                line = []
                for column in range(width):
                    budget.visit()
                    first, second = value[row][column], other[row][column]
                    first_on, second_on = first != model.background_value, second != model.background_value
                    if kind == 'union_lagged_support':
                        if first_on and second_on and first != second:
                            raise SequencePrerequisite('UNION_OVERLAP_PALETTE_PRIORITY_NOT_BOUND')
                        pixel = first if first_on else second
                    elif kind == 'difference_lagged_support':
                        pixel = first if first_on and not second_on else model.background_value
                    else:
                        pixel = first if first_on and not second_on else second if second_on and not first_on else model.background_value
                    line.append(pixel)
                output.append(tuple(line))
            value = tuple(output)
        else:
            raise SequencePrerequisite('SUPPLIED_RASTER_OPERATION_UNSUPPORTED')
    if value is None:
        raise SequencePrerequisite('RASTER_PROGRAM_HAS_NO_VALUE')
    return value


def _compose(model, request, budget):
    if request.missing_index is None or model.render_height is None or model.render_width is None or model.background_value is None:
        raise SequencePrerequisite('ORIGINAL_MISSING_RANK_OR_CANVAS_BASELINE_MISSING')
    if model.render_height * model.render_width > request.domain_bound:
        raise DComputationInterrupted('MISSING_CARD_PIXEL_DOMAIN_BOUND', d_map({'height': model.render_height, 'width': model.render_width}))
    if model.overlap_law_ref not in ('declared_order_overwrite', 'overlap_must_agree'):
        raise SequencePrerequisite('FEATURE_OVERLAY_LAW_MISSING')
    programs = {program.feature_ref: program for program in model.feature_programs}
    if len(programs) != len(model.feature_programs) or set(model.render_order) != set(programs) or len(model.render_order) != len(programs):
        raise SequencePrerequisite('COMPLETE_UNIQUE_FEATURE_RENDER_ORDER_MISSING')
    output = [[model.background_value] * model.render_width for _ in range(model.render_height)]
    written, assignments, predictions = {}, {}, []
    for feature_ref in model.render_order:
        program = programs[feature_ref]
        rank = _rank(_clock_for(model, program), request.missing_index)
        if rank is None:
            predictions.append((feature_ref, None, 'CLOCK_NOT_PRESENT_AT_ORIGINAL_RANK'))
            continue
        value = _value(program, rank)
        layers = tuple(layer for layer in model.feature_layers if layer.feature_ref == feature_ref and layer.value == value)
        if len(layers) != 1:
            raise SequencePrerequisite('FEATURE_VALUE_TO_COMPLETE_RASTER_LAYER_NOT_UNIQUE')
        layer = layers[0]
        for binding in (program.model_assignments, layer.model_assignments):
            for key in sorted(binding):
                if key in assignments and assignments[key] != binding[key]:
                    return {'coherent': False, 'conflicting_assignment_key': key,
                            'partial_feature_predictions': tuple(predictions)}
                assignments[key] = binding[key]
        if layer.raster.height != model.render_height or layer.raster.width != model.render_width:
            raise SequencePrerequisite('FEATURE_LAYER_CANVAS_NOT_ALIGNED')
        if len(set(layer.mask)) != len(layer.mask):
            raise SequencePrerequisite('FEATURE_LAYER_MASK_NOT_UNIQUE')
        for row, column in layer.mask:
            budget.visit({'feature_ref': feature_ref, 'mask_pixel': (row, column)})
            if not 0 <= row < model.render_height or not 0 <= column < model.render_width:
                raise SequencePrerequisite('FEATURE_MASK_OUTSIDE_DECLARED_CANVAS')
            pixel = layer.raster.rows[row][column]
            if (row, column) in written and model.overlap_law_ref == 'overlap_must_agree' and written[(row, column)] != pixel:
                return {'coherent': False, 'conflicting_pixel': (row, column),
                        'partial_feature_predictions': tuple(predictions)}
            output[row][column] = pixel
            written[(row, column)] = pixel
        predictions.append((feature_ref, rank, value))
    return {'coherent': True, 'raster': tuple(tuple(row) for row in output),
        'feature_predictions': tuple(predictions), 'shared_model_assignments': d_map(assignments),
        'original_missing_index': request.missing_index}


def _pixel_comparison(first, second, budget):
    if len(first) != len(second) or any(len(a) != len(b) for a, b in zip(first, second)):
        return {'exact_match': False, 'shape_mismatch': True, 'counterexample_pixels': ()}
    mismatches = []
    for row, (expected, observed) in enumerate(zip(first, second)):
        for column, (a, b) in enumerate(zip(expected, observed)):
            budget.visit({'next_pixel': (row, column)})
            if a != b:
                mismatches.append((row, column, a, b))
    return {'exact_match': not mismatches, 'counterexample_pixels': tuple(mismatches),
            'full_raster_not_one_feature_checked': True}


def _control_state(state):
    if len(set(state.question_order)) != len(state.question_order) or len(set(state.accepted_question_refs)) != len(state.accepted_question_refs):
        raise SequencePrerequisite('QUESTION_OR_RECEIPT_IDENTITIES_NOT_UNIQUE')
    if any(ref not in state.question_order for ref in state.accepted_question_refs):
        raise SequencePrerequisite('ACCEPTED_RECEIPT_OUTSIDE_REQUIRED_QUESTION_DOMAIN')
    if state.active_question_ref is not None and state.active_question_ref not in state.question_order:
        raise SequencePrerequisite('ACTIVE_QUESTION_OUTSIDE_CURRENT_DOMAIN')


def _proposal_relation(model, request, proposal_ref, budget):
    state = request.control_state
    if state is None or state.active_question_ref is None:
        raise SequencePrerequisite('ACTIVE_QUESTION_CONTROL_NOT_BOUND')
    proposals = tuple(proposal for proposal in request.proposals if proposal.proposal_ref == proposal_ref
        and proposal.question_ref == state.active_question_ref
        and proposal.evidence_revision_ref == request.scope.evidence_revision_ref)
    predictions = tuple(raster for ref, raster in request.predicted_rasters if ref == model.model_ref)
    proofs = tuple(evidence for ref, evidence, revision in request.prediction_evidence_refs
        if ref == model.model_ref and revision == request.scope.evidence_revision_ref)
    if len(proposals) != 1 or len(predictions) != 1 or len(proofs) != 1:
        raise SequencePrerequisite('CURRENT_PROPOSAL_OR_SUPPORTED_PREDICTION_NOT_UNIQUE')
    if model.exact_comparison_law_ref != 'complete_palette_raster_equality':
        raise SequencePrerequisite('SUPPORTED_FULL_ANSWER_MATCHING_LAW_MISSING')
    return _pixel_comparison(predictions[0].rows, proposals[0].raster.rows, budget), proofs[0]


def _external_answer(model, request, budget):
    state = request.control_state
    if state is None or request.action_kind is None:
        raise SequencePrerequisite('CURRENT_QUESTION_FOCUS_AND_INPUT_KIND_MISSING')
    _control_state(state)
    kind = request.action_kind
    if kind == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise SequencePrerequisite('INDEPENDENT_ANSWER_RESET_LAW_MISSING')
        _control_state(model.reset_state)
        following, debit, attempted, accepted, relation = model.reset_state, model.reset_cost, False, False, None
    else:
        costs = tuple(cost for input_kind, cost in model.input_costs if input_kind == kind)
        if len(costs) != 1 or costs[0] < 0:
            raise SequencePrerequisite('EXACT_ANSWER_INPUT_COST_MISSING')
        following, debit, attempted, accepted, relation = state, costs[0], False, False, None
        if kind in ('previous_question', 'next_question', 'question_seek'):
            if model.navigation_law_ref != 'saturating_declared_question_order' or state.active_question_ref is None:
                raise SequencePrerequisite('QUESTION_NAVIGATION_ORDER_OR_LAW_MISSING')
            if kind == 'question_seek':
                if request.target_question_ref not in state.question_order:
                    raise SequencePrerequisite('QUESTION_SEEK_TARGET_NOT_CURRENT')
                target = request.target_question_ref
            else:
                index = state.question_order.index(state.active_question_ref)
                index = min(max(index + (-1 if kind == 'previous_question' else 1), 0), len(state.question_order) - 1)
                target = state.question_order[index]
            following = state.model_copy(update={'active_question_ref': target, 'focused_proposal_ref': None})
        elif kind in ('proposal_focus', 'proposal_click', 'explicit_submit'):
            proposal_ref = state.focused_proposal_ref if kind == 'explicit_submit' else request.bound_proposal_ref
            proposals = tuple(proposal for proposal in request.proposals if proposal.proposal_ref == proposal_ref
                and proposal.question_ref == state.active_question_ref
                and proposal.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(proposals) != 1:
                raise SequencePrerequisite('CURRENT_FOCUSED_OR_CLICKED_PROPOSAL_NOT_UNIQUE')
            if kind == 'proposal_focus':
                following = state.model_copy(update={'focused_proposal_ref': proposal_ref})
            elif kind == 'proposal_click' and model.click_law_ref == 'click_focuses_only':
                following = state.model_copy(update={'focused_proposal_ref': proposal_ref})
            else:
                if kind == 'proposal_click' and model.click_law_ref != 'click_submits_directly':
                    raise SequencePrerequisite('EVIDENCED_CLICK_FOCUS_OR_SUBMISSION_LAW_MISSING')
                if model.accepted_persistence_law_ref != 'accepted_rows_persist_on_attempt':
                    raise SequencePrerequisite('UNRELATED_ACCEPTED_ROW_PERSISTENCE_LAW_MISSING')
                relation, _ = _proposal_relation(model, request, proposal_ref, budget)
                attempted, accepted = True, relation['exact_match']
                receipts = tuple(ref for ref in state.question_order
                    if ref in state.accepted_question_refs or (accepted and ref == state.active_question_ref))
                following = state.model_copy(update={'attempt_count': state.attempt_count + 1,
                    'accepted_question_refs': receipts, 'focused_proposal_ref': proposal_ref})
                if accepted:
                    if model.next_row_law_ref == 'activate_next_unsolved_in_declared_order':
                        unresolved = tuple(ref for ref in state.question_order if ref not in receipts)
                        following = following.model_copy(update={'active_question_ref': unresolved[0] if unresolved else None,
                                                                'focused_proposal_ref': None})
                    elif model.next_row_law_ref != 'preserve_active_question':
                        raise SequencePrerequisite('AUTOMATIC_NEXT_QUESTION_LAW_MISSING')
        else:
            raise SequencePrerequisite('ANSWER_CONTROL_INPUT_KIND_UNSUPPORTED')
    if model.completion_law_ref != 'every_required_question_has_receipt':
        raise SequencePrerequisite('REQUIRED_QUESTION_COMPLETION_QUANTIFIER_MISSING')
    complete = set(following.question_order) <= set(following.accepted_question_refs)
    ledger = d_map({'owner_ref': request.scope.event_owner_ref, 'input_kind': kind,
        'debit': debit, 'one_attempt': attempted, 'accepted': accepted,
        'accepted_receipts': following.accepted_question_refs, 'complete': complete,
        'direct_automatic_cost_acceptance_owned': True})
    return {'state': following, 'event_ledger': (ledger,), 'proposal_comparison': d_map(relation or {}),
        'complete': complete, 'new_question_raster_not_invented': True,
        'new_binding_required': following.active_question_ref != state.active_question_ref,
        'automatic_pass_already_owned': True, 'cost_already_owned': True}


def _answer_binding(request, kind, proposal_ref):
    if request.control_state is None:
        raise SequencePrerequisite('ACTIVE_ANSWER_BINDING_SCOPE_MISSING')
    matches = tuple(binding for binding in request.answer_bindings
        if binding.question_ref == request.control_state.active_question_ref and binding.kind_ref == kind
        and binding.proposal_ref == proposal_ref and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
    if len(matches) != 1:
        raise SequencePrerequisite('CURRENT_NATIVE_ANSWER_INPUT_NOT_UNIQUE')
    return d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload})


def _answer_commitment(model, request, budget):
    if request.bound_proposal_ref is None or request.control_state is None:
        raise SequencePrerequisite('SOURCE_BOUND_PROPOSAL_AND_CURRENT_ROW_MISSING')
    relation, proof = _proposal_relation(model, request, request.bound_proposal_ref, budget)
    if not relation['exact_match']:
        raise SequencePrerequisite('BOUND_PROPOSAL_DOES_NOT_MATCH_SUPPORTED_FULL_PREDICTION')
    if model.click_law_ref == 'click_submits_directly':
        word = (_answer_binding(request, 'proposal_click', request.bound_proposal_ref),)
        prefix = request.model_copy(update={'action_kind': 'proposal_click'})
    elif model.click_law_ref == 'click_focuses_only':
        if request.control_state.focused_proposal_ref == request.bound_proposal_ref:
            word = (_answer_binding(request, 'explicit_submit', request.bound_proposal_ref),)
            prefix = request.model_copy(update={'action_kind': 'explicit_submit'})
        else:
            word = (_answer_binding(request, 'proposal_click', request.bound_proposal_ref),)
            prefix = request.model_copy(update={'action_kind': 'proposal_click'})
            # Focus must be observed before submitting when the focus channel
            # has not yet bound a current explicit-submit payload.
            row = _external_answer(model, prefix, budget)
            return {'primitive_prefix': word, 'expected_focus_successor': d_map(row),
                    'stops_before_submission': True, 'supported_prediction_evidence_ref': proof,
                    'frozen_prerequisites': request.scope.assumption_refs,
                    'commitment_lease_authorized': False}
    else:
        raise SequencePrerequisite('EVIDENCED_AVAILABLE_ANSWER_CHANNEL_MISSING')
    return {'primitive_prefix': word, 'expected_receipt': d_map(_external_answer(model, prefix, budget)),
        'frozen_prerequisites': request.scope.assumption_refs, 'supported_prediction_evidence_ref': proof,
        'commitment_lease_authorized': False}


def _answer_reconciliation(model, request, budget):
    if not request.observations:
        raise SequencePrerequisite('SEALED_ANSWER_REPLY_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        budget.visit({'reply_index': index})
        if sample.get('sealed') is not True or not sample.get('attempt_owner_ref') or sample.get('before_state') is None or sample.get('after_state') is None:
            raise SequencePrerequisite('SEALED_ANSWER_OWNER_AND_CONTROL_STATES_MISSING')
        if sample['attempt_owner_ref'] != request.scope.event_owner_ref:
            raise SequencePrerequisite('ANSWER_REPLY_OWNER_DOES_NOT_MATCH_REQUEST_SCOPE')
        before = SequenceControlState.model_validate(sample['before_state'])
        after = SequenceControlState.model_validate(sample['after_state'])
        _control_state(before)
        _control_state(after)
        added = tuple(ref for ref in after.accepted_question_refs if ref not in before.accepted_question_refs)
        lost = tuple(ref for ref in before.accepted_question_refs if ref not in after.accepted_question_refs)
        rows.append(d_map({'attempt_owner_ref': sample['attempt_owner_ref'], 'sample_index': index,
            'attempt_count_delta': after.attempt_count - before.attempt_count,
            'added_accepted_question_refs': added, 'lost_accepted_question_refs': lost,
            'persistent_prior_receipts_match': not lost if model.accepted_persistence_law_ref == 'accepted_rows_persist_on_attempt' else None,
            'before_active_question_ref': before.active_question_ref, 'after_active_question_ref': after.active_question_ref,
            'focus_changed': before.focused_proposal_ref != after.focused_proposal_ref,
            'old_proposal_geometry_invalidated': before.active_question_ref != after.active_question_ref,
            'official_level_transition_receipt_ref': sample.get('official_level_transition_receipt_ref')}))
    return {'reply_deltas': tuple(rows), 'per_question_evidence_preserved': True, 'canonical_mutation_authorized': False}


def measure_visual_sequence(request: VisualSequenceRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if operation == 'layout_measure':
            return d_result(request, 'OK', 'EXACT_CURRENT_INDEXED_SEQUENCE_LAYOUT',
                values=_layout_measure(request, budget), complete=True, examined=budget.examined)
        if operation == 'feature_factorization':
            return d_result(request, 'COMPLETE', 'EXACT_SOURCE_DECOMPOSITION_MEASUREMENTS_RETURNED',
                values=_feature_factorization(request, budget), complete=True, examined=budget.examined)
        if not request.models:
            raise SequencePrerequisite('SCOPED_SEQUENCE_MODELS_MISSING')
        if operation == 'hypothesis_discrimination':
            if not request.predicted_rasters:
                raise SequencePrerequisite('MODEL_CORRELATED_ANSWER_PREDICTIONS_MISSING')
            classes = {}
            representatives = {}
            if len(set(ref for ref, _ in request.predicted_rasters)) != len(request.predicted_rasters) or set(ref for ref, _ in request.predicted_rasters) != set(model.model_ref for model in request.models):
                raise SequencePrerequisite('PREDICTED_ANSWER_DOMAIN_NOT_COMPLETE_FOR_RETAINED_MODELS')
            for model_ref, raster in request.predicted_rasters:
                budget.visit({'model_ref': model_ref})
                if model_ref not in tuple(model.model_ref for model in request.models):
                    raise SequencePrerequisite('PREDICTION_FROM_UNRETAINED_MODEL')
                digest = stable_digest(raster.rows)
                classes.setdefault(digest, []).append(model_ref)
                representatives[digest] = raster.rows
            distinctions = []
            digests = tuple(sorted(classes))
            for position, first in enumerate(digests):
                for second in digests[position + 1:]:
                    distinctions.append(d_map({'first_class': first, 'second_class': second,
                        'pixel_comparison': d_map(_pixel_comparison(representatives[first], representatives[second], budget))}))
            future = []
            if len(request.discrimination_indices) * len(request.models) > request.domain_bound:
                raise DComputationInterrupted('DISCRIMINATION_COMPUTATION_DOMAIN_BOUND', d_map({
                    'index_count': len(request.discrimination_indices), 'model_count': len(request.models)}))
            for index in request.discrimination_indices:
                predictions = []
                for model in request.models:
                    budget.visit({'model_ref': model.model_ref, 'requested_index': index})
                    predictions.append(d_map({'model_ref': model.model_ref, 'feature_predictions': tuple(
                        (program.feature_ref, _value(program, _rank(_clock_for(model, program), index)))
                        for program in model.feature_programs)}))
                future.append(d_map({'original_index': index, 'model_predictions': tuple(predictions)}))
            values = {'answer_equivalence_classes': tuple((digest, tuple(refs)) for digest, refs in sorted(classes.items())),
                'agreement_is_answer_scoped_not_unique_law': len(classes) == 1,
                'counterexample_pixels_by_answer_classes': tuple(distinctions),
                'requested_future_computations': tuple(future), 'information_request_selection_authorized': False}
        else:
            rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
            for model in request.models[len(rows):]:
                current_model_ref = model.model_ref
                budget.visit()
                if operation == 'clock_partition':
                    row = _clock_domain(model, request, budget)
                elif operation == 'transition_fit':
                    row = _fit_features(model, request, budget)
                elif operation == 'raster_recurrence':
                    if request.mode_ref == 'PREDICT':
                        if request.missing_index is None:
                            raise SequencePrerequisite('ORIGINAL_MISSING_INDEX_NOT_BOUND')
                        row = {'predicted_raster': _raster_program(model, request, request.missing_index, budget)}
                    else:
                        comparisons, unresolved = [], []
                        for slot in _validate_slots(request):
                            if slot.raster is None:
                                continue
                            try:
                                predicted = _raster_program(model, request, slot.index, budget)
                            except SequencePrerequisite as error:
                                unresolved.append((slot.index, str(error)))
                                continue
                            comparisons.append(d_map({'slot_index': slot.index,
                                'comparison': d_map(_pixel_comparison(predicted, slot.raster.rows, budget))}))
                        row = {'raster_constraints': tuple(comparisons), 'untested_constraints': tuple(unresolved),
                               'particular_algebra_or_unique_law_not_claimed': True}
                elif operation == 'missing_term_composition':
                    row = _compose(model, request, budget)
                elif operation == 'proposal_match':
                    if model.exact_comparison_law_ref != 'complete_palette_raster_equality' or request.question_ref is None:
                        raise SequencePrerequisite('EXACT_CURRENT_QUESTION_COMPARISON_LAW_MISSING')
                    predictions = tuple(raster for ref, raster in request.predicted_rasters if ref == model.model_ref)
                    if len(predictions) != 1:
                        raise SequencePrerequisite('MODEL_PREDICTED_RASTER_NOT_UNIQUE')
                    proposal_rows = []
                    for proposal in request.proposals:
                        if proposal.question_ref != request.question_ref or proposal.evidence_revision_ref != request.scope.evidence_revision_ref:
                            raise SequencePrerequisite('PROPOSAL_QUESTION_OR_GEOMETRY_REVISION_STALE')
                        proposal_rows.append(d_map({'proposal_ref': proposal.proposal_ref,
                            'comparison': d_map(_pixel_comparison(predictions[0].rows, proposal.raster.rows, budget))}))
                    row = {'proposal_comparisons': tuple(proposal_rows),
                        'matching_proposal_refs': tuple(item['proposal_ref'] for item in proposal_rows if item['comparison']['exact_match'])}
                elif operation == 'answer_commitment':
                    row = _answer_commitment(model, request, budget)
                elif operation == 'answer_reconciliation':
                    row = _answer_reconciliation(model, request, budget)
                elif operation == 'external_primitive':
                    row = _external_answer(model, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
                rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
            values = {'model_correlated_results': tuple(rows)}
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values=values, complete=True, examined=budget.examined)
    except (SequencePrerequisite, DResumeMismatch) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
