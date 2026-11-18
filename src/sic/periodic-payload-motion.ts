import type { NativePoint } from '../logos-engine/v6-native-types.ts';
import type { Direction } from './rectangular-contact-route.ts';
import type { PeriodicContactMove, PeriodicContactRoute, PeriodicPose } from './periodic-contact-route.ts';

export function periodicBodyGeometry(route: PeriodicContactRoute) {
  const [width, height] = route.size;
  const sources = route.sources, cargo = route.payloads ?? [], carriers = route.carriers;
  const index = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height ? y * width + x : -1;
  const shift = (at: number, dx: number, dy: number) => index(at % width + dx, Math.floor(at / width) + dy);
  const rectangle = ([w, h]: NativePoint): NativePoint[] =>
    Array.from({ length: w * h }, (_, i): NativePoint => [i % w, Math.floor(i / w)]);
  const sourceOffset = carriers?.length ?? 1, cargoOffset = sourceOffset + sources.length;
  const masks: NativePoint[][] = [...(carriers ? carriers.map(carrier => rectangle(carrier.size)) : [[[0, 0]] as NativePoint[]]),
    ...sources.map(source => rectangle(source.size)), ...cargo.map(part => part.mask)];
  const footprints = masks.map(mask => route.field.map((_, at) => mask.map(([x, y]) => shift(at, x, y))));
  const terrain = footprints.map(boxes => boxes.map(cells => {
    if (cells.some(cell => cell < 0 || route.field[cell] === 2)) return 2;
    return cells.some(cell => route.field[cell] === 1) ? 1 : 0;
  }));
  return { shift, masks, footprints, terrain, sourceOffset, cargoOffset };
}

export function createPeriodicPayloadProjection(route: PeriodicContactRoute, timed: boolean, geometry = periodicBodyGeometry(route)) {
  const { shift, footprints, terrain, sourceOffset, cargoOffset } = geometry;
  const { sources, carriers } = route;
  return (pose: PeriodicPose, direction: Direction): PeriodicContactMove | null => {
    const places = [...(pose.carriers ?? [pose.actor]), ...pose.sources, ...(pose.payloads ?? [])];
    const active = pose.selected ?? 0, phases = [...pose.phases], automatic: number[] = [];
    const lastForce = new Map<number, NativePoint>();
    const cellsAt = (body: number, at = places[body]!) => footprints[body]![at]!;
    const conflict = (body: number, at: number) => places.some((_, other) => other !== body
      && cellsAt(body, at).some(cell => cellsAt(other).includes(cell)));
    const actor = shift(pose.actor, direction[1], direction[2]);
    let contact: number | null = null, payloadContact: number | undefined, carrierContact: number | undefined;
    if (terrain[active]![actor] === 0) {
      const footprint = cellsAt(active, actor);
      const hits = places.flatMap((_, i) => i !== active && cellsAt(i).some(cell => footprint.includes(cell)) ? [i] : []);
      if (!hits.length) places[active] = actor;
      else if (hits.length === 1) {
        const hit = hits[0]!, original = places[hit]!;
        const [, dx, dy] = direction;
        let steps = 0;
        while (steps < route.calibration.steps || terrain[hit]![places[hit]!] === 1) {
          const next = shift(places[hit]!, dx, dy);
          if (next < 0 || terrain[hit]![next] === 2) break;
          if (conflict(hit, next)) {
            if (!carriers) return null;
            break;
          }
          places[hit] = next;
          steps++;
        }
        if (terrain[hit]![places[hit]!] !== 0) {
          if (!carriers) return null;
          places[hit] = original;
          steps = 0;
        }
        if (steps && hit < sourceOffset) carrierContact = hit;
        if (steps && hit >= sourceOffset && hit < cargoOffset) contact = hit - sourceOffset;
        if (steps && hit >= cargoOffset) payloadContact = hit - cargoOffset;
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
        const { i, source, sign } = active, bodyIndex = i + sourceOffset, from = places[bodyIndex]!;
        const face = (sign > 0 ? source.size[source.axis] - 1 : 0) + length * sign;
        const edge = Array.from({ length: source.size[1 - source.axis]! }, (_, cross) =>
          source.axis === 0 ? shift(from, face, cross) : shift(from, cross, face));
        const affected = places.flatMap((_, body) => body !== bodyIndex && cellsAt(body).some(cell => edge.includes(cell)) ? [body] : []);
        if (affected.some(body => body >= sourceOffset && body < cargoOffset) || affected.length > 1) return null;
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
    const next: PeriodicPose = { actor: places[active]!, phases, sources: places.slice(sourceOffset, cargoOffset),
      payloads: places.slice(cargoOffset), ...(carriers ? { carriers: places.slice(0, sourceOffset), selected: active } : {}) };
    return { direction, pose: next, contact, automatic, ...(payloadContact === undefined ? {} : { payloadContact }),
      ...(carrierContact === undefined ? {} : { carrierContact }) };
  };
}
