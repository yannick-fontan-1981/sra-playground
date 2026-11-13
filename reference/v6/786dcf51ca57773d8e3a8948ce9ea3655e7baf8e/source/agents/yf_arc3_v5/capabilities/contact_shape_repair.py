"""K26 bounded Source-supplied component contacts and spatial shape predicates."""
from typing import Literal
from math import gcd
from pydantic import Field,model_validator
import hashlib,json
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data
from .digital_topology import DigitalTopologyContract,DigitalTopologyInput,measure_digital_topology
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields

Point=tuple[int,int]


class ShapeNode(FrozenModel):
    node_ref: Ref
    position: Point
    contact_offsets: tuple[Point,...]=Field(default=((0,0),),min_length=1,max_length=128)


class ShapeSegment(FrozenModel):
    segment_ref: Ref
    node_refs: tuple[Ref,Ref]
    raster_rule: Literal['AXIS_INCLUSIVE','SUPPLIED_MASK']
    thickness_offsets: tuple[Point,...]=Field(default=((0,0),),min_length=1,max_length=128)
    supplied_cells: tuple[Point,...]=Field(default=(),max_length=4096)


class ShapeMarker(FrozenModel):
    marker_ref: Ref
    node_ref: Ref
    offset: Point=(0,0)


class ShapeBody(FrozenModel):
    body_ref: Ref
    layer_ref: Ref
    family_ref: Ref
    nodes: tuple[ShapeNode,...]=Field(min_length=1,max_length=128)
    roots: tuple[Ref,...]=Field(min_length=1,max_length=128)
    segments: tuple[ShapeSegment,...]=Field(min_length=1,max_length=128)
    markers: tuple[ShapeMarker,...]=Field(default=(),max_length=128)
    aspect_ref: Ref
    orientation_ref: Ref
    @model_validator(mode='after')
    def validate_body(self):
        refs={n.node_ref for n in self.nodes}
        if len(refs)!=len(self.nodes) or not set(self.roots)<=refs:raise ValueError('nodes and roots must have exact identities')
        if any(not set(s.node_refs)<=refs for s in self.segments) or any(m.node_ref not in refs for m in self.markers):raise ValueError('segments and markers require existing nodes')
        for values in ([s.segment_ref for s in self.segments],[m.marker_ref for m in self.markers]):
            if len(set(values))!=len(values):raise ValueError('segment and marker refs must be unique')
        return self


class ShapeAspectRule(FrozenModel):
    rule_ref: Ref
    layer_ref: Ref
    contact_cells: tuple[Point,...]=Field(min_length=1,max_length=4096)
    before_aspect_ref: Ref
    after_aspect_ref: Ref
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)


class ShapeLaw(FrozenModel):
    law_ref: Ref
    control_ref: Ref
    body_ref: Ref
    node_deltas: tuple[tuple[Ref,Point],...]=Field(max_length=128)
    endpoint_contact: Literal['KEEP_BEFORE','IGNORE','UNKNOWN']
    path_policy: Literal['ENDPOINT','SUPPLIED_SWEEP','UNKNOWN']
    swept_node_positions: tuple[tuple[Ref,tuple[Point,...]],...]=Field(default=(),max_length=128)
    recomposed_collision: Literal['REJECT_ATOMIC','ALLOW_DECLARED_CONTACT','UNKNOWN']
    aspect_phase: Literal['NONE','BEFORE_GEOMETRY','AFTER_GEOMETRY','UNKNOWN']
    aspect_rule_order: tuple[Ref,...]=Field(default=(),max_length=128)
    orientation_after_ref: Ref|None=None
    evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    assumption_ref: Ref|None=None


class ShapeInvariant(FrozenModel):
    invariant_ref: Ref
    body_ref: Ref
    kind: Literal['WIDTH','HEIGHT','ARM_OFFSET','NODE_DELTA','ROOT_POSITION','CONNECTED']
    node_refs: tuple[Ref,...]=Field(default=(),max_length=2)
    parameter_scope_ref: Ref
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)


class ShapeModel(FrozenModel):
    model_ref: Ref
    model_revision_ref: Ref
    stops: tuple[tuple[Ref,tuple[Point,...]],...]=Field(default=(),max_length=32)
    viewport: tuple[int,int,int,int]|None=None
    laws: tuple[ShapeLaw,...]=Field(default=(),max_length=128)
    aspect_rules: tuple[ShapeAspectRule,...]=Field(default=(),max_length=128)
    invariants: tuple[ShapeInvariant,...]=Field(default=(),max_length=128)
    topology_contract: DigitalTopologyContract|None=None


class ShapeTarget(FrozenModel):
    target_ref: Ref
    family_ref: Ref|None=None
    marker_positions: tuple[tuple[Ref,Point],...]=Field(default=(),max_length=128)
    required_mask: tuple[Point,...]|None=Field(default=None,max_length=4096)
    required_aspect_ref: Ref|None=None
    required_orientation_ref: Ref|None=None
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)


class ShapeCandidate(FrozenModel):
    candidate_ref: Ref
    body_ref: Ref
    proposed_body: ShapeBody
    control_word: tuple[Ref,...]|None=Field(default=None,max_length=4096)


class ShapeAssignment(FrozenModel):
    assignment_ref: Ref
    body_target_pairs: tuple[tuple[Ref,Ref],...]=Field(max_length=128)
    candidate_refs: tuple[Ref,...]=Field(default=(),max_length=128)


class ShapeContinuation(FrozenModel):
    input_digest: Ref
    phase: Literal['ROWS','UNSTARTED']
    next_item: int=Field(default=0,ge=0)
    next_step: int=Field(default=0,ge=0)
    current_bodies: tuple[ShapeBody,...]=()
    loop_after_bodies: tuple[ShapeBody,...]=()
    events: tuple[FrozenMap,...]=()
    completed_rows: tuple[FrozenMap,...]=()
    prerequisite_refs: tuple[Ref,...]=()
    accounted_evaluations: int=Field(default=0,ge=0)


class ShapeRequest(FrozenModel):
    schema_version: Ref='yf_arc3_v5.contact_shape_repair_request.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref|None=None
    bodies: tuple[ShapeBody,...]=Field(default=(),max_length=32)
    model: ShapeModel|None=None
    focused_body_ref: Ref|None=None
    control_ref: Ref|None=None
    after_bodies: tuple[ShapeBody,...]=Field(default=(),max_length=32)
    targets: tuple[ShapeTarget,...]=Field(default=(),max_length=128)
    candidates: tuple[ShapeCandidate,...]=Field(default=(),max_length=4096)
    assignments: tuple[ShapeAssignment,...]=Field(default=(),max_length=4096)
    loop_word: tuple[Ref,...]=Field(default=(),max_length=4096)
    suffix_word: tuple[Ref,...]|None=Field(default=None,max_length=4096)
    maximum_evaluations: int=Field(default=65536,ge=1,le=65536)
    maximum_states: int=Field(default=4096,ge=1,le=4096)
    resume: ShapeContinuation|None=None
    @model_validator(mode='after')
    def validate_domains(self):
        for values in ([b.body_ref for b in self.bodies],[b.body_ref for b in self.after_bodies],[t.target_ref for t in self.targets],
            [c.candidate_ref for c in self.candidates],[a.assignment_ref for a in self.assignments]):
            if len(set(values))!=len(values):raise ValueError('identity domains must be unique')
        return self


SHAPE_OPERATION_MODES={'measure':('MEASURE',),'contact_successor':('STEP_INTERNAL',),'invariant_check':('PRECONDITION',),
    'recolour_successor':('STEP_INTERNAL',),'inverse_shape':('INVERSE_DOMAIN',),'assignment_domain':('INVERSE_DOMAIN',),'round_trip_delta':('COMPARE',)}


def _shape_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _shape_resume(request,**fields):
    fields['completed_rows']=tuple(immutable_json_data(r) for r in fields.get('completed_rows',()))
    fields['events']=tuple(immutable_json_data(r) for r in fields.get('events',()))
    return ShapeContinuation(input_digest=_shape_digest(request),phase='ROWS',**fields)


def _shape_cells(body):
    nodes={n.node_ref:n.position for n in body.nodes};parts={};debt=[]
    for segment in body.segments:
        first,last=(nodes[r] for r in segment.node_refs);dr,dc=last[0]-first[0],last[1]-first[1]
        if segment.raster_rule=='SUPPLIED_MASK':
            if not segment.supplied_cells:debt.append('complete_supplied_component_mask');continue
            cells=set(segment.supplied_cells)
        else:
            if dr and dc:debt.append('supported_axis_segment_raster');continue
            length=max(abs(dr),abs(dc))
            if (length+1)*len(segment.thickness_offsets)>4096:debt.append('bounded_complete_component_mask');continue
            step=(0 if not dr else dr//abs(dr),0 if not dc else dc//abs(dc))
            cells={(first[0]+i*step[0]+r,first[1]+i*step[1]+c) for i in range(length+1) for r,c in segment.thickness_offsets}
        parts[segment.segment_ref]=frozenset(cells)
        if len(frozenset().union(*parts.values()))>4096:
            return frozenset(),{},('bounded_complete_body_mask',)
    mask=frozenset().union(*parts.values()) if parts else frozenset()
    if len(mask)>4096:debt.append('bounded_complete_body_mask')
    return mask,parts,tuple(dict.fromkeys(debt))


def _shape_measure(body,model):
    mask,parts,debt=_shape_cells(body);nodes={n.node_ref:n.position for n in body.nodes}
    lengths=tuple((s.segment_ref,gcd(abs(nodes[s.node_refs[1]][0]-nodes[s.node_refs[0]][0]),abs(nodes[s.node_refs[1]][1]-nodes[s.node_refs[0]][1]))) for s in body.segments)
    root=nodes[body.roots[0]]
    offsets=tuple((n.node_ref,(n.position[0]-root[0],n.position[1]-root[1])) for n in body.nodes)
    intersections=tuple((a,b,tuple(sorted(parts[a]&parts[b]))) for index,a in enumerate(sorted(parts)) for b in sorted(parts)[index+1:] if parts[a]&parts[b])
    clipped=tuple(sorted((r,c) for r,c in mask if model.viewport is not None and not(model.viewport[0]<=r<=model.viewport[2] and model.viewport[1]<=c<=model.viewport[3])))
    markers=tuple((m.marker_ref,(nodes[m.node_ref][0]+m.offset[0],nodes[m.node_ref][1]+m.offset[1])) for m in body.markers)
    topology=None
    if model.topology_contract is not None and mask:
        area=(max(r for r,c in mask)-min(r for r,c in mask)+3)*(max(c for r,c in mask)-min(c for r,c in mask)+3)
        if area>model.topology_contract.max_padded_domain_area:debt+=('topology_domain_within_supplied_bound',)
        else:topology=measure_digital_topology(DigitalTopologyInput(support=tuple(sorted(mask)),contract=model.topology_contract))
    return {'body_ref':body.body_ref,'segment_lattice_lengths':lengths,'endpoint_root_offsets':offsets,'component_intersections':intersections,
        'full_mask':tuple(sorted(mask)),'clipped_cells':clipped,'markers':markers,'topology':topology},debt


def _shape_match(body,target,model):
    row,debt=_shape_measure(body,model);markers=dict(row['markers'])
    residual=tuple((ref,None if ref not in markers else (markers[ref][0]-p[0],markers[ref][1]-p[1])) for ref,p in target.marker_positions)
    if target.marker_positions and 'markers' not in body.model_fields_set:debt+=('current_marker_constellation_explicitly_supplied',)
    good=not debt and all(delta==(0,0) for _,delta in residual)
    if target.required_mask is not None:good=good and set(row['full_mask'])==set(target.required_mask)
    good=good and (target.family_ref is None or body.family_ref==target.family_ref)
    good=good and (target.required_aspect_ref is None or body.aspect_ref==target.required_aspect_ref)
    good=good and (target.required_orientation_ref is None or body.orientation_ref==target.required_orientation_ref)
    return {'target_ref':target.target_ref,'compatible':good,'marker_residuals':residual,
        'orientation_checked_separately_from_family':True},debt


def _shape_invariants(before,after,model):
    bmask,bparts,debt=_shape_cells(before);amask,aparts,missing=_shape_cells(after);debt+=missing
    bn={n.node_ref:n.position for n in before.nodes};an={n.node_ref:n.position for n in after.nodes};rows=[]
    for inv in model.invariants:
        if inv.body_ref!=before.body_ref:continue
        if inv.parameter_scope_ref!=model.model_revision_ref:debt+=('invariant_parameter_scope_matches_current_model',);continue
        if inv.kind in ('WIDTH','HEIGHT'):
            axis=1 if inv.kind=='WIDTH' else 0
            a=max((p[axis] for p in amask),default=0)-min((p[axis] for p in amask),default=0)
            b=max((p[axis] for p in bmask),default=0)-min((p[axis] for p in bmask),default=0);holds=a==b
        elif inv.kind=='ROOT_POSITION':holds=all(r in an and bn[r]==an[r] for r in before.roots)
        elif inv.kind=='CONNECTED':
            graph={n.node_ref:set() for n in after.nodes}
            for s in after.segments:graph[s.node_refs[0]].add(s.node_refs[1]);graph[s.node_refs[1]].add(s.node_refs[0])
            pending=[after.roots[0]];seen=set()
            while pending:
                ref=pending.pop()
                if ref in seen:continue
                seen.add(ref);pending.extend(sorted(graph[ref]-seen))
            holds=len(seen)==len(graph)
        else:
            if len(inv.node_refs)!=2 or not set(inv.node_refs)<=set(bn)&set(an):debt+=('invariant_endpoint_parameter_domain',);continue
            x,y=inv.node_refs;holds=tuple(an[y][i]-an[x][i] for i in range(2))==tuple(bn[y][i]-bn[x][i] for i in range(2))
        rows.append({'invariant_ref':inv.invariant_ref,'holds':holds,'parameter_scope_ref':inv.parameter_scope_ref})
    return tuple(rows),tuple(dict.fromkeys(debt))


def _shape_aspect(body,law,model):
    mask,_,debt=_shape_cells(body)
    by_ref={r.rule_ref:r for r in model.aspect_rules}
    if len(by_ref)!=len(model.aspect_rules) or any(ref not in by_ref for ref in law.aspect_rule_order):
        return body,(),('exact_ordered_aspect_rule_domain',)
    current=body;events=[]
    for ref in law.aspect_rule_order:
        rule=by_ref[ref]
        contact=rule.layer_ref==body.layer_ref and bool(mask&set(rule.contact_cells))
        if contact and current.aspect_ref==rule.before_aspect_ref:
            current=current.model_copy(update={'aspect_ref':rule.after_aspect_ref});events.append({'rule_ref':ref,'before':rule.before_aspect_ref,'after':rule.after_aspect_ref})
    return current,tuple(events),debt


def _shape_step(bodies,control,request,recolour_only=False):
    focused=next((b for b in bodies if b.body_ref==request.focused_body_ref),None)
    if focused is None:return bodies,(),('current_focused_body_identity',)
    laws=tuple(l for l in request.model.laws if l.body_ref==focused.body_ref and l.control_ref==control)
    if len(laws)!=1:return bodies,(),('unique_scoped_component_contact_law',)
    law=laws[0]
    if not law.evidence_refs and law.assumption_ref not in request.scope.assumption_refs:return bodies,(),('evidenced_or_retained_component_contact_law',)
    if law.aspect_phase=='UNKNOWN':return bodies,(),('ordered_contact_aspect_phase',)
    before=focused;events=[]
    if recolour_only:
        after,aspect,debt=_shape_aspect(focused,law,request.model)
        return tuple(after if b.body_ref==after.body_ref else b for b in bodies),aspect,debt
    if law.path_policy=='UNKNOWN' or law.endpoint_contact=='UNKNOWN' or law.recomposed_collision=='UNKNOWN':
        return bodies,(),('supported_endpoint_path_and_recomposed_contact_policy',)
    if 'stops' not in request.model.model_fields_set:return bodies,(),('current_layer_stop_domain_explicitly_supplied',)
    deltas=dict(law.node_deltas);nodes={n.node_ref:n for n in focused.nodes}
    if len(deltas)!=len(law.node_deltas) or set(deltas)!=set(nodes):return bodies,(),('complete_unique_node_motion_domain',)
    swept=dict(law.swept_node_positions)
    if len(swept)!=len(law.swept_node_positions):return bodies,(),('unique_node_swept_supports',)
    stops=frozenset(p for layer,positions in request.model.stops if layer==focused.layer_ref for p in positions)
    if law.aspect_phase=='BEFORE_GEOMETRY':
        focused,aspect,debt=_shape_aspect(focused,law,request.model)
        if debt:return bodies,(),debt
        events.extend(aspect)
    moved=[]
    for node in focused.nodes:
        delta=deltas[node.node_ref];position=(node.position[0]+delta[0],node.position[1]+delta[1]);path=(position,)
        if law.path_policy=='SUPPLIED_SWEEP':
            path=swept.get(node.node_ref,())
            if not path or path[0]!=node.position or path[-1]!=position:return bodies,(),('complete_node_swept_path_from_before_to_after',)
        contact=any((p[0]+r,p[1]+c) in stops for p in path for r,c in node.contact_offsets)
        if contact and law.endpoint_contact=='KEEP_BEFORE':position=node.position
        moved.append(node.model_copy(update={'position':position}))
        events.append({'node_ref':node.node_ref,'before':node.position,'after':position,'contact':contact})
    segments=[]
    newnodes={n.node_ref:n.position for n in moved}
    for segment in focused.segments:
        if segment.raster_rule=='SUPPLIED_MASK':
            displacements=tuple((newnodes[ref][0]-nodes[ref].position[0],newnodes[ref][1]-nodes[ref].position[1]) for ref in segment.node_refs)
            if displacements[0]!=displacements[1]:return bodies,(),('supported_mask_for_nonrigid_component_deformation',)
            dr,dc=displacements[0];segment=segment.model_copy(update={'supplied_cells':tuple((r+dr,c+dc) for r,c in segment.supplied_cells)})
        segments.append(segment)
    after=focused.model_copy(update={'nodes':tuple(moved),'segments':tuple(segments),
        'orientation_ref':law.orientation_after_ref if law.orientation_after_ref is not None else focused.orientation_ref})
    mask,_,debt=_shape_cells(after)
    if debt:return bodies,(),debt
    others=[]
    for body in bodies:
        if body.body_ref==after.body_ref or body.layer_ref!=after.layer_ref:continue
        cells,_,missing=_shape_cells(body)
        if missing:return bodies,(),missing
        others.extend(cells)
    other=frozenset(others)
    if mask&other:return bodies,(),('supported_contact_policy_for_other_complete_bodies',)
    if mask&stops and law.recomposed_collision=='REJECT_ATOMIC':return bodies,({'atomic_rejection':True,'blocking_cells':tuple(sorted(mask&stops))},),()
    if law.aspect_phase=='AFTER_GEOMETRY':
        after,aspect,debt=_shape_aspect(after,law,request.model)
        if debt:return bodies,(),debt
        events.extend(aspect)
    return tuple(after if b.body_ref==after.body_ref else b for b in bodies),tuple(events),()


def _shape_work(bodies,model):
    # Conservatively includes nested footprints and supplied topology domain.
    total=1+len(model.laws)+len(model.invariants)+sum(len(p) for _,p in model.stops)+sum(len(r.contact_cells) for r in model.aspect_rules)
    for body in bodies:
        total+=len(body.nodes)+len(body.markers)+len(body.segments)**2
        nodes={n.node_ref:n.position for n in body.nodes}
        for s in body.segments:
            a,b=(nodes[r] for r in s.node_refs)
            total+=len(s.supplied_cells) if s.raster_rule=='SUPPLIED_MASK' else (max(abs(a[0]-b[0]),abs(a[1]-b[1]))+1)*len(s.thickness_offsets)
        total+=sum(len(n.contact_offsets) for n in body.nodes)
    total+=sum(sum(len(path) for _,path in l.swept_node_positions) for l in model.laws)*128
    if model.topology_contract is not None:total+=model.topology_contract.max_padded_domain_area*16
    return total


def _shape_rows(request,operation):
    resume=request.resume if request.resume is not None and request.resume.phase=='ROWS' else None
    rows=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=resume.accounted_evaluations if resume is not None else 0
    items=request.candidates if operation=='inverse_shape' else request.assignments if operation=='assignment_domain' else (request.loop_word,)
    for index in range(resume.next_item if resume is not None else 0,len(items)):
        item=items[index];continuing=resume is not None and index==resume.next_item
        bodies=resume.current_bodies if continuing and resume.current_bodies else request.bodies;events=list(resume.events) if continuing else []
        loop_after=resume.loop_after_bodies if continuing else ()
        word=item.control_word if operation=='inverse_shape' else request.loop_word if operation=='round_trip_delta' else ()
        word=word if word is not None else ()
        if operation=='round_trip_delta':word=(*word,*(request.suffix_word or ()))
        for part in range(resume.next_step if continuing else 0,len(word)+1):
            if operation=='round_trip_delta' and part==len(request.loop_word) and not loop_after:loop_after=bodies
            measured_bodies=(*bodies,item.proposed_body) if operation=='inverse_shape' and part==len(word) else bodies
            if operation=='assignment_domain' and part==len(word):
                refs=set(item.candidate_refs);measured_bodies=(*bodies,*(c.proposed_body for c in request.candidates if c.candidate_ref in refs))
            work=_shape_work(measured_bodies,request.model)*(max(1,len(request.targets)) if part==len(word) else 1)
            if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
                token=_shape_resume(request,next_item=index,next_step=part,current_bodies=bodies,loop_after_bodies=loop_after,events=tuple(events),completed_rows=tuple(rows),
                    prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
                return family_result(request,values={'candidate_rows':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                    domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
            count+=work
            if part<len(word):
                bodies,trace,missing=_shape_step(bodies,word[part],request);events.extend(trace)
                if missing:
                    debt.extend(missing);rows.append({'item_index':index,'unsupported_refs':missing,'current_bodies':bodies,'completed_events':tuple(events)});break
                continue
            by_body={b.body_ref:b for b in bodies};targets={t.target_ref:t for t in request.targets}
            if operation=='assignment_domain':
                pairs=item.body_target_pairs;injective=len({b for b,t in pairs})==len(pairs) and len({t for b,t in pairs})==len(pairs)
                matches=[];unsupported=[]
                pose_candidates={c.candidate_ref:c for c in request.candidates}
                proposed={};pose_limits=[]
                for ref in item.candidate_refs:
                    candidate=pose_candidates.get(ref)
                    if candidate is None or candidate.body_ref in proposed or candidate.proposed_body.body_ref!=candidate.body_ref:
                        pose_limits.append(ref);continue
                    original=by_body.get(candidate.body_ref)
                    if original is None:pose_limits.append(ref);continue
                    checks,missing=_shape_invariants(original,candidate.proposed_body,request.model);debt.extend(missing)
                    if missing or not all(c['holds'] for c in checks):pose_limits.append(ref);continue
                    proposed[candidate.body_ref]=candidate.proposed_body
                for body_ref,target_ref in pairs:
                    if body_ref not in by_body or target_ref not in targets:unsupported.append((body_ref,target_ref));continue
                    match,missing=_shape_match(proposed.get(body_ref,by_body[body_ref]),targets[target_ref],request.model);matches.append(match);debt.extend(missing)
                rows.append({'assignment_ref':item.assignment_ref,'injective':injective,'matches':tuple(matches),'unsupported_residuals':tuple(unsupported),
                    'unsupported_pose_refs':tuple(pose_limits),'transit_or_route_proven':False,
                    'unassigned_body_refs':tuple(b.body_ref for b in bodies if b.body_ref not in {b for b,t in pairs}),
                    'unassigned_target_refs':tuple(t.target_ref for t in request.targets if t.target_ref not in {t for b,t in pairs}),
                    'complete_target_coverage':set(targets)<={t for b,t in pairs},
                    'initial_aspect_assignment_permanent':False,'compatible':injective and not unsupported and not pose_limits and all(m['compatible'] for m in matches)})
            elif operation=='inverse_shape':
                original=next((b for b in request.bodies if b.body_ref==item.body_ref),None)
                actual=by_body.get(item.body_ref);pose=item.proposed_body
                if original is None or pose.body_ref!=item.body_ref:
                    debt.append('candidate_existing_body_identity');rows.append({'candidate_ref':item.candidate_ref,'unsupported_refs':('candidate_existing_body_identity',)});continue
                invariants,missing=_shape_invariants(original,pose,request.model);debt.extend(missing)
                matches=[]
                for target in request.targets:
                    match,missing=_shape_match(pose,target,request.model);matches.append(match);debt.extend(missing)
                transit=None if item.control_word is None else actual==pose
                rows.append({'candidate_ref':item.candidate_ref,'target_matches':tuple(matches),'invariants':invariants,
                    'transit_supported':transit,'final_pose_compatible':all(r['holds'] for r in invariants) and any(m['compatible'] for m in matches),
                    'actual_body_after_word':actual,'events':tuple(events),'missing_refs':missing})
            else:
                before={b.body_ref:b for b in request.bodies}
                loop_bodies=loop_after or bodies
                deltas=tuple({'body_ref':b.body_ref,'before_nodes':before[b.body_ref].nodes,'after_nodes':b.nodes,
                    'before_segments':before[b.body_ref].segments,'after_segments':b.segments,
                    'before_aspect':before[b.body_ref].aspect_ref,'after_aspect':b.aspect_ref,
                    'before_orientation':before[b.body_ref].orientation_ref,'after_orientation':b.orientation_ref,
                    'internal_geometry_equal':before[b.body_ref].nodes==b.nodes and before[b.body_ref].segments==b.segments
                        and before[b.body_ref].roots==b.roots and before[b.body_ref].markers==b.markers,
                    'world_positions_closed':{n.node_ref:n.position for n in before[b.body_ref].nodes}=={n.node_ref:n.position for n in b.nodes}} for b in loop_bodies)
                rows.append({'loop_geometry_deltas':deltas,'loop_after_bodies':loop_bodies,'loop_length':len(request.loop_word),'suffix_forward_checked':request.suffix_word is not None,
                    'after_bodies':bodies,'events':tuple(events)})
    return family_result(request,values={'candidate_rows':tuple(rows),'input_domain_exhaustive':request.scope.input_domain_complete},
        prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,domain_complete=not debt and request.scope.input_domain_complete)


def _measure_contact_shape_repair(request):
    prefix='mechanics.contact_shape_repair.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in SHAPE_OPERATION_MODES or request.mode not in SHAPE_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'measure':('bodies','model'),'contact_successor':('bodies','model','focused_body_ref','control_ref'),
        'invariant_check':('bodies','after_bodies','model'),'recolour_successor':('bodies','model','focused_body_ref','control_ref'),
        'inverse_shape':('bodies','model','candidates','targets'),'assignment_domain':('bodies','model','assignments','targets'),
        'round_trip_delta':('bodies','model','loop_word','focused_body_ref')}[operation]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if request.model.model_revision_ref!=request.scope.model_revision_ref:return family_result(request,prerequisite_refs=('model_matches_current_scope_revision',),domain_complete=False)
    if operation in ('inverse_shape','assignment_domain','round_trip_delta'):return _shape_rows(request,operation)
    work=_shape_work(request.bodies+request.after_bodies,request.model)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'required_work':work})
    rows=[];debt=[]
    if operation=='measure':
        for body in request.bodies:
            row,missing=_shape_measure(body,request.model);rows.append(row);debt.extend(missing)
    elif operation=='invariant_check':
        after={b.body_ref:b for b in request.after_bodies}
        for body in request.bodies:
            if body.body_ref not in after:debt.append('matching_after_body_identity');continue
            row,missing=_shape_invariants(body,after[body.body_ref],request.model);rows.append({'body_ref':body.body_ref,'invariants':row});debt.extend(missing)
    else:
        bodies,events,missing=_shape_step(request.bodies,request.control_ref,request,operation=='recolour_successor')
        rows.append({'after_bodies':bodies,'events':events,'unaffected_body_refs':tuple(b.body_ref for b in request.bodies if b.body_ref!=request.focused_body_ref)});debt.extend(missing)
    return family_result(request,values={'measurements':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=work,domain_complete=not debt)


def measure_contact_shape_repair(request: ShapeRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_shape_digest(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_shape_inputs',),domain_complete=False)
    result=_measure_contact_shape_repair(request)
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':ShapeContinuation(input_digest=_shape_digest(request),phase='UNSTARTED')})})
    return result
