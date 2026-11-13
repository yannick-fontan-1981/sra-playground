import type { PublicObservationLike } from './linked-preparation.ts';
import { FieldStock, filled, type RetainedAddressedFieldPrior } from './field-stock.ts';

export interface RetentionModel {
  action_ref: string;
  palette: number;
  size: readonly [number, number];
  offset: readonly [number, number];
  exemplar: { bbox: readonly [number, number, number, number] };
  goal: { enclosure: { bbox: readonly [number, number, number, number]; mask: readonly (readonly [number, number])[] } };
  [key: string]: unknown;
}
export interface RetentionSample { moved_to_anchor: boolean; [key: string]: unknown }
export interface AddressedFieldRetentionState {
  epoch: number | null; model: RetentionModel | null; samples: RetentionSample[];
  indicator: Record<string, unknown> | null; lowerSquared: number; upperSquared: number | null;
  calibration: 'different_offset' | 'outside_indicator' | 'indicator_edge' | 'navigation';
  events: Array<Record<string, unknown>>; passed: Array<{ score: number; evidence: string }>;
  prior: RetainedAddressedFieldPrior | null; stock: FieldStock | null;
}
export function createAddressedFieldRetentionState(): AddressedFieldRetentionState {
  return { epoch:null, model:null, samples:[], indicator:null, lowerSquared:0, upperSquared:null,
    calibration:'different_offset', events:[], passed:[], prior:null, stock:null };
}
export function ensureFieldStock(state: AddressedFieldRetentionState, observation: PublicObservationLike, rows: readonly (readonly number[])[]): FieldStock | null {
  if (state.model === null && state.prior && state.stock === null) state.stock = FieldStock.create(state.prior, observation, rows);
  return state.stock;
}
function buildPriorFromModel(state: AddressedFieldRetentionState, boundary: string): RetainedAddressedFieldPrior | null {
  const model=state.model; if (!model) return null;
  const enclosure=model.goal.enclosure; const [left,top,right,bottom]=enclosure.bbox;
  const size=[right-left+1,bottom-top+1] as const;
  const envelope=[...filled(enclosure.mask,size[0],size[1])].map(item=>item.split(',').map(Number) as [number,number]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  return { action_ref:model.action_ref, lower_squared:state.lowerSquared, upper_squared:state.upperSquared, boundary,
    request_row:Math.floor((model.exemplar.bbox[1]+model.exemplar.bbox[3])/2), goal_region:{size,envelope},
    class_templates:{[String(model.palette)]:{size:model.size,offset:model.offset,
      mask:(model.mask ?? []) as readonly (readonly [number,number])[],
      alignment_supported:state.samples.filter(sample=>sample.moved_to_anchor).length>=2}},
    qualification:'retained local hypothesis; new occurrence and field require revalidation' };
}
function resetActiveEpoch(state: AddressedFieldRetentionState, epoch:number): void {
  state.model=null; state.stock=null; state.epoch=epoch; state.samples=[]; state.indicator=null;
  state.lowerSquared=0; state.upperSquared=null; state.calibration='different_offset';
}
export function crossAddressedFieldBoundary(state: AddressedFieldRetentionState, before: PublicObservationLike, after: PublicObservationLike): {crossed:boolean;officialBoundary?:number} {
  const changed=before.level_epoch!==after.level_epoch||before.levels_completed!==after.levels_completed;
  if(!changed) return {crossed:false};
  if(after.levels_completed>before.levels_completed){
    if(state.stock){ state.prior=state.stock.retained(after.observation_ref); state.passed.push({score:after.levels_completed,evidence:after.observation_ref}); }
    else if(state.model){ state.passed.push({score:after.levels_completed,evidence:after.observation_ref}); state.prior=buildPriorFromModel(state,after.observation_ref); }
  }
  resetActiveEpoch(state,after.level_epoch);
  return {crossed:true,officialBoundary:after.levels_completed};
}
