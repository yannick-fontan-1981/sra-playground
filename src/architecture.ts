import './styles.css';
import './architecture.css';
import { renderSiteHeader } from './site-header';

const websiteRepo = 'https://github.com/yannick-fontan-1981/sra-playground';
const agentRepo = 'https://github.com/yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan';
const sourceCommit = '212d8d426f07eea2b6797c2bb647545767488a96';
const repositoryBase = `${agentRepo}/blob/${sourceCommit}/`;
const sourceBase = `${repositoryBase}agents/yf_arc3_v5/`;
const external = '<svg class="icon small-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const arrow = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
const link = (url: string, label: string, className = 'arch-source'): string => `<a class="${className}" href="${url}" target="_blank" rel="noopener noreferrer">${label}${external}</a>`;
const source = (path: string, label: string): string => link(`${sourceBase}${path}`, label);

const promises = [
  ['01', 'Make knowledge inspectable.', 'An agent should be able to expose what it believes, the evidence behind it, the conditions under which it applies, and what would defeat it. A useful explanation follows the structures that govern the action.'],
  ['02', 'Make experience composable.', 'A discovered mechanism can become a component of a new plan. The ambition is to reuse a relation such as “maintaining this condition keeps a passage open,” even when the objects and layout change.'],
  ['03', 'Make reasoning revisable.', 'When an expectation fails, the agent needs to revisit the premise, its dependencies, and the affected plan. Explicit structure gives that revision an address; reliable repair remains something to demonstrate.'],
];

const layers = [
  {name:'Logos', kind:'REPRESENT', question:'What is being claimed?', copy:'Typed terms, claims, goals, intentions, and records give reasoning a common language. Claims retain their arguments, conditions, evidence, contradictions, and validity across revisions.', path:'logos/claims.py', label:'Inspect the Claim contract'},
  {name:'DRM', kind:'DECLARE', question:'Under which conditions does it apply?', copy:'Declarative knowledge describes principles, applicability, expected effects, dependencies, and falsifiers. Authored types and rules provide structure; observations support or challenge their application.', path:'drm/knowledge.py', label:'Inspect declared knowledge'},
  {name:'SRC', kind:'ORCHESTRATE', question:'What reasoning should happen next?', copy:'Symbolic Reasoning Code makes calls, selections, branches, waits, and outcomes explicit. Its released action cycle grounds and releases an action, waits for a frame, and observes the result.', path:'src/core/released_action_cycle.src', label:'Inspect an executable cycle'},
  {name:'Python runtime', kind:'EXECUTE', question:'Can this step run in the current state?', copy:'The controller, scheduler, capabilities, and adapters carry out the computation. The agent entry point routes normal actions through the runtime and its source-authorized action boundary.', path:'agent.py', label:'Inspect the agent entry point'},
];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application mount is missing.');

app.innerHTML = `
  <a class="skip-link" href="#architecture-content">Skip to architecture</a>
  ${renderSiteHeader('architecture')}
  <main class="architecture-page" id="architecture-content">
    <section class="arch-hero wrap" aria-labelledby="architecture-title">
      <div>
        <p class="eyebrow"><span class="status-dot"></span> SRA PLAYGROUND / ARCHITECTURE &amp; RESEARCH</p>
        <h1 id="architecture-title">Symbolic<br>Reasoning Agent<span class="title-dot">.</span></h1>
        <p class="arch-hero-subtitle">Toward an artificial cortex.</p>
      </div>
      <div class="arch-hero-copy">
        <p>A case for intelligence that can express what it knows, explore what that knowledge makes possible, and keep pursuing a goal.</p>
        <span class="arch-author">AN INDEPENDENT RESEARCH PROJECT BY YANNICK FONTAN</span>
        <a class="text-link" href="#thesis">Why symbolic reasoning? ${arrow}</a>
      </div>
    </section>

    <div class="arch-reading-line wrap"><span><span class="status-dot"></span> RESEARCH VISION + CURRENT PYTHON ARCHITECTURE</span><a href="#browser">100 games live · SRA integration next ${arrow}</a></div>
    <nav class="arch-toc wrap" aria-label="On this page">
      <a href="#thesis"><span>01</span> The case</a><a href="#abstraction"><span>02</span> Abstraction</a><a href="#cortex"><span>03</span> Artificial cortex</a><a href="#meaning"><span>04</span> Meaning</a><a href="#reasoning-loop"><span>05</span> The loop</a><a href="#system"><span>06</span> The code</a><a href="#evidence"><span>07</span> The test</a>
    </nav>

    <section class="arch-section wrap" id="thesis" aria-labelledby="thesis-title">
      <div class="arch-split">
        <div class="arch-section-heading"><p class="eyebrow">01 / A CASE FOR SYMBOLIC REASONING</p><h2 id="thesis-title">Give intelligence<br>something it can<br><em>think with.</em></h2></div>
        <div class="arch-prose arch-large-prose">
          <p>SRA explores a simple conviction: <strong>knowledge becomes more useful when an agent can represent it, question it, and combine it deliberately.</strong> Objects, roles, mechanisms, spaces, and goals become explicit parts of reasoning.</p>
          <p>The ambition is to turn experience into a structured model of what a world allows. A discovery should expand the agent’s possibilities. A possibility should connect to an intention. An action should return evidence about whether that intention advanced.</p>
          <p>Symbolic AI has long studied reasoning through structured representations and search.<a class="arch-citation" href="#reference-symbols" aria-label="Reference 1: Newell and Simon">[1]</a> SRA brings that research question into interactive worlds, where useful knowledge must be acquired, tested, and carried into the next situation.</p>
        </div>
      </div>
      <div class="arch-arguments">${promises.map(([number,title,copy])=>`<article><span>${number}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}</div>
      <div class="arch-principle"><p class="eyebrow">THE PROJECT’S PRIORITY</p><p>Discover. Structure. Validate. <span>Then exploit.</span></p><div class="arch-prose"><p>The project’s <em>Artificial Wisdom Design</em> places discovery and the structuring of meaning before aggressive early cost optimization. It also separates a preferred candidate from a committed action, leaving room to inspect alternatives before acting.</p>${link(`${repositoryBase}docs/architecture/artificial_wisdom_design.md`, 'Read the design principle')}</div></div>
    </section>

    <section class="arch-section wrap" id="abstraction" aria-labelledby="abstraction-title">
      <div class="arch-section-heading"><p class="eyebrow">02 / CHANGE THE LEVEL OF DESCRIPTION</p><h2 id="abstraction-title">From computation<br>to manipulable knowledge.</h2><p class="arch-section-lead">The intuition behind the project is an analogy about abstraction: make the structures that matter available to deliberate reasoning.</p></div>
      <div class="arch-abstraction" aria-label="An analogy between programming abstraction and explicit reasoning">
        <article><span class="arch-kicker">THE COMPUTING ANALOGY</span><h3>Binary <span aria-hidden="true">→</span> assembly</h3><p>Machine encodings become named instructions, addresses, and control flow. That vocabulary makes operations easier to inspect and compose.</p><div class="arch-abstraction-code"><span>0101 …</span><span aria-hidden="true">→</span><strong>named operations</strong><span aria-hidden="true">→</span><strong>programs</strong></div></article>
        <article><span class="arch-kicker">THE REPRESENTATIONAL AMBITION</span><h3>Neural representations<br><span aria-hidden="true">→</span> explicit symbolic reasoning</h3><p>The proposed gain is direct access to selected structures: an entity, its role, a mechanism’s conditions, and the goal a composition could serve.</p><div class="arch-abstraction-code"><span>patterns</span><span aria-hidden="true">→</span><strong>relations</strong><span aria-hidden="true">→</span><strong>reasoned possibilities</strong></div></article>
      </div>
      <div class="arch-split arch-after-figure"><div><h3 class="arch-subheading">A higher level of explicit control.</h3></div><div class="arch-prose"><p>Neural networks can learn abstract representations.<a class="arch-citation" href="#reference-representations" aria-label="Reference 2: Bengio, Courville and Vincent">[2]</a> They are not literally binary code, and symbolic reasoning is not automatically more intelligent. The analogy concerns <strong>what is directly addressable</strong>: a relation can be examined, a condition challenged, a subgoal suspended, a mechanism reused.</p><p>Learned perception and symbolic reasoning can cooperate. Here, the research choice is to make knowledge and control explicit enough that the system can work on its own representations. The abstraction must earn its value through better behavior.</p></div></div>
    </section>

    <section class="arch-section wrap" id="cortex" aria-labelledby="cortex-title">
      <div class="arch-split"><div class="arch-section-heading"><p class="eyebrow">03 / THE ARTIFICIAL CORTEX AMBITION</p><h2 id="cortex-title">A world model.<br>A memory.<br><em>A continuing intention.</em></h2><p class="arch-section-lead">A shared architecture in which perception, hypotheses, memory, goals, and action continually constrain one another.</p></div><div class="arch-prose"><p>“Artificial cortex” names the project’s organizing ambition: a persistent reasoning layer that turns observations into concepts, connects concepts to mechanisms, and uses those mechanisms to pursue goals. It is a functional metaphor, without claiming a biological simulation or subjective consciousness.</p><p>The demanding part is <strong>continuity</strong>. The agent must remember why it investigated an object, what a result changes, which assumptions remain valid, and which unfinished goal should benefit. Local discoveries need a place in an ongoing process.</p><p>A symbol such as <em>switch</em> is useful when it binds an observed entity to a conditional effect. A reusable mechanism needs evidence, a scope, and prerequisites. A plan needs a reason to continue—or a reason to be revised.</p></div></div>
      <div class="arch-cortex-functions">
        <div><span>PERCEPTION ↔ MODEL</span><h3>What changed, and what might explain it?</h3><p>Track entities and differences. Keep competing interpretations available while a mechanism is uncertain.</p></div>
        <div><span>MEMORY ↔ CONTEXT</span><h3>What can be reused here?</h3><p>Recall an acquired relation, then qualify it against current evidence, scope, and conditions.</p></div>
        <div><span>GOALS ↔ COMPOSITION</span><h3>What would make progress possible?</h3><p>Find prerequisites, assemble available means, preserve the parent intention, and check the effect.</p></div>
      </div>
      <div class="arch-source-row">${source('state/memory_reuse_contract.py', 'Memory qualified by current evidence')}${source('state/portable_activity_memory.py', 'Portable activity schemas')}${source('scheduler/reasoning_context_stack.py', 'Continuing parent context')}</div>
    </section>

    <section class="arch-section wrap" id="meaning" aria-labelledby="meaning-title">
      <div class="arch-section-heading"><p class="eyebrow">04 / A RELATIONAL ACCOUNT OF MEANING</p><h2 id="meaning-title">What does a discovery<br><em>make possible?</em></h2><p class="arch-section-lead">An object gains operational meaning through what it changes, requires, enables, or prevents—and through its relevance to a goal.</p></div>
      <div class="arch-split arch-meaning-copy"><div class="arch-prose"><p>A graph of names is insufficient. Symbol grounding asks how symbols connect to the world they are supposed to describe.<a class="arch-citation" href="#reference-grounding" aria-label="Reference 3: Harnad">[3]</a> SRA’s practical direction is to retain the observation, the proposed interpretation, the conditions, and the evidence that could support or defeat it.</p><p>A <strong>role</strong> expresses what an entity does in context. A <strong>mechanism</strong> connects an intervention to an effect under conditions. A <strong>space</strong> constrains which interactions and routes are possible. A <strong>goal</strong> makes some of these relations relevant now.</p></div><div class="arch-claim"><span class="arch-kicker">A USEFUL CLAIM NEEDS MORE THAN A LABEL</span><p><strong>relation</strong> + arguments + conditions</p><p>+ evidence + scope + current status</p><div class="arch-claim-states"><span>proposed</span><span>supported</span><span>contradicted</span></div>${source('logos/claims.py', 'How the source expresses a claim')}</div></div>

      <div class="meaning-lab" aria-labelledby="meaning-lab-title">
        <div class="meaning-lab-heading"><div><span class="arch-kicker">EXPLORE THE IDEA</span><h3 id="meaning-lab-title">Change the premise.<br>Watch the plan change.</h3></div><span class="arch-illustrative-label">AUTHORED ILLUSTRATION<br>NOT A LIVE SRA RUN</span></div>
        <p class="meaning-lab-intro">The same scene: a pad, a gate, a movable box, and an exit. Choose what has been established about the pad.</p>
        <div class="meaning-choices" role="group" aria-label="Choose the established mechanism">
          <button type="button" data-mechanism="unknown" aria-pressed="true" aria-controls="meaning-result">Effect unknown</button>
          <button type="button" data-mechanism="latch" aria-pressed="false" aria-controls="meaning-result">Persistent switch</button>
          <button type="button" data-mechanism="pressure" aria-pressed="false" aria-controls="meaning-result">Pressure plate</button>
        </div>
        <div class="meaning-lab-body" id="meaning-result" aria-live="polite" aria-atomic="true"></div>
        <p class="meaning-lab-footnote">This small demonstration uses three authored cases to explain the architecture. It does not run the agent, learn a mechanism, or report a solved game.</p>
      </div>
      <div class="arch-split arch-after-figure"><h3 class="arch-subheading">The graph holds the relationships.<br>The loop makes use of them.</h3><div class="arch-prose"><p>The current source already contains several relational structures: claims, declared knowledge, goal dependencies, and a context stack. The goal frontier records parent, prerequisite, alternative, and conflicting goals. Undeclared relationships remain <strong>unknown</strong>.</p><p>The larger ambition is to make these relations support reliable composition and continuation across situations. Their presence is a foundation to evaluate, rather than evidence of a completed universal graph of meaning.</p><div class="arch-source-row">${source('logos/goal_frontier.py', 'Goal relations')}${source('drm/knowledge.py', 'Declared dependencies')}</div></div></div>
    </section>

    <section class="arch-section wrap" id="reasoning-loop" aria-labelledby="loop-title">
      <div class="arch-section-heading"><p class="eyebrow">05 / DISCOVERY → POSSIBILITY → RESUMED GOAL</p><h2 id="loop-title">The behavior-tree-loop.</h2><p class="arch-section-lead">Keep the intention alive. Ask the question that matters now. Return a discovery to the goal that made it useful.</p></div>
      <div class="arch-loop-layout">
        <figure class="arch-behavior-tree" aria-labelledby="tree-caption">
          <div class="tree-root"><span class="arch-kicker">REVISIT AFTER EVERY RESULT</span><strong>Advance the current goal</strong><small>Retain parent context, evidence, and constraints.</small></div>
          <ol class="tree-branches">
            <li><span class="tree-index">01</span><div><h3>A result has returned?</h3><p>Consume it once. Update the claims and dependencies. Reopen the parent question.</p><span class="tree-outcome">RECONCILE → REEVALUATE</span></div></li>
            <li><span class="tree-index">02</span><div><h3>A supported composition is available?</h3><p>Check its current prerequisites and release conditions. Act, observe, then assess progress.</p><span class="tree-outcome">COMPOSE → ACT → OBSERVE</span></div></li>
            <li><span class="tree-index">03</span><div><h3>A missing relation blocks the goal?</h3><p>Open a scoped investigation. Preserve its recipient and parent intention. Return the result.</p><span class="tree-outcome">QUESTION → PROBE → RETURN</span></div></li>
            <li><span class="tree-index">04</span><div><h3>No supported next step remains?</h3><p>Revise a premise, try a declared alternative, or defer with an explicit reason.</p><span class="tree-outcome">REPAIR / ALTERNATIVE / DEFER</span></div></li>
          </ol>
          <div class="tree-return"><span aria-hidden="true">↶</span> New evidence returns control to the goal.</div>
          <figcaption id="tree-caption">Conceptual tree and feedback loop, simplified from SRC workflows and typed context mechanisms. The source does not expose this diagram as a single completed generic behavior-tree engine.</figcaption>
        </figure>
        <div class="arch-loop-notes">
          <article><span class="arch-kicker">THE QUESTIONS THAT HOLD THE LOOP TOGETHER</span><h3>What did I learn?<br>What does it enable?<br>Which goal benefits?</h3><p>Then: which condition is missing, which action tests the composition, and what observation would count as progress?</p></article>
          <article><h3>A discovery needs a recipient.</h3><p>The continuation workflow distinguishes completed, blocked, failed, and deferred child outcomes. It checks consumed receipts, recovers the parent context, and inspects remaining reasoning options.</p>${source('src/arc3/continue_after_information_probe.src', 'Continuation after an information probe')}</article>
          <article><h3>A possibility needs valid conditions.</h3><p>Composition checks providers, prerequisites, dependency cycles, and resource bounds. Action release checks grounding, viability, memory reuse, parent continuity, and relevant constraints.</p><div class="arch-source-row">${source('dynamic_workflow/synthesis.py', 'Bounded composition')}${source('src/core/release_action.src', 'Action release')}</div></article>
          <p class="arch-loop-standard">A result matters when it changes what the parent goal can do next.<br><strong>Progress can be informative or physical. Physical success must still be observed.</strong></p>
        </div>
      </div>
    </section>

    <section class="arch-section wrap" id="system" aria-labelledby="system-title">
      <div class="arch-section-heading"><p class="eyebrow">06 / THE CURRENT IMPLEMENTATION</p><h2 id="system-title">The ideas have<br>a place in the code.</h2><p class="arch-section-lead">The Python V5 source separates representation, declared knowledge, orchestration, and execution. The links below open the inspected source snapshot.</p></div>
      <div class="arch-layers">${layers.map((layer,index)=>`<article class="arch-layer"><div class="arch-layer-top"><span class="arch-layer-index">0${index+1}</span><span class="arch-kicker">${layer.kind}</span></div><h3>${layer.name}</h3><p class="arch-layer-question">${layer.question}</p><p>${layer.copy}</p>${source(layer.path,layer.label)}</article>`).join('')}</div>
      <div class="arch-split arch-after-figure"><h3 class="arch-subheading">Reusable structure,<br>qualified in the present.</h3><div class="arch-prose"><p>Portable activity memory separates reusable workflow schemas from the donor scene’s geometry and concrete actions. Importing a schema begins a hypothesis that needs qualification in the new situation.</p><p>The memory reuse contract requires recalled claims and current supporting claims. The contribution contract binds a child result to its request, recipient, scope, parent goal, and evidence. These are concrete ways to express the difference between remembering, applying, and making progress.</p><div class="arch-source-row">${source('state/portable_activity_memory.py', 'Portable memory')}${source('state/memory_reuse_contract.py', 'Reuse contract')}${source('scheduler/contribution_contract.py', 'Contribution contract')}</div></div></div>
    </section>

    <section class="arch-section wrap" id="evidence" aria-labelledby="evidence-title">
      <div class="arch-split"><div class="arch-section-heading"><p class="eyebrow">07 / LET THE BEHAVIOR ANSWER</p><h2 id="evidence-title">The argument becomes<br>stronger when it<br><em>survives a new world.</em></h2></div><div class="arch-prose"><p>The research question is concrete: can an agent discover a mechanism, express what it learned, combine it with another mechanism, and resume a goal in a different situation?</p><p>Authored types, principles, and capabilities provide an initial structure. The challenge is to ground and revise their use through experience. A symbolic architecture still has to manage uncertainty, choose useful abstractions, and control the growth of possible compositions.</p><p>Traceability makes that challenge easier to investigate. It does not by itself establish reliable transfer or general understanding.</p></div></div>
      <div class="arch-evidence-table" role="region" aria-label="Research goals and the evidence they require" tabindex="0"><table><thead><tr><th>Research objective</th><th>Evidence to look for</th></tr></thead><tbody><tr><th scope="row">Transfer</th><td>Reuse a mechanism in a new setting with different appearance or geometry, while preserving earlier successes.</td></tr><tr><th scope="row">Continuation</th><td>Return from an investigation to the correct parent goal and turn the result into observed progress.</td></tr><tr><th scope="row">Revision</th><td>Invalidate a disproved premise and repair the affected composition without spreading the error.</td></tr><tr><th scope="row">Useful abstraction</th><td>Improve success, exploration cost, or decision clarity under measured time and memory budgets.</td></tr></tbody></table></div>
      <div class="arch-source-row">${link(`${repositoryBase}docs/reasoning-tree/composition-target-tree_v-1.0/README.md`, 'The source distinguishes wiring, use, success, and transfer')}</div>

      <div class="arch-browser" id="browser"><div class="arch-section-heading"><p class="eyebrow">THE PLAYGROUND TODAY</p><h3>Small worlds for a larger research question.</h3></div><div class="arch-browser-grid"><article><span class="arch-phase"><span class="status-dot"></span> PLAYABLE</span><h4>100 original games</h4><p>25 official games and 75 custom games execute locally through Python, Pyodide, and WebAssembly. The TypeScript interface provides manual play, Undo, and Reset.</p><a class="text-link" href="/">Open SRA Playground ${arrow}</a></article><article><span class="arch-phase">BROWSER EXECUTION</span><h4>Decisions on your device</h4><p>Game moves run in a dedicated worker after the site loads its local assets. The intended agent experience keeps reasoning in the browser too, without per-action server requests.</p></article><article><span class="arch-phase">NEXT STAGE</span><h4>Connect the real SRA</h4><p>The agent is not connected yet. Its reasoning must be integrated and checked against the Python reference, including public observations, interrupted plans, and parent-goal resumption.</p></article></div></div>
      <p class="arch-closing">Toward <em>Understandable Intelligence.</em></p>
    </section>

    <section class="arch-sources wrap" aria-labelledby="sources-title"><div class="arch-section-heading"><p class="eyebrow">SOURCE &amp; RESEARCH CONTEXT</p><h2 id="sources-title">An argument you can inspect.</h2><p class="arch-section-lead">The architecture links are pinned to Python commit ${link(`${agentRepo}/commit/${sourceCommit}`, sourceCommit.slice(0,12))}. The research vision and the illustrative example express the project’s intended direction; the code links describe existing mechanisms.</p></div><div class="arch-repo-links">${link(`${agentRepo}/tree/${sourceCommit}/agents/yf_arc3_v5`, 'Python SRA V5')}${link(websiteRepo, 'SRA Playground source')}</div><ol class="arch-references"><li id="reference-symbols"><span>01</span><div>${link('https://dl.acm.org/doi/10.1145/360018.360022', 'Newell & Simon · Computer Science as Empirical Inquiry: Symbols and Search')}<p>1976 · Historical foundation for the symbolic systems and search research program.</p></div></li><li id="reference-representations"><span>02</span><div>${link('https://arxiv.org/abs/1206.5538', 'Bengio, Courville & Vincent · Representation Learning: A Review and New Perspectives')}<p>2013 · Context for learned representations and the importance of how knowledge is represented.</p></div></li><li id="reference-grounding"><span>03</span><div>${link('https://www.southampton.ac.uk/~harnad/Papers/Harnad/harnad90.sgproblem.html', 'Harnad · The Symbol Grounding Problem')}<p>1990 · Why relationships between symbols and perception matter to an account of meaning.</p></div></li></ol></section>
  </main>
  <footer class="site-footer wrap"><span><strong>SRA Playground</strong><span class="footer-separator">/</span>Independent research by Yannick Fontan</span><div><a href="/">Back to the games ${arrow}</a><a href="${websiteRepo}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Licenses &amp; notices ${external}</a></div></footer>
`;

type Mechanism = 'unknown' | 'latch' | 'pressure';
interface MeaningCase {
  relation: string;
  condition: string;
  state: string;
  plan: string[];
  evidence: string;
  question: string;
  prerequisite: string;
}
const meaningCases: Record<Mechanism, MeaningCase> = {
  unknown: {
    relation:'Pad activation ↔ gate opening?',
    condition:'The connection and its persistence need testing.',
    state:'HYPOTHESIS',
    plan:['Retain the goal: reach the exit.', 'Activate the pad and observe the gate.', 'Leave the pad and check whether the effect persists.'],
    evidence:'A useful probe distinguishes a lasting switch from a condition that must be maintained.',
    question:'What happens when occupancy stops?',
    prerequisite:'Qualify the mechanism',
  },
  latch: {
    relation:'Pad activated → gate stays open',
    condition:'Assume persistence has been established in this scene.',
    state:'SUPPORTED IN THIS EXAMPLE',
    plan:['Activate the pad.', 'Use the verified open route to cross the gate.', 'Observe arrival at the exit before claiming progress.'],
    evidence:'The lasting effect removes occupancy as a continuing prerequisite; the parent goal can resume.',
    question:'Does the open route remain valid?',
    prerequisite:'Activate the switch',
  },
  pressure: {
    relation:'Pad occupied → gate open',
    condition:'Assume the box can be moved onto the pad and keeps it active.',
    state:'SUPPORTED IN THIS EXAMPLE',
    plan:['Move the box onto the pad.', 'Check that the gate stays open while the agent leaves.', 'Cross the gate and verify arrival at the exit.'],
    evidence:'The plan must preserve occupancy while freeing the agent to move. A movable box supplies that condition only under the stated assumptions.',
    question:'Can occupancy be maintained independently?',
    prerequisite:'Maintain pad occupancy',
  },
};
const result = document.querySelector<HTMLDivElement>('#meaning-result');
const mechanismButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-mechanism]')];
if (!result) throw new Error('Meaning illustration mount is missing.');
const meaningResult: HTMLDivElement = result;
function setMechanism(mechanism: Mechanism): void {
  const example = meaningCases[mechanism];
  for (const button of mechanismButtons) button.setAttribute('aria-pressed', String(button.dataset.mechanism === mechanism));
  meaningResult.dataset.mechanism = mechanism;
  meaningResult.innerHTML = `
    <div class="meaning-model">
      <span class="arch-kicker">RELATIONS &amp; DEPENDENCIES</span>
      <div class="meaning-goal"><small>PARENT GOAL RETAINED</small><strong>Reach the exit</strong></div>
      <div class="meaning-dependency"><span>requires</span><div><strong>An open route</strong><small>Agent able to cross</small></div></div>
      <div class="meaning-dependency"><span>${mechanism === 'unknown' ? 'investigate' : 'requires'}</span><div><strong>${example.prerequisite}</strong><small>${example.question}</small></div></div>
      <div class="meaning-relation"><span>${example.state}</span><strong>${example.relation}</strong><p>${example.condition}</p></div>
    </div>
    <div class="meaning-plan"><span class="arch-kicker">THE NEXT REASONING &amp; ACTION SEQUENCE</span><ol>${example.plan.map(step=>`<li>${step}</li>`).join('')}</ol><p>${example.evidence}</p><div class="meaning-progress"><span class="status-dot"></span> ${mechanism === 'unknown' ? 'Useful progress: the probe result informs the route to the exit.' : 'Physical success: arrival at the exit is observed.'}</div></div>
  `;
}
for (const button of mechanismButtons) {
  button.addEventListener('click', () => {
    const mechanism = button.dataset.mechanism;
    if (mechanism === 'unknown' || mechanism === 'latch' || mechanism === 'pressure') setMechanism(mechanism);
  });
}
setMechanism('unknown');
