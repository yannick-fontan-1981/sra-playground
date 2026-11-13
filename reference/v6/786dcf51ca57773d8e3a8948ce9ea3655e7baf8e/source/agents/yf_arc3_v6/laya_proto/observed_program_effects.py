"""Align a public active-member cue with intermediate packet effects.

This module constructs scoped hypotheses, not universal operator semantics.
It receives measured supports and public images; it has no environment handle.
"""
from collections import defaultdict
from geometric_observer import components
from terminal_composition import identity

def patch(rows,box):
    x,y,r,b=box
    return [list(row[x:r+1]) for row in rows[y:b+1]]

def world_parts(rows,exclusions):
    out=defaultdict(list)
    for e in components(rows):
        x,y,r,b=e['bbox']
        if e['area']<3 or any(not(r<a or x>c or b<d or y>f) for a,d,c,f in exclusions):continue
        signature=identity([sorted(e['normalized']),e['color'],e['area']])
        out[signature].append({'position':[x,y],'bbox':e['bbox'],'palette':e['color'],'area':e['area'],'mask':[list(p) for p in sorted(e['normalized'])]})
    return out

def residual_effect(before,after,exclusions):
    a=world_parts(before,exclusions);b=world_parts(after,exclusions);translations=[];changes=[]
    for signature in sorted(set(a)|set(b)):
        left={tuple(e['position']):e for e in a.get(signature,[])};right={tuple(e['position']):e for e in b.get(signature,[])};same=set(left)&set(right)
        first=[e for p,e in left.items() if p not in same];last=[e for p,e in right.items() if p not in same]
        if len(first)==len(last)==1:
            x,y=first[0]['position'];u,v=last[0]['position'];translations.append({'signature':signature,'shape':first[0]['mask'],'palette':first[0]['palette'],'area':first[0]['area'],'before':first[0]['position'],'after':last[0]['position'],'vector':[u-x,v-y],'identity_status':'unique_residual_correspondence_hypothesis'})
        elif first or last:changes.append({'signature':signature,'before_count':len(first),'after_count':len(last),'before_positions':[e['position'] for e in first],'after_positions':[e['position'] for e in last],'identity_status':'appearance_change_not_object_death_proof'})
    return {'translations':translations,'other_changes':changes}

def align_program_packet(before,frames,*,members,controls,observation_ref,epoch,command_ref,after_observation_ref):
    if len(members)<2 or not frames:return {'status':'unknown','reason':'no_multi_member_reference_or_packet','phases':[]}
    baselines=[patch(before,e['bbox']) for e in members];images=[before,*frames];phases=[];active=None;stop=len(images)-1
    for index,rows in enumerate(images[1:],1):
        changed=[j for j,e in enumerate(members) if patch(rows,e['bbox'])!=baselines[j]]
        if len(changed)>1:
            # A new scene or global collection rewrite cannot identify an operator.
            if active is not None:phases[-1]['end_exclusive']=index;active=None
            stop=index;break
        current=changed[0] if changed else None
        if current!=active:
            if active is not None:phases[-1]['end_exclusive']=index
            if current is not None:phases.append({'member_index':current,'label':members[current]['color'],'start':index})
            active=current
    if active is not None:phases[-1]['end_exclusive']=stop
    if len(phases)<2:return {'status':'unknown','reason':'insufficient_unique_active_member_phases','phases':phases}
    indices=[p['member_index'] for p in phases]
    if len(set(indices))!=len(indices):return {'status':'unknown','reason':'repeated_phase_binding_requires_disambiguation','phases':phases}
    pane=[min(e['bbox'][0] for e in members),0,max(e['bbox'][2] for e in members),len(before)-1]
    footer=[0,min(e['bbox'][1] for e in controls),len(before[0])-1,len(before)-1]
    for phase in phases:
        start=phase['start'];end=phase.get('end_exclusive',stop)
        if end<=start:phase['effect']={'status':'unknown','reason':'no_observed_phase_duration'};continue
        # The next phase's marker is excluded with the whole editor pane. Its
        # activation snapshot is an observed endpoint, never the final new scene.
        endpoint=end if end<stop else end-1
        phase['effect']=residual_effect(images[start],images[endpoint],[pane,footer]);phase['endpoint']=endpoint
        phase['evidence']=[{'observation_ref':observation_ref,'packet_index':start-1},{'observation_ref':observation_ref,'packet_index':endpoint-1}]
    signatures=[set(t['signature'] for t in p['effect'].get('translations',[])) for p in phases if p['effect'].get('translations')]
    shared=set.intersection(*signatures) if signatures else set()
    roles=[{'signature':s,'supporting_phase_count':sum(any(t['signature']==s for t in p['effect'].get('translations',[])) for p in phases),'status':'candidate_operand_role'} for s in sorted(shared)]
    return {'status':'phase_aligned_candidates','epoch':epoch,'command_ref':command_ref,'before_ref':observation_ref,'after_ref':after_observation_ref,'phases':phases,'candidate_roles':roles,'collection_order':indices,'excluded_from':stop,'editor_geometry':{'member_column':pane,'member_size':[members[0]['bbox'][2]-members[0]['bbox'][0]+1,members[0]['bbox'][3]-members[0]['bbox'][1]+1],'controls':[{'bbox':e['bbox'],'color':e['color'],'patch':patch(before,e['bbox'])} for e in controls],'footer':footer},'initial_members':members,'scopes':['Public member-patch changes bind labels to time intervals.','Residual translation is a correspondence hypothesis, not universal physical-object identity.','A single execution cannot prove a context-independent operator law.','Final scene rewrite and official boundary are excluded from per-operator attribution.'],'predictive_use_allowed':False}

def translation_candidates(alignment):
    if alignment.get('status')!='phase_aligned_candidates':return []
    roles={r['signature'] for r in alignment['candidate_roles'] if r['supporting_phase_count']>=2};members=alignment['initial_members'];result=[]
    for phase in alignment['phases']:
        motions=[t for t in phase['effect'].get('translations',[]) if t['signature'] in roles]
        if len(motions)!=1:continue
        motion=motions[0];bindings=[i for i,e in enumerate(members) if e['color']==motion['palette']]
        if len(bindings)!=1:continue
        controls=[c for c in alignment['editor_geometry']['controls'] if c['color']==phase['label']]
        if len(controls)!=1:continue
        binding='first_member' if bindings[0]==0 else 'last_member' if bindings[0]==len(members)-1 else None
        if binding is None:continue
        rule={'kind':'observed_program_translation','acquisition_epoch':alignment['epoch'],'label':phase['label'],'glyph_patch':controls[0]['patch'],'command_ref':alignment['command_ref'],'vector':motion['vector'],'operand_shape':motion['shape'],'operand_area':motion['area'],'operand_palette_binding':binding,'phase_binding':'one changed collection-member patch','source_refs':phase['evidence'],'status':'candidate','predictive_use_allowed':False,'scope':'Conditional experiment after exact glyph and structural operand rebinding; local supports and blocking remain unknown.'}
        rule['rule_id']='program-translation:'+identity(rule)[:20];result.append(rule)
    return result

def predict_operator(rule,rows,*,members,controls,exclusions):
    if not members:return {'status':'not_applicable','reason':'empty_collection','rule_id':rule['rule_id']}
    glyphs=[e for e in controls if e['color']==rule['label'] and patch(rows,e['bbox'])==rule['glyph_patch']]
    if len(glyphs)!=1:return {'status':'not_applicable','reason':'label_glyph_not_revalidated','rule_id':rule['rule_id']}
    member=members[0] if rule['operand_palette_binding']=='first_member' else members[-1];palette=member['color'];matches=[]
    for es in world_parts(rows,exclusions).values():
        matches.extend(e for e in es if e['palette']==palette and e['area']==rule['operand_area'] and e['mask']==rule['operand_shape'])
    if len(matches)!=1:return {'status':'not_applicable','reason':'operand_correspondence_ambiguous_or_absent','rule_id':rule['rule_id'],'matches':len(matches)}
    entity=matches[0];x,y=entity['position'];dx,dy=rule['vector']
    return {'status':'conditional_prediction','rule_id':rule['rule_id'],'rule_digest':identity(rule),'source_refs':rule['source_refs'],'before':entity['position'],'expected_after':[x+dx,y+dy],'operand_palette':palette,'operand_shape':rule['operand_shape'],'operand_area':rule['operand_area'],'local_support_status':'unknown','predictive_use_allowed':False,'scope':'Prospective phase test; a matching outcome confirms only this observed context.'}

def compare_operator_prediction(prediction,later,exclusions):
    if prediction.get('status')!='conditional_prediction':return {'status':'not_evaluated','reason':prediction.get('reason','no_prediction')}
    matches=[]
    for es in world_parts(later,exclusions).values():
        matches.extend(e['position'] for e in es if e['palette']==prediction['operand_palette'] and e['area']==prediction['operand_area'] and e['mask']==prediction['operand_shape'])
    if len(matches)!=1:return {'status':'unknown','reason':'post_operand_correspondence_ambiguous_or_absent','positions':matches}
    return {'status':'confirmed_in_observed_context' if matches[0]==prediction['expected_after'] else 'refuted_in_observed_context','observed_position':matches[0],'expected_position':prediction['expected_after'],'universal_rule_confirmed':False}

def predict_program_prefix(alignment,rows,*,members,controls,command_ref,observation_ref,epoch):
    """Freeze a conditional prefix before the command, including glyph bindings."""
    rules=translation_candidates(alignment);order=alignment.get('collection_order',[])
    if len(order)<2 or any(b-a!=-1 for a,b in zip(order,order[1:])):return {'status':'unknown','reason':'execution_order_not_bound'}
    if command_ref!=alignment['command_ref'] or not members:return {'status':'unknown','reason':'command_or_collection_not_bound'}
    geometry=alignment['editor_geometry'];exclusions=[geometry['member_column'],geometry['footer']];steps=[];position=None
    for member_index in range(len(members)-1,-1,-1):
        label=members[member_index]['color'];matches=[r for r in rules if r['label']==label]
        if len(matches)!=1:break
        rule=matches[0];candidate=predict_operator(rule,rows,members=members,controls=controls,exclusions=exclusions)
        if candidate['status']!='conditional_prediction':break
        if position is None:position=candidate['before']
        candidate={**candidate,'before':list(position),'expected_after':[position[0]+rule['vector'][0],position[1]+rule['vector'][1]],'member_index':member_index,'label':label,'glyph_validated_at':observation_ref,'glyph_frame_digest':identity(rows)}
        steps.append(candidate);position=candidate['expected_after']
    return {'status':'conditional_prefix' if steps else 'unknown','steps':steps,'binding':{'observation_ref':observation_ref,'epoch':epoch,'frame_digest':identity(rows),'command_ref':command_ref},'glyph_validation_scope':'Frozen at command dispatch; disappearance of the editing interface during execution does not itself falsify the glyph association.','prefix_scope':'Each projected displacement is conditional on the previous expected position and preserved operand; seal on first mismatch or global rewrite.','unknown_suffix':len(steps)<len(members),'predictive_use_allowed':False,'exclusions':exclusions}
