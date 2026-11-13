from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAIN = ROOT / "src/main.ts"
CONTRACTS = ROOT / "src/runtime/contracts.ts"
TEST = ROOT / "tests/main-agent-mode-controller-integration.test.ts"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


main = MAIN.read_text()
if "const agentModeController = new V6AgentModeController" not in main:
    main = replace_once(
        main,
        "import { AGENT_STATUS } from './runtime/contracts';\n",
        "import { AGENT_STATUS } from './runtime/contracts';\n"
        "import { createPublicSingleActionBrowserCampaignHost } from './runtime/v6-browser-common-campaign-host';\n"
        "import {\n"
        "  V6AgentModeController,\n"
        "  isTerminalGameObservation,\n"
        "  type AgentModeRunResult,\n"
        "} from './runtime/v6-agent-mode-controller';\n",
        "Agent controller imports",
    )
    main = replace_once(
        main,
        "${icon('robot')}SRA Agent<span class=\"soon-label\">Coming next</span>",
        "${icon('robot')}SRA Agent<span class=\"soon-label\">Bounded preview</span>",
        "Agent tab label",
    )
    main = replace_once(
        main,
        """            <div id=\"agent-panel\" role=\"tabpanel\" aria-labelledby=\"agent-tab\" data-agent-status=\"${AGENT_STATUS.status}\" data-agent-available=\"${AGENT_STATUS.available}\" hidden>
              <div class=\"agent-illustration\" aria-hidden=\"true\"><span class=\"node node-a\"></span><span class=\"node node-b\"></span><span class=\"node node-c\"></span><span class=\"node node-d\"></span><span class=\"node-line line-a\"></span><span class=\"node-line line-b\"></span><span class=\"node-line line-c\"></span></div>
              <h3>SRA is coming.</h3>
              <p class=\"agent-honesty\">The real agent is not connected yet.</p>
              <button id=\"return-manual\" type=\"button\" class=\"primary-button\">Play manually ${icon('arrow')}</button>
              <a class=\"text-link\" href=\"${agentSources}\" target=\"_blank\" rel=\"noopener noreferrer\">SRA source references ${icon('external')}</a>
            </div>""",
        """            <div id=\"agent-panel\" role=\"tabpanel\" aria-labelledby=\"agent-tab\" data-agent-status=\"${AGENT_STATUS.status}\" data-agent-available=\"${AGENT_STATUS.available}\" hidden>
              <div class=\"agent-illustration\" aria-hidden=\"true\"><span class=\"node node-a\"></span><span class=\"node node-b\"></span><span class=\"node node-c\"></span><span class=\"node node-d\"></span><span class=\"node-line line-a\"></span><span class=\"node-line line-b\"></span><span class=\"node-line line-c\"></span></div>
              <h3>Bounded SRA runtime</h3>
              <p class=\"agent-honesty\">This public OP28 preview runs only when one simple action is uniquely available. It stops instead of guessing.</p>
              <p id=\"agent-runtime-status\" class=\"agent-honesty\" role=\"status\" aria-live=\"polite\">Ready to run a bounded local campaign.</p>
              <button id=\"run-agent\" type=\"button\" class=\"primary-button\">Run bounded agent ${icon('arrow')}</button>
              <button id=\"return-manual\" type=\"button\" class=\"secondary-button\">Stop and play manually</button>
              <a class=\"text-link\" href=\"${agentSources}\" target=\"_blank\" rel=\"noopener noreferrer\">SRA source references ${icon('external')}</a>
            </div>""",
        "Agent panel",
    )
    main = replace_once(
        main,
        """const runtime = new BrowserGameRuntime();
let observation: GameObservation | null = null;""",
        """const runtime = new BrowserGameRuntime();
const agentModeController = new V6AgentModeController({
  seam: 'browser-common-campaign',
  host: createPublicSingleActionBrowserCampaignHost(),
  maxSteps: 64,
});
let agentSessionCounter = 0;
let observation: GameObservation | null = null;""",
        "Agent controller construction",
    )
    main = replace_once(
        main,
        """  canvas.setAttribute('aria-busy', String(busy || loading));
  canvas.tabIndex = enabled ? 0 : -1;
}""",
        """  canvas.setAttribute('aria-busy', String(busy || loading));
  canvas.tabIndex = enabled ? 0 : -1;
  element<HTMLButtonElement>('#run-agent').disabled = mode !== 'agent'
    || !ready()
    || isTerminalGameObservation(observation)
    || agentModeController.running;
}""",
        "Agent run readiness",
    )
    main = replace_once(
        main,
        """function showFailure(error: unknown, generation: number): void {
  if (generation !== selectionGeneration) return;
  busy = false;
  loading = false;
  failed = true;
  console.error(`Game operation failed for ${selectedGame.code}.`, error);
  element('#runtime-message').textContent = `Could not load ${selectedGame.code}. Please retry.`;
  element('#game-feedback').textContent = 'The game could not continue. Retry to reload it.';
  updateInterface();
}

async function run(operation: () => Promise<GameObservation>, announcement = ''): Promise<void> {""",
        """function showFailure(error: unknown, generation: number): void {
  if (generation !== selectionGeneration) return;
  busy = false;
  loading = false;
  failed = true;
  console.error(`Game operation failed for ${selectedGame.code}.`, error);
  element('#runtime-message').textContent = `Could not load ${selectedGame.code}. Please retry.`;
  element('#game-feedback').textContent = 'The game could not continue. Retry to reload it.';
  updateInterface();
}

function setAgentStatus(message: string): void {
  element('#agent-runtime-status').textContent = message;
}

function describeAgentResult(result: AgentModeRunResult): string {
  const actions = `${result.steps} ${result.steps === 1 ? 'action' : 'actions'}`;
  switch (result.reason) {
    case 'complete': return `Agent stopped after ${actions}: the game reports completion.`;
    case 'game-over': return `Agent stopped after ${actions}: the game reports game over.`;
    case 'none': return `Stopped safely after ${actions}: no symbolic owner proposed an action.`;
    case 'ambiguous': return `Stopped safely after ${actions}: several proposals remain ambiguous.`;
    case 'blocked': return `Stopped safely after ${actions}: the Logos authority blocked the proposal.`;
    case 'max-steps': return `Stopped at the hard bound of ${actions}.`;
    case 'dispatch-rejected': return `Stopped after ${actions}: the product rejected the action.`;
    case 'stale': return `Stopped after ${actions}: the game selection changed.`;
    case 'product-not-ready': return 'Waiting: the game is not ready for an Agent action.';
    case 'stale-product-observation': return 'Waiting: the visible observation is no longer current.';
    case 'pending': return 'Waiting: the previous action still owns its return.';
    case 'error': return `Stopped after ${actions}: the Agent seam reported an error.`;
    case 'manual': return 'Agent stopped. Manual mode owns the game.';
    case 'game-change': return 'Agent stopped because another game or level was selected.';
    default: return `Agent stopped after ${actions} without inventing a fallback action.`;
  }
}

async function runAgent(): Promise<void> {
  if (mode !== 'agent' || !observation || !ready()) return;
  if (isTerminalGameObservation(observation)) {
    setAgentStatus('The current game state is terminal. No Agent action is requested.');
    updateInterface();
    return;
  }

  const generation = selectionGeneration;
  const sessionId = `browser-agent:${selectedGame.code}:${generation}:${++agentSessionCounter}`;
  try {
    agentModeController.begin({ sessionId, observation });
  } catch (error) {
    console.error('Agent session could not start.', error);
    setAgentStatus('The public observation cannot start an Agent session.');
    updateInterface();
    return;
  }

  setAgentStatus('Agent running locally with one explicit campaign owner.');
  updateInterface();
  const result = await agentModeController.runUntilStop({
    state: productReadinessState,
    ports: {
      action: (action, data) => runtime.action(action, data),
      present: (next, nextGeneration) => present(next, nextGeneration, false),
      now: () => performance.now(),
      generation: () => selectionGeneration,
      setBusy: value => {
        busy = value;
        updateInterface();
      },
      onError: (error, errorGeneration) => showFailure(error, errorGeneration),
    },
  });

  if (generation !== selectionGeneration || mode !== 'agent') return;
  setAgentStatus(describeAgentResult(result));
  updateInterface();
}

async function run(operation: () => Promise<GameObservation>, announcement = ''): Promise<void> {""",
        "Agent run functions",
    )
    main = replace_once(
        main,
        """function setMode(next: 'manual' | 'agent', focusTab = false): void {
  mode = next;
  const manual = next === 'manual';""",
        """function setMode(next: 'manual' | 'agent', focusTab = false): void {
  if (mode === 'agent' && next === 'manual') {
    agentModeController.stop('manual');
    setAgentStatus('Agent stopped. Manual mode owns the game.');
  }
  mode = next;
  const manual = next === 'manual';""",
        "Manual ownership transition",
    )
    main = replace_once(
        main,
        """  element('#canvas-stage').classList.toggle('agent-preview', !manual);
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}""",
        """  element('#canvas-stage').classList.toggle('agent-preview', !manual);
  if (!manual && !agentModeController.running) {
    setAgentStatus(isTerminalGameObservation(observation)
      ? 'The current game state is terminal. No Agent action is requested.'
      : 'Ready to run the bounded public OP28 campaign.');
  }
  updateInterface();
  if (focusTab) (manual ? manualTab : agentTab).focus();
}""",
        "Agent mode status",
    )
    main = replace_once(
        main,
        """async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push', level?: number): Promise<void> {
  const game = getGameByCode(code) ?? defaultGame!;""",
        """async function selectGame(code: string, historyMode: 'push' | 'replace' | 'none' = 'push', level?: number): Promise<void> {
  agentModeController.stop('game-change');
  setAgentStatus('Load the game, then choose Agent mode to start a bounded campaign.');
  const game = getGameByCode(code) ?? defaultGame!;""",
        "Game selection ownership",
    )
    main = replace_once(
        main,
        """element('#manual-tab').addEventListener('click', () => setMode('manual'));
element('#agent-tab').addEventListener('click', () => setMode('agent'));
element('#return-manual').addEventListener('click', () => { setMode('manual'); focusCanvas(); });""",
        """element('#manual-tab').addEventListener('click', () => setMode('manual'));
element('#agent-tab').addEventListener('click', () => setMode('agent'));
element('#run-agent').addEventListener('click', () => { void runAgent(); });
element('#return-manual').addEventListener('click', () => { setMode('manual'); focusCanvas(); });""",
        "Agent run event",
    )
    main = replace_once(
        main,
        """window.addEventListener('pagehide', event => { if (!event.persisted) runtime.dispose(); });""",
        """window.addEventListener('pagehide', event => {
  if (!event.persisted) {
    agentModeController.dispose();
    runtime.dispose();
  }
});""",
        "Agent disposal",
    )
    main = replace_once(
        main,
        "Connecting the agent is the next implementation step. The architecture pages describe the code; the video series follows the project’s development.",
        "A bounded public OP28 Agent controller is now connected as an explicit preview. Broader symbolic producers remain under reconstruction; the architecture pages describe the code and limits.",
        "About Agent status",
    )
    MAIN.write_text(main)

contracts = CONTRACTS.read_text()
contracts = contracts.replace(
    """export const AGENT_STATUS = {
  available: false,
  status: 'port-pending',
} as const;""",
    """export const AGENT_STATUS = {
  available: true,
  status: 'browser-common-campaign-op28-preview',
} as const;""",
)
CONTRACTS.write_text(contracts)

TEST.write_text("""import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const contracts = readFileSync(new URL('../src/runtime/contracts.ts', import.meta.url), 'utf8');

test('main selects exactly one explicit browser Agent seam', () => {
  assert.match(main, /createPublicSingleActionBrowserCampaignHost/);
  assert.match(main, /new V6AgentModeController\\(\\{/);
  assert.match(main, /seam: 'browser-common-campaign'/);
  assert.match(main, /host: createPublicSingleActionBrowserCampaignHost\\(\\)/);
  assert.doesNotMatch(main, /V6CommonCampaignDecisionPort|v6-agent-worker/);
});

test('Agent campaign starts only from the explicit Agent control', () => {
  assert.match(main, /id=\\"run-agent\\"/);
  assert.match(main, /#run-agent'\\)\\.addEventListener\\('click', \\(\\) => \\{ void runAgent\\(\\); \\}\\)/);
  assert.match(main, /if \\(mode !== 'agent' \\|\\| !observation \\|\\| !ready\\(\\)\\) return/);
  assert.match(main, /agentModeController\\.runUntilStop\\(\\{/);
  const setMode = main.slice(main.indexOf('function setMode'), main.indexOf('async function selectGame'));
  assert.doesNotMatch(setMode, /runAgent\\(/);
});

test('Manual and game-selection ownership cancel the Agent without sharing a loop', () => {
  assert.match(main, /agentModeController\\.stop\\('manual'\\)/);
  assert.match(main, /agentModeController\\.stop\\('game-change'\\)/);
  assert.match(main, /if \\(!ready\\(\\) \\|\\| mode !== 'manual'\\) return/);
  assert.match(main, /dispatchProductAction\\(state, action, data/);
});

test('Agent availability is honest about the bounded OP28 preview', () => {
  assert.match(contracts, /available: true/);
  assert.match(contracts, /browser-common-campaign-op28-preview/);
  assert.match(main, /stops instead of guessing/);
  assert.match(main, /no symbolic owner proposed an action/);
});
""")
