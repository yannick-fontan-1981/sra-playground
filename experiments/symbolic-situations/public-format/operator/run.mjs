import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { consumer } from './frozen.mjs';
import { measure } from './measure.mjs';
import { development, formatDir } from './schedule.mjs';

const { values } = parseArgs({ options: {
  partition: { type: 'string', default: 'developpement' }, solveur: { type: 'string' },
  depot: { type: 'string' }, sha: { type: 'string' }, entree: { type: 'string' },
  dep: { type: 'string', multiple: true }, rapport: { type: 'string' },
} });
const sealed = values.partition === 'reserve';
if (!sealed && values.partition !== 'developpement') throw new Error('Partition inconnue');
if (sealed && (values.solveur || !values.sha || values.rapport)) {
  throw new Error('La réserve utilise un commit consommateur figé et un reçu privé automatique');
}
const solver = consumer(values);
const git = args => execFileSync('git', args, { cwd: formatDir, encoding: 'utf8', windowsHide: true }).trim();
const revision = git(['rev-parse', 'HEAD']);
let cases, commitment = null, destination = values.rapport;
if (sealed) {
  if (git(['status', '--porcelain', '--untracked-files=normal', '--', '..'])) throw new Error('Opérateur ou situations modifiés depuis le gel');
  const partition = await import('./reserved.mjs');
  cases = partition.reserved();
  commitment = partition.commitment;
  destination = join(mkdtempSync(join(formatDir, 'operator/private/', solver.sha + '-')), 'mesure.json');
} else {
  cases = development();
}
const report = { protocole: 'sra.public/1', partition: values.partition, engagement: commitment,
  operateur: revision, runtime: process.version, consommateur: solver.sha, entree: solver.program,
  fichiers: solver.hashes, ...await measure(cases, solver) };
if (destination) writeFileSync(destination, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ bilan: report.bilan, familles: report.familles }, null, 2));
if (destination) console.error('Reçu ' + destination);
