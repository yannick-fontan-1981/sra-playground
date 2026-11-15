/** Author-only breadth-first search. No import from any browser/agent module. */
import { initialState, stepWorld } from '../../dist/core.js';
export function ruleKey(s) {
  // Facing and failure feedback do not affect the Merchant's transition rules.
  return `${s.hero.x},${s.hero.y}|${s.rocks.map(p => `${p.x},${p.y}`).sort().join(';')}|${s.complete}`;
}
export function search(world, { actions = [1,2,3,4,5], maxStates = 50000, allow = () => true } = {}) {
  const first = initialState(world), nodes = [{ state: first, parent: -1, action: 0 }];
  const seen = new Set([ruleKey(first)]);
  for (let head = 0; head < nodes.length; head++) {
    const { state } = nodes[head];
    if (state.complete) {
      const path = [];
      for (let at = head; nodes[at].parent !== -1; at = nodes[at].parent) path.push(nodes[at].action);
      return { status: 'solved', actions: path.reverse(), visited: seen.size };
    }
    for (const a of actions) {
      const next = stepWorld(world, state, a), key = ruleKey(next);
      if (!allow(state, next, a) || seen.has(key)) continue;
      if (seen.size >= maxStates) return { status: 'budget', actions: null, visited: seen.size };
      seen.add(key); nodes.push({ state: next, parent: head, action: a });
    }
  }
  return { status: 'unsolvable', actions: null, visited: seen.size };
}
export function walkingCells(world) {
  const first = initialState(world), queue = [first], seen = new Set([ruleKey(first)]);
  for (let head = 0; head < queue.length; head++) for (const a of [1,2,3,4]) {
    const next = stepWorld(world, queue[head], a), key = ruleKey(next);
    if (!seen.has(key)) { seen.add(key); queue.push(next); }
  }
  return queue.map(s => s.hero);
}
