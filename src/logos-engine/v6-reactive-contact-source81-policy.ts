/** Source81 declarations, executed by the native common SRC interpreter. */
import { NativeDrmRegistry, projectDeclaredAlternatives, declaredEligibilityMatches } from './v6-drm-projector.ts';
import { createDrmSelectPrimitive } from './v6-drm-selection.ts';
import { NativeSrcProgram, V6_DECLARATIVE_SOURCES } from './v6-src-program.ts';
import type { NativeLoadedDrm } from './v6-drm-projector.ts';
import type { NativeProgramHandle, NativeProgramRegistry } from './v6-native-types.ts';
import type { Primitive, JsonObject } from './ir.ts';
type R=Record<string,any>;
const POLICY='policy.prepare_observed_peer_composition_access',PUBLICATION='schema.source81_publication',SCOPE='schema.source81_scope';
const BASE='agents/yf_arc3_v6/morphology_policy/reactive_contact/';
const clone=<T>(v:T):T=>structuredClone(v);
const unique=(v:string[]):string[]=>[...new Set(v)];
export class Source81Policy {
  readonly drm:NativeDrmRegistry;readonly registry:NativeDrmRegistry;
  readonly loaded:NativeLoadedDrm;readonly continuation_loaded:NativeLoadedDrm;readonly context_loaded:NativeLoadedDrm;readonly revision_loaded:NativeLoadedDrm;
  private callbacks:Record<string,Primitive>;
  private programs:Record<string,NativeProgramHandle>={};
  private constructor(drm:NativeDrmRegistry,loaded:NativeLoadedDrm[]){
    this.drm=this.registry=drm;[this.loaded,this.continuation_loaded,this.context_loaded,this.revision_loaded]=loaded as [NativeLoadedDrm,NativeLoadedDrm,NativeLoadedDrm,NativeLoadedDrm];
    this.callbacks={
      'source81.project_candidates':args=>this.candidates(args.request as R),
      'source81.finish_selection':args=>this.finish(args.request as R,args.measured as R,args.assessment as R),
      'source81.abstain':args=>this.abstain(args.measured as R),
      'source81.publish_continuation':args=>this.publishContinuation(args.request as R),
      'source81.publish_target_revision':args=>this.publishTargetRevision(args.request as R),
      'source81.publish':args=>this.publish(args.request as R),
      [POLICY]:createDrmSelectPrimitive(drm,POLICY),
    };
  }
  static async create():Promise<Source81Policy>{
    const drm=new NativeDrmRegistry(),loaded:NativeLoadedDrm[]=[];
    for(const file of ['source81-declarations.drm','source81-continuation.drm','source81-publication-context.drm','source81-target-revision.drm']){const source=(V6_DECLARATIVE_SOURCES as R)[BASE+file];if(!source)throw new Error('Missing Source81 declaration '+file);loaded.push(await drm.registerSource(source.text,source.sha256));}drm.seal();const p=new Source81Policy(drm,loaded);
    for(const name of ['prepare','project','continue_target','revise_target'])p.programs[name]=await NativeSrcProgram.create('v6.source81.'+name,p.callbacks);return p;
  }
  async attachPrograms(registry:NativeProgramRegistry):Promise<void>{for(const name of ['prepare','project','continue_target','revise_target'])this.programs[name]=await registry.registerProgram('v6.source81.'+name,this.callbacks);}
  private projection(policy:string,refs:string[],facts:R):R{return projectDeclaredAlternatives({drm:this.drm,selection_policy_ref:policy,alternative_refs:refs,descriptive_facts:facts});}
  candidates(request:R):R{
    const common=request.question_facts,raw:R={};
    for(const row of request.rows){const ref=row.alternative_ref??row.candidate_ref;if(Object.hasOwn(raw,ref))throw new Error('duplicate Source81 alternative');const facts={...clone(row),...clone(common),alternative_ref:ref};facts.current_identity_binding=common.current_identity_binding===true&&common.parent_peer_component_ref!=null&&row.peer_component_ref===common.parent_peer_component_ref;const cost=facts.total_primitive_distance,remaining=common.remaining_budget;facts.within_remaining_budget=Number.isSafeInteger(cost)&&typeof cost==='number'&&Number.isSafeInteger(remaining)&&typeof remaining==='number'&&0<=cost&&cost<=remaining;raw[ref]=facts;}
    if(!Object.keys(raw).length)raw['source81.empty_inventory']={empty_source81_inventory:true,within_remaining_budget:false,current_identity_binding:false};
    const projected=this.projection(POLICY,Object.keys(raw),raw),scoped=this.projection(SCOPE,Object.keys(raw),projected.alternative_facts),[declaration]=this.drm.resolve(POLICY),eligible=Object.values(scoped.alternative_facts).some(facts=>declaredEligibilityMatches(facts as JsonObject,declaration));return{...scoped,projection_refs:unique([...projected.projection_refs,...scoped.projection_refs]),goal_ref:common.question_ref,has_eligible:eligible};
  }
  abstain(measured:R):R{return{status:'abstain',reason:'no_declared_current_composition_within_physical_budget',projection_refs:measured.projection_refs,release_authority:false};}
  finish(request:R,measured:R,assessment:R):R{
    const selected=assessment.alternatives?.selected;if(!selected)return{status:'abstain',assessment,projection_refs:measured.projection_refs,release_authority:false};const rows=Object.fromEntries(request.rows.map((r:R)=>[r.alternative_ref??r.candidate_ref,r]));if(!rows[selected])throw new Error('SELECT returned an undeclared Source81 candidate');return{status:'selected',selected_ref:selected,selected_row:{...clone(rows[selected]),facts:measured.alternative_facts[selected]},projection_refs:measured.projection_refs,assessment,policy_ref:POLICY,drm_hash:this.loaded.source_hash,conditional_scope:'stationary_or_one_cell_responses_not_a_complete_acquired_response_law',release_authority:false};
  }
  publish(request:R):R{
    const ref=request.alternative_ref??'source81.current_candidate',contextual=this.projection('schema.source81_current_publication_context',[ref],request),projected=this.projection(PUBLICATION,[ref],contextual.alternative_facts[ref]),facts=projected.alternative_facts[ref];return{status:projected.projection_refs.length?'projected':'abstain',facts,projected:facts,projection_refs:projected.projection_refs,drm_hash:this.loaded.source_hash,release_authority:false,context_projection_refs:contextual.projection_refs,context_drm_hash:this.context_loaded.source_hash};
  }
  publishContinuation(request:R):R{const ref=request.alternative_ref??'source81.retained_target',out=this.projection('policy.v6_source81_continuation',[ref],request),facts=out.alternative_facts[ref];return{status:facts.source81_continuation_eligible===true?'continuation':'abstain',facts,projected:facts,projection_refs:out.projection_refs,drm_hash:this.continuation_loaded.source_hash,release_authority:false,qualification_scope:'V6 continuity adaptation; current guards required; no new physics'};}
  publishTargetRevision(request:R):R{const ref=request.old_target_ref??'source81.no_retained_target',out=this.projection('policy.v6_source81_target_revision',[ref],request),facts=out.alternative_facts[ref];return{status:facts.target_revision_admitted===true?'revision':'abstain',facts,projection_refs:out.projection_refs,drm_hash:this.revision_loaded.source_hash,release_authority:false};}
  private async run(name:string,request:R):Promise<readonly[R,any]>{const{result,receipt}=await this.programs[name]!.run({request});return[result as R,{workflow:receipt.workflow,src_hash:receipt.src_hash,src_status:receipt.src_status,executed_statements:clone(receipt.executed_statements)}];}
  async prepare(rows:R[],question_facts:R):Promise<readonly[R,any]>{return this.run('prepare',{rows,question_facts});}
  async project(facts:R):Promise<readonly[R,any]>{return this.run('project',facts);}
  async continue_target(facts:R):Promise<readonly[R,any]>{return this.run('continue_target',facts);}
  async revise_target(facts:R):Promise<readonly[R,any]>{return this.run('revise_target',facts);}
}
