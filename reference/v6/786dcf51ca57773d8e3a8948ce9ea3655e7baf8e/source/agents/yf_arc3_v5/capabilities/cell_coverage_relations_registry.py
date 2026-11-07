"""Typed wiring of Source-owned coverage questions to the existing finite CSP."""
from .cell_coverage_relations import (
    CellCoverageProposal, CellCoverageMeasurementInput, CellCoverageScopeBinding,
    CellCoverageReturn, CellCoverageResultInput, CellCoverageAdmission,
    measure_cell_coverage_geometry, bind_cell_coverage_relations,
    measure_cell_coverage_return, append_cell_coverage_measurements,
)
from .contracts import InteractionProbeAgenda
from .finite_search_contracts_c import FiniteSearchInputC

CELL_COVERAGE_TYPES = tuple(x.__name__ for x in (
    CellCoverageProposal, CellCoverageMeasurementInput, CellCoverageScopeBinding,
    CellCoverageReturn, CellCoverageResultInput, CellCoverageAdmission))


def cell_coverage_entries(factory):
    rows = (
        ('capability.cell_coverage_geometry', measure_cell_coverage_geometry, CellCoverageMeasurementInput, CellCoverageProposal),
        ('capability.cell_coverage_scope', bind_cell_coverage_relations, CellCoverageScopeBinding, FiniteSearchInputC),
        ('capability.cell_coverage_result', measure_cell_coverage_return, CellCoverageResultInput, CellCoverageReturn),
        ('capability.cell_coverage_measurements', append_cell_coverage_measurements, CellCoverageAdmission, InteractionProbeAgenda),
    )
    return tuple(factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file='cell_coverage_relations.py', applicability=('current_support_geometry_and_source_goal_variant',),
        invariants=('source_owns_goal_and_constraints', 'existing_finite_csp_only', 'one_step_trial_not_verified_word',
                    'ordered_prefix_and_support_preserved', 'no_world_single_visit_or_terminal_law'),
        falsifiers=('stale_geometry_or_receiver', 'first_edge_or_prefix_model_contradicted', 'bounded_is_not_empty_proof'))
        for ref, method, before, after in rows)


def cell_coverage_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.cell_coverage_geometry': ((p('request', 'InteractionProbeInput'), p('agenda', 'InteractionProbeAgenda')), 'CellCoverageProposal'),
        'capability.cell_coverage_scope': ((p('proposal', 'CellCoverageProposal'), p('source_disposition_ref', 'Ref'),
            p('source_alternative_facts', 'Any'), p('state_revision', 'Integer')), 'FiniteSearchInputC'),
        'capability.cell_coverage_result': ((p('proposal', 'CellCoverageProposal'), p('result', 'FiniteSearchFactsC')), 'CellCoverageReturn'),
        'capability.cell_coverage_measurements': ((p('calculation', 'CellCoverageReturn'), p('source_disposition_ref', 'Ref'),
            p('source_alternative_facts', 'Any')), 'InteractionProbeAgenda'),
    }
