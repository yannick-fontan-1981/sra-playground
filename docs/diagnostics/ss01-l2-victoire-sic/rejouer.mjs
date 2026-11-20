// Independent physical replay from the first public frame of level 1.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const [root, output] = process.argv.slice(2);
if (!root) throw Error('Pass the checkout of the pinned environment');
const proof = JSON.parse(await readFile(new URL('parcours.json', import.meta.url), 'utf8'));
assert.equal(
  execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  proof.engine
);
const mod = (file) => import(pathToFileURL(join(resolve(root), file)).href);
const { SinkingStarSession, compileLevel, initialState, stepWorld, renderWorld, pixelToCell } = await mod(
  'src/games/sinking-star/core.ts'
);
const { SS01_LEVELS } = await mod('src/games/sinking-star/levels.ts');
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hash = (b) => digest(b.frame).slice(0, 16);
// Native family checkpoints restore JSON object keys in canonical order between commands.
const ordered = (v) =>
  Array.isArray(v)
    ? v.map(ordered)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, ordered(v[k])])
        )
      : v;
const level = proof.target,
  definition = SS01_LEVELS[level - 1],
  world = compileLevel(definition);
const local = (p) => [
  p.x - Math.floor((20 - definition.rows[0].length) / 2) + 1,
  p.y - Math.floor((20 - definition.rows.length) / 2) + 1,
];
const cell = (p) => pixelToCell(Math.floor(p[0] / 2), Math.floor(p[1] / 2));
const region = (p) => {
  const queue = [p],
    seen = new Set([p.y * 20 + p.x]);
  for (const u of queue)
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const x = u.x + dx,
        y = u.y + dy,
        k = y * 20 + x;
      if (x < 0 || y < 0 || x >= 20 || y >= 20 || world.tiles[k] !== '.' || seen.has(k)) continue;
      seen.add(k);
      queue.push({ x, y });
    }
  return seen.has(world.start.y * 20 + world.start.x)
    ? 'haut'
    : seen.has(world.goal.y * 20 + world.goal.x)
      ? 'droite'
      : 'gauche';
};
function enter() {
  const game = new SinkingStarSession(SS01_LEVELS);
  for (const c of proof.lesson.commands) {
    assert.equal(game.observe().level, 1);
    assert.equal(hash(game.observe()), c.from);
    assert.equal(hash(game.action(c.id, c.data)), c.to);
  }
  assert.equal(game.observe().level, 2);
  assert.equal(game.observe().levelsCompleted, 1);
  return game;
}
function replay(omit = new Set(), strict = false) {
  const game = enter();
  let state = initialState(world);
  const steps = [],
    forecasts = [],
    images = new Set([hash(game.observe())]);
  for (const c of proof.actions) {
    if (omit.has(c.n)) continue;
    if (game.observe().level !== 2) break;
    if (strict) {
      assert.equal(hash(game.observe()), c.from);
      const trial =
        c.template !== undefined ? { ...proof.templates[c.template], index: c.index } : c.forecast;
      assert.equal(digest(c.template !== undefined && c.index > 0 ? ordered(trial) : trial), c.commitment);
      if (c.template !== undefined) {
        const plan = trial.plan,
          step = plan.steps[trial.index];
        assert.equal('ACTION' + c.id, step.op);
        assert.deepEqual(local(cell(step.p)), local(state.hero));
        assert.ok(state.mirrors.some((m) => local(m).join() === local(cell(step.c)).join()));
        if (!trial.index)
          forecasts.push({
            n: c.n,
            reachable: plan.home,
            proposed: plan.otherSetups,
            method: plan.projectionBasis,
            site: local(cell(plan.initialC)),
            placed: local(cell(plan.placed)),
            launch: local(cell(plan.launch)),
            arrival: local(cell(plan.arrival)),
            continuation: local(cell(plan.use)),
            cause: trial.cause.tag,
          });
      } else if (c.phase === 'seekTerminalContact') {
        assert.deepEqual(local(cell(trial.from)), local(state.hero));
        assert.deepEqual(local(cell(trial.goal)), local(world.goal));
        assert.equal(trial.op, 'ACTION' + c.id);
      }
    }
    const before = state;
    state = stepWorld(world, state, c.id, c.data);
    const next = game.action(c.id, c.data);
    if (strict) {
      assert.equal(hash(next), c.to);
      if (!state.complete) assert.equal(digest(renderWorld(world, state)).slice(0, 16), c.to);
      if (c.template !== undefined) {
        const s = proof.templates[c.template].plan.steps[c.index];
        assert.deepEqual(local(cell(s.to)), local(state.hero));
        assert.ok(state.mirrors.some((m) => local(m).join() === local(cell(s.placed)).join()));
      }
    }
    images.add(hash(next));
    steps.push({
      n: c.n,
      op: c.id,
      phase: c.phase,
      stage: c.stage,
      actor: local(state.hero),
      region: region(state.hero),
      mirrors: state.mirrors.map(local),
      moved: state.mirrors.some((m, i) => m.x !== before.mirrors[i].x || m.y !== before.mirrors[i].y),
      score: next.levelsCompleted,
    });
  }
  return {
    commands: steps.length,
    won: game.observe().levelsCompleted === 2,
    score: game.observe().levelsCompleted,
    uniqueImages: images.size,
    regions: [...new Set(steps.map((x) => x.region))],
    steps,
    forecasts,
  };
}
const native = replay(new Set(), true);
assert.equal(native.won, true);
assert.equal(native.commands, 32);
assert.equal(native.uniqueImages, proof.uniquePublicImages);
const equivalent = [];
for (const t of proof.actions.filter((c) => c.stage === 'read' || c.phase === 'seekTerminalContact')) {
  const alternatives = [];
  for (const q of [1, 2, 3, 4, 5]) {
    const g = enter();
    let s = initialState(world);
    for (const c of proof.actions.slice(0, t.n - 1)) {
      g.action(c.id, c.data);
      s = stepWorld(world, s, c.id, c.data);
    }
    assert.equal(hash(g.observe()), t.from);
    const z = stepWorld(world, s, q),
      board = g.action(q);
    alternatives.push({ q, arrived: local(z.hero), region: region(z.hero), score: board.levelsCompleted });
  }
  equivalent.push({ n: t.n, expected: t.id, alternatives });
}
const ablations = proof.templates.map((_, i) => {
  const skipped = proof.actions.filter((c) => c.template === i && c.stage === 'write').map((c) => c.n),
    r = replay(new Set(skipped));
  return { omitted: skipped, won: r.won, score: r.score, regions: r.regions };
});
const counts = {
  commands: native.commands,
  score: native.score,
  distinctImages: native.uniqueImages,
  regions: native.regions,
  forecasts: native.forecasts,
  ablations,
  localControls: equivalent,
};
if (output)
  await writeFile(
    output,
    JSON.stringify(
      {
        ...counts,
        initialActor: local(initialState(world).hero),
        rows: definition.rows,
        steps: native.steps,
      },
      null,
      2
    ) + '\n'
  );
console.log(JSON.stringify(counts));
