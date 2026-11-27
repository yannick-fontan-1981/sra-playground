import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

const [sha,group,vendor,out,selection]=process.argv.slice(2);
const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef';
assert.ok([gel,candidate].includes(sha));
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),m=mount(sha,repo);
const groups={
  repères:[['nominal',16],['ordre-déclaré',3],['préimage',3]],
  choix:[['initial-bis',3],['canal-bis',9],['sans-loi',3]],
  historique:[['initial-essayé',3],['initiaux-épuisés',2],['canal-essayé',9],['canaux-épuisés',9]],
  réserve:[['renommée',16],['renommée-essayée',16]]
};
assert.ok(groups[group]);
try{
  const head='experiments/sic-agenda-offres/',path=head+'onde-27-29/',base=pathToFileURL(m.program+'/');
  for(const [revision,paths] of [[sha,['public/python']],[candidate,[path,head+'evaluateur-jeu.mjs',head+'frontiere-22-23/game.mjs']]]){
    const tar=join(m.program,revision.slice(0,8)+'.tar');execFileSync('git',['-C',repo,'archive','--output='+tar,revision,...paths]);
    execFileSync('tar',['-xf',tar,'-C',m.program]);
  }
  const {play}=await import(new URL(path+'parcours.mjs',base));
  const {PeriodicSums,measurePeriodicSums}=await import(new URL('src/logos-engine/v6-periodic-sums.ts',base));
  const {symbolicDigest:digest}=await import(new URL('src/logos-engine/v6-hash.ts',base));
  let held;
  if(group==='réserve'){
    const bytes=readFileSync(selection);assert.equal(createHash('sha256').update(bytes).digest('hex'),'159c6f8b62a28915da0e8e6793a0f08c01162c601b9bf1abe3fd8b0c8fe26139');
    held=JSON.parse(bytes);
  }
  const results={};
  for(const [i,[name,gestes]] of groups[group].entries()){
    const card={version:'sic.onde/1',gestes,budget:16,couleurs:held?.[i].échange??[]};
    if(name==='ordre-déclaré')card.inverserQuestionsInitiales=true;
    if(name==='préimage')card.retirerPreimage={geste:2,phases:[7,0]};
    if(name==='initial-bis'||name==='canal-bis')card.substitution={geste:name==='initial-bis'?1:7,indice:1};
    const changes=[],native=PeriodicSums.prototype.propose;
    const intervention={'initial-essayé':1,'initiaux-épuisés':1,'sans-loi':2,'canal-essayé':7,'canaux-épuisés':7,'renommée-essayée':7}[name];
    PeriodicSums.prototype.propose=async function(obs,rows,inputs,remaining){
      if(!intervention || obs.revision!==intervention || changes.length)return native.call(this,obs,rows,inputs,remaining);
      const scene=measurePeriodicSums(rows),entry={ref:obs.observation_ref,modification:name};
      if(intervention===1){
        const actions=this.config.initial_control_question.ordered_input_hypotheses.slice(0,name==='initial-essayé'?1:2);
        for(const a of actions)this.bootstrap_attempts.add(digest([obs.level_epoch,scene.layout,scene.tracks.map(t=>t.profile),scene.selected,a,'initial_selected_strip_response']));
        entry.actions=actions;
      }else if(intervention===2){
        assert.deepEqual(Object.keys(this.individual),['ACTION3']);assert.deepEqual(this.refs,[obs.observation_ref]);
        entry.acquisition={commande:'ACTION3',gain:this.individual.ACTION3,ref:this.refs[0]};this.individual={};this.refs=[];
      }else{
        const point=held?.[i].historique.questionEssayée.point??{x:48,y:3};
        const chosen=scene.controls.filter(c=>name==='canaux-épuisés'||(c.point[0]===point.x && c.point[1]===point.y));
        assert.equal(chosen.length,name==='canaux-épuisés'?2:1);
        for(const control of chosen)this.tried.add(digest([obs.level_epoch,scene.layout,control.shape,'channel']));
        entry.points=chosen.map(c=>c.point);
      }
      changes.push(entry);
      const p=await native.call(this,obs,rows,inputs,remaining);
      entry.offre=p?{type:p.kind,cmd:p.actions[0]}:null;
      return p;
    };
    try{
      const report=await play(card,vendor,base.href);results[name]={card,changes,...report};
      console.log(JSON.stringify([name,changes.length,report.steps.length,report.stop]));
    }finally{PeriodicSums.prototype.propose=native;}
  }
  writeFileSync(out,JSON.stringify({sha,group,results})+'\n',{flag:'wx'});
}finally{m.close();}
