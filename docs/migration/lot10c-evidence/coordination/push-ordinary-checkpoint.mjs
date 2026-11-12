import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const projectId = 'appgprj_6adbc388d79081918581b93b919d7258';
const requestedRevision = process.argv[2];
const ref = process.argv[3];
if (!/^[0-9a-f]{40}$/.test(requestedRevision || '')) throw new Error('Exact commit required');
if (ref !== 'refs/heads/lot10c-ordered-recruitment-checkpoint-20261111' && !/^refs\/heads\/lot10c-prepared-(5c|6b|8a)-transport-20261111$/.test(ref || '')) throw new Error('Only owned source-checkpoint references are permitted');
// Source-only checkpoints are ordinary work: no global mutex or peer quiet gate.
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
// Only the immutable requested commit is pushed. Uncommitted local evidence is excluded.
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const revision = git(['rev-parse', requestedRevision + '^{commit}']).stdout.trim();
if (revision !== requestedRevision || git(['merge-base', '--is-ancestor', revision, head], false, false).status !== 0) throw new Error('Push revision must be an immutable ancestor of the current candidate');
const expectedHeads = JSON.parse(process.argv[4] || '{}');
for (const [expectedRef, expectedCommit] of Object.entries(expectedHeads)) {
  if ((expectedRef !== 'refs/heads/lot10c-ordered-recruitment-checkpoint-20261111' && !/^refs\/heads\/lot10c-prepared-(5c|6b|8a)-transport-20261111$/.test(expectedRef)) || !/^[0-9a-f]{40}$/.test(expectedCommit)) throw new Error('Invalid required advertised checkpoint');
}
const advertised = new Map(git(['ls-remote', '--heads', credential.remote_url], true).stdout.trim().split(/\r?\n/).filter(Boolean).map(line => { const [commit, name] = line.split(/\s+/); return [name, commit]; }));
for (const [expectedRef, expectedCommit] of Object.entries(expectedHeads)) if (advertised.get(expectedRef) !== expectedCommit) throw new Error('Previously verified checkpoint is not advertised at its expected commit: ' + expectedRef);
git(['fetch', '--no-tags', credential.remote_url, 'refs/heads/main'], true);
git(['push', credential.remote_url, revision + ':' + ref], true);
const remote = git(['ls-remote', '--heads', credential.remote_url, ref], true).stdout.trim().split(/\s+/)[0];
if (remote !== revision || git(['rev-parse', 'HEAD']).stdout.trim() !== head) throw new Error('Remote checkpoint mismatch');
console.log(JSON.stringify({ projectId, ref, head, pushedCommit: revision, remote, requiredAdvertisedHeadsVerified: expectedHeads, remoteVerified: true, sourceOnly: true, published: false, uncommittedPaths: pending.length, workingTreeClean: pending.length === 0, globalLockAcquired: false, peerQuietGateUsed: false, workingTreeQualification: pending.length ? 'Only the immutable committed revision is saved; uncommitted work remains local and is not included in this checkpoint' : 'clean', verifiedAt: new Date().toISOString() }));
