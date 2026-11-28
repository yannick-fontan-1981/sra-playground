import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {mount} from '../ls19-ligne-90/montage.mjs';

export async function verifyTimeline(nominal){
  const gel='d0e7527ca8033bd805a6d7a8bb021eff62e87021',m=mount(gel,'.');
  try{
    const {recurrentSeriesFields}=await import(new URL('src/logos-engine/v6-recurrent-series-observation.ts',pathToFileURL(m.program+'/')));
    const trace='docs/migration/lot3i-evidence/final/conn-recurrent-series-session/conn-public-trace.json.gz';
    const packets=JSON.parse(gunzipSync(execFileSync('git',['show',gel+':'+trace]))).packets;
    return [10,11,12].map(turn=>{
      const before=packets[turn-1].packet,after=packets[turn].packet,frames=after.frame_packet;
      const [f]=recurrentSeriesFields(before.frame_rows);
      const e=nominal[turn].acquisitions.find(v=>v.kind==='supported_insertion_observation');
      const stable=(film,point,color)=>{
        const [x,y]=point.map((v,i)=>f.origin[i]+v*f.pitch[i]),[w,h]=f.size;
        const same=frame=>frame.slice(y,y+h).every(row=>row.slice(x,x+w).every(v=>v===color));
        const lastDifferent=film.findLastIndex(frame=>!same(frame));
        return lastDifferent+1;
      };
      const result=(film)=>[stable(film,e.arrived,e.own),stable(film,e.response,e.other)];
      const full=result(frames),final=result([after.frame_rows]);
      assert.ok(full[0]<full[1] && full[1]<frames.length);assert.deepEqual(final,[0,0]);
      return {tour:turn,images:frames.length,contribution:full[0],réponse:full[1],finaleSeule:final};
    });
  }finally{m.close();}
}
