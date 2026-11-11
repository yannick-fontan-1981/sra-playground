#!/usr/bin/env python3
"""Read retained graphs only. Diagnostic differences are not a qualification."""
from pathlib import Path
import collections,datetime,gzip,itertools,json,re,sys,time,traceback
OUT=Path(__file__).resolve().parent
SUMMARY=OUT/'hypothetical-common-difference-inventory-attempt02.json'
RAW=OUT/'hypothetical-common-differences-attempt02.jsonl'
PROGRESS=OUT/'hypothetical-common-difference-inventory-attempt02-progress.json'
START=time.monotonic(); START_UTC=datetime.datetime.now(datetime.timezone.utc).isoformat(); LIMIT=115.0
class BoundReached(Exception):pass
def guard():
 if time.monotonic()-START>=LIMIT:raise BoundReached('Internal 115-second diagnostic bound reached before external 120-second timeout')
counts=collections.Counter(); patterns={}; exact_paths={}; points=[]; shape_events=[]; created_envelopes={}; rows_seen=0; last_context=None
left={};right={}; finished=False; failure=None; tick_count=0
raw=RAW.open('x',encoding='utf-8')
def packed(value):return json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
def normalize_id(node_id):
 if node_id.startswith('reasoning:trace:'):return 'reasoning:trace:*'
 if node_id.startswith('state_fragment:'):return 'state_fragment:*'
 return node_id
def summarize(value):
 text=packed(value)
 return value if len(text)<=300 else {'diagnosticPreview':text[:300],'serializedCharacters':len(text),'fullValueRetainedIn':RAW.name}
def record(path,a,b,node_id,context,classification,a_present=True,b_present=True):
 counts['rawDifferences']+=1;counts[classification]+=1
 value={**context,'nodeId':node_id,'path':path,'classification':classification,'baselinePresent':a_present,'candidatePresent':b_present,'baseline':a,'candidate':b}
 raw.write(packed(value)+'\n')
 key=(context['scope'],normalize_id(node_id),path,classification)
 if key not in patterns:patterns[key]={'scope':context['scope'],'nodePattern':normalize_id(node_id),'path':path,'classification':classification,'occurrences':0,'example':{**context,'nodeId':node_id,'baseline':summarize(a),'candidate':summarize(b)}}
 patterns[key]['occurrences']+=1
 exact=(context['scope'],node_id,path,classification)
 exact_paths[exact]=exact_paths.get(exact,0)+1
 if classification=='hypothetical_created_envelope':
  ekey=(node_id,context['createdEnvelopePath']);created_envelopes[ekey]=created_envelopes.get(ekey,0)+1

def created_parent(a,b,node_id,path,context):
 if not re.fullmatch(r'reasoning:trace:[1-9][0-9]*',node_id):return False
 if not context.get('recognizedTraceEnvelope'):return False
 if not path.startswith('/value/root/'):return False
 required={'id','episode','kind','body','created'}
 if set(a)!=required or set(b)!=required:return False
 if a['id']!=int(node_id.rsplit(':',1)[1]) or b['id']!=a['id']:return False
 def floating(v):return isinstance(v,dict) and set(v)=={'kind','bits'} and v['kind']=='float64' and isinstance(v['bits'],str) and re.fullmatch(r'[0-9a-f]{16}',v['bits']) is not None
 return floating(a['created']) and floating(b['created'])

def diff(a,b,path,node_id,context,classification='unattributed'):
 global tick_count
 tick_count+=1
 if tick_count%2048==0:guard()
 if a==b:return
 if isinstance(a,dict) and isinstance(b,dict):
  is_trace=created_parent(a,b,node_id,path,context)
  for key in sorted(a.keys()|b.keys()):
   q=path+'/'+key.replace('~','~0').replace('/','~1')
   kind=classification;next_context=context
   if path=='/origin' and key=='source_digest':kind='contract_origin_source_digest'
   if is_trace and key=='created':
    kind='hypothetical_created_envelope';next_context={**context,'createdEnvelopePath':q}
   if key in a and key in b:diff(a[key],b[key],q,node_id,next_context,kind)
   else:record(q,a.get(key),b.get(key),node_id,next_context,kind,key in a,key in b)
 elif isinstance(a,list) and isinstance(b,list):
  if len(a)!=len(b):record(path+'/length',len(a),len(b),node_id,context,classification)
  for index in range(max(len(a),len(b))):
   if index<len(a) and index<len(b):diff(a[index],b[index],path+'/'+str(index),node_id,context,classification)
   else:record(path+'/'+str(index),a[index] if index<len(a) else None,b[index] if index<len(b) else None,node_id,context,classification,index<len(a),index<len(b))
 else:record(path,a,b,node_id,context,classification)

def compare_nodes(a,b,node_id,context):
 av=a.get('value');bv=b.get('value')
 recognized=all(isinstance(v,dict) and v.get('profile')=='logos-engine.v6.state-graph.v1' and v.get('component')==node_id and isinstance(v.get('root'),dict) and v['root'].get('kind')=='object' for v in (av,bv))
 diff(a,b,'',node_id,{**context,'recognizedTraceEnvelope':recognized})

def delta_map(values):
 occurrence=collections.Counter();result={};order=[]
 for delta in values:
  pair=(delta['node']['id'],delta['node']['revision']);idx=occurrence[pair];occurrence[pair]+=1
  key=(*pair,idx);result[key]=delta;order.append(key)
 return result,order

def report(complete,error):
 by_class=dict(counts)
 ordinary=counts['unattributed'];created=counts['hypothetical_created_envelope'];origin=counts['contract_origin_source_digest'];envelope=counts['delta_envelope']
 return {'schema':'logos-engine.lot6b-hypothetical-common-difference-inventory.v2','status':'diagnostic_only_not_qualification','attempt':2,
  'complete':complete,'error':error,'startedAt':START_UTC,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'elapsedSeconds':time.monotonic()-START,'internalBoundSeconds':LIMIT,'externalTimeoutSeconds':120,
  'rowsReadPerRole':rows_seen,'pointsCompared':len(points),'counts':by_class,
  'rawNodeAndCauseDifferences':ordinary+created+origin,'nodeAndCauseDifferencesAfterHypotheticalCreatedOnly':ordinary+origin,
  'nodeAndCauseDifferencesAfterExistingOriginRuleAndHypotheticalCreated':ordinary,
  'deltaEnvelopeDifferencesSeparatelyRetained':envelope,
  'hypothesis':{'created':'Only the float64 created entry of an encoded reasoning:trace:N object with exactly id/episode/kind/body/created, matching numeric id, matching component/profile and object root is hypothetically excluded. No other timestamp or subtree is omitted.',
   'origin':'Existing official origin.source_digest metadata exception is counted separately from the created hypothesis.',
   'deltaEnvelope':'Common delta sequence, previous, digest and source_digest are inventoried separately, not declared equivalent or qualified.'},
  'limits':['No native module imports or new captures.','Raw retained deltas reconstruct node tables; hash chains and source semantics are not requalified.','All common current nodes and matching common delta occurrences are compared; missing identities and ordering differences are retained.','No official refusal, helper, source or captured byte is modified.','A complete diagnostic inventory is not an official qualification pass.'],
  'points':points,'structuralEvents':shape_events,
  'createdEnvelopePaths':[{'nodeId':key[0],'path':key[1],'occurrences':value} for key,value in sorted(created_envelopes.items())],
  'differencePatterns':list(patterns.values()),
  'exactDifferencePaths':[{'scope':key[0],'nodeId':key[1],'path':key[2],'classification':key[3],'occurrences':value} for key,value in sorted(exact_paths.items())],
  'rawDifferencesFile':RAW.name,'script':Path(__file__).name}
try:
 with gzip.open(OUT/'owner-baseline.json.gz','rt',encoding='utf-8') as af,gzip.open(OUT/'owner-candidate.json.gz','rt',encoding='utf-8') as bf:
  for ordinal,(al,bl) in enumerate(itertools.zip_longest(af,bf)):
   guard();rows_seen=ordinal+1
   if al is None or bl is None:raise ValueError('Retained stream lengths differ')
   a=json.loads(al);b=json.loads(bl)
   keys=('type','case','form','pointIndex');ak=[a.get(k) for k in keys];bk=[b.get(k) for k in keys]
   if ak!=bk:raise ValueError('Retained row correspondence differs: '+packed({'row':ordinal,'baseline':ak,'candidate':bk}))
   if ('knowledge' in a)!=('knowledge' in b):raise ValueError('Only one retained row contains a graph')
   if 'knowledge' not in a:continue
   ag=a['knowledge'];bg=b['knowledge']
   if ag['fromRevision']==0:left={};right={}
   if (ag['fromRevision']==0)!=(bg['fromRevision']==0):raise ValueError('Retained session graph resets differ')
   for delta in ag['deltasAdded']:left[delta['node']['id']]=delta['node']
   for delta in bg['deltasAdded']:right[delta['node']['id']]=delta['node']
   context={'case':a.get('case'),'form':a.get('form'),'pointIndex':a.get('pointIndex'),'rowType':a['type']};last_context=context
   common=left.keys()&right.keys();before=counts.copy()
   for node_id in sorted(common):
    guard();counts['commonCurrentNodesCompared']+=1;compare_nodes(left[node_id],right[node_id],node_id,{**context,'scope':'current_node'})
   ad,ao=delta_map(ag['deltasAdded']);bd,bo=delta_map([d for d in bg['deltasAdded'] if d['node']['id'] in left])
   if ao!=bo:shape_events.append({**context,'kind':'common_delta_order_or_identity_difference','baseline':ao,'candidate':bo})
   for key in sorted(ad.keys()&bd.keys()):
    guard();counts['commonDeltaOccurrencesCompared']+=1;x=ad[key];y=bd[key];ct={**context,'scope':'common_delta','revision':key[1],'occurrence':key[2]}
    compare_nodes(x['node'],y['node'],key[0],ct);diff(x['cause'],y['cause'],'/delta/cause',key[0],ct)
    for field in ('sequence','previous','digest','source_digest'):
     diff(x.get(field),y.get(field),'/delta-envelope/'+field,key[0],{**ct,'scope':'delta_envelope'},'delta_envelope')
   point={**context,'commonCurrentNodes':len(common),'commonDeltaOccurrences':len(ad.keys()&bd.keys()),
    'baselineOnlyNodes':sorted(left.keys()-right.keys()),'candidateOnlyNodes':sorted(right.keys()-left.keys()),
    'baselineOnlyDeltaOccurrences':[list(k) for k in sorted(ad.keys()-bd.keys())],
    'candidateOnlyCommonDeltaOccurrences':[list(k) for k in sorted(bd.keys()-ad.keys())],
    'differenceCounts':dict(counts-before)}
   if point['baselineOnlyNodes']:shape_events.append({**context,'kind':'baseline_node_absent_from_candidate','ids':point['baselineOnlyNodes']})
   points.append(point);raw.flush()
   with PROGRESS.open('w',encoding='utf-8') as progress:json.dump({'complete':False,'pointsCompleted':len(points),'rowsReadPerRole':rows_seen,'counts':dict(counts),'elapsedSeconds':time.monotonic()-START,'lastPoint':context},progress,ensure_ascii=False,indent=2)
 finished=True
except BaseException as e:
 failure={'type':type(e).__name__,'message':str(e),'lastContext':last_context,'traceback':traceback.format_exc()}
finally:
 raw.flush();raw.close();value=report(finished,failure)
 with SUMMARY.open('x',encoding='utf-8') as stream:json.dump(value,stream,ensure_ascii=False,indent=2,allow_nan=False);stream.write('\n')
 print(packed({'status':value['status'],'complete':finished,'error':failure,'rowsReadPerRole':rows_seen,'pointsCompared':len(points),'counts':dict(counts),'nodeAndCauseDifferencesAfterHypotheticalCreatedOnly':value['nodeAndCauseDifferencesAfterHypotheticalCreatedOnly'],'nodeAndCauseDifferencesAfterExistingOriginRuleAndHypotheticalCreated':value['nodeAndCauseDifferencesAfterExistingOriginRuleAndHypotheticalCreated'],'structuralEvents':len(shape_events),'exactDifferencePaths':len(exact_paths),'createdEnvelopePaths':len(created_envelopes),'elapsedSeconds':value['elapsedSeconds'],'summary':SUMMARY.name}),flush=True)
 print(packed({'unattributedPatterns':[p for p in patterns.values() if p['classification']=='unattributed']}),flush=True)
 print(packed({'createdPatternSummary':[{'nodePattern':p['nodePattern'],'path':p['path'],'scope':p['scope'],'occurrences':p['occurrences']} for p in patterns.values() if p['classification']=='hypothetical_created_envelope']}),flush=True)
raise SystemExit(0 if finished else 2)
