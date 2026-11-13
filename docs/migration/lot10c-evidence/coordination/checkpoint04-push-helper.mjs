import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const projectId = 'appgprj_6adbc388d79081918581b93b919d7258';
const ref = 'refs/heads/lot10c-ordered-recruitment-checkpoint-20261111';
for (const lane of ['5c', '6b', '8a', '10c']) {
  const state = JSON.parse(readFileSync('/workspace/shared/sra-coordination/lot' + lane + '-status.json', 'utf8'));
  if (['quiet_requested', 'performance_started', 'official_cost_active'].some(key => state[key] === true)) throw new Error('Active quiet/cost request in lane ' + lane);
}
const input = await new Promise((resolve, reject) => {
  let text = '';
  let settled = false;
  const wasRaw = process.stdin.isTTY ? process.stdin.isRaw : false;
  const cleanup = () => {
    clearTimeout(deadline);
    process.stdin.removeListener('data', receive);
    process.stdin.removeListener('end', finish);
    process.stdin.removeListener('error', fail);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(signal, cancel);
    process.stdin.pause();
    if (process.stdin.isTTY) process.stdin.setRawMode(Boolean(wasRaw));
  };
  const settle = (error, value) => {
    if (settled) return;
    settled = true;
    text = '';
    try { cleanup(); } catch { error = new Error('Failed to restore hidden input terminal'); }
    if (error) reject(error); else resolve(value);
  };
  const fail = () => settle(new Error('Hidden input stream failed'));
  const cancel = () => settle(new Error('Hidden input cancelled'));
  const finish = () => {
    let value;
    try { value = JSON.parse(text); } catch { settle(new Error('Invalid hidden input')); return; }
    settle(null, value);
  };
  const receive = chunk => {
    text += chunk;
    if (text.length > 65536) settle(new Error('Input too large'));
    else if (process.stdin.isTTY && text.includes('\u0003')) cancel();
    else if (/[\r\n]/.test(text)) finish();
  };
  const deadline = setTimeout(() => settle(new Error('Timed out waiting for hidden input after 30 seconds')), 30000);
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', receive);
    process.stdin.once('end', finish);
    process.stdin.once('error', fail);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, cancel);
    process.stdin.resume();
    process.stderr.write('Ready for checkpoint credential JSON on stdin (input is hidden).\n');
  } catch { settle(new Error('Unable to initialize hidden input')); }
});
const credential = input.credential;
const url = new URL(credential.remote_url);
if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/' + projectId + '.git')) throw new Error('Invalid destination');
if (JSON.parse(readFileSync('.openai/hosting.json', 'utf8')).project_id !== projectId) throw new Error('Project mismatch');
if (credential.publish_on_push_accepted) throw new Error('Checkpoint requires ordinary source-only credential');
if (credential.token_expires_at && Date.parse(credential.token_expires_at) <= Date.now()) throw new Error('Expired credential');
if (!['http_extra_header', 'work_proxy'].includes(credential.auth_mode)) throw new Error('Unsupported authentication');
if (credential.auth_mode === 'http_extra_header' && (typeof credential.token !== 'string' || /[\r\n\0]/.test(credential.token))) throw new Error('Invalid credential');
function git(args, network = false, check = true) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  const extra = ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false'];
  for (const key of Object.keys(env)) if (key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE') delete env[key];
  if (network) {
    extra.push('-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false');
    if (credential.auth_mode === 'http_extra_header') {
      env.SITES_GIT_AUTHORIZATION = 'Authorization: Bearer ' + credential.token;
      extra.push('--config-env=http.' + credential.remote_url + '.extraHeader=SITES_GIT_AUTHORIZATION');
    }
    if (process.env.CODEX_NETWORK_PROXY_ACTIVE === '1' && process.env.HTTPS_PROXY) {
      const p = git(['config', '--null', '--get-urlmatch', 'http.proxy', credential.remote_url], false, false);
      if (p.status === 0 && p.stdout === '\0') extra.push('--config-env=http.' + credential.remote_url + '.proxy=HTTPS_PROXY');
    }
  }
  const r = spawnSync('git', [...extra, ...args], { env, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (check && r.status !== 0) {
    let detail = r.stderr || String(r.error || 'Git failed');
    if (credential.token) detail = detail.split(credential.token).join('[redacted]');
    throw new Error(detail);
  }
  return r;
}
git(['check-ref-format', ref]);
if (git(['ls-remote', '--get-url', credential.remote_url]).stdout.trim() !== credential.remote_url) throw new Error('URL rewrite');
const rewrites = git(['config', '--get-regexp', '^url\\..*\\.pushinsteadof$'], false, false).stdout;
if (rewrites.split('\n').some(line => { const p = line.match(/^\S+\s+(.+)$/)?.[1]; return p && credential.remote_url.startsWith(p); })) throw new Error('Push URL rewrite');
const pending = git(['status', '--porcelain=v1', '--untracked-files=all', '-z']).stdout.split('\0').filter(Boolean);
const evidenceBase = 'docs/migration/lot10c-evidence/development/regressions01/';
const pendingEvidenceFiles = new Set(['preflight.json', 'regression-launch.json', 'regression-driver-output.raw.txt', 'regression-driver-output.log.gz']);
for (const row of pending) {
  const name = row.slice(3);
  if (!row.startsWith('?? ') || !name.startsWith(evidenceBase) ||
      !(name.startsWith(evidenceBase + 'regressions/') || pendingEvidenceFiles.has(name.slice(evidenceBase.length)))) {
    throw new Error('Unexpected uncommitted input outside declared regression evidence awaiting a later transport batch');
  }
}
const head = git(['rev-parse', 'HEAD']).stdout.trim();
git(['fetch', '--no-tags', credential.remote_url, 'refs/heads/main'], true);
git(['push', credential.remote_url, 'HEAD:' + ref], true);
const remote = git(['ls-remote', '--heads', credential.remote_url, ref], true).stdout.trim().split(/\s+/)[0];
if (remote !== head || git(['rev-parse', 'HEAD']).stdout.trim() !== head) throw new Error('Remote checkpoint mismatch');
console.log(JSON.stringify({ projectId, ref, head, remote, remoteVerified: true, sourceOnly: true, published: false, pendingRegressionEvidenceFiles: pending.length, workingTreeQualification: pending.length ? 'Only declared terminal regression evidence remains untracked for a later transport batch' : 'clean', verifiedAt: new Date().toISOString() }));
