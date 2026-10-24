import './symbolic-example.css';

type Fact = 'At(agent,door)' | 'WithinReach(key)' | 'OutOfReach(key)' | 'Has(agent,key)' | 'Matches(key,door)' | 'Locked(door)' | 'Unlocked(door)' | 'Closed(door)' | 'Open(door)' | 'Reached(exit)';
type Action = { name: string; requires: Fact[]; adds: Fact[]; removes: Fact[] };
type Scenario = { facts: Fact[]; unknown: Fact[] };
const actions: Action[] = [
  { name: 'Take the key', requires: ['At(agent,door)', 'WithinReach(key)'], adds: ['Has(agent,key)'], removes: ['WithinReach(key)'] },
  { name: 'Unlock the door', requires: ['At(agent,door)', 'Has(agent,key)', 'Matches(key,door)', 'Locked(door)'], adds: ['Unlocked(door)'], removes: ['Locked(door)'] },
  { name: 'Open the door', requires: ['At(agent,door)', 'Unlocked(door)', 'Closed(door)'], adds: ['Open(door)'], removes: ['Closed(door)'] },
  { name: 'Pass through', requires: ['At(agent,door)', 'Open(door)'], adds: ['Reached(exit)'], removes: ['At(agent,door)'] },
];
const shared: Fact[] = ['At(agent,door)', 'Locked(door)', 'Closed(door)'];
const scenarios: Record<string, Scenario> = {
  reachable: { facts: [...shared, 'WithinReach(key)', 'Matches(key,door)'], unknown: [] },
  held: { facts: [...shared, 'Has(agent,key)', 'Matches(key,door)'], unknown: [] },
  unknown: { facts: [...shared, 'WithinReach(key)'], unknown: ['Matches(key,door)'] },
  unreachable: { facts: [...shared, 'OutOfReach(key)', 'Matches(key,door)'], unknown: [] },
};
const goal: Fact = 'Reached(exit)';

/** Search the declared model; no game engine, neural model, or SRA is involved. */
function plan(initial: Fact[]): Action[] | undefined {
  const queue = [{ facts: new Set(initial), path: [] as Action[] }];
  const visited = new Set<string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor];
    if (!state) continue;
    if (state.facts.has(goal)) return state.path;
    const key = [...state.facts].sort().join('|');
    if (visited.has(key)) continue;
    visited.add(key);
    for (const action of actions) {
      if (!action.requires.every(fact => state.facts.has(fact))) continue;
      const next = new Set(state.facts);
      for (const fact of action.removes) next.delete(fact);
      for (const fact of action.adds) next.add(fact);
      queue.push({ facts: next, path: [...state.path, action] });
    }
  }
  return undefined;
}

/** Explain unsupported leaf prerequisites in this deliberately acyclic model. */
function missingPrerequisites(initial: Fact[], target: Fact = goal): Fact[] {
  if (initial.includes(target)) return [];
  const producer = actions.find(action => action.adds.includes(target));
  if (!producer) return [target];
  return [...new Set(producer.requires.flatMap(fact => missingPrerequisites(initial, fact)))];
}

function code(text: string): HTMLElement {
  const element = document.createElement('code');
  element.textContent = text;
  return element;
}
function labelledText(label: string, value: string): HTMLSpanElement {
  const line = document.createElement('span');
  line.className = 'symbolic-rule-line';
  const caption = document.createElement('span');
  caption.textContent = label;
  line.append(caption, code(value));
  return line;
}

const demo = document.querySelector<HTMLElement>('#symbolic-example');
if (demo) {
  const select = demo.querySelector<HTMLSelectElement>('[data-symbolic-scenario]');
  const facts = demo.querySelector<HTMLElement>('[data-symbolic-facts]');
  const rules = demo.querySelector<HTMLElement>('[data-symbolic-rules]');
  const steps = demo.querySelector<HTMLOListElement>('[data-symbolic-plan]');
  const result = demo.querySelector<HTMLElement>('[data-symbolic-result]');
  const missing = demo.querySelector<HTMLElement>('[data-symbolic-missing]');
  if (select && facts && steps && result && missing) {
    if (rules) {
      rules.replaceChildren(...actions.map(action => {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = action.name;
        item.append(name, labelledText('Requires', action.requires.join(' + ')), labelledText('Adds', action.adds.join(', ')), labelledText('Removes', action.removes.join(', ')));
        return item;
      }));
    }
    const render = () => {
      const scenario = scenarios[select.value] ?? scenarios.reachable;
      if (!scenario) return;
      const list = document.createElement('ul');
      list.className = 'symbolic-fact-list';
      for (const fact of scenario.facts) {
        const item = document.createElement('li');
        item.append(code(fact));
        list.append(item);
      }
      for (const fact of scenario.unknown) {
        const item = document.createElement('li');
        item.className = 'symbolic-unknown';
        item.append(code(fact), document.createTextNode(' — unknown'));
        list.append(item);
      }
      facts.replaceChildren(list);
      const path = plan(scenario.facts);
      steps.replaceChildren();
      if (path) {
        for (const action of path) {
          const item = document.createElement('li');
          const title = document.createElement('strong');
          title.textContent = action.name;
          item.append(title, labelledText('Now true', action.adds.join(', ')), labelledText('No longer true', action.removes.join(', ')));
          steps.append(item);
        }
        result.textContent = `Goal reached in model · ${path.length} actions`;
        missing.textContent = 'Each action is justified by the current facts. Its effects update the state used by the next action.';
        demo.dataset.outcome = 'reached';
      } else {
        const item = document.createElement('li');
        item.className = 'symbolic-no-plan';
        item.textContent = 'No sequence of these four actions reaches the goal from the supplied facts.';
        steps.append(item);
        result.textContent = 'No justified plan with current facts';
        const unsupported = missingPrerequisites(scenario.facts);
        missing.textContent = unsupported.map(fact => {
          if (scenario.unknown.includes(fact)) return `${fact} is unknown. Taking the key is possible, but unlocking is not yet justified. The model needs evidence that the key fits; unknown does not mean false.`;
          if (fact === 'WithinReach(key)' && scenario.facts.includes('OutOfReach(key)')) return 'WithinReach(key) is not satisfied: the key is observed out of reach. The available actions contain no way to reach it. A further action or a changed situation is needed.';
          return `The model needs ${fact}, which none of the available actions can establish.`;
        }).join(' ');
        demo.dataset.outcome = 'blocked';
      }
    };
    select.disabled = false;
    render();
    select.addEventListener('change', render);
    window.addEventListener('pageshow', render);
  }
}
