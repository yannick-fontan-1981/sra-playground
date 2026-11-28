export const navigation = ['advance', 'inspect', 'wait', 'left', 'right'];
export const delays = [1, 2];
export const windows = [3, 4, 5];
export const exits = ['left', 'right'];

const between = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function scenario(spec) {
  const { id, mechanic, controls, control, delay, window, approach, target, visibility, moveBudget, searchBudget, armingSignal = false } = spec;
  const markers = spec.controlMarkers;
  if (typeof id !== 'string' || !id || !['pulse', 'load'].includes(mechanic)
    || !Array.isArray(controls) || !between(controls.length, 2, 3) || new Set(controls).size !== controls.length
    || controls.some(code => typeof code !== 'string' || !code || navigation.includes(code))
    || !controls.includes(control) || !delays.includes(delay) || !windows.includes(window)
    || ![1, 2].includes(approach) || !exits.includes(target) || !['start', 'gate', 'never'].includes(visibility)
    || typeof armingSignal !== 'boolean' || armingSignal && mechanic !== 'load'
    || !between(moveBudget, 6, 12) || !between(searchBudget, 1000, 12000)) {
    throw new Error('Invalid scenario: ' + id);
  }
  if (markers !== undefined && (markers === null || typeof markers !== 'object' || Array.isArray(markers)
    || Object.keys(markers).length !== controls.length
    || controls.some(code => !Object.hasOwn(markers, code) || typeof markers[code] !== 'string' || !markers[code]))) {
    throw new Error('Invalid public control markers: ' + id);
  }
  const rules = Object.freeze({ mechanic, controls: Object.freeze([...controls]), approach, visibility, moveBudget, searchBudget,
    ...(armingSignal ? { armingSignal } : {}), ...(markers ? { controlMarkers: Object.freeze({ ...markers }) } : {}) });
  let tick = 0, position = 0, opening = Infinity, reveal = null, outcome = null, armed = false;
  const open = () => tick >= opening && tick < opening + window;
  const read = () => ({ position, open: open(), target: reveal, outcome, ...(armingSignal ? { armed } : {}) });
  return {
    rules,
    read,
    step(action) {
      if (outcome || tick >= moveBudget || ![...navigation, ...controls].includes(action)) throw new Error('Unavailable action: ' + action);
      if (action === control && (opening === Infinity || tick >= opening + window)
        && (mechanic === 'pulse' || !armed && position === 0)) {
        opening = tick + 1 + delay;
        armed = true;
      }
      if (action === 'advance') position = Math.min(approach, position + 1);
      if (action === 'inspect' && (visibility === 'start' && position === 0
        || visibility === 'gate' && position === approach && open())) reveal = target;
      if (exits.includes(action) && position === approach && open()) outcome = action === target ? 'win' : 'loss';
      tick++;
      return read();
    },
  };
}
