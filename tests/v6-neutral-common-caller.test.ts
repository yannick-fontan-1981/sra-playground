import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NeutralCommonCaller,
  type CommonCallerAcquisition,
  type CommonCallerOwner,
  type CommonCallerProposal,
} from '../src/logos-engine/v6-neutral-common-caller.ts';

class FakeOwner implements CommonCallerOwner {
  readonly acquired: CommonCallerAcquisition[] = [];

  constructor(
    readonly id: string,
    readonly proposal: CommonCallerProposal | undefined,
  ) {}

  propose(): CommonCallerProposal | undefined {
    return this.proposal ? structuredClone(this.proposal) : undefined;
  }

  acquire(event: CommonCallerAcquisition): unknown {
    this.acquired.push(structuredClone(event));
    return { owner: this.id, source: event.source };
  }
}

function proposal(ownerId: string, proposalRef = ownerId + '-proposal'): CommonCallerProposal {
  return { ownerId, proposalRef, actionRef: 'ACTION1' };
}

test('no proposal produces none', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('a', undefined));
  caller.register(new FakeOwner('b', undefined));
  assert.deepEqual(caller.select(caller.collect()), { status: 'none', proposals: [] });
});

test('exactly one proposal may be selected', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('a', undefined));
  caller.register(new FakeOwner('b', proposal('b')));
  const collected = caller.collect();
  assert.equal(collected.length, 1);
  assert.deepEqual(caller.select(collected), {
    status: 'selected',
    selected: proposal('b'),
    proposals: [proposal('b')],
  });
});

test('multiple proposals are ambiguous instead of being ranked', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('first', proposal('first')));
  caller.register(new FakeOwner('second', proposal('second')));
  const selection = caller.select(caller.collect());
  assert.equal(selection.status, 'ambiguous');
  assert.equal(selection.selected, undefined);
  assert.deepEqual(selection.proposals.map(item => item.ownerId), ['first', 'second']);
});

test('ambiguous selection cannot be routed as selected', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('a', proposal('a')));
  caller.register(new FakeOwner('b', proposal('b')));
  const selection = caller.select(caller.collect());
  assert.throws(() => caller.routeSelected(selection, 'event-1', {}), /exactly one selected proposal/);
});

test('selected return routes only to selected owner', () => {
  const caller = new NeutralCommonCaller();
  const a = new FakeOwner('a', undefined);
  const b = new FakeOwner('b', proposal('b'));
  caller.register(a);
  caller.register(b);
  const selection = caller.select(caller.collect());
  const receipt = caller.routeSelected(selection, 'event-1', { value: 3 });
  assert.equal(receipt.ownerId, 'b');
  assert.equal(receipt.routed, true);
  assert.equal(a.acquired.length, 0);
  assert.equal(b.acquired.length, 1);
  assert.equal(b.acquired[0]?.source, 'selected');
});

test('passive routing requires explicit owner ids and payloads', () => {
  const caller = new NeutralCommonCaller();
  const a = new FakeOwner('a', undefined);
  const b = new FakeOwner('b', undefined);
  caller.register(a);
  caller.register(b);
  const receipts = caller.routePassive(['a'], 'event-2', { a: { seen: true } });
  assert.equal(receipts.length, 1);
  assert.equal(a.acquired.length, 1);
  assert.equal(a.acquired[0]?.source, 'passive');
  assert.equal(b.acquired.length, 0);
  assert.throws(() => caller.routePassive(['b'], 'event-3', {}), /missing passive payload/);
});

test('same physical return is routed at most once per owner', () => {
  const caller = new NeutralCommonCaller();
  const owner = new FakeOwner('a', proposal('a'));
  caller.register(owner);
  const selection = caller.select(caller.collect());
  assert.equal(caller.routeSelected(selection, 'event-4', {}).routed, true);
  const duplicate = caller.routePassive(['a'], 'event-4', { a: {} })[0]!;
  assert.equal(duplicate.routed, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(owner.acquired.length, 1);
});

test('snapshot restore preserves caller dedupe state and requires same owner order', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('a', proposal('a')));
  const selection = caller.select(caller.collect());
  caller.routeSelected(selection, 'event-5', {});
  const snapshot = caller.snapshot();

  const restored = new NeutralCommonCaller();
  const restoredOwner = new FakeOwner('a', proposal('a'));
  restored.register(restoredOwner);
  restored.restore(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(restored.routePassive(['a'], 'event-5', { a: {} })[0]?.duplicate, true);

  const wrong = new NeutralCommonCaller();
  wrong.register(new FakeOwner('b', proposal('b')));
  assert.throws(() => wrong.restore(snapshot), /owner set\/order mismatch/);
});

test('caller rejects duplicate owner ids and duplicate proposal refs', () => {
  const caller = new NeutralCommonCaller();
  caller.register(new FakeOwner('a', proposal('a', 'same')));
  assert.throws(() => caller.register(new FakeOwner('a', undefined)), /duplicate caller owner/);
  caller.register(new FakeOwner('b', proposal('b', 'same')));
  assert.throws(() => caller.collect(), /duplicate proposalRef/);
});
