"""Full support translations and spacing constrain pitch, never glyph bounds."""
from .lattice_calibration_contracts_c import (LatticeCalibrationInputC, LatticeCalibrationFactsC,
    LatticeCandidateMeasurementC, NativeCellAddressC, LatticeCalibrationDecisionInputC,
    LatticeCalibrationDecisionC)
from agents.yf_arc3_v5.logos.types import FrozenMap


def _current(value, evidence, frame_field):
    return (evidence.epoch == value.epoch and evidence.revision_ref == value.revision_ref
        and evidence.scene_ref == value.scene_ref and evidence.descriptive_domain_ref == value.descriptive_domain_ref
        and getattr(evidence, frame_field) == value.native_frame_ref)


def _whole_translation(evidence):
    before = {(point.row, point.column, point.value) for point in evidence.before_support}
    after = {(point.row, point.column, point.value) for point in evidence.after_support}
    if len({(row, column) for row, column, color in before}) != len(before) or len({
            (row, column) for row, column, color in after}) != len(after):
        return None
    if not before or not after or not evidence.complete_whole_support or not evidence.same_body_evidence_refs:
        return None
    row_delta = min(point[0] for point in after)-min(point[0] for point in before)
    column_delta = min(point[1] for point in after)-min(point[1] for point in before)
    if {(row+row_delta, column+column_delta, color) for row, column, color in before} != after:
        return None
    if evidence.camera_delta is None or not evidence.camera_evidence_refs:
        return None
    world_delta = (row_delta-evidence.camera_delta[0], column_delta-evidence.camera_delta[1])
    return world_delta if world_delta != (0, 0) else None


def measure_lattice_calibration(value: LatticeCalibrationInputC) -> LatticeCalibrationFactsC:
    point_count = sum(len(item.before_support)+len(item.after_support) for item in value.motion_evidence)
    support_bound = point_count > value.max_input_support_points
    motion, spacing, unqualified = [], [], []
    input_visits = 0
    if not support_bound:
        for evidence in value.motion_evidence:
            evidence_current = _current(value, evidence, "after_frame_ref")
            if evidence_current:
                input_visits += len(evidence.before_support)+len(evidence.after_support)
            delta = _whole_translation(evidence) if evidence_current else None
            if delta is None:
                unqualified.append(evidence.evidence_ref)
            else:
                motion.append((evidence, delta))
    else:
        unqualified.extend(item.evidence_ref for item in value.motion_evidence)
    for evidence in value.spacing_evidence:
        positions = sorted(set(evidence.boundary_positions))
        if not _current(value, evidence, "native_frame_ref") or not evidence.same_boundary_kind_evidence_refs or len(positions) < 2:
            unqualified.append(evidence.evidence_ref)
        else:
            spacing.append((evidence, tuple(second-first for first, second in zip(positions, positions[1:]))))
    comparisons, bounded, results, admissible = 0, support_bound, [], []
    for candidate in value.candidates:
        current = _current(value, candidate, "native_frame_ref") and bool(candidate.morphology_evidence_refs)
        structural = (candidate.row_pitch == candidate.core_height+candidate.row_gap
            and candidate.column_pitch == candidate.core_width+candidate.column_gap)
        contradictions, quantum, compatible = [], [], []
        for evidence, delta in motion:
            if comparisons >= value.max_candidate_comparisons:
                bounded = True
                break
            comparisons += 1
            fits = delta[0] % candidate.row_pitch == 0 and delta[1] % candidate.column_pitch == 0
            if evidence.logical_delta is not None and evidence.logical_quantum_evidence_refs:
                fits = fits and delta == (evidence.logical_delta[0]*candidate.row_pitch,
                    evidence.logical_delta[1]*candidate.column_pitch)
                if fits and delta != (0, 0):
                    quantum.append(evidence.evidence_ref)
            if fits:
                compatible.append(evidence.evidence_ref)
            else:
                contradictions.append(evidence.evidence_ref)
        for evidence, intervals in spacing:
            if comparisons >= value.max_candidate_comparisons:
                bounded = True
                break
            comparisons += 1
            pitch = candidate.row_pitch if evidence.axis == "ROW" else candidate.column_pitch
            fits = all(interval % pitch == 0 for interval in intervals)
            if evidence.cells_per_interval is not None and evidence.logical_quantum_evidence_refs:
                fits = fits and all(interval == pitch*evidence.cells_per_interval for interval in intervals)
                if fits:
                    quantum.append(evidence.evidence_ref)
            if not fits:
                contradictions.append(evidence.evidence_ref)
        addresses = []
        for point in value.queries:
            row, row_offset = divmod(point.row-candidate.row_origin, candidate.row_pitch)
            column, column_offset = divmod(point.column-candidate.column_origin, candidate.column_pitch)
            addresses.append(NativeCellAddressC(point_ref=point.point_ref, row=row, column=column,
                core_row_offset=row_offset, core_column_offset=column_offset,
                in_core=row_offset < candidate.core_height and column_offset < candidate.core_width))
        results.append(LatticeCandidateMeasurementC(lattice_ref=candidate.lattice_ref,
            scope_current=current, structure_consistent=structural,
            contradicted_by_evidence_refs=tuple(sorted(set(contradictions))),
            supported_quantum_evidence_refs=tuple(sorted(set(quantum))), compatible_motion_refs=tuple(compatible),
            addresses=tuple(addresses)))
        if current and structural and not contradictions:
            admissible.append(candidate.lattice_ref)
    refs_unique = len({candidate.lattice_ref for candidate in value.candidates}) == len(value.candidates)
    retained = (value.retained_lattice_ref is not None and value.retained_lattice_ref in admissible
        and bool(value.retained_current_revalidation_refs))
    singleton_quantum = (len(admissible) == 1 and any(item.lattice_ref == admissible[0]
        and bool(item.supported_quantum_evidence_refs) for item in results))
    return LatticeCalibrationFactsC(candidate_measurements=tuple(results), admissible_lattice_refs=tuple(admissible),
        unqualified_evidence_refs=tuple(sorted(set(unqualified))),
        actual_input_support_point_visits=input_visits,
        actual_candidate_comparisons=comparisons,
        facts=FrozenMap({"current_observation_evidenced": bool(value.observation_evidence_refs),
            "candidate_refs_unique": refs_unique, "budget_reached": bounded,
            "retained_lattice_currently_revalidated": retained,
            "enumeration_complete": value.enumeration_complete,
            "one_admissible_quantum_supported": singleton_quantum,
            "admissible_candidates_present": bool(admissible)}))


def assemble_lattice_calibration(value: LatticeCalibrationDecisionInputC) -> LatticeCalibrationDecisionC:
    bound = None
    if value.source_disposition_ref == "lattice.continue_revalidated_binding":
        bound = value.request.retained_lattice_ref
    elif value.source_disposition_ref == "lattice.bind_unique_quantum_supported":
        bound = value.measured.admissible_lattice_refs[0]
    addresses = next((item.addresses for item in value.measured.candidate_measurements
        if item.lattice_ref == bound), ())
    return LatticeCalibrationDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request, frozen_measurement=value.measured,
        operational_lattice_ref=bound, operational_addresses=addresses)
