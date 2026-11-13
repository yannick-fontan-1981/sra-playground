import { compileRecoveryPack, defaultRecoveryPack, type RecoveryPack } from './active-recovery.ts';

const storageKey = 'sra.sic.contact-recovery.v1';

export function bindRecoverySettings(panel: HTMLElement): () => RecoveryPack {
  const form = panel.querySelector<HTMLFormElement>('[data-sic-recovery-settings]')!;
  const status = form.querySelector<HTMLElement>('[data-sic-recovery-status]')!;
  const mode = form.elements.namedItem('mode') as HTMLSelectElement;
  const depth = form.elements.namedItem('maxDepth') as HTMLInputElement;
  const nodes = form.elements.namedItem('maxNodes') as HTMLInputElement;
  let pack = defaultRecoveryPack;
  try {
    const previous = localStorage.getItem(storageKey);
    if (previous !== null) pack = compileRecoveryPack(JSON.parse(previous));
  } catch {
    status.textContent = 'Using defaults because the saved recovery settings could not be read.';
  }
  mode.value = pack.mode;
  depth.value = String(pack.maxDepth);
  nodes.value = String(pack.maxNodes);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const candidate = compileRecoveryPack({ version: 1, mode: mode.value, maxDepth: depth.valueAsNumber, maxNodes: nodes.valueAsNumber });
      localStorage.setItem(storageKey, JSON.stringify(candidate));
      pack = candidate;
      status.textContent = `Saved ${pack.mode} recovery for the next agent session.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Recovery settings could not be saved.';
    }
  });
  return () => pack;
}
