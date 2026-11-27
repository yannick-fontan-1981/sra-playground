import type { NativePoint, NativeRecord } from '../../src/logos-engine/v6-native-types.ts';
import type { V6Ticket } from '../../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../../src/runtime/browser-games.ts';
import type { GlyphWorkshopState } from '../../src/sic/managed-glyph-workshop.ts';

export type CycleChange = 'phase' | 'position' | 'ambiguous' | 'missing';

/** Independent public raster with three moving stations. Initial geometry is
 * declared by the fixture, but no station period or repeated-history witness
 * is supplied. The native owner must acquire that role from physical returns. */
export function glyphCycleRoom(varied = false) {
  const pitch = varied ? 4 : 3, period = 5;
  const ink = (value: number) => varied ? (value * 5 + 3) % 16 : value;
  const floor = ink(1), forward = varied ? 'ACTION3' : 'ACTION4';
  const point = (cell: number): NativePoint => [varied ? 45 - cell * pitch : 2 + cell * pitch, varied ? 35 : 32];
  const site = (role: number, phase: number): NativePoint => [varied ? 45 - (phase + 1) * pitch : 2 + (phase + 1) * pitch,
    varied ? 1 + role * 9 : 2 + role * 7];
  const actor = Array.from({ length: pitch * pitch }, (_, i) => ink(varied && i % pitch === 0 ? 12 : 7));
  const stamp = (role: number) => Array.from({ length: pitch * pitch }, (_, i) =>
    i === pitch + 1 ? ink(3 + role) : floor);
  const masks = varied ? '0,0;1,0;1,1;2,1' : '0,0;0,1;1,1';
  const displayScale = varied ? 2 : 1, displaySide = varied ? 8 : 4;
  const shownBox: [number, number, number, number] = [50, 24, 49 + displaySide, 23 + displaySide];
  const glyph = { mask: masks, ink: ink(6) };
  const reserve = { row: 60, left: 1, right: 61, active: ink(9), depleted: floor, cost: 1, samples: 2 };
  let cell = 0, phase = 0, commands = 0, acquired = 0;
  const goals = [8, 10].map(value => ({ at: point(value),
    box: [point(value)[0], point(value)[1], point(value)[0] + pitch - 1, point(value)[1] + pitch - 1] as const,
    glyph: { ...glyph } }));
  const cells = Array.from({ length: 11 }, (_, i) => point(i));
  const positions = [...cells, ...Array.from({ length: 3 }, (_, role) => Array.from({ length: period }, (_, i) => site(role, i))).flat()];
  const stationPositions = () => Array.from({ length: 3 }, (_, role) => site(role, (phase + role * 2) % period));

  function frame(change?: CycleChange) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(floor));
    const tile = ([x, y]: NativePoint, pixels: number[]) => pixels.forEach((value, i) => { rows[y + Math.floor(i / pitch)]![x + i % pitch] = value; });
    for (let role = 0; role < 3; role++) tile(stationPositions()[role]!, stamp(role));
    for (let goal = 0; goal < goals.length; goal++) if (!(acquired & (1 << goal))) {
      const at = goals[goal]!.at;
      tile(at, Array.from({ length: pitch * pitch }, (_, i) =>
        i < pitch || i >= pitch * (pitch - 1) || i % pitch === 0 || i % pitch === pitch - 1 ? ink(10 + goal) : glyph.ink));
    }
    if (change !== 'missing') tile(point(cell), actor);
    if (change === 'ambiguous') tile(point(cell === 0 ? 1 : 0), actor);
    for (const item of masks.split(';')) {
      const [x, y] = item.split(',').map(Number);
      for (let dy = 0; dy < displayScale; dy++) for (let dx = 0; dx < displayScale; dx++) {
        rows[shownBox[1] + 1 + y! * displayScale + dy]![shownBox[0] + 1 + x! * displayScale + dx] = glyph.ink;
      }
    }
    rows[reserve.row]!.fill(reserve.active, reserve.left, reserve.right - commands);
    return rows;
  }
  const memory = { epoch: 0, evidence: 'fixture-observed-layout', actor, pitch, floor, peerScale: 1,
    reserve, bandInks: [], directions: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'] };
  const local: GlyphWorkshopState = { epoch: 1, at: point(0), refs: [], history: [stationPositions()],
    shapes: [], colors: [], landings: [], acquired: 0, spent: 0, blocked: [], visits: [point(0).join(',')],
    layout: { ...memory, display: { point: [shownBox[0], shownBox[1]], scale: displayScale, side: displaySide / displayScale },
      shownBox, exit: goals[0]!.at, exitBox: goals[0]!.box, positions, cells, goals,
      stations: ['shape', 'color', 'rotation'].map((role, i) => ({ role: role as 'shape' | 'color' | 'rotation', image: stamp(i).join(',') })),
      charges: [], turn: 1 } };
  function retainedLayout(): NativeRecord {
    return { glyphMemory: structuredClone(memory), glyphWorkshop: structuredClone(local), transfer: {
      epoch: 0, victory: 'fixture-observed-layout', confirmedMoves: memory.directions,
      rotation: { shape: masks, peerScale: 1, delta: 1, station: stamp(2), evidence: 'fixture-observed-layout' },
    } };
  }
  function packet(change?: CycleChange): GameObservation {
    const rows = frame(change), completed = acquired === 3 ? 1 : 0;
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], level: 1, levelCount: 1, levelsCompleted: completed,
      state: completed ? 'WIN' : 'NOT_FINISHED', availableActionIds: [1, 2, 3, 4], canUndo: false, canSelectLevel: true, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, change?: CycleChange) {
    const dx = ticket.actionRef === 'ACTION4' ? 1 : ticket.actionRef === 'ACTION3' ? -1 : 0;
    const delta = varied ? -dx : dx, next = cell + delta;
    if (!delta || next < 0 || next > 10) return;
    cell = change === 'position' ? Math.min(10, next + 1) : next;
    phase = (phase + (change === 'phase' ? 2 : 1)) % period;
    commands++;
    goals.forEach((goal, index) => { if (goal.at[0] === point(cell)[0]) acquired |= 1 << index; });
  }
  return { packet, act, retainedLayout, forward, point, get completed() { return acquired === 3 ? 1 : 0; },
    get physicalPhase() { return phase; }, get commands() { return commands; } };
}
