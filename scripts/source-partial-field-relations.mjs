import { solidFieldCells,fieldPitches,readFieldCue,fieldSymbolIndex } from '../src/sic/field-exemplars.ts';
import { fulfillsSite,siteValue } from '../src/sic/field-obligations.ts';

// A previously unseen mark is explained as an absent operand only after
// two distinct public diagrams show it at positions with no solid slot.
// A known mark can also name another diagram's fixed anchor.
export function partialFieldPlans(board,parts,rules,extend=false,decorated=false) {
  const result=[];
  for (const cells of solidFieldCells(board,parts).values()) for (const rule of rules) {
    const {rows,columns,cueIndex}=rule, w=cells[0].box[2]-cells[0].box[0]+1,h=cells[0].box[3]-cells[0].box[1]+1;
    if(cells.length<columns || w%columns || h%rows)continue;
    const loc=new Map(cells.map(c=>[c.box.slice(0,2).join(),c]));
    for(const dx of fieldPitches(cells,0))for(const dy of fieldPitches(cells,1)){
      if(dx<w||dy<h)continue;
      const offsets=Array.from({length:columns*rows},(_,k)=>[(k%columns-cueIndex%columns)*dx,
        (Math.floor(k/columns)-Math.floor(cueIndex/columns))*dy]);
      const centers=new Set(cells.flatMap(c=>offsets.map(([u,v])=>[c.box[0]-u,c.box[1]-v].join())));
      const windows=new Map(),missing=new Map(),present=new Set();
      for(const key of centers){
        const [x,y]=key.split(',').map(Number);
        if(x<0||y<0||x+w>board[0].length||y+h>board.length||loc.has(key))continue;
        const cue=[x,y,x+w-1,y+h-1],symbols=readFieldCue(board,{columns,rows,cue});
        if(!symbols)continue;
        const anchor=symbols[cueIndex];
        if(rule.sameAsCue.includes(anchor)||rule.differentFromCue.includes(anchor))continue;
        const claims=offsets.flatMap(([u,v],k)=>{
          if(k===cueIndex)return [];
          const symbol=symbols[fieldSymbolIndex(k,rule,rule.orientation)];
          const equal=rule.sameAsCue.includes(symbol)?true:rule.differentFromCue.includes(symbol)?false:null;
          const site=[x+u,y+v].join();return [{site,symbol,equal,cell:loc.get(site)}];
        });
        const supported=claims.filter(c=>c.cell&&c.equal!==null);
        const seed=supported.length>=Math.ceil(claims.length/2)&&supported.some(c=>c.equal)&&supported.some(c=>!c.equal);
        if(!seed && (!extend || !supported.length))continue;
        windows.set(key,{cue,anchor,claims});
        if(!seed)continue;
        for(const c of claims.filter(c=>c.equal===null)){
          if(c.cell)present.add(c.symbol);
          else {const examples=missing.get(c.symbol)??new Set();examples.add(key);missing.set(c.symbol,examples);}
        }
      }
      const nullSymbols=[...missing].filter(([symbol,examples])=>!present.has(symbol)&&examples.size>=2).map(([symbol])=>symbol);
      if(!nullSymbols.length)continue;
      const accepted=[],sites=new Map(),unbound=[];
      const palette=[...new Set([...windows.values()].map(window=>window.anchor))].sort((a,b)=>a-b);
      for(const window of windows.values()){
        if(!window.claims.every(c=>{
          if(c.equal===null)return nullSymbols.includes(c.symbol)&&!c.cell;
          if(c.cell)return true;
          const other=windows.get(c.site);
          if(other && (other.anchor===window.anchor)===c.equal)return true;
          return extend;
        }))continue;
        accepted.push(window.cue);
        for(const c of window.claims.filter(c=>!c.cell&&c.equal!==null)){
          const other=windows.get(c.site);
          if(other && (other.anchor===window.anchor)===c.equal)continue;
          const [x,y]=c.site.split(',').map(Number),box=[x,y,x+w-1,y+h-1];
          if(decorated && !other && palette.length===2 && x>=0 && y>=0 && x+w<=board[0].length && y+h<=board.length) {
            const values=new Set(board.slice(y,y+h).flatMap(row=>row.slice(x,x+w)));
            const marked=palette.filter(color=>values.has(color));
            if(values.size>1 && marked.length===1) {
              const site=sites.get(c.site)??{box,equal:[],different:[],palette};
              const list=c.equal?site.equal:site.different;
              if(!list.includes(window.anchor))list.push(window.anchor);
              sites.set(c.site,site);
              continue;
            }
          }
          unbound.push(c.site);
        }
        for(const c of window.claims.filter(c=>c.cell&&c.equal!==null)){
          const site=sites.get(c.site)??{box:c.cell.box,equal:[],different:[]};
          const list=c.equal?site.equal:site.different;
          if(!list.includes(window.anchor))list.push(window.anchor);
          sites.set(c.site,site);
        }
      }
      const obligations=[...sites.values()].sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0]);
      if(accepted.length<2||obligations.some(s=>s.equal.length>1||s.equal.some(v=>s.different.includes(v))))continue;
      if(obligations.some(s=>!fulfillsSite(siteValue(board,s.box),s)))result.push({cues:accepted,obligations,nullSymbols,unbound,palette});
    }
  }
  return result.sort((a,b)=>b.cues.length-a.cues.length || b.obligations.length-a.obligations.length);
}
