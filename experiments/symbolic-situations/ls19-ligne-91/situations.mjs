import assert from 'node:assert/strict';
import { capture } from '../ls19-ligne-90/fixture.mjs';
export const baseline='975d9d809ba1cb41dd8c63414586cb95498018b1';
const ls=capture('ls19');

// La capture enregistre deux bandes du mobile, sur un sol de couleur 3.
// L'ouverture libère le carré d'entrée. Le passage déplace les huit lignes du mobile.
function variant(frame,change,drift) {
  if(change==='identique') return frame;
  const next=frame.map(row=>[...row]);
  if(change==='decalage') {
    assert.ok(Number.isInteger(drift) && Math.abs(drift)>=1 && Math.abs(drift)<=3);
    for(let y=48;y<56;y++) for(let x=40;x<48;x++) next[y][x]=3;
    for(let y=48;y<56;y++) for(let x=40;x<48;x++) next[y][x+drift]=frame[y][x];
    return next;
  }
  for(let y=0;y<8;y++) for(let x=40;x<48;x++) {
    assert.equal(frame[48+y][x],y<2?12:9);
    if(change==='passage') {
      next[56+y][x]=frame[48+y][x];
      next[48+y][x]=3;
    } else if(change==='ouverture') next[56+y][x]=3;
    else throw Error('Retour construit inconnu');
  }
  return next;
}
function orient(frame,mode) {
  if(mode==='miroir') return frame.map(row=>[...row].reverse());
  if(mode==='rotation') return frame[0].map((_,x)=>frame.map(row=>row[x]).reverse());
  if(mode==='rotation-miroir') return frame[0].map((_,x)=>frame.map(row=>row[x]));
  assert.equal(mode,'original');
  return frame;
}
export function game(spec) {
  const {step,change,mode,tail=0}=spec;
  assert.ok([12,13].includes(step));
  assert.ok(tail>=0 && tail<=4);
  function observation(i) {
    const o=ls.observations[Math.min(step,i)];
    const map=f=>orient(i>=step?variant(f,change,spec.drift):f,mode);
    return {frame:map(o.frame),frames:o.frames.map(map),availableActionIds:o.availableActionIds,
      state:o.state,level:o.level,levelsCompleted:o.levelsCompleted,stepIndex:i};
  }
  return {budgets:{...ls.budgets,maxActions:24},initial:observation(0),length:step+tail,
    advance(i,cmd){
      if(!cmd || !ls.observations[0].availableActionIds.includes(Number(cmd.actionRef.replace('ACTION',''))) ||
         Object.keys(cmd.data).length) return null;
      if(i<step && ls.commands[i].actionRef!==cmd.actionRef) return null;
      return observation(i+1);
    }};
}
export const development=[
  {id:'D1-présent',step:12,change:'identique',mode:'miroir',tail:1},
  {id:'D1-ouvert',step:12,change:'ouverture',mode:'miroir',tail:1},
  {id:'D2-arrêt',step:13,change:'identique',mode:'original',tail:2},
  {id:'D2-passage',step:13,change:'passage',mode:'original',tail:2},
];
