// Both arms start from the same verified public switch and motor response.
// Click a body, repeat the witnessed motor, and separately measure both bodies.
export function measureReturnedControl({reset,rep,entities,previous,selected,motor,moves,live}) {
  const inside=(b,r)=>b[0]>=r[0]&&b[1]>=r[1]&&b[2]<=r[2]&&b[3]<=r[3];
  function point(box){
    const subjects=entities.filter(e=>e.area>=2&&inside(e.bbox,box)).sort((a,b)=>b.area-a.area);
    const e=subjects[0];if(!e||subjects[1]?.area===e.area)return null;
    const cx=(e.bbox[2]-e.bbox[0])/2,cy=(e.bbox[3]-e.bbox[1])/2;
    const [x,y]=e.mask.slice().sort((a,b)=>Math.abs(a[0]-cx)+Math.abs(a[1]-cy)-Math.abs(b[0]-cx)-Math.abs(b[1]-cy))[0];
    return 'ACTION6:'+(e.bbox[0]+x)+','+(e.bbox[1]+y);
  }
  const clickA=point(previous),clickB=point(selected);
  if(!clickA||!clickB||clickA===clickB)return;
  function test(click){
    const start=reset();
    if(!start.availableActionIds.includes(6))return {outcome:'click_unavailable'};
    const before=rep.act(click);
    if(!live(before)||!before.availableActionIds.includes(Number(motor.slice(6))))return {outcome:'motor_unavailable',won:rep.win(before)};
    const after=rep.act(motor);
    if(!live(after))return {outcome:'terminal',won:rep.win(after)};
    const movement=moves(before,after);
    const stayed=box=>before.frame.slice(box[1],box[3]+1).every((row,j)=>row.slice(box[0],box[2]+1).every((v,k)=>after.frame[j+box[1]][k+box[0]]===v));
    const translated=box=>movement.some(m=>inside(m.from.bbox,box));
    return {outcome:translated(previous)&&stayed(selected)?'first_moves':translated(selected)&&stayed(previous)?'second_moves':'other'};
  }
  const a=test(clickA),b=test(clickB);reset();return {previous:a,selected:b};
}
