import './styles.css';
import { renderSiteHeader } from './site-header';
import { BrowserGameRuntime, type GameObservation } from './runtime/browser-games';
import { AGENT_STATUS } from './runtime/contracts';
import { GAME_CATALOG, getGameByCode, type GameCatalogEntry } from './games/catalog';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
const agentRepo = 'https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan';
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
  official: 'Official ARC-AGI-3',
  custom: 'Custom · Wave 1',
  custom_2: 'Custom · Wave 2',
  custom_3: 'Custom · Wave 3',
};
const defaultGameCode = 'CASC';
const defaultGame = getGameByCode(defaultGameCode);
if (!defaultGame) throw new Error(`The ${defaultGameCode} catalogue entry is missing.`);
let selectedGame: GameCatalogEntry = getGameByCode(new URL(window.location.href).searchParams.get('game') ?? defaultGameCode) ?? defaultGame;
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
        <p class="eyebrow"><span class="status-dot"></span> INTERACTIVE GAMES / INDEPENDENT RESEARCH</p>
        <h1 id="page-title">SRA Playground</h1>
        <p class="hero-agent">Symbolic Reasoning Agent</p>
        <p class="hero-statement">Toward <em>Understandable Intelligence.</em></p>
      </div>
      <div class="intro-art" aria-hidden="true">
        <img src="/game-mosaic.png?v=custom-wave-3" alt="" width="405" height="204" />
        <span class="mosaic-label">CUSTOM GAMES · WAVE 3</span>
      </div>
    </section>

    <aside class="design-premise wrap" aria-labelledby="design-premise-title">
      <h2 id="design-premise-title">DESIGN PREMISE</h2>
      <div>
        <p><strong>The design of artificial intelligence should begin with ethical principles.</strong> Symbolic reasoning makes deliberate design possible through explicit concepts, relations, and reasoning structures rooted in human intelligence. SRA draws its meaning and purpose from this human source, enabling us to take responsibility for the intelligence we build and thereby fulfill the ethical principle that guides its design.</p>
        <a class="text-link" href="/architecture.html#design-rooted-in-human-intelligence">Design, meaning &amp; responsibility ${icon('arrow')}</a>
      </div>
    </aside>

    <section class="playground-section wrap" id="playground" aria-labelledby="playground-title">
      <div class="section-line"><div class="playground-heading-group"><h2 class="playground-heading" id="playground-title">ARC AGI <span>3</span></h2><a class="text-link" href="/arc-agi-3.html">What is ARC-AGI-3? ${icon('arrow')}</a></div><span class="catalog-count">${GAME_CATALOG.length} GAMES<span>/</span>25 OFFICIAL + 75 CUSTOM</span></div>
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
            <button type="button" id="agent-tab" role="tab" aria-selected="false" aria-controls="agent-panel" tabindex="-1">${icon('robot')}SRA Agent<span class="soon-label">Coming next</span></button>
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
              <div class="game-overlay" id="win-overlay" hidden>
                <div class="win-check">${icon('check')}</div><h3 id="win-title">Complete</h3>
                <button class="primary-button" type="button" id="win-continue">Play again ${icon('arrow')}</button>
              </div>
            </div>
          </div>

          <aside class="control-column minimal-control-column">
            <div id="manual-panel" role="tabpanel" aria-labelledby="manual-tab">
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
              <div class="agent-illustration" aria-hidden="true"><span class="node node-a"></span><span class="node node-b"></span><span class="node node-c"></span><span class="node node-d"></span><span class="node-line line-a"></span><span class="node-line line-b"></span><span class="node-line line-c"></span></div>
              <h3>SRA is coming.</h3>
              <p class="agent-honesty">The real agent is not connected yet.</p>
              <button id="return-manual" type="button" class="primary-button">Play manually ${icon('arrow')}</button>
              <a class="text-link" href="${agentRepo}" target="_blank" rel="noopener noreferrer">SRA source ${icon('external')}</a>
            </div>
          </aside>
        </div>

        <footer class="level-explorer minimal-level-explorer" id="level-explorer" hidden>
          <span class="eyebrow">LEVEL</span>
          <div class="level-buttons" id="level-buttons" aria-label="Choose a level"></div>
        </footer>
        <p id="game-feedback" class="sr-only" aria-live="polite"></p>
      </article>
    </section>

    <section class="about-section wrap" id="about" aria-labelledby="about-title">
      <div class="about-heading"><p class="eyebrow">THE PROJECT</p><h2 id="about-title">About SRA</h2><div class="about-links"><a class="text-link" href="/architecture.html">Architecture ${icon('arrow')}</a><a class="text-link" href="/videos.html">Video series ${icon('arrow')}</a></div></div>
      <div class="about-content"><p><strong>Symbolic Reasoning Agent</strong> is Yannick Fontan’s research project for interactive games. The Python agent uses explicit representations of observations, mechanisms, and goals to organize its reasoning.</p><p>The 100 games on this page run locally in your browser. Connecting the agent is the next implementation step. The architecture pages describe the code; the video series follows the project’s development.</p></div>
    </section>
  </main>
  <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Independent research by Yannick Fontan</span><div><a href="https://arcprize.org/arc-agi/3" target="_blank" rel="noopener noreferrer">ARC Prize ${icon('external')}</a><a href="${websiteRepo}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Licenses & notices ${icon('external')}</a></div></footer>
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
let busy = false;
let loading = false;
let failed = false;
let selectionGeneration = 0;
let presentationGeneration = 0;
let renderedLevelCount = 0;
let renderedPalette = '';
let colors: number[][] = [];

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
  const won = observation?.state === 'WIN';
  const lost = observation?.state === 'GAME_OVER' || observation?.state === 'GAMEOVER';
  const available = new Set(observation?.availableActionIds ?? []);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
    button.disabled = !enabled || Boolean(won || lost) || !available.has(Number(button.dataset.action));
  }
  element<HTMLButtonElement>('#undo-button').disabled = !enabled || !observation?.canUndo;
  element<HTMLButtonElement>('#reset-button').disabled = !enabled;
  const levelCount = observation?.canSelectLevel ? observation.levelCount : 0;
  if (levelCount !== renderedLevelCount) {
    renderedLevelCount = levelCount;
    element('#level-buttons').innerHTML = Array.from({ length: levelCount }, (_, index) =>
      `<button type="button" data-level="${index + 1}" aria-label="Choose level ${index + 1}">${String(index + 1).padStart(2, '0')}</button>`,
    ).join('');
  }
  element('#level-explorer').hidden = !observation?.canSelectLevel || levelCount < 2 || loading || failed;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    const current = Number(button.dataset.level) === observation?.level;
    button.classList.toggle('current-level', current);
    button.setAttribute('aria-pressed', String(current));
    button.disabled = !enabled;
  }
  element('#win-overlay').hidden = !enabled || !won;
  element('#win-title').textContent = 'Complete';
  element<HTMLButtonElement>('#win-continue').disabled = !enabled;
  element('#runtime-overlay').hidden = !loading && !failed;
  element('#runtime-spinner').hidden = !loading;
  element<HTMLButtonElement>('#retry-button').hidden = !failed;
  element('#game-availability').textContent = loading ? 'Loading' : failed ? 'Unavailable' : 'Ready';
  element('#game-availability').classList.toggle('is-pending', loading || failed);
  canvas.setAttribute('aria-busy', String(busy || loading));
  canvas.tabIndex = enabled ? 0 : -1;
}

async function present(next: GameObservation, selectedGeneration: number): Promise<void> {
  if (selectedGeneration !== selectionGeneration || next.gameCode !== selectedGame.code) return;
  const generation = ++presentationGeneration;
  observation = next;
  loading = false;
  failed = false;
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
  updateInterface();
  if (next.state === 'WIN') element('#game-feedback').textContent = 'Complete.';
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

async function run(operation: () => Promise<GameObservation>, announcement = ''): Promise<void> {
  if (!ready() || mode !== 'manual') return;
  const generation = selectionGeneration;
  busy = true;
  updateInterface();
  try {
    await present(await operation(), generation);
    if (generation === selectionGeneration && announcement) element('#game-feedback').textContent = announcement;
  } catch (error) {
    showFailure(error, generation);
  }
}

function perform(action: number, data?: { x: number; y: number }): void {
  if (!observation?.availableActionIds.includes(action) || ['WIN', 'GAME_OVER', 'GAMEOVER'].includes(observation.state)) return;
  void run(() => runtime.action(action, data));
}
function undo(): void {
  if (!observation?.canUndo) return;
  void run(() => runtime.undo(), 'Last action undone.');
}
function reset(): void {
  void run(() => runtime.reset(), 'Level reset.');
}
function focusCanvas(): void {
  canvas.focus({ preventScroll: true });
}

function setMode(next: 'manual' | 'agent', focusTab = false): void {
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
  element('#canvas-stage').classList.toggle('agent-preview', !manual);
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}

async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push'): Promise<void> {
  const game = getGameByCode(code) ?? defaultGame!;
  const generation = ++selectionGeneration;
  presentationGeneration += 1;
  selectedGame = game;
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
    if (historyMode === 'replace') window.history.replaceState(null, '', url);
    else if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }
  try {
    await present(await runtime.load(game.code), generation);
  } catch (error) {
    showFailure(error, generation);
  }
}

element<HTMLSelectElement>('#game-select').addEventListener('change', event => {
  void selectGame((event.currentTarget as HTMLSelectElement).value);
});
window.addEventListener('popstate', () => {
  void selectGame(new URL(window.location.href).searchParams.get('game') ?? defaultGameCode, 'none');
});
element('#retry-button').addEventListener('click', () => { void selectGame(selectedGame.code, 'none'); });
element('#manual-tab').addEventListener('click', () => setMode('manual'));
element('#agent-tab').addEventListener('click', () => setMode('agent'));
element('#return-manual').addEventListener('click', () => { setMode('manual'); focusCanvas(); });
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
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => { perform(Number(button.dataset.action)); focusCanvas(); });
}
element('#level-buttons').addEventListener('click', (event: MouseEvent) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
  if (!button || button.disabled || !observation?.canSelectLevel) return;
  const level = Number(button.dataset.level);
  void run(() => runtime.selectLevel(level));
  focusCanvas();
});
element('#win-continue').addEventListener('click', reset);
const fullscreenButton = element<HTMLButtonElement>('#fullscreen-button');
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', () => {
  const operation = document.fullscreenElement ? document.exitFullscreen() : element('#canvas-stage').requestFullscreen();
  void operation.catch(() => { element('#game-feedback').textContent = 'Full-screen mode is not available in this browser window.'; });
});
window.addEventListener('pagehide', event => { if (!event.persisted) runtime.dispose(); });
void selectGame(selectedGame.code, 'replace');
