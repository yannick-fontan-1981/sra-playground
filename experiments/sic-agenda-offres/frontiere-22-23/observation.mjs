import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const slot = Symbol.for('sic.experiment.frontier.pre');
const marker = 'const agenda = usesAgenda ? selectFrontierStrategy(localQuestion, route, frontierRef(observation)) : null;';

// L'appel est inséré dans le processus d'expérience, juste avant le résolveur.
// La sonde ne reçoit que des copies de valeurs déjà calculées.
export function observeFrontier(receive, root = new URL('../../../', import.meta.url), { includeRanking = false } = {}) {
  const url = new URL('src/logos-engine/v6-observed-frontier.ts', root).href;
  globalThis[slot] = (pre, ranking) => {
    const payload = JSON.stringify(pre);
    receive({ payload, sha256: digest(pre) }, structuredClone(ranking));
  };
  return registerHooks({ load(request, context, next) {
    const loaded = next(request, context);
    if (request !== url) return loaded;
    const source = loaded.source.toString();
    assert.equal(source.split(marker).length, 2, 'coupe native unique requise');
    const tap = `if (usesConfigurableOrder && options.sic_frontier) {
      const questionFields = q => q ? { ref: q.question_ref, context: q.context_index, action: q.action } : null;
      globalThis[Symbol.for('sic.experiment.frontier.pre')]({
        observation: current.observation_ref, index, epoch: protocol.level_epoch, frame: protocol.frame_hash,
        sequence: this.sequence, graphChain: this.chain, inputOrder: order,
        local: questionFields(localQuestion),
        domain: Object.entries(this.nodes[index].actions).map(([key, command]) => ({
          command, tried: this.nodes[index].attempts[key]?.evidence_refs ?? []
        })),
        routeStatus: access === null ? 'unqueried' : route ? 'found' : 'exhausted',
        remote: questionFields(route?.question),
        path: (route?.path ?? []).map(e => ({
          ref: e.edge_id, source: e.source, target: e.target, action: e.action, witnesses: e.evidence_refs
        }))
      }, ${includeRanking ? `{
        questions: questions.map(q => ({ ref: q.question_ref, priority: q.priority, reason: q.reason,
          command: q.action, trialsHere: q.input_trials_at_context })),
        alternatives: ranked ? { leastTried: ranked.leastTried.question_ref,
          commandOrder: ranked.commandOrder.question_ref, usageGap: ranked.usageGap } : null
      }` : 'null'});
    }`;
    return { ...loaded, source: source.replace(marker, tap + '\n    ' + marker) };
  } });
}
