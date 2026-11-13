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
import { firstRecovery, isLevelCompletion, type PursuedObjective } from './recovery.ts';
import compositionOperations from './composition-operations.json';
import type { GameObservation } from '../runtime/browser-games.ts';
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
  describe('[data-sic-strategy-body]', [
    view?.native?.family ? `Native 0.68 · Selected method: ${nativeLabel(view.native.family)}.`
      : repeated.length ? `Observed patterns: ${repeated.map(group => `${commands[group.command]} (${group.moved} matching translations)`).join(', ')}.`
      : view?.commands.length ? `Available to explore: ${view.commands.map(id => commands[id]).join(', ')}.` : 'No available command observed.',
    view?.native?.question ? `What this method checks: ${nativeLabel(view.native.question).replace(/[.!?]$/, '')}.`
      : view?.native?.family ? 'The native trace has no retained purpose for this selection.'
        : 'No solving strategy established. Compare conditions before generalizing a return.',
  ]);
  const strategies = panel.querySelector('[data-sic-strategy-body]')!;
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
  renderObjectives(panel, progress, board, native?.pending ? native : lastPlan, objectives);
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
  current: Pick<NativeResolution, 'objective' | 'objectiveSource' | 'question'> | null | undefined,
  entries: readonly PursuedObjective[]): void {
  const section = panel.querySelector('[data-sic-objective-body]')!;
  const paragraph = (value: string) => { const p = document.createElement('p'); p.textContent = value; return p; };
  section.replaceChildren(paragraph(progress));
  const cards = document.createElement('div');
  cards.className = 'sic-objective-columns';
  const group = (title: string) => {
    const card = document.createElement('section'), heading = document.createElement('h5');
    heading.textContent = title;
    card.append(heading);
    cards.append(card);
    return card;
  };
  const active = group('Current objective');
  active.append(paragraph(board?.state === 'WIN' ? 'The game reports victory.'
    : describePlanObjective(current) ?? 'No current native objective observed.'));
  if (current?.objectiveSource === 'native' && current.question) {
    active.append(paragraph(`Immediate aim: ${nativeLabel(current.question).replace(/[.!?]$/, '')}.`));
  }
  const past = group('Objectives pursued');
  if (!entries.length) past.append(paragraph('No objective has been recorded in this session.'));
  else {
    const details = document.createElement('details');
    const title = document.createElement('summary');
    title.textContent = `${entries.length} recorded episodes`;
    const list = document.createElement('ol');
    for (const entry of [...entries].reverse()) {
      const row = document.createElement('li');
      row.textContent = `Level ${entry.level} · ${entry.first === entry.last ? `action ${entry.first}` : `actions ${entry.first}–${entry.last}`} · `
        + (isLevelCompletion(entry.source.objective) ? `Complete level ${entry.level}`
          : nativeLabel(entry.source.objective ?? entry.source.question ?? 'Objective not retained'))
        + (entry.advanced ? ' · Level advanced' : entry.interrupted ? ' · Interrupted by restart' : '');
      if (entry.source.objectiveSource === 'native' && entry.source.question) {
        row.append(paragraph(`Immediate aim: ${nativeLabel(entry.source.question).replace(/[.!?]$/, '')}.`));
      }
      list.append(row);
    }
    details.append(title, list);
    past.append(details);
  }
  const future = group('Possible future objectives');
  if (board && board.level < board.levelCount && board.state !== 'WIN') {
    future.append(paragraph(`Reach and complete level ${board.level + 1}, if the current level is completed.`),
      paragraph('Suggested by public progression; the native engine has not selected it.'));
    if (board.level + 1 < board.levelCount) future.append(paragraph('Later possibility: finish the remaining levels after that.'));
  } else future.append(paragraph('No further objective supported by the current observations.'));
  section.append(cards);
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
    if (route.routeBoard) section.append(renderRoute(route.routeBoard, route.decision.route, palette));
    section.append(renderFrames(route.decision.sprites.map(sprite => [sprite.label, sprite.before] as const), palette));
  } else {
    const pending = document.createElement('p');
    pending.textContent = 'No post-restart route with published coordinates has been captured yet.';
    section.append(pending);
  }
  container.append(section);
}

function renderRoute(rows: NativeRows, points: readonly (readonly [number, number])[], palette: readonly string[]): HTMLElement {
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
  for (const [index, [x, y]] of points.entries()) {
    ctx.fillStyle = index === 0 ? '#64e9e2' : index === points.length - 1 ? '#ffd15a' : '#fff';
    ctx.fillRect(x * 3, y * 3, 3, 3);
  }
  const caption = document.createElement('figcaption');
  caption.textContent = `Proposed route on the returned board: ${points.map(([x, y]) => `(${x}, ${y})`).join(' → ')}.`;
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
