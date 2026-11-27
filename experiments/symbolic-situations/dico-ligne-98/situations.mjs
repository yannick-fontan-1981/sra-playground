export function situations(seed){
  const dx=seed?1+seed[0]%3:0,dy=seed?2+seed[1]%3:0;
  const colors=seed?[8+seed[2]%3,11,12,13]:[2,3,4,5];
  const [body,up,left,right]=colors,clicks=[[12+dx,12+dy],[32+dx,38+dy],[52+dx,15+dy]];
  const [a,b,c]=clicks,cell=(p,x,y,color)=>[p[0]+x,p[1]+y,color];
  const points=[...clicks.map(p=>cell(p,0,0,body)),cell(a,0,-3,up),cell(a,-3,0,left),cell(b,0,-3,up),cell(b,-3,0,left),cell(c,3,0,right)];
  const card=p=>({version:'sic.ouverture/1',points:p,clics:clicks});
  return {égalité:card(points),nouvelle:card([...points,cell(b,3,0,right)]),doublon:card([...points,cell(b,-6,0,left)])};
}
if(import.meta.main){
  const key=process.argv[2]??'égalité',cards=situations();
  if(!Object.hasOwn(cards,key))throw Error('Choisir égalité, nouvelle ou doublon');
  console.log(JSON.stringify(cards[key],null,2));
}
