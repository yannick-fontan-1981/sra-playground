/** Compare all 100 games through the JSON bridge in native and self-hosted Python.
 * Run: node scripts/test-python-games.mjs
 * Or: python scripts/test-python-games.py --output /tmp/sra-native.json
 *     node scripts/test-python-games.mjs --native-report /tmp/sra-native.json
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'sra-bridge-parity-'));
try {
  const suppliedIndex = process.argv.indexOf('--native-report');
  const nativeReport = suppliedIndex === -1
    ? path.join(temporary, 'native.json') : process.argv[suppliedIndex + 1];
  if (suppliedIndex === -1) {
    console.log('Checking the 100-game bridge in native Python…');
    const result = spawnSync(process.env.SRA_PARITY_PYTHON || 'python',
      [path.join(root, 'scripts/test-python-games.py'), '--output', nativeReport],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, result.stdout || 'Native game bridge checks failed');
  }
  const expected = JSON.parse(await readFile(nativeReport, 'utf8'));
  assert.deepEqual(expected.failures, []);

  // Missing local assets must fail, never silently fetch a CDN package.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    if (/^https?:/i.test(url)) throw new Error('Unexpected network request: ' + url);
    return originalFetch(input, init);
  };
  const vendor = path.join(root, 'public/vendor/pyodide');
  const { loadPyodide } = await import(pathToFileURL(path.join(vendor, 'pyodide.mjs')).href);
  const pyodide = await loadPyodide({ indexURL: vendor + path.sep });
  await pyodide.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  for (const name of ['custom-games.zip', 'official-games.zip']) {
    pyodide.unpackArchive(new Uint8Array(await readFile(path.join(root, 'public/python', name))),
      'zip', { extractDir: '/games' });
  }
  for (const name of ['game_bridge.py', 'official_adapter.py']) {
    pyodide.FS.writeFile('/games/' + name, new Uint8Array(await readFile(path.join(root, 'public/python', name))));
  }
  pyodide.runPython('import sys\nsys.path.insert(0, "/games")');
  pyodide.globals.set('bridge_checks_source', await readFile(path.join(root, 'scripts/test-python-games.py'), 'utf8'));
  pyodide.runPython('bridge_checks_globals = {"__name__": "bridge_runtime_checks"}\nexec(compile(bridge_checks_source, "bridge_runtime_checks.py", "exec"), bridge_checks_globals)');
  console.log('Checking the same 100-game JSON boundary in offline WebAssembly…');
  const actual = JSON.parse(await pyodide.runPythonAsync('__import__("json").dumps(bridge_checks_globals["run_checks"]())'));
  assert.deepEqual(actual.failures, [], JSON.stringify(actual.failures));
  assert.equal(actual.gamesPassed, 100);
  for (const key of ['actionsChecked', 'levelsChecked', 'observationsChecked']) {
    assert.equal(actual[key], expected[key], 'Different ' + key);
  }
  for (let index = 0; index < expected.records.length; index += 1) {
    assert.deepEqual(actual.records[index], expected.records[index],
      'Native/WebAssembly JSON observation differs at ' + expected.records[index].label);
  }
  console.log(JSON.stringify({
    status: 'PASS', games: actual.gamesPassed,
    actions: actual.actionsChecked, levelStarts: actual.levelsChecked,
    matchingObservations: actual.observationsChecked,
    nativeSeconds: expected.seconds, wasmSeconds: actual.seconds,
    runtime: 'CPython / self-hosted Pyodide', networkRequests: 0,
  }, null, 2));
} catch (error) {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
