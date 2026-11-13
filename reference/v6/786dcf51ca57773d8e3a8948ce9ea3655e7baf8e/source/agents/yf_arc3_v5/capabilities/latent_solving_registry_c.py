"""K41 parent ports; reuse the existing calculation and collector registries."""
from .latent_solving_contracts_c import (LatentSolvingBindC,LatentSolvingFinishC,LatentSolvingReturnC,
    LatentJoinInputC,LatentJoinFactsC,LatentJoinFinishC)
from .latent_reference_restoration import RestorationRequest
from .latent_solving_c import bind_latent_solving,finish_latent_solving,measure_latent_join,get_latent_join,finish_latent_join
from .family_result_join import FamilyJoinRequest
from .latent_solving_contracts_c import LatentEvidenceInputC,LatentEvidenceRowsC,LatentEvidenceAppendC,LatentEvidenceSealC
from .latent_evidence_c import measure_latent_evidence,start_latent_evidence,bind_latent_evidence,append_latent_evidence,seal_latent_evidence
from .latent_evidence_c import join_latent_interval
from .latent_observed_effect_c import measure_latent_observed_effects,seal_latent_observed_effects,join_latent_owner_publication
from .latent_solving_contracts_c import LatentOwnerPublicationBindingC,LatentOwnerPublicationFactsC,LatentOwnerPublicationJoinC
from .latent_solving_contracts_c import LatentMemoryCaptureFactsC,LatentMemoryCaptureJoinC,LatentMemoryRequestC
from .native_memory_owner_contracts_d import DNativeMemoryOwnerRequest
from .latent_reference_capture_c import prepare_latent_reference_capture,get_latent_reference_capture,seal_latent_reference_capture
from .latent_first_probe_c import measure_latent_first_probes,seal_latent_first_probes
from .latent_actual_metrics_c import measure_latent_actual_metrics,seal_latent_actual_metrics
from .latent_solving_contracts_c import LatentIntervalSourceC,LatentIntervalFactsC,LatentIntervalJoinC,LatentSolvingFactsC

LATENT_SOLVING_C_TYPES=("LatentAppearanceCellC","LatentAppearanceSnapshotC","LatentFieldBindingC","LatentCausalBindingC","LatentSolvingInputC","LatentSolvingFactsC",
    "LatentSolvingBindC","LatentSolvingReturnC","LatentSolvingFinishC","LatentJoinInputC","LatentJoinFactsC","LatentJoinFinishC",
    "LatentEvidenceInputC","LatentEvidenceRowsC","LatentEvidenceAppendC","LatentEvidenceSealC",
    "LatentIntervalSourceC","LatentIntervalFactsC","LatentIntervalJoinC",
    "LatentOwnerPublicationBindingC","LatentOwnerPublicationFactsC","LatentOwnerPublicationJoinC")
LATENT_SOLVING_C_TYPES += ("LatentReferenceRecallC",)
LATENT_SOLVING_C_TYPES += ("LatentReferenceCaptureC","LatentMemoryCaptureFactsC","LatentMemoryCaptureJoinC","LatentMemoryRequestC")
LATENT_SOLVING_C_ENTRIES=(
    ("capability.latent_solving_native_c",bind_latent_solving,LatentSolvingBindC,RestorationRequest),
    ("capability.latent_solving_return_c",finish_latent_solving,LatentSolvingFinishC,LatentSolvingReturnC),
    ("capability.latent_join_measure_c",measure_latent_join,LatentJoinInputC,LatentJoinFactsC),
    ("capability.latent_join_input_c",get_latent_join,LatentJoinInputC,FamilyJoinRequest),
    ("capability.latent_join_finish_c",finish_latent_join,LatentJoinFinishC,LatentSolvingReturnC),
    ("capability.latent_evidence_input_c",bind_latent_evidence,LatentJoinInputC,LatentEvidenceInputC),
    ("capability.latent_evidence_measure_c",measure_latent_evidence,LatentEvidenceInputC,LatentEvidenceRowsC),
    ("capability.latent_evidence_start_c",start_latent_evidence,LatentEvidenceInputC,LatentEvidenceRowsC),
    ("capability.latent_evidence_append_c",append_latent_evidence,LatentEvidenceAppendC,LatentEvidenceRowsC),
    ("capability.latent_evidence_seal_c",seal_latent_evidence,LatentEvidenceSealC,LatentSolvingReturnC),
    ("capability.latent_interval_join_c",join_latent_interval,LatentIntervalJoinC,LatentSolvingFactsC),
    ("capability.latent_observed_effect_measure_c",measure_latent_observed_effects,LatentEvidenceInputC,LatentEvidenceRowsC),
    ("capability.latent_observed_effect_seal_c",seal_latent_observed_effects,LatentEvidenceSealC,LatentSolvingReturnC),
    ("capability.latent_owner_publication_join_c",join_latent_owner_publication,LatentOwnerPublicationJoinC,LatentSolvingReturnC),
    ("capability.latent_memory_capture_prepare_c",prepare_latent_reference_capture,LatentJoinInputC,LatentMemoryCaptureFactsC),
    ("capability.latent_memory_capture_input_c",get_latent_reference_capture,LatentMemoryCaptureFactsC,LatentMemoryRequestC),
    ("capability.latent_memory_capture_seal_c",seal_latent_reference_capture,LatentMemoryCaptureJoinC,LatentSolvingReturnC),
    ("capability.latent_first_probe_measure_c",measure_latent_first_probes,LatentEvidenceInputC,LatentEvidenceRowsC),
    ("capability.latent_first_probe_seal_c",seal_latent_first_probes,LatentEvidenceSealC,LatentSolvingReturnC),
    ("capability.latent_actual_metrics_measure_c",measure_latent_actual_metrics,LatentEvidenceInputC,LatentEvidenceRowsC),
    ("capability.latent_actual_metrics_seal_c",seal_latent_actual_metrics,LatentEvidenceSealC,LatentSolvingReturnC))


def latent_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref,implementation=method,input_model=inputs,output_model=outputs,
        source_file=method.__module__.rsplit(".",1)[-1]+".py",applicability=("current_fixed_reference_parent_question",),
        invariants=("current_acquisition","frozen_parent_why","hypotheses_preserved","no_ACT"),
        falsifiers=("stale_request","unsupported_law_promotion","reference_changed")) for ref,method,inputs,outputs in LATENT_SOLVING_C_ENTRIES)


def latent_solving_signatures_c(type_spec,parameter_spec):
    def p(name,kind):return parameter_spec(name=name,type_spec=type_spec(kind))
    return {
        "capability.latent_solving_native_c":((p("measured","LatentSolvingFactsC"),),"RestorationRequest"),
        "capability.latent_solving_return_c":((p("measured","LatentSolvingFactsC"),p("returned","Any")),"LatentSolvingReturnC"),
        "capability.latent_join_measure_c":((p("returned","LatentSolvingReturnC"),),"LatentJoinFactsC"),
        "capability.latent_join_input_c":((p("returned","LatentSolvingReturnC"),),"FamilyJoinRequest"),
        "capability.latent_join_finish_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentJoinFactsC"),p("joined","Any")),"LatentSolvingReturnC"),
        "capability.latent_evidence_input_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceInputC"),
        "capability.latent_evidence_measure_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceRowsC"),
        "capability.latent_evidence_start_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceRowsC"),
        "capability.latent_evidence_append_c":((p("prior","List<Any>"),p("meaning","DeclaredMeaningInstantiation")),"LatentEvidenceRowsC"),
        "capability.latent_evidence_seal_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentEvidenceRowsC"),p("meanings","List<Any>")),"LatentSolvingReturnC"),
        "capability.latent_interval_join_c":((p("measured","LatentSolvingFactsC"),p("interval","LatentIntervalFactsC")),"LatentSolvingFactsC"),
        "capability.latent_observed_effect_measure_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceRowsC"),
        "capability.latent_observed_effect_seal_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentEvidenceRowsC"),p("meanings","List<Any>")),"LatentSolvingReturnC"),
        "capability.latent_owner_publication_join_c":((p("returned","LatentSolvingReturnC"),p("publication","LatentOwnerPublicationFactsC"),p("published","Any")),"LatentSolvingReturnC"),
        "capability.latent_memory_capture_prepare_c":((p("returned","LatentSolvingReturnC"),),"LatentMemoryCaptureFactsC"),
        "capability.latent_memory_capture_input_c":((p("memory_request","Any"),p("facts","Any"),p("missing_refs","List<String>")),"LatentMemoryRequestC"),
        "capability.latent_memory_capture_seal_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentMemoryCaptureFactsC"),p("captured","Any")),"LatentSolvingReturnC"),
        "capability.latent_first_probe_measure_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceRowsC"),
        "capability.latent_first_probe_seal_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentEvidenceRowsC"),p("meanings","List<Any>")),"LatentSolvingReturnC"),
        "capability.latent_actual_metrics_measure_c":((p("returned","LatentSolvingReturnC"),),"LatentEvidenceRowsC"),
        "capability.latent_actual_metrics_seal_c":((p("returned","LatentSolvingReturnC"),p("measured","LatentEvidenceRowsC"),p("meanings","List<Any>")),"LatentSolvingReturnC")}
