import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { materialReturn,toV1 } from '../accuses-publics/contrat.mjs';
import { examples } from '../accuses-publics/developpement.mjs';
import { publicCase } from '../reductions/cases.mjs';
import { measure } from '../operator/measure.mjs';
import { crossed,groups } from './lots.mjs';
import { translate } from './traduire.mjs';

test('A/B et B3 retrouvent les déclarations publiées, X1/X2 ne changent que le retour',()=>{
  const dev=examples();
  for(const id of ['A','B','B3']) {
    const page=translate(dev[id].base);
    assert.deepEqual(page,dev[id].card);
  }
  const [x,y]=crossed();
  const page=translate(x.message);
  assert.deepEqual(page,translate(y.message));
  assert.equal(materialReturn(page,['indexer','P'],x.ack).kind,'confirmed');
  assert.equal(materialReturn(page,['indexer','P'],y.substitution).kind,'unmatched');
  const omitted=structuredClone(x.message);
  omitted.sources[3]=omitted.sources[3].replace('renvoie exactement « indexé ».','donne un retour.');
  assert.equal(materialReturn(translate(omitted),['indexer','P'],'indexé').kind,'undeclared');
});

test('les anciens jeux ne déclarent aucun libellé matériel',async()=>{
  const {developpement}=await groups(false);
  for(const c of developpement) {
    const page=translate(c.message);
    assert.deepEqual(toV1(page),c.message);
    assert.ok(page.receipts.every(r=>r.status==='undeclared'));
  }
});

test('huit témoins structurels, toutes les transitions joignables', {skip:!process.env.SRA_TEMOINS_CONNUS},async()=>{
  const lots=await groups(true);
  let worlds=0,edges=0;
  for(const c of lots.structure) {
    const page=translate(c.message);
    for(const e of page.receipts) {
      if (['indexer','ouvrir'].includes(e.command[0])) {
        assert.equal(e.status,'declared');
        assert.equal(e.replies[0].coverage,'unknown');
        assert.equal(e.replies[0].label,e.command[0]==='ouvrir'?'ouvert':'indexé');
      } else assert.equal(e.status,'undeclared');
    }
    for(const w of c.worlds) {
      worlds++;
      const seen=new Set();
      function visit(s) {
        const id=JSON.stringify(s);
        if (seen.has(id)) return;
        seen.add(id);
        for(const {command} of page.commands) {
          edges++;
          const r=c.dynamics.step(w,s,command.join(' '));
          const type=materialReturn(page,command,r?.feedback??'Action indisponible.');
          if (!r) assert.equal(type.kind,'refused');
          else if (!r.next) assert.equal(type.kind,'terminal');
          else {
            assert.equal(type.kind,command[0]==='lire'?'observation':'confirmed');
            if(type.kind==='observation') assert.ok(page.domains.find(d=>d.ref[0]==='dial').values.includes(r.feedback));
            visit(r.next);
          }
        }
      }
      visit(c.dynamics.initialState(w));
    }
  }
  assert.equal(worlds,8); assert.equal(edges,288);
});

test('le processus témoin atteste ses deux seules entrées sur chacun des départs A',async()=>{
  const c=publicCase('A'), page=translate(c.message);
  const code=`import {createInterface} from 'node:readline';import {createHash} from 'node:crypto';
    import {readFileSync} from 'node:fs';
    let seen=[];
    for await (const line of createInterface({input:process.stdin})) {
      seen.push(line);
      if (seen.length===1) console.log(JSON.stringify({action:'indexer P'}));
      else {
        let denied=false;
        try{readFileSync('../outside-window.txt')}catch(e){denied=e.code==='ERR_ACCESS_DENIED'}
        console.log(JSON.stringify({arret:createHash('sha256').update(seen.join('\\n')).digest('hex')+' '+denied+' '+Object.hasOwn(process.env,'SRA_RELAY_TEST_MARKER')}));break;
      }
    }`;
  const previous=process.env.SRA_RELAY_TEST_MARKER;
  process.env.SRA_RELAY_TEST_MARKER='opérateur';
  let r;
  try {r=await measure([{...c,message:page}],{program:'temoin.mjs',files:new Map([['temoin.mjs',Buffer.from(code)]])});}
  finally {
    if(previous===undefined) delete process.env.SRA_RELAY_TEST_MARKER;
    else process.env.SRA_RELAY_TEST_MARKER=previous;
  }
  const digest=createHash('sha256').update(JSON.stringify({fiche:page})+'\n'+JSON.stringify({retour:'poste indexé'})).digest('hex');
  assert.equal(r.departs.length,2);
  for(const row of r.departs) assert.equal(row.premierEcart?.detail,digest+' true false');
});

test('parcours manuel v1.1, deux mondes et reprise exacte après la lecture',()=>{
  const path=fileURLToPath(new URL('./manuel.mjs',import.meta.url));
  const run=(args,actions=[])=>execFileSync(process.execPath,[path,...args],{encoding:'utf8',input:actions.map(action=>JSON.stringify({action})).join('\n')+'\n'}).trim();
  const prompt=run(['--message','--fiche','A']);
  const page=JSON.parse(prompt.split(/\r?\n/)[1]).fiche;
  assert.deepEqual(page,translate(publicCase('A').message));
  const folder=mkdtempSync(join(tmpdir(),'prefixe-public-'));
  try {
    for(const [i,code] of ['R','S'].entries()) {
      const actions=['indexer P','lire','marquer P '+code,'valider'];
      const feedback=run(['--monde',String(i+1)],actions).split(/\r?\n/).map(s=>JSON.parse(s).retour);
      assert.deepEqual(feedback,['poste indexé',code,'marqué','succès']);
      const prefix=actions.slice(0,2).map((action,n)=>({action,retour:feedback[n]}));
      const file=join(folder,'prefix.json');writeFileSync(file,JSON.stringify(prefix));
      assert.ok(run(['--message','--prefixe',file]).endsWith(JSON.stringify({retour:code})));
      assert.deepEqual(run(['--prefixe',file],actions.slice(2)).split(/\r?\n/).map(s=>JSON.parse(s).retour),feedback.slice(2));
    }
  } finally {rmSync(folder,{recursive:true,force:true});}
});
