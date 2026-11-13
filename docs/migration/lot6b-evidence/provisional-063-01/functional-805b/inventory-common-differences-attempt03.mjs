#!/usr/bin/env node
/** Independent diagnostic only. No project/native imports or qualification.
 * Reads the exact envelope/record/footer format specified by streamCapture in
 * docs/migration/lot6b-evidence/qualify-cost-owner-graphs.mjs.
 * Gzip JSONL outputs contain concatenated standard gzip members (64 KiB chunks).
 */
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip, gzipSync } from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';
const DIR=dirname(fileURLToPath(import.meta.url)), START=performance.now(), STARTED=new Date().toISOString();
const LIMIT=115000, MAXLINE=64*1024*1024, MAXOUTPUT=512*1024*1024;
const PREFIX='hypothetical-common-difference-inventory-attempt03';
const own=(o,k)=>Object.hasOwn(o,k), assert=(v,m)=>{if(!v)throw Error(m);};
let lastGuard=-Infinity, totalWritten=0, context=null;
function guard(force=false){
  if(performance.now()-START>LIMIT)throw Error('Internal 115-second bound reached');
  if(force||performance.now()-lastGuard>500){lastGuard=performance.now();
    for(const n of ['lot10c-status.json','lot5c-status.json']){
      const x=JSON.parse(fs.readFileSync('/workspace/shared/sra-coordination/'+n,'utf8'));
      if(x.quiet_requested===true)throw Error('Fresh quiet request: '+n+' '+(x.quiet_request_id??''));
    }
  }
}
const result={schema:'logos-engine.lot6b-common-difference-diagnostic.v3',attempt:3,
 status:'diagnostic_only_not_qualification',complete:false,officialQualification:false,
 startedAt:STARTED,internalBoundSeconds:115,externalTimeoutSeconds:120,
 hypothesis:{name:'created_envelope_timestamp_only',scope:'Only the float64 bits at /value/root/members/created/bits of a reasoning:trace:<integer> component_state/native_reasoning_trace envelope. No nested created field, hash, reference, chain, source digest, subtree or other metadata is normalized.',
  sourceDigest:'origin.source_digest remains a distinct raw/residual difference, checked against its own captured runtime digest; never silently removed.',
  derivedIdentities:'All delta sequence/previous/digest/source_digest and graph/execution identities remain explicit; this reader does not certify their derivation or recompute native hashes.'},
 limits:{maxLineBytes:MAXLINE,maxOutputUncompressedBytes:MAXOUTPUT},recordsPerRole:{baseline:0,candidate:0},
 inputs:{},sessions:[],points:[],counts:{},categoryCounts:{},domainCounts:{},paths:{},errors:[],
 validationScope:'Framing, contiguous records/delta sequence, previous-chain links, per-node revisions, scope/runtime-origin binding, graph/snapshot counts; no native codec/kernel import, no official semantic validator.',
 priorAttemptsUnchanged:true};
const count=(map,k,n=1)=>map[k]=(map[k]??0)+n;
class Output{
 constructor(suffix){this.path=join(DIR,PREFIX+'-'+suffix+'.jsonl.gz');this.fd=fs.openSync(this.path,'wx');this.buffer='';this.rows=0;this.bytes=0;}
 put(value){const line=JSON.stringify(value)+'\n';totalWritten+=Buffer.byteLength(line);assert(totalWritten<=MAXOUTPUT,'Output byte bound reached');this.buffer+=line;this.rows++;if(this.buffer.length>=65536)this.flush();}
 flush(){if(this.buffer){const b=Buffer.from(this.buffer);this.bytes+=b.length;fs.writeSync(this.fd,gzipSync(b,{level:1}));this.buffer='';}}
 close(){this.flush();fs.closeSync(this.fd);return{file:this.path.split('/').at(-1),rows:this.rows,uncompressedBytes:this.bytes,compressedBytes:fs.statSync(this.path).size};}
}
const outputs={};let streams=[];const pairCache=new WeakMap();
function diff(a,b,path='',out=[]){
 if(Object.is(a,b))return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
  if(Array.isArray(a)){if(a.length!==b.length)out.push({path:path+'/length',baseline:a.length,candidate:b.length});for(let i=0;i<Math.max(a.length,b.length);i++){if(i>=a.length||i>=b.length)out.push({path:path+'/'+i,baselinePresent:i<a.length,candidatePresent:i<b.length,...(i<a.length?{baseline:a[i]}:{}),...(i<b.length?{candidate:b[i]}:{})});else diff(a[i],b[i],path+'/'+i,out);}}
  else for(const k of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()){
   const p=path+'/'+k.replaceAll('~','~0').replaceAll('/','~1');
   if(!own(a,k)||!own(b,k))out.push({path:p,baselinePresent:own(a,k),candidatePresent:own(b,k),...(own(a,k)?{baseline:a[k]}:{}),...(own(b,k)?{candidate:b[k]}:{})});else diff(a[k],b[k],p,out);
  }
 }else out.push({path,baseline:a,candidate:b});return out;
}
function nodeDiff(a,b){let inner=pairCache.get(a);if(!inner){inner=new WeakMap();pairCache.set(a,inner);}let v=inner.get(b);if(!v){v=diff(a,b);inner.set(b,v);}return v;}
function createdEnvelope(node){const v=node.value;return /^reasoning:trace:\d+$/.test(node.id)&&node.kind==='component_state'&&node.component==='native_reasoning_trace'&&v?.component===node.id&&v?.profile==='logos-engine.v6.state-graph.v1'&&v?.root?.kind==='object'&&v.root.members?.created?.kind==='float64'&&/^[a-f0-9]{16}$/.test(v.root.members.created.bits);}
function timestamp(bits){try{const seconds=Buffer.from(bits,'hex').readDoubleBE();return{seconds,iso:Number.isFinite(seconds)&&Math.abs(seconds)<8.64e12?new Date(seconds*1000).toISOString():null};}catch{return null;}}
function emit(domain,ctx,d,aNode,bNode,digests){
 let category='other_field';
 if(d.path==='/origin/source_digest'&&aNode&&bNode)category=d.baseline===digests[0]&&d.candidate===digests[1]?'origin_source_digest_bound_to_role':'origin_source_digest_unexpected';
 else if(d.path==='/value/root/members/created/bits'&&aNode&&bNode&&createdEnvelope(aNode)&&createdEnvelope(bNode))category='hypothetical_created_envelope_timestamp';
 else if(domain==='common_delta_identity'||domain==='point_graph_identity')category='derived_identity_or_structural_count';
 const row={...ctx,domain,category,...d,residualAfterCreatedHypothesis:category!=='hypothetical_created_envelope_timestamp'};
 if(category==='hypothetical_created_envelope_timestamp')row.decodedTimestamp={baseline:timestamp(d.baseline),candidate:timestamp(d.candidate)};
 outputs.raw.put(row);count(result.counts,'rawDifferences');count(result.categoryCounts,category);count(result.domainCounts,domain);
 const key=JSON.stringify([domain,ctx.nodeId??null,d.path,category]);count(result.paths,key);
 if(row.residualAfterCreatedHypothesis){outputs.residual.put(row);count(result.counts,'residualAfterCreatedOnly');}
 if(category.startsWith('origin_source_digest')){outputs.origin.put(row);count(result.counts,'originSourceDigestDifferences');}
 if(['common_node','common_delta_node','common_delta_cause','common_delta_order'].includes(domain)&&!['hypothetical_created_envelope_timestamp','origin_source_digest_bound_to_role'].includes(category)){outputs.unexplained.put(row);count(result.counts,'commonNodeOrCauseResidualExcludingDeclaredOrigin');}
}
async function* streamCapture(role){
 const path=join(DIR,'owner-'+role+'.json.gz'),before=fs.statSync(path),sha=createHash('sha256');
 const source=fs.createReadStream(path),stream=source.pipe(createGunzip()),decoder=new StringDecoder('utf8');
 source.on('data',chunk=>sha.update(chunk));source.on('error',e=>stream.destroy(e));
 let pending='',line=0,record=0,previousComma=true,ended=false,complete=false;
 const parse=value=>{guard();if(line++===0){assert(value.endsWith('"records":['),'Invalid capture header '+role);return{type:'$header',value:JSON.parse(value+']}')};}
  assert(!ended,'Data after footer '+role);if(value.startsWith('],')){assert(record>0&&!previousComma,'Invalid footer separator '+role);ended=true;const footer=JSON.parse('{'+value.slice(2));assert(footer.recordCount===record,'Footer record count '+role);return{type:'$footer',value:footer};}
  assert(previousComma,'Missing record comma '+role);previousComma=value.endsWith(',');const row=JSON.parse(previousComma?value.slice(0,-1):value);assert(row.recordIndex===record,'Noncontiguous record '+role);record++;result.recordsPerRole[role]=record;return row;};
 try{for await(const chunk of stream){guard();pending+=decoder.write(chunk);assert(pending.length<=MAXLINE,'Pending line bound '+role);let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);if(line.length)yield parse(line);}}
  pending+=decoder.end();if(pending.length)yield parse(pending);assert(ended,'Capture footer absent '+role);complete=true;
 }finally{source.destroy();stream.destroy();const after=fs.statSync(path);result.inputs[role]={file:path.split('/').at(-1),bytes:before.size,mtimeMsBefore:before.mtimeMs,mtimeMsAfter:after.mtimeMs,sizeAfter:after.size,unchangedStat:before.size===after.size&&before.mtimeMs===after.mtimeMs,completeRead:complete,sha256:complete?sha.digest('hex'):null};}
}
function start(role,row){return{role,start:row,nodes:new Map(),revision:0,chain:null,runtimeDigest:null,points:0,commands:0};}
function applyGraph(state,row){
 const g=row.knowledge,s=row.snapshot;state.runtimeDigest??=s.sourceDigest;
 assert(g&&Array.isArray(g.deltasAdded),'Missing graph deltas');assert(g.fromRevision===state.revision,'Graph fromRevision');assert(s.sourceDigest===state.runtimeDigest,'Runtime digest changed');
 for(const d of g.deltasAdded){guard();assert(d.sequence===state.revision+1,'Delta sequence');assert(d.previous===state.chain,'Delta previous link');assert(d.source_digest===state.runtimeDigest,'Delta runtime digest');const n=d.node,prior=state.nodes.get(n.id);assert(n.scope===row.sessionId,'Node scope');assert(n.origin.source_digest===state.runtimeDigest,'Node origin digest');assert(n.revision===(prior?.revision??0)+1,'Node revision');state.nodes.set(n.id,n);state.revision=d.sequence;state.chain=d.digest;}
 assert(g.toRevision===state.revision&&g.chain===state.chain&&g.nodeCount===state.nodes.size,'Graph summary mismatch');assert(s.graphRevision===state.revision&&s.graphChain===state.chain&&s.nodeCount===state.nodes.size,'Snapshot graph mismatch');assert(row.pointIndex===state.points++,'Point order');
}
function comparePoint(states,a,b){
 const ctx={case:a.case,form:a.form,pointIndex:a.pointIndex,type:a.type,recordIndex:a.recordIndex};context=ctx;
 assert(a.pointIndex===b.pointIndex&&a.request.type===b.request.type&&a.request.sequence===b.request.sequence,'Point/request alignment');
 applyGraph(states[0],a);applyGraph(states[1],b);const [left,right]=states,digests=[left.runtimeDigest,right.runtimeDigest];
 const common=[...left.nodes.keys()].filter(id=>right.nodes.has(id)),missing=[...left.nodes.keys()].filter(id=>!right.nodes.has(id)),extra=[...right.nodes.keys()].filter(id=>!left.nodes.has(id));
 const pc={...ctx,commonNodes:common.length,baselineNodes:left.nodes.size,candidateNodes:right.nodes.size,baselineOnlyNodeIds:missing,candidateOnlyNodeIds:extra,commonDeltas:0,baselineOnlyDeltas:0,candidateOnlyDeltas:0};
 for(const id of common){guard();const x=left.nodes.get(id),y=right.nodes.get(id),ds=nodeDiff(x,y);outputs.coverage.put({...ctx,nodeId:id,baselineRevision:x.revision,candidateRevision:y.revision,rawDifferences:ds.length,rawEqual:ds.length===0});count(result.counts,'commonNodeComparisons');for(const d of ds)emit('common_node',{...ctx,nodeId:id},d,x,y,digests);}
 for(const[role,ids,state]of[['baseline',missing,left],['candidate',extra,right]])for(const id of ids){outputs.unmatched.put({...ctx,role,nodeId:id,node:state.nodes.get(id)});count(result.counts,role+'OnlyNodeOccurrences');}
 const deltas=[a.knowledge.deltasAdded,b.knowledge.deltasAdded],maps=deltas.map(ds=>{const m=new Map();for(const d of ds){const key=JSON.stringify([d.node.id,d.node.revision]);assert(!m.has(key),'Duplicate delta node/revision within point');m.set(key,d);}return m;});
 const shared=[...maps[0].keys()].filter(k=>maps[1].has(k));pc.commonDeltas=shared.length;
 const orderA=[...maps[0].keys()].filter(k=>maps[1].has(k)),orderB=[...maps[1].keys()].filter(k=>maps[0].has(k));
 for(const d of diff(orderA,orderB))emit('common_delta_order',ctx,d,null,null,digests);
 for(const key of shared){guard();const x=maps[0].get(key),y=maps[1].get(key),dc={...ctx,nodeId:x.node.id,nodeRevision:x.node.revision};count(result.counts,'commonDeltaComparisons');for(const d of nodeDiff(x.node,y.node))emit('common_delta_node',dc,d,x.node,y.node,digests);for(const d of diff(x.cause,y.cause))emit('common_delta_cause',dc,d,null,null,digests);const metadata=d=>Object.fromEntries(Object.entries(d).filter(([k])=>k!=='node'&&k!=='cause'));for(const d of diff(metadata(x),metadata(y)))emit('common_delta_identity',dc,d,null,null,digests);}
 for(let i=0;i<2;i++)for(const[k,d]of maps[i])if(!maps[1-i].has(k)){const role=i?'candidate':'baseline';pc[role+'OnlyDeltas']++;outputs.unmatched.put({...ctx,role,delta:d});count(result.counts,role+'OnlyDeltaOccurrences');}
 const identity=row=>({knowledge:Object.fromEntries(Object.entries(row.knowledge).filter(([k])=>k!=='deltasAdded')),snapshot:{sourceDigest:row.snapshot.sourceDigest,graphChain:row.snapshot.graphChain,graphRevision:row.snapshot.graphRevision,nodeCount:row.snapshot.nodeCount,nativeExecutionDigest:row.snapshot.nativeExecutionDigest}});
 for(const d of diff(identity(a),identity(b)))emit('point_graph_identity',ctx,d,null,null,digests);
 result.points.push(pc);count(result.counts,'pointsCompared');
}
let failure=null;
try{
 guard(true);assert(!fs.existsSync(join(DIR,PREFIX+'.json')),'Refuse existing attempt03 inventory');
 for(const name of ['raw','residual','origin','unexplained','coverage','unmatched'])outputs[name]=new Output(name);
 const receipts=['baseline','candidate'].map(role=>JSON.parse(fs.readFileSync(join(DIR,'owner-'+role+'.receipt.json'),'utf8')));
 result.expectedSessions=receipts[0].sessions.length;result.expectedPointsPerRole=Object.fromEntries(['baseline','candidate'].map((role,i)=>[role,receipts[i].sessions.reduce((n,s)=>n+s.captures+s.terminalInspections,0)]));
 streams=[streamCapture('baseline'),streamCapture('candidate')];let states=null,sessions=0,footer=false,preflight=false;
 while(true){guard();const pair=await Promise.all(streams.map(s=>s.next()));assert(pair[0].done===pair[1].done,'Stream lengths differ');if(pair[0].done)break;const[a,b]=pair.map(p=>p.value);assert(a.type===b.type,'Record types differ');context={type:a.type,recordIndex:a.recordIndex};
  if(a.type==='$header'){assert(a.value.role==='baseline'&&b.value.role==='candidate','Header roles');result.captureHeaders={baseline:a.value,candidate:b.value};continue;}
  if(a.type==='$footer'){assert(states===null,'Footer inside session');result.captureFooters={baseline:a.value,candidate:b.value};footer=true;continue;}
  assert(a.recordIndex===b.recordIndex,'Record indexes differ');
  if(a.type==='preflight'){assert(!preflight,'Duplicate preflight');preflight=true;continue;}
  if(a.type==='session_start'){assert(!states,'Nested session');assert(JSON.stringify([a.case,a.form,a.sessionId])===JSON.stringify([b.case,b.form,b.sessionId]),'Session alignment');states=[start('baseline',a),start('candidate',b)];continue;}
  assert(states&&a.sessionId===states[0].start.sessionId&&b.sessionId===states[1].start.sessionId,'Record outside aligned session');
  if(a.type==='capture'||a.type==='terminal_inspection')comparePoint(states,a,b);
  else if(a.type==='command_checked'){assert(JSON.stringify(a.actualCommand)===JSON.stringify(b.actualCommand),'Public command differs');states.forEach(s=>s.commands++);}
  else if(a.type==='session_end'){for(let i=0;i<2;i++){const row=i?b:a,receipt=receipts[i].sessions[sessions];assert(states[i].points===receipt.captures+receipt.terminalInspections,'Session point total vs receipt');assert(states[i].commands===receipt.commands&&row.commands===receipt.commands,'Session command count');}result.sessions.push({case:a.case,form:a.form,sessionId:a.sessionId,points:states[0].points,commands:states[0].commands,runtimeDigests:states.map(s=>s.runtimeDigest)});states=null;sessions++;}
  else throw Error('Unsupported record type '+a.type);
 }
 assert(footer&&preflight&&states===null&&sessions===result.expectedSessions,'Incomplete stream/session envelope');assert(result.counts.pointsCompared>0&&result.counts.pointsCompared===result.expectedPointsPerRole.baseline&&result.counts.pointsCompared===result.expectedPointsPerRole.candidate,'Point coverage incomplete or zero');
 for(let i=0;i<2;i++){const role=i?'candidate':'baseline',input=result.inputs[role];assert(input.completeRead&&input.unchangedStat,'Incomplete/changed input '+role);assert(input.sha256===receipts[i].report.sha256&&input.bytes===receipts[i].report.bytes,'Capture bytes differ from receipt '+role);}
 result.complete=true;result.scopeConclusion='All expected capture/inspection points and every common node at each point were inventoried; differences remain diagnostic and no official qualification is issued.';
}catch(e){failure=e;result.errors.push({name:e.name,message:e.message,context});}
finally{
 await Promise.allSettled(streams.map(s=>s.return()));
 result.outputs={};for(const[name,out]of Object.entries(outputs))try{result.outputs[name]=out.close();}catch(e){result.errors.push({name:e.name,message:e.message,output:name});result.complete=false;}
 result.finishedAt=new Date().toISOString();result.elapsedSeconds=(performance.now()-START)/1000;
 result.uniqueDifferencePaths=Object.keys(result.paths).length;const paths=result.paths;delete result.paths;
 fs.writeFileSync(join(DIR,PREFIX+'-paths.json'),JSON.stringify({schema:'logos-engine.lot6b-diagnostic-path-inventory.v1',complete:result.complete,paths:Object.entries(paths).map(([key,count])=>({key:JSON.parse(key),count}))},null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(join(DIR,PREFIX+'.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({complete:result.complete,officialQualification:false,counts:result.counts,categories:result.categoryCounts,domains:result.domainCounts,sessions:result.sessions.length,records:result.recordsPerRole,elapsedSeconds:result.elapsedSeconds,errors:result.errors}));
 if(failure||!result.complete)process.exitCode=2;
}
