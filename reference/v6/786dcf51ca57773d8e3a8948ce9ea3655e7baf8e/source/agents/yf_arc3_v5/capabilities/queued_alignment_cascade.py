"""Pure occurrence-preserving queue, line union, gravity and cascade operations."""
from collections import deque
from collections.abc import Mapping
from agents.yf_arc3_v5.capabilities.mechanical_contracts_b import MechanicalRequestB, MechanicalResultB, found, missing
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _board(value):
    board = tuple(tuple(row) for row in value)
    if not board or not board[0] or len(board) * len(board[0]) > 4096 or any(len(row) != len(board[0]) for row in board):
        raise ValueError('a bounded rectangular board is required')
    ids = tuple(cell['occurrence_ref'] for row in board for cell in row if cell is not None)
    if len(set(ids)) != len(ids):
        raise ValueError('physical occurrence identities must be unique')
    return board


def _lines(board, directions, minimum):
    if type(minimum) is not int or minimum < 2:
        raise ValueError('the supplied line threshold must be at least two')
    height, width = len(board), len(board[0])
    runs, removed = [], set()
    for dr, dc in directions:
        if (dr, dc) not in ((0,1),(1,0),(1,1),(1,-1)):
            raise ValueError('line directions must be explicitly registered unit vectors')
        for r in range(height):
            for c in range(width):
                cell = board[r][c]
                if cell is None:
                    continue
                pr, pc = r-dr, c-dc
                if 0 <= pr < height and 0 <= pc < width and board[pr][pc] is not None and board[pr][pc]['value'] == cell['value']:
                    continue
                run, rr, cc = [], r, c
                while 0 <= rr < height and 0 <= cc < width and board[rr][cc] is not None and board[rr][cc]['value'] == cell['value']:
                    run.append((rr,cc)); rr += dr; cc += dc
                if len(run) >= minimum:
                    runs.append(tuple(run)); removed.update(run)
    return tuple(runs), tuple(sorted(removed))


def _compact(board, removed, gravity):
    if gravity not in (-1, 1):
        raise ValueError('the vertical gravity sign is required')
    height, width = len(board), len(board[0])
    removal = set(removed)
    output = [[None for _ in range(width)] for _ in range(height)]
    falls = []
    for c in range(width):
        survivors = tuple((r,board[r][c]) for r in range(height) if board[r][c] is not None and (r,c) not in removal)
        start = height-len(survivors) if gravity == 1 else 0
        for offset, (old_r, cell) in enumerate(survivors):
            new_r = start+offset; output[new_r][c] = cell
            falls.append(FrozenMap({'occurrence_ref':cell['occurrence_ref'], 'before':(old_r,c), 'after':(new_r,c)}))
    return tuple(tuple(row) for row in output), tuple(falls)


def _closure(board, model, bound, capture=None):
    trace, credited = [], []
    for wave in range(bound):
        runs, removed = _lines(board, model['directions'], model['minimum_line'])
        if capture is not None:capture('automatic.equal_line_union',board,{'runs':runs,'removed_positions':removed,'wave_index':wave})
        if not removed:
            return board, tuple(trace), tuple(credited), True
        occurrences = tuple(board[r][c]['occurrence_ref'] for r,c in removed)
        credited.extend(occurrences)
        if capture is not None:
            removal=set(removed)
            removed_board=tuple(tuple(None if (r,c) in removal else cell for c,cell in enumerate(row)) for r,row in enumerate(board))
            capture('automatic.simultaneous_removal',removed_board,{'credited_occurrences':occurrences,'wave_index':wave})
        board, falls = _compact(board, removed, model['gravity'])
        if capture is not None:capture('automatic.column_compaction',board,{'falls':falls,'wave_index':wave})
        trace.append(FrozenMap({'phase':'automatic','wave_index':wave,'runs':runs,'removed_positions':removed,
                               'credited_occurrences':occurrences,'falls':falls,'board':board}))
    _, pending = _lines(board, model['directions'], model['minimum_line'])
    return board, tuple(trace), tuple(credited), not pending


def _place(board, bundle, column, gravity):
    height, width = len(board), len(board[0])
    if not 0 <= column < width or not bundle or len(bundle) > height:
        return None
    rows = tuple(range(len(bundle))) if gravity == 1 else tuple(range(height-len(bundle),height))
    if any(board[r][column] is not None for r in rows):
        return None
    while all(0 <= r+gravity < height and board[r+gravity][column] is None for r in rows):
        rows = tuple(r+gravity for r in rows)
    output = [list(row) for row in board]
    for r, cell in zip(rows,bundle):
        output[r][column] = cell
    return _board(output), tuple((r,column) for r in rows)


def equal_line_union(request: MechanicalRequestB):
    if any(key not in request.model for key in ('directions','minimum_line')):
        return missing(request,'model.line_predicate')
    board = _board(request.state['board']);runs, removed = _lines(board,request.model['directions'],request.model['minimum_line'])
    return found(request,maximal_runs=runs,removal_union=removed,removed_occurrence_refs=tuple(board[r][c]['occurrence_ref'] for r,c in removed))


def column_compaction(request: MechanicalRequestB):
    if 'gravity' not in request.model or 'removed_positions' not in request.data:
        return missing(request,'model.gravity_or_declared_removal')
    board,falls = _compact(_board(request.state['board']),request.data['removed_positions'],request.model['gravity'])
    return found(request,board=board,falls=falls)


def cascade_closure(request: MechanicalRequestB):
    if any(key not in request.model for key in ('directions','minimum_line','gravity')) or 'max_waves' not in request.bounds:
        return missing(request,'model.cascade_or_wave_bound')
    board,trace,credited,closed = _closure(_board(request.state['board']),request.model,request.bounds['max_waves'])
    return MechanicalResultB(request=request,source_status='FOUND' if closed else 'BUDGET_REACHED',
        cause=None if closed else 'COMPUTATION_BOUND',values=FrozenMap({'board':board,'wave_trace':trace,'credited_occurrences':credited,'closed':closed}),
        examined_count=len(trace),frontier=() if closed else (FrozenMap({'board':board,'credited_occurrences':credited}),))


def bundle_order_domain(request: MechanicalRequestB):
    if 'cycle_permutation' not in request.model or 'bundle' not in request.state:
        return missing(request,'model.bundle_cycle')
    bundle = tuple(request.state['bundle']);permutation = tuple(request.model['cycle_permutation'])
    if sorted(permutation) != list(range(len(bundle))):
        raise ValueError('cycle must be a permutation of physical bundle occurrences')
    orders,seen,current = [],set(),bundle
    bound = request.bounds.get('max_domain',0)
    while tuple(cell['occurrence_ref'] for cell in current) not in seen:
        if len(orders) >= bound:
            return MechanicalResultB(request=request,source_status='BUDGET_REACHED',cause='COMPUTATION_BOUND',
        values=FrozenMap({'orders':tuple(orders),'cycle_counts':tuple(range(len(orders)))}),examined_count=len(orders),frontier=(FrozenMap({'bundle':current}),))
        seen.add(tuple(cell['occurrence_ref'] for cell in current));orders.append(current)
        current = tuple(current[index] for index in permutation)
    return MechanicalResultB(request=request,source_status='FOUND',values=FrozenMap({'orders':tuple(orders),'cycle_counts':tuple(range(len(orders))), 'physical_occurrence_order_preserved':True}),
                             examined_count=len(orders),domain_size=len(orders),domain_exhausted=True)


def placement_domain(request: MechanicalRequestB):
    if 'gravity' not in request.model or 'bundle' not in request.state:
        return missing(request,'model.bundle_placement')
    required = ('available_column_band', 'preparation_rows', 'control_bindings', 'input_costs')
    absent = tuple('model.'+key for key in required if key not in request.model)
    if absent or 'column' not in request.state:
        return missing(request, *absent, *(() if 'column' in request.state else ('state.column',)))
    board = _board(request.state['board']); columns = tuple(request.data.get('column_domain',range(len(board[0]))))
    low, high = request.model['available_column_band']
    preparation_rows = tuple(request.model['preparation_rows'])
    if len(preparation_rows) != len(request.state['bundle']):
        return missing(request, 'model.preparation_rows_for_each_bundle_member')
    start_column = request.state['column']
    results=[];bound=request.bounds.get('max_domain',0)
    for index,column in enumerate(columns):
        if index >= bound:
            return MechanicalResultB(request=request,source_status='BUDGET_REACHED',cause='COMPUTATION_BOUND',
                values=FrozenMap({'placements':tuple(results)}),examined_count=index,
                frontier=tuple(FrozenMap({'column':c}) for c in columns[index:]))
        passage_columns = tuple(range(min(start_column,column),max(start_column,column)+1))
        blockers = tuple((r,c) for c in passage_columns for r in preparation_rows
                         if not low <= c <= high or not 0 <= c < len(board[0]) or not 0 <= r < len(board) or board[r][c] is not None)
        if blockers:
            continue
        distance = abs(column-start_column)
        direction = 'left' if column < start_column else 'right'
        binding = request.model['control_bindings'].get(direction) if distance else None
        drop = request.model['control_bindings'].get('drop')
        if (distance and binding is None) or drop is None:
            return missing(request, 'model.bound_preparation_and_drop_controls')
        costs = request.model['input_costs']
        if drop not in costs or (distance and binding not in costs):
            return missing(request, 'model.actual_primitive_costs')
        placed = _place(board,request.state['bundle'],column,request.model['gravity'])
        if placed is not None:
            after,positions=placed;results.append(FrozenMap({'column':column,'board':after,'positions':positions,
                'preparation_runs':(FrozenMap({'action_ref':binding,'count':distance}),) if distance else (),
                'drop_action_ref':drop,'external_cost':distance*costs[binding]+costs[drop] if distance else costs[drop],
                'access_columns':passage_columns,'spawn_prerequisites':('complete_next_bundle_support',)}))
    return MechanicalResultB(request=request,source_status='FOUND' if results else 'EMPTY_DECLARED_DOMAIN',
        values=FrozenMap({'placements':tuple(results)}),examined_count=len(columns),domain_size=len(columns),domain_exhausted=True)


def quota_queue_boundary(request: MechanicalRequestB):
    if any(key not in request.model for key in ('quota_interval','acceptance_before_spawn')) or 'credit' not in request.state:
        return missing(request,'model.quota_checkpoint')
    low,high = request.model['quota_interval'];credit=request.state['credit']
    if type(low) is not int or type(high) is not int or not 0 <= low <= high:
        raise ValueError('quota interval must be ordered nonnegative integers')
    accepted = credit >= high;possible = credit >= low
    queue_exhausted = request.state['queue_index'] >= len(request.state['queue'])
    spawn_checked = not (accepted and request.model['acceptance_before_spawn'])
    spawn_legal = request.data.get('spawn_legal') if spawn_checked and not queue_exhausted else None
    return found(request,acceptance_for_all_quotas=accepted,acceptance_for_some_quotas=possible,
        decision_relevant_quota_unknown=possible and not accepted,queue_exhausted=queue_exhausted,
        spawn_checked=spawn_checked,spawn_legal=spawn_legal,
        terminal_before_queue_or_spawn=accepted and request.model['acceptance_before_spawn'])


def external_primitive(request: MechanicalRequestB):
    action = request.data.get('action_ref');operators=request.model.get('action_operators',{})
    if not isinstance(operators,Mapping):return missing(request,'model.action_operators_mapping')
    operator=operators.get(action)
    if operator is None:
        return missing(request,'model.action_operator')
    from agents.yf_arc3_v5.capabilities.mechanical_ledger_b import MechanicalLedgerB
    ledger=MechanicalLedgerB(request)
    state=dict(request.state);events=[]
    def capture(kind,fields=(),predicates=None,interruption=None):
        ledger.record(state,kind,fields,predicates,interruption)
    def capture_board(kind,board,predicates):
        state['board']=board
        capture(kind,('board',),predicates)
    if operator in ('left','right'):
        if 'available_column_band' not in request.model:
            return missing(request,'model.available_column_band')
        band=request.model['available_column_band']
        if type(state.get('column')) is not int:return missing(request,'state.column')
        if not isinstance(band,(tuple,list)) or len(band)!=2 or any(type(v) is not int for v in band) or band[0]>band[1]:
            return missing(request,'model.ordered_available_column_band')
        low,high=request.model['available_column_band'];before=state['column']
        state['column']=max(low,min(high,before+(-1 if operator=='left' else 1)))
        events.append(FrozenMap({'phase':'direct','operator':operator,'before':before,'after':state['column']}))
        capture('direct.'+operator,('column',))
    elif operator=='cycle':
        if 'cycle_permutation' not in request.model:
            return missing(request,'model.cycle_permutation')
        bundle=state.get('bundle');p=request.model['cycle_permutation']
        if not isinstance(bundle,(tuple,list)):return missing(request,'state.ordered_bundle')
        if not isinstance(p,(tuple,list)) or any(type(v) is not int for v in p) or sorted(p)!=list(range(len(bundle))):
            return missing(request,'model.valid_cycle_permutation')
        state['bundle']=tuple(bundle[index] for index in p)
        events.append(FrozenMap({'phase':'direct','operator':'cycle','queue_consumed':False}))
        capture('direct.cycle',('bundle',))
    elif operator=='drop':
        if any(key not in request.model for key in ('gravity','directions','minimum_line','quota_interval','acceptance_before_spawn')) or 'max_waves' not in request.bounds:
            return missing(request,'model.complete_locking_drop')
        absent=tuple('state.'+field for field in ('board','bundle','column','credit','queue','queue_index') if field not in state)
        if absent:return missing(request,*absent)
        if any(type(state[field]) is not int or state[field]<0 for field in ('column','credit','queue_index')):
            return missing(request,'state.nonnegative_column_credit_queue_index')
        if not isinstance(state['bundle'],(tuple,list)) or not isinstance(state['queue'],(tuple,list)):
            return missing(request,'state.ordered_bundle_and_queue')
        cells=tuple(state['bundle'])+tuple(cell for bundle in state['queue'] if isinstance(bundle,(tuple,list)) for cell in bundle)
        if any(not isinstance(bundle,(tuple,list)) for bundle in state['queue']) or any(not isinstance(cell,Mapping) or 'occurrence_ref' not in cell or 'value' not in cell for cell in cells):
            return missing(request,'state.typed_bundle_queue_members')
        try:board_before=_board(state['board'])
        except (ValueError,TypeError,KeyError):return missing(request,'state.bounded_unique_rectangular_board')
        if any(cell is not None and (not isinstance(cell,Mapping) or 'value' not in cell) for row in board_before for cell in row):
            return missing(request,'state.typed_board_members')
        quota_interval=request.model['quota_interval'];directions=request.model['directions']
        if not isinstance(quota_interval,(tuple,list)) or len(quota_interval)!=2 or any(type(v) is not int for v in quota_interval) or not 0<=quota_interval[0]<=quota_interval[1]:
            return missing(request,'model.ordered_nonnegative_quota_interval')
        if type(request.model['minimum_line']) is not int or request.model['minimum_line']<2 or request.model['gravity'] not in (-1,1) or type(request.model['acceptance_before_spawn']) is not bool:
            return missing(request,'model.typed_line_gravity_acceptance_laws')
        if not isinstance(directions,(tuple,list)) or not directions or any(not isinstance(v,(tuple,list)) or tuple(v) not in ((0,1),(1,0),(1,1),(1,-1)) for v in directions):
            return missing(request,'model.registered_line_directions')
        placed=_place(board_before,state['bundle'],state['column'],request.model['gravity'])
        if placed is None:
            capture('direct.safe_refusal',('board','bundle','column'),{'safe_refusal':True})
            return found(request,state=FrozenMap(state),events=(),source_outcome='safe_refusal',primitive_count=1,queue_consumed=False,
                **ledger.values(True,'safe_refusal'))
        board,positions=placed;events.append(FrozenMap({'phase':'direct','operator':'lock','positions':positions}))
        state['board']=board
        capture('direct.lock',('board','bundle','column'),{'locked_positions':positions})
        board,waves,credit,closed=_closure(board,request.model,request.bounds['max_waves'],capture=capture_board)
        state['board']=board;state['credit']+=len(credit);events.extend(waves)
        capture('automatic.credit',('credit',),{'credited_occurrences':credit,'cascade_closed':closed})
        if not closed:
            return MechanicalResultB(request=request,source_status='BUDGET_REACHED',cause='COMPUTATION_BOUND',
                values=FrozenMap({'state':FrozenMap(state),'events':tuple(events),'closed':False,'primitive_count':1,
                    **ledger.values(False,'computation.cascade_bound')}),
                frontier=(FrozenMap({'state':FrozenMap(state),'phase':'cascade'}),))
        quota=quota_queue_boundary(request.model_copy(update={'state':FrozenMap(state)})).values
        if quota['decision_relevant_quota_unknown']:
            return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='MISSING_OBSERVATION',
                values=FrozenMap({'state':FrozenMap(state),'events':tuple(events),'primitive_count':1,
                    **ledger.values(False,'model.exact_quota_missing')}),missing_refs=('model.exact_quota',))
        if quota['terminal_before_queue_or_spawn']:
            state['terminal']=True
            capture('checkpoint.acceptance',('credit','queue_index','queue'),{'quota':quota},'model.terminal_acceptance')
        else:
            state['queue_index']+=1
            capture('automatic.queue_advance',('queue_index','queue'))
            quota=quota_queue_boundary(request.model_copy(update={'state':FrozenMap(state)})).values
            if state['queue_index']>=len(state['queue']):
                state['queue_exhausted']=True
                capture('checkpoint.queue_exhausted',('queue','queue_index'),{'queue_exhausted':True},'model.queue_exhausted')
            else:
                state['bundle']=tuple(state['queue'][state['queue_index']])
                state['spawn_legal']=_place(board,state['bundle'],state['column'],request.model['gravity']) is not None
                capture('automatic.spawn',('board','column','queue','queue_index'),{'spawn_legal':state['spawn_legal']})
                if quota['acceptance_for_all_quotas'] and state['spawn_legal']:
                    state['terminal']=True
                capture('checkpoint.acceptance',('credit','queue_index','queue','spawn_legal'),{'quota':quota},
                    'model.terminal_acceptance' if state.get('terminal') else None)
        events.append(FrozenMap({'phase':'acceptance','quota':quota}))
    elif operator=='reset':
        if 'reset_state' not in request.model:
            return missing(request,'model.independent_reset_contract')
        if not isinstance(request.model['reset_state'],Mapping):return missing(request,'model.reset_state_mapping')
        state=dict(request.model['reset_state']);events.append(FrozenMap({'phase':'restoration','operator':'reset'}))
        capture('restoration.reset')
    else:
        return MechanicalResultB(request=request,source_status='NEEDS_EVIDENCE',cause='UNSUPPORTED_MODEL',missing_refs=('model.registered_action_operator',))
    return found(request,state=FrozenMap(state),events=tuple(events),primitive_count=1,
        queue_consumed=operator=='drop' and state.get('queue_index')!=request.state.get('queue_index'),
        **ledger.values(True,'external_primitive.closed'))


def control_trigger_fit(request: MechanicalRequestB):
    surviving=[];contradictions=[]
    for index,model in enumerate(request.model_alternatives):
        agrees=True if request.observations else None
        for observed in request.observations:
            measured=external_primitive(request.model_copy(update={'model':model,'state':observed['before'], 'data':FrozenMap({'action_ref':observed['action_ref']})}))
            if measured.source_status!='FOUND':
                agrees=None;break
            if observed.get('sealed') is not True:
                agrees=None;break
            if measured.values['state']!=observed['after'] or ('events' in observed and measured.values['events']!=observed['events']):
                agrees=False;break
        if agrees is not False:surviving.append(FrozenMap({'model_index':index,'model':model,'coverage_complete':agrees is True}))
        else:contradictions.append(index)
    return found(request,model_alternatives=tuple(surviving),contradicted_model_indices=tuple(contradictions),observed_count=len(request.observations))


def scene_layers(request: MechanicalRequestB):
    from agents.yf_arc3_v5.capabilities.guarded_transport import scene_layers as measure_masks
    if 'entity_masks' not in request.data:
        return missing(request, 'evidence.separate_board_bundle_queue_band_and_quota_masks')
    measured=measure_masks(request)
    if measured.source_status!='FOUND':return measured
    board=_board(request.state['board']);rows=[]
    transient=set(request.data.get('transient_occurrence_refs',()))
    for r,row in enumerate(board):
        for c,cell in enumerate(row):
            if cell is not None:rows.append(FrozenMap({'occurrence_ref':cell['occurrence_ref'],'value':None if cell['occurrence_ref'] in transient else cell['value'],
                'value_unknown_during_transient':cell['occurrence_ref'] in transient,'position':(r,c),'support_below':r+1==len(board) or board[r+1][c] is not None}))
    return found(request,board_shape=(len(board),len(board[0])),occurrence_rows=tuple(rows),
                 active_bundle=tuple(request.state.get('bundle',())),queue_index=request.state.get('queue_index'),credit=request.state.get('credit'),
                 mask_rows=measured.values['mask_rows'],layer_supports=measured.values['layer_supports'],
                 unknown_layer_refs=measured.values['unknown_layer_refs'],
                 visible_queue=tuple(request.state.get('queue',())),queue_suffix_known=request.data.get('queue_suffix_known') is True,
                 quota_display_candidates=tuple(request.data.get('quota_display_candidates',())),
                 occluded_quantities=FrozenMap(request.data.get('occluded_quantities',{})))


def future_contribution_certificate(request: MechanicalRequestB):
    placements=placement_domain(request)
    if placements.source_status not in ('FOUND','EMPTY_DECLARED_DOMAIN'):return placements
    candidates=[]
    for item in placements.values['placements']:
        board,waves,credited,closed=_closure(item['board'],request.model,request.bounds.get('max_waves',0))
        candidates.append(FrozenMap({'column':item['column'],'board':board,'credit_after':request.state['credit']+len(credited),
            'queue_index':request.state['queue_index'],'preparation_control':request.state.get('column'),
            'closed':closed,'wave_trace':waves,'consumer_refs':tuple(request.data.get('consumer_refs',())),
            'preparation_runs':item['preparation_runs'],'drop_action_ref':item['drop_action_ref'],'external_cost':item['external_cost'],
            'queue':request.state.get('queue'),'scope_revision_ref':request.input_revision_ref,
            'staging_consumer_unbound':not credited and not request.data.get('consumer_refs'),
            'state_key':stable_digest((board,request.state['queue_index'],request.state['credit']+len(credited),request.state.get('column')))}))
    return found(request,candidates=tuple(candidates),required_state_key_fields=('board','queue_index','credit','preparation_control'),exhaustive_placement_domain=placements.domain_exhausted)


def sealed_cascade_compare(request: MechanicalRequestB):
    from agents.yf_arc3_v5.capabilities.sealed_mechanical_compare_b import compare_sealed
    return compare_sealed(request, external_primitive,
                          ('board', 'bundle', 'column', 'queue', 'queue_index', 'credit'),
                          ('events', 'primitive_count', 'queue_consumed'))
