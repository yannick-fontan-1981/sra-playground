/** Native transfer of common_animated_contact.py, animated_contact_access.py
 * and their neutral AnimationBase. The sole owned action is reconciled against
 * its full ordered public packet before another contact may be proposed.
 */
import frontierPolicy from './v6/frontier-policy.json' with { type:'json' };
import defaultRules from './v6/animated-contact-rules.json' with { type:'json' };
import { ObservedInputDomain } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import { supportSame,supportKey } from './v6-support-measurements.ts';
import { orderedTransientComponentPathFacts,measureScalarFillDisplay } from './v6-transient-measurements.ts';
import { acquireTransientCurve,projectTransientCurve,transientCalibration,transientSourceRoleProbe } from './v6-transient-contact-memory.ts';
import type { NativeFamily,NativeRows,NativeBeforeResult,NativeAfterResult,NativeRecordResult,NativeRecord,NativeObservation } from './v6-native-types.ts';
type R=Record<string,any>;
const clone=<T>(v:T):T=>structuredClone(v);
export function animatedCrossInvitation(o:R):R|null{
  const candidates:R[]=[];for(const e of o.entities){const[left,top,right,bottom]=e.bbox,width=right-left,height=bottom-top;if(width!==height||width<2||width%2||e.area!==width+height+1)continue;
    const half=width/2,actual=new Set<string>(e.mask.map(supportKey)),expected=new Set<string>();for(let y=0;y<=height;y++)expected.add(supportKey([half,y]));for(let x=0;x<=width;x++)expected.add(supportKey([x,half]));
    if(actual.size===expected.size&&[...actual].every(k=>expected.has(k)))candidates.push({point:{x:left+half,y:top+half},entity_ref:e.id,signature:e.signature});
  }return candidates.length===1?candidates[0]!:null;
}
export const animatedAuthorization=(p:R):string=>symbolicDigest(Object.fromEntries(['proposal_id','animated_contact_plan','actions','facts','binding','question'].map(k=>[k,p[k]])));

export class AnimatedContactAccess{
  arc_events:R[]=[];arc_pending:R|null=null;readonly rules:R;
  constructor(rules:R=defaultRules){this.rules=clone(rules);}
  retainedDigest():string{return symbolicDigest([null,this.arc_events]);}
  applyEvent(e:R):void{if(e.kind==='measured_animated_contact'){this.arc_events.push(e);return;}throw new TypeError('Unknown animation event');}
  proposeGraph(o:R,rows:NativeRows,_inputs:readonly R[],_limit:number,config:R):R|null{
    const cfg=config.animated_contact_question,available=new Set<string>(o.available_action_refs);if(!cfg||!Object.keys(cfg).length||!available.has('ACTION6'))return null;
    const current=this.arc_events.filter(e=>e.epoch===o.level_epoch);let point:R|null=null,scalarAction:string|null=null,evidence=[o.observation_ref],facts:R={},mode='invitation',why=cfg.invitation_question;
    if(current.length&&current.at(-1)!.after_rows_digest===symbolicDigest(rows)){
      const last=current.at(-1)!,measured=last.measurement;evidence.push(...last.evidence);
      for(const currentMode of['contact_solution','curve_disclosure']){mode=currentMode;const key='ballistic_'+mode;if(!measured[key+'_present'])continue;point={x:measured[key+'_column'],y:measured[key+'_row']};const command={action_ref:'ACTION6',data:point},used=current.filter(e=>supportSame(e.command,command)).length;
        facts={...measured,['candidate_is_'+key]:true,interaction_measurement_kind:'point',attempted_without_effect_in_current_context:false,tested_before_without_resolution_plan:used>0,candidate_execution_count:used};const rule=this.rules['projection.exploration.'+key];
        if(rule.all_conditions.every((c:R)=>c.operator==='equals'&&supportSame(facts[c.field]??null,c.expected))){why=cfg[mode+'_question'];evidence.push(rule.id);break;}point=null;
      }
    }else if(!current.length){const invitation=animatedCrossInvitation(o);if(invitation){point=invitation.point;facts={unique_symmetric_cross_invitation:true,current_occurrence:invitation.entity_ref,physical_role:'unknown'};}
      else for(const event of[...this.arc_events].reverse()){if(!event.model)continue;const projected=projectTransientCurve(event.model,rows);if(projected.status!=='measured')continue;
        for(const currentMode of['contact_solution','curve_disclosure']){mode=currentMode;const target=projected[mode];if(target==null)continue;point={x:target[1],y:target[0]};why=cfg.recall_question;facts={current_relocated_curve_hypothesis:projected};evidence.push(...event.evidence);break;}break;
      }
    }
    const models=[...this.arc_events].reverse().filter(e=>e.model).map(e=>e.model);
    if(point===null&&current.length){const fill=measureScalarFillDisplay(rows);for(const model of models){const projected=projectTransientCurve(model,rows);if(projected.status!=='measured'||!projected.contact_solution)continue;const target=projected.contact_solution,candidate={action_ref:'ACTION6',data:{x:target[1],y:target[0]}};
        if(current.some(e=>supportSame(e.command,candidate)&&(e.scalar_before??{}).scalar_fill_count===fill.scalar_fill_count))continue;point=candidate.data;mode='contact_solution';why=cfg.recall_question;facts={current_relocated_curve_hypothesis:projected,retained_peer_binding:model.peer_binding??'current_measured_peer'};evidence.push(...model.evidence);break;
      }
    }
    if(models.length&&(point===null||mode==='curve_disclosure')){
      const compatible=models.find(m=>transientCalibration(m,rows)!==null);
      if(compatible){const fill=measureScalarFillDisplay(rows),count=fill.scalar_fill_count,base=compatible.fill.scalar_fill_count,scalar=this.arc_events.filter(e=>e.scalar_change!=null),increases=scalar.filter(e=>e.scalar_change>0&&available.has(e.command.action_ref));
        if(Number.isInteger(count)&&Number.isInteger(base)&&fill.scalar_fill_display_present){
          if(current.length&&current.at(-1)!.mode==='scalar_experiment'&&count>base){point=transientCalibration(compatible,rows);mode='parameter_contrast';why=cfg.parameter_contrast_question;facts={current_scalar_fill:count,previous_measured_fill:base,retained_model_ref:compatible.model_ref,same_relative_aim_revalidated:true};evidence.push(...compatible.evidence);}
          else if(mode!=='contact_solution'){const tried=new Set(scalar.map(e=>e.command.action_ref)),unknown=[...available].filter(a=>a!=='ACTION6'&&!tried.has(a)).sort();scalarAction=increases.length?increases.at(-1)!.command.action_ref:unknown[0]??null;
            if(scalarAction){point=null;mode='scalar_experiment';why=cfg.parameter_question;facts={current_scalar_fill:count,no_current_fitted_contact:true,control_status:increases.length?'conditionally_recalled_increase':'unknown_input_effect',retained_model_ref:compatible.model_ref,alternatives_remaining:unknown};evidence.push(...compatible.evidence);}
          }
        }
      }else if(!current.some(e=>e.mode==='relocated_source_question')){const hypotheses=models.map(m=>[m,transientSourceRoleProbe(m,rows)]).filter(([,h])=>h!==null);if(hypotheses.length){const[model,hypothesis]=hypotheses[0]!;point=hypothesis!.point;mode='relocated_source_question';why=cfg.source_role_question;facts={current_source_role_hypothesis:hypothesis,role_confirmed:false};evidence.push(...model!.evidence);}}
    }
    if(point===null&&scalarAction===null)return this.arc_events.length?{status:'unknown',block_unrelated_probe:true,reason:'measured_contact_continuation_requires_current_evidence'}:null;
    const command=scalarAction?{action_ref:scalarAction}:{action_ref:'ACTION6',data:point},ref='animated-contact:'+symbolicDigest([o.observation_ref,mode,command]),plan={epoch:o.level_epoch,score:o.levels_completed,observation_ref:o.observation_ref,frame_digest:symbolicDigest(rows),command,mode};
    return{status:'proposed',kind:'measured_animated_contact',proposal_id:ref,animated_contact_plan:plan,actions:[command],steps:[{action:command,expected_after:null}],facts,compositions:[{id:ref,observed:false,open_question:why,properties:{roles:[mode==='invitation'?'current point invitation':'conditionally fitted transient contact']},relations:['contributes_to:G_official_completion']}],question:{reason:why,hypothesis_refs:evidence},route_refs:evidence,binding:{level_epoch:o.level_epoch,observation_ref:o.observation_ref},bundle_template:{operation_key:'OP18',composition_ref:ref,objective_ref:'G_official_completion',preserve_refs:[],actions:[command],purpose:why,preconditions:facts,evidence,outcome_guard:{path:['value'],contains:ref}}};
  }
  before(p:R,index:number,rows:NativeRows,meta:R):NativeBeforeResult{
    if(!('animated_contact_plan'in p))return{admitted:false,reason:'not_animation_question'};const plan=p.animated_contact_plan;
    const ok=index===0&&supportSame([meta.epoch,meta.score,meta.observation_ref],[plan.epoch,plan.score,plan.observation_ref])&&symbolicDigest(rows)===plan.frame_digest&&supportSame(p.actions,[plan.command])&&supportSame([plan.command],p.bundle_template.actions)&&meta.available.includes(plan.command.action_ref)&&p.proposal_id==='animated-contact:'+symbolicDigest([plan.observation_ref,plan.mode,plan.command]);
    return{admitted:ok,reason:ok?'current_animation_question_bound':'animation_question_context_changed'};
  }
  after(p:R,_index:number,_rows:NativeRows,_later:NativeRows):NativeAfterResult{return{matched:null,seal_prefix:true,reason:'animated_contact_plan'in p?'public_animation_requires_reconciliation':'not_animation_question'};}
  record(before:R,command:R,after:R,rows:NativeRows,later:NativeRows,proposal:R,_index:number):R[]{if('animated_contact_plan'in proposal)this.arc_pending={before,after,command,rows,later,mode:proposal.animated_contact_plan.mode};return[];}
  recordPacket(before:R,command:R,after:R,rows:NativeRows,frames:readonly NativeRows[],_episode:unknown):R[]{
    const pending=this.arc_pending;if(!pending||pending.before.observation_ref!==before.observation_ref)return[];this.arc_pending=null;let measurement:R={},intermediate:readonly NativeRows[]=[];
    if(before.level_epoch===after.level_epoch){intermediate=frames.length&&supportSame(frames.at(-1),pending.later)?frames.slice(0,-1):frames;measurement=orderedTransientComponentPathFacts(rows,intermediate,pending.later,command.action_ref,command.data??{});}
    const evidence=[before.observation_ref,after.observation_ref],model=Object.keys(measurement).length?acquireTransientCurve(rows,intermediate,measurement,before.level_epoch,evidence,command,this.arc_events.filter(e=>e.model).map(e=>e.model)):null;
    const firstFill=measureScalarFillDisplay(rows),lastFill=measureScalarFillDisplay(pending.later);let scalarChange:number|null=null;
    if(pending.mode==='scalar_experiment'&&before.level_epoch===after.level_epoch&&firstFill.scalar_fill_display_present&&lastFill.scalar_fill_display_present)scalarChange=lastFill.scalar_fill_count-firstFill.scalar_fill_count;
    const e={kind:'measured_animated_contact',epoch:before.level_epoch,command,mode:pending.mode,evidence,packet_frames:frames.length,measurement,model,scalar_before:firstFill,scalar_after:lastFill,scalar_change:scalarChange,after_rows_digest:symbolicDigest(pending.later),boundary:before.level_epoch!==after.level_epoch,scope:'Ordered public raster measurement and provisional contact/disclosure calculus; no complete or universal physics asserted.'};this.arc_events.push(e);return[e];
  }
}

export class AnimatedContact implements NativeFamily<any>{
  readonly id='animated_contact';readonly mechanism:AnimatedContactAccess;readonly policy:R;authorized:R={};
  constructor(policy:R=frontierPolicy.animated_contact_question,rules:R=defaultRules){this.policy=clone(policy);this.mechanism=new AnimatedContactAccess(rules);}
  async propose(obs:R,rows:NativeRows,inputs:readonly R[],remaining:number):Promise<any|null>{
    if(remaining<1)return null;const p=this.mechanism.proposeGraph(obs,rows,inputs,Math.min(remaining,16),{animated_contact_question:this.policy});if(!p||p.status!=='proposed')return p;
    p.support_plan={animated_contact:true};p.binding.levels_completed=obs.levels_completed;p.binding.frame_hash=obs.frame_hash;const command=p.actions[0];
    if(command.data&&Object.keys(command.data).length)p.steps[0].locus_witness=await ObservedInputDomain.makeLocusWitness(obs as NativeObservation,rows,[command.data.x,command.data.y],{reason:p.question.reason,evidence:p.route_refs});
    this.authorized={[p.proposal_id]:animatedAuthorization(p)};return p;
  }
  bind(p:R):void{for(const step of p.steps??[])if(step.locus_witness)step.point_binding=step.locus_witness;}
  before(p:R,index:number,packet:R,obs:R):NativeBeforeResult{
    if(!p.support_plan?.animated_contact||this.authorized[p.proposal_id]!==animatedAuthorization(p))return{admitted:false,reason:'animation_authorized_question_changed'};
    if(packet.frame_hash!==p.binding.frame_hash||obs.frame_hash!==p.binding.frame_hash)return{admitted:false,reason:'animation_frame_changed'};
    if(p.steps.length!==1||!supportSame(p.steps[0].action,p.actions[0]))return{admitted:false,reason:'animation_step_payload_changed'};
    return this.mechanism.before(p,index,packet.frame_rows,{epoch:packet.level,score:packet.levels_completed,observation_ref:obs.observation_ref,available:packet.available_action_refs});
  }
  after(p:R,index:number,_before:R,_after:R,first:NativeRows,second:NativeRows):NativeAfterResult{return this.mechanism.after(p,index,first,second);}
  record(before:R,after:R,command:R,first:NativeRows,second:NativeRows,proposal?:R,index?:number,frames:readonly NativeRows[]=[]):NativeRecordResult{
    if(!proposal?.support_plan?.animated_contact)return{events:[]};if(index!==0||!supportSame(command,proposal.actions[0]))throw new TypeError('Animation response has another command');
    this.mechanism.record(before,command,after,first,second,proposal,index);const events=this.mechanism.recordPacket(before,command,after,first,frames.length?frames:[second],null);this.authorized={};return{events};
  }
  state():NativeRecord{return clone({format:'animated_contact.v1',events:this.mechanism.arc_events,authorized:this.authorized});}
  restore(state:NativeRecord):void{const s=clone(state) as R;if(s.format!=='animated_contact.v1'||!supportSame(Object.keys(s).sort(),['authorized','events','format']))throw new TypeError('Incomplete animation memory');this.mechanism.arc_events=s.events;this.mechanism.arc_pending=null;this.authorized=s.authorized;}
}
