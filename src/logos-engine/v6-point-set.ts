/**
 * Finite integer-coordinate sets with the reference CPython 3.12 / 64-bit
 * iteration order. PortAssembly keeps the first equally costly solution;
 * replacing its sets by insertion-ordered JS Sets would change that decision.
 *
 * This is a native data structure, not Python execution. Scope: pairs of safe
 * integers only. Hash/probing rules: CPython v3.12.14 Objects/{tuple,set}object.c.
 * Table slots (including deletion markers) are retained by the V7 state codec.
 */
export type Point = readonly [number, number];
export interface PointSetState {
  readonly format: 'cpython-3.12-64-point-set';
  readonly capacity: number;
  readonly finger: number;
  readonly entries: readonly (readonly [index: number, point: Point])[];
  readonly dummies: readonly number[];
}
const MOD64 = (1n << 64n) - 1n, HASH_MODULUS = (1n << 61n) - 1n;
const P1 = 11400714785074694791n, P2 = 14029467366897019727n, P5 = 2870177450012600261n;
const DUMMY = Symbol('deleted coordinate');
type Entry = { readonly point: Point; readonly hash: bigint };
type Slot = Entry | typeof DUMMY | null;
const equal = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
export const comparePoints = (a: Point, b: Point): number => a[0] - b[0] || a[1] - b[1];
export const pointKey = (point: Point): string => `${point[0]},${point[1]}`;
export function pointHash(point: Point): bigint {
  let acc = P5;
  for (const coordinate of point) {
    if (!Number.isSafeInteger(coordinate)) throw new TypeError('Point coordinates must be safe integers');
    const value = BigInt(coordinate); let lane = value % HASH_MODULUS; if (lane === -1n) lane = -2n;
    acc = (acc + (lane & MOD64) * P2) & MOD64;
    acc = ((acc << 31n) | (acc >> 33n)) & MOD64;
    acc = acc * P1 & MOD64;
  }
  acc = (acc + (2n ^ (P5 ^ 3527539n))) & MOD64;
  return acc === MOD64 ? 1546275796n : BigInt.asIntN(64, acc);
}

export class PointSet implements Iterable<Point> {
  private table: Slot[] = Array<Slot>(8).fill(null);
  private fill = 0; private used = 0; private finger = 0;
  constructor(points: Iterable<Point> = []) { this.update(points); }
  get size(): number { return this.used; }
  *[Symbol.iterator](): IterableIterator<Point> { for (const entry of this.table) if (entry && entry !== DUMMY) yield entry.point; }
  sorted(): Point[] { return [...this].sort(comparePoints); }
  private locate(point: Point, hash: bigint, insertion: boolean): number {
    const mask = this.table.length - 1; let perturb = hash & MOD64, index = Number(perturb & BigInt(mask)), free = -1;
    for (;;) {
      const probes = index + 9 <= mask ? 9 : 0;
      for (let step = 0; step <= probes; step++) {
        const slot = index + step, entry = this.table[slot];
        if (entry === null) return insertion && free >= 0 ? free : slot;
        if (entry === DUMMY) { if (insertion) free = slot; }
        else if (entry!.hash === hash && equal(entry!.point, point)) return slot;
      }
      perturb >>= 5n; index = Number((BigInt(index) * 5n + 1n + perturb) & BigInt(mask));
    }
  }
  private clean(entry: Entry): void {
    const slot = this.locate(entry.point, entry.hash, true); this.table[slot] = entry;
  }
  private resize(minimum: number): void {
    let size = 8; while (size <= minimum) size *= 2;
    if (size === 8 && this.table.length === 8 && this.fill === this.used) return;
    const previous = this.table; this.table = Array<Slot>(size).fill(null); this.fill = this.used;
    for (const entry of previous) if (entry && entry !== DUMMY) this.clean(entry);
  }
  has(point: Point): boolean { const slot = this.table[this.locate(point, pointHash(point), false)]; return !!slot && slot !== DUMMY; }
  add(point: Point): this {
    const hash = pointHash(point), index = this.locate(point, hash, true), previous = this.table[index];
    if (previous && previous !== DUMMY) return this;
    this.table[index] = { point: [point[0], point[1]], hash }; this.used++;
    if (previous === DUMMY) return this;
    this.fill++; if (this.fill * 5 >= (this.table.length - 1) * 3) this.resize(this.used > 50_000 ? this.used * 2 : this.used * 4);
    return this;
  }
  delete(point: Point): boolean {
    const index = this.locate(point, pointHash(point), false), entry = this.table[index];
    if (!entry || entry === DUMMY) return false; this.table[index] = DUMMY; this.used--; return true;
  }
  pop(): Point {
    if (!this.used) throw new RangeError('Cannot pop an empty coordinate set');
    let index = this.finger & (this.table.length - 1);
    while (!this.table[index] || this.table[index] === DUMMY) index = (index + 1) & (this.table.length - 1);
    const point = (this.table[index] as Entry).point; this.table[index] = DUMMY; this.used--; this.finger = index + 1; return point;
  }
  update(points: Iterable<Point>): this {
    if (!(points instanceof PointSet)) { for (const point of points) this.add(point); return this; }
    if (points === this || !points.size) return this;
    if ((this.fill + points.size) * 5 >= (this.table.length - 1) * 3) this.resize((this.used + points.size) * 2);
    if (!this.fill && this.table.length === points.table.length && points.fill === points.used) {
      this.table = [...points.table]; this.fill = points.fill; this.used = points.used; return this;
    }
    if (!this.fill) {
      for (const entry of points.table) if (entry && entry !== DUMMY) this.clean(entry);
      this.fill = points.used; this.used = points.used; return this;
    }
    for (const point of points) this.add(point); return this;
  }
  copy(): PointSet { return new PointSet(this); }
  union(...others: readonly PointSet[]): PointSet { const result = this.copy(); for (const other of others) result.update(other); return result; }
  intersection(other: PointSet): PointSet {
    if (other === this) return this.copy();
    const iterate = other.size > this.size ? this : other, lookup = iterate === this ? other : this, result = new PointSet();
    for (const point of iterate) if (lookup.has(point)) result.add(point); return result;
  }
  difference(other: PointSet): PointSet {
    if (Math.floor(this.size / 4) > other.size) return this.copy().differenceUpdate(other);
    return new PointSet([...this].filter(point => !other.has(point)));
  }
  differenceUpdate(other: PointSet): this {
    if (other === this) { this.table = Array<Slot>(8).fill(null); this.fill = 0; this.used = 0; this.finger = 0; return this; }
    const iterate = Math.floor(other.size / 8) > this.size ? this.intersection(other) : other;
    for (const point of iterate) this.delete(point);
    if (this.fill - this.used > (this.table.length - 1) / 4) this.resize(this.used > 50_000 ? this.used * 2 : this.used * 4);
    return this;
  }
  isSubset(other: PointSet): boolean { return this.size <= other.size && [...this].every(point => other.has(point)); }
  equals(other: PointSet): boolean { return this.size === other.size && this.isSubset(other); }
  disjoint(other: PointSet): boolean { return ![...this.size < other.size ? this : other].some(point => (this.size < other.size ? other : this).has(point)); }
  state(): PointSetState {
    const entries: [number, Point][] = [], dummies: number[] = [];
    this.table.forEach((entry, index) => { if (entry === DUMMY) dummies.push(index); else if (entry) entries.push([index, [...entry.point] as Point]); });
    return { format: 'cpython-3.12-64-point-set', capacity: this.table.length, finger: this.finger, entries, dummies };
  }
  static restore(state: PointSetState): PointSet {
    if (state.format !== 'cpython-3.12-64-point-set' || !Number.isSafeInteger(state.capacity) || state.capacity < 8 || state.capacity > 1_048_576 || !Number.isInteger(Math.log2(state.capacity)) || !Number.isInteger(state.finger) || state.finger < 0) throw new TypeError('Incompatible coordinate-set state');
    const result = new PointSet(); result.table = Array<Slot>(state.capacity).fill(null); result.finger = state.finger;
    const occupy = (index: number, entry: Slot) => {
      if (!Number.isInteger(index) || index < 0 || index >= state.capacity || result.table[index] !== null) throw new TypeError('Invalid coordinate-set slot');
      result.table[index] = entry; result.fill++;
    };
    for (const [index, point] of state.entries) { occupy(index, { point: [...point] as Point, hash: pointHash(point) }); result.used++; }
    for (const index of state.dummies) occupy(index, DUMMY);
    if (result.fill >= state.capacity || state.entries.some(([, point]) => !result.has(point))) throw new TypeError('Inconsistent coordinate-set state');
    return result;
  }
}
