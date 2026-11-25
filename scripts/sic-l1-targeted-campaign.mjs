import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { assessSituation, collectAnchors, generatedCases } from './sic-l1-generated-frontiers.mjs';
import { openQueue } from './sic-transfer-queue.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { count:{ type:'string', default:'10000' }, state:{ type:'string' } } });
const total = Number(values.count);
if (!Number.isSafeInteger(total) || total < 120 || total > 100_000) throw Error('count must be 120 to 100000');
const directory = resolve(values.state ?? join(root,'artifacts','sic-l1-targeted-campaign'));
mkdirSync(directory,{recursive:true});
const files = ['scripts/sic-l1-targeted-campaign.mjs','scripts/sic-l1-generated-frontiers.mjs',
  'src/sic/observed-actor-composition.ts','src/sic/observed-role-selection.ts'];
const revision = spawnSync('git',['rev-parse','HEAD'],{ cwd:root, encoding:'utf8' }).stdout.trim();
const fingerprint = files.reduce((hash,file)=>hash.update(readFileSync(join(root,file))),createHash('sha256')).digest('hex');
const anchors = await collectAnchors();
const configuration = { total, revision, fingerprint, anchors:anchors.length };
const queue = openQueue(join(directory,'queue.sqlite'),configuration);

function learn(rows) {
  const decisions = rows.filter(row=>row.facts);
  const features = Object.keys(decisions[0]?.facts ?? {});
  let best;
  for (let mask = 0; mask < (1 << features.length); mask++) {
    const requires = features.filter((_,i)=>mask & (1<<i));
    let errors = 0, falseAdmissions = 0;
    for (const row of decisions) {
      const admission = requires.every(feature=>row.facts[feature]);
      if (admission !== row.expected) {
        errors++;
        if (admission) falseAdmissions++;
      }
    }
    const score = [falseAdmissions, errors, requires.length];
    const previous = best?.score ?? [Infinity,Infinity,Infinity];
    const firstDifference = score.findIndex((value,index)=>value !== previous[index]);
    if (firstDifference !== -1 && score[firstDifference] < previous[firstDifference]) best = { requires, score, falseAdmissions, errors };
  }
  const choiceSets = rows.filter(row=>row.choices?.length > 1 && row.choices.some(choice=>choice.truePeer)).map(row=>row.choices);
  const weights = [...new Set(choiceSets.flatMap(choices=>choices.flatMap(a=>choices.map(b=>
    Math.abs(a.distance-b.distance))).filter(Boolean)))].slice(0,20);
  const variants = [{ mixed:1, distance:0 },{ mixed:0, distance:1 },{ mixed:0, distance:-1 }];
  for (const weight of weights) variants.push({ mixed:weight,distance:1 },{ mixed:weight,distance:-1 },
    { mixed:-weight,distance:1 },{ mixed:-weight,distance:-1 });
  let ranking, bestClicks=Infinity;
  for (const variant of variants) {
    const steps=choiceSets.reduce((total,choices)=>total+[...choices].sort((a,b)=>
      (b.mixed-a.mixed)*variant.mixed +(b.distance-a.distance)*variant.distance).findIndex(choice=>choice.truePeer)+1,0);
    if (steps < bestClicks) { ranking=variant; bestClicks=steps; }
  }
  return { requires:best?.requires ?? features, ranking, witnessComparisons:decisions.length,
    ambiguousSets:choiceSets.length, falseAdmissions:best?.falseAdmissions ?? 0, errors:best?.errors ?? 0 };
}

function summarize(rows) {
  const tasks={}, byGame={}, failures={};
  const initial=()=>({ count:0, referenceCorrect:0, candidateCorrect:0, gains:0, losses:0, rejectedReturns:0, firstClick:0 });
  for(const row of rows) {
    for(const slot of [tasks[row.spec.task]??=initial(),byGame[row.spec.code]??=initial()]) {
      slot.count++;
      if(row.baseline===row.expected) slot.referenceCorrect++;
      if(row.candidate===row.expected) slot.candidateCorrect++;
      if(row.candidate===row.expected && row.baseline!==row.expected) slot.gains++;
      if(row.candidate!==row.expected && row.baseline===row.expected) slot.losses++;
      if(row.spec.task==='verification'&&!row.expected&&!row.candidate) slot.rejectedReturns++;
      if(row.spec.task==='disambiguation'&&row.candidate&&row.clicks===1) slot.firstClick++;
    }
    if(row.baseline!==row.expected||row.candidate!==row.expected) {
      const mechanism=row.spec.task==='verification'?'selection-return-'+row.spec.returnType:
        row.spec.originLayer?'covered-active-body':row.spec.peerLayer?'covered-peer-body':row.spec.decoy?'similar-inert-glyph':'public-scene';
      const failure=failures[mechanism]??={ reference:0,candidate:0,example:row.id };
      if(row.baseline!==row.expected) failure.reference++;
      if(row.candidate!==row.expected) failure.candidate++;
    }
  }
  return { tasks, byGame, failures };
}

function run(stage, index, count, proposed) {
  const plan=queue.seed(stage,used=>generatedCases(anchors,count,index,used),{ rule:proposed });
  const owner='l1-campaign-'+process.pid;
  while(queue.pending(stage)>0) {
    const batch=queue.claim(stage,owner,40,45000);
    if (!batch.length) throw Error('Campaign has outstanding reservations');
    try {
      queue.checkpoint(owner,batch.map(({id,spec})=>({id,...assessSituation(anchors,spec,plan.rule)})));
    } finally {
      queue.release(owner);
    }
  }
  const rows=queue.results(stage);
  console.log(JSON.stringify({stage, completed:rows.length, rule:plan.rule, summary:summarize(rows).tasks}));
  return { rows, rule:plan.rule, summary:summarize(rows) };
}
try {
  const discoveryCount=Math.floor(total/2/5)*5;
  const calibrationCount=Math.floor(total/4/5)*5;
  const discovery=run('discover',0,discoveryCount,null);
  const calibration=run('calibrate',1,calibrationCount,learn(discovery.rows));
  const validation=run('validate',2,total-discoveryCount-calibrationCount,learn([...discovery.rows,...calibration.rows]));
  const rows=[...discovery.rows,...calibration.rows,...validation.rows];
  if(rows.length!==total)throw Error('Incomplete count');
  const report={ configuration, comparisons:rows.length,
    discovery:{...discovery.summary}, calibration:{...calibration.summary,rule:calibration.rule},
    validation:{...validation.summary,rule:validation.rule}, all:summarize(rows) };
  const output=join(directory,'report.json');
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({ comparisons:rows.length, anchors:anchors.length, output }));
} finally {
  queue.close();
}
