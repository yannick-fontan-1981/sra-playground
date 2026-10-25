"""Bounded transport of Source-declared activity schemas between controllers.

Archive contents remain historical hypotheses. DRM/SRC qualify their class and
current applicability; neither loading a file nor matching a name releases ACT.
No donor geometry, action payload or scene binding is exported.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from pydantic import Field, ValidationError, model_validator

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest


class ObservedActivitySchema(FrozenModel):
    origin_claim_ref: Ref
    origin_claim_digest: Ref
    origin_workflow_ref: Ref
    observed_activity_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    ordered_activity_workflow_refs: tuple[Ref, ...] = Field(default=(), max_length=32)
    component_workflow_refs: tuple[Ref, ...] = Field(default=(), max_length=32)
    origin_proof_rule: Ref
    origin_ground_refs: tuple[Ref, ...] = Field(max_length=128)
    origin_epistemic_status: Ref
    origin_disposition: Ref
    origin_polarity: Ref
    origin_has_contradictions: bool
    drop_scene_local_bindings: bool
    instance_binding_forbidden: bool
    schema_status: Ref

    @model_validator(mode="after")
    def validate_observed_structure(self) -> "ObservedActivitySchema":
        if self.ordered_activity_workflow_refs:
            if len(self.ordered_activity_workflow_refs) != len(
                self.observed_activity_refs
            ):
                raise ValueError(
                    "each observed activity needs its actual workflow occurrence"
                )
            if (
                tuple(dict.fromkeys(self.ordered_activity_workflow_refs))
                != self.component_workflow_refs
            ):
                raise ValueError(
                    "component inventory differs from observed workflow occurrences"
                )
        elif self.component_workflow_refs:
            raise ValueError("component inventory has no observed occurrence map")
        return self


class PortableActivityArchive(FrozenModel):
    source_manifest_sha256: Ref
    origin_game_id: Ref
    origin_run_id: Ref
    origin_state_hash: Ref
    origin_state_revision: int = Field(strict=True, ge=0)
    schemas: tuple[ObservedActivitySchema, ...] = Field(max_length=8)
    schema_version: Ref = "yf_arc3_v5.portable_activity_archive.v1"


class ActivityMemoryCapacityExceeded(ValueError):
    """The bounded projection cannot represent the complete historical domain."""


def export_archive(snapshot, *, profile, source_manifest, game_id, run_id, path=None):
    """Project the declared export fields from canonical Source schema CLAIMs."""
    schemas = []
    for claim in snapshot.claims_for_predicate(profile["schema_predicate"]):
        attrs = claim.attributes
        activities = attrs.get(profile["activity_field"], ())
        if not activities or not claim.arguments:
            continue
        schemas.append(
            ObservedActivitySchema(
                origin_claim_ref=claim.id,
                origin_claim_digest=stable_digest(claim),
                origin_workflow_ref=claim.arguments[0],
                observed_activity_refs=activities,
                ordered_activity_workflow_refs=attrs.get(
                    "ordered_activity_workflow_refs", ()
                ),
                component_workflow_refs=attrs.get("component_workflow_refs", ()),
                origin_proof_rule=claim.proof_rule,
                origin_ground_refs=claim.grounds,
                origin_epistemic_status=claim.epistemic_status.value,
                origin_disposition=claim.disposition.value,
                origin_polarity=claim.polarity.value,
                origin_has_contradictions=bool(
                    claim.active_contradictions or claim.defeated_by
                ),
                drop_scene_local_bindings=attrs.get("drop_scene_local_bindings")
                is True,
                instance_binding_forbidden=attrs.get("instance_binding_forbidden")
                is True,
                schema_status=attrs.get("schema_status", "undeclared"),
            )
        )
    archive = PortableActivityArchive(
        source_manifest_sha256=source_manifest,
        origin_game_id=game_id,
        origin_run_id=run_id,
        origin_state_hash=snapshot.state_hash,
        origin_state_revision=snapshot.revision,
        schemas=tuple(schemas),
    )
    encoded = archive.model_dump_json(indent=2).encode("utf-8")
    if len(encoded) > 65536:
        raise ActivityMemoryCapacityExceeded("portable activity archive exceeds 64 KiB")
    if path is None:
        return archive
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".writing")
    temporary.write_bytes(encoded + b"\n")
    os.replace(temporary, path)
    return archive


def read_archive(path):
    path = Path(path)
    if path.stat().st_size > 65536:
        raise ValueError("portable activity archive exceeds 64 KiB")
    raw = json.loads(path.read_bytes())
    if raw.get("schema_version") != "yf_arc3_v5.portable_activity_archive.v1":
        raise ValueError("unsupported portable activity archive version")
    return PortableActivityArchive.model_validate(raw)


def _inspection_fields(phase, frame_ref, rows):
    token = stable_digest((phase, frame_ref, rows))
    return {
        "inspection_ref": "event.portable_activity.inspection." + token,
        "inspection_claim_ref": "claim.portable_activity.inspection." + token,
        "input_item_count": len(rows),
    }


def import_facts(archive, *, source_manifest, frame_ref):
    rows = []
    for schema in archive.schemas:
        digest = stable_digest(
            (
                archive.source_manifest_sha256,
                archive.origin_run_id,
                schema.origin_claim_digest,
            )
        )
        rows.append(
            FrozenMap(
                {
                    **schema.model_dump(mode="python"),
                    "memory_ref": "memory.portable_activity." + digest,
                    "memory_claim_ref": "claim.memory.portable_activity." + digest,
                    "schema_digest": digest,
                    "observed_activity_count": len(schema.observed_activity_refs),
                    "observed_activity_ref": schema.observed_activity_refs[0],
                    "origin_game_id": archive.origin_game_id,
                    "origin_run_id": archive.origin_run_id,
                    "origin_source_manifest": archive.source_manifest_sha256,
                }
            )
        )
    return FrozenMap(
        {
            **_inspection_fields("import", frame_ref, tuple(rows)),
            "phase": "import",
            "measurement_complete": True,
            "source_exact": archive.source_manifest_sha256 == source_manifest,
            "observation_ref": frame_ref,
            "schema_rows": tuple(rows),
            "evidence_refs": (frame_ref,),
            "existing_term_refs": (),
        }
    )


def owned_activity_facts(
    snapshot, *, profile, source_manifest, frame_ref, game_id, run_id
):
    """Measure the complete owned schema domain without a file or scene bindings."""
    claims = tuple(
        claim
        for claim in snapshot.claims_for_predicate(profile["schema_predicate"])
        if claim.attributes.get(profile["activity_field"], ()) and claim.arguments
    )
    owned_versions_current = all(
        (current := snapshot.claim(memory.attributes["origin_claim_ref"])) is not None
        and stable_digest(current) == memory.attributes["origin_claim_digest"]
        for memory in snapshot.claims_for_predicate(profile["recalled_predicate"])
        if memory.attributes.get("origin_run_id") == run_id
    )
    archive = None
    if owned_versions_current and len(claims) <= profile["maximum_owned_schema_count"]:
        try:
            archive = export_archive(
                snapshot,
                profile=profile,
                source_manifest=source_manifest,
                game_id=game_id,
                run_id=run_id,
            )
        except (ActivityMemoryCapacityExceeded, ValidationError):
            # Raw canonical claims remain intact. An unrepresentable complete
            # domain cannot establish uniqueness or current applicability.
            pass
    if archive is None:
        return FrozenMap(
            {
                **_inspection_fields("owned-import", frame_ref, (len(claims),)),
                "phase": "import",
                "source_exact": True,
                "measurement_complete": False,
                "input_item_count": len(claims),
                "observation_ref": frame_ref,
                "schema_rows": (),
                "evidence_refs": (frame_ref,),
            }
        )
    facts = import_facts(archive, source_manifest=source_manifest, frame_ref=frame_ref)
    additions = []
    unchanged = 0
    for row in facts["schema_rows"]:
        existing = snapshot.claim(row["memory_claim_ref"])
        if existing is None:
            additions.append(row)
            continue
        # An immutable recalled version keeps its original qualification basis.
        # Re-deriving it at a later boundary would change its grounds under the
        # same ID. A conflicting origin remains an incomplete measurement.
        if existing.predicate != profile["recalled_predicate"] or any(
            existing.attributes.get(field) != row[field]
            for field in (
                "origin_claim_ref",
                "origin_claim_digest",
                "origin_source_manifest",
                "origin_run_id",
                "origin_workflow_ref",
                "observed_activity_refs",
            )
        ):
            return FrozenMap(
                {**facts, "measurement_complete": False, "schema_rows": ()}
            )
        unchanged += 1
    rows = tuple(additions)
    return FrozenMap(
        {
            **facts,
            **_inspection_fields("owned-import-delta", frame_ref, rows),
            "schema_rows": rows,
            "input_item_count": len(rows),
            "already_recalled_item_count": unchanged,
            "owned_inventory_item_count": len(archive.schemas),
        }
    )


def current_facts(
    snapshot, agenda, projected, *, profile, frame_ref, memory_domain_complete=True
):
    memories = tuple(snapshot.claims_for_predicate(profile["recalled_predicate"]))
    rows = []
    complete = (
        memory_domain_complete and len(agenda.alternative_refs) * len(memories) <= 256
    )
    for candidate_ref in agenda.alternative_refs:
        facts = projected.alternative_facts[candidate_ref]
        # Keep every historical alternative. DRM requires one supported schema;
        # Python must not pick a winner when several histories are available.
        for memory in memories:
            if not complete:
                continue
            token = stable_digest((frame_ref, candidate_ref, memory.id, facts))
            rows.append(
                FrozenMap(
                    {
                        "candidate_ref": candidate_ref,
                        "binding_token": token,
                        "memory_ref": memory.arguments[0],
                        "memory_claim_ref": memory.id,
                        "source_schema_class_ref": memory.attributes.get(
                            "schema_class_ref"
                        ),
                        "recalled_schema_count": len(memories),
                        "reflection_supported": facts.get(
                            "reflection_repair_continuation_eligible"
                        ),
                        "periodic_status": facts.get("periodic_noise_status"),
                        "observation_ref": frame_ref,
                        "row_evidence_refs": (frame_ref, memory.id),
                        "projection_digest": stable_digest(facts),
                    }
                )
            )
    return FrozenMap(
        {
            **_inspection_fields("current", frame_ref, tuple(rows)),
            "phase": "current",
            "source_exact": True,
            "measurement_complete": complete,
            "observation_ref": frame_ref,
            "candidate_rows": tuple(rows),
            "evidence_refs": (frame_ref, *(memory.id for memory in memories)),
            "existing_term_refs": tuple(memory.arguments[0] for memory in memories),
        }
    )


def attach_current_proof_rows(
    snapshot, agenda, *, profile, frame_ref, measurement_complete=True
):
    memories = {
        claim.id: claim
        for claim in snapshot.claims_for_predicate(profile["recalled_predicate"])
    }
    proofs = tuple(snapshot.claims_for_predicate(profile["current_predicate"]))
    result = {}
    for candidate_ref in agenda.alternative_refs:
        matching = tuple(
            claim
            for claim in proofs
            if measurement_complete
            and claim.attributes.get("memory_revalidation_observation_ref") == frame_ref
            and claim.attributes.get("candidate_ref") == candidate_ref
            and claim.attributes.get("memory_claim_ref") in memories
        )
        recalled_refs = tuple(
            dict.fromkeys(claim.attributes["memory_claim_ref"] for claim in matching)
        )
        result[candidate_ref] = FrozenMap(
            {
                "portable_activity_proof_measurement_complete": measurement_complete,
                "portable_activity_current_proof_count": len(matching),
                "portable_activity_recalled_count": len(recalled_refs),
                "portable_activity_current_proof_refs": tuple(
                    claim.id for claim in matching
                ),
                "portable_activity_recalled_claim_refs": recalled_refs,
            }
        )
    # Source reconstructs projected alternatives from descriptive deltas. Both
    # representations must carry the same literal canonical-reference join.
    return agenda.model_copy(
        update={
            key: FrozenMap(
                {
                    ref: FrozenMap.overlay(facts, result[ref])
                    for ref, facts in sorted(getattr(agenda, key).items())
                }
            )
            for key in ("alternative_facts", "descriptive_delta_facts")
        }
    )
