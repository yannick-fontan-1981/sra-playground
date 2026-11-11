#!/usr/bin/env python3
"""Pure, exact-byte resolution of the two documented fields of one10C ACK.

No file access, process launch or mutation of the peer payload occurs here.
Every changed10C snapshot, including a later correction, requires a new review.
All other lanes retain their literal fields and the callers' ordinary guards.
"""
import hashlib
import json

REQUEST = 'lot5c-cost-a33a5f88-final-01'
ACK_AT = '2026-11-11T18:36:58.444829+00:00'
RAW_BYTES = 6558
RAW_SHA256 = '6c361b848909bda5bae35208ebebd0827c466e6ab72a6bf54af8a2b5f1a34ad7'
RESOLUTION_BYTES = 4181
RESOLUTION_SHA256 = '4df26fa565ae7f49beb4f6037b975a569da9dfe9efb62563e1a9297c1df154d9'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def decode_ack(raw):
    require(isinstance(raw, bytes) and len(raw) <= 100_000, 'Bounded raw ACK bytes required')
    def unique(pairs):
        value = {}
        for key, item in pairs:
            require(key not in value, 'Duplicate ACK key: ' + key)
            value[key] = item
        return value
    def invalid(value):
        raise ValueError('Invalid ACK constant: ' + value)
    value = json.loads(raw, object_pairs_hook=unique, parse_constant=invalid)
    require(isinstance(value, dict), 'ACK must be an object')
    return value


def resolution_receipt(raw):
    require(isinstance(raw, bytes) and len(raw) == RESOLUTION_BYTES
            and hashlib.sha256(raw).hexdigest() == RESOLUTION_SHA256, 'Specific root resolution bytes changed')
    value = decode_ack(raw)
    require(value['schema'] == 'logos-engine.lot5c-specific-quiet-ack-field-resolution.v1'
            and value['status'] == 'declared_before_measurement_pending_independent_review'
            and value['lane'] == 'lot10c' and value['requestId'] == REQUEST
            and value['acknowledgedAt'] == value['originalUpdatedAt'] == ACK_AT
            and value['rawAck']['bytes'] == RAW_BYTES and value['rawAck']['sha256'] == RAW_SHA256
            and value['resolvedBy'] == 'lot5c_root_interpretation_of_explicit_peer_ack'
            and value['peerStatusFileModified'] is False and value['peerAckCreatedOrRetimed'] is False
            and value['measurementsStarted'] is False, 'Specific resolution identity differs')
    return value


def resolve_ack(lane, raw, resolution_raw):
    payload = decode_ack(raw)
    if lane != 'lot10c':
        return payload
    resolution = resolution_receipt(resolution_raw)
    require(len(raw) == RAW_BYTES and hashlib.sha256(raw).hexdigest() == RAW_SHA256,
            '10C payload differs from the sole reviewed raw ACK; stop and re-examine')
    require(payload['quiet_acknowledged'] is True and payload['quiet_request_id'] == REQUEST
            and payload['quiet_acknowledged_at'] == payload['updated_at'] == ACK_AT
            and payload['heavy_execution_active'] is False and payload['all_own_subagents_idle'] is True
            and payload['preview_stopped'] is True
            and payload['request_to_lot5c'] == resolution['explicitFreshAckText']
            and payload['active_command'] == resolution['recordedStaleActiveCommand']
            and 'no_queued_commands' not in payload, 'Explicit10C ACK facts do not support this resolution')
    changes = resolution['fieldResolution']
    require([item['field'] for item in changes] == ['active_command', 'no_queued_commands']
            and changes[0]['rawValue'] == payload['active_command'] and changes[0]['resolvedValue'] is None
            and changes[1]['rawFieldAbsent'] is True and changes[1]['resolvedValue'] is True,
            'Resolution is not limited to the two documented fields')
    result = dict(payload)
    result['active_command'] = None
    result['no_queued_commands'] = True
    require(all(result[key] == value for key, value in payload.items() if key != 'active_command')
            and set(result) == set(payload) | {'no_queued_commands'}, 'Unexpected resolved-field mutation')
    return result
