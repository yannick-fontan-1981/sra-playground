from collections import Counter
from itertools import product
from types import SimpleNamespace
from hashlib import sha256
import json
from agents.yf_arc3_v6.morphology_policy.topological_recolor.geometry import components
from agents.yf_arc3_v5.capabilities.window_processing_d import TrainRankD,WindowReceiverD,WindowBeatStateD,_window_eligibility,_process_one_beat
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DWorkBudget

def digest(v):return sha256(json.dumps(v,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def measure(rows):
 if not rows or not rows[0]:return None
 cc=components(rows);boxes=[]
 for c in cc:
  l,t,r,b=c['bbox'];w=r-l+1;h=b-t+1
  if h<6 or w<2*h or w>3*h:continue
  ring={(x,y)for y in range(t,b+1)for x in range(l,r+1)if x in(l,r)or y in(t,b)}
  if not ring<=set(map(tuple,c['cells'])):continue
  if (h-2)%3:continue
  unit=(h-2)//3;start=b-unit;inside=Counter(rows[y][x]for y in range(t+1,b)for x in range(l+1,r));base=inside.most_common(1)[0][0];slots=[]
  x=l+1
  while x<r:
   if all(rows[y][x]==base for y in range(start,b)):x+=1;continue
   end=x
   while end+1<r and any(rows[y][end+1]!=base for y in range(start,b)):end+=1
   pixels=[rows[y][xx]for y in range(start,b)for xx in range(x,end+1)];slots.append({'box':[x,start,end,b-1],'values':pixels,'full':len(set(pixels))==1});x=end+1
  if not slots or len(slots)>16 or any(s['box'][2]-s['box'][0]+1!=unit for s in slots):continue
  full=all(s['full']for s in slots);fixed=not full
  if fixed and not all(len(set(s['values']))==2 and s['values'].count(base)==(unit-1)**2 for s in slots):continue
  active=slots[0]['values'][-1];capacity=len(slots)if fixed else sum(s['values'][0]==active for s in slots)
  if not fixed and [s['values'][0]==active for s in slots]!=[i<capacity for i in range(len(slots))]:continue
  fw=2*unit+1;fl=l+1;ft=t+1;fr=fl+fw-1;fb=start-1
  # A constant rectangular core plus vertically displayed alternatives; otherwise a multicolour patch remains a wildcard hypothesis.
  def field(left):
   right=left+fw-1;patch=[rows[y][x]for y in range(ft,fb+1)for x in range(left,right+1)];counts=Counter(patch);dominant=counts.most_common(1)[0][0];overlay={(left+unit,y)for y in range(ft+1,fb)};other={(x,y)for y in range(ft,fb+1)for x in range(left,right+1)if rows[y][x]!=dominant}
   if dominant!=base and other<=overlay:return {'value':dominant,'domain':[dominant],'fixed_hypothesis':True,'overlay':sorted(other),'point':[(left+right)//2,(ft+fb)//2]}
   core=[rows[y][x]for y in range(ft,fb+1)for x in range(left+unit,right+1)]
   if len(set(core))!=1 or core[0]==base:return None
   domain=[]
   for y in range(ft,fb+1):
    v=rows[y][left]
    if v!=base and v not in domain:domain.append(v)
   if len(domain)<2 or core[0]not in domain:return None
   return {'value':core[0],'domain':domain,'fixed_hypothesis':False,'overlay':[],'point':[(left+right)//2,(ft+fb)//2]}
  left_field=field(fl);right_field=field(r-fw)
  filter_value=left_field['value']if left_field else None;domain=left_field['domain']if left_field else[]
  if not left_field:
   patch={rows[y][x]for y in range(ft,fb+1)for x in range(fl,fr+1)}
   if len(patch)<3:continue
  # A second actual field is retained as a role question, never silently counted as another capture.
  output=right_field if right_field and right_field['point']!=[ (fl+fr)//2,(ft+fb)//2]else None
  boxes.append({'bbox':[l,t,r,b],'border':c['value'],'base':base,'unit':unit,'slots':slots,'capacity':capacity,'capacity_domain':[len(slots)]if fixed else list(range(1,len(slots)+1)),'capacity_point':[(l+r)//2,start],'filter':filter_value,'filter_domain':domain,'filter_point':[(fl+fr)//2,(ft+fb)//2],'wildcard_hypothesis':filter_value is None,'fixed_capacity':fixed,'left_field':left_field,'second_field':output})
 if len(boxes)<2 or len({tuple(b['bbox'][i]-b['bbox'][i-2]for i in(2,3))for b in boxes})!=1:return None
 boxes.sort(key=lambda b:(b['bbox'][1],b['bbox'][0]))
 top=min(b['bbox'][1]for b in boxes);groups={}
 for c in cc:
  l,t,r,b=c['bbox'];w=r-l+1;h=b-t+1
  if b>=top or w!=h or w<2 or w>6 or len(c['cells'])!=w*h:continue
  groups.setdefault((t,b,w),[]).append(c)
 candidates=[]
 for key,units in groups.items():
  units.sort(key=lambda c:c['bbox'][0]);gaps=[b['bbox'][0]-a['bbox'][0]for a,b in zip(units,units[1:])]
  if len(units)>=3 and len(set(gaps))==1 and gaps[0]>key[2]:candidates.append(units)
 if len(candidates)!=1:return None
 word=candidates[0];colors=[c['value']for c in word]
 if len(set(colors))<2 or any(b['filter']is not None and b['filter']not in colors for b in boxes):return None
 return {'boxes':boxes,'word':[{'bbox':c['bbox'],'value':c['value']}for c in word],'colors':colors,'signature':{'box_shape':[boxes[0]['bbox'][2]-boxes[0]['bbox'][0]+1,boxes[0]['bbox'][3]-boxes[0]['bbox'][1]+1],'unit':boxes[0]['unit'],'word_shape':[word[0]['bbox'][2]-word[0]['bbox'][0]+1,word[0]['bbox'][3]-word[0]['bbox'][1]+1]}}

def coverage(m,settings,model):
 if model.get("receiver_order_hypothesis")!="visual_reading_order_not_rail_law" or model.get("one_use_for_run") is not True:return False,[]
 train=tuple(TrainRankD(unit_ref='visible_rank:'+str(i),rank=i,current_color_ref='pixel:'+str(c),captured=False)for i,c in enumerate(m['colors']));budget=DWorkBudget(SimpleNamespace(node_bound=4096,time_bound_ms=1000,domain_bound=4096));receipts=[]
 for ordinal,(box,setting)in enumerate(zip(m['boxes'],settings)):
  size,color,output=setting;operation=model['dual_field_operation_hypothesis']if box['second_field']else model['single_field_operation_hypothesis']
  receiver=WindowReceiverD(receiver_ref='box:'+str(ordinal),first_rank_at_beat_zero=0,window_size=size,admitted_color_refs=None if color is None else('pixel:'+str(color),),maximal_group_required=model['maximal_group_required'],action=operation,paint_color_ref='pixel:'+str(output)if operation=='PAINT'else None,event_ref='hypothetical_capture',one_use_for_run=model['one_use_for_run'])
  state=WindowBeatStateD(train=train,receivers=(receiver,),receiver_order=(receiver.receiver_ref,),beat=0,rank_shift_per_beat=0,visitation_policy='single_ordered_pass',revisit_termination_evidence_ref=None)
  for start in range(len(train)-size+1):
   rx=receiver.model_copy(update={'first_rank_at_beat_zero':start});result=_window_eligibility(state,rx,train,set(),(),budget)
   if result['eligible']:
    ranks=set(result['input_ranks']);projected,ledger=_process_one_beat(state.model_copy(update={'receivers':(rx,)}),budget,1);train=projected.train;receipts.append({'box':ordinal,'ranks':sorted(ranks),'operation_hypothesis':operation,'projection':ledger['ordered_events'],'status':'conditional_static_coverage_not_observed_no_real_beat_inferred'});break
 return all(u.captured for u in train),receipts

def plans(m,model):
 domains=[list(product(b['capacity_domain'],b['filter_domain']or[None],b['second_field']['domain']if b['second_field']else[None]))for b in m['boxes']];count=1
 for d in domains:count*=len(d)
 if count>model['configuration_bound']:return [],{'truncated':True,'domain':count}
 result=[]
 for settings in product(*domains):
  okay,receipts=coverage(m,settings,model)
  if not okay:continue
  edits=[]
  for i,(b,(size,color,output))in enumerate(zip(m['boxes'],settings)):
   if b['second_field']and output!=b['second_field']['value']:
    field=b['second_field'];steps=(field['domain'].index(output)-field['domain'].index(field['value']))%len(field['domain']);edits.extend([{'box':i,'field':'second_field','point':field['point'],'desired':output}]*steps)
   if size!=b['capacity']:
    steps=(b['capacity_domain'].index(size)-b['capacity_domain'].index(b['capacity']))%len(b['capacity_domain']);edits.extend([{'box':i,'field':'capacity','point':b['capacity_point'],'desired':size}]*steps)
   if color!=b['filter']:
    steps=(b['filter_domain'].index(color)-b['filter_domain'].index(b['filter']))%len(b['filter_domain']);edits.extend([{'box':i,'field':'filter','point':b['filter_point'],'desired':color}]*steps)
  result.append({'settings':settings,'edits':edits,'cost':len(edits)+1,'coverage':receipts})
 return result,{'truncated':False,'domain':count}
