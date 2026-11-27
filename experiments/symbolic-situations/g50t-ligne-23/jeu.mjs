import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {verifyCheckout,localDecision,localReturn} from './service-commun.mjs';
const [sha,checkout,vendor,name,receipt]=process.argv.slice(2);
assert.ok(['G50T','REGN'].includes(name));
const {url}=verifyCheckout(checkout);
const official=file=>import(new URL('experiments/sic-agenda-offres/'+file,url));
const {loadService}=await official('essai-local-23/service.mjs');
const {withPinnedEngine}=await official('essai-local-23/moteur.mjs');
const {loadGame}=await official('frontiere-22-23/game.mjs');
await withPinnedEngine(sha,async engine=>{
  const game=await loadGame(name,resolve(vendor),engine),start=await loadService(engine);
  let board=game.initial;
  const session=await start(board),turns=[];
  const count=name==='G50T'?1:16;
  for(let i=0;i<count;i++){
    const d=await session.decision();
    if(!d.ticket)break;
    const level=board.level;
    board=await game.step(Number(d.ticket.actionRef.slice(6)),d.ticket.data);
    const r=await session.advance(d.ticket.id,board);
    turns.push({level,decision:d,acquisition:r});
  }
  const t=turns.at(-1),d=t?.decision,r=t?.acquisition;
  const ok=name==='G50T'?turns.length===1 && t.level===1 && localDecision(d) && localReturn(d,r) &&
    d.ticket.actionRef==='ACTION1' && d.question.id==='Q_36ce889058ea8eda599b':
    turns.length===16 && t.level===3 && d.family==='returned_branch_contrast' && d.kind==='access' &&
    d.ticket.actionRef==='ACTION4' && r.matched===true && r.status==='matched_public_projection' && !localDecision(d);
  const changes=[];
  if(name==='G50T' && ok){
    const other=structuredClone(d);other.family='returned_branch_contrast';changes.push(!localDecision(other));
    const foreign=structuredClone(r);foreign.frontier.objective='Q_étrangère';changes.push(!localReturn(d,foreign));
  }
  writeFileSync(receipt,JSON.stringify({sha,name,turns,ok,changes})+'\n',{flag:'wx'});
  console.log(JSON.stringify({jeu:name,actions:turns.length,niveau:t?.level,famille:d?.family,question:d?.question?.id,
    commande:d?.ticket.actionRef,retour:r?.status,matched:r?.matched,ok,alterations:changes}));
  process.exitCode=Number(!ok || changes.some(v=>!v));
});
