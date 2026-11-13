"""Read actual acquisition and existing SceneLayer measurements, never roles.

Source supplies query/calibration references, not pixels or physical masks.
Evidence presence binds the query; it does not certify its semantic meaning.
"""
from dataclasses import dataclass
from pydantic import Field
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.capabilities.scene_layer_measurement_d import (
    DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion, measure_scene_layers_d,
)
from agents.yf_arc3_v5.logos.operations import ObservationAcquiredRecord
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, Disposition, Polarity
from agents.yf_arc3_v5.runtime.contracts import ObservedWorldInput


class ObservedInputReadRequest(FrozenModel):
    observation_record_ref: Ref
    raw_input_ref: Ref
    timeline_ref: Ref
    expected_frame_ref: Ref | None = None


class ObservedSceneReadRequest(ObservedInputReadRequest):
    calibrations: tuple[DSceneCalibration, ...] = Field(min_length=1, max_length=128)
    layer_questions: tuple[DSceneLayerQuestion, ...] = Field(min_length=1, max_length=128)
    occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)


@dataclass(frozen=True)
class ObservedInputReadResult:
    request: ObservedInputReadRequest
    acquisition: ObservationAcquiredRecord | None
    world_input: ObservedWorldInput | None
    state_revision: int
    missing_refs: tuple[Ref, ...]


@dataclass(frozen=True)
class ObservedSceneReadResult:
    request: ObservedSceneReadRequest
    acquisition: ObservationAcquiredRecord | None
    world_input: ObservedWorldInput | None
    layers: tuple[FrozenMap, ...]
    evidence_refs: tuple[Ref, ...]
    state_revision: int
    missing_refs: tuple[Ref, ...]


def current_positive_claim(claim, revision):
    return (claim is not None and claim.polarity is Polarity.POSITIVE
        and claim.epistemic_status.value in ('supported', 'established')
        and claim.disposition is Disposition.ACTIVE and not claim.active_contradictions
        and not claim.defeated_by and (claim.valid_through_state_revision is None
            or claim.valid_through_state_revision >= revision))


def read_observed_input(store, repository, request: ObservedInputReadRequest):
    """Actual acquisition join only; exact window sensors need no fake lattice."""
    missing = []
    snapshot = store.snapshot
    acquired = store.artifact(request.observation_record_ref)
    world = None
    if (not isinstance(acquired, ObservationAcquiredRecord)
            or acquired.raw_input_ref != request.raw_input_ref
            or acquired.timeline_id != request.timeline_ref):
        missing.append('observed_scene.actual_observation_record')
        acquired = None
    else:
        try:
            world = repository.get(acquired.raw_input_ref) if repository is not None else None
        except KeyError:
            world = None
        if world is None or world.frame_id != acquired.frame_id:
            missing.append('observed_scene.actual_repository_frame')
            world = None
        elif request.expected_frame_ref is not None and world.frame_id != request.expected_frame_ref:
            missing.append('observed_scene.expected_owner_frame')
    return ObservedInputReadResult(request, acquired, world, snapshot.revision, tuple(missing))


def read_observed_scene(store, repository, request: ObservedSceneReadRequest, budget):
    """Immutable readonly join; caller retains its canonical owner/role checks.

    Historical acquisitions are allowed; expected_frame_ref, when supplied by
    the current owner, additionally binds its frame. Unknown/clipped/occluded
    morphology is unchanged from SceneLayer. No state writer or action authority.
    """
    observed = read_observed_input(store, repository, request)
    missing = list(observed.missing_refs)
    snapshot = store.snapshot
    if snapshot.revision != observed.state_revision:
        missing.append('observed_scene.unchanged_acquisition_read_revision')
    evidence = (request.observation_record_ref,
        *(row.evidence_ref for row in request.calibrations),
        *(row.evidence_ref for row in request.layer_questions),
        *(row.evidence_ref for row in request.occlusions))
    for ref in evidence:
        claim = snapshot.claim(ref)
        if store.artifact(ref) is None and snapshot.term(ref) is None and claim is None:
            missing.append('observed_scene.actual_evidence.' + ref)
        if claim is not None and not current_positive_claim(claim, snapshot.revision):
            missing.append('observed_scene.current_evidence.' + ref)
    layers = ()
    if not missing:
        layers = measure_scene_layers_d(FrameGrid(rows=observed.world_input.frame), request.calibrations,
            request.layer_questions, request.occlusions, budget)
    return ObservedSceneReadResult(request, observed.acquisition, observed.world_input, tuple(layers), evidence,
        snapshot.revision, tuple(dict.fromkeys(missing)))
