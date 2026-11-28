import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mock } from 'node:test';

const [checkout, label, condition, vendor, output] = process.argv.slice(2);
assert.ok(['gel', 'candidat'].includes(label));
assert.ok(['nominal', 'sans-trajet', 'sans-question'].includes(condition));
const revision = 'be816a3f09e7b36d9393aaead8d835d9dc3850c5';
const git = (...args) => execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), revision);
git('diff', '--exit-code', 'HEAD', '--', 'src', 'experiments');
const root = pathToFileURL(resolve(checkout) + sep);
const lab = new URL('experiments/sic-agenda-offres/', root);
const { play, readCard } = await import(new URL('regn-22/operateur.mjs', lab));
const { withEngine, versions } = await import(new URL('moteur-reference.mjs', lab));
const card = await readCard(new URL('regn-22/public/reprise.json', lab));
const question = 'Q_8b45c6cdc354b85cd0a2';
const target = 'frontier-qualification:epoch:3:revision:16:frame:af0bcad41eef9c48';
const interventions = [], boundaries = [];
const candidateRoot = process.env.SIC_REGN_ENGINE_ROOT;
let source = label === 'gel' ? versions.gel : revision;
if (candidateRoot) {
  assert.equal(label, 'candidat');
  const inspect = (...args) => execFileSync('git', ['-C', candidateRoot, ...args], { encoding: 'utf8' }).trim();
  source = inspect('rev-parse', 'HEAD');
  inspect('diff', '--exit-code', 'HEAD', '--', 'src', 'public/python', 'reference');
}
const run = candidateRoot ? fn => fn(pathToFileURL(resolve(candidateRoot) + sep)) : fn => withEngine(label, fn);
const game = await run(async engine => {
  const { NativeCallerCoordinator } = await import(new URL('src/logos-engine/v6-native-caller.ts', engine));
  const { V6AgentService } = await import(new URL('src/runtime/v6-agent-service.ts', engine));
  const handle = V6AgentService.prototype.handle;
  const service = mock.method(V6AgentService.prototype, 'handle', async function (message) {
    const reply = await handle.call(this, message);
    if (message.sequence >= 15) {
      const refusal = reply.snapshot?.proposal?.sic_frontier_refusal;
      boundaries.push({ call: message.type, sequence: message.sequence, kind: reply.kind, reason: reply.reason,
        ticket: reply.ticket?.id, action: reply.ticket?.actionRef, refusal });
    }
    return reply;
  });
  const offer = NativeCallerCoordinator.prototype.frontierOffer;
  const caller = mock.method(NativeCallerCoordinator.prototype, 'frontierOffer', async function (obs, inputs) {
    if (obs.observation_ref !== target) return offer.call(this, obs, inputs);
    const graph = this.frontier;
    const access = graph.access, open = graph.open;
    const evidence = { observation: obs.observation_ref, questions: [], routes: [] };
    const opens = mock.method(graph, 'open', async function (...args) {
      const available = await open.apply(this, args);
      const refs = available.map(q => q.question_ref);
      const offered = condition === 'sans-question' ? available.filter(q => q.question_ref !== question) : available;
      evidence.questions.push({ at: args[0], available: refs, offered: offered.map(q => q.question_ref) });
      return offered;
    });
    const routes = mock.method(graph, 'access', async function (...args) {
      const [path, destination] = await access.apply(this, args);
      evidence.routes.push({ path: path?.map(e => ({ edge: e.edge_id, witnesses: e.evidence_refs, command: e.action })),
        question: destination?.question_ref });
      return condition === 'sans-trajet' ? [null, null] : [path, destination];
    });
    try {
      const p = await offer.call(this, obs, inputs);
      evidence.offered = { status: p.status, kind: p.kind, actions: p.actions, need: p.sic_frontier_decision?.need,
        refusal: p.sic_frontier_refusal };
      interventions.push(evidence);
      return p;
    } finally { routes.mock.restore(); opens.mock.restore(); }
  });
  try { return await play(engine, card, resolve(vendor)); }
  finally { caller.mock.restore(); service.mock.restore(); }
});
assert.ok(interventions.length > 0);
assert.ok(interventions.every(i => i.routes.length && i.questions.some(q => q.available.includes(question))));
await writeFile(output, JSON.stringify({ source, condition, card, interventions, boundaries, game }) + '\n');
