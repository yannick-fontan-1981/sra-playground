import { createHash } from 'node:crypto';

// Passive public-raster observer. Production SIC never imports this module.
export const gridOwner = 'sic_navigate_revealed_grid';
const copy = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const point = value => Array.isArray(value) && value.length === 2 && value.every(Number.isSafeInteger);
const cellOrigin = (grid, cell) => [grid.box[0] + cell % grid.columns * grid.pitch,
  grid.box[1] + Math.floor(cell / grid.columns) * grid.pitch];
const refs = value => Array.isArray(value) && value.every(ref => typeof ref === 'string') ? [...value] : [];

function measure(rows, grid, heldWall, probeExit) {
  if (!rows || !Array.isArray(grid.box) || grid.box.length !== 4 || !Number.isSafeInteger(grid.pitch)
    || !Number.isSafeInteger(grid.columns) || !Number.isSafeInteger(grid.size)) return null;
  const actors = [], obstacles = [], patrols = [];
  for (let cell = 0; cell < grid.size; cell++) {
    const [x,y] = cellOrigin(grid, cell), middle = Math.floor(grid.pitch / 2);
    const visible = grid.actorPixels?.length ? grid.actorPixels.every(([dx,dy]) => rows[y+dy]?.[x+dx] === grid.actor)
      : rows[y+middle]?.[x+middle] === grid.actor;
    if (visible && rows[y]?.[x] !== grid.enemy && cell !== grid.goal) actors.push(cell);
    if (rows[y]?.[x] === grid.enemy) obstacles.push(cell);
    if (grid.sentry?.every(([dx,dy,ink]) => rows[y+dy]?.[x+dx] === ink)
      || grid.sentryPatterns?.some(pattern => pattern.every(([dx,dy,ink]) => rows[y+dy]?.[x+dx] === ink))) patrols.push(cell);
  }
  let staticWall = null;
  if (heldWall !== null) {
    const [x,y] = cellOrigin(grid,heldWall), a=rows[y]?.[x],b=rows[y]?.[x+1],c=rows[y+1]?.[x+1];
    staticWall = a !== undefined && a === b && c !== b && ![grid.tint,grid.base,grid.enemy].includes(a)
      && !patrols.includes(heldWall);
  }
  const [exitX, exitY] = cellOrigin(grid, grid.goal);
  const exitSignature = probeExit ? hash(rows.slice(exitY, exitY + grid.pitch).flatMap(row => row.slice(exitX, exitX + grid.pitch))) : null;
  return { actor: actors.length === 1 ? actors[0] : null, actorCount: actors.length,
    obstacles, patrols, staticWall, charges: grid.charges.filter(([x,y]) => rows[y]?.[x] === grid.enemy).length,
    ...(probeExit ? { exitSignature } : {}) };
}

export function captureGridContinuity(proposal, ticket, rows) {
  try {
    if (proposal?.kind !== gridOwner || !ticket || proposal.actions?.[ticket.actionIndex]?.action_ref !== ticket.actionRef) return null;
    const grid = proposal.local?.grid, walk = proposal.walk, hold = proposal.hold, index = ticket.actionIndex;
    if (!grid || (!walk && !hold) || (walk && hold) || !Array.isArray(grid.charges) || !grid.charges.every(point)) return null;
    const expectedFrom = hold ? hold.role.at : index ? walk[index-1]?.target : proposal.local.last.position;
    const expectedTo = hold ? hold.role.at : walk[index]?.target;
    if (![expectedFrom,expectedTo].every(Number.isSafeInteger)) return null;
    const probeExit = Array.isArray(proposal.exitAfterProbe) && !!walk;
    return { kind: hold ? 'stationary hold' : probeExit ? 'probe with known exit' : 'known grid walk',
      ...(probeExit ? { experimental: index === 0, exitSignature: hash(proposal.exitAfterProbe),
        probeTerrain: proposal.local.last.memory[walk[0].target] ?? null } : {}), actionRef: ticket.actionRef,
      bindingRef: proposal.binding?.observation_ref ?? null, beforeRef: ticket.observationRef,
      levelEpoch: proposal.binding?.level_epoch ?? null, scoreBefore: ticket.levelsCompleted,
      expectedFrom, expectedTo, columns: grid.columns, goal: grid.goal,
      roleFingerprint: hash(grid), learnedEvidence: refs(proposal.route_refs),
      completedRole: copy(proposal.local.completed ?? null), holdRole: copy(hold ?? null),
      turnBefore: proposal.local.timing?.clock?.turn ?? null,
      before: measure(rows, grid, hold?.role.wall ?? null, probeExit), geometry: copy(grid),
      knownTerrain: proposal.local.last.memory };
  } catch { return null; }
}

export function observeGridReturn(capture, rows, levelsCompleted) {
  if (!capture) return null;
  const { geometry, knownTerrain, ...prior } = capture, boundary = levelsCompleted > capture.scoreBefore;
  try {
    const after = boundary ? null : measure(rows, geometry, capture.holdRole?.role.wall ?? null, capture.kind === 'probe with known exit');
    const terrainBeforePatrols = Object.fromEntries((after?.patrols ?? []).filter(cell => knownTerrain[cell] !== undefined)
      .map(cell => [cell, knownTerrain[cell]]));
    return { ...prior, boundary, scoreAfter: levelsCompleted, after, terrainBeforePatrols };
  }
  catch { return { ...prior, boundary, scoreAfter: levelsCompleted, after: null }; }
}

export function completeGridContinuity(capture, readOwnerState, returned) {
  if (!capture) return null;
  let acquisition = null;
  try {
    const state = returned?.sealCount === 1 ? readOwnerState?.()?.state : null;
    if (state) acquisition = { epoch: state.epoch, score: state.score, at: state.last.position,
      charges: state.last.charges, evidence: refs(state.refs), completed: copy(state.completed ?? null),
      stationary: copy(state.stationary ?? null), turn: state.timing?.clock?.turn ?? null,
      terrainUnderPatrols: Object.fromEntries((capture.after?.patrols ?? []).map(cell => [cell,state.last.memory[cell] ?? null])) };
  } catch { /* Missing acquisition is unknown, never inferred from the plan. */ }
  return { ...capture, afterRef: returned?.outcome?.observation_ref ?? null, acquisition };
}
