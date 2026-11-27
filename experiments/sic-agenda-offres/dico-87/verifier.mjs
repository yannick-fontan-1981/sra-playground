import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { sha } from './sonde.mjs';

const { values } = parseArgs({ options: { pyodide: { type: 'string' }, recu: { type: 'string' } } });
if (!values.pyodide) throw Error('--pyodide exige le chemin du paquet local.');
const vendor = resolve(values.pyodide);
const root = new URL('../../../', import.meta.url);
const refs = { catalogue: '8ce7ee3563fa1d5eca1639c6ad03975cfc962460', gel: 'd0e7527ca8033bd805a6d7a8bb021eff62e87021' };
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: fileURLToPath(root), maxBuffer: 8 * 1024 * 1024 });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error((r.stderr || r.stdout).split(/\r?\n/).filter(s => s.length < 480).slice(-24).join('\n'));
  return r.stdout;
}
function play(opening, engine, variant) {
  return JSON.parse(run(process.execPath, [fileURLToPath(new URL('parcours.mjs', import.meta.url)),
    opening, vendor, engine, ...(variant ? [variant] : [])]));
}
async function pinned(revision) {
  const temp = await mkdtemp(join(tmpdir(), 'sic-dico-'));
  try {
    const d = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
    const tar = join(temp, 'source.tar');
    run('git',['archive','--format=tar','--output',tar,revision,'src','package.json','public/python',d+'laya_proto',d+'morphology_policy']);
    run('tar',['-xf',tar,'-C',temp]);
    const engine = pathToFileURL(temp + sep).href;
    return { catalogue: play('catalogue',engine), curieux: play('curieux',engine) };
  } finally { await rm(temp,{ recursive:true,force:true }); }
}

const pop = [0,1,4,5], survivors = [1,5], query = [0,4];
const witness = JSON.parse(await readFile(new URL('temoin.json',import.meta.url)));
const reduced = r => ({ ticket:r.ticket.id, command:r.ticket.data, question:r.query?.key, after:r.after,
  matched:r.matched, frames:r.frames, feedback:r.feedback.event?.label ?? null, retained:r.feedback.retained });
function qualify(result) {
  const { rows, permutation, posteriorOnSameView, stationary, last } = result.catalogue;
  const [first, nav, nextNav, q] = rows;
  assert.deepEqual(rows.map(r => [r.level, r.kind]), [[1,'experiment'],[1,'subset_scope_navigation'],[1,'subset_scope_navigation'],[1,'subset_scope_query']]);
  assert.deepEqual(first.ticket.data, { x:1,y:3 });
  assert.equal(nextNav.ticket.actionRef,'ACTION6');
  assert.deepEqual(nav.ticket.data,q.ticket.data);
  assert.ok(!nav.offerSet && nav.query.key !== q.query.key);
  assert.equal(q.family,'subset_diagnosis');
  assert.equal(q.guard.admitted,true);
  assert.equal(q.guard.reason,'current_subset_control_and_exact_declared_question');
  assert.equal(q.matched,null);
  const { pre, sha256 } = q.offerSet;
  assert.equal(sha(pre),sha256);
  assert.deepEqual(q.offerSet,witness.pre);
  assert.deepEqual(reduced(q),witness.query);
  assert.equal(pre.observation,q.ticket.observationRef);
  assert.deepEqual(pre.candidates,pop);
  assert.deepEqual(pre.offers.map(o => [o.kind,o.tested,o.remaining]),[
    ['scope',[0,4],2],['scope',[1,5],2],['member',[0],3],['member',[1],3],['member',[4],3],['member',[5],3],
  ]);
  for (const offer of pre.offers) {
    assert.equal(offer.global, pop.filter(i => offer.tested.includes(i)).length);
    assert.equal(offer.local,pop.length-offer.global);
    assert.equal(offer.remaining,Math.max(offer.global,offer.local));
  }
  assert.deepEqual(q.query.candidates,pop);
  assert.deepEqual(q.query.tested,query);
  assert.deepEqual(q.ticket.data,{x:6,y:3});
  assert.equal(q.feedback.event.label,'LOCAL');
  assert.equal(q.feedback.event.after,q.after);
  assert.equal(q.feedback.event.before,pre.observation);
  assert.deepEqual(q.feedback.event.tested,q.query.tested);
  assert.deepEqual(q.feedback.event.beforeDomain,pop);
  assert.deepEqual(q.feedback.event.afterDomain,survivors);
  assert.deepEqual(q.feedback.retained,survivors);
  assert.equal(permutation.offerSet,sha256);
  assert.equal(permutation.key,q.query.key);
  assert.deepEqual(permutation.command.data,q.ticket.data);
  for (const control of [stationary,last]) {
    assert.equal(control.offerSet.sha256,sha256);
    assert.deepEqual(control.ticket,q.ticket);
    assert.equal(control.frames,1);
    assert.equal(control.feedback.event,null);
    assert.deepEqual(control.feedback.retained,pop);
  }
  for (const r of [stationary,last,q]) {
    assert.equal(r.feedback.before,r.ticket.observationRef);
    assert.equal(r.feedback.after,r.after);
    assert.deepEqual(r.feedback.command,{action_ref:r.ticket.actionRef,data:r.ticket.data});
  }
  assert.deepEqual(reduced(last),witness.lastOnly);
  assert.deepEqual(reduced(stationary),witness.stationary);
  assert.deepEqual(permutation,witness.permutation);
  assert.equal(last.after,q.after,'même dernière image publique');
  assert.equal(posteriorOnSameView.kind,'subset_scope_query');
  assert.deepEqual(posteriorOnSameView.candidates,survivors);
  assert.deepEqual(posteriorOnSameView.offerSet.pre.offers.map(o=>[o.kind,o.tested,o.remaining]),
    [['member',[1],1],['member',[5],1]]);
  assert.deepEqual(posteriorOnSameView.command.data,{x:25,y:26});
  const curious = result.curieux.rows;
  assert.equal(curious[0].opening,true);
  assert.deepEqual(curious[0].ticket.data,{x:25,y:36});
  assert.equal(curious[0].completed,1);
  assert.deepEqual([curious[3].level,curious[3].kind],[2,'subset_scope_navigation']);
  assert.equal(curious[3].offerSet,undefined);
  assert.deepEqual([curious[0],curious[3]].map(r=>({step:r.step,level:r.level,kind:r.kind,
    command:r.ticket.data,completed:r.completed})),witness.openingControl);
}
const results = {};
for (const [name,revision] of Object.entries(refs)) {
  results[name]=await pinned(revision);
  qualify(results[name]);
  console.log(name, revision.slice(0,8), 'catalogue : N1/4, 6 offres, LOCAL, 4 → 2 ; curiosité : N1/1 terminé puis navigation N2/4');
}
results.candidat = {catalogue:play('catalogue',root.href),curieux:play('curieux',root.href)};
qualify(results.candidat);
assert.equal(sha(results.candidat),sha(results.gel),'parité des deux préfixes et des contre-épreuves, reçus compris');
const historical = results.catalogue.catalogue.rows[3], active = results.candidat.catalogue.rows[3];
assert.deepEqual(historical.offerSet,active.offerSet);
assert.deepEqual(historical.query,active.query);
assert.deepEqual(historical.feedback,active.feedback);
const peer = play('catalogue',root.href,'autre-optimum').rows;
assert.deepEqual(peer.slice(0,3),results.candidat.catalogue.rows.slice(0,3));
const other = peer[3];
assert.deepEqual(reduced(other),witness.otherOptimum);
assert.deepEqual(other.offerSet,active.offerSet);
assert.deepEqual(other.query.tested,[1,5]);
assert.deepEqual(other.ticket.data,{x:27,y:3});
assert.equal(other.guard.admitted,true);
assert.notEqual(other.query.key,active.query.key);
assert.deepEqual(other.feedback.event.tested,[1,5]);
const expected = other.feedback.event.label === 'GLOBAL' ? survivors : query;
assert.ok(['GLOBAL','LOCAL'].includes(other.feedback.event.label));
assert.deepEqual(other.feedback.retained,expected);
console.log('candidat : parité complète avec le gel ; autre optimum en processus témoin : (27,3),',other.feedback.event.label,other.feedback.retained);
if (values.recu) await writeFile(resolve(values.recu),JSON.stringify({ revision:run('git',['rev-parse','HEAD']).trim(), refs,
  parity:sha(results.candidat), historical, candidate:results.candidat, alternate:other },null,2)+'\n');
