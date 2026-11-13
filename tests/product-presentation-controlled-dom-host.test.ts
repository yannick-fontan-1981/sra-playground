import assert from 'node:assert/strict';
import test from 'node:test';
import {
  presentProductObservation,
  type ProductPresentationEffectPorts,
} from '../src/product-presentation-effects.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

function observation(overrides: Partial<GameObservation> = {}): GameObservation {
  return {
    gameCode: 'CASC',
    frame: [[9]],
    frames: [[[1]], [[2]]],
    frameDurationsMs: [25],
    state: 'LEVEL_COMPLETE',
    availableActionIds: [1, 2, 3, 4, 5, 6],
    canUndo: true,
    canSelectLevel: false,
    level: 2,
    levelCount: 6,
    levelsCompleted: 1,
    defaultFps: 10,
    ...overrides,
  };
}

function controlledDomHarness(initialHref = 'https://example.test/play?mode=manual#board') {
  let selectionGeneration = 7;
  let presentationGeneration = 11;
  let selectedGameCode = 'CASC';
  let currentObservation: GameObservation | null = null;
  let loading = true;
  let failed = true;
  let busy = true;
  let href = initialHref;
  let feedback = 'previous feedback';

  const historyReplacements: string[] = [];
  const paints: Array<{ pixel: number | undefined; palette: string | undefined }> = [];
  const waits: number[] = [];
  let interfaceUpdates = 0;

  const ports: ProductPresentationEffectPorts = {
    currentSelectionGeneration: () => selectionGeneration,
    currentPresentationGeneration: () => presentationGeneration,
    nextPresentationGeneration: () => ++presentationGeneration,
    selectedGameCode: () => selectedGameCode,
    setObservation: value => { currentObservation = value; },
    setLoading: value => { loading = value; },
    setFailed: value => { failed = value; },
    syncLocation: value => {
      const url = new URL(href);
      url.searchParams.set('game', value.gameCode);
      url.searchParams.set('level', String(value.level));
      if (url.href !== href) {
        href = url.href;
        historyReplacements.push(url.href);
      }
    },
    updateInterface: () => { interfaceUpdates += 1; },
    paint: (frame, palette) => paints.push({ pixel: frame[0]?.[0], palette: palette[0] }),
    wait: async delayMs => { waits.push(delayMs); },
    setBusy: value => { busy = value; },
    setFeedback: message => { feedback = message; },
  };

  return {
    ports,
    state: () => ({
      selectionGeneration,
      presentationGeneration,
      selectedGameCode,
      currentObservation,
      loading,
      failed,
      busy,
      href,
      feedback,
      historyReplacements: [...historyReplacements],
      paints: [...paints],
      waits: [...waits],
      interfaceUpdates,
    }),
    setSelectionGeneration: (value: number) => { selectionGeneration = value; },
    setPresentationGeneration: (value: number) => { presentationGeneration = value; },
    setSelectedGameCode: (value: string) => { selectedGameCode = value; },
  };
}

test('controlled DOM host preserves URL state, paint order, interface updates and terminal feedback', async () => {
  const host = controlledDomHarness();
  const next = observation({ palette: ['custom'] });

  const result = await presentProductObservation(next, 7, host.ports, {
    fallbackPalette: ['fallback'],
  });

  assert.equal(result.accepted, true);
  assert.equal(result.stale, false);
  assert.deepEqual(host.state(), {
    selectionGeneration: 7,
    presentationGeneration: 12,
    selectedGameCode: 'CASC',
    currentObservation: next,
    loading: false,
    failed: false,
    busy: false,
    href: 'https://example.test/play?mode=manual&game=CASC&level=2#board',
    feedback: 'Level 2 complete.',
    historyReplacements: ['https://example.test/play?mode=manual&game=CASC&level=2#board'],
    paints: [
      { pixel: 1, palette: 'custom' },
      { pixel: 2, palette: 'custom' },
      { pixel: 9, palette: 'custom' },
    ],
    waits: [25],
    interfaceUpdates: 2,
  });
});

test('already synchronized URL avoids a redundant history replacement', async () => {
  const host = controlledDomHarness('https://example.test/play?mode=manual&game=CASC&level=2#board');

  await presentProductObservation(observation(), 7, host.ports, {
    fallbackPalette: ['fallback'],
  });

  assert.deepEqual(host.state().historyReplacements, []);
  assert.equal(host.state().href, 'https://example.test/play?mode=manual&game=CASC&level=2#board');
});

test('mismatched selected game produces no DOM, history, paint or state effects', async () => {
  const host = controlledDomHarness();
  host.setSelectedGameCode('KLOT');
  const before = host.state();

  const result = await presentProductObservation(observation(), 7, host.ports, {
    fallbackPalette: ['fallback'],
  });

  assert.equal(result.stale, true);
  assert.deepEqual(host.state(), before);
});

test('selection change during animation prevents final paint, feedback and busy release', async () => {
  const host = controlledDomHarness();
  host.ports.wait = async delayMs => {
    const state = host.state();
    assert.deepEqual(state.waits, []);
    host.setSelectionGeneration(8);
    assert.equal(delayMs, 25);
  };

  const result = await presentProductObservation(observation(), 7, host.ports, {
    fallbackPalette: ['fallback'],
  });
  const state = host.state();

  assert.deepEqual(result, {
    accepted: false,
    stale: true,
    presentationGeneration: 12,
    animationFramesPainted: 1,
    finalFramePainted: false,
  });
  assert.deepEqual(state.paints, [{ pixel: 1, palette: 'fallback' }]);
  assert.equal(state.busy, true);
  assert.equal(state.feedback, 'previous feedback');
  assert.equal(state.interfaceUpdates, 1);
});

test('superseding presentation during animation prevents final DOM effects', async () => {
  const host = controlledDomHarness();
  host.ports.wait = async () => { host.setPresentationGeneration(13); };

  const result = await presentProductObservation(observation(), 7, host.ports, {
    fallbackPalette: ['fallback'],
  });
  const state = host.state();

  assert.equal(result.stale, true);
  assert.equal(result.finalFramePainted, false);
  assert.deepEqual(state.paints, [{ pixel: 1, palette: 'fallback' }]);
  assert.equal(state.busy, true);
  assert.equal(state.feedback, 'previous feedback');
});

test('dispatch-owned presentation keeps busy while still updating URL, final paint and feedback', async () => {
  const host = controlledDomHarness();

  const result = await presentProductObservation(observation(), 7, host.ports, {
    fallbackPalette: ['fallback'],
    releaseBusy: false,
  });
  const state = host.state();

  assert.equal(result.accepted, true);
  assert.equal(state.busy, true);
  assert.equal(state.interfaceUpdates, 1);
  assert.equal(state.historyReplacements.length, 1);
  assert.equal(state.paints.at(-1)?.pixel, 9);
  assert.equal(state.feedback, 'Level 2 complete.');
});
