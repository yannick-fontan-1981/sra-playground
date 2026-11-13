"""Native declared domains for bounded application questions; no guessed effects."""
from typing import Literal
from pydantic import Field, model_serializer
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest, immutable_json_data
from agents.yf_arc3_v5.drm.meaning import DeclaredAlternativeFacts
from agents.yf_arc3_v5.logos.operational_prediction import OperationalConsciousnessApplicationPrediction
from .conscious_application_consequences import OperationalConsciousnessApplicationConsequences
from .conscious_experiment_nomination import OperationalConsciousnessExperimentNomination
from .mechanism_application import (
    ApplicationBindingRequest, ApplicationBindingEnumeration, ParticipantSignature,
    enumerate_declared_application_bindings,
)


from .conscious_recovery_preservation import (
    OperationalConsciousnessPreservationRequirements, bind_declared_preservation, bind_recovery_subject_fields)


class OperationalConsciousnessApplicationDomain(FrozenModel):
    domain_ref: Ref
    goal_ref: Ref
    mechanism_ref: Ref
    request: ApplicationBindingRequest | None
    reference_versions: FrozenMap
    addressed_control_refs: tuple[Ref, ...] = ()
    observed_return_context: FrozenMap | None = None
    participant_measurements: FrozenMap = Field(default_factory=FrozenMap)
    goal_comparison_context: FrozenMap = Field(default_factory=FrozenMap)
    symbolic_observation_fields: tuple[Ref, ...] = ()
    recovery_observation_fields: tuple[Ref, ...] = ()
    recovery_subject_fields: FrozenMap = Field(default_factory=FrozenMap)
    maximum_observed_inverse_pairs: int | None = Field(default=None, ge=1, le=4096)
    recovery_search_bounds: FrozenMap = Field(default_factory=FrozenMap)
    conditional_recovery_policy_required: bool = False
    preservation_requirements: OperationalConsciousnessPreservationRequirements | None = None
    maximum_symbolic_prediction_variants: int | None = Field(default=None, ge=1, le=256)
    experiment_nomination_required: bool = False
    late_experiment_control_required: bool = False
    native_acquisition_required: bool = False
    current_control_candidates: FrozenMap = Field(default_factory=FrozenMap)
    commitment_feedback: FrozenMap = Field(default_factory=FrozenMap)
    missing_refs: tuple[Ref, ...] = ()
    participant_domain_exceeds_bound: bool = False
    influence_domain_measured: Literal[False] = False
    utility_established: Literal[False] = False

    @model_serializer(mode='wrap')
    def preserve_prior_domain_shape(self, handler):
        data = handler(self)
        for field in ('addressed_control_refs', 'observed_return_context', 'participant_measurements', 'goal_comparison_context',
                'symbolic_observation_fields', 'maximum_symbolic_prediction_variants', 'experiment_nomination_required',
                'late_experiment_control_required', 'native_acquisition_required', 'current_control_candidates', 'commitment_feedback',
                'recovery_observation_fields', 'recovery_subject_fields', 'maximum_observed_inverse_pairs', 'recovery_search_bounds', 'preservation_requirements', 'conditional_recovery_policy_required'):
            if field not in self.model_fields_set:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('addressed_control_refs', 'observed_return_context', 'participant_measurements', 'goal_comparison_context',
                'symbolic_observation_fields', 'maximum_symbolic_prediction_variants', 'experiment_nomination_required',
                'late_experiment_control_required', 'native_acquisition_required', 'current_control_candidates', 'commitment_feedback',
                'recovery_observation_fields', 'recovery_subject_fields', 'maximum_observed_inverse_pairs', 'recovery_search_bounds', 'preservation_requirements', 'conditional_recovery_policy_required') or name in self.model_fields_set)


class OperationalConsciousnessApplicationReview(FrozenModel):
    domain: OperationalConsciousnessApplicationDomain
    enumeration: ApplicationBindingEnumeration | None
    projection: DeclaredAlternativeFacts
    source_disposition_ref: Ref
    question_ref: Ref
    grants_action: Literal[False] = False
    utility_established: Literal[False] = False
    prediction: OperationalConsciousnessApplicationPrediction | None = None
    consequences: OperationalConsciousnessApplicationConsequences | None = None
    experiment_nomination: OperationalConsciousnessExperimentNomination | None = None

    @model_serializer(mode='wrap')
    def preserve_prior_review_shape(self, handler):
        data = handler(self)
        for name in ('prediction', 'consequences', 'experiment_nomination'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('prediction', 'consequences', 'experiment_nomination') or name in self.model_fields_set)


class OperationalConsciousnessNativeMeansReview(FrozenModel):
    schema_version: Literal['operational_consciousness_native_means_review.v1'] = 'operational_consciousness_native_means_review.v1'
    mechanism_projection: DeclaredAlternativeFacts
    application_reviews: tuple[OperationalConsciousnessApplicationReview, ...] = Field(max_length=64)
    grants_action: Literal[False] = False


def _refs(attributes, names):
    result = set()
    for field in names:
        value = attributes.get(field)
        values = value if isinstance(value, (tuple, list)) else (value,)
        result.update(ref for ref in values if isinstance(ref, str) and ref)
    return result


def native_application_participant_refs(snapshot, native, goal_intent, configuration, *, execution_scope=None):
    from .conscious_goal_binding import measure_goal_relation_evidence
    refs = _refs(goal_intent.declarations, configuration['goal_target_attributes'])
    refs.update(measure_goal_relation_evidence(snapshot, goal_intent.goal_ref, configuration,
        execution_scope=execution_scope)['participant_refs'])
    for ref in native['mechanism_refs']:
        term = snapshot.term(ref)
        if term is not None:
            refs.update(_refs(term.attributes, configuration['participant_reference_attributes']))
    return tuple(sorted(refs))


def measure_native_application_domains(snapshot, native, goal_intent, configuration, *, observed_returns=None,
        participant_measurements=None, current_control_candidates=None, commitment_feedback_by_mechanism=None,
        execution_scope=None):
    """Measure only DRM-named native references; SRC calls the enumerator later."""
    from .conscious_goal_binding import measure_goal_relation_evidence
    goal_relations = measure_goal_relation_evidence(snapshot, goal_intent.goal_ref, configuration,
        execution_scope=execution_scope)
    domains = []
    for mechanism_ref in native['mechanism_refs']:
        feedback = (commitment_feedback_by_mechanism or {}).get(mechanism_ref, FrozenMap())
        observed_return = observed_returns.get(mechanism_ref) if observed_returns is not None else None
        term = snapshot.term(mechanism_ref)
        attributes = term.attributes if term is not None else FrozenMap()
        participants = _refs(attributes, configuration['participant_reference_attributes'])
        participants.update(_refs(goal_intent.declarations, configuration['goal_target_attributes']))
        participants.update(goal_relations['participant_refs'])
        operators = _refs(attributes, configuration['operator_reference_attributes'])
        controls = tuple(sorted(_refs(attributes, configuration['addressed_control_attributes'])))
        packet = current_control_candidates or FrozenMap()
        control_rows = FrozenMap({ref: row for ref, row in sorted(packet.get('rows', {}).items())
            if row['signature'] is None or (row['signature']['addressed_control_ref'] in controls
                and row['signature']['action_kind_ref'] in operators)})
        control_packet = FrozenMap.overlay({'rows': control_rows, 'proof_refs': tuple(control_rows)}, packet)
        versions, missing, signatures = {}, [], []
        if term is None:
            missing.append(mechanism_ref)
        versions[mechanism_ref] = stable_digest(term)
        current_measurements = FrozenMap({ref: participant_measurements[ref] for ref in sorted(participants)
            if participant_measurements is not None and ref in participant_measurements})
        for ref in sorted(participants):
            participant = snapshot.term(ref)
            measured = current_measurements.get(ref)
            versions[ref] = stable_digest((participant, measured))
            if participant is None and measured is None:
                missing.append(ref)
            else:
                signatures.append(ParticipantSignature(participant_ref=ref,
                    signature_ref='application-participant:' + versions[ref]))
        if not participants:
            missing.append('application.declared_participant_domain')
        if len(operators) != 1:
            missing.append('application.single_declared_operator')
        exceeds = len(participants) > configuration['maximum_participants']
        signature = stable_digest((goal_intent, versions, tuple(sorted(operators)), configuration,
            observed_return, control_packet, feedback, goal_relations))
        domain_ref = 'conscious-application-domain:' + signature
        request = None
        if not missing and not exceeds:
            request = ApplicationBindingRequest(operator_ref=next(iter(operators)),
                conditioning_signature_ref='application-conditioning:' + signature,
                candidate_prefix=domain_ref, participants=tuple(signatures),
                requested_cardinalities=tuple(configuration['requested_cardinalities']),
                exchangeable_slots_declared=configuration['exchangeable_slots_declared'],
                maximum_bindings=configuration['maximum_bindings'])
        domains.append(OperationalConsciousnessApplicationDomain(domain_ref=domain_ref,
            goal_ref=goal_intent.goal_ref, mechanism_ref=mechanism_ref, request=request,
            reference_versions=FrozenMap(versions), missing_refs=tuple(missing),
            addressed_control_refs=controls,
            observed_return_context=observed_return,
            participant_measurements=current_measurements,
            symbolic_observation_fields=tuple(configuration['symbolic_observation_fields']),
            recovery_observation_fields=tuple(configuration['recovery_observation_fields']),
            recovery_subject_fields=bind_recovery_subject_fields(attributes, configuration),
            maximum_observed_inverse_pairs=configuration['maximum_observed_inverse_pairs'],
            recovery_search_bounds=FrozenMap(configuration['recovery_search_bounds']),
            conditional_recovery_policy_required=configuration.get('conditional_recovery_policy_required', False),
            preservation_requirements=bind_declared_preservation(goal_intent, mechanism_ref, attributes, configuration),
            maximum_symbolic_prediction_variants=configuration['maximum_symbolic_prediction_variants'],
            experiment_nomination_required=configuration['experiment_nomination_required'],
            late_experiment_control_required=configuration['late_experiment_control_required'],
            native_acquisition_required=configuration['native_acquisition_required'],
            current_control_candidates=control_packet,
            commitment_feedback=feedback,
            goal_comparison_context=FrozenMap({
                'goal_relation_evidence': goal_relations,
                'goal_kind': goal_intent.declarations.get('goal_kind'),
                'declared_target_ref': goal_intent.declarations.get('concrete_target_ref'),
                'declared_target_candidates': goal_intent.declarations.get('concrete_target_candidates', ()),
                'mechanism_goal_ref': attributes.get('goal_ref'),
                'moving_entity_ref': attributes.get('moving_entity_ref'),
                'fixed_entity_ref': attributes.get('fixed_entity_ref'),
                'alignment_axis': attributes.get('alignment_axis'),
                'evidence_contract_ref': native['descriptive_by_ref'][mechanism_ref]['evidence_contract_ref'],
                'preserved_dimension_refs': attributes.get('preserved_dimension_refs', ()),
                'goal_falsifier_refs': goal_intent.declarations.get('falsifier_refs', ()),
            }),
            participant_domain_exceeds_bound=exceeds))
    return tuple(domains)


def enumerate_application_domain(domain):
    current = OperationalConsciousnessApplicationDomain.model_validate(domain)
    enumeration = enumerate_declared_application_bindings(current.request) if current.request is not None else None
    from .conscious_application_prediction import measure_conditional_translation
    from .conscious_symbolic_prediction import measure_symbolic_transition
    translation = measure_conditional_translation(current, enumeration)
    symbolic = measure_symbolic_transition(current, enumeration)
    return FrozenMap({'domain': immutable_json_data(current),
        'symbolic_transition_measurement': symbolic,
        'symbolic_transition_computable_count': symbolic['symbolic_transition_computable_count'],
        'observed_changed_state_count': symbolic['observed_changed_state_count'],
        'symbolic_history_incomplete': symbolic.get('history_incomplete', False),
        'symbolic_variants_exceed_bound': symbolic.get('variants_exceed_bound', False),
        'symbolic_competing_response_count': symbolic.get('competing_response_count', 0),
        'conditional_translation_measurement': translation,
        'translation_computable_count': translation['translation_computable_count'],
        'enumeration': immutable_json_data(enumeration) if enumeration is not None else None,
        'declared_domain_bound': current.request is not None,
        'participant_domain_exceeds_bound': current.participant_domain_exceeds_bound,
        'enumeration_complete': enumeration.complete if enumeration is not None else False,
        'exact_binding_count': enumeration.exact_binding_count if enumeration is not None else None,
        'participant_geometry_variants_present': bool(current.participant_measurements),
        'participant_geometry_ambiguous': any(len(rows) > 1 for _, rows in sorted(current.participant_measurements.items())),
        'participant_predecessors_unresolved': any(row['possible_predecessor_entity_refs']
            for _, rows in sorted(current.participant_measurements.items()) for row in rows),
        'observed_candidate_count': current.observed_return_context.get('observed_candidate_count', 0)
            if current.observed_return_context is not None else 0,
        'observed_physical_return_present': current.observed_return_context.get('physical_effect_present', False)
            if current.observed_return_context is not None else False,
        'observed_physical_packet_consistent': current.observed_return_context.get('physical_packet_dimensions_consistent')
            if current.observed_return_context is not None else None,
        'observed_transient_only_change': current.observed_return_context.get('physical_transient_only_change')
            if current.observed_return_context is not None else None,
        'observed_return_from_prior_frame': current.observed_return_context.get('observation_in_current_frame') is False
            if current.observed_return_context is not None else False,
        'observed_return_source_current': (current.observed_return_context.get('producer_source_current') is True
            and current.observed_return_context.get('latest_inspection_producer_source_current') is True)
            if current.observed_return_context is not None else None,
        'later_application_inspection_unbound': current.observed_return_context.get('later_inspection_unbound', False)
            if current.observed_return_context is not None else False,
        'participants_currently_observed': False,
        'influence_domain_measured': False, 'effect_prediction_available': False})
