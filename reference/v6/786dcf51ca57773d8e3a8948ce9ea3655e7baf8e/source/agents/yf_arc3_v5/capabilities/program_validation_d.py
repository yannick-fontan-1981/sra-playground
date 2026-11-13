"""Exact validation precondition; do not execute an input or invent a control."""
from .program_validation_contracts_d import ProgramValidationMeasurementsD


def measure_program_validation_d(request):
    sockets = {socket.socket_ref: socket.occupant_token_ref for socket in request.current.sockets}
    differences = tuple(ref for ref, token_ref in request.assignment.socket_token_refs if sockets[ref]!=token_ref)
    return ProgramValidationMeasurementsD(configuration_equal=not differences,
        differing_socket_refs=differences, action_ref=request.action_ref,
        available_action_ref=request.available_action_ref, control_ref=request.control_ref,
        action_data=request.action_data,
        evaluations=len(request.current.sockets)+len(request.assignment.socket_token_refs))
