import { createHash } from 'node:crypto';

export function contextsFor(step, previous, penultimate) {
  const contexts={lastAction:previous?.op, predecessor:previous?.source,
    twoActions:penultimate?[penultimate.op,previous.op].join('/'):undefined};
  for (let period=2;period<=6;period++) contexts['phase'+period]=step%period;
  return contexts;
}

export function evaluateAmbiguity(prior, sample, models) {
  const counts=new Map();
  for (const item of prior) counts.set(item.next,(counts.get(item.next)??0)+1);
  if (counts.size<2) return false;
  const majority=[...counts.keys()].sort((a,b)=>counts.get(b)-counts.get(a)||a.localeCompare(b))[0];
  for (const [name,value] of Object.entries(sample.contexts)) {
    if (value===undefined) continue;
    const matching=prior.filter(item=>item.contexts[name]===value);
    if (matching.length<2 || !matching.every(item=>item.next===matching[0].next)) continue;
    const scores=models[name]??={predictions:0,confirmed:0,majorityCorrect:0,corrected:0,damaged:0};
    const hit=matching[0].next===sample.next, other=majority===sample.next;
    scores.predictions++; scores.confirmed+=Number(hit); scores.majorityCorrect+=Number(other);
    scores.corrected+=Number(hit&&!other); scores.damaged+=Number(!hit&&other);
  }
  return true;
}

export function historyStep(previous,penultimate,op,source,next) {
  const index=previous ? previous.index+1 : 0;
  const history = previous?.after ?? 'initial';
  return {index,op,source,next,question:source+'/'+op,history,
    after:createHash('sha256').update(history+'|'+op).digest('hex'), contexts:contextsFor(index,previous,penultimate)};
}

export function evaluateForks(reference,forks) {
  let tested=0,ambiguous=0;
  const models={}, qualified=new Set(), testedHistories=new Set();
  for (const group of [0,1]) {
    const index=new Map(), included=new Set();
    function add(sample) {
      if (included.has(sample.after)) return;
      included.add(sample.after);
      const rows=index.get(sample.question)??[];
      rows.push(sample); index.set(sample.question,rows);
    }
    for (const step of reference) add(step);
    for (const [i,paths] of forks.entries()) if (i%2!==group) for (const s of paths.flat()) add(s);
    for (const [i,paths] of forks.entries()) if (i%2===group) for (const s of paths.flat()) {
      if (included.has(s.after) || testedHistories.has(s.after)) continue;
      testedHistories.add(s.after);
      const priors=index.get(s.question);
      if (!priors?.length) continue;
      tested++;
      if (evaluateAmbiguity(priors,s,models)) { ambiguous++; qualified.add(s.question); }
    }
  }
  return {tested,ambiguous,distinctAmbiguous:qualified.size,models};
}
