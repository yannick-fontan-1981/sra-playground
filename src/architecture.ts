import './styles.css';
import './architecture.css';
import { renderSiteHeader } from './site-header';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
const agentRepo = 'https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan';
const sourceCommit = '212d8d426f07eea2b6797c2bb647545767488a96';
const sourceBase = `${agentRepo}/blob/${sourceCommit}/agents/yf_arc3_v5/`;
const external = '<svg class="icon small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const arrow = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const source = (path: string, label: string): string => `<a class="arch-source" href="${sourceBase}${path}" target="_blank" rel="noopener noreferrer">${label}${external}</a>`;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application mount is missing.');

app.innerHTML = `
  <a class="skip-link" href="#architecture-content">Skip to architecture</a>
  ${renderSiteHeader('architecture')}

  <main class="architecture-page" id="architecture-content">
    <section class="arch-hero wrap" aria-labelledby="architecture-title">
      <div>
        <p class="eyebrow"><span class="status-dot"></span> SRA / ARCHITECTURE</p>
        <h1 id="architecture-title">Toward<br><em>Understandable<br class="arch-title-break"> Intelligence</em><span class="title-dot">.</span></h1>
      </div>
      <div class="arch-hero-copy">
        <p>An observation becomes useful when it changes what an agent can do—and helps it return to the goal that made the discovery matter.</p>
        <p class="arch-hero-small">SRA explores that connection through explicit concepts, relations, mechanisms, and executable reasoning.</p>
        <a class="text-link" href="#reasoning-loop">Follow the reasoning loop ${arrow}</a>
      </div>
    </section>

    <div class="arch-status wrap">
      <span class="arch-status-label">READING THIS PAGE</span>
      <p>The architecture below describes the <strong>Python V5 source</strong>. The Playground executes <strong>100 game engines locally in your browser</strong>; connecting the real SRA agent is the next stage.</p>
      <a href="#browser">Implementation status ${arrow}</a>
    </div>

    <nav class="arch-toc wrap" aria-label="On this page">
      <a href="#intent"><span>01</span> The idea</a>
      <a href="#system"><span>02</span> The system</a>
      <a href="#reasoning-loop"><span>03</span> The loop</a>
      <a href="#example"><span>04</span> An example</a>
      <a href="#browser"><span>05</span> The browser</a>
    </nav>

    <section class="arch-section wrap arch-intent" id="intent" aria-labelledby="intent-title">
      <div class="arch-section-heading"><p class="eyebrow">01 / THE RESEARCH QUESTION</p><h2 id="intent-title">From recognizing a pattern<br>to understanding a possibility.</h2></div>
      <div class="arch-prose">
        <p>SRA—<strong>Symbolic Reasoning Agent</strong>—is Yannick Fontan’s exploration of intelligence whose reasoning can be inspected. Interactive games provide small worlds where actions have consequences, information is incomplete, and useful knowledge must survive a change of situation.</p>
        <p>The central question is operational: <em>what does this discovery allow me to do, under which conditions, and for which goal?</em> A meaningful representation connects an object or event to its role, its dependencies, the evidence supporting it, and the consequences it may enable.</p>
        <p>That ambition needs more than a vocabulary. It needs a way to revise claims, compose available mechanisms, test an expectation, and reconnect the result to an unfinished intention. The architecture makes those responsibilities explicit.</p>
      </div>
    </section>

    <section class="arch-section wrap" id="system" aria-labelledby="system-title">
      <div class="arch-section-heading arch-heading-row"><div><p class="eyebrow">02 / THE SYSTEM</p><h2 id="system-title">Four responsibilities.<br>One accountable action.</h2></div><p class="arch-heading-aside">Represent what is known.<br>Declare how it can be used.<br>Make the next decision traceable.</p></div>
      <div class="arch-layers">
        <article class="arch-layer">
          <div class="arch-layer-top"><span class="arch-layer-index">01</span><span class="arch-layer-kind">REPRESENTATION</span></div>
          <h3>Logos</h3><p class="arch-layer-question">What exactly is being claimed?</p>
          <p>Typed terms, claims, goals, intentions, and records give reasoning a shared structure. A claim carries its relation, arguments, conditions, evidence, epistemic status, and possible contradictions. Its validity can be tied to a state revision.</p>
          ${source('logos/claims.py', 'Claim contract')}
        </article>
        <article class="arch-layer">
          <div class="arch-layer-top"><span class="arch-layer-index">02</span><span class="arch-layer-kind">DECLARATIVE KNOWLEDGE</span></div>
          <h3>DRM</h3><p class="arch-layer-question">When is this reasoning applicable?</p>
          <p>Declarations express principles, applicability conditions, expected effects, dependencies, and falsifiers. The registry and runtime make these declarations available to reasoning. The system starts with authored structures and rules; experience must ground their application.</p>
          ${source('drm/knowledge.py', 'Declared knowledge graph')}
        </article>
        <article class="arch-layer">
          <div class="arch-layer-top"><span class="arch-layer-index">03</span><span class="arch-layer-kind">ORCHESTRATION</span></div>
          <h3>SRC</h3><p class="arch-layer-question">Which reasoning step comes next?</p>
          <p>Symbolic Reasoning Code expresses workflows with explicit calls, selections, branches, waits, and outcomes. A source-visible action cycle checks grounding and release, executes an action, waits for the returned frame, and observes the result.</p>
          ${source('src/core/released_action_cycle.src', 'Source action cycle')}
        </article>
        <article class="arch-layer">
          <div class="arch-layer-top"><span class="arch-layer-index">04</span><span class="arch-layer-kind">EXECUTION</span></div>
          <h3>Python runtime</h3><p class="arch-layer-question">Can this step execute here, now?</p>
          <p>The controller, scheduler, capabilities, and environment adapters perform computation and carry state between observations. The agent bridge routes normal actions through the runtime and its ActionBoundary, with the current frame and source release checked before dispatch.</p>
          ${source('agent.py', 'Agent entry point')}
        </article>
      </div>

      <div class="arch-knowledge">
        <div><p class="eyebrow">A RELATIONAL MODEL OF MEANING</p><h3>Keep the connection<br>between “known” and “useful.”</h3></div>
        <div class="arch-prose">
          <p>The source already contains explicit relational structures. Claims link arguments to predicates and evidence. The goal frontier records parent, prerequisite, alternative, and conflicting goals, with supporting claims and dependency snapshots. An undeclared relationship remains <strong>unknown</strong>.</p>
          <p>A context stack preserves the active path through those goals, including the parent intention, local justification, and returned child result. This supports a crucial distinction: learning something, receiving a result, and making progress on the parent goal are separate events.</p>
          <div class="arch-source-row">${source('logos/goal_frontier.py', 'Goal frontier')}${source('scheduler/reasoning_context_stack.py', 'Reasoning context stack')}</div>
        </div>
      </div>
    </section>

    <section class="arch-section wrap" id="reasoning-loop" aria-labelledby="loop-title">
      <div class="arch-section-heading"><p class="eyebrow">03 / DISCOVERY → POSSIBILITY → CONTINUATION</p><h2 id="loop-title">The behavior-tree-loop.</h2><p class="arch-section-lead">A conceptual view of the source workflows: keep a goal alive while exploring what could make it achievable.</p></div>
      <figure class="arch-loop-figure" aria-labelledby="loop-caption">
        <div class="arch-loop-context"><span class="status-dot"></span><span><strong>Parent goal retained</strong><span class="arch-context-detail"> · current context, dependencies, and constraints</span></span><span class="arch-context-tag">ACROSS THE LOOP</span></div>
        <div class="arch-loop-grid">
          <div class="arch-loop-return" aria-hidden="true"></div>
          <div class="arch-loop-node"><span>01 / OBSERVE</span><h3>Acquire the change</h3><p>Public frame, available actions,<br>measured differences.</p></div>
          <div class="arch-loop-node"><span>02 / RELATE</span><h3>Qualify the discovery</h3><p>Evidence, claims, uncertainty,<br>and a question worth answering.</p></div>
          <div class="arch-loop-node"><span>03 / COMPOSE</span><h3>Build a possible next step</h3><p>Requirements, reusable components,<br>expected effects, and bounds.</p></div>
          <div class="arch-loop-node arch-loop-action"><span>04 / ACT</span><h3>Pass the release gate</h3><p>Grounding, current context,<br>parent continuity, and viability.</p></div>
          <div class="arch-loop-node"><span>05 / RECONCILE</span><h3>Check what happened</h3><p>Consume the returned result.<br>Compare evidence with expectation.</p></div>
          <div class="arch-loop-node"><span>06 / RESUME</span><h3>Revisit the parent goal</h3><p>Continue, revise, ask a new question,<br>or defer with a reason.</p></div>
        </div>
        <figcaption id="loop-caption">Conceptual control flow, simplified for explanation. The implementation uses SRC workflows and typed state; this diagram does not claim a single, completed generic behavior-tree engine.</figcaption>
      </figure>

      <div class="arch-loop-explanation">
        <div class="arch-prose"><h3>A discovery must have a recipient.</h3><p>A child investigation should return to the question and parent context that opened it. The continuation workflow distinguishes completed, blocked, failed, and deferred returns, checks whether a receipt has already been consumed, and examines remaining reasoning options.</p><p>Its result may reopen reasoning or preserve the current goal frontier. Receiving information does not itself authorize an action.</p>${source('src/arc3/continue_after_information_probe.src', 'Continuation after an information probe')}</div>
        <div class="arch-prose"><h3>A possibility must survive its conditions.</h3><p>Dynamic composition materializes declared combinations of registered components within explicit resource bounds. Missing prerequisites, unavailable producers, and cyclic dependencies can reject a candidate.</p><p>Before release, the source checks current memory reuse, parent continuity, viability, and relevant constraints. The next observation must then justify continuing the plan.</p><div class="arch-source-row">${source('dynamic_workflow/synthesis.py', 'Bounded composition')}${source('src/core/release_action.src', 'Action release gates')}</div></div>
      </div>
    </section>

    <section class="arch-section wrap" id="example" aria-labelledby="example-title">
      <div class="arch-section-heading arch-heading-row"><div><p class="eyebrow">04 / FOLLOW A DISCOVERY</p><h2 id="example-title">“The gate opened.<br>What can I do with that?”</h2></div><span class="arch-illustrative-label">ILLUSTRATIVE EXAMPLE · NOT A RECORDED RUN</span></div>
      <div class="arch-example">
        <div class="arch-example-world">
          <svg viewBox="0 0 420 250" role="img" aria-labelledby="world-title world-description">
            <title id="world-title">A pad, a gate, and a goal</title>
            <desc id="world-description">An illustrative agent stands near a pressure pad. A gate separates it from a goal. A dotted relation connects pad and gate; whether the effect persists remains a question.</desc>
            <defs><pattern id="world-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0V26" fill="none" stroke="var(--line)" stroke-width="0.7"/></pattern><marker id="world-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="m0 0 6 3-6 3" fill="none" stroke="var(--yellow)" stroke-width="1"/></marker></defs>
            <rect x="15" y="28" width="390" height="182" fill="url(#world-grid)" stroke="var(--line)"/>
            <path d="M275 28v57m0 68v57" stroke="var(--control-border)" stroke-width="10"/>
            <path d="M275 87v64" stroke="var(--yellow)" stroke-width="5" stroke-dasharray="7 5"/>
            <rect x="99" y="111" width="38" height="14" fill="var(--accent)"/>
            <rect x="53" y="106" width="26" height="26" fill="var(--ink)"/>
            <path d="m345 104 15 15-15 15-15-15Z" fill="none" stroke="var(--yellow)" stroke-width="3"/>
            <path d="M120 94C150 47 236 45 267 91" fill="none" stroke="var(--yellow)" stroke-width="1.5" stroke-dasharray="4 5" marker-end="url(#world-arrow)"/>
            <text x="67" y="159" text-anchor="middle">AGENT</text><text x="120" y="159" text-anchor="middle">PAD</text><text x="276" y="238" text-anchor="middle">GATE</text><text x="345" y="159" text-anchor="middle">GOAL</text>
            <rect x="139" y="47" width="112" height="25" fill="var(--surface-raised)" stroke="var(--line)"/><text x="195" y="64" class="arch-world-question" text-anchor="middle">effect persists?</text>
          </svg>
          <p>The useful relationship includes its conditions: <strong>pad occupied → gate open</strong> may differ from <strong>pad activated → gate stays open</strong>.</p>
        </div>
        <ol class="arch-example-steps">
          <li><span>01</span><div><h3>Preserve the intention</h3><p>The parent goal is to reach the far side. The gate blocks that goal; inspecting the pad is a child investigation.</p></div></li>
          <li><span>02</span><div><h3>Separate observation from explanation</h3><p>Pressing the pad coincides with the gate opening. Record the change and a candidate relation. Ask whether the gate remains open after leaving.</p></div></li>
          <li><span>03</span><div><h3>Test the missing condition</h3><p>A suitable probe can distinguish a persistent switch from a pressure mechanism. Its outcome changes which compositions are plausible.</p></div></li>
          <li><span>04</span><div><h3>Compose, then return to the goal</h3><p>If the opening persists, crossing may become possible. If occupancy is required, a suitable movable object might be a prerequisite—only if evidence supports that option. Check the resulting state before claiming progress.</p></div></li>
        </ol>
      </div>
      <p class="arch-example-takeaway">The decisive transition is from <em>“I observed an effect”</em> to <em>“I have a currently supported way to advance this goal.”</em></p>
    </section>

    <section class="arch-section wrap" id="browser" aria-labelledby="browser-title">
      <div class="arch-section-heading"><p class="eyebrow">05 / FROM PYTHON TO THE PLAYGROUND</p><h2 id="browser-title">The whole experience.<br>Inside the browser.</h2><p class="arch-section-lead">The games now execute locally. The next milestone is to bring SRA’s reasoning into the browser as well, keeping decisions and actions on your device.</p></div>
      <div class="arch-status-grid">
        <article><span class="arch-phase arch-phase-live"><span class="status-dot"></span> PLAYABLE TODAY</span><h3>100 original games</h3><p>The catalog brings together 25 official games and 75 custom games. Their original Python engines execute locally through Pyodide and WebAssembly, with manual controls, Undo, and Reset. The separate TypeScript PIPE implementation remains a parity reference.</p><a class="text-link" href="/">Open the Playground ${arrow}</a></article>
        <article><span class="arch-phase">LOCAL EXECUTION</span><h3>Python, in the browser</h3><p>A TypeScript interface talks to a dedicated game worker. The Python runtime, dependencies, and game bundles are served by this site during loading. Once initialized, moves run on your device with no game server or external CDN request. This is a browser execution bridge; the 100 engines have not all been rewritten in TypeScript.</p></article>
        <article><span class="arch-phase">NEXT IMPLEMENTATION STAGE</span><h3>Bring the real agent over</h3><p>SRA is not connected yet. Its representations, reasoning workflows, and action semantics still need browser integration and validation against the Python reference. Public observations must remain separate from hidden engine state, with interrupted plans and parent-goal resumption checked alongside completed levels.</p></article>
      </div>
      <div class="arch-limit-note"><h3>What remains an open research question?</h3><p>Typed contracts and traceable decisions make the system easier to inspect. Their presence does not establish reliable transfer, general understanding, or successful composition in every game. Those claims need behavioral evidence across unfamiliar situations, with regressions tracked. This page describes architectural mechanisms and intended behavior, not a new benchmark result.</p></div>
    </section>

    <section class="arch-source-footer wrap" aria-labelledby="sources-title">
      <div><p class="eyebrow">READ THE IMPLEMENTATION</p><h2 id="sources-title">The code is part of the explanation.</h2><p>Python references on this page are pinned to commit <a href="${agentRepo}/commit/${sourceCommit}" target="_blank" rel="noopener noreferrer"><code>${sourceCommit.slice(0, 12)}</code>${external}</a> so that each link describes the same source snapshot.</p></div>
      <div class="arch-repo-links"><a href="${agentRepo}/tree/${sourceCommit}/agents/yf_arc3_v5" target="_blank" rel="noopener noreferrer"><span><small>RESEARCH SOURCE</small>Python SRA V5</span>${external}</a><a href="${websiteRepo}" target="_blank" rel="noopener noreferrer"><span><small>BROWSER IMPLEMENTATION</small>SRA Playground</span>${external}</a></div>
    </section>
  </main>

  <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Yannick Fontan · 2026</span><div><a href="/">Back to the games ${arrow}</a><a href="${websiteRepo}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Licenses &amp; notices ${external}</a></div></footer>
`;
