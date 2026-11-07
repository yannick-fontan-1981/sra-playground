/**
 * Explicit check: node tests/v6-agent-native.smoke.ts [gameCode] [targetLevels]
 * The agent is TypeScript. Pyodide below is used solely for native game engines.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';
import { BrowserV6Agent } from '../src/runtime/v6-agent.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { createNativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import type { V6AgentOperation, V6AgentTransport } from '../src/runtime/v6-agent-protocol.ts';

const gameCode = process.argv[2] ?? 'HANO';
const targetLevels = Number(process.argv[3] ?? 3);
assert.ok(Number.isInteger(targetLevels) && targetLevels >= 1 && targetLevels <= 3);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const service = new V6AgentService(() => createNativeV6Runtime(declarations));
const operations: V6AgentOperation[] = [];
const transport: V6AgentTransport = {
  request(operation) { operations.push(operation); return service.handle(operation); },
  reset() { throw new Error('The integration check must retain solver memory.'); }, dispose() {},
};

// This interpreter hosts games only, exactly as the existing game's worker does.
const native = await loadPyodide({ indexURL: new URL('../public/vendor/pyodide/', import.meta.url).pathname,
  stdout: () => {}, stderr: (text: string) => console.error(text) });
await native.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
for (const name of ['custom-games.zip', 'official-games.zip']) {
  native.unpackArchive(new Uint8Array(await readFile(new URL(`../public/python/${name}`, import.meta.url))), 'zip', { extractDir: '/games' });
}
for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
  native.FS.writeFile(`/games/${name}`, await readFile(new URL(`../public/python/${name}`, import.meta.url), 'utf8'));
}
native.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
function game(request: unknown): GameObservation {
  native.globals.set('_native_game_request', JSON.stringify(request));
  let result;
  try { result = JSON.parse(native.runPython('dispatch(_native_game_request)')); }
  finally { native.globals.delete('_native_game_request'); }
  if (result.error) throw new Error(result.error);
  return { ...result, gameCode: result.code ?? result.gameCode };
}

let current = game({ type: 'load', code: gameCode, level: 1 });
const actions: unknown[] = [];
const agent = new BrowserV6Agent({
  transport, targetLevels, actionsPerLevel: 600, getObservation: () => current, canDispatch: () => true, onState: () => {},
  dispatch: async action => {
    const started = performance.now();
    current = game({ type: 'action', actionId: action.id, ...(action.id === 6 ? { data: action.data } : {}) });
    const executionMs = performance.now() - started;
    actions.push(action); return { observation: current, executionMs };
  },
});
let sessionId: string | null = null;
const boundaries: unknown[] = [];
for (let level = 1; level <= targetLevels; level += 1) {
  await agent.run(600);
  assert.notEqual(agent.snapshot.status, 'error', agent.snapshot.message);
  if (sessionId !== null) assert.equal(agent.snapshot.sessionId, sessionId, 'Natural progression must preserve the native agent session.');
  sessionId = agent.snapshot.sessionId;
  assert.ok(current.levelsCompleted >= level, `Native transfer did not complete ${gameCode} level ${level}: ${agent.snapshot.message}`);
  boundaries.push({ level: current.level, levelsCompleted: current.levelsCompleted, actions: actions.length, phase: agent.snapshot.phase });
  if (level < targetLevels) { assert.equal(agent.snapshot.requiresNewSession, false); assert.equal(agent.snapshot.canStep, true); }
}
assert.equal(agent.snapshot.actionCount, actions.length);
assert.equal(agent.snapshot.actions, actions.length);
assert.equal(operations.filter(operation => operation.type === 'advance').length, actions.length);
const agentModules = JSON.parse(native.runPython("__import__('json').dumps([name for name in sys.modules if name.startswith(('agents.', 'v6_python_bridge'))])"));
assert.deepEqual(agentModules, [], 'The game interpreter must not load the Python agent.');
console.log(JSON.stringify({
  game: gameCode, targetLevels, actions: actions.length, levelsCompleted: current.levelsCompleted, state: current.state,
  status: agent.snapshot.status, activeSeconds: agent.snapshot.activeSeconds, cycles: agent.snapshot.cycles,
  pythonAgentModules: agentModules.length, boundaries,
}));
