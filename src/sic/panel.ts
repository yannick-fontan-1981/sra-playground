import type { AgentAction } from '../runtime/contracts.ts';
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

function clickDetails(receipt: ShadowView['clickReturn']): {
  control: string; effect: string; uncertainty: string;
} {
  if (!receipt) return {
    control: 'No addressed return for this board yet.',
    effect: 'Waiting for a measured click return.',
    uncertainty: '',
  };
  const [x, y] = receipt.point;
  const size = receipt.target?.pixels;
  const control = `Click at (${x}, ${y})` + (size ? ` on a visible region of ${size} ${size === 1 ? 'pixel' : 'pixels'}.` : '.');
  if (receipt.boundary) return {
    control,
    effect: receipt.fromLevel !== receipt.toLevel
      ? `The game advanced from level ${receipt.fromLevel} to level ${receipt.toLevel}.`
      : 'The game reported a boundary after the click.',
    uncertainty: 'The boundary leaves the local effect of the click uncertain.',
  };
  const count = receipt.changedTargetPixels;
  const effect = !receipt.target ? 'V6 could not identify a visible region at the click point.'
    : receipt.sameSupport && receipt.atPointAfter?.palette !== receipt.target.palette
      ? 'The clicked region changed color and kept its position and shape.'
      : count > 0
        ? `${count} of ${size} pixels in the clicked region changed.`
        : 'The clicked region kept the same visible pixels.';
  return {
    control,
    effect,
    uncertainty: receipt.target
      ? 'The region is visible. Its role in the game is still uncertain.'
      : 'The subject of the click and its effect are still uncertain.',
  };
}

function observedEffect(effect: ClickEffectCount): string {
  if (effect.kind === 'recolor') return `Changed to palette color ${effect.afterPalette} with the same shape and position`;
  if (effect.kind === 'unchanged') return 'Kept the same visible pixels';
  return 'Pixels changed. The resulting region could not be matched exactly';
}

function renderClickComparisons(panel: HTMLElement, evidence: ShadowView['clickEvidence']): void {
  const section = panel.querySelector<HTMLElement>('[data-sic-comparisons]')!;
  section.hidden = !evidence;
  if (!evidence) return;
  const repeated = evidence.comparisons.filter(group => group.status === 'repeated').length;
  const varied = evidence.comparisons.filter(group => group.status === 'varied').length;
  const counts = [
    repeated ? `${repeated} ${repeated === 1 ? 'pattern repeated' : 'patterns repeated'}` : 'No repeated pattern yet',
    varied ? `${varied} with different outcomes` : '',
  ].filter(Boolean);
  panel.querySelector<HTMLElement>('[data-sic-comparison-summary]')!.textContent = counts.join(' · ');
  panel.querySelector<HTMLElement>('[data-sic-comparison-scope]')!.textContent = [
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
    for (const effect of effects) {
      const line = document.createElement('p');
      const level = effect.levels.length === 1 ? 'level' : 'levels';
      line.textContent = `${observedEffect(effect)} · ${effect.count}× on ${level} ${effect.levels.join(', ')}`;
      row.append(line);
    }
    return row;
  });
  panel.querySelector<HTMLUListElement>('[data-sic-comparison-list]')!.replaceChildren(...rows);
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
  const detailsOfClick = clickDetails(view?.clickReturn ?? null);
  panel.querySelector<HTMLElement>('[data-sic-control]')!.textContent = detailsOfClick.control;
  panel.querySelector<HTMLElement>('[data-sic-effect]')!.textContent = detailsOfClick.effect;
  const uncertainty = panel.querySelector<HTMLElement>('[data-sic-uncertainty]')!;
  uncertainty.textContent = detailsOfClick.uncertainty;
  uncertainty.hidden = !detailsOfClick.uncertainty;
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
