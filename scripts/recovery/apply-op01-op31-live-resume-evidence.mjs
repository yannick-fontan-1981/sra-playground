import { copyFile, readFile, writeFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'op01-op31-live-smlp-session-resume-report.json';
const registryPath = 'docs/migration/v6-entry-point-progress.json';
const progressPath = 'docs/migration/op01-op31-progress.md';
const proofMarkdownPath = 'docs/recovery/op01-op31-live-smlp-session-resume-20261113.md';
const proofJsonPath = 'docs/recovery/op01-op31-live-smlp-session-resume-qualified.json';
const evidenceTestPath = 'tests/v6-entry-point-live-resume-evidence.test.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function appendUnique(values, ...items) {
  for (const item of items) {
    if (!values.includes(item)) values.push(item);
  }
}

function replaceOnce(text, before, after, label) {
  assert(text.includes(before), `missing ${label} replacement anchor`);
  return text.replace(before, after);
}

function replacePattern(text, pattern, replacement, label) {
  assert(pattern.test(text), `missing ${label} replacement pattern`);
  pattern.lastIndex = 0;
  return text.replace(pattern, replacement);
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
assert(report.status === 'live-smlp-browser-session-resume-qualified', 'browser qualification report is not qualified');
assert(report.assertions?.realWorkersQualified === 2, 'expected two qualified real Workers');
assert(report.assertions?.physicalActionsQualified === 2, 'expected two qualified physical actions');
assert(report.assertions?.controllerReactivationsQualified === 1, 'expected one controller reactivation');
assert(report.assertions?.dispatchedReturnsResumed === 1, 'expected one dispatched return resume');
assert(report.assertions?.replayedActions === 0, 'physical action replay detected');
assert(report.assertions?.duplicatePresentations === 0, 'duplicate presentation detected');

await copyFile(reportPath, proofJsonPath);

const proofMarkdown = `# OP01–OP31 live SMLP browser session resume qualification - 2026-11-13

## Status

**Qualified for functional in-memory continuity in a real headless Chrome browser using the real module Worker, Pyodide and Python SMLP engine.**

This proof closes the real-browser sub-boundary of C1. It does not claim durable persistence through a page reload, a browser-process restart, another machine or an external store.

## Qualified execution

- Repository: \`yannick-fontan-1981/sra-playground\`
- Canonical integration commit for the reusable fixture: \`e465e78aa48b69e81e8b5afadbc094428387cfe9\`
- Qualified source commit: \`abda7e50be688b62de7ed6b36fdf405d6f7ee8ac\`
- GitHub Actions run: \`43439234643\`
- Job: \`131932196246\`
- Browser: \`HeadlessChrome/157.0.0.0\`
- Game: \`SMLP\`, level 1
- Runtime backend: \`python-wasm\`
- Physical action: \`ACTION6\` at \`(32, 26)\`
- Original artifact id: \`14044696579\`
- Original artifact digest: \`sha256:40460ca2a5c1026a672895df18b15fb08981a04aa42a92e307a9f58e7be7699b\`

## Runtime chain exercised

\`\`\`text
BrowserAgentController / BrowserCommonCampaignHost
→ BrowserGameRuntime
→ real module Worker
→ Pyodide
→ game_bridge.py
→ custom-games.zip
→ Python SMLP engine
→ returned public observation
→ campaign acquisition
→ next controller state
\`\`\`

No synthetic Worker and no mocked Python response are used for the physical game transition.

## Scenario A - Manual stop and Agent reactivation

The controller starts from the real SMLP observation, sends one ACTION6 through Worker/Pyodide, receives \`deactivate("manual")\` while the action is pending, settles the return exactly once, retains its checkpoint and then activates again from a fresh host.

| Assertion | Result |
|---|---:|
| Real Worker instances | 1 |
| Worker action requests | 1 |
| Physical action calls | 1 |
| Presentations | 1 |
| Routed acquisitions | 1 |
| Hosts created | 2 |
| First stop reason | \`manual\` |
| Second stop reason | \`action-limit\` |
| Same session id preserved | yes |
| Same dispatched-action count preserved | yes, \`1\` |
| New Worker request after reactivation | 0 |
| Physical replay | 0 |
| Duplicate presentation | 0 |
| Duplicate acquisition | 0 |
| Changed public pixels | 9 |

The final public-frame hash differs from the initial hash.

## Scenario B - return already dispatched before restoration

A checkpoint is captured with \`pendingReturn.stage = "dispatched"\`. The physical return then settles. A fresh host restores that checkpoint against the already-live returned observation and acquires it with status \`resumed\`.

| Assertion | Result |
|---|---:|
| Real Worker instances | 1 |
| Worker action requests | 1 |
| Physical action calls | 1 |
| Original presentations | 1 |
| Original acquisitions | 1 |
| Captured pending stage | \`dispatched\` |
| Restored status | \`resumed\` |
| Returned sequence | \`1\` |
| Same \`needId\` preserved | yes |
| Physical replay | 0 |
| Duplicate presentation | 0 |
| Restored acquisition duplicate flag | \`false\` |
| Changed public pixels | 9 |

## Consolidated result

| Measure | Result |
|---|---:|
| Real Workers qualified | 2 |
| Physical actions qualified | 2 |
| Controller reactivations qualified | 1 |
| Dispatched returns resumed | 1 |
| Replayed actions | 0 |
| Duplicate presentations | 0 |

The generated structured proof is stored in:

\`docs/recovery/op01-op31-live-smlp-session-resume-qualified.json\`

## Regression validation

The qualifying run passed:

- production build;
- complete TypeScript regression suite, **396/396**;
- report-contract suite, **5/5**;
- real Chrome, Worker, Pyodide and SMLP qualification.

## Performance disposition

This is a functional qualification only.

- Snapshot and restore duration were not used as acceptance criteria.
- The official C7 Region performance scope remains unchanged.
- No capability is promoted to \`official-qualified\` performance status by this proof.
- Snapshot creation, restoration and resumed acquisition must be measured separately before any complete-loop performance claim.

## Exact remaining boundary

Still open:

- durable, versioned checkpoint storage;
- restoration after page reload or browser-process restart;
- restoration on another machine;
- the literal public DOM interaction sequence selecting Manual and then Agent;
- official performance of checkpoint and restore;
- recovery of any identity in the historical 76-slot registry;
- Site publication and GitHub ↔ Site parity.

## Next step

\`\`\`text
serialize the retained browser checkpoint
→ store it durably with an explicit schema version and expiry policy
→ reload the page or start a new browser process
→ restore the game observation and campaign checkpoint together
→ acquire an already-sent return without replay
→ measure snapshot and restore costs independently
\`\`\`
`;
await writeFile(proofMarkdownPath, proofMarkdown);

const registry = JSON.parse(await readFile(registryPath, 'utf8'));
const capabilities = new Map(registry.capabilities.map(capability => [capability.id, capability]));
const capabilityIds = [
  'campaign.common-owner',
  'runtime.campaign-checkpoint-core',
  'runtime.browser-campaign-host',
  'runtime.browser-agent-controller',
];
const browserFixture = 'tests/browser/op01-op31-live-smlp-session-resume.ts';
const contractTest = 'tests/op01-op31-live-smlp-session-resume-contract.test.mjs';
const proofMarkdownRef = proofMarkdownPath;
const proofJsonRef = proofJsonPath;

for (const id of capabilityIds) {
  const capability = capabilities.get(id);
  assert(capability, `missing registry capability ${id}`);
  appendUnique(capability.tests, browserFixture, contractTest);
  appendUnique(capability.proofs, proofMarkdownRef, proofJsonRef);
}

const commonOwner = capabilities.get('campaign.common-owner');
appendUnique(
  commonOwner.limits,
  'La continuité en mémoire est qualifiée sous Chrome avec le vrai Worker/Pyodide ; la persistance après rechargement ou nouveau processus reste ouverte.',
);

const checkpointCore = capabilities.get('runtime.campaign-checkpoint-core');
assert(checkpointCore.productStatus === 'active-in-product', 'checkpoint core active product status regressed');
appendUnique(
  checkpointCore.limits,
  'Le checkpoint actif est qualifié pour une restauration en mémoire sous Chrome/Worker/Pyodide.',
  'Aucun stockage durable ni reprise après rechargement de page ou nouveau processus n’est encore qualifié.',
  'Le coût de snapshot, restauration et acquisition reprise n’est pas mesuré séparément.',
);

const campaignHost = capabilities.get('runtime.browser-campaign-host');
appendUnique(
  campaignHost.limits,
  'La reprise d’un retour déjà envoyé est qualifiée sous Chrome/Worker/Pyodide sans replay ni seconde présentation.',
  'La persistance au-delà du cycle de vie de la page reste non qualifiée.',
);

const controller = capabilities.get('runtime.browser-agent-controller');
controller.limits = controller.limits.filter(limit => !(
  /Chrome|Pyodide/u.test(limit)
  && /non qualifi|pas qualifi|aucune bascule|fixture/u.test(limit)
));
appendUnique(
  controller.limits,
  'L’arrêt Manual puis la réactivation Agent sont qualifiés via le seam contrôleur dans Chrome avec le vrai Worker/Pyodide.',
  'La séquence DOM publique complète et la reprise après rechargement de page ou nouveau processus restent non qualifiées.',
);

const persistenceGate = registry.openGates.find(gate => gate.id === 'browser-checkpoint-persistence');
assert(persistenceGate, 'browser-checkpoint-persistence gate is missing');
persistenceGate.reason = 'La réactivation en mémoire du contrôleur et la reprise d’un retour déjà envoyé sont qualifiées dans Chrome avec le vrai Worker/Pyodide. Le gate reste ouvert pour un stockage durable versionné, la restauration après rechargement de page ou nouveau processus et la séquence DOM publique complète.';
registry.disposition.nextStep = 'persist the active browser checkpoint with an explicit schema version and expiry policy, prove page-reload or new-process recovery without physical replay, exercise the complete public Manual-to-Agent DOM sequence, measure snapshot and restore costs separately, and continue searching durable evidence for the historical 76-slot schema';
assert(registry.summary.capabilitiesProductActive === 8, 'active product capability count regressed');
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

let progress = await readFile(progressPath, 'utf8');
progress = replacePattern(
  progress,
  /- Branche de travail :\n  `[^`]+`/u,
  '- Branche de travail :\n  `op01-op31-live-resume-evidence-reconcile-20261113`',
  'working branch',
);
progress = replacePattern(
  progress,
  /- Candidat fonctionnel qualifié :\n  `[^`]+`/u,
  '- Candidat fonctionnel Chrome/Pyodide qualifié :\n  `abda7e50be688b62de7ed6b36fdf405d6f7ee8ac`',
  'qualified candidate',
);
progress = replaceOnce(
  progress,
  '- Raccord navigateur de la continuité :\n  `docs/recovery/op01-op31-browser-session-resume-20261113.md`\n',
  '- Raccord navigateur de la continuité :\n  `docs/recovery/op01-op31-browser-session-resume-20261113.md`\n- Qualification réelle Chrome/Worker/Pyodide de la continuité :\n  `docs/recovery/op01-op31-live-smlp-session-resume-20261113.md`\n- Preuve structurée correspondante :\n  `docs/recovery/op01-op31-live-smlp-session-resume-qualified.json`\n',
  'proof references',
);
progress = replaceOnce(
  progress,
  '- une reprise host d\'un retour physiquement envoyé sans rejouer l\'action ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.\n',
  '- une reprise host d\'un retour physiquement envoyé sans rejouer l\'action ;\n- une désactivation Manual puis une réactivation Agent qualifiées dans Chrome\n  avec le vrai Worker, Pyodide et le moteur Python SMLP ;\n- une reprise d\'un checkpoint `dispatched` avec le même `needId`, sans seconde\n  ACTION6 ni seconde présentation ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.\n',
  'global evidence',
);
progress = replaceOnce(
  progress,
  'stockage durable, la preuve Chrome réelle, une campagne de résolution produit\ncomplète, le coût ciblé de la nouvelle composition et OP31 restent ouverts.**',
  'stockage durable après rechargement ou nouveau processus, la séquence DOM\npublique Manual → Agent, une campagne de résolution produit complète, le coût\nciblé de la nouvelle composition et OP31 restent ouverts.**',
  'global open boundary',
);
progress = replacePattern(
  progress,
  /^\| C1 \|.*$/mu,
  '| C1 | **continuité en mémoire qualifiée dans Chrome/Worker/Pyodide** | arrêt Manual pendant ACTION6, règlement unique, même `sessionId`, même compteur et même `needId` après réactivation ; checkpoint `dispatched` repris sans replay ni seconde présentation | stockage durable, reprise après rechargement ou nouveau processus, séquence DOM publique et coût isolé |',
  'C1 row',
);
progress = replaceOnce(
  progress,
  '- statut `resumed` sans nouvelle action physique pour un retour déjà envoyé.\n',
  '- statut `resumed` sans nouvelle action physique pour un retour déjà envoyé ;\n- qualification réelle sous Chrome du passage `running → stopping(manual) →\n  stopped(manual) → running → stopped(action-limit)` ;\n- absence de nouvelle requête Worker, de seconde ACTION6, de seconde\n  présentation et de seconde acquisition après réactivation.\n',
  'controller guarantees',
);
progress = replaceOnce(
  progress,
  '- aucune désactivation/réactivation réelle dans Chrome n\'est encore qualifiée ;\n',
  '- la réactivation via le seam contrôleur est qualifiée dans Chrome, mais la\n  séquence DOM publique complète Manual → Agent n\'est pas encore exercée ;\n',
  'open Chrome limit',
);
progress = replacePattern(
  progress,
  /### Étape immédiate : persistance durable et fixture navigateur réelle\n\n[\s\S]*?\n### Étape suivante : STCK conjoint produit/u,
  `### Étape immédiate : persistance durable et reprise après rechargement

1. définir un stockage durable versionné avec politique d'expiration ;
2. lier le checkpoint au jeu, au niveau et à la génération produit courante ;
3. conserver une frontière sûre lors de \`pagehide\` sans annuler un retour déjà
   physiquement envoyé ;
4. exercer la séquence DOM publique Manual → Agent dans Chrome ;
5. recharger la page ou démarrer un nouveau processus, puis restaurer ensemble
   l'observation de jeu et le checkpoint de campagne ;
6. vérifier à nouveau l'absence de perte de \`needId\`, de double acquisition, de
   double présentation et de double ACTION6 ;
7. mesurer séparément snapshot, restauration et acquisition reprise.

### Étape suivante : STCK conjoint produit`,
  'immediate roadmap',
);
progress = replaceOnce(
  progress,
  'La preuve reste contractuelle sous Node. Le stockage durable et la fixture Chrome\nréelle restent ouverts.\n',
  'Cette preuve contractuelle sous Node est maintenant complétée par la\nqualification réelle Chrome/Worker/Pyodide ci-dessous. Le stockage durable et\nla reprise après rechargement ou nouveau processus restent ouverts.\n',
  'Node qualification boundary',
);
const qualificationAnchor = '## Requalification C7 du contrat de configuration canonique\n';
assert(progress.includes(qualificationAnchor), 'missing C7 insertion anchor');
const liveQualificationSection = `## Qualification réelle Chrome/Worker/Pyodide C1

Le candidat \`abda7e50be688b62de7ed6b36fdf405d6f7ee8ac\` a été qualifié par le
run \`43439234643\`, job \`131932196246\`, sous Headless Chrome 157.

Chaîne réellement exécutée :

\`\`\`text
BrowserAgentController / BrowserCommonCampaignHost
→ BrowserGameRuntime
→ module Worker réel
→ Pyodide
→ game_bridge.py
→ custom-games.zip
→ moteur Python SMLP
\`\`\`

Résultats :

- build de production : réussi ;
- régression TypeScript complète : **396/396** ;
- contrat de rapport : **5/5** ;
- Workers réels qualifiés : \`2\` ;
- ACTION6 physiques qualifiées : \`2\` ;
- réactivation contrôleur qualifiée : \`1\` ;
- retour au stade \`dispatched\` repris : \`1\` ;
- actions rejouées : \`0\` ;
- présentations dupliquées : \`0\` ;
- même \`sessionId\`, compteur d'actions, \`needId\` et séquence conservés ;
- \`9\` pixels publics modifiés dans chaque scénario, avec hash final distinct.

Deux scénarios sont couverts :

1. ACTION6 en vol, demande Manual, règlement unique, checkpoint retenu, puis
   réactivation Agent sans nouvelle requête Worker ;
2. checkpoint capturé après envoi physique, restauration dans un host frais
   contre l'observation déjà retournée, puis acquisition \`resumed\` sans replay
   ni seconde présentation.

Preuves durables :

- \`docs/recovery/op01-op31-live-smlp-session-resume-20261113.md\` ;
- \`docs/recovery/op01-op31-live-smlp-session-resume-qualified.json\`.

Cette qualification est fonctionnelle. Elle ne mesure pas le coût de snapshot
ou de restauration et ne prouve pas encore la persistance après rechargement,
nouveau processus ou changement de machine.

`;
progress = progress.replace(qualificationAnchor, liveQualificationSection + qualificationAnchor);
await writeFile(progressPath, progress);

const evidenceTest = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const registryPath = new URL('../docs/migration/v6-entry-point-progress.json', import.meta.url);

async function loadRegistry() {
  return JSON.parse(await readFile(registryPath, 'utf8'));
}

test('real Chrome resume evidence preserves active checkpoint status and narrows the remaining gate', async () => {
  const registry = await loadRegistry();
  assert.equal(registry.summary.capabilitiesProductActive, 8);

  for (const id of [
    'campaign.common-owner',
    'runtime.campaign-checkpoint-core',
    'runtime.browser-campaign-host',
    'runtime.browser-agent-controller',
  ]) {
    const capability = registry.capabilities.find(candidate => candidate.id === id);
    assert.ok(capability, \`missing capability \${id}\`);
    assert.ok(capability.tests.includes('tests/browser/op01-op31-live-smlp-session-resume.ts'));
    assert.ok(capability.tests.includes('tests/op01-op31-live-smlp-session-resume-contract.test.mjs'));
    assert.ok(capability.proofs.includes('docs/recovery/op01-op31-live-smlp-session-resume-20261113.md'));
    assert.ok(capability.proofs.includes('docs/recovery/op01-op31-live-smlp-session-resume-qualified.json'));
  }

  const checkpoint = registry.capabilities.find(candidate => candidate.id === 'runtime.campaign-checkpoint-core');
  assert.equal(checkpoint.productStatus, 'active-in-product');
  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');

  const gate = registry.openGates.find(candidate => candidate.id === 'browser-checkpoint-persistence');
  assert.equal(gate.status, 'open');
  assert.match(gate.reason, /réactivation en mémoire.*qualifiées dans Chrome.*vrai Worker\\/Pyodide/u);
  assert.match(gate.reason, /stockage durable versionné.*rechargement de page.*nouveau processus/u);
  assert.equal(
    registry.openGates.some(candidate => candidate.id === 'browser-session-reactivation'),
    false,
  );
});
`;
await writeFile(evidenceTestPath, evidenceTest);

console.log(JSON.stringify({
  status: 'live-session-resume-evidence-reconciled',
  proofMarkdownPath,
  proofJsonPath,
  evidenceTestPath,
  activeProductCapabilities: registry.summary.capabilitiesProductActive,
  remainingGate: persistenceGate.id,
  realWorkersQualified: report.assertions.realWorkersQualified,
  replayedActions: report.assertions.replayedActions,
  duplicatePresentations: report.assertions.duplicatePresentations,
}, null, 2));
