"""Frame-derived scale correspondence and exact finite constraint composition."""
import itertools,json
from collections import Counter
from pathlib import Path
from geometric_observer import components
POLICY_PATH=Path(__file__).with_name('field_constraints.drm.json')


def perceive(rows):
    parts=components(rows)
    squares=[p for p in parts if p['rectangular'] and p['bbox'][2]-p['bbox'][0]==p['bbox'][3]-p['bbox'][1] and p['bbox'][2]-p['bbox'][0]>=2]
    sizes=Counter(p['bbox'][2]-p['bbox'][0]+1 for p in squares)
    size,count=sizes.most_common(1)[0]
    if count<4 or size%3:raise ValueError('Unresolved two-scale carrier family')
    outer=[p for p in squares if p['bbox'][2]-p['bbox'][0]+1==size]
    positions={(p['bbox'][0],p['bbox'][1]):p['color'] for p in outer}
    differences=Counter()
    for axis in (0,1):
        for other in {p[1-axis] for p in positions}:
            coordinates=sorted(p[axis] for p in positions if p[1-axis]==other)
            differences.update(b-a for a,b in zip(coordinates,coordinates[1:]) if b-a>size)
    pitch=differences.most_common(1)[0][0]
    possible={(x+dx*pitch,y+dy*pitch) for x,y in positions for dx in (-1,0,1) for dy in (-1,0,1)}
    anchors={};micro=size//3
    for x,y in sorted(possible):
        if x<0 or y<0 or y+size>len(rows) or x+size>len(rows[0]):continue
        values=[];valid=True
        for iy in range(3):
            for ix in range(3):
                block={rows[yy][xx] for yy in range(y+iy*micro,y+(iy+1)*micro) for xx in range(x+ix*micro,x+(ix+1)*micro)}
                if len(block)!=1:valid=False;break
                values.append(next(iter(block)))
            if not valid:break
        if not valid or len(set(values))<3:continue
        descriptors=set(values[:4]+values[5:])
        if values[4] in descriptors or not 2<=len(descriptors)<=3:continue
        neighbors=sum((x+dx*pitch,y+dy*pitch) in positions for dx in (-1,0,1) for dy in (-1,0,1) if (dx,dy)!=(0,0))
        if neighbors<4:continue
        anchors[(x,y)]={'center':values[4],'cells':values,'position':[x,y]}
    if not anchors:raise ValueError('No nested instruction anchors found')
    return {'size':size,'pitch':pitch,'carriers':positions,'anchors':anchors,
            'domain':sorted(set(positions.values())|{a['center'] for a in anchors.values()})}


def requests(state,anchor):
    x,y=anchor['position'];pitch=state['pitch']
    for index,glyph in enumerate(anchor['cells']):
        if index==4:continue
        dx,dy=index%3-1,index//3-1
        yield (x+dx*pitch,y+dy*pitch),glyph,[dx,dy]


def allowed(rule,center,domain):
    if rule=='same':return {center}
    if rule=='different':return set(domain)-{center}
    return set()


def infer_semantics(state,minimum):
    glyphs=sorted({g for a in state['anchors'].values() for p,g,o in requests(state,a)})
    if len(glyphs)>3:raise ValueError('Descriptor domain exceeds declared hypothesis space')
    scored=[]
    for assignment in itertools.product(('same','different','absent'),repeat=len(glyphs)):
        mapping=dict(zip(glyphs,assignment));coherent=[]
        for anchor in state['anchors'].values():
            good=True
            for point,glyph,offset in requests(state,anchor):
                if mapping[glyph]=='absent':good &= point not in state['carriers']
                else:good &= state['carriers'].get(point) in allowed(mapping[glyph],anchor['center'],state['domain'])
            if good:coherent.append(anchor['position'])
        scored.append((len(coherent),mapping,coherent))
    maximum=max(s[0] for s in scored);best=[s for s in scored if s[0]==maximum]
    if maximum<minimum or len(best)!=1:raise ValueError('Homologous examples do not uniquely determine descriptor semantics')
    return best[0][1],{'coherent_panels':maximum,'positions':best[0][2],'scope':'observed homologous agreement; revisable interpretation'}


def compose(state,semantics):
    constraints={}
    for anchor in state['anchors'].values():
        for point,glyph,offset in requests(state,anchor):
            if glyph not in semantics:raise ValueError('Unobserved descriptor needs a new interpretation')
            rule=semantics[glyph]
            if point in state['anchors']:
                if rule!='absent':raise ValueError('Value request overlaps a protected instruction')
                continue
            if rule=='absent':
                if point in state['carriers']:raise ValueError('Unexpected mutable carrier at required absence')
                continue
            if point not in state['carriers']:raise ValueError('Required carrier absent')
            values=allowed(rule,anchor['center'],state['domain'])
            item=constraints.setdefault(point,{'allowed':set(state['domain']),'provenance':[]})
            item['allowed'] &= values
            item['provenance'].append({'anchor':anchor['position'],'offset':offset,'rule':rule,'parameter':anchor['center']})
            if not item['allowed']:raise ValueError('Composed constraints conflict')
    mismatches=[]
    for point,item in sorted(constraints.items()):
        if state['carriers'][point] not in item['allowed']:
            if len(item['allowed'])!=1:raise ValueError('Repair destination remains ambiguous')
            mismatches.append({'point':list(point),'before':state['carriers'][point],'after':next(iter(item['allowed'])),
                'provenance':item['provenance']})
    return constraints,mismatches


class FieldPlanner:
    def __init__(self):
        self.policy=json.loads(POLICY_PATH.read_text());self.semantics=None;self.semantic_evidence=None;self.effects=[];self.edges=set()

    def state(self,rows):
        result=perceive(rows)
        if self.semantics is None:
            self.semantics,self.semantic_evidence=infer_semantics(result,self.policy['learning']['minimum_coherent_panels'])
        constraints,mismatches=compose(result,self.semantics)
        result.update(constraints=constraints,mismatches=mismatches)
        return result

    def observe(self,before,after,request,evidence):
        if before['anchors']!=after['anchors']:raise ValueError('Protected instruction changed')
        if before['carriers'].keys()!=after['carriers'].keys():raise ValueError('Carrier population changed during point repair')
        point=tuple(request['point'])
        changed=[p for p in before['carriers'] if before['carriers'][p]!=after['carriers'][p]]
        if changed!=[point] or after['carriers'][point]!=request['after']:
            raise ValueError('Point-effect hypothesis refuted')
        if len(after['mismatches'])!=len(before['mismatches'])-1:raise ValueError('Composition mismatch did not decrease by one')
        edge=(request['before'],request['after']);self.edges.add(edge)
        record={'effect':'observed_single_carrier_value_transition','before':edge[0],'after':edge[1],
            'changed_carriers':1,'unchanged_carriers':len(before['carriers'])-1,'protected_anchors':len(before['anchors']),
            'remaining_mismatches':len(after['mismatches']),'evidence':evidence,'reverse_transition_proved':False}
        self.effects.append(record);return record

    def portfolio(self,state,revision,level):
        mismatches=state['mismatches']
        if not mismatches:raise ValueError('Constraints satisfied without official completion')
        unknown=[m for m in mismatches if (m['before'],m['after']) not in self.edges]
        chosen=unknown[:1] if unknown else mismatches[:self.policy['execution']['max_bundle_actions']]
        recipe='probe_point_effect' if unknown else 'repair_composition'
        comps=[{'id':g['id'],'properties':{'definition':g['composition']},'relations':[g.get('parent','root')],
                'things':['carriers','instruction_anchors'],'role':'objective'} for g in self.policy['goals']]
        ref='C_field_'+str(revision)
        comps.append({'id':ref,'properties':{'mismatch_count':len(mismatches),'contributing_repairs':len(chosen)},
            'relations':['contributes_to:G_terminal'],'things':['value_carriers'],'role':'intermediate'})
        actions=[{'action_ref':'ACTION6','data':{'x':m['point'][0]+state['size']//2,'y':m['point'][1]+state['size']//2}} for m in chosen]
        bundle={'id':'B0','operation_key':'OP18' if unknown else 'OP28','composition_ref':ref,
            'objective_ref':'G_information' if unknown else 'G_terminal','preserve_refs':['G_preserve'],
            'observation_revision':revision,'level_epoch':level,'kind':'probe' if unknown else 'realize',
            'actions':actions,'purpose':'Réparer la composition de contraintes en préservant les instructions et les positions déjà valides.',
            'preconditions':{'source_rule_applicable':True},'preservation_evidence':{'G_preserve':'exact point deltas checked after each command; no anchor or already valid carrier selected'},
            'evidence':['current composed requests','learned descriptor semantics with local center parameters'],
            'recipe':recipe,'repairs':chosen,'mismatch_count_before':len(mismatches)}
        return comps,{'B0':bundle}

def compact(state):
    return {'carrier_count':len(state['carriers']),'anchor_count':len(state['anchors']),'constraint_count':len(state['constraints']),
        'mismatch_count':len(state['mismatches']),'overlapping_positions':sum(len(c['provenance'])>1 for c in state['constraints'].values()),
        'domain':state['domain'],'size':state['size'],'pitch':state['pitch']}
