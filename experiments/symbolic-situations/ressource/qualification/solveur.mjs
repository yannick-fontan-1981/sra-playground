import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const agenda = '475044aa609fe2934101b6286a96ae544aa24250';
const here = dirname(fileURLToPath(import.meta.url));
const entry = 'solveur.mjs';
export function bundle(solver) {
  if (solver) return new Map([[entry, readFileSync(solver)]]);
  const files = new Map([[entry, readFileSync(join(here, 'agenda-stdio.mjs'))]]);
  for (const path of ['experiments/sic-agenda-offres/transfert/fiche-publique.mjs',
    'experiments/sic-agenda-offres/agenda.mjs', 'src/sic/reasoning-mode.ts']) {
    const blob = execFileSync('git', ['cat-file', 'blob', agenda + ':' + path], { cwd: here, windowsHide: true });
    files.set(path, blob);
  }
  return files;
}

export const fingerprints = files => Object.fromEntries([...files].map(([name, bytes]) =>
  [name, createHash('sha256').update(bytes).digest('hex')]));

export function launch(files) {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Exécuter l’opérateur avec Node 24 ou ultérieur');
  const folder = mkdtempSync(join(tmpdir(), 'partie-'));
  try {
    for (const [name, bytes] of files) {
      const file = join(folder, name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
    const proc = spawn(process.execPath, ['--permission', '--allow-fs-read=' + folder, entry],
      { cwd: folder, env: {}, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const closed = new Promise(resolve => proc.once('close', resolve));
    let error = '', buffered = '';
    let ready, reject;
    proc.stdout.setEncoding('utf8');
    function fail(message) {
      error ||= message;
      reject?.(new Error(error));
      proc.kill();
    }
    proc.on('error', err => fail(err.message));
    proc.stdin.on('error', err => fail(err.message));
    proc.stderr.setEncoding('utf8').on('data', chunk => { error = (error + chunk).slice(-2048); });
    proc.stdout.on('data', chunk => {
      buffered += chunk;
      if (buffered.length > 8192) return fail('Réponse trop longue');
      const end = buffered.indexOf('\n');
      if (end < 0) return;
      if (!ready || buffered.slice(end + 1).length) return fail('Réponse hors tour');
      let value;
      try { value = JSON.parse(buffered.slice(0, end)); } catch { return fail('JSON non reconnu'); }
      buffered = '';
      ready(value);
      ready = reject = undefined;
    });
    closed.then(() => reject?.(new Error(error || 'Solveur fermé sans réponse')));
    return {
      reply(input) {
        return new Promise((resolve, rejectReply) => {
          if (proc.exitCode !== null || proc.signalCode) return rejectReply(new Error(error || 'Solveur fermé'));
          const timer = setTimeout(() => fail('Délai de réponse dépassé'), 5000);
          ready = value => { clearTimeout(timer); resolve(value); };
          reject = reason => { clearTimeout(timer); rejectReply(reason); };
          proc.stdin.write(JSON.stringify(input) + '\n');
        });
      },
      async close(last) {
        if (!proc.stdin.destroyed) proc.stdin.end(last ? JSON.stringify(last) + '\n' : '');
        const timer = setTimeout(() => proc.kill(), 500);
        try { await closed; } finally {
          clearTimeout(timer);
          rmSync(folder, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    rmSync(folder, { recursive: true, force: true });
    throw error;
  }
}
