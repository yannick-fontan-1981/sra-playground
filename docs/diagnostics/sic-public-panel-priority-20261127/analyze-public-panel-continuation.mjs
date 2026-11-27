import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const load=file=>import(pathToFileURL(resolve(file)));
const [{createSicPublicInputExploration,observedPressureRecoveryGroup},{NativeKnowledgeStore},{ObservedInputDomain}]=await Promise.all([
  load('src/sic/public-input-exploration.ts'),load('src/logos-engine/v6-knowledge-store.ts'),load('src/logos-engine/v6-native-observer.ts')]);
const [input,output]=process.argv.slice(2);
const capture=JSON.parse(await readFile(input,'utf8'));
const family=createSicPublicInputExploration(true);
await family.attachPrograms(new NativeKnowledgeStore('public-panel-diagnostic','public-panel-diagnostic'));
const domain=new ObservedInputDomain(100);
const results=[];
for(const item of capture.publicEvidence){
  const state=item.populationFamilies[family.id],observation=item.nativeObservation,rows=item.publicBefore.frame;
  family.restore(state);
  const inputs=domain.candidates(observation);
  const proposal=await family.propose(observation,rows,inputs,271-(item.index-373));
  family.restore(state);
  const early=await family.proposeInGroup(observedPressureRecoveryGroup,observation,rows,inputs,271-(item.index-373));
  const payload=p=>p?{kind:p.kind,actions:p.actions,strategy:p.sicSituationCard?.strategy,situation:p.sicSituationCard?.situation,
    fields:Object.keys(p).filter(k=>/panel|terrain|mechanism|transport|access|revealed|bridge/i.test(k)),
    stage:p.sicSrcDecision?.situation?.stage,evidence:p.sicSituationCard?.evidence,
    ...(p.panelApproach?{approach:p.panelApproach}:{}),...(p.panelContact?{contact:p.panelContact}:{}),
    ...(p.panelComparison?{comparison:p.panelComparison}:{}),binding:p.binding}:null;
  results.push({index:item.index,levelCommand:item.index-372,selected:{family:item.plan?.family,action:item.action,strategy:item.proposal?.sicSituationCard?.strategy},
    state:{epoch:state.epoch,experiments:state.experiments,walker:state.panelWalker,effectCount:state.panelEffects?.length,
      marker:state.panelMarker,arrival:state.panelArrival,sources:state.panelSources,destinations:state.panelDestinations,
      programmes:state.panelPrograms,tests:state.panelTests,lastPanelContext:state.lastPanelContext},early:payload(early),available:payload(proposal)});
}
const doc={source:capture.source,commandPrefixMatches:capture.commandPrefixMatches,mode:'Offline evaluation of captured public family state with the real registered landing decision module; no engine state or reference route',limitations:['No directional-motion callback was captured. This evaluation retains public panel knowledge and the observed command domain.'],results};
await writeFile(output,JSON.stringify(doc,null,2));
for(const r of results) console.log(JSON.stringify({n:r.levelCommand,selected:r.selected,early:r.early?.stage??null,available:r.available&&{stage:r.available.stage,actions:r.available.actions,fields:r.available.fields},walker:!!r.state.walker,effects:r.state.effectCount}));
