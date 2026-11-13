import type { DirectionalReturn } from './directional-return.ts';
import { auditStrategyPriority, countStrategyFacts, StrategyCoverage, type FactGroup } from './strategy-coverage.ts';
import { defaultStrategyRules, matchStrategy, matchesStrategyRule, strategyClassificationChanges, strategyFacts,
  type StrategyRule, type strategyTimeline } from './strategy-timeline.ts';

const storageKey = 'sra-playground.sic.strategy-rules.v1';
const textLimit = 500;
const factEntries = Object.entries(strategyFacts);
const knownFacts = new Set(Object.keys(strategyFacts));

function validRule(rule: StrategyRule): boolean {
  const conditions = [...(rule.when ?? []), ...(rule.whenAny ?? [])];
  return Boolean(rule.title.trim() && rule.need.trim() && rule.situation.trim())
    && rule.title.length <= 120
    && rule.need.length <= textLimit && rule.situation.length <= textLimit
    && conditions.length > 0 && new Set(conditions).size === conditions.length
    && conditions.every(fact => knownFacts.has(fact));
}

function readRules(): readonly StrategyRule[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null');
    if (!Array.isArray(saved)) return defaultStrategyRules;
    const remaining = new Map(defaultStrategyRules.map(rule => [rule.id, rule]));
    const restored: StrategyRule[] = [];
    for (const entry of saved) {
      const rule = remaining.get(entry?.id);
      if (!rule) continue;
      remaining.delete(rule.id);
      const candidate = {
        ...rule,
        title: typeof entry.title === 'string' ? entry.title : rule.title,
        need: typeof entry.need === 'string' ? entry.need : rule.need,
        situation: typeof entry.situation === 'string' ? entry.situation : rule.situation,
        when: Array.isArray(entry.when) ? entry.when : undefined,
        whenAny: Array.isArray(entry.whenAny) ? entry.whenAny : undefined,
      };
      restored.push(validRule(candidate) ? candidate : rule);
    }
    return [...restored, ...remaining.values()];
  } catch {
    return defaultStrategyRules;
  }
}

function labeled(label: string, control: HTMLElement): HTMLLabelElement {
  const element = document.createElement('label');
  const caption = document.createElement('span');
  caption.textContent = label;
  control.setAttribute('aria-label', label);
  element.append(caption, control);
  return element;
}

type Timeline = ReturnType<typeof strategyTimeline>;
type RenderEvidence = (item: DirectionalReturn, caption: string) => readonly HTMLElement[];

function episodeLabel(first: DirectionalReturn, last: DirectionalReturn) {
  const range = first.sequence === last.sequence ? `action ${first.sequence}` : `actions ${first.sequence}–${last.sequence}`;
  return `Level ${first.fromLevel} · ${range}`;
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  return element;
}

/** Keep the editor mounted when game returns redraw the timeline. */
export class StrategyEditor {
  private rules = readRules();
  private order = this.rules.map(rule => rule.id);
  private readonly coverage = new StrategyCoverage();
  private groups: FactGroup[] = [];
  private game: string | null = null;
  private readonly auditScope = document.createElement('select');
  private readonly auditSummary = document.createElement('p');
  private readonly auditList = document.createElement('ul');
  private readonly drafts = new Map<string, StrategyRule>();
  private readonly rulePicker = document.createElement('select');
  private readonly priority = document.createElement('select');
  private readonly restoreOrder = button('Restore saved order');
  private readonly title = document.createElement('input');
  private readonly need = document.createElement('textarea');
  private readonly situation = document.createElement('textarea');
  private readonly conditionFields = new Map<string, HTMLSelectElement>();
  private readonly preview = document.createElement('div');
  private readonly summary = document.createElement('p');
  private readonly impactTitle = document.createElement('h5');
  private readonly impactSummary = document.createElement('p');
  private readonly impactList = document.createElement('div');
  private readonly feedback = document.createElement('p');
  private readonly save = document.createElement('button');
  private timeline: Timeline = [];
  private renderEvidence: RenderEvidence = () => [];
  private onSave = () => {};

  constructor(container: HTMLElement) {
    const audit = document.createElement('section');
    audit.className = 'sic-strategy-audit';
    const auditHeading = document.createElement('h5');
    auditHeading.textContent = 'Rule priority audit';
    this.auditScope.addEventListener('change', () => this.showAudit());
    audit.append(auditHeading, labeled('Games to compare', this.auditScope), this.auditSummary, this.auditList);
    this.showAuditScopes();
    const details = document.createElement('details');
    details.className = 'sic-details sic-strategy-editor';
    const heading = document.createElement('summary');
    heading.textContent = 'Edit strategy rules';
    const form = document.createElement('form');
    const scope = document.createElement('p');
    scope.textContent = 'Rules label the strategy timeline. Changes are saved in this browser.';
    this.showOrder(this.order[0]!);
    this.rulePicker.addEventListener('change', () => this.loadDraft());
    this.priority.addEventListener('change', () => {
      const selected = this.rulePicker.value;
      this.order = this.order.filter(id => id !== selected);
      this.order.splice(Number(this.priority.value), 0, selected);
      this.showOrder(selected);
      this.feedback.textContent = '';
      this.showPreview();
    });
    this.restoreOrder.addEventListener('click', () => {
      this.order = this.rules.map(rule => rule.id);
      this.showOrder(this.rulePicker.value);
      this.feedback.textContent = '';
      this.showPreview();
    });
    this.title.required = true;
    this.title.maxLength = 120;
    for (const input of [this.need, this.situation]) {
      input.rows = 2;
      input.maxLength = textLimit;
      input.required = true;
    }
    const conditions = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Conditions';
    const hint = document.createElement('p');
    hint.textContent = 'All required facts must hold. If you add alternatives, at least one must also hold.';
    conditions.append(legend, hint);
    for (const [fact, label] of factEntries) {
      const input = document.createElement('select');
      input.add(new Option('Ignore', ''));
      input.add(new Option('Required', 'when'));
      input.add(new Option('Alternative', 'whenAny'));
      this.conditionFields.set(fact, input);
      conditions.append(labeled(label, input));
    }
    const actions = document.createElement('div');
    actions.className = 'sic-strategy-editor-actions';
    this.save.type = 'submit';
    this.save.textContent = 'Save changes';
    const reset = button('Load rule defaults');
    reset.addEventListener('click', () => {
      const rule = defaultStrategyRules.find(item => item.id === this.rulePicker.value)!;
      this.drafts.set(rule.id, rule);
      this.loadDraft();
    });
    actions.append(this.save, reset, this.restoreOrder);
    this.feedback.setAttribute('role', 'status');
    const priorityHint = document.createElement('p');
    priorityHint.textContent = 'The first matching rule labels each episode. Position 1 has highest priority.';
    form.append(scope, labeled('Strategy rule', this.rulePicker), labeled('Priority position', this.priority),
      priorityHint, labeled('Rule name', this.title), labeled('Need', this.need),
      labeled('Situation', this.situation), conditions, actions, this.feedback);
    form.addEventListener('input', event => {
      if (event.target === this.rulePicker || event.target === this.priority) return;
      const rule = this.selectedRule;
      const when: string[] = [], whenAny: string[] = [];
      for (const [fact, input] of this.conditionFields) {
        if (input.value === 'when') when.push(fact);
        if (input.value === 'whenAny') whenAny.push(fact);
      }
      this.drafts.set(rule.id, { ...rule, title: this.title.value, need: this.need.value, situation: this.situation.value, when, whenAny });
      if (event.target === this.title) this.updateRuleLabel(rule.id, this.title.value);
      this.feedback.textContent = '';
      this.showPreview();
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      this.saveDraft();
    });
    const previewTitle = document.createElement('h5');
    previewTitle.textContent = 'Matching returns in this session';
    this.summary.setAttribute('aria-live', 'polite');
    this.impactTitle.textContent = 'Classification changes before saving';
    this.impactSummary.setAttribute('aria-live', 'polite');
    this.impactList.className = 'sic-strategy-rule-matches sic-strategy-rule-impact';
    this.preview.className = 'sic-strategy-rule-matches';
    details.append(heading, form, this.impactTitle, this.impactSummary, this.impactList, previewTitle, this.summary, this.preview);
    container.append(audit, details);
    details.addEventListener('toggle', () => { if (details.open) this.showPreview(); });
    this.loadDraft();
  }

  get activeRules(): readonly StrategyRule[] { return this.rules; }

  update(game: string | null, timeline: Timeline, renderEvidence: RenderEvidence, onSave: () => void): void {
    this.game = game;
    this.timeline = timeline;
    this.groups = countStrategyFacts(timeline);
    if (game) this.coverage.record(game, this.groups);
    this.showAuditScopes();
    this.renderEvidence = renderEvidence;
    this.onSave = onSave;
    this.showAudit();
    if (this.preview.closest('details')?.open) this.showPreview();
  }

  private showAuditScopes(): void {
    const selected = this.auditScope.value;
    const games = [...this.coverage.samples.keys()].sort();
    const options = [new Option('Current session', 'session'), new Option(`All recorded games (${games.length})`, 'all')];
    for (const game of games) options.push(new Option(game, game));
    this.auditScope.replaceChildren(...options);
    this.auditScope.value = options.some(option => option.value === selected) ? selected : 'session';
  }

  private showAudit(): void {
    const scope = this.auditScope.value;
    const samples = this.coverage.samples;
    const groups = scope === 'session' ? this.groups : scope === 'all' ? [...samples.values()].flat() : samples.get(scope) ?? [];
    const episodes = groups.reduce((total, group) => total + group.count, 0);
    const source = scope === 'session' ? this.game ?? 'Current session'
      : scope === 'all' ? `${samples.size} recorded games` : scope;
    const draft = this.pendingRules;
    const hasDraft = this.drafts.size > 0 || this.orderChanged;
    const validDraft = hasDraft && draft.every(validRule);
    const results = auditStrategyPriority(groups, validDraft ? draft : this.rules);
    this.auditList.replaceChildren();
    const extent = scope === 'all' ? ' · latest sample per game' : '';
    const version = validDraft ? ' · draft rules' : ' · saved rules';
    this.auditSummary.textContent = `${source} · ${episodes} recorded episodes${extent}${version}.`;
    if (!episodes) {
      this.auditSummary.textContent += ' Run the agent to collect evidence.';
      return;
    }
    for (const { rule, matches, first, winners } of results) {
      const row = document.createElement('li');
      const name = document.createElement('strong');
      const status = document.createElement('span');
      name.textContent = rule.title;
      status.textContent = !matches ? 'No matching episodes' : !first
        ? `Always outranked · 0 of ${matches} ranked first`
        : `${first} of ${matches} ranked first`;
      if (matches && !first) row.dataset.alwaysOutranked = '';
      row.append(name, status);
      if (winners.size) {
        const competing = document.createElement('p');
        competing.textContent = 'Ranked first instead · ' + [...winners].map(([winner, count]) =>
          `${winner.title} (${count})`).join(' · ');
        row.append(competing);
      }
      this.auditList.append(row);
    }
  }

  private get selectedRule(): StrategyRule {
    return this.rules.find(rule => rule.id === this.rulePicker.value)!;
  }

  private get pendingRules(): StrategyRule[] {
    const byId = new Map(this.rules.map(rule => [rule.id, this.drafts.get(rule.id) ?? rule]));
    return this.order.map(id => byId.get(id)!);
  }

  private get orderChanged(): boolean {
    return this.order.some((id, index) => id !== this.rules[index]?.id);
  }

  private showOrder(selected: string): void {
    const configurations = this.pendingRules;
    this.rulePicker.replaceChildren(...configurations.map((rule, index) => new Option(`${index + 1}. ${rule.title || 'Unnamed rule'}`, rule.id)));
    this.rulePicker.value = selected;
    this.priority.replaceChildren(...configurations.map((_, index) =>
      new Option(index === 0 ? '1 · Highest' : String(index + 1), String(index))));
    this.priority.value = String(this.order.indexOf(selected));
    this.restoreOrder.disabled = !this.orderChanged;
  }

  private updateRuleLabel(id: string, title: string): void {
    const index = this.order.indexOf(id);
    this.rulePicker.options[index]!.text = `${index + 1}. ${title || 'Unnamed rule'}`;
  }

  private loadDraft(): void {
    const rule = this.drafts.get(this.rulePicker.value) ?? this.selectedRule;
    this.title.value = rule.title;
    this.updateRuleLabel(rule.id, rule.title);
    this.need.value = rule.need;
    this.situation.value = rule.situation;
    for (const [fact, input] of this.conditionFields) {
      input.value = rule.when?.includes(fact) ? 'when' : rule.whenAny?.includes(fact) ? 'whenAny' : '';
    }
    this.feedback.textContent = '';
    this.showPreview();
  }

  private saveDraft(): void {
    const proposed = this.pendingRules;
    if ((!this.drafts.size && !this.orderChanged) || proposed.some(rule => !validRule(rule))) return;
    const updated = proposed.map(rule => ({
      ...rule, title: rule.title.trim(), need: rule.need.trim(), situation: rule.situation.trim(),
    }));
    let saved = true;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      saved = false;
    }
    this.rules = updated;
    this.drafts.clear();
    this.showOrder(this.rulePicker.value);
    this.loadDraft();
    this.onSave();
    this.feedback.textContent = saved ? 'Changes saved. Timeline updated.' : 'Timeline updated for this page. Browser storage is unavailable.';
  }

  private showPreview(): void {
    const rule = this.drafts.get(this.rulePicker.value) ?? this.selectedRule;
    const configurations = this.pendingRules;
    const invalid = configurations.find(candidate => !validRule(candidate));
    this.save.disabled = Boolean(invalid) || (!this.drafts.size && !this.orderChanged);
    this.showAudit();
    this.showImpact(configurations, invalid);
    const expanded = new Set([...this.preview.querySelectorAll<HTMLDetailsElement>('details[open]')].map(item => item.dataset.match));
    this.preview.replaceChildren();
    if (!validRule(rule)) {
      this.summary.textContent = 'Enter a name, need and situation, and select at least one condition.';
      return;
    }
    if (!this.timeline.length) {
      this.summary.textContent = 'Run the agent to preview this rule against observed returns.';
      return;
    }
    const matching = this.timeline.filter(episode => matchesStrategyRule(episode.facts, rule));
    const applied = matching.filter(episode => matchStrategy(episode.facts, configurations)?.id === rule.id).length;
    this.summary.textContent = `${matching.length} of ${this.timeline.length} recorded plan episodes match. This rule ranks first for ${applied}.`;
    for (const episode of [...matching].reverse()) {
      const { first, last, previous } = episode;
      const match = document.createElement('details');
      match.dataset.match = `${rule.id}:${first.sessionId}:${first.sequence}`;
      match.open = expanded.has(match.dataset.match);
      const title = document.createElement('summary');
      const appliedRule = matchStrategy(episode.facts, configurations);
      title.textContent = episodeLabel(first, last) + (appliedRule?.id !== rule.id ? ` · ${appliedRule?.title} takes priority` : '');
      match.append(title);
      const showEvidence = () => {
        if (!match.open || match.childElementCount > 1) return;
        const competing = configurations.filter(candidate => matchesStrategyRule(episode.facts, candidate));
        if (competing.length > 1) {
          const order = document.createElement('p');
          order.textContent = `Matching rules in priority order · ${competing.map(candidate => candidate.title).join(' → ')}`;
          match.append(order);
        }
        const facts = document.createElement('ul');
        const selectedFacts = [...(rule.when ?? []), ...(rule.whenAny ?? [])];
        for (const [fact, label] of factEntries) {
          if (!selectedFacts.includes(fact)) continue;
          const item = document.createElement('li');
          const present = [...episode.facts].some(value => value === fact);
          item.textContent = `${label} · ${present ? 'Observed' : 'No evidence here'}`;
          facts.append(item);
        }
        match.append(facts);
        const evidence = first === last ? [first] : [first, last];
        if (selectedFacts.includes('previousPredictionFailed') && previous?.nativeCheck?.matched === false) evidence.unshift(previous);
        const frames = evidence.flatMap(item => this.renderEvidence(item, `Action ${item.sequence}`));
        if (frames.length) match.append(...frames);
        else {
          const note = document.createElement('p');
          note.textContent = 'No localized sprites were retained for these returns.';
          match.append(note);
        }
      };
      match.addEventListener('toggle', showEvidence);
      this.preview.append(match);
      showEvidence();
    }
  }

  private showImpact(configurations: readonly StrategyRule[], invalid?: StrategyRule): void {
    this.impactList.replaceChildren();
    this.impactTitle.hidden = this.impactSummary.hidden = !this.drafts.size && !this.orderChanged;
    this.impactSummary.textContent = '';
    if (this.impactTitle.hidden) return;
    if (invalid) {
      this.impactSummary.textContent = `Complete the fields and conditions for ${invalid.title || 'the unnamed rule'} to see the changes.`;
      return;
    }
    if (!this.timeline.length) {
      this.impactSummary.textContent = 'Run the agent to compare classifications on observed episodes.';
      return;
    }
    const changes = strategyClassificationChanges(this.timeline, configurations);
    this.impactSummary.textContent = changes.length
      ? `${changes.length} of ${this.timeline.length} recorded plan episodes would change classification.`
      : 'No recorded episodes would change classification.';
    if (!changes.length) return;
    const list = document.createElement('ol');
    for (const { episode, saved, proposed } of [...changes].reverse()) {
      const row = document.createElement('li');
      row.textContent = `${episodeLabel(episode.first, episode.last)} · ${saved?.title ?? 'Unclassified'} → ${proposed?.title ?? 'Unclassified'}`;
      list.append(row);
    }
    this.impactList.append(list);
  }
}
