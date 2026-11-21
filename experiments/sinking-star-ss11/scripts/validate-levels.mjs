/** Bounded content and teaching checks, without search. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {compileLevel,initialState,renderWorld,DuoPuzzleSession,GRID,PALETTE} from '../dist/core.js';
import {SS11_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {lessonIds,observeLesson,TUTORIAL_LEVEL} from '../dist/tutorial.js';
assert.equal(SS11_LEVELS.length,8);assert.equal(TUTORIAL_LEVEL,7);
assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);
const levels=SS11_LEVELS.map((spec,i)=>{
 const design=JSON.parse(readFileSync(new URL(`../reference/level${i+1}-design.json`,import.meta.url),'utf8'));
 assert.deepEqual(spec,design.spec);assert.ok(LEVEL_INFO[i].label);assert.match(LEVEL_INFO[i].url,/^https:\/\/sinkingstarwalkthrough\.com\/fr\//);
 const w=compileLevel(spec),s=initialState(w),frame=renderWorld(w,s);
 assert.deepEqual(w.heroes.map(h=>h.kind),['warrior','wizard']);assert.equal(w.goals.length,2);assert.equal(s.dead,false);
 assert.equal(frame.length,64);for(const row of frame){assert.equal(row.length,64);for(const c of row)assert.ok(Number.isInteger(c)&&c>=0&&c<16);}
 return {level:i+1,title:spec.title,dimensions:[spec.rows[0].length,spec.rows.length],source:LEVEL_INFO[i].url,initialFrameValid:true};
});
const design=JSON.parse(readFileSync(new URL(`../reference/level${TUTORIAL_LEVEL}-design.json`,import.meta.url),'utf8'));
const session=new DuoPuzzleSession(SS11_LEVELS),learned=new Set();let current=session.selectLevel(TUTORIAL_LEVEL);
for(const a of design.actions){const before=current;current=session.action(a.id,a.data);observeLesson(learned,before,current,a.id);}
assert.deepEqual(lessonIds.filter(id=>!learned.has(id)),[],'Every tutorial lesson must be observable');
const html=readFileSync(new URL('../dist/SS11-demo.html',import.meta.url),'utf8');
assert.ok(!/<script[^>]+src=/i.test(html));assert.ok(!/function solve\(/.test(html));assert.ok(!/tests\/witnesses|reference\/author/.test(html));
const report={version:JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version,success:true,scope:'Eight initial boards, source/reference parity and twelve public tutorial detections',campaignSearch:false,lessonCount:learned.size,levels};
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});writeFileSync(new URL('../validation/content-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({initialBoards:levels.length,tutorialLessons:learned.size,campaignSearch:false,success:true}));
