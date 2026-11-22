/** Independent bounded review. Author tooling only, excluded from playable HTML. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Author} from './author.mjs';
import {replay,decodeCommand,stateKey} from '../../scripts/solver.mjs';
import {stepDetailed,circuitPressed,gateClosed} from '../../dist/core.js';

// Candidate as observed before closing its unintended northern reserve entrance.
const archivedInitialCandidate={
  "id": "ss16-05",
  "title": "La relève du gardien",
  "rows": [
    "####################",
    "#....o...###..o.o..#",
    "#....T...###.......#",
    "#.M................#",
    "#......#.m.m.......#",
    "#.......o.##.......#",
    "#.......W.##########",
    "#.........##########",
    "#.........##########",
    "#.........##########",
    "#.........#........#",
    "#.........#........#",
    "#........~~........#",
    "#.........#........#",
    "#........##........#",
    "#........##........#",
    "#........####.######",
    "#############.######",
    "############..g.g.g#",
    "####################"
  ],
  "circuits": [
    {
      "id": "impulsion",
      "buttons": [
        {
          "x": 2,
          "y": 3
        }
      ],
      "color": 12
    },
    {
      "id": "passerelles",
      "buttons": [
        {
          "x": 9,
          "y": 4
        }
      ],
      "color": 10
    },
    {
      "id": "reserve",
      "buttons": [
        {
          "x": 5,
          "y": 4
        }
      ],
      "color": 14
    },
    {
      "id": "deux-poids",
      "buttons": [
        {
          "x": 5,
          "y": 14
        },
        {
          "x": 15,
          "y": 12
        }
      ],
      "color": 15
    }
  ],
  "gates": [
    {
      "at": {
        "x": 8,
        "y": 4
      },
      "circuit": "impulsion",
      "direction": "E",
      "closedWhen": "released"
    },
    {
      "at": {
        "x": 12,
        "y": 4
      },
      "circuit": "reserve",
      "direction": "E",
      "closedWhen": "released"
    },
    {
      "at": {
        "x": 13,
        "y": 16
      },
      "circuit": "passerelles",
      "direction": "N",
      "closedWhen": "pressed"
    },
    {
      "at": {
        "x": 13,
        "y": 17
      },
      "circuit": "deux-poids",
      "direction": "N",
      "closedWhen": "released"
    }
  ],
  "platforms": [
    {
      "at": {
        "x": 9,
        "y": 12
      },
      "circuit": "passerelles",
      "activeWhen": "pressed"
    },
    {
      "at": {
        "x": 10,
        "y": 12
      },
      "circuit": "passerelles",
      "activeWhen": "pressed"
    }
  ]
};
const reserveBypass='CULCCLCCRDDDDRRRUDDLULLDUUUURRRRRRURR';

const d=JSON.parse(readFileSync(new URL('../level5-design.json',import.meta.url),'utf8'));
const version=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const at=(index)=>{const a=new Author(d.spec);if(index>=0)a.act(d.commands.slice(0,d.stages[index].turn));return a;};
const point=(state,kind)=>state.heroes.find(h=>h.kind===kind).at;
const snapshot=r=>({heroes:r.state.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:r.state.stones,supports:r.state.supports,monsters:r.state.monsters,complete:r.state.complete,dead:r.state.dead,failed:r.state.failed,gates:r.state.gateClosed,circuits:Object.fromEntries(r.world.circuits.map(c=>[c.id,circuitPressed(r.world,r.state,c.id)])),metrics:r.metrics});
const localChecks=[];
function check(label,commands,test,scope){const r=replay(d.spec,commands);test(r);localChecks.push({label,commands,observed:snapshot(r),scope});return r;}

const win=replay(d.spec,d.commands);
assert(win.state.complete&&!win.state.dead&&!win.state.failed);
assert.equal(win.metrics.blocked,0);assert.equal(win.metrics.deaths,0);
assert.equal(win.state.heroes.length,3);

// First reproduce the actual counterexample on its immutable candidate map.
const old=replay(archivedInitialCandidate,reserveBypass);
assert(!old.state.dead&&!old.state.failed&&old.metrics.blocked===0);
assert.deepEqual(point(old.state,'thief'),{x:14,y:2});
assert(!circuitPressed(old.world,old.state,'reserve'));
assert(old.state.stones.some(p=>eq(p,{x:5,y:1})));
const repaired=check('L5 — le contournement nord observé ne franchit plus la réserve',reserveBypass,r=>{
 assert(!r.state.dead);assert(r.metrics.blocked>0);assert(!circuitPressed(r.world,r.state,'reserve'));
 assert.deepEqual(point(r.state,'thief'),{x:11,y:3});
 assert.equal(r.trace.findIndex(t=>t.after.failed)+1,34);
},'Exact replay of a 37-input counterexample found during independent review. On the archived candidate the Thief reaches the reserve with the key untouched; the corrected map rejects its first crossing at input 34. This is an access counterexample, not an archived full winning route.');

// Exhaust the small model the real shortcut used, allowing walking and its
// circuit transitions while the other heroes and all resources remain fixed.
const noKey=new Author(d.spec);
noKey.select('warrior').act('UL').select('merchant').act('L');
noKey.go(9,5,'thief').act('DDLULLD');
const queue=[{state:noKey.state,commands:''}],seen=new Set([stateKey(noKey.state)]);
let transitions=0,reached=null;
for(let head=0;head<queue.length;head++){
 const node=queue[head],hero=node.state.heroes[node.state.active];
 if(hero.at.x>=12&&hero.at.y<=5){reached=node.commands;break;}
 for(const command of 'UDLR'){
  transitions++;
  const action=decodeCommand(command,node.state),next=stepDetailed(noKey.world,node.state,action.id,action.data);
  if(next.state.failed||next.state.dead||next.phases.some(p=>p.moves.some(m=>m.actor!=='hero'))||next.state.heroes.some((h,i)=>i!==node.state.active&&!eq(h.at,node.state.heroes[i].at)))continue;
  const key=stateKey(next.state);if(seen.has(key))continue;
  seen.add(key);queue.push({state:next.state,commands:node.commands+command});
 }
 assert(seen.size<10000,'The declared restricted search must exhaust, not silently stop at a limit');
}
assert.equal(reached,null);
const restrictedSearch={status:'exhausted',states:seen.size,transitions,goal:'Thief enters a reserve cell with x >= 12 and y <= 5',activeHero:'thief',fixedHeroes:noKey.state.heroes.filter(h=>h.kind!=='thief').map(h=>({kind:h.kind,at:h.at})),fixedStones:noKey.state.stones,fixedSupports:noKey.state.supports,fixedMonsters:noKey.state.monsters};
localChecks.push({label:'L5 — la marche seule ne remplace plus la clef après la relève',commands:noKey.commands,observed:restrictedSearch,scope:'Exhaustive only in the explicitly restricted single-active-Thief model. The two other heroes and all resources are fixed; walking-triggered gates/platforms are simulated. Repositioning another hero, moving a crate or using a different earlier preparation is outside this claim.'});

{
 const a=at(1);a.go(8,3,'thief');
 check('L5 — la réserve ouverte reste dangereuse avant le combat',a.commands+'R',r=>{
  assert(r.state.dead);assert(r.state.heroes.find(h=>h.kind==='thief').dead);
  assert.equal(r.state.monsters.length,2);assert(circuitPressed(r.world,r.state,'reserve'));
 },'Exact premature approach from the northern side after the key and press load have been prepared. Opening the reserve command alone does not remove the live guardian.');
}
{
 const a=at(4);a.go(5,5,'thief').act('DR').go(11,4,'warrior');
 check('L5 — reprendre la clef avant les charges ferme leur accès',a.commands+'R',r=>{
  assert(r.state.failed&&!r.state.dead);assert(gateClosed(r.world,r.state,1));
  assert(!circuitPressed(r.world,r.state,'reserve'));
  assert(r.state.stones.some(p=>eq(p,{x:14,y:4}))&&r.state.stones.some(p=>eq(p,{x:16,y:4})));
 },'Exact wrong-order branch after extracting both reserve crates but before delivering them outside. The first attempt to enter the closed reserve is refused; returning a weight to its command may repair this local mistake.');
}
{
 const a=at(5);a.go(9,5,'thief').act('DDDDDD');
 check('L5 — tirer jusqu’à l’eau ne construit pas le pont',a.commands+'D',r=>{
  assert(r.state.failed&&!r.state.dead);assert.equal(r.state.supports.length,0);
  assert.deepEqual(point(r.state,'thief'),{x:9,y:11});assert(r.state.stones.some(p=>eq(p,{x:9,y:10})));
 },'One extra forward pull from the bank is refused. The prepared cargo remains dry; this supports the need for a local change of pushing side in the reference preparation, not a global necessity of that exact route.');
}
{
 const a=at(7);a.select('warrior').act('D');
 check('L5 — le premier appui laisse encore une case d’eau',a.commands+'R',r=>{
  assert(r.state.failed&&!r.state.dead);assert.deepEqual(r.state.supports,[{x:9,y:12}]);
  assert.deepEqual(point(r.state,'warrior'),{x:9,y:12});assert(!circuitPressed(r.world,r.state,'passerelles'));
 },'Exact crossing attempt with the hydraulic command released and only the first permanent support in place. It does not prove a global minimum under every possible hydraulic sequence.');
}
{
 const a=at(11);a.go(13,16,'merchant').go(9,5,'warrior');
 check('L5 — réactiver les plateformes expulse le héros à l’opposé des sorties',a.commands+'U',r=>{
  assert(!r.state.failed&&!r.state.dead);assert(gateClosed(r.world,r.state,2));
  assert(circuitPressed(r.world,r.state,'deux-poids')&&circuitPressed(r.world,r.state,'passerelles'));
  assert.deepEqual(point(r.state,'merchant'),{x:13,y:15});
  assert(r.trace.at(-1).phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'&&eq(m.from,{x:13,y:16})&&eq(m.to,{x:13,y:15}))));
 },'Exact attempted hydraulic-gate catapult with both final weights installed. Its closing direction pushes north, back into the work room; this local use cannot inject the Merchant south into the goal chamber.');
}
{
 const a=at(11);a.go(13,17,'merchant').go(5,15,'thief');
 check('L5 — retirer le lest final ne catapulte pas vers les sorties',a.commands+'D',r=>{
  assert(!r.state.failed&&!r.state.dead);assert(gateClosed(r.world,r.state,3));
  assert(!circuitPressed(r.world,r.state,'deux-poids'));
  assert.deepEqual(point(r.state,'merchant'),{x:13,y:16});
  assert(r.trace.at(-1).phases.some(p=>p.kind==='piston'&&p.moves.some(m=>m.actor==='hero'&&eq(m.from,{x:13,y:17})&&eq(m.to,{x:13,y:16}))));
 },'Exact final-weight gate closure with a hero deliberately inside it. The ejection is north, away from the goal chamber. The other water and reserve mechanisms are not changed in this check.');
}

export const report={game:'SS16',version,level:5,success:true,status:'targeted-review-passed',
 specSha256:createHash('sha256').update(JSON.stringify(d.spec)).digest('hex'),
 scope:'Independent counterexample reproduction, one exhaustive restricted walking model, exact wrong-order and gate-catapult branches, and replay of the authored winning route.',
 winningRoute:{commands:d.commands,metrics:win.metrics,complete:win.state.complete},
 historicalRepairs:[{id:'unlocked-northern-reserve-entry',commands:reserveBypass,archivedSpecSha256:createHash('sha256').update(JSON.stringify(archivedInitialCandidate)).digest('hex'),archivedObserved:snapshot(old),currentFirstRefusal:repaired.trace.findIndex(t=>t.after.failed)+1}],
 restrictedSearch,checks:localChecks.length,localChecks,
 limitations:['The repaired historical route is a reserve-access shortcut, not a full winning solution.','Queue exhaustion applies only to the fixed-resource single-active-Thief model reported above.','Local wrong-order checks establish their exact effects; recoverability and other reorganizations are not exhaustively searched.','Neither uniqueness, optimal route length, necessity of every role, nor a global minimum resource count is claimed.']};
writeFileSync(new URL('../level5-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({level:5,success:report.success,checks:report.checks,winningInputs:win.metrics.actions,historicalRepairs:report.historicalRepairs.length,restrictedStates:restrictedSearch.states,restrictedTransitions:restrictedSearch.transitions}));
