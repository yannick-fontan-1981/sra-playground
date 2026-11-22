/** Private level-design checks. Not imported by the playable demo. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';
import {compileLevel,initialState,stepDetailed,circuitPressed,gateClosed,doorsOpen,supported,terrainAt} from '../../dist/core.js';
const designs=[5,6,7,8].map(n=>JSON.parse(readFileSync(new URL(`../level${n}-design.json`,import.meta.url))));
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const has=(ps,x,y)=>ps.some(p=>p.x===x&&p.y===y);
const summaries=[];
function snapshot(r){return{heroes:r.state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:r.state.stones,supports:r.state.supports,monsters:r.state.monsters,mirrors:r.state.mirrors,dead:r.state.dead,failed:r.state.failed,complete:r.state.complete,gateClosed:r.state.gateClosed??[],platformActive:r.state.platformActive??[],circuits:Object.fromEntries(r.world.circuits.map(c=>[c.id,circuitPressed(r.world,r.state,c.id)])),metrics:r.metrics};}
function caseAt(d,label,commands,test,scope){const r=replay(d.spec,commands);test(r);const result={label,commands,observed:snapshot(r),scope};summaries.push({level:+d.spec.id.slice(-2),...result});return r;}
function authorAt(d,stage){const a=new Author(d.spec);if(stage>=0)a.act(d.commands.slice(0,d.stages[stage].turn));return a;}
function staticReach(w,s,starts){const key=p=>`${p.x},${p.y}`,queue=[...starts],seen=new Set(queue.map(key));for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(seen.has(key(p))||terrainAt(w,p)==='#'||!supported(w,s,p)||w.gates.some((g,j)=>eq(g.at,p)&&gateClosed(w,s,j))||(w.doors.some(d=>eq(d,p))&&!doorsOpen(w,s)))continue;seen.add(key(p));queue.push(p);}return{cells:queue,keys:seen};}
const baseline=designs.map(d=>{const r=replay(d.spec,d.commands);assert(r.state.complete&&!r.state.dead);assert.equal(r.metrics.blocked,0);const w=compileLevel(d.spec),s=initialState(w),reach=staticReach(w,s,s.heroes.map(h=>h.at));assert(w.goals.every(g=>!reach.keys.has(`${g.x},${g.y}`)));assert.equal(w.heroes.length,3);assert.equal(w.goals.length,3);assert(w.gates.every(g=>!w.buttons.some(b=>eq(b,g.at))));return{level:+d.spec.id.slice(-2),title:d.spec.title,winningRoute:r.metrics,initialFixedGeometry:{reachableCellsIgnoringActors:reach.cells.length,reachableGoals:0,closedGateCount:w.gates.filter((_,i)=>gateClosed(w,s,i)).length,scope:'Flood-fill with initial circuits fixed, ignoring actor obstacles. Establishes no initial walking access; not a search over button changes or reflections.'},purePresses:true};});
{
 const d=designs[0];
 const a=authorAt(d,-1);a.select('warrior').act('R').select('thief').act('DDDR').go(13,6);
 caseAt(d,'L5 — la porte ouverte ne suffit pas tant que les gardiens restent vivants',a.commands+'D',r=>{assert(r.state.dead);assert(r.state.heroes.find(h=>h.kind==='thief').dead);assert.equal(r.state.monsters.length,2);},'Exact local branch with both final weights in place, before firing the distant loaded press.');
 const noCargo=structuredClone(d.spec);noCargo.rows[8]=noCargo.rows[8].slice(0,10)+'.'+noCargo.rows[8].slice(11);const r=replay(noCargo,'L');assert.equal(r.state.monsters.length,2);assert.equal(r.metrics.pistonPushes,0);summaries.push({level:5,label:'L5 — une presse vide ne déplace pas son voisin',observed:snapshot(r),scope:'Local initial cargo ablation, one command only; not a global impossibility claim.'});
 const after=authorAt(d,2);after.go(15,5,'thief');
 caseAt(d,'L5 — reprendre le lest nord referme la porte',after.commands+'D',r=>{assert(!circuitPressed(r.world,r.state,'deux-poids'));assert(gateClosed(r.world,r.state,1));assert(!r.state.dead);},'Exact branch after the two final weights have been installed.');
}
{
 const d=designs[1];
 const a=authorAt(d,1);a.select('merchant').act('R');
 caseAt(d,'L6 — retirer le chantier avant de changer l’axe gaspille les deux charges',a.commands,r=>{assert(has(r.state.supports,9,10)&&has(r.state.supports,10,10));assert(!has(r.state.supports,9,9)&&!has(r.state.supports,10,9));const reach=staticReach(r.world,r.state,r.state.heroes.filter(h=>h.kind!=='thief').map(h=>h.at));assert(!reach.keys.has('11,9'));assert(!r.state.dead);},'The two crates are irreversibly fixed in the south work row; the current static passage from the west is still broken. No claim of exhaustive global unsolvability.');
 const b=authorAt(d,1);b.go(9,11,'warrior').act('U').select('merchant');
 caseAt(d,'L6 — le gardien attend que le Guerrier quitte le chantier',b.commands+'R',r=>{assert(r.state.dead);assert(r.state.heroes.find(h=>h.kind==='warrior').dead);},'Exact interruption while the Warrior stands on the vacated south platform.');
 caseAt(d,'L6 — marée haute : les charges restent mobiles mais la dernière porte est fermée',d.commands.slice(0,d.stages[2].turn),r=>{assert(has(r.state.stones,9,9)&&has(r.state.stones,10,9));assert.equal(r.state.supports.length,0);assert(gateClosed(r.world,r.state,1));},'Correct route state immediately before the keeper leaves the control.');
 caseAt(d,'L6 — marée basse : deux appuis au bon rang et porte finale ouverte',d.commands.slice(0,d.stages[3].turn),r=>{assert(has(r.state.supports,9,9)&&has(r.state.supports,10,9));assert(!gateClosed(r.world,r.state,1));assert(!r.state.dead);},'Correct local transition, no shortest-route claim.');
}
{
 const d=designs[2];
 caseAt(d,'L7 — aucun reflet initial ne donne accès aux sorties','X',r=>{assert(r.state.failed);assert.equal(r.metrics.reflections,0);assert.equal(r.state.supports.length,0);},'Single initial mirror action with the original geometry.');
 const a=authorAt(d,3);a.go(8,6,'thief');
 caseAt(d,'L7 — un héros trop proche prend le transport destiné à la caisse',a.commands+'X',r=>{assert(eq(r.state.heroes.find(h=>h.kind==='thief').at,{x:6,y:8}));assert(has(r.state.stones,8,5));assert(!has(r.state.supports,5,8));},'Distance-priority counter-branch immediately before the planned first cargo reflection.');
 const b=authorAt(d,3);b.go(8,7,'merchant').act('DDR');
 caseAt(d,'L7 — retirer le miroir avant ses deux dépôts bloque son ancien travail',b.commands+'X',r=>{assert(r.state.failed);assert(has(r.state.mirrors.map(m=>m.at),8,10));assert(!has(r.state.supports,4,8)&&!has(r.state.supports,5,8));},'Exact wrong-order branch; it does not assert that undo or repositioning the mirror is impossible.');
 const noBuffer=structuredClone(d.spec);noBuffer.rows[12]=noBuffer.rows[12].slice(0,11)+'.'+noBuffer.rows[12].slice(12);const c=new Author(noBuffer);c.go(11,11,'warrior');const r=replay(noBuffer,c.commands+'D');assert(r.state.dead&&r.state.heroes.find(h=>h.kind==='warrior').dead);summaries.push({level:7,label:'L7 — la caisse intermédiaire maintient la distance au monstre',commands:c.commands+'D',observed:snapshot(r),scope:'One-crate local ablation at the guarded corridor; not an all-objects global search.'});
 caseAt(d,'L7 — les deux lests sont des ressources distinctes conservées après les immersions',d.commands.slice(0,d.stages[7].turn),r=>{assert(has(r.state.supports,4,8)&&has(r.state.supports,5,8)&&has(r.state.supports,13,5));assert(has(r.state.stones,11,17));assert(has(r.state.mirrors.map(m=>m.at),8,10));assert(circuitPressed(r.world,r.state,'dernier-bail'));assert.equal(r.state.monsters.length,0);},'Correct staged resource accounting: three permanent supports, one remaining crate and one mirror weight.');
}
{
 const d=designs[3];
 const a=authorAt(d,1);a.select('merchant').act('R').go(6,7,'thief').act('U');
 caseAt(d,'L8 — immerger la première caisse trop tôt supprime sa fonction de clef',a.commands,r=>{assert(has(r.state.supports,6,8));assert(!has(r.state.stones,6,7));assert(!circuitPressed(r.world,r.state,'reserve'));assert(gateClosed(r.world,r.state,1));},'Exact local premature withdrawal; other unsearched reorganizations are outside this check.');
 caseAt(d,'L8 — premier et deuxième dépôts gardent le monstre sur la commande',d.commands.slice(0,d.stages[4].turn),r=>{assert(has(r.state.monsters,8,1));assert.equal(r.state.monsters.length,2);assert(circuitPressed(r.world,r.state,'maree-gardee'));assert(has(r.state.stones,6,7));assert(has(r.state.stones,6,8));},'Correct route state after both loading and reflection operations.');
 const whole=replay(d.spec,d.commands);const unsafeIndex=whole.trace.findIndex(t=>eq(t.after.heroes.find(h=>h.kind==='warrior').at,{x:6,y:8})&&has(t.after.stones,5,8));assert(unsafeIndex>=0);const b=new Author(d.spec);b.act(d.commands.slice(0,unsafeIndex+1)).select('merchant');
 caseAt(d,'L8 — la sortie du gardien attend le retour du pousseur sur terre',b.commands+'R',r=>{assert(r.state.dead&&r.state.heroes.find(h=>h.kind==='warrior').dead);},'Exact hydraulic release while the Warrior is on the first platform.');
 const c=authorAt(d,7);c.go(8,7,'merchant').act('DDDR');
 caseAt(d,'L8 — retirer le premier miroir avant le dernier reflet conserve les gardiens',c.commands+'X',r=>{assert(r.state.failed);assert.equal(r.state.monsters.length,2);assert(has(r.state.mirrors.map(m=>m.at),8,11));},'Exact wrong-order branch after building both permanent supports; no global irrecoverability claim.');
 caseAt(d,'L8 — le dernier reflet sacrifie le gardien après la conversion des deux appuis',d.commands.slice(0,d.stages[8].turn),r=>{assert.equal(r.state.monsters.length,0);assert(has(r.state.supports,5,8)&&has(r.state.supports,6,8));assert(!circuitPressed(r.world,r.state,'maree-gardee'));assert(!r.state.dead);},'Correct order: permanent bridge first, removal of the hydraulic keeper second.');
 const e=authorAt(d,10);
 caseAt(d,'L8 — déposer la dernière caisse ne remplace pas le troisième lest',e.commands+'X',r=>{assert(has(r.state.stones,12,13));assert(!has(r.state.stones,14,9));assert(!circuitPressed(r.world,r.state,'trois-lests'));assert(gateClosed(r.world,r.state,2));},'Exact local branch before the Thief separates the auxiliary crate from the final file.');
 caseAt(d,'L8 — seul l’ensemble des trois lests ouvre l’accès collectif',d.commands.slice(0,d.stages[12].turn),r=>{assert(has(r.state.mirrors.map(m=>m.at),8,11));assert(has(r.state.stones,12,13)&&has(r.state.stones,14,9));assert(circuitPressed(r.world,r.state,'trois-lests'));assert(!gateClosed(r.world,r.state,2));assert.equal(r.state.supports.length,2);},'Correct staged accounting of four original crates: two supports and two dry final weights, plus the first mirror as third weight.');
}
const report={version:'SS16 0.1.0',status:'pass',scope:'Deterministic winning-route replays, initial fixed-circuit geometry checks and local counter-branches. These checks establish the listed effects only; they are not a proof of unique solutions, shortest paths or global impossibility after mistakes.',baseline,checks:summaries.length,localChecks:summaries};
writeFileSync(new URL('../levels5-8-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,levels:baseline.map(x=>({level:x.level,actions:x.winningRoute.actions,initialReachableGoals:x.initialFixedGeometry.reachableGoals})),localChecks:summaries.length}));
