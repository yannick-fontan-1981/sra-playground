import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
const root=new URL('../',import.meta.url);
const output=new URL('finals-independent-review.json',root);
const previous=existsSync(output)?JSON.parse(readFileSync(output,'utf8')):{};
const baseline=previous.baselineCounterexamples??{};
if(previous.shortcut&&!baseline.ss16_08)baseline.ss16_08={spec:previous.shortcut.spec,commands:previous.shortcut.commands,metrics:previous.shortcut.metrics,description:'Aucun appui permanent, réserve nord inutilisée, trois transports de héros par le premier miroir.'};
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
const checks=[];
for(const [n,build]of [[7,shortcut7],[8,shortcut8]]){
 const d=JSON.parse(readFileSync(new URL(`level${n}-design.json`,root),'utf8'));
 const a=new Author(d.spec);let result;
 try{build(a);const r=a.result({label:'Contre-exemple indépendant'},'Revue de géométrie, aucune modification du niveau.');
  result={status:'bypass-found',metrics:r.metrics,commands:r.commands,stages:r.stages};
  if(!baseline[`ss16_0${n}`])baseline[`ss16_0${n}`]={spec:r.spec,commands:r.commands,metrics:r.metrics,description:n===7?'Aucun des deux appuis du pont central ; une caisse remplace le miroir final ; trois transports de héros par le miroir.':'Aucun appui permanent, réserve nord inutilisée, trois transports de héros par le premier miroir.'};
 }catch(error){result={status:'known-bypass-blocked',blockedAt:error.message,acceptedPrefix:a.commands,stages:a.stages};}
 checks.push({level:d.spec.id,specSha256:createHash('sha256').update(JSON.stringify(d.spec)).digest('hex'),referenceMetrics:d.metrics,...result});
}
const report={status:checks.some(c=>c.status==='bypass-found')?'bypass-found':'known-bypasses-blocked',method:'Construction indépendante de parcours gagnants complets, puis nouvelle tentative des mêmes stratégies sur la géométrie courante.',scope:'Ces vérifications invalident ou confirment des contre-exemples concrets. Elles ne prouvent ni unicité, ni optimalité, ni absence de tout autre contournement.',baselineCounterexamples:baseline,checks};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,checks:checks.map(c=>({level:c.level,status:c.status,metrics:c.metrics,blockedAt:c.blockedAt}))}));
