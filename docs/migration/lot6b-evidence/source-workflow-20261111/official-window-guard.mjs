#!/usr/bin/env node
/** Prospective ordinary-work guard. This module never opens a lock file.
 * A preparatory quiet request or a historical started flag is informational.
 * Only an explicit actual official window can defer a new ordinary command.
 * Root must declare its bounded activity before checking, and official owners
 * must obtain fresh terminal/all-worker acknowledgments before first use.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const COORDINATION = '/workspace/shared/sra-coordination';
const LANES = ['lot5c', 'lot6b', 'lot8a', 'lot10c'];
const fail = (code, lane) => { const error = new Error(code); error.code = code; error.lane = lane; throw error; };

// Accept Node UTC and Python UTC (including microseconds), while rejecting
// coercion, local time and calendar rollover. Preserve sub-millisecond expiry.
function utcInstant(value) {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(?:Z|\+00:00)$/.exec(value);
  if (!match) return NaN;
  const whole = Date.parse(match[1] + 'Z');
  if (!Number.isFinite(whole) || new Date(whole).toISOString().slice(0, 19) !== match[1]) return NaN;
  return whole + (match[2] ? Number('0.' + match[2]) * 1000 : 0);
}

export function inspectOfficialWindows(rows, nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) fail('OFFICIAL_CLOCK_INVALID', null);
  const observations = [];
  for (const { lane, status } of rows) {
    if (!status || typeof status !== 'object' || Array.isArray(status)) fail('OFFICIAL_STATUS_INVALID', lane);
    const window = status.official_window;
    const row = { lane, quietRequested: typeof status.quiet_requested === 'boolean' ? status.quiet_requested : null,
      preparatoryQuietIsAGate: false, actualWindow: null };
    if (window === undefined || window === null) { observations.push(row); continue; }
    if (typeof window !== 'object' || Array.isArray(window)) fail('OFFICIAL_WINDOW_INVALID', lane);
    if (!['preparing', 'released', 'active'].includes(window.state)) fail('OFFICIAL_WINDOW_STATE_INVALID', lane);
    if (window.state !== 'active') {
      row.actualWindow = { state: typeof window.state === 'string' ? window.state : null, blocksOrdinaryWork: false };
      observations.push(row); continue;
    }
    const start = utcInstant(window.startedAt), deadline = utcInstant(window.deadlineAt);
    if (typeof window.id !== 'string' || !window.id.trim() || window.owner !== lane ||
        !['performance', 'publication'].includes(window.kind) ||
        !Number.isFinite(start) || !Number.isFinite(deadline) || start > nowMs || deadline <= start ||
        window.releasedAt !== null) fail('OFFICIAL_ACTIVE_WINDOW_INVALID', lane);
    // Expiry is not evidence that an owner released its descriptor. Fail once;
    // never poll indefinitely, steal, unlink, or replace an owner's mutex.
    if (deadline <= nowMs) fail('OFFICIAL_WINDOW_EXPIRED_NEEDS_OWNER_CLOSURE', lane);
    fail('OFFICIAL_WINDOW_ACTIVE', lane);
  }
  return observations;
}

export function assertNoActiveOfficialWindow() {
  const rows = LANES.map(lane => {
    let status;
    try { status = JSON.parse(readFileSync(`${COORDINATION}/${lane}-status.json`, 'utf8')); }
    catch { fail('OFFICIAL_STATUS_UNREADABLE', lane); }
    return { lane, status };
  });
  return inspectOfficialWindows(rows);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(JSON.stringify({ status: 'passed', globalLockAcquired: false,
    observations: assertNoActiveOfficialWindow() }) + '\n'); }
  catch (error) { process.stdout.write(JSON.stringify({ status: 'deferred', code: error.code ?? 'OFFICIAL_UNKNOWN_ERROR',
    lane: error.lane ?? null, globalLockAcquired: false, automaticRetry: false }) + '\n'); process.exitCode = 1; }
}
