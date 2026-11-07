"""Bounded natural join of caller-declared, correlated family candidates.

No family, goal, resource law or action is selected here. Shared keys are exact
constraints; distinct keys remain independent. Every source candidate survives
inside its joined row, including its normalized mechanical result and scope.
"""
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, require_unique
from agents.yf_arc3_v5.capabilities.mechanical_request_contracts import MechanicalNormalizedReturn
from agents.yf_arc3_v5.capabilities.mechanical_transport_b import candidate_payload


class FamilyJoinCandidate(FrozenModel):
    candidate_ref: Ref
    result: MechanicalNormalizedReturn
    dependency_revisions: FrozenMap
    assignments: FrozenMap
    resource_provenance: FrozenMap
    rationale: FrozenMap
    preservation_refs: tuple[Ref,...] = Field(default=(),max_length=128)

    @model_validator(mode='after')
    def retain_declared_meaning(self):
        if any(len(value)>256 for value in (self.dependency_revisions,self.assignments,self.resource_provenance,self.rationale)):
            raise ValueError('family candidate maps exceed their declared bound')
        required=('usefulness_premise_refs','morphology_premise_refs','consumer_ref','desired_predicate',
            'and_dependency_refs','or_dependency_refs','temporal_scope_ref','evidence_status','falsifier_ref')
        if any(field not in self.rationale for field in required):
            raise ValueError('family candidate is missing its declared rationale or scope')
        return self


class FamilyJoinGroup(FrozenModel):
    group_ref: Ref
    candidates: tuple[FamilyJoinCandidate,...] = Field(max_length=128)
    domain_complete: bool


class FamilyJoinRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.family_join_request.v1'
    request_ref: Ref
    parent_goal_ref: Ref
    episode_ref: Ref
    level_scope_ref: Ref
    epoch: int = Field(ge=0)
    groups: tuple[FamilyJoinGroup,...] = Field(min_length=1,max_length=128)
    max_pairs: int = Field(ge=0,le=65536)
    max_candidates: int = Field(ge=0,le=4096)

    @model_validator(mode='after')
    def exact_scope(self):
        require_unique(tuple(g.group_ref for g in self.groups),'family join groups')
        rows=tuple(c for g in self.groups for c in g.candidates)
        if len(rows)>256:raise ValueError('family join input exceeds explicit candidate bound')
        require_unique(tuple(c.candidate_ref for c in rows),'family join candidates')
        for row in rows:
            if row.result.status!='FOUND':
                raise ValueError('only returned descriptive candidates participate in a join')
            if row.result.request.epoch!=self.epoch:
                raise ValueError('family join crosses an epoch')
            if row.rationale.get('episode_ref')!=self.episode_ref or row.rationale.get('level_scope_ref')!=self.level_scope_ref:
                raise ValueError('family join crosses an episode or level scope')
            if row.rationale.get('parent_goal_ref')!=self.parent_goal_ref:
                raise ValueError('family join changes its upstream goal')
        return self


class FamilyJoinResult(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.family_join_result.v1'
    request: FamilyJoinRequest
    candidates: tuple[FrozenMap,...] = Field(max_length=4096)
    conflicts: tuple[FrozenMap,...] = Field(max_length=256)
    examined_pairs: int
    computation_complete: bool
    input_domains_complete: bool
    joint_descriptive_candidate_exists: bool
    empty_complete_join: bool
    frontier: FrozenMap
    executable_authority: None = None


def join_family_results(request: FamilyJoinRequest):
    partial=(FrozenMap({'members':(), 'dependency_revisions':FrozenMap(),
        'assignments':FrozenMap(),'resource_provenance':FrozenMap(),'preservation_refs':()}),)
    examined=0;conflicts=[];domains_complete=all(g.domain_complete for g in request.groups)
    for group_index,group in enumerate(request.groups):
        joined=[]
        for left_index,left in enumerate(partial):
            for right_index,right in enumerate(group.candidates):
                if examined>=request.max_pairs or len(joined)>=request.max_candidates:
                    return FamilyJoinResult(request=request,candidates=tuple(joined),conflicts=tuple(conflicts),
                        examined_pairs=examined,computation_complete=False,input_domains_complete=domains_complete,
                        joint_descriptive_candidate_exists=False,empty_complete_join=False,
                        frontier=FrozenMap({'group_index':group_index,'left_index':left_index,'right_index':right_index,
                            'prior_candidates':partial,'completed_prefix':tuple(joined),
                            'stop_ref':'bound.pairs' if examined>=request.max_pairs else 'bound.candidates'}))
                examined+=1;merged={};conflict=None
                for namespace in ('dependency_revisions','assignments','resource_provenance'):
                    lhs=left[namespace];rhs=getattr(right,namespace)
                    shared=tuple(sorted(set(lhs)&set(rhs)))
                    mismatch=tuple(k for k in shared if lhs[k]!=rhs[k])
                    if mismatch:
                        conflict=FrozenMap({'group_ref':group.group_ref,'left_members':tuple(c['candidate_ref'] for c in left['members']),
                            'right_candidate_ref':right.candidate_ref,'namespace':namespace,'keys':mismatch})
                        break
                    merged[namespace]=FrozenMap({**lhs,**rhs})
                if conflict is not None:
                    if len(conflicts)<256:conflicts.append(conflict)
                    continue
                joined.append(FrozenMap({**merged,'members':left['members']+(candidate_payload(right),),
                    'preservation_refs':tuple(sorted(set(left['preservation_refs'])|set(right.preservation_refs)))}))
        partial=tuple(joined)
        if not partial:break
    # Empty or truncated inputs do not establish impossibility. Nonempty joined
    # rows are joint descriptive candidates, never an executable action lease.
    return FamilyJoinResult(request=request,candidates=partial,conflicts=tuple(conflicts),
        examined_pairs=examined,computation_complete=True,input_domains_complete=domains_complete,
        joint_descriptive_candidate_exists=bool(partial),empty_complete_join=not partial and domains_complete,
        frontier=FrozenMap())
