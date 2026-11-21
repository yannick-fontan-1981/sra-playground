import { symbolicDigest } from '../logos-engine/v6-hash.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeObservation, NativeProposal, NativeRows } from '../logos-engine/v6-native-types.ts';
import { exemplarPlans } from './field-exemplars.ts';
import { fieldObligationPlans, fulfillsSite, siteValue, type SiteObligation } from './field-obligations.ts';
import { sicNeedId } from './need-identity.ts';
import learned from './source-field-relations.json' with { type: 'json' };

export const fieldGroup = 'compose_relations_from_visible_fields';
export const sourceFieldRelations = learned.rules;
type Layout = { origin: string; cues: NativeBox[]; examples: NativeBox[]; obligations: SiteObligation[] };
export type FieldForecast = Layout & { target: SiteObligation; before: number; held: SiteObligation[]; key: string };
type FieldOffer = NativeProposal & {context:string;trigger:string;goal:null;needId:string;fieldForecast:FieldForecast};
const measured = new WeakMap<NativeObservation,Layout[]>();
function layouts(o: NativeObservation, rows: NativeRows): Layout[] {
  const cached = measured.get(o);
  if (cached) return cached;
  const local = exemplarPlans(rows,o.entities).map(p => ({origin:'current_examples', cues:[p.cue], examples:p.samples,
    obligations:p.assignments.map(c => ({box:c.box,equal:[c.desired],different:[]}))}));
  const transferred = fieldObligationPlans(rows,o.entities,sourceFieldRelations).map(p => ({
    origin:'learned_relative_layout', cues:p.cues, examples:[], obligations:p.obligations}));
  const plans = [...local,...transferred];
  measured.set(o,plans);
  return plans;
}

function changedPatch(first: NativeRows, second: NativeRows, box: NativeBox): boolean {
  for (let y=box[1];y<=box[3];y++) for (let x=box[0];x<=box[2];x++) if (first[y]?.[x] !== second[y]?.[x]) return true;
  return false;
}
export function fieldMatches(f: FieldForecast,first: NativeRows,next: NativeRows): boolean {
  return fulfillsSite(siteValue(next,f.target.box),f.target) && f.held.every(s => fulfillsSite(siteValue(next,s.box),s))
    && [...f.cues,...f.examples].every(box => !changedPatch(first,next,box));
}

export async function proposeFieldComposition(family:string, o:NativeObservation, rows:NativeRows, rejected:readonly string[]):Promise<FieldOffer|null> {
  if (!o.available_action_refs.includes('ACTION6')) return null;
  for (const plan of layouts(o,rows)) {
    const held = plan.obligations.filter(site => fulfillsSite(siteValue(rows,site.box),site));
    const identity = symbolicDigest([plan.cues,plan.obligations]);
    for (const target of plan.obligations) {
      const before = siteValue(rows,target.box);
      if (before === null || fulfillsSite(before,target)) continue;
      const key = symbolicDigest([identity,target,before]);
      if (rejected.includes(key)) continue;
      const ref = o.observation_ref, evidence = [ref], parent = 'G_official_completion';
      const label = 'Satisfy a remaining field relation while preserving the compatible sites and visible examples';
      const question = {kind:'test_observed_composition',scope:ref.split(':revision:',1)[0]!,
        subjects:[identity,target.box.join()],parentObjective:parent,satisfactionContract:'requested_site_relation_and_earlier_relations_hold'};
      const need = {...question,id:sicNeedId(question),status:'assigned',evidence};
      const [l,t,r,b] = target.box, x = Math.floor((l+r)/2), y = Math.floor((t+b)/2);
      const command = {action_ref:'ACTION6',data:{x,y}};
      const witness = await ObservedInputDomain.makeLocusWitness(o,rows,[x,y],{reason:label,evidence});
      const keepId = 'held_field_relations_'+symbolicDigest([identity,held]);
      const current = {cues:plan.cues,examples:plan.examples,sites:held};
      return {
        kind:family,status:'proposed',actions:[command],goal:null,context:identity,trigger:fieldGroup,needId:need.id,
        fieldForecast:{...plan,target,before,held,key},
        steps:[{action:command,expected_after:{site:target,held},point_binding:witness}],
        binding:{observation_ref:ref,level_epoch:o.level_epoch},
        sicSituationCard:{strategy:'test_composition',need:label,mode:'exploration',situation:label,evidence,agenda:[],trigger:fieldGroup},
        compositions:[{id:need.id,observed:false,open_question:label,relations:['contributes_to:'+parent]},
          {id:keepId,observed:true,role:'preserved_condition',properties:current,relations:['contributes_to:'+parent]}],
        question:{reason:label,hypothesis_refs:evidence},route_refs:evidence,
        sicLocalDecision:{strategy:'test_composition',objective:{id:need.id,label,parent},need},
        bundle_template:{operation_key:'OP18',composition_ref:need.id,objective_ref:parent,purpose:label,evidence,preconditions:{},
          preserve_refs:[keepId],preservation_evidence:{[keepId]:{observation_ref:ref,witness_refs:evidence,current_condition_measure:current}},
          actions:[command],outcome_guard:{path:['value'],contains:need.id}},
      };
    }
  }
  return null;
}
