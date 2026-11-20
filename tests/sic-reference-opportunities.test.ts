import { test } from 'node:test';
import assert from 'node:assert/strict';
import { naturalControls } from '../src/sic/natural-reference-controls.ts';
import { measuredReferenceRecipes } from '../src/sic/measured-reference-recipes.ts';
import { routeToReference } from '../src/sic/route-to-reference.ts';
import { initialMemory, type Edge } from '../src/sic/preparation-experiments.ts';
import type { FrameEffect, FramePose } from '../src/sic/motion-frames.ts';
import type { InverseInputs } from '../src/sic/inverse-frame-sites.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import type { XY } from '../src/sic/access-terrain.ts';
const traveller = { signature: 'p', fixed: [] },
  reference = { signature: 'r', fixed: [] };
const id = (r: typeof traveller) => JSON.stringify([r.signature, r.fixed]);
const rows = Array.from({ length: 16 }, () => Array(16).fill(0));
function pose(scene: number, from: XY, placed: XY): FramePose {
  return {
    scene,
    index: scene,
    from,
    role: traveller,
    anchors: new Map<string, XY>([
      ['self', from],
      ['world', [0, 0]],
      ['r', placed],
    ]),
  };
}
function evidence(): InverseInputs {
  const before: FrameEffect = { ...pose(1, [2, 2], [5, 2]), index: 1, afterScene: 2, to: [5, 2] };
  const write: FrameEffect = {
    ...pose(3, [5, 2], [5, 2]),
    role: reference,
    index: 3,
    afterScene: 4,
    to: [8, 2],
  };
  return {
    i: 4,
    rows,
    now: { s: 4, g: new Map() },
    known: new Map([
      ['Q', new Map([[id(traveller), traveller]])],
      ['A', new Map([[id(reference), reference]])],
    ]),
    history: new Map([
      ['Q/' + id(traveller), [before]],
      ['A/' + id(reference), [write]],
    ]),
    tried: new Set(),
    sample: (_g, _s, r) => (r.signature === 'p' ? pose(4, [2, 2], [8, 2]) : null),
    pairAt: () => ({ from: [2, 2], to: [2, 2] }),
  };
}
test('a past preparation can leave two different causal predictions to measure with one command', () => {
  const args = evidence(),
    p = naturalControls(args)[0]!;
  assert.deepEqual([p.q, p.to, p.without, p.relative, p.world], ['Q', [8, 2], [5, 2], [5, 2], [5, 2]]);
  assert.equal(naturalControls({ ...args, pairAt: () => ({ from: [3, 2], to: [2, 2] }) }).length, 0);
  args.history.get('Q/' + id(traveller))!.push({ ...pose(4, [2, 2], [8, 2]), index: 5, to: [8, 2] });
  assert.equal(naturalControls(args).length, 0);
  assert.deepEqual(
    measuredReferenceRecipes(args).map((r) => r.refs),
    [[1, 5]]
  );
  assert.deepEqual(measuredReferenceRecipes({ ...args, pairAt: () => null }), []);
});
test('a mixed path can put a measured reference at an as-yet untested destination', () => {
  const m = initialMemory(1);
  m.scenes = ['h0|A,Q', 'h1|B,Q', 'h2|C,Q'];
  const edge = (s: number, t: number, cmd: string, x: number, ref: number): Edge => ({
    s,
    t,
    cmd,
    ref,
    stable: true,
    effect: { key: 'motion', moves: [] },
    anchors: {
      r: { at: x + ',2', exterior: '' },
      p: { at: '1,2', exterior: '' },
      target: { at: '9,2', exterior: '' },
    },
  });
  m.edges = [edge(0, 1, 'A', 5, 1), edge(1, 2, 'B', 7, 2), edge(2, 2, 'C', 9, 3)];
  const o = {
    revision: 10,
    entities: [{ signature: 'target', area: 1, identity_ambiguous: false }],
  } as NativeObservation;
  const recipe = {
    q: 'Q',
    role: traveller,
    anchor: 'r',
    offset: [0, 0] as XY,
    refs: [5, 8],
    placement: [4, 2] as XY,
  };
  const p = routeToReference(m, o, 0, rows, [recipe])[0]!;
  assert.deepEqual(
    p.via?.map((e) => e.op),
    ['A', 'B']
  );
  assert.deepEqual(p.to, [9, 2]);
  m.edges[1]!.stable = false;
  assert.ok(routeToReference(m, o, 0, rows, [recipe]).every((v) => v.to[0] !== 9));
});
