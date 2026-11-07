import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SurfaceProgram, surfaceCrop, surfaceInside, measureSurfaceLayout, observeSurface, surfaceAttachment,
  advanceSurfacePose, makeSurfaceMasks, paintSurface, surfaceProgram } from '../src/logos-engine/v6-surface-program.ts';
import { CodeProgram, codeInputAt, measureCodeScene, codePosition, codeBits, moveCodePosition, physicalCodePaths,
  encodeCodeWord, decodeCodeWord } from '../src/logos-engine/v6-code-program.ts';
import { BandTransfer, measureBandGeometry, bandQuantities, bandEffect, findBandPath } from '../src/logos-engine/v6-band-transfer.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-program-families-reference.json', import.meta.url), 'utf8'));
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const classes = { surface: SurfaceProgram, code: CodeProgram, band: BandTransfer };

async function executeCase(sample: any): Promise<unknown> {
  const a = sample.arguments, scene = reference.scenes[a.scene];
  if (sample.family === 'band') switch (sample.operation) {
    case 'geometry': return measureBandGeometry(scene.observation, scene.rows, scene.inputs);
    case 'quantities': return bandQuantities(scene.rows, a.model);
    case 'effect': return bandEffect(a.q, a.control, a.sense, a.unit);
    case 'find_path': return findBandPath(a.q, a.targets, a.sense, a.unit, a.blocked, a.remaining);
  }
  if (sample.family === 'surface') switch (sample.operation) {
    case 'layout': return measureSurfaceLayout(scene.observation, scene.rows, scene.inputs);
    case 'observe': return observeSurface(scene.rows, a.layout);
    case 'attachment': { const result = surfaceAttachment(a.layout, scene.observation, scene.inputs, a.state); return result ? [result[0].map(String), result[1], result[2]] : null; }
    case 'make_masks': return makeSurfaceMasks(a.width, a.height, a.inclusive).map(String);
    case 'paint': return paintSurface(a.grid, BigInt(a.mask), a.hue);
    case 'program': return surfaceProgram(a.current, a.target, a.pose, a.hue, a.masks.map(BigInt));
    case 'advance_all': return Array.from({ length: 8 }, (_, p) => Array.from({ length: 8 }, (_, aim) => advanceSurfacePose(p, aim, a.motion)));
    case 'crop': return surfaceCrop(scene.rows, a.box);
    case 'inside': return surfaceInside(a.point, a.box);
  }
  if (sample.family === 'code') switch (sample.operation) {
    case 'scene': return measureCodeScene(scene.observation, scene.rows, scene.inputs);
    case 'input_at': return codeInputAt(scene.inputs, a.box);
    case 'position': return codePosition(scene.rows, a.board);
    case 'bits': return codeBits(scene.rows, a.board);
    case 'bits_rows': return codeBits(a.rows, a.board);
    case 'move': return moveCodePosition(a.position, a.delta, a.board);
    case 'physical_paths': return physicalCodePaths(a.board, a.start, a.length, new Map(a.effects.map(([word, vector]: any) => [decodeCodeWord(word), vector])));
  }
  throw new Error(`Unknown oracle helper ${sample.family}/${sample.operation}`);
}

for (const sample of reference.cases) test(`original V6 ${sample.family} helper parity: ${sample.id}`, async () => {
  if (sample.error) await assert.rejects(() => executeCase(sample), (error: unknown) => error instanceof Error && error.message === sample.error);
  else assert.deepEqual(plain(await executeCase(sample)), sample.expected);
});

for (const scenario of reference.scenarios) test(`original V6 ${scenario.family} program and persistent memory parity: ${scenario.id}`, async () => {
  const Constructor = classes[scenario.family as keyof typeof classes];
  let memory = new Constructor(), proposal: any = null, domain: ObservedInputDomain | null = null;
  for (const [ordinal, sample] of scenario.steps.entries()) {
    const op = sample.operation;
    const execute = async (): Promise<unknown> => {
      if (op.kind === 'propose') {
        const view = reference.scenes[op.scene]; domain = new ObservedInputDomain(4096); const inputs = domain.candidates(view.observation);
        proposal = await memory.propose(view.observation, view.rows, op.inputs ?? inputs, op.remaining ?? 100); return proposal;
      }
      if (op.kind === 'bind') { memory.bind(proposal, domain!); return proposal; }
      if (op.kind === 'before') return memory.before(proposal, op.index ?? 0, reference.scenes[op.scene].public, reference.scenes[op.observation ?? op.scene].observation);
      if (op.kind === 'after' || op.kind === 'record') {
        const before = reference.scenes[op.before], after = reference.scenes[op.after], index = op.index ?? 0;
        if (op.kind === 'after') return memory.after(proposal, index, before.observation, after.observation, before.rows, after.rows);
        if (memory instanceof CodeProgram) return memory.record(before.observation, after.observation, proposal.actions[index], before.rows, after.rows, proposal, index, (op.frames ?? []).map((name: string) => reference.scenes[name].rows));
        return memory.record(before.observation, after.observation, proposal.actions[index], before.rows, after.rows, proposal, index);
      }
      throw new Error(`Unknown oracle operation ${op.kind}`);
    };
    let actual: any;
    try { actual = { result: plain(await execute()), state: memory.state() }; }
    catch (error) { actual = { error: error instanceof Error ? error.message : String(error), state: memory.state() }; }
    assert.deepEqual(plain(actual), sample.expected, `${scenario.id}, operation ${ordinal + 1}: ${op.kind}`);
    const restored = new Constructor(); restored.restore(memory.state()); assert.deepEqual(restored.state(), memory.state()); memory = restored;
  }
});

test('native program-family state codecs retain every bit and reject unrelated snapshots', () => {
  const value = (1n << 127n) + (1n << 63n) + 3n;
  assert.equal(decodeCodeWord(encodeCodeWord(value)), value);
  assert.equal(encodeCodeWord(42n), 42);
  assert.throws(() => decodeCodeWord(Number.MAX_SAFE_INTEGER + 1), /Invalid exact/);
  const surface = new SurfaceProgram(); surface.masks = [[value]];
  const restored = new SurfaceProgram(); restored.restore(surface.state()); assert.equal(restored.masks![0]![0], value);
  for (const Constructor of Object.values(classes)) {
    const memory = new Constructor(), state = memory.state(); memory.restore(state); assert.deepEqual(memory.state(), state);
    assert.throws(() => memory.restore({ ...state, format: 'unrelated' }), /Incompatible/);
  }
});

test('all original source routines were executed and the pinned files retain their hashes', async () => {
  assert.deepEqual(reference.coveredSourceFunctions.surface, ['__init__', 'advance', 'after', 'attachment', 'before', 'bind', 'cost', 'crop', 'inside', 'layout', 'make_masks', 'match', 'nominal', 'observe', 'options', 'paint', 'predict', 'program', 'propose', 'record', 'start', 'useful']);
  assert.deepEqual(reference.coveredSourceFunctions.code, ['__init__', 'after', 'before', 'bind', 'bits', 'input_at', 'move', 'physical_paths', 'position', 'propose', 'record', 'scene', 'start', 'walk']);
  assert.deepEqual(reference.coveredSourceFunctions.band, ['__init__', 'after', 'before', 'bind', 'effect', 'find_path', 'geometry', 'lower', 'propose', 'quantities', 'record', 'start']);
  for (const [path, expected] of Object.entries(reference.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${reference.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
