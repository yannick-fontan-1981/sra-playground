import type { DirectionalReturn } from './directional-return.ts';
import { defaultStrategyRules, matchStrategy, matchesStrategyRule, strategyFacts, type StrategyRule, type strategyTimeline } from './strategy-timeline.ts';

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
    return defaultStrategyRules.map(rule => {
      const entry = saved.find(item => item?.id === rule.id);
      if (!entry || typeof entry.need !== 'string' || typeof entry.situation !== 'string'
          || !Array.isArray(entry.when) || !Array.isArray(entry.whenAny)) return rule;
      const candidate = { ...rule, need: entry.need, situation: entry.situation, when: entry.when, whenAny: entry.whenAny };
      if (typeof entry.title === 'string') candidate.title = entry.title;
      return validRule(candidate) ? candidate : rule;
    });
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

/** Keep the editor mounted when game returns redraw the timeline. */
export class StrategyEditor {
  private rules = readRules();
  private readonly drafts = new Map<string, StrategyRule>();
  private readonly rulePicker = document.createElement('select');
  private readonly title = document.createElement('input');
  private readonly need = document.createElement('textarea');
  private readonly situation = document.createElement('textarea');
  private readonly conditionFields = new Map<string, HTMLSelectElement>();
  private readonly preview = document.createElement('div');
  private readonly summary = document.createElement('p');
  private readonly feedback = document.createElement('p');
  private readonly save = document.createElement('button');
  private timeline: Timeline = [];
  private renderEvidence: RenderEvidence = () => [];
  private onSave = () => {};

  constructor(container: HTMLElement) {
    const details = document.createElement('details');
    details.className = 'sic-details sic-strategy-editor';
    const heading = document.createElement('summary');
    heading.textContent = 'Edit strategy rules';
    const form = document.createElement('form');
    const scope = document.createElement('p');
    scope.textContent = 'Rules label the strategy timeline. Changes are saved in this browser.';
    for (const rule of this.rules) this.rulePicker.add(new Option(rule.title, rule.id));
    this.rulePicker.addEventListener('change', () => this.loadDraft());
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
    this.save.textContent = 'Save rule';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Load defaults';
    reset.addEventListener('click', () => {
      const rule = defaultStrategyRules.find(item => item.id === this.rulePicker.value)!;
      this.drafts.set(rule.id, rule);
      this.loadDraft();
    });
    actions.append(this.save, reset);
    this.feedback.setAttribute('role', 'status');
    form.append(scope, labeled('Strategy rule', this.rulePicker), labeled('Rule name', this.title), labeled('Need', this.need),
      labeled('Situation', this.situation), conditions, actions, this.feedback);
    form.addEventListener('input', event => {
      if (event.target === this.rulePicker) return;
      const rule = this.selectedRule;
      const when: string[] = [], whenAny: string[] = [];
      for (const [fact, input] of this.conditionFields) {
        if (input.value === 'when') when.push(fact);
        if (input.value === 'whenAny') whenAny.push(fact);
      }
      this.drafts.set(rule.id, { ...rule, title: this.title.value, need: this.need.value, situation: this.situation.value, when, whenAny });
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
    this.preview.className = 'sic-strategy-rule-matches';
    details.append(heading, form, previewTitle, this.summary, this.preview);
    container.append(details);
    details.addEventListener('toggle', () => { if (details.open) this.showPreview(); });
    this.loadDraft();
  }

  get activeRules(): readonly StrategyRule[] { return this.rules; }

  update(timeline: Timeline, renderEvidence: RenderEvidence, onSave: () => void): void {
    this.timeline = timeline;
    this.renderEvidence = renderEvidence;
    this.onSave = onSave;
    if (this.preview.closest('details')?.open) this.showPreview();
  }

  private get selectedRule(): StrategyRule {
    return this.rules.find(rule => rule.id === this.rulePicker.value)!;
  }

  private loadDraft(): void {
    const rule = this.drafts.get(this.rulePicker.value) ?? this.selectedRule;
    this.title.value = rule.title;
    this.need.value = rule.need;
    this.situation.value = rule.situation;
    for (const [fact, input] of this.conditionFields) {
      input.value = rule.when?.includes(fact) ? 'when' : rule.whenAny?.includes(fact) ? 'whenAny' : '';
    }
    this.feedback.textContent = '';
    this.showPreview();
  }

  private saveDraft(): void {
    const rule = this.drafts.get(this.rulePicker.value);
    if (!rule || !validRule(rule)) return;
    const updated = this.rules.map(existing => existing.id === rule.id
      ? { ...rule, title: rule.title.trim(), need: rule.need.trim(), situation: rule.situation.trim() } : existing);
    let saved = true;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      saved = false;
    }
    this.rules = updated;
    this.rulePicker.options[this.rulePicker.selectedIndex]!.text = this.selectedRule.title;
    this.drafts.delete(rule.id);
    this.loadDraft();
    this.onSave();
    this.feedback.textContent = saved ? 'Rule saved. Timeline updated.' : 'Timeline updated for this page. Browser storage is unavailable.';
  }

  private showPreview(): void {
    const rule = this.drafts.get(this.rulePicker.value) ?? this.selectedRule;
    const valid = validRule(rule);
    this.save.disabled = !valid || !this.drafts.has(rule.id);
    const expanded = new Set([...this.preview.querySelectorAll<HTMLDetailsElement>('details[open]')].map(item => item.dataset.match));
    this.preview.replaceChildren();
    if (!valid) {
      this.summary.textContent = 'Enter a name, need and situation, and select at least one condition.';
      return;
    }
    if (!this.timeline.length) {
      this.summary.textContent = 'Run the agent to preview this rule against observed returns.';
      return;
    }
    const configurations = this.rules.map(existing => existing.id === rule.id ? rule : existing);
    const matching = this.timeline.filter(episode => matchesStrategyRule(episode.facts, rule));
    const applied = matching.filter(episode => matchStrategy(episode.facts, configurations)?.id === rule.id).length;
    this.summary.textContent = `${matching.length} of ${this.timeline.length} recorded plan episodes match. Shown in the timeline for ${applied} after rule priority.`;
    for (const episode of [...matching].reverse()) {
      const { first, last, previous } = episode;
      const match = document.createElement('details');
      match.dataset.match = `${rule.id}:${first.sessionId}:${first.sequence}`;
      match.open = expanded.has(match.dataset.match);
      const title = document.createElement('summary');
      const range = first.sequence === last.sequence ? `action ${first.sequence}` : `actions ${first.sequence}–${last.sequence}`;
      const appliedRule = matchStrategy(episode.facts, configurations);
      title.textContent = `Level ${first.fromLevel} · ${range}${appliedRule?.id !== rule.id ? ` · ${appliedRule?.title} takes priority` : ''}`;
      match.append(title);
      const showEvidence = () => {
        if (!match.open || match.childElementCount > 1) return;
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
}
