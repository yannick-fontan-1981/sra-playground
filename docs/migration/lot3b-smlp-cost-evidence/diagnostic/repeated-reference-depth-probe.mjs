/** Synthetic structural contract only: no gameplay or performance measurement. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const checkout = process.argv[2];
if (!checkout) throw new TypeError('Expected the checkout path');
const moduleUrl = name => pathToFileURL(resolve(checkout, 'src/logos-engine', name)).href;
const { hydrateNativeState, NATIVE_STATE_GRAPH_PROFILE } = await import(moduleUrl('v6-native-state-graph.ts'));
const { symbolicDigest } = await import(moduleUrl('v6-hash.ts'));
const ref = id => ({ kind: 'ref', id });
const nested = (node, count) => {
  for (let i = 0; i < count; i++) node = { kind: 'array', items: [node] };
  return node;
};
const fragment = node => {
  const value = { profile: NATIVE_STATE_GRAPH_PROFILE, node };
  return { id: `state_fragment:${symbolicDigest(value, false)}`, value };
};
const leaf = fragment(nested(97, 10));
const parent = fragment({ kind: 'array', items: [ref(leaf.id)] });
const fragments = new Map([leaf, parent].map(item => [item.id, item.value]));
const cases = [
  { name: 'single-reference-depth-513', prefixReference: false, wrappers: 499 },
  { name: 'repeated-reference-depth-512', prefixReference: true, wrappers: 498 },
  { name: 'repeated-reference-depth-513', prefixReference: true, wrappers: 499 },
];
const results = cases.map(({ name, prefixReference, wrappers }) => {
  const items = prefixReference ? [ref(parent.id)] : [];
  items.push(nested(ref(parent.id), wrappers));
  const root = { profile: NATIVE_STATE_GRAPH_PROFILE, component: 'synthetic-depth-contract', root: { kind: 'array', items } };
  const reads = [];
  try {
    hydrateNativeState(root, id => { reads.push(id); return fragments.get(id); });
    return { name, accepted: true, reads };
  } catch (error) {
    return { name, accepted: false, reads, error: { name: error.name, message: error.message } };
  }
});
console.log(JSON.stringify({ checkout, results }));
