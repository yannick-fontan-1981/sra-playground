import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { indexedCombination, networkDomain } from '../src/logos-engine/v5-finite-relation-domain.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v5-finite-relation-domain-reference.json.gz', import.meta.url))).toString());

test('finite-domain expectations come from unchanged original V5/V6 sources', () => {
  assert.equal(fixture.originalSourceFilesVerifiedBeforeAndAfter, 1786);
  for (const [path, digest] of Object.entries(fixture.sourceHashes)) {
    const bytes = readFileSync(new URL(`../reference/v6/${fixture.sourceCommit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
  }
});

for (const item of fixture.cases) test(`finite relation source parity: ${item.id}`, () => {
  const argumentsCopy = structuredClone(item.arguments), args = item.arguments;
  assert.deepEqual(networkDomain(args.request, args.fixed, args.requirements, args.offset), item.expected);
  assert.deepEqual(item.arguments, argumentsCopy, 'Enumeration must not revise its caller-owned contracts.');
});

test('indexed combinations preserve Python divmod, declaration order and wrap behavior', () => {
  for (const item of fixture.combinationCases) assert.deepEqual(indexedCombination(item.domains, item.index), item.expected);
  assert.throws(() => indexedCombination([[]], 0), RangeError);
});

test('unsafe native integer domains refuse rather than rounding the source frontier', () => {
  const args = structuredClone(fixture.cases.find((item: any) => item.id === 'source-only-network-preserves-variable-order').arguments);
  args.request.variables = Array.from({ length: 54 }, (_, i) => ({ variable_ref: 'source:' + i, values: ['0', '1'], source: true }));
  assert.throws(() => networkDomain(args.request, {}), /portable integer/);
  assert.throws(() => indexedCombination([['0', '1']], Number.MAX_SAFE_INTEGER + 1), /portable integer/);
  assert.throws(() => networkDomain({ ...args.request, variables: [], domain_offset: -1 }, {}), /bounds/);
});
