"""Finite geometry over measured arrangements and conditional actuator relations."""
from itertools import permutations,product
from math import prod

def assignments(layout,targets,limit):
 objects=layout['objects'];values=sorted({o['value'] for o in objects});out=[]
 for target in targets:
  groups=[]
  for value in values:
   source=sorted(tuple(o['xy']) for o in objects if o['value']==value);wanted=sorted((x,y) for x,y,v in target['target'] if v==value)
   if len(source)>6:return []
   choices=[tuple((a,b,value) for a,b in zip(source,order)) for order in permutations(wanted)]
   groups.append(choices)
  if prod(map(len,groups))>limit:return []
  for parts in product(*groups):
   pairs=[{'from':list(a),'to':list(b),'value':v} for group in parts for a,b,v in group];moves=[p for p in pairs if p['from']!=p['to']]
   out.append({'target':target,'pairs':pairs,'moves':moves,'distance':sum(sum(abs(p['from'][i]-p['to'][i]) for i in (0,1)) for p in moves)})
 return out

def options(layout,targets,models,selection_ref,failed,config):
 alternatives=assignments(layout,targets,config['maximum_assignments']);selected=layout['selected'];offers=[]
 for goal in alternatives:
  if not goal['moves']:continue
  available=[m for m in goal['moves'] if selected and m['from']==selected['xy'] and m['value']==selected['value']]
  if not available:
   for move in goal['moves']:
    role=next(o for o in layout['objects'] if o['xy']==move['from'] and o['value']==move['value'])
    offers.append({'kind':'select_participant','point':role['point'],'goal':goal,'move':move,'predictions':{'selected_participant':role['xy']},'model_evidence':[],
     'assumptions':['pointing_may_select_this_participant'],'falsifiers':['no_unique_selection_marker','another_participant_changes'],
     'risks':['selection_effect_not_yet_attested'],'cost':1,'rank':[goal['distance'],len(goal['moves']),1,move['from']]})
   continue
  move=available[0];residual=[move['to'][i]-move['from'][i] for i in (0,1)]
  for pad in layout['pads']:
   marker=pad['selected']
   if not marker or marker['value']!=selected['value']:continue
   records=[m for m in models if m['control']['pad_ref']==pad['ref'] and m.get('selection_ref')==selection_ref and m['object_value']==selected['value']]
   gains={};refs=[];contradiction=False
   for model in records:
    diff=[model['control']['to'][i]-model['control']['from'][i] for i in (0,1)]
    for axis in (0,1):
     if diff[axis]:
      g=model['delta'][axis]/diff[axis]
      if not g or abs(model['delta'][axis])>layout['shape'][axis]//2:continue
      if axis in gains and gains[axis]!=g:contradiction=True
      gains[axis]=g;refs.extend(model['evidence'])
   if contradiction:continue
   for dest in pad['cells']:
    d=[dest['xy'][i]-marker['xy'][i] for i in (0,1)]
    if not any(d):continue
    # The declared first experiment is one adjacent control step, not an acquired gain.
    if not records and max(map(abs,d))>config['first_control_step']:continue
    predicted=[move['from'][i]+d[i]*gains.get(i,config['unmeasured_concordant_gain']) for i in (0,1)]
    if any(v!=int(v) or not 0<=v<layout['shape'][i] for i,v in enumerate(predicted)):continue
    distance=sum(abs(predicted[i]-move['to'][i]) for i in (0,1));before=sum(map(abs,residual))
    if distance>=before:continue
    if any(o['xy']==predicted and o['xy']!=selected['xy'] for o in layout['objects']):continue
    trial=(tuple(selected['xy']),pad['ref'],tuple(marker['xy']),tuple(dest['xy']))
    if trial in failed:continue
    unmeasured=[i for i in (0,1) if d[i] and i not in gains]
    offers.append({'kind':'probe_actuator_relation','point':dest['point'],'goal':goal,'move':move,'pad_ref':pad['ref'],'trial':trial,
     'predictions':{'selected_participant':list(map(int,predicted)),'actuator_marker':dest['xy']},'model_evidence':list(dict.fromkeys(refs)),
     'assumptions':['current_selection_and_pad_gain_persist']+(['concordant_unit_gain_unmeasured_axes'] if unmeasured else []),
     'unmeasured_axes':unmeasured,'alternatives':['no_motion','opposite_motion','different_gain','coupled_motion','edge_transition'],
     'falsifiers':['other_participant_changes','different_observed_displacement','marker_does_not_follow','expected_relative_arrangement_without_boundary'],
     'risks':['return_not_proven','gain_not_universal','possible_overlap_or_nonlocal_transition'],'cost':1,
     'rank':[goal['distance']-before+distance,len(goal['moves']),0,len(unmeasured),dest['point']]})
 return sorted(offers,key=lambda o:o['rank'])
