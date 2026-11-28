import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { SIC_TN36_ENGINE_ROOT: root, SIC_TN36_RECEIPT: output } = process.env;
const load = name => pathToFileURL(resolve(root, 'src', name)).href;
const provider = load('logos-engine/v6-code-program.ts');
const calls = new Map();
const key = Symbol.for('sic.bench.tn36.paths');
globalThis[key] = (ref, position, goal, count, effects, tried, paths) => {
  calls.set(ref, { position, goal, count, effects: [...effects].map(([word, vector]) => [word.toString(), vector]),
    tried: [...tried].sort(), candidates: paths.length, firstPaths: paths.slice(0, 4) });
};
const original = 'for (const encoded of physicalCodePaths(board, position, code.length, this.effects)) {';
const hook = registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (url !== provider) return loaded;
  const text = loaded.source.toString();
  assert.equal(text.split(original).length, 2, 'one production call to physicalCodePaths');
  return { ...loaded, source: text.replace(original,
    `const measuredPaths = physicalCodePaths(board, position, code.length, this.effects);
      globalThis[Symbol.for('sic.bench.tn36.paths')](observation.observation_ref, position, board.goal, code.length, this.effects, this.demoTried, measuredPaths);
      for (const encoded of measuredPaths) {`) };
}});
const { CodeProgram } = await import(provider);
hook.deregister();
const { V6AgentService } = await import(load('runtime/v6-agent-service.ts'));
let observations;
const record = CodeProgram.prototype.record;
CodeProgram.prototype.record = function (...args) {
  const reply = record.apply(this, args);
  observations.push({ ref: reply.ref, samples: reply.measured, preserved: reply.preserved_actual_world,
    status: reply.status, effects: this.effects.size, attempts: this.executed.size, demonstration: [...this.demoTried].sort() });
  return reply;
};
const sessions = [];
const handle = V6AgentService.prototype.handle;
V6AgentService.prototype.handle = async function (message) {
  if (message.type === 'init') { sessions.push([]); calls.clear(); }
  observations = [];
  const reply = await handle.call(this, message);
  const rows = sessions.at(-1), snapshot = reply.snapshot;
  if (message.type === 'advance') {
    const r = snapshot.trace.findLast(e => e.kind === 'actual_outcome');
    rows.push({ kind: 'return', turn: message.sequence, ref: r?.observation_ref, matched: r?.matched,
      reason: r?.reason, frames: message.observation.frames.length,
      frame: createHash('sha256').update(JSON.stringify(message.observation.frame)).digest('hex'),
      levels: message.observation.levelsCompleted, observations });
  }
  if (reply.ticket) {
    const t = reply.ticket, p = snapshot.proposal, step = p.steps[t.actionIndex], plan = p.code_plan;
    rows.push({ kind: 'ticket', turn: message.sequence + 1, id: t.id, ref: t.observationRef, level: t.level, owner: snapshot.lastDecision,
      action: t.actionRef, point: t.data, mode: step.mode, example: step.example, code: step.code, want: plan.desired_codes,
      expected: step.expected_after, position: step.position, operators: plan.locally_observed_operators, refs: p.question.hypothesis_refs,
      guard: snapshot.trace.findLast(e => e.kind === 'before_guard')?.reason, pathCall: calls.get(t.observationRef) });
  }
  return reply;
};
process.on('exit', () => { if (sessions.length) writeFileSync(output, JSON.stringify(sessions) + '\n', { flag: 'wx' }); });
