import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_SKBN_ENGINE_ROOT: root, SIC_SKBN_RECEIPT: output } = process.env;
const load = name => import(pathToFileURL(resolve(root, 'src', name)));
const { ObservedInventory } = await load('logos-engine/v6-observed-inventory.ts');
const { V6AgentService } = await load('runtime/v6-agent-service.ts');
const sessions = [];
let acquired;

const recordSource = ObservedInventory.prototype.recordSource;
ObservedInventory.prototype.recordSource = function (...args) {
  const count = this.access_returns.length;
  const result = recordSource.apply(this, args);
  if (args[5]?.inventory_plan) {
    acquired.push({ before: args[0].observation_ref, after: args[1].observation_ref, status: result?.status,
      evidence: result?.evidence, dependencyReturn: result?.dependency_return,
      accessCount: [count, this.access_returns.length], retainedEffect: this.retained_effect_scope });
  }
  return result;
};

const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') sessions.push([]);
  acquired = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const o = message.observation, r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      owner: r?.family, reason: r?.reason, levels: o.levelsCompleted, acquired,
      packet: createHash('sha256').update(JSON.stringify(o)).digest('hex') });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, offer = p.inventory_plan?.offer;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, level: t.level, id: t.id, ref: t.observationRef,
      owner: snapshot.lastDecision, action: t.actionRef, point: t.data, offer: offer?.kind ?? p.kind,
      endpointRole: offer?.target?.endpoint_role, endpoint: offer?.target?.source_bbox,
      refs: p.route_refs, controlRefs: offer?.route.prefix[0]?.control.evidence });
  }
  return reply;
};

process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
