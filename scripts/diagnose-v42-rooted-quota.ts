/** Saved-public-evidence diagnosis only. No game host, action or agent campaign. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { measureRootedQuota, measureRootedLengths } from '../src/logos-engine/v6-rooted-quota-observation.ts';
import { propagateRootedQuota } from '../src/logos-engine/v6-rooted-quota-mechanics.ts';
import { RootedQuotaMemory } from '../src/logos-engine/v6-rooted-quota-access.ts';
import { symbolicDigest } from '../src/logos-engine/v6-hash.ts';

type R = Record<string, any>;
const root = fileURLToPath(new URL('../', import.meta.url));
const reportPath = 'docs/migration/native-campaigns-v42/ther-four-levels.json';
const tracePath = 'docs/migration/native-campaigns-v42/ther-four-level-public-trace.json.gz';
const fixturePath = 'tests/fixtures/v6-rooted-quota-reference.json.gz';
const outputPath = 'docs/migration/native-campaigns-v42/diagnostics/ther-level-five-quota-diagnosis.json';
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const read = (path: string) => readFile(new URL(path, new URL('../', import.meta.url)));
const reportBytes = await read(reportPath), traceBytes = await read(tracePath), fixtureBytes = await read(fixturePath);
const report: R = JSON.parse(reportBytes.toString()), trace: R = JSON.parse(gunzipSync(traceBytes).toString());
const fixture: R = JSON.parse(gunzipSync(fixtureBytes).toString());
assert.equal(report.status, 'passed'); assert.equal(report.final.levelsCompleted, 4);
assert.equal(report.sourceUnchangedDuringRun, true); assert.equal(report.source.digest, trace.sourceDigest);
const packetIndex = report.final.actions, packet = trace.packets[packetIndex].packet;
assert.equal(packet.level, 5); assert.equal(packet.levels_completed, 4);
const prefix = report.prefixes.find((item: R) => item.callerAcquiredTransitions === packetIndex);
const acquiredEvent = prefix.sharedSeries.rootedQuotaLatestState, model = acquiredEvent.model;
assert.equal(acquiredEvent.kind, 'rooted_quota_state'); assert.equal(acquiredEvent.stop_reason, null);
assert.equal(prefix.sharedSeries.rootedQuotaStateCount, packetIndex);
assert.equal(hash(JSON.stringify(packet)), report.actions.at(-1).publicPacketSha256);
const nativeHashes: R = {};
for (const [path, expected] of Object.entries(report.source.files)) {
  nativeHashes[path] = hash(await read(path)); assert.equal(nativeHashes[path], expected, path);
}
const observation = { level_epoch: packet.level, levels_completed: packet.levels_completed,
  observation_ref: acquiredEvent.evidence.at(-1), frame_hash: packet.frame_hash, state: packet.state,
  available_action_refs: packet.available_action_refs };
const rows = packet.frame_rows, scene = measureRootedQuota(rows, model.empty_palette);
assert.ok(scene); const lengths = measureRootedLengths(rows, scene, model); assert.ok(lengths);
const mechanical = propagateRootedQuota(scene, observation, model, 300000, () => 0);
const memory = new RootedQuotaMemory(); memory.applyEvent(acquiredEvent);
const proposal = memory.proposeRooted(observation, rows, [], 16, fixture.policy, 300000, () => 0);

// Execute only the pinned Python observation/mechanics/access component functions.
// The current model is extracted from a real acquired event, not fabricated.
const python = String.raw`
import copy,hashlib,json,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
payload=json.load(sys.stdin)
root=Path(payload['root']);commit=payload['commit'];source=root/'reference/v6'/commit/'source'
sys.path[:0]=[str(source),str(source/'agents/yf_arc3_v6/laya_proto')]
from rooted_chain_observation import scene
from rooted_quota_access import RootedQuotaAccess,lengths
from rooted_quota_methods import propagate,plain
manifest=json.loads((source.parent/'manifest.json').read_text())['files']
def source_hashes():
 out={}
 for module in list(sys.modules.values()):
  if not getattr(module,'__file__',None):continue
  path=Path(module.__file__).resolve()
  if path.is_relative_to(source) and path.is_file():
   key=str(path.relative_to(source));digest=hashlib.sha256(path.read_bytes()).hexdigest()
   assert manifest[key]['sha256']==digest,key
   out[key]=digest
 return dict(sorted(out.items()))
before=source_hashes();event=payload['event'];obs=payload['observation'];rows=payload['rows']
model=copy.deepcopy(event['model']);geometry=scene(rows,model.get('empty_palette'))
current=lengths(rows,geometry,model) if geometry is not None else None
result=propagate(geometry,obs,model,time.perf_counter()+300) if current is not None else None
memory=RootedQuotaAccess();memory.apply_event(copy.deepcopy(event))
question=memory.propose([],obs,rows,[],16,{**payload['policy'],'level_deadline':time.perf_counter()+300})
after=source_hashes()
assert all(after.get(path)==digest for path,digest in before.items())
print(json.dumps({'scene':plain(geometry),'lengths':plain(current),'mechanical':plain(result),
 'proposal':plain(question),'sourceHashes':after,'sourceUnchanged':True,'sourceModified':False,
 'gameHostRun':False,'scope':'Pinned component calls on one saved public packet and acquired model; not a full caller replay.'}))
`;
const original: R = JSON.parse(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON ?? 'python', ['-c', python], {
  cwd: root, input: JSON.stringify({ root, commit: report.referenceCommit, event: acquiredEvent, rows, observation, policy: fixture.policy }),
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
}));
for (const [key, actual] of Object.entries({ scene, lengths, mechanical, proposal })) assert.deepEqual(actual, original[key], key);

// Image-only audit of matching aligned mark units over the whole visible margin.
// This candidate is not installed as perception, and no resulting command is run.
function components(raster: number[][]): R[] {
  const seen = new Set<string>(), out: R[] = [], height = raster.length, width = raster[0]!.length;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (seen.has(`${x},${y}`)) continue;
    const color = raster[y]![x], stack = [[x, y]], points: number[][] = []; seen.add(`${x},${y}`);
    while (stack.length) {
      const [a, b] = stack.pop()!; points.push([a!, b!]);
      for (const [nx, ny] of [[a! - 1, b!], [a! + 1, b!], [a!, b! - 1], [a!, b! + 1]]) {
        const key = `${nx},${ny}`;
        if (nx! >= 0 && ny! >= 0 && nx! < width && ny! < height && !seen.has(key) && raster[ny!]![nx!] === color) {
          seen.add(key); stack.push([nx!, ny!]);
        }
      }
    }
    const xs = points.map(p => p[0]!), ys = points.map(p => p[1]!);
    out.push({ color, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], area: points.length });
  }
  return out;
}
const parts = components(rows), axes: R[] = [];
for (const axis of [0, 1]) {
  const lines = axis === 0 ? scene.y_lines : scene.x_lines, pitch = lines[1] - lines[0];
  const edge = axis === 0 ? scene.bbox[0] : scene.bbox[1], shape = scene.mark_unit_shapes[axis];
  const groups: R[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const mid = Math.floor((lines[i] + lines[i + 1]) / 2);
    const units = parts.filter(part => {
      const [l, t, r, b] = part.bbox;
      return part.area === shape[0] * shape[1] && r - l + 1 === shape[0] && b - t + 1 === shape[1]
        && (axis === 0 ? r < edge && Math.abs((t + b) / 2 - mid) < pitch / 4
          : b < edge && Math.abs((l + r) / 2 - mid) < pitch / 4);
    });
    const inside = units.filter(unit => (axis === 0 ? unit.bbox[0] : unit.bbox[1]) >= edge - pitch);
    const outside = units.filter(unit => !inside.includes(unit));
    assert.equal(inside.length, (axis === 0 ? scene.row_marks : scene.column_marks)[i]);
    assert.equal(new Set(units.map(unit => unit.color)).size, 1);
    groups.push({ index: i, alignmentCenter: mid, measuredCount: inside.length, visibleAlignedUnitCount: units.length,
      units, omittedByOnePitchBand: outside });
  }
  axes.push({ axis: axis === 0 ? 'row' : 'column', gridPitch: pitch, gridEdge: edge,
    nativeBandMinimum: edge - pitch, groups });
}
const candidateScene = structuredClone(scene);
candidateScene.row_marks = axes[0]!.groups.map((group: R) => group.visibleAlignedUnitCount);
candidateScene.column_marks = axes[1]!.groups.map((group: R) => group.visibleAlignedUnitCount);
delete candidateScene.geometry_ref; candidateScene.geometry_ref = symbolicDigest(candidateScene);
const candidateMechanical = propagateRootedQuota(candidateScene, observation, model, 300000, () => 0);
const certificates = mechanical.values.removal_certificates;
const empty = mechanical.values.chain_refs.filter((_: string, i: number) => mechanical.values.retained_domains[i].length === 0);
const diagnosis: R = {
  schema: 'logos-engine.rooted-quota-saved-public-diagnosis.v1', status: 'passed',
  generator: 'scripts/diagnose-v42-rooted-quota.ts',
  generatorSha256: hash(await read('scripts/diagnose-v42-rooted-quota.ts')),
  scope: 'Read-only source/native component diagnosis. No game host, new action, production edit or campaign claim.',
  inputs: { report: { path: reportPath, sha256: hash(reportBytes) }, publicTrace: { path: tracePath, sha256: hash(traceBytes) },
    policyFixture: { path: fixturePath, sha256: hash(fixtureBytes) }, packetIndex,
    packetSha256: hash(JSON.stringify(packet)), observation,
    prefixId: prefix.id, acquiredTransitionCount: prefix.callerAcquiredTransitions,
    acquiredStateCount: prefix.sharedSeries.rootedQuotaStateCount, acquiredEvent },
  nativeSource: { campaignDigest: report.source.digest, verifiedFileCount: Object.keys(nativeHashes).length, files: nativeHashes },
  pinnedOriginal: { commit: report.referenceCommit, verifiedFileCount: Object.keys(original.sourceHashes).length,
    sourceHashes: original.sourceHashes, sourceUnchanged: original.sourceUnchanged, sourceModified: false, gameHostRun: false,
    scope: original.scope },
  exactComponentParity: { scene: true, lengths: true, completeMechanicalReceipt: true, abstention: true },
  originalComponent: { scene: original.scene, lengths: original.lengths, mechanical: original.mechanical, proposal: original.proposal },
  nativeComponent: { scene, lengths, mechanical, proposal },
  diagnosis: { measurementSucceeded: true, prefixLengthsValid: true, learnedAddition: model.addition_observed,
    learnedCut: model.cut_observed, failure: mechanical.cause,
    notMerelyNonsingleton: true, computationComplete: mechanical.domain_complete,
    emptyChains: empty,
    emptyChainCertificates: certificates.filter((item: R) => empty.includes(item.chain_ref)),
    participatingQuotaRefs: [...new Set(certificates.map((item: R) => item.quota_ref))],
    participatingChainRefs: [...new Set(certificates.map((item: R) => item.chain_ref))],
    interpretation: 'The complete conditional propagation contradicts the measured quotas. The access wrapper reports its broader not-singleton refusal; this is not a time/node interruption or a missing learned edit law.' },
  publicPixelAudit: { method: 'Count rectangular units with the measured unit shape and alignment over the visible left/top margin; use no hidden clue value.', axes,
    finding: 'One matching visible unit is omitted on the third row and third column by the source one-grid-pitch band.' },
  analyticCandidateOnly: { installed: false, executedGameActions: 0,
    qualification: 'A measured wider reading is tested against the unchanged propagator only. Its semantic assumptions still require guarded public validation; this is not a solved level.',
    rowMarks: candidateScene.row_marks, columnMarks: candidateScene.column_marks, mechanical: candidateMechanical },
  nextGenericCapability: 'Acquire an explicit observation-support boundary and detect aligned repeated units continuing beyond it; enlarge and revalidate the grouped mark support under shape/spacing/colour/axis constraints, retaining alternatives and a refutation if ownership is ambiguous. Recompute conditional quotas before allowing guarded actions. Keep the faithful source path and this native perception extension separately identified.',
};
await mkdir(new URL('docs/migration/native-campaigns-v42/diagnostics/', new URL('../', import.meta.url)), { recursive: true });
await writeFile(new URL(outputPath, new URL('../', import.meta.url)), JSON.stringify(diagnosis, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, exactComponentParity: diagnosis.exactComponentParity,
  sourceFileHashes: diagnosis.pinnedOriginal.verifiedFileCount, cause: mechanical.cause, emptyChains: empty,
  visibleRows: candidateScene.row_marks, visibleColumns: candidateScene.column_marks,
  candidateStatus: candidateMechanical.status, candidateCause: candidateMechanical.cause,
  candidateSingleton: candidateMechanical.values.all_domains_singleton }, null, 2));
