"""Finite drop-board calculations; the caller declares models and search bounds.

No color, board size, game identifier, opponent preference or goal is inferred.
STEP applies one player transaction. DOMAIN exposes OR/AND alternatives and
does not choose a move, use an evaluation score, or release an action.
"""
from __future__ import annotations

from collections import deque
from itertools import product
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .mechanical_family_contracts_a import MechanicalFamilyResult, MechanicalFamilyScope, family_result, missing_supplied_fields


class DropBoard(FrozenModel):
    board_ref: Ref
    cells: tuple[tuple[Ref | None, ...], ...] = Field(min_length=1, max_length=16)
    immutable_cells: tuple[tuple[int, int], ...] = Field(default=(), max_length=256)
    panel_ref: Ref
    @model_validator(mode="after")
    def rectangular(self):
        width=len(self.cells[0])
        if not 1 <= width <= 16 or any(len(row)!=width for row in self.cells):
            raise ValueError("drop board must be a bounded rectangle")
        if len(set(self.immutable_cells))!=len(self.immutable_cells):
            raise ValueError("immutable supports must be unique")
        if any(not (0<=r<len(self.cells) and 0<=c<width) for r,c in self.immutable_cells):
            raise ValueError("support outside supplied board")
        return self


class DropObservation(FrozenModel):
    evidence_ref: Ref
    before: DropBoard
    after: DropBoard
    column: int = Field(ge=0, le=15)
    owner_ref: Ref
    settled_row: int | None = Field(default=None, ge=0, le=15)
    retained: bool
    click_point: tuple[int,int] | None = None
    clicked_panel_ref: Ref | None = None
    sealed: bool = False
    animation: tuple["DropAnimation",...] = Field(default=(),max_length=256)


class DropAnimation(FrozenModel):
    evidence_ref: Ref
    sequence_index: int = Field(ge=0)
    panel_ref: Ref
    owner_ref: Ref
    row: int = Field(ge=0,le=15)
    column: int = Field(ge=0,le=15)
    phase: Literal["FALLING","SETTLED","REMOVED","REJECTED"]


class DropCellGlyph(FrozenModel):
    row: int = Field(ge=0,le=15)
    column: int = Field(ge=0,le=15)
    template_ref: Ref
    owner_ref: Ref | None
    immutable: bool


class DropBoardRasterModel(FrozenModel):
    model_ref: Ref
    board_ref: Ref
    panel_ref: Ref
    bottom_template_ref: Ref
    row_positions: tuple[int,...] = Field(min_length=1,max_length=16)
    column_positions: tuple[int,...] = Field(min_length=1,max_length=16)
    glyphs: tuple[DropCellGlyph,...] = Field(max_length=1024)
    playable_columns: tuple[int,...] = Field(max_length=16)
    gravity_models: tuple[Literal["TOP","BOTTOM"],...] = Field(min_length=1,max_length=2)
    @model_validator(mode="after")
    def lattice(self):
        if len(set(self.row_positions))!=len(self.row_positions) or len(set(self.column_positions))!=len(self.column_positions):raise ValueError("board row and column positions are unique")
        if any(g.row>=len(self.row_positions) or g.column>=len(self.column_positions) for g in self.glyphs):raise ValueError("glyph belongs to the measured board lattice")
        if len(set(self.playable_columns))!=len(self.playable_columns) or any(c<0 or c>=len(self.column_positions) for c in self.playable_columns):raise ValueError("playable column domain is explicit and bounded")
        return self


class DropClickMap(FrozenModel):
    model_ref: Ref
    panel_ref: Ref
    active_bounds: tuple[int,int,int,int]
    column_bands: tuple[tuple[int,int,int],...] = Field(min_length=1,max_length=16)
    @model_validator(mode="after")
    def bounds(self):
        x0,y0,x1,y1=self.active_bounds
        if x0>x1 or y0>y1 or any(c<0 or c>15 or left>right for c,left,right in self.column_bands):raise ValueError("click domains have ordered physical bounds")
        return self


class DropResponsePolicy(FrozenModel):
    policy_ref: Ref
    columns: tuple[int,...] = Field(max_length=16)
    priority: tuple[Literal["IMMEDIATE_WIN","IMMEDIATE_BLOCK","DECLARED_LEGAL"],...] = Field(min_length=1,max_length=3)
    choice_mode: Literal["FIRST_DECLARED","ANY","STOCHASTIC"]
    column_weights: tuple[tuple[int,int],...] = Field(default=(),max_length=16)
    @model_validator(mode="after")
    def domain(self):
        if len(set(self.columns))!=len(self.columns) or any(c<0 or c>15 for c in self.columns):raise ValueError("response columns retain unique declared identities")
        if len(set(self.priority))!=len(self.priority):raise ValueError("response priority stages are unique")
        if any(c not in self.columns or weight<0 for c,weight in self.column_weights) or len({c for c,_ in self.column_weights})!=len(self.column_weights):raise ValueError("stochastic weights bind declared columns once")
        if self.choice_mode=="STOCHASTIC" and (set(c for c,_ in self.column_weights)!=set(self.columns) or not any(w>0 for _,w in self.column_weights)):raise ValueError("stochastic policy declares its complete finite support")
        return self


class DropTransactionEvent(FrozenModel):
    occurrence_ref: Ref
    primitive_ref: Ref
    event_owner_ref: Ref
    kind: Literal["PLAYER_DROP","OPPONENT_REPLY","TUTORIAL_REFUSAL","REMOVAL","DRAW","LOSS","RESTORE","PANEL_ACCEPTED"]
    actor_ref: Ref | None
    panel_ref: Ref
    before: DropBoard
    after: DropBoard
    restore_epoch_before: int = Field(ge=0)
    restore_epoch_after: int = Field(ge=0)
    authoritative_status: Literal["ACTIVE","WIN","GAME_OVER"]


class DropTransactionComparison(FrozenModel):
    packet_ref: Ref
    sealed: bool
    primitive_ref: Ref
    expected_events: tuple[DropTransactionEvent,...] = Field(max_length=256)
    observed_events: tuple[DropTransactionEvent,...] = Field(max_length=256)


class DropLaw(FrozenModel):
    law_ref: Ref
    gravity: Literal["BOTTOM", "TOP"]
    retained: bool
    full_column_rejected: bool


class OpponentRestriction(FrozenModel):
    policy_ref: Ref
    columns: tuple[int, ...] = Field(max_length=16)
    deterministic_first: bool


class DropOutcomeLaw(FrozenModel):
    law_ref: Ref
    accepted_panel_ref: Ref
    simultaneous_priority: Literal["PLAYER", "OPPONENT"]
    opponent_win_outcome: Literal["STOP", "RESTORE"]
    draw_outcome: Literal["STOP", "RESTORE"]
    restored_board: DropBoard | None = None
    @model_validator(mode="after")
    def restoration_binding(self):
        if "RESTORE" in (self.opponent_win_outcome,self.draw_outcome) and self.restored_board is None:
            raise ValueError("a restore law needs its exact supplied restored board")
        return self


class AdversarialDropRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.adversarial_drop_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    board: DropBoard | None = None
    player_ref: Ref | None = None
    opponent_ref: Ref | None = None
    gravity: Literal["BOTTOM", "TOP"] | None = None
    alignment_length: int | None = Field(default=None,ge=1, le=16)
    directions: tuple[tuple[int,int], ...] | None = Field(default=None,max_length=8)
    column_order: tuple[int, ...] | None = Field(default=None,max_length=16)
    opponent_columns: tuple[int, ...] | None = Field(default=None,max_length=16)
    opponent_domain_complete: bool | None = None
    player_column: int | None = Field(default=None, ge=0, le=15)
    # Acceptance ordering and retained/removed placements are explicit model inputs.
    acceptance_checkpoint: Literal["AFTER_PLAYER", "AFTER_REPLY"] | None = None
    retained_placement: bool | None = None
    competitive_mode: bool | None = None
    outcome_law: DropOutcomeLaw | None = None
    observations: tuple[DropObservation,...] = Field(default=(), max_length=64)
    law_alternatives: tuple[DropLaw,...] = Field(default=(), max_length=16)
    opponent_restrictions: tuple[OpponentRestriction,...] = Field(default=(), max_length=32)
    actual_board: DropBoard | None = None
    expected_board: DropBoard | None = None
    support_cells: tuple[tuple[int,int],...] = Field(default=(), max_length=32)
    maximum_states: int = Field(ge=1, le=4096)
    maximum_depth: int = Field(ge=0, le=12)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ContactLayerTemplate,...] = Field(default=(),max_length=1024)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=1024)
    board_models: tuple[DropBoardRasterModel,...] = Field(default=(),max_length=64)
    click_maps: tuple[DropClickMap,...] = Field(default=(),max_length=64)
    response_policies: tuple[DropResponsePolicy,...] = Field(default=(),max_length=128)
    transaction_comparisons: tuple[DropTransactionComparison,...] = Field(default=(),max_length=64)
    @model_validator(mode="after")
    def validate_domain(self):
        width=len(self.board.cells[0]) if self.board is not None else None
        if self.player_ref is not None and self.opponent_ref is not None and self.player_ref==self.opponent_ref:
            raise ValueError("player and opponent identities must be distinct")
        for values in (self.column_order or (),self.opponent_columns or ()):
            if len(set(values))!=len(values) or any(c<0 or (width is not None and c>=width) for c in values):
                raise ValueError("column domain must be unique and in bounds")
        if any((dr,dc)==(0,0) or abs(dr)>1 or abs(dc)>1 for dr,dc in self.directions or ()):
            raise ValueError("alignment directions must be adjacent nonzero vectors")
        if self.directions is not None and len(set(self.directions))!=len(self.directions):
            raise ValueError("duplicate alignment direction")
        if self.board is not None and any(not (0<=r<len(self.board.cells) and 0<=c<width) for r,c in self.support_cells):
            raise ValueError("support targets must belong to the supplied board")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError("one raw token per pixel")
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("raw templates have unique identities")
        for values,name in ((self.board_models,'model_ref'),(self.click_maps,'model_ref'),(self.response_policies,'policy_ref'),(self.transaction_comparisons,'packet_ref')):
            if len({getattr(v,name) for v in values})!=len(values):raise ValueError("retained domains have unique supplied identities")
        for observation in self.observations:
            if len({a.sequence_index for a in observation.animation})!=len(observation.animation):raise ValueError("animation samples have an exact temporal position")
        return self


OPERATION_MODES={
    "board_owners":"MEASURE", "drop_law":"FIT", "line_windows":"DOMAIN",
    "turn_successor":"STEP", "opponent_fit":"FIT", "immediate_tactics":"PRECONDITION",
    "forcing_certificate":"INVERSE_DOMAIN", "bounded_adversarial_domain":"DOMAIN",
    "support_preparation":"INVERSE_DOMAIN", "response_reconciliation":"COMPARE",
}


def _board_owners(request):
    measured=measure_translated_layers(request)
    if measured.computation_bound_reached:return measured
    certain={r["template_ref"] for r in measured.values.get("measured_layer_alternatives",())}
    possible={r["template_ref"] for r in measured.values.get("possible_layer_alternatives",())}
    templates={t.template_ref:t for t in request.layer_templates};boards=[];unknown=[];count=measured.examined_count
    for model_index,model in enumerate(request.board_models):
        if model.bottom_template_ref not in certain:
            unknown.append((model.model_ref,"current_measured_bottom_reference"));continue
        domains=[];coordinates=[];model_unknown=[]
        for row in range(len(model.row_positions)):
            for column in range(len(model.column_positions)):
                alternatives=[]
                for glyph in model.glyphs:
                    if (glyph.row,glyph.column)!=(row,column):continue
                    template=templates.get(glyph.template_ref)
                    if template is None or template.origin!=(model.column_positions[column],model.row_positions[row]):
                        model_unknown.append((row,column,"glyph_on_current_board_lattice"));continue
                    if glyph.template_ref in certain:alternatives.append((glyph.owner_ref,glyph.immutable,glyph.template_ref,False))
                    elif glyph.template_ref in possible:alternatives.append((glyph.owner_ref,glyph.immutable,glyph.template_ref,True))
                if not alternatives:model_unknown.append((row,column,"current_cell_owner_or_empty_support"))
                domains.append(tuple(dict.fromkeys(alternatives)));coordinates.append((row,column))
        if model_unknown:
            unknown.extend((model.model_ref,*item) for item in model_unknown);continue
        for assignment_index,assignment in enumerate(product(*domains)):
            if count>=request.maximum_evaluations or len(boards)>=request.maximum_states:
                return family_result(request,values={"board_domain_alternatives":tuple(boards),"unresolved_measurement_refs":tuple(unknown)},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"model_index":model_index,"assignment_index":assignment_index,"current_assignment":assignment})
            count+=1;cells=[[None for _ in model.column_positions] for _ in model.row_positions];immutable=[];unobserved=[]
            for (row,column),(owner,fixed,template_ref,partial) in zip(coordinates,assignment):
                cells[row][column]=owner
                if fixed:immutable.append((row,column))
                if partial:unobserved.append((row,column,template_ref))
            board=DropBoard(board_ref=model.board_ref,panel_ref=model.panel_ref,cells=tuple(tuple(row) for row in cells),immutable_cells=tuple(immutable))
            boards.append({"model_ref":model.model_ref,"board":board,"bottom_reference_ref":model.bottom_template_ref,
                "column_occupancy":tuple(tuple(board.cells[r][c] for r in range(len(board.cells))) for c in range(len(board.cells[0]))),
                "conditional_landing_cells":tuple((gravity,tuple((_landing(board,c,gravity),c) for c in model.playable_columns)) for gravity in model.gravity_models),
                "owner_refs":tuple(sorted({owner for row in board.cells for owner in row if owner is not None})),
                "unknown_cell_supports":tuple(unobserved),"panels_merged":False})
            if unobserved:unknown.append((model.model_ref,"partial_cell_glyph_evidence"))
    return family_result(request,values={"board_domain_alternatives":tuple(boards),"unresolved_measurement_refs":tuple(unknown),
        "physical_layer_refutations":measured.values.get("refutations",()),"board_dimensions_imported":False,
        "owner_colors_imported":False},examined_count=count,
        prerequisite_refs=("complete_bottom_lattice_or_cell_owner_evidence",) if unknown else ())


def _click_columns(mapping,point):
    x0,y0,x1,y1=mapping.active_bounds;x,y=point
    if not x0<=x<=x1 or not y0<=y<=y1:return ()
    return tuple(column for column,left,right in mapping.column_bands if left<=x<=right)


def _landing(board, column, gravity):
    if not 0<=column<len(board.cells[0]):
        return None
    rows=range(len(board.cells)) if gravity=="BOTTOM" else range(len(board.cells)-1,-1,-1)
    previous=None
    # Reachability from the entry face matters, not merely an empty lower cell.
    for row in rows:
        if board.cells[row][column] is not None or (row,column) in board.immutable_cells:
            return previous
        previous=row
    return previous


def _place(board, column, owner, gravity):
    row=_landing(board,column,gravity)
    if row is None:
        return None
    cells=tuple(tuple(owner if (r,c)==(row,column) else value for c,value in enumerate(line))
                for r,line in enumerate(board.cells))
    return board.model_copy(update={"cells":cells}),row


def _windows(request, board):
    height,width=len(board.cells),len(board.cells[0])
    values=[]
    for r in range(height):
        for c in range(width):
            for dr,dc in request.directions:
                positions=tuple((r+k*dr,c+k*dc) for k in range(request.alignment_length))
                if any(not (0<=rr<height and 0<=cc<width) for rr,cc in positions):
                    continue
                tokens=tuple(board.cells[rr][cc] for rr,cc in positions)
                owners=tuple(dict.fromkeys(x for x in tokens if x is not None))
                empty=tuple(pos for pos,token in zip(positions,tokens) if token is None)
                values.append({"cells":positions,"owner_refs":owners,"empty_cells":empty,
                    "mixed_ownership":len(owners)>1,
                    "missing_playability_supports":tuple(p for p in empty
                        if _landing(board,p[1],request.gravity)!=p[0]),
                    "immutable_support_cells":tuple(p for p in positions if p in board.immutable_cells),
                    "playable_empty_cells":tuple(p for p in empty
                        if p[1] in request.column_order and _landing(board,p[1],request.gravity)==p[0]),
                    "aligned_owner_ref":owners[0] if len(owners)==1 and not empty
                        and not any(p in board.immutable_cells for p in positions) else None})
    return tuple(values)


def _aligned(request, board, owner):
    return any(x["aligned_owner_ref"]==owner for x in _windows(request,board))


def _wins(request, board, owner, columns):
    values=[]
    for column in columns:
        placed=_place(board,column,owner,request.gravity)
        if placed is not None and _aligned(request,placed[0],owner):
            values.append(column)
    return tuple(values)


def _successors(request, board, column):
    if column not in request.column_order:
        return ({"board":board,"player_column":column,"rejected":True,
                 "rejection_cause":"outside_declared_column_domain","events":()},)
    placed=_place(board,column,request.player_ref,request.gravity)
    if placed is None:
        return ({"board":board,"player_column":column,"rejected":True,"events":()},)
    player_board,row=placed
    player_event=(request.scope.event_owner_ref,"player_drop",request.player_ref,(row,column))
    player_win=_aligned(request,player_board,request.player_ref)
    if player_win and request.acceptance_checkpoint=="AFTER_PLAYER":
        return (_settled_outcome(request,player_board,column,True,False,False,(player_event,)),)
    if not request.competitive_mode:
        if player_win:return (_settled_outcome(request,player_board,column,True,False,False,(player_event,)),)
        removed=not request.retained_placement
        events=(player_event,)+( ((request.scope.event_owner_ref,"tutorial_refusal",board.panel_ref,(row,column)),) if removed else ())
        return ({"board":board if removed else player_board,"player_column":column,"player_alignment":False,
                 "opponent_alignment":False,"player_accepted":False,"opponent_accepted":False,
                 "terminal_outcome":"TUTORIAL_REFUSAL" if removed else "ONGOING",
                 "events":events,"removed":removed,"settled_board":player_board},)
    replies=[]
    for reply in request.opponent_columns:
        response=_place(player_board,reply,request.opponent_ref,request.gravity)
        if response is None:
            continue
        after,reply_row=response
        draw=all(_landing(after,c,request.gravity) is None for c in tuple(dict.fromkeys(request.column_order+request.opponent_columns)))
        outcome=_settled_outcome(request,after,column,player_win,_aligned(request,after,request.opponent_ref),draw,
            (player_event,(request.scope.event_owner_ref,"opponent_drop",request.opponent_ref,(reply_row,reply))))
        replies.append({**outcome,"opponent_column":reply})
    if not replies:
        draw=all(_landing(player_board,c,request.gravity) is None for c in tuple(dict.fromkeys(request.column_order+request.opponent_columns)))
        replies.append({**_settled_outcome(request,player_board,column,player_win,False,draw,(player_event,)),
                        "no_declared_reply":not draw})
    return tuple(replies)


def _settled_outcome(request,board,column,player_win,opponent_win,draw,events):
    law=request.outcome_law
    player_accepted=player_win and (not opponent_win or law.simultaneous_priority=="PLAYER")
    opponent_accepted=opponent_win and not player_accepted
    draw=draw and not player_accepted and not opponent_accepted
    outcome="PLAYER_ACCEPTED" if player_accepted else ("OPPONENT_ACCEPTED" if opponent_accepted else ("DRAW" if draw else "ONGOING"))
    effects=list(events)
    if player_accepted:effects.append((request.scope.event_owner_ref,"accepted_panel",law.accepted_panel_ref,()))
    elif opponent_accepted:effects.append((request.scope.event_owner_ref,"opponent_acceptance",request.opponent_ref,()))
    elif draw:effects.append((request.scope.event_owner_ref,"draw_checkpoint",board.panel_ref,()))
    restore=(opponent_accepted and law.opponent_win_outcome=="RESTORE") or (draw and law.draw_outcome=="RESTORE")
    returned=law.restored_board if restore else board
    if restore:effects.append((request.scope.event_owner_ref,"declared_restoration",law.law_ref,returned.panel_ref))
    return {"board":returned,"settled_board":board,"player_column":column,"player_alignment":player_win,
        "opponent_alignment":opponent_win,"player_accepted":player_accepted,"opponent_accepted":opponent_accepted,
        "draw":draw,"restored":restore,"terminal_outcome":outcome,"events":tuple(effects),
        "outcome_law_ref":law.law_ref,"external_command_count":1}


def _fit_drop(request):
    if not request.observations or not request.law_alternatives or not request.click_maps:
        return family_result(request,prerequisite_refs=("owned_click_animation_and_drop_law_domains",),domain_complete=False)
    compatible=[];refutations=[];unknown=[];count=0
    for law_index,law in enumerate(request.law_alternatives):
        for map_index,mapping in enumerate(request.click_maps):
            first=None;unresolved=[];bindings=[]
            for observation_index,observation in enumerate(request.observations):
                if observation.before.panel_ref!=mapping.panel_ref:continue
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"compatible_drop_bindings":tuple(compatible),"first_refutations":tuple(refutations)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"law_index":law_index,"click_map_index":map_index,"observation_index":observation_index})
                count+=1
                if not observation.sealed or observation.click_point is None or observation.clicked_panel_ref!=mapping.panel_ref:
                    unresolved.append((observation.evidence_ref,"sealed_click_and_receiver_panel"));continue
                columns=_click_columns(mapping,observation.click_point)
                if observation.column not in columns:first=(observation.evidence_ref,"click_column_binding",columns,observation.column);break
                if observation.column>=len(observation.before.cells[0]):first=(observation.evidence_ref,"click_column_inside_measured_board");break
                if len(columns)!=1:unresolved.append((observation.evidence_ref,"unique_click_column"))
                animation=tuple(sorted(observation.animation,key=lambda x:x.sequence_index))
                if not animation:
                    unresolved.append((observation.evidence_ref,"owned_animation_and_settled_observation"));continue
                if any(a.panel_ref!=mapping.panel_ref or a.owner_ref!=observation.owner_ref or a.column!=observation.column for a in animation):
                    first=(observation.evidence_ref,"animation_owner_panel_column");break
                placed=_place(observation.before,observation.column,observation.owner_ref,law.gravity)
                settled=tuple(a.row for a in animation if a.phase=="SETTLED");removed=any(a.phase=="REMOVED" for a in animation)
                rejected=any(a.phase=="REJECTED" for a in animation)
                if placed is None:
                    if not law.full_column_rejected or not rejected or observation.after.cells!=observation.before.cells:
                        first=(observation.evidence_ref,"full_column_rejection");break
                else:
                    after,row=placed;expected=after if law.retained else observation.before
                    if not settled:unresolved.append((observation.evidence_ref,"observed_settled_row"))
                    elif any(r!=row for r in settled):first=(observation.evidence_ref,"settled_row",row,settled);break
                    if observation.after.cells!=expected.cells or observation.retained!=law.retained or removed==law.retained or rejected:
                        first=(observation.evidence_ref,"retained_vs_transient_removed_placement");break
                    falling=tuple(a.row for a in animation if a.phase=="FALLING")
                    monotone=all(a<=b for a,b in zip(falling,falling[1:])) if law.gravity=="BOTTOM" else all(a>=b for a,b in zip(falling,falling[1:]))
                    if not monotone:first=(observation.evidence_ref,"animation_gravity_order");break
                bindings.append((observation.evidence_ref,observation.click_point,observation.column,settled,removed,rejected))
            if first:refutations.append((law.law_ref,mapping.model_ref,first));continue
            if not bindings and not unresolved:continue
            compatible.append({"law":law,"click_map":mapping,"owned_observation_bindings":tuple(bindings),"unresolved_evidence":tuple(unresolved)})
            unknown.extend(unresolved)
    return family_result(request,values={"compatible_drop_bindings":tuple(compatible),"first_refutations":tuple(refutations),
        "unresolved_observation_evidence":tuple(unknown),"tutorial_removal_is_retained_success":False},examined_count=count,
        prerequisite_refs=("current_click_animation_or_persistence_evidence",) if unknown else ())


def _fit_opponent(request):
    observed=tuple(x for x in request.observations if x.owner_ref==request.opponent_ref)
    if not observed or not request.response_policies:
        return family_result(request,prerequisite_refs=("observed_replies_and_supplied_tactical_or_stochastic_policy_domains",),domain_complete=False)
    kept=[];refutations=[];unknown=[];count=0
    for policy_index,policy in enumerate(request.response_policies):
        first=None;unresolved=[];responses=[]
        for observation_index,observation in enumerate(observed):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"compatible_response_policies":tuple(kept),"first_refutations":tuple(refutations)},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"policy_index":policy_index,"observation_index":observation_index})
            count+=1;legal=tuple(c for c in policy.columns if _landing(observation.before,c,request.gravity) is not None);choices=()
            for stage in policy.priority:
                if stage!="DECLARED_LEGAL" and (request.alignment_length is None or request.directions is None or request.player_ref is None):
                    unresolved.append((observation.evidence_ref,"current_line_model_for_tactical_policy"));break
                if stage=="IMMEDIATE_WIN":choices=_wins(request,observation.before,request.opponent_ref,legal)
                elif stage=="IMMEDIATE_BLOCK":choices=_wins(request,observation.before,request.player_ref,legal)
                else:choices=legal
                if choices:break
            if not choices:
                if unresolved:continue
                first=(observation.evidence_ref,"empty_declared_policy_response_domain");break
            if policy.choice_mode=="FIRST_DECLARED":choices=choices[:1]
            elif policy.choice_mode=="STOCHASTIC":
                weights=dict(policy.column_weights);choices=tuple(c for c in choices if weights[c]>0)
            actual=_place(observation.before,observation.column,request.opponent_ref,request.gravity)
            if observation.column not in choices or actual is None or actual[0].cells!=observation.after.cells:
                first=(observation.evidence_ref,"refuting_reply",choices,observation.column);break
            responses.append((observation.evidence_ref,choices,observation.column,policy.choice_mode))
        if first:refutations.append((policy.policy_ref,first));continue
        kept.append({"policy":policy,"compatible_reply_domains":tuple(responses),"unresolved_evidence":tuple(unresolved)});unknown.extend(unresolved)
    return family_result(request,values={"compatible_response_policies":tuple(kept),"first_refutations":tuple(refutations),
        "unresolved_policy_evidence":tuple(unknown),"stochastic_distribution_measured":False,"optimal_opponent_proved":False,
        "one_block_proves_universal_optimal_play":False},examined_count=count,
        prerequisite_refs=("qualified_reply_line_model_for_remaining_policy",) if unknown else ())


def _reconcile(request):
    actual=request.actual_board;expected=request.expected_board;outcomes=[];count=0;missing=[];accepted_panels=[];reply_boundaries=[]
    for packet_index,packet in enumerate(request.transaction_comparisons):
        first=None;unresolved=[];last=None;categories=[];stopped=False
        if not packet.sealed:unresolved.append("sealed_returned_transaction")
        if len(packet.expected_events)!=len(packet.observed_events):
            first=("ordered_event_count",len(packet.expected_events),len(packet.observed_events))
        for event_index,(a,b) in enumerate(zip(packet.expected_events,packet.observed_events)):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"transaction_comparisons":tuple(outcomes)},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,
                    frontier={"packet_index":packet_index,"event_index":event_index,"current_first_divergence":first,"current_categories":tuple(categories)})
            count+=1
            if b.primitive_ref!=packet.primitive_ref or b.event_owner_ref!=request.scope.event_owner_ref:
                unresolved.append((event_index,"owned_current_primitive_event"))
            if stopped:unresolved.append((event_index,"old_suffix_after_authoritative_game_over"))
            if last is not None and b.before!=last:unresolved.append((event_index,"continuous_observed_event_state"))
            if b.kind=="RESTORE":
                if b.restore_epoch_after<=b.restore_epoch_before:unresolved.append((event_index,"new_restoration_epoch"))
            elif b.restore_epoch_after!=b.restore_epoch_before:unresolved.append((event_index,"restoration_effect_missing_from_ledger"))
            if b.kind=="PLAYER_DROP" and b.actor_ref!=request.player_ref:unresolved.append((event_index,"player_placement_owner"))
            if b.kind=="OPPONENT_REPLY":
                if b.actor_ref!=request.opponent_ref:unresolved.append((event_index,"automatic_reply_owner"))
                reply_boundaries.append((packet.packet_ref,event_index,b.after))
            if b.kind=="PANEL_ACCEPTED":accepted_panels.append((packet.packet_ref,event_index,b.panel_ref))
            if b.kind in ("TUTORIAL_REFUSAL","REMOVAL"):
                categories.append((event_index,b.kind,b.before,b.after,"transient_didactic_effect"))
            else:categories.append((event_index,b.kind,b.before,b.after,"owned_transaction_effect"))
            for field in ("primitive_ref","event_owner_ref","kind","actor_ref","panel_ref","before","after","restore_epoch_before","restore_epoch_after","authoritative_status"):
                if first is None and getattr(a,field)!=getattr(b,field):first=(event_index,field,getattr(a,field),getattr(b,field))
            last=b.after;stopped=stopped or b.authoritative_status=="GAME_OVER"
        outcomes.append({"packet_ref":packet.packet_ref,"first_divergence":first,"unresolved_evidence":tuple(unresolved),
            "ordered_owned_effects":tuple(categories),"returned_board":last,"authoritative_suffix_stopped":stopped,
            "automatic_replies_count_as_player_commands":False})
        missing.extend(unresolved)
    if outcomes and outcomes[-1]["returned_board"] is not None and outcomes[-1]["returned_board"]!=actual:
        missing.append("last_owned_event_matches_actual_returned_board")
    if not request.transaction_comparisons:missing.append("owned_sealed_player_reply_refusal_restore_acceptance_ledger")
    dimensions=len(actual.cells)==len(expected.cells) and len(actual.cells[0])==len(expected.cells[0]);changed=[]
    if dimensions:
        for r,line in enumerate(actual.cells):
            for c,owner in enumerate(line):
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"transaction_comparisons":tuple(outcomes),"changed_cells":tuple(changed)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={"phase":"returned_board","row":r,"column":c})
                count+=1
                if expected.cells[r][c]!=owner:changed.append((r,c,expected.cells[r][c],owner))
    event_first=next((row["first_divergence"] for row in outcomes if row["first_divergence"] is not None),None)
    new_scope=actual.panel_ref!=expected.panel_ref
    columns_current=all(0<=c<len(actual.cells[0]) for c in request.column_order+request.opponent_columns)
    if not columns_current:missing.append("column_domain_for_actual_returned_board")
    return family_result(request,values={"transaction_comparisons":tuple(outcomes),"dimensions_match":dimensions,
        "changed_cells":tuple(changed),"first_divergence":event_first or (changed[0] if changed else None) or (None if dimensions else ("board_dimensions",)),
        "actual_line_windows":_windows(request,actual) if columns_current else (),"actual_player_winning_columns":_wins(request,actual,request.player_ref,request.column_order) if columns_current else (),
        "actual_opponent_winning_columns":_wins(request,actual,request.opponent_ref,request.opponent_columns) if columns_current else (),
        "accepted_panel_events":tuple(accepted_panels),"automatic_reply_boundaries":tuple(reply_boundaries),
        "remaining_line_knowledge":_windows(request,actual) if columns_current else (),"next_move_observation_boundary":bool(reply_boundaries),
        "new_panel_execution_scope_required":new_scope,
        "transient_removed_placement_counted_as_retained":False},examined_count=count,
        prerequisite_refs=("complete_current_owned_transaction_events",) if missing else ())


def _forcing(request):
    if not request.competitive_mode:
        return family_result(request,prerequisite_refs=("competitive_turn_model",),domain_complete=False)
    if request.player_column is None or not request.opponent_domain_complete:
        return family_result(request,prerequisite_refs=("candidate_column_and_complete_response_domain",),domain_complete=False)
    placed=_place(request.board,request.player_column,request.player_ref,request.gravity)
    if placed is None or _aligned(request,request.board,request.opponent_ref) or _aligned(request,placed[0],request.player_ref):
        return family_result(request,prerequisite_refs=("nonterminal_candidate_without_prior_opposing_win",),domain_complete=False)
    responses=_successors(request,request.board,request.player_column)
    certificate=[];evaluations=len(responses)
    if evaluations>request.maximum_evaluations:
        return family_result(request,values={'responses':(),'next_win_after_every_reply':False,
            'all_replies_examined':False},domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'complete_current_reply_domain','required_reply_visits':evaluations})
    refutation=None
    for response in responses:
        next_wins=[]
        if not response.get('restored') and not response.get('opponent_accepted') and not response.get('draw'):
            for column in _wins(request,response["board"],request.player_ref,request.column_order):
                if evaluations>=request.maximum_evaluations:
                    return family_result(request,values={'responses':tuple(certificate),
                        'next_win_after_every_reply':False,'all_replies_examined':False},
                        examined_count=evaluations,domain_complete=False,computation_bound_reached=True,
                        frontier={'reply_index':len(certificate),'next_player_column':column})
                continuation=_successors(request,response['board'],column)
                if evaluations+len(continuation)>request.maximum_evaluations:
                    return family_result(request,values={'responses':tuple(certificate),
                        'next_win_after_every_reply':False,'all_replies_examined':False},
                        examined_count=evaluations,domain_complete=False,computation_bound_reached=True,
                        frontier={'reply_index':len(certificate),'next_player_column':column})
                evaluations+=len(continuation)
                if continuation and all(row.get('player_accepted') and not row.get('no_declared_reply') for row in continuation):
                    next_wins.append(column)
        next_wins=tuple(next_wins)
        ended=response.get("player_accepted",False)
        row={"opponent_column":response.get("opponent_column"),"next_player_wins":next_wins,
             "player_accepted_before_reply":bool(ended),"opponent_alignment":bool(response.get("opponent_alignment"))}
        certificate.append(row)
        if response.get("rejected") or response.get("opponent_accepted") or response.get('restored') or (not ended and not next_wins):
            if refutation is None:
                refutation=row
    no_reply_without_draw=any(x.get("no_declared_reply") and not x.get("draw") for x in responses)
    return family_result(request,values={"responses":tuple(certificate),"refuting_reply":refutation,
        "all_replies_examined":not no_reply_without_draw,
        "next_win_after_every_reply":refutation is None and not no_reply_without_draw and request.scope.input_domain_complete},
        examined_count=evaluations,domain_complete=not no_reply_without_draw)


def _domain(request, support=False):
    if _aligned(request,request.board,request.player_ref) or _aligned(request,request.board,request.opponent_ref):
        return family_result(request,prerequisite_refs=("nonterminal_initial_board",),domain_complete=False)
    queue=deque(((request.board,0),))
    seen={(request.board,"PLAYER_TURN"):0}
    response_seen={};nodes=[];response_nodes=[];dependencies=[];pending_edges=[]
    expanded=0;capped=False;missing_reply=False
    while queue:
        if expanded>=request.maximum_states:
            capped=True
            break
        board,depth=queue.popleft()
        expanded+=1
        edges=[]
        if depth<request.maximum_depth:
            for column in request.column_order:
                if _landing(board,column,request.gravity) is None:
                    continue
                player_board,_=_place(board,column,request.player_ref,request.gravity)
                phase="TERMINAL_CHECKPOINT" if _aligned(request,player_board,request.player_ref) and request.acceptance_checkpoint=="AFTER_PLAYER" else "RESPONSE_TURN"
                response_key=(player_board,phase)
                if response_key not in response_seen:
                    if len(seen)+len(response_seen)>=request.maximum_states:
                        capped=True;pending_edges.append((board,column,depth));continue
                    response_seen[response_key]=len(response_seen)
                replies=_successors(request,board,column)
                missing_reply|=any(x.get("no_declared_reply") and not x.get("draw") for x in replies)
                edges.append({"player_column":column,"response_quantifier":"ALL_DECLARED",
                              "response_state":response_key,"responses":replies})
                if response_seen[response_key]>=len(response_nodes):
                    response_nodes.append({"state":response_key,"responses":replies,"reply_quantifier":"ALL_DECLARED"})
                if support:
                    before_support=tuple(p for p in request.support_cells if _landing(board,p[1],request.gravity)==p[0])
                    outcomes=tuple({"opponent_column":reply.get('opponent_column'),
                        "prepared_future_cells":tuple(p for p in request.support_cells
                            if not reply.get('player_alignment') and not reply.get('opponent_alignment') and not reply.get('draw') and not reply.get('restored')
                            and p not in before_support and _landing(reply['board'],p[1],request.gravity)==p[0]),
                        "earlier_opponent_win":bool(reply.get('opponent_accepted')),
                        "player_terminal":bool(reply.get('player_alignment')),"after":reply['board']} for reply in replies)
                    if any(outcome['prepared_future_cells'] for outcome in outcomes):
                        dependencies.append({"preparation_state":(board,'PLAYER_TURN'),"candidate_column":column,"outcomes":outcomes,
                            "line_dependencies":tuple({"opponent_column":outcome['opponent_column'],
                                "windows":tuple(window for window in _windows(request,outcome['after'])
                                    if any(cell in window['cells'] for cell in outcome['prepared_future_cells'])
                                    and not window['immutable_support_cells']
                                    and all(owner==request.player_ref for owner in window['owner_refs']))}
                                for outcome in outcomes if outcome['prepared_future_cells']),
                            "conditional_reply_history":True,"earlier_prefix_opponent_win":False,
                            "executable_reply_history_materialized":False,
                            "no_immediate_opponent_win_in_declared_replies":all(not x['earlier_opponent_win'] for x in outcomes),
                            "common_prepared_cells":tuple(p for p in request.support_cells
                                if all(p in x['prepared_future_cells'] and not x['earlier_opponent_win'] for x in outcomes)),
                            "depth":depth+1})
                for response in replies:
                    after=response["board"]
                    if response.get("player_alignment") or response.get("opponent_alignment") or response.get("draw") or response.get('restored'):
                        continue
                    key=(after,"PLAYER_TURN")
                    if key not in seen:
                        if len(seen)+len(response_seen)>=request.maximum_states:
                            capped=True
                            pending_edges.append((after,None,depth+1))
                            continue
                        seen[key]=depth+1
                        queue.append((after,depth+1))
        nodes.append({"state":(board,"PLAYER_TURN"),"board":board,"depth":depth,
            "horizon_leaf":depth==request.maximum_depth,"player_quantifier":"ANY_DECLARED","edges":tuple(edges)})
    return family_result(request,values={"nodes":tuple(nodes),"response_nodes":tuple(response_nodes),"support_dependencies":tuple(dependencies),
        "depth_bound":request.maximum_depth,"response_domain_complete":request.opponent_domain_complete,
        "evaluation_or_ordering_inferred":False,"response_state_count":len(response_nodes)},examined_count=expanded+len(response_nodes),
        prerequisite_refs=("legal_opponent_response_domain",) if missing_reply else (),
        domain_complete=not capped and not missing_reply and (not request.competitive_mode or request.opponent_domain_complete),
        computation_bound_reached=capped,
        frontier={"pending":tuple(queue),"pending_edges":tuple(pending_edges),
            "visited_player_states":tuple(seen.items()),"visited_response_states":tuple(response_seen.items())} if capped else {})


def _calculate_adversarial_drop_alignment(request: AdversarialDropRequest) -> MechanicalFamilyResult:
    """Dispatch the exact supplied signature; do not infer a mode or priority."""
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required_fields={
        "board_owners":("raw_layer_pixels","layer_templates","board_models"),
        "drop_law":("observations","law_alternatives","click_maps"),
        "opponent_fit":("observations","response_policies","opponent_ref","gravity"),
    }
    line_fields=("board","player_ref","opponent_ref","gravity","alignment_length","directions","column_order","opponent_columns")
    for name in ("line_windows","turn_successor","immediate_tactics","forcing_certificate","bounded_adversarial_domain","support_preparation"):
        required_fields[name]=line_fields
    for name in ("turn_successor","immediate_tactics","forcing_certificate","bounded_adversarial_domain","support_preparation"):
        required_fields[name]+=("acceptance_checkpoint","competitive_mode","retained_placement","opponent_domain_complete")
    for name in ("turn_successor","immediate_tactics","forcing_certificate","bounded_adversarial_domain","support_preparation"):
        required_fields[name]+=("outcome_law",)
    required_fields["support_preparation"]+=("support_cells",)
    required_fields["response_reconciliation"]=("actual_board","expected_board","player_ref","opponent_ref","alignment_length","directions","column_order","opponent_columns","gravity","transaction_comparisons")
    missing=missing_supplied_fields(request,required_fields.get(request.operation_ref,()))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    operation=request.operation_ref
    board=request.board
    if operation=="board_owners":
        return _board_owners(request)
    if operation=="drop_law":
        return _fit_drop(request)
    if operation=="line_windows":
        windows=_windows(request,board)
        return family_result(request,values={"windows":windows,
            "player_winning_columns":_wins(request,board,request.player_ref,request.column_order),
            "opponent_winning_columns":_wins(request,board,request.opponent_ref,request.opponent_columns)},
            examined_count=len(windows))
    if operation=="turn_successor":
        if request.player_column is None:
            return family_result(request,prerequisite_refs=("bound_player_column",),domain_complete=False)
        values=_successors(request,board,request.player_column)
        missing_reply=any(x.get("no_declared_reply") and not x.get("draw") for x in values)
        return family_result(request,values={"successors":values,"external_command_count":1},
            prerequisite_refs=("legal_opponent_response_domain",) if missing_reply else (),
            examined_count=len(values),domain_complete=not missing_reply and
            (not request.competitive_mode or request.opponent_domain_complete))
    if operation=="opponent_fit":
        return _fit_opponent(request)
    if operation=="immediate_tactics":
        values=[]
        prior_threats=_wins(request,board,request.opponent_ref,request.opponent_columns)
        for column in request.column_order:
            placed=_place(board,column,request.player_ref,request.gravity)
            if placed is None:
                continue
            after,_=placed
            player_alignment=_aligned(request,after,request.player_ref)
            reply_wins=_wins(request,after,request.opponent_ref,request.opponent_columns)
            settled=_successors(request,board,column)
            accepted=bool(settled) and all(row.get('player_accepted') and not row.get('no_declared_reply') for row in settled)
            safe=bool(settled) and all(not row.get('opponent_accepted') and not row.get('no_declared_reply') for row in settled)
            values.append({"player_column":column,"player_alignment":player_alignment,
                "player_accepted_in_every_declared_response":accepted,
                "opponent_immediate_wins":reply_wins,"opponent_response_occurs":request.competitive_mode and not
                    (player_alignment and request.acceptance_checkpoint=="AFTER_PLAYER"),
                "safe_against_declared_immediate_reply":safe,
                "acceptance_checkpoint":request.acceptance_checkpoint})
        return family_result(request,values={"candidate_tactics":tuple(values),
            "prior_opponent_immediate_wins":prior_threats,
            "safe_tactical_columns":tuple(x["player_column"] for x in values
                if x["safe_against_declared_immediate_reply"] and request.opponent_domain_complete
                and request.scope.input_domain_complete),
            "defense_required":bool(prior_threats),
            "defense_or_terminal_columns":tuple(x["player_column"] for x in values
                if prior_threats and x["safe_against_declared_immediate_reply"] and request.opponent_domain_complete
                and request.scope.input_domain_complete)},examined_count=len(values),
                             domain_complete=request.opponent_domain_complete)
    if operation=="forcing_certificate":
        return _forcing(request)
    if operation in ("bounded_adversarial_domain","support_preparation"):
        return _domain(request,support=operation=="support_preparation")
    return _reconcile(request)


def measure_adversarial_drop_alignment(request: AdversarialDropRequest) -> MechanicalFamilyResult:
    return _calculate_adversarial_drop_alignment(request)
