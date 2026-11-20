/// <reference types="vite/client" />
import './styles.css';
import './sra-agent.css';
import { renderSiteHeader } from './site-header';
import { BrowserGameRuntime, type GameObservation } from './runtime/browser-games';
import { AGENT_STATUS, type AgentAction } from './runtime/contracts';
import { BrowserV6Agent, type V6AgentSnapshot } from './runtime/v6-agent.ts';
import { bindSicPerspectives, renderSicPanel } from './sic/panel.ts';
import { bindSrcStrategyEditor } from './sic/src-strategy-editor.ts';
import { bindRecoverySettings, renderActionCoverage } from './sic/recovery-settings.ts';
import { as66Contradiction, type ContradictionReview } from './sic/contradiction-review.ts';
import { readControlEffectShadow } from './sic/shadow.ts';
import { observeSpace, type SpaceReturn } from './sic/space-return.ts';
import { compareStckRank, type StckRankTrial } from './sic/stck-stack.ts';
import { matchObservedRotation, observeDirectionalReturn, samplePublicAnimation, type DirectionalReturn } from './sic/directional-return.ts';
import { captureDecisionSprites, readNativeResolution, type NativeResolution } from './sic/native-resolution.ts';
import { defaultRecoveryPack, isRecoveryStop } from './sic/active-recovery.ts';
import { observeLs20Restart, recordPursuedObjective, type PursuedObjective } from './sic/recovery.ts';
import ls20ReviewEvidence from './sic/ls20-review-evidence.json';
import { GAME_CATALOG, getGameByCode, type GameCatalogEntry } from './games/catalog';
import { SINKING_STAR_CREDIT_HTML } from './games/sinking-star/credit.ts';
import { LEVEL_INFO as SS02_LEVEL_INFO } from '../experiments/sinking-star-ss02/src/level-info.ts';
import { lessonPrompt, observeLesson, type TutorialLesson } from '../experiments/sinking-star-ss02/src/tutorial.ts';
import { LEVEL_INFO as SS03_LEVEL_INFO } from '../experiments/sinking-star-ss03/src/level-info.ts';
import { PullTutorial } from '../experiments/sinking-star-ss03/src/tutorial.ts';
import { LEVEL_INFO as SS04_LEVEL_INFO } from '../experiments/sinking-star-ss04/src/level-info.ts';
import { lessonPrompt as wizardPrompt, observeLesson as observeWizardLesson, type WizardLesson } from '../experiments/sinking-star-ss04/src/tutorial.ts';
import { LEVEL_INFO as SS05_LEVEL_INFO } from '../experiments/sinking-star-ss05/src/level-info.ts';
import { lessonPrompt as bardPrompt, observeLesson as observeBardLesson, type BardLesson } from '../experiments/sinking-star-ss05/src/tutorial.ts';
import { LEVEL_INFO as SS06_LEVEL_INFO } from '../experiments/sinking-star-ss06/src/level-info.ts';
import { actionFeedback as duoFeedback, lessonIds as duoLessonIds, lessonPrompt as duoPrompt, observeLesson as observeDuoLesson, visibleHeroes, type DuoLesson } from '../experiments/sinking-star-ss06/src/tutorial.ts';
import { LEVEL_INFO as SS07_LEVEL_INFO } from '../experiments/sinking-star-ss07/src/level-info.ts';
import { actionFeedback as thiefFeedback, lessonIds as thiefLessonIds, lessonPrompt as thiefPrompt, observeLesson as observeThiefLesson, visibleHeroes as visibleThiefHeroes, type ThiefLesson } from '../experiments/sinking-star-ss07/src/tutorial.ts';
import { LEVEL_INFO as SS08_LEVEL_INFO } from '../experiments/sinking-star-ss08/src/level-info.ts';
import { actionFeedback as transpositionFeedback, lessonIds as transpositionLessonIds, lessonPrompt as transpositionPrompt, observeLesson as observeTranspositionLesson, TUTORIAL_LEVEL as SS08_TUTORIAL_LEVEL, visibleHeroes as visibleTranspositionHeroes, type TranspositionLesson } from '../experiments/sinking-star-ss08/src/tutorial.ts';
import { LEVEL_INFO as SS09_LEVEL_INFO } from '../experiments/sinking-star-ss09/src/level-info.ts';
import { actionFeedback as chorusFeedback, lessonIds as chorusLessonIds, lessonPrompt as chorusPrompt, observeLesson as observeChorusLesson, TUTORIAL_LEVEL as SS09_TUTORIAL_LEVEL, visibleHeroes as visibleChorusHeroes, type ChorusLesson } from '../experiments/sinking-star-ss09/src/tutorial.ts';
import { LEVEL_INFO as SS10_LEVEL_INFO } from '../experiments/sinking-star-ss10/src/level-info.ts';
import { actionFeedback as warehouseFeedback, lessonIds as warehouseLessonIds, lessonPrompt as warehousePrompt, observeLesson as observeWarehouseLesson, visibleHeroes as visibleWarehouseHeroes, type WarehouseLesson } from '../experiments/sinking-star-ss10/src/tutorial.ts';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
const isDirectionalNativeGame = (code: string): boolean => code === 'SS02' || code === 'SS03' || code === 'SS04';
type DuoGameCode = 'SS06' | 'SS07' | 'SS08' | 'SS09' | 'SS10';
const isDuoNativeGame = (code: string): code is DuoGameCode => code === 'SS06' || code === 'SS07' || code === 'SS08' || code === 'SS09' || code === 'SS10';
const usesReflectionShortcut = (code: string): boolean => code === 'SS05' || isDuoNativeGame(code);
const usesNativeManualControls = (code: string): boolean => usesReflectionShortcut(code) || isDirectionalNativeGame(code);
const fallbackPalette = [
  '#F3F2EB', '#C9CDC8', '#37404B', '#66707B', '#1B2028', '#11161C',
  '#614439', '#E7B9A3', '#F06B65', '#679DEB', '#63D5D6', '#F1CE62',
  '#EBA258', '#86513A', '#77CB93', '#BB94EB',
];
const icon = (name: string, cls = ''): string => {
  const paths: Record<string, string> = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    space: '<path d="M4 9v6h16V9"/>',
    undo: '<path d="m9 5-5 5 5 5M4 10h9a6 6 0 0 1 6 6v3"/>',
    reset: '<path d="M4 7v5h5M5 12a7 7 0 1 1 1.7 4.6"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    hand: '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V11M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 11V8a1.5 1.5 0 0 1 3 0v6c0 4-2 7-6 7h-1a6 6 0 0 1-5-2.7l-3.5-5a1.5 1.5 0 0 1 2.4-1.8L7 14"/>',
    robot: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M12 3v4M2 11v5m20-5v5M9 16h6"/><circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="3" r="1" fill="currentColor" stroke="none"/>',
    github: '<path d="M9 19c-4.3 1.3-4.3-2-6-2m12 5v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6.2 0C6.3 3.4 5.3 3.7 5.3 3.7a4.3 4.3 0 0 0-.1 3.3A4.7 4.7 0 0 0 4 10.3c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V22"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
};

const groupLabels: Record<GameCatalogEntry['group'], string> = {
  custom: 'Custom · Wave 1',
  custom_2: 'Custom · Wave 2',
  custom_3: 'Custom · Wave 3',
  custom_4: 'Custom 4 · Sinking Star',
  official: 'Official ARC-AGI-3',
};
const customCount = GAME_CATALOG.filter(game => game.group !== 'official').length;
const defaultGameCode = 'CASC';
const defaultGame = getGameByCode(defaultGameCode);
if (!defaultGame) throw new Error(`The ${defaultGameCode} catalogue entry is missing.`);
let selectedGame: GameCatalogEntry = getGameByCode(new URL(window.location.href).searchParams.get('game') ?? defaultGameCode) ?? defaultGame;
function requestedLevel(url: URL, game: GameCatalogEntry): number | undefined {
  const value = url.searchParams.get('level');
  if (!value || !/^\d+$/.test(value)) return undefined;
  const level = Number(value);
  return Number.isSafeInteger(level) && level >= 1 && level <= (game.levels ?? 1) ? level : undefined;
}
const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]!);
const gameOptions = Object.entries(groupLabels).map(([group, label]) =>
  `<optgroup label="${escapeHtml(label)}">${GAME_CATALOG.filter(game => game.group === group).sort((a, b) => a.code.localeCompare(b.code, 'en')).map(game =>
    `<option value="${game.code}"${game.code === selectedGame.code ? ' selected' : ''}>${game.code} — ${escapeHtml(game.name)}</option>`,
  ).join('')}</optgroup>`,
).join('');

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application mount is missing.');
app.innerHTML = `
  <a class="skip-link" href="#game-select">Skip to the games</a>
  ${renderSiteHeader('playground')}

  <main>
    <section class="intro wrap" aria-labelledby="page-title">
      <div class="intro-main">
        <h1 id="page-title">SRA Playground</h1>
        <p class="hero-agent">Symbolic Reasoning Agent</p>
        <p class="hero-statement">Toward <em>Understandable Intelligence.</em></p>
      </div>
      <a class="intro-art" href="/gallery.html" aria-label="Explore ${customCount} New Games, followed by 25 official games">
        <img src="/game-mosaic.png?v=custom-wave-3" alt="A patchwork of custom game boards" width="405" height="204" />
        <span class="mosaic-label">EXPLORE ${customCount} NEW GAMES ${icon('arrow')}</span>
      </a>
    </section>

    <aside class="design-premise wrap" aria-labelledby="design-premise-title">
      <h2 id="design-premise-title">DESIGN PREMISE</h2>
      <div>
        <p><strong>The design of artificial intelligence should begin with ethical principles.</strong> Symbolic reasoning makes deliberate design possible through explicit concepts, relations, and reasoning structures rooted in human intelligence. SRA draws its meaning and purpose from this human source, enabling us to take responsibility for the intelligence we build and thereby fulfill the ethical principle that guides its design.</p>
        <a class="text-link" href="/motivation.html">Start here: Motivation ${icon('arrow')}</a>
      </div>
    </aside>

    <section class="playground-section wrap" id="playground" aria-labelledby="playground-title">
      <div class="section-line"><div class="playground-heading-group"><h2 class="playground-heading" id="playground-title">ARC AGI <span>3</span></h2><a class="text-link" href="/arc-agi-3.html">What is ARC-AGI-3? ${icon('arrow')}</a></div><a class="catalog-count" href="/gallery.html" aria-label="${customCount} New Games and 25 official games: browse all ${GAME_CATALOG.length} games">${GAME_CATALOG.length} GAMES<span>/</span>25 OFFICIAL + ${customCount} CUSTOM</a></div>
      <p class="custom-game-credit"><strong>${customCount} new custom games</strong><span class="custom-game-author">created or compiled by <span>Yannick Fontan.</span></span></p>
      <article class="player is-agent-mode">
        <header class="player-header">
          <div class="game-identity">
            <span class="game-code-badge" id="game-code">${selectedGame.code}</span>
            <div><h2 id="game-title">${escapeHtml(selectedGame.name)}</h2><p id="game-meta">${groupLabels[selectedGame.group]}</p></div>
          </div>
          <div class="game-picker">
            <div class="picker-label"><label for="game-select">CHOOSE A GAME</label><span id="game-availability" class="availability-tag">Loading</span></div>
            <select id="game-select">${gameOptions}</select>
          </div>
        </header>
        <p id="selection-feedback" class="sr-only" role="status" aria-live="polite"></p>

        <div class="mode-bar">
          <div class="mode-tabs" role="tablist" aria-label="Play mode">
            <button type="button" id="manual-tab" role="tab" aria-selected="false" aria-controls="manual-panel" tabindex="-1">${icon('hand')}Manual</button>
            <button type="button" id="agent-tab" role="tab" aria-selected="true" aria-controls="agent-panel" tabindex="0">${icon('robot')}SRA Agent<span class="agent-mode-label">Native TS</span></button>
          </div>
          <span class="local-label"><span class="status-dot"></span> In your browser</span>
        </div>

        <div class="play-area minimal-play-area">
          <div class="board-column">
            <button id="fullscreen-button" class="icon-button" type="button" aria-label="Expand game board" title="Expand game board">${icon('expand')}</button>
            <div class="canvas-stage" id="canvas-stage">
              <canvas id="game-canvas" width="64" height="64" tabindex="0" role="application" aria-label="Game board. Use the arrow keys, Space, or click to interact." aria-describedby="keyboard-help">Your browser must support canvas to play.</canvas>
              <div class="runtime-overlay" id="runtime-overlay" role="status" aria-live="polite">
                <span class="runtime-spinner" id="runtime-spinner" aria-hidden="true"></span>
                <p id="runtime-message">Loading game…</p>
                <button class="secondary-button" type="button" id="retry-button" hidden>Retry</button>
              </div>
              <div class="game-overlay" id="win-overlay" role="status" aria-live="polite" hidden>
                <div class="win-check">${icon('check')}</div><h3 id="win-title">VICTORY</h3>
                <button class="primary-button" type="button" id="win-continue"><span id="win-continue-label">Restart from level 1</span>${icon('arrow')}</button>
              </div>
              <div class="game-overlay" id="native-defeat" aria-labelledby="native-defeat-title" hidden>
                <h3 id="native-defeat-title">GAME OVER</h3>
                <div class="utility-controls">
                  <button type="button" id="native-defeat-undo" class="utility-button">Undo</button>
                  <button type="button" id="native-defeat-reset" class="utility-button">Reset level</button>
                </div>
              </div>
            </div>
            <p id="board-source-credit" class="board-source-credit" hidden>${SINKING_STAR_CREDIT_HTML}</p>
          </div>

          <aside class="control-column minimal-control-column">
            <div id="manual-panel" role="tabpanel" aria-labelledby="manual-tab" hidden>
              <div class="level-controls" aria-label="Level navigation">
                <div class="level-picker">
                  <label for="level-select">LEVEL</label>
                  <select id="level-select" aria-label="Jump to level" disabled><option value="">Loading…</option></select>
                </div>
                <button type="button" id="restart-button" class="utility-button restart-button" title="Start this game again from level 1" disabled>${icon('reset')}<span>Restart from level 1</span></button>
              </div>
              <div class="compact-controller" aria-label="Game controls">
                <div class="input-pad">
                  <div class="d-pad" aria-label="Directional actions">
                    <button type="button" data-action="1" class="direction-up" aria-label="Up" title="Arrow up">${icon('up')}</button>
                    <button type="button" data-action="3" class="direction-left" aria-label="Left" title="Arrow left">${icon('left')}</button>
                    <span class="d-pad-center" aria-hidden="true"></span>
                    <button type="button" data-action="4" class="direction-right" aria-label="Right" title="Arrow right">${icon('right')}</button>
                    <button type="button" data-action="2" class="direction-down" aria-label="Down" title="Arrow down">${icon('down')}</button>
                  </div>
                  <button type="button" id="space-button" data-action="5" class="space-action" aria-label="Primary action (Space)" title="Space">${icon('space')}<span>Space</span></button>
                </div>
                <div class="utility-controls">
                  <button type="button" id="merchant-button" class="utility-button" title="Select next Merchant (C)" hidden disabled><span>Merchant · C</span></button>
                  <button type="button" id="undo-button" class="utility-button" aria-label="Undo last action" title="Undo (Z or Ctrl+Z)">${icon('undo')}<span>Undo</span></button>
                  <button type="button" id="reset-button" class="utility-button" aria-label="Reset level" title="Reset level (R)">${icon('reset')}<span>Reset</span></button>
                </div>
              </div>
              <div id="ss06-role-controls" class="utility-controls duo-role-controls" role="group" aria-label="Sélection du personnage" lang="fr" hidden>
                <button type="button" class="utility-button" data-duo-slot="1" data-ss06-hero="merchant" aria-pressed="false">Marchand · 1</button>
                <button type="button" class="utility-button" data-duo-slot="2" data-ss06-hero="warrior" aria-pressed="false">Guerrier · 2</button>
              </div>
              <div id="ss07-role-controls" class="utility-controls duo-role-controls" role="group" aria-label="Sélection du personnage" lang="fr" hidden>
                <button type="button" class="utility-button" data-duo-slot="1" data-ss07-hero="merchant" aria-pressed="false">Marchand · 1</button>
                <button type="button" class="utility-button" data-duo-slot="2" data-ss07-hero="thief" aria-pressed="false">Voleur · 2</button>
              </div>
              <div id="ss08-role-controls" class="utility-controls duo-role-controls" role="group" aria-label="Sélection du personnage" lang="fr" hidden>
                <button type="button" class="utility-button" data-duo-slot="1" data-ss08-hero="merchant" aria-pressed="false">Marchand · 1</button>
                <button type="button" class="utility-button" data-duo-slot="2" data-ss08-hero="wizard" aria-pressed="false">Magicien · 2</button>
              </div>
              <div id="ss09-role-controls" class="utility-controls duo-role-controls" role="group" aria-label="Sélection du personnage" lang="fr" hidden>
                <button type="button" class="utility-button" data-duo-slot="1" data-ss09-hero="merchant" aria-pressed="false">Marchand · 1</button>
                <button type="button" class="utility-button" data-duo-slot="2" data-ss09-hero="bard" aria-pressed="false">Barde · 2</button>
              </div>
              <div id="ss10-role-controls" class="utility-controls duo-role-controls" role="group" aria-label="Sélection du personnage" lang="fr" hidden>
                <button type="button" class="utility-button" data-duo-slot="1" data-ss10-hero="warrior" aria-pressed="false">Guerrier · 1</button>
                <button type="button" class="utility-button" data-duo-slot="2" data-ss10-hero="thief" aria-pressed="false">Voleur · 2</button>
              </div>
              <p id="keyboard-help" class="sr-only">Arrow keys and Space for actions. Click the board to interact. Z or Control Z to undo. R to reset the level. In SS01, C or a click selects a Merchant.</p>
              <p id="ss02-level-info" class="native-game-level-info" lang="fr" hidden></p>
              <details id="ss02-tutorial" class="native-game-tutorial" lang="fr" open hidden>
                <summary>Niveau 1 · Tutoriel guidé</summary>
                <div class="native-game-tutorial-content">
                  <p id="ss02-lesson-next" aria-live="polite"></p>
                  <ul>
                    <li data-ss02-lesson="move">Se déplacer avec les quatre flèches.</li>
                    <li data-ss02-lesson="chain">Pousser deux pierres alignées avec une flèche.</li>
                    <li data-ss02-lesson="bridge">Créer un pont : la pierre immergée devient immobile.</li>
                    <li data-ss02-lesson="gate">Maintenir les deux + roses pour ouvrir la porte.</li>
                  </ul>
                  <p>Rejoins ensuite le contour jaune. Une pierre coincée ? Z annule, R recommence. Si la file est bloquée, la flèche ne la déplace pas.</p>
                </div>
              </details>
              <p id="ss03-level-info" class="native-game-level-info" lang="fr" hidden><span id="ss03-source-label"></span> <a id="ss03-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
              <details id="ss03-tutorial" class="native-game-tutorial" lang="fr" open hidden>
                <summary>Niveau 1 · L’atelier du Voleur</summary>
                <div class="native-game-tutorial-content">
                  <p id="ss03-lesson-next" aria-live="polite"></p>
                  <ul>
                    <li data-ss03-lesson="move">Marcher avec les quatre flèches.</li>
                    <li data-ss03-lesson="pull">S’éloigner d’une caisse pour la tirer d’une case.</li>
                    <li data-ss03-lesson="release">Partir sur le côté pour laisser la caisse en place.</li>
                    <li data-ss03-lesson="place">Contourner une caisse et l’amener sur un + rose.</li>
                    <li data-ss03-lesson="gate">Occuper les trois boutons pour ouvrir la porte.</li>
                  </ul>
                  <p>Le Voleur ne pousse pas. Prévois la case où tu vas te tenir après chaque traction. Pour laisser une caisse sur son bouton, évite de repartir en ligne droite en l’entraînant. Z annule ; R recommence.</p>
                </div>
              </details>
              <details id="ss03-piston-help" class="native-game-tutorial" lang="fr" open hidden>
                <summary>La porte qui pousse</summary>
                <div class="native-game-tutorial-content">
                  <p>Lorsqu’une porte apparaît, elle pousse la caisse ou le Voleur sur sa case, dans le sens du chevron. Une file de caisses avance ensemble.</p>
                  <p>Le petit repère coloré relie chaque bouton à ses portes. Si plusieurs boutons portent le même repère, ils doivent être occupés ensemble. Selon la porte, leur activation l’ouvre ou la ferme.</p>
                  <p>Un déplacement imposé par une porte ne tire pas la caisse derrière le Voleur. Si la poussée est bloquée, l’occupant sur la porte est écrasé. Z permet de revenir en arrière.</p>
                </div>
              </details>
              <p id="ss04-level-info" class="native-game-level-info" lang="fr" hidden><span id="ss04-source-label"></span> <a id="ss04-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
              <details id="ss04-tutorial" class="native-game-tutorial" lang="fr" open hidden>
                <summary>Niveau 1 · L’atelier des échanges</summary>
                <div class="native-game-tutorial-content">
                  <p id="ss04-lesson-next" aria-live="polite"></p>
                  <ul>
                    <li data-ss04-lesson="move">Se déplacer et choisir son axe.</li>
                    <li data-ss04-lesson="swap">Échanger sa place avec une caisse.</li>
                    <li data-ss04-lesson="platform">Créer un appui dans l’eau avec la presse.</li>
                    <li data-ss04-lesson="mirror">Atteindre une cible par le reflet d’un miroir.</li>
                    <li data-ss04-lesson="place">Laisser un poids sur un + rose.</li>
                    <li data-ss04-lesson="gate">Déclencher l’ouverture d’une porte.</li>
                  </ul>
                  <p>Le Magicien n’avance pas vers une caisse visible : il échange immédiatement avec elle. Pour modifier ton alignement, déplace-toi sur le côté. Pour déposer une caisse, tiens-toi à l’endroit voulu avant l’échange.</p>
                  <p>Les appuis marron marqués d’un X cyan sont praticables. Une caisse immergée devient un appui permanent ; on ne peut plus l’échanger.</p>
                </div>
              </details>
              <details id="ss04-piston-help" class="native-game-tutorial" lang="fr" open hidden>
                <summary>La porte qui pousse</summary>
                <div class="native-game-tutorial-content">
                  <p>Lorsqu’une porte apparaît, elle pousse l’occupant de sa case dans le sens du chevron. Une file de caisses avance ensemble.</p>
                  <p>Le petit repère coloré relie chaque bouton à ses portes. Si plusieurs boutons portent le même repère, ils doivent être occupés ensemble. Selon la porte, leur activation l’ouvre ou la ferme.</p>
                  <p>Une caisse poussée dans l’eau forme un appui. Le Magicien peut se noyer ou être écrasé si le passage est bloqué. Z permet de revenir avant toute la séquence.</p>
                </div>
              </details>
              <details id="ss04-mirror-help" class="native-game-tutorial" lang="fr" hidden>
                <summary>Viser avec les miroirs</summary>
                <div class="native-game-tutorial-content">
                  <p>La face blanche d’un miroir fixe renvoie la visée à angle droit. Le dos noir arrête la visée. Suis le reflet jusqu’à la première caisse ou au premier monstre visible pour échanger vos places.</p>
                </div>
              </details>
              <details id="ss04-monster-help" class="native-game-tutorial" lang="fr" hidden>
                <summary>Échanger avec les monstres</summary>
                <div class="native-game-tutorial-content">
                  <p>Les monstres noirs marqués d’un X rouge restent immobiles. Ils peuvent être des cibles d’échange, peser sur un bouton et être déplacés par une presse.</p>
                  <p>Évite de terminer une action juste au-dessus, au-dessous, à gauche ou à droite d’un monstre. Un contact diagonal ne déclenche pas d’attaque.</p>
                  <p>Deux monstres côte à côte s’éliminent mutuellement. Vérifie les deux emplacements avant d’échanger : ta nouvelle position et celle du monstre.</p>
                </div>
              </details>
              <p id="ss05-level-info" class="native-game-level-info" lang="fr" hidden><span id="ss05-source-label"></span> <a id="ss05-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
              <details id="ss05-tutorial" class="native-game-tutorial" lang="fr" open hidden>
                <summary>Niveau 1 · L’atelier du chant</summary>
                <div class="native-game-tutorial-content">
                  <p id="ss05-lesson-next" aria-live="polite"></p>
                  <ul>
                    <li data-ss05-lesson="move">Avancer avec le Barde magenta.</li>
                    <li data-ss05-lesson="song">Entraîner une caisse avec le chant.</li>
                    <li data-ss05-lesson="anchor">Laisser un objet bloqué pour se replacer.</li>
                    <li data-ss05-lesson="platform">Créer ou déplacer un appui sur l’eau.</li>
                    <li data-ss05-lesson="mirror">Changer d’axe avec un miroir.</li>
                    <li data-ss05-lesson="gate">Ouvrir un passage avec un bouton.</li>
                  </ul>
                  <p>Le chant accompagne chaque pas. Il entraîne les objets dans un carré de 5 × 5 cases autour du Barde, diagonales comprises. Un mur peut retenir un objet sans arrêter le chant.</p>
                  <p>Une caisse dans l’eau devient un appui marron avec un X cyan. Le chant peut le faire glisser sur l’eau, mais ne peut pas le remonter sur le sol. L’appui sur lequel tu te trouves ou vas poser le pied reste en place pendant ton pas.</p>
                </div>
              </details>
              <details id="ss05-mirror-help" class="native-game-tutorial" lang="fr" hidden>
                <summary>Les reflets · Espace ou X</summary>
                <div class="native-game-tutorial-content">
                  <p>Espace, X ou le bouton Reflet active les miroirs sans chant. Sur chaque face blanche, le premier occupant d’un axe est envoyé à distance égale sur l’autre axe.</p>
                  <p>Le + gris clair prévisualise l’arrivée du Barde. Le contour carré gris clair indique celle d’une caisse ou d’un monstre. Une arrivée occupée peut bloquer toute l’opération. Les appuis immergés restent en place.</p>
                  <p>Une caisse reflétée dans l’eau devient un appui. Le Barde a besoin de sol ou d’un appui à l’arrivée.</p>
                </div>
              </details>
              <details id="ss05-piston-help" class="native-game-tutorial" lang="fr" open hidden>
                <summary>La porte qui pousse</summary>
                <div class="native-game-tutorial-content">
                  <p>Lorsqu’une porte apparaît, elle pousse la file dans le sens du chevron. Les boutons d’un même circuit portent un repère commun et doivent être occupés ensemble.</p>
                  <p>Une caisse poussée dans l’eau forme un appui. Le Barde peut se noyer ou être écrasé. Z annule toute la séquence.</p>
                </div>
              </details>
              <details id="ss05-monster-help" class="native-game-tutorial" lang="fr" hidden>
                <summary>Guider les monstres</summary>
                <div class="native-game-tutorial-content">
                  <p>Les monstres noirs marqués d’un X rouge suivent le chant quand ils sont à portée. Ils peuvent peser sur un bouton, être reflétés et être déplacés par une presse.</p>
                  <p>Les monstres attaquent les quatre cases voisines dans les directions cardinales. Deux monstres côte à côte s’éliminent mutuellement, chacun portant encore son attaque pendant cette action.</p>
                </div>
              </details>
              <div id="ss06-room-help" lang="fr" hidden>
                <p id="ss06-objective" class="native-game-level-info"></p>
                <p class="native-game-level-info"><span id="ss06-source-label"></span> <a id="ss06-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
                <details id="ss06-tutorial" class="native-game-tutorial" open hidden>
                  <summary>Niveau 1 · L’atelier des deux rives</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss06-lesson-next" aria-live="polite"></p>
                    <ul>
                      <li data-ss06-lesson="move">Déplacer le personnage au point blanc.</li>
                      <li data-ss06-lesson="select">Sélectionner l’autre personnage.</li>
                      <li data-ss06-lesson="merchant-push">Pousser un objet avec le Marchand.</li>
                      <li data-ss06-lesson="warrior-push">Pousser une file avec le Guerrier.</li>
                      <li data-ss06-lesson="platform">Créer un appui dans l’eau.</li>
                      <li data-ss06-lesson="mirror">Déplacer un occupant par reflet.</li>
                      <li data-ss06-lesson="gate">Modifier une porte avec un bouton.</li>
                      <li data-ss06-lesson="goals">Occuper les deux cibles simultanément.</li>
                    </ul>
                    <p id="ss06-lesson-progress"></p>
                  </div>
                </details>
                <details class="native-game-tutorial">
                  <summary>Poussées et reflets</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss06-cooperation-help">Le Marchand pousse un objet. Les deux héros peuvent activer les miroirs et servir de poids. Le premier arrivé peut encore aider son partenaire.</p>
                    <p>Le Guerrier pousse toute une file si son extrémité est libre. Une caisse envoyée dans l’eau devient un appui marron marqué d’un X cyan.</p>
                    <p>Espace, X ou le bouton Reflet active tous les miroirs. Le + gris clair montre l’arrivée d’un héros et le contour carré gris clair celle d’une caisse. Un mur, un autre miroir ou une arrivée occupée peut bloquer le reflet.</p>
                  </div>
                </details>
                <details id="ss06-piston-help" class="native-game-tutorial" open hidden>
                  <summary>La porte qui pousse</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les boutons d’un même circuit doivent être occupés ensemble. Une porte qui se ferme pousse toute la file dans le sens du repère. Si la file est bloquée, l’occupant sur la porte est écrasé. Z annule la cascade.</p>
                  </div>
                </details>
                <details id="ss06-platform-help" class="native-game-tutorial" open hidden>
                  <summary>Les portes-plateformes dans l’eau</summary>
                  <div class="native-game-tutorial-content">
                    <p class="duo-platform-legend"><span><i aria-hidden="true"></i> Déployée</span><span><i class="is-retracted" aria-hidden="true"></i> Retirée</span></p>
                    <p>Le repère central indique le circuit de la plateforme.</p>
                    <p>Quitte les plateformes qui vont disparaître avant de faire basculer leur bouton. Les reflets permettent de commander les boutons à distance. Les appuis marron marqués d’un X cyan restent en place.</p>
                  </div>
                </details>
                <details class="native-game-tutorial">
                  <summary>Monstres · distance et rencontre</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les monstres attaquent les quatre cases voisines après une action réussie. Deux monstres côte à côte s’éliminent mutuellement, chacun portant encore son attaque. Une diagonale ne déclenche pas de combat.</p>
                  </div>
                </details>
              </div>
              <div id="ss07-room-help" lang="fr" hidden>
                <p id="ss07-objective" class="native-game-level-info"></p>
                <p class="native-game-level-info"><span id="ss07-source-label"></span> <a id="ss07-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
                <details id="ss07-tutorial" class="native-game-tutorial" open hidden>
                  <summary>Niveau 1 · L’atelier du pas de côté</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss07-lesson-next" aria-live="polite"></p>
                    <ul>
                      <li data-ss07-lesson="move">Déplacer le personnage au point blanc.</li>
                      <li data-ss07-lesson="select">Sélectionner l’autre personnage.</li>
                      <li data-ss07-lesson="merchant-push">Pousser une pièce avec le Marchand.</li>
                      <li data-ss07-lesson="thief-pull">Tirer une pièce avec le Voleur.</li>
                      <li data-ss07-lesson="mirror-motion">Pousser ou tirer un miroir.</li>
                      <li data-ss07-lesson="platform">Créer un appui dans l’eau.</li>
                      <li data-ss07-lesson="mirror">Déplacer un occupant par reflet.</li>
                      <li data-ss07-lesson="gate">Commander une porte avec un bouton.</li>
                      <li data-ss07-lesson="goals">Occuper les deux cibles simultanément.</li>
                    </ul>
                    <p id="ss07-lesson-progress"></p>
                  </div>
                </details>
                <details class="native-game-tutorial" open>
                  <summary>Poussée, traction et reflets</summary>
                  <div class="native-game-tutorial-content">
                    <p>Le Marchand pousse une pièce devant lui. Le Voleur tire la pièce immédiatement derrière lui en avançant vers une case libre. Un pas de côté permet de lâcher la pièce.</p>
                    <p>Espace, X ou le bouton Reflet active les miroirs. Pour chaque miroir, l’occupant le plus proche traverse. À la même distance, les deux échangent leurs places. Une arrivée bloquée pour l’occupant le plus loin ne gêne pas le transfert du plus proche.</p>
                    <p>Le + gris clair montre l’arrivée d’un héros et le contour carré gris clair celle d’une caisse. Un reflet ou une presse ne déclenche pas de traction supplémentaire.</p>
                  </div>
                </details>
                <details id="ss07-piston-help" class="native-game-tutorial" open hidden>
                  <summary>La porte qui pousse</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les boutons reliés doivent être occupés ensemble. Une porte qui se ferme pousse la file dans le sens indiqué. Si la file est bloquée, l’occupant sur la porte est écrasé. Z annule la cascade.</p>
                  </div>
                </details>
                <details id="ss07-platform-help" class="native-game-tutorial" open hidden>
                  <summary>Le pont provisoire</summary>
                  <div class="native-game-tutorial-content">
                    <p class="duo-platform-legend"><span><i aria-hidden="true"></i> Déployée</span><span><i class="is-retracted" aria-hidden="true"></i> Retirée</span></p>
                    <p>Le repère central indique le circuit. Une caisse sur une plateforme qui se retire devient un appui permanent, marqué d’un X cyan. Vérifie l’appui des deux héros avant de libérer le bouton.</p>
                  </div>
                </details>
                <details class="native-game-tutorial">
                  <summary>Monstres · distance et rencontre</summary>
                  <div class="native-game-tutorial-content">
                    <p>Après une action réussie, les monstres frappent les quatre cases voisines. Deux monstres côte à côte s’éliminent mutuellement, chacun portant encore son attaque.</p>
                  </div>
                </details>
              </div>
              <div id="ss08-room-help" lang="fr" hidden>
                <p id="ss08-objective" class="native-game-level-info"></p>
                <p class="native-game-level-info"><span id="ss08-source-label"></span> <a id="ss08-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
                <details id="ss08-tutorial" class="native-game-tutorial" open hidden>
                  <summary>Niveau 4 · L’atelier des deux passages</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss08-lesson-next" aria-live="polite"></p>
                    <ul>
                      <li data-ss08-lesson="select">Sélectionner l’autre personnage.</li>
                      <li data-ss08-lesson="wizard-swap">Échanger avec la première cible du Magicien.</li>
                      <li data-ss08-lesson="move">Marcher vers une case libre.</li>
                      <li data-ss08-lesson="merchant-push">Pousser une pièce avec le Marchand.</li>
                      <li data-ss08-lesson="platform">Créer un appui dans l’eau.</li>
                      <li data-ss08-lesson="gate">Commander une porte avec un bouton.</li>
                      <li data-ss08-lesson="mirror-motion">Déplacer un miroir.</li>
                      <li data-ss08-lesson="wizard-bend">Échanger après avoir dévié la visée.</li>
                      <li data-ss08-lesson="mirror">Déplacer un occupant par reflet.</li>
                      <li data-ss08-lesson="goals">Occuper les deux cibles simultanément.</li>
                    </ul>
                    <p id="ss08-lesson-progress"></p>
                  </div>
                </details>
                <details class="native-game-tutorial" open>
                  <summary>Visée et reflets</summary>
                  <div class="native-game-tutorial-content">
                    <p>Le Marchand pousse une pièce. Une flèche fait échanger le Magicien avec la première cible visée. Chaque face blanche dévie sa visée à angle droit. Le dos noir l’arrête. Sans cible ni boucle, le Magicien tente un pas.</p>
                    <p>Si le rayon revient au Magicien, il clignote sur place et les mécanismes restent immobiles.</p>
                    <p>Espace, X ou Reflet active le reflet géométrique de tous les miroirs. Le plus proche traverse, même si l’arrivée de l’occupant éloigné est bloquée. À la même distance, les deux échangent leurs places.</p>
                    <p>Le + gris clair montre l’arrivée d’un héros et le contour carré gris clair celle d’une caisse.</p>
                  </div>
                </details>
                <details id="ss08-piston-help" class="native-game-tutorial" open hidden>
                  <summary>La porte qui pousse</summary>
                  <div class="native-game-tutorial-content">
                    <p>Un héros, un miroir ou un autre occupant peut maintenir un bouton. À la fermeture, la presse avance la file dans le sens du repère. Z annule toute la cascade.</p>
                  </div>
                </details>
                <details id="ss08-platform-help" class="native-game-tutorial" open hidden>
                  <summary>Les portes-plateformes dans l’eau</summary>
                  <div class="native-game-tutorial-content">
                    <p class="duo-platform-legend"><span><i aria-hidden="true"></i> Déployée</span><span><i class="is-retracted" aria-hidden="true"></i> Retirée</span></p>
                    <p>Le repère central indique le circuit. Une caisse immergée devient un appui fixe, marqué d’un X cyan. Un échange peut maintenir un bouton en remplaçant son occupant.</p>
                  </div>
                </details>
                <details class="native-game-tutorial">
                  <summary>Monstres · distance et rencontre</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les monstres attaquent les quatre cases voisines après une action réussie. Deux monstres côte à côte s’éliminent mutuellement, chacun portant encore son attaque.</p>
                  </div>
                </details>
              </div>
              <div id="ss09-room-help" lang="fr" hidden>
                <p id="ss09-objective" class="native-game-level-info"></p>
                <p class="native-game-level-info"><span id="ss09-source-label"></span> <a id="ss09-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
                <details id="ss09-tutorial" class="native-game-tutorial" open hidden>
                  <summary>Niveau 1 · Le chantier des deux voix</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss09-lesson-next" aria-live="polite"></p>
                    <ul>
                      <li data-ss09-lesson="select">Sélectionner l’autre personnage.</li>
                      <li data-ss09-lesson="move">Avancer avec le personnage sélectionné.</li>
                      <li data-ss09-lesson="merchant-push">Pousser une pièce avec le Marchand.</li>
                      <li data-ss09-lesson="bard-song">Déplacer une pièce avec le chant.</li>
                      <li data-ss09-lesson="partner-song">Entraîner le Marchand avec le chant.</li>
                      <li data-ss09-lesson="selective-song">Déplacer une pièce pendant qu’une autre reste en place.</li>
                      <li data-ss09-lesson="platform">Créer un appui dans l’eau.</li>
                      <li data-ss09-lesson="support-slide">Faire glisser un appui avec le chant.</li>
                      <li data-ss09-lesson="mirror-motion">Déplacer un miroir avec le Marchand.</li>
                      <li data-ss09-lesson="mirror">Transporter un occupant par reflet.</li>
                      <li data-ss09-lesson="gate">Commander une porte ou une presse avec un bouton.</li>
                      <li data-ss09-lesson="goals">Occuper les deux cibles simultanément.</li>
                    </ul>
                    <p id="ss09-lesson-progress"></p>
                  </div>
                </details>
                <details class="native-game-tutorial" open>
                  <summary>Poussée, chant et reflets</summary>
                  <div class="native-game-tutorial-content">
                    <p>Le Marchand pousse une seule pièce, y compris le Barde. Avant chaque pas du Barde, son aura de 5 × 5 cases choisit les caisses, monstres, appuis et le Marchand qu’il peut entraîner. Les diagonales comptent et les murs ne coupent pas la portée.</p>
                    <p>Les pièces bloquées et les miroirs restent en place. L’appui sous un héros et celui à l’arrivée du Barde restent ancrés. Une poussée subie, une presse ou un reflet ne déclenche aucun chant.</p>
                    <p>Espace, X et Reflet activent les miroirs sans chant. L’occupant le plus proche traverse. À distance égale, les deux échangent leur place. Le + gris clair indique l’arrivée d’un héros et le contour celle d’une caisse. La diagonale d’un miroir responsable d’un refus clignote en rouge.</p>
                  </div>
                </details>
                <details id="ss09-piston-help" class="native-game-tutorial" open hidden>
                  <summary>La porte qui pousse</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les boutons reliés doivent être occupés ensemble. Une presse qui se ferme pousse la file dans le sens de son repère. Z annule la cascade entière.</p>
                  </div>
                </details>
                <details id="ss09-platform-help" class="native-game-tutorial" open hidden>
                  <summary>Les portes-plateformes dans l’eau</summary>
                  <div class="native-game-tutorial-content">
                    <p class="duo-platform-legend"><span><i aria-hidden="true"></i> Déployée</span><span><i class="is-retracted" aria-hidden="true"></i> Retirée</span></p>
                    <p>Le repère central indique le circuit. Une caisse immergée devient un appui marqué d’un X cyan. Le chant peut faire glisser un appui entre deux cases d’eau.</p>
                  </div>
                </details>
              </div>
              <div id="ss10-room-help" lang="fr" hidden>
                <p id="ss10-objective" class="native-game-level-info"></p>
                <p class="native-game-level-info"><span id="ss10-source-label"></span> <a id="ss10-source-link" target="_blank" rel="noopener noreferrer" hidden></a></p>
                <details id="ss10-tutorial" class="native-game-tutorial" open hidden>
                  <summary>Niveau 1 · L’atelier du contrepoids</summary>
                  <div class="native-game-tutorial-content">
                    <p id="ss10-lesson-next" aria-live="polite"></p>
                    <ul>
                      <li data-ss10-lesson="move">Marcher avec le personnage sélectionné.</li>
                      <li data-ss10-lesson="select">Sélectionner l’autre personnage.</li>
                      <li data-ss10-lesson="warrior-push">Pousser une pièce avec le Guerrier.</li>
                      <li data-ss10-lesson="chain">Pousser une file entière.</li>
                      <li data-ss10-lesson="thief-pull">Tirer une pièce avec le Voleur.</li>
                      <li data-ss10-lesson="single-pull">Séparer deux pièces en tirant la plus proche.</li>
                      <li data-ss10-lesson="release">Lâcher une pièce en changeant de direction.</li>
                      <li data-ss10-lesson="mirror-motion">Déplacer un miroir.</li>
                      <li data-ss10-lesson="platform">Construire un appui dans l’eau.</li>
                      <li data-ss10-lesson="mirror">Transporter un occupant par reflet.</li>
                      <li data-ss10-lesson="gate">Commander une porte ou une presse.</li>
                      <li data-ss10-lesson="goals">Occuper les deux destinations.</li>
                    </ul>
                    <p id="ss10-lesson-progress"></p>
                  </div>
                </details>
                <details class="native-game-tutorial" open>
                  <summary>Poussée, traction et reflets</summary>
                  <div class="native-game-tutorial-content">
                    <p>Le Guerrier pousse toute la file devant lui si son extrémité est libre. Le Voleur tire une seule pièce derrière lui en avançant. Un pas de côté lui permet de la lâcher.</p>
                    <p>Une caisse plongée dans l’eau devient un appui fixe, marqué d’un X cyan. Les appuis restent en place pendant les poussées, les tractions et les reflets.</p>
                    <p>Espace, X et Reflet activent les miroirs. Le plus proche traverse. À distance égale, les occupants échangent leur place. Le + gris clair annonce l’arrivée d’un héros et le contour carré celle d’une caisse. Le socle d’un miroir responsable d’un refus clignote en rouge.</p>
                  </div>
                </details>
                <details id="ss10-piston-help" class="native-game-tutorial" open hidden>
                  <summary>La porte qui pousse</summary>
                  <div class="native-game-tutorial-content">
                    <p>Les boutons reliés doivent être occupés ensemble. Une presse qui se ferme pousse la file dans le sens de son repère. Z annule toute la cascade.</p>
                  </div>
                </details>
                <details id="ss10-platform-help" class="native-game-tutorial" open hidden>
                  <summary>Les portes-plateformes dans l’eau</summary>
                  <div class="native-game-tutorial-content">
                    <p class="duo-platform-legend"><span><i aria-hidden="true"></i> Déployée</span><span><i class="is-retracted" aria-hidden="true"></i> Retirée</span></p>
                    <p>Le repère central indique le circuit. Une plateforme qui se retire laisse les appuis permanents en place.</p>
                  </div>
                </details>
              </div>
            </div>
            <div id="agent-panel" role="tabpanel" aria-labelledby="agent-tab" data-agent-status="${AGENT_STATUS.status}" data-agent-available="${AGENT_STATUS.available}">
              <h3>Solve with SRA.</h3>
              <p id="agent-message" class="agent-message" role="status" aria-live="polite" aria-atomic="true" tabindex="0">Ready to run from level 1.</p>
              <label for="agent-planning">Planning</label>
              <select id="agent-planning"><option value="sic">SIC</option><option value="sic-fallback">SIC Fallback</option></select>
              <div class="agent-run-controls">
                <button id="agent-run" type="button" class="primary-button">Run to next level</button>
                <button id="agent-batch" type="button" class="secondary-button">Run 16 actions</button>
                <button id="agent-step" type="button" class="secondary-button">One action</button>
                <button id="agent-reset-level" type="button" class="secondary-button" hidden>Reset level</button>
                <button id="agent-pause" type="button" class="secondary-button agent-pause-wide" disabled>Pause</button>
              </div>
              <div id="agent-sic-review" hidden>
                <label><input id="agent-sic-pause" type="checkbox"> Pause on a contradicted prediction</label>
                <button id="agent-sic-resume" type="button" class="primary-button" hidden>Confirm and resume</button>
              </div>
              <div class="agent-live-stats" aria-label="Agent session">
                <div><strong id="agent-action-count">0</strong><span>actions</span></div>
                <div><strong id="agent-level-count">0</strong><span>levels solved</span></div>
                <div><strong id="agent-prefix-count">0</strong><span>completed plans</span></div>
              </div>
              <div id="agent-unsupported" hidden><button id="agent-restart" type="button" class="secondary-button">Restart game at level 1</button></div>
              <button id="agent-new-session" type="button" class="agent-text-button">New reasoning session</button>
              <button id="return-manual" type="button" class="agent-text-button">Return to Manual ${icon('arrow')}</button>
            </div>
          </aside>
        </div>

        <section id="sic-panel" class="sic-panel" aria-labelledby="sic-title" hidden>
          <header class="sic-header">
            <div><h3 id="sic-title">SIC · How does this command work?</h3><p data-sic-context></p></div>
            <span class="sic-mode" data-sic-mode>Read-only preview</span>
          </header>
          <div class="sic-tabs" role="tablist" aria-label="SIC perspectives" data-sic-tabs>
            <button type="button" id="sic-perceptions-tab" role="tab" aria-selected="true" aria-controls="sic-perceptions">Perceptions</button>
            <button type="button" id="sic-information-tab" role="tab" aria-selected="false" aria-controls="sic-information" tabindex="-1">Information</button>
            <button type="button" id="sic-strategies-tab" role="tab" aria-selected="false" aria-controls="sic-strategies" tabindex="-1">Strategies</button>
            <button type="button" id="sic-objectives-tab" role="tab" aria-selected="false" aria-controls="sic-objectives" tabindex="-1">Objectives</button>
            <button type="button" id="sic-plans-tab" role="tab" aria-selected="false" aria-controls="sic-plans" tabindex="-1">Action plans</button>
          </div>
          <div id="sic-perceptions" role="tabpanel" aria-labelledby="sic-perceptions-tab" tabindex="0">
            <div class="sic-card">
              <h4>Current board</h4>
              <dl>
                <dt>Available commands</dt><dd data-sic-commands>Waiting for the board.</dd>
                <dt>Next action from V6</dt><dd data-sic-next>No pending action to show.</dd>
                <dt>Latest V6 check</dt><dd data-sic-return>No checked return for this board.</dd>
              </dl>
              <p data-sic-perception-scope></p>
              <div data-sic-board-preview></div>
            </div>
            <section class="sic-observations" data-sic-latest-direction hidden>
              <h4>Compare command returns</h4>
              <label>Return <select data-sic-direction-select></select></label>
              <div data-sic-direction-sprites></div>
            </section>
            <section class="sic-observations" aria-labelledby="sic-clicks-title">
              <div class="sic-section-header">
                <h4 id="sic-clicks-title">Click returns</h4>
                <label data-sic-level-filter hidden>Level <select data-sic-level></select></label>
              </div>
              <p data-sic-returns-empty>Run the agent to see its observed clicks.</p>
              <ul data-sic-returns></ul>
            </section>
            <section class="sic-observations" aria-labelledby="sic-space-title" data-sic-space-perceptions hidden>
              <h4 id="sic-space-title">Space · Animation frames</h4>
              <div data-sic-space-frames></div>
            </section>
          </div>
          <div id="sic-information" role="tabpanel" aria-labelledby="sic-information-tab" tabindex="0" hidden>
            <div class="sic-tabs sic-subtabs" role="tablist" aria-label="Types of information" data-sic-tabs>
              <button type="button" id="sic-effects-tab" role="tab" aria-selected="true" aria-controls="sic-effects">Command effects</button>
              <button type="button" id="sic-mechanisms-tab" role="tab" aria-selected="false" aria-controls="sic-mechanisms" tabindex="-1">Mechanisms</button>
              <button type="button" id="sic-roles-tab" role="tab" aria-selected="false" aria-controls="sic-roles" tabindex="-1">Roles</button>
              <button type="button" id="sic-animations-tab" role="tab" aria-selected="false" aria-controls="sic-animations" tabindex="-1">Animations</button>
              <button type="button" id="sic-game-model-tab" role="tab" aria-selected="false" aria-controls="sic-game-model" tabindex="-1">Game model</button>
            </div>
            <div id="sic-mechanisms" role="tabpanel" aria-labelledby="sic-mechanisms-tab" tabindex="0" hidden>
              <section class="sic-card" data-sic-mechanisms></section>
              <section class="sic-observations" data-sic-targets hidden></section>
              <div data-sic-mechanism-review></div>
            </div>
            <div id="sic-roles" role="tabpanel" aria-labelledby="sic-roles-tab" tabindex="0" hidden>
              <section class="sic-card" data-sic-roles></section>
              <div data-sic-role-review></div>
            </div>
            <div id="sic-animations" role="tabpanel" aria-labelledby="sic-animations-tab" tabindex="0" hidden>
              <section class="sic-observations" aria-labelledby="sic-card-test-title" data-sic-card-test hidden>
                <h4 id="sic-card-test-title">Space · Change one card</h4>
                <div data-sic-card-test-cases></div>
              </section>
              <section class="sic-observations" aria-labelledby="sic-tower-test-title" data-sic-tower-test hidden>
                <h4 id="sic-tower-test-title">Space · Attack and push</h4>
                <div data-sic-tower-test-cases></div>
              </section>
              <p data-sic-space-empty>Run Space in STCK to inspect its animation.</p>
              <div data-sic-generic-animation></div>
              <section class="sic-observations" aria-labelledby="sic-space-info-title" data-sic-space-information hidden>
              <h4 id="sic-space-info-title">Space · Changes during the animation</h4>
              <ul data-sic-space-facts></ul>
              </section>
            </div>
            <div id="sic-game-model" role="tabpanel" aria-labelledby="sic-game-model-tab" tabindex="0" hidden>
              <section class="sic-card" data-sic-game-content></section>
              <div data-sic-operation-catalog></div>
            </div>
            <div id="sic-effects" role="tabpanel" aria-labelledby="sic-effects-tab" tabindex="0">
            <p data-sic-direction-effect hidden></p>
            <section class="sic-observations" data-sic-stack-rank hidden>
              <h4>STCK · Position in the program stack</h4>
              <p data-sic-stack-report></p>
              <p data-sic-stack-live></p>
            </section>
            <section class="sic-observations" aria-labelledby="sic-observations-title">
              <h4 id="sic-observations-title">Does the effect repeat?</h4>
              <p data-sic-comparison-summary></p>
              <ul data-sic-comparison-list></ul>
              <p data-sic-comparison-scope></p>
            </section>
            <div class="sic-card sic-question">
              <h4>What remains to be verified?</h4>
              <p class="sic-summary" data-sic-summary>Waiting for the board.</p>
              <p data-sic-evidence></p>
            </div>
            <details class="sic-details" data-sic-details hidden>
              <summary>Methods and evidence</summary>
              <ul data-sic-methods></ul>
            </details>
            </div>
          </div>
          <div id="sic-strategies" role="tabpanel" aria-labelledby="sic-strategies-tab" tabindex="0" hidden>
            <section class="sic-card">
              <h4>Ways to solve the situation</h4>
              <details class="sic-details sic-strategy-editor">
                <summary>Active SIC settings</summary>
                <form data-sic-recovery-settings>
                  <p>Changes apply to new agent sessions. Contact recovery in shadow stops at its counterexample.</p>
                  <label for="sic-recovery-mode">Recovery mode</label>
                  <select id="sic-recovery-mode" name="mode"><option value="active">Active</option><option value="shadow">Shadow</option></select>
                  <label for="sic-recovery-priority">First contact-recovery strategy</label>
                  <select id="sic-recovery-priority" name="priority"></select>
                  <p data-sic-recovery-fallback></p>
                  <label>Maximum search depth <input name="maxDepth" type="number" required min="1" max="88" step="1"></label>
                  <label>Maximum states <input name="maxNodes" type="number" required min="1" max="1000" step="1"></label>
                  <label for="sic-frontier-input-order">Priority among equally supported experiments</label>
                  <select id="sic-frontier-input-order" name="frontierInputOrder"></select>
                  <p data-sic-frontier-preview></p>
                  <label for="sic-family-agenda">Selection across strategy families</label>
                  <select id="sic-family-agenda" name="familyAgenda"><option value="native">Native selection</option><option value="shadow">Compare SIC in shadow</option><option value="active">Use the SIC agenda</option></select>
                  <label><input type="checkbox" name="adaptiveReasoning"> Adaptive reasoning modes</label>
                  <label for="sic-opening-curiosity">Opening curiosity</label>
                  <select id="sic-opening-curiosity" name="openingCuriosity"><option value="native">Native order</option><option value="shadow">Compare the richest composition in shadow</option><option value="active">Investigate the richest composition first</option></select>
                  <details class="sic-details">
                    <summary>Information experiment priority</summary>
                    <label>Preferred strategy <select name="informationStrategy"></select></label>
                    <label>Minimum distinct predicted returns <input name="informationOutcomes" type="number" min="2" max="64" value="2"></label>
                    <label>Priority mode <select name="informationMode"><option value="native">Keep the current order</option><option value="shadow">Preview on new decisions</option><option value="active">Apply in new sessions</option></select></label>
                    <p>Compares experiments that already satisfy the current preservation and action limits.</p>
                  </details>
                  <details class="sic-details">
                    <summary>Create a local exploration rule</summary>
                    <label>Rule name <input name="localRuleTitle" maxlength="80" placeholder="Leave blank to disable the rule"></label>
                    <label>Command domain <select name="localRuleCommands"><option value="directions">Directional commands</option><option value="clicks">Clicks</option><option value="any">Any command</option></select></label>
                    <label>Minimum difference in prior uses <input name="localRuleGap" type="number" min="1" max="600" value="1"></label>
                    <label>Priority when the rule matches <select name="localRulePreference"></select></label>
                    <label>Rule mode <select name="localRuleMode"><option value="shadow">Observe in shadow</option><option value="active">Apply in new sessions</option></select></label>
                    <p data-sic-local-rule-preview></p>
                  </details>
                  <details class="sic-details">
                    <summary>Strategy graph coverage</summary>
                    <div data-sic-graph-coverage></div>
                    <div data-sic-action-coverage></div>
                  </details>
                  <button type="submit">Save SIC settings</button>
                  <button type="button" data-sic-recovery-rollback>Restore previous revision</button>
                  <details class="sic-details">
                    <summary>Import or export SIC settings</summary>
                    <label for="sic-recovery-pack">Pack JSON</label>
                    <textarea id="sic-recovery-pack" name="pack" rows="6" maxlength="32768" spellcheck="false"></textarea>
                    <label for="sic-recovery-signer">Trusted signer fingerprint (for signed packs)</label>
                    <input id="sic-recovery-signer" name="trustedSigner" maxlength="64" spellcheck="false" autocomplete="off">
                    <button type="button" data-sic-recovery-export>Show saved pack</button>
                    <button type="button" data-sic-recovery-import>Preview pack settings</button>
                    <p data-sic-recovery-revision></p>
                  </details>
                  <p role="status" data-sic-recovery-status></p>
                </form>
              </details>
              <div data-sic-src-editor></div>
              <div data-sic-strategy-editor></div>
              <div data-sic-strategy-body></div>
            </section>
          </div>
          <div id="sic-objectives" role="tabpanel" aria-labelledby="sic-objectives-tab" tabindex="0" hidden>
            <section class="sic-card">
              <h4>What to achieve</h4><p data-sic-objective-progress></p>
              <div class="sic-tabs sic-subtabs" role="tablist" aria-label="Objectives by time" data-sic-tabs>
                <button type="button" id="sic-past-tab" role="tab" aria-selected="false" aria-controls="sic-past" tabindex="-1">Past</button>
                <button type="button" id="sic-present-tab" role="tab" aria-selected="true" aria-controls="sic-present">Present</button>
                <button type="button" id="sic-future-tab" role="tab" aria-selected="false" aria-controls="sic-future" tabindex="-1">Future</button>
              </div>
              <div id="sic-past" role="tabpanel" aria-labelledby="sic-past-tab" tabindex="0" hidden></div>
              <div id="sic-present" role="tabpanel" aria-labelledby="sic-present-tab" tabindex="0"></div>
              <div id="sic-future" role="tabpanel" aria-labelledby="sic-future-tab" tabindex="0" hidden></div>
              <div id="sic-objective-evidence"></div>
            </section>
          </div>
          <div id="sic-plans" role="tabpanel" aria-labelledby="sic-plans-tab" tabindex="0" hidden>
            <section class="sic-card"><h4>What to do next</h4>
              <dl><dt>Next action from V6</dt><dd data-sic-plan-next>No pending action to show.</dd></dl>
              <div data-sic-plan-body></div>
            </section>
          </div>
        </section>

        <p id="game-feedback" class="sr-only" aria-live="polite"></p>
      </article>
    </section>

    <section class="about-section wrap" id="about" aria-labelledby="about-title">
      <div class="about-heading"><p class="eyebrow">THE PROJECT</p><h2 id="about-title">About SRA</h2><div class="about-links"><a class="text-link" href="/motivation.html">Motivation ${icon('arrow')}</a><a class="text-link" href="/architecture.html">Architecture ${icon('arrow')}</a><a class="text-link" href="/videos.html">Video series ${icon('arrow')}</a></div></div>
      <div class="about-content"><p><strong>Symbolic Reasoning Agent</strong> is Yannick Fontan’s research project for interactive games. The agent uses explicit representations of observations, mechanisms, and goals to organize its reasoning.</p><p>The 100 games on this page run locally in your browser. The ongoing SRA Agent migration transfers V6 capabilities into native TypeScript and the common V7 reasoning architecture. Coordinate inputs, guarded action sequences and memory across levels are connected. The original Python game engines remain isolated from the agent. Explore the shared reasoning syntax in the <a class="text-link" href="/reasoning-lab.html">Logos Engine Reasoning Lab</a>.</p></div>
    </section>
  </main>
  <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Independent research by Yannick Fontan</span><div><a href="/contact.html">Contact ${icon('arrow')}</a><a href="https://arcprize.org/arc-agi/3" target="_blank" rel="noopener noreferrer">ARC Prize ${icon('external')}</a><a href="${websiteRepo}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Licenses & notices ${icon('external')}</a></div></footer>
`;

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Missing interface element: ${selector}`);
  return found;
}

const canvas = element<HTMLCanvasElement>('#game-canvas');
const context = canvas.getContext('2d', { alpha: false });
if (!context) throw new Error('This browser does not support the 2D canvas.');
context.imageSmoothingEnabled = false;
const runtime = new BrowserGameRuntime();
let observation: GameObservation | null = null;
let mode: 'manual' | 'agent' = usesNativeManualControls(selectedGame.code) ? 'manual' : 'agent';
let busy = false;
let interruptibleAnimation = false;
const ss02Lessons = new Set<TutorialLesson>();
const ss03Tutorial = new PullTutorial();
const ss04Lessons = new Set<WizardLesson>();
const ss05Lessons = new Set<BardLesson>();
const ss06Lessons = new Set<DuoLesson>();
const ss07Lessons = new Set<ThiefLesson>();
const ss08Lessons = new Set<TranspositionLesson>();
const ss09Lessons = new Set<ChorusLesson>();
const ss10Lessons = new Set<WarehouseLesson>();
const duoRoomHelp = {
  SS06: { roles: [{ kind: 'merchant', label: 'Marchand' }, { kind: 'warrior', label: 'Guerrier' }], directions: 'Flèches pour marcher ou pousser.', rooms: SS06_LEVEL_INFO,
    heroes: visibleHeroes, lessons: ss06Lessons, total: duoLessonIds.length, prompt: () => duoPrompt(ss06Lessons), tutorialLevel: 1 },
  SS07: { roles: [{ kind: 'merchant', label: 'Marchand' }, { kind: 'thief', label: 'Voleur' }], directions: 'Flèches pour marcher, pousser ou tirer.', rooms: SS07_LEVEL_INFO,
    heroes: visibleThiefHeroes, lessons: ss07Lessons, total: thiefLessonIds.length, prompt: () => thiefPrompt(ss07Lessons), tutorialLevel: 1 },
  SS08: { roles: [{ kind: 'merchant', label: 'Marchand' }, { kind: 'wizard', label: 'Magicien' }], directions: 'Flèches pour marcher, pousser ou transposer.', rooms: SS08_LEVEL_INFO,
    heroes: visibleTranspositionHeroes, lessons: ss08Lessons, total: transpositionLessonIds.length,
    prompt: () => transpositionPrompt(ss08Lessons), tutorialLevel: SS08_TUTORIAL_LEVEL },
  SS09: { roles: [{ kind: 'merchant', label: 'Marchand' }, { kind: 'bard', label: 'Barde' }], directions: 'Flèches pour marcher, pousser ou chanter.', rooms: SS09_LEVEL_INFO,
    heroes: visibleChorusHeroes, lessons: ss09Lessons, total: chorusLessonIds.length,
    prompt: () => chorusPrompt(ss09Lessons), tutorialLevel: SS09_TUTORIAL_LEVEL },
  SS10: { roles: [{ kind: 'warrior', label: 'Guerrier' }, { kind: 'thief', label: 'Voleur' }],
    directions: 'Flèches pour marcher, pousser ou tirer.', rooms: SS10_LEVEL_INFO,
    heroes: visibleWarehouseHeroes, lessons: ss10Lessons, total: warehouseLessonIds.length,
    prompt: () => warehousePrompt(ss10Lessons), tutorialLevel: 1 },
} as const;
let ss06Solo = false;
let loading = false;
let failed = false;
let selectionGeneration = 0;
let presentationGeneration = 0;
let renderedLevelCount = -1;
let renderedPalette = '';
let colors: number[][] = [];
let agentState: V6AgentSnapshot | null = null;
let contradictionReview: ContradictionReview | null = null;
const sicPanel = element<HTMLElement>('#sic-panel');
bindSicPerspectives(sicPanel);
const recoveryConfiguration = bindRecoverySettings(sicPanel);
const sicActionCoverage = sicPanel.querySelector<HTMLElement>('[data-sic-action-coverage]')!;
const sicModeLabel = sicPanel.querySelector<HTMLElement>('[data-sic-mode]')!;
let sicRenderPending = false;
let lastSicBoard: GameObservation | null = null;
let lastSicState: V6AgentSnapshot | null = null;
let spaceReturns: readonly SpaceReturn[] = [];
let stckRankReturns: readonly (StckRankTrial & { sessionId: string; sequence: number })[] = [];
let agentReturns: readonly DirectionalReturn[] = [];
type AgentReturnDraft = { sessionId: string; sequence: number; action: AgentAction; before: GameObservation;
  next: GameObservation; decision: V6AgentSnapshot | null; acquired?: V6AgentSnapshot };
const pendingSicReturns: AgentReturnDraft[] = [];
const sicDisplayEnabled = new URLSearchParams(window.location.search).get('sicDisplay') !== 'off';
sicPanel.hidden = !sicDisplayEnabled;
let objectiveLedger: { sessionId: string; entries: readonly PursuedObjective[] } | null = null;
let manualReturns: readonly DirectionalReturn[] = [];
let manualSequence = 0;
let lastSicReturns: readonly DirectionalReturn[] | null = null;
let lastSicMode: 'manual' | 'agent' | null = null;

function recordPublicReturn(history: readonly DirectionalReturn[], sessionId: string, sequence: number, command: number,
  before: GameObservation, next: GameObservation, native?: NativeResolution | null): readonly DirectionalReturn[] {
  try {
    const restart = before.gameCode === 'LS20' && before.level === next.level
      ? observeLs20Restart(before.frame, next.frame, next.frames) : undefined;
    const boundary = before.level !== next.level || before.state !== next.state || Boolean(restart);
    const recovered = [...history].reverse().find(item => item.fromLevel === before.level && item.restart);
    const routeBoard = native && recovered?.sessionId === sessionId && native.route.length > 1
      && (native.nextIndex === 0 || !history.some(item => item.sessionId === sessionId && item.sequence > recovered.sequence && item.routeBoard))
      ? before.frame : undefined;
    const entry = observeDirectionalReturn(
      { sessionId, sequence, command, fromLevel: before.level, toLevel: next.level, frameCount: Math.max(1, next.frames.length),
        animation: samplePublicAnimation(next.frames),
        decision: native ? captureDecisionSprites(native, before.frame, boundary ? null : next.frame) : undefined,
        restart, routeBoard },
      before.frame, next.frame, boundary, history.at(-1));
    const witness = !boundary && before.gameCode === 'LS20'
      ? ls20ReviewEvidence.rotations.find(item => item.level === before.level) : undefined;
    const rotation = witness ? matchObservedRotation(entry, before.frame, next.frame, witness) : undefined;
    return [...history.filter(item => item.sessionId === sessionId).slice(-95), { ...entry, rotation }];
  } catch {
    return history;
  }
}
function canDispatchAgentAction(): boolean {
  return ready() && mode === 'agent'
    && (!usesNativeManualControls(selectedGame.code) || observation?.state === 'NOT_FINISHED');
}

const agent = new BrowserV6Agent({
  getObservation: () => observation,
  canDispatch: canDispatchAgentAction,
  resetLevel: async () => {
    const generation = selectionGeneration;
    busy = true;
    updateInterface();
    try {
      const next = await runtime.reset();
      await present(next, generation);
      return next;
    } catch (error) {
      if (generation === selectionGeneration) { busy = false; updateInterface(); }
      throw error;
    }
  },
  recoveryConfiguration: () => {
    const { maxDepth, maxNodes } = recoveryConfiguration();
    const solver = element<HTMLSelectElement>('#agent-planning').value === 'sic-fallback' ? 'sic-fallback' : 'sic';
    return { ...defaultRecoveryPack, maxDepth, maxNodes, solver };
  },
  dispatch: async action => {
    if (!canDispatchAgentAction() || !observation?.availableActionIds.includes(action.id)) {
      throw new Error('The game changed before the action could be sent.');
    }
    const generation = selectionGeneration;
    const before = observation;
    const sessionId = agentState?.sessionId;
    const sequence = (agentState?.sequence ?? 0) + 1;
    const nativeSnapshot = agentState;
    busy = true;
    updateInterface();
    try {
      const actionStarted = performance.now();
      const next = await runtime.action(action.id, action.id === 6 ? action.data : undefined);
      const executionMs = performance.now() - actionStarted;
      await present(next, generation);
      if (generation !== selectionGeneration || next.gameCode !== selectedGame.code) {
        throw new Error('The action belongs to an earlier game session.');
      }
      // Capture references during the run. Build display evidence only at a settled boundary.
      if (sicDisplayEnabled && sessionId && sessionId === agentState?.sessionId) {
        pendingSicReturns.push({ sessionId, sequence, action, before, next, decision: nativeSnapshot });
        if (pendingSicReturns.length > 96) pendingSicReturns.shift();
      }
      return { observation: next, executionMs };
    } catch (error) {
      showFailure(error, generation);
      throw error;
    }
  },
  onAcquired: state => {
    const review = as66Contradiction(selectedGame.code, element<HTMLInputElement>('#agent-sic-pause').checked, state);
    if (review) {
      contradictionReview = review;
      agent.pause();
    }
  },
  onState: state => {
    if (contradictionReview?.sessionId !== state.sessionId) contradictionReview = null;
    const last = pendingSicReturns.at(-1);
    if (last && last.sessionId !== state.sessionId) pendingSicReturns.length = 0;
    else if (last && !last.acquired && last.sequence === state.sequence && state.actions === last.sequence && state.status !== 'error') {
      last.acquired = state;
    }
    agentState = state;
    refreshSrcEditor(state);
    updateInterface();
  },
});
const refreshSrcEditor = bindSrcStrategyEditor(sicPanel.querySelector<HTMLElement>('[data-sic-src-editor]')!, agent);

function projectAgentReturn({ sessionId, sequence, action, before, next, decision: nativeSnapshot, acquired }: AgentReturnDraft): void {
  let decision: NativeResolution | null = null;
  if (nativeSnapshot?.level === before.level && nativeSnapshot.phase === 'authorised_not_executed') {
    try { decision = readNativeResolution(nativeSnapshot); } catch { /* An optional explanation was unavailable. */ }
  }
  agentReturns = recordPublicReturn(agentReturns, sessionId, sequence, action.id, before, next, decision);
  const receipt = agentReturns.at(-1);
  if (receipt?.sessionId === sessionId && receipt.sequence === sequence) {
    const outcome = acquired ? readNativeResolution(acquired)?.outcome : null;
    if (outcome) agentReturns = [...agentReturns.slice(0, -1), { ...receipt, nativeCheck: outcome }];
    const entries = objectiveLedger?.sessionId === sessionId ? objectiveLedger.entries : [];
    objectiveLedger = { sessionId, entries: recordPursuedObjective(entries, receipt) };
  }
  if (before.gameCode !== 'STCK') return;
  if (action.id === 5) {
    const entry = observeSpace({ sessionId, sequence, fromLevel: before.level, toLevel: next.level },
      before.frame, next.frames.length ? next.frames : [next.frame]);
    spaceReturns = [...spaceReturns.filter(item => item.sessionId === sessionId).slice(-2), entry];
  }
  if (action.id === 6 && before.level === next.level && before.state === next.state) {
    const trial = compareStckRank(before.frame, next.frame, [action.data.x, action.data.y], before.level);
    if (trial) stckRankReturns = [...stckRankReturns.filter(item => item.sessionId === sessionId).slice(-31),
      { ...trial, sessionId, sequence }];
  }
}

function updateSicPanel(): void {
  if (!sicDisplayEnabled || sicPanel.hidden || sicRenderPending || busy || agentState?.busy) return;
  sicRenderPending = true;
  const renderWhenIdle = (availableMs: number) => {
    sicRenderPending = false;
    if (sicPanel.hidden || busy || agentState?.busy) return;
    if (availableMs < 2) { updateSicPanel(); return; }
    const deadline = performance.now() + Math.min(5, availableMs);
    while (pendingSicReturns.length) {
      const entry = pendingSicReturns.shift()!;
      if (entry.sessionId === agentState?.sessionId) {
        try { projectAgentReturn(entry); } catch { /* Display evidence is optional. */ }
      }
      if (performance.now() >= deadline) { updateSicPanel(); return; }
    }
    updateSicModeLabel();
    const board = loading || failed ? null : observation;
    const history = mode === 'agent' ? agentReturns : manualReturns;
    if (board === lastSicBoard && agentState === lastSicState && history === lastSicReturns && mode === lastSicMode) return;
    lastSicBoard = board;
    lastSicState = agentState;
    lastSicReturns = history;
    lastSicMode = mode;
    const state = agentState;
    renderActionCoverage(sicActionCoverage, mode === 'agent' && board && state?.sessionId ? state : null);
    const visible = <T extends { sessionId: string; sequence: number }>(entries: readonly T[]) =>
      board?.gameCode === 'STCK' && state && state.status !== 'error'
        ? entries.filter(item => item.sessionId === state.sessionId && item.sequence <= state.sequence)
        : [];
    const returns = !board ? [] : mode === 'manual' ? manualReturns
      : state?.sessionId && state.status !== 'error' ? agentReturns.filter(item => item.sessionId === state.sessionId
        && item.sequence <= state.sequence) : [];
    renderSicPanel(sicPanel, board ? readControlEffectShadow(board, mode === 'agent' ? agentState : null, presentationGeneration) : null,
      board?.palette ?? fallbackPalette, mode === 'agent' ? visible(spaceReturns) : [], mode === 'agent' ? visible(stckRankReturns) : [],
      board, mode, Boolean(mode === 'agent' && board && !state?.sessionId && (board.level !== 1 || board.levelsCompleted !== 0)), returns,
      mode === 'agent' && objectiveLedger && objectiveLedger.sessionId === state?.sessionId && state.status !== 'error'
        ? objectiveLedger.entries.filter(item => item.last <= state.sequence) : []);
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(deadline => renderWhenIdle(deadline.didTimeout ? 2 : deadline.timeRemaining()), { timeout: 250 });
  }
  else window.requestAnimationFrame(() => renderWhenIdle(5));
}

function updateSicModeLabel(): void {
  const state = agentState;
  const recoveryStop = mode === 'agent' && state?.status === 'stopped' && isRecoveryStop(state.reason) ? state.reason : null;
  const label = recoveryStop === 'sic_recovery_shadow' ? 'Contact recovery observed in shadow'
    : recoveryStop ? 'Contact recovery limited'
    : mode === 'agent' && selectedGame.code === 'AS66' && element<HTMLInputElement>('#agent-sic-pause').checked ? 'Pause for review enabled'
    : mode === 'agent' ? (element<HTMLSelectElement>('#agent-planning').value === 'sic-fallback' ? 'SIC Fallback' : 'SIC')
    : 'Read-only preview';
  if (sicModeLabel.textContent !== label) sicModeLabel.textContent = label;
}

function updateAgentInterface(): void {
  const state = agentState;
  const terminal = Boolean(observation && ['WIN', 'LEVEL_COMPLETE', 'GAME_OVER', 'GAMEOVER'].includes(observation.state));
  const grounded = Boolean(observation?.availableActionIds.some(id => id >= 1 && id <= 7));
  const needsRestart = Boolean(observation && !state?.sessionId && (observation.level !== 1 || observation.levelsCompleted !== 0));
  const available = mode === 'agent' && ready() && !terminal && grounded && !needsRestart;
  const planning = element<HTMLSelectElement>('#agent-planning');
  planning.disabled = Boolean(state?.busy) || busy || loading;
  const reviewing = Boolean(contradictionReview);
  element<HTMLButtonElement>('#agent-step').disabled = reviewing || !available || !(state?.canStep ?? true);
  element<HTMLButtonElement>('#agent-run').disabled = reviewing || !available || !(state?.canRun ?? true);
  element<HTMLButtonElement>('#agent-batch').disabled = reviewing || !available || !(state?.canRun ?? true);
  element('#agent-sic-review').hidden = selectedGame.code !== 'AS66';
  const reviewToggle = element<HTMLInputElement>('#agent-sic-pause');
  reviewToggle.disabled = reviewing || Boolean(state?.busy);
  const recoveryStop = mode === 'agent' && state?.status === 'stopped' && isRecoveryStop(state.reason) ? state.reason : null;
  const confirm = element<HTMLButtonElement>('#agent-sic-resume');
  confirm.hidden = !reviewing;
  confirm.disabled = !reviewing || !available || !state?.canRun;
  element<HTMLButtonElement>('#agent-pause').disabled = !state?.busy;
  const resetLevel = element<HTMLButtonElement>('#agent-reset-level');
  resetLevel.hidden = mode !== 'agent' || !state?.canResetLevel;
  resetLevel.disabled = !state?.canResetLevel;
  element<HTMLButtonElement>('#agent-new-session').disabled = !ready() || Boolean(state?.busy);
  element<HTMLButtonElement>('#agent-restart').disabled = !ready() || Boolean(state?.busy);
  element('#agent-unsupported').hidden = !needsRestart && !recoveryStop;
  const pausedMessage = state?.message.startsWith('Level completed.') ? 'Level completed.'
    : state?.message.startsWith('One action completed.') ? 'One action completed.'
    : state?.message.startsWith('Batch limit reached:') ? `${state.message.split('. ')[0]}.`
    : state?.message.startsWith('Paused.') ? 'Paused.' : state?.message;
  const message = loading ? 'Waiting for the game to load…' : failed ? 'Reload the game to continue.'
    : state?.sessionId ? state.status === 'preparing' ? 'Preparing the agent…'
      : state.status === 'thinking' ? 'Reading the board and planning…'
      : state.status === 'acting' ? 'Applying the next action…'
      : state.status === 'paused' ? pausedMessage
      : state.message
    : needsRestart ? 'Restart at level 1 to begin.'
    : terminal ? 'This game has ended. Use Manual to reset or restart it.'
    : observation && !grounded ? 'The game offers no action in its current public state.'
    : state?.status === 'idle' ? 'Ready to run from level 1.'
    : state?.message ?? 'Ready to run from level 1.';
  element('#agent-message').textContent = contradictionReview
    ? `SIC paused after action ${contradictionReview.sequence}. The return contradicted the prediction. Confirm to continue toward the next level.`
    : recoveryStop === 'sic_recovery_shadow' ? 'SIC recorded the contact counterexample. This session uses shadow recovery.'
    : recoveryStop === 'rooted_cell_access_unresolved' ? 'SIC found no access within the current contact-recovery limits.'
    : message ?? '';
  element('#agent-message').setAttribute('data-status', state?.status ?? 'idle');
  element('#agent-action-count').textContent = String(state?.actionCount ?? 0);
  element('#agent-level-count').textContent = String(state?.sessionId ? state.levelsCompleted : 0);
  element('#agent-prefix-count').textContent = String(state?.cycles ?? 0);
  updateSicPanel();
}

function paint(frame: readonly (readonly number[])[], palette: readonly string[] = observation?.palette ?? fallbackPalette): void {
  if (!context || !frame.length || !frame[0]?.length) return;
  const width = frame[0].length;
  const height = frame.length;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    context.imageSmoothingEnabled = false;
  }
  const paletteKey = palette.join(',');
  if (renderedPalette !== paletteKey) {
    renderedPalette = paletteKey;
    colors = palette.map(hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
  }
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[frame[y]?.[x] ?? 4] ?? colors[4] ?? [27, 32, 40];
      const offset = (y * width + x) * 4;
      image.data[offset] = color[0]!;
      image.data[offset + 1] = color[1]!;
      image.data[offset + 2] = color[2]!;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function ready(): boolean {
  return Boolean(observation && observation.gameCode === selectedGame.code && !busy && !loading && !failed);
}

function updateSs02Tutorial(): void {
  const levelInfo = element('#ss02-level-info');
  const tutorial = element('#ss02-tutorial');
  const level = observation?.gameCode === 'SS02' ? observation.level : 0;
  levelInfo.hidden = !level;
  tutorial.hidden = level !== 1;
  if (!level) return;
  levelInfo.textContent = SS02_LEVEL_INFO[level - 1]?.label ?? '';
  if (tutorial.hidden) return;
  for (const item of tutorial.querySelectorAll<HTMLElement>('[data-ss02-lesson]')) {
    const learned = ss02Lessons.has(item.dataset.ss02Lesson as TutorialLesson);
    item.classList.toggle('done', learned);
  }
  const prompt = element('#ss02-lesson-next');
  const text = lessonPrompt(ss02Lessons);
  if (prompt.textContent !== text) prompt.textContent = text;
}

function updateNativeRoomHelp(game: 'ss03' | 'ss04' | 'ss05', current: GameObservation | null): void {
  const rooms = game === 'ss05' ? SS05_LEVEL_INFO : game === 'ss04' ? SS04_LEVEL_INFO : SS03_LEVEL_INFO;
  const info = current ? rooms[current.level - 1] : undefined;
  const tutorial = element(`#${game}-tutorial`);
  const link = element<HTMLAnchorElement>(`#${game}-source-link`);
  element(`#${game}-level-info`).hidden = !info;
  element(`#${game}-piston-help`).hidden = !info?.piston;
  if (game !== 'ss03') {
    element(`#${game}-mirror-help`).hidden = !info;
    element(`#${game}-monster-help`).hidden = !info;
  }
  tutorial.hidden = current?.level !== 1;
  if (!info || !current) return;
  element(`#${game}-source-label`).textContent = info.label;
  link.hidden = !info.url;
  if (info.url) {
    link.href = info.url;
    link.textContent = info.puzzle ? `Voir l’énigme ${info.puzzle} de référence ↗` : 'Voir la source ↗';
  }
  const lessonAttribute = `data-${game}-lesson`;
  const learned: ReadonlySet<string> = game === 'ss05' ? ss05Lessons : game === 'ss04' ? ss04Lessons : ss03Tutorial.learned;
  for (const item of tutorial.querySelectorAll<HTMLElement>(`[${lessonAttribute}]`)) {
    item.classList.toggle('done', learned.has(item.getAttribute(lessonAttribute) ?? ''));
  }
  if (tutorial.hidden) return;
  const prompt = element(`#${game}-lesson-next`);
  const text = game === 'ss05' ? bardPrompt(ss05Lessons) : game === 'ss04' ? wizardPrompt(ss04Lessons) : ss03Tutorial.prompt(current.frame);
  if (prompt.textContent !== text) prompt.textContent = text;
}

function updateDuoRoomHelp(game: DuoGameCode, current: GameObservation | null, canPlay: boolean): void {
  const id = game.toLowerCase();
  const solo = game === 'SS06' && ss06Solo;
  const { roles: [first, second], directions, rooms, heroes, lessons, total, prompt, tutorialLevel } = duoRoomHelp[game];
  const info = current ? rooms[current.level - 1] : undefined;
  element(`#${id}-room-help`).hidden = !info;
  element(`#${id}-role-controls`).hidden = !info || solo;
  if (!info || !current) return;
  const objective = solo
    ? 'Amène le Guerrier rouge sur l’unique contour jaune.'
    : `Amène le ${first.label} et le ${second.label} sur les deux contours jaunes en même temps.`;
  element(`#${id}-objective`).textContent = (game === 'SS09' || game === 'SS10') && 'objective' in info ? info.objective : objective;
  if (game === 'SS06') element('#ss06-cooperation-help').hidden = solo;
  const selected = heroes(current.frame).find(hero => hero.selected)?.kind;
  const roleAttribute = `data-${id}-hero`;
  for (const button of document.querySelectorAll<HTMLButtonElement>(`[${roleAttribute}]`)) {
    button.disabled = !canPlay || solo || !current.availableActionIds.includes(6);
    button.setAttribute('aria-pressed', String(button.getAttribute(roleAttribute) === selected));
  }
  canvas.setAttribute('aria-label', `Plateau ${game}`);
  element('#keyboard-help').textContent = `${directions} Espace ou X pour les reflets. Z pour annuler. R pour recommencer.`
    + (solo ? '' : ` Clique sur un héros ou utilise Tab, 1 pour le ${first.label} et 2 pour le ${second.label}. Maj+Tab quitte la grille.`);
  element(`#${id}-source-label`).textContent = info.label;
  const link = element<HTMLAnchorElement>(`#${id}-source-link`);
  link.hidden = !info.url;
  if (info.url) {
    link.href = info.url;
    link.textContent = 'puzzle' in info && info.puzzle ? `Voir l’énigme ${info.puzzle} de référence ↗` : 'Voir la source ↗';
  }
  element(`#${id}-piston-help`).hidden = !info.piston;
  element(`#${id}-platform-help`).hidden = !('platform' in info && info.platform);
  const tutorial = element(`#${id}-tutorial`);
  tutorial.hidden = current.level !== tutorialLevel;
  const learned: ReadonlySet<string> = lessons;
  const lessonAttribute = `data-${id}-lesson`;
  for (const item of tutorial.querySelectorAll<HTMLElement>(`[${lessonAttribute}]`)) {
    item.classList.toggle('done', learned.has(item.getAttribute(lessonAttribute) ?? ''));
  }
  element(`#${id}-lesson-progress`).textContent = `${learned.size} / ${total} découvertes`;
  const hint = element(`#${id}-lesson-next`);
  const text = prompt();
  if (hint.textContent !== text) hint.textContent = text;
}

function hasNextLevel(current: GameObservation): boolean {
  return current.level < current.levelCount && !(usesNativeManualControls(current.gameCode) && current.state === 'WIN');
}

function updateInterface(): void {
  const enabled = ready() && mode === 'manual';
  const canNavigate = mode === 'manual' && (enabled || interruptibleAnimation);
  const complete = observation?.state === 'WIN' || observation?.state === 'LEVEL_COMPLETE';
  const lost = observation?.state === 'GAME_OVER' || observation?.state === 'GAMEOVER';
  const available = new Set(observation?.availableActionIds ?? []);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    button.disabled = !enabled || Boolean(complete || lost) || !available.has(Number(button.dataset.action));
  }
  const merchantButton = element<HTMLButtonElement>('#merchant-button');
  merchantButton.hidden = selectedGame.code !== 'SS01';
  merchantButton.disabled = !enabled || Boolean(complete || lost) || !available.has(6);
  element<HTMLButtonElement>('#undo-button').disabled = !canNavigate || !observation?.canUndo;
  element<HTMLButtonElement>('#reset-button').disabled = !canNavigate;
  element<HTMLButtonElement>('#restart-button').disabled = !canNavigate;
  const levelSelect = element<HTMLSelectElement>('#level-select');
  const levelCount = observation?.canSelectLevel ? observation.levelCount : 0;
  if (levelCount !== renderedLevelCount) {
    renderedLevelCount = levelCount;
    levelSelect.innerHTML = levelCount ? Array.from({ length: levelCount }, (_, index) =>
      `<option value="${index + 1}">Level ${index + 1}</option>`,
    ).join('') : '<option value="">Loading…</option>';
  }
  levelSelect.disabled = !canNavigate || levelCount < 2;
  if (levelCount && observation) levelSelect.value = String(observation.level);
  const nextLevel = Boolean(observation && hasNextLevel(observation));
  const victory = complete && !nextLevel;
  element('#win-overlay').hidden = !ready() || !complete || (mode === 'agent' && !victory);
  const duo = isDuoNativeGame(selectedGame.code);
  const solo = selectedGame.code === 'SS06' && ss06Solo;
  element('#win-title').textContent = duo
    ? solo ? 'Le Guerrier a atteint sa destination' : 'Les deux destinations sont occupées'
    : victory ? 'VICTORY' : 'Level complete';
  element('#win-continue-label').textContent = nextLevel ? 'Next level' : 'Restart from level 1';
  element<HTMLButtonElement>('#win-continue').disabled = !ready() || Boolean(agentState?.busy);
  element('#runtime-overlay').hidden = !loading && !failed;
  element('#runtime-spinner').hidden = !loading;
  element<HTMLButtonElement>('#retry-button').hidden = !failed;
  element('#game-availability').textContent = loading ? 'Loading' : failed ? 'Unavailable' : 'Ready';
  element('#game-availability').classList.toggle('is-pending', loading || failed);
  canvas.setAttribute('aria-busy', String(busy || loading));
  canvas.tabIndex = enabled ? 0 : -1;
  if (selectedGame.code === 'SS02' && mode === 'manual') updateSs02Tutorial();
  if (selectedGame.code === 'SS03' || selectedGame.code === 'SS04' || usesReflectionShortcut(selectedGame.code)) {
    element('#native-defeat').hidden = !ready() || !lost;
    element('#native-defeat-title').textContent = duo
      ? solo ? 'Le Guerrier a été perdu' : 'Un personnage a été perdu'
      : 'GAME OVER';
    element<HTMLButtonElement>('#native-defeat-undo').disabled = !observation?.canUndo;
    if (mode === 'manual' && !duo) {
      updateNativeRoomHelp(selectedGame.code === 'SS05' ? 'ss05' : selectedGame.code === 'SS04' ? 'ss04' : 'ss03', observation);
    }
  }
  if (isDuoNativeGame(selectedGame.code)) updateDuoRoomHelp(selectedGame.code, observation, enabled && !complete && !lost);
  updateAgentInterface();
}

async function present(next: GameObservation, selectedGeneration: number, manualAction = false): Promise<void> {
  if (selectedGeneration !== selectionGeneration || next.gameCode !== selectedGame.code) return;
  const generation = ++presentationGeneration;
  const previous = observation;
  const soloBefore = next.gameCode === 'SS06' && ss06Solo;
  if (next.gameCode === 'SS08' && next.level === SS08_TUTORIAL_LEVEL && previous?.level !== next.level) {
    element<HTMLDetailsElement>('#ss08-tutorial').open = true;
  }
  observation = next;
  loading = false;
  failed = false;
  const url = new URL(window.location.href);
  url.searchParams.set('game', next.gameCode);
  url.searchParams.set('level', String(next.level));
  if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  const frames = next.frames.length ? next.frames : [next.frame];
  interruptibleAnimation = (manualAction || isDuoNativeGame(next.gameCode)) && usesNativeManualControls(next.gameCode) && frames.length > 1;
  updateInterface();
  const frameDuration = 1000 / Math.max(1, Math.min(60, next.defaultFps || 10));
  for (let i = 0; i < frames.length; i += 1) {
    if (generation !== presentationGeneration || selectedGeneration !== selectionGeneration) return;
    paint(frames[i]!, next.palette ?? fallbackPalette);
    const requestedDuration = next.frameDurationsMs?.[i];
    const duration = requestedDuration !== undefined && Number.isFinite(requestedDuration) && requestedDuration >= 0
      ? requestedDuration : frameDuration;
    if (i < frames.length - 1) await new Promise<void>(resolve => window.setTimeout(resolve, duration));
  }
  if (generation !== presentationGeneration || selectedGeneration !== selectionGeneration) return;
  paint(next.frame, next.palette ?? fallbackPalette);
  if (next.gameCode === 'SS06' && next.state === 'NOT_FINISHED') {
    // Read the living roster from the settled image. A lost hero must not turn a duo into a solo.
    ss06Solo = visibleHeroes(next.frame).length === 1;
  }
  interruptibleAnimation = false;
  busy = false;
  agent.refresh();
  updateInterface();
  if (isDuoNativeGame(next.gameCode)) {
    if (next.state === 'GAME_OVER') element('#game-feedback').textContent =
      `${soloBefore ? 'Le Guerrier' : 'Un personnage'} a été perdu. Annule ou recommence le niveau.`;
    else if (previous && next.levelsCompleted > previous.levelsCompleted) element('#game-feedback').textContent =
      soloBefore ? 'La destination est atteinte.' : 'Les deux destinations sont occupées.';
    else if (next.state === 'NOT_FINISHED') element('#game-feedback').textContent = '';
  } else if (next.state === 'WIN' || next.state === 'LEVEL_COMPLETE') element('#game-feedback').textContent =
    hasNextLevel(next) ? `Level ${next.level} complete.` : 'VICTORY';
  else if (next.state === 'GAME_OVER' || next.state === 'GAMEOVER') element('#game-feedback').textContent = 'Game over. Undo or reset to continue.';
}

function showFailure(error: unknown, generation: number): void {
  if (generation !== selectionGeneration) return;
  interruptibleAnimation = false;
  busy = false;
  loading = false;
  failed = true;
  console.error(`Game operation failed for ${selectedGame.code}.`, error);
  element('#runtime-message').textContent = `Could not load ${selectedGame.code}. Please retry.`;
  element('#game-feedback').textContent = 'The game could not continue. Retry to reload it.';
  updateInterface();
}

async function run(operation: () => Promise<GameObservation>, options: {
  announcement?: string;
  action?: number;
  control?: 'undo' | 'reset' | 'restart' | 'selectLevel';
} = {}): Promise<void> {
  const { announcement, action, control } = options;
  if (mode !== 'manual' || (!ready() && !(control && interruptibleAnimation))) return;
  const before = observation!;
  if (interruptibleAnimation) {
    presentationGeneration += 1;
    interruptibleAnimation = false;
  }
  if (before.gameCode === 'SS02' && control && control !== 'undo') ss02Lessons.clear();
  if (before.gameCode === 'SS03' && control) ss03Tutorial.reset(control === 'undo');
  if (before.gameCode === 'SS04' && control && control !== 'undo') ss04Lessons.clear();
  if (before.gameCode === 'SS05' && control && control !== 'undo') ss05Lessons.clear();
  if (isDuoNativeGame(before.gameCode) && control && control !== 'undo') duoRoomHelp[before.gameCode].lessons.clear();
  agent.invalidate('Manual play changed the observation. Start a fresh experiment when ready.');
  const generation = selectionGeneration;
  busy = true;
  updateInterface();
  try {
    const next = await operation();
    if (generation !== selectionGeneration) return;
    if (next.gameCode === 'SS02' && action !== undefined) observeLesson(ss02Lessons, before, next, action);
    if (next.gameCode === 'SS03' && action !== undefined) ss03Tutorial.observe(before, next, action);
    if (next.gameCode === 'SS04' && action !== undefined) observeWizardLesson(ss04Lessons, before, next);
    if (next.gameCode === 'SS05' && action !== undefined) observeBardLesson(ss05Lessons, before, next, action);
    if (next.gameCode === 'SS06' && action !== undefined) observeDuoLesson(ss06Lessons, before, next, action);
    if (next.gameCode === 'SS07' && action !== undefined) observeThiefLesson(ss07Lessons, before, next, action);
    if (next.gameCode === 'SS09' && action !== undefined) observeChorusLesson(ss09Lessons, before, next, action);
    if (next.gameCode === 'SS10') {
      if (action !== undefined) observeWarehouseLesson(ss10Lessons, before, next, action);
      if (control === 'restart') element<HTMLDetailsElement>('#ss10-tutorial').open = true;
    }
    if (next.gameCode === 'SS08') {
      if (action !== undefined) observeTranspositionLesson(ss08Lessons, before, next, action);
      if (next.level === SS08_TUTORIAL_LEVEL && (control === 'selectLevel' || control === 'reset')) {
        element<HTMLDetailsElement>('#ss08-tutorial').open = true;
      }
    }
    const presenting = present(next, generation, action !== undefined);
    const presentation = presentationGeneration;
    await presenting;
    if (generation !== selectionGeneration || presentation !== presentationGeneration) return;
    if (sicDisplayEnabled && mode === 'manual') {
      manualReturns = action === undefined ? [] : recordPublicReturn(manualReturns, `manual:${generation}`, ++manualSequence, action, before, next);
      updateSicPanel();
    }
    if (next.gameCode === 'SS06' && action !== undefined) element('#game-feedback').textContent = duoFeedback(before, next, action);
    else if (next.gameCode === 'SS07' && action !== undefined) element('#game-feedback').textContent = thiefFeedback(before, next, action);
    else if (next.gameCode === 'SS08' && action !== undefined) element('#game-feedback').textContent = transpositionFeedback(before, next, action);
    else if (next.gameCode === 'SS09' && action !== undefined) element('#game-feedback').textContent = chorusFeedback(before, next, action);
    else if (next.gameCode === 'SS10' && action !== undefined) element('#game-feedback').textContent = warehouseFeedback(before, next, action);
    else if (announcement) element('#game-feedback').textContent = announcement;
  } catch (error) {
    showFailure(error, generation);
  }
}

function perform(action: number, data?: { x: number; y: number }): void {
  if (!observation?.availableActionIds.includes(action) || ['WIN', 'LEVEL_COMPLETE', 'GAME_OVER', 'GAMEOVER'].includes(observation.state)) return;
  void run(() => runtime.action(action, data), { action });
}
function nextMerchant(): void {
  if (selectedGame.code !== 'SS01' || !observation?.availableActionIds.includes(6) || observation.state === 'WIN') return;
  void run(() => runtime.nextMerchant(), { announcement: 'Merchant selected.' });
}
function canSelectDuoHero(code: string): boolean {
  return isDuoNativeGame(code) && !(code === 'SS06' && ss06Solo);
}
function selectDuoHero(slot?: '1' | '2'): void {
  const code = selectedGame.code;
  if (!isDuoNativeGame(code) || !canSelectDuoHero(code) || !ready() || !observation) return;
  const { roles: [first, second], heroes } = duoRoomHelp[code];
  const kind = slot === '1' ? first.kind : slot === '2' ? second.kind : undefined;
  const hero = heroes(observation.frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  if (hero && !hero.selected) perform(6, { x: 3 + hero.x * 3, y: 3 + hero.y * 3 });
}
function undo(): void {
  if (!observation?.canUndo) return;
  void run(() => runtime.undo(), { control: 'undo', announcement: 'Last action undone.' });
}
function reset(): void {
  void run(() => runtime.reset(), { control: 'reset', announcement: 'Level reset.' });
}
function restart(): void {
  void run(() => runtime.restart(), { control: 'restart', announcement: 'Game restarted from level 1.' });
}
function focusCanvas(): void {
  canvas.focus({ preventScroll: true });
}

function setMode(next: 'manual' | 'agent', focusTab = false): void {
  if (mode !== next && next === 'manual') {
    agent.invalidate('Manual control. Start a fresh experiment when ready.');
    manualReturns = [];
  }
  mode = next;
  const manual = next === 'manual';
  const manualTab = element<HTMLButtonElement>('#manual-tab');
  const agentTab = element<HTMLButtonElement>('#agent-tab');
  manualTab.setAttribute('aria-selected', String(manual));
  agentTab.setAttribute('aria-selected', String(!manual));
  manualTab.tabIndex = manual ? 0 : -1;
  agentTab.tabIndex = manual ? -1 : 0;
  element('#manual-panel').hidden = !manual;
  element('#agent-panel').hidden = manual;
  element('.player').classList.toggle('is-agent-mode', !manual);
  sicPanel.hidden = !sicDisplayEnabled;
  agent.refresh();
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}

async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push', level?: number): Promise<void> {
  agent.invalidate('A new game observation is ready for native reasoning.');
  const game = getGameByCode(code) ?? defaultGame!;
  const directional = isDirectionalNativeGame(game.code);
  const bard = game.code === 'SS05';
  const reflection = usesReflectionShortcut(game.code);
  const enteringNativeManualGame = usesNativeManualControls(game.code) && selectedGame.code !== game.code;
  const generation = ++selectionGeneration;
  presentationGeneration += 1;
  interruptibleAnimation = false;
  ss02Lessons.clear();
  if (game.code === 'SS02') element<HTMLDetailsElement>('#ss02-tutorial').open = true;
  element('#ss02-tutorial').hidden = true;
  element('#ss02-level-info').hidden = true;
  ss03Tutorial.reset();
  ss04Lessons.clear();
  ss05Lessons.clear();
  ss06Lessons.clear();
  ss07Lessons.clear();
  ss08Lessons.clear();
  ss09Lessons.clear();
  ss10Lessons.clear();
  ss06Solo = false;
  if (isDuoNativeGame(game.code)) element<HTMLDetailsElement>(`#${game.code.toLowerCase()}-tutorial`).open = true;
  if (game.code === 'SS03' || game.code === 'SS04' || bard) {
    const help = game.code.toLowerCase();
    element<HTMLDetailsElement>(`#${help}-tutorial`).open = true;
    element<HTMLDetailsElement>(`#${help}-piston-help`).open = true;
  }
  for (const id of ['ss03-tutorial', 'ss03-level-info', 'ss03-piston-help', 'ss04-tutorial', 'ss04-level-info',
    'ss04-piston-help', 'ss04-mirror-help', 'ss04-monster-help', 'ss05-tutorial', 'ss05-level-info',
    'ss05-piston-help', 'ss05-mirror-help', 'ss05-monster-help', 'ss06-room-help', 'ss06-role-controls',
    'ss07-room-help', 'ss07-role-controls', 'ss08-room-help', 'ss08-role-controls', 'ss09-room-help',
    'ss09-role-controls', 'ss10-room-help', 'ss10-role-controls', 'native-defeat']) element(`#${id}`).hidden = true;
  const primaryAction = element<HTMLButtonElement>('#space-button');
  primaryAction.hidden = directional;
  primaryAction.title = reflection ? 'Reflet (Espace ou X)' : 'Space';
  primaryAction.setAttribute('aria-label', reflection ? primaryAction.title : 'Primary action (Space)');
  element('#space-button span').textContent = reflection ? 'Reflet' : 'Space';
  selectedGame = game;
  manualReturns = [];
  manualSequence = 0;
  observation = null;
  busy = true;
  loading = true;
  failed = false;
  element<HTMLSelectElement>('#game-select').value = game.code;
  element('#game-code').textContent = game.code;
  element('#game-title').textContent = game.name;
  element('#game-meta').textContent = groupLabels[game.group];
  element('#board-source-credit').hidden = game.group !== 'custom_4';
  element('#runtime-message').textContent = 'Loading game…';
  element('#selection-feedback').textContent = `${game.code} selected.`;
  const movement = game.code === 'SS04' ? 'swap with a visible crate or monster, or move one cell'
    : game.code === 'SS03' ? 'move or pull' : 'move or push';
  canvas.setAttribute('aria-label', bard ? 'Plateau SS05. Les flèches déplacent le Barde et déclenchent le chant. Espace ou X active les miroirs.'
    : directional ? `${game.code} game board. Use the arrow keys to ${movement}.`
    : `${game.code} game board. Use the arrow keys, Space, or click to interact.`);
  element('#keyboard-help').textContent = bard ? 'Flèches pour marcher et entraîner les objets proches. Espace ou X pour les reflets. Z pour annuler. R pour recommencer.'
    : directional
    ? `Use the arrow keys to ${movement}. Z or Control Z to undo. R to reset the level.`
    : 'Arrow keys and Space for actions. Click the board to interact. Z or Control Z to undo. R to reset the level. In SS01, C or a click selects a Merchant.';
  document.title = `SRA Playground · ${game.code} — Symbolic Reasoning Agent`;
  setMode(enteringNativeManualGame ? 'manual' : mode);
  if (historyMode !== 'none') {
    const url = new URL(window.location.href);
    url.searchParams.set('game', game.code);
    if (level === undefined) url.searchParams.delete('level');
    else url.searchParams.set('level', String(level));
    if (historyMode === 'replace') window.history.replaceState(null, '', url);
    else if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }
  try {
    await present(await runtime.load(game.code, level), generation);
  } catch (error) {
    showFailure(error, generation);
  }
}

element<HTMLSelectElement>('#game-select').addEventListener('change', event => {
  void selectGame((event.currentTarget as HTMLSelectElement).value);
});
window.addEventListener('popstate', () => {
  const url = new URL(window.location.href);
  const game = getGameByCode(url.searchParams.get('game') ?? defaultGameCode) ?? defaultGame!;
  void selectGame(game.code, 'none', requestedLevel(url, game));
});
element('#retry-button').addEventListener('click', () => {
  void selectGame(selectedGame.code, 'none', requestedLevel(new URL(window.location.href), selectedGame));
});
element('#manual-tab').addEventListener('click', () => setMode('manual'));
element('#agent-tab').addEventListener('click', () => setMode('agent'));
element('#return-manual').addEventListener('click', () => { setMode('manual'); focusCanvas(); });
element('#agent-step').addEventListener('click', () => { if (!contradictionReview) void agent.step(); });
element('#agent-planning').addEventListener('change', () => {
  agent.invalidate('Planning selection changed. Start a new reasoning session on the current board.');
});
element('#agent-run').addEventListener('click', () => {
  if (contradictionReview) return;
  const start = performance.now();
  void agent.run(600).finally(() => {
    if (import.meta.env.DEV) element('#agent-panel').dataset.lastRunMilliseconds = String(Math.round(performance.now() - start));
  });
});
element('#agent-batch').addEventListener('click', () => { if (!contradictionReview) void agent.run(16); });
element('#agent-pause').addEventListener('click', () => agent.pause());
element('#agent-reset-level').addEventListener('click', () => { contradictionReview = null; void agent.resetLevel(); });
element('#agent-sic-pause').addEventListener('change', updateAgentInterface);
element('#agent-sic-resume').addEventListener('click', () => {
  if (!contradictionReview || !agentState?.canRun || element<HTMLButtonElement>('#agent-sic-resume').disabled) return;
  contradictionReview = null;
  void agent.run(600);
});
element('#agent-new-session').addEventListener('click', () => agent.invalidate('New reasoning session. The current game position is preserved.'));
element('#agent-restart').addEventListener('click', () => {
  void selectGame(selectedGame.code, 'replace', 1);
});
element('.mode-tabs').addEventListener('keydown', (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setMode(event.key === 'Home' ? 'manual' : event.key === 'End' ? 'agent' : mode === 'manual' ? 'agent' : 'manual', true);
});
canvas.addEventListener('click', (event: MouseEvent) => {
  if (!ready() || mode !== 'manual') return;
  if (selectedGame.code === 'SS06' && ss06Solo) { focusCanvas(); return; }
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
  perform(6, { x, y });
  focusCanvas();
});
canvas.addEventListener('keydown', (event: KeyboardEvent) => {
  const reflectionShortcut = usesReflectionShortcut(selectedGame.code) && event.key.toLowerCase() === 'x';
  if (event.altKey || (event.shiftKey && !reflectionShortcut)) return;
  if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'c' && selectedGame.code === 'SS01') {
    event.preventDefault(); nextMerchant(); return;
  }
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey || event.metaKey) return;
  if (canSelectDuoHero(selectedGame.code) && ['Tab', '1', '2'].includes(event.key)) {
    event.preventDefault();
    selectDuoHero(event.key === '1' || event.key === '2' ? event.key : undefined);
    return;
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    reset();
    return;
  }
  const actions: Record<string, number> = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, ' ': 5 };
  const action = reflectionShortcut ? 5 : actions[event.key];
  if (action === undefined || (action === 5 && isDirectionalNativeGame(selectedGame.code))) return;
  event.preventDefault();
  perform(action);
});
element('#merchant-button').addEventListener('click', () => { nextMerchant(); focusCanvas(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-duo-slot]')) {
  button.addEventListener('click', () => {
    const slot = button.dataset.duoSlot;
    if (slot === '1' || slot === '2') selectDuoHero(slot);
    focusCanvas();
  });
}
element('#undo-button').addEventListener('click', () => { undo(); focusCanvas(); });
element('#reset-button').addEventListener('click', () => { reset(); focusCanvas(); });
element('#restart-button').addEventListener('click', () => { restart(); focusCanvas(); });
element('#native-defeat-undo').addEventListener('click', () => { setMode('manual'); undo(); focusCanvas(); });
element('#native-defeat-reset').addEventListener('click', () => { setMode('manual'); reset(); focusCanvas(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => { perform(Number(button.dataset.action)); focusCanvas(); });
}
element<HTMLSelectElement>('#level-select').addEventListener('change', event => {
  const select = event.currentTarget as HTMLSelectElement;
  if (select.disabled || !observation?.canSelectLevel) return;
  const level = Number(select.value);
  void run(() => runtime.selectLevel(level), { control: 'selectLevel', announcement: `Level ${level} selected.` });
});
element('#win-continue').addEventListener('click', () => {
  if (!observation || !ready() || agentState?.busy) return;
  if (mode === 'agent') setMode('manual');
  if (hasNextLevel(observation)) {
    const level = observation.level + 1;
    void run(() => runtime.selectLevel(level), { control: 'selectLevel', announcement: `Level ${level} selected.` });
  } else restart();
  focusCanvas();
});
const fullscreenButton = element<HTMLButtonElement>('#fullscreen-button');
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', () => {
  const operation = document.fullscreenElement ? document.exitFullscreen() : element('#canvas-stage').requestFullscreen();
  void operation.catch(() => { element('#game-feedback').textContent = 'Full-screen mode is not available in this browser window.'; });
});
window.addEventListener('pagehide', event => {
  agent.pause();
  if (!event.persisted) { agent.dispose(); runtime.dispose(); }
});
void selectGame(selectedGame.code, 'replace', requestedLevel(new URL(window.location.href), selectedGame));
