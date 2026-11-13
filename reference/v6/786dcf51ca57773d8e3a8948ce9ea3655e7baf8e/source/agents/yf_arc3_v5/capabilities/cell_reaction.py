"""Exact requested cell reception and simultaneous line-reaction simulations.

The caller supplies the anonymous empty value, direction, axes and threshold.
These counterfactuals neither establish physics nor choose an objective/action.
"""
from __future__ import annotations

from dataclasses import dataclass
from collections import defaultdict, deque

from .parallel_cell_fields import ParallelCellField, measure_cell_lines

CellBoard = tuple[tuple[int | None, ...], ...]
CellBody = tuple[tuple[int, int, int], ...]


@dataclass(frozen=True)
class EnclosedCellField:
    top: int
    left: int
    core_height: int
    core_width: int
    row_pitch: int
    col_pitch: int
    cells: CellBoard
    rim_component_refs: tuple[tuple[str, ...], ...]


def measure_enclosed_cell_fields(scene) -> tuple[EnclosedCellField, ...]:
    """Complete equal-pitch rectangles of uniform cores with exact closed rims.

    Different anonymous rim values may coexist. Neither the field nor any rim
    is assigned a playable, fixed or controlled role by this measurement.
    """
    if len(scene.blocks.components) > 256 or scene.frame.height * scene.frame.width > 4096:
        return ()
    pixel_refs = {p:component.component_id for component in scene.blocks.components
                  for p in component.pixels}
    groups = defaultdict(dict)
    for component in scene.blocks.components:
        box=component.bbox
        if (component.area != box.height * box.width or box.top == 0 or box.left == 0
            or box.bottom + 1 >= scene.frame.height or box.right + 1 >= scene.frame.width):
            continue
        rim=tuple((r,c) for r in range(box.top-1,box.bottom+2)
                  for c in range(box.left-1,box.right+2)
                  if r in (box.top-1,box.bottom+1) or c in (box.left-1,box.right+1))
        refs={pixel_refs[p] for p in rim}
        if len(refs) != 1:
            continue
        groups[(box.height,box.width)][(box.top,box.left)]=(component.value,next(iter(refs)))
    fields=[]
    for (height,width), members in sorted(groups.items()):
        rows=tuple(sorted({r for r,c in members}))
        cols=tuple(sorted({c for r,c in members}))
        if not (2 <= len(rows) and 2 <= len(cols) and len(rows)*len(cols) == len(members) <= 256):
            continue
        row_steps={b-a for a,b in zip(rows,rows[1:])}
        col_steps={b-a for a,b in zip(cols,cols[1:])}
        if len(row_steps)!=1 or len(col_steps)!=1:
            continue
        rp,cp=next(iter(row_steps)),next(iter(col_steps))
        if rp <= height or cp <= width:
            continue
        fields.append(EnclosedCellField(rows[0],cols[0],height,width,rp,cp,
            tuple(tuple(members[(r,c)][0] for c in cols) for r in rows),
            tuple(tuple(members[(r,c)][1] for c in cols) for r in rows)))
    return tuple(fields) if len(fields)<=16 else ()


def _field_geometry(field):
    return (field.top,field.left,field.core_height,field.core_width,
            field.row_pitch,field.col_pitch,len(field.cells),len(field.cells[0]))


def measure_enclosed_slot_prefix_transfers(before_scene, after_scene, *,
                                         receiver_geometry, receiver_positions):
    """Exact shrinking prefix and equal ordered values in a supplied footprint.

    Both row-wise and column-wise fields are compared, without choosing a
    supplier role or promising another future occupant. One-slot remnants are
    not covered by the rectangular field detector and remain unmeasured.
    """
    before_fields = measure_enclosed_cell_fields(before_scene)
    after_fields = measure_enclosed_cell_fields(after_scene)
    receivers = tuple(field for field in after_fields
                      if _field_geometry(field) == tuple(receiver_geometry))
    positions = tuple(tuple(p) for p in receiver_positions)
    if len(receivers) != 1 or not positions:
        return {'slot_prefix_transfer_match_count': 0}
    receiver = receivers[0]
    if any(not (0 <= r < len(receiver.cells) and 0 <= c < len(receiver.cells[0]))
           for r, c in positions):
        return {'slot_prefix_transfer_match_count': 0}
    received_values = tuple(receiver.cells[r][c] for r, c in positions)
    matches = []
    for old in before_fields:
        for new in after_fields:
            if (_field_geometry(new) == tuple(receiver_geometry)
                    or _field_geometry(old)[:6] != _field_geometry(new)[:6]
                    or old.core_height * receiver.core_width
                    != old.core_width * receiver.core_height):
                continue
            for axis in (0, 1):
                old_slots = (old.cells if axis == 0 else tuple(zip(*old.cells)))
                new_slots = (new.cells if axis == 0 else tuple(zip(*new.cells)))
                if (len(old_slots) != len(new_slots) + 1
                        or tuple(old_slots[1:]) != tuple(new_slots)
                        or tuple(old_slots[0]) != received_values):
                    continue
                matches.append({
                    'before_field_geometry': _field_geometry(old),
                    'after_field_geometry': _field_geometry(new),
                    'receiver_field_geometry': _field_geometry(receiver),
                    'receiver_positions': positions,
                    'source_rim_value': after_scene.frame.rows[new.top - 1][new.left],
                    'prefix_axis': axis,
                    'before_slot_values': tuple(tuple(slot) for slot in old_slots),
                    'after_slot_values': tuple(tuple(slot) for slot in new_slots),
                    'removed_prefix_values': received_values,
                })
    facts = {'slot_prefix_transfer_match_count': len(matches)}
    if len(matches) == 1:
        facts['slot_prefix_transfer'] = matches[0]
    return facts


def _linear_field_rims(field, components):
    members=defaultdict(list)
    for r,row in enumerate(field.rim_component_refs):
        for c,ref in enumerate(row):
            members[ref].append((r,c))
    result=[]
    for ref,positions in sorted(members.items()):
        if not 2 <= len(positions) <= 64:
            continue
        steps={(b[0]-a[0],b[1]-a[1]) for a,b in zip(positions,positions[1:])}
        if len(steps)!=1 or next(iter(steps)) not in ((1,0),(0,1)):
            continue
        component=components[ref]
        result.append((component.value,component.relative_pixels,tuple(positions)))
    return tuple(result)


def measure_enclosed_cell_body_translations(before_scene, after_scene):
    """Whole ordered footprint translation with an unchanged surrounding field."""
    before_fields=measure_enclosed_cell_fields(before_scene)
    after_fields=measure_enclosed_cell_fields(after_scene)
    before_components={c.component_id:c for c in before_scene.blocks.components}
    after_components={c.component_id:c for c in after_scene.blocks.components}
    matches=[]
    for before in before_fields:
        for after in after_fields:
            if _field_geometry(before)!=_field_geometry(after):
                continue
            for value,shape,positions in _linear_field_rims(before,before_components):
                old_body=tuple((r,c,before.cells[r][c]) for r,c in positions)
                for new_value,new_shape,new_positions in _linear_field_rims(after,after_components):
                    if (value,shape,len(positions))!=(new_value,new_shape,len(new_positions)):
                        continue
                    deltas={(b[0]-a[0],b[1]-a[1]) for a,b in zip(positions,new_positions)}
                    if len(deltas)!=1 or next(iter(deltas))==(0,0):
                        continue
                    dr,dc=next(iter(deltas))
                    if bool(dr)==bool(dc):
                        continue
                    new_body=tuple((r,c,after.cells[r][c]) for r,c in new_positions)
                    if tuple(v for r,c,v in old_body)!=tuple(v for r,c,v in new_body):
                        continue
                    vacated=set(positions)-set(new_positions)
                    entered=set(new_positions)-set(positions)
                    values={after.cells[r][c] for r,c in sorted(vacated)} | {
                        before.cells[r][c] for r,c in sorted(entered)}
                    if len(values)!=1:
                        continue
                    empty=next(iter(values))
                    if any(v==empty for r,c,v in old_body):
                        continue
                    old=tuple(tuple(empty if (r,c) in positions else v for c,v in enumerate(row))
                              for r,row in enumerate(before.cells))
                    new=tuple(tuple(empty if (r,c) in new_positions else v for c,v in enumerate(row))
                              for r,row in enumerate(after.cells))
                    if old!=new:
                        continue
                    matches.append(dict(field_geometry=_field_geometry(before),
                        body_rim_value=value,body_rim_relative_pixels=shape,
                        empty_value=empty,delta_row=dr*before.row_pitch,
                        delta_col=dc*before.col_pitch))
    facts={'cell_body_translation_comparison_count':len(matches)}
    if len(matches)==1:
        facts['cell_body_translation_comparison']=matches[0]
    return facts


def measure_cell_reception_comparisons(before_scene, after_scene, *, directions,
                                      axes, minimum_length) -> dict[str, object]:
    """Compare explicitly requested counterfactuals with exact final cell values.

    Body candidates are linear equal-pitch apertures in one unchanged rim
    silhouette. A fresh aperture occupant is masked separately from deposited
    cells; all anonymous vacancy candidates remain in the finite comparison.
    This final-state fit does not attest unobserved animation or all axes.
    """
    if not directions or not axes:
        return {}
    old_fields=measure_enclosed_cell_fields(before_scene)
    new_fields=measure_enclosed_cell_fields(after_scene)
    old_components={c.component_id:c for c in before_scene.blocks.components}
    new_components={c.component_id:c for c in after_scene.blocks.components}

    matches=[]
    for old in old_fields:
        for new in new_fields:
            if _field_geometry(old)!=_field_geometry(new):
                continue
            for rim_value,rim_shape,positions in _linear_field_rims(old,old_components):
                for new_value,new_shape,new_positions in _linear_field_rims(new,new_components):
                    if (rim_value,rim_shape,len(positions))!=(new_value,new_shape,len(new_positions)):
                        continue
                    values=sorted({v for row in old.cells+new.cells for v in row})
                    for empty in values:
                        board=[list(row) for row in old.cells]
                        body=tuple((r,c,board[r][c]) for r,c in positions)
                        if any(v==empty for r,c,v in body):
                            continue
                        for r,c in positions:
                            board[r][c]=empty
                        final=[list(row) for row in new.cells]
                        for r,c in new_positions:
                            final[r][c]=empty
                        expected=tuple(tuple(row) for row in final)
                        for direction in directions:
                            result=simulate_cell_reaction(tuple(tuple(row) for row in board),body,
                                empty_value=empty,direction=direction,axes=axes,minimum_length=minimum_length)
                            if result.reception_distance and result.final_cells==expected:
                                matches.append(dict(direction=direction,empty_value=empty,
                                    field_geometry=_field_geometry(old),before_body_cells=body,
                                    body_rim_value=rim_value,body_rim_relative_pixels=rim_shape,
                                    after_body_positions=new_positions,reception_distance=result.reception_distance,
                                    removed_count=result.removed_count,
                                    removed_cells_by_round=result.removed_cells_by_round,
                                    line_lengths_by_round=result.line_lengths_by_round,
                                    line_axes_by_round=result.line_axes_by_round,
                                    requested_axes=axes,minimum_length=minimum_length))
    facts={'cell_reception_comparison_match_count':len(matches)}
    if len(matches)==1:
        from .cell_supply import measure_receipt_band_changes
        matches[0]['rendered_band_changes'] = measure_receipt_band_changes(
            before_scene, after_scene, excluded_geometry=matches[0]['field_geometry'])
        facts.update(cell_reception_comparison_unique=True,
            cell_reception_comparison=matches[0],
            cell_reception_removed_count=matches[0]['removed_count'],
            cell_reception_direction_row=matches[0]['direction'][0],
            cell_reception_direction_col=matches[0]['direction'][1])
        facts.update(measure_enclosed_slot_prefix_transfers(
            before_scene, after_scene,
            receiver_geometry=matches[0]['field_geometry'],
            receiver_positions=matches[0]['after_body_positions']))
    return facts


def measure_current_cell_reaction(scene, claim_facts, observation_ref):
    """Rebind one recalled anonymous model to one currently measured footprint.

    Translation of the field is allowed; pitch, extents, complete topology and
    the common rim silhouette must still agree. Conflicting models or multiple
    current bodies remain unresolved. No role, objective or permission is made.
    """
    if not claim_facts:
        return {}, None
    fields = measure_enclosed_cell_fields(scene)
    matches = {}
    for fact in claim_facts:
        comparison = fact.get('comparison', {})
        geometry = tuple(comparison.get('field_geometry', ()))
        rim_shape = tuple(tuple(p) for p in comparison.get('body_rim_relative_pixels', ()))
        if len(geometry) != 8 or not rim_shape or not fact.get('claim_ref') or not fact.get('action_ref'):
            continue
        for field in fields:
            shape = (field.core_height, field.core_width, field.row_pitch, field.col_pitch,
                     len(field.cells), len(field.cells[0]))
            if shape != geometry[2:]:
                continue
            for component in scene.blocks.components:
                if (component.value != comparison.get('body_rim_value') or
                        component.relative_pixels != rim_shape):
                    continue
                positions = tuple((r, c) for r, row in enumerate(field.rim_component_refs)
                                  for c, ref in enumerate(row) if ref == component.component_id)
                old_body = comparison.get('before_body_cells', ())
                if not positions or len(positions) != len(old_body):
                    continue
                steps = {(b[0]-a[0], b[1]-a[1]) for a,b in zip(positions,positions[1:])}
                if len(steps) != 1 or next(iter(steps)) not in ((1,0),(0,1)):
                    continue
                empty = comparison['empty_value']
                body = tuple((r,c,field.cells[r][c]) for r,c in positions)
                if any(v == empty for r,c,v in body):
                    continue
                board = tuple(tuple(empty if (r,c) in positions else v for c,v in enumerate(row))
                              for r,row in enumerate(field.cells))
                direction = tuple(comparison['direction'])
                axes = tuple(tuple(axis) for axis in comparison['requested_axes'])
                threshold = int(comparison['minimum_length'])
                key = (str(fact['action_ref']), shape, field.top, field.left,
                       body, board, empty, direction, axes, threshold)
                if key not in matches:
                    matches[key] = [field, body, board, comparison, []]
                matches[key][4].append(str(fact['claim_ref']))
    facts = {'cell_reaction_current_binding_count': len(matches)}
    if len(matches) != 1:
        return facts, None
    (key, (field, body, board, comparison, refs)), = matches.items()
    result = simulate_cell_reaction(board, body, empty_value=comparison['empty_value'],
        direction=tuple(comparison['direction']),
        axes=tuple(tuple(axis) for axis in comparison['requested_axes']),
        minimum_length=int(comparison['minimum_length']))
    facts.update(cell_reaction_current_binding_unique=True,
        cell_reaction_recalled_claim_refs=tuple(dict.fromkeys(refs)),
        cell_reaction_revalidation_frame_ref=observation_ref,
        cell_reaction_action_ref=key[0], cell_reaction_current_body_cells=body,
        cell_reaction_current_board=board,
        cell_reaction_current_model=comparison,
        cell_reaction_current_field_geometry=(field.top,field.left)+key[1],
        cell_reaction_predicted_received_cells=result.received_cells,
        cell_reaction_predicted_removed_count=result.removed_count,
        cell_reaction_predicted_removed_cells_by_round=result.removed_cells_by_round,
        cell_reaction_predicted_final_cells=result.final_cells)
    return facts, result


def measure_current_cell_body_corridors(scene, translation_facts, observation_ref):
    """Rebind an observed footprint and measure empty cardinal corridors.

    A corridor ending on occupied cells is a geometric observation, not proof
    that a command will move the body to that endpoint or deposit its values.
    """
    fields = measure_enclosed_cell_fields(scene) if translation_facts else ()
    components = {c.component_id: c for c in scene.blocks.components}
    matches = {}
    for fact in translation_facts:
        comparison = fact.get('cell_body_translation_comparison', {})
        geometry = tuple(comparison.get('field_geometry', ()))
        rim_shape = tuple(tuple(p) for p in comparison.get('body_rim_relative_pixels', ()))
        if len(geometry) != 8 or not rim_shape or not fact.get('claim_ref'):
            continue
        for field in fields:
            if _field_geometry(field)[2:] != geometry[2:]:
                continue
            for rim_value, shape, positions in _linear_field_rims(field, components):
                if (rim_value, shape) != (comparison.get('body_rim_value'), rim_shape):
                    continue
                empty = comparison.get('empty_value')
                body = tuple((r,c,field.cells[r][c]) for r,c in positions)
                if empty is None or any(v == empty for r,c,v in body):
                    continue
                board = tuple(tuple(empty if (r,c) in positions else v for c,v in enumerate(row))
                              for r,row in enumerate(field.cells))
                key = (_field_geometry(field), body, board, empty)
                if key not in matches:
                    matches[key] = []
                matches[key].append(str(fact['claim_ref']))
    facts = {'cell_body_corridor_binding_count': len(matches)}
    if len(matches) != 1:
        return facts
    ((geometry, body, board, empty), refs), = matches.items()
    corridors = []
    for dr,dc in ((-1,0),(1,0),(0,-1),(0,1)):
        endpoint, distance = settle_cell_body(board, body, empty_value=empty, direction=(dr,dc))
        contacts = tuple((r+dr,c+dc,board[r+dr][c+dc]) for r,c,v in endpoint
                         if 0 <= r+dr < len(board) and 0 <= c+dc < len(board[0])
                         and board[r+dr][c+dc] != empty)
        corridors.append((dr,dc,distance,contacts))
    facts.update(cell_body_corridor_binding_unique=True,
        cell_body_corridor_frame_ref=observation_ref,
        cell_body_corridor_recalled_claim_refs=tuple(dict.fromkeys(refs)),
        cell_body_corridor_field_geometry=geometry,
        cell_body_corridor_body_cells=body, cell_body_corridor_board=board,
        cell_body_corridor_empty_value=empty, cell_body_corridors=tuple(corridors))
    return facts


def measure_cell_body_corridor_candidate(context, action_ref, interface_deltas):
    """Compare the interface's nominal axis to occupied corridor endpoints."""
    deltas = {(dr,dc) for ref,dr,dc in interface_deltas if ref == action_ref}
    contacts = ()
    distance = 0
    if len(deltas) == 1:
        dr,dc = next(iter(deltas))
        if bool(dr) != bool(dc):
            direction = ((dr > 0)-(dr < 0), (dc > 0)-(dc < 0))
            for rr,cc,span,occupied in context.get('cell_body_corridors', ()):
                if (rr,cc) == direction:
                    distance, contacts = span, occupied
                    break
    return {'cell_body_candidate_corridor_distance': distance,
            'cell_body_candidate_endpoint_occupied_count': len(contacts),
            'cell_body_candidate_endpoint_cells': contacts}


def measure_cell_reaction_candidate(context, candidate):
    """Action equality and numeric effect only; DRM interprets usefulness."""
    return {
        'cell_reaction_candidate_action_matches': bool(
            context.get('cell_reaction_current_binding_unique') and
            candidate.action_ref == context.get('cell_reaction_action_ref')),
        'cell_preparation_candidate_action_matches': bool(
            context.get('cell_preparation_action_refs') and
            candidate.action_ref == context['cell_preparation_action_refs'][0]),
        'cell_supply_candidate_action_matches': bool(
            context.get('cell_supply_action_refs') and
            candidate.action_ref == context['cell_supply_action_refs'][0]),
    }


def measure_cell_preparation_context(value, context):
    """Qualify canonical numeric operators against the current common rim."""
    if not context.get('cell_reaction_current_binding_unique'):
        return {}
    config=value.route_generation_policy.get('cell_preparation_search',{})
    if config.get('traversal_order')!='action_ref_ascending':
        return {}
    model=context['cell_reaction_current_model']
    geometry=tuple(context['cell_reaction_current_field_geometry'])
    body=tuple(tuple(cell) for cell in context['cell_reaction_current_body_cells'])
    rim=tuple(tuple(p) for p in model['body_rim_relative_pixels'])
    maps=defaultdict(dict)
    available=frozenset(value.available_action_refs)
    for fact in value.canonical_cell_body_translation_claim_facts:
        measured=fact.get('cell_body_translation_comparison',{})
        old_geometry=tuple(measured.get('field_geometry',()))
        if (len(old_geometry)!=8 or old_geometry[2:]!=geometry[2:] or
                measured.get('empty_value')!=model['empty_value'] or
                measured.get('body_rim_value')!=model['body_rim_value'] or
                tuple(tuple(p) for p in measured.get('body_rim_relative_pixels',()))!=rim):
            continue
        arguments=tuple(fact.get('argument_refs',()))
        action=str(fact.get('action_ref') or (arguments[0] if arguments else ''))
        dr,dc=int(measured['delta_row']),int(measured['delta_col'])
        rp,cp=geometry[4:6]
        if dr%rp or dc%cp or bool(dr)==bool(dc) or action not in available:
            continue
        key=(dr//rp,dc//cp,0)
        maps[action].setdefault(key,[]).append(str(fact['claim_ref']))
    centers=tuple((2*(geometry[0]+r*geometry[4])+geometry[2]-1,
                   2*(geometry[1]+c*geometry[5])+geometry[3]-1) for r,c,v in body)
    relative=tuple((r-centers[0][0],c-centers[0][1]) for r,c in centers)
    for fact in value.canonical_closed_support_permutation_claim_facts:
        slots=tuple(tuple(p) for p in fact.get('slot_centers_twice',()))
        if (len(slots)!=len(body) or not slots or
                fact.get('body_rim_value')!=model['body_rim_value'] or
                tuple(tuple(p) for p in fact.get('body_rim_relative_pixels',()))!=rim or
                tuple((r-slots[0][0],c-slots[0][1]) for r,c in slots)!=relative):
            continue
        action=str(fact.get('action_ref') or '')
        quantum=int(fact.get('signed_slot_quantum') or 0)
        if action not in available or not quantum:
            continue
        maps[action].setdefault((0,0,quantum),[]).append(str(fact['claim_ref']))
    operators=[]
    operator_refs={}
    for action, variants in sorted(maps.items()):
        if len(variants)!=1 or action==context['cell_reaction_action_ref']:
            continue
        (key,refs),=variants.items()
        dr,dc,quantum=key
        if not quantum and abs(dr)+abs(dc)!=1:
            continue
        operators.append(CellBodyOperator(action,(dr,dc),quantum))
        operator_refs[action]=tuple(dict.fromkeys(refs))
    from .cell_supply import measure_cell_supply_context
    supply_facts = measure_cell_supply_context(value, context, tuple(operators), operator_refs)
    qualification = dict(cell_preparation_ambiguous_operator_count=sum(len(variants)>1 for action,variants in sorted(maps.items())),
        cell_preparation_qualified_operator_count=len(operators))
    # The declared supply request excludes a merely immediate-effect witness
    # once all its complete numeric inputs have a unique current binding.
    if (supply_facts.get('cell_supply_binding_unique')
            and supply_facts.get('cell_credit_binding_unique')):
        qualification.update(supply_facts, cell_preparation_witness_count=0,
            cell_preparation_search_bound_reached=supply_facts.get('cell_supply_search_bound_reached', True))
        if supply_facts.get('cell_supply_all_recalled_claim_refs'):
            qualification['cell_reaction_recalled_claim_refs'] = supply_facts['cell_supply_all_recalled_claim_refs']
        return qualification
    search=search_cell_preparations(context['cell_reaction_current_board'],body,
        empty_value=model['empty_value'],direction=tuple(model['direction']),
        axes=tuple(tuple(a) for a in model['requested_axes']),
        minimum_length=int(model['minimum_length']),
        minimum_removed_cells=int(config['minimum_removed_cells']),
        reception_action_ref=context['cell_reaction_action_ref'],operators=tuple(operators),
        traversal_orders=(tuple(op.action_ref for op in operators),),
        maximum_depth=int(config['maximum_depth']),maximum_states=int(config['maximum_states']))
    facts=dict(cell_preparation_witness_count=len(search.witnesses),
        cell_preparation_search_bound_reached=search.bound_reached,
        cell_preparation_expanded_states=search.expanded_states,
        cell_preparation_ambiguous_operator_count=sum(len(variants)>1 for action,variants in sorted(maps.items())),
        cell_preparation_qualified_operator_count=len(operators))
    facts.update(supply_facts)
    if len(search.witnesses)==1:
        witness=search.witnesses[0]
        refs=tuple(dict.fromkeys(tuple(context['cell_reaction_recalled_claim_refs'])+
            tuple(ref for action in witness.actions for ref in operator_refs.get(action,()))))
        facts.update(cell_preparation_action_refs=witness.actions,
            cell_preparation_first_body_cells=witness.bodies[min(1,len(witness.bodies)-1)],
            cell_preparation_predicted_final_cells=witness.reaction.final_cells,
            cell_preparation_predicted_removed_count=witness.reaction.removed_count,
            cell_reaction_recalled_claim_refs=refs)
    return facts


@dataclass(frozen=True)
class CellBodyOperator:
    action_ref: str
    translation: tuple[int, int] = (0, 0)
    slot_quantum: int = 0


@dataclass(frozen=True)
class CellPreparationWitness:
    actions: tuple[str, ...]
    bodies: tuple[CellBody, ...]
    reaction: CellReaction


@dataclass(frozen=True)
class CellPreparationSearch:
    witnesses: tuple[CellPreparationWitness, ...]
    expanded_states: int
    bound_reached: bool


def search_cell_preparations(cells, body, *, empty_value, direction, axes,
                             minimum_length, minimum_removed_cells,
                             reception_action_ref, operators, traversal_orders,
                             maximum_depth, maximum_states):
    """First deterministic shortest witness per declared traversal (global <=3).

    The field and law are fixed parameters of this search. The node key is the
    complete footprint and ordered values, never just heights or progress.
    Predecessors are kept once per node; rejected executable paths are not made.
    This requested numeric predicate does not establish an objective or physics.
    """
    height, width = _validate_board(cells)
    _validate_direction(direction)
    settle_cell_body(cells, body, empty_value=empty_value, direction=direction)
    if not 1 <= minimum_removed_cells or not 1 <= maximum_depth <= 64:
        raise ValueError('positive effect and depth bounds are required')
    if not 1 <= maximum_states <= 16384 or not 1 <= len(traversal_orders) <= 3:
        raise ValueError('bounded states and at most three global traversals are required')
    by_ref = {op.action_ref: op for op in operators}
    if len(by_ref) != len(operators) or reception_action_ref in by_ref:
        raise ValueError('each requested operator must have one distinct action')
    for op in operators:
        if (bool(op.translation != (0,0)) == bool(op.slot_quantum) or
                (op.translation[0] and op.translation[1])):
            raise ValueError('one cardinal translation or cyclic permutation is required')
    total = 0
    witnesses = []
    bound_reached = False
    for order in traversal_orders:
        if len(order) != len(by_ref) or set(order) != set(by_ref):
            raise ValueError('each traversal must contain all requested operators exactly once')
        queue = deque([(body,0)])
        predecessors = {body: None}
        while queue:
            if total >= maximum_states:
                bound_reached = True
                break
            current, depth = queue.popleft()
            total += 1
            result = simulate_cell_reaction(cells,current,empty_value=empty_value,
                direction=direction,axes=axes,minimum_length=minimum_length)
            if result.removed_count >= minimum_removed_cells:
                reverse_actions = [reception_action_ref]
                reverse_bodies = [current]
                node = current
                while predecessors[node] is not None:
                    parent, action = predecessors[node]
                    reverse_actions.append(action)
                    reverse_bodies.append(parent)
                    node = parent
                witnesses.append(CellPreparationWitness(tuple(reversed(reverse_actions)),
                    tuple(reversed(reverse_bodies)),result))
                break
            if depth + 1 >= maximum_depth:
                # A reception itself is one external primitive too.
                if order:
                    bound_reached = True
                continue
            for ref in order:
                op = by_ref[ref]
                if op.slot_quantum:
                    values = tuple(v for r,c,v in current)
                    after = tuple((r,c,values[(i-op.slot_quantum)%len(values)])
                                  for i,(r,c,v) in enumerate(current))
                else:
                    dr,dc = op.translation
                    after = tuple((r+dr,c+dc,v) for r,c,v in current)
                    if any(not (0 <= r < height and 0 <= c < width) or cells[r][c] != empty_value
                           for r,c,v in after):
                        continue
                if after in predecessors:
                    continue
                if len(predecessors) >= maximum_states:
                    bound_reached = True
                    continue
                predecessors[after] = (current,ref)
                queue.append((after,depth+1))
        if total >= maximum_states:
            break
    return CellPreparationSearch(tuple(witnesses),total,bound_reached)


@dataclass(frozen=True)
class CellReaction:
    final_cells: CellBoard
    reception_distance: int
    received_cells: CellBody
    removed_cells_by_round: tuple[tuple[tuple[int, int, int], ...], ...]
    line_lengths_by_round: tuple[tuple[int, ...], ...]
    stabilized_cells_by_round: tuple[CellBoard, ...]
    line_axes_by_round: tuple[tuple[tuple[int, int], ...], ...]

    @property
    def removed_count(self) -> int:
        return sum(len(cells) for cells in self.removed_cells_by_round)


def _validate_board(cells: CellBoard) -> tuple[int, int]:
    height = len(cells)
    width = len(cells[0]) if height else 0
    if not width or height * width > 256 or any(len(row) != width for row in cells):
        raise ValueError('a complete rectangular field of at most 256 cells is required')
    if any(value is None for row in cells for value in row):
        raise ValueError('unknown cells cannot establish a complete reaction')
    return height, width


def _validate_direction(direction: tuple[int, int]) -> None:
    if direction not in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        raise ValueError('settlement requires one declared cardinal direction')


def settle_cell_body(
    cells: CellBoard, body: CellBody, *, empty_value: int,
    direction: tuple[int, int],
) -> tuple[CellBody, int]:
    """Rigid footprint translated until the first occupied cell or field edge."""
    height, width = _validate_board(cells)
    _validate_direction(direction)
    if not body or len({(r, c) for r, c, _ in body}) != len(body):
        raise ValueError('body cells must be nonempty and distinct')
    if any(v == empty_value or not (0 <= r < height and 0 <= c < width)
           or cells[r][c] != empty_value for r, c, v in body):
        raise ValueError('body must occupy known vacant cells without overlap')
    dr, dc = direction
    distance = 0
    while all(0 <= r + (distance + 1) * dr < height
              and 0 <= c + (distance + 1) * dc < width
              and cells[r + (distance + 1) * dr][c + (distance + 1) * dc] == empty_value
              for r, c, _ in body):
        distance += 1
    return tuple((r + distance * dr, c + distance * dc, v) for r, c, v in body), distance


def compact_cell_field(cells: CellBoard, *, empty_value: int,
                       direction: tuple[int, int]) -> CellBoard:
    """Stable compaction preserves the order of surviving values on each axis."""
    height, width = _validate_board(cells)
    _validate_direction(direction)
    result = [[empty_value] * width for _ in range(height)]
    dr, dc = direction
    strips = (tuple((r, c) for r in range(height)) for c in range(width)) if dr else (
        tuple((r, c) for c in range(width)) for r in range(height))
    for positions in strips:
        values = tuple(cells[r][c] for r, c in positions if cells[r][c] != empty_value)
        offset = len(positions) - len(values) if dr + dc > 0 else 0
        for (r, c), value in zip(positions[offset:], values):
            result[r][c] = value
    return tuple(tuple(row) for row in result)


def simulate_cell_reaction(
    cells: CellBoard, body: CellBody, *, empty_value: int,
    direction: tuple[int, int], axes: tuple[tuple[int, int], ...],
    minimum_length: int,
) -> CellReaction:
    """One reception, snapshot-union deletion, then stable compaction to closure.

    No intermediate animation is synthesized. Each nonempty reaction strictly
    decreases occupied cardinality, so the complete closure is finite without
    an opaque iteration quota. Nonmatching deposits remain admissible results.
    """
    _validate_board(cells)
    if minimum_length < 2 or not axes or len(set(axes)) != len(axes) or any(
        axis not in ((0, 1), (1, 0), (1, 1), (1, -1)) for axis in axes
    ):
        raise ValueError('explicit unique undirected axes and a threshold >=2 are required')
    received, distance = settle_cell_body(cells, body, empty_value=empty_value, direction=direction)
    board = [list(row) for row in cells]
    for r, c, value in received:
        board[r][c] = value
    current = tuple(tuple(row) for row in board)
    removed_rounds, lengths_rounds, stabilized, axes_rounds = [], [], [], []
    while True:
        # Reuse the existing four-axis maximal-run measurement; empty cells
        # are masked, never counted as monochrome objects.
        field = ParallelCellField(0, 0, 1, 1, tuple(tuple(
            None if v == empty_value else v for v in row) for row in current))
        lines = tuple(line for line in measure_cell_lines(field)
                      if line.step in axes and len(line.positions) >= minimum_length)
        positions = sorted({p for line in lines for p in line.positions})
        if not positions:
            return CellReaction(current, distance, received, tuple(removed_rounds),
                                tuple(lengths_rounds), tuple(stabilized), tuple(axes_rounds))
        removed_rounds.append(tuple((r, c, current[r][c]) for r, c in positions))
        lengths_rounds.append(tuple(len(line.positions) for line in lines))
        axes_rounds.append(tuple(line.step for line in lines))
        board = [list(row) for row in current]
        for r, c in positions:
            board[r][c] = empty_value
        current = compact_cell_field(tuple(tuple(row) for row in board),
                                     empty_value=empty_value, direction=direction)
        stabilized.append(current)
