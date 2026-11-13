import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browserGameRuntimeObservationIdentity,
  type BrowserGameRuntimeCheckpointV1,
  type GameObservation,
} from '../src/runtime/browser-games.ts';
import {
  BrowserDurableSessionAutosave,
  browserDurableSessionContentIdentity,
} from '../src/runtime/v6-browser-durable-autosave.ts';
import {
  createBrowserDurableSessionCheckpoint,
  type BrowserDurableSessionCheckpointV1,
} from '../src/runtime/v6-browser-durable-session.ts';
import type { BrowserAgentControllerCheckpointV1 } from '../src/runtime/v6-browser-agent-controller.ts';
import { createPublicSingleActionBrowserCampaignHost } from '../src/runtime/v6-browser-common-campaign-host.ts';

function observation(overrides: Partial<GameObservation> = {}): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds: [1],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 1,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

function checkpoint(
  options: {
    savedAtMs?: number;
    mode?: 'manual' | 'agent';
    selectionGeneration?: number;
    current?: GameObservation;
  } = {},
): BrowserDurableSessionCheckpointV1 {
  const current = options.current ?? observation();
  const host = createPublicSingleActionBrowserCampaignHost();
  host.begin({ sessionId: 'autosave-session', observation: current });
  const runtime: BrowserGameRuntimeCheckpointV1 = {
    version: 1,
    gameCode: current.gameCode,
    entries: [{
      sequence: 1,
      request: { type: 'load', code: current.gameCode },
      observationIdentity: browserGameRuntimeObservationIdentity(current),
    }],
    pending: null,
  };
  const agent: BrowserAgentControllerCheckpointV1 = {
    version: 1,
    host: host.snapshot(),
    actionsDispatched: 0,
    sessionOrdinal: 1,
    pendingDispatchCounted: false,
  };
  return createBrowserDurableSessionCheckpoint({
    runtime,
    agent,
    selectionGeneration: options.selectionGeneration ?? 1,
    mode: options.mode ?? 'agent',
    savedAtMs: options.savedAtMs ?? 1_000,
    ttlMs: 10_000,
  });
}

test('autosave content identity ignores TTL renewal but includes live product state', () => {
  const first = checkpoint({ savedAtMs: 1_000 });
  const renewed = checkpoint({ savedAtMs: 2_000 });
  const manual = checkpoint({ savedAtMs: 2_000, mode: 'manual' });
  const nextGeneration = checkpoint({ savedAtMs: 2_000, selectionGeneration: 2 });

  assert.equal(
    browserDurableSessionContentIdentity(first),
    browserDurableSessionContentIdentity(renewed),
  );
  assert.notEqual(
    browserDurableSessionContentIdentity(first),
    browserDurableSessionContentIdentity(manual),
  );
  assert.notEqual(
    browserDurableSessionContentIdentity(first),
    browserDurableSessionContentIdentity(nextGeneration),
  );
});

test('scheduled safe-boundary notifications are coalesced into one durable write', () => {
  const scheduled: Array<() => void> = [];
  const saved: BrowserDurableSessionCheckpointV1[] = [];
  const autosave = new BrowserDurableSessionAutosave({
    capture: () => checkpoint(),
    save: value => {
      saved.push(value);
      return { status: 'saved', bytes: 123 };
    },
    schedule: callback => { scheduled.push(callback); },
  });

  autosave.request();
  autosave.request();
  autosave.request();
  assert.equal(scheduled.length, 1);
  scheduled.shift()?.();
  assert.equal(saved.length, 1);

  autosave.request();
  scheduled.shift()?.();
  assert.equal(saved.length, 1, 'identical state should not rewrite durable storage');
});

test('unsafe and failed captures preserve the last successful crash checkpoint', () => {
  let current: BrowserDurableSessionCheckpointV1 | null = checkpoint();
  let captureFailure: unknown = null;
  let writes = 0;
  const autosave = new BrowserDurableSessionAutosave({
    capture: () => {
      if (captureFailure) throw captureFailure;
      return current;
    },
    save: () => {
      writes += 1;
      return { status: 'saved', bytes: 123 };
    },
  });

  assert.equal(autosave.flush().status, 'saved');
  assert.equal(writes, 1);

  current = null;
  assert.equal(autosave.flush().status, 'unsafe');
  assert.equal(writes, 1);

  captureFailure = new Error('between safe boundaries');
  assert.equal(autosave.flush().status, 'capture-failed');
  assert.equal(writes, 1);

  captureFailure = null;
  current = checkpoint({ savedAtMs: 5_000 });
  assert.equal(autosave.flush().status, 'unchanged');
  assert.equal(writes, 1, 'failed attempts must not erase or replace the last good identity');
});

test('a failed durable write is retried for the same live state', () => {
  let attempts = 0;
  const autosave = new BrowserDurableSessionAutosave({
    capture: () => checkpoint(),
    save: () => {
      attempts += 1;
      return attempts === 1
        ? { status: 'unavailable', error: new Error('quota temporarily unavailable') }
        : { status: 'saved', bytes: 123 };
    },
  });

  assert.equal(autosave.flush().status, 'unavailable');
  assert.equal(autosave.flush().status, 'saved');
  assert.equal(autosave.flush().status, 'unchanged');
  assert.equal(attempts, 2);
});

test('reset invalidates queued work after explicit product invalidation', () => {
  const scheduled: Array<() => void> = [];
  let writes = 0;
  const autosave = new BrowserDurableSessionAutosave({
    capture: () => checkpoint(),
    save: () => {
      writes += 1;
      return { status: 'saved', bytes: 123 };
    },
    schedule: callback => { scheduled.push(callback); },
  });

  autosave.request();
  autosave.reset();
  scheduled.shift()?.();
  assert.equal(writes, 0);

  autosave.request();
  scheduled.shift()?.();
  assert.equal(writes, 1);
});

test('priming from an existing localStorage checkpoint avoids a redundant rewrite', () => {
  let writes = 0;
  const existing = checkpoint({ savedAtMs: 1_000 });
  const autosave = new BrowserDurableSessionAutosave({
    capture: () => checkpoint({ savedAtMs: 9_000 }),
    save: () => {
      writes += 1;
      return { status: 'saved', bytes: 123 };
    },
  });

  autosave.prime(existing);
  assert.equal(autosave.flush().status, 'unchanged');
  assert.equal(writes, 0);
});
