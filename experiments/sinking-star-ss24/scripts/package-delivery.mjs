/** Bind the distributable HTML to successful lab reports and exact source bytes. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const json=async path=>JSON.parse(await read(path));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const {version}=await json('package.json');
const html=await read('dist/SS24-demo.html'),htmlSha256=hash(html);
const unit=await json('validation/unit-tests.json'),levels=await json('validation/levels-report.json'),ui=await json('validation/ui-dom-report.json'),design=await json('validation/design-report.json');
for(const [name,report]of Object.entries({unit,levels,ui,design}))assert.equal(report.success,true,`${name}: successful qualification required`);
assert.equal(levels.htmlSha256,htmlSha256);assert.equal(ui.htmlSha256,htmlSha256);
assert.equal(levels.levels.length,8);assert.equal(ui.campaignCoverage.length,8);assert.equal(design.levels.length,8);
assert.equal(levels.campaignChecks.finalState,'WIN');assert.equal(levels.tutorial.acquired,37);
for(const [i,level]of levels.levels.entries()){
 assert.equal(level.actions,ui.campaignCoverage[i].actions);
 assert.equal(level.mapSha256,design.levels[i].mapSha256);
}
const sources={};
for(const path of ['src/core.ts','src/levels.ts','src/level-info.ts','src/tutorial.ts','src/browser.ts','index.template.html','scripts/build-demo.mjs','package.json','package-lock.json','tsconfig.json'])sources[path]=hash(await read(path));
const reports={};
for(const name of ['unit-tests','levels-report','ui-dom-report','design-report'])reports[`validation/${name}.json`]=hash(await read(`validation/${name}.json`));
const manifest={
 game:'SS24',title:'Les Voies de Traverse',version,
 artifact:{filename:'SS24-demo.html',bytes:html.length,sha256:htmlSha256,standalone:true,networkRequiredToPlay:false,authorWitnessesIncluded:false},
 roster:['merchant','thief','wizard','bard'],defaultHero:'merchant',tutorial:{level:1,discoveries:37},
 qualification:{unitTests:unit.tests,unitPassed:unit.passed,levelsWon:8,totalWitnessActions:levels.totals.actions,refusedWitnessActions:levels.totals.blocked,witnessDeaths:levels.totals.deaths,ui:'Compiled HTML in Happy DOM with exact public canvas frames and timing',nativeBrowserSession:false,priorLayoutsCompared:design.layoutComparison.previousLevels},
 sourceSha256:sources,reportSha256:reports,
 limits:['Author witnesses prove solvability, not an optimal or unique route.','Local counter-branches and geometric resource arguments are documented separately.','This manifest qualifies the standalone laboratory, not native SRA execution or Site publication.']
};
await writeFile(new URL('validation/delivery-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({game:manifest.game,version,bytes:html.length,htmlSha256,success:true}));
