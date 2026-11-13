/** Inspection and revision of the same graph used by the running agent. */
import type { BrowserV6Agent, V6AgentSnapshot } from './runtime/v6-agent.ts';
import type { KnowledgeMemory, KnowledgeNode } from './logos-engine/kernel.ts';
import type { NativeGraphEdit } from './logos-engine/v6-native-types.ts';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const record = (value: unknown): Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];

export class AgentKnowledgePanel {
  private graph: KnowledgeMemory | null = null;
  private state: V6AgentSnapshot | null = null;
  private session: string | null = null;
  private selected = '';
  private working = false;
  private decoded: unknown = null;
  private selectionVersion = 0;
  constructor(private readonly root: HTMLElement, private readonly agent: BrowserV6Agent) {
    root.innerHTML = `<details class="agent-knowledge-details"><summary>Inspect and edit the live reasoning graph</summary>
      <div class="agent-knowledge-toolbar"><button type="button" data-refresh class="secondary-button">Read current graph</button><p data-status role="status">Start a reasoning session to inspect its nodes.</p></div>
      <div class="agent-knowledge-browser" hidden>
        <div class="agent-node-picker"><label>Find a node<input type="search" data-filter placeholder="Program, family, memory or evidence…"></label>
          <label>Node type<select data-kind><option value="main">Programs and state</option><option value="program">Programs</option><option value="family_activation">Family activation</option><option value="component_state">Shared memory</option><option value="prefix_evidence">Observed prefixes</option><option value="state_fragment">Stored fragments</option><option value="all">All nodes</option></select></label>
          <label>Retained nodes<select data-nodes size="9" aria-label="Retained reasoning nodes"></select></label><p data-count class="agent-knowledge-hint"></p></div>
        <div class="agent-node-detail"><p data-node-title class="agent-node-title">Select a node.</p><div data-program-tree class="agent-program-tree"></div>
          <details><summary>Stored node and provenance</summary><pre data-node-json></pre></details>
          <details data-editor hidden><summary>Edit this program</summary><p class="agent-knowledge-hint">Edit the current program tree. A validated revision becomes the program used for the next decision.</p><label>Program JSON<textarea data-program spellcheck="false" rows="16"></textarea></label></details>
          <div data-activation hidden><label class="agent-family-toggle"><input type="checkbox" data-enabled> Enable this reasoning family</label></div>
          <div data-edit-controls hidden><label>Reason for this revision<input type="text" data-reason maxlength="1000" placeholder="Describe the reasoning change"></label><button type="button" data-apply class="secondary-button">Apply validated revision</button></div>
          <p data-edit-help class="agent-knowledge-hint"></p>
        </div>
      </div></details>`;
    this.query<HTMLButtonElement>('[data-refresh]').addEventListener('click', () => { void this.refresh(); });
    this.query<HTMLInputElement>('[data-filter]').addEventListener('input', () => this.renderList());
    this.query<HTMLSelectElement>('[data-kind]').addEventListener('change', () => this.renderList());
    this.query<HTMLSelectElement>('[data-nodes]').addEventListener('change', () => { this.selected = this.query<HTMLSelectElement>('[data-nodes]').value; void this.renderNode(); });
    this.query<HTMLButtonElement>('[data-apply]').addEventListener('click', () => { void this.apply(); });
    this.query<HTMLInputElement>('[data-reason]').addEventListener('input', () => this.controls());
    this.controls();
  }
  private query<T extends HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }
  private message(value: string): void { this.query('[data-status]').textContent = value; }
  /** Closing inspection releases only its detached view, never agent memory. */
  release(): void {
    this.graph = null; this.decoded = null; this.selectionVersion++;
    this.query('.agent-knowledge-browser').hidden = true;
    this.query('[data-nodes]').replaceChildren();
    this.query('[data-program-tree]').replaceChildren();
    this.query('[data-node-json]').textContent = '';
    this.query<HTMLTextAreaElement>('[data-program]').value = '';
    this.message('Read the current graph when you want to inspect its nodes.');
  }
  update(state: V6AgentSnapshot | null): void {
    if (this.session !== state?.sessionId) {
      this.session = state?.sessionId ?? null; this.graph = null; this.decoded = null; this.selected = ''; this.selectionVersion++;
      this.query('.agent-knowledge-browser').hidden = true;
      this.message(this.session ? 'Read the graph after the current reasoning operation.' : 'Start a reasoning session to inspect its nodes.');
    }
    this.state = state; this.controls();
  }
  private editable(): boolean {
    return !!this.graph && this.graph.chain === this.state?.graphChain && this.state.phase === 'sealed_prefix' && !this.state.busy && !this.working;
  }
  private controls(): void {
    this.query<HTMLButtonElement>('[data-refresh]').disabled = !this.state?.sessionId || !!this.state.busy || this.working;
    const selected = this.graph?.nodes[this.selected], canEdit = selected?.kind === 'program' || selected?.kind === 'family_activation';
    const allowed = this.editable();
    this.query<HTMLButtonElement>('[data-apply]').disabled = !canEdit || !allowed || !this.decoded || !this.query<HTMLInputElement>('[data-reason]').value.trim();
    this.query<HTMLTextAreaElement>('[data-program]').disabled = !allowed;
    this.query<HTMLInputElement>('[data-enabled]').disabled = !allowed;
    this.query<HTMLInputElement>('[data-reason]').disabled = !allowed;
    this.query('[data-edit-help]').textContent = !this.graph ? '' : this.graph.chain !== this.state?.graphChain
      ? 'The graph has changed. Read its current revision before editing.'
      : this.state?.phase !== 'sealed_prefix' ? 'Inspection is available. Finish the current action sequence before editing its program.'
      : canEdit ? 'Changes are checked and recorded as a new revision. They do not play a game action.' : 'This node retains acquired state or evidence. Its provenance is available above.';
  }
  private async refresh(): Promise<void> {
    if (this.working) return;
    const version = this.selectionVersion;
    this.working = true; this.controls(); this.message('Reading the retained graph…');
    try {
      const graph = await this.agent.inspectKnowledge();
      if (version !== this.selectionVersion) return;
      this.graph = graph;
      this.query('.agent-knowledge-browser').hidden = false;
      this.message(`${Object.keys(this.graph.nodes).length} nodes · ${this.graph.deltas.length} recorded revisions · graph ${this.graph.chain?.slice(0, 12)}`);
      this.renderList();
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
    finally { this.working = false; this.controls(); }
  }
  private renderList(): void {
    if (!this.graph) return;
    const search = this.query<HTMLInputElement>('[data-filter]').value.trim().toLowerCase(), kind = this.query<HTMLSelectElement>('[data-kind]').value;
    const matches = Object.values(this.graph.nodes).filter(node => (kind === 'all' || kind === 'main' && node.kind !== 'state_fragment' || node.kind === kind)
      && `${node.id} ${node.kind}`.toLowerCase().includes(search));
    matches.sort((a, b) => a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'program' ? -1 : b.kind === 'program' ? 1 : a.kind.localeCompare(b.kind));
    const shown = matches.slice(0, 250);
    if (!shown.some(node => node.id === this.selected)) this.selected = shown[0]?.id ?? '';
    this.query<HTMLSelectElement>('[data-nodes]').innerHTML = shown.map(node => `<option value="${escape(node.id)}"${node.id === this.selected ? ' selected' : ''}>${escape(node.id)} · r${node.revision}</option>`).join('');
    this.query('[data-count]').textContent = shown.length < matches.length ? `Showing ${shown.length} of ${matches.length} matching nodes. Refine the search to find another node.` : `${matches.length} matching nodes.`;
    void this.renderNode();
  }
  private async renderNode(): Promise<void> {
    const node = this.graph?.nodes[this.selected], version = ++this.selectionVersion; this.decoded = null;
    this.query('[data-program-tree]').innerHTML = '';
    for (const selector of ['[data-editor]', '[data-activation]', '[data-edit-controls]']) this.query(selector).hidden = true;
    this.query('[data-node-title]').textContent = node ? `${node.id} · revision ${node.revision}` : 'No matching node.';
    this.query('[data-node-json]').textContent = node ? JSON.stringify(node, null, 2) : '';
    this.controls(); if (!node || !['program', 'family_activation'].includes(node.kind)) return;
    try {
      const { decodeNativeState } = await import('./logos-engine/v6-knowledge-store.ts');
      const value = record(decodeNativeState(node.value!));
      if (version !== this.selectionVersion) return;
      this.decoded = value;
      this.query('[data-edit-controls]').hidden = false;
      if (node.kind === 'program') {
        this.query('[data-editor]').hidden = false;
        this.query<HTMLTextAreaElement>('[data-program]').value = JSON.stringify(value.module, null, 2);
        this.query('[data-program-tree]').innerHTML = renderProgramTree(value.module);
      } else {
        this.query('[data-activation]').hidden = false;
        this.query<HTMLInputElement>('[data-enabled]').checked = value.enabled === true;
      }
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
    this.controls();
  }
  private async apply(): Promise<void> {
    const node: KnowledgeNode | undefined = this.graph?.nodes[this.selected];
    if (!node || !this.editable() || !this.decoded) return;
    try {
      const changes: NativeGraphEdit['changes'] = node.kind === 'program'
        ? [{ type: 'replace_program', programId: node.id.slice('program:'.length), module: JSON.parse(this.query<HTMLTextAreaElement>('[data-program]').value) }]
        : [{ type: 'set_family_enabled', familyId: String(node.family), enabled: this.query<HTMLInputElement>('[data-enabled]').checked }];
      this.working = true; this.controls(); this.message('Validating the proposed revision…');
      await this.agent.edit({ expectedGraphChain: this.graph!.chain!, reason: this.query<HTMLInputElement>('[data-reason]').value.trim(), changes });
      this.query<HTMLInputElement>('[data-reason]').value = '';
      this.working = false; await this.refresh();
      this.message(`Revision saved. The next decision will use the updated ${node.kind === 'program' ? 'program' : 'family activation'}.`);
    } catch (error) { this.message(error instanceof Error ? error.message : String(error)); }
    finally { this.working = false; this.controls(); }
  }
}

function renderProgramTree(module: unknown): string {
  const label = (value: unknown): string => {
    const item = record(value);
    return item.kind === 'list' ? `[${list(item.items).map(label).join(', ')}]` : String(item.value ?? item.kind ?? '');
  };
  const statements = (items: unknown): string => `<ul>${list(items).map(value => {
    const item = record(value);
    return `<li><code title="${escape(item.id)}">${escape(item.kind)} ${escape(label(item.expression))}${item.result_binding ? ` → ${escape(item.result_binding)}` : ''}</code>${list(item.body).length ? statements(item.body) : ''}${list(item.else_body).length ? `<p>ELSE</p>${statements(item.else_body)}` : ''}</li>`;
  }).join('')}</ul>`;
  return list(record(module).workflows).map(workflow => `<h4>${escape(workflow.id)}</h4>${list(workflow.steps).map((step, index) => `<details${index === 0 ? ' open' : ''}><summary>${escape(step.id)}</summary>${statements(step.statements)}</details>`).join('')}`).join('');
}
