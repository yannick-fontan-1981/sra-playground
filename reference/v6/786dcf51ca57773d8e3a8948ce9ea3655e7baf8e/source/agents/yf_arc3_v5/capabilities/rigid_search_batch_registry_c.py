"""Source-owned fixed-model math batches, not additional STEP/search engines."""
from .rigid_search_batch_c import (RigidSearchBatchInputC,RigidSearchBatchPreparedC,
    RigidSearchBatchMeasuredC,RigidSearchBatchFinishC,RigidSearchBatchDispatchC,RigidSearchBatchReadC,
    prepare_rigid_search_batch,calculate_rigid_search_batch,finish_rigid_search_batch,
    read_rigid_search_batch_session,SearchDriverSessionC)
from .rigid_search_batch_c import (RigidSearchBatchLegacyInputC,RigidSearchBatchLegacyFlagC,
    transport_rigid_search_batch_flag)

RIGID_SEARCH_BATCH_ENTRIES_C = (
    ('capability.rigid_search_batch_legacy_flag_c',transport_rigid_search_batch_flag,RigidSearchBatchLegacyInputC,RigidSearchBatchLegacyFlagC),
    ('capability.rigid_search_batch_prepare_c',prepare_rigid_search_batch,RigidSearchBatchInputC,RigidSearchBatchPreparedC),
    ('capability.rigid_search_batch_math_c',calculate_rigid_search_batch,RigidSearchBatchPreparedC,RigidSearchBatchMeasuredC),
    ('capability.rigid_search_batch_finish_c',finish_rigid_search_batch,RigidSearchBatchFinishC,RigidSearchBatchDispatchC),
    ('capability.rigid_search_batch_session_c',read_rigid_search_batch_session,RigidSearchBatchReadC,SearchDriverSessionC),
)
RIGID_SEARCH_BATCH_TYPES_C = tuple(sorted({model.__name__ for _,_,before,after in RIGID_SEARCH_BATCH_ENTRIES_C
    for model in (before,after)}))


def rigid_search_batch_entries_c(factory):
    return tuple(factory(capability_id=ref,implementation=implementation,input_model=before,output_model=after,
        source_file='rigid_search_batch_c.py',applicability=('source_admitted_fixed_deterministic_rigid_model',),
        invariants=('existing_d_math_and_c_projection','each_state_rebound_and_revalidated',
            'source_adopts_the_aggregate','no_per_node_reasoning_context','no_search_or_action_release'),
        falsifiers=('stale_scope_or_bindings','incomplete_native_boundary','actual_row_or_native_work_bound'))
        for ref,implementation,before,after in RIGID_SEARCH_BATCH_ENTRIES_C)


def rigid_search_batch_signatures_c(type_spec,parameter_spec):
    def p(name,kind,optional=False):
        return parameter_spec(name=name,type_spec=type_spec(kind,optional=optional))
    signatures = {ref:((p('request',before.__name__),),after.__name__)
        for ref,_,before,after in RIGID_SEARCH_BATCH_ENTRIES_C}
    signatures['capability.rigid_search_batch_prepare_c'] = ((p('session','SearchDriverSessionC'),
        p('maximum_rows','Integer'),p('maximum_native_nodes','Integer')),'RigidSearchBatchPreparedC')
    signatures['capability.rigid_search_batch_legacy_flag_c'] = ((p('batch_flag','Boolean'),
        p('dispatched','RigidSearchBatchDispatchC',True)),'RigidSearchBatchLegacyFlagC')
    signatures['capability.rigid_search_batch_session_c'] = ((p('dispatched','RigidSearchBatchDispatchC',True),),'SearchDriverSessionC')
    signatures['capability.rigid_search_batch_finish_c'] = ((p('prepared','RigidSearchBatchPreparedC'),
        p('measured','RigidSearchBatchMeasuredC',True),p('source_append','Boolean'),p('used_batch','Boolean'),
        p('source_status','String'),p('missing_cause','String',True)),'RigidSearchBatchDispatchC')
    return signatures
