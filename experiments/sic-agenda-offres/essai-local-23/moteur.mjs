import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = new URL('../../../', import.meta.url);
export const frozen = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
export const historical = '8ce7ee3563fa1d5eca1639c6ad03975cfc962460';
export function run(bin, args) {
  const result = spawnSync(bin, args, { cwd: fileURLToPath(root), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error((result.stderr || result.stdout).split(/\r?\n/).filter(s => s.length < 500).slice(-24).join('\n'));
  return result.stdout;
}
export async function withPinnedEngine(commit, consume) {
  const temp = await mkdtemp(join(tmpdir(), 'sic-local-23-'));
  try {
    const dir = 'reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
    const archive = join(temp, 'src.tar');
    run('git', ['archive', '--format=tar', '--output', archive, commit, 'src', 'package.json', 'public/python',
      dir + 'laya_proto', dir + 'morphology_policy']);
    run('tar', ['-xf', archive, '-C', temp]);
    return await consume(pathToFileURL(temp + sep).href);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
