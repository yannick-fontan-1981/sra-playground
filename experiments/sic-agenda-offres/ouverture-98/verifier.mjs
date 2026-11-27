import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { verifierTypes23 } from './compatibilite-23.mjs';
import { sha } from './sonde.mjs';
import { current, refs, run, withEngine } from './versions.mjs';

const { values } = parseArgs({ options:{ pyodide:{type:'string'}, recu:{type:'string'} } });
if (!values.pyodide) throw Error('Indiquer --pyodide et le chemin du paquet local.');
const vendor = resolve(values.pyodide);
function script(name,...args) {
  return JSON.parse(run(process.execPath,[fileURLToPath(new URL(name,import.meta.url)),...args]));
}
const game = (root,code,mode,...variant) => script('jeu.mjs',vendor,root,code,mode,...variant);
function series(root) {
  const fixture = script('fixtures.mjs',root);
  const active = game(root,'DICO','active');
  const [shadow] = game(root,'DICO','shadow'), [absent] = game(root,'DICO','absent');
  const [memo] = game(root,'MEMO','active');
  return {active,shadow,absent,memo,fixture};
}
function receipt(row) {
  const {slate,ticket,objective,returned,opening} = row;
  const qualified = slate?.pre.eligible.filter(q=>q.target) ?? [];
  const maximum = qualified.length ? Math.max(...qualified.map(q=>q.target.count)) : null;
  const ties = qualified.filter(q=>q.target.count===maximum).map(q=>({ref:q.ref,...q.command.data}));
  return { level:row.level,id:ticket.id,click:ticket.data,family:row.family,strategy:row.strategy,
    pre:slate?.sha256 ?? null,offered:slate ? qualified.length : null,maximum,ties:slate ? ties : null,baseline:opening?.baseline.data ?? null,
    objective,need:row.need,guard:row.guard,returned };
}
const expected = [
  { sha:'8f73d9b44d0d0546e818542e94876cdcd848a0d6ac0114152b3a548e7498aedf',n:147,max:12,
    ties:[[25,36],[32,35],[37,24],[37,36]],objective:'Q_25c1916be61561533bb6' },
  { sha:'18f5361c51f014302623085f7bc6c7d9dc84b1887dca67fa891146549e665a5d',n:228,max:13,
    ties:[[13,12],[25,12]],objective:'Q_0f7ae3b372ec456042ed' },
];
function testSeries(result) {
  const {active,shadow,absent,memo} = result;
  assert.equal(active.length,2);
  active.forEach((row,i)=>{
    const e = expected[i], s = receipt(row), pre = row.slate.pre;
    assert.equal(sha(pre),e.sha);
    assert.equal(s.pre,e.sha);
    assert.equal(pre.observation,row.ticket.observationRef);
    assert.equal(pre.tier,3);
    assert.deepEqual(Object.keys(pre).sort(),['baseline','eligible','epoch','frame','observation','offered','tier']);
    assert.deepEqual(pre.offered,pre.eligible.filter(q=>q.target).map(q=>q.ref));
    assert.equal(s.offered,e.n);
    assert.equal(s.maximum,e.max);
    assert.deepEqual(s.ties.map(q=>[q.x,q.y]),e.ties);
    assert.deepEqual(s.click,{x:e.ties[0][0],y:e.ties[0][1]});
    assert.deepEqual(s.baseline,{x:1,y:3});
    assert.equal(s.family,'observed_frontier');
    assert.equal(s.strategy,'test_local_input');
    assert.equal(row.opening.selected,true);
    assert.equal(s.objective.label,'Investigate the richest observable composition');
    assert.equal(s.objective.id,e.objective);
    assert.equal(s.ties[0].ref,s.objective.id);
    assert.equal(s.id,'subset-qualification:native:'+(i+1));
    assert.equal(s.level,i+1);
    assert.equal(s.guard.admitted,true);
    assert.equal(s.returned.completed,1);
    assert.equal(s.returned.matched,null);
    assert.equal(s.returned.status,'unknown_effect_observed');
    assert.deepEqual(s.returned.acquired,{objective:s.objective.id,status:'observed',need:s.need});
  });
  assert.equal(active[0].returned.after,active[1].ticket.observationRef);
  const neighbors = active[0].slate.pre.eligible;
  const at = (x,y) => neighbors.find(q=>q.command.data.x===x && q.command.data.y===y);
  assert.equal(at(25,24).target.count,11);
  assert.equal(at(1,3).target.count,2);
  assert.deepEqual(shadow.slate,active[0].slate);
  assert.equal(shadow.opening.selected,false);
  assert.deepEqual(shadow.opening.command,active[0].opening.command);
  assert.deepEqual(shadow.ticket.data,active[0].opening.baseline.data);
  assert.equal(shadow.objective.id,active[0].slate.pre.baseline);
  assert.notEqual(shadow.objective.label,active[0].objective.label);
  assert.equal(absent.slate,null);
  assert.equal(absent.opening,null);
  assert.deepEqual(absent.ticket.data,shadow.ticket.data);
  assert.deepEqual(absent.objective,shadow.objective);
  assert.equal(memo.family,'public_occurrence_recall');
  assert.equal(memo.slate,null);
}
const candidate = series(current.href);
testSeries(candidate);
const same = {};
for (const name of ['historique','gel','parent']) {
  await withEngine(name,async root=>{
    const other = series(root);
    testSeries(other);
    // Les versions sont comparées au même mode et au même point de départ.
    for (const key of Object.keys(other)) assert.equal(sha(other[key]),sha(candidate[key]),name+' / '+key);
    same[name]=Object.fromEntries(Object.entries(other).map(([k,v])=>[k,sha(v)]));
  });
}
const [alternative] = game(current.href,'DICO','active','autre-egalite');
const first = candidate.active[0];
assert.deepEqual(alternative.slate,first.slate);
assert.equal(alternative.opening.evidence.distinctRelations,12);
assert.deepEqual(alternative.ticket.data,{x:37,y:36});
assert.equal(alternative.guard.admitted,true);
assert.equal(alternative.objective.id,receipt(first).ties.at(-1).ref);
assert.equal(alternative.returned.acquired.objective,alternative.objective.id);
assert.equal(alternative.returned.acquired.need,alternative.need);
assert.equal(alternative.returned.completed,0);
const compatibilite = await verifierTypes23();

const report = { base:refs.gel,parent:refs.parent,historique:refs.historique,
  candidat:run('git',['rev-parse','HEAD']).trim(),comparaisons:same,
  actif:candidate.active.map(receipt), shadow:receipt(candidate.shadow), absent:receipt(candidate.absent),
  autreJeu:receipt(candidate.memo), departageInverse:receipt(alternative), compatibilite,
  fiches:Object.fromEntries(Object.entries(candidate.fixture).map(([name,r])=>[name,{
    rang:r.slate?.pre.eligible.map(q=>q.target?.count ?? null) ?? null,
    commande:r.command,objectif:r.question,ouverture:r.opening?.selected ?? null,garde:r.guard.admitted,
  }])) };
if (values.recu) await writeFile(values.recu,JSON.stringify(report,null,2)+'\n','utf8');
console.log('Ligne 98 · 4 versions · DICO N1 et N2, shadow, sans option, MEMO et 7 décisions de fixture identiques.');
console.log('Départage substitué à offres constantes : (37,36), retour lié à sa question, niveau 1 en cours.');
console.log('Compatibilité avec les types de la ligne 23 : application et compilation réussies.');
