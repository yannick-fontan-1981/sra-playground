import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/main.ts';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`main integration anchor missing: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`main integration anchor is not unique: ${label}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  "import { BrowserGameRuntime, type GameObservation } from './runtime/browser-games';\n",
  "import { BrowserGameRuntime, type GameObservation } from './runtime/browser-games';\n"
    + "import {\n"
    + "  BrowserDurableSessionStore,\n"
    + "  createBrowserDurableSessionCheckpoint,\n"
    + "  type BrowserDurableSessionCheckpointV1,\n"
    + "} from './runtime/v6-browser-durable-session';\n",
  'durable session import',
);

replaceOnce(
  "const runtime = new BrowserGameRuntime();\nlet observation: GameObservation | null = null;",
  "const runtime = new BrowserGameRuntime();\n"
    + "let durableSessionStore: BrowserDurableSessionStore | null = null;\n"
    + "try {\n"
    + "  durableSessionStore = new BrowserDurableSessionStore(window.localStorage);\n"
    + "} catch (error) {\n"
    + "  console.warn('Durable browser session storage is unavailable.', error);\n"
    + "}\n"
    + "let observation: GameObservation | null = null;",
  'durable store construction',
);

replaceOnce(
  "  onError: error => {\n    console.error(`Bounded Agent campaign failed for ${selectedGame.code}.`, error);\n  },\n});\nagentSnapshot = agentController.snapshot();",
  "  onError: error => {\n"
    + "    console.error(`Bounded Agent campaign failed for ${selectedGame.code}.`, error);\n"
    + "  },\n"
    + "  onCheckpointRejected: error => {\n"
    + "    durableSessionStore?.clear();\n"
    + "    console.warn('A durable Agent checkpoint was rejected.', error);\n"
    + "  },\n"
    + "});\n"
    + "agentSnapshot = agentController.snapshot();\n\n"
    + "function invalidateDurableResume(): void {\n"
    + "  durableSessionStore?.clear();\n"
    + "  agentController.clearCheckpoint();\n"
    + "}\n\n"
    + "function persistDurableSession(): boolean {\n"
    + "  if (!durableSessionStore) return false;\n"
    + "  const agent = agentController.captureCheckpoint();\n"
    + "  if (!agent) {\n"
    + "    durableSessionStore.clear();\n"
    + "    return false;\n"
    + "  }\n"
    + "  try {\n"
    + "    const checkpoint = createBrowserDurableSessionCheckpoint({\n"
    + "      runtime: runtime.snapshot(),\n"
    + "      agent,\n"
    + "      selectionGeneration,\n"
    + "      mode,\n"
    + "    });\n"
    + "    const saved = durableSessionStore.save(checkpoint);\n"
    + "    if (saved.status !== 'saved') {\n"
    + "      console.warn('The durable browser session was not saved.', saved);\n"
    + "      return false;\n"
    + "    }\n"
    + "    return true;\n"
    + "  } catch (error) {\n"
    + "    durableSessionStore.clear();\n"
    + "    console.warn('The current browser session is not at a durable boundary.', error);\n"
    + "    return false;\n"
    + "  }\n"
    + "}",
  'durable controller callbacks and helpers',
);

replaceOnce(
  "async function run(operation: () => Promise<GameObservation>, announcement = ''): Promise<void> {\n  if (!ready() || mode !== 'manual') return;\n  const generation = selectionGeneration;",
  "async function run(operation: () => Promise<GameObservation>, announcement = ''): Promise<void> {\n"
    + "  if (!ready() || mode !== 'manual') return;\n"
    + "  invalidateDurableResume();\n"
    + "  const generation = selectionGeneration;",
  'manual operation invalidation',
);

replaceOnce(
  "function perform(action: number, data?: { x: number; y: number }): void {\n  const state = productReadinessState();",
  "function perform(action: number, data?: { x: number; y: number }): void {\n"
    + "  const state = productReadinessState();\n"
    + "  if (mode === 'manual' && productReady(state)) invalidateDurableResume();",
  'manual dispatch invalidation',
);

replaceOnce(
  "async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push', level?: number): Promise<void> {\n  const game = getGameByCode(code) ?? defaultGame!;\n  if (agentController.running) agentController.deactivate('replaced');\n  const generation = ++selectionGeneration;",
  "async function selectGame(\n"
    + "  code: string,\n"
    + "  historyMode: 'push' | 'replace' | 'none' = 'push',\n"
    + "  level?: number,\n"
    + "  durable?: BrowserDurableSessionCheckpointV1,\n"
    + "): Promise<void> {\n"
    + "  const game = getGameByCode(code) ?? defaultGame!;\n"
    + "  if (durable) {\n"
    + "    durableSessionStore?.clear();\n"
    + "    selectionGeneration = Math.max(selectionGeneration, durable.selectionGeneration);\n"
    + "  } else {\n"
    + "    invalidateDurableResume();\n"
    + "  }\n"
    + "  if (agentController.running) agentController.deactivate('replaced');\n"
    + "  const generation = ++selectionGeneration;",
  'selectGame durable parameter',
);

replaceOnce(
  "  try {\n    await present(await runtime.load(game.code, level), generation);\n  } catch (error) {\n    showFailure(error, generation);\n  }\n}",
  "  try {\n"
    + "    if (durable) {\n"
    + "      const restored = await runtime.restore(durable.runtime);\n"
    + "      agentController.restoreCheckpoint(durable.agent);\n"
    + "      await present(restored.observation, generation);\n"
    + "      element('#game-feedback').textContent = restored.replayedPending\n"
    + "        ? 'The saved Agent return was reconstructed and is ready to be acquired.'\n"
    + "        : 'The saved browser session was restored.';\n"
    + "      if (durable.mode === 'agent' && generation === selectionGeneration) setMode('agent');\n"
    + "    } else {\n"
    + "      await present(await runtime.load(game.code, level), generation);\n"
    + "    }\n"
    + "  } catch (error) {\n"
    + "    if (!durable) {\n"
    + "      showFailure(error, generation);\n"
    + "      return;\n"
    + "    }\n"
    + "    console.warn('Durable browser session restore was rejected; loading a fresh game.', error);\n"
    + "    agentController.clearCheckpoint();\n"
    + "    try {\n"
    + "      await present(await runtime.load(game.code, level), generation);\n"
    + "    } catch (fallbackError) {\n"
    + "      showFailure(fallbackError, generation);\n"
    + "    }\n"
    + "  }\n"
    + "}",
  'durable restore before fresh load',
);

replaceOnce(
  "window.addEventListener('pagehide', event => {\n  if (!event.persisted) {\n    agentController.dispose();\n    runtime.dispose();\n  }\n});\nvoid selectGame(selectedGame.code, 'replace', requestedLevel(new URL(window.location.href), selectedGame));",
  "window.addEventListener('pagehide', event => {\n"
    + "  persistDurableSession();\n"
    + "  if (!event.persisted) {\n"
    + "    agentController.dispose();\n"
    + "    runtime.dispose();\n"
    + "  }\n"
    + "});\n"
    + "window.addEventListener('pageshow', event => {\n"
    + "  if (event.persisted) durableSessionStore?.clear();\n"
    + "});\n\n"
    + "const initialUrl = new URL(window.location.href);\n"
    + "const initialLevel = requestedLevel(initialUrl, selectedGame);\n"
    + "const storedSession = durableSessionStore?.load(Date.now(), selectedGame.code);\n"
    + "let initialDurable = storedSession?.status === 'ready'\n"
    + "  ? storedSession.checkpoint\n"
    + "  : undefined;\n"
    + "if (\n"
    + "  initialDurable\n"
    + "  && initialLevel !== undefined\n"
    + "  && initialDurable.agent.host.session?.gameObservation.level !== initialLevel\n"
    + ") {\n"
    + "  durableSessionStore?.clear();\n"
    + "  initialDurable = undefined;\n"
    + "}\n"
    + "void selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);",
  'pagehide persistence and startup restore',
);

await writeFile(path, source);
console.log('Applied durable browser session integration to src/main.ts');
