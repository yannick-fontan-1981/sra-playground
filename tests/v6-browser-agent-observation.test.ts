import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import {
  BrowserAgentObservationStream,
  toAgentObservationFromGame,
} from '../src/runtime/v6-browser-agent-observation.ts';

function gameObservation(overrides: Partial<GameObservation> = {}): GameObservation {
  return {
    gameCode: 'TEST',
    frame: Array.from({ length: 64 }, () => Array(64).fill(3)),
    frames: [],
    state: 'NOT_FINISHED',
    availableActionIds: [1, 1, 2],
    canUndo: false,
    canSelectLevel: false,
    level: 1,
    levelCount: 2,
    levelsCompleted: 0,
    defaultFps: 5,
    ...overrides,
  };
}

test('browser observation adapter copies only the public 64x64 frame and deduplicates actions', () => {
  const source = gameObservation();
  source.frame[0]![0] = 8;
  const converted = toAgentObservationFromGame(source, 'session-a', 4);
  assert.equal(converted.image.pixels.length, 4096);
  assert.equal(converted.image.pixels[0], 8);
  assert.deepEqual(converted.availableActionIds, [1, 2]);
  source.frame[0]![0] = 4;
  assert.equal(converted.image.pixels[0], 8);
  assert.equal(converted.sessionId, 'session-a');
  assert.equal(converted.sequence, 4);
});

test('observation stream assigns monotonic sequences only after successful conversion', () => {
  const stream = new BrowserAgentObservationStream({
    sessionId: 'session-a',
    gameCode: 'TEST',
  });
  assert.equal(stream.next(gameObservation()).sequence, 0);
  assert.equal(stream.next(gameObservation()).sequence, 1);
  assert.equal(stream.nextSequence, 2);
  assert.throws(
    () => stream.next(gameObservation({ gameCode: 'OTHER' })),
    /stream game/,
  );
  assert.equal(stream.nextSequence, 2);
});

test('adapter rejects malformed or non-public observations', () => {
  assert.throws(
    () => toAgentObservationFromGame(gameObservation({ frame: [[3]] }), 's', 0),
    /64 rows/,
  );
  const invalid = gameObservation();
  invalid.frame[2]![3] = 16;
  assert.throws(
    () => toAgentObservationFromGame(invalid, 's', 0),
    /palette indices/,
  );
  assert.throws(
    () => toAgentObservationFromGame(gameObservation({ state: 'GAME_OVER' }), 's', 0),
    /not representable/,
  );
  assert.throws(
    () => toAgentObservationFromGame(gameObservation({ availableActionIds: [9] }), 's', 0),
    /action ids/,
  );
});
