/** Author build step; never imported by the playable bundle. */
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const designs=await Promise.all(Array.from({length:8},(_,i)=>readFile(new URL(`reference/level${i+1}-design.json`,root),'utf8').then(JSON.parse)));
const json=x=>JSON.stringify(x,null,2);
await writeFile(new URL('src/levels.ts',root),"import type {LevelSpec} from './core.js';\nexport const SS16_LEVELS:readonly LevelSpec[]="+json(designs.map(d=>d.spec))+';\n');
await writeFile(new URL('src/level-info.ts',root),'export const LEVEL_INFO='+json(designs.map(d=>({...d.source,platform:!!d.source.platform})))+' as const;\n');
await writeFile(new URL('tests/witnesses.json',root),json(designs.map((d,i)=>({level:i+1,id:d.spec.id,commands:d.commands,actions:d.actions})))+'\n');
console.log('Synced eight SS16 level specs, public credits and author witnesses.');
