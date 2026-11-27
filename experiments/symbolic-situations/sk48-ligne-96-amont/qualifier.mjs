import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,writeFileSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [g,out,vendor,archive]=process.argv.slice(2);
const parent=g==='banc-parent',sha=parent?'08fa10a6b9986e7028551fbfc9d9e16eb83726b7':'4946cf0297734b9464fc52256af6fb27846f3bad';
const repo=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),prior=JSON.parse(readFileSync(new URL('../sk48-ligne-96/recu.json',import.meta.url),'utf8'));
function inputs(){
  const palettes={historique:[],développement:[9,14],réserve:[8,14],nouvelle:[9,13],banc:[8,13],'banc-parent':[8,13]};
  assert.ok(Object.hasOwn(palettes,g),'groupe inconnu');
  const publicNames=['direct','reposition','contraire','contraire-reposition'];
  const full=g==='historique'||g.startsWith('banc');
  const rows=(full?[false]:[false,true]).flatMap(negative=>[false,true].map(alternate=>{
    const index=Number(negative)*2+Number(alternate);
    const card=g==='réserve'?JSON.parse(readFileSync(new URL('rejeux-publics/'+publicNames[index]+'.json',import.meta.url))):{
      version:'sic.contact/1',couleurs:palettes[g],pack:alternate?{strategyOrder:['reposition_root_before_contact','revise_rooted_contact']}:{},
      gestes:full?24:13,
      ...(negative?{retourModifie:{geste:12,zone:[42,30,45,40],couleurs:g==='développement'?[14,9]:[13,14]}}:{})};
    return {negative,alternate,card};
  }));
  if(archive && Object.hasOwn(prior.empreintes,g)){
    const old=JSON.parse(readFileSync(join(archive,'08fa10a6.'+g+'.json'))).results;
    assert.equal(h(old),prior.empreintes[g]);
    assert.deepEqual(rows,old.map(({negative,alternate,card})=>({negative,alternate,card})));
  }
  return rows;
}
const base=mkdtempSync(join(tmpdir(),'sk48-qualification-'));
try{
  const head='experiments/sic-agenda-offres/',p=head+'projection-initiale/',r=head+'revision-96/',tar=join(base,'moteur.tar');
  const ref='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
  const fixture='docs/migration/lot3d-evidence/final/sk48-rooted-session/sk48-public-trace.json.gz';
  execFileSync('git',['-C',repo,'archive','--output='+tar,sha,'src','public/python','package.json',ref+'laya_proto',ref+'morphology_policy',
    head+'evaluateur-jeu.mjs',head+'frontiere-22-23/game.mjs',...(parent?[r+'operateur.mjs']:[p+'operateur.mjs',p+'enquete.mjs',p+'trajet.mjs']),r+'moteurs.mjs',r+'parcours.mjs',r+'sonde.mjs',fixture]);
  execFileSync('tar',['-xf',tar,'-C',base]);
  if(g==='stations'){
    copyFileSync(new URL('stations.mjs',import.meta.url),join(base,'stations.mjs'));
    const s=execFileSync(process.execPath,['stations.mjs'],{cwd:base,encoding:'utf8'});writeFileSync(out,s,{flag:'wx'});
  }else{
    const results=[];
    for(const {negative,alternate,card} of inputs()){
      const f=join(base,'carte.json'),rec=join(base,'reçu.json');writeFileSync(f,JSON.stringify(card));
      execFileSync(process.execPath,[join(base,(parent?r:p)+'operateur.mjs'),...(parent?['--moteur','candidat']:[]),'--fiche',f,'--pyodide',vendor,'--recu',rec,'--source',pathToFileURL(base+'/').href],
        {cwd:base,timeout:180000,windowsHide:true});
      const result=JSON.parse(readFileSync(rec));if(!parent)assert.deepEqual(result.card,card);
      results.push({negative,alternate,card,result});console.log(JSON.stringify([g,result.steps.length,result.steps[4]?.cmd,result.steps[12]?.cmd,result.stop]));
    }
    writeFileSync(out,JSON.stringify({sha,results})+'\n',{flag:'wx'});
  }
}finally{rmSync(base,{recursive:true,force:true});}
