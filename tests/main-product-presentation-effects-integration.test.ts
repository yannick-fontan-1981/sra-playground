import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');

function presentSource(): string {
  const match = main.match(/async function present\(next: GameObservation, selectedGeneration: number, releaseBusy = true\): Promise<void> \{[\s\S]*?\n\}\n\nfunction showFailure/);
  assert.ok(match, 'present() must remain a distinct product boundary');
  return match[0];
}

test('main delegates product presentation effects to the shared port', () => {
  assert.match(main, /import \{ presentProductObservation \} from '\.\/product-presentation-effects';/);
  assert.doesNotMatch(main, /from '\.\/product-presentation';/);
  assert.match(presentSource(), /await presentProductObservation\(next, selectedGeneration/);
});

test('main exposes the live generation and selected-game owners to the presentation port', () => {
  const source = presentSource();
  assert.match(source, /currentSelectionGeneration: \(\) => selectionGeneration/);
  assert.match(source, /currentPresentationGeneration: \(\) => presentationGeneration/);
  assert.match(source, /nextPresentationGeneration: \(\) => \{\s*presentationGeneration \+= 1;\s*return presentationGeneration;\s*\}/s);
  assert.match(source, /selectedGameCode: \(\) => selectedGame\.code/);
});

test('main presentation ports preserve the historical DOM and state effects', () => {
  const source = presentSource();
  assert.match(source, /setObservation: value => \{ observation = value; \}/);
  assert.match(source, /setLoading: value => \{ loading = value; \}/);
  assert.match(source, /setFailed: value => \{ failed = value; \}/);
  assert.match(source, /window\.history\.replaceState\(null, '', url\)/);
  assert.match(source, /updateInterface,/);
  assert.match(source, /paint: \(frame, palette\) => paint\(frame, palette\)/);
  assert.match(source, /window\.setTimeout\(resolve, delayMs\)/);
  assert.match(source, /setBusy: value => \{ busy = value; \}/);
  assert.match(source, /element\('#game-feedback'\)\.textContent = message/);
  assert.match(source, /\{ fallbackPalette, releaseBusy \}/);
});

test('main no longer duplicates deterministic frame, timing, stale or feedback rules', () => {
  const source = presentSource();
  assert.doesNotMatch(source, /presentationFrames\(/);
  assert.doesNotMatch(source, /presentationFrameDurationMs\(/);
  assert.doesNotMatch(source, /presentationFeedback\(/);
  assert.doesNotMatch(source, /isPresentationCurrent\(/);
  assert.doesNotMatch(source, /isPresentationLoopCurrent\(/);
});
