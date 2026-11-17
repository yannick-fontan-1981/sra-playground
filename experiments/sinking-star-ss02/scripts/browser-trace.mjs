import {writeFile,readFile} from 'node:fs/promises';
import {PushPuzzleSession,PALETTE} from '../dist/core.js';
import {SS02_LEVELS} from '../dist/levels.js';
const cases=JSON.parse(await readFile(new URL('../tests/witnesses.json',import.meta.url),'utf8'));
function hash(frame){let h=2166136261;for(const v of frame.flat()){const c=parseInt(PALETTE[v].slice(1),16);for(const b of [c>>>16,(c>>>8)&255,c&255,255])h=Math.imul(h^b,16777619)>>>0;}return String(h);}
const session=new PushPuzzleSession(SS02_LEVELS),trace={initial:hash(session.observe().frame),steps:[]};
for(const c of cases)for(const a of c.actions){const o=session.action(a);trace.steps.push({action:a,level:o.level,completed:o.levelsCompleted,state:o.state,hash:hash(o.frame)});}
await writeFile(new URL('../validation/browser-trace.json',import.meta.url),JSON.stringify(trace));
