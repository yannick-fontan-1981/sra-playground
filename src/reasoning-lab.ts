import './styles.css';
import './reasoning-lab.css';
import { renderSiteHeader } from './site-header.ts';
import { loadV7Bundle, V7_SOURCE_COMMIT } from './logos-engine/bundle.ts';
import type { DemonstrationScenario, V7Bundle } from './logos-engine/bundle.ts';
import type { LabRequest, LabResponse, LabSnapshot } from './logos-engine/lab-protocol.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <a class="skip-link" href="#lab-main">Skip to the reasoning lab</a>
  ${renderSiteHeader('lab')}
  <main id="lab-main" class="lab wrap">
    <section class="lab-hero" aria-labelledby="lab-title">
      <div><p class="eyebrow">LOGOS ENGINE / REASONING LAB</p>
        <h1 id="lab-title">Watch knowledge take shape.</h1>
        <p class="lab-lead">Follow an observation through the V7 reasoning program. Inspect the hypotheses it creates, the rules it connects, and what changes when a counterexample arrives.</p>
      </div>
      <aside class="lab-milestone"><span>01</span><div><strong>Native TypeScript kernel</strong><p>Controlled observations · program inspection</p></div></aside>
    </section>

    <section class="lab-session" aria-labelledby="session-title">
      <div class="lab-section-heading"><h2 id="session-title">A small, inspectable experiment</h2><span id="lab-status" class="lab-status" role="status">Loading the V7 program…</span></div>
      <p class="lab-description">These synthetic transitions exercise the original V7 rules. Use SRA Agent in the Playground for the native V6 transfer on real game observations.</p>
      <div class="lab-controls">
        <label for="lab-scenario">Experiment<select id="lab-scenario" disabled><option>Loading…</option></select></label>
        <div class="lab-actions"><button id="lab-run" class="lab-primary" disabled>Run experiment</button><button id="lab-next" disabled>Next observation</button><button id="lab-stop" disabled>Stop</button><button id="lab-reset" disabled>Reset</button></div>
      </div>
      <p id="lab-scenario-description" class="lab-description"></p>
      <p id="lab-error" class="lab-error" role="alert" hidden></p>
      <ol id="lab-timeline" class="lab-timeline" aria-label="Observations"></ol>
      <div class="lab-stats" aria-label="Knowledge summary">
        <div><span id="lab-count-observations">0</span><p>Observations</p></div>
        <div><span id="lab-count-hypotheses">0</span><p>Hypotheses</p></div>
        <div><span id="lab-count-compositions">0</span><p>Compositions</p></div>
        <div><span id="lab-count-suspended">0</span><p>Suspended nodes</p></div>
      </div>
    </section>

    <div class="lab-workspace">
      <section class="lab-panel lab-program" aria-labelledby="program-title">
        <div class="lab-panel-heading"><p class="eyebrow">PROGRAM</p><h2 id="program-title">The rules that run</h2><p>Expand a step to inspect its instructions. Blue markers identify instructions reached in the latest cycle.</p></div>
        <div id="lab-program-tree" class="lab-program-tree"></div>
        <details class="lab-source"><summary>Read the original SRC</summary><pre id="lab-source-code"></pre></details>
      </section>
      <section class="lab-panel lab-knowledge" aria-labelledby="knowledge-title">
        <div class="lab-panel-heading"><p class="eyebrow">KNOWLEDGE</p><h2 id="knowledge-title">What the engine has learned</h2><p>Select a node to inspect its current revision and evidence.</p></div>
        <div id="lab-nodes" class="lab-nodes"><p class="lab-empty">Run the first observation to create knowledge.</p></div>
      </section>
      <section class="lab-panel lab-inspector" aria-labelledby="inspector-title">
        <div class="lab-panel-heading"><p class="eyebrow">NODE INSPECTOR</p><h2 id="inspector-title">Evidence &amp; provenance</h2></div>
        <div id="lab-inspector"><p class="lab-empty">A node records what it claims and where that claim came from.</p></div>
      </section>
    </div>

    <section class="lab-panel lab-trace" aria-labelledby="trace-title">
      <div class="lab-panel-heading"><p class="eyebrow">EXECUTION</p><h2 id="trace-title">The latest reasoning cycle</h2><p id="lab-receipt">No cycle has run yet.</p></div>
      <details id="lab-trace-details"><summary>Inspect the execution trace <span id="lab-trace-count"></span></summary><div id="lab-trace-content" class="lab-trace-scroll"><p class="lab-empty">The trace will appear after an observation.</p></div></details>
      <details class="lab-observation"><summary>Inspect the latest observation</summary><pre id="lab-observation-json">No observation yet.</pre></details>
    </section>

    <footer class="lab-footer"><p><strong>A foundation for editable reasoning.</strong> This lab displays the compiled program that actually executes. The Playground's SRA Agent mode uses this shared interpreter for the ongoing native V6 transfer. Full capability parity and a common editable program-and-knowledge model remain migration requirements.</p><p>Python reference: V7 at <a href="https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan/tree/${V7_SOURCE_COMMIT}/agents/yf_arc3_v7" target="_blank" rel="noopener noreferrer">${V7_SOURCE_COMMIT.slice(0, 10)}</a>. <a href="/">Return to the Playground →</a></p></footer>
  </main>`;

const query = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const pretty = (value: unknown): string => JSON.stringify(value, null, 2) ?? '';
const human = (value: unknown): string => String(value ?? '').replace(/_/g, ' ');
const shortId = (value: unknown): string => String(value ?? '').replace(/^node:/, '').slice(0, 10);

const select = query<HTMLSelectElement>('#lab-scenario');
const runButton = query<HTMLButtonElement>('#lab-run');
const nextButton = query<HTMLButtonElement>('#lab-next');
const stopButton = query<HTMLButtonElement>('#lab-stop');
const resetButton = query<HTMLButtonElement>('#lab-reset');
const worker = new Worker(new URL('./logos-engine/lab-worker.ts', import.meta.url), { type: 'module' });
const pending = new Map<number, { resolve: (snapshot: LabSnapshot) => void; reject: (error: Error) => void }>();
let requestId = 0;
let bundle: V7Bundle;
let state: LabSnapshot = { sequence: 0, memory: { nodes: [], deltas: [], chain: '' }, trace: [], receipt: null };
let cursor = 0;
let busy = false;
let runAll = false;
let selectedNode = '';
let stopped = false;
let initializing = false;
let transportFailed = false;

worker.onmessage = (event: MessageEvent<LabResponse>) => {
  const response = event.data;
  const promise = pending.get(response.id);
  if (!promise) return;
  pending.delete(response.id);
  if (response.type === 'result') promise.resolve(response.snapshot);
  else {
    const error = new Error(response.message);
    if (response.cancelled) error.name = 'AbortError';
    promise.reject(error);
  }
};
worker.onerror = (event) => {
  transportFailed = true;
  const error = new Error(event.message || 'The reasoning worker could not start.');
  for (const promise of pending.values()) promise.reject(error);
  pending.clear();
  showError(error);
  controls();
};

function request(payload: Omit<Extract<LabRequest, { type: 'initialize' }>, 'id'> | Omit<Extract<LabRequest, { type: 'advance' }>, 'id'>): Promise<LabSnapshot> {
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...payload, id });
  });
}

function scenario(): DemonstrationScenario { return bundle.scenarios.find(item => item.id === select.value) ?? bundle.scenarios[0]!; }
function status(message: string): void { query('#lab-status').textContent = message; }
function showError(error: unknown): void {
  query('#lab-error').textContent = error instanceof Error ? error.message : String(error);
  query('#lab-error').hidden = false;
  status('The experiment stopped');
}
function controls(): void {
  const complete = bundle && cursor >= scenario().events.length;
  select.disabled = busy || transportFailed;
  runButton.disabled = busy || complete || !bundle || transportFailed;
  nextButton.disabled = busy || complete || !bundle || transportFailed;
  resetButton.disabled = busy || !bundle || transportFailed;
  stopButton.disabled = !busy || initializing || transportFailed;
  runButton.textContent = cursor > 0 && !complete ? 'Run remaining observations' : 'Run experiment';
}

function renderTimeline(): void {
  query('#lab-scenario-description').textContent = scenario().description;
  query('#lab-timeline').innerHTML = scenario().events.map((item, index) => `<li class="${index < cursor ? 'is-complete' : index === cursor ? 'is-next' : ''}"${index === cursor ? ' aria-current="step"' : ''}><span>${index < cursor ? '✓' : index + 1}</span><p>${escape(item.label)}</p></li>`).join('');
}

function expressionLabel(value: unknown): string {
  const expr = record(value);
  if (expr.kind === 'call') return String(expr.value ?? 'call');
  if (expr.kind === 'reference') return String(expr.value ?? 'reference');
  if (expr.kind === 'list') return `[${array(expr.items).map(expressionLabel).join(', ')}]`;
  return typeof expr.value === 'string' ? expr.value : JSON.stringify(expr.value ?? expr.kind);
}

function renderProgram(): void {
  const executed = new Set(state.trace.filter(event => event.status === 'completed').map(event => String(event.statementId)));
  const renderStatements = (statements: unknown[]): string => `<ul>${statements.map(value => {
    const statement = record(value);
    const id = String(statement.id);
    const kind = String(statement.kind);
    const body = array(statement.body);
    const otherwise = array(statement.else_body);
    const label = `${kind === 'FOR_EACH' ? `FOR ${String(statement.iterator)} IN` : kind} ${expressionLabel(statement.expression)}`;
    return `<li><div class="lab-instruction${executed.has(id) ? ' is-executed' : ''}" title="${escape(id)}"><span aria-label="${executed.has(id) ? 'Executed in the latest cycle' : 'Not executed in the latest cycle'}">${executed.has(id) ? '●' : '○'}</span><code>${escape(label)}</code>${statement.result_binding ? `<small>→ ${escape(statement.result_binding)}</small>` : ''}</div>${body.length ? renderStatements(body) : ''}${otherwise.length ? `<div class="lab-else">ELSE</div>${renderStatements(otherwise)}` : ''}</li>`;
  }).join('')}</ul>`;
  const workflows = array(record(bundle.programs.generators).workflows);
  const tree = query('#lab-program-tree');
  const openIds = new Set(Array.from(tree.querySelectorAll<HTMLDetailsElement>('details[open]')).map(item => item.dataset.step));
  const firstRender = tree.childElementCount === 0;
  tree.innerHTML = workflows.map(value => {
    const workflow = record(value);
    return `<p class="lab-workflow-name">${escape(workflow.id)}</p>${array(workflow.steps).map((stepValue, index) => {
      const step = record(stepValue);
      const reached = state.trace.some(event => event.stepId === step.id);
      return `<details data-step="${escape(step.id)}"${openIds.has(String(step.id)) || (firstRender && index === 0) ? ' open' : ''}><summary><span class="lab-step-dot${reached ? ' is-executed' : ''}"></span>${escape(String(step.id).split('.').pop())}<small>STEP</small></summary>${renderStatements(array(step.statements))}</details>`;
    }).join('')}`;
  }).join('');
}

function renderKnowledge(): void {
  const nodes = state.memory.nodes;
  query('#lab-count-observations').textContent = String(cursor);
  query('#lab-count-hypotheses').textContent = String(nodes.filter(node => node.kind === 'hypothesis').length);
  query('#lab-count-compositions').textContent = String(nodes.filter(node => node.kind === 'composition').length);
  query('#lab-count-suspended').textContent = String(nodes.filter(node => node.status === 'suspended').length);
  if (!nodes.some(node => node.id === selectedNode)) selectedNode = String(nodes[0]?.id ?? '');
  query('#lab-nodes').innerHTML = nodes.length ? nodes.map(node => `<button class="lab-node${node.id === selectedNode ? ' is-selected' : ''}" data-node="${escape(node.id)}" aria-pressed="${node.id === selectedNode}"><span class="lab-node-top"><strong>${escape(human(node.kind))}</strong><span class="lab-tag" data-status="${escape(node.status)}">${escape(human(node.status))}</span></span><span class="lab-node-bottom"><code>${escape(shortId(node.id))}</code><span>revision ${escape(node.revision)}</span></span></button>`).join('') : '<p class="lab-empty">Run the first observation to create knowledge.</p>';
  renderInspector();
}

function renderInspector(): void {
  const node = state.memory.nodes.find(item => item.id === selectedNode);
  if (!node) { query('#lab-inspector').innerHTML = '<p class="lab-empty">A node records what it claims and where that claim came from.</p>'; return; }
  const details = Object.entries(node).filter(([key]) => !['id', 'kind', 'revision', 'status'].includes(key));
  query('#lab-inspector').innerHTML = `<div class="lab-inspector-title"><h3>${escape(human(node.kind))}</h3><span class="lab-tag" data-status="${escape(node.status)}">${escape(human(node.status))}</span></div><p class="lab-node-id"><code>${escape(node.id)}</code></p><p class="lab-revision">Revision ${escape(node.revision)}</p><dl>${details.map(([key, value]) => `<div><dt>${escape(human(key))}</dt><dd>${typeof value === 'object' ? `<pre>${escape(pretty(value))}</pre>` : escape(value)}</dd></div>`).join('')}</dl><details><summary>Complete node as JSON</summary><pre>${escape(pretty(node))}</pre></details>`;
}

function renderTrace(): void {
  const receipt = state.receipt;
  query('#lab-receipt').textContent = receipt ? `Cycle ${state.sequence} · ${receipt.instructions} instructions · ${receipt.deltaCount} knowledge changes · ${Math.round(Number(receipt.durationMs))} ms` : 'No cycle has run yet.';
  query('#lab-trace-count').textContent = state.trace.length ? `(${state.trace.length} events)` : '';
  const visibleTrace = state.trace.slice(-200);
  query('#lab-trace-content').innerHTML = visibleTrace.length ? `${state.trace.length > 200 ? '<p class="lab-description">Showing the last 200 trace events.</p>' : ''}<table><thead><tr><th>Step / instruction</th><th>Operation</th><th>Result</th></tr></thead><tbody>${visibleTrace.map(event => `<tr><td><code title="${escape(event.statementId)}">${escape(String(event.statementId ?? '').replace(`${String(event.workflowId)}.`, ''))}</code></td><td>${escape(event.kind)} ${escape(event.target ?? '')}</td><td>${escape(event.status)}${event.summary ? ` · ${escape(event.summary)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="lab-empty">The trace will appear after an observation.</p>';
  query('#lab-observation-json').textContent = cursor ? pretty(scenario().events[cursor - 1]?.event) : 'No observation yet.';
}

function render(): void { renderTimeline(); renderProgram(); renderKnowledge(); renderTrace(); controls(); }

async function reset(): Promise<void> {
  busy = true; initializing = true; controls();
  query('#lab-error').hidden = true;
  try {
    state = await request({ type: 'initialize', bundle });
    cursor = 0; selectedNode = ''; stopped = false;
    status('Ready in your browser');
    render();
  } catch (error) { showError(error); }
  finally { busy = false; initializing = false; controls(); }
}

async function advance(all: boolean): Promise<void> {
  if (busy) return;
  busy = true; runAll = all; stopped = false;
  query('#lab-error').hidden = true;
  controls();
  try {
    do {
      const event = scenario().events[cursor];
      if (!event) break;
      status(`Observing ${cursor + 1} of ${scenario().events.length}…`);
      state = await request({ type: 'advance', event: event.event });
      cursor += 1;
      render();
    } while (runAll && !stopped && cursor < scenario().events.length);
    status(stopped ? 'Stopped between observations' : cursor === scenario().events.length ? 'Experiment complete' : 'Ready for the next observation');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') status('Stopped · last completed cycle preserved');
    else showError(error);
  } finally { busy = false; runAll = false; controls(); }
}

query('#lab-nodes').addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-node]');
  if (button) { selectedNode = button.dataset.node ?? ''; renderKnowledge(); }
});
select.addEventListener('change', () => { void reset(); });
runButton.addEventListener('click', () => { void advance(true); });
nextButton.addEventListener('click', () => { void advance(false); });
resetButton.addEventListener('click', () => { void reset(); });
stopButton.addEventListener('click', () => {
  stopped = true; runAll = false;
  worker.postMessage({ id: ++requestId, type: 'cancel' } satisfies LabRequest);
});
window.addEventListener('pagehide', event => { if (!event.persisted) worker.terminate(); });

void loadV7Bundle().then(async loaded => {
  bundle = loaded;
  if (!bundle.scenarios.length) throw new Error('No reference experiment is available.');
  select.innerHTML = bundle.scenarios.map(item => `<option value="${escape(item.id)}">${escape(item.title)}</option>`).join('');
  query('#lab-source-code').textContent = bundle.sources.generators;
  await reset();
}).catch(showError);
