/** Synthetic direct-owner capture used only to qualify the independent reader. */
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { NativePreviewPacking } from '../src/logos-engine/v6-preview-packing.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { capturePreviewPacking } from '../tests/helpers/capture-preview-packing.ts';

const output = process.argv[2];
if (!output) throw new Error('Provide a new output path');
const fixture = JSON.parse(gunzipSync(await readFile(new URL('../tests/fixtures/v6-preview-packing/reference.json.gz', import.meta.url))).toString('utf8'));
const events: Record<string, any>[] = [];
const owner = new NativePreviewPacking();
capturePreviewPacking(owner, events);
for (const row of fixture.sessions[0].steps) {
  // Only independently specified public inputs are consumed from the fixture.
  // No source state, source proposal, expected return or target enters owner.
  const proposal = await owner.propose(structuredClone(row.beforeObservation), structuredClone(row.beforePublic.frame_rows), structuredClone(row.inputs), row.remaining);
  if (!row.afterPublic) continue;
  if (!proposal || proposal.status !== 'proposed') throw new Error('Synthetic interface must produce its current source-qualified offer');
  owner.bind(proposal, new ObservedInputDomain(250));
  const command = structuredClone(proposal.actions[0]!);
  owner.before(proposal, 0, structuredClone(row.beforePublic), structuredClone(row.beforeObservation));
  owner.after(proposal, 0, structuredClone(row.beforeObservation), structuredClone(row.afterObservation), structuredClone(row.beforePublic.frame_rows), structuredClone(row.afterPublic.frame_rows));
  await owner.record(structuredClone(row.beforeObservation), structuredClone(row.afterObservation), command,
    structuredClone(row.beforePublic.frame_rows), structuredClone(row.afterPublic.frame_rows), proposal, 0);
  owner.restoreNative(owner.nativeState());
}
const report = { schema: 'sra.preview-packing-capture-reader-synthetic-qualification.v1', status: 'passed',
  referenceCommit: fixture.provenance.commit, origin: 'Declared synthetic public interface, direct native component, not a caller/game campaign',
  sourceFixtureScope: fixture.provenance.observationScope, gameExecution: false, nativeStateSeed: false,
  previewPackingEvents: events, prefixes: [] };
await writeFile(output, gzipSync(Buffer.from(JSON.stringify(report)+'\n')), { flag: 'wx' });
process.stdout.write(JSON.stringify({output, events: events.length, calls: events.filter(e => e.kind === 'call').length,
  restores: events.filter(e => e.kind === 'restore').length, status: 'captured', gameExecution: false})+'\n');
