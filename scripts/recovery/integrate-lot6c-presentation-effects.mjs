import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../../src/main.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

const oldImport = `import {
  isPresentationCurrent,
  isPresentationLoopCurrent,
  presentationFeedback,
  presentationFrameDurationMs,
  presentationFrames,
} from './product-presentation';`;
const newImport = `import { presentProductObservation } from './product-presentation-effects';`;

if (source.includes(oldImport)) {
  source = source.replace(oldImport, newImport);
} else if (!source.includes(newImport)) {
  throw new Error('The expected presentation import block was not found.');
}

const replacement = `async function present(next: GameObservation, selectedGeneration: number, releaseBusy = true): Promise<void> {
  await presentProductObservation(next, selectedGeneration, {
    currentSelectionGeneration: () => selectionGeneration,
    currentPresentationGeneration: () => presentationGeneration,
    nextPresentationGeneration: () => {
      presentationGeneration += 1;
      return presentationGeneration;
    },
    selectedGameCode: () => selectedGame.code,
    setObservation: value => { observation = value; },
    setLoading: value => { loading = value; },
    setFailed: value => { failed = value; },
    syncLocation: value => {
      const url = new URL(window.location.href);
      url.searchParams.set('game', value.gameCode);
      url.searchParams.set('level', String(value.level));
      if (url.href !== window.location.href) window.history.replaceState(null, '', url);
    },
    updateInterface,
    paint: (frame, palette) => paint(frame, palette),
    wait: delayMs => new Promise<void>(resolve => window.setTimeout(resolve, delayMs)),
    setBusy: value => { busy = value; },
    setFeedback: message => { element('#game-feedback').textContent = message; },
  }, { fallbackPalette, releaseBusy });
}`;

const presentPattern = /async function present\(next: GameObservation, selectedGeneration: number, releaseBusy = true\): Promise<void> \{[\s\S]*?\n\}\n\nfunction showFailure/;
const matches = source.match(presentPattern);
if (!matches) {
  if (!source.includes('await presentProductObservation(next, selectedGeneration')) {
    throw new Error('The expected present() function was not found.');
  }
} else {
  source = source.replace(presentPattern, `${replacement}\n\nfunction showFailure`);
}

const required = [
  "from './product-presentation-effects'",
  'await presentProductObservation(next, selectedGeneration',
  'currentSelectionGeneration: () => selectionGeneration',
  'currentPresentationGeneration: () => presentationGeneration',
  'paint: (frame, palette) => paint(frame, palette)',
  "setFeedback: message => { element('#game-feedback').textContent = message; }",
];
for (const needle of required) {
  if (!source.includes(needle)) throw new Error(`Missing integrated presentation effect: ${needle}`);
}
if (source.includes("from './product-presentation';")) {
  throw new Error('main.ts still imports the superseded deterministic helpers directly.');
}

writeFileSync(path, source);
