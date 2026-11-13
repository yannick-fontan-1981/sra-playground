#!/usr/bin/env node
/** Source-only checkpoint transport. Run the PARENT directly in a retained raw
 * TTY, WITHOUT an outer flock. Supply exactly one ephemeral JSON line after the
 * hidden-input prompt. The parent acquires no lock while awaiting that line.
 * CLI: node checkpoint-transport.mjs --receipt <new local .json path>
 * stdin: {credential:c,mode:'fetch'} or {credential:c,mode:'push',commit:40hex}
 * Only the worker invokes Git, under its supervised shared flock group.
 * No API response, input line, token, header, proxy value or raw Git output is
 * printed or persisted. Receipts contain an explicit allowlist of observations.
 */
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync, writeSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url), HERE = dirname(SELF);
const ROOT = '/workspace/sites/sra-lot6b-20261111/.sites-checkout';
const PROJECT = 'appgprj_6adbc388d79081918581b93b919d7258';
const REMOTE = 'https://git.chatgpt-team.site/1420c261-4288-48ec-92c8-f957ea49ece1/appgprj_6adbc388d79081918581b93b919d7258.git';
const OWN = 'refs/heads/lot6b-selected-rigid-checkpoint-20261111';
const FIVE_C = 'refs/heads/lot5c-recovery-checkpoint-20261111';
const MAIN = 'refs/heads/main';
const LOCK = '/workspace/shared/sra-coordination/performance.lock';
const LANES = ['lot5c', 'lot8a', 'lot10c'];
const MAX_INPUT = 65536, INPUT_MS = 120000, WORKER_MS = 80000, GIT_MS = 50000;
const MAX_GIT_OUTPUT = 4 * 1024 * 1024;
const now = () => new Date().toISOString();
class Refusal extends Error { constructor(code) { super(code); this.code = code; } }
const need = (condition, code) => { if (!condition) throw new Refusal(code); };
const safeCode = error => error instanceof Refusal ? error.code : 'INTERNAL_ERROR_REDACTED';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function args() {
  const list = process.argv.slice(2), worker = list[0] === '--worker';
  if (worker) list.shift();
  need(list.length === 2 && list[0] === '--receipt', 'EXPECTED_RECEIPT_ARGUMENT');
  const receipt = resolve(ROOT, list[1]), rel = relative(HERE, receipt);
  need(rel && !rel.startsWith('..') && !isAbsolute(rel) && /^[a-zA-Z0-9_.-]+\.json$/.test(rel), 'RECEIPT_OUTSIDE_CHECKPOINT_DIRECTORY');
  need(realpathSync(dirname(receipt)) === realpathSync(HERE) && !existsSync(receipt), 'RECEIPT_MUST_BE_NEW');
  return { worker, receipt };
}
function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^GIT_(?:TRACE.*|CURL_VERBOSE|CONFIG.*|ASKPASS|SSH.*|DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES)$/i.test(key)
        || ['SRA_CHECKPOINT_AUTHORIZATION', 'NODE_OPTIONS', 'NODE_DEBUG'].includes(key)) delete env[key];
  }
  env.GIT_TERMINAL_PROMPT = '0'; env.GIT_ASKPASS = '/bin/false'; env.SSH_ASKPASS = '/bin/false';
  env.GIT_OPTIONAL_LOCKS = '0';
  return env;
}
function decode(line) {
  need(Buffer.byteLength(line) <= MAX_INPUT && !/[\r\n\0]/.test(line), 'INPUT_MUST_BE_ONE_JSON_LINE');
  let value; try { value = JSON.parse(line); } catch { throw new Refusal('INVALID_INPUT_JSON'); }
  need(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_ENVELOPE');
  need(Object.keys(value).every(key => ['credential', 'mode', 'commit'].includes(key)), 'UNKNOWN_ENVELOPE_FIELD');
  need(['fetch', 'push'].includes(value.mode), 'INVALID_MODE');
  const c = value.credential;
  need(c && typeof c === 'object' && !Array.isArray(c), 'INVALID_CREDENTIAL');
  need(c.remote_url === REMOTE && c.branch === 'main' && c.publish_on_push_accepted !== true, 'AUTH_SCOPE_REFUSED');
  need(['work_proxy', 'http_extra_header'].includes(c.auth_mode), 'AUTH_MODE_REFUSED');
  if (c.auth_mode === 'http_extra_header') {
    need(typeof c.token === 'string' && c.token.length > 0 && c.token.length <= 16384 && !/[\r\n\0]/.test(c.token), 'INVALID_EPHEMERAL_TOKEN');
  }
  if (c.token_expires_at !== undefined) need(typeof c.token_expires_at === 'string' && Number.isFinite(Date.parse(c.token_expires_at)) && Date.parse(c.token_expires_at) > Date.now(), 'CREDENTIAL_EXPIRED_OR_INVALID');
  if (value.mode === 'push') need(typeof value.commit === 'string' && /^[0-9a-f]{40}$/.test(value.commit), 'EXPECTED_EXACT_COMMIT');
  else need(value.commit === undefined, 'FETCH_COMMIT_NOT_ALLOWED');
  return value;
}
async function hiddenLine() {
  need(process.stdin.isTTY && typeof process.stdin.setRawMode === 'function', 'RAW_TTY_REQUIRED');
  process.stdin.setRawMode(true); process.stdin.setEncoding('utf8');
  return await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => finish(new Refusal('INPUT_DEADLINE')), INPUT_MS);
    const onEnd = () => finish(new Refusal('INPUT_ENDED_WITHOUT_LINE'));
    function finish(error, line) {
      clearTimeout(timer); process.stdin.off('data', onData); process.stdin.off('end', onEnd);
      process.stdin.off('error', onError); process.stdin.pause(); text = '';
      if (error) reject(error); else resolve(line);
    }
    const onError = () => finish(new Refusal('INPUT_IO_FAILURE'));
    function onData(chunk) {
      text += chunk;
      if (Buffer.byteLength(text) > MAX_INPUT || /[\x03\x04\0]/.test(text)) return finish(new Refusal('INPUT_CANCELLED_OR_TOO_LARGE'));
      const match = /\r\n|\r|\n/.exec(text);
      if (!match) return;
      if (text.slice(match.index + match[0].length).length !== 0) return finish(new Refusal('MULTIPLE_INPUT_LINES'));
      finish(null, text.slice(0, match.index));
    }
    process.stdin.on('data', onData); process.stdin.once('end', onEnd); process.stdin.once('error', onError);
    process.stdin.resume();
    writeSync(1, 'Ready for checkpoint transport JSON on stdin (hidden; no lock acquired by this helper).\n');
  });
}
async function pipeLine() {
  need(!process.stdin.isTTY, 'WORKER_REQUIRES_EPHEMERAL_PIPE');
  return await new Promise((resolve, reject) => {
    let chunks = [], bytes = 0;
    const timer = setTimeout(() => finish(new Refusal('WORKER_INPUT_DEADLINE')), 5000);
    function finish(error, value) { clearTimeout(timer); process.stdin.removeAllListeners('data'); process.stdin.pause(); chunks = []; error ? reject(error) : resolve(value); }
    process.stdin.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_INPUT + 2) finish(new Refusal('WORKER_INPUT_TOO_LARGE')); else chunks.push(chunk); });
    process.stdin.once('error', () => finish(new Refusal('WORKER_INPUT_IO_FAILURE')));
    process.stdin.once('end', () => { const input = Buffer.concat(chunks).toString('utf8'); needLine(input); });
    function needLine(input) { if (!/^[^\r\n]+\r?\n$/.test(input)) finish(new Refusal('WORKER_EXPECTS_EXACTLY_ONE_LINE')); else finish(null, input.replace(/\r?\n$/, '')); }
  });
}
const emit = value => writeSync(1, JSON.stringify({ transportProtocol: 1, ...value }) + '\n');
function quietGuard() {
  const observations = [];
  for (const lane of LANES) {
    let status; try { status = JSON.parse(readFileSync('/workspace/shared/sra-coordination/' + lane + '-status.json', 'utf8')); }
    catch { throw new Refusal('QUIET_STATUS_UNREADABLE'); }
    need(status && typeof status === 'object', 'QUIET_STATUS_INVALID');
    const present = Object.hasOwn(status, 'quiet_requested'), requested = status.quiet_requested;
    need(!present || typeof requested === 'boolean', 'QUIET_FLAG_INVALID');
    observations.push({ lane, fieldPresent: present, quietRequested: present ? requested : null });
    need(requested !== true, 'QUIET_REQUESTED');
  }
  return observations;
}
function groupExists(pid) { try { process.kill(-pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }
function signalGroup(pid, signal) { try { process.kill(-pid, signal); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } }

async function worker() {
  need(process.env.SRA_CHECKPOINT_INTERNAL_WORKER === '1', 'WORKER_MUST_BE_LAUNCHED_BY_PARENT');
  const proc = readFileSync('/proc/self/stat', 'utf8');
  const pgid = Number(proc.slice(proc.lastIndexOf(')') + 2).trim().split(/\s+/)[2]);
  need(Number.isSafeInteger(pgid) && pgid > 1 && pgid === process.ppid && pgid !== process.pid, 'UNEXPECTED_FLOCK_PROCESS_GROUP');
  function hardAbort(code) { try { emit({ type: 'abort', code }); } finally { signalGroup(pgid, 'SIGKILL'); } }
  const deadline = setTimeout(() => hardAbort('WORKER_TIME_LIMIT'), WORKER_MS);
  const startedAt = now(), commands = [];
  let request = null, env = cleanEnv(), result;
  try {
    request = decode(await pipeLine());
    const guards = quietGuard();
    need(realpathSync(ROOT) === realpathSync(resolve(HERE, '../../../../..')), 'CHECKOUT_SCOPE_REFUSED');
    let hosting; try { hosting = JSON.parse(readFileSync(resolve(ROOT, '.openai/hosting.json'), 'utf8')); }
    catch { throw new Refusal('HOSTING_METADATA_UNREADABLE'); }
    need(hosting.project_id === PROJECT, 'HOSTING_PROJECT_REFUSED'); hosting = null;
    const config = ['-C', ROOT, '-c', 'credential.helper=', '-c', 'http.extraHeader=',
      '-c', `http.${REMOTE}.extraHeader=`, '-c', 'http.followRedirects=false', '-c', `http.${REMOTE}.followRedirects=false`,
      '-c', 'gc.auto=0', '-c', 'maintenance.auto=false',
      '-c', 'fetch.recurseSubmodules=false', '-c', 'submodule.recurse=false', '-c', 'push.followTags=false'];
    if (request.credential.auth_mode === 'http_extra_header') {
      env.SRA_CHECKPOINT_AUTHORIZATION = 'Authorization: Bearer ' + request.credential.token;
      config.push(`--config-env=http.${REMOTE}.extraHeader=SRA_CHECKPOINT_AUTHORIZATION`);
    }
    async function git(label, argv, { allowMissing = false, limitMs = GIT_MS } = {}) {
      quietGuard();
      const fullArgs = [...config, ...argv], began = now(), tick = performance.now();
      const child = spawn('git', fullArgs, { cwd: ROOT, env, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
      const row = { label, argv: fullArgs, pid: child.pid ?? null, startedAt: began, limitMs };
      emit({ type: 'git_start', ...row });
      let output = [], bytes = 0, stderrBytes = 0, spawnFailed = false;
      const timer = setTimeout(() => hardAbort('GIT_TIME_LIMIT'), limitMs);
      child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > MAX_GIT_OUTPUT) hardAbort('GIT_OUTPUT_LIMIT'); else output.push(chunk); });
      child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes > MAX_GIT_OUTPUT) hardAbort('GIT_OUTPUT_LIMIT'); });
      const terminal = await new Promise(resolve => { child.once('error', () => { spawnFailed = true; }); child.once('close', (code, signal) => resolve({ code, signal })); });
      clearTimeout(timer);
      Object.assign(row, { finishedAt: now(), elapsedMs: performance.now() - tick, exitCode: terminal.code, signal: terminal.signal,
        stdoutBytes: bytes, stderrBytes, childReaped: true, rawOutputRetained: false });
      commands.push(row); emit({ type: 'git_finish', ...row });
      need(!spawnFailed, 'GIT_SPAWN_FAILED');
      need(terminal.code === 0 || allowMissing && terminal.code === 1, 'GIT_COMMAND_FAILED');
      const text = Buffer.concat(output).toString('utf8'); output = []; return { text, code: terminal.code };
    }
    // Proxy values stay in memory; only a boolean is retained.
    let proxyOverrideApplied = false;
    if (process.env.CODEX_NETWORK_PROXY_ACTIVE === '1' && typeof env.HTTPS_PROXY === 'string' && env.HTTPS_PROXY) {
      const proxy = await git('proxy-urlmatch', ['config', '--null', '--get-urlmatch', 'http.proxy', REMOTE], { allowMissing: true, limitMs: 5000 });
      if (proxy.code === 0 && proxy.text === '\0') { config.push(`--config-env=http.${REMOTE}.proxy=HTTPS_PROXY`); proxyOverrideApplied = true; }
    }
    // A local URL rewrite must not redirect this exact-repository transport.
    const effectiveUrl = await git('verify-exact-repository-url', ['ls-remote', '--get-url', REMOTE], { limitMs: 5000 });
    need(effectiveUrl.text.trim() === REMOTE, 'REPOSITORY_URL_REWRITE_REFUSED');
    function refs(text, allowed) {
      const found = {};
      for (const line of text.trim().split('\n').filter(Boolean)) {
        const match = /^([0-9a-f]{40})\t([^\s]+)$/.exec(line);
        need(match && allowed.includes(match[2]) && !Object.hasOwn(found, match[2]), 'UNEXPECTED_REMOTE_REFERENCE');
        found[match[2]] = match[1];
      }
      return found;
    }
    let observation;
    if (request.mode === 'fetch') {
      const before = refs((await git('ls-remote-before-fetch', ['ls-remote', '--heads', REMOTE, MAIN, OWN, FIVE_C])).text, [MAIN, OWN, FIVE_C]);
      need(before[MAIN] && before[FIVE_C], 'REQUIRED_FETCH_REFERENCE_MISSING');
      await git('fetch-main-and-5c', ['fetch', '--no-tags', '--no-recurse-submodules', '--no-auto-maintenance', REMOTE,
        `${MAIN}:refs/remotes/origin/main`, `${FIVE_C}:refs/remotes/origin/${FIVE_C.slice('refs/heads/'.length)}`]);
      const local = (await git('verify-fetched-references', ['rev-parse', '--verify', 'refs/remotes/origin/main'], { limitMs: 5000 })).text.trim();
      const five = (await git('verify-fetched-5c', ['rev-parse', '--verify', `refs/remotes/origin/${FIVE_C.slice('refs/heads/'.length)}`], { limitMs: 5000 })).text.trim();
      need(local === before[MAIN] && five === before[FIVE_C], 'FETCHED_REFERENCE_CHANGED_DURING_TRANSPORT');
      observation = { advertisedBefore: before, fetched: { [MAIN]: local, [FIVE_C]: five } };
    } else {
      need((await git('verify-declared-commit-type', ['cat-file', '-t', request.commit], { limitMs: 5000 })).text.trim() === 'commit', 'DECLARED_OBJECT_IS_NOT_COMMIT');
      const before = refs((await git('ls-remote-before-push', ['ls-remote', '--heads', REMOTE, OWN])).text, [OWN]);
      await git('push-only-own-checkpoint', ['push', '--porcelain', '--no-follow-tags', REMOTE, `${request.commit}:${OWN}`]);
      const after = refs((await git('ls-remote-after-push', ['ls-remote', '--heads', REMOTE, OWN])).text, [OWN]);
      need(after[OWN] === request.commit, 'PUSH_REMOTE_VERIFICATION_FAILED');
      observation = { advertisedBefore: before, verifiedAfter: after, exactDeclaredCommit: request.commit, force: false, mainPushed: false };
    }
    result = { status: 'passed', mode: request.mode, authMode: request.credential.auth_mode, projectId: PROJECT,
      remote: REMOTE, ownRef: OWN, proxyOverrideApplied, guards, observation, commands, startedAt, finishedAt: now() };
  } catch (error) {
    result = { status: 'failed', code: safeCode(error), commands, startedAt, finishedAt: now() };
  } finally { clearTimeout(deadline); delete env.SRA_CHECKPOINT_AUTHORIZATION; request = null; env = null; }
  emit({ type: 'result', result }); process.exitCode = result.status === 'passed' ? 0 : 1;
}

async function supervise(request, receiptPath) {
  const startedAt = now(), tick = performance.now(), events = [];
  const env = cleanEnv(); env.SRA_CHECKPOINT_INTERNAL_WORKER = '1';
  const argv = ['-s', '-w', '2', LOCK, process.execPath, SELF, '--worker', '--receipt', relative(ROOT, receiptPath)];
  const child = spawn('flock', argv, { cwd: ROOT, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '', workerResult = null, abortCode = null, stderrBytes = 0, spawnFailed = false;
  let escalation = null, stopped = false;
  const signals = [];
  function stop(code) {
    if (stopped) return; stopped = true; abortCode = code;
    if (child.pid) { signals.push({ signal: 'SIGTERM', sent: signalGroup(child.pid, 'SIGTERM'), at: now() });
      escalation = setTimeout(() => signals.push({ signal: 'SIGKILL', sent: signalGroup(child.pid, 'SIGKILL'), at: now() }), 2000); }
  }
  const overall = setTimeout(() => stop('SUPERVISOR_TIME_LIMIT'), 85000);
  const interrupt = () => stop('SUPERVISOR_INTERRUPTED');
  process.once('SIGTERM', interrupt); process.once('SIGINT', interrupt);
  child.stdout.on('data', chunk => {
    buffer += chunk.toString('utf8'); if (buffer.length > MAX_GIT_OUTPUT) return stop('WORKER_PROTOCOL_LIMIT');
    while (buffer.includes('\n')) {
      const split = buffer.indexOf('\n'), line = buffer.slice(0, split); buffer = buffer.slice(split + 1);
      let event; try { event = JSON.parse(line); } catch { stop('WORKER_PROTOCOL_INVALID'); continue; }
      if (event?.transportProtocol !== 1 || !['git_start', 'git_finish', 'abort', 'result'].includes(event.type)) { stop('WORKER_PROTOCOL_INVALID'); continue; }
      if (event.type === 'result') workerResult = event.result;
      else { events.push(event); if (event.type === 'abort') stop(event.code); }
    }
  });
  child.stderr.on('data', chunk => { stderrBytes += chunk.length; if (stderrBytes > MAX_GIT_OUTPUT) stop('WORKER_STDERR_LIMIT'); });
  child.stdin.on('error', () => { /* Actual child exit and protocol outcome decide the receipt. */ });
  child.stdin.end(JSON.stringify(request) + '\n'); request = null;
  const terminal = await new Promise(resolve => { child.once('error', () => { spawnFailed = true; }); child.once('close', (code, signal) => resolve({ code, signal })); });
  clearTimeout(overall); if (escalation) clearTimeout(escalation);
  let groupAbsent = child.pid ? !groupExists(child.pid) : true;
  if (!groupAbsent) {
    abortCode ??= 'RESIDUAL_PROCESS_GROUP';
    signals.push({ signal: 'SIGKILL', sent: signalGroup(child.pid, 'SIGKILL'), at: now() });
    const until = performance.now() + Math.min(3000, Math.max(0, 90000 - (performance.now() - tick)));
    while (groupExists(child.pid) && performance.now() < until) await delay(50);
    groupAbsent = !groupExists(child.pid);
  }
  process.off('SIGTERM', interrupt); process.off('SIGINT', interrupt);
  const passed = !spawnFailed && !abortCode && terminal.code === 0 && workerResult?.status === 'passed' && groupAbsent;
  return { schema: 'logos-engine.lot6b-checkpoint-transport-execution.v1', status: passed ? 'passed' : 'failed',
    startedAt, finishedAt: now(), elapsedSeconds: (performance.now() - tick) / 1000,
    launch: ['flock', ...argv], lockAcquiredOnlyAfterInput: true, lockWaitLimitSeconds: 2,
    workerLimitSeconds: 80, gitCommandLimitSeconds: 50, supervisorStopSeconds: 85, cleanupTargetTotalSeconds: 90,
    exitCode: terminal.code, signal: terminal.signal, spawnFailed, abortCode,
    directChildReaped: true, processGroupAbsent: groupAbsent, signals, worker: workerResult, events,
    workerStderrBytes: stderrBytes, rawWorkerStderrRetained: false, rawGitOutputsRetained: false,
    credentialsPersisted: false, indexOrCommitCommandsAllowed: false, publicationRequested: false };
}
async function parent(receiptPath) {
  let request = null, result;
  try { request = decode(await hiddenLine()); result = await supervise(request, receiptPath); }
  catch (error) { result = { schema: 'logos-engine.lot6b-checkpoint-transport-execution.v1', status: 'failed', code: safeCode(error), finishedAt: now(), credentialsPersisted: false }; }
  finally { request = null; if (process.stdin.isTTY) process.stdin.setRawMode(false); process.stdin.pause(); }
  writeFileSync(receiptPath, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  writeSync(1, JSON.stringify({ status: result.status, receipt: relative(ROOT, receiptPath), code: result.code ?? result.abortCode ?? null,
    processGroupAbsent: result.processGroupAbsent ?? null, elapsedSeconds: result.elapsedSeconds ?? null }) + '\n');
  process.exitCode = result.status === 'passed' ? 0 : 1;
}
try { const option = args(); if (option.worker) await worker(); else await parent(option.receipt); }
catch (error) { writeSync(2, JSON.stringify({ status: 'failed', code: safeCode(error), detailsRedacted: true }) + '\n'); process.exitCode = 1; }
