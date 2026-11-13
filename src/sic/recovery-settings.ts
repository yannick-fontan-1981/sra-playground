import { compileRecoveryPack, defaultRecoveryPack, type RecoveryPack } from './active-recovery.ts';
import { nextRecoveryRevision, readRecoveryRevision, recoveryRevision } from './recovery-pack.ts';

const storageKey = 'sra.sic.contact-recovery.revisions.v1';
const legacyKey = 'sra.sic.contact-recovery.v1';

export function bindRecoverySettings(panel: HTMLElement): () => RecoveryPack {
  const form = panel.querySelector<HTMLFormElement>('[data-sic-recovery-settings]')!;
  const status = form.querySelector<HTMLElement>('[data-sic-recovery-status]')!;
  const revision = form.querySelector<HTMLElement>('[data-sic-recovery-revision]')!;
  const rollback = form.querySelector<HTMLButtonElement>('[data-sic-recovery-rollback]')!;
  const mode = form.elements.namedItem('mode') as HTMLSelectElement;
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
      const candidate = compileRecoveryPack({ version: 1, mode: mode.value, maxDepth: depth.valueAsNumber, maxNodes: nodes.valueAsNumber });
      save(nextRecoveryRevision(saved.current, saved.previous, recoveryRevision(candidate)));
      status.textContent = `Saved ${candidate.mode} recovery for the next agent session.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Recovery settings could not be saved.';
    }
  });
  rollback.addEventListener('click', () => {
    if (!saved.previous) return;
    try {
      save({ current: saved.previous, previous: saved.current });
      status.textContent = 'Previous recovery revision restored for the next agent session.';
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
      const differences = [
        current.mode === draft.configuration.mode ? null : `mode ${current.mode} → ${draft.configuration.mode}`,
        current.maxDepth === draft.configuration.maxDepth ? null : `depth ${current.maxDepth} → ${draft.configuration.maxDepth}`,
        current.maxNodes === draft.configuration.maxNodes ? null : `states ${current.maxNodes} → ${draft.configuration.maxNodes}`,
      ].filter(Boolean);
      status.textContent = differences.length
        ? `Preview ${draft.digest.slice(0, 12)} · ${differences.join(' · ')}. Save recovery settings to apply it next session.`
        : 'This pack matches the saved recovery settings.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Recovery pack could not be opened.';
    }
  });
  return () => saved.current.configuration;
}
