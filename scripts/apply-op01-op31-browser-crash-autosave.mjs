import { readFile, writeFile } from 'node:fs/promises';

const MAIN = 'src/main.ts';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label} anchor`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous ${label} anchor`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let source = await readFile(MAIN, 'utf8');

source = replaceOnce(
  source,
  `import {\n  BrowserDurableSessionStore,\n  createBrowserDurableSessionCheckpoint,\n  type BrowserDurableSessionCheckpointV1,\n} from './runtime/v6-browser-durable-session';\n`,
  `import {\n  BrowserDurableSessionStore,\n  createBrowserDurableSessionCheckpoint,\n  type BrowserDurableSessionCheckpointV1,\n} from './runtime/v6-browser-durable-session';\nimport { BrowserDurableSessionAutosave } from './runtime/v6-browser-durable-autosave';\n`,
  'durable autosave import',
);

source = replaceOnce(
  source,
  `} catch (error) {\n  console.warn('Durable browser session storage is unavailable.', error);\n}\nlet observation: GameObservation | null = null;\n`,
  `} catch (error) {\n  console.warn('Durable browser session storage is unavailable.', error);\n}\nlet durableAutosave: BrowserDurableSessionAutosave | null = null;\nlet observation: GameObservation | null = null;\n`,
  'durable autosave variable',
);

source = replaceOnce(
  source,
  `  onStateChange: snapshot => {\n    agentSnapshot = snapshot;\n    updateAgentStatus();\n    updateInterface();\n  },\n`,
  `  onStateChange: snapshot => {\n    agentSnapshot = snapshot;\n    requestDurableAutosave();\n    updateAgentStatus();\n    updateInterface();\n  },\n`,
  'controller autosave notification',
);

source = replaceOnce(
  source,
  `agentSnapshot = agentController.snapshot();\n\nfunction invalidateDurableResume(): void {\n  durableSessionStore?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction persistDurableSession(): boolean {\n  if (!durableSessionStore) return false;\n  const agent = agentController.captureCheckpoint();\n  if (!agent) {\n    durableSessionStore.clear();\n    return false;\n  }\n  try {\n    const checkpoint = createBrowserDurableSessionCheckpoint({\n      runtime: runtime.snapshot(),\n      agent,\n      selectionGeneration,\n      mode,\n    });\n    const saved = durableSessionStore.save(checkpoint);\n    if (saved.status !== 'saved') {\n      console.warn('The durable browser session was not saved.', saved);\n      return false;\n    }\n    return true;\n  } catch (error) {\n    durableSessionStore.clear();\n    console.warn('The current browser session is not at a durable boundary.', error);\n    return false;\n  }\n}\n`,
  `agentSnapshot = agentController.snapshot();\n\nif (durableSessionStore) {\n  durableAutosave = new BrowserDurableSessionAutosave({\n    capture: captureDurableSessionCheckpoint,\n    save: checkpoint => durableSessionStore!.save(checkpoint),\n    onResult: result => {\n      if (result.status === 'saved' || result.status === 'unchanged' || result.status === 'unsafe') return;\n      console.warn('The durable browser autosave did not commit a new checkpoint.', result);\n    },\n  });\n}\n\nconst durableAutosaveStopReasons = new Set<BrowserAgentControllerSnapshot['stopReason']>([\n  'manual',\n  'none',\n  'ambiguous',\n  'pending',\n  'blocked',\n  'action-limit',\n]);\n\nfunction invalidateDurableResume(): void {\n  durableAutosave?.reset();\n  durableSessionStore?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction captureDurableSessionCheckpoint(): BrowserDurableSessionCheckpointV1 | null {\n  const agent = agentController.captureCheckpoint();\n  if (!agent) return null;\n  return createBrowserDurableSessionCheckpoint({\n    runtime: runtime.snapshot(),\n    agent,\n    selectionGeneration,\n    mode,\n  });\n}\n\nfunction requestDurableAutosave(): void {\n  const checkpointable = agentSnapshot.phase === 'running'\n    || (agentSnapshot.phase === 'stopping' && agentSnapshot.stopReason === 'manual')\n    || (agentSnapshot.phase === 'stopped'\n      && durableAutosaveStopReasons.has(agentSnapshot.stopReason));\n  if (checkpointable) {\n    durableAutosave?.request();\n    return;\n  }\n  if (\n    agentSnapshot.phase === 'error'\n    || agentSnapshot.phase === 'disposed'\n    || ['replaced', 'terminal', 'stale', 'not-started', 'not-ready', 'error', 'disposed']\n      .includes(agentSnapshot.stopReason ?? '')\n  ) {\n    durableAutosave?.reset();\n    durableSessionStore?.clear();\n  }\n}\n\nfunction persistDurableSession(): boolean {\n  const result = durableAutosave?.flush();\n  return result?.status === 'saved' || result?.status === 'unchanged';\n}\n`,
  'durable persistence coordinator',
);

source = replaceOnce(
  source,
  `    action: (action, data) => runtime.action(action, data),\n    present: (next, generation) => present(next, generation, false),\n`,
  `    action: (action, data) => {\n      const pending = runtime.action(action, data);\n      durableAutosave?.flush();\n      return pending;\n    },\n    present: (next, generation) => present(next, generation, false),\n`,
  'physical dispatch autosave',
);

source = replaceOnce(
  source,
  `  if (durable) {\n    durableSessionStore?.clear();\n    selectionGeneration = Math.max(selectionGeneration, durable.selectionGeneration);\n  } else {\n`,
  `  if (durable) {\n    selectionGeneration = Math.max(selectionGeneration, durable.selectionGeneration);\n  } else {\n`,
  'restore retention',
);

source = replaceOnce(
  source,
  `      if (durable.mode === 'agent' && generation === selectionGeneration) setMode('agent');\n`,
  `      if (durable.mode === 'agent' && generation === selectionGeneration) setMode('agent');\n      else if (generation === selectionGeneration) requestDurableAutosave();\n`,
  'manual restore autosave',
);

source = replaceOnce(
  source,
  `    console.warn('Durable browser session restore was rejected; loading a fresh game.', error);\n    agentController.clearCheckpoint();\n`,
  `    console.warn('Durable browser session restore was rejected; loading a fresh game.', error);\n    invalidateDurableResume();\n`,
  'rejected restore invalidation',
);

source = replaceOnce(
  source,
  `window.addEventListener('pagehide', event => {\n  persistDurableSession();\n`,
  `document.addEventListener('visibilitychange', () => {\n  if (document.visibilityState === 'hidden') persistDurableSession();\n});\ndocument.addEventListener('freeze', () => {\n  persistDurableSession();\n});\nwindow.addEventListener('pagehide', event => {\n  persistDurableSession();\n`,
  'hidden freeze autosave',
);

source = replaceOnce(
  source,
  `  durableSessionStore?.clear();\n  initialDurable = undefined;\n}\nvoid selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);`,
  `  durableAutosave?.reset();\n  durableSessionStore?.clear();\n  initialDurable = undefined;\n}\nif (initialDurable) durableAutosave?.prime(initialDurable);\nvoid selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);`,
  'startup autosave priming',
);

await writeFile(MAIN, source);
await import('./apply-op01-op31-browser-crash-phase-routing.mjs');
console.log('Applied safe-boundary autosave wiring to src/main.ts');
