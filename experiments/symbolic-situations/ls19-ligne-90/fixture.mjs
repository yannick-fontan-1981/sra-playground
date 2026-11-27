import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

export const reference='13ebd79de759b1052e1b261d9c6c3f5b2205d7f9';
const blob=path=>execFileSync('git',['show',reference+':tests/fixtures/'+path],{maxBuffer:16*1024*1024,windowsHide:true});
export function capture(family) {
  if(family==='viewport'){
    const {publicProtocol,budgets}=JSON.parse(blob('v6-native-caller/viewport-three-prefixes.json'));
    return {budgets,observations:publicProtocol.events.map(e=>e.observation),
      commands:publicProtocol.events.slice(1).map(e=>e.command)};
  }
  assert.equal(family,'ls19');
  const {budgets,observations,commands}=JSON.parse(gunzipSync(blob('sic-view-edge-ls19-l1.json.gz')));
  return {budgets,observations,commands};
}

// Transformations locales d'un environnement à transitions partielles. Une action non enregistrée
// n'a pas de successeur connu. Elle n'autorise jamais la transmission de l'image historique suivante.
export function build({family,op,mirror=false,rotate=false,hold=0,limit,alias=5}) {
  const {budgets,commands,observations}=capture(family);
  const images=observations.map((o,i)=>{
    const src=i===hold && hold ? observations[i-1] : o;
    const transform=f=>{
      const oriented=rotate?f[0].map((_,x)=>f.map(row=>row[x]).reverse()):f;
      return mirror?oriented.map(row=>[...row].reverse()):oriented;
    };
    return {frame:transform(src.frame),frames:src.frames.map(transform),
      availableActionIds:o.availableActionIds.map(id=>family==='viewport' && id===5?alias:id),
      state:o.state,level:o.level,levelsCompleted:o.levelsCompleted,stepIndex:o.stepIndex};
  });
  const inputs=commands.map(c=>({actionRef:family==='viewport'?'ACTION'+alias:c.actionRef,data:c.data}));
  return {op,budgets,initial:images[0],length:limit??inputs.length,
    advance(i,command) {return command?.actionRef===inputs[i]?.actionRef && Object.keys(command.data).length===0?images[i+1]:null;}};
}
export const development=[
  {op:'vue',family:'viewport',alias:3,limit:3},
  {op:'vue-fixe',family:'viewport',alias:3,hold:3,limit:3},
  {op:'passage',family:'ls19',mirror:true,limit:13},
  {op:'contact-avance',family:'ls19',mirror:true,hold:3,limit:3},
];
