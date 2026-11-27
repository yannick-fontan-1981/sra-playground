import {createInterface} from 'node:readline';
import {contrastModels,contrastOffers} from './src/logos-engine/v6-point-contrasts.ts';
for await(const line of createInterface({input:process.stdin})){
  const {history,options,spent}=JSON.parse(line),models=await contrastModels(history);
  const names=new Map(models.map(m=>[m.feature,m.id]));
  const pairs=spent.map(pair=>pair.map(k=>names.get(k)).sort());
  const offers=await contrastOffers(history,options,{compared_pairs:pairs});
  console.log(JSON.stringify(offers.map(o=>{
    const features=new Map(o.rivals.map(r=>[r.id,r.feature]));
    return {point:o.binding.action.data,predictions:Object.fromEntries(Object.entries(o.frozen_predictions).map(([id,v])=>[features.get(id),v])),
      pairs:o.new_contrast_pairs.map(pair=>pair.map(id=>features.get(id)).sort().join('|')).sort()};
  })));
}
