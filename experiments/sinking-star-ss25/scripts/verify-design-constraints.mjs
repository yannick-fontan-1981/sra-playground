/** Bind all reproducible design reviews to the exact shipped maps. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SS25_LEVELS} from '../dist/levels.js';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const report={game:'SS25',success:false,scope:'Reproducible tutorial, middle, final and independent reviews; 88 historical layouts; bounded walking and explicit local counter-branches',levels:[],reviews:[],limitations:[
 'Witnesses establish solvability, not unique or optimal solutions or autonomous SRA success.',
 'Fixed-resource individual walking, even with other heroes ignored as obstacles, is a restricted model of the puzzle.',
 'Terrain symmetries detect exact geometric repeats, not subjective originality.',
 'Local counter-branches and omitted route segments do not prove global necessity or irrecoverable deadlocks.',
 'The difficulty comparison with SS24 describes checked dependencies; action counts are not a difficulty score.'
]};
try{
 assert.equal(SS25_LEVELS.length,8);
 for(const script of ['review-intro-ss25.mjs','review-middle-ss25.mjs','review-final-ss25.mjs','independent-review-ss25.mjs']){
  const path=new URL('../reference/author/'+script,import.meta.url);
  const result=JSON.parse(execFileSync(process.execPath,[fileURLToPath(path)],{encoding:'utf8',maxBuffer:8*1024*1024}));
  assert.equal(result.success,true,script+': completed successful review required');
  report.reviews.push({script:'reference/author/'+script,success:true,result,sha256:hash(result)});
 }
 const independent=read('../reference/independent-ss25-review.json');
 assert.equal(independent.success,true);assert.equal(independent.levels.length,8);assert.equal(independent.layoutComparison.previousLevels,88);
 for(const[i,spec]of SS25_LEVELS.entries()){
  const design=read(`../reference/level${i+1}-design.json`),qualified=independent.levels.find(l=>l.level===i+1);
  assert.deepEqual(spec,design.spec);assert.equal(qualified.mapSha256,hash(spec));assert.equal(qualified.actionsSha256,hash(design.actions));
  assert.equal(qualified.complete,true);assert.equal(qualified.refusedActions,0);assert.equal(qualified.deaths,0);
  assert(qualified.maximumIndividualWalkingGoalAssignment<4);assert.deepEqual(qualified.exactHistoricalTerrainRepeats,[]);
  report.levels.push(qualified);
 }
 report.layoutComparison=independent.layoutComparison;
 report.structuralComparison=independent.structuralComparison;
 report.counterBranches=independent.counterBranches;
 report.shortcutReview=independent.shortcutReview;
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});
writeFileSync(new URL('../validation/design-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:report.levels.length,reviews:report.reviews.length,error:report.error},null,2));
