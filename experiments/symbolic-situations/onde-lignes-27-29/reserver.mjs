import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

const [receiptFile,selectionFile,out]=process.argv.slice(2);
const {turns,sha}=JSON.parse(readFileSync(receiptFile));
assert.equal(sha,'d0e7527ca8033bd805a6d7a8bb021eff62e87021');
const bytes=readFileSync(selectionFile),hash=x=>createHash('sha256').update(x).digest('hex');
assert.ok(readFileSync(new URL('CONTRAT.md',import.meta.url),'utf8').includes(hash(bytes)));
const seed=Buffer.from(JSON.parse(bytes).seed,'hex'),scene=turns[6];
assert.equal(scene.niveau,3);assert.equal(scene.mode,'channel_question');
const colors=scene.profils.map(t=>t.couleur);
assert.ok(colors.length>=2 && new Set(colors).size===colors.length);
const first=colors[seed[0]%colors.length],rest=colors.filter(c=>c!==first),pair=[first,rest[seed[1]%rest.length]];
const cards=[false,true].map(tried=>({version:'sra.onde/1',échange:pair,plafond:16,
  ...(tried?{historique:{tour:7,questionEssayée:{commande:scene.cmd,point:scene.point}}}:{})}));
const serial=JSON.stringify(cards)+'\n';writeFileSync(out,serial,{flag:'wx'});
console.log(JSON.stringify({départs:cards.length,empreinte:hash(serial)}));
