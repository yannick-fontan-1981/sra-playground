"""Compact projection of an actual typed temporal-tracking calculation."""
from agents.yf_arc3_v5.capabilities.contracts import TemporalTrackingResult
from agents.yf_arc3_v5.logos.operational_observation import OperationalConsciousnessParticipantMeasurement
from agents.yf_arc3_v5.logos.types import stable_digest


def project_conscious_participants(result):
    tracked = TemporalTrackingResult.model_validate(result)
    if any(row.current_frame_ref != tracked.frame_ref for row in tracked.entities):
        raise ValueError('participant projection mixes physical observation frames')
    return tuple(OperationalConsciousnessParticipantMeasurement(
        entity_ref=row.entity_id, component_ref=row.component.component_id,
        bounds=(row.component.bbox.top, row.component.bbox.left, row.component.bbox.bottom, row.component.bbox.right),
        pixel_area=row.component.area, observed_value=row.component.value,
        relative_shape_digest=stable_digest(row.component.relative_pixels),
        identity_status=row.identity_status, match_kind=row.match_kind,
        possible_predecessor_entity_refs=row.possible_predecessor_entity_refs,
    ) for row in tracked.entities)
