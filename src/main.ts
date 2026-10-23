import './styles.css';
import { PipesEngine, PALETTE, type PipesObservation } from './games/pipes';
import { AGENT_STATUS } from './runtime/contracts';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
const agentRepo = 'https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan';
const icon = (name: string, cls = ''): string => {
  const paths: Record<string, string> = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M7 17 17 7M7 7h10v10"/>',
    rotate: '<path d="M20 7v5h-5M19 12a7 7 0 1 0-1.7 4.6"/>',
    reset: '<path d="M4 7v5h5M5 12a7 7 0 1 1 1.7 4.6"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
    down: '<path d="m6 10 6 6 6-6"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    expand: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    play: '<path d="m9 5 10 7-10 7V5Z"/>',
    agent: '<path d="M8 8h8v8H8zM12 3v5m0 8v5M3 12h5m8 0h5"/><circle cx="12" cy="3" r="1"/><circle cx="21" cy="12" r="1"/><circle cx="12" cy="21" r="1"/><circle cx="3" cy="12" r="1"/>',
    github: '<path d="M9 19c-4.3 1.3-4.3-2-6-2m12 5v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6.2 0C6.3 3.4 5.3 3.7 5.3 3.7a4.3 4.3 0 0 0-.1 3.3A4.7 4.7 0 0 0 4 10.3c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V22"/>',
  };
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.arrow}</svg>`;
};

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application mount is missing.');
app.innerHTML = `
  <a class="skip-link" href="#game-canvas">Skip to the game</a>
  <header class="site-header wrap">
    <a class="brand" href="#" aria-label="SRA Playground home">
      <svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="8" fill="currentColor"/><path d="M9 11h12v7h-7v7h14" fill="none" stroke="#d2f36c" stroke-width="4"/><circle cx="9" cy="11" r="2.5" fill="#d2f36c"/><circle cx="28" cy="25" r="2.5" fill="#d2f36c"/></svg>
      <span>SRA<span class="brand-divider">/</span><span class="brand-light">Playground</span></span>
    </a>
    <nav aria-label="Main navigation">
      <a class="nav-active" href="#playground">Playground</a>
      <a href="#about">The project</a>
      <a class="source-link" href="${websiteRepo}" target="_blank" rel="noopener noreferrer">${icon('github')}<span>Source code</span>${icon('external', 'small-icon')}</a>
    </nav>
  </header>

  <main>
    <section class="intro wrap" aria-labelledby="page-title">
      <div class="intro-main">
        <p class="eyebrow"><span class="status-dot"></span> SYMBOLIC REASONING, IN PLAY</p>
        <h1 id="page-title">Small worlds.<br>Big <span class="question-word">questions<span class="title-dot">.</span></span></h1>
      </div>
      <div class="intro-copy">
        <p>Every puzzle is a world to understand.<br>Explore the games behind SRA, one discovery at a time.</p>
        <div class="byline"><span class="author-monogram">YF</span><span>A project by <strong>Yannick Fontan</strong></span></div>
      </div>
      <div class="intro-decoration" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    </section>

    <section class="playground-section wrap" id="playground" aria-labelledby="game-title">
      <div class="section-line"><span class="eyebrow">THE PLAYGROUND</span><span class="catalog-count">01 game available <span>/</span> more worlds ahead</span></div>
      <article class="player">
        <header class="player-header">
          <div class="game-identity">
            <div class="pipe-emblem" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M9 10h13v12h10M22 22v10" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="9" cy="10" r="4" fill="currentColor"/><circle cx="32" cy="22" r="4" fill="currentColor"/></svg></div>
            <div><div class="game-title-row"><h2 id="game-title">Pipes</h2><span class="game-code">PIPE</span></div><p>Rotation. Connection. One complete network.</p></div>
          </div>
          <div class="game-tags"><span>6 levels</span><span>Logic puzzle</span></div>
        </header>

        <div class="mode-bar">
          <div class="mode-tabs" role="tablist" aria-label="Play mode">
            <button type="button" id="manual-tab" role="tab" aria-selected="true" aria-controls="manual-panel" tabindex="0">${icon('play')}Manual</button>
            <button type="button" id="agent-tab" role="tab" aria-selected="false" aria-controls="agent-panel" tabindex="-1">${icon('agent')}SRA Agent<span class="soon-label">Coming next</span></button>
          </div>
          <span class="local-label"><span class="status-dot"></span> Runs in your browser</span>
        </div>

        <div class="play-area">
          <div class="board-column">
            <div class="board-meta"><span id="session-kind">CAMPAIGN</span><button id="fullscreen-button" class="icon-button" type="button" aria-label="Expand game board" title="Expand game board">${icon('expand')}</button></div>
            <div class="canvas-stage" id="canvas-stage">
              <canvas id="game-canvas" width="64" height="64" tabindex="0" role="application" aria-label="Pipes puzzle. Use the arrow keys to select a pipe, then Space to rotate. Click or tap a pipe to rotate it." aria-describedby="keyboard-help">Your browser must support canvas to play Pipes.</canvas>
              <div class="game-overlay" id="win-overlay" hidden><div class="win-check">${icon('check')}</div><p class="eyebrow" id="win-eyebrow">LEVEL COMPLETE</p><h3 id="win-title">Everything connects.</h3><p id="win-copy">A single network. No leaks. No loops.</p><button class="primary-button" type="button" id="win-continue">Play again ${icon('arrow')}</button></div>
              <div class="agent-board-label" id="agent-board-label" hidden>${icon('agent')} SRA integration in progress</div>
            </div>
            <div class="board-caption"><span><span class="source-dot"></span> Blue is your source</span><span>64 × 64</span></div>
            <p class="game-feedback" id="game-feedback" aria-live="polite">Click a pipe. Turn a possibility into a connection.</p>
          </div>

          <aside class="control-column">
            <div id="manual-panel" role="tabpanel" aria-labelledby="manual-tab">
              <div class="level-heading"><span class="eyebrow" id="level-number">LEVEL 01 / 06</span><span id="practice-label" class="practice-label" hidden>Practice</span></div>
              <h3 id="level-title">First connection</h3>
              <p class="game-goal">Rotate the pipes to connect every cell to the blue source, with no leaks or loops.</p>
              <div class="supply-status"><div><span>Connected to source</span><strong id="connected-count">1 <span>/ 9</span></strong></div><div class="supply-track" aria-hidden="true"><div id="supply-fill"></div></div></div>
              <dl class="game-stats"><div><dt>Rotations</dt><dd id="moves-count">0</dd></div><div><dt>Leaks</dt><dd id="leaks-count">0</dd></div><div><dt>Loops</dt><dd id="cycles-count">0</dd></div></dl>
              <div class="main-controls"><button type="button" id="rotate-button" class="primary-button">${icon('rotate')}Rotate pipe <kbd>Space</kbd></button><button type="button" id="restart-button" class="secondary-button">${icon('reset')}Restart level<kbd>R</kbd></button></div>
              <div class="direction-controls"><div class="d-pad" aria-label="Move pipe selection"><button type="button" data-action="1" class="direction-up" aria-label="Select pipe above">${icon('up')}</button><button type="button" data-action="3" class="direction-left" aria-label="Select pipe to the left">${icon('left')}</button><span class="d-pad-center" aria-hidden="true"></span><button type="button" data-action="4" class="direction-right" aria-label="Select pipe to the right">${icon('right')}</button><button type="button" data-action="2" class="direction-down" aria-label="Select pipe below">${icon('down')}</button></div><p id="keyboard-help">Arrow keys to select.<br>Space to rotate.<br>Or just click a pipe.</p></div>
            </div>
            <div id="agent-panel" role="tabpanel" aria-labelledby="agent-tab" data-agent-status="${AGENT_STATUS.status}" data-agent-available="${AGENT_STATUS.available}" hidden>
              <span class="eyebrow agent-status"><span class="status-dot"></span> NEXT CHAPTER</span>
              <div class="agent-illustration" aria-hidden="true"><span class="node node-a"></span><span class="node node-b"></span><span class="node node-c"></span><span class="node node-d"></span><span class="node-line line-a"></span><span class="node-line line-b"></span><span class="node-line line-c"></span></div>
              <h3>Meet your future<br>puzzle partner.</h3>
              <p class="game-goal">SRA is being brought to the browser. Its job: observe the world, discover how it works, and compose a path forward.</p>
              <p class="agent-honesty">The agent is not connected in this release. Manual play is ready to explore.</p>
              <button id="return-manual" type="button" class="primary-button">Play it yourself ${icon('arrow')}</button>
              <a class="text-link" href="${agentRepo}" target="_blank" rel="noopener noreferrer">Explore the SRA project ${icon('external')}</a>
            </div>
          </aside>
        </div>

        <footer class="level-explorer"><div><span class="eyebrow">EXPLORE A LEVEL</span><span class="practice-note">Jump in for a practice round</span></div><div class="level-buttons" aria-label="Practice a level">${Array.from({ length: 6 }, (_, i) => `<button type="button" data-level="${i + 1}" aria-label="Practice level ${i + 1}"><span>${String(i + 1).padStart(2, '0')}</span><span class="level-complete-mark" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div><button type="button" id="campaign-button" class="campaign-button">New campaign ${icon('arrow')}</button></footer>
      </article>
    </section>

    <section class="about-section wrap" id="about" aria-labelledby="about-title">
      <div class="about-heading"><p class="eyebrow">BEHIND THE PLAYGROUND</p><h2 id="about-title">A place to play.<br>A way to study reasoning.</h2><a class="text-link" href="${agentRepo}" target="_blank" rel="noopener noreferrer">Inside the SRA project ${icon('external')}</a></div>
      <div class="about-content"><p>SRA stands for <strong>Symbolic Reasoning Agent</strong>. This playground brings Yannick Fontan’s games together with his exploration of how an agent can discover mechanisms, connect knowledge, and pursue a goal.</p><p>Start by playing. The next step is to bring the agent alongside you, with the game and its reasoning running in your browser.</p><div class="reasoning-flow" aria-label="The intended reasoning loop: observe, discover, compose, act"><span><b>01</b>Observe</span><span><b>02</b>Discover</span><span><b>03</b>Compose</span><span><b>04</b>Act</span></div></div>
    </section>
  </main>
  <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Yannick Fontan · 2026</span><div><span class="release-label">First playable release</span><a href="${websiteRepo}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT license ${icon('external')}</a></div></footer>
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
const imageData = context.createImageData(64, 64);
const colors = PALETTE.map((hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]);
const engine = new PipesEngine();
let observation: PipesObservation = engine.observe();
let mode: 'manual' | 'agent' = 'manual';
let busy = false;
let animationGeneration = 0;

function paint(frame: readonly (readonly number[])[]): void {
  if (!context) return;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const color = colors[frame[y]?.[x] ?? 4] ?? colors[4]!;
      const offset = (y * 64 + x) * 4;
      imageData.data[offset] = color[0]!;
      imageData.data[offset + 1] = color[1]!;
      imageData.data[offset + 2] = color[2]!;
      imageData.data[offset + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function updateInterface(): void {
  element('#level-number').textContent = `LEVEL ${String(observation.level).padStart(2, '0')} / 06`;
  element('#level-title').textContent = observation.level_name;
  element('#moves-count').textContent = String(observation.moves);
  element('#leaks-count').textContent = String(observation.leak_count);
  element('#cycles-count').textContent = String(observation.cycle_count);
  element('#connected-count').innerHTML = `${observation.connected} <span>/ ${observation.total}</span>`;
  element('#supply-fill').style.width = `${(observation.connected / observation.total) * 100}%`;
  element('#session-kind').textContent = observation.test_mode ? 'PRACTICE' : 'CAMPAIGN';
  element('#practice-label').hidden = !observation.test_mode;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
    const level = Number(button.dataset.level);
    button.classList.toggle('current-level', level === observation.level);
    button.classList.toggle('completed-level', Boolean(observation.completed[level - 1]));
    button.setAttribute('aria-pressed', String(level === observation.level));
    button.disabled = mode !== 'manual' || busy;
  }
  const won = observation.state === 'WIN';
  element('#win-overlay').hidden = !won || busy || mode !== 'manual';
  element('#win-eyebrow').textContent = observation.test_mode ? 'LEVEL COMPLETE' : 'CAMPAIGN COMPLETE';
  element('#win-title').textContent = observation.test_mode ? 'Everything connects.' : 'Six worlds. All connected.';
  element('#win-copy').textContent = observation.test_mode ? 'A single network. No leaks. No loops.' : 'You brought every pipe into the flow.';
  element('#win-continue').innerHTML = `${observation.test_mode && observation.level < 6 ? 'Try the next level' : 'Play again'} ${icon('arrow')}`;
  element<HTMLButtonElement>('#rotate-button').disabled = won || busy || mode !== 'manual';
  element<HTMLButtonElement>('#restart-button').disabled = busy || mode !== 'manual';
  element<HTMLButtonElement>('#campaign-button').disabled = busy || mode !== 'manual';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) button.disabled = won || busy || mode !== 'manual';
  canvas.setAttribute('aria-busy', String(busy));
  canvas.tabIndex = mode === 'manual' ? 0 : -1;
}

async function present(next: PipesObservation, initialMessage?: string): Promise<void> {
  const generation = ++animationGeneration;
  observation = next;
  busy = next.frames.length > 1;
  updateInterface();
  if (initialMessage) element('#game-feedback').textContent = initialMessage;
  const frames = next.frames.length ? next.frames : [next.frame];
  for (let i = 0; i < frames.length; i += 1) {
    if (generation !== animationGeneration) return;
    paint(frames[i]!);
    if (frames.length > 1 && i < frames.length - 1) await new Promise<void>((resolve) => window.setTimeout(resolve, 1000 / next.default_fps));
  }
  if (generation !== animationGeneration) return;
  busy = false;
  updateInterface();
  if (next.event === 'success') {
    element('#game-feedback').textContent = `Level ${next.played_level} complete. A new network awaits.`;
  } else if (next.event === 'win') {
    element('#game-feedback').textContent = next.test_mode ? 'Level complete. Every pipe is connected.' : 'Campaign complete. All six levels solved.';
  } else if (!initialMessage && next.event !== 'ignored') {
    element('#game-feedback').textContent = next.selected_cell ? 'Selected pipe outlined in white. Space to rotate.' : 'Click a pipe. Turn a possibility into a connection.';
  }
}

function perform(action: number, data?: { x: number; y: number }): void {
  if (mode !== 'manual' || busy) return;
  void present(engine.action(action, data));
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
  element('#agent-board-label').hidden = manual;
  element('#canvas-stage').classList.toggle('agent-preview', !manual);
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}

element('#manual-tab').addEventListener('click', () => setMode('manual'));
element('#agent-tab').addEventListener('click', () => setMode('agent'));
element('#return-manual').addEventListener('click', () => { setMode('manual'); canvas.focus({ preventScroll: true }); });
element('.mode-tabs').addEventListener('keydown', (event: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  setMode(event.key === 'Home' ? 'manual' : event.key === 'End' ? 'agent' : mode === 'manual' ? 'agent' : 'manual', true);
});

canvas.addEventListener('click', (event: MouseEvent) => {
  if (mode !== 'manual' || busy) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * 64);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * 64);
  perform(6, { x, y });
  canvas.focus({ preventScroll: true });
});
canvas.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const actions: Record<string, number> = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 3, ArrowRight: 4, ' ': 5, r: 7, R: 7 };
  const action = actions[event.key];
  if (action === undefined) return;
  event.preventDefault();
  perform(action);
});
element('#rotate-button').addEventListener('click', () => { perform(5); canvas.focus({ preventScroll: true }); });
element('#restart-button').addEventListener('click', () => { if (mode !== 'manual' || busy) return; void present(engine.level_reset(), 'Fresh pipes. A new way through.'); canvas.focus({ preventScroll: true }); });
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action]')) {
  button.addEventListener('click', () => { perform(Number(button.dataset.action)); canvas.focus({ preventScroll: true }); });
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-level]')) {
  button.addEventListener('click', () => {
    if (mode !== 'manual' || busy) return;
    const level = Number(button.dataset.level);
    void present(engine.jump_to_level(level), `Practice level ${level}. Campaign progress starts fresh when you choose New campaign.`);
    canvas.focus({ preventScroll: true });
  });
}
element('#campaign-button').addEventListener('click', () => { if (mode !== 'manual' || busy) return; void present(engine.reset(), 'A fresh campaign. Six networks to discover.'); canvas.focus({ preventScroll: true }); });
element('#win-continue').addEventListener('click', () => {
  if (mode !== 'manual' || busy) return;
  void present(observation.test_mode && observation.level < 6 ? engine.jump_to_level(observation.level + 1) : engine.reset());
  canvas.focus({ preventScroll: true });
});
const fullscreenButton = element<HTMLButtonElement>('#fullscreen-button');
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', () => {
  const operation = document.fullscreenElement ? document.exitFullscreen() : element('#canvas-stage').requestFullscreen();
  void operation.catch(() => { element('#game-feedback').textContent = 'Full-screen mode is not available in this browser window.'; });
});

paint(observation.frame);
updateInterface();
