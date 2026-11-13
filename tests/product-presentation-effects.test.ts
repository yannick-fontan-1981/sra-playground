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

function harness() {
  const events: string[] = [];
  let selectionGeneration = 7;
  let presentationGeneration = 11;
  let selectedGameCode = 'CASC';

  const ports: ProductPresentationEffectPorts = {
    currentSelectionGeneration: () => selectionGeneration,
    currentPresentationGeneration: () => presentationGeneration,
    nextPresentationGeneration: () => {
      presentationGeneration += 1;
      events.push(`presentation:${presentationGeneration}`);
      return presentationGeneration;
    },
    selectedGameCode: () => selectedGameCode,
    setObservation: value => events.push(`observation:${value.gameCode}:${value.level}`),
    setLoading: value => events.push(`loading:${value}`),
    setFailed: value => events.push(`failed:${value}`),
    syncLocation: value => events.push(`location:${value.gameCode}:${value.level}`),
    updateInterface: () => events.push('interface'),
    paint: (frame, palette) => events.push(`paint:${frame[0]?.[0]}:${palette[0]}`),
    wait: async delayMs => { events.push(`wait:${delayMs}`); },
    setBusy: value => events.push(`busy:${value}`),
    setFeedback: message => events.push(`feedback:${message}`),
  };

  return {
    events,
    ports,
    setSelectionGeneration: (value: number) => { selectionGeneration = value; },
    setPresentationGeneration: (value: number) => { presentationGeneration = value; },
    setSelectedGameCode: (value: string) => { selectedGameCode = value; },
  };
}

test('happy path preserves effect ordering and paints the final frame after animation', async () => {
  const { events, ports } = harness();
  const result = await presentProductObservation(observation(), 7, ports, {
    fallbackPalette: ['fallback'],
  });

  assert.deepEqual(result, {
    accepted: true,
    stale: false,
    presentationGeneration: 12,
    animationFramesPainted: 2,
    finalFramePainted: true,
  });
  assert.deepEqual(events, [
    'presentation:12',
    'observation:CASC:2',
    'loading:false',
    'failed:false',
    'location:CASC:2',
    'interface',
    'paint:1:fallback',
    'wait:25',
    'paint:2:fallback',
    'paint:9:fallback',
    'busy:false',
    'interface',
    'feedback:Level 2 complete.',
  ]);
});

test('observation palette overrides the fallback palette', async () => {
  const { events, ports } = harness();
  await presentProductObservation(observation({ palette: ['custom'] }), 7, ports, {
    fallbackPalette: ['fallback'],
  });
  assert.equal(events.filter(event => event.startsWith('paint:')).every(event => event.endsWith(':custom')), true);
});

test('stale selection or mismatched game produces no effects', async () => {
  const first = harness();
  first.setSelectionGeneration(8);
  const staleGeneration = await presentProductObservation(observation(), 7, first.ports, {
    fallbackPalette: ['fallback'],
  });
  assert.equal(staleGeneration.stale, true);
  assert.deepEqual(first.events, []);

  const second = harness();
  second.setSelectedGameCode('KLOT');
  const staleGame = await presentProductObservation(observation(), 7, second.ports, {
    fallbackPalette: ['fallback'],
  });
  assert.equal(staleGame.stale, true);
  assert.deepEqual(second.events, []);
});

test('selection becoming stale during wait prevents later and final effects', async () => {
  const h = harness();
  h.ports.wait = async delayMs => {
    h.events.push(`wait:${delayMs}`);
    h.setSelectionGeneration(8);
  };

  const result = await presentProductObservation(observation(), 7, h.ports, {
    fallbackPalette: ['fallback'],
  });

  assert.deepEqual(result, {
    accepted: false,
    stale: true,
    presentationGeneration: 12,
    animationFramesPainted: 1,
    finalFramePainted: false,
  });
  assert.deepEqual(h.events, [
    'presentation:12',
    'observation:CASC:2',
    'loading:false',
    'failed:false',
    'location:CASC:2',
    'interface',
    'paint:1:fallback',
    'wait:25',
  ]);
});

test('superseding presentation during wait prevents final paint, busy release and feedback', async () => {
  const h = harness();
  h.ports.wait = async delayMs => {
    h.events.push(`wait:${delayMs}`);
    h.setPresentationGeneration(13);
  };

  const result = await presentProductObservation(observation(), 7, h.ports, {
    fallbackPalette: ['fallback'],
  });

  assert.equal(result.stale, true);
  assert.equal(result.finalFramePainted, false);
  assert.equal(h.events.some(event => event === 'busy:false'), false);
  assert.equal(h.events.some(event => event.startsWith('feedback:')), false);
  assert.equal(h.events.some(event => event === 'paint:9:fallback'), false);
});

test('releaseBusy false preserves dispatch ownership while still publishing feedback', async () => {
  const { events, ports } = harness();
  const result = await presentProductObservation(observation(), 7, ports, {
    fallbackPalette: ['fallback'],
    releaseBusy: false,
  });

  assert.equal(result.accepted, true);
  assert.equal(events.includes('busy:false'), false);
  assert.equal(events.filter(event => event === 'interface').length, 1);
  assert.equal(events.includes('feedback:Level 2 complete.'), true);
});

test('non-terminal presentation leaves feedback unchanged', async () => {
  const { events, ports } = harness();
  await presentProductObservation(observation({ state: 'NOT_FINISHED' }), 7, ports, {
    fallbackPalette: ['fallback'],
  });
  assert.equal(events.some(event => event.startsWith('feedback:')), false);
});
