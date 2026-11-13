import type { AgentAction } from '../runtime/contracts.ts';
import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';
import type { ClickEffectCount } from './click-evidence.ts';
import type { Applicability, ControlEffectResolution } from './know-control-effect.ts';
import type { ShadowView } from './shadow.ts';
import type { SituationKey } from './situation.ts';

const commands: Readonly<Record<number, string>> = {
  1: 'Up', 2: 'Down', 3: 'Left', 4: 'Right', 5: 'Space', 6: 'Click', 7: 'Action 7',
};

const discriminants: Record<SituationKey, string> = {
  controlModel: 'how the command controls the subject',
  commandAvailable: 'whether the specific command is available',
  subjectObservable: 'whether the same subject can be identified before and after',
  effectIsolatable: 'whether the effect can be attributed to the command',
  riskBounded: 'whether the experiment has a known risk limit',
  experimentPending: 'whether an experiment is already pending',
  passiveObservationPossible: 'whether a normal game return can provide evidence',
};

const nextEvidence: Record<SituationKey, string> = {
  controlModel: 'Identify what the command controls and how.',
  commandAvailable: 'Check whether the specific command is available on this board.',
  subjectObservable: 'Find the same subject before and after the action.',
  effectIsolatable: 'Check what changed because of the command.',
  riskBounded: 'Check what the experiment could affect.',
  experimentPending: 'Check whether an experiment is already in progress.',
  passiveObservationPossible: 'Check whether a normal game return can provide evidence.',
};

const statusLabels: Record<Applicability, string> = {
  applicable: 'Fits the evidence',
  not_applicable: 'Ruled out',
  unknown: 'Needs evidence',
};

const summaries: Record<ControlEffectResolution['outcome'], string> = {
  candidate: 'A method fits the current evidence.',
  needs_evidence: 'More evidence is needed.',
  ambiguous: 'Several methods fit. The evidence does not distinguish them.',
  uncovered: 'The current evidence rules out the methods in this preview.',
  closed: 'This board is at a game boundary.',
  stale: 'Waiting for a current observation.',
  unscoped: 'The command and its subject need to be identified.',
};

function actionLabel(action: AgentAction): string {
  return action.id === 6 ? `Click at (${action.data.x}, ${action.data.y})` : commands[action.id]!;
}

function selectPerspective(panel: HTMLElement, selected: HTMLButtonElement): void {
  for (const tab of panel.querySelectorAll<HTMLButtonElement>('[data-sic-tabs] [role="tab"]')) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panel.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`)!.hidden = !active;
  }
}

function filterClickRows(panel: HTMLElement): void {
  const selectedLevel = panel.querySelector<HTMLSelectElement>('[data-sic-level]')!.value;
  for (const row of panel.querySelectorAll<HTMLElement>('[data-sic-returns] [data-level]')) {
    row.hidden = selectedLevel !== '' && row.dataset.level !== selectedLevel;
  }
}

export function bindSicPerspectives(panel: HTMLElement): void {
  const tabList = panel.querySelector<HTMLElement>('[data-sic-tabs]')!;
  const tabs = [...tabList.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  for (const tab of tabs) tab.addEventListener('click', () => selectPerspective(panel, tab));
  tabList.addEventListener('keydown', event => {
    const index = tabs.findIndex(tab => tab === event.target);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    tabs[next]!.focus();
    selectPerspective(panel, tabs[next]!);
  });
  panel.querySelector('[data-sic-level]')!.addEventListener('change', () => filterClickRows(panel));
}

function showReturn(panel: HTMLElement, receipt: NativeClickReturn): void {
  selectPerspective(panel, panel.querySelector<HTMLButtonElement>('#sic-perceptions-tab')!);
  panel.querySelector<HTMLSelectElement>('[data-sic-level]')!.value = String(receipt.fromLevel);
  filterClickRows(panel);
  panel.querySelector<HTMLElement>(`[data-sic-return-sequence="${receipt.sequence}"]`)?.focus();
}

function describeClickReturn(receipt: NativeClickReturn): [string, string] {
  const target = receipt.target;
  const before = target
    ? `Before: ${target.pixels} pixels in palette color ${target.palette} at the click point.`
    : 'Before: no visible region identified at the click point.';
  if (receipt.boundary) return [before, receipt.fromLevel !== receipt.toLevel
    ? `After: the game advanced to level ${receipt.toLevel}. The local effect is uncertain across this boundary.`
    : 'After: the game reported a boundary. The local effect is uncertain.'];
  if (!target) return [before, 'After: the local effect could not be measured.'];
  if (receipt.sameSupport && receipt.atPointAfter && receipt.atPointAfter.palette !== target.palette) {
    return [before, `After: palette color ${receipt.atPointAfter.palette}, with the same shape and position.`];
  }
  return [before, receipt.changedTargetPixels
    ? `After: ${receipt.changedTargetPixels} of ${target.pixels} pixels changed. The resulting region could not be matched exactly.`
    : 'After: the region kept the same visible pixels.'];
}

function renderClickReturns(panel: HTMLElement, returns: readonly NativeClickReturn[]): void {
  const levelFilter = panel.querySelector<HTMLSelectElement>('[data-sic-level]')!;
  const previous = levelFilter.value;
  const levels = [...new Set(returns.map(receipt => receipt.fromLevel))].sort((a, b) => a - b);
  levelFilter.replaceChildren(new Option('All observed levels', ''), ...levels.map(level => new Option(String(level))));
  levelFilter.value = levels.includes(Number(previous)) ? previous : '';
  panel.querySelector<HTMLElement>('[data-sic-level-filter]')!.hidden = levels.length < 2;
  panel.querySelector<HTMLElement>('[data-sic-returns-empty]')!.hidden = returns.length > 0;
  const list = panel.querySelector<HTMLUListElement>('[data-sic-returns]')!;
  list.replaceChildren(...[...returns].reverse().map(receipt => {
    const row = document.createElement('li');
    row.dataset.level = String(receipt.fromLevel);
    row.dataset.sicReturnSequence = String(receipt.sequence);
    row.tabIndex = -1;
    const heading = document.createElement('strong');
    heading.textContent = `Level ${receipt.fromLevel} · Action ${receipt.sequence} · Click (${receipt.point.join(', ')})`;
    row.append(heading);
    for (const description of describeClickReturn(receipt)) {
      const line = document.createElement('p');
      line.textContent = description;
      row.append(line);
    }
    return row;
  }));
  filterClickRows(panel);
}

function observedEffect(effect: ClickEffectCount): string {
  if (effect.kind === 'recolor') return `Changed to palette color ${effect.afterPalette} with the same shape and position`;
  if (effect.kind === 'unchanged') return 'Kept the same visible pixels';
  return 'Pixels changed. The resulting region could not be matched exactly';
}

function renderClickComparisons(panel: HTMLElement, evidence: ShadowView['clickEvidence']): void {
  const summary = panel.querySelector<HTMLElement>('[data-sic-comparison-summary]')!;
  const scope = panel.querySelector<HTMLElement>('[data-sic-comparison-scope]')!;
  const list = panel.querySelector<HTMLUListElement>('[data-sic-comparison-list]')!;
  if (!evidence) {
    summary.textContent = 'Run the agent to collect click returns for comparison.';
    scope.textContent = '';
    list.replaceChildren();
    return;
  }
  const repeated = evidence.comparisons.filter(group => group.status === 'repeated').length;
  const varied = evidence.comparisons.filter(group => group.status === 'varied').length;
  const counts = [
    repeated ? `${repeated} ${repeated === 1 ? 'pattern repeated' : 'patterns repeated'}` : 'No repeated pattern yet',
    varied ? `${varied} with different outcomes` : '',
  ].filter(Boolean);
  summary.textContent = counts.join(' · ');
  scope.textContent = [
    'Compared within this session by measured shape, starting color and click position within the region.',
    'The role of the region and whether the result transfers to other situations remain uncertain.',
    evidence.boundaries ? `${evidence.boundaries} game boundary returns excluded.` : '',
    evidence.unidentified ? `${evidence.unidentified} clicks without a visible region excluded.` : '',
    evidence.omitted ? `${evidence.omitted} older clicks outside the retained window.` : '',
  ].filter(Boolean).join(' ');
  const labels = {
    repeated: 'Repeated observation',
    varied: 'Different outcomes',
    single: 'Seen once',
    unresolved: 'Effect uncertain',
  } as const;
  const rows = evidence.comparisons.map(({ example, status, effects, count }) => {
    const row = document.createElement('li');
    const heading = document.createElement('strong');
    const target = example.target!;
    const offset = [example.point[0] - target.box[0], example.point[1] - target.box[1]];
    heading.textContent = `${labels[status]} · ${count} ${count === 1 ? 'click' : 'clicks'}`;
    const condition = document.createElement('p');
    condition.textContent = `${target.pixels} px region · starting palette color ${target.palette} · click offset (${offset.join(', ')})`;
    row.append(heading, condition);
    if (status === 'varied') {
      const uncertainty = document.createElement('p');
      uncertainty.textContent = 'These visible conditions do not predict a single outcome.';
      row.append(uncertainty);
    }
    for (const effect of effects) {
      for (const level of effect.levels) {
        const receipts = effect.returns.filter(receipt => receipt.fromLevel === level);
        const line = document.createElement('div');
        line.className = 'sic-effect-row';
        const outcome = document.createElement('p');
        outcome.textContent = `Level ${level} · ${observedEffect(effect)} · ${receipts.length}×`;
        const inspect = document.createElement('button');
        inspect.type = 'button';
        inspect.className = 'sic-evidence-link';
        inspect.textContent = 'View return';
        inspect.setAttribute('aria-label', `View level ${level}, action ${receipts[0]!.sequence}, in Perceptions`);
        inspect.addEventListener('click', () => showReturn(panel, receipts[0]!));
        line.append(outcome, inspect);
        row.append(line);
      }
    }
    return row;
  });
  list.replaceChildren(...rows);
}

export function renderSicPanel(panel: HTMLElement, view: ShadowView | null): void {
  panel.querySelector<HTMLElement>('[data-sic-context]')!.textContent = view
    ? `${view.gameCode} · Level ${view.frame.scope.level} · Last settled board` : '';
  panel.querySelector<HTMLElement>('[data-sic-summary]')!.textContent = view ? summaries[view.resolution.outcome] : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-commands]')!.textContent = view?.commands.length
    ? view.commands.map(id => commands[id]).join(', ')
    : view ? 'No command available.' : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-next]')!.textContent = view?.nextAction
    ? actionLabel(view.nextAction) : 'No pending action to show.';
  renderClickReturns(panel, view?.clickEvidence?.returns ?? (view?.clickReturn ? [view.clickReturn] : []));
  renderClickComparisons(panel, view?.clickEvidence ?? null);
  const check = view?.returnCheck;
  panel.querySelector<HTMLElement>('[data-sic-return]')!.textContent = !check ? 'No checked return for this board.'
    : check.matched === true ? 'The return matched the V6 plan’s expectation.'
    : check.matched === false ? 'The return differed from the V6 plan’s expectation.'
    : 'V6 could not verify the expected result.';
  const missing = view?.resolution.missing ?? [];
  panel.querySelector<HTMLElement>('[data-sic-evidence]')!.textContent = view?.resolution.candidate?.label
    ?? (missing[0] ? nextEvidence[missing[0]]
      : view?.resolution.outcome === 'closed' ? 'Continue from a playable board to evaluate another situation.'
      : 'SIC uses public observations and verified returns from V6.');
  const details = panel.querySelector<HTMLDetailsElement>('[data-sic-details]')!;
  details.hidden = !view?.resolution.branches.length;
  const methods = panel.querySelector<HTMLUListElement>('[data-sic-methods]')!;
  methods.replaceChildren(...(view?.resolution.branches ?? []).map(branch => {
    const row = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = branch.label;
    const status = document.createElement('span');
    status.dataset.applicability = branch.status;
    status.textContent = statusLabels[branch.status];
    row.append(label, status);
    const keys = branch.status === 'not_applicable' ? branch.excludedBy : branch.missing;
    if (keys.length) {
      const reason = document.createElement('p');
      const prefix = branch.status === 'not_applicable' ? 'Contradicted by current evidence about ' : 'Still to establish ';
      reason.textContent = prefix + new Intl.ListFormat('en').format(keys.map(key => discriminants[key])) + '.';
      row.append(reason);
    }
    return row;
  }));
}
