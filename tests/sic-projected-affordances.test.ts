import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fitMotion,
  projectedStep,
  spatialControls,
  type Layout,
  type Sample,
} from '../src/sic/projected-motion.ts';
import { contactAspirations, allocateHorizon } from '../src/sic/contact-aspirations.ts';
import type { NativeEntity } from '../src/logos-engine/v6-native-types.ts';
import { recordProjection, newProjectionMemory } from '../src/sic/projected-affordances.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
const sample = (before: Layout, after: Layout, ref: number): Sample => ({ before, after, ref });
test('an unseen marker column retains the motion enabled on its row', () => {
  const records: Sample[] = [];
  for (const x of [2, 5, 8])
    for (const y of [3, 7]) {
      records.push(
        sample(
          [
            [1, 1],
            [x, y],
          ],
          [
            [1, y === 7 ? 5 : 1],
            [x, y],
          ],
          records.length + 1
        )
      );
    }
  const model = fitMotion('use', records);
  assert.deepEqual(
    projectedStep(model, [
      [1, 1],
      [9, 7],
    ]),
    [
      [1, 5],
      [9, 7],
    ]
  );
  assert.deepEqual(
    projectedStep(model, [
      [1, 1],
      [9, 3],
    ]),
    [
      [1, 1],
      [9, 3],
    ]
  );
});
test('a witnessed exchange projects an unobserved separation and direction', () => {
  const model = fitMotion('activate', [
    sample(
      [
        [1, 1],
        [5, 1],
      ],
      [
        [5, 1],
        [1, 1],
      ],
      1
    ),
  ]);
  assert.deepEqual(
    projectedStep(model, [
      [3, 7],
      [2, 4],
    ]),
    [
      [2, 4],
      [3, 7],
    ]
  );
});
test('a correct landing cannot certify the next move', () => {
  const m = initialMemory(1);
  m.projection = newProjectionMemory();
  const A: Layout = [
      [1, 1],
      [4, 1],
    ],
    B: Layout = [
      [4, 1],
      [1, 1],
    ],
    C: Layout = [
      [5, 1],
      [1, 1],
    ];
  const plan = {
    roles: ['p', 'q'] as [string, string],
    steps: [
      { op: 'transfer', from: A, to: B, refs: [1] },
      { op: 'right', from: B, to: C, refs: [2] },
    ],
    arrival: 0,
    goals: [],
    score: 10,
    region: false,
  };
  const obs = (p: Layout) =>
    ({
      entities: p.map((position, i) => ({ signature: plan.roles[i], position })),
      state: 'PLAY',
      level_epoch: 1,
      levels_completed: 0,
    }) as NativeObservation;
  assert.equal(recordProjection(m, { plan, index: 0 }, obs(A), obs(B)).result, 'arrival_verified');
  assert.equal(m.projection.active?.index, 1);
  assert.equal(recordProjection(m, m.projection.active!, obs(B), obs(B)).result, 'projection_refuted');
  assert.equal(m.projection.active, null);
});

test('transfers an unused control direction only at a scale witnessed by this role', () => {
  const evidence = new Map([
    [
      'ACTION1',
      [
        sample(
          [
            [4, 4],
            [5, 5],
          ],
          [
            [4, 2],
            [5, 5],
          ],
          1
        ),
      ],
    ],
    [
      'ACTION4',
      [
        sample(
          [
            [4, 4],
            [5, 5],
          ],
          [
            [6, 4],
            [5, 5],
          ],
          2
        ),
      ],
    ],
  ]);
  const controls = spatialControls(evidence, new Set(['ACTION1', 'ACTION4', 'ACTION2', 'ACTION5']));
  const inferred = controls.find((m) => m.op === 'ACTION2');
  assert.ok(inferred);
  assert.deepEqual(
    projectedStep(inferred, [
      [3, 1],
      [5, 5],
    ]),
    [
      [3, 3],
      [5, 5],
    ]
  );
  assert.ok(!controls.some((m) => m.op === 'ACTION5'));
});

test('plans backwards from a distant use while only the preparatory role is moving', () => {
  const piece = (id: string, x: number) =>
    ({
      id,
      signature: id,
      position: [x, 0],
      bbox: [x, 0, x, 0],
      area: 1,
      identity_ambiguous: false,
    }) as NativeEntity;
  const at: Layout = [
    [0, 0],
    [2, 0],
  ];
  const swap = fitMotion('activate', [
    sample(
      at,
      [
        [2, 0],
        [0, 0],
      ],
      1
    ),
  ]);
  const slide = fitMotion('slide', [
    sample(
      at,
      [
        [0, 0],
        [3, 0],
      ],
      2
    ),
  ]);
  const rank = contactAspirations(
    [piece('user', 0), piece('mechanism', 2)],
    [piece('target', 20)],
    [swap, slide],
    [new Set(['0,0']), new Set(['2,0'])],
    at
  );
  const near: Layout = [
    [0, 0],
    [19, 0],
  ];
  assert.ok(rank(near).dist[0]! < rank(at).dist[0]!);
  assert.ok(rank(near).reward > rank(at).reward);
});
test('separate goals retain search paths when aggregate reward favors one direction', () => {
  const nodes = Array.from({ length: 20 }, (_, x) => ({
    p: [
      [x, 0],
      [0, 1],
    ] as Layout,
    uncertainty: 0,
  }));
  const kept = allocateHorizon(nodes, (p) => ({ dist: [p[0][0], 19 - p[0][0]], reward: p[0][0] }), 8);
  assert.ok(kept.includes(nodes[0]!));
  assert.ok(kept.includes(nodes[19]!));
  assert.equal(kept.length, 8);
});
