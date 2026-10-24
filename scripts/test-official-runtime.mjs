/** Compare the shipped official source archive in CPython and offline Pyodide.
 * Run after `node scripts/prepare-python.mjs` with Python 3.12+, NumPy,
 * Pydantic and typing_extensions installed in the local Python interpreter.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(path.join(os.tmpdir(), 'sra-official-parity-'));
const nativeProgram = `
import json, os, shutil, sys, zipfile
from pathlib import Path
root = Path(os.environ['SRA_PARITY_SITE'])
runtime = Path(os.environ['SRA_PARITY_RUNTIME'])
with zipfile.ZipFile(root / 'public/python/official-games.zip') as archive:
    archive.extractall(runtime)
shutil.copy2(root / 'public/python/official_adapter.py', runtime / 'official_adapter.py')
sys.path.insert(0, str(runtime))
source = root / 'scripts/test-official-runtime.py'
checks_globals = {'__name__': 'official_runtime_checks'}
exec(compile(source.read_text(), str(source), 'exec'), checks_globals)
print(json.dumps(checks_globals['run_official_checks']()))
`;

try {
  const nativeReportIndex = process.argv.indexOf('--native-report');
  let expected;
  if (nativeReportIndex !== -1) {
    // This form also works in environments that disallow child processes:
    // python scripts/test-official-runtime.py --output /tmp/official-native.json
    // node scripts/test-official-runtime.mjs --native-report /tmp/official-native.json
    expected = JSON.parse(await readFile(process.argv[nativeReportIndex + 1], 'utf8'));
  } else {
    console.log('Checking the official archive in native Python…');
    const native = spawnSync(process.env.SRA_PARITY_PYTHON || 'python', ['-c', nativeProgram], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, SRA_PARITY_SITE: root, SRA_PARITY_RUNTIME: temporary },
    });
    if (native.stderr) process.stderr.write(native.stderr);
    if (native.error) throw native.error;
    assert.equal(native.status, 0, 'Native official engine validation failed');
    expected = JSON.parse(native.stdout);
  }

  // All WebAssembly and Python wheels must come from the site itself. A missing
  // local package must fail instead of silently falling back to a remote CDN.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const target = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    if (/^https?:/i.test(target)) throw new Error(`Unexpected network request: ${target}`);
    return originalFetch(input, init);
  };

  const vendor = path.join(root, 'public/vendor/pyodide');
  const { loadPyodide } = await import(pathToFileURL(path.join(vendor, 'pyodide.mjs')).href);
  const pyodide = await loadPyodide({ indexURL: vendor + path.sep });
  await pyodide.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  pyodide.unpackArchive(new Uint8Array(await readFile(path.join(root, 'public/python/official-games.zip'))), 'zip', { extractDir: '/games' });
  pyodide.FS.writeFile('/games/official_adapter.py', new Uint8Array(await readFile(path.join(root, 'public/python/official_adapter.py'))));
  pyodide.runPython('import sys\nsys.path.insert(0, "/games")');
  const checks = await readFile(path.join(root, 'scripts/test-official-runtime.py'), 'utf8');
  pyodide.globals.set('official_checks_source', checks);
  pyodide.runPython('official_checks_globals = {"__name__": "official_runtime_checks"}\nexec(compile(official_checks_source, "official_runtime_checks.py", "exec"), official_checks_globals)');
  console.log('Checking the same archive in browser WebAssembly…');
  const actual = JSON.parse(await pyodide.runPythonAsync('__import__("json").dumps(official_checks_globals["run_official_checks"]())'));
  assert.equal(actual.games_checked, 25);
  assert.equal(actual.levels_checked, 183);
  assert.equal(actual.action_ids_checked, expected.action_ids_checked);
  assert.equal(actual.observations_checked, expected.observations_checked);
  for (let index = 0; index < expected.records.length; index += 1) {
    assert.deepEqual(actual.records[index], expected.records[index],
      `Native/WebAssembly official frames or states differ at ${expected.records[index].label}`);
  }
  console.log(JSON.stringify({
    status: 'PASS',
    games: actual.games_checked,
    levels: actual.levels_checked,
    native_action_ids: actual.action_ids_checked,
    matching_observations: actual.observations_checked,
    runtime: 'CPython / self-hosted Pyodide',
    network_requests: 0,
  }, null, 2));
} catch (error) {
  // Pyodide's bundled module is minified; printing an uncaught Node stack would
  // flood the terminal with that entire line instead of the Python traceback.
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
