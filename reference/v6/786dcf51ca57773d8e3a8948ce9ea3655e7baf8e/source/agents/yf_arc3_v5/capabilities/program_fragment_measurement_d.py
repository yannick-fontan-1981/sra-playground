"""Exact output spans and flat-resource deficits, not a factorization policy."""
from collections import Counter
from .program_joint_fit_contracts_d import ProgramOutputFragmentD, ProgramLiteralDeficitD


def measure_flat_program_resources_d(request):
    template = request.interpreter_template
    required = Counter(template.reference_values)
    stock = Counter(token.value_ref for token in template.tokens if token.instruction_kind == 'literal')
    deficits = tuple(ProgramLiteralDeficitD(value_ref=value_ref, required_flat_occurrences=count,
        physical_literal_count=stock[value_ref], flat_stock_deficit=max(0, count-stock[value_ref]))
        for value_ref, count in sorted(required.items()))
    entry = next(d for d in request.definitions if d.definition_ref == template.entry_definition_ref)
    socket_deficit = max(0, len(template.reference_values)-len(entry.socket_refs))
    work = len(template.reference_values)+len(template.tokens)+len(request.definitions)
    return deficits, socket_deficit, work


def measure_program_fragments_d(interpreter, result, maximum_evaluations):
    """Use interpreter provenance; never segment by colour or hypothesize calls."""
    scan_work = len(result.emissions)*4
    if scan_work > maximum_evaluations:
        return (), 0, False
    depths = tuple(len(e.call_site_chain) for e in result.emissions)
    maximum_work = (len(interpreter.tokens)+len(interpreter.definitions)+scan_work
        +sum(depths)*4+sum(depth+1 for depth in depths)*5
        +(result.calls_executed+1)*(max(depths, default=0)*3+4))
    if maximum_work > maximum_evaluations:
        return (), scan_work, False
    tokens = {token.token_ref: token for token in interpreter.tokens}
    definitions = {definition.definition_ref: definition for definition in interpreter.definitions}
    nodes = [[(), None, None]]
    child_nodes = {}
    for emission in result.emissions:
        node = 0
        if nodes[node][1] is None:
            nodes[node][1] = emission.output_index
        nodes[node][2] = emission.output_index+1
        for site in emission.call_site_chain:
            key = (node, site)
            next_node = child_nodes.get(key)
            if next_node is None:
                next_node = len(nodes)
                child_nodes[key] = next_node
                nodes.append([nodes[node][0]+(site,), emission.output_index, emission.output_index+1])
            node = next_node
            nodes[node][2] = emission.output_index+1
    rows = []
    signatures = []
    active_chain = result.retained_state.call_site_chain if result.retained_state is not None else None
    for prefix, start, stop in nodes:
        if start is None:
            continue
        if prefix:
            caller, pc = prefix[-1]
            token = tokens[definitions[caller].instruction_token_refs[pc]]
            definition_ref = token.target_definition_ref
            if token.instruction_kind != 'call' or definition_ref is None:
                raise ValueError('emission provenance must bind an actual call instruction')
        else:
            definition_ref = interpreter.entry_definition_ref
        returned = result.normal_termination or (active_chain is not None and bool(prefix)
            and active_chain[:len(prefix)] != prefix)
        rows.append((definition_ref, prefix, start, stop, returned))
        signatures.append((definition_ref, result.emitted_values[start:stop]))
    counts = Counter(signatures)
    fragments = tuple(ProgramOutputFragmentD(definition_ref=definition_ref, call_site_chain=prefix,
        output_start=start, output_stop=stop, same_definition_value_occurrences=counts[signature],
        call_return_observed_in_simulation=returned)
        for (definition_ref, prefix, start, stop, returned), signature in zip(rows, signatures))
    return fragments, maximum_work, True
