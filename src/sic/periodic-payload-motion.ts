import type { NativePoint } from '../logos-engine/v6-native-types.ts';
import type { Direction } from './rectangular-contact-route.ts';
import type { PeriodicContactMove, PeriodicContactRoute, PeriodicPose } from './periodic-contact-route.ts';

export function createPeriodicPayloadProjection(route: PeriodicContactRoute, timed: boolean) {
  const [width, height] = route.size;
  const sources = route.sources, cargo = route.payloads ?? [];
  const index = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height ? y * width + x : -1;
  const shift = (at: number, dx: number, dy: number) => index(at % width + dx, Math.floor(at / width) + dy);
  const masks: NativePoint[][] = [[[0, 0]], ...sources.map(source =>
    Array.from({ length: source.size[0] * source.size[1] }, (_, i): NativePoint => [i % source.size[0], Math.floor(i / source.size[0])])),
  ...cargo.map(part => part.mask)];
  const footprints = masks.map(mask => route.field.map((_, at) => mask.map(([x, y]) => shift(at, x, y))));
  const terrain = footprints.map(boxes => boxes.map(cells => {
    if (cells.some(cell => cell < 0 || route.field[cell] === 2)) return 2;
    return cells.some(cell => route.field[cell] === 1) ? 1 : 0;
  }));
  return (pose: PeriodicPose, direction: Direction): PeriodicContactMove | null => {
    const places = [pose.actor, ...pose.sources, ...pose.payloads!], phases = [...pose.phases], automatic: number[] = [];
    const lastForce = new Map<number, NativePoint>();
    const cellsAt = (body: number, at = places[body]!) => footprints[body]![at]!;
    const conflict = (body: number, at: number) => places.some((_, other) => other !== body
      && cellsAt(body, at).some(cell => cellsAt(other).includes(cell)));
    const actor = shift(pose.actor, direction[1], direction[2]);
    let contact: number | null = null, payloadContact: number | undefined;
    if (route.field[actor] === 0) {
      const hit = places.findIndex((_, i) => i > 0 && cellsAt(i).includes(actor));
      if (hit < 0) places[0] = actor;
      else {
        const [, dx, dy] = direction;
        let steps = 0;
        while (steps < route.calibration.steps || terrain[hit]![places[hit]!] === 1) {
          const next = shift(places[hit]!, dx, dy);
          if (next < 0 || terrain[hit]![next] === 2) break;
          if (conflict(hit, next)) return null;
          places[hit] = next;
          steps++;
        }
        if (terrain[hit]![places[hit]!] !== 0) return null;
        if (steps && hit <= sources.length) contact = hit - 1;
        if (steps && hit > sources.length) payloadContact = hit - sources.length - 1;
      }
    }
    if (timed) {
      const ready = sources.flatMap((source, i) => {
        const rhythm = route.rhythms[i]!;
        phases[i] = (phases[i]! + 1) % rhythm.period!;
        if (phases[i] !== 0) return [];
        const sign = rhythm.side === 0 ? 1 : -1;
        return [{ i, source, reach: rhythm.reach!, sign }];
      });
      for (let length = 1; length <= Math.max(0, ...ready.map(item => item.reach)); length++) for (const active of ready) {
        if (length > active.reach) continue;
        const { i, source, sign } = active, from = places[i + 1]!;
        const face = (sign > 0 ? source.size[source.axis] - 1 : 0) + length * sign;
        const edge = Array.from({ length: source.size[1 - source.axis]! }, (_, cross) =>
          source.axis === 0 ? shift(from, face, cross) : shift(from, cross, face));
        const affected = places.flatMap((_, body) => body !== i + 1 && cellsAt(body).some(cell => edge.includes(cell)) ? [body] : []);
        if (affected.some(body => body > 0 && body <= sources.length) || affected.length > 1) return null;
        for (const body of affected) {
          const [dx, dy]: NativePoint = source.axis === 0 ? [sign, 0] : [0, sign];
          const next = shift(places[body]!, dx, dy);
          if (!automatic.includes(i)) automatic.push(i);
          if (next < 0 || terrain[body]![next] === 2) continue;
          if (conflict(body, next)) return null;
          places[body] = next;
          lastForce.set(body, [dx, dy]);
        }
      }
      for (const [body, [dx, dy]] of lastForce) while (terrain[body]![places[body]!] === 1) {
        const next = shift(places[body]!, dx, dy);
        if (next < 0 || terrain[body]![next] === 2 || conflict(body, next)) return null;
        places[body] = next;
      }
    }
    const next: PeriodicPose = { actor: places[0]!, phases, sources: places.slice(1, sources.length + 1), payloads: places.slice(sources.length + 1) };
    return { direction, pose: next, contact, automatic, ...(payloadContact === undefined ? {} : { payloadContact }) };
  };
}
