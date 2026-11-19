import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function sourceBackend(environment) {
  const vendor = join(environment, 'public/vendor/pyodide'),
    python = join(environment, 'public/python');
  const { loadPyodide } = await import(pathToFileURL(join(vendor, 'pyodide.mjs')).href);
  const py = await loadPyodide({ indexURL: vendor, stdout() {}, stderr() {} });
  await py.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  for (const name of ['custom-games.zip', 'official-games.zip']) {
    py.unpackArchive(new Uint8Array(await readFile(join(python, name))), 'zip', { extractDir: '/games' });
  }
  for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
    py.FS.writeFile('/games/' + name, await readFile(join(python, name), 'utf8'));
  }
  py.runPython("import sys\nsys.path.insert(0,'/games')\nfrom game_bridge import dispatch");
  return {
    dispatch(request) {
      py.globals.set('_request', JSON.stringify(request));
      const result = JSON.parse(py.runPython('dispatch(_request)'));
      if (result.error) throw Error(result.error);
      return { ...result, gameCode: result.code ?? result.gameCode };
    },
  };
}
