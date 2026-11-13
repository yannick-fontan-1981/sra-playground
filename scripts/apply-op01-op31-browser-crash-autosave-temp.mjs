import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/main.ts';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label} source`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous ${label} source`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  `} from './runtime/v6-browser-durable-session';\n`,
  `} from './runtime/v6-browser-durable-session';\nimport { BrowserDurableSessionAutosave } from './runtime/v6-browser-durable-autosave';\n`,
  'durable autosave import',
);

replaceOnce(
  `} catch (error) {\n  console.warn('Durable browser session storage is unavailable.', error);\n}\nlet observation: GameObservation | null = null;`,
  `} catch (error) {\n  console.warn('Durable browser session storage is unavailable.', error);\n}\nlet durableAutosave: BrowserDurableSessionAutosave | null = null;\nlet requestDurableAutosave = (): void => {};\nlet observation: GameObservation | null = null;`,
  'durable autosave state',
);

replaceOnce(
  `  onStateChange: snapshot => {\n    agentSnapshot = snapshot;\n    updateAgentStatus();\n    updateInterface();\n  },`,
  `  onStateChange: snapshot => {\n    agentSnapshot = snapshot;\n    requestDurableAutosave();\n    updateAgentStatus();\n    updateInterface();\n  },`,
  'controller state autosave hook',
);

replaceOnce(
  `function invalidateDurableResume(): void {\n  durableSessionStore?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction persistDurableSession(): boolean {\n  if (!durableSessionStore) return false;\n  const agent = agentController.captureCheckpoint();\n  if (!agent) {\n    durableSessionStore.clear();\n    return false;\n  }\n  try {\n    const checkpoint = createBrowserDurableSessionCheckpoint({\n      runtime: runtime.snapshot(),\n      agent,\n      selectionGeneration,\n      mode,\n    });\n    const saved = durableSessionStore.save(checkpoint);\n    if (saved.status !== 'saved') {\n      console.warn('The durable browser session was not saved.', saved);\n      return false;\n    }\n    return true;\n  } catch (error) {\n    durableSessionStore.clear();\n    console.warn('The current browser session is not at a durable boundary.', error);\n    return false;\n  }\n}\n`,
  `function invalidateDurableResume(): void {\n  durableAutosave?.reset();\n  durableSessionStore?.clear();\n  agentController.clearCheckpoint();\n}\n\nfunction captureDurableSessionCheckpoint(): BrowserDurableSessionCheckpointV1 | null {\n  const agent = agentController.captureCheckpoint();\n  if (!agent) return null;\n  return createBrowserDurableSessionCheckpoint({\n    runtime: runtime.snapshot(),\n    agent,\n    selectionGeneration,\n    mode,\n  });\n}\n\nconst durableStore = durableSessionStore;\ndurableAutosave = durableStore\n  ? new BrowserDurableSessionAutosave({\n      capture: captureDurableSessionCheckpoint,\n      save: checkpoint => durableStore.save(checkpoint),\n      onResult: result => {\n        if (\n          result.status === 'too-large'\n          || result.status === 'unavailable'\n          || result.status === 'capture-failed'\n          || result.status === 'save-failed'\n        ) {\n          console.warn('The durable browser autosave did not advance.', result);\n        }\n      },\n    })\n  : null;\nrequestDurableAutosave = () => durableAutosave?.request();\n\nfunction persistDurableSession(): boolean {\n  if (!durableAutosave) return false;\n  const result = durableAutosave.flush();\n  return result.status === 'saved' || result.status === 'unchanged';\n}\n`,
  'durable persistence functions',
);

replaceOnce(
  `    action: (action, data) => runtime.action(action, data),`,
  `    action: (action, data) => {\n      const pending = runtime.action(action, data);\n      durableAutosave?.flush();\n      return pending;\n    },`,
  'Agent physical action autosave seam',
);

replaceOnce(
  `  if (durable) {\n    durableSessionStore?.clear();\n    selectionGeneration = Math.max(selectionGeneration, durable.selectionGeneration);\n  } else {`,
  `  if (durable) {\n    selectionGeneration = Math.max(selectionGeneration, durable.selectionGeneration);\n  } else {`,
  'durable restore retention',
);

replaceOnce(
  `    console.warn('Durable browser session restore was rejected; loading a fresh game.', error);\n    agentController.clearCheckpoint();`,
  `    console.warn('Durable browser session restore was rejected; loading a fresh game.', error);\n    invalidateDurableResume();`,
  'durable restore rejection',
);

replaceOnce(
  `window.addEventListener('pagehide', event => {\n  persistDurableSession();`,
  `document.addEventListener('visibilitychange', () => {\n  if (document.visibilityState === 'hidden') persistDurableSession();\n});\ndocument.addEventListener('freeze', () => {\n  persistDurableSession();\n});\nwindow.addEventListener('pagehide', event => {\n  persistDurableSession();`,
  'hidden and freeze durability hooks',
);

replaceOnce(
  `window.addEventListener('pageshow', event => {\n  if (event.persisted) durableSessionStore?.clear();\n});`,
  `window.addEventListener('pageshow', event => {\n  if (event.persisted) {\n    durableAutosave?.reset();\n    durableSessionStore?.clear();\n  }\n});`,
  'bfcache autosave reset',
);

replaceOnce(
  `  initialDurable = undefined;\n}\nvoid selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);`,
  `  initialDurable = undefined;\n}\nif (initialDurable) durableAutosave?.prime(initialDurable);\nvoid selectGame(selectedGame.code, 'replace', initialLevel, initialDurable);`,
  'initial durable autosave prime',
);

await writeFile(path, source);
console.log(JSON.stringify({ status: 'browser-crash-autosave-applied', path }, null, 2));
