import type { NativeEntity, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import { aligned } from './controlled-parts.ts';
import { same, diff } from './access-terrain.ts';
import { spatialControls } from './calibrate-spatial-controls.ts';
import { visualLayout, type PreviewLearning } from './witnessed-preview-transfer.ts';
import type { TerminalContact } from './terminal-contact.ts';
import signatures from './source-contact-signatures.json' with { type: 'json' };

export function contactDescriptors(e: NativeEntity, count: number, pitch: number, centered: boolean, mobile: boolean): string[] {
  const width=e.bbox[2]-e.bbox[0]+1, height=e.bbox[3]-e.bbox[1]+1;
  const nx=Math.min(3,Math.ceil(2*width/pitch)), ny=Math.min(3,Math.ceil(2*height/pitch));
  const sparse=e.area*2<width*height, group=count===1?'one':count===2?'pair':'many';
  return [
    ['relative-shape',nx,ny,e.rectangular,sparse,group,centered,mobile],
    ['contact',nx===ny,e.rectangular,sparse,group,centered,mobile],
    ['stationary-mark',e.rectangular,group,centered,mobile],
  ].map(parts=>JSON.stringify(parts));
}

export function sourceContactHypotheses(learn: PreviewLearning, o: NativeObservation, rows: NativeRows): TerminalContact[] {
  const layout=visualLayout(o,rows), entities=new Map(o.entities.map(e=>[e.signature,e]));
  const contacts: TerminalContact[]=[];
  for (const [actor,motion] of Object.entries(learn.partMotion??{})) {
    const actors=layout[actor]??[], last=learn.lastActor[actor];
    const active=actors.length===1?actors[0]:actors.find(p=>last && same(p.at,last));
    if (!active) continue;
    const model=spatialControls(motion,new Set(o.available_action_refs),'',{},o.frame_hash,actor);
    const strokes=model?.motors.filter(m=>m.support>0)??[];
    if (!model || !strokes.length) continue;
    for (const [marker,parts] of Object.entries(layout)) {
      if (marker===actor || parts.length>12) continue;
      for (const part of parts) {
        const goal=aligned(part.at,active.at,model.pitch);
        if (same(goal,active.at)) continue;
        const e=entities.get(part.form);
        if (!e) continue;
        const centered=Math.max(Math.abs(goal[0]-part.at[0]),Math.abs(goal[1]-part.at[1]))<=1;
        const descriptor=contactDescriptors(e,parts.length,model.pitch[0]/2,centered,!!learn.partMotion?.[marker])
          .find(k=>Object.hasOwn(signatures,k));
        if (!descriptor) continue;
        const stroke=strokes.reduce((best,m)=>m.support>best.support?m:best);
        const refs=Object.values(motion.axes[stroke.op]??{}).filter(r=>same(r.d,stroke.d));
        if (!refs.length) continue;
        contacts.push({actor,marker,offset:diff(part.at,goal),pitch:model.pitch,before:refs[0]!.first,
          after:o.observation_ref,at:part.at,from:active.at,destination:goal,q:stroke.op,
          support:stroke.support,peers:actors.length-1,sourceDescriptor:descriptor});
      }
    }
  }
  return contacts;
}
