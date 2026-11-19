import { alignReductionScene, mergeReductionScene, packReductionState, reductionMoved, reductionScan, reductionState, reductionVisibleCells,
  type ReductionModel, type ReductionPoint, type ReductionScene } from '../logos-engine/v6-reduction-transport.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

type PackedScene = { floor: string[]; pegs: string[]; carriers: ReductionPoint[]; rails: string[]; edges: string[]; known: string[];
  plots?: string[]; carriedPlots?: string[]; auxiliaries?: string[] };
export type CarrierView = { offset: ReductionPoint; memory: PackedScene };
export type CarrierPosition = ReturnType<typeof packReductionState>;
export type CarrierBoundaryTraffic = { cell: string; inward: ReductionPoint };

const key = (point: ReductionPoint) => point.join(',');

export function carrierView(offset: ReductionPoint, scene: ReductionScene): CarrierView {
  return { offset, memory: { floor: [...scene.floor], pegs: [...scene.pegs], carriers: scene.carriers,
    rails: [...scene.rails], edges: [...scene.edges], known: [...(scene.known_cells ?? [])], ...(scene.plots ? { plots: [...scene.plots] } : {}),
    ...(scene.carriedPlots ? { carriedPlots: [...scene.carriedPlots] } : {}),
    ...(scene.auxiliaries ? { auxiliaries: [...scene.auxiliaries] } : {}) } };
}

export function unpackCarrierView({ memory }: CarrierView): ReductionScene {
  return { floor: new Set(memory.floor), pegs: new Set(memory.pegs), carriers: memory.carriers,
    rails: new Set(memory.rails), edges: new Set(memory.edges), known_cells: new Set(memory.known),
    ...(memory.plots ? { plots: new Set(memory.plots) } : {}),
    ...(memory.carriedPlots ? { carriedPlots: new Set(memory.carriedPlots) } : {}),
    ...(memory.auxiliaries ? { auxiliaries: new Set(memory.auxiliaries) } : {}) };
}

export function acquireCarrierView(rows: NativeRows, observation: NativeObservation, model: ReductionModel,
  view: CarrierView, expectation: CarrierPosition | null, motion?: ReductionPoint) {
  const previous = unpackCarrierView(view);
  const aligned = alignReductionScene(rows, observation, model, previous, view.offset);
  if (!aligned) return null;
  const [nextModel, offset, unpredicted] = aligned;
  const visible = reductionVisibleCells(nextModel, offset), known = previous.known_cells!;
  const clippedRow = (layout: ReductionModel, at: ReductionPoint) =>
    at[1] + (layout.height - layout.unit - layout.phase[1]) / layout.pitch;
  const previousClip = model.trackClippedCarrierRows ? clippedRow(model, view.offset) : null;
  const currentClip = model.trackClippedCarrierRows ? clippedRow(nextModel, offset) : null;
  const actual = reductionScan(rows, nextModel);
  if (expectation && actual.plots && previousClip !== null && currentClip !== null) {
    const cargo = new Set(expectation[2]?.map(key));
    for (const [x, y] of expectation[1]) {
      const at = key([x, y]);
      if (y !== currentClip || !cargo.has(at)) continue;
      const previousPosition = motion && key([x - motion[0], y - motion[1]]);
      const knownCargo = previous.carriedPlots?.has(at) || previousPosition && previous.carriedPlots?.has(previousPosition);
      if (!knownCargo && currentClip >= previousClip) continue;
      const cell: ReductionPoint = [x - offset[0], y - offset[1]];
      if (!actual.plots.delete(key(cell))) continue;
      actual.carriers.push(cell);
      (actual.carriedPlots ??= new Set()).add(key(cell));
    }
  }
  const registered = mergeReductionScene(null, actual, nextModel, offset);
  const projectedCarriers = motion && expectation ? new Set(expectation[1].map(key)) : null;
  const observedCarriers = motion && expectation ? new Set(registered.carriers.map(key)) : null;
  const entering = new Set(motion && projectedCarriers ? registered.carriers.flatMap(([x, y]) => {
    const cell = key([x, y]), predecessor = key([x - motion[0], y - motion[1]]);
    const newlyUnclipped = y === previousClip && currentClip !== null && y < currentClip;
    return !projectedCarriers.has(cell) && (!known.has(predecessor) || newlyUnclipped) ? [cell] : [];
  }) : []);
  const leaving = new Set(motion && projectedCarriers && observedCarriers ? previous.carriers.flatMap(([x, y]) => {
    const cell = key([x, y]), successor = key([x + motion[0], y + motion[1]]);
    return visible.has(cell) && projectedCarriers.has(cell) && !observedCarriers.has(cell) && !known.has(successor)
      && !previous.pegs.has(cell) && !previous.auxiliaries?.has(cell) ? [cell] : [];
  }) : []);
  const check = (positions: Iterable<string>, predicted: ReductionPoint[]) => {
    const projected = new Set(predicted.map(key)), observed = new Set(positions);
    // Newly exposed cells can add pieces. Previously seen and now visible
    // cells must still agree with the transition we chose.
    for (const cell of visible) {
      if ((known.has(cell) || projected.has(cell)) && projected.has(cell) !== observed.has(cell)
        && !(entering.has(cell) && observed.has(cell)) && !(leaving.has(cell) && !observed.has(cell))) return false;
    }
    return true;
  };
  // Revealing the whole rim can identify a previously visible plot as cargo.
  const reclassified = model.trackClippedCarrierRows && previous.plots
    ? [...entering].filter(cell => previous.plots!.has(cell) && registered.carriedPlots?.has(cell)) : [];
  const fixedPlots = reclassified.length ? new Set([...previous.plots!].filter(cell => !reclassified.includes(cell))) : previous.plots;
  const plotsPreserved = !fixedPlots || [...visible].every(cell => !known.has(cell)
    || fixedPlots.has(cell) === !!registered.plots?.has(cell));
  const matches = expectation ? plotsPreserved && check(registered.pegs, expectation[0]) && check(registered.carriers.map(key), expectation[1])
    && check(registered.carriedPlots ?? [], expectation[2] ?? []) && check(registered.auxiliaries ?? [], expectation[3] ?? []) : null;
  const scene = expectation && matches ? mergeReductionScene({ ...previous, ...(fixedPlots ? { plots: fixedPlots } : {}),
    pegs: new Set(expectation[0].map(key)),
    carriers: expectation[1], ...(expectation[2] && (!expectation[3] || previous.carriedPlots || expectation[2].length)
      ? { carriedPlots: new Set(expectation[2].map(key)) } : {}),
    ...(expectation[3] ? { auxiliaries: new Set(expectation[3].map(key)) } : {}) },
  actual, nextModel, offset) : unpredicted;
  return { nextModel, view: carrierView(offset, scene), matches,
    cameraChanged: key(offset) !== key(view.offset) || key(model.phase) !== key(nextModel.phase),
    newPegs: [...registered.pegs].filter(cell => !known.has(cell) || entering.has(cell)).length,
    enteringCarriers: entering.size, leavingCarriers: leaving.size,
    loadedArrivals: [...entering].filter(cell => registered.auxiliaries?.has(cell)) };
}

export function reconcileCarrierTraffic(rows: NativeRows, observation: NativeObservation, model: ReductionModel,
  view: CarrierView, expectation: CarrierPosition | null, motion: ReductionPoint | undefined,
  traffic: CarrierBoundaryTraffic | undefined, followVacated: boolean | undefined) {
  const observed = acquireCarrierView(rows, observation, model, view, expectation, motion);
  if (observed?.matches !== false || !motion || !traffic || key(traffic.inward) !== key([-motion[0], -motion[1]])) return observed;
  const scene = unpackCarrierView(view), leading = scene.carriers.find(cell => key(cell) === traffic.cell);
  if (!leading || !scene.auxiliaries?.has(traffic.cell) || scene.pegs.has(traffic.cell)
    || scene.known_cells?.has(key([leading[0] + motion[0], leading[1] + motion[1]]))) return observed;

  // The incoming lane is measured. On the reverse motion, test whether its leading auxiliary
  // left view and freed the boundary cell for the following carrier. Verify every visible piece.
  const current = reductionState(scene);
  current[1] = current[1].filter(cell => key(cell) !== traffic.cell);
  current[3]!.delete(traffic.cell);
  const expected = packReductionState(reductionMoved(current, motion, scene.edges, scene.plots, followVacated));
  const departure = acquireCarrierView(rows, observation, model, view, expected, motion);
  return departure?.matches ? { ...departure, leavingCarriers: departure.leavingCarriers + 1 } : observed;
}
