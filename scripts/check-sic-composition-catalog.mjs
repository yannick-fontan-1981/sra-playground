/** Keep the small UI catalog in sync without bundling the native graph in the page. */
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const { operations } = read('../src/logos-engine/v6/catalog.json');
const expected = Object.values(operations).map(({ key, description }) => ({ key, description }));
assert.deepEqual(expected.map(item => item.key), Array.from({ length: 31 }, (_, i) => `OP${String(i + 1).padStart(2, '0')}`));
const artifact = '../src/sic/composition-operations.json';
if (process.argv.includes('--write')) writeFileSync(new URL(artifact, import.meta.url), JSON.stringify(expected, null, 2) + '\n');
else assert.deepEqual(read(artifact), expected);
console.log(`SIC catalog: ${expected.length} operations verified`);
