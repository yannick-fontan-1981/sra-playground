"""Source strategy ports; Root retains its existing K25/K03/K09 registry."""
from .anchor_solving_contracts_c import AnchorSolvingBindInputC, AnchorSolvingFinishInputC, AnchorSolvingReturnC
from .inverse_anchor_signature import AnchorRequest
from .anchor_solving_c import bind_anchor_solving, finish_anchor_solving, measure_anchor_join, get_anchor_join, return_anchor_join, blocked_anchor_publication
from .anchor_solving_contracts_c import AnchorBindingBlockedInputC,AnchorSolvingFactsC
from .anchor_solving_contracts_c import AnchorJoinInputC, AnchorJoinFactsC, AnchorJoinReturnInputC
from .family_result_join import FamilyJoinRequest
from .anchor_solving_contracts_c import (AnchorStockPrepareInputC, AnchorStockPreparedC,
    AnchorStockSimulationInputC, AnchorStockAppendInputC, AnchorStockSealInputC, AnchorStockRowsC, AnchorStockStartInputC)
from .contracts import QuantitySimulationInput
from .anchor_stock_c import prepare_anchor_stock, get_anchor_stock_simulation, append_anchor_stock, seal_anchor_stock, start_anchor_stock

ANCHOR_FRONTIER_C_TYPES=('AnchorFrontierFieldC','AnchorObservedFacetC','AnchorFrontierInputC',
    'AnchorFrontierFactsC','AnchorFrontierCalculationC','AnchorFrontierReturnC','AnchorFrontierInterpretationC',
    'AnchorFrontierPublicationC','AnchorFrontierPublicationJoinC','AnchorFrontierAgendaInputC','AnchorFrontierAgendaRequestC')

ANCHOR_SOLVING_C_TYPES = ("AnchorTargetLayoutC", "AnchorGoalContractC", "AnchorLawScopeC", "AnchorCanonicalBindingC", "AnchorPreparationSupportC", "AnchorActionBindingC", "AnchorSolvingInputC",
    "AnchorSolvingFactsC", "AnchorSolvingBindInputC", "AnchorSolvingFinishInputC", "AnchorSolvingReturnC",
    "AnchorConstructionSupportC", "AnchorStockWitnessC", "AnchorStockPreparedC", "AnchorStockPrepareInputC",
    "AnchorStockSimulationInputC", "AnchorStockAppendInputC", "AnchorStockSealInputC", "AnchorStockRowsC", "AnchorStockStartInputC",
    "AnchorJoinInputC", "AnchorJoinFactsC", "AnchorJoinReturnInputC", "AnchorBindingPublicationC", "AnchorBindingReturnC", "AnchorBindingBlockedInputC",*ANCHOR_FRONTIER_C_TYPES)
ANCHOR_SOLVING_C_ENTRIES = (
    ("capability.anchor_solving_native_c", bind_anchor_solving, AnchorSolvingBindInputC, AnchorRequest),
    ("capability.anchor_solving_return_c", finish_anchor_solving, AnchorSolvingFinishInputC, AnchorSolvingReturnC),
    ("capability.anchor_stock_prepare_c", prepare_anchor_stock, AnchorStockPrepareInputC, AnchorStockPreparedC),
    ("capability.anchor_stock_simulation_c", get_anchor_stock_simulation, AnchorStockSimulationInputC, QuantitySimulationInput),
    ("capability.anchor_stock_append_c", append_anchor_stock, AnchorStockAppendInputC, AnchorStockRowsC),
    ("capability.anchor_stock_start_c", start_anchor_stock, AnchorStockStartInputC, AnchorStockRowsC),
    ("capability.anchor_stock_seal_c", seal_anchor_stock, AnchorStockSealInputC, AnchorSolvingReturnC),
    ("capability.anchor_join_measure_c", measure_anchor_join, AnchorJoinInputC, AnchorJoinFactsC),
    ("capability.anchor_join_input_c", get_anchor_join, AnchorJoinInputC, FamilyJoinRequest),
    ("capability.anchor_join_return_c", return_anchor_join, AnchorJoinReturnInputC, AnchorSolvingReturnC),
    ("capability.anchor_binding_blocked_c", blocked_anchor_publication, AnchorBindingBlockedInputC, AnchorSolvingFactsC))

def anchor_solving_entries_c(entry_factory):
    from .anchor_frontier_registry_c import anchor_frontier_entries_c
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file=method.__module__.rsplit(".",1)[-1]+".py", applicability=("goal_owned_spatial_beacon_relation",),
        invariants=("current_parent", "spatial_signature", "grounded_dependence", "same_K25", "all_systems", "no_act"),
        falsifiers=("stale_agenda", "palette_as_layout", "mean_extrapolation", "unknown_clearance"))
        for ref, method, inputs, outputs in ANCHOR_SOLVING_C_ENTRIES)+anchor_frontier_entries_c(entry_factory)

def anchor_solving_signatures_c(type_spec, parameter_spec):
    def p(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    from .anchor_frontier_registry_c import anchor_frontier_signatures_c
    return {**anchor_frontier_signatures_c(type_spec,parameter_spec),"capability.anchor_solving_native_c": ((p("measured", "AnchorSolvingFactsC"),), "AnchorRequest"),
        "capability.anchor_solving_return_c": ((p("measured", "AnchorSolvingFactsC"),
            p("returned", "Any")), "AnchorSolvingReturnC"),
        "capability.anchor_stock_prepare_c": ((p("returned","AnchorSolvingReturnC"),p("witness","AnchorStockWitnessC")),"AnchorStockPreparedC"),
        "capability.anchor_stock_simulation_c": ((p("prepared","AnchorStockPreparedC"),),"QuantitySimulationInput"),
        "capability.anchor_stock_append_c": ((p("prepared","AnchorStockPreparedC"),p("measured","Any"),p("prior_rows","Any")),"AnchorStockRowsC"),
        "capability.anchor_stock_start_c": ((p("returned","AnchorSolvingReturnC"),),"AnchorStockRowsC"),
        "capability.anchor_stock_seal_c": ((p("returned","AnchorSolvingReturnC"),p("rows","Any")),"AnchorSolvingReturnC"),
        "capability.anchor_join_measure_c": ((p("returned","AnchorSolvingReturnC"),),"AnchorJoinFactsC"),
        "capability.anchor_join_input_c": ((p("returned","AnchorSolvingReturnC"),),"FamilyJoinRequest"),
        "capability.anchor_join_return_c": ((p("returned","AnchorSolvingReturnC"),p("joined","FamilyJoinResult")),"AnchorSolvingReturnC"),
        "capability.anchor_binding_blocked_c": ((p("returned","AnchorBindingReturnC"),),"AnchorSolvingFactsC")}
