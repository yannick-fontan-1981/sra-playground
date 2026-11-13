import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as slot from '../src/logos-engine/v6-slot-substitution.ts';
import * as word from '../src/logos-engine/v6-word-interface.ts';
import * as port from '../src/logos-engine/v6-port-assembly.ts';
import * as cover from '../src/logos-engine/v6-constellation-cover.ts';
import { measureRigidMarkerPoses } from '../src/logos-engine/v6-rigid-marker-pose.ts';
import { PointSet, type Point } from '../src/logos-engine/v6-point-set.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
const fixture = JSON.parse(readFileSync(new URL('./fixtures/v6-interface-families-reference.json', import.meta.url), 'utf8'));
const scene = (name: string): any => fixture.scenes[name];
const normalize = (value: any): any => {
  if (value instanceof PointSet) return value.sorted();
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, item]) => [String(key), normalize(item)]));
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
};
function portModel(value: any): port.PortModel { return { ...value, bodies: value.bodies.map((body: any) => ({ ...body, material: new PointSet(body.material), ports: new PointSet(body.ports) })) }; }
function coverModel(value: any): cover.ConstellationModel {
  return { ...value, targets: new Map(Object.entries(value.targets).map(([color, points]) => [Number(color), new PointSet(points as Point[])])),
    marker_rows: new Map(Object.entries(value.marker_rows).map(([color, rings]) => [Number(color), rings as any[]])),
    excluded: new PointSet(value.excluded), boundary_overlay: new PointSet(value.boundary_overlay), focus_occlusion: new PointSet(value.focus_occlusion),
    marker_raster: new Map(Object.entries(value.marker_raster).map(([key, value]) => { const point = key.slice(1, -1).split(',').map(Number) as unknown as Point; return [point.join(','), { point, value: value as number }]; })) };
}
function plainCoverModel(value: cover.ConstellationModel | null): any { return value && normalize({ ...value, marker_raster: Object.fromEntries([...value.marker_raster.values()].map(({ point, value }) => [`(${point[0]}, ${point[1]})`, value])) }); }
const body = (value: any): cover.ConstellationBody => ({ ...value, mask: new PointSet(value.mask) });
const samples = (items: any[]): cover.ConstellationSample[] => items.map(sample => ({ focus: sample.focus, material: new Map(Object.entries(sample.material).map(([color, points]) => [Number(color), new PointSet(points as Point[])])) }));

for (const item of fixture.cases) test(`${item.family}: ${item.id} matches unchanged Python`, async () => {
  const a = item.arguments, v = a.scene ? scene(a.scene) : undefined; let result: any;
  if (item.family === 'slot') {
    if (item.operation === 'layout') result = slot.measureSlotLayout(v.observation, v.rows);
    else if (item.operation === 'state') result = slot.readSlotState(v.rows, a.model);
    else if (item.operation === 'boundary') result = slot.slotBoundary(v.rows, a.box);
    else if (item.operation === 'command_at') result = slot.slotCommandAt(a.inputs, a.box);
    else throw new Error(item.operation);
  } else if (item.family === 'word') {
    if (item.operation === 'scene') result = await word.measureWordScene(v.observation, v.rows);
    else if (item.operation === 'glyphs') result = await word.wordGlyphs(v.rows, a.group, a.ink);
    else if (item.operation === 'focus') result = word.wordFocus(v.rows, a.group, a.cursor);
    else if (item.operation === 'edit_path') result = word.wordEditPath(new Map(Object.entries(a.graph).map(([key, edges]) => [key, new Map(Object.entries(edges as any)) as Map<string, string>])), a.start, a.goal);
    else if (item.operation === 'cursor_path') result = word.wordCursorPath(new Map(Object.entries(a.directions)) as Map<string, number>, a.start, a.target, a.n);
    else if (item.operation === 'visit_plan') result = word.wordVisitPlan(a.word, a.goal, a.at, new Map(Object.entries(a.edits).map(([key, edges]) => [key, new Map(Object.entries(edges as any)) as Map<string, string>])), new Map(Object.entries(a.directions)) as Map<string, number>);
    else throw new Error(item.operation);
  } else if (item.family === 'parser') {
    let progress: any = {}; result = [];
    for (const maximum of a.budgets) { const budget = new word.WordBudget(maximum), saved = structuredClone(progress); progress = {};
      const parsed = word.parseTypedWord(a.word, a.rules, a.inputType, a.outputType, a.maximumOutput, a.maximumParses, budget, progress, saved);
      result.push({ result: parsed, progress: structuredClone(progress), examined: budget.examined.toString(), reached: budget.reached }); }
  } else if (item.family === 'port') {
    const model = a.model ? portModel(a.model) : undefined;
    if (item.operation === 'layout') result = port.measurePortLayout(v.observation, v.rows);
    else if (item.operation === 'view') { const [material, ports, transform] = port.portView(new PointSet(a.material), new PointSet(a.ports), a.rotation); result = [material, ports, [...transform].map(([key, value]) => [key.split(',').map(Number), value])]; }
    else if (item.operation === 'neighbors') result = port.portNeighbors(a.point);
    else if (item.operation === 'cells') result = [...port.portCells(v.rows, model!).values()].map(row => [row.point, row.value]);
    else if (item.operation === 'placed') result = port.placedPorts(model!, a.index, a.pose);
    else if (item.operation === 'in_bounds') result = port.portInBounds(model!, new PointSet(a.points));
    else if (item.operation === 'infer_poses') result = port.inferPortPoses(v.rows, model!, a.previous, a.active);
    else if (item.operation === 'agrees') result = port.portAgreement(v.rows, model!, a.poses);
    else if (item.operation === 'compatible') result = port.compatiblePorts(model!, a.index, a.pose, new Map(a.already));
    else if (item.operation === 'assembly') result = port.assemblePorts(model!, a.current, a.active, a.rotationSign);
    else if (item.operation === 'constrained_assembly') result = { result: port.constrainedPortAssembly(model!, a.current, a.active, a.rotationSign), search_nodes: model!.search_nodes };
    else if (item.operation === 'access_path') result = port.portAccessPath(model!, a.current, a.index, a.target, new Map(Object.entries(a.motion)) as Map<string, Point>, a.allowOverlap);
    else throw new Error(item.operation);
  } else if (item.family === 'cover') {
    const model = a.model ? coverModel(a.model) : undefined, bodies = a.bodies?.map(body);
    if (item.operation === 'layout') result = plainCoverModel(cover.measureConstellationLayout(v.observation, v.rows));
    else if (item.operation === 'focus_loci') result = cover.constellationFocusLoci(v.rows, model!);
    else if (item.operation === 'focus') result = cover.constellationFocus(v.rows, model!);
    else if (item.operation === 'material') result = [...cover.constellationMaterial(v.rows, model!)];
    else if (item.operation === 'components') result = [...cover.constellationComponents(new PointSet(a.points))];
    else if (item.operation === 'acquire') result = cover.acquireConstellation(samples(a.samples), model!);
    else if (item.operation === 'body_pixels') result = cover.constellationBodyPixels(body(a.body), a.pose);
    else if (item.operation === 'outside') result = cover.constellationOutside(new PointSet(a.points), model!);
    else if (item.operation === 'within_envelope') result = cover.constellationWithinEnvelope(body(a.body), a.pose, a.point);
    else if (item.operation === 'agrees') result = cover.constellationAgreement(v.rows, model!, bodies, a.poses, a.cursor, a.active);
    else if (item.operation === 'mechanical_pose_options') { const measured = await cover.constellationMechanicalPoseOptions(v.observation, v.rows, bodies, a.poses, model!, a.quantum); result = measured && [...measured]; }
    else if (item.operation === 'joint_goal') result = cover.constellationJointGoal(bodies, a.poses, model!, a.quantum, a.options && new Map(a.options.map(([color, points]: any) => [color, points === null ? null : new PointSet(points)])));
    else if (item.operation === 'selection_effect') result = cover.constellationSelectionEffect(scene(a.first).rows, scene(a.second).rows, model!, a.old, a.new);
    else if (item.operation === 'cursor_at') result = cover.constellationCursorAt(v.rows, model!, a.expected, bodies, a.poses, a.active);
    else throw new Error(item.operation);
  } else if (item.family === 'rigid') result = await measureRigidMarkerPoses(a);
  else throw new Error(item.family);
  assert.deepEqual(normalize(result), item.expected);
});

const constructors: Record<string, new () => any> = { slot: slot.SlotSubstitution, word: word.WordInterface, port: port.PortAssembly, cover: cover.ConstellationCover };
for (const scenario of fixture.scenarios) test(`${scenario.family}: complete journal ${scenario.id} survives each graph restore`, async () => {
  const Constructor = constructors[scenario.family]!; let memory = new Constructor(), proposal: any = null, domain: ObservedInputDomain | null = null;
  for (const [ordinal, step] of scenario.steps.entries()) {
    const op = step.operation; let result: any = null;
    if (op.kind === 'seed') { memory = new Constructor(); memory.restore(op.state); proposal = op.proposal; }
    else if (op.kind === 'propose') { const v = scene(op.scene); domain = new ObservedInputDomain(4096); const inputs = domain.candidates(v.observation); proposal = await memory.propose(v.observation, v.rows, op.inputs ?? inputs, op.remaining ?? 100); result = proposal; }
    else if (op.kind === 'bind') { await memory.bind(proposal, domain); result = proposal; }
    else if (op.kind === 'before') result = await memory.before(proposal, op.index ?? 0, scene(op.scene).public, scene(op.observation ?? op.scene).observation);
    else if (op.kind === 'after' || op.kind === 'record') {
      const b = scene(op.before), a = scene(op.after), index = op.index ?? 0;
      result = op.kind === 'after' ? await memory.after(proposal, index, b.observation, a.observation, b.rows, a.rows)
        : await memory.record(b.observation, a.observation, op.command ?? proposal.actions[index], b.rows, a.rows, proposal, index);
    } else if (op.kind === 'proposal') { proposal = structuredClone(op.proposal); result = proposal; }
    else throw new Error(`Unknown operation ${op.kind}`);
    assert.deepEqual(normalize(result), step.expected.result, `${ordinal} ${op.kind}: result`);
    assert.deepEqual(memory.state(), step.expected.state, `${ordinal} ${op.kind}: retained state`);
    const saved = JSON.parse(JSON.stringify(memory.state())); memory = new Constructor(); memory.restore(saved);
    assert.deepEqual(memory.state(), saved, `${ordinal} ${op.kind}: round trip`);
  }
});
test('source hashes are pinned and every routine in the four family modules executed', () => {
  const prefix = `../reference/v6/${fixture.provenance.commit}/source/`;
  for (const [path, expected] of Object.entries(fixture.provenance.sourceHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(prefix + path, import.meta.url))).digest('hex'), expected, path);
  const routines = { slot: ['boundary','layout','expand','state','command_at','__init__','propose','bind','before','after','record'],
    word: ['glyphs','focus','scene','edit_path','cursor_path','visit_plan','__init__','read','propose','bind','before','after','record'],
    port: ['neighbors','view','layout','cells','placed','in_bounds','observed_agrees','agrees','infer_poses','cost','update_ports','compatible','assembly','visit','constrained_assembly','access_path','__init__','propose','bind','before','after','record'],
    cover: ['plus','minus','layout','focus_loci','focus','cursor_at','material','components','acquire','body_pixels','outside','within_envelope','agrees','selection_effect','mechanical_pose_options','joint_goal','__init__','propose','bind','before','after','record'],
    parser: ['parse_typed_word','save','__init__','take'], rigid: ['measure_rigid_marker_poses','bounded_point','placed','incompatible_pixels','covered_by_one_row_and_column'] };
  for (const [module, names] of Object.entries(routines)) for (const name of names) assert(fixture.coveredFunctions[module].includes(name), `${module}.${name}`);
});
