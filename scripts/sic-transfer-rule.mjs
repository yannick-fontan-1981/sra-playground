export function cycleHypotheses(samples, equal = Object.is) {
  const models = [];
  for (let length = 2; length * 3 < samples.length; length++) {
    for (let start = 1; start + length * 3 <= samples.length; start++) {
      // Canonical onset is just after a witnessed incompatible observation.
      const previous = samples[start - 1];
      if (previous === null) continue;
      const phases = Array(length).fill(null), witnesses = Array(length).fill(0);
      const prediction = Array(length).fill(0);
      let consistent = true;
      for (let i = start; i < samples.length; i++) {
        if (samples[i] === null) continue;
        const at = (i - start) % length;
        if (witnesses[at] && !equal(phases[at], samples[i])) {
          consistent = false;
          break;
        }
        phases[at] = samples[i];
        if (++witnesses[at] > 2 && i - start >= length * 2) prediction[at]++;
      }
      if (!consistent || prediction.some(count => !count) || equal(previous, phases.at(-1))
        || phases.every(value => equal(value, phases[0]))) continue;
      let prefixConflicts = 0;
      for (let i = Math.max(0, start - length); i < start; i++) {
        if (samples[i] !== null && !equal(samples[i], phases[(i - start + length) % length])) prefixConflicts++;
      }
      models.push({ start, phases, witnesses, features: {
        onset: start, period: length, prefixConflicts, minimumWitnesses: Math.min(...witnesses),
        coverage: Math.floor(10 * witnesses.reduce((a, b) => a + b, 0) / (samples.length - start)),
      } });
    }
  }
  return models;
}

export function accepts(model, conditions) {
  return conditions.every(({ feature, op, value }) => op === '<='
    ? model.features[feature] <= value : model.features[feature] >= value);
}

export function predictCycle(samples, equal, rule) {
  const accepted = cycleHypotheses(samples, equal).filter(model => accepts(model, rule.conditions));
  const first = accepted[0];
  if (!first) return;
  // Multiple plausible models may share samples and still disagree on what comes next.
  const horizon = Math.max(...accepted.map(model => model.phases.length)) * 2;
  for (const model of accepted.slice(1)) {
    for (let index = samples.length; index < samples.length + horizon; index++) {
      if (!equal(first.phases[(index - first.start) % first.phases.length],
        model.phases[(index - model.start) % model.phases.length])) return;
    }
  }
  const { start, phases, witnesses } = first;
  return { start, phases, witnesses };
}
