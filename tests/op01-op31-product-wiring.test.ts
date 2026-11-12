import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkLogosProductWiring } from '../scripts/check-op01-op31-product-wiring.mjs';

function write(root: string, relative: string, content: string): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

test('product wiring gate reports library-only when Logos is not imported outside src/logos-engine', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-wiring-none-'));
  write(root, 'src/logos-engine/v6-operations.ts', 'export const x = 1;');
  write(root, 'src/main.ts', "export const main = true;\n");
  const result = checkLogosProductWiring(root);
  assert.equal(result.connected, false);
  assert.equal(result.status, 'logos-library-only-no-product-wiring');
  assert.deepEqual(result.matches, []);
});

test('product wiring gate detects a static Logos import in product code', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-wiring-static-'));
  write(root, 'src/logos-engine/v6-operation-cycle.ts', 'export const runOperationCycle = () => {};');
  write(root, 'src/runtime/v6-agent-worker.ts', "import { runOperationCycle } from '../logos-engine/v6-operation-cycle.ts';\n");
  const result = checkLogosProductWiring(root);
  assert.equal(result.connected, true);
  assert.equal(result.status, 'logos-product-wiring-present');
  assert.equal(result.matches[0]?.path, 'src/runtime/v6-agent-worker.ts');
  assert.equal(result.matches[0]?.line, 1);
});

test('product wiring gate ignores internal Logos imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-wiring-internal-'));
  write(root, 'src/logos-engine/a.ts', "import { b } from './b.ts';\n");
  write(root, 'src/logos-engine/b.ts', 'export const b = 1;');
  const result = checkLogosProductWiring(root);
  assert.equal(result.connected, false);
  assert.equal(result.matches.length, 0);
});
