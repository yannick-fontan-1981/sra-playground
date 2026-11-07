"""Exact caller-declared operator receiver coverage, separate from propagation."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_articulated_operator_scopes(request):
    native=request.native_request
    steps=(*((native.step,) if native.step is not None else ()),
        *(step for candidate in native.candidates for step in candidate.operator_word))
    if len(steps)>4096: return (), ("articulated.operator_scope_work_bound",)
    declarations={item.input_ref:item for item in request.operator_scopes}
    if len(declarations)!=len(request.operator_scopes):
        return (), ("articulated.unique_operator_scope_population",)
    if set(declarations)!={step.input_ref for step in steps}:
        return (), ("articulated.complete_operator_scope_population",)
    reasons,missing=[],[]
    for step in steps:
        declared=declarations[step.input_ref]
        bodies={body.body_ref:body for body in step.before_bodies}
        direct={operation.receiver_ref for operation in step.operations}
        control_support={relation.support_claim_ref for relation in request.relations
            if relation.kind=="CONTROL_CHANNEL" and relation.origin_ref==step.channel_ref
            and relation.destination_ref in direct}
        if not control_support or not control_support<=set(declared.support_claim_refs):
            missing.append("articulated.scope_uses_current_actual_control_relations")
        if (len(set(declared.direct_receiver_refs))!=len(declared.direct_receiver_refs)
                or direct!=set(declared.direct_receiver_refs) or not direct<=set(bodies)):
            missing.append("articulated.exact_direct_receiver_population");continue
        if declared.kind=="SHARED_CHANNEL":
            expected={body.body_ref for body in step.before_bodies if step.channel_ref in body.channel_refs}
            if declared.root_body_ref is not None or direct!=expected:
                missing.append("articulated.channel_edit_includes_every_grounded_receiver")
        else:
            if declared.root_body_ref not in bodies or direct!={declared.root_body_ref}:
                missing.append("articulated.rooted_rotation_has_only_its_direct_root")
        descendants=set(direct)
        # Forest depth is at most the existing native body bound. This traverses
        # attachment membership only; K24 owns frame transforms and collisions.
        for _ in range(len(bodies)):
            expanded=descendants|{body.body_ref for body in step.before_bodies if body.parent_ref in descendants}
            if expanded==descendants:break
            descendants=expanded
        propagated=descendants-direct
        needed_attachments={relation.support_claim_ref for relation in request.relations
            if relation.kind=="DIRECTED_ATTACHMENT" and relation.destination_ref in propagated}
        if not needed_attachments<=set(declared.support_claim_refs):
            missing.append("articulated.scope_uses_current_actual_attachment_relations")
        if (len(set(declared.propagated_body_refs))!=len(declared.propagated_body_refs)
                or propagated!=set(declared.propagated_body_refs)):
            missing.append("articulated.exact_directed_descendant_propagation")
        available={body.body_ref for body in step.before_bodies if step.channel_ref in body.channel_refs}
        if not direct<=available:
            missing.append("articulated.no_independent_edit_without_available_control")
        reasons.append(FrozenMap({"input_ref":step.input_ref,"operator_scope_kind":declared.kind,
            "direct_receivers":tuple(sorted(direct)),"propagated_descendants":tuple(sorted(propagated)),
            "unrelated_same_channel_bodies":tuple(sorted(available-descendants)),
            "passive_descendants_keep_owned_collision_masks":True,
            "local_root_motion_is_not_independent_control":True}))
    return tuple(reasons),tuple(sorted(set(missing)))
