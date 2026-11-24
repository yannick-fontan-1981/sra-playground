import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { splitNativeState } from '../src/logos-engine/v6-native-state-graph.ts';
import { contactProject, type Board } from '../src/sic/contact-frontier-search.ts';
import {
  newContactMemory,
  observeRegionArrival,
  observeContactDisplacement,
  inheritFrontierContacts,
  proposeFrontierContact,
  recordFrontierContact,
} from '../src/sic/contact-frontier.ts';
import { newPreviewLearning, visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import type { XY } from '../src/sic/access-terrain.ts';

const limits = { maxNodes: 100, maxDepth: 20 };
const moves: [string, XY][] = [
  ['west', [-4, 0]],
  ['south', [0, 4]],
  ['east', [4, 0]],
  ['north', [0, -4]],
];
async function room(actor: number, piece: number, divided: boolean, revision: number) {
  // Independent toy environment: a lift delivers the subject to a room with
  // an unlabelled block. No goal, reflection, or completion from an earlier level.
  const pixels = Array.from({ length: 10 }, (_, y) =>
    Array.from({ length: 22 }, (_, x) => {
      const col = Math.floor(x / 2),
        row = Math.floor(y / 2);
      if (row === 2 && col === actor) return 7;
      if (row === 2 && col === piece) return 5;
      return row >= 1 && row <= 3 && col >= 1 && col <= 9 && (!divided || col !== 4) ? 2 : 9;
    })
  );
  const observation = await measureNativeObservation(
    {
      frame_rows: pixels,
      frame_hash: await publicFrameHash(pixels),
      level: 1,
      levels_completed: 0,
      state: 'NOT_FINISHED',
      available_action_refs: [...moves.map(([op]) => op), 'lift'],
    },
    revision
  );
  return { pixels, observation };
}
async function landing(divided: boolean) {
  const before = await room(2, 7, divided, 1),
    after = await room(6, 7, divided, 2);
  const role = Object.entries(visualLayout(before.observation, before.pixels)).find(([, parts]) =>
    parts.some((p) => p.at.join() === '9,9')
  )![0];
  const learning = newPreviewLearning();
  learning.partMotion = {
    [role]: {
      axes: Object.fromEntries(
        moves.map(([op, d]) => [op, { [d.join()]: { d, count: 3, first: 'prior', last: 'prior' } }])
      ),
      sites: {},
      substrate: { 2: 8 },
    },
  };
  const memory = newContactMemory();
  observeRegionArrival(memory, learning, before.observation, after.observation, before.pixels, after.pixels);
  return { after, memory, learning };
}
test('entry into an unvisited component creates and checks an object experiment without a goal or a previous level', async () => {
  const { after, memory, learning } = await landing(true);
  assert.equal(memory.arrival, true);
  const trial = proposeFrontierContact(memory, learning, after.observation, after.pixels, limits)!;
  assert.equal(trial.project.purpose, 'test_contact');
  assert.equal(trial.step.op, 'east');
  assert.equal(Object.hasOwn(trial, 'controlRole'), false);
  assert.doesNotThrow(() => splitNativeState({ experiment: { contactProject: trial } }, 'pivot-free-contact'));
  const moved = await room(7, 8, true, 3);
  assert.equal(
    recordFrontierContact(memory, learning, after.observation, moved.observation, after.pixels, moved.pixels, trial),
    'object_displaced'
  );
  assert.deepEqual(memory.displaced, [trial.step.role]);
  assert.deepEqual(memory.supported, []);
});
test('a long movement in the same accessible component does not launch the new-region experiment', async () => {
  const { after, memory, learning } = await landing(false);
  assert.ok(!memory.arrival);
  assert.equal(proposeFrontierContact(memory, learning, after.observation, after.pixels, limits), null);
});
test('a projected support is tested at a gap that connects distinct regions, with a reachable pushing stance', () => {
  const board: Board = {
    width: 7,
    height: 3,
    floor: new Set([7, 8, 9, 11, 12]),
    goals: [12],
    actor: 7,
    parts: [9],
    roles: ['part'],
    pivotIndex: -1,
    motors: [
      { op: 'east', delta: 1 },
      { op: 'west', delta: -1 },
    ],
  };
  const project = contactProject(board, new Set(), limits)!;
  assert.equal(project.purpose, 'test_support');
  assert.equal(project.site, 10);
  assert.deepEqual(
    project.steps.map((s) => [s.op, s.from, s.to]),
    [
      ['east', 7, 8],
      ['east', 8, 9],
    ]
  );
  assert.equal(project.steps[1]!.boundary, true);
  assert.equal(contactProject({ ...board, floor: new Set([7, 8, 9, 12]) }, new Set(), limits), null);
});

test('only actual entry confirms a terrain change and supplies evidence for a second object of the same role', async () => {
  async function channel(actor: number, objects: number[], revision: number) {
    const pixels = Array.from({ length: 6 }, (_, y) =>
      Array.from({ length: 18 }, (_, x) => {
        const col = Math.floor(x / 2);
        if (Math.floor(y / 2) !== 1 || col < 1 || col > 7) return 9;
        if (col === actor) return 7;
        if (objects.includes(col)) return 5;
        if (col === 7) return 6;
        return col === 3 || col === 6 ? 9 : 2;
      })
    );
    const observation = await measureNativeObservation(
      {
        frame_rows: pixels,
        frame_hash: await publicFrameHash(pixels),
        level: 2,
        levels_completed: 1,
        state: 'NOT_FINISHED',
        available_action_refs: moves.map(([op]) => op),
      },
      revision
    );
    return { pixels, observation };
  }
  const start = await channel(1, [2, 5], 1),
    layout = visualLayout(start.observation, start.pixels);
  const role = (x: number) =>
    Object.entries(layout).find(([, parts]) => parts.some((p) => p.at.join() === [x, 5].join()))![0];
  const actor = role(5),
    marker = role(29),
    learning = newPreviewLearning(),
    m = newContactMemory();
  learning.partMotion = {
    [actor]: {
      axes: Object.fromEntries(
        moves.map(([op, d]) => [op, { [d.join()]: { d, count: 3, first: 'prior', last: 'prior' } }])
      ),
      sites: {},
      substrate: { 2: 8 },
    },
  };
  learning.terminal = [
    {
      actor,
      marker,
      offset: [0, 0],
      pitch: [4, 4],
      before: 'previous',
      after: 'credit',
      at: [0, 0],
      from: [0, 0],
      destination: [0, 0],
      q: 'east',
      support: 1,
      peers: 0,
    },
  ];
  assert.equal(proposeFrontierContact(m, learning, start.observation, start.pixels, limits), null);
  async function contact(from: number, to: number, old: number, moved: number) {
    const b = await channel(from, [old], 4),
      a = await channel(to, [moved], 5);
    observeContactDisplacement(
      m,
      learning,
      b.observation,
      a.observation,
      visualLayout(b.observation, b.pixels),
      visualLayout(a.observation, a.pixels),
      'east'
    );
  }
  await contact(2, 3, 1, 2);
  assert.equal(m.contactEvidence?.[actor], undefined);
  await contact(1, 2, 2, 3);
  await contact(2, 3, 3, 4);
  assert.equal(m.contactEvidence?.[actor]?.sites.length, 2);
  assert.equal(proposeFrontierContact(m, learning, start.observation, start.pixels, limits), null);
  Object.assign(m, inheritFrontierContacts(m.contactEvidence, learning));
  const first = proposeFrontierContact(m, learning, start.observation, start.pixels, limits)!;
  assert.equal(first.step.boundary, true);
  const changed = await channel(2, [5], 2);
  assert.equal(
    recordFrontierContact(m, learning, start.observation, changed.observation, start.pixels, changed.pixels, first),
    'object_changed_at_frontier_test_entry'
  );
  const verify = proposeFrontierContact(m, learning, changed.observation, changed.pixels, limits)!;
  assert.ok(verify.acquired);
  const negative = structuredClone(m);
  assert.equal(
    recordFrontierContact(
      negative,
      learning,
      changed.observation,
      changed.observation,
      changed.pixels,
      changed.pixels,
      verify
    ),
    'movement_refuted'
  );
  assert.deepEqual(negative.supported, []);
  assert.equal(negative.verified, undefined);
  const entered = await channel(3, [5], 3);
  assert.equal(
    recordFrontierContact(
      m,
      learning,
      changed.observation,
      entered.observation,
      changed.pixels,
      entered.pixels,
      verify
    ),
    'new_support_entered'
  );
  const cueLearning = structuredClone(learning);
  cueLearning.bindings.dualRole = {
    relation: 'indicator_marks_subject_arrival_after_action',
    actor,
    indicator: first.project.role!,
    gesture: { op: 'east' },
    witnesses: [],
  };
  const contactOnly = inheritFrontierContacts(m.contactEvidence, cueLearning);
  assert.equal(proposeFrontierContact(contactOnly, cueLearning, start.observation, start.pixels, limits), null);
  const transferred = inheritFrontierContacts(m.contactEvidence, cueLearning, m.supportLessons);
  assert.ok(proposeFrontierContact(transferred, cueLearning, start.observation, start.pixels, limits));
  assert.equal(transferred.inheritedSupports?.[0]?.entry, entered.observation.observation_ref);
  assert.deepEqual(transferred.supported, []);
  const repeat = proposeFrontierContact(m, learning, entered.observation, entered.pixels, limits)!;
  assert.equal(repeat.previousEntry, entered.observation.observation_ref);
  assert.notEqual(repeat.project.site, first.project.site);
  // A remote object may merge with a public overlay while the current walking
  // stance remains unobstructed. Recheck the object at its contact step.
  m.active = repeat.project;
  const obscured = await channel(3, [], 4);
  const continuing = proposeFrontierContact(m, learning, obscured.observation, obscured.pixels, limits);
  assert.deepEqual(continuing?.step, repeat.step);
});
