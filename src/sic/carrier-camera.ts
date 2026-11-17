import { alignReductionScene, mergeReductionScene, reductionScan, reductionVisibleCells,
  type ReductionModel, type ReductionPoint, type ReductionScene, type packReductionState } from '../logos-engine/v6-reduction-transport.ts';
import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';

type PackedScene = { floor: string[]; pegs: string[]; carriers: ReductionPoint[]; rails: string[]; edges: string[]; known: string[];
  plots?: string[]; carriedPlots?: string[] };
export type CarrierView = { offset: ReductionPoint; memory: PackedScene };
export type CarrierPosition = ReturnType<typeof packReductionState>;

const key = (point: ReductionPoint) => point.join(',');

export function carrierView(offset: ReductionPoint, scene: ReductionScene): CarrierView {
  return { offset, memory: { floor: [...scene.floor], pegs: [...scene.pegs], carriers: scene.carriers,
    rails: [...scene.rails], edges: [...scene.edges], known: [...(scene.known_cells ?? [])], ...(scene.plots ? { plots: [...scene.plots] } : {}),
    ...(scene.carriedPlots ? { carriedPlots: [...scene.carriedPlots] } : {}) } };
}

export function unpackCarrierView({ memory }: CarrierView): ReductionScene {
  return { floor: new Set(memory.floor), pegs: new Set(memory.pegs), carriers: memory.carriers,
    rails: new Set(memory.rails), edges: new Set(memory.edges), known_cells: new Set(memory.known),
    ...(memory.plots ? { plots: new Set(memory.plots) } : {}),
    ...(memory.carriedPlots ? { carriedPlots: new Set(memory.carriedPlots) } : {}) };
}

export function acquireCarrierView(rows: NativeRows, observation: NativeObservation, model: ReductionModel,
  view: CarrierView, expectation: CarrierPosition | null) {
  const previous = unpackCarrierView(view);
  const aligned = alignReductionScene(rows, observation, model, previous, view.offset);
  if (!aligned) return null;
  const [nextModel, offset, unpredicted] = aligned;
  const visible = reductionVisibleCells(nextModel, offset), known = previous.known_cells!;
  const actual = reductionScan(rows, nextModel);
  const registered = mergeReductionScene(null, actual, nextModel, offset);
  const check = (positions: Iterable<string>, predicted: ReductionPoint[]) => {
    const projected = new Set(predicted.map(key)), observed = new Set(positions);
    // Newly exposed cells can add pieces. Previously seen and now visible
    // cells must still agree with the transition we chose.
    for (const cell of visible) {
      if ((known.has(cell) || projected.has(cell)) && projected.has(cell) !== observed.has(cell)) return false;
    }
    return true;
  };
  const plotsPreserved = !previous.plots || [...visible].every(cell => !known.has(cell)
    || previous.plots!.has(cell) === !!registered.plots?.has(cell));
  const matches = expectation ? plotsPreserved && check(registered.pegs, expectation[0]) && check(registered.carriers.map(key), expectation[1])
    && check(registered.carriedPlots ?? [], expectation[2] ?? []) : null;
  const scene = expectation && matches ? mergeReductionScene({ ...previous, pegs: new Set(expectation[0].map(key)),
    carriers: expectation[1], ...(expectation[2] ? { carriedPlots: new Set(expectation[2].map(key)) } : {}) },
  actual, nextModel, offset) : unpredicted;
  return { nextModel, view: carrierView(offset, scene), matches,
    cameraChanged: key(offset) !== key(view.offset) || key(model.phase) !== key(nextModel.phase),
    newPegs: [...registered.pegs].filter(cell => !known.has(cell)).length };
}
