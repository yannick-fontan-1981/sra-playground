"""Exact full-model DOMAIN projections for Source-declared retained bindings."""
from collections.abc import Mapping
from agents.yf_arc3_v5.logos.types import FrozenMap
from .guarded_transport import route_domain


def retained_route_domains(request, primary, project_domain=route_domain):
    rows=[(request,primary)]
    if not request.model_alternatives:
        return tuple(rows), ()
    bindings=request.data.get('k09_retained_model_bindings')
    if not isinstance(bindings,(tuple,list)) or len(bindings)!=len(request.model_alternatives):
        return (), ('data.k09_retained_model_bindings.complete_population',)
    if len(bindings)+1>128:
        return (), ('data.k09_retained_model_bindings.provider_capacity',)
    by_index={}; refs={request.model_ref}; missing=[]
    for binding in bindings:
        if not isinstance(binding,Mapping):
            missing.append('data.k09_retained_model_bindings.typed_binding');continue
        index=binding.get('model_index'); ref=binding.get('model_ref'); state=binding.get('initial_state')
        if type(index) is not int or not 0<=index<len(request.model_alternatives) or index in by_index:
            missing.append('data.k09_retained_model_bindings.exact_unique_index');continue
        if not isinstance(ref,str) or not ref or ref in refs or not isinstance(state,Mapping):
            missing.append('data.k09_retained_model_bindings.unique_ref_and_full_state');continue
        by_index[index]=binding;refs.add(ref)
    if len(by_index)!=len(request.model_alternatives):
        missing.append('data.k09_retained_model_bindings.complete_population')
    if missing:return (),tuple(dict.fromkeys(missing))
    for index,model in enumerate(request.model_alternatives):
        binding=by_index[index]
        bound=request.model_copy(update={'model_ref':binding['model_ref'],
            'model':model,'state':FrozenMap(binding['initial_state']),'model_alternatives':()})
        projected=project_domain(bound)
        descriptor=projected.values.get('search_ready_descriptor')
        missing.extend(projected.missing_refs)
        if descriptor is None:
            missing.append('retained_model.'+binding['model_ref']+'.search_ready_descriptor');continue
        missing.extend(descriptor['unresolved_dependencies'])
        # A common deterministic word has one declared primitive payload/cost
        # and one terminal contract. Incompatible contracts require Source input.
        for field in ('primitive_domain','input_costs','goal_contract'):
            if descriptor[field]!=primary[field]:
                missing.append('retained_model.'+binding['model_ref']+'.common_'+field)
        rows.append((bound,descriptor))
    return tuple(rows),tuple(dict.fromkeys(missing))
