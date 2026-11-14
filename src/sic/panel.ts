import type { AgentAction } from '../runtime/contracts.ts';
import type { NativeClickReturn } from '../logos-engine/v6-native-click-return.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { SpaceReturn } from './space-return.ts';
import type { StckRankTrial } from './stck-stack.ts';
import stckCardComparisons from './stck-card-comparison.json';
import stckTowerEffects from './stck-tower-effects.json';
import { compareDirectionTargets, summarizeDirections, type DirectionalReturn } from './directional-return.ts';
import ls20Directions from './ls20-direction-review.json';
import ls20ShapeExit from './ls20-review-evidence.json';
import { captureDecisionSprites, type NativeResolution } from './native-resolution.ts';
import { compareRecoveryRoute, firstRecovery, isLevelCompletion, recoveryContinuation, type PursuedObjective } from './recovery.ts';
import { explainDecision, orientationAfter, strategyEpisodes, strategyLinks, strategyOutcome, type Decision, type StrategyLink } from './decision-configurations.ts';
import { strategyTimeline } from './strategy-timeline.ts';
import { StrategyEditor } from './strategy-editor.ts';
import compositionOperations from './composition-operations.json';
import type { GameObservation } from '../runtime/browser-games.ts';
import { compareAboveColors, contrastClickContexts, describeClickContext, type ClickEffectCount } from './click-evidence.ts';
import type { Applicability, ControlEffectResolution } from './know-control-effect.ts';
import type { ShadowView } from './shadow.ts';
import type { SituationKey } from './situation.ts';
import { contactRecoveryStrategies } from './active-recovery.ts';
import { frontierStrategies } from './frontier-strategy.ts';
import { viewStrategies } from './view-strategy.ts';
import type { AgendaEntry } from './strategy-agenda.ts';
import { frontierInputOrders } from './frontier-configuration.ts';

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

function openInformation(panel: HTMLElement, subtab: string): void {
  const parent = panel.querySelector<HTMLButtonElement>('#sic-information-tab')!;
  const selected = panel.querySelector<HTMLButtonElement>(`#${subtab}-tab`)!;
  selectPerspective(panel, parent);
  selectPerspective(panel, selected);
  selected.focus();
}

function renderMechanisms(panel: HTMLElement, groups: ReturnType<typeof summarizeDirections>,
  returns: readonly DirectionalReturn[], palette: readonly string[]): void {
  const container = panel.querySelector<HTMLElement>('[data-sic-mechanisms]')!;
  const title = document.createElement('h4');
  title.textContent = 'Mechanisms observed in this session';
  const intro = document.createElement('p');
  const repeated = groups.filter(group => group.repeated);
  intro.textContent = repeated.length ? 'Matching returns support these effects. Object roles and general rules are still open.'
    : 'No repeated mechanism yet. Effects are built from the current session’s returns.';
  container.replaceChildren(title, intro);
  for (const group of groups) {
    const block = document.createElement('div');
    block.className = 'sic-effect-row';
    const label = document.createElement('strong');
    label.textContent = `${commands[group.command]} · ${group.repeated ? 'Repeated translation' : 'Observed returns'}`;
    const effect = document.createElement('p');
    effect.textContent = `${group.moved} translations${group.repeated ? ` of (${group.shift}) px` : ''}; ${group.stationary} stationary and ${group.unresolved} unresolved.`;
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'sic-evidence-link';
    link.textContent = 'See command comparisons';
    link.addEventListener('click', () => openInformation(panel, 'sic-effects'));
    block.append(label, effect, link);
    container.append(block);
  }
  const targets = compareDirectionTargets(returns);
  const targetSection = panel.querySelector<HTMLElement>('[data-sic-targets]')!;
  targetSection.hidden = !targets.length;
  targetSection.replaceChildren();
  if (!targets.length) return;
  const heading = document.createElement('h4');
  heading.textContent = 'Where movement succeeds or stays blocked';
  const note = document.createElement('p');
  note.textContent = 'Grouped by the colors visible in the target before the command. This comparison does not by itself establish a rule.';
  targetSection.append(heading, note);
  for (const group of targets.slice(0, 6)) {
    const block = document.createElement('div');
    const label = document.createElement('p');
    label.textContent = `Colors ${group.colors.join(', ')} · ${group.moved} moved · ${group.stationary} stationary`;
    block.append(label, renderFrames([
      ['Target before movement', group.movedExample?.translation?.targetBefore ?? null],
      ['Target before no movement', group.stationaryExample?.stationary?.ahead ?? null],
    ], palette));
    targetSection.append(block);
  }
}

function renderRoles(panel: HTMLElement, returns: readonly DirectionalReturn[], palette: readonly string[], level: number | undefined): void {
  const container = panel.querySelector<HTMLElement>('[data-sic-roles]')!;
  const title = document.createElement('h4');
  title.textContent = 'Roles under discovery';
  const local = returns.filter(item => item.fromLevel === level && item.toLevel === level);
  const latest = [...local].reverse().find(item => item.translation || item.stationary);
  const note = document.createElement('p');
  note.textContent = latest ? 'These roles describe what the sprites did in the observed return. Their game-specific meaning is still open.'
    : 'No role assigned yet. Roles start from the observed behavior of sprites.';
  container.replaceChildren(title, note);
  const rotation = [...local].reverse().find(item => item.rotation);
  if (rotation?.rotation) {
    const label = document.createElement('strong');
    label.textContent = `Rotation changer · observed at action ${rotation.sequence}`;
    container.append(label, renderFrames([
      ['Tile entered', rotation.rotation.tile], ['Indicator before', rotation.rotation.before], ['Indicator after', rotation.rotation.after],
    ], palette));
  }
  if (!latest) return;
  container.append(renderFrames([
    ['Tracked sprite', latest.translation?.sprite ?? latest.stationary?.sprite ?? null],
    ['Approached area', latest.translation?.targetBefore ?? latest.stationary?.ahead ?? null],
    ['Other changed region', latest.changes?.samples[0]?.after ?? null],
  ], palette));
}

function renderOfflineReview(panel: HTMLElement, level: number | null, palette: readonly string[]): void {
  const mechanisms = panel.querySelector<HTMLElement>('[data-sic-mechanism-review]')!;
  const roles = panel.querySelector<HTMLElement>('[data-sic-role-review]')!;
  const key = level ? `${level}:${palette.join(',')}` : 'hidden';
  if (mechanisms.dataset.review === key) return;
  mechanisms.dataset.review = key;
  mechanisms.replaceChildren();
  roles.replaceChildren();
  if (!level) return;
  const review = (title: string) => {
    const box = document.createElement('details');
    box.className = 'sic-observations';
    const label = document.createElement('summary');
    label.textContent = title;
    const source = document.createElement('p');
    source.textContent = 'Offline evidence from earlier LS20 runs and controlled trials. It does not initialize the current discovery session.';
    box.append(label, source);
    return box;
  };
  const mechanismReview = review('Offline review · Directions');
  const directions = document.createElement('ul');
  const words: Record<number, string> = { 1: 'up', 2: 'down', 3: 'left', 4: 'right' };
  for (const item of ls20Directions.commands) {
    const row = document.createElement('li');
    row.textContent = `${commands[item.command]}: 5 px ${words[item.command]} when matched · ${item.moved} moves, ${item.stationary} stationary, ${item.unresolved} unresolved or boundary.`;
    directions.append(row);
  }
  const contrast = document.createElement('p');
  const open = ls20Directions.targets.find(group => group.colors.length === 1 && group.colors[0] === 3);
  const closed = ls20Directions.targets.find(group => group.colors.length === 1 && group.colors[0] === 4);
  contrast.textContent = `${ls20Directions.count} directional returns. A plain color-3 target moved in ${open?.moved} cases; a plain color-4 target was stationary in ${closed?.stationary} cases. The cropped examples are two consecutive Up returns on level ${ls20Directions.example.level}.`;
  mechanismReview.append(directions, contrast, renderFrames([
    ['Tracked sprite', ls20Directions.example.sprite], ['Target · moved', ls20Directions.example.movedTarget],
    ['Target · no movement', ls20Directions.example.blockedTarget],
  ], palette));
  mechanisms.append(mechanismReview);
  const rotation = ls20ShapeExit.rotations.find(sample => sample.level === level);
  if (rotation) {
    const rotationReview = review(`Level ${level} · Rotation changer evidence`);
    const note = document.createElement('p');
    note.textContent = `Recorded action ${rotation.action} changed orientation while the shape and color stayed the same. There is no shape changer on this level.`;
    rotationReview.append(note, renderFrames([
      ['Rotation changer', rotation.tile], ['Indicator before', rotation.before], ['Indicator after', rotation.after],
    ], palette));
    roles.append(rotationReview);
  }
  if (level !== ls20ShapeExit.summary.shapeLevel) return;
  const shape = document.createElement('p');
  const run = ls20ShapeExit.sameRun;
  shape.textContent = `Level 4 replay: the shape changes on action ${run.shapeAction} and stays the same until action ${run.exitAction} advances to level ${run.resultLevel}. The color was adjusted separately (actions ${run.colorActions.join(', ')}).`;
  mechanismReview.append(shape);
  const roleReview = review('Level 4 only · Shape changer and exit evidence');
  const inference = document.createElement('p');
  const publicReview = ls20ShapeExit.publicReview;
  inference.textContent = `From public returns alone: ${publicReview.changer ? 'a candidate appearance changer' : 'no appearance changer localized'} and ${publicReview.exit ? 'an exit candidate at the level transition' : 'no exit localized'}. ${publicReview.otherAppearanceCandidates} other appearance changes were also proposed. This evidence does not yet distinguish shape, color and rotation reliably.`;
  roleReview.append(inference);
  const sprites = ls20ShapeExit.sprites;
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'sic-evidence-link';
  link.textContent = 'See the shape matching mechanism';
  link.addEventListener('click', () => { openInformation(panel, 'sic-mechanisms'); mechanismReview.open = true; });
  const roleCards = document.createElement('ul');
  for (const [name, description, previews] of [
    ['Moving sprite', 'Moves in the direction requested if the next position allows it.', [['Observed sprite', sprites.mover]]],
    ['Shape changer', 'Crossing this tile changes the shape shown in the indicator.', [
      ['Tile', sprites.plate], ['Indicator before', sprites.before], ['Indicator after', sprites.after]]],
    ['Exit and required shape', 'The exit tests shape, color and orientation. The shape changer supplies the shape part of that match.', [
      ['Exit', sprites.exit], ['Required shape', sprites.target]]],
  ] as const) {
    const row = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = name;
    const copy = document.createElement('p');
    copy.textContent = description;
    row.append(label, copy, renderFrames(previews, palette));
    roleCards.append(row);
  }
  const candidates = renderFrames([
    ['Public candidate · appearance changer', publicReview.changer?.sprite ?? null],
    ['Public candidate · exit', publicReview.exit?.sprite ?? null],
  ], palette);
  roleReview.append(candidates, roleCards, link);
  roles.append(roleReview);
}

function renderCardComparisons(panel: HTMLElement, palette: readonly string[], stck: boolean): void {
  const section = panel.querySelector<HTMLElement>('[data-sic-card-test]')!;
  section.hidden = !stck;
  const container = panel.querySelector<HTMLElement>('[data-sic-card-test-cases]')!;
  const key = stck ? palette.join(',') : 'hidden';
  if (container.dataset.palette === key) return;
  container.dataset.palette = key;
  container.replaceChildren();
  if (!stck) return;
  const method = document.createElement('p');
  method.textContent = 'Offline test: two copies of the same game state run Space. Only the outlined card differs. The paired images are aligned by phase of that instruction.';
  container.append(method);
  const phases = ['Before the card', 'Wind-up', 'Attempted move', 'End of this card'];
  const coord = (point: readonly number[]) => `(${point.join(', ')})`;
  for (const pair of stckCardComparisons) {
    const block = document.createElement('details');
    block.open = pair.id === 'two-directions';
    const title = document.createElement('summary');
    title.textContent = `Level ${pair.level} · Card ${pair.rank} from bottom · ${pair.id === 'blocked' ? 'Movement vs. no movement' : 'Two directions from the same cell'}`;
    const note = document.createElement('p');
    note.textContent = `Same cell before the card: ${coord(pair.origin)}. The replacement changes the immediate result from ${coord(pair.baseline.destination)} to ${coord(pair.variant.destination)} (row, column).`;
    const select = document.createElement('select');
    select.setAttribute('aria-label', `Level ${pair.level} · Compared phase`);
    phases.forEach((label, index) => select.add(new Option(label, String(index))));
    select.selectedIndex = 2;
    const controls = document.createElement('div');
    controls.className = 'sic-animation-controls';
    controls.append(select);
    const body = document.createElement('div');
    body.className = 'sic-animation-evidence';
    const render = () => {
      body.replaceChildren();
      for (const [label, variant] of [['Original', pair.baseline], ['One card replaced', pair.variant]] as const) {
        const side = document.createElement('div');
        const heading = document.createElement('strong');
        heading.textContent = `${label} · ${variant.card}`;
        const program = document.createElement('div');
        program.className = 'sic-program';
        program.setAttribute('aria-label', 'Program in order from bottom to top');
        variant.program.forEach((card, index) => {
          const item = document.createElement('span');
          item.textContent = card;
          if (index + 1 === pair.rank) {
            item.dataset.sicChangedCard = '';
            item.setAttribute('aria-label', `Compared card: ${card}`);
          }
          program.append(item);
        });
        const frame = variant.frames[select.selectedIndex]!;
        const position = document.createElement('p');
        position.textContent = `Player cell: ${coord(frame.position)}`;
        side.append(heading, program, renderFrames([
          ['Compared card', frame.focus], ['Board near the starting cell', frame.board], ['Player', frame.player],
        ], palette), position);
        body.append(side);
      }
    };
    select.addEventListener('change', render);
    render();
    block.append(title, note, controls, body);
    container.append(block);
  }
  const scope = document.createElement('p');
  scope.textContent = 'Attribution stops at the end of the replaced card. Later instructions and flashes can also differ; the test does not assign each later change directly to that card.';
  container.append(scope);
}

function renderTowerEffects(panel: HTMLElement, palette: readonly string[], stck: boolean): void {
  const section = panel.querySelector<HTMLElement>('[data-sic-tower-test]')!;
  section.hidden = !stck;
  const container = panel.querySelector<HTMLElement>('[data-sic-tower-test-cases]')!;
  const key = stck ? palette.join(',') : 'hidden';
  if (container.dataset.palette === key) return;
  container.dataset.palette = key;
  container.replaceChildren();
  if (!stck) return;
  const intro = document.createElement('p');
  intro.textContent = 'Controlled STCK board: identical terrain and towers, with one card changed. The cyan control left all five towers unchanged during its instruction. Only the player instruction is compared, before any opponent acts.';
  container.append(intro);
  const coord = (point: readonly number[]) => `(${point.join(', ')})`;
  for (const trial of stckTowerEffects) {
    const block = document.createElement('details');
    const title = document.createElement('summary');
    const attack = trial.card === 'red';
    title.textContent = attack ? 'Red · Attack neighbouring towers' : 'Pink · Push neighbouring towers';
    const overview = document.createElement('p');
    overview.textContent = attack
      ? 'The four neighbours, including the diagonal, lose their top card without moving. A tower that loses its last card disappears. The distant tower is unchanged.'
      : 'A free floor allows one step away. Missing floor and an occupied destination block the push. A pushed tower disappears if it falls into a hole. The distant tower is unchanged.';
    const controls = document.createElement('div');
    controls.className = 'sic-animation-controls';
    const select = document.createElement('select');
    select.setAttribute('aria-label', attack ? 'Attack phase' : 'Push phase');
    ['Before the card', 'Effect during the flash', 'After the card'].forEach((phase, i) => select.add(new Option(phase, String(i))));
    select.selectedIndex = 2;
    controls.append(select);
    const body = document.createElement('div');
    const render = () => {
      const phase = select.selectedIndex;
      const frame = trial.frames[phase]!;
      body.replaceChildren(renderFrames([['Selected card', frame.focus], ['Nearby board', frame.board]], palette));
      const towers = document.createElement('ul');
      for (const tower of trial.towers) {
        const row = document.createElement('li');
        const label = document.createElement('strong');
        label.textContent = tower.condition;
        const before = tower.frames[0]!, after = tower.frames[phase]!;
        const status = document.createElement('p');
        status.textContent = phase === 0 ? `${coord(before.cell)} · ${before.cards} card(s)`
          : `${coord(before.cell)} → ${coord(after.cell)} · ${before.cards} → ${after.cards} cards`
            + (!after.alive ? ' · Tower gone' : ' · Tower remains');
        row.append(label, status, renderFrames(phase ? [['Before', before.sprite], ['Selected phase', after.sprite]]
          : [['Before', before.sprite]], palette));
        towers.append(row);
      }
      body.append(towers);
    };
    select.addEventListener('change', render);
    render();
    block.append(title, overview, controls, body);
    container.append(block);
  }
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
  empty.textContent = stck ? 'STCK’s detailed sprite tracking appears after the agent runs Space.' : '';
  if (!stck) empty.hidden = true;
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

function renderGameInformation(panel: HTMLElement, stck: boolean, ranks: readonly StckRankTrial[], view: ShadowView | null,
  groups: ReturnType<typeof summarizeDirections>, returns: readonly DirectionalReturn[]): void {
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
  title.textContent = 'Model under discovery';
  const provenance = document.createElement('p');
  provenance.textContent = 'Built from this session’s public observations.';
  model.replaceChildren(title, provenance);
  const observations = document.createElement('dl');
  const repeated = groups.filter(group => group.repeated);
  for (const [term, definition] of [
    ['Observed', view ? `${view.commands.length} available commands on the current board; ${returns.length} recorded returns.` : 'Waiting for a public board.'],
    ['Repeated', repeated.length ? repeated.map(group => `${commands[group.command]}: ${group.moved} matching translations`).join(' · ')
      : 'No repeated translation established yet.'],
    ['Still uncertain', 'What the sprites represent, what blocks a move, and what conditions explain other changes.'],
  ]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = term!;
    dd.textContent = definition!;
    observations.append(dt, dd);
  }
  model.append(observations);
}

function renderBoardAndDirection(panel: HTMLElement, board: NativeRows | null, palette: readonly string[],
  needsRestart: boolean, returns: readonly DirectionalReturn[]): void {
  panel.querySelector('[data-sic-perception-scope]')!.textContent = needsRestart
    ? 'To collect agent returns, restart the native agent at level 1. You can inspect manual returns at this level.'
    : board ? 'Public board. Command meanings are verified separately.' : '';
  panel.querySelector('[data-sic-board-preview]')!.replaceChildren(renderFrames([['Settled board', board]], palette));
  const section = panel.querySelector<HTMLElement>('[data-sic-latest-direction]')!;
  const effect = panel.querySelector<HTMLElement>('[data-sic-direction-effect]')!;
  section.hidden = effect.hidden = returns.length === 0;
  if (!returns.length) return;
  const select = panel.querySelector<HTMLSelectElement>('[data-sic-direction-select]')!;
  const previous = select.value;
  const wasLatest = select.selectedIndex === 0;
  const label = (item: DirectionalReturn) => item.translation ? 'Sprite moved'
    : item.stationary ? 'Sprite stayed in place' : item.changes ? 'Movement unresolved' : 'Boundary';
  select.replaceChildren(...[...returns].reverse().map(item => new Option(
    `Level ${item.fromLevel} · Action ${item.sequence} · ${commands[item.command]} · ${label(item)}`, String(item.sequence))));
  if (!wasLatest && returns.some(item => String(item.sequence) === previous)) select.value = previous;
  const coordinates = (box: readonly number[]) => `(${box[0]}, ${box[1]})`;
  const render = () => {
    const item = returns.find(sample => String(sample.sequence) === select.value)!;
    const body = panel.querySelector<HTMLElement>('[data-sic-direction-sprites]')!;
    const summary = document.createElement('p');
    summary.textContent = item.translation
      ? `Matching sprite moved: ${coordinates(item.translation.from)} → ${coordinates(item.translation.to)}.`
      : item.stationary ? `Matching sprite stayed at ${coordinates(item.stationary.box)}. The attempted move had no visible displacement; the reason is unverified.`
      : item.changes ? 'No unique sprite match. The regions below show what changed.'
      : 'Level or state transition, or incompatible images. No sprite comparison.';
    body.replaceChildren(summary);
    if (item.translation) body.append(renderFrames([
      [`Before ${coordinates(item.translation.from)}`, item.translation.sprite],
      [`After ${coordinates(item.translation.to)}`, item.translation.sprite], ['Target before the move', item.translation.targetBefore],
    ], palette));
    if (item.stationary) body.append(renderFrames([
      ['Sprite before', item.stationary.sprite], ['Sprite after', item.stationary.sprite], ['Area in requested direction', item.stationary.ahead],
    ], palette));
    if (!item.changes) return;
    const other = document.createElement('p');
    other.textContent = `${item.translation || item.stationary ? 'Other changes' : 'Visible changes'}: ${item.changes.totalPixels} pixels in ${item.changes.regionCount} regions.`;
    body.append(other, ...item.changes.samples.map(sample => renderFrames(
      [[`Before ${coordinates(sample.box)}`, sample.before], [`After ${coordinates(sample.box)}`, sample.after]], palette)));
  };
  select.onchange = render;
  render();
  effect.replaceChildren(...summarizeDirections(returns).map(group => {
    const row = document.createElement('span');
    row.className = 'sic-effect-count';
    row.textContent = `${commands[group.command]}: ${group.moved} moved · ${group.stationary} stationary · ${group.unresolved} unresolved`;
    return row;
  }));
}

const strategyEditors = new WeakMap<HTMLElement, StrategyEditor>();

function renderDiscoveryPerspectives(panel: HTMLElement, view: ShadowView | null, board: GameObservation | null,
  mode: 'manual' | 'agent', returns: readonly DirectionalReturn[], groups: ReturnType<typeof summarizeDirections>,
  palette: readonly string[], objectives: readonly PursuedObjective[]): void {
  const describe = (selector: string, lines: readonly string[]) => {
    panel.querySelector(selector)!.replaceChildren(...lines.map(text => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    }));
  };
  const repeated = groups.filter(group => group.repeated);
  const native = view?.native;
  const lastPlan = [...returns].reverse().find(item => item.fromLevel === board?.level && item.decision)?.decision;
  const planSource = native?.pending ? native : lastPlan ?? (native?.steps.length ? native : null);
  const expandedMethods = new Map([...panel.querySelectorAll<HTMLDetailsElement>('[data-sic-method]')]
    .map(details => [details.dataset.sicMethod, details.open] as const));
  describe('[data-sic-strategy-body]', [
    view?.native?.family ? 'Methods reconstructed from the decisions and returns of Native TS 0.68.'
      : repeated.length ? `Observed patterns: ${repeated.map(group => `${commands[group.command]} (${group.moved} matching translations)`).join(', ')}.`
      : view?.commands.length ? `Available to explore: ${view.commands.map(id => commands[id]).join(', ')}.` : 'No available command observed.',
  ]);
  const strategies = panel.querySelector('[data-sic-strategy-body]')!;
  if (view?.recoveryRefusal) {
    const summary = document.createElement('p');
    summary.textContent = view.recoveryRefusal.reason === 'sic_recovery_shadow'
      ? 'The contact-recovery agenda ran in shadow. No recovery command was released.'
      : 'The contact-recovery agenda found no admissible plan within the current limits.';
    strategies.append(summary, renderAgenda('Contact recovery priority', contactRecoveryStrategies, view.recoveryRefusal.agenda));
  }
  if (view?.frontierRefusal?.length) {
    const summary = document.createElement('p');
    summary.textContent = 'There is no untried input here, and the observed routes have no admissible access to one.';
    strategies.append(summary, renderAgenda('Exploration strategy priority', frontierStrategies, view.frontierRefusal));
  }
  let editor = strategyEditors.get(panel);
  if (!editor) {
    editor = new StrategyEditor(panel.querySelector<HTMLElement>('[data-sic-strategy-editor]')!);
    strategyEditors.set(panel, editor);
  }
  const timeline = strategyTimeline(returns, editor.activeRules);
  panel.querySelector('[data-sic-recovery-settings]')!.dispatchEvent(new CustomEvent('sic-frontier-choices', {
    detail: timeline.flatMap(({ first }) => {
      const frontier = first.decision?.frontierStrategy;
      return frontier?.inputOrder && frontier.choices ? [{ sequence: first.sequence, order: frontier.inputOrder, choices: frontier.choices,
        ruleEvidence: frontier.ruleEvidence }] : [];
    }),
  }));
  const shown = selectTimelineEpisodes(timeline, board?.level);
  const agentActions = mode === 'agent' ? returns.length : 0;
  editor.update(board?.gameCode ?? null, timeline, shown, agentActions, (item, caption) => strategyEvidenceFrames(item, palette, caption),
    () => renderDiscoveryPerspectives(panel, view, board, mode, returns, groups, palette, objectives));
  renderGenericTimeline(panel, strategies, shown, palette, expandedMethods);
  const operation = planSource?.operation;
  const catalog = document.createElement('details');
  catalog.className = 'sic-details';
  const catalogTitle = document.createElement('summary');
  catalogTitle.textContent = operation ? `Composition operations · ${operation} in this plan` : 'Composition operations · OP01–OP31';
  const distinction = document.createElement('p');
  distinction.textContent = 'These are symbolic operations on compositions. Only a code published with this proposal is attributed to the plan.';
  const entries = document.createElement('ol');
  for (const item of compositionOperations) {
    const row = document.createElement('li');
    row.textContent = `${item.key} · ${item.description}${item.key === operation ? ' · attached to this plan' : ''}`;
    entries.append(row);
  }
  catalog.append(catalogTitle, distinction, entries);
  strategies.append(catalog);
  const composition = native?.compositions.find(item => item.id === planSource?.composition);
  if (planSource?.composition) {
    const line = document.createElement('p');
    line.textContent = composition?.role ? `Composition role: ${nativeLabel(composition.role)}${composition.observed === false ? ' · proposed' : ''}.`
      : 'This plan references a native composition; no role was retained.';
    strategies.append(line);
  }
  const progress = board ? `Public progress: ${board.levelsCompleted} completed · current level ${board.level} of ${board.levelCount}.` : 'Waiting for the board.';
  renderObjectives(panel, progress, board, native?.pending ? native : lastPlan, objectives, timeline);
  const objectiveTimeline = panel.querySelector('#sic-objective-evidence')!;
  const expanded = new Map([...objectiveTimeline.querySelectorAll<HTMLDetailsElement>('details[data-strategy-choice]')]
    .map(details => [details.dataset.strategyChoice, details.open] as const));
  objectiveTimeline.replaceChildren();
  renderStrategyEpisodes(panel, objectiveTimeline, returns, timeline, native?.pending ? native : null, board?.level, palette, expanded);
  const last = returns.slice(-5);
  describe('[data-sic-plan-body]', [
    last.length ? `Recent actions (${mode}): ${last.map(item => commands[item.command]).join(' → ')}.` : 'No action return recorded in this session.',
    view?.native?.guard ? `Native condition checked: ${nativeLabel(view.native.guard)}.`
      : 'No current native condition retained.',
  ]);
  const plan = panel.querySelector('[data-sic-plan-body]')!;
  const objective = describePlanObjective(planSource);
  if (objective) {
    const line = document.createElement('p');
    line.textContent = objective;
    plan.append(line);
  }
  const planRecovery = planSource?.recoveryDecision?.objective ?? planSource?.frontierStrategy?.objective ?? planSource?.viewStrategy?.objective;
  if (planRecovery) {
    const line = document.createElement('p');
    line.textContent = `SIC sub-objective: ${planRecovery.label}.`;
    plan.append(line);
  }
  renderRecovery(plan, returns, board?.level, palette);
  if (native?.steps.length) {
    const heading = document.createElement('p');
    heading.textContent = native.pending ? 'Sequence proposed by 0.68; only the marked step is currently authorized.'
      : 'Last proposal retained in the trace. These steps are not a record of execution.';
    const list = document.createElement('ol');
    native.steps.forEach((step, index) => {
      const row = document.createElement('li');
      row.textContent = `${step.action}${step.expected ? ` → ${step.expected}` : ''}${index === native.nextIndex ? ' · authorized now' : ''}`;
      list.append(row);
    });
    plan.append(heading, list);
    if (board && native.pending && native.subjects.length) {
      const subjects = captureDecisionSprites(native, board.frame, null).sprites;
      plan.append(renderFrames(subjects.map(item => [item.label, item.before] as const), palette));
    }
  }
  if (native?.releasedPlan) {
    const line = document.createElement('p');
    const receipt = native.releasedPlan;
    line.textContent = `Guarded plan · ${nativeLabel(receipt.family)} · ${receipt.planned} ${receipt.planned === 1 ? 'command' : 'commands'}.`;
    plan.append(line);
  }
  if (native?.outcome) {
    const outcome = document.createElement('p');
    const result = native.outcome.matched === true ? 'matched the prediction'
      : native.outcome.matched === false ? 'differed from the prediction' : 'had no verified prediction';
    outcome.textContent = `Latest executed return (${nativeLabel(native.outcome.family)}): ${result}.`
      + (native.outcome.reason ? ` ${nativeLabel(native.outcome.reason)}.` : '');
    plan.append(outcome);
  }
  const history = returns.filter(item => item.nativeCheck).map(item => ({
    ...item.nativeCheck!, sequence: item.sequence, level: item.fromLevel,
  }));
  if (history.length || native?.history.length) {
    const details = document.createElement('details');
    details.className = 'sic-details';
    const title = document.createElement('summary');
    title.textContent = 'Executed steps and native checks';
    const list = document.createElement('ol');
    const levels = [...new Set(history.map(item => item.level))].sort((a, b) => b - a);
    const levelSelect = document.createElement('select');
    levelSelect.setAttribute('aria-label', 'Executed actions by level');
    levels.forEach(level => levelSelect.add(new Option(`Level ${level}`, String(level))));
    const preferred = levels.includes(board?.level ?? 0) ? board!.level : levels[0];
    if (preferred) levelSelect.value = String(preferred);
    const renderChecks = () => {
      list.replaceChildren();
      const selection = history.length ? history.filter(item => item.level === Number(levelSelect.value)) : native?.history ?? [];
      for (const event of [...selection].reverse()) {
        const row = document.createElement('li');
        const input = returns.find(item => item.sequence === event.sequence);
        const check = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = `Action ${event.sequence}${input ? ` · ${commands[input.command]}` : ''} · ${nativeLabel(event.family)} · `
          + (event.matched === true ? 'prediction matched' : event.matched === false ? 'prediction differed' : 'no verified prediction')
          + (event.reason ? ` · ${nativeLabel(event.reason)}` : '');
        check.append(summary);
        check.addEventListener('toggle', () => {
          if (!check.open || check.childElementCount > 1) return;
          const relevant = input?.decision?.family === event.family ? input.decision : undefined;
          if (relevant?.sprites.length) {
            const title = document.createElement('p');
            title.textContent = 'Regions referenced by the native proposal (same coordinates before and after).';
            check.append(title, ...relevant.sprites.map(item => renderFrames([
              [`${item.label} · before`, item.before], ['Same region after', item.after],
            ], palette)));
          } else {
            const missing = document.createElement('p');
            missing.textContent = 'The native proposal did not provide a sprite location for this step.';
            check.append(missing);
          }
          if (input?.translation || input?.changes?.samples.length) {
            const title = document.createElement('p');
            title.textContent = 'Visible return measured independently by SIC.';
            check.append(title, renderFrames([
              ['Translated sprite', input.translation?.sprite ?? null],
              ['Changed region before', input.changes?.samples[0]?.before ?? null],
              ['Changed region after', input.changes?.samples[0]?.after ?? null],
            ], palette));
          }
        });
        row.append(check);
        list.append(row);
      }
    };
    levelSelect.addEventListener('change', renderChecks);
    renderChecks();
    details.append(title);
    if (levels.length) details.append(levelSelect);
    details.append(list);
    plan.append(details);
  }
  const animations = returns.filter(item => (item.frameCount ?? 0) > 1);
  const area = panel.querySelector('[data-sic-generic-animation]')!;
  if (!animations.length) {
    describe('[data-sic-generic-animation]', ['No multi-frame return observed in this session.']);
  } else {
    area.replaceChildren(...animations.slice(-3).reverse().map(item => {
      const block = document.createElement('div');
      const title = document.createElement('p');
      title.textContent = `Level ${item.fromLevel} · Action ${item.sequence} · ${commands[item.command]} · ${item.frameCount} public frames.`;
      block.append(title, renderFrames((item.animation ?? []).map(frame => [`Frame ${frame.index}`, frame.rows] as const), palette));
      return block;
    }));
  }
}

function renderObjectives(panel: HTMLElement, progress: string, board: GameObservation | null,
  current: Pick<NativeResolution, 'objective' | 'objectiveSource' | 'question' | 'recoveryDecision' | 'frontierStrategy' | 'viewStrategy'>
    & Partial<Pick<NativeResolution, 'context'>> | null | undefined,
  entries: readonly PursuedObjective[], timeline: ReturnType<typeof strategyTimeline>): void {
  const paragraph = (value: string) => { const p = document.createElement('p'); p.textContent = value; return p; };
  panel.querySelector('[data-sic-objective-progress]')!.textContent = progress;
  const active = panel.querySelector('#sic-present')!;
  active.replaceChildren();
  active.append(paragraph(board?.state === 'WIN' ? 'The game reports victory.'
    : describePlanObjective(current) ?? 'No current native objective observed.'));
  const currentSubObjective = current?.recoveryDecision?.objective ?? current?.frontierStrategy?.objective ?? current?.viewStrategy?.objective;
  if (currentSubObjective) {
    active.append(paragraph(`SIC sub-objective: ${currentSubObjective.label}.`));
  }
  if (current?.objectiveSource === 'native' && current.question) {
    active.append(paragraph(`Immediate aim: ${nativeLabel(current.question).replace(/[.!?]$/, '')}.`));
  }
  if (current) renderDecisionConfigurations(active, current, 'objective');
  const past = panel.querySelector('#sic-past')!;
  past.replaceChildren();
  if (!entries.length) past.append(paragraph('No objective has been recorded in this session.'));
  else {
    const list = document.createElement('ol');
    list.className = 'sic-objective-history';
    for (const entry of [...entries].reverse()) {
      const row = document.createElement('li');
      row.textContent = `Level ${entry.level} · ${entry.first === entry.last ? `action ${entry.first}` : `actions ${entry.first}–${entry.last}`} · `
        + (isLevelCompletion(entry.source.objective) ? `Complete level ${entry.level}`
          : nativeLabel(entry.source.objective ?? entry.source.question ?? 'Objective not retained'))
        + (entry.advanced ? ' · Level advanced' : entry.interrupted ? ' · Interrupted by restart' : '');
      if (entry.source.objectiveSource === 'native' && entry.source.question) {
        row.append(paragraph(`Immediate aim: ${nativeLabel(entry.source.question).replace(/[.!?]$/, '')}.`));
      }
      if (entry.sic) row.append(paragraph(`SIC sub-objective: ${entry.sic.label}.`));
      const method = timeline.find(item => item.first.fromLevel === entry.level
        && item.last.sequence >= entry.first && item.first.sequence <= entry.last
        && (item.rule || item.first.decision?.recoveryDecision || item.first.decision?.frontierStrategy || item.first.decision?.viewStrategy)
        && panel.querySelector(`[data-sic-method="${item.first.sequence}"]`));
      const strategy = method?.first.decision?.recoveryDecision?.strategy ?? method?.first.decision?.frontierStrategy?.title
        ?? method?.first.decision?.viewStrategy?.title ?? method?.rule?.title;
      if (method && strategy) row.append(perspectiveJump(panel, 'strategies', `[data-sic-method="${method.first.sequence}"]`, `Strategy: ${strategy}`));
      list.append(row);
    }
    past.append(paragraph(`${entries.length} recorded episodes`), list);
  }
  const future = panel.querySelector('#sic-future')!;
  future.replaceChildren();
  if (board && board.level < board.levelCount && board.state !== 'WIN') {
    future.append(paragraph(`Reach and complete level ${board.level + 1}, if the current level is completed.`),
      paragraph('Suggested by public progression; the native engine has not selected it.'));
    if (board.level + 1 < board.levelCount) future.append(paragraph('Later possibility: finish the remaining levels after that.'));
  } else future.append(paragraph('No further objective supported by the current observations.'));
}

function renderRecovery(container: Element, returns: readonly DirectionalReturn[], currentLevel: number | undefined,
  palette: readonly string[]): void {
  const levels = [...new Set(returns.filter(item => item.restart).map(item => item.fromLevel))];
  const level = levels.find(item => item === currentLevel) ?? levels.at(-1);
  const review = level === undefined ? null : firstRecovery(returns, level);
  if (!review?.interrupted.restart) return;
  const { interrupted, following, route, retained } = review;
  const witness = interrupted.restart!;
  const section = document.createElement('section');
  section.className = 'sic-observations sic-recovery';
  const title = document.createElement('h4');
  title.textContent = `Level ${level} · First restart · Action ${interrupted.sequence}`;
  const why = document.createElement('p');
  const check = interrupted.nativeCheck;
  why.textContent = `${commands[interrupted.command]} returned a full yellow flash and restored the board. The old route cannot be continued from its previous position. `
    + (!check ? 'No native verdict was retained.'
      : check.matched === false ? 'The native return differed from the prediction.'
        : check.matched === true ? 'The native check still reported a match; the restart is a separate public observation.'
          : 'The engine had no verified prediction for this return.');
  section.append(title, why, renderFrames([
    ['Before the interruption', witness.before],
    ['Restart flash', witness.flash],
    ['Board after restart', witness.after],
  ], palette));
  if (interrupted.decision?.sprites.length) section.append(renderFrames(
    interrupted.decision.sprites.map(item => [item.label, item.before] as const), palette));
  const goal = document.createElement('p');
  goal.textContent = retained ? `Objective retained: ${isLevelCompletion(interrupted.decision?.objective) ? `complete level ${level}`
    : nativeLabel(interrupted.decision?.objective ?? '')}.`
    : 'The trace does not establish that the first post-restart proposal reused the same objective.';
  section.append(goal);
  if (interrupted.decision?.question) {
    const aim = document.createElement('p');
    aim.textContent = `Aim before restart: ${nativeLabel(interrupted.decision.question).replace(/[.!?]$/, '')}.`;
    section.append(aim);
  }
  if (following?.decision?.question) {
    const aim = document.createElement('p');
    aim.textContent = `First aim after restart (action ${following.sequence}): ${nativeLabel(following.decision.question).replace(/[.!?]$/, '')}.`;
    section.append(aim);
  }
  if (route?.decision) {
    const caption = document.createElement('p');
    const shown = route.decision.steps.map(step => step.action);
    caption.textContent = `New native route at action ${route.sequence} · ${route.decision.remainingSteps} proposed steps: ${shown.join(' → ')}${shown.length < route.decision.remainingSteps ? ' …' : '.'}`;
    section.append(caption);
    renderRecoveryComparison(section, route, returns, palette);
    section.append(renderFrames(route.decision.sprites.map(sprite => [sprite.label, sprite.before] as const), palette));
    renderRecoveryContinuation(section, route, returns, palette);
  } else {
    const pending = document.createElement('p');
    pending.textContent = 'No post-restart route with published coordinates has been captured yet.';
    section.append(pending);
  }
  container.append(section);
}

function renderDecisionConfigurations(container: Element, decision: Decision, kind?: 'strategy' | 'objective'): void {
  for (const configuration of explainDecision(decision)) {
    if ((kind && configuration.kind !== kind) || (kind === 'strategy' && configuration.title)) continue;
    const details = document.createElement('details');
    details.className = 'sic-details';
    const title = document.createElement('summary');
    title.textContent = 'Why this ' + configuration.kind + '?';
    const facts = document.createElement('dl');
    for (const [label, description] of [
      ['Need', configuration.need], ['Situation', configuration.situation], ['Choice', configuration.choice],
    ] as const) {
      const term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = label;
      value.textContent = description;
      facts.append(term, value);
    }
    details.append(title, facts);
    container.append(details);
  }
}

function selectTimelineEpisodes(timeline: ReturnType<typeof strategyTimeline>, level: number | undefined) {
  const previousLevel = timeline.filter(item => item.first.fromLevel !== level).at(-1)?.first.fromLevel;
  const visible = timeline.filter(item => item.first.fromLevel === level || item.first.fromLevel === previousLevel);
  const recent = visible.slice(-12);
  const highlights = visible.filter(item => item.status === 'contradicted' || followsContradiction(item)).slice(-6);
  return visible.filter(item => recent.includes(item) || highlights.includes(item));
}

function followsContradiction(item: ReturnType<typeof strategyTimeline>[number]) {
  return item.facts.has('previousPredictionFailed') && item.facts.has('differentPlan');
}

function renderGenericTimeline(panel: HTMLElement, container: Element, selected: ReturnType<typeof strategyTimeline>,
  palette: readonly string[], expanded: ReadonlyMap<string | undefined, boolean>): void {
  const lastContradiction = selected.filter(item => item.status === 'contradicted').at(-1);
  const section = document.createElement('section');
  section.className = 'sic-strategy-configurations';
  const heading = document.createElement('h5');
  heading.textContent = 'Strategy timeline';
  section.append(heading);
  if (!selected.length) {
    const note = document.createElement('p');
    note.textContent = 'No native plan and return recorded in this session yet.';
    section.append(note);
  }
  const statuses = { contradicted: 'Prediction contradicted', advanced: 'Level advanced', replaced: 'Plan replaced',
    confirmed: 'Prediction matched', unverified: 'No confirmed prediction' };
  const nav = document.createElement('nav'), list = document.createElement('ol');
  nav.className = 'sic-strategy-chain';
  nav.setAttribute('aria-label', 'Strategy timeline by action');
  const key = (n: number) => `method:${n}`;
  for (const episode of selected) {
    const { first, last, previous, next, rule, status } = episode;
    const action = (item: DirectionalReturn) => item.decision?.steps[0]?.action ?? commands[item.command] ?? 'Action';
    const actions = first.sequence === last.sequence ? String(first.sequence) : `${first.sequence}–${last.sequence}`;
    const operation = compositionOperations.find(item => item.key === first.decision?.operation);
    const searchOperation = compositionOperations.find(item => item.key === first.decision?.searchOperation);
    const operations = [searchOperation?.key, operation?.key].filter(Boolean).join(' → ');
    const badge = operations ? ` · ${operations}` : '';
    const row = document.createElement('li');
    row.append(strategyJump(section, key(first.sequence), `${actions} · ${statuses[status]}${badge}`));
    list.append(row);
    const details = document.createElement('details'), title = document.createElement('summary');
    details.className = 'sic-details';
    details.dataset.sicMethod = String(first.sequence);
    details.dataset.strategyChoice = key(first.sequence);
    details.open = expanded.get(details.dataset.sicMethod) ?? episode === lastContradiction;
    const viewStrategy = first.decision?.viewStrategy;
    const chosen = first.decision?.recoveryDecision?.strategy ?? first.decision?.frontierStrategy?.title ?? viewStrategy?.title;
    const method = [operations, chosen ?? (first.decision?.question ? nativeLabel(first.decision.question)
      : operation?.description ?? rule?.title ?? 'Observe an action return')].filter(Boolean).join(' · ');
    title.textContent = `L${first.fromLevel} · ${actions} · ${method} · ${statuses[status]}`;
    details.append(title);
    const facts = document.createElement('dl');
    const planText = (item: DirectionalReturn) => (item.decision?.steps.slice(0, 5).map(step => step.action).join(' → ') || action(item))
      + ((item.decision?.remainingSteps ?? 0) > 5 ? ' → …' : '');
    const expected = last.decision?.steps[0]?.expected;
    const check = last.nativeCheck?.reason;
    const factsList: [string, string][] = [];
    if (operation && rule) factsList.push(['SIC strategy rule', rule.title]);
    if (rule) factsList.push(['Need', rule.need], ['Situation', rule.situation]);
    if (searchOperation) factsList.push(['Access search', `${searchOperation.key} · ${searchOperation.description}`]);
    if (operation) factsList.push(['Native composition operation', `${operation.key} · ${operation.description}`]);
    const frontierStrategy = first.decision?.frontierStrategy;
    if (frontierStrategy) {
      factsList.push(['Frontier strategy', frontierStrategy.title], ['Information objective', frontierStrategy.objective.label]);
      const learned = last.nativeCheck?.frontierOutcome;
      if (learned?.objective === frontierStrategy.objective.id) factsList.push(['Information outcome', learned.status === 'observed'
        ? 'The untried input was executed and its public return was acquired.'
        : 'The observed route was interrupted before the untried input.']);
      if (frontierStrategy.inputOrder) factsList.push(['Experiment priority', frontierInputOrders[frontierStrategy.inputOrder]]);
      const localRule = frontierStrategy.localRule;
      if (localRule) factsList.push([localRule.title, `${localRule.matched ? localRule.mode === 'active' ? 'Applied' : 'Matched in shadow' : 'Did not match'}. ${localRule.reason}`]);
      if (frontierStrategy.choices && frontierStrategy.choices.least_tried !== frontierStrategy.choices.command_order) {
        const { least_tried, command_order } = frontierStrategy.choices;
        factsList.push(['Choice on this board', `Least-used: ${least_tried} · Stable order: ${command_order}`]);
      }
    }
    if (viewStrategy) {
      factsList.push(['Need', 'Observe access to more of the board'], ['Information objective', viewStrategy.objective.label]);
      if (viewStrategy.expectedPixels !== null) factsList.push(['Potential new screen area', `${viewStrategy.expectedPixels} pixels if the forecast screen shift occurs.`]);
      const returned = last.nativeCheck?.viewOutcome;
      if (returned?.objective === viewStrategy.objective.id) factsList.push(['Observed screen return', returned.status === 'unregistered'
        ? 'The two views could not be aligned reliably.' : returned.status === 'expanded' ? `${returned.newPixels} newly visible pixels.` : 'No new area was measured.']);
    }
    if (!operation && first.decision?.question) factsList.push(['What the engine is trying', nativeLabel(first.decision.question)]);
    factsList.push(['Plan', planText(first)], ['Return', `${last.sequence} · ${action(last)} · ${statuses[status]}${expected ? ` · Expected: ${expected}` : ''}.`]);
    if (check && status === 'contradicted') factsList.push(['Native check', nativeLabel(check)]);
    if (status === 'contradicted' && last.toLevel > last.fromLevel) {
      factsList.push(['Progress', `The game still advanced to level ${last.toLevel}.`]);
    }
    if ((status === 'contradicted' || status === 'replaced') && next) {
      factsList.push(['Next plan', `Action ${next.sequence} · ${planText(next)}.`]);
      if (isLevelCompletion(last.decision?.objective) && isLevelCompletion(next.decision?.objective)) {
        factsList.push(['Objective', 'The objective of completing the level stayed the same.']);
      }
    }
    if (status === 'contradicted' || status === 'replaced') {
      factsList.push(['Still uncertain', status === 'contradicted'
        ? 'The return invalidates the prediction for this step. It does not establish why the prediction failed.'
        : 'The next plan was different; the engine did not report that this return refuted the previous plan.']);
    }
    const recoveryDecision = first.decision?.recoveryDecision;
    if (recoveryDecision) {
      factsList.push(['SIC need', recoveryDecision.need], ['Active strategy', recoveryDecision.strategy],
        ['Configured search limits', `${recoveryDecision.maxDepth} moves · ${recoveryDecision.maxNodes} states`]);
      if (recoveryDecision.objective) factsList.push(['Recovery objective', recoveryDecision.objective.label]);
      if (recoveryDecision.packDigest) factsList.push(['Pack revision', recoveryDecision.packDigest.slice(0, 12)]);
      const recoveryNeed = last.nativeCheck?.recoveryNeed;
      if (recoveryNeed?.status === 'assigned') factsList.push(['Need status', 'Assigned · the engine checked this step and continues the search.']);
      if (recoveryNeed?.status === 'satisfied') factsList.push(['Need status', 'Satisfied · the game confirmed progression.']);
      if (recoveryNeed?.status === 'refuted') factsList.push(['Need status', 'Refuted · the revised projection disagreed with the return.']);
      if (recoveryNeed?.status === 'expired') factsList.push(['Need status', 'Expired · the current evidence can no longer authorize recovery.']);
    }
    for (const [name, description] of factsList) {
      const term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = name; value.textContent = description; facts.append(term, value);
    }
    details.append(facts);
    if (recoveryDecision?.agenda?.length) {
      const context = document.createElement('p');
      context.textContent = recoveryDecision.situationAction === undefined ? 'Judged from the current board.'
        : `Judged from the board after action ${recoveryDecision.situationAction}.`;
      details.append(context, renderAgenda('Contact recovery priority', contactRecoveryStrategies, recoveryDecision.agenda, recoveryDecision.agendaEvidence));
    }
    if (frontierStrategy?.agenda.length) details.append(renderAgenda('Exploration strategy priority', frontierStrategies, frontierStrategy.agenda));
    if (viewStrategy?.agenda.length) details.append(renderAgenda('View access strategies', viewStrategies, viewStrategy.agenda, viewStrategy.agendaEvidence));
    const recoveryOperations = first.decision?.recoveryOperations;
    if (recoveryOperations?.length) {
      const recovery = document.createElement('ol');
      recovery.className = 'sic-recovery-timeline';
      recovery.setAttribute('aria-label', 'How the blocked plan recovered');
      for (const { key: op, finding } of recoveryOperations) {
        const step = document.createElement('li');
        step.textContent = `${op} · ${finding}`;
        recovery.append(step);
      }
      details.append(recovery);
      const action = first.decision?.recoveryAction;
      const source = selected.find(item => action === item.last.sequence && item.first.sessionId === first.sessionId);
      if (source) details.append(strategyJump(section, key(source.first.sequence), `See the counterexample at action ${action}`));
    }
    const source = status === 'contradicted' || status === 'replaced' ? last : followsContradiction(episode) ? previous : last;
    const addSprites = () => {
      if (!details.open || details.querySelector('[data-return-sprites]') || !source) return;
      const samples = document.createElement('div');
      samples.dataset.returnSprites = '';
      samples.append(...strategyEvidenceFrames(source, palette, `Action ${source.sequence}`));
      if (status === 'contradicted' && next) samples.append(...strategyEvidenceFrames(next, palette, `New plan · action ${next.sequence}`));
      if (!samples.querySelector('canvas')) {
        const note = document.createElement('p');
        note.textContent = 'No localized sprite retained for this return.';
        samples.append(note);
      }
      details.append(samples);
    };
    details.addEventListener('toggle', addSprites);
    section.append(details);
    addSprites();
  }
  if (selected.length) {
    nav.append(list);
    heading.after(nav);
  }
  container.append(section);
}

function strategyEvidenceFrames(item: DirectionalReturn, palette: readonly string[], prefix: string): HTMLElement[] {
  const frames: (readonly [string, NativeRows | null])[] = [];
  const subject = item.decision?.sprites.find(sprite => sprite.label === 'Clicked area')
    ?? item.decision?.sprites.find(sprite => sprite.label.startsWith('Controlled footprint'));
  if (subject) frames.push([`${prefix} · ${subject.label} before`, subject.before], [`${prefix} · same area after`, subject.after]);
  for (const sprite of item.decision?.sprites ?? []) {
    if (sprite.label === 'Controlled root' || sprite.label.startsWith('Material ')) {
      frames.push([`${prefix} · ${sprite.label} before`, sprite.before], [`${prefix} · same area after`, sprite.after]);
    }
  }
  const destination = item.decision?.sprites.find(sprite => sprite.label === 'Predicted destination');
  if (destination) frames.push([`${prefix} · predicted destination before`, destination.before],
    [`${prefix} · what returned there`, destination.after]);
  if (item.translation) frames.push([`${prefix} · moved sprite`, item.translation.sprite], [`${prefix} · destination before`, item.translation.targetBefore]);
  else if (item.stationary) frames.push([`${prefix} · stationary sprite`, item.stationary.sprite], [`${prefix} · area ahead`, item.stationary.ahead]);
  for (const [index, changed] of (item.changes?.samples ?? []).slice(0, item.nativeCheck?.matched === false ? 3 : 1).entries()) {
    frames.push([`${prefix} · change ${index + 1} before`, changed.before], [`${prefix} · change ${index + 1} after`, changed.after]);
  }
  if (!frames.length && item.decision?.strategyTarget) frames.push([`${prefix} · planned area`, item.decision.strategyTarget.before]);
  return frames.length ? [renderFrames(frames, palette)] : [];
}

function renderStrategyEpisodes(panel: HTMLElement, container: Element, returns: readonly DirectionalReturn[], timeline: ReturnType<typeof strategyTimeline>, pending: NativeResolution | null,
  level: number | undefined, palette: readonly string[], expanded: ReadonlyMap<string | undefined, boolean>): void {
  const last = returns.at(-1);
  const episodes = last ? strategyEpisodes(returns, last.sessionId) : [];
  const current = pending ? explainDecision(pending).filter(rule => rule.title) : [];
  const priorLevel = episodes.filter(item => item.first.fromLevel !== level).at(-1)?.first.fromLevel;
  const visible = episodes.filter(item => item.first.fromLevel === level || item.first.fromLevel === priorLevel).slice(-16);
  if (!visible.length && !current.length) return;
  const section = document.createElement('section');
  section.className = 'sic-strategy-configurations';
  const heading = document.createElement('h5');
  heading.textContent = 'Immediate aims and their evidence';
  const intro = document.createElement('p');
  intro.textContent = 'What the engine tried to find out or achieve, and what the game returned.';
  section.append(heading, intro);
  const important = new Set(['colorContact', 'reserveContact', 'reserveAndColor', 'targetContact']);
  const cardId = (first: DirectionalReturn, when: string) => `${first.sessionId}:${first.sequence}:${when}`;
  const chainLevel = visible.filter(item => item.configuration.when === 'colorContact'
    || item.configuration.when === 'reserveAndColor').at(-1)?.first.fromLevel;
  const chain = visible.filter(({ configuration, first, last: end }) => first.fromLevel === chainLevel
    && (important.has(configuration.when) || (configuration.when === 'reserveRoute' && end.decision?.context?.effect === 'modifier')));
  if (chain.length > 1) {
    const nav = document.createElement('nav'), list = document.createElement('ol');
    nav.setAttribute('aria-label', `Level ${chainLevel} strategy sequence`);
    nav.className = 'sic-strategy-chain';
    const title = document.createElement('h6');
    title.textContent = `Level ${chainLevel} · Sequence of immediate aims`;
    for (const { configuration, first, last: end } of chain) {
      const row = document.createElement('li');
      const label = configuration.when === 'reserveRoute' ? 'Test orientation'
        : configuration.when === 'reserveContact' ? 'Recharge' : configuration.when === 'colorContact' ? 'Test color'
          : configuration.when === 'reserveAndColor' ? 'Color and reserve' : 'Try the target';
      row.append(strategyJump(section, cardId(first, configuration.when), `${end.sequence} · ${label}`));
      list.append(row);
    }
    nav.append(title, list);
    section.append(nav);
  }
  for (const configuration of current) {
    if (visible.some(item => item.configuration.when === configuration.when && item.last.decision?.proposalRef === pending?.proposalRef)) continue;
    const active = document.createElement('p');
    active.textContent = `Proposed · ${configuration.title}: ${configuration.need}. ${configuration.choice}`;
    section.append(active);
  }
  for (const { configuration, first, last: end } of visible) {
    const start = first.decision!, decision = end.decision!;
    const strategy = start.context?.strategy;
    const details = document.createElement('details'), title = document.createElement('summary');
    details.className = 'sic-details';
    details.dataset.strategyChoice = cardId(first, configuration.when);
    details.open = expanded.get(details.dataset.strategyChoice) ?? (important.has(configuration.when)
      && !visible.some(other => other.configuration.when === configuration.when && other.first.sequence > first.sequence));
    const actions = first.sequence === end.sequence ? `action ${first.sequence}` : `actions ${first.sequence}–${end.sequence}`;
    const orientation = configuration.when === 'reserveRoute' && decision.context?.effect === 'modifier';
    title.textContent = `L${first.fromLevel} · ${actions} · ${orientation ? 'Test orientation within the reserve' : configuration.title}`;
    const facts = document.createElement('dl');
    const evidence = [
      strategy?.color === 'different' && (configuration.when === 'colorContact' || configuration.when === 'reserveAndColor')
        ? 'The compared motifs had different colors.' : null,
      strategy?.meter ? `At selection: about ${strategy.meter.steps} moves before the gauge ran out at the observed rate.` : null,
      strategy?.directCost != null && strategy.capacityNeeded
        ? `The direct route needed at least ${strategy.directCost} moves.` : null,
      strategy?.totalCost != null && strategy.plannedCharges > 0
        ? `The engine projected ${strategy.totalCost} moves with ${strategy.plannedCharges} recharge ${strategy.plannedCharges === 1 ? 'stop' : 'stops'}.` : null,
      strategy?.colorWitness != null ? `The engine reused the color effect seen at action ${strategy.colorWitness}.` : null,
    ].filter(Boolean).join(' ');
    const meter = decision.strategyMeter;
    const measured = meter?.unitsAfter != null ? ` Gauge length: ${meter.unitsBefore} → ${meter.unitsAfter} pixels.` : '';
    const poseAfter = orientation ? orientationAfter(end, returns) : null;
    const pose = poseAfter === 'aligned' ? ' Before the next action, the engine measured aligned motifs.'
      : poseAfter === 'different' ? ' Before the next action, the engine still measured an orientation difference.' : '';
    const factsList = [
      ['Need', configuration.need],
      ['Situation', [configuration.situation, evidence].filter(Boolean).join(' ')],
      ['Choice', orientation ? 'Reach the orientation contact while keeping enough reserve to continue.' : configuration.choice],
      ['Return', strategyOutcome(configuration, end) + pose + measured],
    ] as const;
    for (const [name, description] of factsList) {
      const term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = name; value.textContent = description;
      facts.append(term, value);
    }
    details.append(title, facts);
    const method = timeline.find(episode => first.sequence >= episode.first.sequence && first.sequence <= episode.last.sequence);
    if (method?.rule && panel.querySelector(`[data-sic-method="${method.first.sequence}"]`)) {
      details.append(perspectiveJump(panel, 'strategies', `[data-sic-method="${method.first.sequence}"]`, `Strategy: ${method.rule.title}`));
      const methodCard = panel.querySelector(`[data-sic-method="${method.first.sequence}"]`)!;
      methodCard.append(perspectiveJump(panel, 'objectives', `[id="sic-aim-${first.sequence}-${configuration.when}"]`, 'See the immediate aim'));
    }
    details.id = `sic-aim-${first.sequence}-${configuration.when}`;
    const links = strategyLinks({ configuration, first, last: end }, episodes, returns);
    const uncertainty = configuration.when === 'reserveContact'
      ? 'A gauge rise confirms this return; it does not establish that every similar tile refills it.'
      : configuration.when === 'colorContact'
        ? 'This contact tests one color transition. Other colors or repeat contacts may behave differently.'
        : configuration.when === 'targetContact'
          ? 'The successful contact shows which conditions held together. It does not isolate which of them are necessary.'
          : orientation ? 'A pose measurement can justify the next step. It does not establish that every approach produces the same rotation.'
            : null;
    if (uncertainty) {
      const note = document.createElement('p');
      note.textContent = `Still uncertain: ${uncertainty}`;
      details.append(note);
    }
    const frames = () => {
      if (!details.open || details.querySelector('.sic-sprites')) return;
      const target = decision.strategyTarget ?? start.strategyTarget;
      const terminal = decision.remainingSteps === 1 && decision.stepIndex != null;
      if (target) details.append(renderFrames([['Planned tile · before', target.before],
        ['Planned tile · after the last step', terminal ? target.after : null]], palette));
      if (configuration.when === 'colorContact' || configuration.when === 'reserveAndColor' || configuration.when === 'targetContact' || orientation) {
        for (const [index, sprite] of decision.sprites.filter(sprite => sprite.label.startsWith('Pattern compared')).entries()) {
          details.append(renderFrames([[`Motif ${index + 1} · before`, sprite.before],
            [`Motif ${index + 1} · after`, sprite.after]], palette));
        }
      }
      if (meter || start.strategyMeter) {
        details.append(renderStrategyGauge(meter ? [['Gauge · before the last step', meter.before],
          ['Gauge · after the last step', meter.after]] : [['Gauge · at selection', start.strategyMeter!.before]], palette));
      }
      if (links.length) {
        const reused = document.createElement('details');
        reused.className = 'sic-details sic-strategy-reuse';
        const summary = document.createElement('summary');
        summary.textContent = 'What the engine used';
        reused.append(summary);
        for (const link of links) {
          const sourceCard = visible.find(item => item.first.sequence <= link.source.sequence && item.last.sequence === link.source.sequence);
          const jump = sourceCard ? strategyJump(section, cardId(sourceCard.first, sourceCard.configuration.when), `See action ${link.source.sequence}`) : null;
          renderStrategyLink(reused, link, first, palette, jump);
        }
        details.append(reused);
      }
    };
    details.addEventListener('toggle', frames);
    section.append(details);
    frames();
  }
  container.append(section);
}

function perspectiveJump(panel: HTMLElement, tab: 'strategies' | 'objectives', selector: string, label: string) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sic-evidence-link';
  button.textContent = label;
  button.addEventListener('click', () => {
    const target = panel.querySelector<HTMLElement>(selector);
    if (!target) return;
    selectPerspective(panel, panel.querySelector<HTMLButtonElement>(`#sic-${tab}-tab`)!);
    if (target instanceof HTMLDetailsElement) target.open = true;
    (target.querySelector('summary') ?? target).focus();
    target.scrollIntoView({ block: 'nearest' });
  });
  return button;
}

function strategyJump(section: HTMLElement, id: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sic-evidence-link';
  button.textContent = label;
  button.addEventListener('click', () => {
    const target = [...section.querySelectorAll<HTMLDetailsElement>('details[data-strategy-choice]')]
      .find(details => details.dataset.strategyChoice === id);
    if (!target) return;
    target.open = true;
    target.querySelector('summary')?.focus();
    target.scrollIntoView({ block: 'nearest' });
  });
  return button;
}

function renderStrategyGauge(frames: readonly (readonly [string, NativeRows | null])[], palette: readonly string[]): HTMLElement {
  const group = renderFrames(frames, palette);
  group.classList.add('sic-strategy-gauge');
  for (const canvas of group.querySelectorAll('canvas')) {
    const scale = Math.min(3, 168 / canvas.width, 72 / canvas.height);
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
  }
  return group;
}

function renderStrategyLink(container: Element, link: StrategyLink, first: DirectionalReturn, palette: readonly string[],
  jump: HTMLButtonElement | null): void {
  const section = document.createElement('div'), text = document.createElement('p');
  const action = link.source.sequence, source = link.source.decision, current = first.decision;
  if (link.kind === 'gauge') {
    const a = source?.strategyMeter, b = current?.strategyMeter;
    text.textContent = `Measured again: the same gauge refilled at action ${action}. This choice used its current reading (${b?.unitsBefore} pixels).`;
    section.append(text);
    if (a?.after && b) section.append(renderStrategyGauge([[`After action ${action}`, a.after], ['Gauge at this choice', b.before]], palette));
  } else {
    text.textContent = link.kind === 'color' ? `Measured again: the motifs that matched after action ${action} still matched when this choice was made.`
      : link.kind === 'nativeColor' ? `Cited by 0.68: the earlier color effect at action ${action}.`
        : link.kind === 'nativePattern' ? `Cited by 0.68: the change to one motif at action ${action}.`
          : `Cited by 0.68: the earlier contact used to plan the approach at action ${action}.`;
    section.append(text);
    const sourceMotifs = source?.sprites.filter(sprite => sprite.label.startsWith('Pattern compared')) ?? [];
    const currentMotifs = current?.sprites.filter(sprite => sprite.label.startsWith('Pattern compared')) ?? [];
    for (const [index, sprite] of sourceMotifs.entries()) {
      section.append(renderFrames([
        [`Motif ${index + 1} · before action ${action}`, sprite.before],
        [`Motif ${index + 1} · after action ${action}`, sprite.after],
        [`Motif ${index + 1} · this choice`, currentMotifs[index]?.before ?? null],
      ], palette));
    }
  }
  if (jump) section.append(jump);
  container.append(section);
}

function renderRecoveryContinuation(section: HTMLElement, first: DirectionalReturn,
  returns: readonly DirectionalReturn[], palette: readonly string[]): void {
  const plans = recoveryContinuation(first, returns);
  if (!plans.length) return;
  const heading = document.createElement('h5');
  heading.textContent = 'From the first contact to the exit';
  const timeline = document.createElement('ol');
  timeline.className = 'sic-recovery-timeline';
  for (const start of plans) {
    const comparison = compareRecoveryRoute(start, returns)!;
    const end = comparison.executed.at(-1) ?? start;
    const plan = start.decision!;
    const context = plan.context;
    const row = document.createElement('li'), details = document.createElement('details');
    const title = document.createElement('summary');
    const contact = context?.access === 'contact' && comparison.completed;
    const range = start.sequence === end.sequence ? `Action ${start.sequence}` : `Actions ${start.sequence}–${end.sequence}`;
    const label = end.toLevel > end.fromLevel ? `Exit · Level ${end.toLevel}`
      : contact && context.effect === 'modifier' ? 'Orientation contact'
        : contact && context.effect === 'capacity_probe' ? 'Reserve contact'
          : contact && context.effect === 'peer' ? 'Target contact'
            : comparison.abandoned ? 'Route replaced' : 'Approach';
    title.textContent = `${range} · ${label}`;
    row.dataset.sicPlanAction = String(start.sequence);
    details.append(title);
    details.addEventListener('toggle', () => {
      if (!details.open || details.childElementCount > 1) return;
      const note = document.createElement('p');
      note.textContent = plan.question ? nativeLabel(plan.question).replace(/[.!?]$/, '') + '.' : 'The proposal has no recorded question.';
      details.append(note);
      if (context?.entryActions.length && context.entryDelta !== null) {
        const evidence = document.createElement('p');
        const gap = context.residual === 0 ? 'The motifs are aligned.' : context.residual === null ? ''
          : `The motifs are ${context.residual} quarter turns apart.`;
        evidence.textContent = `The plan uses a rotation of ${context.entryDelta} quarter turn(s) per contact. ${gap}`;
        details.append(evidence);
        const links = document.createElement('div');
        links.className = 'sic-animation-controls';
        for (const action of context.entryActions) {
          const source = plans.find(item => item.sequence <= action
            && (compareRecoveryRoute(item, returns)?.executed.at(-1)?.sequence ?? item.sequence) >= action);
          if (!source || source.sequence >= start.sequence) continue;
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `Contact at action ${action}`;
          button.addEventListener('click', () => {
            const target = timeline.querySelector<HTMLDetailsElement>(`[data-sic-plan-action="${source.sequence}"] > details`);
            if (!target) return;
            target.open = true;
            target.querySelector('summary')?.focus();
          });
          links.append(button);
        }
        if (links.childElementCount) details.append(links);
      } else if (context?.orientation === 'aligned' || context?.orientation === 'different') {
        const orientation = document.createElement('p');
        orientation.textContent = context.orientation === 'aligned' ? 'The engine measures the two motifs as aligned.' : 'The engine measures different orientations for the two motifs.';
        details.append(orientation);
      }
      if (contact) {
        if (end.rotation) details.append(renderFrames([
          ['Tile entered', end.rotation.tile],
          ['Orientation before', end.rotation.before],
          ['Orientation after', end.rotation.after],
        ], palette));
        const sprites = end.decision?.sprites.filter(sprite => sprite.label.startsWith('Pattern compared')) ?? [];
        for (const sprite of sprites) details.append(renderFrames([
          [`${sprite.label} · before contact`, sprite.before],
          ['After contact', sprite.after],
        ], palette));
        if (end.toLevel > end.fromLevel) {
          const boundary = document.createElement('p');
          boundary.textContent = `The return advances to level ${end.toLevel}.`;
          details.append(boundary, renderFrames((end.animation ?? []).map(item => [`Return frame ${item.index}`, item.rows] as const), palette));
        }
      }
      renderDecisionConfigurations(details, plan);
      renderRecoveryComparison(details, start, returns, palette);
    });
    row.append(details);
    timeline.append(row);
  }
  section.append(heading, timeline);
}

function renderRecoveryComparison(section: HTMLElement, start: DirectionalReturn, returns: readonly DirectionalReturn[],
  palette: readonly string[]): void {
  const plan = start.decision!;
  const comparison = compareRecoveryRoute(start, returns)!;
  const { executed, replacement, interruption, completed, abandoned } = comparison;
  const confirmed = executed.filter(item => item.nativeCheck?.matched === true).length;
  const differed = executed.filter(item => item.nativeCheck?.matched === false).length;
  const summary = document.createElement('p');
  summary.textContent = `${executed.length}/${plan.remainingSteps} steps executed · ${confirmed} confirmed · ${differed} differed · ${executed.length - confirmed - differed} without a verified prediction.`;
  section.append(summary);
  if (replacement || interruption || completed) {
    const event = document.createElement('p');
    if (replacement) {
      event.textContent = abandoned
        ? `Replanned at action ${replacement.sequence}. The remaining ${plan.remainingSteps - executed.length} steps of the old route were left unexecuted.`
        : `Route completed. The engine proposed a new plan at action ${replacement.sequence}.`;
    } else if (interruption) {
      event.textContent = `Action ${interruption.sequence} ${interruption.restart ? 'restarted the board' : 'changed the level'}.`
        + (abandoned ? ' The rest of this route was left unexecuted.' : '');
    } else event.textContent = 'All steps in this proposal were executed.';
    section.append(event);
  }
  const choices = document.createElement('select');
  choices.setAttribute('aria-label', 'Compare recovery steps');
  for (const [index, step] of plan.steps.entries()) {
    const item = executed[index];
    const status = item?.nativeCheck?.matched === true ? 'Confirmed' : item?.nativeCheck?.matched === false ? 'Prediction differed'
      : item ? 'Executed · no verified prediction' : abandoned ? 'Left unexecuted' : 'Pending or unavailable';
    choices.add(new Option(`Step ${index + 1} · ${step.action} · ${status}`, String(index)));
  }
  if (replacement) choices.add(new Option(`Action ${replacement.sequence} · New proposal`, 'replacement'));
  const content = document.createElement('div');
  const update = () => {
    const index = Number(choices.value);
    const item = choices.value === 'replacement' ? replacement : executed[index];
    content.replaceChildren();
    const planned = plan.route[index + 1];
    if (!item && !planned) return;
    const position = document.createElement('p');
    const movement = item?.translation;
    if (planned) {
      position.textContent = `Planned position (${planned.join(', ')})`
        + (movement ? ` · Observed position (${movement.to.slice(0, 2).join(', ')})` : '.');
      content.append(position);
    }
    if (!item) return;
    const decision = item.decision;
    const evidence = document.createElement('p');
    evidence.textContent = choices.value === 'replacement'
      ? `Action ${item.sequence} · ${decision?.steps[0]?.action ?? commands[item.command]} starts the new proposal.`
      : `Action ${item.sequence} · ${item.nativeCheck?.reason ? nativeLabel(item.nativeCheck.reason) : 'No native check retained'}.`;
    content.append(evidence, renderFrames([
      ['Controlled sprite before', decision?.sprites.find(sprite => sprite.label === 'Controlled footprint before the step')?.before ?? null],
      ['Returned pixels at planned position', decision?.destinationSprite ?? null],
      ['Observed moving sprite', item.translation?.sprite ?? null],
    ], palette));
  };
  choices.addEventListener('change', update);
  if (start.routeBoard) {
    const executedSegments = executed.flatMap(item => {
      const movement = item.translation;
      if (movement) return [[[movement.from[0], movement.from[1]], [movement.to[0], movement.to[1]]] as const];
      const route = item.decision?.route;
      return item.nativeCheck?.matched === true && route?.[0] && route[1] ? [[route[0], route[1]] as const] : [];
    });
    section.append(renderRoute(start.routeBoard, plan.route, executedSegments, palette));
  }
  section.append(choices, content);
  update();
}

function renderRoute(rows: NativeRows, points: readonly (readonly [number, number])[],
  executed: readonly (readonly [readonly [number, number], readonly [number, number]])[],
  palette: readonly string[]): HTMLElement {
  const figure = document.createElement('figure');
  figure.className = 'sic-route';
  const width = rows[0]?.length ?? 0, height = rows.length;
  const canvas = document.createElement('canvas');
  canvas.width = width * 3;
  canvas.height = height * 3;
  const ctx = canvas.getContext('2d');
  if (!ctx) return figure;
  rows.forEach((row, y) => row.forEach((color, x) => {
    ctx.fillStyle = palette[color] ?? '#000';
    ctx.fillRect(x * 3, y * 3, 3, 3);
  }));
  const draw = (color: string, line: number) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * 3 + 1.5, y * 3 + 1.5) : ctx.moveTo(x * 3 + 1.5, y * 3 + 1.5));
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.stroke();
  };
  draw('#111', 4);
  draw('#fff', 2);
  ctx.beginPath();
  for (const [[x, y], [toX, toY]] of executed) {
    ctx.moveTo(x * 3 + 1.5, y * 3 + 1.5);
    ctx.lineTo(toX * 3 + 1.5, toY * 3 + 1.5);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#64e9e2';
  ctx.stroke();
  for (const [index, [x, y]] of points.entries()) {
    ctx.fillStyle = index === 0 ? '#64e9e2' : index === points.length - 1 ? '#ffd15a' : '#fff';
    ctx.fillRect(x * 3, y * 3, 3, 3);
  }
  const caption = document.createElement('figcaption');
  caption.textContent = 'White shows the proposed route. Turquoise shows observed movements and positions confirmed by the engine.';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Proposed and executed route on the restored board. ${executed.length} movement segments shown.`);
  figure.append(canvas, caption);
  return figure;
}

function describePlanObjective(source: Pick<NativeResolution, 'objective' | 'objectiveSource'> | null | undefined) {
  if (source?.objectiveSource === 'native' && isLevelCompletion(source.objective)) return 'Native plan objective: complete the current level.';
  if (source?.objectiveSource === 'native' && source.objective) return `Native plan objective: ${nativeLabel(source.objective)}.`;
  if (source?.objectiveSource === 'question' && source.objective) return `Immediate aim from the native proposal: ${nativeLabel(source.objective).replace(/[.!?]$/, '')}.`;
  return source?.objectiveSource === 'unpublished' ? 'A plan exists, but its objective was not retained in the native trace.' : null;
}

function nativeLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    morphology: 'Compare shapes and test a route',
    acquire_control_for_target: 'Find which element the controls move',
    test_peer_contact_after_measured_selective_alignment: 'Test contact with the target after measuring alignment',
    current_geometry_bound: 'The measured geometry still supports this step',
    compare_predicted_position: 'Compare the returned position with the planned position',
    compare_frozen_slide_endpoint_and_static_support: 'Check the expected stopping position and whether the rest of the board stayed as predicted',
    complete_forecast_board_comparison: 'Compare the returned board with the full forecast',
    compare_selective_entry_prediction: 'Check what happens when entering the selected area',
    measure_terminal_contact_or_boundary: 'Check whether contact changes the level or state',
    test_next_dependency_of_a_capacity_feasible_composition: 'Test the next step of a route that fits the available reserve',
  };
  return labels[value] ?? value.replace(/_/g, ' ');
}

export function renderSicPanel(panel: HTMLElement, view: ShadowView | null, palette: readonly string[],
  space: readonly SpaceReturn[], ranks: readonly StckRankTrial[], board: GameObservation | null, mode: 'manual' | 'agent',
  needsRestart: boolean, returns: readonly DirectionalReturn[], objectives: readonly PursuedObjective[]): void {
  panel.querySelector<HTMLElement>('[data-sic-context]')!.textContent = view
    ? `${view.gameCode} · Level ${view.frame.scope.level} · Last settled board` : '';
  panel.querySelector<HTMLElement>('[data-sic-summary]')!.textContent = view ? summaries[view.resolution.outcome] : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-commands]')!.textContent = view?.commands.length
    ? view.commands.map(id => commands[id]).join(', ')
    : view ? 'No command available.' : 'Waiting for the board.';
  panel.querySelector<HTMLElement>('[data-sic-next]')!.textContent = view?.nextAction
    ? actionLabel(view.nextAction) : 'No pending action to show.';
  panel.querySelector<HTMLElement>('[data-sic-plan-next]')!.textContent = panel.querySelector('[data-sic-next]')!.textContent;
  panel.querySelector<HTMLElement>('[data-sic-returns-empty]')!.textContent = view?.commands.includes(6)
    ? 'No click return recorded by V6 yet. Perceptions also shows public command returns.'
    : 'Click is not among the commands available on this board.';
  renderClickReturns(panel, view?.clickEvidence?.returns ?? (view?.clickReturn ? [view.clickReturn] : []), palette);
  renderClickComparisons(panel, view?.clickEvidence ?? null, palette);
  renderSpaceReturns(panel, space, palette, view?.gameCode === 'STCK');
  const groups = summarizeDirections(returns);
  renderBoardAndDirection(panel, board?.frame ?? null, palette, needsRestart, returns);
  renderDiscoveryPerspectives(panel, view, board, mode, returns, groups, palette, objectives);
  renderGameInformation(panel, view?.gameCode === 'STCK', ranks, view, groups, returns);
  renderMechanisms(panel, groups, returns, palette);
  renderRoles(panel, returns, palette, board?.level);
  renderOfflineReview(panel, view?.gameCode === 'LS20' ? view.frame.scope.level : null, palette);
  renderCardComparisons(panel, palette, view?.gameCode === 'STCK');
  renderTowerEffects(panel, palette, view?.gameCode === 'STCK');
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
function renderAgenda<Id extends string>(label: string, labels: Readonly<Record<Id, string>>, agenda: readonly AgendaEntry<Id>[],
  evidence?: Readonly<Partial<Record<Id, readonly number[]>>>): HTMLOListElement {
  const ranking = document.createElement('ol');
  ranking.className = 'sic-recovery-timeline';
  ranking.setAttribute('aria-label', label);
  const outcomes = { selected: 'Selected', no_plan: 'No plan found within limits', lower_priority: 'Lower priority',
    skipped: 'Conditions not met', shadow: 'Applicable in shadow' };
  for (const entry of agenda) {
    if (!Object.hasOwn(labels, entry.id)) continue;
    const candidate = document.createElement('li');
    const outcome = entry.applicability === 'undetermined' ? 'Applicability uncertain' : outcomes[entry.result];
    const actions = evidence?.[entry.id];
    const sources = actions?.length ? ` Evidence from ${actions.length === 1 ? 'action' : 'actions'} ${actions.join(', ')}.` : '';
    candidate.textContent = `${labels[entry.id]} · ${outcome}. ${entry.reason}${sources}`;
    ranking.append(candidate);
  }
  return ranking;
}
