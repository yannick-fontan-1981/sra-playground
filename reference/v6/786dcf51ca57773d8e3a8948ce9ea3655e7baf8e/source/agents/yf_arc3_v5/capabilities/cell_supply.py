"""Exact ordered-field, rendered-quantity and finite cell-series calculations.

Roles, requested predicates, rendering profiles and traversal orders are supplied
by declarative authority. These measurements do not release an action.
"""
from collections import defaultdict, deque
from dataclasses import dataclass

from .cell_reaction import simulate_cell_reaction, settle_cell_body, _validate_board
from .resource_quantities import refine_rendered_budget_models


def read_uniform_band(frame, geometry, *, axis, fill_value, background_value, side):
    top, left, height, width = geometry
    if axis not in (0, 1) or side not in (-1, 1) or fill_value == background_value:
        return None
    if (min(height, width) < 1 or top < 0 or left < 0
            or top + height > frame.height or left + width > frame.width):
        return None
    samples = []
    for index in range((height, width)[axis]):
        pixels = (tuple(frame.rows[top + index][left:left + width]) if axis == 0
                  else tuple(frame.rows[r][left + index] for r in range(top, top + height)))
        if len(set(pixels)) != 1 or pixels[0] not in (fill_value, background_value):
            return None
        samples.append(pixels[0] == fill_value)
    count = sum(samples)
    expected = ([True] * count + [False] * (len(samples) - count) if side == 1
                else [False] * (len(samples) - count) + [True] * count)
    return count if samples == expected else None


def measure_receipt_band_changes(before_scene, after_scene, *, excluded_geometry):
    """Adjacent uniform rectangles, with exact old/new contiguous fill counts."""
    components = tuple(c for c in after_scene.blocks.components
                       if c.area == c.bbox.height * c.bbox.width)
    candidates = {}
    for axis in (0, 1):
        groups = defaultdict(list)
        for component in components:
            box = component.bbox
            key = (box.left, box.right) if axis == 0 else (box.top, box.bottom)
            groups[key].append(component)
        for key in sorted(groups):
            group = groups[key]
            ordered = sorted(group, key=lambda c: (c.bbox.top if axis == 0 else c.bbox.left))
            for a, b in zip(ordered, ordered[1:]):
                aa, bb = a.bbox, b.bbox
                if a.value == b.value or (aa.bottom + 1 != bb.top if axis == 0 else aa.right + 1 != bb.left):
                    continue
                geometry = (aa.top, aa.left, bb.bottom - aa.top + 1, bb.right - aa.left + 1)
                top, left, height, width = geometry
                if (height, width)[axis] <= (width, height)[axis]:
                    continue
                gt, gl, gh, gw, rp, cp, rows, cols = excluded_geometry
                if (top < gt + (rows - 1) * rp + gh and top + height > gt
                        and left < gl + (cols - 1) * cp + gw and left + width > gl):
                    continue
                for fill, background, side in ((a.value, b.value, 1), (b.value, a.value, -1)):
                    old = read_uniform_band(before_scene.frame, geometry, axis=axis,
                        fill_value=fill, background_value=background, side=side)
                    new = read_uniform_band(after_scene.frame, geometry, axis=axis,
                        fill_value=fill, background_value=background, side=side)
                    if old is not None and new is not None and old != new:
                        key = (geometry, axis, fill, background, side)
                        candidates[key] = dict(geometry=geometry, axis=axis, fill_value=fill,
                            background_value=background, side=side, before_filled=old,
                            after_filled=new, extent_units=(height, width)[axis])
    return tuple(candidates[key] for key in sorted(candidates))


def measure_current_prefix_field(scene, context, transfer_facts):
    """Revalidate a supplied prefix-transfer signature against current pixels.

    The last single slot is read using the learned pitch/core/rim, not a cold
    two-dimensional rectangle discovery. Conflicting fields remain explicit.
    """
    geometry = tuple(context.get('cell_reaction_current_field_geometry', ()))
    if len(geometry) != 8:
        return {'cell_supply_binding_count': 0}
    matches = {}
    for fact in transfer_facts:
        transfer = fact.get('transfer', {})
        receiver = tuple(transfer.get('receiver_field_geometry', ()))
        old_source = tuple(transfer.get('after_field_geometry', ()))
        if (len(receiver) != 8 or len(old_source) != 8 or receiver[2:] != geometry[2:]
                or 'source_rim_value' not in transfer):
            continue
        axis = int(transfer['prefix_axis'])
        if axis not in (0, 1):
            continue
        top = old_source[0] + geometry[0] - receiver[0]
        left = old_source[1] + geometry[1] - receiver[1]
        core_h, core_w, rp, cp = old_source[2:6]
        original_slots = transfer['before_slot_values']
        if not original_slots or min(core_h, core_w, rp, cp) < 1:
            continue
        slot_size = len(original_slots[0])
        slots = []
        # Read to the current field boundary. A historical short suffix must not
        # truncate a longer current field (for example after a new attempt).
        maximum_slots = ((scene.frame.height - top) // rp if axis == 0
                         else (scene.frame.width - left) // cp)
        for ordinal in range(maximum_slots):
            values = []
            for member in range(slot_size):
                r, c = (ordinal, member) if axis == 0 else (member, ordinal)
                y, x = top + r * rp, left + c * cp
                if y < 1 or x < 1 or y + core_h >= scene.frame.height or x + core_w >= scene.frame.width:
                    break
                pixels = {scene.frame.rows[rr][cc] for rr in range(y, y + core_h)
                          for cc in range(x, x + core_w)}
                rim = {scene.frame.rows[rr][cc] for rr in range(y - 1, y + core_h + 1)
                       for cc in range(x - 1, x + core_w + 1)
                       if rr in (y - 1, y + core_h) or cc in (x - 1, x + core_w)}
                if len(pixels) != 1 or rim != {transfer['source_rim_value']} or pixels == rim:
                    break
                values.append(next(iter(pixels)))
            if len(values) != slot_size:
                break
            slots.append(tuple(values))
        if not slots:
            continue
        positions = tuple(tuple(p) for p in transfer.get('receiver_positions', ()))
        if len(positions) != slot_size:
            continue
        key = (top, left, axis, tuple(slots), positions)
        matches.setdefault(key, []).append(str(fact['claim_ref']))
    facts = {'cell_supply_binding_count': len(matches)}
    if len(matches) == 1:
        (key, refs), = matches.items()
        facts.update(cell_supply_binding_unique=True, cell_supply_slot_values=key[3],
            cell_supply_aperture_positions=key[4], cell_supply_recalled_claim_refs=tuple(dict.fromkeys(refs)))
    return facts


def measure_cell_credit_context(scene, context, reaction_facts, *, profiles, delta_sign,
                                maximum_calibration_states):
    """Fit supplied quantity models to exact cumulative cardinality samples."""
    geometry = tuple(context.get('cell_reaction_current_field_geometry', ()))
    if len(geometry) != 8 or not 1 <= maximum_calibration_states <= 4096:
        return {'cell_credit_binding_count': 0}
    groups = defaultdict(dict)
    for fact in reaction_facts:
        comparison = fact.get('comparison', {})
        receiver = tuple(comparison.get('field_geometry', ()))
        if len(receiver) != 8 or receiver[2:] != geometry[2:]:
            continue
        for band in comparison.get('rendered_band_changes', ()):
            if delta_sign * (band['after_filled'] - band['before_filled']) <= 0:
                continue
            old = tuple(band['geometry'])
            relative = (old[0] - receiver[0], old[1] - receiver[1], *old[2:])
            key = (relative, band['axis'], band['fill_value'], band['background_value'], band['side'])
            edge = (int(band['before_filled']), int(band['after_filled']),
                    int(comparison['removed_count']), int(band['extent_units']))
            groups[key].setdefault(edge, []).append(str(fact['claim_ref']))
    fits = []
    limited = False
    for key, edges in sorted(groups.items()):
        band_geometry, axis, fill, background, side = key
        # Calibration starts at measured zero, not an invented initial credit.
        pending = deque([(0, 0, ((0, 0),), ())])
        visited = set()
        while pending and len(visited) < maximum_calibration_states:
            displayed, credit, samples, refs = pending.popleft()
            if samples in visited:
                continue
            visited.add(samples)
            current_geometry = (band_geometry[0] + geometry[0],
                                band_geometry[1] + geometry[1], *band_geometry[2:])
            current = read_uniform_band(scene.frame, current_geometry, axis=axis,
                fill_value=fill, background_value=background, side=side)
            if displayed == current and credit > 0:
                extent = (band_geometry[2], band_geometry[3])[axis]
                observations = tuple((i, extent - n) for i, (cost, n) in enumerate(samples))
                cumulative = {str(p['ref']): {i: cost for i, (cost, n) in enumerate(samples)} for p in profiles}
                intervals = refine_rendered_budget_models(extent=extent, observations=observations,
                    profiles=profiles, cumulative_cost_samples=cumulative)
                if intervals and all(row['maximum_total_budget'] is not None for row in intervals):
                    fits.append((key, credit, intervals, refs))
            for (old, new, removed, extent), edge_refs in sorted(edges.items()):
                if old == displayed and removed > 0:
                    pending.append((new, credit + removed,
                        samples + ((credit + removed, new),), refs + tuple(edge_refs)))
        limited = limited or bool(pending)
    facts = {'cell_credit_binding_count': len(fits), 'cell_credit_calibration_bound_reached': limited}
    if len(fits) == 1 and not limited:
        key, credit, intervals, refs = fits[0]
        facts.update(cell_credit_binding_unique=True, cell_credit_measured_count=credit,
            cell_credit_target_minimum=min(row['minimum_total_budget'] for row in intervals),
            cell_credit_target_maximum=max(row['maximum_total_budget'] for row in intervals),
            cell_credit_render_fit_intervals=tuple(intervals), cell_credit_recalled_claim_refs=refs)
    return facts


@dataclass(frozen=True)
class CellSupplyWitness:
    actions: tuple[str, ...]
    states: tuple[tuple, ...]
    final_removed_count: int


@dataclass(frozen=True)
class CellSupplySearch:
    witnesses: tuple[CellSupplyWitness, ...]
    expanded_states: int
    bound_reached: bool


def search_cell_supply(cells, body, *, queue_values, aperture_positions, credit,
                       target_credit, empty_value, direction, axes, minimum_length,
                       reception_action_ref, operators, traversal_orders,
                       maximum_depth, maximum_states):
    """Unit-cost BFS of complete boards, active order, suffix and credit.

    Terminal is tested after reaction closure and before supply exhaustion or
    aperture collision. Zero-gain deposits are allowed as actual future states.
    At most three globally shared witnesses, one shortest per supplied traversal.
    """
    if not (1 <= maximum_depth <= 64 and 1 <= maximum_states <= 16384
            and 1 <= len(traversal_orders) <= 3 and target_credit > credit >= 0):
        raise ValueError('finite positive search bounds and an open numeric target are required')
    by_ref = {op.action_ref: op for op in operators}
    if len(by_ref) != len(operators) or reception_action_ref in by_ref:
        raise ValueError('distinct supplied operator identities are required')
    height, width = _validate_board(cells)
    settle_cell_body(cells, body, empty_value=empty_value, direction=direction)
    if not body or len(set(aperture_positions)) != len(aperture_positions):
        raise ValueError('a nonempty body and distinct aperture positions are required')
    if any(len(values) != len(aperture_positions) or any(v is None or v == empty_value for v in values)
           for values in queue_values):
        raise ValueError('complete nonempty ordered values are required for every supplied body')
    for op in operators:
        if (bool(op.translation != (0, 0)) == bool(op.slot_quantum)
                or (not op.slot_quantum and sum(abs(d) for d in op.translation) != 1)):
            raise ValueError('one unit cardinal translation or cyclic permutation is required')
    start = (cells, body, tuple(queue_values), credit)
    total, limited, witnesses = 0, False, []
    for order in traversal_orders:
        if set(order) != set(by_ref) or len(order) != len(by_ref):
            raise ValueError('every supplied operator is required exactly once in a traversal')
        pending, previous = deque([(start, 0)]), {start: None}
        terminal = None
        while pending:
            if total >= maximum_states:
                limited = True
                break
            state, depth = pending.popleft()
            total += 1
            board, active, suffix, count = state
            if count >= target_credit:
                terminal = state
                break
            if depth >= maximum_depth:
                limited = True
                continue
            for ref in (*order, reception_action_ref):
                if ref == reception_action_ref:
                    reaction = simulate_cell_reaction(board, active, empty_value=empty_value,
                        direction=direction, axes=axes, minimum_length=minimum_length)
                    new_count = count + reaction.removed_count
                    if new_count >= target_credit:
                        after = (reaction.final_cells, (), (), new_count)
                    else:
                        if not suffix or len(suffix[0]) != len(aperture_positions):
                            continue
                        if any(not (0 <= r < height and 0 <= c < width)
                               or reaction.final_cells[r][c] != empty_value for r, c in aperture_positions):
                            continue
                        next_active = tuple((r, c, v) for (r, c), v in zip(aperture_positions, suffix[0]))
                        after = (reaction.final_cells, next_active, suffix[1:], new_count)
                else:
                    op = by_ref[ref]
                    if op.slot_quantum:
                        values = tuple(v for r, c, v in active)
                        moved = tuple((r, c, values[(i - op.slot_quantum) % len(values)])
                                      for i, (r, c, v) in enumerate(active))
                    else:
                        dr, dc = op.translation
                        moved = tuple((r + dr, c + dc, v) for r, c, v in active)
                        if any(not (0 <= r < height and 0 <= c < width)
                               or board[r][c] != empty_value for r, c, v in moved):
                            continue
                    after = (board, moved, suffix, count)
                if after in previous:
                    continue
                if len(previous) >= maximum_states:
                    limited = True
                    continue
                previous[after] = (state, ref)
                pending.append((after, depth + 1))
        if terminal is not None:
            reversed_states, reversed_actions = [terminal], []
            node = terminal
            while previous[node] is not None:
                parent, ref = previous[node]
                reversed_actions.append(ref)
                reversed_states.append(parent)
                node = parent
            witnesses.append(CellSupplyWitness(tuple(reversed(reversed_actions)),
                tuple(reversed(reversed_states)), terminal[3]))
        if total >= maximum_states:
            break
    return CellSupplySearch(tuple(witnesses), total, limited)


def measure_cell_supply_context(value, context, operators, operator_claim_refs):
    """Requested full-future calculation; no objective, strategy or release.

    Current board, ordered source pixels and quantity must each revalidate. A
    witness targets the upper endpoint of all compatible requested render fits.
    No historical board, hidden queue or creator quota is used as input.
    """
    config = value.route_generation_policy.get('cell_supply_search', {})
    if (not config or not context.get('cell_reaction_current_binding_unique')
            or config.get('traversal_order') != 'action_ref_ascending'
            or config.get('terminal_precedes_supply_and_aperture_failure') is not True
            or config.get('state_key_preserves_board_order_supply_credit') is not True):
        return {}
    from .contracts import VisualSceneInput
    from .sprites import describe_visual_scene
    scene = describe_visual_scene(VisualSceneInput(frame=value.current_observed_frame or value.frame))
    facts = measure_current_prefix_field(scene, context, value.canonical_slot_prefix_transfer_claim_facts)
    credit = measure_cell_credit_context(scene, context, value.canonical_cell_reaction_claim_facts,
        profiles=config['rendering_profiles'], delta_sign=config['credit_band_delta_sign'],
        maximum_calibration_states=int(config['maximum_calibration_states']))
    facts.update(credit)
    if not (facts.get('cell_supply_binding_unique') and facts.get('cell_credit_binding_unique')):
        return facts
    model = context['cell_reaction_current_model']
    search = search_cell_supply(context['cell_reaction_current_board'], context['cell_reaction_current_body_cells'],
        queue_values=facts['cell_supply_slot_values'], aperture_positions=facts['cell_supply_aperture_positions'],
        credit=facts['cell_credit_measured_count'], target_credit=facts['cell_credit_target_maximum'],
        empty_value=model['empty_value'], direction=tuple(model['direction']),
        axes=tuple(tuple(axis) for axis in model['requested_axes']), minimum_length=int(model['minimum_length']),
        reception_action_ref=context['cell_reaction_action_ref'], operators=operators,
        traversal_orders=(tuple(op.action_ref for op in operators),),
        maximum_depth=int(config['maximum_depth']), maximum_states=int(config['maximum_states']))
    facts.update(cell_supply_witness_count=len(search.witnesses),
        cell_supply_search_bound_reached=search.bound_reached, cell_supply_expanded_states=search.expanded_states)
    if len(search.witnesses) == 1:
        witness = search.witnesses[0]
        refs = tuple(dict.fromkeys(tuple(context['cell_reaction_recalled_claim_refs'])
            + facts['cell_supply_recalled_claim_refs'] + facts['cell_credit_recalled_claim_refs']
            + tuple(ref for action in witness.actions for ref in operator_claim_refs.get(action, ()))))
        facts.update(cell_supply_action_refs=witness.actions, cell_supply_predicted_states=witness.states,
            cell_supply_predicted_final_removed_count=witness.final_removed_count,
            cell_supply_predicted_additional_removed_count=witness.final_removed_count - facts['cell_credit_measured_count'],
            cell_supply_all_recalled_claim_refs=refs,
            cell_supply_revalidation_frame_ref=context['cell_reaction_revalidation_frame_ref'])
    return facts
