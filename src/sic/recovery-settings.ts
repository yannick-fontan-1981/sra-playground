import { compileRecoveryPack, contactRecoveryGraph, contactRecoveryOrder, contactRecoveryStrategies, defaultRecoveryPack, isContactStrategy, type RecoveryPack } from './active-recovery.ts';
import { nextRecoveryRevision, readRecoveryRevision, recoveryRevision } from './recovery-pack.ts';
import { evaluateFrontierLocalRule, compileFrontierLocalRule, defaultFrontierConfiguration, frontierInputOrders,
  isFrontierInputOrder, type FrontierChoiceEvidence, type FrontierInputOrder, type FrontierLocalRule } from './frontier-configuration.ts';
import { frontierStrategies, frontierStrategyGraph } from './frontier-strategy.ts';
import { auditStrategyGraph, type StrategyGraph } from './strategy-agenda.ts';
import type { V6BackendSnapshot } from '../runtime/v6-agent-protocol.ts';

const storageKey = 'sra.sic.contact-recovery.revisions.v1';
const legacyKey = 'sra.sic.contact-recovery.v1';

export function bindRecoverySettings(panel: HTMLElement): () => RecoveryPack {
  const form = panel.querySelector<HTMLFormElement>('[data-sic-recovery-settings]')!;
  const status = form.querySelector<HTMLElement>('[data-sic-recovery-status]')!;
  const revision = form.querySelector<HTMLElement>('[data-sic-recovery-revision]')!;
  const rollback = form.querySelector<HTMLButtonElement>('[data-sic-recovery-rollback]')!;
  const mode = form.elements.namedItem('mode') as HTMLSelectElement;
  const priority = form.elements.namedItem('priority') as HTMLSelectElement;
  const inputOrder = form.elements.namedItem('frontierInputOrder') as HTMLSelectElement;
  const ruleTitle = form.elements.namedItem('localRuleTitle') as HTMLInputElement;
  const ruleCommands = form.elements.namedItem('localRuleCommands') as HTMLSelectElement;
  const ruleGap = form.elements.namedItem('localRuleGap') as HTMLInputElement;
  const rulePreference = form.elements.namedItem('localRulePreference') as HTMLSelectElement;
  const ruleMode = form.elements.namedItem('localRuleMode') as HTMLSelectElement;
  const rulePreview = form.querySelector<HTMLElement>('[data-sic-local-rule-preview]')!;
  inputOrder.replaceChildren(...Object.entries(frontierInputOrders).map(([id, title]) => new Option(title, id)));
  rulePreference.replaceChildren(...Object.entries(frontierInputOrders).map(([id, title]) => new Option(title, id)));
  const fallback = form.querySelector<HTMLElement>('[data-sic-recovery-fallback]')!;
  const coverage = form.querySelector<HTMLElement>('[data-sic-graph-coverage]')!;
  const priorityPreview = form.querySelector<HTMLElement>('[data-sic-frontier-preview]')!;
  let comparedChoices: readonly { sequence: number; order: FrontierInputOrder; choices: Readonly<Record<FrontierInputOrder, string>>;
    ruleEvidence?: FrontierChoiceEvidence }[] = [];
  const readLocalRule = () => ruleTitle.value.trim() ? compileFrontierLocalRule({
    title: ruleTitle.value, mode: ruleMode.value, commands: ruleCommands.value,
    minimumUsageGap: ruleGap.valueAsNumber, prefer: rulePreference.value,
  }) : undefined;
  const renderRulePreview = () => {
    rulePreview.textContent = '';
    try {
      const rule = readLocalRule();
      if (!rule || !isFrontierInputOrder(inputOrder.value)) return;
      const order = inputOrder.value;
      const comparable = comparedChoices.flatMap(item => item.ruleEvidence ? [{ ...item, ruleEvidence: item.ruleEvidence }] : []);
      const matches = comparable.filter(({ ruleEvidence }) => evaluateFrontierLocalRule(rule, ruleEvidence).matched);
      const changed = matches.filter(item => item.choices[rule.prefer] !== item.choices[order]);
      const examples = changed.slice(0, 4).map(item => `action ${item.sequence} (${item.choices[order]} → ${item.choices[rule.prefer]})`);
      rulePreview.textContent = comparable.length ? `${matches.length}/${comparable.length} retained boards match. ${changed.length} would change command when active${examples.length
        ? ` · ${examples.join(' · ')}` : ''}.` : 'Run the agent to test this rule on observed boards.';
    } catch (error) {
      rulePreview.textContent = error instanceof Error ? error.message : 'Invalid rule.';
    }
  };
  const renderPriorityPreview = () => {
    if (!isFrontierInputOrder(inputOrder.value)) return;
    const draft = inputOrder.value;
    const changes = comparedChoices.filter(({ order, choices }) => choices[draft] !== choices[order]);
    const examples = changes.slice(0, 3).map(({ sequence, order, choices }) => `action ${sequence}: ${choices[order]} → ${choices[draft]}`);
    priorityPreview.textContent = comparedChoices.length
      ? `${changes.length} of ${comparedChoices.length} retained local choices would change on the observed boards${examples.length ? ` · ${examples.join(' · ')}` : ''}.`
      : 'Run the agent to compare the priorities on observed boards.';
  };
  inputOrder.addEventListener('change', renderPriorityPreview);
  inputOrder.addEventListener('change', renderRulePreview);
  for (const field of [ruleTitle, ruleCommands, ruleGap, rulePreference, ruleMode]) field.addEventListener('input', renderRulePreview);
  form.addEventListener('sic-frontier-choices', event => {
    comparedChoices = (event as CustomEvent<typeof comparedChoices>).detail;
    renderPriorityPreview();
    renderRulePreview();
  });
  priority.replaceChildren(...contactRecoveryOrder.map(id => new Option(contactRecoveryStrategies[id], id)));
  const showFallback = () => {
    const next = contactRecoveryOrder.find(id => id !== priority.value);
    fallback.textContent = next ? `Then try ${contactRecoveryStrategies[next]} if it applies and no plan was found.` : '';
    if (!isContactStrategy(priority.value) || !next) return;
    coverage.replaceChildren(graphCoverage('Contact recovery', contactRecoveryGraph, contactRecoveryStrategies, [priority.value, next]),
      graphCoverage('Exploration', frontierStrategyGraph, frontierStrategies, frontierStrategyGraph.priorities));
  };
  priority.addEventListener('change', showFallback);
  const depth = form.elements.namedItem('maxDepth') as HTMLInputElement;
  const nodes = form.elements.namedItem('maxNodes') as HTMLInputElement;
  const json = form.elements.namedItem('pack') as HTMLTextAreaElement;
  let saved: ReturnType<typeof nextRecoveryRevision> = { current: recoveryRevision(defaultRecoveryPack), previous: null };
  try {
    const revisions = localStorage.getItem(storageKey);
    const legacy = localStorage.getItem(legacyKey);
    if (revisions !== null) {
      const record = JSON.parse(revisions);
      saved = { current: readRecoveryRevision(record.current), previous: record.previous === null ? null : readRecoveryRevision(record.previous) };
    } else if (legacy !== null) {
      saved.current = recoveryRevision(compileRecoveryPack(JSON.parse(legacy)));
    }
  } catch {
    status.textContent = 'Using defaults because the saved SIC settings could not be read.';
  }
  function showDraft(pack: RecoveryPack) {
    mode.value = pack.mode;
    depth.value = String(pack.maxDepth);
    nodes.value = String(pack.maxNodes);
    priority.value = (pack.strategyOrder ?? contactRecoveryOrder)[0]!;
    inputOrder.value = (pack.frontier ?? defaultFrontierConfiguration).inputOrder;
    const rule: FrontierLocalRule | undefined = pack.frontier?.localRule;
    ruleTitle.value = rule?.title ?? '';
    ruleCommands.value = rule?.commands ?? 'directions';
    ruleGap.value = String(rule?.minimumUsageGap ?? 1);
    rulePreference.value = rule?.prefer ?? 'command_order';
    ruleMode.value = rule?.mode ?? 'shadow';
    renderPriorityPreview();
    renderRulePreview();
    showFallback();
  }
  function showSaved() {
    const suffix = saved.previous ? ` · Previous ${saved.previous.digest.slice(0, 12)}` : '';
    revision.textContent = `Saved revision ${saved.current.digest.slice(0, 12)}${suffix}`;
    rollback.disabled = saved.previous === null;
  }
  function save(next: ReturnType<typeof nextRecoveryRevision>) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    saved = next;
    showDraft(saved.current.configuration);
    showSaved();
  }
  showDraft(saved.current.configuration);
  showSaved();
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const strategyOrder = [priority.value, ...contactRecoveryOrder.filter(id => id !== priority.value)];
      const localRule = readLocalRule();
      const candidate = compileRecoveryPack({ version: 1, mode: mode.value, maxDepth: depth.valueAsNumber, maxNodes: nodes.valueAsNumber, strategyOrder,
        frontier: { inputOrder: inputOrder.value, ...(localRule ? { localRule } : {}) } });
      save(nextRecoveryRevision(saved.current, saved.previous, recoveryRevision(candidate)));
      status.textContent = 'SIC settings saved for the next agent session.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'SIC settings could not be saved.';
    }
  });
  rollback.addEventListener('click', () => {
    if (!saved.previous) return;
    try {
      save({ current: saved.previous, previous: saved.current });
      status.textContent = 'Previous SIC revision restored for the next agent session.';
    } catch {
      status.textContent = 'The previous revision could not be restored.';
    }
  });
  form.querySelector('[data-sic-recovery-export]')!.addEventListener('click', () => {
    json.value = JSON.stringify(saved.current, null, 2);
    json.focus();
    json.select();
  });
  form.querySelector('[data-sic-recovery-import]')!.addEventListener('click', () => {
    try {
      const draft = readRecoveryRevision(JSON.parse(json.value));
      showDraft(draft.configuration);
      const current = saved.current.configuration;
      const currentFirst = (current.strategyOrder ?? contactRecoveryOrder)[0]!;
      const draftFirst = (draft.configuration.strategyOrder ?? contactRecoveryOrder)[0]!;
      const draftOrder = (draft.configuration.frontier ?? defaultFrontierConfiguration).inputOrder;
      const differences = [
        current.mode === draft.configuration.mode ? null : `mode ${current.mode} → ${draft.configuration.mode}`,
        current.maxDepth === draft.configuration.maxDepth ? null : `depth ${current.maxDepth} → ${draft.configuration.maxDepth}`,
        current.maxNodes === draft.configuration.maxNodes ? null : `states ${current.maxNodes} → ${draft.configuration.maxNodes}`,
        currentFirst === draftFirst ? null : `first strategy → ${contactRecoveryStrategies[draftFirst]}`,
        (current.frontier ?? defaultFrontierConfiguration).inputOrder === draftOrder ? null : `experiment priority → ${frontierInputOrders[draftOrder]}`,
        JSON.stringify(current.frontier?.localRule) === JSON.stringify(draft.configuration.frontier?.localRule) ? null
          : `exploration rule → ${draft.configuration.frontier?.localRule?.title ?? 'removed'}`,
      ].filter(Boolean);
      status.textContent = differences.length
        ? `Preview ${draft.digest.slice(0, 12)} · ${differences.join(' · ')}. Save SIC settings to apply it next session.`
        : 'This pack matches the saved SIC settings.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'SIC pack could not be opened.';
    }
  });
  return () => saved.current.configuration;
}

function graphCoverage<Id extends string, Key extends string>(title: string, graph: StrategyGraph<Id, Key>,
  labels: Readonly<Record<Id, string>>, priorities: readonly Id[]) {
  const { covered, combinations, overlapping, matches } = auditStrategyGraph(graph, priorities);
  const result = document.createElement('p');
  const winners = matches.map(row => `${labels[row.id]} ranked first in ${row.first}.`);
  result.textContent = `${title} · Guards cover ${covered}/${combinations} possible fact combinations, including ${overlapping} with several applicable strategies. ${winners.join(' ')}`;
  return result;
}

export function renderActionCoverage(container: HTMLElement,
  state: Pick<V6BackendSnapshot, 'sourceDigest' | 'coverage' | 'sicActionCoverage'> | null) {
  let counts = container.querySelector('p');
  if (!counts) counts = container.appendChild(document.createElement('p'));
  const sample = state?.sicActionCoverage;
  const configurable = (sample?.contactRecovery ?? 0) + (sample?.configurableFrontier ?? 0);
  const agenda = configurable + (sample?.fixedFrontier ?? 0);
  const total = agenda + (sample?.native ?? 0);
  counts.textContent = total
    ? `${configurable}/${total} executed commands (${Math.round(100 * configurable / total)}%) came from a SIC strategy with editable settings. ${agenda}/${total} came from a SIC agenda. All ${total} commands have a plan record.`
    : 'Execute a command to measure which part of this session uses configurable SIC strategies.';
  const oldRoutes = container.querySelector('details');
  if (oldRoutes?.dataset.source === state?.sourceDigest) return;
  oldRoutes?.remove();
  const groups = state?.coverage?.sourceGroups;
  if (!groups || !state) return;
  const routes = document.createElement('details');
  routes.className = 'sic-details';
  routes.dataset.source = state.sourceDigest;
  routes.appendChild(document.createElement('summary')).textContent = 'Native routes and SIC decision points';
  routes.appendChild(document.createElement('p')).textContent = 'The native selector still ranks these groups. Some routes invoke a SIC agenda after selection.';
  const list = routes.appendChild(document.createElement('ul'));
  for (const group of groups) {
    const item = list.appendChild(document.createElement('li'));
    item.appendChild(document.createElement('strong')).textContent = group.id.replaceAll('_', ' ');
    if (!group.families.length) item.append(' · no registered provider');
    else {
      const entries = item.appendChild(document.createElement('ul'));
      for (const [index, family] of group.families.entries()) {
        const entry = group.entryPoints?.[index];
        let authority = 'native';
        if (group.id === 'observed_frontier' && family === 'observed_frontier') authority = 'SIC for untried inputs and access to them';
        else if (group.id === 'goal_access' && entry === 'observed_composition_services') authority = 'SIC for contact recovery after a contradicted prediction';
        entries.appendChild(document.createElement('li')).textContent = `${family.replaceAll('_', ' ')}${entry ? ` · ${entry.replaceAll('_', ' ')}` : ''} · ${authority}`;
      }
    }
  }
  container.append(routes);
}
