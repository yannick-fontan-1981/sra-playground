// Adaptation locale du chargement hors ligne de scripts/check-sic-chronological.mjs.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadGame(code, vendor, root) {
  const { loadPyodide } = await import(pathToFileURL(resolve(vendor, 'pyodide.mjs')));
  const py = await loadPyodide({ indexURL: resolve(vendor), stdout() {}, stderr() {} });
  await py.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  const assets = new URL('public/python/', root);
  for (const file of ['custom-games.zip', 'official-games.zip']) {
    py.unpackArchive(new Uint8Array(await readFile(new URL(file, assets))), 'zip', { extractDir: '/games' });
  }
  for (const file of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
    py.FS.writeFile('/games/' + file, await readFile(new URL(file, assets), 'utf8'));
  }
  py.runPython("import sys\nsys.path.insert(0,'/games')\nfrom game_bridge import dispatch");
  function send(request) {
    py.globals.set('_request', JSON.stringify(request));
    const board = JSON.parse(py.runPython('dispatch(_request)'));
    if (board.error) throw Error(board.error);
    return board;
  }
  return { initial: send({ type: 'load', code, level: 1 }),
    step: (id, data) => send({ type: 'action', actionId: id, ...(id === 6 ? { data } : {}) }) };
}
