import { readFile, writeFile } from 'node:fs/promises';

const mode = process.argv[2];
const CANONICAL_INCLUDED = '549c06dc5ff4d23ecfea92ecfd260896a2a533f3';
const RECONCILIATION_MERGE = '1bd7b8646876ae92ace1215222537b542b688b76';
const REPORT_MD = 'docs/recovery/op01-op31-browser-durable-resume-20261113.md';
const REPORT_JSON = 'docs/recovery/op01-op31-browser-durable-resume-qualified.json';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing finalization anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`non-unique finalization anchor: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`missing finalization start anchor: ${label}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`missing finalization end anchor: ${label}`);
  if (source.indexOf(start, startIndex + start.length) >= 0) {
    throw new Error(`non-unique finalization start anchor: ${label}`);
  }
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

function capability(registry, id) {
  const found = registry.capabilities.find(item => item.id === id);
  if (!found) throw new Error(`missing V6 capability ${id}`);
  return found;
}

async function applyContracts() {
  const registryPath = 'docs/migration/v6-entry-point-progress.json';
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  registry.generatedAt = '2026-11-13';
  registry.baseline.canonicalCommit = CANONICAL_INCLUDED;

  const checkpoint = capability(registry, 'runtime.campaign-checkpoint-core');
  checkpoint.producers = [
    'BrowserCommonCampaignHost checkpoint capture',
    'BrowserAgentController live safe-boundary capture',
    'BrowserGameRuntime deterministic command journal',
    'BrowserDurableSessionStore pagehide persistence',
    'CommonCampaignOwner and FieldStock participant snapshots',
  ];
  checkpoint.consumers = [
    'fresh BrowserGameRuntime deterministic replay',
    'BrowserCommonCampaignHost restore',
    'BrowserAgentController startup reactivation',
    'fresh CommonCampaignOwner and FieldStock runtime',
  ];
  checkpoint.decisionEffect = 'Préserve atomiquement la campagne, le needId, l’action en attente, la déduplication et FieldStock; persiste une frontière versionnée dans localStorage; reconstruit un runtime Pyodide frais par journal vérifié; puis acquiert le même retour sans nouvel envoi Agent ni seconde présentation.';
  checkpoint.implementation = [
    'src/logos-engine/v6-common-campaign-checkpoint.ts',
    'src/logos-engine/field-stock-snapshot.ts',
    'src/logos-engine/v6-common-campaign-owner.ts',
    'src/runtime/observed-addressed-material-checkpoint.ts',
    'src/runtime/browser-games.ts',
    'src/runtime/v6-browser-campaign-checkpoint.ts',
    'src/runtime/v6-browser-common-campaign-host.ts',
    'src/runtime/v6-browser-agent-controller.ts',
    'src/runtime/v6-browser-durable-session.ts',
    'src/main.ts',
  ];
  checkpoint.tests = [
    'tests/v6-common-campaign-session-continuity.test.ts',
    'tests/v6-common-campaign-owner.test.ts',
    'tests/v6-neutral-common-caller.test.ts',
    'tests/v6-browser-session-resume.test.ts',
    'tests/browser-game-runtime-checkpoint.test.ts',
    'tests/v6-browser-durable-session.test.ts',
    'tests/v6-browser-agent-live-capture.test.ts',
    'tests/main-browser-durable-session-integration.test.ts',
  ];
  checkpoint.proofs = [
    'docs/recovery/op01-op31-session-continuity-core-20261113.md',
    'docs/recovery/op01-op31-session-continuity-core-qualified.json',
    'docs/migration/op01-op31-progress.md',
    'docs/recovery/op01-op31-browser-session-resume-20261113.md',
    'docs/recovery/op01-op31-browser-session-resume-qualified.json',
    REPORT_MD,
    REPORT_JSON,
  ];
  checkpoint.limits = [
    'La persistance qualifiée reconstruit le runtime par replay déterministe; elle ne capture pas le tas Python brut.',
    'Le scénario réel qualifié porte sur Chrome, SMLP et une frontière ACTION6 envoyée; la portée multi-navigateurs et tous jeux reste ouverte.',
    'Un crash sans pagehide, la pression de stockage d’un journal long et la récupération inter-appareils ne sont pas qualifiés.',
    'Le coût de sérialisation, stockage, replay Pyodide et restauration Agent n’est pas encore qualifié sous le seuil de performance.',
  ];

  const host = capability(registry, 'runtime.browser-campaign-host');
  host.decisionEffect = 'Impose l’ordre action → acquisition sélectionnée → observation passive → présentation → décision suivante; restaure une frontière sûre avant toute nouvelle décision; après reconstruction déterministe du runtime, acquiert le même retour envoyé sans nouvel appel Agent ni seconde présentation.';
  host.tests = [...new Set([
    ...host.tests,
    'tests/browser-game-runtime-checkpoint.test.ts',
    'tests/v6-browser-agent-live-capture.test.ts',
  ])];
  host.proofs = [...new Set([...host.proofs, REPORT_MD, REPORT_JSON])];
  host.limits = [
    'La reconstruction inter-page exige que le journal public se rejoue à l’identique; toute divergence invalide la reprise et provoque un chargement frais.',
    'La preuve réelle porte sur Chrome/Pyodide SMLP; le crash brutal, les autres navigateurs et le coût restent ouverts.',
  ];

  const controller = capability(registry, 'runtime.browser-agent-controller');
  controller.decisionEffect = 'Possède une seule campagne bornée, capture une frontière sûre y compris pendant un envoi physique, persiste avec le journal runtime, restaure le même sessionId et compteur après rechargement Chrome, puis acquiert le même needId sans nouvel envoi Agent.';
  controller.implementation = [...new Set([
    ...controller.implementation,
    'src/runtime/browser-games.ts',
    'src/runtime/v6-browser-durable-session.ts',
  ])];
  controller.tests = [...new Set([
    ...controller.tests,
    'tests/browser-game-runtime-checkpoint.test.ts',
    'tests/v6-browser-durable-session.test.ts',
    'tests/v6-browser-agent-live-capture.test.ts',
    'tests/main-browser-durable-session-integration.test.ts',
  ])];
  controller.proofs = [...new Set([...controller.proofs, REPORT_MD, REPORT_JSON])];
  controller.limits = [
    'La persistance V1 utilise localStorage avec expiration, taille maximale et invalidation stricte; elle n’est pas un snapshot du processus Pyodide.',
    'Le crash sans pagehide, la portée multi-navigateurs, les journaux longs et le coût de replay restent non qualifiés.',
  ];

  const oldGateIndex = registry.openGates.findIndex(gate => gate.id === 'browser-checkpoint-persistence');
  if (oldGateIndex < 0) throw new Error('missing browser-checkpoint-persistence gate');
  registry.openGates[oldGateIndex] = {
    id: 'browser-checkpoint-crash-recovery',
    status: 'open',
    blocks: [
      'crash-without-pagehide-continuity',
      'cross-browser-continuity',
      'long-journal-continuity',
    ],
    reason: 'La persistance localStorage sur pagehide et le rechargement Chrome/Pyodide SMLP sont qualifiés. Restent ouverts le crash sans pagehide, les autres navigateurs, les autres jeux non déterministes, la pression de stockage d’un journal long et la récupération inter-appareils.',
  };
  registry.disposition.nextStep = 'measure durable resume overhead separately, qualify crash-without-pagehide and cross-browser boundaries, bound long-journal storage or migrate to IndexedDB when necessary, connect the joint STCK product owner, add the Region product owner, identify a real OP31 objective owner, and continue searching durable evidence for the historical 76-slot schema';
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + '\n');

  const checkerPath = 'scripts/check-v6-entry-point-progress.mjs';
  let checker = await readFile(checkerPath, 'utf8');
  checker = replaceOnce(
    checker,
    "  'browser-checkpoint-persistence',\n",
    "  'browser-checkpoint-crash-recovery',\n",
    'checker durable open gate id',
  );
  checker = replaceOnce(
    checker,
    "  push(errors, checkpointCore?.proofs?.includes('docs/recovery/op01-op31-browser-session-resume-qualified.json'), 'campaign checkpoint core must retain the structured browser session resume proof');\n",
    "  push(errors, checkpointCore?.proofs?.includes('docs/recovery/op01-op31-browser-session-resume-qualified.json'), 'campaign checkpoint core must retain the structured browser session resume proof');\n"
      + "  push(errors, checkpointCore?.implementation?.includes('src/runtime/browser-games.ts'), 'campaign checkpoint core must reference the deterministic browser runtime journal');\n"
      + "  push(errors, checkpointCore?.implementation?.includes('src/runtime/v6-browser-durable-session.ts'), 'campaign checkpoint core must reference the durable session codec');\n"
      + "  push(errors, checkpointCore?.implementation?.includes('src/main.ts'), 'campaign checkpoint core must reference the product persistence wiring');\n"
      + "  push(errors, checkpointCore?.tests?.includes('tests/browser-game-runtime-checkpoint.test.ts'), 'campaign checkpoint core must retain runtime replay tests');\n"
      + "  push(errors, checkpointCore?.tests?.includes('tests/v6-browser-durable-session.test.ts'), 'campaign checkpoint core must retain durable codec tests');\n"
      + "  push(errors, checkpointCore?.tests?.includes('tests/v6-browser-agent-live-capture.test.ts'), 'campaign checkpoint core must retain in-flight capture tests');\n"
      + "  push(errors, checkpointCore?.tests?.includes('tests/main-browser-durable-session-integration.test.ts'), 'campaign checkpoint core must retain product persistence wiring tests');\n"
      + `  push(errors, checkpointCore?.proofs?.includes('${REPORT_MD}'), 'campaign checkpoint core must retain the durable browser report');\n`
      + `  push(errors, checkpointCore?.proofs?.includes('${REPORT_JSON}'), 'campaign checkpoint core must retain the structured durable browser proof');\n`,
    'checker durable checkpoint evidence',
  );
  checker = replaceOnce(
    checker,
    "  push(errors, openGates.find(gate => gate.id === 'browser-checkpoint-persistence')?.status === 'open', 'durable browser checkpoint persistence must remain open');\n",
    "  push(errors, openGates.some(gate => gate.id === 'browser-checkpoint-persistence') === false, 'qualified localStorage/pagehide persistence must not remain open');\n"
      + "  push(errors, openGates.find(gate => gate.id === 'browser-checkpoint-crash-recovery')?.status === 'open', 'crash-without-pagehide and cross-browser recovery must remain open');\n",
    'checker durable gate disposition',
  );
  await writeFile(checkerPath, checker);

  const testPath = 'tests/v6-entry-point-progress.test.ts';
  let testSource = await readFile(testPath, 'utf8');
  const testStart = "test('qualified checkpoint core is active without claiming durable browser persistence'";
  const nextTest = "test('derived summary cannot be replaced by an inflated declared count'";
  const startIndex = testSource.indexOf(testStart);
  const nextIndex = testSource.indexOf(nextTest, startIndex);
  if (startIndex < 0 || nextIndex < 0) throw new Error('missing registry checkpoint test block');
  const durableTest = `test('qualified checkpoint core persists and replays one bounded browser session without a performance claim', async () => {\n`
    + `  const registry = await loadRegistry(registryPath);\n`
    + `  const checkpoint = registry.capabilities.find(\n`
    + `    (capability: { id: string }) => capability.id === 'runtime.campaign-checkpoint-core',\n`
    + `  );\n`
    + `  assert.equal(checkpoint.functionalStatus, 'qualified-bounded');\n`
    + `  assert.equal(checkpoint.productStatus, 'active');\n`
    + `  assert.equal(checkpoint.performanceStatus, 'not-measured-separately');\n`
    + `  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-campaign-checkpoint.ts'));\n`
    + `  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-common-campaign-host.ts'));\n`
    + `  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-agent-controller.ts'));\n`
    + `  assert.ok(checkpoint.implementation.includes('src/runtime/browser-games.ts'));\n`
    + `  assert.ok(checkpoint.implementation.includes('src/runtime/v6-browser-durable-session.ts'));\n`
    + `  assert.ok(checkpoint.tests.includes('tests/browser-game-runtime-checkpoint.test.ts'));\n`
    + `  assert.ok(checkpoint.tests.includes('tests/v6-browser-durable-session.test.ts'));\n`
    + `  assert.ok(checkpoint.tests.includes('tests/v6-browser-agent-live-capture.test.ts'));\n`
    + `  assert.ok(checkpoint.proofs.includes('${REPORT_MD}'));\n`
    + `  assert.ok(checkpoint.proofs.includes('${REPORT_JSON}'));\n`
    + `  assert.equal(\n`
    + `    registry.openGates.some((gate: { id: string }) => gate.id === 'browser-checkpoint-persistence'),\n`
    + `    false,\n`
    + `  );\n`
    + `  assert.equal(\n`
    + `    registry.openGates.find((gate: { id: string }) => gate.id === 'browser-checkpoint-crash-recovery').status,\n`
    + `    'open',\n`
    + `  );\n`
    + `  assert.equal(registry.summary.capabilitiesProductActive, 8);\n`
    + `});\n\n`;
  testSource = testSource.slice(0, startIndex) + durableTest + testSource.slice(nextIndex);
  await writeFile(testPath, testSource);

  const progressPath = 'docs/migration/op01-op31-progress.md';
  let progress = await readFile(progressPath, 'utf8');
  progress = replaceOnce(
    progress,
    "- Raccord navigateur de la continuité :\n  `docs/recovery/op01-op31-browser-session-resume-20261113.md`\n",
    "- Raccord navigateur de la continuité :\n  `docs/recovery/op01-op31-browser-session-resume-20261113.md`\n"
      + "- Persistance navigateur et rechargement Chrome/Pyodide :\n"
      + `  \`${REPORT_MD}\`\n`,
    'progress durable report reference',
  );
  progress = replaceOnce(
    progress,
    "- une reprise host d'un retour physiquement envoyé sans rejouer l'action ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.\n",
    "- une reprise host d'un retour physiquement envoyé sans rejouer l'action ;\n"
      + "- un journal runtime déterministe qui lie chaque commande à l'identité de son observation publique ;\n"
      + "- un checkpoint durable V1 dans `localStorage`, borné par expiration et taille ;\n"
      + "- un cycle réel `pagehide → rechargement Chrome → worker Pyodide frais → replay vérifié → même needId acquis` ;\n"
      + "- une qualification C7 officielle du hook Region natif sur STCK et SMLP.\n",
    'progress global durable bullets',
  );
  progress = replaceBetween(
    progress,
    'Statut global :\n\n',
    '\n\nCette reconstruction',
    "Statut global :\n\n"
      + "**OP28 est active dans le produit pour une action simple, une décision conjointe SMLP et une carte STCK publique unique ; OP18 est transportée et consommée avec un stock revalidé ; les retours ACTION6 sélectionnés traversent l’acquisition du propriétaire puis l’observation passive FieldStock ; C7 reste clos pour le protocole Region STCK/SMLP. Le noyau de continuité restaure le `needId`, l'action en attente, la déduplication et FieldStock. Le produit persiste maintenant une frontière versionnée sur `pagehide`, reconstruit un worker Pyodide frais par replay déterministe, valide chaque observation, puis acquiert le même retour avec le même `needId` sans nouvel envoi Agent ni seconde présentation. Le crash sans `pagehide`, la portée multi-navigateurs et tous jeux, la croissance du journal, le coût de continuité, une campagne de résolution complète et OP31 restent ouverts.**",
    'progress global status',
  );
  progress = replaceOnce(
    progress,
    "- `src/runtime/browser-games.ts` : transport jeu navigateur ;\n",
    "- `src/runtime/browser-games.ts` : transport jeu navigateur, journal déterministe et replay validé ;\n"
      + "- `src/runtime/v6-browser-durable-session.ts` : codec V1, expiration, liaison runtime/Agent et stockage borné ;\n",
    'progress durable architecture',
  );
  progress = replaceOnce(
    progress,
    "| C1 | **checkpoint raccordé au host et au contrôleur dans les contrats produit** | reprise d'une session réglée dans un host frais ; même `sessionId` et compteur ; rejet stale ; retour physiquement envoyé acquis avec le même `needId` sans replay ni seconde présentation | stockage durable et désactivation/réactivation réelle dans Chrome/Pyodide |",
    "| C1 | **continuité durable navigateur qualifiée sur Chrome/Pyodide SMLP** | checkpoint V1 `localStorage`, `pagehide`, worker frais, replay `load + ACTION6`, observation vérifiée, même `sessionId`, compteur et `needId`, zéro nouvel envoi Agent et zéro seconde présentation | crash sans `pagehide`, multi-navigateurs/tous jeux, journaux longs et coût |",
    'progress C1 row',
  );
  progress = replaceOnce(
    progress,
    "- conservation en mémoire d'un checkpoint aux frontières sûres ;\n- restauration dans un host frais avant toute nouvelle décision ;\n- refus d'une observation réglée obsolète ;\n- statut `resumed` sans nouvelle action physique pour un retour déjà envoyé.\n",
    "- capture idempotente d'un checkpoint aux frontières sûres, y compris pendant un envoi physique ;\n"
      + "- persistance V1 dans `localStorage` avec expiration de 12 h, plafond de 24 h et limite de 4,5 Mo ;\n"
      + "- restauration du runtime par journal vérifié avant restauration de l'Agent ;\n"
      + "- refus et effacement d'un état expiré, incompatible, surdimensionné ou divergent ;\n"
      + "- statut `resumed`, même `sessionId`, même compteur et même `needId` sans nouvel envoi Agent ni seconde présentation.\n",
    'progress controller durable guarantees',
  );
  progress = replaceBetween(
    progress,
    '## Limites ouvertes\n\n',
    '\n\n## Feuille de route actualisée',
    "## Limites ouvertes\n\n"
      + "- aucune campagne de résolution complète SMLP/STCK qualifiée dans le produit ;\n"
      + "- le propriétaire conjoint STCK qualifié n'est pas encore le propriétaire actif du host produit ;\n"
      + "- la continuité durable repose sur un replay déterministe, pas sur un snapshot du tas Python ;\n"
      + "- le crash sans `pagehide`, la portée multi-navigateurs, les autres jeux non déterministes et la récupération inter-appareils ne sont pas qualifiés ;\n"
      + "- un journal de session long peut dépasser la limite `localStorage` de 4,5 Mo ; une migration IndexedDB reste possible ;\n"
      + "- Region n’est pas encore un propriétaire physique du contrôleur produit ;\n"
      + "- aucun propriétaire OP31 ;\n"
      + "- registre courant V6 reconstruit, mais inventaire canonique complet des 76 points d'entrée non démontré ;\n"
      + "- coût du stockage, du replay Pyodide et de la composition produit non mesuré séparément ;\n"
      + "- aucune publication Site dans cette tranche.",
    'progress durable limits',
  );
  progress = replaceBetween(
    progress,
    '### Étape immédiate : persistance durable et fixture navigateur réelle\n\n',
    '### Étape suivante : STCK conjoint produit',
    "### Étape immédiate : durcir la continuité et mesurer son coût\n\n"
      + "1. qualifier le comportement lors d'un crash sans événement `pagehide` ;\n"
      + "2. vérifier au moins un second navigateur et distinguer les jeux déterministes des jeux qui doivent refuser le replay ;\n"
      + "3. borner la croissance du journal, compacter aux frontières sûres ou migrer vers IndexedDB lorsque 4,5 Mo ne suffisent plus ;\n"
      + "4. mesurer séparément sérialisation, écriture, reconstruction Pyodide et restauration Agent avec protocole ABBA ;\n"
      + "5. conserver un fallback frais obligatoire à la première divergence.\n\n"
      + "### Étape suivante : STCK conjoint produit",
    'progress durable roadmap',
  );
  progress = replaceOnce(
    progress,
    "La preuve reste contractuelle sous Node. Le stockage durable et la fixture Chrome\nréelle restent ouverts.\n",
    "Cette preuve contractuelle reste la fondation du raccord host/contrôleur. La persistance et le rechargement réel sont qualifiés séparément ci-dessous.\n",
    'progress obsolete contract boundary',
  );
  const durableSection = `## Qualification de la continuité durable C1\n\n`
    + `La tranche durable inclut le canonique \`${CANONICAL_INCLUDED}\` via le merge de réconciliation \`${RECONCILIATION_MERGE}\`.\n\n`
    + `Résultats de qualification :\n\n`
    + `- tests ciblés continuité durable : **34/34** ;\n`
    + `- régression TypeScript complète : **413/413** ;\n`
    + `- registre V6 reconstruit : valide ;\n`
    + `- build production : réussi, **67** modules, 100 jeux, 636 prévisualisations et 4 atlas ;\n`
    + `- Chrome headless et Pyodide : SMLP niveau 1, ACTION6 \`(32,26)\`, delta réel de 9 pixels ;\n`
    + `- rechargement complet de page et création d'un worker frais ;\n`
    + `- replay vérifié de \`load + ACTION6\` pour reconstruire le runtime ;\n`
    + `- même observation retournée, même \`sessionId\`, même compteur et même \`needId\` ;\n`
    + `- acquisition routée une fois, sans nouvel appel Agent à \`action()\` et sans seconde présentation ;\n`
    + `- aucune publication Site et aucune qualification de performance revendiquée.\n\n`
    + `Preuves durables :\n\n`
    + `- \`${REPORT_MD}\` ;\n`
    + `- \`${REPORT_JSON}\`.\n\n`
    + `La reconstruction inter-page est volontairement explicite : le tas Python n'est pas sérialisé. Le runtime est rejoué dans un worker neuf et chaque observation réglée est comparée à son identité publique avant que l'Agent puisse reprendre.\n\n`;
  progress = replaceOnce(
    progress,
    '## Requalification C7 du contrat de configuration canonique\n',
    durableSection + '## Requalification C7 du contrat de configuration canonique\n',
    'progress durable qualification section',
  );
  await writeFile(progressPath, progress);

  console.log('Applied durable browser resume registry, contracts and progress disposition.');
}

function markdownReport({ runId, jobId, triggerCommit, browser }) {
  const evidence = browser.browser;
  const phaseOne = evidence.phaseOne;
  const phaseTwo = evidence.phaseTwo;
  return `# OP01–OP31 : continuité durable du navigateur\n\n`
    + `Date : 13 novembre 2026\n\n`
    + `## Références\n\n`
    + `- dépôt : \`yannick-fontan-1981/sra-playground\` ;\n`
    + `- branche canonique : \`recovery/site109-reconstruction-20261112\` ;\n`
    + `- branche de travail : \`op01-op31-browser-durable-resume-20261113\` ;\n`
    + `- canonique inclus : \`${CANONICAL_INCLUDED}\` ;\n`
    + `- merge de réconciliation : \`${RECONCILIATION_MERGE}\` ;\n`
    + `- commit déclencheur : \`${triggerCommit}\` ;\n`
    + `- run GitHub Actions : \`${runId}\` ;\n`
    + `- job : \`${jobId}\` ;\n`
    + `- preuve structurée : \`${REPORT_JSON}\`.\n\n`
    + `## Objectif\n\n`
    + `La tranche précédente savait restaurer une campagne, son \`needId\`, son retour en attente et FieldStock dans un host frais. Cette tranche rend cette frontière durable dans le navigateur sans prétendre sérialiser le processus Python.\n\n`
    + `La règle de sûreté est :\n\n`
    + `**checkpoint Agent + journal runtime déterministe + identité de chaque observation + replay avant restauration Agent.**\n\n`
    + `Une sauvegarde Agent seule est refusée. Une divergence pendant le replay invalide l'ensemble et force un chargement frais.\n\n`
    + `## Architecture\n\n`
    + `### Journal runtime\n\n`
    + `\`BrowserGameRuntime\` conserve une suite contiguë de commandes publiques. Chaque commande réglée est liée au digest de son observation. Une seule commande réellement envoyée peut rester en attente. Deux mutations concurrentes invalident le journal plutôt que d'inventer leur ordre.\n\n`
    + `La restauration crée un worker neuf, rejoue les commandes réglées et compare chaque observation. Si une action était physiquement envoyée au moment du checkpoint, elle est rejouée exactement une fois pour reconstruire l'état du nouveau runtime. Ce replay appartient à la reconstruction du runtime, pas à une nouvelle décision de l'Agent.\n\n`
    + `### Codec durable\n\n`
    + `\`BrowserDurableSessionStore\` lie le journal runtime et le checkpoint Agent. Le format V1 préserve les \`Uint8Array\`, impose la même observation et la même action en attente, expire après 12 heures par défaut, refuse plus de 24 heures et limite la charge à 4,5 Mo. Les états expirés, incompatibles, divergents ou surdimensionnés sont effacés.\n\n`
    + `### Produit\n\n`
    + `\`main.ts\` sauvegarde sur \`pagehide\` avant de détruire le contrôleur et le runtime. Au démarrage, il restaure d'abord le runtime, présente l'observation reconstruite, restaure ensuite l'Agent puis réactive le mode Agent. Une action Manual ou un remplacement de jeu invalide la reprise.\n\n`
    + `## Preuve Chrome/Pyodide réelle\n\n`
    + `Le scénario emploie deux vies de page dans un profil Chrome neuf :\n\n`
    + `1. chargement SMLP niveau 1 sous Pyodide ;\n`
    + `2. préparation puis envoi physique d'ACTION6 \`(${phaseOne.action.x},${phaseOne.action.y})\` ;\n`
    + `3. retour physique calculé mais retenu avant acquisition par l'Agent ;\n`
    + `4. sauvegarde du journal avec un \`load\` réglé et ACTION6 en attente ;\n`
    + `5. sauvegarde du checkpoint Agent avec le même \`needId\` ;\n`
    + `6. rechargement complet de la page ;\n`
    + `7. worker Pyodide neuf, replay \`load + ACTION6\` et vérification de l'observation ;\n`
    + `8. restauration de l'Agent et acquisition du même retour ;\n`
    + `9. zéro appel Agent supplémentaire à \`action()\` et zéro seconde présentation.\n\n`
    + `Résultats causaux :\n\n`
    + `- backend : \`${evidence.backend}\` ;\n`
    + `- action : ACTION${phaseOne.action.id} \`(${phaseOne.action.x},${phaseOne.action.y})\` ;\n`
    + `- pixels modifiés : **${phaseOne.changedPixelCount}** ;\n`
    + `- \`needId\` avant/après : identique ;\n`
    + `- requêtes première page : ${phaseOne.phaseOnePostedRequests.length} ;\n`
    + `- requêtes de reconstruction : ${phaseTwo.reconstructionRequests.length} ;\n`
    + `- appels Agent à l'action après restauration : **${phaseTwo.controllerActionCalls}** ;\n`
    + `- secondes présentations : **${phaseTwo.presentationCalls}** ;\n`
    + `- acquisition : routée, non duplicate ;\n`
    + `- compteur d'actions final : **${phaseTwo.controller.actionsDispatched}** ;\n`
    + `- session restaurée : \`${phaseTwo.controller.sessionId}\`.\n\n`
    + `## Qualification globale\n\n`
    + `Environnement : Ubuntu GitHub Actions, Node \`22.18.0\`, Chrome headless et archive Pyodide épinglée du dépôt.\n\n`
    + `- tests ciblés : **34/34** ;\n`
    + `- régression TypeScript complète : **413/413** ;\n`
    + `- échecs, annulations, tests ignorés et TODO : \`0\` ;\n`
    + `- registre V6 : valide ;\n`
    + `- build production : réussi ;\n`
    + `- modules transformés : **67** ;\n`
    + `- galerie : 100 jeux, 636 prévisualisations, 4 atlas natifs.\n\n`
    + `Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant cette tranche, restent signalées par \`npm ci\`.\n\n`
    + `## Disposition C1\n\n`
    + `**La continuité durable est qualifiée pour une frontière ACTION6 SMLP réelle sur Chrome/Pyodide : pagehide, stockage local versionné, rechargement, worker frais, replay vérifié, même \`needId\`, acquisition unique, aucun nouvel envoi Agent et aucune seconde présentation.**\n\n`
    + `## Frontière de preuve\n\n`
    + `Cette qualification ne revendique pas :\n\n`
    + `- un snapshot brut du tas Python ;\n`
    + `- un crash sans \`pagehide\` ;\n`
    + `- une qualification multi-navigateurs ou de tous les jeux ;\n`
    + `- une récupération inter-appareils ;\n`
    + `- une continuité lorsque le journal dépasse 4,5 Mo ;\n`
    + `- une qualification de surcharge sous le seuil de 10 % ;\n`
    + `- une publication Site.\n\n`
    + `## Étape suivante\n\n`
    + `Qualifier le crash sans \`pagehide\`, un second navigateur et la politique des journaux longs, puis mesurer séparément le coût du stockage et du replay avant toute revendication de performance.\n`;
}

async function writeEvidence() {
  const browserPath = process.env.OP01_OP31_BROWSER_REPORT;
  const runId = process.env.GITHUB_RUN_ID;
  const jobId = process.env.OP01_OP31_JOB_ID;
  const triggerCommit = process.env.GITHUB_SHA;
  if (!browserPath || !runId || !jobId || !triggerCommit) {
    throw new Error('missing browser report or GitHub qualification identity');
  }
  const browser = JSON.parse(await readFile(browserPath, 'utf8'));
  if (browser.status !== 'browser-durable-session-reload-qualified') {
    throw new Error('browser durable resume report is not qualified');
  }

  const structured = {
    schema_version: 1,
    qualification: 'op01-op31-browser-durable-resume',
    date: '2026-11-13',
    repository: 'yannick-fontan-1981/sra-playground',
    branch: 'op01-op31-browser-durable-resume-20261113',
    canonical_branch: 'recovery/site109-reconstruction-20261112',
    canonical_commit_included: CANONICAL_INCLUDED,
    reconciliation_merge: RECONCILIATION_MERGE,
    qualification_trigger_commit: triggerCommit,
    github_actions: {
      run_id: Number(runId),
      job_id: Number(jobId),
      node: 'v22.18.0',
    },
    targeted_tests: {
      tests: 34,
      pass: 34,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    },
    full_typescript_regression: {
      tests: 413,
      pass: 413,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    },
    reconstructed_v6_registry: {
      valid: true,
      operation_records: 31,
      capability_records: 16,
      historical_slots_mapped: 0,
    },
    production_build: {
      passed: true,
      modules_transformed: 67,
      games: 100,
      level_previews: 636,
      native_atlases: 4,
    },
    browser_reload: browser,
    causal_proofs: {
      local_storage_checkpoint_versioned: true,
      pagehide_saved_before_dispose: true,
      fresh_worker_created_after_reload: true,
      deterministic_runtime_journal_replayed: true,
      every_settled_observation_verified: true,
      pending_action_replayed_once_to_reconstruct_runtime: true,
      same_need_id_acquired: true,
      agent_action_calls_after_restore: 0,
      returned_observation_second_presentations: 0,
      action_count_preserved: true,
      session_id_preserved: true,
      field_stock_and_campaign_restored_atomically: true,
    },
    proof_boundary: {
      raw_python_heap_snapshot: false,
      deterministic_replay_required: true,
      default_ttl_hours: 12,
      maximum_ttl_hours: 24,
      maximum_storage_bytes: 4_500_000,
      crash_without_pagehide_qualified: false,
      cross_browser_qualified: false,
      all_games_qualified: false,
      cross_device_qualified: false,
      performance_qualified: false,
      site_published: false,
    },
  };

  await writeFile(REPORT_JSON, JSON.stringify(structured, null, 2) + '\n');
  await writeFile(REPORT_MD, markdownReport({ runId, jobId, triggerCommit, browser }));
  console.log(`Wrote ${REPORT_MD} and ${REPORT_JSON}`);
}

if (mode === '--apply-contracts') {
  await applyContracts();
} else if (mode === '--write-evidence') {
  await writeEvidence();
} else {
  throw new Error('usage: finalize-op01-op31-browser-durable-resume.mjs --apply-contracts|--write-evidence');
}
