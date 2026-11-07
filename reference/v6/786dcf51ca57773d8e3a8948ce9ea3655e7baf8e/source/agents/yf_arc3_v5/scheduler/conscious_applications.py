"""Source enumeration, DRM interpretation and exact native parent consumption."""
from agents.yf_arc3_v5.capabilities.conscious_application_candidates import (
    OperationalConsciousnessApplicationDomain, OperationalConsciousnessApplicationReview,
    OperationalConsciousnessNativeMeansReview, enumerate_application_domain,
)
from agents.yf_arc3_v5.capabilities.mechanism_application import ApplicationBindingEnumeration
from agents.yf_arc3_v5.drm.meaning import DeclaredAlternativeFacts, project_declared_alternatives
from agents.yf_arc3_v5.logos.types import immutable_json_data
from .registry import PureCallBlocked
from agents.yf_arc3_v5.capabilities.conscious_application_prediction import calculate_conditional_translation
from agents.yf_arc3_v5.logos.operational_prediction import OperationalConsciousnessApplicationPrediction
from agents.yf_arc3_v5.capabilities.conscious_symbolic_prediction import (
    calculate_symbolic_transition, combine_application_predictions,
)
from agents.yf_arc3_v5.capabilities.conscious_application_consequences import (
    OperationalConsciousnessApplicationConsequences, measure_application_consequences,
)
from agents.yf_arc3_v5.capabilities.conscious_experiment_nomination import (
    OperationalConsciousnessExperimentNomination, measure_experiment_nomination, assemble_experiment_nomination,
)


def _expected_consequences(owner, domain, prediction):
    measured = measure_application_consequences(domain, prediction)
    projection = project_declared_alternatives(drm=owner._drm,
        selection_policy_ref='policy.conscious_application_consequences',
        alternative_refs=measured['alternative_refs'], descriptive_facts=measured['descriptive_by_ref'])
    return OperationalConsciousnessApplicationConsequences(domain_ref=domain.domain_ref,
        goal_ref=domain.goal_ref, prediction_digest=measured['prediction_digest'],
        descriptive_by_ref=measured['descriptive_by_ref'], projection=projection)


def _current_control_projection(owner, domain):
    packet = domain.current_control_candidates
    return project_declared_alternatives(drm=owner._drm,
        selection_policy_ref='policy.conscious_experiment_current_controls',
        alternative_refs=packet.get('proof_refs', ()), descriptive_facts=packet.get('rows', {}))


def _verify_application(owner, review, policy_ref):
    measured = enumerate_application_domain(review.domain)
    expected = project_declared_alternatives(drm=owner._drm,
        selection_policy_ref=policy_ref, alternative_refs=[], descriptive_facts=measured)
    facts = expected.alternative_facts.get(review.source_disposition_ref)
    if (immutable_json_data(review.enumeration) != measured['enumeration']
            or review.projection != expected or facts is None or facts.get('eligible') is not True
            or review.question_ref != facts.get('question_ref')):
        raise PureCallBlocked('application review changed its declared domain, enumeration or question')
    translation = calculate_conditional_translation(measured['conditional_translation_measurement'], facts) \
        if facts.get('calculate_conditional_translation') is True else None
    symbolic = calculate_symbolic_transition(measured['symbolic_transition_measurement'], facts) \
        if facts.get('calculate_symbolic_state_transition') is True else None
    predicted = combine_application_predictions(measured, translation, symbolic)
    if review.prediction != predicted:
        raise PureCallBlocked('application consumption lost its exact conditional prediction')
    if ('goal_comparison_context' in review.domain.model_fields_set or review.consequences is not None
            ) and review.consequences != _expected_consequences(owner, review.domain, predicted):
        raise PureCallBlocked('application consumption lost the declared goal consequence comparison')
    if review.domain.experiment_nomination_required or review.experiment_nomination is not None:
        nomination = review.experiment_nomination
        if nomination is None:
            raise PureCallBlocked('application consumption lost its required experiment nomination')
        measurement = measure_experiment_nomination(review.domain, review.enumeration, predicted, review.consequences,
            _current_control_projection(owner, review.domain))
        projected = project_declared_alternatives(drm=owner._drm,
            selection_policy_ref='policy.conscious_native_experiment_nomination',
            alternative_refs=[], descriptive_facts=measurement)
        if nomination != assemble_experiment_nomination(measurement, projected, nomination.source_disposition_ref):
            raise PureCallBlocked('application consumption changed its experiment question, observables or binding debts')
    return review


def enumerate_candidates(owner, context):
    return enumerate_application_domain(context.arguments['domain'])


def read_calculation(owner, context):
    args = context.arguments
    measured = enumerate_application_domain(args['measured']['domain'])
    expected = project_declared_alternatives(drm=owner._drm,
        selection_policy_ref=args['selection_policy_ref'], alternative_refs=[], descriptive_facts=measured)
    facts = expected.alternative_facts.get(args['selected_ref'])
    if (measured != args['measured'] or expected != DeclaredAlternativeFacts.model_validate(args['projected'])
            or facts is None or facts.get('eligible') is not True):
        raise PureCallBlocked('application calculation has no exact Source-selected DRM hypothesis')
    return facts


def calculate_prediction(owner, context):
    facts = read_calculation(owner, context)
    if facts.get('calculate_conditional_translation') is not True:
        raise PureCallBlocked('conditional translation was not declared by DRM')
    return immutable_json_data(calculate_conditional_translation(
        context.arguments['measured']['conditional_translation_measurement'], facts))


def calculate_state_prediction(owner, context):
    facts = read_calculation(owner, context)
    if facts.get('calculate_symbolic_state_transition') is not True:
        raise PureCallBlocked('symbolic state prediction was not declared by DRM')
    return immutable_json_data(calculate_symbolic_transition(
        context.arguments['measured']['symbolic_transition_measurement'], facts))


def bind_prediction(owner, context):
    args = context.arguments
    parts = tuple(OperationalConsciousnessApplicationPrediction.model_validate(args[key])
        if args[key] is not None else None for key in ('translation', 'symbolic'))
    return immutable_json_data(combine_application_predictions(args['measured'], *parts))


def measure_consequences(owner, context):
    args = context.arguments
    domain = OperationalConsciousnessApplicationDomain.model_validate(args['domain'])
    prediction = OperationalConsciousnessApplicationPrediction.model_validate(args['prediction']) \
        if args['prediction'] is not None else None
    return measure_application_consequences(domain, prediction)


def retain_consequences(owner, context):
    args = context.arguments
    domain = OperationalConsciousnessApplicationDomain.model_validate(args['domain'])
    prediction = OperationalConsciousnessApplicationPrediction.model_validate(args['prediction']) \
        if args['prediction'] is not None else None
    expected = _expected_consequences(owner, domain, prediction)
    if (measure_application_consequences(domain, prediction) != args['measured']
            or expected.projection != DeclaredAlternativeFacts.model_validate(args['projected'])):
        raise PureCallBlocked('goal consequences differ from their actual prediction and DRM meaning')
    return immutable_json_data(expected)


def append_review(owner, context):
    args = context.arguments
    measured = args['measured']
    projected = DeclaredAlternativeFacts.model_validate(args['projected'])
    facts = projected.alternative_facts.get(args['selected_ref'])
    if facts is None or facts.get('eligible') is not True:
        raise PureCallBlocked('application enumeration has no Source-selected disposition')
    review = OperationalConsciousnessApplicationReview(
        domain=OperationalConsciousnessApplicationDomain.model_validate(measured['domain']),
        enumeration=ApplicationBindingEnumeration.model_validate(measured['enumeration'])
            if measured['enumeration'] is not None else None,
        projection=projected, source_disposition_ref=args['selected_ref'], question_ref=facts['question_ref'],
        prediction=OperationalConsciousnessApplicationPrediction.model_validate(args['prediction'])
            if args['prediction'] is not None else None,
        consequences=OperationalConsciousnessApplicationConsequences.model_validate(args['consequences']),
        experiment_nomination=OperationalConsciousnessExperimentNomination.model_validate(args['experiment_nomination']))
    _verify_application(owner, review, args['selection_policy_ref'])
    prior = tuple(OperationalConsciousnessApplicationReview.model_validate(row) for row in args['previous'])
    if len(prior) >= 64 or any(row.domain.domain_ref == review.domain.domain_ref for row in prior):
        raise PureCallBlocked('application enumeration lost its finite distinct domain')
    return tuple(immutable_json_data(row) for row in (*prior, review))


def measure_nomination(owner, context):
    args = context.arguments
    domain = OperationalConsciousnessApplicationDomain.model_validate(args['domain'])
    controls = _current_control_projection(owner, domain)
    if controls != DeclaredAlternativeFacts.model_validate(args['control_projection']):
        raise PureCallBlocked('experiment controls differ from their exact current DRM evidence projection')
    return measure_experiment_nomination(domain,
        ApplicationBindingEnumeration.model_validate(args['enumeration']) if args['enumeration'] is not None else None,
        OperationalConsciousnessApplicationPrediction.model_validate(args['prediction']) if args['prediction'] is not None else None,
        OperationalConsciousnessApplicationConsequences.model_validate(args['consequences']), controls)


def retain_nomination(owner, context):
    args = context.arguments
    projected = project_declared_alternatives(drm=owner._drm,
        selection_policy_ref='policy.conscious_native_experiment_nomination',
        alternative_refs=[], descriptive_facts=args['measured'])
    if projected != DeclaredAlternativeFacts.model_validate(args['projected']):
        raise PureCallBlocked('experiment nomination differs from its actual DRM question')
    return immutable_json_data(assemble_experiment_nomination(args['measured'], projected, args['selected_ref']))


def bind_native_review(owner, context):
    args = context.arguments
    review = OperationalConsciousnessNativeMeansReview(
        mechanism_projection=DeclaredAlternativeFacts.model_validate(args['projection']),
        application_reviews=tuple(OperationalConsciousnessApplicationReview.model_validate(row)
            for row in args['application_reviews']))
    return immutable_json_data(verify_native_review(owner, args['inputs'], review))


def verify_native_review(owner, inputs, value):
    review = OperationalConsciousnessNativeMeansReview.model_validate(value)
    expected = project_declared_alternatives(drm=owner._drm,
        selection_policy_ref='policy.declared_functional_research_coverage',
        alternative_refs=inputs['mechanism_refs'], descriptive_facts=inputs['descriptive_by_ref'])
    domains = tuple(OperationalConsciousnessApplicationDomain.model_validate(row) for row in inputs['application_domains'])
    if (review.mechanism_projection != expected
            or tuple(row.domain for row in review.application_reviews) != domains):
        raise PureCallBlocked('native means consumption lost a declared application domain')
    for row in review.application_reviews:
        _verify_application(owner, row, 'policy.conscious_application_enumeration')
    return review
