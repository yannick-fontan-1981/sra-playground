import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPresentationCurrent,
  presentationFeedback,
  presentationFrameDurationMs,
  presentationFrames,
} from '../src/product-presentation.ts';

test('presentation validity requires both current selection generation and selected game', () => {
  assert.equal(isPresentationCurrent(4, 4, 'CASC', 'CASC'), true);
  assert.equal(isPresentationCurrent(3, 4, 'CASC', 'CASC'), false);
  assert.equal(isPresentationCurrent(4, 4, 'OTHER', 'CASC'), false);
});

test('explicit animation frames are preserved', () => {
  const frames = [[[1]], [[2]]];
  assert.equal(presentationFrames({ frames, frame: [[9]] }), frames);
});

test('empty animation frames fall back to the final frame', () => {
  assert.deepEqual(presentationFrames({ frames: [], frame: [[9]] }), [[[9]]]);
});

test('explicit non-negative frame duration overrides default fps timing', () => {
  assert.equal(presentationFrameDurationMs({ frameDurationsMs: [0, 25], defaultFps: 10 }, 0), 0);
  assert.equal(presentationFrameDurationMs({ frameDurationsMs: [0, 25], defaultFps: 10 }, 1), 25);
});

test('invalid explicit frame duration falls back to clamped fps timing', () => {
  assert.equal(presentationFrameDurationMs({ frameDurationsMs: [-1], defaultFps: 20 }, 0), 50);
  assert.equal(presentationFrameDurationMs({ frameDurationsMs: [Number.NaN], defaultFps: 20 }, 0), 50);
});

test('default fps keeps historical fallback and clamp semantics', () => {
  assert.equal(presentationFrameDurationMs({ defaultFps: 0 }, 0), 100);
  assert.equal(presentationFrameDurationMs({ defaultFps: 120 }, 0), 1000 / 60);
  assert.equal(presentationFrameDurationMs({ defaultFps: 0.25 }, 0), 1000);
});

test('completion states produce level-complete feedback', () => {
  assert.equal(presentationFeedback({ state: 'WIN', level: 3 }), 'Level 3 complete.');
  assert.equal(presentationFeedback({ state: 'LEVEL_COMPLETE', level: 2 }), 'Level 2 complete.');
});

test('game-over states produce recovery feedback and normal states stay silent', () => {
  assert.equal(presentationFeedback({ state: 'GAME_OVER', level: 1 }), 'Game over. Undo or reset to continue.');
  assert.equal(presentationFeedback({ state: 'GAMEOVER', level: 1 }), 'Game over. Undo or reset to continue.');
  assert.equal(presentationFeedback({ state: 'NOT_FINISHED', level: 1 }), '');
});
