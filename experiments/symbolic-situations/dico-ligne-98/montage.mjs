import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
export const refs=['d0e7527ca8033bd805a6d7a8bb021eff62e87021','c0b9f4027f1df257d7b8c96f5656f9dbb83661f0','e21781637371b846c60aa50de5ff080c136c9abf'];
export async function withEngine(sha,work,variant=false){
  assert.ok(refs.includes(sha));
  const root=execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim(),tmp=mkdtempSync(join(tmpdir(),'trois-cibles-'));
  const git=(...args)=>execFileSync('git',['-C',root,...args]);
  try{
    const engine=join(tmp,'engine'),lab=join(tmp,'experiences'),tar=join(tmp,'source.tar');mkdirSync(engine);mkdirSync(lab);
    const pack='reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
    git('archive','--output='+tar,sha,'src','package.json','public/python',pack+'laya_proto',pack+'morphology_policy');
    execFileSync('tar',['-xf',tar,'-C',engine]);
    for(const name of ['evaluateur-jeu.mjs','frontiere-22-23/game.mjs','ouverture-98/jeu.mjs','ouverture-98/fiche.mjs','ouverture-98/sonde.mjs']){
      let source=git('show',refs[2]+':experiments/sic-agenda-offres/'+name).toString();
      if(name.endsWith('sonde.mjs') && variant){
        assert.equal(sha,refs[2]);
        const standard='opening = selectOpeningOffer(offers.slice().reverse());';
        assert.equal(source.split(standard).length,2);
        // Permuter uniquement les deux premières offres au score maximal. Aucune cible retirée.
        const alternate='const choice=selectOpeningOffer(offers); const order=[...offers]; const i=order.indexOf(choice); const j=order.findIndex((o,k)=>k>i && o.evidence.distinctRelations===choice.evidence.distinctRelations); if(j>i)[order[i],order[j]]=[order[j],order[i]]; opening=selectOpeningOffer(order);';
        source=source.replace(standard,alternate);
      }
      const dest=join(lab,name);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,source);
    }
    return await work({root:pathToFileURL(engine+'/').href,lab});
  }finally{rmSync(tmp,{recursive:true,force:true});}
}
