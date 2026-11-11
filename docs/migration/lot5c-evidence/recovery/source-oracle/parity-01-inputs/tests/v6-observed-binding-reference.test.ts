/** New recovery expectations come only from immutable original Python.
 * The original source tracker, native checkpoint, and shared attention memory
 * are three distinct contracts. No expected state seeds an acquired owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { ObservedBinding, locate } from '../src/logos-engine/v6-observed-binding.ts';
import { BindingTracker, corner_contradiction } from '../src/logos-engine/v6-object-binding-tracker.ts';
import * as geometry from '../src/logos-engine/v6-object-binding-geometry.ts';
import * as identity from '../src/logos-engine/v6-object-binding-identity.ts';
import * as reception from '../src/logos-engine/v6-object-binding-reception.ts';
import * as planning from '../src/logos-engine/v6-object-binding-planning.ts';
import { AttentionMemory } from '../src/logos-engine/v6-attention-memory.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-observed-binding-reference.json.gz', import.meta.url))).toString());
const fields = ['epoch', 'core', 'moves', 'tried', 'blocked', 'held', 'interaction', 'methods', 'events', 'failed',
  'goal_evidence', 'correspondence_context', 'context_refutations', 'pending_reception', 'reception_receipts', 'observed_frames'];
const clone = <T>(value: T): T => structuredClone(value);
function normalized(value: any): any {
  if (value instanceof Set) return [...value].map(item => typeof item === 'string' ? JSON.parse(item) : item)
    .sort((a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]!);
  if (Array.isArray(value)) return value.map(normalized);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalized(item)]));
  return value;
}
function difference(a: any, b: any, path = '$'): string | null {
  if (Object.is(a, b)) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object')
    return `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return path + ': array/object differs';
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}: length ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i++) { const found = difference(a[i], b[i], `${path}[${i}]`); if (found) return found; }
    return null;
  }
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
  if (JSON.stringify(ak) !== JSON.stringify(bk)) return `${path}: keys ${JSON.stringify(ak)} !== ${JSON.stringify(bk)}`;
  for (const key of ak) { const found = difference(a[key], b[key], path + '.' + key); if (found) return found; }
  return null;
}
function exact(actual: any, expected: any, context: string): void {
  const found = difference(actual === undefined ? null : normalized(actual), expected);
  assert.equal(found, null, context + (found ? ': ' + found : ''));
}
function stateOrder(actual: R, expected: R, context: string): void {
  for (const key of ['moves', 'observed_frames']) exact(Object.keys(actual[key]), Object.keys(expected[key]), context + ': ' + key + ' insertion order');
  if (expected.correspondence_context) exact(Object.keys(actual.correspondence_context.frames), Object.keys(expected.correspondence_context.frames), context + ': context frame order');
}

class PutMemory {
  readonly facts = new Map<string, R>();
  readonly puts: R[] = [];
  get(episode: string, key: string): R {
    const value = this.facts.get(JSON.stringify([episode, key]));
    if (!value) throw new RangeError('Missing attention fact');
    return clone(value);
  }
  put(episode: string, key: string, value: any, evidence: string, revision: number): void {
    const item = { value: clone(value), evidence, revision };
    this.facts.set(JSON.stringify([episode, key]), clone(item));
    this.puts.push({ episode, key, ...clone(item) });
  }
}
type Cursor = { owner: ObservedBinding; memory: PutMemory; attention: AttentionMemory; proposal: R | null; episode: string };
function fresh(episode: string): Cursor {
  const memory = new PutMemory();
  return { owner: new ObservedBinding(), memory, attention: new AttentionMemory(memory as any, episode), proposal: null, episode };
}
async function invoke(cursor: Cursor, operation: R): Promise<R> {
  const i = clone(operation.input), owner = cursor.owner;
  if (operation.useLatestSourceProposal) {
    assert.ok(cursor.proposal, 'The native caller must have computed its own preceding proposal');
    exact(cursor.proposal, i.proposal, 'Caller proposal matches the independently computed original');
    i.proposal = clone(cursor.proposal);
  }
  const sourceAttention: Record<string, (a: R) => any> = {
    open: a => cursor.attention.open(a.question, a.obs), matches: a => cursor.attention.matches(a.question, a.obs),
    revalidate: a => cursor.attention.revalidate(a.obs), observe: a => cursor.attention.observe(a.before, a.after, a.command, a.focus_id),
    take_parent_return: a => cursor.attention.takeParentReturn(a.obs), close_pending: a => cursor.attention.closePending(a.obs, a.reason),
    composition_for: a => cursor.attention.compositionFor(a.owner, a.obs),
    retain_composition: a => cursor.attention.retainComposition(a.owner, a.target_ref, a.question, a.evidence, a.obs, a.binding ?? null),
    return_composition: a => cursor.attention.returnComposition(a.owner, a.target_ref, a.status, a.evidence, a.obs),
  };
  if (operation.method.startsWith('attention.')) return { result: await sourceAttention[operation.method.slice(10)]!(i) };
  switch (operation.method) {
    case 'propose': {
      const result = await owner.proposeSource(i.obs, i.rows, i.inputs, i.remaining, cursor.attention);
      cursor.proposal = clone(result); return { result };
    }
    case 'record': return { result: await owner.recordSource(i.before, i.after, i.command, i.first, i.second, i.proposal, i.index ?? 0) };
    case 'bind': {
      const proposal = clone(i.proposal);
      const result = owner.bind(proposal as any, null as any);
      if (operation.useLatestSourceProposal) cursor.proposal = clone(proposal);
      return { result, proposalAfterBind: proposal };
    }
    case 'before': return { result: await owner.before(i.proposal, i.index, i.public, i.obs) };
    case 'after': return { result: await owner.after(i.proposal, i.index, i.before, i.after, i.first, i.second) };
    case 'restore': return { result: owner.restore(i.state) };
    case 'tracker.reset': return { result: owner.tracker.reset(i.epoch) };
    default: throw new Error('Unexecuted original operation: ' + operation.method);
  }
}
function restoreActual(cursor: Cursor, mode: 'source' | 'native'): void {
  const wasShared = cursor.owner.attention === cursor.attention;
  const privateAttention = clone(cursor.owner.attention.state());
  const retained = mode === 'native' ? cursor.owner.nativeState() : cursor.owner.state();
  const owner = new ObservedBinding();
  if (mode === 'native') {
    assert.equal(Object.hasOwn(retained, 'attention'), false, 'Native owner checkpoint must not duplicate common attention');
    owner.restoreNative(retained);
    // Load the actual native writes, not a source expectation or tracker field.
    cursor.attention = new AttentionMemory(cursor.memory as any, cursor.episode);
  } else owner.restore(retained);
  if (wasShared) {
    owner.attention = cursor.attention;
    owner.enableCallerContext({ attention: () => cursor.attention });
  } else owner.attention.restore(privateAttention);
  cursor.owner = owner;
}
function checkException(error: unknown, expected: R, context: string): void {
  assert.ok(error instanceof Error, context + ': native call must reject');
  assert.equal(error.message, expected.message, context + ': exact original failure message');
  // Python ValueError and native TypeError are language-specific names for the
  // declared invalid-binder input. This mapping is explicit, not null coercion.
  if (expected.type === 'ValueError') assert.ok(['TypeError', 'Error'].includes(error.name), context + ': invalid-input error class');
  else assert.equal(error.name, expected.type, context + ': exception class');
}

test('original recovery fixture has a complete, independent cold contract', () => {
  assert.equal(fixture.schema, 'logos-engine.v6.observed-binding-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.mode, 'declared-synthetic-public-returns');
  assert.ok(fixture.helpers.length && fixture.chains.length);
  assert.equal(new Set(fixture.helpers.map((row: R) => row.id)).size, fixture.helpers.length);
  assert.equal(new Set(fixture.chains.map((row: R) => row.id)).size, fixture.chains.length);
  for (const chain of fixture.chains) {
    exact(Object.keys(chain.initialState).sort(), [...fields].sort(), chain.id + ': cold tracker fields');
    assert.equal(chain.initialState.core, null); assert.equal(chain.initialState.epoch, null);
    exact(chain.initialAttention, { item: null, composition: null }, chain.id + ': cold attention');
    exact(chain.initialMemoryPuts, [], chain.id + ': no injected memory');
  }
});

const helperModules: Record<string, R> = { geometry, identity, reception, planning, tracker: { corner_contradiction }, family: { locate } };
for (const item of fixture.helpers) test('original helper: ' + item.id, async () => {
  const [domain, name] = item.method.split('.'), args = clone(item.args);
  if (domain === 'planning' && ['offers', 'separation_offers'].includes(name)) {
    assert.ok(item.acquiredFrom, 'The component tracker prior must name its actual source acquisition');
    const sourceChain = fixture.chains.find((row: R) => row.id === item.acquiredFrom.chain);
    exact(args[0], sourceChain.operations[item.acquiredFrom.operation].state, 'Helper prior is actually acquired source state');
    const tracker = new BindingTracker(); tracker.restore(args[0]); args[0] = tracker;
  }
  if (item.method === 'geometry.moved_core') args.push(item.kwargs.minimum_area ?? 4, item.kwargs.preferred_minimum_area ?? null);
  if (item.method === 'geometry.digest' && item.floatPaths) args.push(item.floatPaths);
  const callback = helperModules[domain]![name]; assert.equal(typeof callback, 'function', 'Transferred helper is available');
  let returned: any, failed: unknown;
  try { returned = await callback(...args); } catch (error) { failed = error; }
  if (item.exception) checkException(failed, item.exception, item.id);
  else { if (failed) throw failed; exact(returned, item.result, item.id); }
});

for (const chain of fixture.chains) test('original chain: ' + chain.id, async () => {
  const modes = chain.nativeCheckpointEligible ? ['continuous', 'source', 'native'] as const : ['continuous', 'source'] as const;
  for (const mode of modes) {
    const cursor = fresh(chain.episode);
    exact(cursor.owner.state(), chain.initialState, chain.id + ': initial source tracker');
    for (const [index, op] of chain.operations.entries()) {
      const label = `${chain.id}/${mode}/${index}/${op.method}`;
      let returned: R = {}, failed: unknown;
      try { returned = await invoke(cursor, op); } catch (error) { failed = error; }
      if (op.exception) checkException(failed, op.exception, label);
      else {
        if (failed) throw failed;
        exact(returned.result, op.result, label + ': result');
        if (Object.hasOwn(op, 'proposalAfterBind')) exact(returned.proposalAfterBind, op.proposalAfterBind, label + ': bound proposal');
      }
      exact(cursor.owner.state(), op.state, label + ': all source tracker fields');
      stateOrder(cursor.owner.state(), op.state, label);
      exact(cursor.attention.state(), op.attention, label + ': common attention');
      exact(cursor.owner.attention.state(), op.ownerAttention, label + ': actual family attention');
      exact(cursor.owner.attention === cursor.attention, op.attentionBoundShared, label + ': shared identity');
      exact(cursor.memory.puts, op.memoryPuts, label + ': actual cumulative writes');
      if (mode !== 'continuous') restoreActual(cursor, mode);
    }
    exact(cursor.owner.state(), chain.finalState, chain.id + '/' + mode + ': final state');
    exact(cursor.attention.state(), chain.finalAttention, chain.id + '/' + mode + ': final attention');
    exact(cursor.memory.puts, chain.finalMemoryPuts, chain.id + '/' + mode + ': final writes');
  }
});
