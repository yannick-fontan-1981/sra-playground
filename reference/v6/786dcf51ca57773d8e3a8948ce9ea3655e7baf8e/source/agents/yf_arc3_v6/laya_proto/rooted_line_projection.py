"""Repeated root morphology, thin axial band and ordered reference, public raster only."""
from collections import defaultdict,Counter
from geometric_observer import components
from terminal_composition import identity
from src_bridge import plain
from retained_frame_geometry import revalidate_frame
from agents.yf_arc3_v5.capabilities.contracts import PiercingConfiguration,PiercingRodState,PiercingPieceState

def mask(box):
 l,t,r,b=box
 return tuple((y,x)for y in range(t,b+1)for x in range(l,r+1))
def scene(rows):
 cs=components(rows);height=len(rows);width=len(rows[0]);bands=[Counter(row).most_common(1)[0]for row in rows];dividers=[y for y in range(height//2+1,height-3)if bands[y][1]>=width*0.75 and bands[y-1][0]!=bands[y][0]!=bands[y+1][0]]
 if len(dividers)!=1:return None
 split=dividers[0];groups=defaultdict(list)
 for c in cs:
  l,t,r,b=c['bbox'];u=r-l+1
  if 4<=u<=12 and b-t+1==u and c['area']<u*u and c['area']>=u:groups[(c['color'],tuple(sorted(c['normalized'])))].append(c)
 pairs=[v for v in groups.values()if len(v)==2 and min(c['bbox'][1]for c in v)<split<max(c['bbox'][1]for c in v)]
 if pairs:
  largest=max(v[0]['bbox'][2]-v[0]['bbox'][0]for v in pairs);pairs=[v for v in pairs if v[0]['bbox'][2]-v[0]['bbox'][0]==largest]
 if len(pairs)!=1:return None
 root,reference=sorted(pairs[0],key=lambda c:c['bbox'][1]);rb=root['bbox'];refb=reference['bbox']
 reference_unit=refb[2]-refb[0]-1
 refs=[c for c in cs if c['bbox'][0]>refb[2]and refb[1]<=c['bbox'][1]<=c['bbox'][3]<=refb[3]and c['bbox'][2]-c['bbox'][0]+1==c['bbox'][3]-c['bbox'][1]+1==reference_unit and revalidate_frame({'bbox':c['bbox'],'palette_value':c['color'],'corner_value':c['color']},rows)is not None]
 refs.sort(key=lambda c:c['bbox'][0])
 if not refs or len({c['color']for c in refs})!=len(refs)or len({c['bbox'][2]-c['bbox'][0]for c in refs})!=1:return None
 colors={c['color']for c in refs};unit=refs[0]['bbox'][2]-refs[0]['bbox'][0]+1
 pieces=[c for c in cs if c['bbox'][3]<split and c['color']in colors and c['rectangular']and c['bbox'][2]-c['bbox'][0]+1==unit and c['bbox'][3]-c['bbox'][1]+1==unit]
 if sorted(c['color']for c in pieces)!=sorted(colors):return None
 fields=[c for c in cs if c['bbox'][3]<split and c['bbox'][0]>rb[0]and c['bbox'][2]-c['bbox'][0]>=unit*3 and c['bbox'][3]-c['bbox'][1]>=unit*3 and c['area']>unit*unit*3]
 if not fields:return None
 bg=max(fields,key=lambda c:c['area'])['color'];fragments=[c for c in cs if c['color']==bg and c['bbox'][3]<split and c['bbox'][0]>rb[0]]
 field=[min(c['bbox'][0]for c in fragments),min(c['bbox'][1]for c in fragments),max(c['bbox'][2]for c in fragments),max(c['bbox'][3]for c in fragments)]
 middle=(rb[1]+rb[3])//2;thickness=2 if rb[3]-rb[1]+1==unit+2 else None
 if thickness is None:return None
 line_rows=list(range(middle,middle+thickness));start=rb[2];tip=start-1
 for x in range(start,field[2]+1):
  if all(rows[y][x]==bg for y in line_rows):break
  tip=x
 if tip<start:return None
 # Reference homologues define order, never palette semantics or a loaded route.
 return plain({'root':rb,'reference_root':refb,'root_signature':identity([root['color'],sorted(root['normalized'])]),'field':field,'background':bg,'line_rows':line_rows,'start':start,'tip':tip,'pieces':[{'id':'material:'+str(c['color']),'type':str(c['color']),'bbox':c['bbox']}for c in sorted(pieces,key=lambda c:c['color'])],'order':[str(c['color'])for c in refs],'unit':unit,'layout':identity([field,refb,[(c['color'],c['bbox'])for c in refs],sorted(root['normalized'])])})
def physical(s):return {'root':s['root'],'tip':s['tip'],'pieces':[[p['id'],p['bbox']]for p in sorted(s['pieces'],key=lambda p:p['id'])]}
def configuration(s,ref,epoch):
 root='current_root';rod='current_rod';y=s['line_rows'][0];spine=tuple((y,x)for x in range(s['start'],s['tip']+1));foot=tuple((yy,x)for yy in s['line_rows']for x in range(s['start'],s['tip']+1));domain=mask([s['root'][0],s['field'][1],s['field'][2],s['field'][3]])
 pieces=tuple(PiercingPieceState(piece_ref=p['id'],type_ref=p['type'],occupied_positions=mask(p['bbox']),support_refs=())for p in s['pieces']);possible=tuple((rod,p.piece_ref)for p in pieces if set(p.occupied_positions)&set(foot))
 return PiercingConfiguration(configuration_ref='observed:'+ref,rods=(PiercingRodState(rod_ref=rod,root_ref=root,root_to_tip_positions=spine,rod_footprint_positions=foot),),pieces=pieces,domain_positions=domain,domain_boundary_is_known=False,root_footprints=((root,mask(s['root'])),),root_admissible_positions=((root,mask([s['root'][0],s['field'][1],s['root'][2],s['field'][3]])),),movable_piece_refs=tuple(p.piece_ref for p in pieces),possible_support_pairs=possible,frame_ref=ref,scope={'level_epoch':epoch},provenance=(ref,))
def projected(c):
 roots=dict(c.root_footprints);r=roots['current_root'];rod=next(x for x in c.rods if x.rod_ref=='current_rod')
 def box(points):return [min(x for y,x in points),min(y for y,x in points),max(x for y,x in points),max(y for y,x in points)]
 return {'root':box(r),'tip':max(x for y,x in rod.root_to_tip_positions),'pieces':[[p.piece_ref,box(p.occupied_positions)]for p in sorted(c.pieces,key=lambda p:p.piece_ref)]}
