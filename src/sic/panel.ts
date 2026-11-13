import type { AgentAction } from '../runtime/contracts.ts';
import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { SpaceReturn } from './space-return.ts';
import type { StckRankTrial } from './stck-stack.ts';
import { compareAboveColors, contrastClickContexts, describeClickContext, type ClickEffectCount } from './click-evidence.ts';
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
  for (const tab of selected.closest('[data-sic-tabs]')!.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
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
  for (const tabList of panel.querySelectorAll<HTMLElement>('[data-sic-tabs]')) {
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
  }
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

function renderFrames(
  frames: readonly (readonly [string, NativeRows | null])[],
  palette: readonly string[],
  point?: NativePoint,
): HTMLElement {
  const group = document.createElement('div');
  group.className = 'sic-sprites';
  for (const [label, rows] of frames) {
    if (!rows?.length) continue;
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.width = rows[0]!.length;
    canvas.height = rows.length;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    rows.forEach((row, y) => row.forEach((value, x) => {
      ctx.fillStyle = palette[value] ?? '#000';
      ctx.fillRect(x, y, 1, 1);
    }));
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    const image = document.createElement('div');
    image.className = 'sic-sprite';
    image.setAttribute('role', 'img');
    image.setAttribute('aria-label', label);
    image.append(canvas);
    if (point) {
      const marker = document.createElement('span');
      marker.style.left = `${(point[0] + 0.5) / canvas.width * 100}%`;
      marker.style.top = `${(point[1] + 0.5) / canvas.height * 100}%`;
      image.append(marker);
    }
    figure.append(image, caption);
    group.append(figure);
  }
  return group;
}

function renderClickPreview(receipt: NativeClickReturn, palette: readonly string[]): HTMLElement | null {
  const preview = receipt.preview;
  if (!preview) return null;
  const group = renderFrames([['Before', preview.before], ['After', preview.after]], palette, preview.point);
  const changes = receipt.otherChanges;
  if (!changes?.regionCount) return group;
  const details = document.createElement('details');
  const title = document.createElement('summary');
  title.textContent = `Other changes in the same return · ${changes.regionCount} ${changes.regionCount === 1 ? 'region' : 'regions'}`;
  details.append(title);
  const note = document.createElement('p');
  note.textContent = `${changes.totalPixels} changed pixels outside the clicked box. The largest ${changes.samples.length} regions are shown. Their link to the click is uncertain.`;
  details.append(note);
  for (const sample of changes.samples) {
    const [x, y] = sample.box;
    const label = document.createElement('p');
    label.textContent = `Region at (${x}, ${y}) · ${sample.pixels} changed pixels`;
    details.append(label, renderFrames([['Before', sample.before], ['After', sample.after]], palette));
  }
  const section = document.createElement('div');
  section.append(group, details);
  return section;
}

function renderSpaceFramePicker(receipt: SpaceReturn, palette: readonly string[], board: boolean): HTMLElement {
  const player = document.createElement('div');
  player.className = 'sic-animation-player';
  const controls = document.createElement('div');
  controls.className = 'sic-animation-controls';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Previous frame';
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next frame';
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Animation frame');
  for (let index = 0; index <= receipt.frameCount; index++) {
    select.add(new Option(index === 0 ? 'Before Space' : `Frame ${index} / ${receipt.frameCount}`, String(index)));
  }
  controls.append(previous, select, next);
  const body = document.createElement('div');
  const render = () => {
    const index = Number(select.value);
    const frame = receipt.frames[index - 1];
    previous.disabled = index === 0;
    next.disabled = index === receipt.frameCount;
    body.replaceChildren();
    if (board) {
      const images: [string, NativeRows][] = frame
        ? [[index === 1 ? 'Before Space' : `Frame ${index - 1}`, receipt.frames[index - 2]?.rows ?? receipt.before],
          [`Frame ${index}`, frame.rows]]
        : [['Before Space', receipt.before]];
      body.append(renderFrames(images, palette));
    }
    const note = document.createElement('p');
    note.setAttribute('role', 'status');
    note.textContent = !frame ? 'Board before execution.'
      : frame.boundary ? 'Level transition or reset. Sprite identities are not carried across this frame.'
      : frame.obscured ? 'A full-board flash hides the towers. Sprite matches are paused.'
      : `${frame.changedFromPrevious} pixels changed since the previous image; ${frame.changedFromBefore} differ from before Space.`;
    body.append(note);
    if (!frame || frame.boundary || frame.obscured) return;
    const evidence = document.createElement('div');
    evidence.className = 'sic-animation-evidence';
    const focus = document.createElement('div');
    const focusLabel = document.createElement('strong');
    focusLabel.textContent = 'Highlighted in the program';
    focus.append(focusLabel);
    if (frame.focus.length) {
      focus.append(renderFrames(frame.focus.map(item => [`Card ${item.rank} from bottom`, item.rows] as const), palette));
      if (frame.focus.length > 1) {
        const ambiguous = document.createElement('p');
        ambiguous.textContent = 'Several cards are highlighted. The exact card in focus is uncertain.';
        focus.append(ambiguous);
      }
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'No card highlight detected in this frame.';
      focus.append(empty);
    }
    const effects = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = 'What moved or changed in the same frame';
    effects.append(label);
    for (const sprite of frame.sprites) {
      const effect = document.createElement('p');
      const name = sprite.kind === 'player' ? 'Player' : 'Opponent';
      const where = (item: typeof sprite.before) => item ? `(${item.anchor.join(', ')})` : '—';
      effect.textContent = `${name} #${sprite.track} · ${sprite.effect} · ${where(sprite.before)} → ${where(sprite.after)}`;
      effects.append(effect, renderFrames([['Previous', sprite.before?.rows ?? null], ['Now', sprite.after?.rows ?? null]], palette));
    }
    if (!frame.sprites.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No tracked tower changed in this frame.';
      effects.append(empty);
    }
    if (frame.regions?.samples.length) {
      const details = document.createElement('details');
      details.open = !frame.sprites.length;
      const title = document.createElement('summary');
      title.textContent = `Changed board regions · ${frame.regions.regionCount}`;
      details.append(title);
      for (const sample of frame.regions.samples) {
        const position = document.createElement('p');
        position.textContent = `Region at (${sample.box[0]}, ${sample.box[1]}) · ${sample.pixels} pixels`;
        details.append(position, renderFrames([['Previous', sample.before], ['Now', sample.after]], palette));
      }
      effects.append(details);
    }
    evidence.append(focus, effects);
    const relation = document.createElement('p');
    relation.textContent = 'Aligned by frame. A highlight can coincide with a movement or flash; the link is observational.';
    body.append(evidence, relation);
  };
  previous.addEventListener('click', () => { select.selectedIndex--; render(); });
  next.addEventListener('click', () => { select.selectedIndex++; render(); });
  select.addEventListener('change', render);
  select.selectedIndex = Math.max(0, receipt.frames.find(frame => frame.focus.length && frame.sprites.length)?.index ?? 1);
  render();
  player.append(controls, body);
  return player;
}

function renderSpaceReturns(panel: HTMLElement, returns: readonly SpaceReturn[], palette: readonly string[], stck: boolean): void {
  panel.querySelector<HTMLElement>('[data-sic-space-perceptions]')!.hidden = returns.length === 0;
  panel.querySelector<HTMLElement>('[data-sic-space-information]')!.hidden = returns.length === 0;
  const empty = panel.querySelector<HTMLElement>('[data-sic-space-empty]')!;
  empty.hidden = returns.length > 0;
  empty.textContent = stck ? 'Run the agent until it executes Space to inspect its animation.' : 'No animation analysis is available for this game.';
  const frames = panel.querySelector<HTMLElement>('[data-sic-space-frames]')!;
  const facts = panel.querySelector<HTMLElement>('[data-sic-space-facts]')!;
  frames.replaceChildren();
  facts.replaceChildren();
  for (const receipt of [...returns].reverse()) {
    const heading = `Level ${receipt.fromLevel} · Action ${receipt.sequence} · ${receipt.frameCount} ${receipt.frameCount === 1 ? 'frame' : 'frames'}`;
    const group = document.createElement('details');
    group.open = receipt === returns.at(-1);
    const title = document.createElement('summary');
    title.textContent = heading;
    group.append(title);
    group.append(renderSpaceFramePicker(receipt, palette, true));
    frames.append(group);
    const row = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = heading;
    const summary = document.createElement('p');
    summary.textContent = `Compared with the board before Space, up to ${receipt.peakChange} pixels changed during the return and ${receipt.finalChange} differed on the last frame.`
      + (receipt.toLevel !== receipt.fromLevel ? ` The return reached level ${receipt.toLevel}.` : '');
    row.append(label, summary);
    const metrics = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = 'Pixels changed since the preceding frame';
    const changes = document.createElement('p');
    changes.textContent = receipt.frames.map(frame => `Frame ${frame.index}: ${frame.changedFromPrevious}`).join(' · ');
    metrics.append(caption, changes);
    row.append(renderSpaceFramePicker(receipt, palette, false), metrics);
    facts.append(row);
  }
}

function renderClickReturns(panel: HTMLElement, returns: readonly NativeClickReturn[], palette: readonly string[]): void {
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
    const preview = renderClickPreview(receipt, palette);
    if (preview) row.append(preview);
    for (const description of describeClickReturn(receipt)) {
      const line = document.createElement('p');
      line.textContent = description;
      row.append(line);
    }
    if (receipt.beforeContext) {
      const context = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Before the click';
      const facts = document.createElement('dl');
      for (const [label, value] of describeClickContext(receipt.beforeContext)) {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        facts.append(term, description);
      }
      context.append(summary, facts);
      row.append(context);
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

function renderContextContrast(effects: readonly ClickEffectCount[]): HTMLElement {
  const context = document.createElement('details');
  context.className = 'sic-context-contrast';
  context.open = true;
  const heading = document.createElement('summary');
  heading.textContent = 'What differed before the clicks?';
  const { differences, missing } = contrastClickContexts(effects);
  const assessment = document.createElement('p');
  assessment.textContent = missing ? `Context missing for ${missing} ${missing === 1 ? 'return' : 'returns'}.`
    : differences.some(field => field.separates)
      ? 'Some measurements distinguish these returns. Their causal role is still unknown.'
      : 'The measured context does not separate the outcomes.';
  context.append(heading, assessment);
  const pairs = compareAboveColors(effects);
  const contrast = document.createElement('p');
  contrast.textContent = pairs.length
    ? `${pairs.length} matched ${pairs.length === 1 ? 'pair' : 'pairs'} with different colors above. Recoloring differed in ${pairs.filter(pair => pair.recolorDiffers).length}. This is a comparison of measured features.`
    : 'No pair isolates the colors above. Their predictive value is still unknown.';
  context.append(contrast);
  for (const { label, values, separates } of differences) {
    const line = document.createElement('p');
    const description = values.map((group, index) => {
      const levels = effects[index]!.levels.join(', ');
      return `Level ${levels} (${observedEffect(effects[index]!)}): ${group.join(' / ') || 'Unknown'}`;
    });
    line.textContent = `${label}${separates ? ' (separates these returns)' : ''} · ${description.join(' · ')}`;
    context.append(line);
  }
  return context;
}

function renderClickComparisons(panel: HTMLElement, evidence: ShadowView['clickEvidence'], palette: readonly string[]): void {
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
  const pairs = evidence.comparisons.flatMap(group => compareAboveColors(group.effects));
  const counts = [
    repeated ? `${repeated} ${repeated === 1 ? 'pattern repeated' : 'patterns repeated'}` : 'No repeated pattern yet',
    varied ? `${varied} with different outcomes` : '',
  ].filter(Boolean);
  summary.textContent = counts.join(' · ');
  scope.textContent = [
    'Compared within this session by measured shape, starting color and click position within the region.',
    pairs.length ? `Across all groups, ${pairs.length} matched pairs differ only in the measured colors above. Recoloring differs in ${pairs.filter(pair => pair.recolorDiffers).length} pairs.`
      : 'No matched pairs vary only in the measured colors above.',
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
        line.append(outcome);
        const preview = renderClickPreview(receipts[0]!, palette);
        if (preview) line.append(preview);
        line.append(inspect);
        row.append(line);
      }
    }
    if (status === 'varied') row.append(renderContextContrast(effects));
    return row;
  });
  list.replaceChildren(...rows);
}

function renderGameInformation(panel: HTMLElement, stck: boolean, ranks: readonly StckRankTrial[], space: readonly SpaceReturn[]): void {
  const section = panel.querySelector<HTMLElement>('[data-sic-stack-rank]')!;
  section.hidden = !stck;
  if (stck) {
    panel.querySelector('[data-sic-stack-report]')!.textContent =
      'A click removes the selected card. At the top the slot empties; lower down, the card just above takes its place. Same-color cards can hide this shift.';
    const matched = ranks.filter(item => item.stackShiftMatched && item.actualColor === item.expectedColor).length;
    const last = ranks.at(-1);
    const description = last?.actual === 'same-color' ? 'the slot kept its color'
      : last?.actual === 'recolored' ? 'the slot changed color' : 'the slot emptied';
    panel.querySelector('[data-sic-stack-live]')!.textContent = last
      ? `In this session: ${matched}/${ranks.length} visible stack shifts matched. Latest: level ${last.level}, card ${last.rank} of ${last.depth} from the bottom; ${description}.`
      : 'No stack click observed in this session yet.';
  }
  const model = panel.querySelector<HTMLElement>('[data-sic-game-content]')!;
  const title = document.createElement('h4');
  title.textContent = stck ? 'STCK is a programmable machine' : 'Game model';
  const explanation = document.createElement('p');
  explanation.textContent = stck
    ? 'The column on the left is the program. Clicks edit its cards. Space runs the programmed sequence on the isometric board.'
    : 'No game model is documented for this game yet.';
  model.replaceChildren(title, explanation);
  if (!stck) return;
  const observations = document.createElement('dl');
  for (const [term, definition] of [
    ['Edit', 'Click a card to remove it. The shop buttons can add cards.'],
    ['Program', 'The order of the cards matters. The stack represents movement, attack and push instructions.'],
    ['Run', 'Space switches from editing to execution. Cards are highlighted while the board returns an animation.'],
    ['Evidence', `Documented STCK mechanic. Current session: ${ranks.length} observed stack clicks and ${space.length} retained Space returns.`],
    ['Still uncertain', 'If several cards light up together, their highlight does not identify a unique instruction. A matching frame alone cannot attribute every change to that instruction.'],
  ]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = term!;
    dd.textContent = definition!;
    observations.append(dt, dd);
  }
  model.append(observations);
}

export function renderSicPanel(panel: HTMLElement, view: ShadowView | null, palette: readonly string[],
  space: readonly SpaceReturn[], ranks: readonly StckRankTrial[]): void {
  panel.querySelector<HTMLElement>('[data-sic-context]')!.textContent = view
    ? `${view.gameCode} · Level ${view.frame.scope.level} · Last settled board` : '';
  panel.querySelector<HTMLElement>('[data-sic-summary]')!.textContent = view ? summaries[view.resolution.outcome] : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-commands]')!.textContent = view?.commands.length
    ? view.commands.map(id => commands[id]).join(', ')
    : view ? 'No command available.' : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-next]')!.textContent = view?.nextAction
    ? actionLabel(view.nextAction) : 'No pending action to show.';
  renderClickReturns(panel, view?.clickEvidence?.returns ?? (view?.clickReturn ? [view.clickReturn] : []), palette);
  renderClickComparisons(panel, view?.clickEvidence ?? null, palette);
  renderSpaceReturns(panel, space, palette, view?.gameCode === 'STCK');
  renderGameInformation(panel, view?.gameCode === 'STCK', ranks, space);
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
