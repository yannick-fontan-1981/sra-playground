import { connectedJointFloor, measureJointGrid, type JointScene } from '../logos-engine/v6-joint-transport.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

type Cell = JointScene['player'];
type Colors = number[];
type Grid = { scale: number; offset: readonly [number, number] };
export type TransportAppearance = { surfaces: Colors; controllers: Colors[]; bodies: Colors[]; markers: Colors[] };
const point = (cell: string): Cell => cell.split(',').map(Number) as Cell;
const normalized = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);
const signature = (values: Colors) => values.join(',');

function cellColors(rows: NativeRows, { scale, offset }: Grid, [x, y]: Cell): Colors {
  const left = offset[0] + x * scale, top = offset[1] + y * scale;
  return normalized(rows.slice(top, top + scale).flatMap(row => row.slice(left, left + scale)));
}

export function rememberTransportAppearance(rows: NativeRows, scene: JointScene, earlier?: TransportAppearance): TransportAppearance | undefined {
  const visible = [...scene.floor].filter(cell => !scene.boxes.has(cell) && !scene.targets.has(cell) && cell !== signature(scene.player));
  const surfaces = normalized([...(earlier?.surfaces ?? []), ...visible.flatMap(cell => {
    const colors = cellColors(rows, scene, point(cell));
    return colors.length === 1 ? colors : [];
  })]);
  if (!surfaces.length || surfaces.length > 3) return earlier;
  const read = (cell: Cell) => cellColors(rows, scene, cell);
  const collect = (previous: Colors[] = [], current: Colors[]) => [...new Map([...previous, ...current].map(colors =>
    colors.filter(color => !surfaces.includes(color))).filter(colors => colors.length).map(colors => [signature(colors), colors])).values()];
  return {
    surfaces, controllers: collect(earlier?.controllers, [read(scene.player)]),
    bodies: collect(earlier?.bodies, [...scene.boxes].map(cell => read(point(cell)))),
    markers: collect(earlier?.markers, [...scene.targets].filter(cell => !scene.boxes.has(cell) && cell !== signature(scene.player))
      .map(cell => read(point(cell)))),
  };
}

export function measureRetainedTransport(rows: NativeRows, appearance: TransportAppearance,
  rememberedTargets: readonly Cell[] = [], retainedGrid?: Grid): JointScene {
  const grid = retainedGrid ?? measureJointGrid(rows), { scale, offset: [ox, oy] } = grid;
  const hud = 'hud' in grid && typeof grid.hud === 'number' ? grid.hud : rows.length;
  const targets = new Set(rememberedTargets.map(signature)), boxes = new Set<string>();
  const floor = new Set<string>(), controllers: Cell[] = [];
  const forms = (samples: Colors[]) => new Set(samples.flatMap(colors => [
    signature(colors), ...appearance.markers.map(marker => signature(normalized([...colors, ...marker]))),
  ]));
  const actorForms = forms(appearance.controllers), boxForms = forms(appearance.bodies);
  const markers = new Set(appearance.markers.map(signature));
  let wallCount = 0;
  for (let y = oy; y <= hud - scale; y += scale) for (let x = ox; x <= rows[0]!.length - scale; x += scale) {
    const cell: Cell = [(x - ox) / scale, (y - oy) / scale], key = signature(cell);
    const colors = cellColors(rows, grid, cell), paint = colors.filter(color => !appearance.surfaces.includes(color));
    const form = signature(paint), controller = actorForms.has(form), body = boxForms.has(form), marker = markers.has(form);
    if (Number(controller) + Number(body) + Number(marker) > 1) throw new Error('Retained tile roles overlap');
    if (!colors.some(color => appearance.surfaces.includes(color)) || (paint.length > 0 && !controller && !body && !marker)) {
      wallCount++;
      continue;
    }
    if (controller) controllers.push(cell);
    if (body) boxes.add(key);
    if (marker) targets.add(key);
    floor.add(key);
  }
  if (controllers.length !== 1) throw new Error('Retained controller is ambiguous');
  const player = controllers[0]!, connected = connectedJointFloor(floor, player);
  const bodies = new Set([...boxes].filter(cell => connected.has(cell)));
  const activeTargets = new Set([...targets].filter(cell => connected.has(cell)));
  if (!bodies.size || bodies.size !== activeTargets.size) throw new Error('Retained bodies and visible targets do not match');
  return { scale, offset: [ox, oy], floor: connected, boxes: bodies, targets: activeTargets, player,
    wall_count: wallCount, sprite_count: bodies.size + activeTargets.size + 1 };
}
