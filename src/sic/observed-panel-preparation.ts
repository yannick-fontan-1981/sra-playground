import { measurePanelService } from '../logos-engine/v6-panel-service-observation.ts';
import type { NativeBox, NativeCommand, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Scene } from './panel-service-chain.ts';

export type PanelPreparation = { command: NativeCommand; label: string; box: NativeBox; evidence: string[] };

export function choosePanelPreparation(rows: NativeRows, apply: NativeCommand): PanelPreparation | undefined {
  const scene = measurePanelService(rows, []) as Scene | null;
  if (!scene || scene.panels.length < 2 || scene.panels.length > 6) return;
  const choices = scene.panels.map(panel => {
    const applicable = panel.operators.filter(service => service.control && service.input === panel.material &&
      (service.kind === 'displayed_receiver' || service.kind === 'displayed_rewrite'
        && panel.services.some(receiver => receiver.kind === 'displayed_receiver' && receiver.input === service.output)));
    return applicable.length === 1 ? { panel, control: applicable[0]!.control! } : null;
  });
  if (choices.some(choice => !choice)) return;
  const pending = choices.find(choice => choice && choice.control.outline !== choice.panel.selection_color);
  if (!pending) return { command: apply, label: 'Apply the controls currently matched to the displayed materials',
    box: scene.panels[0]!.bbox, evidence: [] };
  const [x, y] = pending.control.point;
  return { command: { action_ref: 'ACTION6', data: { x, y } },
    label: 'Set the panel control whose displayed input matches the material', box: pending.panel.bbox, evidence: [] };
}
