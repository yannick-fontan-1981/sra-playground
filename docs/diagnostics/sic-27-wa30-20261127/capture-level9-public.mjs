import { appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.env.SIC_REPLAY_CHILD === '1') {
  const output = join(process.env.WA30_PROBE_DIRECTORY, 'level9-public.jsonl');
  const { NativeV6Runtime } = await import(pathToFileURL(resolve('src/logos-engine/v6-native-runtime.ts')));
  const probeEpoch = 9;
  const watched = new Set(['sic_verify_oriented_delivery', 'sic_learn_oriented_delivery']);
  const append = (kind, details) => appendFileSync(output, JSON.stringify({ kind, ...details }) + '\n');

  const initialize = NativeV6Runtime.prototype.initialize;
  NativeV6Runtime.prototype.initialize = function (...args) {
    for (const family of this.families.filter(family => watched.has(family.id))) {
      const propose = family.propose;
      family.propose = async function (observation, rows, inputs, remaining, execution) {
        const answer = await propose.call(this, observation, rows, inputs, remaining, execution);
        if (observation.level_epoch === probeEpoch) {
          const owner = this.state();
          append('owner-proposal', { family: this.id, observation, owner, remaining,
            reasonMode: execution?.reasoningMode, answer: answer && {
              actions: answer.actions, binding: answer.binding, reason: answer.sicSituationCard?.situation,
              route: answer.step, peerGuard: !!answer.peerGuard, walk: answer.walk?.length,
              sectorNetwork: !!answer.local?.sectorNetwork,
            } });
        }
        return answer;
      };
    }
    return initialize.apply(this, args);
  };

  const advance = NativeV6Runtime.prototype.advance;
  NativeV6Runtime.prototype.advance = async function (outcome, execution) {
    if (outcome.observation.level !== probeEpoch && this.current?.level !== probeEpoch)
      return advance.call(this, outcome, execution);
    const prior = this.observation;
    const chosen = this.prefix;
    append('executed-public-return', {
      before: prior?.observation_ref, command: outcome.command, index: chosen?.index, family: chosen?.family.id,
      planBinding: chosen?.proposal.binding, situation: chosen?.proposal.sicSituationCard?.situation,
      observation: outcome.observation,
    });
    const result = await advance.call(this, outcome, execution);
    if (prior?.level_epoch !== probeEpoch) {
      append('level-entry', { observation: this.observation, families: this.families
        .filter(family => watched.has(family.id)).map(family => ({ family: family.id, owner: family.state() })) });
    }
    return result;
  };
}
