import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';

import { frozen, historical, root, run, withPinnedEngine } from './moteur.mjs';

const { values } = parseArgs({ options: { pyodide: { type: 'string' }, recu: { type: 'string' } } });
const vendor = values.pyodide && resolve(values.pyodide);
const module = 'src/logos-engine/v6-observed-frontier.ts';
const changes = run('git', ['diff', '--name-only', frozen, '--', 'src']).trim().split(/\r?\n/);
assert.deepEqual(changes, [module]);
const emit = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true, removeComments: true } }).outputText;
const plain = emit(run('git', ['show', frozen + ':' + module]));
const typed = emit(await readFile(new URL(module, root), 'utf8'));
const sha = s => createHash('sha256').update(s).digest('hex');
assert.equal(sha(plain), sha(typed), 'émission JS différente');
const revision = run('git', ['rev-parse', 'HEAD']).trim();
const report = { revision, frozen, historical, typescript: ts.version, emittedSha256: sha(plain) };
console.log('Émission JavaScript identique', report.emittedSha256);
function measure(engine, mode) {
  const script = fileURLToPath(new URL('mesurer.mjs', import.meta.url));
  return JSON.parse(run(process.execPath, [script, engine, mode, ...(vendor ? [vendor] : [])]));
}
const pinned = (commit, mode) => withPinnedEngine(commit, url => measure(url, mode));
const baseline = await pinned(frozen, 'dev');
const candidate = measure(root.href, 'dev');
assert.equal(candidate.sha256, baseline.sha256, 'décisions, gardes, tickets, retours et reprises');
report.nativeSha256 = baseline.sha256;
report.cases = candidate.results;
console.log('Gel et candidat identiques | choix local, reprise, deux refus de ticket, domaine permuté ou réduit, deux classements natifs, suspension et relais 22');
if (vendor) {
  const { results: { G50T } } = await pinned(historical, 'G50T');
  const current = candidate.results.G50T;
  for (const key of ['pre','occurrence','question','command','guard','need','release','ticket','ranking']) assert.deepEqual(current[key], G50T[key]);
  for (const key of ['ticket','before','after','plan','matched','status','frontier']) assert.deepEqual(current.receipt[key], G50T.receipt[key]);
  report.historicalG50T = G50T;
  console.log('G50T N1/1 | même sceau pré-choix, admission, ACTION1, objectif observé, matched=null sur les trois moteurs');
}
if (values.recu) await writeFile(resolve(values.recu), JSON.stringify(report, null, 2) + '\n');
