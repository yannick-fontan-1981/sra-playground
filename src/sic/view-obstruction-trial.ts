import type { NativeCommand, NativePoint } from '../logos-engine/v6-native-types.ts';
import { pythonEqual } from '../logos-engine/v6-operations.ts';
import type { ViewNeedSituation } from './view-strategy.ts';

type Poses = Readonly<Record<string, NativePoint>>;
type UniqueMovers = Readonly<Record<string, { readonly position: NativePoint }>>;

/** Evidence retained when a previously passable entry stops its bound movers. */
export interface ViewObstructionWitness {
  readonly key: string;
  readonly signature: string;
  readonly position: NativePoint;
  readonly origin: NativePoint;
  readonly command: Pick<NativeCommand, 'action_ref'> & Partial<Pick<NativeCommand, 'data'>>;
  readonly poses: Poses;
  readonly expected: Poses;
  fail_count: number;
  refs: string[];
}

function posesStillMatch(poses: Poses, movers: UniqueMovers): boolean {
  return Object.entries(poses).every(([signature, position]) =>
    Object.hasOwn(movers, signature) && pythonEqual(movers[signature]!.position, position));
}

/** The family identifies the support at its recorded position before offering a probe. */
export function bindViewObstruction(witness: ViewObstructionWitness, current: {
  readonly carrierPresent: boolean;
  readonly origin: NativePoint;
  readonly movers: UniqueMovers;
  readonly tested: ReadonlySet<string>;
}): ViewNeedSituation['obstruction'] {
  if (!current.carrierPresent || current.tested.has(witness.key) || !pythonEqual(current.origin, witness.origin)
      || !posesStillMatch(witness.poses, current.movers)) return null;
  return { refs: witness.refs, repeated: witness.fail_count !== 1 };
}

/** Stationarity is measured in a registered view against every bound mover. */
export function observedRepeatedStop(witness: ViewObstructionWitness, offset: NativePoint | null, movers: UniqueMovers): boolean {
  return pythonEqual(offset, [0, 0]) && posesStillMatch(witness.poses, movers);
}
