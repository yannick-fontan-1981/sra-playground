"""Separate geometric calibration and Source binding; never choose by texture."""
from .lattice_calibration_contracts_c import (LatticeCalibrationInputC, LatticeCalibrationFactsC,
    LatticeCalibrationDecisionInputC, LatticeCalibrationDecisionC)
from .lattice_calibration_c import measure_lattice_calibration, assemble_lattice_calibration

LATTICE_CALIBRATION_C_TYPES = ("RasterSupportPointC", "LatticeCalibrationCandidateC",
    "WholeBodyCalibrationEvidenceC", "LatticeSpacingEvidenceC", "NativeLatticePointQueryC",
    "LatticeCalibrationInputC", "NativeCellAddressC", "LatticeCandidateMeasurementC",
    "LatticeCalibrationFactsC", "LatticeCalibrationDecisionInputC", "LatticeCalibrationDecisionC")


def lattice_calibration_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.lattice_calibration_facts_c",
            implementation=measure_lattice_calibration, input_model=LatticeCalibrationInputC,
            output_model=LatticeCalibrationFactsC, source_file="lattice_calibration_c.py",
            applicability=("current_native_frame_and_declared_geometry_candidates",),
            invariants=("whole_body_not_component_crop", "camera_delta_not_assumed_zero",
                "pitch_independent_of_glyph_border_texture", "retain_clipped_cells_metric_bounds_and_depth",
                "divisibility_not_unique_cell_quantum", "no_lattice_or_role_selection"),
            falsifiers=("stale_or_foreign_frame", "incomplete_support", "contrary_quantum", "actual_bound_reached")),
        entry_factory(capability_id="capability.lattice_calibration_assembly_c",
            implementation=assemble_lattice_calibration, input_model=LatticeCalibrationDecisionInputC,
            output_model=LatticeCalibrationDecisionC, source_file="lattice_calibration_c.py",
            applicability=("src_selected_revalidated_or_unique_supported_lattice",),
            invariants=("native_coordinate_conversion_stays_scoped", "alternatives_not_discarded_by_order",
                "no_cell_type_route_or_action", "no_unknown_lattice_fallback"),
            falsifiers=("unsupported_unique_binding", "old_scene_coordinates_reused", "clip_renumbered")),
    )


def lattice_calibration_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.lattice_calibration_facts_c": ((parameter("request", "LatticeCalibrationInputC"),),
            "LatticeCalibrationFactsC"),
        "capability.lattice_calibration_assembly_c": ((parameter("request", "LatticeCalibrationInputC"),
            parameter("measured", "LatticeCalibrationFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "LatticeCalibrationDecisionC"),
    }
