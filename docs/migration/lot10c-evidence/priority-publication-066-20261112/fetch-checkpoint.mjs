import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const projectId = 'appgprj_6adbc388d79081918581b93b919d7258';
const ref = 'refs/heads/lot10d-temporal-selection-checkpoint-20261111';
const expected = 'feab56d88718ef3b9ae9fd4798254934c09ad3f3';
const credential = await new Promise((resolve, reject) => {
  let input = ''; let settled = false;
  const previousRaw = process.stdin.isTTY ? process.stdin.isRaw : false;
  const finish = (error, value) => {
    if (settled) return; settled = true;
    clearTimeout(deadline); input = '';
    process.stdin.removeListener('data', receive); process.stdin.pause();
    if (process.stdin.isTTY) process.stdin.setRawMode(Boolean(previousRaw));
    if (error) reject(error); else resolve(value);
  };
  const receive = chunk => {
    input += chunk;
    if (input.length > 65536 || input.includes('\u0003')) return finish(new Error('Hidden input cancelled'));
    if (/[\r\n]/.test(input)) {
      try { finish(null, JSON.parse(input)); } catch { finish(new Error('Invalid hidden input')); }
    }
  };
  const deadline = setTimeout(() => finish(new Error('Hidden input timeout')), 30000);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8'); process.stdin.on('data', receive); process.stdin.resume();
  process.stderr.write('Ready for repository credential JSON on stdin (input is hidden).\n');
});
const url = new URL(credential.remote_url);
if (url.protocol !== 'https:' || url.hostname !== 'git.chatgpt-team.site' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/' + projectId + '.git')) throw new Error('Invalid destination');
if (JSON.parse(readFileSync('.openai/hosting.json', 'utf8')).project_id !== projectId) throw new Error('Project mismatch');
if (credential.publish_on_push_accepted) throw new Error('Source-only credential required');
if (!['http_extra_header', 'work_proxy'].includes(credential.auth_mode)) throw new Error('Unsupported authentication');
if (credential.auth_mode === 'http_extra_header' && (typeof credential.token !== 'string' || /[\r\n\0]/.test(credential.token))) throw new Error('Invalid credential');
if (credential.token_expires_at && Date.parse(credential.token_expires_at) <= Date.now()) throw new Error('Expired credential');
function git(args, network = false, check = true) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE') delete env[key];
  const extra = ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false'];
  if (network) {
    extra.push('-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false');
    if (credential.auth_mode === 'http_extra_header') {
      env.SITES_GIT_AUTHORIZATION = 'Authorization: Bearer ' + credential.token;
      extra.push('--config-env=http.' + credential.remote_url + '.extraHeader=SITES_GIT_AUTHORIZATION');
    }
    if (process.env.CODEX_NETWORK_PROXY_ACTIVE === '1' && process.env.HTTPS_PROXY) {
      const proxy = git(['config', '--null', '--get-urlmatch', 'http.proxy', credential.remote_url], false, false);
      if (proxy.status === 0 && proxy.stdout === '\0') extra.push('--config-env=http.' + credential.remote_url + '.proxy=HTTPS_PROXY');
    }
  }
  const result = spawnSync('git', [...extra, ...args], { env, encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (check && result.status !== 0) {
    let detail = result.stderr || String(result.error || 'Git failed');
    if (credential.token) detail = detail.split(credential.token).join('[redacted]');
    throw new Error(detail);
  }
  return result;
}
if (git(['ls-remote', '--get-url', credential.remote_url]).stdout.trim() !== credential.remote_url) throw new Error('URL rewrite');
const advertised = git(['ls-remote', '--heads', credential.remote_url, ref], true).stdout.trim().split(/\s+/);
if (advertised[0] !== expected || advertised[1] !== ref) throw new Error('Saved checkpoint is not advertised at its expected commit');
git(['fetch', '--no-tags', credential.remote_url, ref + ':refs/remotes/lot10/temporal-selection-checkpoint'], true);
const actual = git(['rev-parse', 'refs/remotes/lot10/temporal-selection-checkpoint^{commit}']).stdout.trim();
if (actual !== expected) throw new Error('Fetched checkpoint mismatch');
console.log(JSON.stringify({ projectId, ref, expected, actual, remoteVerified: true, fetchOnly: true, workingTreeUnchanged: true, globalLockAcquired: false, verifiedAt: new Date().toISOString() }));
