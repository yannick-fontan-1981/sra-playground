import { compileRecoveryPack, contactRecoveryOrder, contactRecoveryStrategies, defaultRecoveryPack, type RecoveryPack } from './active-recovery.ts';
import { nextRecoveryRevision, readRecoveryRevision, recoveryRevision } from './recovery-pack.ts';
import { defaultFrontierConfiguration, frontierInputOrders, isFrontierInputOrder, type FrontierInputOrder } from './frontier-configuration.ts';

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
  inputOrder.replaceChildren(...Object.entries(frontierInputOrders).map(([id, title]) => new Option(title, id)));
  const fallback = form.querySelector<HTMLElement>('[data-sic-recovery-fallback]')!;
  const priorityPreview = form.querySelector<HTMLElement>('[data-sic-frontier-preview]')!;
  let comparedChoices: readonly { sequence: number; order: FrontierInputOrder; choices: Readonly<Record<FrontierInputOrder, string>> }[] = [];
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
  form.addEventListener('sic-frontier-choices', event => {
    comparedChoices = (event as CustomEvent<typeof comparedChoices>).detail;
    renderPriorityPreview();
  });
  priority.replaceChildren(...contactRecoveryOrder.map(id => new Option(contactRecoveryStrategies[id], id)));
  const showFallback = () => {
    const next = contactRecoveryOrder.find(id => id !== priority.value);
    fallback.textContent = next ? `Then try ${contactRecoveryStrategies[next]} if it applies and no plan was found.` : '';
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
    status.textContent = 'Using defaults because the saved recovery settings could not be read.';
  }
  function showDraft(pack: RecoveryPack) {
    mode.value = pack.mode;
    depth.value = String(pack.maxDepth);
    nodes.value = String(pack.maxNodes);
    priority.value = (pack.strategyOrder ?? contactRecoveryOrder)[0]!;
    inputOrder.value = (pack.frontier ?? defaultFrontierConfiguration).inputOrder;
    renderPriorityPreview();
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
      const candidate = compileRecoveryPack({ version: 1, mode: mode.value, maxDepth: depth.valueAsNumber, maxNodes: nodes.valueAsNumber, strategyOrder,
        frontier: { inputOrder: inputOrder.value } });
      save(nextRecoveryRevision(saved.current, saved.previous, recoveryRevision(candidate)));
      status.textContent = 'SIC settings saved for the next agent session.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Recovery settings could not be saved.';
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
      ].filter(Boolean);
      status.textContent = differences.length
        ? `Preview ${draft.digest.slice(0, 12)} · ${differences.join(' · ')}. Save SIC settings to apply it next session.`
        : 'This pack matches the saved SIC settings.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Recovery pack could not be opened.';
    }
  });
  return () => saved.current.configuration;
}
