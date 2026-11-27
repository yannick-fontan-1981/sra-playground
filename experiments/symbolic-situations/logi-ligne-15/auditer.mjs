import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {board,development,readRow} from './situations.mjs';
import {evaluate} from './oracle.mjs';

const [publicPath,reservePath,selectionPath]=process.argv.slice(2);
const parse=path=>JSON.parse(readFileSync(path,'utf8'));
const main=parse(publicPath);
const byId=new Map(main.results.map(row=>[row.id,row.turns]));
function paired(specs,receipts,compareHistograms){
  const [a,b]=specs.map(spec=>board(spec));
  const [ta,tb]=receipts;
  assert.deepEqual(a.initial,b.initial);
  assert.deepEqual(ta[0],tb[0]);
  const afterA=a.advance(0,ta[0].command),afterB=b.advance(0,tb[0].command);
  assert.ok(afterA && afterB);
  assert.deepEqual(readRow(afterA.frame,a.controls),readRow(afterB.frame,b.controls));
  assert.notDeepEqual(readRow(afterA.frame,a.receivers),readRow(afterB.frame,b.receivers));
  // Ramener les rectangles des récepteurs au même état doit effacer toute différence publique.
  const normalized=structuredClone(afterB);
  for(const [x,y,right,bottom] of a.receivers){
    for(let j=y;j<=bottom;j++)for(let k=x;k<=right;k++){
      normalized.frame[j][k]=afterA.frame[j][k];
      normalized.frames[0][j][k]=afterA.frames[0][j][k];
    }
  }
  assert.deepEqual(normalized,afterA);
  if(compareHistograms)assert.deepEqual(afterA.frame.flat().sort(),afterB.frame.flat().sort());
  assert.equal(ta[1].measured.value,'coupled');
  assert.equal(tb[1].measured.value,'coupled');
  assert.notDeepEqual(ta[1].command,tb[1].command);
}
const left=development.find(spec=>spec.id==='D2-gauche'),center=development.find(spec=>spec.id==='D2-centre');
const l=byId.get(left.id),c=byId.get(center.id);
paired([left,center],[l,c],true);
assert.ok(evaluate(left,l).ok && evaluate(center,c).ok);
const negatives=[];
function reject(name,edit,expected){
  const copy=structuredClone(l);
  edit(copy);
  const verdict=evaluate(left,copy);
  assert.ok(!verdict.ok && verdict.ecarts.includes(expected),name);
  negatives.push(name);
}
reject('récepteur réattribué',t=>{t[1].info.lamps=[...c[1].info.lamps];},'adressage vérifiable après réponse 0');
reject('retour de la question précédente',t=>{t[2].measured.revision=t[1].measured.revision;
  t[2].measured.evidence=t[1].measured.evidence;},'réponse liée au bon essai 1');
reject('hypothèse couplée validée à tort',t=>{t[2].measured.checks.coupled_switch='matched';},'mesure et trois hypothèses 1');
reject('deuxième clic emprunté à l’autre départ',t=>{t[1].command=c[1].command;},'question suivante justifiée par la nouvelle observation');
const audit={sha:main.sha,paireDéveloppement:true,rejets:negatives};
if(reservePath || selectionPath){
  const bytes=readFileSync(selectionPath),digest=createHash('sha256').update(bytes).digest('hex');
  assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8').includes(digest));
  const {cases}=JSON.parse(bytes),reserve=parse(reservePath);
  assert.equal(reserve.sha,main.sha);
  const rows=cases.map(s=>reserve.results.find(r=>r.id===s.id).turns);
  assert.ok(cases.every((s,i)=>evaluate(s,rows[i]).ok));
  paired(cases.slice(0,2),rows.slice(0,2),false);
  assert.deepEqual(rows[0][0],rows[2][0]);
  assert.deepEqual(rows[0][1].info.lamps,rows[2][1].info.lamps);
  assert.notDeepEqual(rows[0][1].info.before,rows[2][1].info.before);
  assert.equal(rows[2][1].measured.value,'other');
  assert.ok(rows.slice(0,2).every(ts=>ts[2].measured.value==='local_only'));
  audit.réserve=true;
}
console.log(JSON.stringify(audit));
