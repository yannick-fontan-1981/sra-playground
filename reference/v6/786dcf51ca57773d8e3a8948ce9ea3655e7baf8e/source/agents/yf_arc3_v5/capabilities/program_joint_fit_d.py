"""Bounded injective assignment/interpretation join on one shared definition map."""
from agents.yf_arc3_v5.logos.types import stable_digest
from .contracts import TypedProgramDefinition
from .typed_recursive_program import measure_typed_assignment_domains, measure_typed_interpreter
from .program_joint_fit_contracts_d import ProgramJointFitMeasurementsD, ProgramJointFitWitnessD
from .program_fragment_measurement_d import measure_flat_program_resources_d, measure_program_fragments_d


def measure_program_joint_fit_d(request):
    assignment = request.assignment_request
    template = request.interpreter_template
    literal_deficits, socket_deficit, flat_work = measure_flat_program_resources_d(request)
    # Reject an underspecified nested work allowance before entering a solver.
    domain_work = len(assignment.tokens) * len(assignment.sockets)
    enumeration_bound = flat_work + domain_work + assignment.maximum_assignment_visits + assignment.maximum_matching_visits
    if enumeration_bound > request.maximum_evaluations:
        raise ValueError('joint enumeration must fit the supplied total work bound')
    domains = measure_typed_assignment_domains(assignment)
    work = flat_work + domain_work + domains.assignment_visits + domains.matching_visits
    witnesses = []
    checked = matched = rejected = bounded = 0
    witness_projection_complete = True
    projection_work = len(template.tokens) + len(request.definitions) + len(assignment.sockets)
    per_candidate_bound = projection_work + template.maximum_steps + template.maximum_calls
    for candidate in domains.joint_assignments:
        if work + per_candidate_bound > request.maximum_evaluations:
            break
        mapping = dict(candidate.socket_token_refs)
        definitions = tuple(TypedProgramDefinition(definition_ref=definition.definition_ref,
            instruction_token_refs=tuple(mapping[ref] for ref in definition.socket_refs))
            for definition in request.definitions)
        interpreter = template.model_copy(update={'definitions': definitions, 'resume_state': None})
        result = measure_typed_interpreter(interpreter)
        work += projection_work + result.steps_executed + result.calls_executed
        checked += 1
        if result.status in ('budget_reached', 'stack_bound_reached', 'call_bound_reached'):
            bounded += 1
        elif result.computed_boundary_match:
            matched += 1
            if len(witnesses) < request.maximum_witnesses:
                fragments, fragment_work, projection_complete = measure_program_fragments_d(
                    interpreter, result, request.maximum_evaluations-work)
                work += fragment_work
                witness_projection_complete = witness_projection_complete and projection_complete
                witnesses.append(ProgramJointFitWitnessD(assignment=candidate, interpretation=result,
                    fragments=fragments, fragment_projection_complete=projection_complete))
        else:
            rejected += 1
    # Domain results remain inspectable, but rejected/unfinished program
    # assignments are not retained as additional executable witnesses.
    summary = domains.model_copy(update={'joint_assignments': (), 'retained_state': None})
    return ProgramJointFitMeasurementsD(assignment_measurement=summary, witnesses=tuple(witnesses),
        assignments_checked=checked, matching_assignments=matched, rejected_assignments=rejected,
        bounded_assignments=bounded, unvisited_assignments=len(domains.joint_assignments)-checked,
        evaluations=work,
        enumeration_complete=domains.domain_enumeration_complete and domains.assignment_enumeration_complete and domains.matching_complete,
        interpretation_complete=checked == len(domains.joint_assignments) and bounded == 0,
        literal_deficits=literal_deficits, flat_entry_socket_deficit=socket_deficit,
        witness_projection_complete=witness_projection_complete,
        model_sha256=stable_digest(('program_joint_fit.current_model.v1', assignment,
            template, request.definitions)))
