import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {replay,decodeCommand} from '../../scripts/solver.mjs';
import {stepDetailed} from '../../dist/core.js';
const root=new URL('../',import.meta.url);
const output=new URL('finals-independent-review.json',root);
const baseline=JSON.parse(readFileSync(new URL('history/finals-known-bypasses.json',root),'utf8')).counterexamples;
function shortcut7(a){
 a.go(15,5,'merchant').act('L');
 a.select('thief').act('DD').act('R').go(8,2).act('D').act('R');
 a.go(7,8,'merchant').act('R');
 a.go(8,3,'warrior').act('DDDDDD');
 a.go(10,8,'merchant').act('L').go(7,2).act('R');
 a.go(11,11,'warrior').act('DDDDD');
 a.go(8,1,'merchant').act('X').go(1,6);
 a.go(8,1,'warrior').act('X').go(1,11);
 a.go(8,1,'thief').act('X').go(1,8);
}
function shortcut8(a){
 a.select('thief').act('DD').act('R').stage('Charger la caisse initiale sans la refléter');
 a.select('warrior').act('R').stage('La presse donne la caisse au Guerrier');
 a.go(9,8,'warrior').act('L').stage('Écarter le premier miroir temporairement');
 a.go(8,5).act('DDDDD').stage('La caisse initiale remplace le premier miroir sur son bouton final');
 a.go(6,8).act('R').go(9,8).stage('Rétablir le miroir pendant que le Marchand et le gardien maintiennent les plateformes');
 a.go(18,10).act('LL');
 a.go(14,9,'thief').act('U').act('L').stage('Déposer le deuxième lest avec une charge de la file');
 a.act('X').stage('Le premier miroir élimine les gardiens ; le second livre le troisième lest');
 a.go(18,8,'warrior');
 a.go(15,12,'thief').act('UU').go(13,10).stage('Débrancher le deuxième miroir par traction, en conservant son dépôt sur le bouton isolé');
 a.go(8,1,'merchant').act('X').go(1,18).stage('Le Marchand franchit toute l’eau par reflet');
 a.go(8,1,'warrior').act('X').go(3,18).stage('Le Guerrier franchit toute l’eau par reflet');
 a.go(8,1,'thief').act('X').go(6,18).stage('Le Voleur franchit toute l’eau par reflet');
}
function advanced8(a){
 a.select('thief').act('DD').act('R');a.select('warrior').act('RX');
 a.go(6,7,'thief').act('U').act('R');a.go(12,6,'warrior');
 a.go(10,2,'thief').act('DDDDDLULUR');a.select('warrior').act('R').go(8,7).act('ULX');
 a.go(17,4,'merchant').stage('Un seul appui est créé : la caisse-clef reste sèche');
 a.go(8,9,'warrior').act('UUU').stage('Le premier miroir est garé en amont');
 a.go(12,6,'merchant');a.go(7,7,'thief').act('RRU');
 a.select('warrior').act('DDDD').act('R').stage('La caisse-clef, au lieu du miroir, maintient le bouton final');
 a.go(8,6,'thief').act('DR');a.go(8,5,'warrior').act('DD');
 a.go(18,10,'warrior').act('LL');a.go(14,9,'thief').act('U').act('L');
 a.go(8,5,'warrior').act('X').go(1,18).stage('Le premier reflet transporte un héros sur le seul appui et livre le lest isolé');
 a.go(15,12,'thief').act('UU').go(13,10).stage('Le second miroir est retiré pour conserver son dépôt');
 a.go(8,5,'merchant').act('X').go(3,18);a.go(8,5,'thief').act('X').go(6,18);
}
const fingerprint=spec=>createHash('sha256').update(JSON.stringify(spec)).digest('hex');
const designs=Object.fromEntries([7,8].map(n=>[n,JSON.parse(readFileSync(new URL(`level${n}-design.json`,root),'utf8'))]));
const specHashes=Object.fromEntries([7,8].map(n=>[n,fingerprint(designs[n].spec)]));
for(const b of Object.values(baseline))b.specSha256=fingerprint(b.spec);
const checks=[];
for(const [n,build]of [[7,shortcut7],[8,shortcut8]]){
 const d=designs[n],a=new Author(d.spec);let result;
 try{build(a);const r=a.result({label:'Contre-exemple indépendant'},'Revue de géométrie, aucune modification du niveau.');result={status:'bypass-found',metrics:r.metrics,commands:r.commands,stages:r.stages};}
 catch(error){result={status:/No walking route|Invalid author action|Unsolved author route/.test(error.message)?'known-bypass-blocked':'review-error',blockedAt:error.message,acceptedPrefix:a.commands,stages:a.stages};}
 checks.push({name:`ancien-ferry-ss16-0${n}`,level:d.spec.id,specSha256:specHashes[n],referenceMetrics:d.metrics,...result});
}
const activeHistory=baseline.ss16_08_active_hydraulics;
if(!activeHistory)throw Error('The committed review must retain the historical active-hydraulics counterexample.');
const activeReplay=replay(designs[8].spec,activeHistory.commands);
const firstRefusal=activeReplay.trace.findIndex(t=>t.after.failed),blockedStep=activeReplay.trace[firstRefusal];
checks.push({name:'ancien-pont-hydraulique-permanent-141',level:'ss16-08',specSha256:specHashes[8],status:!activeReplay.state.complete&&firstRefusal>=0?'known-bypass-blocked':'bypass-found',originalMetrics:activeHistory.metrics,observedMetrics:activeReplay.metrics,firstRefusal:firstRefusal+1,blockedAction:blockedStep?.command,blockedHero:blockedStep?.before.heroes[blockedStep.before.active],gateClosed:blockedStep?.before.gateClosed,complete:activeReplay.state.complete});
let acceptedAdvancedAlternative;
try{const a=new Author(designs[8].spec);advanced8(a);const r=a.result({label:'Alternative avancée acceptée'},'Un seul appui ; réserve, clef, deux chargements et réorganisation des miroirs conservés.');acceptedAdvancedAlternative={level:'ss16-08',specSha256:specHashes[8],accepted:true,success:r.metrics.blocked===0&&r.metrics.deaths===0&&r.metrics.platformsCreated===1,metrics:r.metrics,commands:r.commands,stages:r.stages,scope:'Cette solution conserve la récupération de la réserve, les deux chargements, la conversion d’une caisse en appui, les trois lests et le retrait de la marée. Elle ne prouve aucun minimum global. Deux appuis et le miroir comme lest appartiennent au parcours de référence, pas à une obligation universelle.'};}
catch(error){acceptedAdvancedAlternative={level:'ss16-08',specSha256:specHashes[8],accepted:true,success:false,error:error.message};}
const probes=[];
try{
 const a=new Author(designs[8].spec);
 a.go(8,9,'warrior').act('U').go(9,7).act('LL').go(6,6).act('D');
 let trial=a.state;for(const c of 'UX'){const action=decodeCommand(c,trial);trial=stepDetailed(a.world,trial,action.id,action.data).state;}
 const farLandingBlocked=trial.failed&&!trial.dead;
 a.act('XD');a.go(17,4,'merchant');
 const shiftedMirrorLost=a.state.mirrors.length===1;
 probes.push({name:'L8-miroir-decale-vers-la-plateforme',success:farLandingBlocked&&shiftedMirrorLost&&!a.state.dead&&a.state.supports.length===0,acceptedPrefix:a.commands,observed:{farLandingBlocked,shiftedMirrorLost,heroDead:a.state.dead,permanentSupports:a.state.supports.length,remainingMirrors:a.state.mirrors},scope:'Le miroir peut être transporté sur la plateforme proche et déplacer un héros tant que la marée est maintenue. Le mur bloque le reflet plus long vers la rive sèche ; le retrait de la marée détruit ce miroir non soutenu. Comparaison locale, pas exploration globale.'});
}catch(error){probes.push({name:'L8-miroir-decale-vers-la-plateforme',success:false,error:error.message});}
try{const a=new Author(designs[8].spec);a.go(8,1,'merchant');probes.push({name:'L8-ancienne-source-du-ferry',success:false,reason:'Source island unexpectedly reached by walking.'});}
catch(error){probes.push({name:'L8-ancienne-source-du-ferry',success:/No walking route/.test(error.message),observed:error.message,scope:'Recherche de marche avec positions des autres ressources initiales ; ne prouve pas une inaccessibilité dans tous les états.'});}
function finalRayProbe7(support){
 const spec=designs[7].spec,rows=spec.rows,has=(x,y)=>x>=0&&y>=0&&y<rows.length&&x<rows[0].length;
 const wall=(x,y)=>!has(x,y)||rows[y][x]==='#'||spec.gates.some(g=>g.at.x===x&&g.at.y===y&&(g.circuit==='dernier-bail'?g.closedWhen==='pressed':g.closedWhen==='released'));
 const safe=(x,y)=>!wall(x,y)&&(rows[y][x]!=='~'||(x===support.x&&y===support.y)||(x===13&&y===5));
 const region=(x,y)=>{const set=new Set(),queue=[[x,y]];while(queue.length){const [a,b]=queue.pop(),k=a+','+b;if(set.has(k)||!safe(a,b))continue;set.add(k);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([a+dx,b+dy]);}return set;};
 const east=region(8,8),west=region(1,6),hits=[];
 for(const key of east){const [mx,my]=key.split(',').map(Number);for(const [sx,sy,tx,ty]of [[0,-1,-1,0],[-1,0,0,-1]])for(let d=1;d<20;d++){
  const x=mx+sx*d,y=my+sy*d,u=mx+tx*d,v=my+ty*d;if(wall(x,y)||wall(u,v))break;
  if(safe(x,y)&&!west.has(x+','+y)&&safe(u,v)&&west.has(u+','+v))hits.push({mirror:{x:mx,y:my},source:{x,y},destination:{x:u,y:v}});
 }}
 return{support,mirrorPositionSuperset:east.size,goalSide:west.size,possibleCrossings:hits};
}
const rayCases=[{x:4,y:8},{x:5,y:8}].map(finalRayProbe7);
probes.push({name:'L7-visées-apres-les-lests-avec-un-seul-appui',success:rayCases.every(c=>c.possibleCrossings.length===0),cases:rayCases,scope:'Géométrie seulement : boutons finaux supposés occupés, réserve relâchée, un seul des deux appuis du pont. On surestime les positions possibles du miroir par toute la composante praticable orientale, sans contraintes de poussée ni obstacles mobiles. Aucun rayon géométrique de cette surapproximation n’atteint la composante des destinations. Cela ne prouve pas une impossibilité globale avec un autre ordre des opérations.'});
const success=checks.every(c=>c.status==='known-bypass-blocked')&&acceptedAdvancedAlternative.success&&probes.every(p=>p.success);
const report={success,status:success?'targeted-review-passed':'review-failed',specHashes,method:'Contre-exemples gagnants construits indépendamment et archivés avec leur ancienne carte ; nouvelles tentatives sur les cartes courantes, alternative avancée réellement rejouée et contrôles géométriques bornés.',scope:'Aucune preuve d’unicité, d’optimalité, de minimum d’appuis global ou d’absence de tout autre contournement. Les cartes historiques ci-dessous ne sont pas les niveaux livrés.',baselineCounterexamples:Object.fromEntries(Object.entries(baseline).map(([id,b])=>[id,{fixture:'reference/history/finals-known-bypasses.json',specSha256:b.specSha256,metrics:b.metrics,description:b.description}])),checks,acceptedAdvancedAlternative,probes};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success,status:report.status,specHashes,checks:checks.map(c=>({name:c.name,status:c.status,firstRefusal:c.firstRefusal})),alternative:acceptedAdvancedAlternative.metrics,probes:probes.map(p=>({name:p.name,success:p.success,cases:p.cases,error:p.error}))}));
