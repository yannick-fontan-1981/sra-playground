"""Compile an explicit injective assignment using the existing exact edit model."""
from agents.yf_arc3_v5.logos.types import stable_digest
from .typed_recursive_program import measure_typed_edit_successor
from .program_edit_compilation_contracts_d import ProgramCompiledEditD, ProgramEditCompilationMeasurementsD, ProgramEditStateD


def measure_program_edit_compilation_d(request):
    state = ProgramEditStateD(locations=request.initial.locations, sockets=request.initial.sockets,
        selection_token_ref=request.initial.selection_token_ref)
    target = dict(request.assignment.socket_token_refs)
    preserved = {socket.socket_ref: socket.occupant_token_ref for socket in request.initial.sockets
        if socket.socket_ref in request.preserved_socket_refs}
    operations = []
    work = len(request.tokens)+len(request.initial.locations)+len(request.initial.sockets)
    for socket_ref in request.socket_order:
        actual = {socket.socket_ref: socket.occupant_token_ref for socket in state.sockets}
        work += len(state.sockets)
        token_ref = target[socket_ref]
        if actual[socket_ref] == token_ref:
            continue
        edits = (('socket_click', socket_ref),) if state.selection_token_ref == token_ref else (
            ('token_click', token_ref), ('socket_click', socket_ref))
        for kind, ref in edits:
            if len(operations) >= request.maximum_operations:
                break
            current = request.initial.model_copy(update={'locations': state.locations,
                'sockets': state.sockets, 'selection_token_ref': state.selection_token_ref,
                'edit_kind': kind, 'edit_ref': ref})
            following = measure_typed_edit_successor(current)
            work += len(current.locations)+len(current.sockets)*2+1
            after = {socket.socket_ref: socket.occupant_token_ref for socket in following.resulting_sockets}
            if any(after[ref] != occupant for ref, occupant in sorted(preserved.items())):
                raise ValueError('an edit would modify a preserved shared fragment')
            operations.append(ProgramCompiledEditD(input=current, output=following))
            state = ProgramEditStateD(locations=following.resulting_locations,
                sockets=following.resulting_sockets, selection_token_ref=following.selection_token_ref)
        if len(operations) >= request.maximum_operations:
            break
    final = {socket.socket_ref: socket.occupant_token_ref for socket in state.sockets}
    work += len(state.sockets)+len(request.socket_order)
    remaining = tuple(ref for ref in request.socket_order if final[ref] != target[ref])
    return ProgramEditCompilationMeasurementsD(operations=tuple(operations), final_state=state,
        complete=not remaining, remaining_socket_refs=remaining, operations_applied=len(operations),
        evaluations=work, model_sha256=stable_digest(('program_edit_compilation.current_model.v1',
            request.model_revision_ref, request.initial, request.tokens, request.assignment,
            request.socket_order, request.preserved_socket_refs)))
