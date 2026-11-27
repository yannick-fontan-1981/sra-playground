// Une observation par enregistrement. Les prédictions et la mémoire viennent du fournisseur natif.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { root } from './parcours.mjs';
import { sha } from './sonde.mjs';

const fixture='docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz';
export async function counterfactuals(engine=root) {
  const {RootedLineMemory,rootedLineAfter} = await import(new URL('src/logos-engine/v6-rooted-line-access.ts',engine));
  const {publicFrameHash} = await import(new URL('src/logos-engine/v6-native-observer.ts',engine));
  const {measureRootedLine,physicalRootedLine} = await import(new URL('src/logos-engine/v6-rooted-line-observation.ts',engine));
  const {compileRecoveryPack,defaultRecoveryPack,contactRecoveryOrder} = await import(new URL('src/sic/active-recovery.ts',engine));
  const archive=await readFile(new URL(fixture,root));
  const {packets,sourceDigest} = JSON.parse(gunzipSync(archive));
  const declaration='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm';
  const config=JSON.parse(await readFile(new URL(declaration,engine))).declarations[0].configuration.observed_composition_services;
  const frame = i => packets[i].packet.frame_rows;
  async function observation(i,rows=frame(i)) {
    return {level_epoch:1,levels_completed:0,available_action_refs:packets[i].packet.available_action_refs,
      observation_ref:'contact-qualification:epoch:1:revision:'+(i+1)+':frame:'+await publicFrameHash(rows)};
  }
  // Reconstituer les dix premiers retours pour reprendre le même plan, avec son vrai décalage.
  const memory=new RootedLineMemory();
  let plan;
  const prefix=[];
  for(let i=0;i<10;i++) {
    const index=i<4 ? 0 : i-4, before=await observation(i), after=await observation(i+1);
    if (!index) plan=memory.propose(before,frame(i),[],16,config);
    const command=plan.actions[index];
    assert.deepEqual({data:{},...command},packets[i+1].command);
    memory.record(before,command,after,frame(i),frame(i+1),plan,index);
    prefix.push(command.action_ref);
  }
  function clone(m) {
    const copy=new RootedLineMemory();
    copy.applyEvent({kind:'observed_rooted_line',memory:m.currentState().line_memory});
    return copy;
  }
  async function acquire(m,turn,rows) {
    const i=turn-1,index=i-4, before=await observation(i),after=await observation(turn,rows),cmd=plan.actions[index];
    assert.deepEqual({data:{},...cmd},packets[turn].command);
    const check=rootedLineAfter(plan,index,frame(i),rows,{epoch:1,score:0});
    m.record(before,cmd,after,frame(i),rows,plan,index);
    const state=m.currentState().line_memory;
    return {turn,command:cmd.action_ref,ref:after.observation_ref,matched:check.matched,sealed:check.seal_prefix,
      counterexamples:state.refuted.length,chain:state.refuted.at(-1)?.cell_push_witness ?? null,need:state.sic_recovery_need?.id ?? null};
  }
  const irrelevant=frame(11).map(row=>row.slice());
  irrelevant[0][0]=(irrelevant[0][0]+1)%16;
  const unchanged=measureRootedLine(frame(11)),modified=measureRootedLine(irrelevant);
  assert.deepEqual(physicalRootedLine(modified),physicalRootedLine(unchanged));
  assert.equal(modified.layout,unchanged.layout);
  const ui=await acquire(clone(memory),11,irrelevant);
  const original=await acquire(memory,11,frame(11));
  const scene=measureRootedLine(frame(12)), wrong=frame(12).map(row=>row.slice());
  // Transposer les deux identités observées dans le terrain et conserver les références du bandeau.
  for(const p of scene.pieces.filter(p=>['8','9'].includes(p.type))) {
    const [l,t,r,b]=p.bbox;
    for(let y=t;y<=b;y++) for(let x=l;x<=r;x++) if(wrong[y][x]===Number(p.type)) wrong[y][x]=p.type==='8'?9:8;
  }
  const wrongScene=measureRootedLine(wrong);
  assert.equal(wrongScene.layout,scene.layout);
  assert.deepEqual(wrongScene.root,scene.root);
  assert.equal(wrongScene.tip,scene.tip);
  const broken=clone(memory), wrongChain=await acquire(broken,12,wrong);
  const actual=await acquire(memory,12,frame(12)), current=await observation(12);
  const pack = extra=>compileRecoveryPack({...defaultRecoveryPack,...extra});
  function decision(m,obs,rows,extra={}) {
    const p=m.propose(obs,rows,[],16,{...config,sic_recovery:pack(extra)});
    const sic=p.sic_decision ?? p.rooted_line_plan?.search?.sic_decision;
    return {status:p.status,reason:p.reason ?? null,blocks:p.block_unrelated_probe ?? false,release:p.release_authority ?? null,
      actions:p.actions?.map(c=>c.action_ref) ?? [],strategy:sic?.strategy ?? null,need:sic?.need?.status ?? null,
      agenda:sic?.agenda.map(e=>[e.id,e.result]) ?? [],visited:sic?.visited ?? null};
  }
  const failedRevision=clone(memory), revised=failedRevision.propose(current,frame(12),[],16,config);
  const later={...current,observation_ref:current.observation_ref.replace(':revision:13:',':revision:14:')};
  const secondCheck=rootedLineAfter(revised,0,frame(12),frame(12),{epoch:1,score:0});
  failedRevision.record(current,revised.actions[0],later,frame(12),frame(12),revised,0);
  const secondState=failedRevision.currentState().line_memory;
  return {fixture,archiveSha256:createHash('sha256').update(archive).digest('hex'),sourceDigest,prefix,
    publicPrefix:await Promise.all(packets.map(async (p,i)=>({i,ref:(await observation(i)).observation_ref,cmd:p.command?.action_ref ?? null}))),
    before:sha(physicalRootedLine(unchanged)),original,ui,actual,wrongChain,
    secondFailure:{before:current.observation_ref,after:later.observation_ref,matched:secondCheck.matched,
      previousNeed:actual.need,retained:secondState.sic_recovery_need,refutations:secondState.refuted.length,
      next:decision(failedRevision,later,frame(12))},
    wrongOutcome:decision(broken,await observation(12,wrong),wrong),
    wrongScope:decision(memory,{...current,observation_ref:current.observation_ref.replace('contact-qualification:','autre-session:')},frame(12)),
    noAccess:decision(memory,current,frame(12),{maxDepth:1}),
    shadow:decision(memory,current,frame(12),{mode:'shadow'}),
    fallback:decision(memory,current,frame(12),{strategyOrder:[...contactRecoveryOrder].reverse(),maxDepth:7})};
}
