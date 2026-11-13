"""Measured ordered-support compositions, using the adjacent declarative contract.

The runtime reads frames only: no palette constants, game coordinates, stored
solutions, level branches or oracle access. Hypotheses remain scope-limited.
"""
import json,math
from pathlib import Path
from geometric_observer import components
POLICY_PATH=Path(__file__).with_name('ordered_support.drm.json')


def center(part):
    l,t,r,b=part['bbox'];return [(l+r)/2,(t+b)/2]


def fixed_axes(rows,parts,members,root,arena,retained=None):
    """Measure anchored vertical segments, excluding members and mobile axis."""
    width=members[0]['bbox'][2]-members[0]['bbox'][0]+1
    member_values={p['color'] for p in members};mobile_y=center(root)[1]
    candidates=[]
    if retained is None:
        for x in sorted({center(p)[0] for p in members}):
            column=[p for p in members if center(p)[0]==x]
            if len(column)<2:continue
            top=min(p['bbox'][1] for p in column)
            anchors=[p for p in parts if p['rectangular'] and center(p)[0]==x and p['bbox'][3]<top
                     and p['bbox'][2]-p['bbox'][0]+1<=width/2 and p['bbox'][3]-p['bbox'][1]+1<=width/2
                     and p['color'] not in member_values]
            if len(anchors)!=1:continue
            a=anchors[0]
            candidates.append({'id':'F'+str(len(candidates)),'anchor_bbox':a['bbox'],'anchor_value':a['color'],'axis_x':x})
    else:candidates=retained
    found=[]
    for candidate in candidates:
        l,t,r,b=candidate['anchor_bbox']
        if any(rows[y][x]!=candidate['anchor_value'] for y in range(t,b+1) for x in range(l,r+1)):
            raise ValueError('Retained fixed anchor changed')
        pieces=[p for p in parts if l<=p['bbox'][0]<=p['bbox'][2]<=r and b<p['bbox'][1]<=p['bbox'][3]<=arena['bbox'][3]
                and p['bbox'][3]-p['bbox'][1]+1<=width
                and p['color'] not in member_values and p['color']!=candidate['anchor_value']
                and not (p['bbox'][1]<=mobile_y+0.5 and p['bbox'][3]>=mobile_y-0.5)]
        if not pieces:
            if retained is not None:raise ValueError('Fixed axis has no visible confirmation')
            continue
        endpoint=max(p['bbox'][3] for p in pieces)
        if 'endpoint' in candidate and endpoint>candidate['endpoint']:
            raise ValueError('Fixed support endpoint unexpectedly extended')
        # An occluded endpoint is retained as a hypothesis, never moved with a cube.
        found.append({**candidate,'endpoint':candidate.get('endpoint',endpoint),'visible_endpoint':endpoint,
                      'status':'observed_anchor_and_visible_segments; fixed-axis relation remains scoped hypothesis'})
    return found


def scene(rows,separator_y=None,reference_members=None,fixed_supports=None):
    parts=components(rows);width=len(rows[0])
    separators=[p for p in parts if p['rectangular'] and p['bbox'][0]==0 and p['bbox'][2]==width-1 and p['bbox'][1]==p['bbox'][3]]
    if separator_y is None:
        if len(separators)!=1:raise ValueError('Unresolved reference separator: '+str(len(separators)))
        split=separators[0]['bbox'][1]
    else:
        split=separator_y
        if not 0<split<len(rows)-1:raise ValueError('Invalid retained reference partition')
    below=[p for p in parts if p['bbox'][1]>split]
    above=[p for p in parts if p['bbox'][3]<split]
    members=[p for p in below if p['rectangular'] and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1] and p['area']>4
             and any(q['rectangular'] and q['area']==p['area'] and q['color']==p['color'] for q in above)]
    if reference_members is not None:
        members=reference_members
        for member in members:
            l,t,r,b=member['bbox']
            if not any(rows[y][x]==member['color'] for y in range(t,b+1) for x in range(l,r+1)):
                raise ValueError('Retained reference member no longer observable')
    if len(members)<2 or len({p['area'] for p in members})!=1:raise ValueError('Ambiguous compact reference family')
    member_width=members[0]['bbox'][2]-members[0]['bbox'][0]+1
    roots=[]
    for a in below:
        w=a['bbox'][2]-a['bbox'][0]+1;h=a['bbox'][3]-a['bbox'][1]+1
        if a['rectangular'] or w!=h or w<=member_width:continue
        for b in above:
            if a['color']==b['color'] and a['mask']==b['mask']:roots.append((a,b))
    if len(roots)!=1:raise ValueError('Ambiguous homologous support root')
    reference,root=roots[0]
    if not all(center(m)[0]>center(reference)[0] for m in members):raise ValueError('Unsupported reference axis direction')
    members.sort(key=lambda m:center(m)[0]);order=[m['color'] for m in members]
    if len(set(order))!=len(order):raise ValueError('Multiplicity requires an explicit member-assignment domain')
    active=[p for p in above if p['color'] in order and p['rectangular'] and p['area']==members[0]['area']]
    if sorted(p['color'] for p in active)!=sorted(order):raise ValueError('Unresolved active member correspondence')
    arena=max((p for p in above if p['bbox'][0]>0 and p['bbox'][2]<width-1 and p['area']>root['area']),key=lambda p:p['area'])
    ref_y=center(reference)[1];ys=range(math.floor(ref_y),math.ceil(ref_y)+1)
    reference_background=max(below,key=lambda p:p['area'])['color']
    shaft_values={rows[y][x] for y in ys for x in range(reference['bbox'][2]+1,max(m['bbox'][2] for m in members)+2)}-set(order)-{reference_background}
    cy=center(root)[1]
    tip_pixels=[x for y in range(math.floor(cy),math.ceil(cy)+1) for x in range(root['bbox'][2]+1,arena['bbox'][2]+1) if rows[y][x] in shaft_values]
    if not tip_pixels:raise ValueError('Unresolved support tip')
    tip=max(tip_pixels)
    supports=fixed_axes(rows,above,active,root,arena,fixed_supports)
    mounted={p['color']:[f['id'] for f in supports if p['bbox'][0]<=f['axis_x']<=p['bbox'][2]
             and p['bbox'][1]<=f['endpoint'] and p['bbox'][3]>f['anchor_bbox'][3]] for p in active}
    carried=sorted((p for p in active if p['bbox'][1]<=cy<=p['bbox'][3] and p['bbox'][2]<tip),key=lambda p:p['bbox'][0])
    prefix=[p['color'] for p in carried]
    auxiliary=[]
    if prefix!=order[:len(prefix)]:
        if carried and all(mounted[p['color']] for p in carried):auxiliary=prefix;prefix=[]
        else:raise ValueError('Observed carried order violates reference prefix')
    return {'separator_y':split,'reference_members':[{k:p[k] for k in ('bbox','color','area')} for p in members],
        'root':{'bbox':root['bbox'],'center':center(root)},'tip':tip,'order':order,'prefix':prefix,
        'members':[{'color':p['color'],'bbox':p['bbox'],'center':center(p),'carried':p in carried,
                    'fixed_supports':mounted[p['color']]} for p in active],
        'fixed_supports':supports,'auxiliary_members':auxiliary,
        'arena_bbox':arena['bbox'],'member_width':member_width,'role_status':'morphological_hypotheses_until_effect_confirmation'}


class OrderedPlanner:
    def __init__(self):
        self.policy=json.loads(POLICY_PATH.read_text());self.vertical_step=None;self.extension_step=None
        self.effects=[];self.previous_order=None

    def observe(self,before,after,bundle,evidence):
        if before['order']!=after['order']:raise ValueError('Reference changed within level')
        if after['prefix'][:len(before['prefix'])]!=before['prefix']:raise ValueError('Constructed prefix was lost')
        dy=after['root']['center'][1]-before['root']['center'][1];dx=after['tip']-before['tip']
        actions=bundle['actions'];recipe=bundle['recipe']
        if recipe=='calibrate_vertical':
            if not dy or dx:raise ValueError('Vertical control hypothesis refuted')
            self.vertical_step=abs(dy)/len(actions)
        if recipe=='calibrate_extension':
            if not dx or dy:raise ValueError('Extension control hypothesis refuted')
            self.extension_step=abs(dx)/len(actions)
        changes=[]
        for a in before['members']:
            b=next(p for p in after['members'] if p['color']==a['color'])
            if a['center']!=b['center'] or a['carried']!=b['carried'] or a['fixed_supports']!=b['fixed_supports']:
                changes.append({'member':a['color'],'translation':[b['center'][i]-a['center'][i] for i in (0,1)],
                    'before_relation':'crossed_auxiliary' if a['color'] in before['auxiliary_members'] else ('on_support' if a['carried'] else 'free'),
                    'after_relation':'crossed_auxiliary' if b['color'] in after['auxiliary_members'] else ('on_support' if b['carried'] else 'free'),
                    'fixed_before':a['fixed_supports'],'fixed_after':b['fixed_supports']})
        observation={'recipe':recipe,'root_delta_y':dy,'tip_delta_x':dx,'member_changes':changes,
            'prefix_before':before['prefix'],'prefix_after':after['prefix'],'evidence':evidence,
            'scope':'observed composition and command set; not irreversible attachment'}
        if recipe=='separate_push' and not any(p['translation'][1]!=0 and p['after_relation']=='free' for p in changes):
            raise ValueError('Transverse separation hypothesis refuted')
        if recipe=='release_contact' and not after['auxiliary_members']:
            raise ValueError('Crossed-support auxiliary hypothesis refuted')
        if recipe=='release_slide':
            if not changes or any(p['translation'][0]!=0 for p in changes) or not any(p['translation'][1]>0 for p in changes):
                raise ValueError('Axial stock-slide hypothesis refuted')
            if [p['endpoint'] for p in before['fixed_supports']]!=[p['endpoint'] for p in after['fixed_supports']]:
                raise ValueError('Fixed endpoint moved with stock')
        if recipe=='release_detach' and before['auxiliary_members']:
            if after['auxiliary_members']:raise ValueError('Auxiliary intersection not detached')
            for value in before['auxiliary_members']:
                a=next(p for p in before['members'] if p['color']==value)
                b=next(p for p in after['members'] if p['color']==value)
                if a['center']!=b['center'] or not b['fixed_supports']:raise ValueError('Fixed member did not remain after mobile retraction')
        if dy==0 and dx==0 and not changes:raise ValueError('Expected contribution produced no observed change')
        self.effects.append(observation);return observation

    def portfolio(self,s,revision,level):
        policy=self.policy;directions=policy['input_hypotheses'];candidates=[]
        free=[p for p in s['members'] if not p['carried']]
        if not free:raise ValueError('Reference built but official boundary absent')
        target=next(p for p in free if p['color']==s['order'][len(s['prefix'])])
        def add(recipe,actions,detail):
            if actions:candidates.append((recipe,actions[:policy['execution']['max_bundle_actions']],detail))
        dy=target['center'][1]-s['root']['center'][1]
        if self.vertical_step is None and dy:
            add('calibrate_vertical',[directions['down' if dy>0 else 'up']],{'target_member':target['color']})
        if self.extension_step is None:
            add('calibrate_extension',[directions['extend']],{'probe':'one axial contribution'})
        if not candidates:
            required_mounted=[p for p in s['members'] if p['color'] in s['order'][:-1] and p['fixed_supports']]
            if (required_mounted and not s['prefix']) or s['auxiliary_members']:
                support_id=(required_mounted[0]['fixed_supports'][0] if required_mounted else
                            next(p for p in s['members'] if p['color'] in s['auxiliary_members'])['fixed_supports'][0])
                stock=sorted((p for p in s['members'] if support_id in p['fixed_supports']),key=lambda p:p['center'][1])
                helper=stock[0]
                if s['auxiliary_members']:
                    if required_mounted:
                        add('release_slide',[directions['down']],{'support':support_id,'members_to_free':[p['color'] for p in required_mounted]})
                    else:
                        count=math.ceil((s['tip']-helper['bbox'][0]+1)/self.extension_step)
                        add('release_detach',[directions['retract']]*count,{'auxiliary_member':helper['color']})
                elif s['tip']>=helper['bbox'][0] and s['root']['center'][1]!=helper['center'][1]:
                    add('release_detach',[directions['retract']]*math.ceil((s['tip']-helper['bbox'][0]+1)/self.extension_step),{'clear_approach_to':helper['color']})
                elif s['root']['center'][1]!=helper['center'][1]:
                    diff=helper['center'][1]-s['root']['center'][1]
                    add('release_align',[directions['down' if diff>0 else 'up']]*int(abs(diff)/self.vertical_step),{'auxiliary_member':helper['color']})
                else:
                    count=max(1,math.ceil((helper['bbox'][0]-s['tip'])/self.extension_step))
                    add('release_contact',[directions['extend']]*count,{'auxiliary_member':helper['color'],'support':support_id})
        if not candidates:
            conflicts=[]
            for y in sorted({p['center'][1] for p in free},reverse=True):
                group=sorted((p for p in free if p['center'][1]==y),key=lambda p:p['center'][0])
                ranks=[s['order'].index(p['color']) for p in group]
                if ranks!=sorted(ranks):conflicts.append(group)
            if conflicts and not s['prefix']:
                group=conflicts[0];excluded=group[-1];pushed=group[:-1]
                desired_y=group[0]['center'][1]+self.vertical_step
                diff=desired_y-s['root']['center'][1]
                if diff:
                    add('separate_align',[directions['down' if diff>0 else 'up']]*int(abs(diff)/self.vertical_step),{'group':[p['color'] for p in group]})
                else:
                    min_tip=max(p['bbox'][2] for p in pushed)+1;max_tip=excluded['bbox'][0]-1
                    if s['tip']<min_tip:
                        count=math.ceil((min_tip-s['tip'])/self.extension_step)
                        if s['tip']+count*self.extension_step>max_tip:raise ValueError('No selective support span on calibrated lattice')
                        add('separate_span',[directions['extend']]*count,{'excluded':excluded['color'],'pushed':[p['color'] for p in pushed]})
                    elif s['tip']>max_tip:
                        add('separate_span',[directions['retract']]*math.ceil((s['tip']-max_tip)/self.extension_step),{'excluded':excluded['color']})
                    else:add('separate_push',[directions['up']],{'pushed':[p['color'] for p in pushed],'excluded':excluded['color']})
            elif dy and s['tip']>=target['bbox'][0]:
                add('retract',[directions['retract']]*math.ceil((s['tip']-target['bbox'][0]+1)/self.extension_step),{'next_member':target['color']})
            elif dy:
                count=abs(dy)/self.vertical_step
                if count!=int(count):raise ValueError('Target outside calibrated transverse lattice')
                add('align',[directions['down' if dy>0 else 'up']]*int(count),{'target_member':target['color']})
            else:
                # Stop at the first possible contact; a pushed member remains
                # a free member until the measured support relation changes.
                count=max(1,math.ceil((target['bbox'][0]-s['tip'])/self.extension_step))
                add('extend',[directions['extend']]*count,{'target_member':target['color'],'desired_prefix':s['order'][:len(s['prefix'])+1]})
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'relations':[g.get('parent','root')],
                'things':['root','support','ordered_members'],'role':'objective','knowledge_status':'hypothesis'} for g in policy['goals']]
        bundles={}
        for i,(recipe,actions,detail) in enumerate(candidates):
            rule=policy['rules'][recipe];ref=f'C_{recipe}_{revision}';key='B'+str(i)
            comps.append({'id':ref,'properties':detail,'relations':['contributes_to:'+rule['goal']],
                'things':['root','support','members'],'role':'intermediate','knowledge_status':'hypothesis'})
            preserve=['G_prefix'] if s['prefix'] else []
            bundles[key]={'id':key,'operation_key':rule['operation'],'composition_ref':ref,'objective_ref':rule['goal'],
                'preserve_refs':preserve,'observation_revision':revision,'level_epoch':level,
                'kind':'probe' if rule['operation']=='OP18' else 'realize','actions':actions,'purpose':rule['purpose'],
                'preconditions':{'source_rule_applicable':True},'preservation_evidence':{p:'check observed ordered prefix after each command' for p in preserve},
                'evidence':['current morphology','declared ordered-support rule:'+recipe],
                'recipe':recipe,'expected_contribution':detail,'prefix_before':s['prefix']}
        return comps,bundles
