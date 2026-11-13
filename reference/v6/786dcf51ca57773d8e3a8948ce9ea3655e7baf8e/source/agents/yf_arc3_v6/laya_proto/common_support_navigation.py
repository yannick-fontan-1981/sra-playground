"""Bind public cursor/control observations to the existing support domain.

Role and support interpretations are explicit provisional hypotheses. Mechanical
coverage, remote-effect measurement and configuration search reuse V5 code.
"""
from collections import Counter, defaultdict, deque
import copy
import json
from pathlib import Path
from types import SimpleNamespace

from agents.yf_arc3_v5.capabilities import ComponentExtractionInput, FrameGrid, detect_components
from agents.yf_arc3_v5.capabilities.support_navigation_domain import measure_support_navigation_domain
from agents.yf_arc3_v5.capabilities.navigation_transition_measurements import measure_remote_navigation_transition, measure_current_translation_underlays
from agents.yf_arc3_v5.capabilities.appearance import measure_orthogonal_bands
from agents.yf_arc3_v5.capabilities.reconfigurable_support import _support_transform
from common_control_dependencies import ControlDependencies
from common_visible_identity import residual_correspondences
from common_multiscale_constraints import digest
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from support_contact_questions import current_reciprocal_fields, addressed_component, field_association

def extract(rows):
    return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows), connectivity=4)).components

def signature(component):
    return tuple(sorted((r-component.bbox.top, c-component.bbox.left, component.value) for r,c in component.pixels))

def shape(component):
    return tuple((r,c) for r,c,_ in signature(component))

def association(component, role):
    return {'term_ref': 'association.' + role + '.' + digest(signature(component))[:16],
            'normalized_valued_pixels': signature(component)}

def bbox(component):
    return [component.bbox.left,component.bbox.top,component.bbox.right,component.bbox.bottom]


from common_oriented_coupling import OrientedCoupling
from common_invited_reduction import InvitedReduction
from common_joint_transport import JointTransport
from common_configured_arrivals import ConfiguredArrivals
from common_contextual_compartments import ContextualCompartments
from common_periodic_sums import PeriodicSums
from common_reflected_cover import ReflectedCover
from common_metric_composition import MetricComposition
from common_sliding_cavity import SlidingCavity
from common_ordered_support import OrderedSupportTransfer
from common_animated_contact import AnimatedContact
from common_fixed_origin import FixedOrigin
from common_subset_diagnosis import SubsetDiagnosis

class SupportNavigation:
    def __init__(self):
        self.acquired_compositions={
            "oriented_coupling":OrientedCoupling(),
            "invited_reduction":InvitedReduction(),
            "joint_transport":JointTransport(),
            "configured_arrivals":ConfiguredArrivals(),
            "metric_composition":MetricComposition(),
            "sliding_cavity":SlidingCavity(),
            "ordered_support_transfer":OrderedSupportTransfer(),
            "animated_contact":AnimatedContact(),
            "fixed_origin":FixedOrigin(),
            "subset_diagnosis":SubsetDiagnosis(),
            "contextual_compartments":ContextualCompartments(),
            "periodic_sums":PeriodicSums(),
            "reflected_cover":ReflectedCover(),
        }
        self.epoch = None
        self.actor_signature = None
        self.target_signature = None
        self.controls = {}
        self.directions = {}
        self.entered = set()
        self.effects = []
        self.tried = Counter()
        self.blocked = set()
        self.events = []
        self.passed = []
        self.underlay = None
        self.control_questions = ControlDependencies()
        self.last_calculation = None
        self.equivalences = []
        self.current_observation = None
        self.contact_question = None
        self.contact_attempted = set()
        self.control_introductions = []
        self.service_edges = []
        policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())
        self.config = {**policy['support_navigation'],'equivalence':policy['support_navigation_equivalence']}
        self.config['addressed_reciprocal_field_contact']=policy.get('support_contact_question',{}).get('enabled',False)
        self.config['control_introduction_contact']=policy.get('support_introduction_question',{}).get('enabled',False)

    def controls_in(self, components):
        groups = defaultdict(list)
        for item in components:
            if item.area > 1 and item.area < item.bbox.height*item.bbox.width:
                groups[shape(item)].append(item)
        repeated = [items for items in groups.values() if len(items)>=2 and len({item.value for item in items})>=2]
        known = {tuple((r,c) for r,c,_ in row['normalized_valued_pixels']) for row in self.controls.values()}
        # Once a control appearance has an intervention witness, rebind that
        # class. A newly coincident residual shape (e.g. two occluded supports)
        # is not a new control role merely because it repeats.
        if known:return [item for item in components if shape(item) in known]
        return [item for item in components if any(item in items for items in repeated)]

    def scene(self, rows):
        components = extract(rows)
        actors = [item for item in components if signature(item)==self.actor_signature]
        targets = [item for item in components if signature(item)==self.target_signature]
        if len(actors)!=1 or len(targets)!=1:
            return None
        actor,target = actors[0],targets[0]
        return components,actor,target,self.controls_in(components)

    def remember_underlay(self, before, after, first, second):
        current=self.scene(second) if self.actor_signature else None
        if not current:
            self.underlay=None
            return
        actor=current[1];box=[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right]
        measured=plain(measure_current_translation_underlays(before=first,after=second))
        matches=[row for row in measured if row['component_ref']==actor.component_id and row['bbox']==box and len(row['underlay_values'])==1]
        if len(matches)==1:
            self.underlay={'row':matches[0],'source_before':before['observation_ref'],'source_after':after['observation_ref'],
                          'observed_frame_hash':after['frame_hash'],'scope':'exact pre-translation pixels'}
        elif self.underlay and self.underlay['row']['bbox']==box:
            value=self.underlay['row']['underlay_values'][0]
            changed={first[y][x] for y in range(len(first)) for x in range(len(first[0]))
                     if first[y][x]!=second[y][x] and (y,x) not in set(actor.pixels)}
            if value in changed:self.underlay=None
            else:self.underlay['scope']='retained under unchanged actor; no observed alteration of this support material, revisable'
        else:self.underlay=None

    def record(self, before, after, command, first, second, proposal=None, index=None, *, frames=None):
        additions=[]
        for name, provider in self.acquired_compositions.items():
            response=provider.record(before,after,command,first,second,proposal,index,frames=frames)
            additions.extend(response.get("events",[]))
        retained=self._record_existing(before,after,command,first,second,proposal,index)
        return {**retained,"events":[*retained.get("events",[]),*additions]} if additions else retained

    def _record_existing(self, before, after, command, first, second, proposal=None, index=None):
        self.events = []
        if before['levels_completed'] != after['levels_completed'] or before['level_epoch'] != after['level_epoch']:
            if self.actor_signature:
                self.passed.append({'score':after['levels_completed'],'observation_ref':after['observation_ref']})
            self.epoch = after['level_epoch']; self.blocked.clear(); self.tried.clear(); self.underlay=None
            self.contact_question=None
            return {'status':'support_boundary_rebind_required','events':self.events}
        self.epoch = before['level_epoch']
        if command.get('data'):
            if proposal and proposal.get('support_plan',{}).get('contact_service_question'):
                question=proposal['support_plan']['contact_service_question']
                self.contact_attempted.add(question['key']);self.contact_question=None
                self.events.append({'kind':'addressed_contact_response_observed','question':question,
                    'before':before['observation_ref'],'after':after['observation_ref'],
                    'scope':'Current context response only; no universal transport or useful outcome inferred.'})
            current = self.scene(first) if self.actor_signature else None
            if current and proposal and proposal.get('support_plan',{}).get('control'):
                components,actor,target,controls = current
                selected = [item for item in controls if bbox(item)==proposal['support_plan']['control']['bbox']]
                if len(selected)==1:
                    control=selected[0];row=association(control,'control');self.controls[row['term_ref']]=row
                    measurement=measure_remote_navigation_transition(before=first,after=second,before_components=components,
                        after_components=extract(second),control=control,actor=actor)
                    effect={'control_association_ref':row['term_ref'],'typed_transition_measurements':plain(measurement),
                            'before':before['observation_ref'],'after':after['observation_ref']}
                    self.effects.append(effect);self.tried[row['term_ref']]+=1
                    self.events.append({'kind':'remote_support_effect_measured','effect':effect,'usefulness':'unconfirmed'})
                    key=proposal['support_plan'].get('experiment_key')
                    if key:
                        self.control_questions.record_attempt(key)
                        self.events.append({'kind':'contextual_control_question_closed','question_key':key,
                            'before':before['observation_ref'],'after':after['observation_ref'],
                            'scope':'The same declared premises and input are no longer a new experiment; hidden equivalence is not established.'})
            self.remember_underlay(before,after,first,second)
            following=self.scene(second) if self.actor_signature else None
            if current and following and bbox(current[1])!=bbox(following[1]):
                edge={'epoch':before['level_epoch'],'command':copy.deepcopy(command),
                    'origin':bbox(current[1]),'landing':bbox(following[1]),
                    'before':before['observation_ref'],'after':after['observation_ref'],
                    'field_question':copy.deepcopy(proposal.get('support_plan',{}).get('contact_service_question')) if proposal else None,
                    'scope':'Observed contextual service edge, not an ordinary translation quantum or a universal transport rule.'}
                self.service_edges.append(edge);self.events.append({'kind':'contextual_body_relocation','edge':edge})
            return {'status':'support_control_observed','events':self.events}
        comparison=residual_correspondences(before,after,first,second)
        candidates=[item for item in comparison['candidates'] if item['before']['rectangular'] and item['before']['area']>1
                    and (self.actor_signature is None or item['before']['palette_value']==self.actor_signature[0][2])]
        if len(candidates)==1:
            old,new=candidates[0]['before'],candidates[0]['after']
            dx,dy=new['bbox'][0]-old['bbox'][0],new['bbox'][1]-old['bbox'][1]
            h,w=old['bbox'][3]-old['bbox'][1]+1,old['bbox'][2]-old['bbox'][0]+1
            if (dx==0 and abs(dy)==h) or (dy==0 and abs(dx)==w):
                components=extract(first)
                actors=[item for item in components if bbox(item)==old['bbox'] and item.value==old['palette_value']]
                if len(actors)==1:
                    actor=actors[0]
                    homologues=[item for item in components if shape(item)==shape(actor) and item.value!=actor.value
                        and sum(signature(peer)==signature(item) for peer in components)==1]
                    if self.target_signature is not None or len(homologues)==1:
                        self.actor_signature=signature(actor)
                        if self.target_signature is None:self.target_signature=signature(homologues[0])
                        self.directions[command['action_ref']]=(dy//h,dx//w)
                        x,y=new['bbox'][:2]
                        self.entered.add(tuple(first[y+yy][x+xx] for yy in range(h) for xx in range(w)))
                        self.events.append({'kind':'unit_translation_and_support_observed','command':command['action_ref'],
                            'delta':[dy,dx],'before':before['observation_ref'],'after':after['observation_ref']})
        elif self.actor_signature:
            current=self.scene(first);following=self.scene(second)
            if current and following and bbox(current[1])==bbox(following[1]):
                self.blocked.add((tuple(bbox(current[1])[:2]),command['action_ref'],digest(first)))
        current=self.scene(first) if self.actor_signature else None
        following=self.scene(second) if self.actor_signature else None
        if current and following:
            old_shapes={signature(item) for item in current[3]}
            for control in following[3]:
                if signature(control) in old_shapes:continue
                bands=measure_orthogonal_bands(control.pixels)['oriented_signature']
                markers=[item for item in current[0] if item.value==control.value and item.area<control.area
                    and set(item.pixels)&set(following[1].pixels)
                    and measure_orthogonal_bands(item.pixels)['oriented_signature']==bands]
                if len(markers)==1:
                    fact={'control_shape':shape(control),'marker_bands':bands,
                        'before':before['observation_ref'],'after':after['observation_ref'],
                        'marker_bbox':bbox(markers[0]),'body_bbox':bbox(following[1]),
                        'scope':'One observed appearance after body contact; recall on another material is a hypothesis requiring its own response.'}
                    self.control_introductions.append(fact)
                    self.events.append({'kind':'control_introduction_after_contact','fact':fact})
            pending=self.contact_question
            if pending and pending.get('mode')=='acquire_control' and bbox(following[1])==pending['bbox']:
                self.contact_attempted.add(pending['key']);self.contact_question=None
                self.events.append({'kind':'control_acquisition_contact_reconciled','question':pending,
                    'before':before['observation_ref'],'after':after['observation_ref'],
                    'introduced':any(signature(c) not in old_shapes for c in following[3])})
        self.remember_underlay(before,after,first,second)
        return {'status':'support_motion_observed','events':self.events}

    def geometry(self, rows, actor, controls):
        h,w=actor.bbox.height,actor.bbox.width; ro,co=actor.bbox.top%h,actor.bbox.left%w
        actor_pixels=set(actor.pixels);excluded={pixel for item in controls for pixel in item.pixels}
        support=set();owner={}
        restored=rows
        if self.underlay and self.underlay['row']['bbox']==[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right]:
            restored=[list(row) for row in rows]
            for y,x in actor_pixels:restored[y][x]=self.underlay['row']['underlay_values'][0]
        for item in extract(restored):
            if signature(item)==self.actor_signature or set(item.pixels)&excluded:continue
            if item.bbox.height%h or item.bbox.width%w or (item.bbox.top-ro)%h or (item.bbox.left-co)%w:continue
            box={(r,c) for r in range(item.bbox.top,item.bbox.bottom+1) for c in range(item.bbox.left,item.bbox.right+1)}
            if box-set(item.pixels)<=actor_pixels:
                support|=box
                for pixel in box:owner.setdefault(pixel,set()).add(item.value)
        # The reused V5 domain admits exact patterns already entered by the
        # controlled occurrence as well as rectangular layers. The guard must
        # retain this same premise when a target occludes part of a rectangle.
        for r in range((len(rows)-ro)//h):
            for c in range((len(rows[0])-co)//w):
                points=[(ro+r*h+dr,co+c*w+dc) for dr in range(h) for dc in range(w)]
                if tuple(restored[y][x] for y,x in points) in self.entered:
                    support.update(points)
                    for y,x in points:owner.setdefault((y,x),set()).add(restored[y][x])
        cells={(r,c) for r in range((len(rows)-ro)//h) for c in range((len(rows[0])-co)//w)
               if all((ro+r*h+dr,co+c*w+dc) in support for dr in range(h) for dc in range(w))}
        # Transport the same provisional occluded-material premise used by the
        # existing domain. This admits a contact experiment, not an acquired
        # permission: subsequent observations still have to bind the control.
        contract=self.config['dependency_measurement_contract']
        if ('missing_control_smaller_same_palette_band_homologue_contact' in contract['permission_models']
                and 'entered_pattern_occluded_by_homologous_item' in contract['surface_models']):
            components=extract(rows)
            for row in self.controls.values():
                pixels=tuple((r,c) for r,c,v in row['normalized_valued_pixels'])
                values={v for r,c,v in row['normalized_valued_pixels']}
                if len(values)!=1:continue
                if any(signature(item)==tuple(map(tuple,row['normalized_valued_pixels'])) for item in components):continue
                bands=measure_orthogonal_bands(pixels)['oriented_signature']
                for item in components:
                    if item.value not in values or item.area>=len(pixels):continue
                    if measure_orthogonal_bands(item.pixels)['oriented_signature']!=bands:continue
                    mask=set(item.pixels)
                    for r in range((len(rows)-ro)//h):
                        for c in range((len(rows[0])-co)//w):
                            points={(ro+r*h+dr,co+c*w+dc) for dr in range(h) for dc in range(w)}
                            if not points&mask:continue
                            remaining={rows[y][x] for y,x in points-mask}
                            if len(remaining)==1 and (next(iter(remaining)),)*(h*w) in self.entered:
                                cells.add((r,c))
        return cells,owner,(h,w,ro,co)

    def propose(self, observation, rows, inputs, remaining):
        self.last_calculation = None
        self.equivalences = []
        if not self.actor_signature or remaining<=0 or 'ACTION6' not in observation['available_action_refs']:return None
        scene=self.scene(rows)
        if not scene:return None
        components,actor,target,controls=scene
        if not controls:return None
        if self.contact_question and bbox(actor)==self.contact_question['bbox']:
            field=self.contact_question
            bound=[item for item in controls if association(item,'control')['term_ref']==field['control_ref']]
            if len(bound)==1 and field['key'] not in self.contact_attempted:
                item=bound[0];control={'bbox':bbox(item),'association':association(item,'control')}
                action={'action_ref':'ACTION6','data':{'x':item.bbox.left+item.bbox.width//2,'y':item.bbox.top+item.bbox.height//2}}
                result=self.make(observation,rows,actor,[action],[None],control,
                    'Retest the measured field intervention with the body now on its addressed field. Persistence, relocation and no response remain rival outcomes.')
                result['support_plan']['contact_service_question']=copy.deepcopy(field)
                result['bundle_template']['frozen_support_plan']=plain(result['support_plan'])
                return result
        cells,owners,grid=self.geometry(rows,actor,controls)
        h,w,ro,co=grid;start=((actor.bbox.top-ro)//h,(actor.bbox.left-co)//w)
        terminal=((target.bbox.top-ro)//h,(target.bbox.left-co)//w)
        cells.add(terminal)
        if start not in cells:return None
        allowed={item['action_ref'] for item in inputs if not item.get('data')}
        unknown=sorted(allowed-set(self.directions))
        if unknown:
            # An unbound direction is a one-primitive experiment, never part of
            # a predicted path. The current body and target remain bound.
            return self.make(observation,rows,actor,[{'action_ref':unknown[0]}],[None],None,
                             'Acquire the missing input displacement under the current support hypothesis.')
        associations=[association(actor,'moving'),association(target,'fixed'),*self.controls.values()]
        memory={'moving_association_refs':[associations[0]['term_ref']],'fixed_association_refs':[associations[1]['term_ref']],
                'control_association_refs':list(self.controls),'observed_lattice_calibration_rows':[{'row_pitch':h,'col_pitch':w,'row_phase':ro,'col_phase':co}],
                'observed_entered_surface_rows':[{'before_pattern':list(pattern)} for pattern in sorted(self.entered)],
                'observed_remote_effect_rows':self.quotient_effects(rows,actor,controls)}
        contract={**self.config['dependency_measurement_contract'],'interface_steps':self.directions,'maximum_executable_series_actions':min(16,remaining)}
        calculated=plain(measure_support_navigation_domain(frame=rows,components=components,memory=memory,
            associations=associations,contract=contract,available_actions=observation['available_action_refs'],
            current_input_aligned_underlay_values=self.underlay['row']['underlay_values'] if self.underlay else (),
            input_aligned_entity_bboxes=(actor.bbox,) if self.underlay else (),
            current_translation_underlay_rows=(self.underlay['row'],) if self.underlay and self.underlay['observed_frame_hash']==observation['frame_hash'] else ()))
        self.last_calculation=calculated
        if not calculated.get('complete',False) and calculated.get('tested_states'):
            return {'status':'support_search_incomplete','actions':[], 'question':{'reason':'Existing finite search bound reached; not a proof of impossibility or a reason to repeat a known intervention.'},
                    'calculation':calculated,'equivalences':self.equivalences}
        if not calculated.get('witness_present'):
            contact=self.contact_access(observation,rows,components,actor,controls,memory,associations,contract,remaining)
            if contact:return contact
        if calculated.get('witness_present'):
            actions=[];positions=[];control=None
            for action,data,pathrow in zip(calculated['executable_series_action_refs'],calculated['executable_series_action_payloads'],calculated['executable_series_path_rows']):
                command={'action_ref':action}
                if data:
                    command['data']=data
                    selected=[item for item in controls if item.bbox.left<=data['x']<=item.bbox.right and item.bbox.top<=data['y']<=item.bbox.bottom]
                    if len(selected)!=1:break
                    control={'bbox':bbox(selected[0]),'association':association(selected[0],'control')}
                actions.append(command);positions.append([co+pathrow[2][1]*w,ro+pathrow[2][0]*h])
                if data:break
            if actions:
                return self.make(observation,rows,actor,actions,positions,control,
                    'Execute the existing support-domain witness; seal at a configuration intervention and revalidate its actual support.',calculated)
        parents={start:None};pending=deque([start])
        while pending:
            here=pending.popleft()
            for action,delta in sorted(self.directions.items()):
                there=here[0]+delta[0],here[1]+delta[1]
                if there in cells and there not in parents:
                    parents[there]=(here,action);pending.append(there)
        distance=lambda cell:abs(cell[0]-terminal[0])+abs(cell[1]-terminal[1])
        closest=min(parents,key=lambda cell:(distance(cell),cell))
        if distance(closest)<distance(start):
            path=[];cursor=closest
            while parents[cursor]:previous,action=parents[cursor];path.append((action,cursor));cursor=previous
            path.reverse();path=path[:min(16,remaining)]
            return self.make(observation,rows,actor,[{'action_ref':action} for action,_ in path],
                [[co+cell[1]*w,ro+cell[0]*h] for _,cell in path],None,
                'Approach the current target frontier through observed rectangular support hypotheses; interrupt on first motion mismatch.')
        blocked_values=set()
        for delta in self.directions.values():
            cell=start[0]+delta[0],start[1]+delta[1]
            if distance(cell)<distance(start) and cell not in cells:
                for dr in range(h):
                    for dc in range(w):
                        y,x=ro+cell[0]*h+dr,co+cell[1]*w+dc
                        if 0<=y<len(rows) and 0<=x<len(rows[0]):blocked_values.add(rows[y][x])
        actor_underlay={value for pixel in actor.pixels for value in owners.get(pixel,())}
        safe=[item for item in controls if item.value not in actor_underlay]
        if not safe:return None
        projected=self.experiment_context(scene,rows,cells,grid)
        candidates=[]
        for item in safe:
            command={'action_ref':'ACTION6','data':{'x':item.bbox.left+item.bbox.width//2,'y':item.bbox.top+item.bbox.height//2}}
            key=self.control_questions.question_key(observation['level_epoch'],'remote_support_response',command,projected)
            if key not in self.control_questions.attempted:candidates.append((item,key))
        if not candidates:
            return {'status':'known_control_questions_closed','actions':[], 'question':{'reason':'Current control responses were already tested; missing access or capability remains an open dependency.'},
                    'calculation':calculated,'equivalences':self.equivalences}
        selected,key=min(candidates,key=lambda pair:(pair[0].value not in blocked_values,bbox(pair[0])))
        control={'bbox':bbox(selected),'association':association(selected,'control')}
        point={'x':selected.bbox.left+selected.bbox.width//2,'y':selected.bbox.top+selected.bbox.height//2}
        result=self.make(observation,rows,actor,[{'action_ref':'ACTION6','data':point}],[[actor.bbox.left,actor.bbox.top]],control,
            'Test the measured remote control homologue associated with the blocked frontier; support persistence and usefulness remain uncertain.')
        result['support_plan']['experiment_key']=key
        result['bundle_template']['frozen_support_plan']=plain(result['support_plan'])
        return result

    def contact_access(self,observation,rows,components,actor,controls,memory,associations,contract,remaining):
        if not self.config.get('addressed_reciprocal_field_contact',False):return None
        h,w=actor.bbox.height,actor.bbox.width;ro,co=actor.bbox.top%h,actor.bbox.left%w
        fields=current_reciprocal_fields(self.effects,rows,observation['level_epoch'],h,w)
        for field in fields:field['mode']='service_contrast'
        # Recall the actually observed contact/introduction relation before
        # repeating a known service on another occurrence. Palette is rebound;
        # it is not a universal permission or an injected control identity.
        current_values={item.value for item in controls}
        known_bands={tuple(fact['marker_bands']) for fact in self.control_introductions} if self.config['control_introduction_contact'] else set()
        for marker in components:
            if marker.value in current_values or marker.area<=1:continue
            bands=tuple(measure_orthogonal_bands(marker.pixels)['oriented_signature'])
            if bands not in known_bands:continue
            mask=set(marker.pixels)
            for r,c in sorted({((y-ro)//h,(x-co)//w) for y,x in mask}):
                points={(ro+r*h+dr,co+c*w+dc) for dr in range(h) for dc in range(w)}
                residual={rows[y][x] for y,x in points-mask}
                if len(residual)!=1 or (next(iter(residual)),)*(h*w) not in self.entered:continue
                top,left=ro+r*h,co+c*w
                pattern=tuple(rows[top+dr][left+dc] for dr in range(h) for dc in range(w))
                fields.append({'mode':'acquire_control','control_ref':None,'marker_value':marker.value,
                    'bbox':[left,top,left+w-1,top+h-1],'pattern':pattern,'alternatives':[pattern],
                    'evidence':[ref for fact in self.control_introductions if tuple(fact['marker_bands'])==bands for ref in (fact['before'],fact['after'])]})
        offers=[];bound={association(item,'control')['term_ref'] for item in controls}
        for field in fields:
            relation='control_introduction_contact' if field['mode']=='acquire_control' else 'body_on_observed_response_field'
            field['key']=self.control_questions.question_key(observation['level_epoch'],relation,field['control_ref'],field['bbox'])
            if field['key'] in self.contact_attempted or (field['mode']!='acquire_control' and field['control_ref'] not in bound):continue
            if self.contact_question and field['key']!=self.contact_question['key']:continue
            addressed=addressed_component(field);target=field_association(field)
            scoped={**memory,'fixed_association_refs':[target['term_ref']]}
            calculation=plain(measure_support_navigation_domain(frame=rows,components=(*components,addressed),memory=scoped,
                associations=[associations[0],target,*self.controls.values()],contract=contract,
                available_actions=observation['available_action_refs'],
                current_input_aligned_underlay_values=self.underlay['row']['underlay_values'] if self.underlay else (),
                input_aligned_entity_bboxes=(actor.bbox,) if self.underlay else (),
                current_translation_underlay_rows=(self.underlay['row'],) if self.underlay and self.underlay['observed_frame_hash']==observation['frame_hash'] else ()))
            if calculation.get('witness_present') and calculation.get('complete'):offers.append((calculation['path_length'],field,calculation))
        if not offers:return None
        offers.sort(key=lambda row:(row[1]['mode']!='acquire_control',row[0],row[1]['bbox']));_,field,calculation=offers[0]
        self.contact_question=copy.deepcopy(field)
        actions=[];positions=[];control=None
        for action,data,pathrow in zip(calculation['executable_series_action_refs'],calculation['executable_series_action_payloads'],calculation['executable_series_path_rows']):
            command={'action_ref':action}
            if data:
                selected=[item for item in controls if item.bbox.left<=data['x']<=item.bbox.right and item.bbox.top<=data['y']<=item.bbox.bottom]
                if len(selected)!=1:break
                control={'bbox':bbox(selected[0]),'association':association(selected[0],'control')};command['data']=data
            actions.append(command);positions.append([co+pathrow[2][1]*w,ro+pathrow[2][0]*h])
            if data:break
        if not actions:return None
        why=('Revalidate the previously observed control-introduction relation on a new current marker occurrence; retain the parent goal and inspect whether a control actually appears.'
             if field['mode']=='acquire_control' else 'Prepare contact with an actually changed reciprocal field, then test its command in that context; preserve the official parent goal. No nonlocal effect is presumed.')
        result=self.make(observation,rows,actor,actions,positions,control,why,calculation)
        result['support_plan']['contact_access_question']={**field,'equally_short_alternatives':[f for n,f,c in offers if n==offers[0][0] and f['mode']==field['mode']],
            'falsifier':'Changed field pattern, failed motion, changed control binding or response inconsistent with the current contrast.'}
        result['bundle_template']['frozen_support_plan']=plain(result['support_plan'])
        return result

    def experiment_context(self, scene, rows, cells=None, grid=None):
        components,actor,target,controls=scene
        if cells is None:cells,_,grid=self.geometry(rows,actor,controls)
        h,w,ro,co=grid
        return {'actor_bbox':bbox(actor),'target':signature(target),'supported_cells':sorted(cells),
                'controls':[(signature(item),bbox(item)) for item in controls],
                'support_patterns':[(r,c,tuple(rows[ro+r*h+dr][co+c*w+dc] for dr in range(h) for dc in range(w))) for r,c in sorted(cells)]}

    def quotient_effects(self, rows, actor, controls):
        """Share current search states for observationally identical laws.

        Original fits remain in self.effects. Same command, contact permissions,
        primitive cost and all four projected support successors are required.
        A changed shape, binding or response reopens the alternatives.
        """
        if not self.config['equivalence']['enabled']:return self.effects
        restored=[list(row) for row in rows]
        if self.underlay and self.underlay['row']['bbox']==[actor.bbox.top,actor.bbox.left,actor.bbox.bottom,actor.bbox.right]:
            for y,x in actor.pixels:restored[y][x]=self.underlay['row']['underlay_values'][0]
        excluded={p for control in controls for p in control.pixels}
        rectangles=[item for item in extract(restored) if item.area==item.bbox.height*item.bbox.width and not set(item.pixels)&excluded]
        aliases={};groups=defaultdict(list)
        for effect in self.effects:
            for fit in effect['typed_transition_measurements']['rigid_fit_rows']:
                key=(effect['control_association_ref'],fit['changed_value'],fit['pivot_value'],fit['pivot_height'],fit['pivot_width'],fit['quarter_turns_clockwise'])
                other_changes={value for other in self.effects if other['control_association_ref']!=effect['control_association_ref']
                               for row in other['typed_transition_measurements']['cell_transition_rows']
                               for value in (*row['before_pattern'],*row['after_pattern'])}
                if {fit['changed_value'],fit['pivot_value']}&other_changes:continue
                pivots=[item for item in rectangles if (item.value,item.bbox.height,item.bbox.width)==key[2:5]]
                points=tuple(sorted((2*y,2*x) for item in rectangles if item.value==fit['changed_value'] for y,x in item.pixels))
                if not pivots or not points:continue
                futures=[]
                for pivot in pivots:
                    centre=(pivot.bbox.top+pivot.bbox.bottom,pivot.bbox.left+pivot.bbox.right)
                    orbit=tuple(_support_transform(points,SimpleNamespace(kind='QUARTER_TURN',pivot=centre,
                                quarter_turns=(step*fit['quarter_turns_clockwise'])%4)) for step in range(4))
                    futures.append((bbox(pivot),orbit))
                group=(key[:5],digest(futures))
                if key not in groups[group]:groups[group].append(key)
        for (premises,geometry),alternatives in groups.items():
            if len(alternatives)<2:continue
            representative=min(alternatives)
            for alternative in alternatives:aliases[alternative]=representative
            self.equivalences.append({'control_relation':premises[0],'alternatives':[item[-1] for item in sorted(alternatives)],
                'representative':representative[-1],'current_future_supports_digest':geometry,
                'preserved_model_dimensions':['same command binding and primitive cost','same four support successors','same actor transitions','same contact-grant conditions'],
                'unmodeled_resources_or_hidden_effects':'unknown, not declared equivalent',
                'falsifier':'New shape, control binding, permission condition or response separating the alternatives; recompute before using the quotient.'})
        result=copy.deepcopy(self.effects)
        for effect in result:
            rows=effect['typed_transition_measurements']['rigid_fit_rows']
            effect['typed_transition_measurements']['rigid_fit_rows']=[fit for fit in rows
                if (lambda key:aliases.get(key,key)==key)((effect['control_association_ref'],fit['changed_value'],fit['pivot_value'],fit['pivot_height'],fit['pivot_width'],fit['quarter_turns_clockwise']))]
        return result

    def make(self, observation, rows, actor, actions, positions, control, why, calculation=None):
        plan={'actor_signature':self.actor_signature,'actor_bbox':bbox(actor),'positions':positions,'control':control,
              'calculation':calculation if calculation is not None else self.last_calculation,'underlay':copy.deepcopy(self.underlay),
              'equivalence_classes':copy.deepcopy(self.equivalences),'scope':self.config['equivalence']['scope']}
        steps=[]
        for action,position in zip(actions,positions):
            step={'action':action,'expected_after':{'actor_top_left':position} if position else None}
            if action.get('data'):
                step['locus_witness']=ObservedInputDomain.make_locus_witness(observation,rows,(action['data']['x'],action['data']['y']),reason=why,evidence=[observation['observation_ref']])
            steps.append(step)
        reference='C_support_'+digest([observation['observation_ref'],actions])[:16]
        facts={'controlled_translation_observed':True,'current_roles_bound':True,'support_interpretation_revisable':True}
        return {'status':'proposed','kind':'reconfigurable_support','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,
                'binding':{'level_epoch':observation['level_epoch'],'levels_completed':observation['levels_completed'],'observation_ref':observation['observation_ref']},
                'compositions':[{'id':reference,'observed':False,'open_question':why,'properties':{'role':'conditional_support_frontier'},'relations':['contributes_to:G_official_completion']}],
                'question':{'reason':why},'route_refs':[observation['observation_ref']],
                'bundle_template':{'operation_key':'OP18','composition_ref':reference,'objective_ref':'G_official_completion','preserve_refs':[],
                    'actions':actions,'purpose':why,'preconditions':facts,'evidence':[observation['observation_ref']],
                    'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':reference}}}

    def bind(self, proposal, domain):
        for step in proposal['steps']:
            if step.get('locus_witness'):step['point_binding']=step['locus_witness']

    def before(self, proposal, index, public, observation):
        for key, provider in self.acquired_compositions.items():
            if proposal["support_plan"].get(key):return provider.before(proposal, index, public, observation)
        expected=proposal['support_plan']['actor_bbox'][:2] if index==0 else proposal['support_plan']['positions'][index-1]
        current=self.scene(public.frame_rows)
        ok=current is not None and public.level==proposal['binding']['level_epoch'] and public.levels_completed==proposal['binding']['levels_completed']
        ok=ok and (expected is None or bbox(current[1])[:2]==list(expected))
        ok=ok and proposal['actions'][index]['action_ref'] in public.available_action_refs
        ok=ok and proposal['support_plan'].get('experiment_key') not in self.control_questions.attempted
        if ok and proposal['support_plan'].get('experiment_key'):
            projected=self.experiment_context(current,public.frame_rows)
            key=self.control_questions.question_key(public.level,'remote_support_response',proposal['actions'][index],projected)
            ok=key==proposal['support_plan']['experiment_key']
        if ok and not proposal['actions'][index].get('data') and proposal['support_plan']['positions'][index] is not None:
            cells,_,grid=self.geometry(public.frame_rows,current[1],current[3]);h,w,ro,co=grid
            x,y=proposal['support_plan']['positions'][index]
            ok=((y-ro)//h,(x-co)//w) in cells or (x,y)==(current[2].bbox.left,current[2].bbox.top)
            field=proposal['support_plan'].get('contact_access_question')
            if not ok and field and [x,y]==field['bbox'][:2]:
                actual=tuple(public.frame_rows[y+dr][x+dc] for dr in range(h) for dc in range(w))
                ok=actual in [tuple(p) for p in field['alternatives']]
        return {'admitted':bool(ok),'reason':'current_support_actor_and_epoch_bound' if ok else 'support_binding_changed'}

    def after(self, proposal, index, before, after, first, second):
        for key, provider in self.acquired_compositions.items():
            if proposal["support_plan"].get(key):return provider.after(proposal, index, before, after, first, second)
        if before['levels_completed']!=after['levels_completed'] or before['level_epoch']!=after['level_epoch'] or before['state']!=after['state']:
            return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
        scene=self.scene(second);expected=proposal['support_plan']['positions'][index]
        matched=scene is not None and bbox(scene[1])[:2]==list(expected) if expected is not None else None
        if matched and proposal['actions'][index].get('data'):
            cells,_,grid=self.geometry(second,scene[1],scene[3]);h,w,ro,co=grid
            matched=((scene[1].bbox.top-ro)//h,(scene[1].bbox.left-co)//w) in cells
        return {'matched':matched,'seal_prefix':bool(proposal['actions'][index].get('data')) or matched is not True,
                'reason':'compare_observed_actor_with_conditional_support_prediction'}
