import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = process.argv[2];
const files = readdirSync(root).filter(name => name.endsWith('.cpuprofile')).sort();
const maps = { self: new Map(), inclusive: new Map(), files: new Map() };
const increment = (map, key, micros) => map.set(key, (map.get(key) ?? 0) + micros);
const label = frame => {
  const url = frame.url || '';
  const file = url.includes('/src/') ? url.slice(url.lastIndexOf('/src/') + 1) : url.startsWith('node:') ? url : url.includes('wasm') ? 'wasm' : url ? 'external' : '(runtime)';
  const func = frame.functionName || ('anonymous:' + (frame.lineNumber + 1));
  return { name: func + '@' + file, file };
};
let microsTotal = 0;
for (const name of files) {
  const profile = JSON.parse(readFileSync(join(root, name), 'utf8'));
  const nodes = new Map(profile.nodes.map(node => [node.id, label(node.callFrame)]));
  const parents = new Map(profile.nodes.flatMap(node => (node.children ?? []).map(child => [child, node.id])));
  for (const [index, id] of profile.samples.entries()) {
    const micros = profile.timeDeltas[index], leaf = nodes.get(id);
    microsTotal += micros;
    if (!leaf) continue;
    increment(maps.self, leaf.name, micros);
    increment(maps.files, leaf.file, micros);
    const seen = new Set();
    for (let current = id; current !== undefined; current = parents.get(current)) {
      const node = nodes.get(current);
      if (!node || seen.has(node.name)) continue;
      increment(maps.inclusive, node.name, micros);
      seen.add(node.name);
    }
  }
}
const top = (map, count, predicate = () => true) => [...map.entries()].filter(([name]) => predicate(name))
  .sort((a, b) => b[1] - a[1]).slice(0, count).map(([name, micros]) => [name, Math.round(micros / 1000)]);
console.log(JSON.stringify({ chunks: files.length, sampledMs: Math.round(microsTotal / 1000),
  self: top(maps.self, 14), files: top(maps.files, 12),
  owner: top(maps.inclusive, 9, name => name.endsWith('/oriented-delivery.ts')),
  common: top(maps.inclusive, 10, name => name.includes('@src/') && !name.endsWith('/oriented-delivery.ts')),
}));
