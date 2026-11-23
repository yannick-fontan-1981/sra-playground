import type { NativeObservation, NativeEntity } from '../logos-engine/v6-native-types.ts';
import { poseRole } from './occupancy-programs.ts';

export type RelayControl = {
  actor: string;
  peer: string;
  ink: number;
  op: string;
  click: string;
  verification: string;
};
type Selection = Omit<RelayControl, 'verification'> & {
  source: readonly number[];
  target: readonly number[];
};
export type RelayControlMemory = { relayControl?: RelayControl; pendingControl?: Selection };
const inside = (e: NativeEntity, x: number, y: number) =>
  e.bbox[0] <= x && x <= e.bbox[2] && e.bbox[1] <= y && y <= e.bbox[3];
const near = (a: readonly number[], b: readonly number[]) =>
  Math.max(Math.abs(a[0]! + a[2]! - b[0]! - b[2]!), Math.abs(a[1]! + a[3]! - b[1]! - b[3]!)) <= 2;
export function rememberRelayControl(
  m: RelayControlMemory,
  b: NativeObservation,
  a: NativeObservation,
  op: string,
  point?: { x?: number; y?: number },
) {
  if (point?.x !== undefined && point.y !== undefined) {
    delete m.pendingControl;
    for (const oldPeer of b.entities.filter((e) => e.area > 1 && inside(e, point.x!, point.y!))) {
      const peer = poseRole(oldPeer);
      const selected = a.entities.find(
        (e) =>
          e.area > 1 &&
          e.palette_value === oldPeer.palette_value &&
          poseRole(e) !== peer &&
          near(e.bbox, oldPeer.bbox),
      );
      if (!selected) continue;
      const actor = poseRole(selected),
        sources = b.entities.filter((e) => poseRole(e) === actor);
      if (
        sources.length !== 1 ||
        !a.entities.some((e) => poseRole(e) === peer && near(e.bbox, sources[0]!.bbox))
      )
        continue;
      m.pendingControl = {
        actor,
        peer,
        ink: selected.palette_value,
        op,
        click: a.observation_ref,
        source: sources[0]!.bbox,
        target: selected.bbox,
      };
      return;
    }
  } else if (m.pendingControl) {
    const p = m.pendingControl,
      subjects = a.entities.filter((e) => poseRole(e) === p.actor);
    if (
      subjects.length === 1 &&
      !near(subjects[0]!.bbox, p.target) &&
      b.entities.some((e) => poseRole(e) === p.actor && near(e.bbox, p.target)) &&
      a.entities.some((e) => poseRole(e) === p.peer && near(e.bbox, p.source))
    ) {
      m.relayControl = {
        actor: p.actor,
        peer: p.peer,
        ink: p.ink,
        op: p.op,
        click: p.click,
        verification: a.observation_ref,
      };
      delete m.pendingControl;
    }
  }
}
