import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { decide } from '../public-v1/planifier.mjs';

const target = new URL('../public-v1/planifier.mjs?compteurs', import.meta.url).href;
const hooks = registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url !== target) return result;
  let source = Buffer.from(result.source).toString('utf8').replaceAll('\r\n', '\n');
  const blob = createHash('sha1').update('blob ' + Buffer.byteLength(source) + '\0').update(source).digest('hex');
  assert.equal(blob, '9ed9363a11a98eb57da58f991d7a8002ce3e057c', 'planificateur du gel f296ac1c');
  function replace(from, to) {
    assert.equal(source.split(from).length, 2, from);
    source = source.replace(from, to);
  }
  replace('  const costs = new Map()', '  probe.root(stateKey(state));\n  const costs = new Map()');
  replace('export function project(model, state, id) {', 'export function project(model, state, id) {\n  probe.projections++;');
  replace('    if (!depth) return false;', '    probe.visit(stateKey(s), depth, depth > 0 && memo.has(key([stateKey(s), depth])));\n    if (!depth) return false;');
  replace('      for (const [id, t] of transitions)', '      probe.horizons.push(depth);\n      for (const [id, t] of transitions)');
  replace('new Agenda().decide({', 'probe.arbitrate(new Agenda(), {');
  source += '\nlet probe; export function measured(m, s, p) { probe = p; try { return decide(m, s); } finally { probe = undefined; } }\n';
  return { ...result, source };
} });
let measured;
try { ({ measured } = await import(target)); } finally { hooks.deregister(); }

export function count(model, state) {
  const visited = new Set(), expanded = new Set();
  const probe = {
    projections: 0, calls: 0, hits: 0, frontier: 0, horizons: [], admitted: [], finalists: [],
    root(k) { visited.add(k); expanded.add(k); },
    visit(k, depth, hit) {
      visited.add(k);
      this.calls++;
      if (depth === 0) this.frontier++;
      else if (hit) this.hits++;
      else expanded.add(k);
    },
    arbitrate(agenda, turn) {
      const result = agenda.decide(turn);
      this.admitted = result.tree.branches.filter(b => b.admission === 'admissible').map(b => b.id);
      this.finalists = result.tree.branches.filter(b => b.contribution === 'directe').map(b => b.id);
      return result;
    },
  };
  const result = measured(model, state, probe);
  assert.deepEqual(result, decide(model, state), 'même sortie complète que le module non instrumenté');
  return { result, metrics: { horizons: probe.horizons, visited: visited.size, expanded: expanded.size,
    calls: probe.calls, cacheHits: probe.hits, frontierCalls: probe.frontier, projections: probe.projections },
    offered: { admissible: probe.admitted, contributing: probe.finalists } };
}
