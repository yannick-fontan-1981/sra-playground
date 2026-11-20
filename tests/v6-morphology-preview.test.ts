import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectMorphologicalPreview,
  measureMorphologicalPreview,
  type PreviewSample,
} from '../src/logos-engine/v6-morphology-preview.ts';

function observation(ref: number, mark: number, indicatorForm: string, subjectForm: string): PreviewSample {
  return {
    ref,
    before: { traveller: [1, 2], indicator: [mark, 5], companion: [1, 3] },
    after: { traveller: [mark, 5], companion: [mark, 6] },
    beforeForms: { indicator: indicatorForm },
    afterForms: { traveller: subjectForm },
  };
}
const scene = { traveller: [1, 2], indicator: [12, 5], companion: [1, 3] } as const;
function project(samples: PreviewSample[], controls: number[] = [], counter: number[] = []) {
  return projectMorphologicalPreview(
    { ...scene, traveller: [1, 2], indicator: [12, 5], companion: [1, 3] },
    { indicator: 'tilted' },
    'traveller',
    'indicator',
    'trigger',
    samples,
    controls,
    counter
  )!;
}
test('a visible mark is a conditional proposal before there is any demonstrated effect', () => {
  const preview = project([]);
  assert.equal(preview.evidence.status, 'hypothesis');
  assert.deepEqual(preview.layout, [{ subject: 'traveller', at: [12, 5], form: null }]);
  assert.equal(
    measureMorphologicalPreview(preview, 'trigger', { traveller: [1, 2], indicator: [12, 5] }, {}, true)
      .status,
    'contradicted'
  );
  assert.equal(
    measureMorphologicalPreview(preview, 'other', { traveller: [12, 5] }, {}, true).status,
    'inapplicable'
  );
  assert.equal(
    measureMorphologicalPreview(preview, 'trigger', { indicator: [12, 5] }, {}, true).status,
    'unobserved'
  );
  assert.equal(
    measureMorphologicalPreview(preview, 'trigger', { traveller: [12, 5] }, {}, false).status,
    'inapplicable'
  );
});
test('after independent examples a preview can encode a future arrangement and a conditional pose', () => {
  const rows = [
    observation(2, 3, 'tilted', 'upright'),
    observation(8, 6, 'tilted', 'upright'),
    observation(10, 9, 'level', 'sideways'),
  ];
  const p = project(rows, [12]);
  assert.equal(p.evidence.status, 'replicated_with_control');
  assert.deepEqual(p.layout, [
    { subject: 'traveller', at: [12, 5], form: 'upright' },
    { subject: 'companion', at: [12, 6], form: null },
  ]);
  assert.equal(
    measureMorphologicalPreview(
      p,
      'trigger',
      { traveller: [12, 5], companion: [12, 6] },
      { traveller: 'upright' },
      true
    ).status,
    'realized'
  );
  assert.equal(
    measureMorphologicalPreview(
      p,
      'trigger',
      { traveller: [12, 5], companion: [11, 6] },
      { traveller: 'upright' },
      true
    ).status,
    'contradicted'
  );
  assert.equal(
    measureMorphologicalPreview(
      p,
      'trigger',
      { traveller: [12, 5], companion: [12, 6] },
      { traveller: 'sideways' },
      true
    ).status,
    'contradicted'
  );
  assert.equal(project(rows).evidence.status, 'witnessed');
  assert.equal(project(rows, [12], [14]).evidence.status, 'witnessed');
});
test('a participant with inconsistent offsets or missing observations has no projected pose', () => {
  const a = observation(2, 3, 'tilted', 'upright'),
    b = observation(7, 8, 'tilted', 'upright');
  const rows = [a, { ...b, after: { ...b.after, companion: [2, 5] as [number, number] } }];
  assert.equal(project(rows, [3]).layout.length, 1);
  assert.equal(project([a, { ...b, after: { traveller: [8, 5] } }], [3]).layout.length, 1);
});
