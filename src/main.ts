import './styles.css';
import './sra-agent.css';
import { renderSiteHeader } from './site-header';
import { BrowserGameRuntime, type GameObservation } from './runtime/browser-games';
import { AGENT_STATUS } from './runtime/contracts';
import { BrowserV6Agent, type V6AgentSnapshot } from './runtime/v6-agent.ts';
import { bindSicPerspectives, renderSicPanel } from './sic/panel.ts';
import { readControlEffectShadow } from './sic/shadow.ts';
import { observeSpace, type SpaceReturn } from './sic/space-return.ts';
import { compareStckRank, type StckRankTrial } from './sic/stck-stack.ts';
import { matchObservedRotation, observeDirectionalReturn, samplePublicAnimation, type DirectionalReturn } from './sic/directional-return.ts';
import { captureDecisionSprites, readNativeResolution, type NativeResolution } from './sic/native-resolution.ts';
import { observeLs20Restart, recordPursuedObjective, type PursuedObjective } from './sic/recovery.ts';
import ls20ReviewEvidence from './sic/ls20-review-evidence.json';
import { GAME_CATALOG, getGameByCode, type GameCatalogEntry } from './games/catalog';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
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
  official: 'Official ARC-AGI-3',
};
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
      <a class="intro-art" href="/gallery.html" aria-label="Explore 75 New Games, followed by 25 official games">
        <img src="/game-mosaic.png?v=custom-wave-3" alt="A patchwork of custom game boards" width="405" height="204" />
        <span class="mosaic-label">EXPLORE 75 NEW GAMES ${icon('arrow')}</span>
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
      <div class="section-line"><div class="playground-heading-group"><h2 class="playground-heading" id="playground-title">ARC AGI <span>3</span></h2><a class="text-link" href="/arc-agi-3.html">What is ARC-AGI-3? ${icon('arrow')}</a></div><a class="catalog-count" href="/gallery.html" aria-label="75 New Games and 25 official games: browse all 100 games">${GAME_CATALOG.length} GAMES<span>/</span>25 OFFICIAL + 75 CUSTOM</a></div>
      <p class="custom-game-credit"><strong>75 new custom games</strong><span class="custom-game-author">created or compiled by <span>Yannick Fontan.</span></span></p>
      <article class="player">
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
            <button type="button" id="manual-tab" role="tab" aria-selected="true" aria-controls="manual-panel" tabindex="0">${icon('hand')}Manual</button>
            <button type="button" id="agent-tab" role="tab" aria-selected="false" aria-controls="agent-panel" tabindex="-1">${icon('robot')}SRA Agent<span class="agent-mode-label">Native TS</span></button>
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
            </div>
          </div>

          <aside class="control-column minimal-control-column">
            <div id="manual-panel" role="tabpanel" aria-labelledby="manual-tab">
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
                  <button type="button" id="undo-button" class="utility-button" aria-label="Undo last action" title="Undo (Z or Ctrl+Z)">${icon('undo')}<span>Undo</span></button>
                  <button type="button" id="reset-button" class="utility-button" aria-label="Reset level" title="Reset level (R)">${icon('reset')}<span>Reset</span></button>
                </div>
              </div>
              <p id="keyboard-help" class="sr-only">Arrow keys and Space for actions. Click the board to interact. Z or Control Z to undo. R to reset the level.</p>
            </div>
            <div id="agent-panel" role="tabpanel" aria-labelledby="agent-tab" data-agent-status="${AGENT_STATUS.status}" data-agent-available="${AGENT_STATUS.available}" hidden>
              <h3>Solve with SRA.</h3>
              <p id="agent-message" class="agent-message" role="status" aria-live="polite" aria-atomic="true" tabindex="0">Ready to run from level 1.</p>
              <div class="agent-run-controls">
                <button id="agent-run" type="button" class="primary-button">Run to next level</button>
                <button id="agent-batch" type="button" class="secondary-button">Run 16 actions</button>
                <button id="agent-step" type="button" class="secondary-button">One action</button>
                <button id="agent-pause" type="button" class="secondary-button agent-pause-wide" disabled>Pause</button>
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
            <span class="sic-mode">Read-only preview</span>
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
            <section class="sic-card"><h4>Ways to solve the situation</h4><div data-sic-strategy-body></div></section>
          </div>
          <div id="sic-objectives" role="tabpanel" aria-labelledby="sic-objectives-tab" tabindex="0" hidden>
            <section class="sic-card"><h4>What to achieve</h4><div data-sic-objective-body></div></section>
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
let mode: 'manual' | 'agent' = 'manual';
let modeGeneration = 0;
let busy = false;
let loading = false;
let failed = false;
let selectionGeneration = 0;
let presentationGeneration = 0;
let renderedLevelCount = -1;
let renderedPalette = '';
let colors: number[][] = [];
let agentState: V6AgentSnapshot | null = null;
const sicPanel = element<HTMLElement>('#sic-panel');
bindSicPerspectives(sicPanel);
let sicRenderPending = false;
let lastSicBoard: GameObservation | null = null;
let lastSicState: V6AgentSnapshot | null = null;
let spaceReturns: readonly SpaceReturn[] = [];
let stckRankReturns: readonly (StckRankTrial & { sessionId: string; sequence: number })[] = [];
let agentReturns: readonly DirectionalReturn[] = [];
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
      && !history.some(item => item.sessionId === sessionId && item.sequence > recovered.sequence && item.routeBoard)
      ? before.frame.map(row => [...row]) : undefined;
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
const agent = new BrowserV6Agent({
  getObservation: () => observation,
  canDispatch: () => ready() && mode === 'agent',
  dispatch: async action => {
    if (!ready() || mode !== 'agent' || !observation?.availableActionIds.includes(action.id)) {
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
      if (action.id === 5 && before.gameCode === 'STCK' && sessionId && sessionId === agentState?.sessionId) {
        try {
          const entry = observeSpace({ sessionId, sequence, fromLevel: before.level, toLevel: next.level },
            before.frame, next.frames.length ? next.frames : [next.frame]);
          spaceReturns = [...spaceReturns.filter(item => item.sessionId === sessionId).slice(-2), entry];
        } catch {
          // An unavailable preview cannot affect the executed action or its return.
        }
      }
      if (action.id === 6 && before.gameCode === 'STCK' && before.level === next.level
          && before.state === next.state && sessionId && sessionId === agentState?.sessionId) {
        try {
          const trial = compareStckRank(before.frame, next.frame, [action.data.x, action.data.y], before.level);
          if (trial) stckRankReturns = [...stckRankReturns.filter(item => item.sessionId === sessionId).slice(-31),
            { ...trial, sessionId, sequence }];
        } catch {
          // Rank evidence is optional and cannot affect the executed action.
        }
      }
      if (sessionId && sessionId === agentState?.sessionId) {
        let decision: NativeResolution | null = null;
        try {
          if (nativeSnapshot?.level === before.level && nativeSnapshot.phase === 'authorised_not_executed') {
            decision = readNativeResolution(nativeSnapshot);
          }
        } catch {
          // Explanations never affect dispatch.
        }
        agentReturns = recordPublicReturn(agentReturns, sessionId, sequence, action.id, before, next, decision);
        const receipt = agentReturns.at(-1);
        if (receipt?.sessionId === sessionId && receipt.sequence === sequence) {
          const entries = objectiveLedger?.sessionId === sessionId ? objectiveLedger.entries : [];
          objectiveLedger = { sessionId, entries: recordPursuedObjective(entries, receipt) };
        }
      }
      return { observation: next, executionMs };
    } catch (error) {
      showFailure(error, generation);
      throw error;
    }
  },
  onState: state => {
    const last = agentReturns.at(-1);
    if (last && !last.nativeCheck && last.sessionId === state.sessionId && last.sequence === state.sequence) {
      try {
        const outcome = readNativeResolution(state)?.outcome;
        if (outcome) agentReturns = [...agentReturns.slice(0, -1), { ...last, nativeCheck: outcome }];
      } catch {
        // A missed display receipt does not change the native session.
      }
    }
    agentState = state;
    updateInterface();
  },
});

function updateSicPanel(): void {
  if (sicPanel.hidden || sicRenderPending || busy || agentState?.busy) return;
  sicRenderPending = true;
  window.requestAnimationFrame(() => {
    sicRenderPending = false;
    if (sicPanel.hidden || busy || agentState?.busy) return;
    const board = loading || failed ? null : observation;
    const history = mode === 'agent' ? agentReturns : manualReturns;
    if (board === lastSicBoard && agentState === lastSicState && history === lastSicReturns && mode === lastSicMode) return;
    lastSicBoard = board;
    lastSicState = agentState;
    lastSicReturns = history;
    lastSicMode = mode;
    const state = agentState;
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
  });
}

function updateAgentInterface(): void {
  const state = agentState;
  const terminal = Boolean(observation && ['WIN', 'LEVEL_COMPLETE', 'GAME_OVER', 'GAMEOVER'].includes(observation.state));
  const grounded = Boolean(observation?.availableActionIds.some(id => id >= 1 && id <= 7));
  const needsRestart = Boolean(observation && !state?.sessionId && (observation.level !== 1 || observation.levelsCompleted !== 0));
  const available = mode === 'agent' && ready() && !terminal && grounded && !needsRestart;
  element<HTMLButtonElement>('#agent-step').disabled = !available || !(state?.canStep ?? true);
  element<HTMLButtonElement>('#agent-run').disabled = !available || !(state?.canRun ?? true);
  element<HTMLButtonElement>('#agent-batch').disabled = !available || !(state?.canRun ?? true);
  element<HTMLButtonElement>('#agent-pause').disabled = !state?.busy;
  element<HTMLButtonElement>('#agent-new-session').disabled = !ready() || Boolean(state?.busy);
  element<HTMLButtonElement>('#agent-restart').disabled = !ready() || Boolean(state?.busy);
  element('#agent-unsupported').hidden = !needsRestart;
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
  element('#agent-message').textContent = message ?? '';
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

function updateInterface(): void {
  const enabled = ready() && mode === 'manual';
  const complete = observation?.state === 'WIN' || observation?.state === 'LEVEL_COMPLETE';
  const lost = observation?.state === 'GAME_OVER' || observation?.state === 'GAMEOVER';
  const available = new Set(observation?.availableActionIds ?? []);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    button.disabled = !enabled || Boolean(complete || lost) || !available.has(Number(button.dataset.action));
  }
  element<HTMLButtonElement>('#undo-button').disabled = !enabled || !observation?.canUndo;
  element<HTMLButtonElement>('#reset-button').disabled = !enabled;
  element<HTMLButtonElement>('#restart-button').disabled = !enabled;
  const levelSelect = element<HTMLSelectElement>('#level-select');
  const levelCount = observation?.canSelectLevel ? observation.levelCount : 0;
  if (levelCount !== renderedLevelCount) {
    renderedLevelCount = levelCount;
    levelSelect.innerHTML = levelCount ? Array.from({ length: levelCount }, (_, index) =>
      `<option value="${index + 1}">Level ${index + 1}</option>`,
    ).join('') : '<option value="">Loading…</option>';
  }
  levelSelect.disabled = !enabled || levelCount < 2;
  if (levelCount && observation) levelSelect.value = String(observation.level);
  const hasNextLevel = Boolean(observation && observation.level < observation.levelCount);
  const victory = complete && !hasNextLevel;
  element('#win-overlay').hidden = !ready() || !complete || (mode === 'agent' && !victory);
  element('#win-title').textContent = victory ? 'VICTORY' : 'Level complete';
  element('#win-continue-label').textContent = hasNextLevel ? 'Next level' : 'Restart from level 1';
  element<HTMLButtonElement>('#win-continue').disabled = !ready() || Boolean(agentState?.busy);
  element('#runtime-overlay').hidden = !loading && !failed;
  element('#runtime-spinner').hidden = !loading;
  element<HTMLButtonElement>('#retry-button').hidden = !failed;
  element('#game-availability').textContent = loading ? 'Loading' : failed ? 'Unavailable' : 'Ready';
  element('#game-availability').classList.toggle('is-pending', loading || failed);
  canvas.setAttribute('aria-busy', String(busy || loading));
  canvas.tabIndex = enabled ? 0 : -1;
  updateAgentInterface();
}

async function present(next: GameObservation, selectedGeneration: number): Promise<void> {
  if (selectedGeneration !== selectionGeneration || next.gameCode !== selectedGame.code) return;
  const generation = ++presentationGeneration;
  observation = next;
  loading = false;
  failed = false;
  const url = new URL(window.location.href);
  url.searchParams.set('game', next.gameCode);
  url.searchParams.set('level', String(next.level));
  if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  updateInterface();
  const frames = next.frames.length ? next.frames : [next.frame];
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
  busy = false;
  agent.refresh();
  updateInterface();
  if (next.state === 'WIN' || next.state === 'LEVEL_COMPLETE') element('#game-feedback').textContent = next.level >= next.levelCount ? 'VICTORY' : `Level ${next.level} complete.`;
  else if (next.state === 'GAME_OVER' || next.state === 'GAMEOVER') element('#game-feedback').textContent = 'Game over. Undo or reset to continue.';
}

function showFailure(error: unknown, generation: number): void {
  if (generation !== selectionGeneration) return;
  busy = false;
  loading = false;
  failed = true;
  console.error(`Game operation failed for ${selectedGame.code}.`, error);
  element('#runtime-message').textContent = `Could not load ${selectedGame.code}. Please retry.`;
  element('#game-feedback').textContent = 'The game could not continue. Retry to reload it.';
  updateInterface();
}

async function run(operation: () => Promise<GameObservation>, announcement = '', command?: number): Promise<void> {
  if (!ready() || mode !== 'manual') return;
  const before = observation!;
  agent.invalidate('Manual play changed the observation. Start a fresh experiment when ready.');
  const generation = selectionGeneration;
  busy = true;
  updateInterface();
  try {
    const next = await operation();
    await present(next, generation);
    if (generation === selectionGeneration && mode === 'manual') {
      manualReturns = command === undefined ? [] : recordPublicReturn(manualReturns, `manual:${generation}`, ++manualSequence, command, before, next);
      updateSicPanel();
    }
    if (generation === selectionGeneration && announcement) element('#game-feedback').textContent = announcement;
  } catch (error) {
    showFailure(error, generation);
  }
}

function perform(action: number, data?: { x: number; y: number }): void {
  if (!observation?.availableActionIds.includes(action) || ['WIN', 'LEVEL_COMPLETE', 'GAME_OVER', 'GAMEOVER'].includes(observation.state)) return;
  void run(() => runtime.action(action, data), '', action);
}
function undo(): void {
  if (!observation?.canUndo) return;
  void run(() => runtime.undo(), 'Last action undone.');
}
function reset(): void {
  void run(() => runtime.reset(), 'Level reset.');
}
function restart(): void {
  void run(() => runtime.restart(), 'Game restarted from level 1.');
}
function focusCanvas(): void {
  canvas.focus({ preventScroll: true });
}

function setMode(next: 'manual' | 'agent', focusTab = false): void {
  modeGeneration += 1;
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
  sicPanel.hidden = false;
  agent.refresh();
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}

async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push', level?: number): Promise<void> {
  agent.invalidate('A new game observation is ready for native reasoning.');
  const game = getGameByCode(code) ?? defaultGame!;
  const generation = ++selectionGeneration;
  presentationGeneration += 1;
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
  element('#runtime-message').textContent = 'Loading game…';
  element('#selection-feedback').textContent = `${game.code} selected.`;
  canvas.setAttribute('aria-label', `${game.code} game board. Use the arrow keys, Space, or click to interact.`);
  document.title = `SRA Playground · ${game.code} — Symbolic Reasoning Agent`;
  setMode('manual');
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
element('#agent-step').addEventListener('click', () => { void agent.step(); });
element('#agent-run').addEventListener('click', () => { void agent.run(600); });
element('#agent-batch').addEventListener('click', () => { void agent.run(16); });
element('#agent-pause').addEventListener('click', () => agent.pause());
element('#agent-new-session').addEventListener('click', () => agent.invalidate('New reasoning session. The current game position is preserved.'));
element('#agent-restart').addEventListener('click', () => {
  const generation = selectionGeneration + 1;
  const code = selectedGame.code;
  const load = selectGame(code, 'replace', 1);
  const requestedMode = modeGeneration;
  void load.then(() => {
    if (selectionGeneration === generation && modeGeneration === requestedMode && selectedGame.code === code && ready()) setMode('agent');
  });
});
element('.mode-tabs').addEventListener('keydown', (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setMode(event.key === 'Home' ? 'manual' : event.key === 'End' ? 'agent' : mode === 'manual' ? 'agent' : 'manual', true);
});
canvas.addEventListener('click', (event: MouseEvent) => {
  if (!ready() || mode !== 'manual') return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)));
  const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)));
  perform(6, { x, y });
  focusCanvas();
});
canvas.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (event.ctrlKey || event.metaKey) return;
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    reset();
    return;
  }
  const actions: Record<string, number> = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, ' ': 5 };
  const action = actions[event.key];
  if (action === undefined) return;
  event.preventDefault();
  perform(action);
});
element('#undo-button').addEventListener('click', () => { undo(); focusCanvas(); });
element('#reset-button').addEventListener('click', () => { reset(); focusCanvas(); });
element('#restart-button').addEventListener('click', () => { restart(); focusCanvas(); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => { perform(Number(button.dataset.action)); focusCanvas(); });
}
element<HTMLSelectElement>('#level-select').addEventListener('change', event => {
  const select = event.currentTarget as HTMLSelectElement;
  if (select.disabled || !observation?.canSelectLevel) return;
  const level = Number(select.value);
  void run(() => runtime.selectLevel(level), `Level ${level} selected.`);
});
element('#win-continue').addEventListener('click', () => {
  if (!observation || !ready() || agentState?.busy) return;
  if (mode === 'agent') setMode('manual');
  if (observation.level < observation.levelCount) {
    const level = observation.level + 1;
    void run(() => runtime.selectLevel(level), `Level ${level} selected.`);
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
