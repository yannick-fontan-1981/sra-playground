import { readFile, writeFile } from 'node:fs/promises';

const BRANCH = 'op01-op31-browser-session-resume-20261113';
const CANONICAL_BRANCH = 'recovery/site109-reconstruction-20261112';
const RECONCILED_SOURCE_PARENT = '9bc69001ac697f8a6f6cc50911b8de4696ce32f8';
const CANONICAL_INCLUDED = '97ba156fd0ffb8359cb84514c91f1504d84e928c';

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function lastMatch(source, expression, label) {
  const matches = [...source.matchAll(expression)];
  if (matches.length === 0) throw new Error(`missing ${label}`);
  return matches.at(-1);
}

async function parseTap(path) {
  const source = stripAnsi(await readFile(path, 'utf8'));
  const value = name => Number(lastMatch(
    source,
    new RegExp(`^# ${name} (\\d+)$`, 'gm'),
    `TAP ${name} in ${path}`,
  )[1]);
  return {
    tests: value('tests'),
    pass: value('pass'),
    fail: value('fail'),
    cancelled: value('cancelled'),
    skipped: value('skipped'),
    todo: value('todo'),
  };
}

async function parseBuild(path) {
  const source = stripAnsi(await readFile(path, 'utf8'));
  const modules = Number(lastMatch(
    source,
    /(\d+) modules transformed\./g,
    'Vite module count',
  )[1]);
  const gallery = lastMatch(
    source,
    /Generated the game gallery: (\d+) games, (\d+) level previews, (\w+) native image atlases\./g,
    'gallery summary',
  );
  const atlasWords = new Map([
    ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ]);
  return {
    passed: /✓ built in/.test(source),
    modulesTransformed: modules,
    games: Number(gallery[1]),
    levelPreviews: Number(gallery[2]),
    nativeAtlases: atlasWords.get(gallery[3]) ?? Number(gallery[3]),
  };
}

async function currentJobId() {
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !runId || !token) {
    throw new Error('GitHub workflow identity is incomplete');
  }
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`unable to resolve workflow job: ${response.status}`);
  }
  const payload = await response.json();
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const job = jobs.find(item => item.name === 'qualify-and-finalize') ?? jobs[0];
  if (!job || !Number.isInteger(job.id)) {
    throw new Error('current workflow job was not found');
  }
  return job.id;
}

function replaceOnce(source, needle, replacement, label) {
  const index = source.indexOf(needle);
  if (index < 0) throw new Error(`missing progress anchor: ${label}`);
  if (source.indexOf(needle, index + needle.length) >= 0) {
    throw new Error(`ambiguous progress anchor: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + needle.length);
}

const targeted = await parseTap('/tmp/browser-resume-targeted.tap');
const full = await parseTap('/tmp/browser-resume-full.tap');
const build = await parseBuild('/tmp/browser-resume-build.log');
const jobId = await currentJobId();
const runId = Number(process.env.GITHUB_RUN_ID);
const qualificationTrigger = process.env.GITHUB_SHA;
const nodeVersion = process.version;

for (const [label, result] of [['targeted', targeted], ['full', full]]) {
  if (
    result.tests !== result.pass
    || result.fail !== 0
    || result.cancelled !== 0
    || result.skipped !== 0
    || result.todo !== 0
  ) {
    throw new Error(`${label} test qualification is not clean`);
  }
}
if (!build.passed) throw new Error('production build did not complete');

const proof = {
  schema_version: 1,
  qualification: 'op01-op31-browser-session-resume',
  date: '2026-11-13',
  repository: 'yannick-fontan-1981/sra-playground',
  branch: BRANCH,
  canonical_branch: CANONICAL_BRANCH,
  reconciled_source_parent: RECONCILED_SOURCE_PARENT,
  canonical_commit_included: CANONICAL_INCLUDED,
  qualification_trigger_commit: qualificationTrigger,
  github_actions: {
    run_id: runId,
    job_id: jobId,
    node: nodeVersion,
  },
  targeted_tests: targeted,
  full_typescript_regression: full,
  production_build: build,
  causal_proofs: {
    settled_session_restored_into_fresh_host: true,
    same_session_id_preserved: true,
    action_count_preserved: true,
    stale_checkpoint_rejected: true,
    dispatched_pending_need_id_preserved: true,
    dispatched_pending_return_acquired_once: true,
    physical_action_replayed_on_resume: false,
    returned_observation_presented_twice: false,
    unchanged_live_observation_keeps_pending: true,
    field_stock_runtime_restored_atomically: true,
    field_stock_transport_context_restored: true,
  },
  proof_boundary: {
    actual_chrome_reactivation: false,
    durable_pagehide_storage: false,
    cross_process_recovery: false,
    automatic_controller_capture_during_unsettled_dispatch: false,
    product_performance_qualified: false,
    site_published: false,
  },
};

await writeFile(
  'docs/recovery/op01-op31-browser-session-resume-qualified.json',
  `${JSON.stringify(proof, null, 2)}\n`,
);

const report = `# OP01–OP31 : raccord navigateur de la continuité de session

Date : 13 novembre 2026

## Références

- dépôt : \`yannick-fontan-1981/sra-playground\` ;
- branche canonique cible : \`${CANONICAL_BRANCH}\` ;
- branche de travail : \`${BRANCH}\` ;
- base canonique réconciliée : \`${CANONICAL_INCLUDED}\` ;
- arbre source réconcilié avant finalisation :
  \`${RECONCILED_SOURCE_PARENT}\` ;
- commit déclencheur de la qualification : \`${qualificationTrigger}\` ;
- run GitHub Actions : \`${runId}\` ;
- job : \`${jobId}\` ;
- preuve structurée :
  \`docs/recovery/op01-op31-browser-session-resume-qualified.json\`.

## Objectif

Le noyau précédent savait capturer puis restaurer la campagne commune,
FieldStock, le \`needId\`, les décisions réglées et la déduplication. Cette
tranche raccorde ce noyau au seam produit navigateur sans donner au checkpoint
une autorité de décision supplémentaire.

L'objectif causal est double :

1. arrêter une campagne à une frontière réglée, recréer un host frais puis
   poursuivre la même session sans perdre son état ;
2. lorsqu'une action physique a déjà été envoyée mais que son retour n'a pas
   encore été acquis, consommer l'observation revenue avec le même \`needId\`
   sans rejouer l'action et sans présenter deux fois le même retour.

## Architecture raccordée

### Contrat de checkpoint navigateur

\`src/runtime/v6-browser-campaign-checkpoint.ts\` définit un format versionné
qui lie explicitement :

- l'état atomique de la campagne commune et de ses participants ;
- le \`sessionId\` produit ;
- le code du jeu ;
- la prochaine séquence publique ;
- l'identité déterministe de l'observation ;
- les observations jeu et Agent correspondantes ;
- l'éventuel retour physique en attente ;
- la préparation sélectionnée, son propriétaire, sa proposition et son
  \`needId\`.

La restauration refuse une autre version, un autre jeu, une rupture de séquence,
une observation Agent qui ne correspond pas au frame public, ou une attente qui
ne correspond plus à l'unique besoin conservé par la campagne.

### Host produit

\`BrowserCommonCampaignHost\` possède maintenant le
\`CommonCampaignCheckpointCoordinator\`. Il accepte deux frontières :

- **frontière réglée** : aucun besoin physique n'est en attente ;
- **frontière envoyée** : le besoin est encore en attente, mais l'appel physique
  à \`ports.action()\` a réellement commencé et son identité est conservée.

Une proposition préparée mais jamais envoyée n'est pas checkpointable. Cette
distinction empêche de restaurer une intention comme si elle avait déjà produit
un effet dans le jeu.

Au retour d'une frontière envoyée :

- si l'observation publique n'a pas changé, le host reste \`pending\` ;
- si elle a changé, le host reconstruit la prochaine observation Agent ;
- il acquiert le retour avec le même \`needId\` ;
- il appelle ensuite les observateurs passifs FieldStock ;
- il ne rappelle pas \`ports.action()\` ;
- il ne rappelle pas la présentation, car l'observation est déjà celle du
  produit vivant ;
- il renvoie le statut explicite \`resumed\` avant toute décision suivante.

### FieldStock

Le coordinateur restaure ensemble :

- l'état exact de \`ObservedAddressedMaterialRuntime\` ;
- le contexte public courant du transport FieldStock ;
- la campagne et sa déduplication.

Le runtime et son transport restent deux participants distincts, avec des
identités et un ordre déterministes. Les statuts diagnostiques transitoires du
transport ne sont pas revendiqués comme connaissance durable.

### Contrôleur Agent

\`BrowserAgentController\` conserve un checkpoint lorsqu'il s'arrête à une
frontière sûre : \`manual\`, \`none\`, \`ambiguous\`, \`pending\`, \`blocked\`
ou limite d'actions.

À la prochaine activation il :

1. crée un nouveau host ;
2. tente de restaurer le checkpoint avant toute décision ;
3. conserve le même \`sessionId\` et le compteur d'actions ;
4. refuse un checkpoint réglé si l'observation vivante a changé ;
5. repart dans une nouvelle session si la restauration est refusée ;
6. ne compte pas \`resumed\` comme une nouvelle action physique.

Un remplacement de jeu, un terminal, une erreur ou \`dispose()\` invalide le
checkpoint détenu en mémoire.

## Chaînes démontrées

### Session réglée

\`observation initiale → action OP28 → acquisition → arrêt none → checkpoint →
host frais → restauration → même session → aucune action supplémentaire\`

La preuve vérifie que le compteur reste à une action et que la seconde activation
ne rappelle pas le transport physique.

### Retour déjà envoyé

\`préparation OP28 → needId → ports.action appelé → snapshot envoyé → host frais
→ observation vivante avancée → même needId acquis → zéro replay → zéro seconde
présentation\`

La variante où l'observation vivante n'a pas encore avancé reste explicitement
\`pending\` et n'exécute aucune action.

### Checkpoint obsolète

\`checkpoint réglé → frame vivant différent → refus → host frais → nouvelle
session\`

Le refus est observable par le callback du contrôleur et ne transforme jamais
l'ancien état en connaissance applicable au nouveau frame.

## Qualification

Environnement :

- runner : GitHub Actions Ubuntu ;
- Node : \`${nodeVersion}\` ;
- base canonique incluse : \`${CANONICAL_INCLUDED}\`.

Résultats ciblés :

- tests : **${targeted.tests}** ;
- réussis : **${targeted.pass}** ;
- échecs : \`${targeted.fail}\` ;
- annulés : \`${targeted.cancelled}\` ;
- ignorés : \`${targeted.skipped}\` ;
- TODO : \`${targeted.todo}\`.

Régression complète :

- tests TypeScript : **${full.tests}/${full.pass}** ;
- échecs : \`${full.fail}\` ;
- annulés : \`${full.cancelled}\` ;
- ignorés : \`${full.skipped}\` ;
- TODO : \`${full.todo}\`.

Build :

- production : réussi ;
- modules Vite transformés : \`${build.modulesTransformed}\` ;
- galerie : \`${build.games}\` jeux, \`${build.levelPreviews}\`
  prévisualisations, \`${build.nativeAtlases}\` atlas natifs.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant ce
lot, restent signalées par \`npm ci\`.

## Disposition C1

Qualifié dans cette tranche :

- ownership du coordinateur par le host produit ;
- format navigateur versionné et validé ;
- restauration dans un host frais avant nouvelle décision ;
- continuité d'une session réglée entre deux activations du contrôleur ;
- conservation du \`sessionId\` et du compteur d'actions ;
- rejet d'un checkpoint obsolète ;
- conservation d'un retour réellement envoyé ;
- acquisition du même \`needId\` sans double action ni double présentation ;
- restauration conjointe de FieldStock et de son contexte public.

Disposition :

**le checkpoint est raccordé au host et au contrôleur dans les contrats produit
TypeScript. Une frontière réglée peut reprendre avec un host frais. Le host peut
aussi acquérir un retour déjà physiquement envoyé sans rejouer l'action.**

## Frontière de preuve

Cette tranche ne revendique pas encore :

- une désactivation/réactivation exécutée dans Chrome ;
- un stockage durable dans IndexedDB, localStorage ou un service externe ;
- la conservation lors de \`pagehide\`, d'un crash ou d'un nouveau processus ;
- une capture automatique par le contrôleur pendant que son appel physique est
  encore en vol : la preuve de cette frontière est portée directement par le
  host ;
- la reprise d'une observation avancée arbitraire sans besoin physique corrélé ;
- une qualification de surcharge de performance ;
- une publication Site.

Le checkpoint du contrôleur reste actuellement en mémoire. \`dispose()\` le
supprime volontairement. La preuve est donc une qualification des contrats
produit et de leur causalité, pas encore une preuve de persistance navigateur
inter-processus.

## Performance

Les opérations de snapshot et restauration ne sont pas appelées dans chaque tour
de décision. Elles n'appartiennent pas à l'ancienne preuve C7 Region et aucune
mesure de surcharge n'est revendiquée dans cette tranche.

## Publication

Aucune publication Site n'est effectuée. Le code et les preuves restent sur
GitHub jusqu'à une tranche visible explicitement qualifiée depuis le canonique.

## Étape suivante

1. définir une politique de stockage durable et d'expiration du checkpoint ;
2. associer le checkpoint à l'identité du jeu et à la génération produit ;
3. conserver une frontière sûre lors de \`pagehide\` sans annuler le besoin
   physiquement envoyé ;
4. exécuter une vraie désactivation/réactivation dans Chrome contre Pyodide ;
5. vérifier dans cette fixture l'absence de double ACTION6, double acquisition,
   double présentation et perte de \`needId\` ;
6. mesurer séparément le coût de la continuité active avant toute revendication
   de performance.
`;

await writeFile(
  'docs/recovery/op01-op31-browser-session-resume-20261113.md',
  report,
);

let progress = await readFile('docs/migration/op01-op31-progress.md', 'utf8');
progress = replaceOnce(
  progress,
  "- Noyau de continuité de session :\n  `docs/recovery/op01-op31-session-continuity-core-20261113.md`\n- Lot 9C2 public conjoint :",
  "- Noyau de continuité de session :\n  `docs/recovery/op01-op31-session-continuity-core-20261113.md`\n- Raccord navigateur de la continuité :\n  `docs/recovery/op01-op31-browser-session-resume-20261113.md`\n- Lot 9C2 public conjoint :",
  'browser resume reference',
);
progress = replaceOnce(
  progress,
  "- une restauration atomique avec rollback en cas de refus d'un participant ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.",
  "- une restauration atomique avec rollback en cas de refus d'un participant ;\n- un raccord qualifié du checkpoint au host produit et au contrôleur Agent ;\n- une reprise host d'un retour physiquement envoyé sans rejouer l'action ;\n- une qualification C7 officielle du hook Region natif sur STCK et SMLP.",
  'global browser resume bullets',
);
progress = replaceOnce(
  progress,
  "Le noyau de continuité sait maintenant restaurer le\n`needId`, l'action en attente, la déduplication et FieldStock sans double\nacquisition. Son raccord au host et au contrôleur navigateur, une campagne de\nrésolution produit complète, le coût ciblé de la nouvelle composition et OP31\nrestent ouverts.",
  "Le noyau de continuité restaure le `needId`, l'action en attente, la\ndéduplication et FieldStock sans double acquisition. Le host et le contrôleur\nrestaurent désormais une frontière réglée dans une instance fraîche ; le host\npeut aussi acquérir un retour physiquement envoyé sans rejouer l'action. Le\nstockage durable, la preuve Chrome réelle, une campagne de résolution produit\ncomplète, le coût ciblé de la nouvelle composition et OP31 restent ouverts.",
  'global browser resume status',
);
progress = replaceOnce(
  progress,
  "- `src/runtime/observed-addressed-material-checkpoint.ts` : participant\n  explicite du runtime FieldStock.",
  "- `src/runtime/observed-addressed-material-checkpoint.ts` : participant\n  explicite du runtime FieldStock ;\n- `src/runtime/v6-browser-campaign-checkpoint.ts` : identité et validation du\n  checkpoint produit, y compris la frontière physique déjà envoyée.",
  'runtime architecture checkpoint file',
);
progress = replaceOnce(
  progress,
  "| C1 | **contrôleur produit actif ; noyau de checkpoint qualifié** | campagne unique, même `needId`, acquisition sélectionnée avant observation passive ; snapshot/restauration de la campagne, du retour en attente, de la déduplication et de FieldStock ; rollback atomique | raccorder le checkpoint au host et au contrôleur, puis qualifier une désactivation/réactivation navigateur réelle |",
  "| C1 | **checkpoint raccordé au host et au contrôleur dans les contrats produit** | reprise d'une session réglée dans un host frais ; même `sessionId` et compteur ; rejet stale ; retour physiquement envoyé acquis avec le même `needId` sans replay ni seconde présentation | stockage durable et désactivation/réactivation réelle dans Chrome/Pyodide |",
  'C1 status row',
);
progress = replaceOnce(
  progress,
  "- fermeture `disposed` stable pendant `pagehide`.\n\nLe mode Manual reste direct",
  "- fermeture `disposed` stable pendant `pagehide` ;\n- conservation en mémoire d'un checkpoint aux frontières sûres ;\n- restauration dans un host frais avant toute nouvelle décision ;\n- refus d'une observation réglée obsolète ;\n- statut `resumed` sans nouvelle action physique pour un retour déjà envoyé.\n\nLe mode Manual reste direct",
  'controller guarantees',
);
progress = replaceOnce(
  progress,
  "- le noyau de persistance du modèle, du prior et du stock n'est pas encore appelé\n  entre deux activations Agent ;\n- snapshot/restauration de la campagne, des propriétaires, du `needId` et de\n  l’action en attente non raccordés au host et au contrôleur produit ;",
  "- le checkpoint du contrôleur reste en mémoire et n'est pas conservé lors de\n  `pagehide`, d'un crash ou d'un nouveau processus ;\n- le host qualifie la frontière d'une action déjà envoyée, mais le contrôleur\n  gracieux attend encore le retour en vol avant de s'arrêter ;\n- aucune désactivation/réactivation réelle dans Chrome n'est encore qualifiée ;",
  'open continuity limits',
);
progress = replaceOnce(
  progress,
  "- registre canonique des 76 points d’entrée V6 absent ;",
  "- registre courant V6 reconstruit, mais inventaire canonique complet des 76\n  points d'entrée non démontré ;",
  'entry registry status',
);
progress = replaceOnce(
  progress,
  "### Étape immédiate : raccorder la continuité au navigateur\n\n1. faire posséder le coordinateur de checkpoint par le host produit ;\n2. exposer snapshot et restauration sans dupliquer la politique de campagne ;\n3. recréer un host et un runtime FieldStock frais lors de la réactivation Agent ;\n4. restaurer avant toute nouvelle décision et vérifier l'observation courante ;\n5. reprendre un retour en attente sans rejouer l'action ;\n6. prouver dans une fixture navigateur réelle l'absence de perte de `needId`,\n   de double acquisition et de double ACTION6.",
  "### Étape immédiate : persistance durable et fixture navigateur réelle\n\n1. définir un stockage durable versionné avec politique d'expiration ;\n2. lier le checkpoint au jeu et à la génération produit courante ;\n3. conserver une frontière sûre lors de `pagehide` sans annuler un retour déjà\n   physiquement envoyé ;\n4. exécuter une désactivation/réactivation réelle dans Chrome contre Pyodide ;\n5. vérifier l'absence de perte de `needId`, de double acquisition, de double\n   présentation et de double ACTION6 ;\n6. mesurer ensuite le coût de la continuité active.",
  'immediate roadmap',
);
progress = replaceOnce(
  progress,
  "Cette qualification porte sur le noyau. Le host et le contrôleur navigateur ne\nl'appellent pas encore, et aucune surcharge produit n'est revendiquée.\n\n## Requalification C7 du contrat de configuration canonique",
  `Cette qualification initiale porte sur le noyau. Son raccord produit est\ndésormais qualifié par la section suivante. Aucune surcharge produit n'est\nrevendiquée.\n\n## Qualification du raccord navigateur C1\n\nLe raccord a été requalifié après intégration du canonique \`${CANONICAL_INCLUDED}\`\npar le run \`${runId}\`, job \`${jobId}\`.\n\nRésultats :\n\n- tests ciblés continuité navigateur : **${targeted.tests}/${targeted.pass}** ;\n- régression TypeScript complète : **${full.tests}/${full.pass}** ;\n- échecs, annulations, ignorés et TODO : \`0\` ;\n- build de production : réussi ;\n- modules transformés : \`${build.modulesTransformed}\` ;\n- galerie : \`${build.games}\` jeux, \`${build.levelPreviews}\` prévisualisations,\n  \`${build.nativeAtlases}\` atlas ;\n- même session restaurée dans un host frais sans nouvelle action ;\n- checkpoint obsolète refusé avant réutilisation ;\n- même \`needId\` acquis après un retour physiquement envoyé ;\n- aucune répétition de l'action ni de la présentation dans cette reprise.\n\nPreuve durable :\n\`docs/recovery/op01-op31-browser-session-resume-20261113.md\`.\n\nLa preuve reste contractuelle sous Node. Le stockage durable et la fixture Chrome\nréelle restent ouverts.\n\n## Requalification C7 du contrat de configuration canonique`,
  'browser resume qualification section',
);
await writeFile('docs/migration/op01-op31-progress.md', progress);

console.log(JSON.stringify({ targeted, full, build, runId, jobId }, null, 2));
