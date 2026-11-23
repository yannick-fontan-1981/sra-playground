/** Executable local design review. This file is never imported by the game. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {build as build5} from './build-level5.mjs';
import {build as build6} from './build-level6.mjs';
import {build as build7} from './build-level7.mjs';
import {build as build8} from './build-level8.mjs';
import {stepDetailed,circuitPressed,equal} from '../../dist/core.js';
import {decodeCommand,replay} from '../../scripts/solver.mjs';

const designs=[build5(),build6(),build7(),build8()];
const checks=[];
const at=(p,x,y)=>p.x===x&&p.y===y;
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const has=(ps,x,y)=>ps.some(p=>at(p,x,y));
for(const [i,d] of designs.entries()){
 const saved=JSON.parse(readFileSync(new URL(`../level${i+5}-design.json`,import.meta.url),'utf8'));
 assert.deepEqual(saved.spec,d.spec,`N${i+5} stored map`);
 assert.equal(saved.commands,d.commands,`N${i+5} stored witness`);
 assert.equal(d.metrics.blocked,0);assert.equal(d.metrics.deaths,0);
}
function branch(level,label,stageIndex,setup,commands,expected,meaning){
 const d=designs[level-5],turn=stageIndex<0?0:d.stages[stageIndex].turn;
 const a=new Author(d.spec).act(d.commands.slice(0,turn));
 setup?.(a);
 let state=a.state;const phases=[],warnings=[];
 for(const c of commands){
  const action=decodeCommand(c,state),step=stepDetailed(a.world,state,action.id,action.data);
  state=step.state;phases.push(...step.phases);warnings.push(...(step.blockedMirrorIndices??[]));
 }
 assert(expected(state,phases,a.world,warnings),`${level}: ${label}`);
 const route=a.commands+commands,r=replay(d.spec,route);
 assert.deepEqual(r.state,state);
 checks.push({level,label,afterReferenceTurn:turn,branchCommands:a.commands.slice(turn)+commands,meaning,
  failed:state.failed,dead:state.dead,complete:state.complete,phases:phases.map(p=>p.kind),
  blockedMirrorIndices:[...new Set(warnings)],heroes:state.heroes,stones:state.stones,supports:state.supports,mirrors:state.mirrors,
  circuits:Object.fromEntries(a.world.circuits.map(c=>[c.id,circuitPressed(a.world,state,c.id)]))});
}

branch(5,'wrong-side-guard-exchange',1,a=>a.go(13,15,'wizard'),'U',
 (s,p,w)=>!s.failed&&!s.dead&&has(s.monsters,13,15)&&!circuitPressed(w,s,'gardiens'),
 'Un échange depuis le dessous déplace le gardien sur une case ordinaire. Le Magicien atteint sa place mais la commande haute reste vide.');
branch(5,'song-withdraws-a-kept-guard',2,a=>a.select('bard'),'L',
 (s,p,w)=>!s.failed&&!s.dead&&has(s.monsters,3,10)&&!circuitPressed(w,s,'gardiens'),
 'Un retour du Barde vers la gauche retire le gardien de sa loge et referme les accès. Cette branche locale reste réparable.');

branch(6,'mirror-cannot-descend-through-the-wall',0,a=>a.go(8,7,'merchant'),'D',
 s=>s.failed&&!s.dead&&s.mirrors.some(m=>at(m.at,8,8)),
 'La descente directe du miroir bute sur la paroi. Le parcours de référence le charge sur la presse latérale.');
branch(6,'used-mirror-still-intercepts-the-last-departure',3,a=>a.go(7,10,'merchant'),'X',
 (s,p,w,warning)=>s.failed&&!s.dead&&at(hero(s,'merchant').at,7,10)&&warning.includes(0),
 'Sans dégager le miroir utilisé, le reflet global final est refusé : le Magicien sur la branche est reste une cible de ce miroir et sa trajectoire traverse la presse fermée.');
branch(6,'mirror-leaves-its-station-before-the-north-arrival',2,a=>a.select('merchant'),'DL',
 (s,p,w)=>!s.failed&&!s.dead&&!circuitPressed(w,s,'station')&&at(hero(s,'bard').at,8,3),
 'Retirer le miroir trop tôt puis quitter sa commande referme le passage nord avant l’arrivée du Barde. Cette erreur ne prouve pas une impasse irréversible.');

branch(7,'initial-direct-exchange-is-screened',-1,a=>a.go(8,10,'wizard'),'RR',
 (s,p)=>s.failed&&!s.dead&&p.every(x=>x.kind!=='swap')&&at(hero(s,'wizard').at,9,10),
 'La porte coupe la visée sur la caisse terminale. Le premier pas reste sur le quai ; le pas suivant vers l’eau est refusé.');
branch(7,'occupied-ferry-is-anchored',1,a=>a.go(11,6,'merchant').act('D').select('bard'),'L',
 s=>s.failed&&!s.dead&&at(hero(s,'merchant').at,11,7)&&has(s.supports,11,7),
 'L’appui occupé est ancré. Le chant ne peut ni le déplacer sous le Marchand ni entraîner ce dernier dans une eau sans appui : toute cette tentative est refusée.');

const alternative7=new Author(designs[2].spec).act(designs[2].commands.slice(0,designs[2].stages[2].turn));
alternative7.go(8,10,'wizard').act('R').go(13,10);
alternative7.go(11,8,'merchant').act('UURR');
alternative7.select('bard').act('LDDDDDDLLL');
const alternative7Replay=replay(designs[2].spec,alternative7.commands);
assert(alternative7Replay.state.complete);assert.equal(alternative7Replay.metrics.blocked,0);assert.equal(alternative7Replay.metrics.deaths,0);
assert.equal(alternative7Replay.metrics.actions,43);assert.equal(alternative7Replay.metrics.supportMoves,10);
const alternatives=[{level:7,label:'exchange-the-terminal-crate',commands:alternative7.commands,metrics:alternative7Replay.metrics,
 meaning:'Après le dépôt de la réserve sur la commande, le Magicien échange directement la caisse terminale. Le Marchand revient à l’alcôve centrale et le Barde rejoint la destination ouest. Cette solution conserve les deux premières traversées, le poids persistant et dix déplacements de l’appui ; elle évite la troisième traversée et l’immersion terminale du témoin principal.'}];

branch(8,'merchant-intercepts-the-prepared-ray',-1,a=>a.act('D').select('wizard'),'R',
 s=>!s.failed&&!s.dead&&at(hero(s,'wizard').at,16,7)&&at(hero(s,'merchant').at,5,8)&&has(s.stones,16,3),
 'Si le Marchand reste devant le miroir après sa poussée, il est la première cible. Le Magicien échange avec lui au lieu d’extraire la réserve.');
branch(8,'return-before-clearing-the-first-target',1,a=>a.select('wizard'),'D',
 s=>!s.failed&&!s.dead&&at(hero(s,'wizard').at,5,8)&&has(s.stones,16,3),
 'Repartir immédiatement vers le bas suit la visée coudée en sens inverse et remet la caisse dans son alcôve.');
branch(8,'ordinary-north-exit-is-walled',2,a=>a.select('bard'),'U',
 s=>s.failed&&!s.dead&&at(hero(s,'bard').at,1,13)&&has(s.stones,3,15),
 'La paroi nord bloque la sortie directe du Barde. L’échange du témoin le libère en laissant la caisse immobile.');
branch(8,'ordinary-east-exit-withdraws-the-weight',2,a=>a.select('bard'),'R',
 s=>!s.failed&&!s.dead&&has(s.stones,4,15)&&!has(s.stones,3,15),
 'Partir à pied vers l’est est légal mais retire le poids de la commande sud-ouest.');
branch(8,'withdraw-hydraulics-before-the-wizard-returns',1,a=>a.go(13,2,'merchant').act('DL').select('wizard'),'D',
 s=>s.failed&&!s.dead&&at(hero(s,'wizard').at,16,3)&&s.platformActive.every(v=>!v),
 'Le retrait prématuré du poids ferme le passage et désactive la plateforme. La tentative de retour du Magicien vers l’eau est refusée.');
branch(8,'turning-too-early-withdraws-the-last-support',8,a=>a.select('bard').act('RRRU').go(7,10,'merchant'),'R',
 s=>s.failed&&!s.dead&&has(s.supports,8,9)&&!has(s.supports,8,10),
 'Tourner vers le nord dès l’entrée de la cour déplace l’appui hors du passage. Le Marchand ne peut plus franchir le même accès.');

branch(8,'south-crate-cannot-be-pushed-through-its-stop',-1,a=>a.go(9,15,'merchant'),'D',
 s=>s.failed&&!s.dead&&has(s.stones,9,16),
 'La caisse sud est retenue par la butée arrière : le Marchand ne peut pas la dégager en poussant depuis le haut.');
branch(8,'ordinary-second-choir-exit-sinks-a-required-weight',6,a=>a.select('bard'),'U',
 (s,p,w)=>!s.failed&&!s.dead&&s.stones.length===2&&has(s.supports,9,13)&&!circuitPressed(w,s,'accord'),
 'Monter directement après le dépôt sud entraîne la caisse dans le lac. Elle devient un appui et ne peut plus fournir le quatrième poids requis par la presse-but.');
branch(8,'mirror-withdrawal-relocks-the-destination',7,a=>a.go(16,11,'merchant'),'LR',
 (s,p,w)=>!s.failed&&!s.dead&&s.mirrors.some(m=>at(m.at,14,11))&&!circuitPressed(w,s,'accord')&&s.gateClosed[2],
 'Le miroir est un quatrième poids à conserver. Le retirer puis quitter sa commande referme aussi la destination basse, même si le passage dans le lac a été préparé.');

const report={success:true,scope:'Rejeu des quatre témoins, contre-branches locales et variante gagnante ; aucune preuve de solution unique ni de difficulté minimale.',
 references:designs.map((d,i)=>({level:i+5,title:d.spec.title,actions:d.metrics.actions,selections:d.metrics.selections,stages:d.stages.length,metrics:d.metrics})),
 checks,acceptedAlternatives:alternatives,
 sourceNotes:[
  {level:5,note:'La rencontre et la conservation des monstres viennent de Bard 13–14 ; la butée d’arrêt et la géométrie d’arène sont originales.'},
  {level:6,note:'Le retrait du miroir devenu obstacle adapte Mirrors 18. La presse déplace le miroir sans le détruire.'},
  {level:7,note:'Water 27 fournit le recalage par butées. La carte ne reproduit ni les quatre rives SS15, ni l’empilement et les pas doubles du jeu commercial.'},
  {level:8,note:'Light 37/40/41 fournit les contraintes de retour, détour et séparation. Le laboratoire emploie les règles fixes du trio, sans faisceaux de pouvoir.'},
 ]};
writeFileSync(new URL('../levels5-8-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:report.references.length,localChecks:checks.length,acceptedAlternatives:alternatives.length,actions:report.references.map(r=>r.actions)}));
