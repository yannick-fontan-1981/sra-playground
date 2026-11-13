#!/usr/bin/env python3
"""Independent bounded contracts for the original V5 rejoin/capture geometry.

Only unchanged, manifest-verified source code and public retained rasters are
read. Controlled variants test a component contract, not game success.
"""
from __future__ import annotations
import argparse,copy,gzip,hashlib,importlib.util,json
from pathlib import Path
import sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('outline_rejoin_contracts',ROOT/'scripts/export-v6-outline-service-reference.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
h=c.helper
from agents.yf_arc3_v5.capabilities.interaction import _adjacent_unmarked_compact_body_capture
SOURCE=h.SOURCE/'agents/yf_arc3_v5/capabilities/interaction.py'
OUT=ROOT/'tests/fixtures/v6-outline-rejoin-reference.json.gz'

def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def plain(v):return h.plain(v)
def paint(rows,box,value,rim=False):
 left,top,right,bottom=box
 for y in range(top,bottom+1):
  for x in range(left,right+1):
   if not rim or x in [left,right] or y in [top,bottom]:rows[y][x]=value
 return rows

def sample():
 rows=[[0]*44 for _ in range(36)];lead=[8,12,11,15]
 paint(rows,lead,7,True);paint(rows,[5,9,7,11],2);paint(rows,[9,9,9,9],2);paint(rows,[20,8,23,11],2,True)
 fields={'available_action_refs':['ACTION1','ACTION2','ACTION3','ACTION4','ACTION5'],
  'canonical_provisional_control_term_facts':[{'term_ref':'hypothesis.controlled_outline','entity_ref':'controlled:lead'}],
  'canonical_provisional_control_geometry_bboxes':[lead],'current_action_conditioned_control_outline_bboxes':[lead],
  'interface_action_translation_deltas':[['ACTION1',-1,0],['ACTION2',1,0],['ACTION3',0,-1],['ACTION4',0,1]],'last_action_ref':'ACTION5'}
 return rows,fields

def generate():
 cases=[]
 def add(name,rows,fields,domain='controlled_raster',provenance=None):
  result=c.capture(lambda:_adjacent_unmarked_compact_body_capture(c.interaction(rows,fields,{})))
  cases.append({'id':name,'domain':domain,'rows':rows,'fields':fields,**result,**({'provenance':provenance} if provenance else {})})
 def variant(name,change):
  rows,fields=sample();change(rows,fields);add(name,rows,fields)
 rows,fields=sample();add('unique_rejoin',rows,fields)
 variant('no_control_terms',lambda r,f:f.update(canonical_provisional_control_term_facts=[]))
 variant('no_control_geometry',lambda r,f:f.update(canonical_provisional_control_geometry_bboxes=[]))
 variant('multiple_control_geometry',lambda r,f:f.update(canonical_provisional_control_geometry_bboxes=[[8,12,11,15],[12,12,15,15]]))
 variant('ambiguous_terms_exact_outline',lambda r,f:f.update(canonical_provisional_control_term_facts=[*f['canonical_provisional_control_term_facts'],{'term_ref':'hypothesis.other','entity_ref':'other'}]))
 variant('ambiguous_terms_no_current_outline',lambda r,f:f.update(canonical_provisional_control_term_facts=[{},{}],current_action_conditioned_control_outline_bboxes=[]))
 variant('ambiguous_terms_bad_current_outline',lambda r,f:(f.update(canonical_provisional_control_term_facts=[{},{}]),r[13].__setitem__(8,0)))
 variant('quantum_too_small',lambda r,f:f.update(canonical_provisional_control_geometry_bboxes=[[8,12,9,13]]))
 variant('no_available_rejoin_direction',lambda r,f:f.update(available_action_refs=['ACTION2','ACTION3','ACTION4','ACTION5']))
 variant('no_available_body_direction',lambda r,f:f.update(available_action_refs=['ACTION1','ACTION2','ACTION3','ACTION5']))
 variant('no_directions',lambda r,f:f.update(interface_action_translation_deltas=[]))
 variant('nonunit_direction_is_normalized',lambda r,f:f.update(interface_action_translation_deltas=[['ACTION1',-4,0],['ACTION2',4,0],['ACTION3',0,-4],['ACTION4',0,4]]))
 variant('duplicate_direction_is_ambiguous',lambda r,f:(f['available_action_refs'].append('ACTION6'),f['interface_action_translation_deltas'].append(['ACTION6',-1,0])))
 variant('diagonal_direction',lambda r,f:f.update(interface_action_translation_deltas=[['ACTION1',-1,1],['ACTION4',0,1]]))
 variant('zero_direction',lambda r,f:f.update(interface_action_translation_deltas=[['ACTION1',0,0],['ACTION4',0,1]]))
 variant('no_body_marker',lambda r,f:r[9].__setitem__(9,0))
 variant('marker_other_value',lambda r,f:r[9].__setitem__(9,6))
 variant('body_not_full',lambda r,f:r[10].__setitem__(6,0))
 variant('target_broken_perimeter',lambda r,f:r[8].__setitem__(21,0))
 variant('target_other_value',lambda r,f:paint(r,[20,8,23,11],6,True))
 variant('target_behind_body',lambda r,f:(paint(r,[20,8,23,11],0),paint(r,[0,8,3,11],2,True)))
 variant('two_matching_targets',lambda r,f:paint(r,[28,8,31,11],2,True))
 variant('rejoin_bound_reached',lambda r,f:[paint(r,[28,y,31,y+3],2,True) for y in [4,12,20]])
 variant('adjacent_unmarked_body',lambda r,f:paint(r,[13,13,15,15],6))
 variant('adjacent_unmarked_body_distinct_interior',lambda r,f:(paint(r,[13,13,15,15],6),paint(r,[9,13,10,14],4)))
 variant('adjacent_body_has_cardinal_marker',lambda r,f:(paint(r,[13,13,15,15],6),paint(r,[17,13,17,13],6)))
 variant('two_adjacent_unmarked_bodies',lambda r,f:(paint(r,[13,13,15,15],6),paint(r,[9,17,11,19],5)))
 variant('adjacent_route_bound_reached',lambda r,f:[paint(r,b,v) for b,v in [([5,13,7,15],1),([13,13,15,15],6),([9,9,11,11],8),([9,17,11,19],5)]] )
 variant('filled_behind_directional_step',lambda r,f:(paint(r,[4,12,7,15],3),f.update(last_action_ref='ACTION4')))
 variant('filled_behind_after_local_action',lambda r,f:paint(r,[4,12,7,15],3))
 variant('filled_behind_wrong_direction',lambda r,f:(paint(r,[4,12,7,15],3),f.update(last_action_ref='ACTION1')))
 variant('nonuniform_interior',lambda r,f:(r[13].__setitem__(9,4),r[14].__setitem__(10,5)))
 variant('distinct_uniform_interior',lambda r,f:paint(r,[9,13,10,14],4))
 variant('uniform_interior_same_as_outer',lambda r,f:paint(r,[9,13,10,14],0))
 # Equivariance: controlled raster coordinates and palette labels are arbitrary.
 rows,fields=sample();shifted=[[0]*50 for _ in range(42)]
 for y,row in enumerate(rows):
  for x,v in enumerate(row):shifted[y+3][x+2]=v
 shifted_fields=copy.deepcopy(fields)
 for k in ['canonical_provisional_control_geometry_bboxes','current_action_conditioned_control_outline_bboxes']:
  shifted_fields[k]=[[b[0]+2,b[1]+3,b[2]+2,b[3]+3] for b in fields[k]]
 add('translated_scene',shifted,shifted_fields)
 palette={0:10,2:5,7:3};add('permuted_palette',[[palette.get(v,v) for v in row] for row in rows],fields)
 # The public current frame override is part of the original contract.
 blank=[[0]*44 for _ in range(36)];add('current_public_frame_override',blank,{**fields,'current_observed_frame':rows})
 # Genuine retained public observations; bindings are copied from acquired state.
 base=ROOT/'docs/migration/native-campaigns-v53/attempt3';report_path=base/'esct-campaign.json.gz';trace_path=base/'esct-public-trace.json.gz'
 report=json.loads(gzip.decompress(report_path.read_bytes()));trace=json.loads(gzip.decompress(trace_path.read_bytes()));cursor=0
 for prefix in report['prefixes']:
  cursor+=prefix['acquiredActions']
  if cursor not in [6,10,11,12,16,18,20,28,30,36,42,45,60]:continue
  state=prefix['outlineAcquisition']['sourceState'];packet=trace['packets'][cursor]['packet'];control=state['control']
  if not control:continue
  fields={'available_action_refs':packet['available_action_refs'],
   'canonical_provisional_control_term_facts':[{'term_ref':'hypothesis.action_conditioned_outline:'+control['signature'],'entity_ref':control['component_ref']}],
   'canonical_provisional_control_geometry_bboxes':[control['bbox']],
   'current_action_conditioned_control_outline_bboxes':[control['bbox']],
   'interface_action_translation_deltas':[['ACTION1',-1,0],['ACTION2',1,0],['ACTION3',0,-1],['ACTION4',0,1]],
   'last_action_ref':state['last']['action_ref'] if state['last'] else None}
  # Match Outline.current() rebinding: source control may hold the previous bbox.
  original=h.OutlineService();original.restore(state);current=original.current({},packet['frame_rows'])
  if current:
   fields['canonical_provisional_control_geometry_bboxes']=[current['bbox']];fields['current_action_conditioned_control_outline_bboxes']=[current['bbox']]
   fields['canonical_provisional_control_term_facts'][0]['entity_ref']=current['component_ref']
  add(f'public_esct_after_{cursor}',packet['frame_rows'],fields,'retained_public_component_contract',
   {'sourceDigest':report['source']['digest'],'afterAction':cursor,'level':packet['level'],
    'report':{'path':report_path.relative_to(ROOT).as_posix(),'sha256':sha(report_path)},
    'trace':{'path':trace_path.relative_to(ROOT).as_posix(),'sha256':sha(trace_path)},
    'bindingQualification':'Current source outline rebind from the actual retained acquisition checkpoint; no action is executed or injected.'})
 before=h.VERIFIED_SOURCE;after=h.verify_source_manifest();assert before==after
 return {'schema':'logos-engine.v5.outline-rejoin-reference.v1','sourceCommit':h.COMMIT,
  'source':{'path':SOURCE.relative_to(ROOT).as_posix(),'sha256':sha(SOURCE)},'sourceUnchanged':True,
  'function':'_adjacent_unmarked_compact_body_capture','cases':cases,
  'qualification':'Only the unchanged original V5 geometric helper produces expected results. No policy, common caller, host action, or successful level is established by these component fixtures.'}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();value=generate();raw=json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
 if args.check:assert gzip.decompress(OUT.read_bytes())==raw
 else:
  with OUT.open('xb') as stream:
   with gzip.GzipFile(filename='',mode='wb',fileobj=stream,mtime=0) as output:output.write(raw)
 print(json.dumps({'fixture':OUT.relative_to(ROOT).as_posix(),'cases':len(value['cases']),'sourceUnchanged':value['sourceUnchanged'],'sha256':sha(OUT),'checkOnly':args.check}),flush=True)
if __name__=='__main__':main()
