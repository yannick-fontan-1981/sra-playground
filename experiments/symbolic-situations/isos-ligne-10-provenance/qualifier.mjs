import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,gameRoot,out]=process.argv.slice(2);
const parent='5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f',fix='640bd882150f8164b2e6a1a7de6b85b16c52711f';
assert.ok([parent,fix].includes(sha));
const work=mount(sha,'.');
try {
  const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
  const tar=join(work.program,'qualification.tar'),test='tests/sic-isos-line-10.test.ts';
  execFileSync('git',['-C',repo,'archive','--output='+tar,fix,'scripts/sic-study-source-games.mjs',test]);
  execFileSync('tar',['-xf',tar,'-C',work.program]);
  if(group==='auteur'){
    const run=spawnSync(process.execPath,['--test',test],{cwd:work.program,encoding:'utf8',
      env:{...process.env,SIC_ISOS_GAME_ROOT:gameRoot,SIC_ISOS_ENGINE_ROOT:work.program}});
    if(run.error)throw run.error;
    assert.equal(run.status,sha===fix?0:1);
    writeFileSync(out,run.stdout,{flag:'wx'});
  }else{
    let code=readFileSync(new URL('../isos-ligne-10/parcours.mjs',import.meta.url),'utf8').replaceAll('\r\n','\n');
    const edits=[
      ['const record=F.record;','const record=F.record;\n  let previousBoundary;'],
      ['    const result=record.apply(this,args),[before,after]=args,state=this.state(),prior=state.portable;',
        '    const [before,after,command,first,second,proposal,index]=args;\n'+
        "    const without=name==='sansMéthodeSélectionnée'&&before.level_epoch===1&&after.level_epoch===2;\n"+
        '    if(without)assert.ok(proposal.facet_plan.method);\n'+
        '    const selected=without?{...proposal,facet_plan:{...proposal.facet_plan,method:null}}:proposal;\n'+
        '    const result=record.call(this,before,after,command,first,second,selected,index),state=this.state(),prior=state.portable;\n'+
        '    if(without)changes.push({tour:before.revision,retour:after.observation_ref,méthodeRetirée:proposal.facet_plan.method,boundary:prior.boundary_ref??null});'],
      ["const epoch=name==='sansPassageN3'?2:1;", "const epoch=name==='ancienneFrontière'?2:1;"],
      ["['sansPassage','sansPassageN3','référenceÉtrangère'].includes(name)","['référenceÉtrangère','ancienneFrontière'].includes(name)"],
      ["      else delete adjusted.boundary_ref;",
        "      else{assert.ok(previousBoundary&&previousBoundary!==after.observation_ref);adjusted.boundary_ref=previousBoundary;}"],
      ["    events.push({status:result.status","    if(result.status==='official_boundary')previousBoundary=after.observation_ref;\n    events.push({status:result.status"],
      ["      let reply=await service.handle",
        "      if(name==='autreTicket'&&i===3){\n"+
        "        const obsolete=rows[1].ticket.id;\n"+
        "        assert.notEqual(obsolete,previous.id);\n"+
        "        await assert.rejects(service.handle({type:'advance',sessionId,sequence:i,ticketId:obsolete,executionMs:0,observation:shown}), error=>{\n"+
        "          changes.push({tour:i,obsolete,autorisé:previous.id,score:real.levelsCompleted,erreur:error.message});\n"+
        "          return error.message.includes('does not bind the one pending authorization');\n"+
        "        });\n"+
        "      }\n"+
        "      let reply=await service.handle"],
      ["  assert.equal(group,'contrôles');","  if(group==='ticket')return {autreTicket:await play(game,'autreTicket',4)};\n  assert.equal(group,'contrôles');"],
      ["{sansPassage:3,sansPassageN3:7,référenceÉtrangère:4,stationnaireT1:1,stationnaireT2:2}",
        "{référenceÉtrangère:4,ancienneFrontière:8,sansMéthodeSélectionnée:4}"]
    ];
    for(const [before,after] of edits){assert.equal(code.split(before).length,2);code=code.replace(before,after);}
    const file=join(work.program,'parcours.mjs');
    writeFileSync(file,code);
    const {run}=await import(pathToFileURL(file));
    writeFileSync(out,JSON.stringify({sha,group,cases:await run(group,gameRoot)})+'\n',{flag:'wx'});
  }
} finally {work.close();}
