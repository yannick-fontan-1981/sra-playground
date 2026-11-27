import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { writeFiles } from '../write-set.mjs';
import { card, keyPage } from './cards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const base = '4b58e1146a7620715e4dfd1b02e52bc05305ff36';
const hash = text => createHash('sha256').update(text, 'utf8').digest();
const hex = text => hash(text).toString('hex');
export function config(seed) {
  const bytes = hash('montage/' + seed);
  return [bytes[0] & 1, bytes[1] & 1];
}
export function selectReserve() {
  const dev = config('17');
  for (let n = 0; ; n++) {
    const seed = 'r-' + hex('sra-ressource-v1/' + base + '/' + n).slice(0, 32);
    if (config(seed).every((bit, i) => bit !== dev[i])) return { n, seed };
  }
}

// Analytic answer construction, independent of the simulator.
function makeKey(m) {
  const prefix = [];
  if (!m.purged) prefix.push('purger ' + m.source);
  if (m.current === null) prefix.push('sonder ' + m.source);
  const lock = 'bloquer ' + m.source, remove = 'retirer ' + m.source;
  const index = 'indexer ' + m.receiver, seal = 'sceller ' + m.receiver;
  return Object.fromEntries((m.current ? [m.current] : [m.drop, m.jam].sort()).map(code => {
    const pair = code === m.drop ? [lock, remove] : [remove, lock];
    const plans = [[...prefix, ...pair, ...(m.indexed ? [index] : []), seal]];
    if (m.indexed && code === m.jam) plans.push([...prefix, remove, index, lock, seal]);
    return [code, plans];
  }));
}

export function suite(seed) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,64}$/.test(seed)) throw new Error('Graine alphanumérique attendue');
  const ids = new Set();
  function name(role) {
    let i = 0, token;
    do { token = 'J' + hex(seed + '/' + role + '/' + i++).slice(0, 6); } while (ids.has(token));
    ids.add(token);
    return token;
  }
  const [polarity, indexing] = config(seed);
  const source = name('source'), receiver = name('receiver');
  const codes = [name('effort-a'), name('effort-b')].sort();
  const archive = codes[hash('archive/' + seed)[0] & 1];
  const apparatus = { source, receiver, drop: codes[polarity], jam: codes[1 - polarity], indexed: Boolean(indexing), archive };
  const starts = [[true, codes[0]], [true, codes[1]], [true, null], [false, null]];
  return { version: 1, seed, cases: starts.map(([purged, current], i) => {
    const model = { ...apparatus, purged, current };
    return { id: hex('fiche/' + seed + '/' + i).slice(0, 20), model, key: makeKey(model) };
  }) };
}

export function writeSuite(dir, corpus) {
  const files = new Map([['corriges/corpus.json', JSON.stringify(corpus, null, 2) + '\n']]);
  for (const c of corpus.cases) {
    files.set('public/' + c.id + '.md', card(c.model));
    files.set('corriges/' + c.id + '.md', keyPage(c.model, c.key));
  }
  writeFiles(dir, files);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, reserve: { type: 'boolean' }, out: { type: 'string' } } });
  if (values.reserve && values.seed !== undefined) throw new Error('Choisir --reserve ou --seed');
  const seed = values.reserve ? selectReserve().seed : values.seed ?? '17';
  const corpus = suite(seed);
  const dest = resolve(values.out ?? join(here, 'generated', values.reserve ? 'reserve' : seed));
  writeSuite(dest, corpus);
  console.log('Fiches publiques dans ' + join(dest, 'public'));
  for (const c of corpus.cases) console.log(c.id + '.md');
}
