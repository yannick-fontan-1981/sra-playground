/** Development-only replay of acquired public transitions; no Python required. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareNativeCaller } from '../tests/helpers/v6-caller-differential.ts';

const file = resolve(process.argv[2] ?? 'tests/fixtures/v6-native-caller/hano-first-prefix.json');
const result = await compareNativeCaller(JSON.parse(await readFile(file, 'utf8')));
if (process.argv[3]) await writeFile(resolve(process.argv[3]), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ passed: result.passed, failed: result.failed,
  failures: result.checks.filter(check => !check.passed), unsupported: result.unsupported }, null, 2));
if (result.failed) process.exitCode = 1;
