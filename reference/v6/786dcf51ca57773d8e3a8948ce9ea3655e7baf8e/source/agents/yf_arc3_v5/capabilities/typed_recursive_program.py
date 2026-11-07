"""Pure bounded measurements for typed resources, edits, calls, and output prefixes."""

from __future__ import annotations

from agents.yf_arc3_v5.capabilities.contracts import (
    TypedAssignmentDomainsInput,
    TypedAssignmentDomainsMeasurements,
    TypedEditSuccessorInput,
    TypedEditSuccessorMeasurements,
    TypedEmissionProvenance,
    TypedInterpreterInput,
    TypedInterpreterMeasurements,
    TypedResourceLocation,
    TypedSocketDomain,
    TypedJointAssignment,
    TypedInterpreterState,
    TypedAssignmentEnumerationState,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_typed_assignment_domains(
    value: TypedAssignmentDomainsInput,
) -> TypedAssignmentDomainsMeasurements:
    """Measure local domains and requested injective physical-token assignments."""

    known_definitions = set(value.definition_refs)
    incompatible_calls = tuple(
        item.token_ref
        for item in value.tokens
        if item.instruction_kind == "call"
        and item.target_definition_ref not in known_definitions
    )
    incompatible_call_set = set(incompatible_calls)
    domains: list[TypedSocketDomain] = []
    complete_domains: list[tuple[str, ...]] = []
    deficits: list[str] = []
    domains_complete = True
    for socket in value.sockets:
        complete_domain = tuple(
            token.token_ref
            for token in value.tokens
            if token.instruction_kind in socket.accepted_instruction_kinds
            and token.token_ref not in incompatible_call_set
        )
        compatible = complete_domain[: value.maximum_domain_members]
        complete_domains.append(complete_domain)
        domains_complete = domains_complete and len(compatible) == len(complete_domain)
        domains.append(
            TypedSocketDomain(
                socket_ref=socket.socket_ref,
                compatible_token_refs=compatible,
            )
        )
        if not compatible:
            deficits.append(socket.socket_ref)
    assignments: list[TypedJointAssignment] = []
    visits = 0
    enumeration_complete = False
    unfilled: tuple[str, ...] = ()
    deficit_count: int | None = None
    matching_visits=0;matching_complete=False
    if value.enumerate_joint_assignments:
        model_sha256=stable_digest(('typed_assignment.retained_state.v1',value.model_revision_ref,
            value.tokens,value.sockets,value.definition_refs,value.maximum_domain_members))
        # Exact bipartite matching on the complete, bounded socket/token packet
        # exposes multiplicity deficits even when every socket has a local domain.
        # Unfilled refs describe this matching, not uniquely impossible sockets.
        token_owner: dict[str, int] = {}
        matching_bound_reached=False

        def augment(socket_index: int, visited_tokens: set[str]) -> bool:
            nonlocal matching_visits,matching_bound_reached
            for token_ref in complete_domains[socket_index]:
                if matching_visits>=value.maximum_matching_visits:
                    matching_bound_reached=True
                    return False
                matching_visits+=1
                if token_ref in visited_tokens:
                    continue
                visited_tokens.add(token_ref)
                previous = token_owner.get(token_ref)
                if previous is None or augment(previous, visited_tokens):
                    token_owner[token_ref] = socket_index
                    return True
            return False

        for socket_index in range(len(value.sockets)):
            augment(socket_index, set())
            if matching_bound_reached:
                break
        filled_indices = set(token_owner.values())
        matching_complete=not matching_bound_reached
        unfilled = tuple(socket.socket_ref for index, socket in enumerate(value.sockets)
            if index not in filled_indices) if matching_complete else ()
        deficit_count = len(unfilled) if matching_complete else None
        # The ordered socket schema is preserved; each physical occurrence can
        # occupy only one socket, including distinct tokens with equal values.
        stack: list[tuple[int, tuple[tuple[str, str], ...], frozenset[str]]] = [(0, (), frozenset())]
        if value.resume_state is not None:
            resume=value.resume_state
            if resume.model_sha256!=model_sha256 or resume.model_revision_ref!=value.model_revision_ref:
                raise ValueError('retained assignments belong to another supplied model')
            if (resume.assignment_visits>value.maximum_assignment_visits
                    or len(resume.completed_assignments)>value.maximum_assignments):
                raise ValueError('retained assignment work already exceeds requested bounds')
            def valid_prefix(prefix,complete=False):
                pairs=prefix.socket_token_refs
                return (len(pairs)<=len(domains) and (not complete or len(pairs)==len(domains))
                    and all(socket==domains[index].socket_ref and token in domains[index].compatible_token_refs
                        for index,(socket,token) in enumerate(pairs)))
            if (any(not valid_prefix(prefix) for prefix in resume.pending_prefixes)
                    or any(not valid_prefix(row,True) for row in resume.completed_assignments)
                    or len(set(row.socket_token_refs for row in resume.completed_assignments))!=len(resume.completed_assignments)):
                raise ValueError('retained assignment prefix differs from the supplied ordered domains')
            prefixes=tuple(prefix.socket_token_refs for prefix in resume.pending_prefixes)
            if len(set(prefixes))!=len(prefixes) or any(
                    left==right[:len(left)] for index,left in enumerate(prefixes)
                    for other,right in enumerate(prefixes) if index!=other):
                raise ValueError('retained assignment frontier has duplicate or overlapping prefixes')
            if any(row.socket_token_refs[:len(prefix)]==prefix
                    for row in resume.completed_assignments for prefix in prefixes):
                raise ValueError('retained completed assignment is still pending')
            stack=[(len(prefix.socket_token_refs),prefix.socket_token_refs,
                frozenset(token for _,token in prefix.socket_token_refs)) for prefix in resume.pending_prefixes]
            assignments=list(resume.completed_assignments);visits=resume.assignment_visits
        while (stack and visits < value.maximum_assignment_visits
                and len(assignments)<value.maximum_assignments):
            index, pairs, used = stack.pop()
            visits += 1
            if index == len(domains):
                assignments.append(TypedJointAssignment(socket_token_refs=pairs))
                if len(assignments) >= value.maximum_assignments:
                    break
                continue
            domain = domains[index]
            for token_ref in reversed(domain.compatible_token_refs):
                if token_ref not in used:
                    stack.append((index + 1, (*pairs, (domain.socket_ref, token_ref)), used | {token_ref}))
        enumeration_complete = not stack and domains_complete
    return TypedAssignmentDomainsMeasurements(
        socket_domains=tuple(domains),
        deficit_socket_refs=tuple(deficits),
        incompatible_call_token_refs=incompatible_calls,
        physical_token_count=len(value.tokens),
        joint_assignments=tuple(assignments),
        assignment_visits=visits,
        matching_visits=matching_visits,matching_complete=matching_complete,
        assignment_enumeration_complete=enumeration_complete,
        domain_enumeration_complete=domains_complete,
        maximum_assignments=value.maximum_assignments if value.enumerate_joint_assignments else None,
        maximum_assignment_visits=value.maximum_assignment_visits if value.enumerate_joint_assignments else None,
        minimum_unfilled_socket_count=deficit_count,
        unfilled_socket_refs_in_maximum_matching=unfilled,
        model_sha256=model_sha256 if value.enumerate_joint_assignments else None,
        actual_bounds=FrozenMap({'domain_members':value.maximum_domain_members,
            'assignments':value.maximum_assignments,'assignment_visits':value.maximum_assignment_visits,
            'matching_visits':value.maximum_matching_visits}),
        retained_state=TypedAssignmentEnumerationState(model_sha256=model_sha256,
            model_revision_ref=value.model_revision_ref,
            pending_prefixes=tuple(TypedJointAssignment(socket_token_refs=pairs) for _,pairs,_ in stack),
            completed_assignments=tuple(assignments),assignment_visits=visits)
            if value.enumerate_joint_assignments and not enumeration_complete else None,
    )


def measure_typed_edit_successor(
    value: TypedEditSuccessorInput,
) -> TypedEditSuccessorMeasurements:
    """Apply exactly one supplied token/socket edit while conserving occurrences."""

    if value.edit_kind == "token_click":
        next_selection = (
            None if value.selection_token_ref == value.edit_ref else value.edit_ref
        )
        return TypedEditSuccessorMeasurements(
            status="selection_changed",
            resulting_locations=value.locations,
            resulting_sockets=value.sockets,
            selection_token_ref=next_selection,
        )

    if value.selection_token_ref is None:
        return TypedEditSuccessorMeasurements(
            status="unchanged_without_selection",
            resulting_locations=value.locations,
            resulting_sockets=value.sockets,
        )

    locations = {item.token_ref: item.location_ref for item in value.locations}
    sockets = {item.socket_ref: item for item in value.sockets}
    moving_ref = value.selection_token_ref
    source_ref = locations[moving_ref]
    destination = sockets[value.edit_ref]
    displaced_ref = destination.occupant_token_ref

    if source_ref in sockets and sockets[source_ref].occupant_token_ref == moving_ref:
        sockets[source_ref] = sockets[source_ref].model_copy(
            update={"occupant_token_ref": None}
        )
    locations[moving_ref] = value.edit_ref
    if displaced_ref is not None and displaced_ref != moving_ref:
        locations[displaced_ref] = source_ref
    sockets[value.edit_ref] = destination.model_copy(
        update={"occupant_token_ref": moving_ref}
    )

    return TypedEditSuccessorMeasurements(
        status="exchanged" if displaced_ref is not None and displaced_ref != moving_ref else "transferred",
        resulting_locations=tuple(
            TypedResourceLocation(token_ref=item.token_ref, location_ref=locations[item.token_ref])
            for item in value.locations
        ),
        resulting_sockets=tuple(sockets[item.socket_ref] for item in value.sockets),
        selection_token_ref=None,
        displaced_token_ref=(
            displaced_ref if displaced_ref is not None and displaced_ref != moving_ref else None
        ),
    )


def measure_typed_interpreter(
    value: TypedInterpreterInput,
) -> TypedInterpreterMeasurements:
    """Interpret one supplied typed definition graph within independent hard bounds."""

    tokens = {item.token_ref: item for item in value.tokens}
    definitions = {item.definition_ref: item for item in value.definitions}
    model_sha256 = stable_digest(("typed_interpreter.retained_state.v1", value.model_revision_ref,
        value.tokens, value.definitions, value.entry_definition_ref,
        value.reference_values, value.boundary_kind))
    definition_ref = value.entry_definition_ref
    instruction_index = 0
    output: list[str] = []
    emissions: list[TypedEmissionProvenance] = []
    returns: list[tuple[str, int]] = []
    call_sites: list[tuple[str, int]] = []
    active_entries: set[tuple[str, int]] = {(definition_ref, 0)}
    steps = 0
    calls = 0
    entry_output_index = 0
    caller_entry_output_indices: list[int] = []
    resume = value.resume_state
    if resume is not None:
        if value.model_revision_ref is None:
            raise ValueError("resumption requires an explicitly supplied current model revision")
        if resume.model_sha256 != model_sha256:
            raise ValueError("retained interpreter state belongs to another supplied model")
        referenced_positions = ((resume.definition_ref, resume.instruction_index),
            *resume.pending_returns, *resume.call_site_chain)
        if any(ref not in definitions or index < 0 or index > len(definitions[ref].instruction_token_refs)
                for ref, index in referenced_positions):
            raise ValueError("retained interpreter position is outside its supplied definition")
        if any(ref not in definitions or index > len(resume.emitted_values)
                for ref, index in resume.active_entries):
            raise ValueError("retained active entry is outside its supplied output scope")
        expected_entries = {(ref, index) for (ref, _), index in
            zip(resume.pending_returns, resume.caller_entry_output_indices)}
        if not resume.normal_termination:
            expected_entries.add((resume.definition_ref, resume.entry_output_index))
        if set(resume.active_entries) != expected_entries:
            raise ValueError("retained active entries differ from the actual caller stack")
        if any(index < 0 or index > len(resume.emitted_values)
                for index in resume.caller_entry_output_indices):
            raise ValueError("retained caller entry is outside its supplied output scope")
        entered = (*[ref for ref, _ in resume.pending_returns[1:]], resume.definition_ref)
        for (caller_ref, pc), (return_ref, return_pc), target_ref in zip(
                resume.call_site_chain, resume.pending_returns, entered):
            instructions = definitions[caller_ref].instruction_token_refs
            if pc >= len(instructions) or caller_ref != return_ref or return_pc != pc + 1:
                raise ValueError("retained caller continuation differs from its call site")
            token = tokens[instructions[pc]]
            if token.instruction_kind != "call" or token.target_definition_ref != target_ref:
                raise ValueError("retained call site does not enter the supplied definition")
        if any(item.output_index != index or item.value_ref != resume.emitted_values[index]
                or item.literal_token_ref not in tokens
                or tokens[item.literal_token_ref].instruction_kind != "literal"
                or tokens[item.literal_token_ref].value_ref != item.value_ref
                or item.definition_ref not in definitions
                or item.instruction_index >= len(definitions[item.definition_ref].instruction_token_refs)
                or definitions[item.definition_ref].instruction_token_refs[item.instruction_index] != item.literal_token_ref
                for index, item in enumerate(resume.emissions)):
            raise ValueError("retained output differs from its supplied literal provenance")
        if (resume.steps_executed > value.maximum_steps or resume.calls_executed > value.maximum_calls
                or len(resume.pending_returns) > value.maximum_stack_depth
                or len(resume.emitted_values) > value.maximum_output):
            raise ValueError("retained execution already exceeds the requested bounds")
        if resume.terminal_status == "normal_termination" and (
                not resume.normal_termination or resume.emitted_values != value.reference_values
                or resume.pending_returns or resume.instruction_index < len(definitions[resume.definition_ref].instruction_token_refs)):
            raise ValueError("retained termination differs from the supplied program boundary")
        definition_ref, instruction_index = resume.definition_ref, resume.instruction_index
        entry_output_index = resume.entry_output_index
        output, emissions = list(resume.emitted_values), list(resume.emissions)
        returns, call_sites = list(resume.pending_returns), list(resume.call_site_chain)
        caller_entry_output_indices = list(resume.caller_entry_output_indices)
        active_entries = set(resume.active_entries)
        steps, calls = resume.steps_executed, resume.calls_executed

    def result(
        status: str,
        *,
        mismatch: int | None = None,
        terminated: bool = False,
    ) -> TypedInterpreterMeasurements:
        prefix_match = mismatch is None and tuple(output) == value.reference_values[: len(output)]
        reached_reference = len(output) >= len(value.reference_values)
        accepted_boundary = (
            reached_reference and prefix_match
            if value.boundary_kind == "finite_prefix"
            else terminated and tuple(output) == value.reference_values
        )
        return TypedInterpreterMeasurements(
            status=status,
            emitted_values=tuple(output),
            emissions=tuple(emissions),
            first_mismatch_index=mismatch,
            pending_returns=tuple(returns),
            prefix_match=prefix_match,
            normal_termination=terminated,
            official_acceptance_observed=(
                value.official_acceptance_evidence and accepted_boundary
            ),
            supplied_official_acceptance_evidence=value.official_acceptance_evidence,
            computed_boundary_match=accepted_boundary,
            steps_executed=steps,
            calls_executed=calls,
            model_sha256=model_sha256,
            actual_bounds=FrozenMap({"steps": value.maximum_steps, "calls": value.maximum_calls,
                "stack": value.maximum_stack_depth, "output": value.maximum_output}),
            retained_state=TypedInterpreterState(
                model_sha256=model_sha256, definition_ref=definition_ref,
                instruction_index=instruction_index, entry_output_index=entry_output_index,
                emitted_values=tuple(output), emissions=tuple(emissions),
                pending_returns=tuple(returns), call_site_chain=tuple(call_sites),
                caller_entry_output_indices=tuple(caller_entry_output_indices),
                active_entries=tuple(sorted(active_entries)), steps_executed=steps,
                calls_executed=calls, first_mismatch_index=mismatch, normal_termination=terminated,
                terminal_status=status if status in {"normal_termination", "mismatch_localized", "nonproductive_cycle"} else None,
            ),
        )

    if resume is not None and resume.terminal_status is not None:
        if resume.terminal_status not in {"normal_termination", "mismatch_localized", "nonproductive_cycle"}:
            raise ValueError("unknown retained interpreter terminal disposition")
        return result(resume.terminal_status, mismatch=resume.first_mismatch_index,
            terminated=resume.normal_termination)
    while True:
        if value.boundary_kind == "finite_prefix" and len(output) == len(
            value.reference_values
        ):
            return result("matched_finite_prefix")
        definition = definitions[definition_ref]
        if instruction_index >= len(definition.instruction_token_refs):
            active_entries.discard((definition_ref, entry_output_index))
            if not returns:
                exact = tuple(output) == value.reference_values
                return result(
                    "normal_termination" if exact else "mismatch_localized",
                    mismatch=None if exact else len(output),
                    terminated=True,
                )
            definition_ref, instruction_index = returns.pop()
            call_sites.pop()
            entry_output_index = caller_entry_output_indices.pop()
            continue

        if steps >= value.maximum_steps or len(output) >= value.maximum_output:
            return result("budget_reached")

        token_ref = definition.instruction_token_refs[instruction_index]
        token = tokens[token_ref]
        if token.instruction_kind == "literal":
            steps += 1
            output_index = len(output)
            literal_value = token.value_ref
            assert literal_value is not None
            output.append(literal_value)
            emissions.append(
                TypedEmissionProvenance(
                    output_index=output_index,
                    value_ref=literal_value,
                    literal_token_ref=token_ref,
                    definition_ref=definition_ref,
                    instruction_index=instruction_index,
                    call_site_chain=tuple(call_sites),
                )
            )
            instruction_index += 1
            if (
                output_index >= len(value.reference_values)
                or literal_value != value.reference_values[output_index]
            ):
                return result("mismatch_localized", mismatch=output_index)
            continue

        if calls >= value.maximum_calls:
            return result("call_bound_reached")
        if len(returns) >= value.maximum_stack_depth:
            return result("stack_bound_reached")
        target_ref = token.target_definition_ref
        assert target_ref is not None
        target_entry = (target_ref, len(output))
        if target_entry in active_entries:
            return result("nonproductive_cycle")
        steps += 1
        calls += 1
        returns.append((definition_ref, instruction_index + 1))
        call_sites.append((definition_ref, instruction_index))
        caller_entry_output_indices.append(entry_output_index)
        active_entries.add(target_entry)
        definition_ref = target_ref
        instruction_index = 0
        entry_output_index = len(output)
