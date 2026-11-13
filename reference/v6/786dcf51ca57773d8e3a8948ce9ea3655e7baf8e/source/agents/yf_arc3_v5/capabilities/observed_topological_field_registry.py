"""Typed bindings for source-admitted observed topological correspondences."""
from .observed_topological_field import (
    ObservedTopologyProposal, ObservedTopologyMeasurementInput, ObservedTopologyScopeBinding,
    ObservedTopologyReturn, ObservedTopologyCorrespondence, ObservedTopologyAdmission,
    measure_observed_topology, bind_observed_topology_scope,
    measure_observed_topology_correspondences, append_observed_topology_loci)
from .contracts import InteractionProbeAgenda
from .topological_region_recolor import TopologicalRecolorRequest

OBSERVED_TOPOLOGY_MODELS = (ObservedTopologyProposal, ObservedTopologyMeasurementInput,
    ObservedTopologyScopeBinding, ObservedTopologyReturn, ObservedTopologyCorrespondence, ObservedTopologyAdmission)
OBSERVED_TOPOLOGY_TYPES = tuple(t.__name__ for t in OBSERVED_TOPOLOGY_MODELS)


def observed_topology_entries(factory):
    rows = (
        ('capability.observed_topology_geometry', measure_observed_topology,
         ObservedTopologyMeasurementInput, ObservedTopologyProposal),
        ('capability.observed_topology_scope', bind_observed_topology_scope,
         ObservedTopologyScopeBinding, TopologicalRecolorRequest),
        ('capability.observed_topology_correspondences', measure_observed_topology_correspondences,
         ObservedTopologyReturn, ObservedTopologyCorrespondence),
        ('capability.observed_topology_loci', append_observed_topology_loci,
         ObservedTopologyAdmission, InteractionProbeAgenda))
    return tuple(factory(capability_id=ref, implementation=method, input_model=before,
        output_model=after, source_file='observed_topological_field.py',
        applicability=('bounded_current_separated_panes_and_uniform_framed_interiors',),
        invariants=('source_admits_reference_interpretation', 'existing_pocket_calculator_and_point_producer',
                    'pockets_preserve_their_parent', 'current_why_and_permits_independent'),
        falsifiers=('ambiguous_pane_or_reference', 'incomplete_pocket_domain',
                    'current_pigment_or_write_effect_contradicts_hypothesis'))
        for ref, method, before, after in rows)


def observed_topology_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        'capability.observed_topology_geometry': ((p('request', 'InteractionProbeInput'), p('agenda', 'InteractionProbeAgenda')), 'ObservedTopologyProposal'),
        'capability.observed_topology_scope': ((p('proposal', 'ObservedTopologyProposal'),
            p('source_disposition_ref', 'Ref'), p('source_alternative_facts', 'Any')), 'TopologicalRecolorRequest'),
        'capability.observed_topology_correspondences': ((p('proposal', 'ObservedTopologyProposal'), p('result', 'DMechanicalResult')), 'ObservedTopologyCorrespondence'),
        'capability.observed_topology_loci': ((p('correspondence', 'ObservedTopologyCorrespondence'),
            p('source_disposition_ref', 'Ref'), p('source_alternative_facts', 'Any')), 'InteractionProbeAgenda'),
    }
