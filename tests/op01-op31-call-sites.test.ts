import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { checkOperationCallSites } from '../scripts/check-op01-op31-call-sites.mjs';

function write(root: string, relative: string, content: string): void {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

test('callsite gate accepts the two approved bridges', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-callsites-ok-'));
  write(root, 'src/logos-engine/v6-operations.ts', 'export function executeOperation() {}\n');
  write(root, 'src/logos-engine/v6-composition-engine.ts', 'const x = executeOperation(bundle.operation_key, state);\n');
  write(root, 'src/logos-engine/v6-target-binding.ts', "const x = executeOperation('OP29', state);\n");
  const result = checkOperationCallSites(root);
  assert.equal(result.ready, true);
  assert.equal(result.unexpected.length, 0);
  assert.deepEqual(result.calls.map(call => call.path).sort(), [
    'src/logos-engine/v6-composition-engine.ts',
    'src/logos-engine/v6-target-binding.ts',
  ]);
});

test('callsite gate rejects a new direct operation caller', () => {
  const root = mkdtempSync(join(tmpdir(), 'op-callsites-bad-'));
  write(root, 'src/logos-engine/v6-operations.ts', 'export function executeOperation() {}\n');
  write(root, 'src/logos-engine/v6-random-caller.ts', "executeOperation('OP07', state);\n");
  const result = checkOperationCallSites(root);
  assert.equal(result.ready, false);
  assert.equal(result.status, 'unexpected-direct-logos-operation-caller');
  assert.equal(result.unexpected[0]?.path, 'src/logos-engine/v6-random-caller.ts');
});
