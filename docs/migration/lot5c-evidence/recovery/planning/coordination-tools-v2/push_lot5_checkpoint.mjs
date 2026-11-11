import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const target = 'refs/heads/lot5c-recovery-checkpoint-20261111';
let credential;
function clean(message) {
  return credential?.token ? String(message).split(credential.token).join('[redacted]') : String(message);
}

try {
  if (!process.stdin.isTTY) throw new Error('A hidden interactive input is required.');
  process.stdin.setRawMode(true);
  process.stderr.write('Ready for checkpoint JSON on stdin (input is hidden).\n');
  const raw = await new Promise((resolve, reject) => {
    let input = '';
    const finish = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); };
    const onData = chunk => {
      input += chunk;
      if (input.includes('\u0003') || input.length > 65536) { finish(); reject(new Error('Input cancelled or too long.')); }
      else if (input.includes('\n')) { finish(); resolve(input); }
    };
    process.stdin.setEncoding('utf8'); process.stdin.on('data', onData); process.stdin.resume();
  });
  let request;
  try { request = JSON.parse(raw); } catch { throw new Error('Invalid checkpoint JSON.'); }
  credential = request.credential;
  const url = new URL(credential.remote_url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Unexpected source URL.');
  if (JSON.parse(readFileSync('.openai/hosting.json', 'utf8')).project_id !== 'appgprj_6adbc388d79081918581b93b919d7258') throw new Error('Wrong project.');
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_TRACE') || key === 'GIT_CURL_VERBOSE') delete env[key];
  const local = (args) => execFileSync('git', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = local(['rev-parse', 'HEAD']);
  if (head !== request.expectedCommit || !/^[a-f0-9]{40}$/.test(head)) throw new Error('Source commit changed.');
  if (local(['status', '--porcelain'])) throw new Error('Commit the intended checkpoint before pushing.');
  if (local(['ls-remote', '--get-url', credential.remote_url]) !== credential.remote_url) throw new Error('Source URL rewriting is not allowed.');
  let rewrites = '';
  try { rewrites = local(['config', '--get-regexp', '^url\\..*\\.pushinsteadof$']); } catch (e) { if (e.status !== 1) throw e; }
  if (rewrites.split('\n').some(line => { const prefix = line.match(/^\S+\s+(.+)$/)?.[1]; return prefix && credential.remote_url.startsWith(prefix); })) throw new Error('Push URL rewriting is not allowed.');
  const auth = ['-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false'];
  if (credential.auth_mode === 'http_extra_header') {
    if (typeof credential.token !== 'string' || !credential.token || /[\r\n\0]/.test(credential.token)) throw new Error('Invalid source credential.');
    env.SRA_LOT5_GIT_AUTHORIZATION = `Authorization: Bearer ${credential.token}`;
    auth.push(`--config-env=http.${credential.remote_url}.extraHeader=SRA_LOT5_GIT_AUTHORIZATION`);
  } else if (credential.auth_mode !== 'work_proxy') throw new Error('Unknown source authentication mode.');
  if (env.CODEX_NETWORK_PROXY_ACTIVE === '1' && env.HTTPS_PROXY) {
    try { if (local(['config', '--get-urlmatch', 'http.proxy', credential.remote_url]) === '') auth.push(`--config-env=http.${credential.remote_url}.proxy=HTTPS_PROXY`); }
    catch (e) { if (e.status !== 1) throw e; }
  }
  const network = args => local([...auth, ...args]);
  if (credential.branch !== 'main') throw new Error('Unexpected source branch.');
  network(['fetch', '--no-tags', credential.remote_url, credential.branch]);
  const fetchedMain = local(['rev-parse', 'FETCH_HEAD']);
  if (!/^[a-f0-9]{40}$/.test(fetchedMain)) throw new Error('Invalid fetched source commit.');
  if (request.fetchOnly === true) {
    if (local(['rev-parse', 'HEAD']) !== head || local(['status', '--porcelain'])) throw new Error('Checkout changed during fetch.');
    process.stdout.write(JSON.stringify({ status: 'fetched_and_verified', commit: head, fetchedMain, sourceMerged: false, sitePublicationPerformed: false }) + '\n');
  } else {
  network(['push', credential.remote_url, `${head}:${target}`]);
  const remoteHead = network(['ls-remote', '--heads', credential.remote_url, target]).split(/\s+/)[0];
  if (remoteHead !== head || local(['rev-parse', 'HEAD']) !== head || local(['status', '--porcelain'])) throw new Error('Checkpoint verification failed.');
  process.stdout.write(JSON.stringify({ status: 'pushed_and_verified', commit: head, branch: target, remoteHead, fetchedMain, sitePublicationPerformed: false }) + '\n');
  }
} catch (error) {
  if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false);
  process.stderr.write(clean(error.stderr?.toString() || error.message || 'Checkpoint failed.') + '\n');
  process.exitCode = 1;
}
