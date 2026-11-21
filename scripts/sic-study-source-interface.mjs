// Experimental observation and action bijections, applied outside the frozen agent.
// The native game remains responsible for transitions, termination and score.
export function sourceInterface(engine, variation) {
  if (!variation) return engine;
  if (
    !["palette", "controls", "reflection", "palette-controls"].includes(
      variation,
    )
  )
    throw new Error("Unknown source interface variation: " + variation);
  const palette = variation.includes("palette"),
    controls = variation.includes("controls"),
    reflect = variation === "reflection";
  // Two transpositions preserve the command vocabulary and are self-inverse.
  const remap = (id) =>
    controls ? ({ 1: 4, 4: 1, 2: 3, 3: 2 }[id] ?? id) : id;
  const color = (v) =>
    palette && v >= 1 && v <= 15 ? 1 + (((v - 1) * 7 + 4) % 15) : v;
  const visible = (rows) =>
    rows.map((row) => (reflect ? [...row].reverse() : row).map(color));
  let width = 0;
  return {
    dispatch(request) {
      let actual = request;
      if (request.type === "action") {
        actual = { ...request, actionId: remap(request.actionId) };
        if (reflect && request.actionId === 6)
          actual.data = { ...request.data, x: width - 1 - request.data.x };
      }
      const board = engine.dispatch(actual);
      width = board.frame[0].length;
      return {
        ...board,
        frame: visible(board.frame),
        ...(board.frames ? { frames: board.frames.map(visible) } : {}),
        availableActionIds: board.availableActionIds
          .map(remap)
          .sort((a, b) => a - b),
      };
    },
  };
}
