import {readFileSync,writeFileSync} from 'node:fs';
import {Author} from './author.mjs';
import {replay} from '../../scripts/solver.mjs';
const d=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url),'utf8'));
const a=new Author(d.spec);a.act('U');a.go(7,5,'thief').act('LLLL');a.go(4,12,'warrior');
const commands=a.commands+'X',r=replay(d.spec,commands);
if(!r.state.dead||r.metrics.blocked)throw Error('Expected legal drowning route');
writeFileSync(new URL('../../tests/failures.json',import.meta.url),JSON.stringify([{level:1,cause:'Miroir déplacé sur un axe dont l’arrivée est dans l’eau',commands,actions:r.actions}],null,2)+'\n');
console.log({actions:r.actions.length,commands,dead:r.state.dead});
