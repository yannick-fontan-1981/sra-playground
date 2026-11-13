import { readFileSync, writeFileSync } from 'node:fs';

const filePath = 'src/runtime/v6-browser-common-campaign-host.ts';
const before = readFileSync(filePath, 'utf8');
const oldHelper = `function sameNumbers(left: readonly number[], right: readonly number[]): boolean {\n  return left.length === right.length && left.every((value, index) => value === right[index]);\n}`;
const newHelper = `function sameNumbers(left: ArrayLike<number>, right: ArrayLike<number>): boolean {\n  if (left.length !== right.length) return false;\n  for (let index = 0; index < left.length; index += 1) {\n    if (left[index] !== right[index]) return false;\n  }\n  return true;\n}`;

if (!before.includes(oldHelper)) {
  if (before.includes(newHelper)) {
    console.log('typing fix already applied');
    process.exit(0);
  }
  throw new Error('sameNumbers helper not found');
}

writeFileSync(filePath, before.replace(oldHelper, newHelper));
console.log(`patched ${filePath}`);
