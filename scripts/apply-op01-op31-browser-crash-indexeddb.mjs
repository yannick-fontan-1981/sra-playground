import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label} anchor`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous ${label} anchor`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const mainPath = 'src/main.ts';
let main = await readFile(mainPath, 'utf8');
main = replaceOnce(
  main,
  `import { BrowserDurableSessionAutosave } from './runtime/v6-browser-durable-autosave';\n`,
  `import { BrowserDurableSessionAutosave } from './runtime/v6-browser-durable-autosave';\nimport {\n  BrowserIndexedDbDurableSessionPersistence,\n  BrowserIndexedDbDurableSessionStore,\n} from './runtime/v6-browser-durable-indexeddb';\n`,
  'IndexedDB imports',
);
main = replaceOnce(
  main,
  `let durableAutosave: BrowserDurableSessionAutosave | null = null;\nlet observation: GameObservation | null = null;\n`,
  `let durableAutosave: BrowserDurableSessionAutosave | null = null;\nlet indexedDbDurableSession: BrowserIndexedDbDurableSessionPersistence | null = null;\ntry {\n  indexedDbDurableSession = new BrowserIndexedDbDurableSessionPersistence(\n    new BrowserIndexedDbDurableSessionStore(window.indexedDB),\n  );\n} catch (error) {\n  console.warn('Strict IndexedDB browser session storage is unavailable.', error);\n}\nlet observation: GameObservation | null = null;\n`,
  'IndexedDB persistence owner',
);
main = replaceOnce(
  main,
  `    save: checkpoint => durableSessionStore!.save(checkpoint),\n`,
  `    save: checkpoint => {\n      const local = durableSessionStore!.save(checkpoint);\n      if (local.status === 'saved') {\n        void indexedDbDurableSession?.enqueue(checkpoint).then(result => {\n          if (result.status !== 'saved') {\n            console.warn('The strict IndexedDB browser checkpoint was not committed.', result);\n          }\n        });\n      }\n      return local;\n    },\n`,
  'hybrid autosave sink',
);
main = replaceOnce(
  main,
  `  durableSessionStore?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction captureDurableSessionCheckpoint`,
  `  durableSessionStore?.clear();\n  void indexedDbDurableSession?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction captureDurableSessionCheckpoint`,
  'hybrid invalidation',
);
main = replaceOnce(
  main,
  `    durableAutosave?.reset();\n    durableSessionStore?.clear();\n  }\n}\n`,
  `    durableAutosave?.reset();\n    durableSessionStore?.clear();\n    void indexedDbDurableSession?.clear();\n  }\n}\n`,
  'terminal hybrid clear',
);
main = replaceOnce(
  main,
  `  onCheckpointRejected: error => {\n    durableSessionStore?.clear();\n    console.warn('A durable Agent checkpoint was rejected.', error);\n  },\n`,
  `  onCheckpointRejected: error => {\n    durableSessionStore?.clear();\n    void indexedDbDurableSession?.clear();\n    console.warn('A durable Agent checkpoint was rejected.', error);\n  },\n`,
  'checkpoint rejection clear',
);
main = replaceOnce(
  main,
  `window.addEventListener('pageshow', event => {\n  if (event.persisted) durableSessionStore?.clear();\n});\n\nconst initialUrl = new URL(window.location.href);\nconst initialLevel = requestedLevel(initialUrl, selectedGame);\nconst storedSession = durableSessionStore?.load(Date.now(), selectedGame.code);\nlet initialDurable = storedSession?.status === 'ready'\n  ? storedSession.checkpoint\n  : undefined;\nif (\n  initialDurable\n  && initialLevel !== undefined\n  && initialDurable.agent.host.session?.gameObservation.level !== initialLevel\n) {\n  durableAutosave?.reset();\n  durableSessionStore?.clear();\n  initialDurable = undefined;\n}\nif (initialDurable) durableAutosave?.prime(initialDurable);\nvoid selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);`,
  `window.addEventListener('pageshow', event => {\n  if (event.persisted) {\n    durableAutosave?.reset();\n    durableSessionStore?.clear();\n    void indexedDbDurableSession?.clear();\n  }\n});\n\nasync function initialDurableSession(): Promise<BrowserDurableSessionCheckpointV1 | undefined> {\n  const nowMs = Date.now();\n  const local = durableSessionStore?.load(nowMs, selectedGame.code);\n  const indexed = await indexedDbDurableSession?.load(nowMs, selectedGame.code);\n  const candidates = [\n    local?.status === 'ready' ? local.checkpoint : undefined,\n    indexed?.status === 'ready' ? indexed.checkpoint : undefined,\n  ].filter((value): value is BrowserDurableSessionCheckpointV1 => Boolean(value));\n  candidates.sort((left, right) => right.savedAtMs - left.savedAtMs);\n  return candidates[0];\n}\n\nasync function bootstrapProduct(): Promise<void> {\n  const initialUrl = new URL(window.location.href);\n  const initialLevel = requestedLevel(initialUrl, selectedGame);\n  let initialDurable = await initialDurableSession();\n  if (\n    initialDurable\n    && initialLevel !== undefined\n    && initialDurable.agent.host.session?.gameObservation.level !== initialLevel\n  ) {\n    invalidateDurableResume();\n    initialDurable = undefined;\n  }\n  if (initialDurable) durableAutosave?.prime(initialDurable);\n  await selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);\n}\n\nvoid bootstrapProduct();`,
  'async hybrid startup',
);
await writeFile(mainPath, main);

const fixturePath = 'tests/browser/op01-op31-browser-crash-resume.ts';
let fixture = await readFile(fixturePath, 'utf8');
fixture = replaceOnce(
  fixture,
  `import {\n  BROWSER_DURABLE_SESSION_STORAGE_KEY,\n  BrowserDurableSessionStore,\n} from '../../src/runtime/v6-browser-durable-session.ts';\n`,
  `import {\n  BROWSER_DURABLE_SESSION_STORAGE_KEY,\n  BrowserDurableSessionStore,\n} from '../../src/runtime/v6-browser-durable-session.ts';\nimport {\n  BrowserIndexedDbDurableSessionPersistence,\n  BrowserIndexedDbDurableSessionStore,\n} from '../../src/runtime/v6-browser-durable-indexeddb.ts';\n`,
  'fixture IndexedDB imports',
);
fixture = replaceOnce(
  fixture,
  `const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;\n`,
  `const EXPECTED_ACTION = { id: 6, x: 32, y: 26 } as const;\nconst indexedDbSession = new BrowserIndexedDbDurableSessionPersistence(\n  new BrowserIndexedDbDurableSessionStore(window.indexedDB),\n);\n`,
  'fixture IndexedDB owner',
);
fixture = replaceOnce(
  fixture,
  `async function phaseOne(): Promise<never> {\n  status('phase 1: waiting for product Agent dispatch and automatic pending autosave');\n`,
  `async function phaseOne(): Promise<never> {\n  status('phase 1: waiting for product Agent dispatch and strict IndexedDB pending autosave');\n  await indexedDbSession.clear();\n`,
  'phase-one IndexedDB reset',
);
fixture = replaceOnce(
  fixture,
  `  const store = new BrowserDurableSessionStore(window.localStorage);\n  const loaded = await waitFor(() => {\n    const candidate = store.load(Date.now(), GAME_CODE);\n    if (candidate.status !== 'ready') return false;\n    const session = candidate.checkpoint.agent.host.session;\n    if (!candidate.checkpoint.runtime.pending || !session?.pendingReturn) return false;\n    return candidate;\n  }, 'automatic in-flight durable checkpoint');\n`,
  `  const loaded = await (async () => {\n    const deadline = performance.now() + 600_000;\n    while (performance.now() < deadline) {\n      const candidate = await indexedDbSession.load(Date.now(), GAME_CODE);\n      if (candidate.status === 'ready') {\n        const session = candidate.checkpoint.agent.host.session;\n        if (candidate.checkpoint.runtime.pending && session?.pendingReturn) return candidate;\n      }\n      await delay(20);\n    }\n    throw new Error('strict IndexedDB in-flight checkpoint timed out');\n  })();\n`,
  'phase-one strict checkpoint wait',
);
fixture = replaceOnce(
  fixture,
  `  const store = new BrowserDurableSessionStore(window.localStorage);\n  const retainedBeforeRestore = store.load(Date.now(), GAME_CODE);\n`,
  `  const retainedBeforeRestore = await indexedDbSession.load(Date.now(), GAME_CODE);\n`,
  'phase-two IndexedDB pre-restore proof',
);
fixture = replaceOnce(
  fixture,
  `  const settled = await waitFor(() => {\n    const candidate = store.load(Date.now(), GAME_CODE);\n    if (candidate.status !== 'ready') return false;\n    const session = candidate.checkpoint.agent.host.session;\n    if (\n      candidate.checkpoint.mode !== 'manual'\n      || candidate.checkpoint.runtime.pending !== null\n      || candidate.checkpoint.runtime.entries.length !== 2\n      || session?.pendingReturn !== null\n      || candidate.checkpoint.agent.actionsDispatched !== 1\n      || candidate.checkpoint.savedAtMs <= evidence.savedAtMs\n    ) return false;\n    return candidate;\n  }, 'settled post-crash durable checkpoint');\n`,
  `  const settled = await (async () => {\n    const deadline = performance.now() + 600_000;\n    while (performance.now() < deadline) {\n      const candidate = await indexedDbSession.load(Date.now(), GAME_CODE);\n      if (candidate.status === 'ready') {\n        const session = candidate.checkpoint.agent.host.session;\n        if (\n          candidate.checkpoint.mode === 'manual'\n          && candidate.checkpoint.runtime.pending === null\n          && candidate.checkpoint.runtime.entries.length === 2\n          && session?.pendingReturn === null\n          && candidate.checkpoint.agent.actionsDispatched === 1\n          && candidate.checkpoint.savedAtMs > evidence.savedAtMs\n        ) return candidate;\n      }\n      await delay(20);\n    }\n    throw new Error('settled strict IndexedDB checkpoint timed out');\n  })();\n`,
  'phase-two settled strict checkpoint wait',
);
fixture = replaceOnce(
  fixture,
  `      pendingBoundaryAutosavedBeforeCrash: true,\n`,
  `      pendingBoundaryAutosavedBeforeCrash: true,\n      indexedDbStrictTransactionCommittedBeforeCrash: true,\n`,
  'strict commit causal proof',
);
fixture = replaceOnce(
  fixture,
  `      localStorageUsed: true,\n      hardProcessTerminationRequested: true,\n`,
  `      localStorageUsed: true,\n      indexedDbStrictTransactionUsed: true,\n      localStorageDiskFlushReliedUpon: false,\n      crashBeforeDurableCommitQualified: false,\n      hardProcessTerminationRequested: true,\n`,
  'strict storage proof boundary',
);
fixture = replaceOnce(
  fixture,
  `  store.clear();\n  window.localStorage.removeItem(PHASE_KEY);\n`,
  `  await indexedDbSession.clear();\n  new BrowserDurableSessionStore(window.localStorage).clear();\n  window.localStorage.removeItem(PHASE_KEY);\n`,
  'hybrid fixture cleanup',
);
await writeFile(fixturePath, fixture);

console.log(JSON.stringify({\n  status: 'strict-indexeddb-crash-checkpoint-wired',\n  files: [mainPath, fixturePath],\n}, null, 2));
