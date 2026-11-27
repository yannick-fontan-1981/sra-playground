import type { V6Ticket } from '../../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../../src/runtime/browser-games.ts';

type Point = [number, number];
export type PassageChange = 'actor' | 'indicator' | 'outlet' | 'switch' | 'command';

/** An independent raster world. Commands move one cell or traverse a paired
 * opening; only an actual switch contact joins the two unpaired endpoints. */
export function pairedPassageRoom(variant = false) {
  const side = variant ? 3 : 2, pitch = side + 2, ox = variant ? 1 : 3, y = variant ? 12 : 11;
  const paint = (ink: number) => variant ? (ink * 5 + 3) % 16 : ink;
  const forward = variant ? 'ACTION3' : 'ACTION4';
  const physical = (cell: number) => ox + (variant ? 11 - cell : cell) * pitch;
  let level = 1, completed = 0, actor = 0, rewired = false;
  let visited = new Set<number>();
  const endpoints = () => level < 3 ? [3, 5, 7, 9] : [5, 7, 9, 10];
  const pairs = (): [number, number][] => level < 3 ? [[3, 5], [7, 9]]
    : rewired ? [[5, 7], [9, 10]] : [[5, 7]];
  const mark = (index: number) => level < 3 || index < 2 || rewired ? Math.floor(index / 2) : index - 1;
  const inputDelta: Record<string, Point> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };

  function frame(change?: PassageChange) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(paint(1)));
    const fill = (x: number, y: number, w: number, h: number, ink: number) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) rows[y + j]![x + i] = paint(ink);
    };
    const pattern = (id: number, x: number, y: number) => level === 1
      ? x === 0 && y === 0 ? 0 : id ? 11 : 10
      : id === 3 ? (x + y) % 2 ? 13 : 15
      : (x + y) % 2 ? id === 0 ? 10 : 2 : id === 0 ? 2 : id === 1 ? 11 : 12;
    const border = (x: number, y: number, ink: number, id: number | null, outlet = false) => {
      for (let j = 0; j < pitch; j++) for (let i = 0; i < pitch; i++) {
        const edge = i === 0 || j === 0 || i === pitch - 1 || j === pitch - 1;
        rows[y + j]![x + i] = paint(edge ? ink : id === null ? 5 : pattern(id, i - 1, j - 1));
      }
      if (outlet) rows[y + 1]![x + (variant ? 0 : pitch - 1)] = paint(10);
    };
    const openings = endpoints();
    for (let cell = 0; cell <= 11; cell++) {
      if (!openings.includes(cell) && cell !== 11 && !(level === 3 && cell === 3)) {
        fill(physical(cell), y, pitch - 1, pitch - 1, 5);
      }
      // A disconnected floor row makes the lattice observable without adding a
      // route around the switch or a shortcut around an opening.
      fill(physical(cell), y + 3 * pitch, pitch - 1, pitch - 1, 5);
    }
    for (const [index, cell] of openings.entries()) {
      border(physical(cell) - 1, y - 1, level === 1 ? index < 2 ? 7 : 9 : 8, mark(index), level > 1);
      border(3 + index * (pitch + 2), 57, visited.has(cell) ? 14 : 7, mark(index));
    }
    border(physical(11) - 1, y - 1, 3, null);
    if (level === 3) {
      border(physical(3) - 1, y - 1, rewired ? 14 : 6, 3);
      fill(52, 57, 7, 3, rewired ? 14 : 6);
    }
    fill(physical(actor), y, side, side, 0);
    if (change === 'actor') fill(physical(2), y + 3 * pitch, side, side, 0);
    if (change === 'indicator') border(3, 57, visited.has(openings[0]!) ? 7 : 14, mark(0));
    if (change === 'outlet') {
      const x = physical(openings[0]!) - 1;
      rows[y]![x + (variant ? 0 : pitch - 1)] = paint(8);
      rows[y - 1]![x + 1] = paint(10);
    }
    if (change === 'switch') {
      border(physical(3) - 1, y - 1, rewired ? 6 : 14, 3);
      fill(52, 57, 7, 3, rewired ? 6 : 14);
    }
    return rows;
  }
  function packet(change?: PassageChange): GameObservation {
    const rows = frame(change);
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], level, levelCount: 3,
      levelsCompleted: completed, state: completed === 3 ? 'WIN' : 'NOT_FINISHED',
      availableActionIds: [1, 2, 3, 4].filter(id => change !== 'command' || 'ACTION' + id !== forward),
      canUndo: false, canSelectLevel: true, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, contradictory = false) {
    if (contradictory) return;
    const [dx, dy] = inputDelta[ticket.actionRef] ?? [0, 0];
    if (dy || !dx) return;
    const delta = variant ? -dx : dx, entry = actor + delta;
    if (entry < 0 || entry > 11) return;
    const pair = pairs().find(pair => pair.includes(entry));
    if (pair) {
      const other = pair.find(cell => cell !== entry)!;
      const landing = other + (level > 1 ? 1 : delta);
      if (landing < 0 || landing > 11 || endpoints().includes(landing)) return;
      visited.add(entry); visited.add(other); actor = landing;
    } else if (!endpoints().includes(entry)) actor = entry;
    if (level === 3 && actor === 3) rewired = true;
    if (actor === 11 && endpoints().every(cell => visited.has(cell))) {
      completed++;
      if (completed < 3) { level++; actor = 0; visited = new Set(); rewired = false; }
    }
  }
  return { frame, packet, act, forward, point: (cell: number): Point => [physical(cell), y],
    get level() { return level; }, get completed() { return completed; }, get rewired() { return rewired; } };
}
