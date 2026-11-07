"""Separate exact arithmetic channels for emission, reveal and listener ranking."""
from __future__ import annotations
from fractions import Fraction
from math import isqrt
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class WaveArithmeticD(FrozenModel):
    metric: Literal['L1', 'LINF', 'EUCLIDEAN_FIXED']
    distance_precision: int = Field(ge=1, le=1000000)
    travel_numerator: int = Field(ge=0)
    travel_denominator: int = Field(ge=1)
    time_precision: int = Field(ge=1, le=1000000)
    time_quantizer: Literal['NONE', 'FLOOR', 'CEIL', 'NEAREST_TIES_UP']
    arithmetic_evidence_ref: Ref


class WaveEmitterD(FrozenModel):
    source_ref: Ref
    position: tuple[int, int]
    squared_range: int = Field(ge=0)
    relay_delay_numerator: int = Field(ge=0)
    relay_delay_denominator: int = Field(ge=1)


class WaveReceiptD(FrozenModel):
    receipt_ref: Ref
    recipient_ref: Ref
    position: tuple[int, int]
    channel: Literal['GATE', 'HEARD_SOURCE', 'VISIBILITY']
    consumer_ref: Ref


class RelayWaveArrivalsRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.relay_wave_arrivals_request_d.v1'
    phase_ref: Literal['PROPAGATION_DOMAIN', 'RECEPTION_TOKENS']
    impulse_ref: Ref
    command_ref: Ref
    origin: WaveEmitterD
    relays: tuple[WaveEmitterD, ...] = Field(default=(), max_length=128)
    queried_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=4096)
    receipts: tuple[WaveReceiptD, ...] = Field(default=(), max_length=4096)
    emission_arithmetic: WaveArithmeticD
    reveal_arithmetic: WaveArithmeticD
    listener_arithmetic: WaveArithmeticD
    stable_source_order: tuple[Ref, ...] | None
    overlap_rule: Literal['EARLIEST', 'ALL_REVEALS']
    disk_ignores_walls_supported: bool
    admitted_segments: tuple[tuple[Ref, tuple[int, int]], ...] = Field(default=(), max_length=4096)
    reception_phase_numerator: int = Field(ge=0)
    reception_phase_denominator: int = Field(ge=1)
    already_delivered_receipt_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.resource_visibility_feasibility.relay_wave_arrivals', 'DOMAIN'),
        ('mechanics.resource_visibility_feasibility.relay_wave_arrivals', 'STEP_INTERNAL'))

    @model_validator(mode='after')
    def owner_domains(self):
        ids = {self.origin.source_ref, *(s.source_ref for s in self.relays)}
        if len(ids) != len(self.relays)+1 or len({r.receipt_ref for r in self.receipts}) != len(self.receipts):
            raise ValueError('source/receipt identities must be unique')
        if len({(r.recipient_ref, r.channel, r.consumer_ref) for r in self.receipts}) != len(self.receipts):
            raise ValueError('one downstream writer per impulse/recipient/channel')
        if self.stable_source_order is not None and (set(self.stable_source_order) != ids or len(self.stable_source_order) != len(ids)):
            raise ValueError('source order must bind every emitter once')
        return self


def _wave_distance(a, b, arithmetic):
    dx, dy = abs(a[0]-b[0]), abs(a[1]-b[1])
    if arithmetic.metric == 'L1': return Fraction(dx+dy)
    if arithmetic.metric == 'LINF': return Fraction(max(dx, dy))
    # The fixed-point floor is the bound model law, not ideal continuous geometry.
    precision = arithmetic.distance_precision
    return Fraction(isqrt((dx*dx+dy*dy)*precision*precision), precision)


def _wave_quantize(value, arithmetic):
    if arithmetic.time_quantizer == 'NONE': return value
    scaled = value*arithmetic.time_precision
    whole, remainder = divmod(scaled.numerator, scaled.denominator)
    if arithmetic.time_quantizer == 'CEIL' and remainder: whole += 1
    if arithmetic.time_quantizer == 'NEAREST_TIES_UP' and 2*remainder >= scaled.denominator: whole += 1
    return Fraction(whole, arithmetic.time_precision)


def _wave_arrival(source, emission, point, arithmetic):
    raw = emission + _wave_distance(source.position, point, arithmetic)*Fraction(
        arithmetic.travel_numerator, arithmetic.travel_denominator)
    return raw, _wave_quantize(raw, arithmetic)


def _wave_admitted(request, source, point):
    if sum((source.position[i]-point[i])**2 for i in (0, 1)) > source.squared_range: return False
    return request.disk_ignores_walls_supported or (source.source_ref, point) in request.admitted_segments


def _fraction_pair(value):
    return value.numerator, value.denominator


def measure_relay_wave_arrivals_d(request: RelayWaveArrivalsRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    if (request.mode_ref == 'DOMAIN') != (request.phase_ref == 'PROPAGATION_DOMAIN'):
        return d_result(request, 'NOT_APPLICABLE', 'MODE_PHASE_MISMATCH')
    budget = DWorkBudget(request)
    try:
        if max(len(request.queried_cells), len(request.receipts), len(request.admitted_segments)) > request.domain_bound:
            return d_result(request, 'NEEDS_EVIDENCE', 'WAVE_INPUT_DOMAIN_BOUND')
        sources = {s.source_ref: s for s in (request.origin, *request.relays)}
        emissions = {}
        pending = {request.origin.source_ref: Fraction(0)}
        processed = set()
        while pending:
            time, ref = min((t, r) for r, t in sorted(pending.items()))
            pending.pop(ref)
            emissions[ref] = time
            source = sources[ref]
            processed.add(ref)
            for relay in request.relays:
                budget.visit({'stage': 'relay_emission_schedule', 'source_ref': ref, 'relay_ref': relay.source_ref})
                if relay.source_ref in processed or relay.source_ref == ref or not _wave_admitted(request, source, relay.position): continue
                raw, _ = _wave_arrival(source, time, relay.position, request.emission_arithmetic)
                emitted = _wave_quantize(raw+Fraction(relay.relay_delay_numerator, relay.relay_delay_denominator), request.emission_arithmetic)
                if emitted < time: raise ValueError('emission quantizer violates causal nondecreasing time')
                old = pending.get(relay.source_ref, emissions.get(relay.source_ref))
                if old is None or emitted < old: pending[relay.source_ref] = emitted
        source_order = request.stable_source_order or tuple(sorted(emissions))
        rank = {ref: i for i, ref in enumerate(source_order)}
        reveals = []
        for point in request.queried_cells:
            arrivals = []
            for ref, emission in sorted(emissions.items()):
                budget.visit({'stage': 'cell_reveal_arrival', 'source_ref': ref, 'point': point})
                if _wave_admitted(request, sources[ref], point):
                    raw, arrival = _wave_arrival(sources[ref], emission, point, request.reveal_arithmetic)
                    arrivals.append((arrival, rank[ref], ref, raw))
            arrivals.sort()
            if request.overlap_rule == 'EARLIEST' and arrivals:
                arrivals = [a for a in arrivals if a[0] == arrivals[0][0]]
            reveals.append({'point': point, 'arrivals': tuple({'source_ref': ref, 'reveal_time': _fraction_pair(t),
                'raw_reveal_time': _fraction_pair(raw)} for t, _, ref, raw in arrivals)})
        tokens, listener_rows = [], []
        current_phase = Fraction(request.reception_phase_numerator, request.reception_phase_denominator)
        uncertain_tie = False
        for receipt in request.receipts:
            arithmetic = request.listener_arithmetic if receipt.channel == 'HEARD_SOURCE' else request.reveal_arithmetic
            arrivals = []
            for ref, emission in sorted(emissions.items()):
                budget.visit({'stage': 'owned_reception', 'receipt_ref': receipt.receipt_ref, 'source_ref': ref})
                if _wave_admitted(request, sources[ref], receipt.position):
                    raw, key = _wave_arrival(sources[ref], emission, receipt.position, arithmetic)
                    arrivals.append((key, rank[ref], ref, raw))
            arrivals.sort()
            earliest = [a for a in arrivals if a[0] == arrivals[0][0]] if arrivals else []
            alternatives = tuple(a[2] for a in earliest)
            ambiguous = len(earliest) > 1 and request.stable_source_order is None
            if request.stable_source_order is not None: alternatives = alternatives[:1]
            listener_rows.append({'receipt_ref': receipt.receipt_ref, 'channel': receipt.channel,
                'consumer_ref': receipt.consumer_ref, 'source_alternatives': alternatives,
                'ranking_keys': tuple((ref, _fraction_pair(key), _fraction_pair(raw)) for key, _, ref, raw in arrivals)})
            if request.mode_ref == 'STEP_INTERNAL' and earliest and earliest[0][0] == current_phase and receipt.receipt_ref not in request.already_delivered_receipt_refs:
                if receipt.channel == 'HEARD_SOURCE' and ambiguous: uncertain_tie = True; continue
                tokens.append({'receipt_ref': receipt.receipt_ref, 'recipient_ref': receipt.recipient_ref,
                    'consumer_ref': receipt.consumer_ref, 'channel': receipt.channel, 'command_ref': request.command_ref,
                    'impulse_ref': request.impulse_ref, 'source_alternatives': alternatives,
                    'reception_time': _fraction_pair(current_phase)})
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if uncertain_tie else 'COMPLETE', 'UNBOUND_LISTENER_TIE' if uncertain_tie else 'SEPARATE_WAVE_ARITHMETIC',
            complete=not uncertain_tie, examined=budget.examined, values={'source_emissions': tuple(
                (r, _fraction_pair(t)) for r, t in sorted(emissions.items())), 'cell_reveals': tuple(reveals),
                'listener_rankings': tuple(listener_rows), 'reception_tokens': tuple(tokens),
                'recipient_fields_written': False, 'extra_world_turns': 0})
    except ValueError as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_WAVE_ARITHMETIC', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_wave_schedule': True, 'work': error.frontier})
