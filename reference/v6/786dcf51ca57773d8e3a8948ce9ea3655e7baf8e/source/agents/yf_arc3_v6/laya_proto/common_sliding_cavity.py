"""Current public bindings for existing V5 cavity/stop/slide capabilities."""
import json
from pathlib import Path
from types import SimpleNamespace
from common_multiscale_constraints import digest
from common_visible_identity import residual_correspondences
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,ComponentExtractionInput,InteractionProbeInput,BoundingBox
from agents.yf_arc3_v5.capabilities.open_cavity import rectangular_open_complements,measure_open_cavity_stop_geometry,measure_connecting_surface
from common_control_dependencies import ControlDependencies
from common_cavity_clock import CavityClock
from agents.yf_arc3_v5.capabilities import open_cavity_transfer as retained_cavity_dependency
from agents.yf_arc3_v5.capabilities.wrap_slide import WrapCell,WrapMember,WrapState,WrapTopology,WrapModel,WrapCommand,_slide
from agents.yf_arc3_v5.logos.types import FrozenMap


def components(rows):
    return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4))


class SlidingCavity:
    def __init__(self):
        self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['sliding_cavity']
        self.scope_policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['cavity_binding_scope']
        self.clock_policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['cavity_clock_composition']
        self.body_type=None;self.floor=None;self.directions={};self.stops=[];self.seams=[]
        self.last_action=None;self.last_delta=None;self.packet=[];self.scored=[];self.events=[]
        self.control_questions=ControlDependencies()
        self.clock=CavityClock()

    def body(self,parts):
        if self.body_type is None:return None
        color,h,w=self.body_type
        found=[c for c in parts.components if c.value==color and c.bbox.height==h and c.bbox.width==w and c.area==h*w]
        return found[0] if len(found)==1 else None

    def input(self,observation,rows):
        parts=components(rows);body=self.body(parts);frame=FrameGrid(rows=tuple(map(tuple,rows)))
        # Restrict the measured relation, never the physical frame/collision mask.
        # An occupied complement is not the recalled open supporting cavity.
        if self.scope_policy['enabled'] and body is not None and self.scored and self.floor is not None:
            records=rectangular_open_complements(parts.components)
            occupied={ref for ref,core,_ in records if any(rows[r][c]!=self.floor for r in range(core.top,core.bottom+1) for c in range(core.left,core.right+1))}
            h,w=self.body_type[1:]
            parts=parts.model_copy(update={'components':tuple(c for c in parts.components
                if c.component_id not in occupied and not (c.area==h*w and c.bbox.height==h and c.bbox.width==w
                    and c.component_id!=body.component_id and c.value!=self.floor
                    and c.value not in {v for s in self.stops for v in s['stop_surface_values']}))})
        return InteractionProbeInput(frame=frame,components=parts,available_action_refs=tuple(observation['available_action_refs']),
            current_observed_frame=frame,current_observation_frame_ref=observation['observation_ref'],
            input_aligned_entity_bboxes=(body.bbox,) if body else (),current_input_aligned_underlay_values=(self.floor,) if self.floor is not None else (),
            interface_action_translation_deltas=tuple((a,d[0],d[1]) for a,d in sorted(self.directions.items())),
            known_action_translation_deltas=((self.last_action,*self.last_delta),) if self.last_action and self.last_delta else (),
            last_action_ref=self.last_action,canonical_surface_stop_facts=tuple(FrozenMap(x) for x in self.stops),
            canonical_screen_wrap_facts=tuple(FrozenMap(x) for x in self.seams),
            latest_ordered_action_frames=tuple(FrameGrid(rows=tuple(map(tuple,r))) for r in self.packet),
            route_generation_policy=FrozenMap({'open_cavity_action_order':tuple(self.policy['action_order']),
                'open_cavity_search_state_bound':self.policy['state_bound']}))

    def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
        self.events=[]
        if proposal and proposal.get('support_plan',{}).get('direction_question'):
            self.control_questions.record_attempt(proposal['support_plan']['question_key'])
        if before['level_epoch']!=after['level_epoch'] or before['levels_completed']!=after['levels_completed']:
            self.clock.reset()
            if after['levels_completed']>before['levels_completed'] and proposal and proposal.get('support_plan',{}).get('sliding_cavity'):
                self.scored.append({'level':before['level_epoch'],'evidence':after['observation_ref'],'method':'observed_stop_then_oriented_cavity_access'})
            self.packet=[];self.last_delta=None
            return {'status':'cavity_boundary','events':[{'kind':'cavity_method_retained','scored':self.scored,'stops':self.stops,'seams':self.seams}] if self.scored else []}
        self.clock.record(self,before,after,command,first,second,frames,components)
        correspondence=residual_correspondences(before,after,first,second)
        cavities=rectangular_open_complements(components(second).components)
        options=[]
        retained_before=self.body(components(first));retained_after=self.body(components(second))
        for pair in correspondence['candidates']:
            old,new=pair['before'],pair['after'];h=new['bbox'][3]-new['bbox'][1]+1;w=new['bbox'][2]-new['bbox'][0]+1
            if self.scope_policy['enabled'] and retained_before is not None and retained_after is not None and (new['palette_value'],h,w)!=self.body_type:continue
            if new['area']==h*w and any(core.height==h and core.width==w for _,core,_ in cavities):options.append((old,new,h,w))
        if len(options)==1:
            old,new,h,w=options[0];self.body_type=(new['palette_value'],h,w)
            self.last_delta=(new['position'][1]-old['position'][1],new['position'][0]-old['position'][0]);self.last_action=command['action_ref']
            vals={second[y][x] for y in range(old['bbox'][1],old['bbox'][3]+1) for x in range(old['bbox'][0],old['bbox'][2]+1)}
            occluded=any((xx,yy) in self.clock.masks() for yy in range(old['bbox'][1],old['bbox'][3]+1) for xx in range(old['bbox'][0],old['bbox'][2]+1))
            if not occluded and len(vals)==1 and next(iter(vals))!=new['palette_value']:self.floor=next(iter(vals))
            self.packet=[first]+list(frames or [second])
            positions=[]
            for rows in self.packet:
                body=self.body(components(rows))
                if body:positions.append((body.bbox.top,body.bbox.left))
            local=[(b[0]-a[0],b[1]-a[1]) for a,b in zip(positions,positions[1:]) if a!=b]
            aligned=[d for d in local if (d[0]==0)!=(d[1]==0) and abs(d[0])<=h and abs(d[1])<=w]
            if aligned:
                signs={(0 if dr==0 else (1 if dr>0 else -1),0 if dc==0 else (1 if dc>0 else -1)) for dr,dc in aligned}
                if len(signs)==1:self.directions[command['action_ref']]=next(iter(signs))
            elif command['action_ref'] not in self.directions and len(local)==1:
                dr,dc=local[0]
                if (dr==0)!=(dc==0):self.directions[command['action_ref']]=(0 if dr==0 else (1 if dr>0 else -1),0 if dc==0 else (1 if dc>0 else -1))
        if self.body_type and self.floor is not None:
            facts=measure_open_cavity_stop_geometry(self.input(after,second))
            if facts.get('open_cavity_observed_first_stop_matches'):
                stop={'claim_ref':'observed_stop:'+after['observation_ref'],'local_row_pitch':self.body_type[1],
                      'local_column_pitch':self.body_type[2],'revisable_floor_value':self.floor,
                      'stop_surface_values':list(facts.get('open_cavity_stop_surface_values',()))}
                if not any({k:v for k,v in s.items() if k!='claim_ref'}=={k:v for k,v in stop.items() if k!='claim_ref'} for s in self.stops):self.stops.append(stop)
            if facts.get('requested_directed_edge_pair_crossing_observed'):
                seam={k:v for k,v in facts.items() if k.startswith(('playable_','cell_','directed_','ordered_','same_member','stationary_scene','requested_directed','opposite_','orthogonal_','competing_'))}
                seam['claim_ref']='observed_crossing:'+after['observation_ref']
                if not any(s.get('directed_edge_pair_ref')==seam.get('directed_edge_pair_ref') and s.get('playable_origin_row')==seam.get('playable_origin_row') for s in self.seams):self.seams.append(seam)
            if options:self.events=[{'kind':'cavity_stop_measurement','before':before['observation_ref'],'after':after['observation_ref'],
                'body_type':self.body_type,'directions':self.directions,'stop_facts':self.stops,'wrap_facts':self.seams,
                'first_stop_supported':bool(facts.get('open_cavity_observed_first_stop_matches')),'local_delta':self.last_delta}]
        return {'status':'cavity_observed','events':self.events}

    def state(self):
        from src_bridge import plain
        return plain({'format':'sliding_cavity_state.v1','body_type':self.body_type,'floor':self.floor,'directions':self.directions,'stops':self.stops,'seams':self.seams,'last_action':self.last_action,'last_delta':self.last_delta,'packet':self.packet,'scored':self.scored,'events':self.events,'control_questions':{'pending':self.control_questions.pending,'attempted':sorted(self.control_questions.attempted)},'clock':{'measurements':self.clock.measurements,'current':self.clock.current}})
    def restore(self,state):
        required={'format','body_type','floor','directions','stops','seams','last_action','last_delta','packet','scored','events','control_questions','clock'}
        if state.get('format')!='sliding_cavity_state.v1' or set(state)!=required or set(state['control_questions'])!={'pending','attempted'} or set(state['clock'])!={'measurements','current'}:raise ValueError('Incomplete sliding cavity state')
        value=json.loads(json.dumps(state))
        for key in ('floor','stops','seams','last_action','packet','scored','events'):setattr(self,key,value[key])
        self.body_type=tuple(value['body_type']) if value['body_type'] is not None else None
        self.last_delta=tuple(value['last_delta']) if value['last_delta'] is not None else None
        self.directions={k:tuple(v) for k,v in value['directions'].items()}
        self.control_questions=ControlDependencies();self.control_questions.pending=value['control_questions']['pending'];self.control_questions.attempted=set(value['control_questions']['attempted'])
        def restore_clock(row):
            if row is None:return None
            row['pattern']=tuple(tuple(x) for x in row['pattern'])
            for key in ('position','delta','size'):row[key]=tuple(row[key])
            return row
        self.clock=CavityClock();self.clock.measurements=[restore_clock(x) for x in value['clock']['measurements']];self.clock.current=restore_clock(value['clock']['current'])
    def propose(self,observation,rows,inputs,remaining):
        return self._propose_retained(observation,rows,remaining)
    def _propose_retained(self,observation,rows,remaining):
        if not self.policy['enabled'] or not self.body_type or self.floor is None or remaining<=0:return None
        if self.clock_policy['enabled']:
            temporal=self.clock.propose(self,observation,rows,remaining,components)
            if temporal:return temporal
        value=self.input(observation,rows);facts=measure_open_cavity_stop_geometry(value);body=self.body(value.components)
        rebound=None
        if body is None and self.scored:
            h,w=self.body_type[1:];blocking={v for s in self.stops for v in s['stop_surface_values']}
            cores=[x for x in rectangular_open_complements(value.components.components) if x[1].height==h and x[1].width==w]
            matches=[c for c in value.components.components if c.area==h*w and c.bbox.height==h and c.bbox.width==w
                     and c.value not in blocking and c.value!=self.floor]
            if len(cores)==1 and len(matches)==1:
                candidate=matches[0];core=cores[0][1];incidence=measure_connecting_surface(value.components.components,candidate.bbox,core)
                surfaces=[c for c in value.components.components if c.component_id==incidence.get('open_cavity_connecting_surface_ref')]
                if len(surfaces)==1 and surfaces[0].value==self.floor and (candidate.bbox.top-core.top)%h==0 and (candidate.bbox.left-core.left)%w==0:
                    rebound={'prior_body_type':self.body_type,'current_component_ref':candidate.component_id,'current_cavity_ref':cores[0][0],
                             'current_surface_ref':surfaces[0].component_id,'scope':'new occurrence with current complete fit, phase and connecting surface; no identity equivalence'}
                    body=candidate;self.body_type=(body.value,h,w);value=self.input(observation,rows);facts=measure_open_cavity_stop_geometry(value)
        if body is None and self.scored and facts.get('open_cavity_recalled_stop_model_present'):
            box=tuple(facts.get('open_cavity_body_bbox',()))
            matches=[c for c in value.components.components if (c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)==box
                     and c.area==self.body_type[1]*self.body_type[2] and c.bbox.height==self.body_type[1] and c.bbox.width==self.body_type[2]]
            if len(matches)==1:
                body=matches[0];rebound={'prior_body_type':self.body_type,'current_component_ref':body.component_id,
                    'current_cavity_ref':facts['open_cavity_component_ref'],'current_surface_ref':facts['open_cavity_connecting_surface_ref'],
                    'scope':'new occurrence under revalidated geometry; not identity or color equivalence'}
                self.body_type=(body.value,body.bbox.height,body.bbox.width)
        if body is None:return None
        path=tuple(facts.get('open_cavity_conditional_route_action_refs',()))
        if not path and facts.get('open_cavity_next_stop_equals_core'):path=tuple(facts.get('open_cavity_nonreturn_first_action_refs',()))
        if not path:return self.propose_direction_question(observation,rows,value,body,rebound) if self.scored else None
        path=path[:min(remaining,16)]
        refs=[facts.get('open_cavity_connecting_surface_ref')];regions=[c for c in value.components.components if c.component_id in refs]
        if len(regions)!=1:return None
        bounds=regions[0].bbox;h,w=self.body_type[1:]
        if bounds.height%h or bounds.width%w:return None
        nr,nc=bounds.height//h,bounds.width//w;pose=((body.bbox.left-bounds.left)//w,(body.bbox.top-bounds.top)//h)
        cells=[]
        for y in range(nr):
            for x in range(nc):
                clear=(x,y)==pose or all(rows[yy][xx]==self.floor for yy in range(bounds.top+y*h,bounds.top+(y+1)*h) for xx in range(bounds.left+x*w,bounds.left+(x+1)*w))
                cells.append(WrapCell(x=x,y=y,terrain='SUPPORT' if clear else 'BLOCKED',evidence_ref='provisional_surface:'+observation['observation_ref']))
        topology=WrapTopology(topology_ref='current_measured_viewport',minimum_x=0,maximum_x=nc-1,minimum_y=0,maximum_y=nr-1,
            horizontal='WRAP',vertical='WRAP',revisit_stop='BEFORE_REENTER_POSE',evidence_ref='conditional_topology_not_universal')
        model=WrapModel(model_ref='conditional_observed_slide',topology=topology,order_kind='ORDERED',motion='SLIDE',boundary_body_rule='WRAP_ANCHOR',patrol_clock_phase='NONE')
        state=WrapState(members=(WrapMember(member_ref='current_body',type_ref='observed_body',x=pose[0],y=pose[1],offsets=((0,0),),alive=True),),
            member_order=('current_body',),required_member_refs=('current_body',),cells=tuple(cells),seats=(),remaining_budget=remaining,input_tick=0,
            level_scope_ref=str(observation['level_epoch']),restore_epoch=0,status='ACTIVE')
        steps=[];positions=[[body.bbox.left,body.bbox.top]]
        for i,action in enumerate(path):
            if action not in self.directions:return None
            dr,dc=self.directions[action];cmd=WrapCommand(input_ref=action,action_ref=action,payload=FrozenMap(),dx=dc,dy=dr,cost=1)
            after,events,debt,work,cut=_slide(state,model,SimpleNamespace(command_scope_ref='cavity:'+str(i),maximum_depth=nr*nc+1),cmd,65536,allow_hypothetical=True)
            if debt or cut:return None
            member=after.members[0];point=[bounds.left+member.x*w,bounds.top+member.y*h]
            if point==positions[-1]:return None
            steps.append({'action':{'action_ref':action},'from':positions[-1],'to':point,
                'expected_before':{'level_epoch':observation['level_epoch'],'body_position':positions[-1]},
                'expected_after':{'body_position':point,'topology':'conditional_wrap_only_where_current_path_needs_it'}})
            positions.append(point);state=after.model_copy(update={'trails':()})
        plan={'sliding_cavity':True,'body_type':list(self.body_type),'positions':positions,'bounds':[bounds.left,bounds.top,bounds.right,bounds.bottom],
              'role_rebinding':rebound,
              'geometry':facts,'before_frame':observation['frame_hash'],'conditional_model':'observed stop law; current wall/support roles and unknown seams remain revisable'}
        plan['static_digest']=self.static_digest(rows,plan);plan=json.loads(json.dumps(plan))
        ref='C_cavity_access_'+digest([observation['observation_ref'],path])[:16];actions=[s['action'] for s in steps]
        evidence=[observation['observation_ref']]+[s['claim_ref'] for s in self.stops]
        why='Use the observed stop law and measured open cavity to compose a conditional access; preserve current support and interrupt at the first divergent endpoint or world change.'
        premises={'current_body_cavity_fit':True,'observed_stop_law_supported':True,'conditional_path_mechanically_projected':True,'terminal_role_is_hypothesis':True}
        return {'status':'proposed','kind':'sliding_cavity_access','support_plan':plan,'steps':steps,'actions':actions,'facts':premises,
            'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'terminal_relevance':'morphological hypothesis'},'relations':['contributes_to:G_official_completion']}],
            'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,
            'binding':{'observation_ref':observation['observation_ref'],'level_epoch':observation['level_epoch'],'levels_completed':observation['levels_completed']},
            'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],
                'purpose':why,'preconditions':premises,'evidence':evidence,'actions':actions,'frozen_support_plan':plan,'outcome_guard':{'path':['value'],'contains':ref}}}

    @staticmethod
    def static_digest(rows,plan):
        _,h,w=plan['body_type'];excluded={(x+dx,y+dy) for x,y in plan['positions'] for dy in range(h) for dx in range(w)}
        l,t,r,b=plan['bounds']
        return digest([(x,y,rows[y][x]) for y in range(t,b+1) for x in range(l,r+1) if (x,y) not in excluded])

    @staticmethod
    def body_at(rows,plan,point):
        color,h,w=plan['body_type'];x,y=point
        return all(rows[y+dy][x+dx]==color for dy in range(h) for dx in range(w))

    def before(self,proposal,index,public,observation):
        p=proposal['support_plan'];b=proposal['binding']
        if p.get('clock_composition'):
            ok=public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and bool(self.clock_matches(public.frame_rows,p,index))
            return {'admitted':ok,'reason':'current_clock_and_body_board_bound' if ok else 'clock_body_or_board_diverged'}
        ok=(public.level==b['level_epoch'] and public.levels_completed==b['levels_completed'] and self.body_at(public.frame_rows,p,p['positions'][index])
            and self.static_digest(public.frame_rows,p)==p['static_digest'] and (index>0 or public.frame_hash==p['before_frame']))
        return {'admitted':bool(ok),'reason':'current_cavity_body_surface_bound' if ok else 'cavity_body_or_world_diverged'}

    def after(self,proposal,index,before,after,first,second):
        if proposal['support_plan'].get('clock_composition'):
            p=proposal['support_plan'];matched=bool(self.clock_matches(first,p,index)&self.clock_matches(second,p,index+1))
            return {'matched':matched,'seal_prefix':not matched or index+1==len(proposal['steps']),'reason':'complete_forecast_board_comparison'}
        if proposal['support_plan'].get('direction_question'):
            return {'matched':None,'seal_prefix':True,'reason':'unknown_input_direction_requires_observed_response_before_route_binding'}
        if before['level_epoch']!=after['level_epoch'] or before['levels_completed']!=after['levels_completed']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        p=proposal['support_plan'];matched=self.body_at(second,p,p['positions'][index+1]) and self.static_digest(second,p)==p['static_digest']
        return {'matched':matched,'seal_prefix':not matched or index+1==len(proposal['steps']),'reason':'compare_frozen_slide_endpoint_and_static_support'}

    @staticmethod
    def clock_matches(rows,plan,index):
        left,top,right,bottom=plan['bounds'];colors=plan['mask_colors'];matches=set()
        for branch,box in enumerate(plan['mask_regions'][index]):
            l,t,r,b=box;counts={str(v):sum(rows[y][x]==v for y in range(t,b+1) for x in range(l,r+1)) for v in colors}
            if counts!=plan['mask_color_counts']:continue
            actual=digest([[(-1 if l<=x<=r and t<=y<=b and rows[y][x] in colors else rows[y][x]) for x in range(left,right+1)] for y in range(top,bottom+1)])
            if actual==plan['board_digests'][index][branch]:matches.add(branch)
        return matches

    def propose_direction_question(self,observation,rows,value,body,rebound):
        cores=[x for x in rectangular_open_complements(value.components.components) if x[1].height==body.bbox.height and x[1].width==body.bbox.width]
        if len(cores)!=1:return None
        incidence=measure_connecting_surface(value.components.components,body.bbox,cores[0][1])
        regions=[c for c in value.components.components if c.component_id==incidence.get('open_cavity_connecting_surface_ref')]
        if len(regions)!=1 or regions[0].value!=self.floor:return None
        bounds=regions[0].bbox;point=[body.bbox.left,body.bbox.top]
        context={'body_bbox':[body.bbox.left,body.bbox.top,body.bbox.right,body.bbox.bottom],
                 'cavity_bbox':[cores[0][1].left,cores[0][1].top,cores[0][1].right,cores[0][1].bottom],
                 'surface_geometry':[(c.value,c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right,c.area) for c in value.components.components if not c.touches_frame_boundary]}
        for action in self.policy['action_order']:
            if action not in observation['available_action_refs'] or action in self.directions:continue
            key=ControlDependencies.question_key(observation['level_epoch'],'missing_direction_for_retained_cavity_method',context,action)
            if key in self.control_questions.attempted:continue
            plan={'sliding_cavity':True,'direction_question':True,'question_key':key,'body_type':list(self.body_type),'positions':[point],
                  'bounds':[bounds.left,bounds.top,bounds.right,bounds.bottom],'before_frame':observation['frame_hash'],'role_rebinding':rebound}
            plan['static_digest']=self.static_digest(rows,plan);plan=json.loads(json.dumps(plan))
            ref='C_cavity_direction_'+key[:16];command={'action_ref':action};why='The retained cavity method has current shape and surface bindings but lacks this input direction; observe it once in this context before binding a complete route.'
            facts={'scored_stop_method_retained':True,'current_cavity_body_surface_fit':True,'input_direction_unknown':True}
            evidence=[observation['observation_ref'],self.scored[-1]['evidence']]
            return {'status':'proposed','kind':'cavity_direction_question','support_plan':plan,'actions':[command],
                'steps':[{'action':command,'expected_before':{'body_position':point,'level_epoch':observation['level_epoch']},'expected_after':{'direction':'unknown','rivals':['stationary','local translation','boundary transport','other effect']}}],
                'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'parent_method':'retained cavity access'},'relations':['contributes_to:G_official_completion']}],
                'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,
                'binding':{'observation_ref':observation['observation_ref'],'level_epoch':observation['level_epoch'],'levels_completed':observation['levels_completed']},
                'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,
                    'evidence':evidence,'actions':[command],'frozen_support_plan':plan,'outcome_guard':{'path':['value'],'contains':ref}}}
        return None
