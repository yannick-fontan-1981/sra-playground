import assert from 'node:assert/strict';
// Chaque moitié reproduit les pixels filmés dans sa région, en immobilisant l’autre région.
export function chronologie(before,packet,lateFirst){
  const final=packet.at(-1);
  const mix=(left,right)=>left.map((row,y)=>row.map((v,x)=>x>=50&&y<46?right[y][x]:v));
  const a=packet.map(f=>lateFirst?mix(before,f):mix(f,before));
  const b=packet.map(f=>lateFirst?mix(f,final):mix(final,f));
  const frames=[...a,...b];assert.deepEqual(frames.at(-1),final);
  return frames;
}
// Reconstruire le support visible de chaque mot à sa propre base. Les couches
// antérieures masquent les couches postérieures sur les pixels qu’elles partagent.
export function readWord(frame,geometry,word,base){
  const values=new Map();
  for(const [i,color] of word.entries())for(const [dx,dy] of geometry.forme){
    const x=base[0]+dx+(i-word.length)*geometry.pas[0],y=base[1]+dy+(i-word.length)*geometry.pas[1];
    const k=x+','+y;if(!values.has(k))values.set(k,{x,y,color});
  }
  let visible=0,matched=0;
  for(const {x,y,color} of values.values())if(frame[y]?.[x]!==undefined){visible++;if(frame[y][x]===color)matched++;}
  return {complet:visible===values.size && matched===visible,compatible:visible>0 && matched===visible};
}
export function firstEffects(before,frames,geometry,subjects){
  return subjects.map(({mot,avant,après})=>{
    assert.ok(readWord(before,geometry,mot,avant).compatible);
    const premier=frames.findIndex(f=>readWord(f,geometry,mot,après).complet && !readWord(f,geometry,mot,avant).compatible);
    return {mot,avant,après,premier};
  });
}
