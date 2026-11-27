import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { examples, receiptVariation } from './developpement.mjs';
import { makeLedger, materialReturn, publish, toV1, validateReceipts, version } from './contrat.mjs';
import { situations } from '../accuses/situations.mjs';
import { development } from '../operator/schedule.mjs';

const dev=examples(), p=['indexer','P'];
const variants=situations().filter(c=>!c.negative);
const published=c=>receiptVariation(c).card;
const get=(name,cmd,label)=>materialReturn(dev[name].card,cmd,label);
const json=name=>JSON.parse(readFileSync(new URL('./exemples/'+name+'.json',import.meta.url)));

test('les exemples et le registre publiés se régénèrent',()=>{
  for(const name of ['B','B3','retours']) assert.deepEqual(json(name),dev[name].card);
  assert.deepEqual(publish(dev.B.base,json('B.declarations')),dev.B.card);
  for(const v of Object.values(dev)) assert.deepEqual(toV1(v.card),v.base);
});

test('la qualification se conserve au renommage, à la permutation et à la reformulation',()=>{
  for(const c of variants) {
    const card=published(c);
    const a=materialReturn(card,c.action.split(' '),c.ack);
    assert.equal(a.kind,'confirmed');
    assert.deepEqual(a.coverage.map(x=>x.effect),[{set:[['indexed','P'],true]}]);
    assert.deepEqual(toV1(card),c.message);
  }
  assert.deepEqual(published(variants[2]).receipts,published(variants[3]).receipts);
  const original=dev.B.base, changed=structuredClone(original);
  changed.sources[3]='La commande indexer P renvoie exactement « indexé ». Elle est disponible si P est non indexé et indexe P.';
  assert.deepEqual(publish(changed,makeLedger(changed,dev.B.declarations.entries)).receipts,dev.B.card.receipts);
  const renamed=JSON.parse(JSON.stringify(dev.B.card).replaceAll('indexer','caler').replaceAll('« indexé »','« calage enregistré »')
    .replace('"label":"indexé"','"label":"calage enregistré"').replaceAll('"P"','"Z"').replaceAll(' P',' Z'));
  assert.deepEqual(materialReturn(renamed,['caler','Z'],'calage enregistré').coverage[0].effect,{set:[['indexed','Z'],true]});
  const foreign=published(variants[5]), shared=published(variants[6]);
  assert.equal(materialReturn(foreign,p,'poste indexé').kind,'unmatched');
  assert.equal(materialReturn(foreign,['indexer','Q'],'poste indexé').kind,'confirmed');
  assert.deepEqual(materialReturn(shared,p,'indexé').coverage[0].effect,{set:[['indexed','P'],true]});
  assert.deepEqual(materialReturn(shared,['indexer','Q'],'indexé').coverage[0].effect,{set:[['indexed','Q'],true]});
});

test('confirmation, refus, déclaration absente ou ambiguë, effet inconnu et lecture',()=>{
  for(const label of ['indexé','indexation faite']) assert.equal(get('retours',p,label).kind,'confirmed');
  for(const [label,kind] of [['verrou local','refused'],['compte rendu incomplet','ambiguous'],
    ['indexé ','unmatched'],['Action indisponible.','refused'],['succès','terminal']]) {
    const r=get('retours',p,label);
    assert.equal(r.kind,kind);
    assert.equal(r.coverage,undefined);
  }
  assert.equal(get('retours',['toucher','T'],'traité').coverage,'unknown');
  assert.equal(get('retours',['toucher','U'],'traité').kind,'ambiguous');
  assert.equal(get('A',['lire'],'S').kind,'observation');
  assert.deepEqual(get('A',p,'poste indexé').coverage.map(x=>x.effect),[{set:[['indexed','P'],true]}]);
});

test('12 fiches historiques et une extension omise restent lisibles et reviennent à v1',()=>{
  for(const {message} of development()) {
    const out=publish(message);
    assert.ok(out.receipts.every(row=>row.status==='undeclared'));
    assert.deepEqual(toV1(out),message);
    assert.deepEqual(toV1(message),message);
    const material=message.commands.find(c=>c.command[0]==='marquer' || c.command[0]==='purger').command;
    for(const page of [message,out,{...message,format:version}]) {
      assert.equal(materialReturn(page,material,'marqué').kind,'undeclared');
      assert.equal(materialReturn(page,material,'Action indisponible.').kind,'refused');
    }
  }
});

test('le producteur rejette une citation supprimée ou modifiée, y compris à libellé identique',()=>{
  for (const line of [undefined,'La commande ne renvoie jamais « indexé ».']) {
    const page=structuredClone(dev.B.base);
    if(line) page.sources[3]=line; else delete page.sources[3];
    assert.throws(()=>publish(page,dev.B.declarations));
  }
});

test('le lecteur rejette les liaisons et les couvertures sans justification',()=>{
  const altered=(name,mutate)=>{
    const card=structuredClone(dev[name].card);
    const r=card.receipts.find(e=>e.command[0]==='indexer');
    mutate(card,r,r.replies[0]);
    assert.throws(()=>validateReceipts(card));
  };
  altered('B',(_c,_e,r)=>{r.label='inventé';});
  altered('B',(_c,_e,r)=>{r.source=[2];});
  altered('B',(_c,_e,r)=>{r.coverage[0].effect.set[1]=false;});
  altered('B',(_c,_e,r)=>{r.coverage[0].source=[2];});
  altered('B',(_c,_e,r)=>{r.label='succès';});
  altered('B',(c,e)=>{c.receipts.push(e);});
  altered('B',(_c,e,r)=>{e.replies.push({...r,kind:'refused'});});
  altered('B',(c)=>{c.receipts.pop();});
  altered('B',(c)=>{c.format='sra.public/1';});
  altered('retours',(_c,e)=>{e.replies.find(x=>x.kind==='refused').coverage='unknown';});
  altered('A',(c,_e,r)=>{const guarded=c.rules.find(x=>x.when && x.effect?.set);r.coverage=[{effect:guarded.effect,source:guarded.source}];});
  altered('A',(c,_e,r)=>{c.receipts.find(x=>x.command[0]==='lire').status='declared';
    c.receipts.find(x=>x.command[0]==='lire').replies=[r];});
});
