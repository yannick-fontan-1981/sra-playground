import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { answerCard, publicCard } from './cards.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const operations = ['rename', 'add', 'rewire', 'mask'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Same xorshift32 as scripts/sic-transfer-generator.mjs on codex/sic-transfer-pilot.
function randomFrom(seed) {
  let state = (seed >>> 0) || 1;
  return limit => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % limit;
  };
}

function freshName(draw, used) {
  // Linear probing also terminates if consecutive draws collide.
  let code = draw(0x1000000);
  while (used.has('X' + code.toString(16).padStart(6, '0'))) code = (code + 1) % 0x1000000;
  const name = 'X' + code.toString(16).padStart(6, '0');
  used.add(name);
  return name;
}

function names(model) {
  return [...model.stamps, ...model.cells, ...Object.keys(model.wiring)];
}

// Closed-form construction of the key. The evaluator has its own transition system.
function makeKey({ cells, wiring, seen }) {
  const outputs = seen === null ? Object.keys(wiring).sort() : [seen];
  return {
    prefix: seen === null ? ['lire'] : [],
    branches: outputs.map(output => {
      const stamp = wiring[output];
      const marks = cells.map(cell => 'marquer ' + cell + ' ' + stamp);
      return { output, stamp, plans: [[...marks, 'valider'], [...marks].reverse().concat('valider')] };
    }),
  };
}

function record(parentId, transformation, model) {
  model.cells.sort();
  model.stamps.sort();
  model.wiring = Object.fromEntries(Object.entries(model.wiring).sort(([a], [b]) => a < b ? -1 : 1));
  const id = digest([parentId, transformation, model]).slice(0, 20);
  return { id, parentId, transformation, model, key: makeKey(model) };
}

function root(seed) {
  const draw = randomFrom(seed);
  const used = new Set();
  const name = () => freshName(draw, used);
  const stamps = [name(), name(), name()];
  const cells = [name(), name()];
  const outputs = [name(), name()];
  const wiring = Object.fromEntries(outputs.map((out, i) => [out, stamps[i]]));
  return record(null, { kind: 'root' }, { stamps, cells, wiring, seen: outputs[draw(2)] });
}

// Takes the persisted parent, including when it already represents several worlds.
export function derive(parent, kind, seed) {
  const model = structuredClone(parent.model);
  const draw = randomFrom(seed);
  const used = new Set(names(model));
  const transformation = { kind };
  switch (kind) {
    case 'rename': {
      const map = Object.fromEntries([...used].sort().map(old => [old, freshName(draw, used)]));
      transformation.map = map;
      model.stamps = model.stamps.map(x => map[x]);
      model.cells = model.cells.map(x => map[x]);
      model.wiring = Object.fromEntries(Object.entries(model.wiring).map(([out, stamp]) => [map[out], map[stamp]]));
      if (model.seen !== null) model.seen = map[model.seen];
      break;
    }
    case 'add':
      transformation.stamp = freshName(draw, used);
      model.stamps.push(transformation.stamp);
      break;
    case 'rewire': {
      const outputs = Object.keys(model.wiring);
      const output = model.seen ?? outputs[draw(outputs.length)];
      const free = model.stamps.filter(x => !Object.values(model.wiring).includes(x));
      const from = model.wiring[output];
      const to = free[draw(free.length)];
      Object.assign(transformation, { output, from, to });
      model.wiring[output] = to;
      break;
    }
    case 'mask':
      if (model.seen === null) throw new Error('mask exige une position encore visible');
      model.seen = null;
      break;
    default:
      throw new Error('Transformation inconnue : ' + kind);
  }
  return record(parent.id, transformation, model);
}

export function campaign(seed, chain) {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Graine attendue : entier de 1 à 4294967295');
  const start = root(seed);
  const cases = [start];
  function child(parent, kind) {
    const localSeed = parseInt(digest([seed, parent.id, kind]).slice(0, 8), 16);
    const result = derive(parent, kind, localSeed);
    cases.push(result);
    return result;
  }
  if (chain !== undefined) {
    chain.reduce(child, start);
  } else {
    const siblings = Object.fromEntries(operations.map(kind => [kind, child(start, kind)]));
    ['mask', 'rename', 'add'].reduce(child, siblings.rewire);
  }
  return { version: 1, seed, cases };
}

function writeCorpus(directory, corpus) {
  const files = new Map([['corriges/corpus.json', JSON.stringify(corpus, null, 2) + '\n']]);
  for (const { id, model, key } of corpus.cases) {
    files.set('public/' + id + '.md', publicCard(model));
    files.set('corriges/' + id + '.md', answerCard(key, model));
  }
  if (existsSync(directory)) {
    // Allow an identical rerun, including a checked-out example with native newlines.
    for (const sub of ['public', 'corriges']) {
      const folder = join(directory, sub);
      const expected = [...files.keys()].filter(file => file.startsWith(sub + '/')).length;
      if (!existsSync(folder) || readdirSync(folder).length !== expected) {
        throw new Error('Inventaire différent dans ' + folder + '. Choisir un nouveau --out.');
      }
    }
    for (const [file, data] of files) {
      const path = join(directory, file);
      if (!existsSync(path) || readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== data) {
        throw new Error('Le dossier contient un autre jeu de fiches. Choisir un nouveau --out.');
      }
    }
    return;
  }
  mkdirSync(dirname(directory), { recursive: true });
  const staging = mkdtempSync(directory + '.');
  try {
    for (const [file, data] of files) {
      const target = join(staging, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data, 'utf8');
    }
    renameSync(staging, directory);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { seed: { type: 'string', default: '107' },
    chain: { type: 'string' }, out: { type: 'string' } } });
  const seed = Number(values.seed);
  const chain = values.chain?.split(',');
  const corpus = campaign(seed, chain);
  const directory = resolve(values.out ?? join(here, 'generated', String(seed) + (chain ? '-' + chain.join('-') : '')));
  writeCorpus(directory, corpus);
  console.log(corpus.cases.length + ' fiches et corrigés écrits ou reproduits dans ' + directory);
}
