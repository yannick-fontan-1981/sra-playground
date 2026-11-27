import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { acquireQueuedField } from '../src/logos-engine/v6-queued-field-models.ts';
import { measureQueuedField } from '../src/logos-engine/v6-queued-field-observation.ts';
import { createSicQueuedPlacement } from '../src/sic/queued-placement.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { nativeAfterPublicBoundaries } from './helpers/sic-native-public-boundaries.ts';

type RecordLike = Record<string, any>;
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-queued-control-transfer-public.json.gz', import.meta.url))).toString());

function scenario(variant: boolean) {
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  const actions: Record<number, number> = variant ? { 1: 4, 2: 1, 3: 2, 4: 3 } : { 1: 1, 2: 2, 3: 3, 4: 4 };
  const geometry = { ...fixture.geometry, origin: variant ? [8, 6] : [3, 3],
    size: variant ? [4, 3] : [3, 3], pitch: variant ? [6, 5] : [5, 5] };
  const sample = (rows: number[][]) => {
    const scene = measureQueuedField(rows, fixture.geometry, 3)!;
    assert.ok(scene);
    return { grid: scene.grid, mark: scene.mark,
      preview: scene.preview_alternatives.find((p: RecordLike) => p.orientation.every(Boolean))?.members ?? [] };
  };
  function render(scene: RecordLike, gridMapped = false, changedGeometry = false, ambiguous = false) {
    const g = changedGeometry ? { ...geometry, size: [geometry.size[0] + 1, geometry.size[1]], pitch: [geometry.pitch[0] + 1, geometry.pitch[1]] } : geometry;
    const gutter = fixture.calibration[0].before.frame[fixture.geometry.origin[1] - 1][fixture.geometry.origin[0] - 1];
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(gutter)));
    const paint = (x: number, y: number, width: number, height: number, value: number) => {
      for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) rows[y + dy]![x + dx] = value;
    };
    const [left, top] = g.origin, [dx, dy] = g.pitch, [width, height] = g.size;
    for (const [j, line] of (scene.grid as number[][]).entries()) for (const [i, value] of line.entries())
      paint(left + i * dx, top + j * dy, width, height, gridMapped ? value : ink(value));
    const envelope = (column: number) => {
      const mark = scene.mark, x = left + column * dx - 1, y = top + mark.rows[0] * dy - 1;
      const right = x + width + 1, bottom = top + mark.rows.at(-1) * dy + height;
      const color = ink(mark.palette);
      for (let xx = x; xx <= right; xx++) { rows[y]![xx] = color; rows[bottom]![xx] = color; }
      for (let yy = y; yy <= bottom; yy++) { rows[yy]![x] = color; rows[yy]![right] = color; }
    };
    if (scene.mark) {
      envelope(scene.mark.column);
      if (ambiguous) envelope(scene.mark.column === 0 ? 3 : 0);
    }
    for (const [i, members] of (scene.preview as number[][]).entries()) for (const [j, value] of members.entries())
      paint(44 + i * 3, 9 + j * 3, 2, 2, ink(value));
    return rows;
  }
  const packet = (source: RecordLike, options: { changedGeometry?: boolean; ambiguous?: boolean } = {}): GameObservation => {
    const frame = render(sample(source.frame), false, options.changedGeometry, options.ambiguous);
    return { gameCode: 'PUBLIC', frame, frames: [frame], level: source.level, levelCount: 3,
      levelsCompleted: source.levelsCompleted, state: source.state,
      availableActionIds: source.availableActionIds.map((id: number) => actions[id] ?? id),
      defaultFps: 10, canSelectLevel: false, canUndo: false };
  };
  let revision = 0;
  const observe = async (source: RecordLike, frame: number[][]) => measureNativeObservation({
    frame_rows: frame, frame_hash: 'queued-transfer-' + variant + '-' + ++revision, level: source.level,
    levels_completed: source.levelsCompleted, state: source.state,
    available_action_refs: source.availableActionIds.map((id: number) => 'ACTION' + (actions[id] ?? id)),
  }, revision, 'public-queued-transfer-' + variant);
  async function acquire() {
    let state: RecordLike | null = null;
    for (const entry of fixture.calibration) {
      const first = render(sample(entry.before.frame)), second = render(sample(entry.after.frame));
      const before = await observe(entry.before, first), after = await observe(entry.after, second);
      const frames = entry.after.frames.map((rows: number[][]) => render(sample(rows)));
      state = acquireQueuedField(state, before, after, { action_ref: 'ACTION' + (actions[entry.action.id] ?? entry.action.id) }, first, second, frames) ?? state;
      assert.ok(state, 'A public queue preparation or receipt must acquire the role before it can be retained');
      state.levelsCompleted = before.levels_completed;
      const scene = measureQueuedField(first, geometry, 3)!;
      state.observedInks = [...new Set<number>([...state.observedInks ?? [], ...scene.grid.flat(),
        ...scene.preview_alternatives.flatMap((p: RecordLike) => p.members.flat())])].filter(color => color !== state!.empty).sort((a, b) => a - b);
    }
    assert.ok(state && Object.keys(state.controls).length === 4 && state.closure_models.length);
    const family = createSicQueuedPlacement(); family.restore({ state });
    return { family, state };
  }
  const prepared = (rows: number[][], actionRef: string) => {
    const measured = measureQueuedField(rows, geometry, 3)!;
    const sourceInput = Number(Object.keys(actions).find(id => actions[Number(id)] === Number(actionRef.slice(6))));
    const mark = measured.mark, grid = structuredClone(measured.grid), values = [...mark.values];
    let column = mark.column;
    // These effects are the public fixture's observed preparation controls.
    // Apply them independently of the planner's projected grids.
    if (sourceInput === 1) values.unshift(values.pop()!);
    else if (sourceInput === 3) column--;
    else if (sourceInput === 4) column++;
    else assert.fail('This fixture only simulates the already observed preparation controls');
    assert.ok(column >= 0 && column < geometry.shape[0]);
    for (const row of mark.rows) grid[row][mark.column] = measured.empty_appearance_hypothesis;
    for (const [index, row] of mark.rows.entries()) grid[row][column] = values[index];
    const scene = sample(fixture.next.frame);
    return render({ ...scene, grid, mark: { ...scene.mark, column, values } }, true);
  };
  const received = (rows: number[][]) => {
    const measured = measureQueuedField(rows, geometry, 3)!, grid: number[][] = structuredClone(measured.grid);
    const { column, values, rows: activeRows } = measured.mark, empty = measured.empty_appearance_hypothesis;
    const scene = sample(fixture.next.frame), frames: number[][][] = [];
    for (const row of activeRows) grid[row]![column] = empty;
    const occupied = grid.findIndex(row => row[column] !== empty);
    const landing = (occupied < 0 ? grid.length : occupied) - values.length;
    assert.ok(landing >= 0);
    values.forEach((value: number, index: number) => { grid[landing + index]![column] = value; });
    const phase = () => render({ ...scene, grid, mark: null }, true);
    frames.push(phase());
    // Independent fixture mechanics: public equal triples disappear together,
    // then each column falls. No planner projection or production closure is used.
    for (;;) {
      const removed = new Set<string>();
      for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y]!.length; x++) {
        if (grid[y]![x] === empty) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          if ([1, 2].every(step => grid[y + step * dy!]?.[x + step * dx!] === grid[y]![x]))
            for (let step = 0; step < 3; step++) removed.add([y + step * dy!, x + step * dx!].join(','));
        }
      }
      if (!removed.size) break;
      for (const cell of removed) { const [y, x] = cell.split(',').map(Number); grid[y!]![x!] = empty; }
      for (let x = 0; x < grid[0]!.length; x++) {
        const survivors = grid.map(row => row[x]!).filter(value => value !== empty);
        const column = [...Array(grid.length - survivors.length).fill(empty), ...survivors];
        grid.forEach((row, y) => { row[x] = column[y]; });
      }
      frames.push(phase());
    }
    const nextValues = scene.preview[0]; assert.ok(nextValues);
    for (const [index, row] of activeRows.entries()) {
      assert.equal(grid[row]![scene.mark.column], empty);
      grid[row]![scene.mark.column] = ink(nextValues[index]);
    }
    const frame = render({ ...scene, grid, preview: scene.preview.slice(1) }, true);
    frames.push(frame);
    return { frame, frames };
  };
  return { geometry, ink, actions, sample, render, packet, acquire, prepared, received };
}

for (const variant of [false, true]) test('native queue reuses compatible controls when all pigments are already in the active group' + (variant ? ' with rectangular tiles, new palette, positions and inputs' : ''), async () => {
  const s = scenario(variant), { family, state } = await s.acquire();
  const next = s.packet(fixture.next), current = measureQueuedField(next.frame)!;
  assert.equal(new Set(current.grid.flat().filter((color: number) => color !== current.empty_appearance_hypothesis
    && !current.mark.values.includes(color))).size, 0);
  const run = await nativeAfterPublicBoundaries(family, next, 'queue-native-' + variant, 34);
  assert.ok(run.reply.ticket);
  const proposal = run.reply.snapshot.proposal as RecordLike;
  assert.notEqual(proposal.sicSituationCard.strategy, 'test_queue_control');
  assert.equal(proposal.model.wholeQueue, false, 'Control transfer does not force the multi-group horizon');
  assert.deepEqual(Object.keys(proposal.model.controls).sort(), Object.keys(state.controls).sort());
  assert.ok(proposal.route_refs.some((ref: string) => state.evidence.includes(ref)));
  assert.ok(proposal.model.controls[run.reply.ticket.actionRef]);
  assert.equal(proposal.actions.at(-1).action_ref, 'ACTION' + s.actions[2],
    'The prepared reachable receipt remains in the same native prefix');
  assert.equal(proposal.preparations.at(-1), null, 'The receipt closes the prefix after its actual return');
  let done = run.reply, sequence = run.sequence, currentRows = next.frame as number[][];
  for (let index = 0; index < proposal.actions.length; index++) {
    assert.ok(done.ticket);
    assert.equal(done.ticket.actionIndex, index);
    const receipt = done.ticket.actionRef === 'ACTION' + s.actions[2];
    const returned = receipt ? s.received(currentRows) : (() => {
      const frame = s.prepared(currentRows, done.ticket!.actionRef); return { frame, frames: [frame] };
    })();
    currentRows = returned.frame;
    sequence++;
    done = await run.service.handle({ type: 'advance', sessionId: run.sessionId, sequence,
      ticketId: done.ticket.id, executionMs: 1,
      observation: toV6PublicObservation({ ...next, ...returned }, sequence) });
    assert.equal((done.snapshot.trace as RecordLike[]).findLast(event => event.kind === 'actual_outcome')?.matched, receipt ? null : true);
  }
  const trace = done.snapshot.trace as RecordLike[];
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, proposal.preparations.length);
  const retained = family.state().state as RecordLike;
  assert.equal(retained.controls[run.reply.ticket.actionRef].revalidated_epoch, 2);
  assert.equal(retained.controls['ACTION' + s.actions[2]].revalidated_epoch, 2);
  assert.equal(retained.last_transition, 'received_then_automatic_or_return_unknown');
  for (const [command, law] of Object.entries(state.controls)) if (command !== run.reply.ticket.actionRef)
    assert.equal(retained.controls[command].acquisition_epoch, (law as RecordLike).acquisition_epoch);
});

for (const failure of ['missing_role', 'changed_geometry', 'ambiguous_envelope', 'missing_receive'] as const)
  test('queue transfer refuses ' + failure + ' while keeping its earlier evidence', async () => {
    const s = scenario(false), { family, state } = await s.acquire();
    if (failure === 'missing_role') family.restore({ state: null });
    const next = s.packet(fixture.next, { changedGeometry: failure === 'changed_geometry', ambiguous: failure === 'ambiguous_envelope' });
    if (failure === 'missing_receive') next.availableActionIds = next.availableActionIds.filter(id => state.controls['ACTION' + id]?.kind !== 'receive');
    const run = await nativeAfterPublicBoundaries(family, next, 'queue-refusal-' + failure, 34);
    const proposal = run.reply.snapshot.proposal as RecordLike | null;
    assert.ok(!proposal?.model?.transfer_scope);
    if (proposal) assert.equal(proposal.sicSituationCard.strategy, 'test_queue_control');
    if (failure !== 'missing_role') assert.deepEqual(family.state().state, state);
  });

test('a contradicted first reused preparation closes its native suffix and retains unrelated controls', async () => {
  const s = scenario(false), { family, state } = await s.acquire(), next = s.packet(fixture.next);
  const run = await nativeAfterPublicBoundaries(family, next, 'queue-contradiction', 34);
  assert.ok(run.reply.ticket);
  const proposal = run.reply.snapshot.proposal as RecordLike;
  assert.ok(proposal.preparations[0]);
  const done = await run.service.handle({ type: 'advance', sessionId: run.sessionId, sequence: run.sequence + 1,
    ticketId: run.reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(next, run.sequence + 1) });
  const trace = done.snapshot.trace as RecordLike[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.ok(!done.ticket || done.ticket.actionIndex === 0);
  for (const command of Object.keys(state.controls)) if (command !== run.reply.ticket.actionRef)
    assert.deepEqual((family.state().state as RecordLike).controls[command].evidence, state.controls[command].evidence);
});

