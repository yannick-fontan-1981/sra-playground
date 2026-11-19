import { measurePanelService, panelServiceProjection } from '../logos-engine/v6-panel-service-observation.ts';
import type { NativeCommand, NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Panel, Pattern, Scene, Service } from './panel-service-chain.ts';

type ServiceRecall = { epoch: number; symbols: Pattern[]; refs: string[] };
export type PanelServiceAcquisition = { edit?: { epoch: number; before: string; after: string }; recall?: ServiceRecall };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function bestLocalActivity(panel: Panel): Service | null {
  const direct = panel.operators.filter(service => service.kind === 'displayed_receiver' && service.input === panel.material);
  if (direct.length === 1) return direct[0]!;
  if (direct.length > 1) return null;
  const conversion = panel.operators.filter(service => service.kind === 'displayed_rewrite' && service.input === panel.material &&
    panel.services.some(receiver => receiver.kind === 'displayed_receiver' && service.output === receiver.input));
  return conversion.length === 1 ? conversion[0]! : null;
}

function selectionReturn(scene: Scene, panel: Panel, row: number) {
  return panelServiceProjection(scene).map(value => value.id === panel.id ? { ...value, activity: [row] } : value);
}

function currentPreparation(rows: NativeRows, recalled: readonly Pattern[]) {
  const scene = measurePanelService(rows, recalled) as Scene | null;
  if (!scene || scene.panels.length < 2 || scene.panels.length > 6) return null;
  const jobs = scene.panels.map(panel => ({ panel, activity: bestLocalActivity(panel) }));
  if (jobs.some(({ activity }) => !activity?.control)) return null;
  const symbols = [...new Map([...recalled, ...scene.panels.flatMap(panel => panel.services.map(service => service.symbol))]
    .map(symbol => [JSON.stringify(symbol), symbol])).values()];
  return { scene, jobs, symbols };
}

export function acquirePanelService(previous: PanelServiceAcquisition | undefined, before: NativeObservation, after: NativeObservation,
  command: NativeCommand, first: NativeRows, second: NativeRows): PanelServiceAcquisition | undefined {
  if (before.available_action_refs.some(action => /^ACTION[1-4]$/.test(action)) || !before.available_action_refs.includes('ACTION5')
    || !before.available_action_refs.includes('ACTION6') || before.frame_hash === after.frame_hash) return undefined;
  const prepared = currentPreparation(first, previous?.recall?.symbols ?? []);
  if (!prepared) return undefined;
  const { jobs, scene, symbols } = prepared;
  if (command.action_ref === 'ACTION6' && before.level_epoch === after.level_epoch) {
    const edit = jobs.find(({ activity, panel }) => activity!.control!.outline !== panel.selection_color
      && same(activity!.control!.point, [command.data.x, command.data.y]));
    const returned = edit && measurePanelService(second, symbols);
    if (returned && same(panelServiceProjection(returned), selectionReturn(scene, edit.panel, edit.activity!.control!.row))) {
      return { ...previous, edit: { epoch: before.level_epoch, before: before.observation_ref, after: after.observation_ref } };
    }
  }
  const edit = previous?.edit;
  if (command.action_ref === 'ACTION5' && after.levels_completed > before.levels_completed && edit?.epoch === before.level_epoch
    && jobs.every(({ activity, panel }) => activity!.control!.outline === panel.selection_color)) {
    return { recall: { epoch: before.level_epoch, symbols, refs: [edit.before, edit.after, before.observation_ref, after.observation_ref] } };
  }
  return undefined;
}

export function projectPanelService(recall: ServiceRecall, observation: NativeObservation, rows: NativeRows) {
  if (!observation.available_action_refs.includes('ACTION5') || !observation.available_action_refs.includes('ACTION6')) return null;
  const prepared = currentPreparation(rows, recall.symbols);
  if (!prepared) return null;
  const { jobs, scene, symbols } = prepared;
  const need = jobs.find(({ panel, activity }) => activity!.control!.outline !== panel.selection_color);
  if (need) {
    const control = need.activity!.control!, [x, y] = control.point;
    const command: NativeCommand = { action_ref: 'ACTION6', data: { x, y } };
    return { command, box: control.bbox, goal: need.panel.room, symbols,
      expected: selectionReturn(scene, need.panel, control.row), outputs: [] };
  }
  const outputs = jobs.flatMap(({ panel, activity }) => activity!.kind === 'displayed_rewrite' && activity!.output !== undefined
    ? [{ id: panel.id, material: activity!.output }] : []);
  const command: NativeCommand = { action_ref: 'ACTION5', data: {} };
  return { command, box: jobs[0]!.panel.bbox, goal: jobs[0]!.panel.room, symbols,
    expected: null, outputs };
}

export function checkPanelService(projection: NonNullable<ReturnType<typeof projectPanelService>>, rows: NativeRows): boolean {
  const returned = measurePanelService(rows, projection.symbols) as Scene | null;
  if (!returned) return false;
  if (projection.expected) return same(panelServiceProjection(returned), projection.expected);
  return projection.outputs.length > 0 && projection.outputs.every(({ id, material }) =>
    returned.panels.some(panel => panel.id === id && panel.material === material));
}
