import type { GameObservation } from '../../src/runtime/browser-games.ts';
import type { NativePoint, NativeRecord } from '../../src/logos-engine/v6-native-types.ts';
import { measureNativeObservation, rowsDigest } from '../../src/logos-engine/v6-native-observer.ts';
import type { V6Ticket } from '../../src/runtime/v6-agent-protocol.ts';

export type PassengerChange = 'blocked' | 'missing' | 'ambiguous' | 'passenger';

/** Independent public room. Prior movement and crossing memory are declared
 * preconditions; no route, passenger association or incompatibility is seeded.
 * The native owner must bind the new room and learn its unsafe pairs from the
 * actual animated returns. The production L1 replay covers prior acquisition. */
export function passengerRoom(varied = false) {
  const ink = (value: number) => varied ? (value * 5 + 3) % 16 : value;
  const step = varied ? 3 : 4, side = varied ? 5 : 7, half = (side - 1) / 2;
  const departure = varied ? 15 : 12, arrival = varied ? 51 : 52;
  const from = varied ? 24 : 20, to = varied ? 42 : 40;
  const ys = varied ? [15, 39, 27] : [12, 44, 28], initialY = varied ? 24 : 20;
  // Leave the default receiver rim outside the pickup comparison radius:
  // its isolated vertical edge must not impersonate the nearby carried body.
  const radius = varied ? 18 : 20, frameHalf = varied ? 5 : 7;
  const commands = varied
    ? { up: 'ACTION4', down: 'ACTION3', left: 'ACTION1', right: 'ACTION2' }
    : { up: 'ACTION1', down: 'ACTION2', left: 'ACTION3', right: 'ACTION4' };
  const motion: Record<string, NativePoint> = {
    [commands.up]: [0, -step], [commands.down]: [0, step],
    [commands.left]: [-step, 0], [commands.right]: [step, 0],
  };
  const colors = [2, 4, 6].map(ink), floor = ink(0), actorInk = ink(15);
  const shapes = varied
    ? [[3, 5], [5, 3], [5, 5]] as const
    : [[5, 3], [5, 5], [3, 5]] as const;
  let actor: NativePoint = [from, initialY], bank = 0, banks = [0, 0, 1], held: number | null = null;
  let heldY = 0;
  let completed = false, resets = 0, frames: number[][][] | null = null;
  const copyActor = (point: NativePoint) => [...point] as [number, number];
  const center = (index: number): NativePoint => held === index
    ? [actor[0] + (bank ? 1 : -1) * (half + (shapes[index]![0] - 1) / 2 + (varied ? 0 : 1)), actor[1] + heldY]
    : [banks[index] ? arrival : departure, ys[index]!];

  function frame(change?: PassengerChange) {
    const rows = Array.from({ length: 64 }, () => Array.from({ length: 64 }, (_, x) =>
      x > from + half && x < to - half ? ink(1) : floor));
    const paint = (x: number, y: number, value: number) => {
      if (rows[y]?.[x] !== undefined) rows[y]![x] = value;
    };
    for (let delta = -radius; delta <= radius; delta++) {
      paint(actor[0] + delta, actor[1] - radius, ink(7));
      paint(actor[0] + delta, actor[1] + radius, ink(7));
      paint(actor[0] - radius, actor[1] + delta, ink(7));
      paint(actor[0] + radius, actor[1] + delta, ink(7));
    }
    for (const index of [...ys.keys()].sort((a, b) => Number(a === held) - Number(b === held))) {
      for (let delta = -frameHalf + 1; delta < frameHalf; delta++) {
        paint(arrival + delta, ys[index]! - frameHalf, colors[index]!);
        paint(arrival + delta, ys[index]! + frameHalf, colors[index]!);
        paint(arrival - frameHalf, ys[index]! + delta, colors[index]!);
        paint(arrival + frameHalf, ys[index]! + delta, colors[index]!);
      }
      const position = center(index), [width, height] = shapes[index]!;
      for (let y = -(height - 1) / 2; y <= (height - 1) / 2; y++) {
        for (let x = -(width - 1) / 2; x <= (width - 1) / 2; x++) {
          if (index === 1 && width === height && Math.abs(x) + Math.abs(y) > (width + 1) / 2) continue;
          paint(position[0] + x + (change === 'passenger' && index === 2 ? 7 : 0), position[1] + y, colors[index]!);
        }
      }
    }
    const body = (point: NativePoint) => {
      for (let y = -half; y <= half; y++) for (let x = -half; x <= half; x++) {
        if (varied && Math.abs(x) === half && Math.abs(y) === half) continue;
        paint(point[0] + x, point[1] + y, actorInk);
      }
    };
    if (change !== 'missing') body(actor);
    if (change === 'ambiguous') body([from, 56]);
    return rows;
  }
  function packet(change?: PassengerChange): GameObservation {
    const rows = frame(change);
    return { gameCode: 'PUBLIC', frame: rows, frames: change ? [rows] : frames ?? [rows],
      level: 1, levelCount: 1, levelsCompleted: Number(completed), state: completed ? 'WIN' : 'NOT_FINISHED',
      availableActionIds: [1, 2, 3, 4, 5], canUndo: false, canSelectLevel: false, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, change?: PassengerChange) {
    frames = null;
    const delta = motion[ticket.actionRef];
    if (delta && change !== 'blocked') {
      const crossing = actor[0] === from && ticket.actionRef === commands.right
        || actor[0] === to && ticket.actionRef === commands.left;
      const next: NativePoint = crossing ? [bank ? from : to, actor[1]]
        : [actor[0] + delta[0], actor[1] + delta[1]];
      const nextBank = crossing ? 1 - bank : bank;
      if (next[0] >= (nextBank ? to : departure) && next[0] <= (nextBank ? arrival : from)
        && next[1] >= Math.min(...ys) && next[1] <= Math.max(...ys)) {
        actor = next; bank = nextBank;
      }
    } else if (ticket.actionRef === 'ACTION5') {
      if (held !== null) { banks[held] = bank; held = null; }
      else {
        const near = banks.flatMap((place, index) => place === bank
          ? [{ index, gap: Math.hypot(center(index)[0] - actor[0], center(index)[1] - actor[1]) }] : [])
          .filter(item => item.gap <= side - 1).sort((a, b) => a.gap - b.gap);
        if (near.length && near[0]!.gap !== near[1]?.gap) {
          held = near[0]!.index; heldY = ys[held]! - actor[1];
        }
      }
    }
    const unsafe = [[0, 2], [1, 2]].some(([a, b]) => held !== a && held !== b && banks[a!] === banks[b!]
      && (banks[a!] !== bank || Math.max(...[a!, b!].map(index =>
        Math.max(Math.abs((banks[index] ? arrival : departure) - actor[0]), Math.abs(ys[index]! - actor[1])))) > radius));
    completed = bank === 1 && held === null && banks.every(value => value === 1);
    if (unsafe && !completed) {
      const changed = frame();
      actor = [from, initialY]; bank = 0; banks = [0, 0, 1]; held = null; heldY = 0; resets++;
      frames = [changed, frame()];
    }
    completed = bank === 1 && held === null && banks.every(value => value === 1);
  }
  async function priorTransport(): Promise<NativeRecord> {
    const rows = frame(), observed = await measureNativeObservation({ frame_rows: rows, frame_hash: await rowsDigest(rows),
      level: 1, levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'] },
    1, 'declared-prior-transport-' + varied);
    const body = observed.entities.filter(entity => entity.palette_value === actorInk);
    if (body.length !== 1) throw new Error('The declared transport body must be unique');
    return { state: null, measuredCrossing: null, multiple: null, guarded: null,
      previousDelivery: { actor: body[0]!.signature, completed: 0,
        crossing: { from: from - half, to: to - half, forward: commands.right, back: commands.left },
        motion, interaction: 'ACTION5', evidence: [observed.observation_ref] } };
  }
  return { packet, act, priorTransport, commands, get completed() { return completed; },
    get resets() { return resets; }, get actor() { return copyActor(actor); }, get held() { return held; } };
}
