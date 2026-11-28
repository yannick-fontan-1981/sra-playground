import { delays, exits, windows } from './terrain.mjs';

export function initialModels(rules) {
  const models = [];
  for (const control of rules.controls) for (const delay of delays) for (const window of windows) for (const destination of exits) {
    models.push({ control, delay, window, destination, pending: 0, allowance: 0, spent: false });
  }
  return models;
}

// The planner projects from public possibilities. The terrain alone chooses and executes the actual world.
function projection(rules, observation, action, model) {
  let { pending, allowance, spent } = model;
  let { position, target, outcome } = observation;
  if (action === 'inspect' && (rules.visibility === 'start' && position === 0
    || rules.visibility === 'gate' && position === rules.approach && allowance > 0)) target = model.destination;
  if (exits.includes(action) && position === rules.approach && allowance > 0) {
    outcome = action === model.destination ? 'win' : 'loss';
  }
  if (action === 'advance') position = Math.min(rules.approach, position + 1);
  if (action === model.control && pending === 0 && allowance === 0
    && (rules.mechanic === 'pulse' || !spent && position === 0)) {
    pending = model.delay + 1;
    spent = rules.mechanic === 'load';
  }
  if (allowance > 0) allowance--;
  if (pending > 0 && --pending === 0) allowance = model.window;
  return {
    next: { ...model, pending, allowance, spent },
    observed: { position, open: allowance > 0, target, outcome, ...(rules.armingSignal ? { armed: spent } : {}) },
  };
}

export function observationKey({ position, open, target, outcome, armed }) {
  return [position, +open, target ?? '', outcome ?? '', armed ?? ''].join('/');
}

export function transitions(rules, observed, models, action) {
  const byObservation = new Map();
  for (const model of models) {
    const result = projection(rules, observed, action, model);
    const key = observationKey(result.observed);
    const existing = byObservation.get(key);
    if (existing) existing.models.push(result.next);
    else byObservation.set(key, { observed: result.observed, models: [result.next] });
  }
  return byObservation;
}

export function stateKey(observed, models) {
  return observationKey(observed) + ':' + models.map(model =>
    [model.control, model.delay, model.window, model.destination, model.pending, model.allowance, +model.spent]).map(JSON.stringify).join('');
}
