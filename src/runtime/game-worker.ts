/** All game execution happens here. No action is sent to a remote game API. */
interface PythonRuntime {
  loadPackage(packages: string[]): Promise<void>;
  unpackArchive(bytes: ArrayBuffer, format: string, options: { extractDir: string }): void;
  FS: { writeFile(path: string, data: string): void };
  globals: { set(name: string, value: string): void; delete(name: string): void };
  runPython(code: string): unknown;
}

const workerScope = self as unknown as {
  location: Location;
  addEventListener(type: 'message', callback: (event: MessageEvent<{ id: number; request: unknown }>) => void): void;
  postMessage(message: unknown): void;
};

async function asset(path: string): Promise<Response> {
  const response = await fetch(new URL(path, workerScope.location.origin));
  if (!response.ok) throw new Error(`A local game file could not be loaded (${response.status}). Please retry.`);
  return response;
}

async function initialize(): Promise<PythonRuntime> {
  const directory = new URL('/vendor/pyodide/', workerScope.location.origin).href;
  const loaderUrl = `${directory}pyodide.mjs`;
  const loader = await import(/* @vite-ignore */ loaderUrl) as {
    loadPyodide(options: { indexURL: string; stdout: (text: string) => void; stderr: (text: string) => void }): Promise<PythonRuntime>;
  };
  const python = await loader.loadPyodide({ indexURL: directory, stdout: () => {}, stderr: text => console.warn(text) });
  await python.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
  const [custom, official, bridge, adapter, navigation] = await Promise.all([
    asset('/python/custom-games.zip').then(response => response.arrayBuffer()),
    asset('/python/official-games.zip').then(response => response.arrayBuffer()),
    asset('/python/game_bridge.py').then(response => response.text()),
    asset('/python/official_adapter.py').then(response => response.text()),
    asset('/python/custom_level_navigation.py').then(response => response.text()),
  ]);
  python.unpackArchive(custom, 'zip', { extractDir: '/games' });
  python.unpackArchive(official, 'zip', { extractDir: '/games' });
  python.FS.writeFile('/games/game_bridge.py', bridge);
  python.FS.writeFile('/games/official_adapter.py', adapter);
  python.FS.writeFile('/games/custom_level_navigation.py', navigation);
  python.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
  return python;
}

let ready: Promise<PythonRuntime> | undefined;
let queue = Promise.resolve();
workerScope.addEventListener('message', event => {
  const { id, request } = event.data;
  queue = queue.then(async () => {
    try {
      ready ??= initialize().catch(error => { ready = undefined; throw error; });
      const python = await ready;
      python.globals.set('_browser_request_json', JSON.stringify(request));
      let result;
      try { result = JSON.parse(String(python.runPython('dispatch(_browser_request_json)'))); }
      finally { python.globals.delete('_browser_request_json'); }
      if (result.error) throw new Error(String(result.error));
      workerScope.postMessage({ id, result });
    } catch (error) {
      console.error('Local game error:', error);
      workerScope.postMessage({ id, error: error instanceof Error ? error.message : 'The game could not complete this action.' });
    }
  });
});
