import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/qualify-op01-op31-browser-crash-resume.mjs';
let source = await readFile(path, 'utf8');

if (!source.includes('`--app=${url}`')) {
  const before = '    `--user-data-dir=${profile}`,\n    url,\n';
  const after = '    `--user-data-dir=${profile}`,\n    `--app=${url}`,\n';
  if (!source.includes(before)) throw new Error('Chrome launch URL anchor is missing');
  source = source.replace(before, after);
}

source = source.replace(
  '    await delay(1_000);\n    const firstExit = await hardKillChrome(firstChrome);',
  '    await delay(5_000);\n    const firstExit = await hardKillChrome(firstChrome);',
);

await writeFile(path, source);
console.log('Forced explicit app-mode phase launch after SIGKILL');
