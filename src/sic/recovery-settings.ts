import { compileRecoveryPack, contactRecoveryGraph, contactRecoveryOrder, contactRecoveryStrategies, defaultRecoveryPack, isContactStrategy, type RecoveryPack } from './active-recovery.ts';
import { nextRecoveryRevision, readRecoveryRevision, recoveryRevision, type RecoveryRevision } from './recovery-pack.ts';
import { verifySignedRecoveryPack, type SignedRecoveryPack } from './pack-signature.ts';
import { informationStrategies } from './information-strategy.ts';
import { evaluateFrontierLocalRule, compileFrontierLocalRule, defaultFrontierConfiguration, frontierInputOrders,
  isFrontierInputOrder, type FrontierChoiceEvidence, type FrontierInputOrder, type FrontierLocalRule } from './frontier-configuration.ts';
import { frontierStrategies, frontierStrategyGraph } from './frontier-strategy.ts';
import { defaultBrowserFamilyAgenda } from './family-agenda.ts';
import { viewStrategies, viewStrategyGraph } from './view-strategy.ts';
import { controlEffectNextGraph, controlEffectPrimitives } from './control-effect-next.ts';
import { auditStrategyGraph, type StrategyGraph } from './strategy-agenda.ts';
import type { V6BackendSnapshot } from '../runtime/v6-agent-protocol.ts';

const storageKey = 'sra.sic.contact-recovery.revisions.v1';
const legacyKey = 'sra.sic.contact-recovery.v1';
type PackProvenance = { readonly pack: SignedRecoveryPack; readonly signer: string };
type SavedRevisions = ReturnType<typeof nextRecoveryRevision> & {
  readonly currentProvenance?: PackProvenance;
  readonly previousProvenance?: PackProvenance;
};

export function bindRecoverySettings(panel: HTMLElement): () => RecoveryPack {
  const form = panel.querySelector<HTMLFormElement>('[data-sic-recovery-settings]')!;
  const status = form.querySelector<HTMLElement>('[data-sic-recovery-status]')!;
  const revision = form.querySelector<HTMLElement>('[data-sic-recovery-revision]')!;
  const rollback = form.querySelector<HTMLButtonElement>('[data-sic-recovery-rollback]')!;
  const mode = form.elements.namedItem('mode') as HTMLSelectElement;
  const priority = form.elements.namedItem('priority') as HTMLSelectElement;
  const inputOrder = form.elements.namedItem('frontierInputOrder') as HTMLSelectElement;
  const familyAgenda = form.elements.namedItem('familyAgenda') as HTMLSelectElement;
  const adaptiveReasoning = form.elements.namedItem('adaptiveReasoning') as HTMLInputElement;
  const openingCuriosity = form.elements.namedItem('openingCuriosity') as HTMLSelectElement;
  const informationStrategy = form.elements.namedItem('informationStrategy') as HTMLSelectElement;
  const informationOutcomes = form.elements.namedItem('informationOutcomes') as HTMLInputElement;
  const informationMode = form.elements.namedItem('informationMode') as HTMLSelectElement;
  informationStrategy.replaceChildren(...Object.entries(informationStrategies).map(([id, title]) => new Option(title, id)));
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
      graphCoverage('Exploration', frontierStrategyGraph, frontierStrategies, frontierStrategyGraph.priorities),
      graphCoverage('View access', viewStrategyGraph, viewStrategies, viewStrategyGraph.priorities),
      graphCoverage('Next primitive for a control effect', controlEffectNextGraph, controlEffectPrimitives, controlEffectNextGraph.priorities));
  };
  priority.addEventListener('change', showFallback);
  const depth = form.elements.namedItem('maxDepth') as HTMLInputElement;
  const nodes = form.elements.namedItem('maxNodes') as HTMLInputElement;
  const json = form.elements.namedItem('pack') as HTMLTextAreaElement;
  const trustedSigner = form.elements.namedItem('trustedSigner') as HTMLInputElement;
  const importButton = form.querySelector<HTMLButtonElement>('[data-sic-recovery-import]')!;
  let previewed: { revision: RecoveryRevision; formDigest: string; text: string; provenance?: PackProvenance } | null = null;
  let savedFormDigest: string;
  let saved: SavedRevisions = { current: recoveryRevision(defaultRecoveryPack), previous: null };
  try {
    const revisions = localStorage.getItem(storageKey);
    const legacy = localStorage.getItem(legacyKey);
    if (revisions !== null) {
      const record = JSON.parse(revisions);
      saved = { current: readRecoveryRevision(record.current), previous: record.previous === null ? null : readRecoveryRevision(record.previous),
        currentProvenance: record.currentProvenance, previousProvenance: record.previousProvenance };
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
    familyAgenda.value = pack.familyAgenda ?? defaultBrowserFamilyAgenda;
    adaptiveReasoning.checked = pack.reasoningMode === 'adaptive';
    openingCuriosity.value = pack.openingCuriosity ?? 'native';
    informationStrategy.value = pack.informationPreference?.strategy ?? 'point_contrast';
    informationOutcomes.value = String(pack.informationPreference?.minimumOutcomes ?? 2);
    informationMode.value = pack.informationPreference?.mode ?? 'native';
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
    savedFormDigest = readForm().digest;
  }
  function save(next: SavedRevisions) {
    localStorage.setItem(storageKey, JSON.stringify(next));
    saved = next;
    previewed = null;
    showDraft(saved.current.configuration);
    showSaved();
  }
  function readForm() {
    const strategyOrder = [priority.value, ...contactRecoveryOrder.filter(id => id !== priority.value)];
    const localRule = readLocalRule();
    return recoveryRevision(compileRecoveryPack({ version: 1, mode: mode.value, maxDepth: depth.valueAsNumber, maxNodes: nodes.valueAsNumber,
      strategyOrder, familyAgenda: familyAgenda.value,
      ...(adaptiveReasoning.checked ? { reasoningMode: 'adaptive' } : {}),
      ...(openingCuriosity.value !== 'native' ? { openingCuriosity: openingCuriosity.value } : {}),
      ...(informationMode.value !== 'native' ? { informationPreference: { strategy: informationStrategy.value,
        mode: informationMode.value, minimumOutcomes: informationOutcomes.valueAsNumber } } : {}),
      frontier: { inputOrder: inputOrder.value, ...(localRule ? { localRule } : {}) } }));
  }
  showDraft(saved.current.configuration);
  showSaved();
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const formRevision = readForm();
      const imported = previewed?.formDigest === formRevision.digest ? previewed : null;
      if (imported?.provenance && (json.value !== imported.text
        || trustedSigner.value.trim().toLowerCase() !== imported.provenance.signer)) {
        throw new TypeError('The signed pack or signer changed. Preview the pack again before saving.');
      }
      const candidate = imported?.revision ?? (formRevision.digest === savedFormDigest ? saved.current : formRevision);
      const next = nextRecoveryRevision(saved.current, saved.previous, candidate);
      const sameRevision = next.current.digest === saved.current.digest;
      save({ ...next, currentProvenance: imported?.provenance ?? (sameRevision ? saved.currentProvenance : undefined),
        previousProvenance: sameRevision ? saved.previousProvenance : saved.currentProvenance });
      status.textContent = imported?.provenance
        ? `Verified revision ${imported.revision.digest.slice(0, 12)} saved for the next agent session.`
        : 'SIC settings saved for the next agent session.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'SIC settings could not be saved.';
    }
  });
  rollback.addEventListener('click', () => {
    if (!saved.previous) return;
    try {
      save({ current: saved.previous, previous: saved.current, currentProvenance: saved.previousProvenance,
        previousProvenance: saved.currentProvenance });
      status.textContent = 'Previous SIC revision restored for the next agent session.';
    } catch {
      status.textContent = 'The previous revision could not be restored.';
    }
  });
  const exportButton = form.querySelector<HTMLButtonElement>('[data-sic-recovery-export]')!;
  exportButton.addEventListener('click', async () => {
    const current = saved;
    const provenance = current.currentProvenance;
    exportButton.disabled = true;
    try {
      const signed = provenance ? await verifySignedRecoveryPack(provenance.pack, provenance.signer) : null;
      if (saved !== current) return;
      if (signed && signed.revision.digest !== current.current.digest) throw new TypeError('The signature belongs to a different SIC revision.');
      json.value = JSON.stringify(signed ?? current.current, null, 2);
      json.focus();
      json.select();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'SIC pack could not be exported.';
    } finally {
      exportButton.disabled = false;
    }
  });
  importButton.addEventListener('click', async () => {
    const currentRevision = saved.current;
    const packageText = json.value;
    const fingerprint = trustedSigner.value.trim().toLowerCase();
    const controlsBeforePreview = new FormData(form);
    previewed = null;
    importButton.disabled = true;
    try {
      const parsed = JSON.parse(packageText);
      const signed = parsed !== null && typeof parsed === 'object' && Object.hasOwn(parsed, 'signature')
        ? await verifySignedRecoveryPack(parsed, fingerprint) : null;
      const draft = signed?.revision ?? readRecoveryRevision(parsed);
      const currentControls = new FormData(form);
      if (saved.current !== currentRevision || [...controlsBeforePreview].some(([name, value]) => currentControls.get(name) !== value)) {
        status.textContent = 'The settings changed during verification. Preview the pack again.';
        return;
      }
      showDraft(draft.configuration);
      previewed = { revision: draft, formDigest: readForm().digest, text: packageText,
        ...(signed ? { provenance: { pack: signed, signer: fingerprint } } : {}) };
      const current = saved.current.configuration;
      const currentFirst = (current.strategyOrder ?? contactRecoveryOrder)[0]!;
      const draftFirst = (draft.configuration.strategyOrder ?? contactRecoveryOrder)[0]!;
      const draftOrder = (draft.configuration.frontier ?? defaultFrontierConfiguration).inputOrder;
      const differences = [
        current.mode === draft.configuration.mode ? null : `mode ${current.mode} → ${draft.configuration.mode}`,
        (current.familyAgenda ?? defaultBrowserFamilyAgenda) === (draft.configuration.familyAgenda ?? defaultBrowserFamilyAgenda)
          ? null : `family selection → ${draft.configuration.familyAgenda ?? defaultBrowserFamilyAgenda}`,
        current.openingCuriosity === draft.configuration.openingCuriosity ? null : `opening curiosity → ${draft.configuration.openingCuriosity ?? 'native'}`,
        current.reasoningMode === draft.configuration.reasoningMode ? null : `reasoning modes → ${draft.configuration.reasoningMode ?? 'standard'}`,
        JSON.stringify(current.informationPreference) === JSON.stringify(draft.configuration.informationPreference) ? null
          : `information priority → ${draft.configuration.informationPreference
            ? `${informationStrategies[draft.configuration.informationPreference.strategy]} (≥ ${draft.configuration.informationPreference.minimumOutcomes} returns, ${draft.configuration.informationPreference.mode})`
            : 'current order'}`,
        current.maxDepth === draft.configuration.maxDepth ? null : `depth ${current.maxDepth} → ${draft.configuration.maxDepth}`,
        current.maxNodes === draft.configuration.maxNodes ? null : `states ${current.maxNodes} → ${draft.configuration.maxNodes}`,
        currentFirst === draftFirst ? null : `first strategy → ${contactRecoveryStrategies[draftFirst]}`,
        (current.frontier ?? defaultFrontierConfiguration).inputOrder === draftOrder ? null : `experiment priority → ${frontierInputOrders[draftOrder]}`,
        JSON.stringify(current.frontier?.localRule) === JSON.stringify(draft.configuration.frontier?.localRule) ? null
          : `exploration rule → ${draft.configuration.frontier?.localRule?.title ?? 'removed'}`,
      ].filter(Boolean);
      const verification = signed ? `Verified signer ${fingerprint.slice(0, 12)} · ` : '';
      const changes = differences.length ? ` · ${differences.join(' · ')}` : ' · settings match the saved configuration';
      status.textContent = `${verification}Preview ${draft.digest.slice(0, 12)}${changes}. Save SIC settings to apply it next session.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'SIC pack could not be opened.';
    } finally {
      importButton.disabled = false;
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
  state: Pick<V6BackendSnapshot, 'sourceDigest' | 'coverage' | 'sicActionCoverage' | 'sicFamilySelection' | 'sicFamilyActions'> | null) {
  let counts = container.querySelector('p');
  if (!counts) counts = container.appendChild(document.createElement('p'));
  const sample = state?.sicActionCoverage;
  const configurable = (sample?.contactRecovery ?? 0) + (sample?.configurableFrontier ?? 0);
  const agenda = configurable + (sample?.fixedFrontier ?? 0) + (sample?.viewAccess ?? 0) + (sample?.information ?? 0);
  const total = agenda + (sample?.native ?? 0);
  const coverage = total
    ? `${configurable}/${total} executed commands (${Math.round(100 * configurable / total)}%) came from a SIC strategy with editable settings. ${agenda}/${total} came from a SIC agenda. All ${total} commands have a plan record.`
    : 'Execute a command to measure which part of this session uses configurable SIC strategies.';
  const selection = state?.sicFamilySelection;
  const group = selection?.selected?.replaceAll('_', ' ');
  const arbitration = selection?.mode === 'active' ? ` The SIC family agenda ${group ? `selected ${group}` : 'found no offer'} after checking ${selection.visited.length} groups.`
    : selection?.mode === 'shadow' ? ` Shadow family comparison ${selection.matchesSource ? 'agrees with native selection' : 'differs from native selection'}.` : '';
  const familyCount = total && state?.sicFamilyActions !== undefined
    ? ` SIC selected the family for ${state.sicFamilyActions}/${total} executed commands.` : '';
  const reasoning = selection?.reasoning;
  const activity = reasoning ? ` Reasoning mode · ${reasoning.mode} · Level ${reasoning.level} · ${reasoning.levelsCompleted}/${reasoning.targetLevels} levels completed · ${reasoning.reason}` : '';
  counts.textContent = coverage + familyCount + arbitration + activity;
  const oldRoutes = container.querySelector('details');
  if (oldRoutes?.dataset.source === state?.sourceDigest) return;
  oldRoutes?.remove();
  const groups = state?.coverage?.sourceGroups;
  if (!groups || !state) return;
  const routes = document.createElement('details');
  routes.className = 'sic-details';
  routes.dataset.source = state.sourceDigest;
  routes.appendChild(document.createElement('summary')).textContent = 'Native routes and SIC decision points';
  routes.appendChild(document.createElement('p')).textContent = 'These groups follow the declared family order. Some routes also invoke a dedicated SIC agenda inside the selected family.';
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
        else if (group.id === 'view' && family === 'view') authority = 'SIC for guarded access to a different view';
        else if (group.id === 'view_continuity' && family === 'view_continuity') authority = 'SIC for learning how to continue when the view is unresolved';
        else if (group.id === 'information_goal' && family === 'information_goal') authority = 'SIC for guarded experiments that separate competing predictions';
        else if (group.id === 'goal_access' && entry === 'observed_composition_services') authority = 'SIC for contact recovery after a contradicted prediction';
        entries.appendChild(document.createElement('li')).textContent = `${family.replaceAll('_', ' ')}${entry ? ` · ${entry.replaceAll('_', ' ')}` : ''} · ${authority}`;
      }
    }
  }
  container.append(routes);
}
