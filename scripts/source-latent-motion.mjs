import {
  exposureLayout,
  exposureMoves,
  exposureBearing,
  exposureRules,
  exposureMatches,
} from "../src/sic/coupled-exposure.ts";

// A quantified appearance. Public observations contain only nonnegative palette indices.
const unbound = -1;
const same = (a, b) =>
  a.actor === b.actor &&
  a.facing === b.facing &&
  a.pieces.length === b.pieces.length &&
  a.pieces.every((p) =>
    b.pieces.some((q) => p.cell === q.cell && p.color === q.color),
  );

export function motorChoices(scene, directions, allowed) {
  const commands = new Map();
  for (const [word, delta] of Object.entries(directions)) {
    const m = exposureMoves.findIndex(
      (p) => p[0] === delta[0] && p[1] === delta[1],
    );
    if (m >= 0 && allowed.includes(Number(word.slice(6))))
      commands.set(m, word);
  }
  if (allowed.includes(5)) commands.set(4, "ACTION5");
  if (allowed.includes(6))
    for (const dial of scene.dial) {
      const h = exposureBearing(dial.vector);
      if (h >= 0) commands.set(5 + h, "ACTION6:" + dial.point.join());
    }
  return commands;
}
export function latentModels(scene, history) {
  const visible = [
    ...new Set([...scene.bodies, ...scene.slots].map((p) => p.color)),
  ];
  if (visible.length !== 1 || !history?.samples?.length) return [];
  const seen = visible[0],
    models = [];
  if (
    history.samples.some((s) =>
      [...s.before.pieces, ...s.after.pieces].some((p) => p.color !== seen),
    )
  )
    return [];
  for (const [shadow, lit] of [
    [seen, unbound],
    [unbound, seen],
  ]) {
    const measured = exposureLayout(scene, {
      shadow,
      lit,
      linked: null,
      released: null,
    });
    if (!measured) continue;
    const rules = exposureRules(measured[0]);
    if (
      history.samples.every((s) =>
        same(rules.project(s.before, s.action), s.after),
      )
    )
      models.push({ board: measured[0], current: measured[1], rules, seen });
  }
  return models;
}
// Seek a common executable prefix followed by a test that could reveal a new appearance.
// No destination, bound appearance or successful final gesture is supplied.
export function firstRevealingSequence(
  models,
  commands,
  maxDepth = 8,
  maxStates = 4000,
) {
  if (!models.length) return null;
  const queue = [{ current: models[0].current, path: [] }],
    visited = new Set([JSON.stringify(queue[0].current)]);
  for (let i = 0; i < queue.length && i < maxStates; i++) {
    const { current, path } = queue[i];
    if (path.length >= maxDepth) continue;
    for (const action of [...commands.keys()].sort((a, b) => a - b)) {
      const forecasts = models.map((m) => m.rules.project(current, action));
      const reveals = forecasts.some((f) =>
        f.pieces.some((p) => p.color === unbound),
      );
      const extended = [...path, action];
      if (reveals) return { path: extended, forecasts, examined: i + 1 };
      if (!forecasts.every((f) => same(f, forecasts[0]))) continue;
      const key = JSON.stringify(forecasts[0]);
      if (visited.has(key) || queue.length >= maxStates) continue;
      visited.add(key);
      queue.push({ current: forecasts[0], path: extended });
    }
  }
  return null;
}
export function bindMeasuredAppearance(model, state, scene) {
  if (!scene) return null;
  const novel = [
    ...new Set(
      scene.bodies.map((p) => p.color).filter((c) => c !== model.seen),
    ),
  ];
  if (novel.length !== 1 || !state.pieces.some((p) => p.color === unbound))
    return null;
  const bind = (c) => (c === unbound ? novel[0] : c);
  const body = {
    ...state,
    pieces: state.pieces.map((p) => ({ ...p, color: bind(p.color) })),
  };
  const colors = {
    ...model.board.colors,
    shadow: bind(model.board.colors.shadow),
    lit: bind(model.board.colors.lit),
  };
  const bound = { ...model.board, colors };
  return exposureMatches(bound, body, scene) ? colors : null;
}
