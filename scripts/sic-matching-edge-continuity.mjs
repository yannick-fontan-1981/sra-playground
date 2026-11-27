// Passive measurement of a learned sliding/attachment role. No solver input is
// derived from this file; the study collector calls it only after dispatch.
export const matchingEdgeOwner = 'sic_settle_pieces_at_matching_edges';
const integer = value => Number.isSafeInteger(value) ? value : null;
const copy = value => value === undefined ? null : structuredClone(value);
const piecesKey = pieces => pieces.map(({ x, y, ink, mark }) => [ink, x, y, mark].join(':')).sort().join('|');

export function observeMatchingEdgeBoard(rows, geometry) {
  try {
    const { grid, panel } = geometry, { x, y, cols, rows: height, pitch, edges } = grid;
    if (![x, y, cols, height, pitch].every(Number.isSafeInteger) || cols < 1 || height < 1 || pitch < 3
      || !Array.isArray(edges) || edges.length !== 4 || new Set(edges).size !== 4 || !rows) return null;
    const right = x + cols * pitch, bottom = y + height * pitch;
    if (rows.slice(y, bottom).length !== height * pitch || right >= rows[0]?.length) return null;
    for (let col = x; col < right; col++) if (rows[y - 1]?.[col] !== edges[0] || rows[bottom]?.[col] !== edges[1]) return null;
    for (let row = y; row < bottom; row++) if (rows[row]?.[x - 1] !== edges[2] || rows[row]?.[right] !== edges[3]) return null;
    const pieces = [], blockers = [], floors = new Set();
    let markOffset;
    for (let row = 0; row < height; row++) for (let col = 0; col < cols; col++) {
      const left = x + col * pitch, top = y + row * pitch;
      const pixels = rows.slice(top, top + pitch).flatMap(line => line.slice(left, left + pitch));
      if (pixels.length !== pitch * pitch || !pixels.every(Number.isSafeInteger)) return null;
      const ink = pixels[0], changes = pixels.flatMap((value, offset) => value === ink ? [] : [{ value, offset }]);
      if (edges.includes(ink)) {
        if (changes.length !== 1 || markOffset !== undefined && changes[0].offset !== markOffset) return null;
        markOffset = changes[0].offset;
        pieces.push({ x: col, y: row, ink, mark: changes[0].value });
      } else if (!changes.length) floors.add(ink);
      else blockers.push({ x: col, y: row, pixels });
    }
    if (floors.size !== 1 || pieces.length < 2) return null;
    let attached = null;
    if (panel) {
      const [left, top, right, bottom] = panel;
      if (right - left !== 4 || bottom - top !== 3) return null;
      const stroke = rows[top]?.[left], base = rows[top]?.[left + 1];
      if (!Number.isSafeInteger(stroke) || !Number.isSafeInteger(base) || stroke === base) return null;
      for (let v = 0; v < 4; v++) for (let u = 0; u < 5; u++) {
        if (v === 1 && u === 2) continue;
        if (rows[top + v]?.[left + u] !== (u === 0 || u === 4 || v === 3 ? stroke : base)) return null;
      }
      const center = rows[top + 1]?.[left + 2];
      if (!Number.isSafeInteger(center)) return null;
      attached = center !== base;
    }
    return { pieces, piecesKey: piecesKey(pieces), blockers: JSON.stringify(blockers), attached, frame: copy(rows) };
  } catch { return null; }
}

export function captureMatchingEdge(proposal, ticket, rows, readOwnerState) {
  try {
    if (proposal?.kind !== matchingEdgeOwner || proposal.actions?.[ticket?.actionIndex]?.action_ref !== ticket?.actionRef) return null;
    const memory = (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState)?.memory;
    const leg = proposal.slidePath?.[ticket.actionIndex];
    const geometry = { grid: copy(proposal.grid), panel: copy(proposal.sicSituationCard?.attachmentControl) };
    return {
      actionRef: ticket.actionRef, levelEpoch: integer(proposal.binding?.level_epoch), beforeRef: ticket.observationRef,
      scoreBefore: integer(ticket.levelsCompleted), switched: !!leg,
      expected: copy(leg?.predicted ?? proposal.predicted), expectedAttached: leg?.expectedMode?.attached ?? null,
      learnedControls: copy(memory?.controls), learnedSwitches: copy(memory?.switchRefs),
      roleWins: integer(memory?.wins), before: observeMatchingEdgeBoard(rows, geometry), geometry,
    };
  } catch { return null; }
}

export function observeMatchingEdgeReturn(capture, rows) {
  if (!capture) return null;
  const { geometry, ...before } = capture;
  return { ...before, after: observeMatchingEdgeBoard(rows, geometry) };
}

export function completeMatchingEdge(observed, readOwnerState, returned, scoreAfter) {
  if (!observed) return null;
  let memory;
  try { if (returned?.sealCount === 1) memory = (typeof readOwnerState === 'function' ? readOwnerState() : readOwnerState)?.memory; } catch { /* Preserve absence. */ }
  return { ...observed, afterRef: returned?.outcome?.observation_ref ?? null, scoreAfter: integer(scoreAfter),
    acquisition: memory ? { wins: integer(memory.wins), controls: copy(memory.controls), switches: copy(memory.switchRefs) } : null };
}
