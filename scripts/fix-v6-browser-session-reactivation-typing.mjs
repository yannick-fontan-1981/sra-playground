import { readFileSync, writeFileSync } from 'node:fs';

function replaceIfNeeded(content, before, after, label) {
  if (content.includes(after)) return content;
  if (!content.includes(before)) throw new Error(`missing ${label}`);
  return content.replace(before, after);
}

const hostPath = 'src/runtime/v6-browser-common-campaign-host.ts';
let hostSource = readFileSync(hostPath, 'utf8');
const oldHelper = `function sameNumbers(left: readonly number[], right: readonly number[]): boolean {\n  return left.length === right.length && left.every((value, index) => value === right[index]);\n}`;
const newHelper = `function sameNumbers(left: ArrayLike<number>, right: ArrayLike<number>): boolean {\n  if (left.length !== right.length) return false;\n  for (let index = 0; index < left.length; index += 1) {\n    if (left[index] !== right[index]) return false;\n  }\n  return true;\n}`;
hostSource = replaceIfNeeded(hostSource, oldHelper, newHelper, 'sameNumbers helper');
writeFileSync(hostPath, hostSource);

const controllerPath = 'src/runtime/v6-browser-agent-controller.ts';
let controllerSource = readFileSync(controllerPath, 'utf8');
controllerSource = replaceIfNeeded(
  controllerSource,
  '    const host = this.#createHost();\n    let sessionId: string;',
  '    let host = this.#createHost();\n    let sessionId: string;',
  'mutable activation host',
);
controllerSource = replaceIfNeeded(
  controllerSource,
  `      } catch {\n        this.#checkpoint = null;\n        const ordinal = ++this.#sessionOrdinal;`,
  `      } catch {\n        this.#checkpoint = null;\n        host.dispose();\n        host = this.#createHost();\n        const ordinal = ++this.#sessionOrdinal;`,
  'fresh host after failed restore',
);
writeFileSync(controllerPath, controllerSource);

const testPath = 'tests/v6-browser-session-reactivation.test.ts';
let testSource = readFileSync(testPath, 'utf8');
testSource = replaceIfNeeded(
  testSource,
  `  const actions: number[] = [];\n  const ports: BrowserAgentControllerPorts = {\n    readState: () => productState(current, busy),`,
  `  const actions: number[] = [];\n  let hostCreations = 0;\n  const ports: BrowserAgentControllerPorts = {\n    readState: () => productState(current, busy),`,
  'stale checkpoint host counter',
);
testSource = replaceIfNeeded(
  testSource,
  `  const controller = new BrowserAgentController({\n    createHost: () => createPublicSingleActionBrowserCampaignHost(),\n    makeSessionId: (_observation, ordinal) => \`stale:\${ordinal}\`,`,
  `  const controller = new BrowserAgentController({\n    createHost: () => {\n      hostCreations += 1;\n      return createPublicSingleActionBrowserCampaignHost();\n    },\n    makeSessionId: (_observation, ordinal) => \`stale:\${ordinal}\`,`,
  'stale checkpoint counted host factory',
);
testSource = replaceIfNeeded(
  testSource,
  `  assert.equal(restarted.actionsDispatched, 1);\n  assert.deepEqual(actions, [1, 3]);\n});`,
  `  assert.equal(restarted.actionsDispatched, 1);\n  assert.deepEqual(actions, [1, 3]);\n  assert.equal(hostCreations, 3);\n});`,
  'fresh fallback host assertion',
);
writeFileSync(testPath, testSource);

console.log(JSON.stringify({
  typedPixels: true,
  freshHostAfterFailedRestore: true,
  staleCheckpointHostCreationsGuarded: true,
}, null, 2));
