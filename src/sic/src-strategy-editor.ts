import { isJsonObject } from '../logos-engine/canonical.ts';
import { executeWorkflow, validateCompiledModule } from '../logos-engine/interpreter.ts';
import type { JsonValue } from '../logos-engine/ir.ts';
import type { BrowserV6Agent, V6AgentSnapshot } from '../runtime/v6-agent.ts';
import { contrastControlOperations, contrastControlsModule, contrastControlsWorkflow,
  defaultContrastCardSettings, readContrastCardSettings } from './contrast-controls-card.ts';

export function bindSrcStrategyEditor(container: HTMLElement, agent: BrowserV6Agent) {
  const details = document.createElement('details');
  details.className = 'sic-details sic-strategy-editor';
  details.innerHTML = `
    <summary>Configure an executable SRC card</summary>
    <form>
      <p>Compare how controls affect distant indicators.</p>
      <label>Indicators that must have changed<input name="trigger" type="number" min="1" max="8" value="1" required></label>
      <label>Next target<select name="order"><option value="largest">Farthest from the last control</option><option value="smallest">Nearest to the last control</option></select></label>
      <label>Indicators to confirm on return<input name="check" type="number" min="1" max="8" value="1" required></label>
      <div class="sic-strategy-editor-actions">
        <button type="button" data-preview>Preview change</button>
        <button type="submit" disabled>Apply to this session</button>
      </div>
      <p role="status">Step the SIC agent once to open a session.</p>
    </form>`;
  container.append(details);
  const form = details.querySelector('form')!;
  const previewButton = form.querySelector<HTMLButtonElement>('[data-preview]')!;
  const applyButton = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const status = form.querySelector<HTMLElement>('[role="status"]')!;
  const trigger = form.elements.namedItem('trigger') as HTMLInputElement;
  const order = form.elements.namedItem('order') as HTMLSelectElement;
  const check = form.elements.namedItem('check') as HTMLInputElement;
  let session: string | null = null;
  let graph: string | undefined;
  let preview: { session: string; chain: string; module: Awaited<ReturnType<typeof contrastControlsModule>> } | null = null;
  let working = false;

  const canEdit = (snapshot: V6AgentSnapshot) =>
    snapshot.phase === 'sealed_prefix' && !!snapshot.graphChain && !!snapshot.sessionId && !snapshot.busy && !snapshot.requiresNewSession;
  const refresh = (snapshot: V6AgentSnapshot) => {
    if (snapshot.sessionId !== session || snapshot.graphChain !== graph) {
      preview = null;
      if (snapshot.sessionId !== session) {
        trigger.value = String(defaultContrastCardSettings.minimumRemoteChanges);
        order.value = defaultContrastCardSettings.order;
        check.value = String(defaultContrastCardSettings.minimumChanges);
      }
      session = snapshot.sessionId;
      graph = snapshot.graphChain;
      if (!working) status.textContent = session
        ? canEdit(snapshot) ? 'Preview a draft against the last recorded comparison.' : 'Pause between commands to preview a change.'
        : 'Step the SIC agent once to open a session.';
    }
    previewButton.disabled = working || !canEdit(snapshot);
    applyButton.disabled = previewButton.disabled || !preview || preview.session !== session || preview.chain !== graph;
  };
  const describe = (result: JsonValue) => {
    if (!isJsonObject(result) || !isJsonObject(result.target)) return 'The card abstains';
    const count = result.minimumChanges;
    return `Click (${result.target.x}, ${result.target.y}), check at least ${count} changed ${count === 1 ? 'indicator' : 'indicators'}`;
  };

  form.addEventListener('input', () => {
    preview = null;
    refresh(agent.snapshot);
    status.textContent = 'Preview these settings before applying.';
  });
  previewButton.addEventListener('click', async () => {
    const before = agent.snapshot;
    if (working || !canEdit(before) || !before.sessionId || !form.reportValidity()) return;
    const settings = { minimumRemoteChanges: trigger.valueAsNumber, order: order.value === 'smallest' ? 'smallest' as const : 'largest' as const,
      minimumChanges: check.valueAsNumber };
    working = true;
    preview = null;
    refresh(before);
    try {
      const memory = await agent.inspectKnowledge();
      const node = memory.nodes[`program:${contrastControlsWorkflow}`];
      if (!isJsonObject(node?.value)) throw new Error('Select SIC alone and start a session to use this card.');
      if (!memory.chain || agent.snapshot.sessionId !== before.sessionId) throw new Error('The session changed. Preview again.');
      const current = validateCompiledModule(node.value.module, contrastControlOperations);
      const replacement = await contrastControlsModule(settings);
      const snapshot = agent.snapshot;
      const decision = [...snapshot.trace].reverse().find(item => isJsonObject(item) && item.kind === 'sic_native_plan' &&
        isJsonObject(item.src_decision) && item.src_decision.workflow === contrastControlsWorkflow);
      const receipt = isJsonObject(decision) ? decision.src_decision : null;
      const situation = isJsonObject(receipt) ? receipt.situation : null;
      const unchangedDraft = settings.minimumRemoteChanges === trigger.valueAsNumber && settings.order === order.value &&
        settings.minimumChanges === check.valueAsNumber;
      if (!unchangedDraft || snapshot.sessionId !== before.sessionId || snapshot.graphChain !== memory.chain) {
        throw new Error('The session or draft changed. Preview again.');
      }
      if (isJsonObject(situation)) {
        const inputs = { situation };
        const [a, b] = await Promise.all([
          executeWorkflow(current, contrastControlsWorkflow, inputs, contrastControlOperations),
          executeWorkflow(replacement, contrastControlsWorkflow, inputs, contrastControlOperations),
        ]);
        status.textContent = `Last recorded comparison. Current: ${describe(a.value)}. Draft: ${describe(b.value)}.`;
      } else {
        const configured = readContrastCardSettings(current);
        const currentStatus = configured ? `Current trigger: ${configured.minimumRemoteChanges} changed indicators.` : 'Current workflow uses a custom rule.';
        status.textContent = `${currentStatus} Play a comparison to preview a recorded target.`;
      }
      const latest = agent.snapshot;
      if (latest.sessionId !== before.sessionId || latest.graphChain !== memory.chain ||
        settings.minimumRemoteChanges !== trigger.valueAsNumber || settings.order !== order.value || settings.minimumChanges !== check.valueAsNumber) {
        throw new Error('The session or draft changed. Preview again.');
      }
      preview = { session: before.sessionId, chain: memory.chain, module: replacement };
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The preview failed.';
    } finally {
      working = false;
      refresh(agent.snapshot);
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const snapshot = agent.snapshot;
    if (working || !preview || !canEdit(snapshot) || preview.session !== snapshot.sessionId || preview.chain !== snapshot.graphChain) return;
    const plan = preview;
    working = true;
    refresh(snapshot);
    try {
      await agent.edit({ expectedGraphChain: plan.chain, reason: 'Configure the comparison of distant indicators',
        changes: [{ type: 'replace_program', programId: contrastControlsWorkflow, module: plan.module }] });
      status.textContent = agent.snapshot.sessionId === plan.session
        ? 'Applied to this session. The next comparison uses these settings.' : 'The session changed. Preview again.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'The edit failed.';
    } finally {
      preview = null;
      refresh(agent.snapshot);
      working = false;
      refresh(agent.snapshot);
    }
  });
  refresh(agent.snapshot);
  return refresh;
}
