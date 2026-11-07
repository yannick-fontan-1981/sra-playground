/** Native transfer of attention_memory.py: scoped questions and observed returns. */
import { digest } from './canonical.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeReasoningMemory } from './v6-reasoning-memory.ts';
type R = Record<string, any>;

export class AttentionMemory {
  item: R | null = null;
  composition: R | null = null;
  readonly memory: Pick<NativeReasoningMemory, 'get' | 'put'> | null;
  readonly episode: string | null;
  constructor(memory: Pick<NativeReasoningMemory, 'get' | 'put'> | null = null, episode: string | null = null) {
    this.memory = memory; this.episode = episode;
    if (memory !== null) {
      try { this.item = memory.get(episode!, 'attention').value; } catch (error) { if (!(error instanceof RangeError)) throw error; }
      try { this.composition = memory.get(episode!, 'attention_composition').value; } catch (error) { if (!(error instanceof RangeError)) throw error; }
    }
  }
  private save(item: R, obs: R): R {
    this.memory?.put(this.episode!, 'attention', item, obs.observation_ref, obs.revision); this.item = item; return item;
  }
  async open(question: R, obs: R): Promise<R | null> {
    if (question.observation_ref !== obs.observation_ref || !truth(question.expected_motion)) return null;
    if (this.item?.status === 'pending') return this.matches(question, obs) ? this.item : null;
    const scope = [obs.level_epoch, obs.observation_ref, question.pair_ref, question.action_ref, question.experiment];
    return this.save({ id: (await digest(scope)).slice(0, 20), status: 'pending', level_epoch: scope[0], opened_at: scope[1], parent: 'alignment_of_homologous_patterns',
      pair_ref: scope[2], action_ref: scope[3], experiment: scope[4], question: question.objective, why_now: 'independent_origin_with_unbound_return',
      expected_motion: question.expected_motion, evidence: question.evidence, release_authority: false }, obs);
  }
  matches(question: R, obs: R): boolean {
    const item = this.item;
    return !!item && item.status === 'pending' && item.level_epoch === obs.level_epoch && item.opened_at === obs.observation_ref && obs.observation_ref === question.observation_ref &&
      item.action_ref === question.action_ref && item.pair_ref === question.pair_ref && item.experiment === question.experiment && same(item.expected_motion, question.expected_motion);
  }
  revalidate(obs: R): void {
    if (this.item?.status === 'pending' && (this.item.level_epoch !== obs.level_epoch || this.item.opened_at !== obs.observation_ref)) this.save({ ...this.item, status: 'expired', reason: 'scope_or_observation_changed' }, obs);
  }
  observe(before: R, after: R, command: R, focusId: string | null): R | null {
    const item = this.item; if (!item || item.status !== 'pending') return null;
    let status: string;
    if (item.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || ['WIN', 'GAME_OVER'].includes(after.state)) status = 'boundary';
    else if (item.opened_at !== before.observation_ref || !same(command, { action_ref: item.action_ref }) || focusId !== item.id) status = 'superseded';
    else {
      const positions = (obs: R): Record<string, number[]> => Object.fromEntries(obs.entities.filter((e: R) => !e.identity_ambiguous).map((e: R) => [e.signature, e.bbox]));
      const old = positions(before), current = positions(after);
      const anchorMap = new Map<string, number[]>();
      for (const [key, box] of Object.entries(old)) if (same(current[key], box)) anchorMap.set(JSON.stringify(box.slice(0, 2)), box.slice(0, 2));
      const anchors = [...anchorMap.values()].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
      let aligned = false;
      if (anchors.length >= 3) {
        const a = anchors[0]!, b = anchors[1]!;
        aligned = anchors.slice(2).some(([x, y]) => (b[0]! - a[0]!) * (y! - a[1]!) !== (b[1]! - a[1]!) * (x! - a[0]!));
      }
      status = 'matched';
      for (const [signature, delta] of Object.entries(item.expected_motion) as [string, number[]][]) {
        if (!aligned || !Object.hasOwn(old, signature) || !Object.hasOwn(current, signature)) { status = 'unobserved'; break; }
        if (old[signature]!.length !== current[signature]!.length) throw new TypeError('Motion bounding boxes differ in length');
        if (!same(old[signature]!.map((u, i) => current[signature]![i]! - u), [...delta, ...delta])) { status = 'contradicted'; break; }
      }
    }
    return this.save({ ...item, status, returned_at: after.observation_ref }, after);
  }
  takeParentReturn(obs: R): R | null {
    const item = this.item; if (!item || !['matched', 'contradicted', 'unobserved'].includes(item.status)) return null;
    const current = item.level_epoch === obs.level_epoch && item.returned_at === obs.observation_ref;
    this.save({ ...item, status: current ? 'returned' : 'expired', result: item.status }, obs); return current ? item : null;
  }
  closePending(obs: R, reason: string): R | null {
    return this.item?.status === 'pending' ? this.save({ ...this.item, status: 'interrupted', reason }, obs) : null;
  }
  private saveComposition(item: R, obs: R): R {
    this.memory?.put(this.episode!, 'attention_composition', item, obs.observation_ref, obs.revision); this.composition = item; return item;
  }
  compositionFor(owner: string, obs: R): R | null {
    const item = this.composition; if (!item || item.status !== 'pending') return null;
    if (item.level_epoch !== obs.level_epoch) { this.saveComposition({ ...item, status: 'boundary', returned_at: obs.observation_ref }, obs); return null; }
    return item.owner === owner ? item : null;
  }
  async retainComposition(owner: string, targetRef: string, question: string, evidence: readonly string[], obs: R, binding: R | null = null): Promise<R | null> {
    const current = this.compositionFor(owner, obs);
    if (current) return current.target_ref === targetRef ? current : null;
    if (this.composition?.status === 'pending' || !truth(targetRef) || !evidence.includes(obs.observation_ref)) return null;
    return this.saveComposition({ id: `composition_attention:${(await digest([owner, obs.level_epoch, targetRef])).slice(0, 20)}`, owner, target_ref: targetRef, question, status: 'pending', level_epoch: obs.level_epoch,
      opened_at: obs.observation_ref, evidence: [...new Set(evidence)], release_authority: false, current_revalidation_required: true, binding }, obs);
  }
  returnComposition(owner: string, targetRef: string, status: string, evidence: readonly string[], obs: R): R | null {
    const item = this.composition;
    if (!item || item.status !== 'pending' || item.owner !== owner || item.target_ref !== targetRef) return null;
    if (!['achieved', 'refuted', 'boundary'].includes(status) || !evidence.includes(obs.observation_ref)) return null;
    if (status !== 'boundary' && item.level_epoch !== obs.level_epoch) return null;
    return this.saveComposition({ ...item, status, returned_at: obs.observation_ref, return_evidence: [...new Set(evidence)] }, obs);
  }
  state(): R { return structuredClone({ item: this.item, composition: this.composition }); }
  restore(state: R): void { this.item = structuredClone(state.item ?? null); this.composition = structuredClone(state.composition ?? null); }
}
