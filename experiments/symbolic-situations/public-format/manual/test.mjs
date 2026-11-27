import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { development, formatDir } from '../operator/schedule.mjs';
import { measure } from '../operator/measure.mjs';

const folder = join(formatDir, 'manual');
const cli = join(folder, 'operer.mjs');
const publicPrefix = join(folder, 'prefixe.json');
const run = (args, actions = []) => execFileSync(process.execPath, [cli, ...args], {
  input: actions.join('\n') + '\n', encoding: 'utf8', windowsHide: true,
}).replaceAll('\r\n', '\n').trimEnd();

test('mêmes retours sur le parcours manuel, dans l’opérateur isolé et après reprise du préfixe public', async () => {
  const transcript = JSON.parse(readFileSync(publicPrefix, 'utf8'));
  const actions = [...transcript.map(t => t.action), 'marquer Xfc26f3 X03a3e1', 'valider'];
  const card = development().find(c => c.id === '9fd1072013fd810d513c');
  const source = "import {createInterface} from 'node:readline'; const actions=" + JSON.stringify(actions) +
    "; for await (const line of createInterface({input:process.stdin})) { if (!actions.length) break; console.log(JSON.stringify({action:actions.shift()})); }";
  const remote = await measure([{...card, worlds:[card.worlds[0]]}], {files:new Map([['solveur.mjs', Buffer.from(source)]]), program:'solveur.mjs'});
  const feedback = remote.departs[0].tours.map(t => t.retour);
  assert.deepEqual(feedback, ['X4c94cf','marqué','marqué','succès']);
  assert.deepEqual(run(['--monde','1'], actions).split('\n'), feedback);
  assert.deepEqual(run(['--prefixe',publicPrefix], actions.slice(2)).split('\n'), feedback.slice(2));
  const message = run(['--message','--prefixe',publicPrefix]);
  assert.ok(message.includes(transcript[0].retour) && message.includes(transcript[1].action));
  assert.ok(!message.includes('--monde') && !message.includes('Joue ton premier coup.'));
  const page = readFileSync(join(formatDir, '../exemple/public/9fd1072013fd810d513c.md'), 'utf8').replaceAll('\r\n', '\n');
  assert.ok(run(['--message']).includes(page.split('Donne un plan')[0].trimEnd()));
});

test('avant la première information discriminante, le préfixe seul ne fixe pas le monde initial', t => {
  const dir = mkdtempSync(join(tmpdir(), 'reprise-'));
  t.after(() => rmSync(dir, {recursive:true,force:true}));
  const path = join(dir, 'prefix.json');
  writeFileSync(path, JSON.stringify([{action:'commande indisponible',retour:'Action indisponible.'}]));
  const res = spawnSync(process.execPath, [cli,'--prefixe',path], {encoding:'utf8',input:''});
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /encore ambigu/);
  assert.equal(run(['--prefixe',path,'--monde','1'], ['lire']), 'X4c94cf');
  assert.equal(run(['--prefixe',path,'--monde','2'], ['lire']), 'X6e9ba2');
  writeFileSync(path, JSON.stringify([{action:'lire',retour:'impossible'}]));
  const bad = spawnSync(process.execPath, [cli,'--prefixe',path,'--message'], {encoding:'utf8',input:''});
  assert.notEqual(bad.status, 0);
});
