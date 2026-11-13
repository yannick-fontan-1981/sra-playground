import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APPROVED_CALLERS = Object.freeze([
  'src/logos-engine/v6-composition-engine.ts',
  'src/logos-engine/v6-target-binding.ts',
]);

function walk(directory) {
  if (!existsSync(directory)) return [];
  const out = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (path.endsWith('.ts')) out.push(path);
  }
  return out;
}

export function checkOperationCallSites(root = process.cwd()) {
  const directory = resolve(root, 'src/logos-engine');
  const calls = [];

  for (const path of walk(directory)) {
    const source = readFileSync(path, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.includes('executeOperation(')) return;
      if (/export\s+function\s+executeOperation\s*\(/.test(line)) return;
      calls.push({
        path: relative(root, path).split(sep).join('/'),
        line: index + 1,
        text: line.trim(),
      });
    });
  }

  const unexpected = calls.filter(call => !APPROVED_CALLERS.includes(call.path));
  return {
    approvedCallers: [...APPROVED_CALLERS],
    calls,
    unexpected,
    ready: unexpected.length === 0,
    status: unexpected.length === 0
      ? 'logos-operation-callsites-qualified'
      : 'unexpected-direct-logos-operation-caller',
  };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = checkOperationCallSites();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
