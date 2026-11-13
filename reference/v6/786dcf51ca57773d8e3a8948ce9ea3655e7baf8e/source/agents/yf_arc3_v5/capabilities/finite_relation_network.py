"""Finite relational networks with shared variables and ordered repeated ports.

This is exact constraint enumeration over supplied domains, not gate-name
recognition or semantic ranking. Unknown functional rows stay shared by scope.
"""
from __future__ import annotations

from typing import Literal
from collections import deque
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .mechanical_family_contracts_a import (
    MechanicalFamilyScope, MechanicalFamilyResult, family_result,
    missing_supplied_fields,
)


class RelationVariable(FrozenModel):
    variable_ref: Ref
    values: tuple[Ref,...] = Field(min_length=1,max_length=16)
    source: bool
    @model_validator(mode="after")
    def finite_set(self):
        if len(set(self.values))!=len(self.values):raise ValueError("variable domain must be a set")
        return self


class RelationComponent(FrozenModel):
    component_ref: Ref
    model_scope_ref: Ref
    signature_ref: Ref
    context_ref: Ref
    ordered_input_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    output_ref: Ref


class FiniteRelationRow(FrozenModel):
    inputs: tuple[Ref,...] = Field(max_length=16)
    outputs: tuple[Ref,...] = Field(min_length=1,max_length=16)


class FiniteRelationAlternative(FrozenModel):
    model_ref: Ref
    model_scope_ref: Ref
    signature_ref: Ref
    context_ref: Ref
    arity: int = Field(ge=1,le=16)
    rows: tuple[FiniteRelationRow,...] = Field(max_length=1024)
    table_complete: bool
    deterministic: bool
    @model_validator(mode="after")
    def row_domain(self):
        if len({row.inputs for row in self.rows})!=len(self.rows) or any(len(row.inputs)!=self.arity for row in self.rows):
            raise ValueError("relation rows must have unique complete input tuples")
        if any(len(set(row.outputs))!=len(row.outputs) or (self.deterministic and len(row.outputs)!=1) for row in self.rows):
            raise ValueError("row output domain must respect the supplied function contract")
        return self


class RelationSample(FrozenModel):
    evidence_ref: Ref
    signature_ref: Ref
    context_ref: Ref
    arity: int = Field(ge=1,le=16)
    inputs: tuple[Ref,...] = Field(max_length=16)
    output_ref: Ref
    appearance_ref: Ref | None = None
    @model_validator(mode="after")
    def whole_tuple(self):
        if len(self.inputs)!=self.arity:raise ValueError("sample must contain every ordered port")
        return self


class RelationEdit(FrozenModel):
    source_ref: Ref
    cycle: tuple[Ref,...] = Field(min_length=2,max_length=16)
    action_ref: Ref
    payload: FrozenMap
    primitive_cost: int = Field(ge=0)
    relayout_after_edit: bool
    @model_validator(mode="after")
    def reversible_cycle(self):
        if len(set(self.cycle))!=len(self.cycle):raise ValueError("edit law must be an explicit unique cycle")
        return self


class RelationPort(FrozenModel):
    port_ref: Ref
    position: tuple[int,int]
    kind: Literal["SOURCE","INPUT","OUTPUT","DISPLAY"]
    variable_ref: Ref | None = None
    component_ref: Ref | None = None
    input_rank: int | None = Field(default=None,ge=0,le=15)
    outgoing_directions: tuple[tuple[int,int],...] = Field(default=(),max_length=4)


class RelationWireTurn(FrozenModel):
    position: tuple[int,int]
    incoming: tuple[int,int]
    outgoing: tuple[tuple[int,int],...] = Field(max_length=4)


class RelationWireModel(FrozenModel):
    model_ref: Ref
    conductive_token_refs: tuple[Ref,...] = Field(min_length=1,max_length=32)
    ports: tuple[RelationPort,...] = Field(max_length=512)
    crossing_turns: tuple[RelationWireTurn,...] = Field(max_length=4096)
    component_boundaries: tuple[tuple[int,int],...] = Field(max_length=4096)
    state_display_templates: tuple[Ref,...] = Field(max_length=512)
    @model_validator(mode="after")
    def topology(self):
        if len({p.port_ref for p in self.ports})!=len(self.ports):raise ValueError("port identities remain distinct")
        if any(v not in ((1,0),(-1,0),(0,1),(0,-1)) for p in self.ports for v in p.outgoing_directions):raise ValueError("source port directions are adjacent physical vectors")
        if len({(t.position,t.incoming) for t in self.crossing_turns})!=len(self.crossing_turns):raise ValueError("one crossing transition per directed arrival")
        if any(v not in ((1,0),(-1,0),(0,1),(0,-1)) for t in self.crossing_turns for v in (t.incoming,)+t.outgoing):raise ValueError("wire transitions use adjacent directional geometry")
        return self


class FiniteRelationRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.finite_relation_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    variables: tuple[RelationVariable,...] = Field(default=(),max_length=128)
    components: tuple[RelationComponent,...] = Field(default=(),max_length=128)
    models: tuple[FiniteRelationAlternative,...] = Field(default=(),max_length=256)
    assignment: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    fixed_values: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    requested_outputs: tuple[tuple[Ref,tuple[Ref,...]],...] = Field(default=(),max_length=128)
    samples: tuple[RelationSample,...] = Field(default=(),max_length=256)
    edits: tuple[RelationEdit,...] = Field(default=(),max_length=128)
    source_ref: Ref | None = None
    bound_assignment: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    declared_edit_order: tuple[Ref,...] = Field(default=(),max_length=128)
    intermediate_constraints: tuple[tuple[Ref,tuple[Ref,...]],...] = Field(default=(),max_length=128)
    intermediate_preservation_declared: bool | None = None
    decision_relevant_component_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    observed_components: tuple[RelationComponent,...] = Field(default=(),max_length=128)
    binary_values: tuple[Ref,Ref] | None = None
    expected_assignment: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    actual_assignment: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)
    acceptance_observed: bool | None = None
    expected_acceptance: bool | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_relation_checks: int = Field(ge=1,le=65536)
    domain_offset: int = Field(default=0,ge=0)
    remaining_input_budget: int | None = Field(default=None,ge=0)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ContactLayerTemplate,...] = Field(default=(),max_length=1024)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=1024)
    wire_models: tuple[RelationWireModel,...] = Field(default=(),max_length=64)
    @model_validator(mode="after")
    def network_identity(self):
        domains={v.variable_ref:set(v.values) for v in self.variables}
        sources={v.variable_ref for v in self.variables if v.source}
        if len(domains)!=len(self.variables) or len({c.component_ref for c in self.components})!=len(self.components):
            raise ValueError("network identities must be unique")
        outputs=tuple(c.output_ref for c in self.components)
        if len(set(outputs))!=len(outputs) or set(outputs)&sources:raise ValueError("each non-source output has one producer")
        if sources|set(outputs)!=set(domains):raise ValueError("every variable must be a source or a produced output")
        for component in self.components:
            if component.output_ref not in domains or not set(component.ordered_input_refs)<=set(domains):raise ValueError("ports must reference bound variables")
            alternatives=tuple(m for m in self.models if m.model_scope_ref==component.model_scope_ref)
            if not alternatives or any((m.signature_ref,m.context_ref,m.arity)!=(component.signature_ref,component.context_ref,len(component.ordered_input_refs)) for m in alternatives):
                raise ValueError("model scope must preserve signature, context and arity")
        for values in (self.assignment,self.fixed_values,self.bound_assignment,self.expected_assignment,self.actual_assignment):
            if len({ref for ref,_ in values})!=len(values) or any(ref not in domains or value not in domains[ref] for ref,value in values):raise ValueError("assignment must bind unique declared variables")
        for constraints in (self.requested_outputs,self.intermediate_constraints):
            if len({ref for ref,_ in constraints})!=len(constraints) or any(ref not in domains or not set(values)<=domains[ref] for ref,values in constraints):raise ValueError("constraint outside declared value domain")
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError("model alternatives must have unique identities")
        if len({e.source_ref for e in self.edits})!=len(self.edits) or any(e.source_ref not in sources or not set(e.cycle)<=domains[e.source_ref] for e in self.edits):raise ValueError("edit law must bind one source and its actual domain")
        if len(set(self.declared_edit_order))!=len(self.declared_edit_order) or not set(self.declared_edit_order)<=sources:raise ValueError("edit order must preserve source identities")
        if len(set(self.decision_relevant_component_refs))!=len(self.decision_relevant_component_refs) or not set(self.decision_relevant_component_refs)<={c.component_ref for c in self.components}:
            raise ValueError("decision relevance must bind declared components")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels) or len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("raw geometry evidence identities are unique")
        return self


OPERATION_MODES={"ports_and_wires":"MEASURE","relation_samples":"FIT","relation_propagation":"PROPAGATE",
    "network_successor":"STEP","backward_output_constraints":"INVERSE_DOMAIN","common_assignment":"DOMAIN",
    "relation_discrimination":"DOMAIN","affine_guard":"PRECONDITION","assignment_compilation":"COMPILE",
    "relation_compare_transfer":"COMPARE"}


def _ports_and_wires(request):
    measured=measure_translated_layers(request)
    if measured.computation_bound_reached:return measured
    current_templates={row["template_ref"] for row in measured.values.get("measured_layer_alternatives",())}
    pixels={p.point:p.token_ref for p in request.raw_layer_pixels};count=measured.examined_count;outcomes=[];unknown=[]
    adjacent=((1,0),(-1,0),(0,1),(0,-1))
    for model_index,model in enumerate(request.wire_models):
        allowed=set(model.conductive_token_refs);boundaries=set(model.component_boundaries);ports={};turns={(t.position,t.incoming):t.outgoing for t in model.crossing_turns}
        for port in model.ports:ports.setdefault(port.position,[]).append(port)
        paths=[];seen_paths=set();model_unknown=[]
        for port in model.ports:
            if port.kind in ("SOURCE","OUTPUT") and port.variable_ref is None:model_unknown.append((port.port_ref,"shared_variable_endpoint_identity"))
            if port.kind=="INPUT" and (port.component_ref is None or port.input_rank is None):model_unknown.append((port.port_ref,"ordered_component_input_identity"))
        for port_index,port in enumerate(model.ports):
            if port.kind not in ("SOURCE","OUTPUT"):continue
            if not port.outgoing_directions:
                model_unknown.append((port.port_ref,"declared_source_port_orientation"));continue
            if port.position not in pixels or pixels[port.position] not in allowed:
                model_unknown.append((port.port_ref,"current_conductive_endpoint"));continue
            queue=deque([(port.position,None,(port.position,))]);visited={(port.position,None)}
            while queue:
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"topology_alternatives":tuple(outcomes)},examined_count=count,
                        domain_complete=False,computation_bound_reached=True,
                        frontier={"model_index":model_index,"port_index":port_index,"pending_routes":tuple(queue),
                            "retained_port_paths":tuple(paths),"unresolved_geometry":tuple(model_unknown)})
                count+=1;point,incoming,path=queue.popleft()
                endpoints=tuple(p for p in ports.get(point,()) if p.port_ref!=port.port_ref)
                if endpoints:
                    for endpoint in endpoints:
                        if endpoint.kind not in ("INPUT","DISPLAY"):continue
                        key=(port.port_ref,endpoint.port_ref)
                        if key in seen_paths:continue
                        seen_paths.add(key);paths.append({"source_port_ref":port.port_ref,"target_port_ref":endpoint.port_ref,
                            "shared_variable_ref":port.variable_ref,"target_component_ref":endpoint.component_ref,
                            "target_input_rank":endpoint.input_rank,"wire_pixels":path})
                    continue
                neighbors=tuple(v for v in adjacent if (point[0]+v[0],point[1]+v[1]) in pixels
                    and pixels[(point[0]+v[0],point[1]+v[1])] in allowed
                    and ((point[0]+v[0],point[1]+v[1]) not in boundaries or (point[0]+v[0],point[1]+v[1]) in ports))
                if incoming is not None and len(neighbors)>=3 and (point,incoming) not in turns:
                    model_unknown.append((point,incoming,"crossing_or_junction_transition_evidence"));continue
                vectors=port.outgoing_directions if incoming is None else turns.get((point,incoming),neighbors)
                for vector in vectors:
                    if vector not in neighbors or incoming is not None and vector==(-incoming[0],-incoming[1]):continue
                    nxt=(point[0]+vector[0],point[1]+vector[1]);key=(nxt,vector)
                    if key in visited:continue
                    visited.add(key);queue.append((nxt,vector,path+(nxt,)))
        inputs={}
        for path in paths:
            if path['target_component_ref'] is not None and path['target_input_rank'] is not None:
                inputs.setdefault((path['target_component_ref'],path['target_input_rank']),[]).append((path['source_port_ref'],path['shared_variable_ref']))
        displays=tuple(ref for ref in model.state_display_templates if ref in current_templates)
        if len(displays)!=len(model.state_display_templates):model_unknown.append((model.model_ref,"current_input_output_state_display_evidence"))
        outcomes.append({"model_ref":model.model_ref,"port_paths":tuple(paths),
            "ordered_input_port_alternatives":tuple((component,rank,tuple(values)) for (component,rank),values in sorted(inputs.items())),
            "component_boundary_support":model.component_boundaries,"state_display_templates":displays,
            "shared_source_fanout_preserved":True,"equal_color_or_crossing_proves_junction":False,
            "unresolved_geometry":tuple(model_unknown)})
        unknown.extend(model_unknown)
    return family_result(request,values={"topology_alternatives":tuple(outcomes),"raw_layer_evidence":measured.values,
        "unresolved_geometry":tuple(unknown)},examined_count=count,
        prerequisite_refs=("current_port_crossing_boundary_or_state_display_evidence",) if unknown else ())


def _backward_output_constraints(request):
    domains={v.variable_ref:set(v.values) for v in request.variables};producers={c.output_ref:c for c in request.components};tables={m.model_ref:{row.inputs:row.outputs for row in m.rows} for m in request.models}
    for ref,allowed in request.requested_outputs:domains[ref]&=set(allowed)
    for ref,value in request.fixed_values:domains[ref]&={value}
    queue=deque(ref for ref,_ in request.requested_outputs);queued=set(queue);traces=[];count=0;missing=[];unknown_rows=[]
    while queue:
        output=queue.popleft();queued.discard(output);component=producers.get(output)
        if component is None:continue
        refs=tuple(dict.fromkeys(component.ordered_input_refs));local_domains=tuple(tuple(sorted(domains[ref])) for ref in refs);total=1
        for values in local_domains:total*=len(values)
        models=tuple(m for m in request.models if m.model_scope_ref==component.model_scope_ref);preimages=[];input_support={ref:set() for ref in refs}
        for model_index,model in enumerate(models):
            for combination_index in range(total):
                if count>=request.maximum_relation_checks or len(preimages)>=request.maximum_states:
                    return family_result(request,values={"recursive_local_preimage_trace":tuple(traces),
                        "necessary_variable_domains":tuple((ref,tuple(sorted(values))) for ref,values in sorted(domains.items()))},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"output_ref":output,"model_index":model_index,"combination_index":combination_index,
                            "retained_local_preimages":tuple(preimages),"upstream_queue":tuple(queue)})
                count+=1;values=dict(zip(refs,_indexed_combination(local_domains,combination_index)))
                inputs=tuple(values[ref] for ref in component.ordered_input_refs);allowed=tables[model.model_ref].get(inputs)
                uncertain=allowed is None and not model.table_complete
                outputs=tuple(sorted(domains[output])) if uncertain else tuple(value for value in allowed or () if value in domains[output])
                if not outputs:continue
                preimages.append((model.model_ref,inputs,outputs,tuple((ref,values[ref]) for ref in refs),uncertain))
                for ref in refs:input_support[ref].add(values[ref])
                if uncertain:unknown_rows.append((model.model_ref,inputs,outputs))
        traces.append({"component_ref":component.component_ref,"output_ref":output,"requested_values":tuple(sorted(domains[output])),
            "ordered_input_refs":component.ordered_input_refs,"local_preimages":tuple(preimages),
            "shared_variable_refs":refs,"independent_duplicate_ports_created":False})
        for ref in refs:
            before=domains[ref];after=before&input_support[ref]
            if after!=before:
                domains[ref]=after
                if ref not in queued:queue.append(ref);queued.add(ref)
            elif ref in producers and ref not in {trace['output_ref'] for trace in traces} and ref not in queued:
                queue.append(ref);queued.add(ref)
    if count>=request.maximum_relation_checks:
        return family_result(request,values={"recursive_local_preimage_trace":tuple(traces)},examined_count=count,
            domain_complete=False,computation_bound_reached=True,frontier={"phase":"joint_model_validation"})
    # Necessary local margins are not a joint witness. Preserve model sharing by
    # validating the narrowed problem with the existing exact finite relation engine.
    if any(not domains[ref] for ref in sorted(domains)):
        return family_result(request,values={"recursive_local_preimage_trace":tuple(traces),"joint_assignment_domain":(),
            "contradiction_within_declared_domain":True if request.scope.input_domain_complete else None,
            "empty_variable_refs":tuple(ref for ref,values in sorted(domains.items()) if not values)},examined_count=count)
    narrowed=request.model_copy(update={"variables":tuple(v.model_copy(update={"values":tuple(sorted(domains[v.variable_ref]))}) for v in request.variables),
        "maximum_relation_checks":request.maximum_relation_checks-count})
    joint=_network_domain(narrowed,dict(request.fixed_values),request.requested_outputs,offset=0)
    result=_domain_result(request,joint,{"recursive_local_preimage_trace":tuple(traces),
        "necessary_variable_domains":tuple((ref,tuple(sorted(values))) for ref,values in sorted(domains.items())),
        "local_preimage_relation_checks":count,"unknown_rows_kept_revisable":tuple(unknown_rows),
        "shared_model_and_source_bindings_validated_jointly":True})
    return result.model_copy(update={"examined_count":joint['relation_checks']+count})


def _indexed_combination(domains,index):
    values=[]
    for domain in reversed(domains):index,digit=divmod(index,len(domain));values.append(domain[digit])
    return tuple(reversed(values))


def _network_domain(request,fixed,requirements=(),offset=None):
    variables=request.variables;domains=tuple((fixed[v.variable_ref],) if v.variable_ref in fixed else v.values for v in variables)
    scopes=tuple(dict.fromkeys(c.model_scope_ref for c in request.components))
    model_domains=tuple(tuple(m for m in request.models if m.model_scope_ref==scope) for scope in scopes)
    all_domains=domains+model_domains;total=1
    for domain in all_domains:total*=len(domain)
    start=request.domain_offset if offset is None else offset;states=[];count=0;checks=0;capped=False;next_index=start
    tables={m.model_ref:{row.inputs:row.outputs for row in m.rows} for m in request.models}
    for index in range(start,total):
        if count>=request.maximum_states or checks+len(request.components)>request.maximum_relation_checks:
            capped=True;next_index=index;break
        count+=1;combination=_indexed_combination(all_domains,index)
        values=dict(zip((v.variable_ref for v in variables),combination[:len(variables)]))
        if any(values[ref] not in allowed for ref,allowed in requirements):continue
        bound_models=dict(zip(scopes,combination[len(variables):]));unknown_rows={};valid=True
        for component in request.components:
            checks+=1;model=bound_models[component.model_scope_ref];inputs=tuple(values[r] for r in component.ordered_input_refs);output=values[component.output_ref]
            allowed=tables[model.model_ref].get(inputs)
            if allowed is not None:
                if output not in allowed:valid=False;break
            elif model.table_complete:valid=False;break
            else:
                row_key=(model.model_ref,inputs)
                if model.deterministic and row_key in unknown_rows and unknown_rows[row_key]!=output:valid=False;break
                unknown_rows[row_key]=output
        if valid:states.append({"assignment":tuple((v.variable_ref,values[v.variable_ref]) for v in variables),
            "model_refs":tuple(m.model_ref for m in combination[len(variables):]),
            "unknown_rows":tuple((model,inputs,value) for (model,inputs),value in sorted(unknown_rows.items()))})
    return {"states":tuple(states),"enumerated_assignments":count,"relation_checks":checks,
        "complete":not capped and start==0,"bounded":capped,
        "frontier":{"next_combination_index":next_index,"total_declared_combinations":total} if capped else {}}


def _domain_result(request,domain,extra=None):
    states=domain['states']
    variable_domains=tuple((variable.variable_ref,tuple(dict.fromkeys(dict(s['assignment'])[variable.variable_ref] for s in states))) for variable in request.variables)
    return family_result(request,values={"consistent_states":states,"value_domains":variable_domains,
        "contradiction_within_declared_domain":not states if domain['complete'] and request.scope.input_domain_complete else None,
        "unknown_relation_rows_present":any(s['unknown_rows'] for s in states),
        "relation_checks":domain['relation_checks'],**(extra or {})},examined_count=domain['enumerated_assignments'],
        domain_complete=domain['complete'],computation_bound_reached=domain['bounded'],frontier=domain['frontier'])


def _source_assignment(request):
    current=dict(request.assignment);sources=tuple(v.variable_ref for v in request.variables if v.source)
    if any(ref not in current for ref in sources):return None
    return {ref:current[ref] for ref in sources}


def _source_successor(request,source_ref):
    current=_source_assignment(request);edit=next((e for e in request.edits if e.source_ref==source_ref),None)
    if current is None or edit is None or current.get(source_ref) not in edit.cycle:return None,None
    successor=dict(current);successor[source_ref]=edit.cycle[(edit.cycle.index(current[source_ref])+1)%len(edit.cycle)]
    return successor,edit


def _affine_guard(request):
    if request.binary_values is None or request.binary_values[0]==request.binary_values[1]:return family_result(request,prerequisite_refs=("declared_binary_difference_algebra",),domain_complete=False)
    sources=tuple(v.variable_ref for v in request.variables if v.source);outputs=tuple(ref for ref,_ in request.requested_outputs)
    if not outputs or any(set(v.values)!=set(request.binary_values) for v in request.variables):return family_result(request,prerequisite_refs=("complete_binary_input_output_domains",),domain_complete=False)
    domain=_network_domain(request,{});by_source={};ambiguous=[]
    for state in domain['states']:
        assignment=dict(state['assignment']);key=tuple(assignment[ref] for ref in sources);value=tuple(assignment[ref] for ref in outputs)
        if key in by_source and by_source[key]!=value:ambiguous.append((key,by_source[key],value))
        else:by_source[key]=value
    expected=2**len(sources);complete=domain['complete'] and len(by_source)==expected and not ambiguous
    counterexample=None;columns=[]
    if complete:
        for rank,source in enumerate(sources):
            reference=None
            for before,output in sorted(by_source.items()):
                after=before[:rank]+(request.binary_values[1] if before[rank]==request.binary_values[0] else request.binary_values[0],)+before[rank+1:]
                delta=tuple(a!=b for a,b in zip(output,by_source[after]))
                if reference is None:reference=delta
                elif delta!=reference and counterexample is None:counterexample=(source,before,after,reference,delta)
            columns.append((source,reference))
    unknown=any(state['unknown_rows'] for state in domain['states'])
    proved=complete and not counterexample and not unknown and request.scope.input_domain_complete
    return _domain_result(request,domain,{"affine_proved_over_declared_domain":proved,"difference_columns":tuple(columns),
        "counterexample":counterexample,"ambiguous_outputs":tuple(ambiguous),"complete_relevant_binary_domain":complete,
        'effect_law_unknown_rows_present':unknown,'morphological_gate_name_proves_algebra':False})


def _compile_assignment(request):
    current=_source_assignment(request);target=dict(request.bound_assignment)
    sources={v.variable_ref for v in request.variables if v.source}
    if current is None or not set(target)<=sources or not set(target)<=set(request.declared_edit_order):
        return family_result(request,prerequisite_refs=("bound_source_assignment_and_covering_edit_order",),domain_complete=False)
    word=[];cost=0;checks=0;enumerated=0
    def boundary(prerequisite,frontier=None):
        return family_result(request,values={"grounded_prefix":tuple(word),"primitive_cost":cost,
            "predicted_source_values":tuple(current.items()),"relation_checks":checks},
            prerequisite_refs=(prerequisite,),domain_complete=False,
            computation_bound_reached=bool(frontier),frontier=frontier)
    for source in request.declared_edit_order:
        if source not in target:continue
        edit=next((e for e in request.edits if e.source_ref==source),None)
        if current[source]==target[source]:continue
        if edit is None or current[source] not in edit.cycle or target[source] not in edit.cycle:return boundary("complete_edit_cycle_for_bound_target")
        while current[source]!=target[source]:
            if cost+edit.primitive_cost>request.remaining_input_budget:return boundary("remaining_input_budget")
            if enumerated>=request.maximum_states or checks+len(request.components)>request.maximum_relation_checks:
                return boundary("remaining_relation_computation",{"next_source_ref":source})
            after=dict(current);after[source]=edit.cycle[(edit.cycle.index(current[source])+1)%len(edit.cycle)]
            scoped=request.model_copy(update={"maximum_states":request.maximum_states-enumerated,
                "maximum_relation_checks":request.maximum_relation_checks-checks})
            domain=_network_domain(scoped,after,offset=0);checks+=domain['relation_checks'];enumerated+=domain['enumerated_assignments']
            if not domain['complete']:return boundary("complete_intermediate_relation_domain",domain['frontier'])
            if not domain['states']:return boundary("consistent_intermediate_network")
            if any(dict(state['assignment'])[ref] not in allowed for state in domain['states'] for ref,allowed in request.intermediate_constraints):
                return boundary("declared_intermediate_preservation_constraints")
            # Preservation comes only from caller-bound constraints, never a lit display.
            word.append(edit);cost+=edit.primitive_cost;current=after
            if edit.relayout_after_edit:return boundary("current_input_payload_after_relayout")
    if enumerated>=request.maximum_states or checks+len(request.components)>request.maximum_relation_checks:
        return boundary("complete_final_relation_domain",{"source_values":tuple(current.items())})
    scoped=request.model_copy(update={"maximum_states":request.maximum_states-enumerated,
        "maximum_relation_checks":request.maximum_relation_checks-checks})
    final=_network_domain(scoped,current,offset=0);checks+=final['relation_checks'];enumerated+=final['enumerated_assignments']
    if not final['complete']:return boundary("complete_final_relation_domain",final['frontier'])
    conjunction=bool(final['states']) and all(dict(state['assignment'])[ref] in allowed
        for state in final['states'] for ref,allowed in request.requested_outputs)
    return family_result(request,values={"grounded_prefix":tuple(word),"primitive_cost":cost,
        "predicted_source_values":tuple(current.items()),"final_states":final['states'],
        "final_conjunction_under_declared_models":conjunction,"final_conjunction_qualified":conjunction and request.scope.input_domain_complete,
        "relation_checks":checks,"preservation_constraints":request.intermediate_constraints,
        "temporary_outputs_automatically_latched":False},examined_count=enumerated)


def _calculate(request):
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    required={"ports_and_wires":("raw_layer_pixels","layer_templates","wire_models"),"relation_samples":("samples",),"network_successor":("assignment","source_ref","edits","requested_outputs","remaining_input_budget"),
        "backward_output_constraints":("requested_outputs",),"common_assignment":("requested_outputs",),
        "relation_discrimination":("assignment","edits","decision_relevant_component_refs","remaining_input_budget"),"affine_guard":("binary_values","requested_outputs"),
        "assignment_compilation":("assignment","bound_assignment","declared_edit_order","edits","intermediate_constraints","requested_outputs","remaining_input_budget"),
        "relation_compare_transfer":("expected_assignment","actual_assignment","samples","observed_components","acceptance_observed","expected_acceptance")}
    missing=missing_supplied_fields(request,required.get(request.operation_ref,()))
    if request.operation_ref=='assignment_compilation' and request.intermediate_preservation_declared is True:
        missing=tuple(ref for ref in missing if ref!='intermediate_constraints')
    if request.operation_ref not in ("ports_and_wires","relation_samples"):
        missing+=missing_supplied_fields(request,("variables","components","models"))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=="ports_and_wires":return _ports_and_wires(request)
    if op=="relation_samples":
        if not request.samples:return family_result(request,prerequisite_refs=("observed_complete_relation_samples",),domain_complete=False)
        rows={}
        for sample in request.samples:rows.setdefault((sample.signature_ref,sample.context_ref,sample.arity,sample.inputs),[]).append((sample.output_ref,sample.evidence_ref))
        return family_result(request,values={"partial_relations":tuple((signature,context,arity,inputs,tuple(values)) for (signature,context,arity,inputs),values in sorted(rows.items())),
            "unchanged_output_proves_source_irrelevant":False},examined_count=len(request.samples))
    if op=="backward_output_constraints":return _backward_output_constraints(request)
    if op in ("relation_propagation","common_assignment"):
        constraints=request.requested_outputs if op!="relation_propagation" else ()
        fixed=dict(request.fixed_values)
        if op=="relation_propagation":
            for ref,value in request.assignment:
                if ref in fixed and fixed[ref]!=value:return family_result(request,prerequisite_refs=("consistent_fixed_and_current_assignments",),domain_complete=False)
                fixed[ref]=value
        domain=_network_domain(request,fixed,constraints)
        return _domain_result(request,domain,{"requested_output_constraints":constraints,"shared_variables_preserved":True,
            "declared_constraint_core":constraints if domain['complete'] and request.scope.input_domain_complete and not domain['states'] else (),
            "minimal_core_proved":False})
    if op=="network_successor":
        successor,edit=_source_successor(request,request.source_ref)
        if successor is None:return family_result(request,prerequisite_refs=("complete_source_assignment_and_bound_edit_law",),domain_complete=False)
        if edit.primitive_cost>request.remaining_input_budget:return family_result(request,prerequisite_refs=("remaining_input_budget",),domain_complete=False)
        domain=_network_domain(request,successor,offset=0)
        effects=tuple({"state":state,"output_conjunction":all(dict(state['assignment'])[ref] in allowed for ref,allowed in request.requested_outputs)} for state in domain['states'])
        return _domain_result(request,domain,{"source_successor":tuple(successor.items()),"conditional_effects":effects,
            "evaluation_checkpoint":"after_declared_network_propagation","external_primitive_count":1,
            "remaining_input_budget":request.remaining_input_budget-edit.primitive_cost})
    if op=="affine_guard":return _affine_guard(request)
    if op=="relation_discrimination":
        candidates=[];remaining=request.maximum_relation_checks;remaining_states=request.maximum_states;bounded=False;reverse_witnesses=[]
        relevant=tuple(c for c in request.components if c.component_ref in request.decision_relevant_component_refs)
        for edit in request.edits:
            successor,_=_source_successor(request,edit.source_ref)
            if successor is None:continue
            if remaining<len(request.components) or remaining_states<=0:bounded=True;break
            scoped=request.model_copy(update={"maximum_relation_checks":remaining,"maximum_states":remaining_states})
            domain=_network_domain(scoped,successor,offset=0);remaining-=domain['relation_checks'];remaining_states-=domain['enumerated_assignments'];bounded|=domain['bounded']
            local=[]
            for component in relevant:
                models=tuple(m for m in request.models if m.model_scope_ref==component.model_scope_ref)
                projection_work=4*len(models)*sum(len(state['assignment'])+len(state['unknown_rows'])+1 for state in domain['states'])
                projection_work+=sum(len(model.rows) for model in models)+len(models)*len(models)*max(1,len(domain['states']))
                if projection_work>remaining:bounded=True;break
                remaining-=projection_work
                responses=tuple((model.model_ref,tuple(sorted(set(
                    (tuple(dict(state['assignment'])[ref] for ref in component.ordered_input_refs),dict(state['assignment'])[component.output_ref])
                    for state in domain['states'] if model.model_ref in state['model_refs'])))) for model in models)
                distinctions=tuple((left,left_values,right,right_values)
                    for rank,(left,left_values) in enumerate(responses) for right,right_values in responses[rank+1:]
                    if left_values!=right_values)
                unknown=[]
                for model in models:
                    known={row.inputs for row in model.rows}
                    input_tuples=tuple(sorted(set(tuple(dict(state['assignment'])[ref] for ref in component.ordered_input_refs)
                        for state in domain['states'] if model.model_ref in state['model_refs'])))
                    for inputs in input_tuples:
                        if inputs not in known and not model.table_complete:
                            unknown.append((model.model_ref,inputs))
                local.append({"component_ref":component.component_ref,"model_response_sets":responses,
                    'decision_relevant_unknown_rows':tuple(unknown),'learned_rows_discarded':False,
                    "observable_differences":distinctions,"domain_complete":domain['complete']})
            if bounded:break
            candidates.append({"source_ref":edit.source_ref,"predictions":domain['states'],"local_tuple_partitions":tuple(local),
                "distinguishes_declared_relevant_models":any(item['observable_differences'] for item in local) and domain['complete'] and request.scope.input_domain_complete,
                "reverse_cycle_primitives":len(edit.cycle)-1,"law_ref":edit.source_ref,
                "round_trip_primitive_cost":edit.primitive_cost*len(edit.cycle),
                "round_trip_budget_sufficient":edit.primitive_cost*len(edit.cycle)<=request.remaining_input_budget,
                "reverse_payload_observation_required":edit.relayout_after_edit})
            if not edit.relayout_after_edit and len(reverse_witnesses)<3:
                reverse_witnesses.append({'source_ref':edit.source_ref,'grounded_reverse_word':(edit,)*(len(edit.cycle)-1)})
        return family_result(request,values={"experiment_candidates":tuple(candidates),
            'reverse_witnesses':tuple(reverse_witnesses),"relation_checks":request.maximum_relation_checks-remaining},
            domain_complete=not bounded,computation_bound_reached=bounded,frontier={"processed_sources":len(candidates)} if bounded else {})
    if op=="assignment_compilation":
        return _compile_assignment(request)
    expected,actual=dict(request.expected_assignment),dict(request.actual_assignment)
    changed=tuple((ref,expected.get(ref),actual.get(ref)) for ref in sorted(set(expected)|set(actual)) if expected.get(ref)!=actual.get(ref))
    rows=tuple((s.signature_ref,s.context_ref,s.arity,s.inputs,s.output_ref,s.appearance_ref,s.evidence_ref) for s in request.samples)
    expected_components={c.component_ref:c for c in request.components};actual_components={c.component_ref:c for c in request.observed_components}
    topology=tuple((ref,expected_components.get(ref),actual_components.get(ref)) for ref in sorted(set(expected_components)|set(actual_components))
        if expected_components.get(ref)!=actual_components.get(ref))
    truth=[]
    for sample in request.samples:
        models=tuple(m for m in request.models if (m.signature_ref,m.context_ref,m.arity)==(sample.signature_ref,sample.context_ref,sample.arity))
        for model in models:
            row=next((row for row in model.rows if row.inputs==sample.inputs),None)
            if (row is not None and sample.output_ref not in row.outputs) or (row is None and model.table_complete):truth.append((sample.evidence_ref,model.model_ref,sample.inputs,sample.output_ref))
    acceptance=(request.expected_acceptance,request.acceptance_observed) if request.expected_acceptance!=request.acceptance_observed else None
    first=("topology",topology[0]) if topology else (("truth_row",truth[0]) if truth else (("propagation",changed[0]) if changed else (("acceptance",acceptance) if acceptance else None)))
    return family_result(request,values={"assignment_contradictions":changed,"topology_contradictions":topology,
        "truth_row_model_contradictions":tuple(truth),"acceptance_contradiction":acceptance,"first_divergence":first,
        "portable_appearance_behavior_samples":rows,"acceptance_observed":request.acceptance_observed,
        "graph_coordinates_transferred":False},examined_count=len(changed)+len(rows))


def measure_finite_relation_network(request: FiniteRelationRequest) -> MechanicalFamilyResult:
    return _calculate(request)
