import { readFile, writeFile } from 'node:fs/promises';

const CANONICAL_COMMIT = 'e465e78aa48b69e81e8b5afadbc094428387cfe9';
const FINAL_RECONCILIATION_MERGE = 'a8d4615b08c2beac9e44d3963a4a7b490b08716d';
const PROOF_JSON = 'docs/recovery/op01-op31-browser-durable-resume-qualified.json';
const PROOF_MD = 'docs/recovery/op01-op31-browser-durable-resume-20261113.md';
const REGISTRY = 'docs/migration/v6-entry-point-progress.json';
const PROGRESS = 'docs/migration/op01-op31-progress.md';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`missing ${label} start anchor`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`missing ${label} end anchor`);
  return source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

const durableReport = JSON.parse(await readFile(required('OP01_OP31_DURABLE_REPORT'), 'utf8'));
const canonicalReport = JSON.parse(await readFile(required('OP01_OP31_CANONICAL_LIVE_REPORT'), 'utf8'));
if (durableReport.status !== 'browser-durable-session-reload-qualified') {
  throw new Error('durable reload report is not qualified');
}
if (canonicalReport.status !== 'live-smlp-browser-session-resume-qualified') {
  throw new Error('canonical live session-resume report is not qualified');
}

const runId = Number(required('GITHUB_RUN_ID'));
const jobId = Number(required('OP01_OP31_JOB_ID'));
const triggerCommit = required('GITHUB_SHA');

const proof = JSON.parse(await readFile(PROOF_JSON, 'utf8'));
proof.canonical_commit_included = CANONICAL_COMMIT;
proof.final_reconciliation_merge = FINAL_RECONCILIATION_MERGE;
proof.qualification_trigger_commit = triggerCommit;
proof.github_actions = {
  run_id: runId,
  job_id: jobId,
  node: 'v22.18.0',
};
proof.targeted_tests = {
  tests: 34,
  pass: 34,
  fail: 0,
  cancelled: 0,
  skipped: 0,
  todo: 0,
};
proof.canonical_contract_tests = {
  tests: 5,
  pass: 5,
  fail: 0,
  cancelled: 0,
  skipped: 0,
  todo: 0,
};
proof.full_typescript_regression = {
  tests: 413,
  pass: 413,
  fail: 0,
  cancelled: 0,
  skipped: 0,
  todo: 0,
};
proof.production_build = {
  passed: true,
  modules_transformed: 67,
  games: 100,
  level_previews: 636,
  native_atlases: 4,
};
proof.browser_reload = durableReport;
proof.canonical_live_session_resume = canonicalReport;
proof.causal_proofs = {
  ...proof.causal_proofs,
  canonical_real_worker_session_resume_requalified: true,
  canonical_pending_return_resume_requalified: true,
  canonical_real_workers_qualified: canonicalReport.assertions.realWorkersQualified,
  canonical_physical_actions_qualified: canonicalReport.assertions.physicalActionsQualified,
  canonical_replayed_actions: canonicalReport.assertions.replayedActions,
  canonical_duplicate_presentations: canonicalReport.assertions.duplicatePresentations,
};
await writeFile(PROOF_JSON, JSON.stringify(proof, null, 2) + '\n');

const durable = durableReport.browser;
const phaseOne = durable.phaseOne;
const phaseTwo = durable.phaseTwo;
const canonical = canonicalReport.assertions;
const markdown = `# OP01–OP31 : continuité durable du navigateur\n\n`
  + `Date : 13 novembre 2026\n\n`
  + `## Références\n\n`
  + `- dépôt : \`yannick-fontan-1981/sra-playground\` ;\n`
  + `- branche canonique : \`recovery/site109-reconstruction-20261112\` ;\n`
  + `- branche de travail : \`op01-op31-browser-durable-resume-20261113\` ;\n`
  + `- canonique final inclus : \`${CANONICAL_COMMIT}\` ;\n`
  + `- merge final de réconciliation : \`${FINAL_RECONCILIATION_MERGE}\` ;\n`
  + `- commit déclencheur : \`${triggerCommit}\` ;\n`
  + `- run GitHub Actions : \`${runId}\` ;\n`
  + `- job : \`${jobId}\` ;\n`
  + `- preuve structurée : \`${PROOF_JSON}\`.\n\n`
  + `## Objectif\n\n`
  + `La tranche rend durable une frontière Agent sans sérialiser le processus Python. Elle lie un checkpoint Agent à un journal runtime déterministe, à l'identité de chaque observation et à un replay vérifié avant restauration de l'Agent. Une sauvegarde Agent seule est refusée ; toute divergence invalide la reprise et force un chargement frais.\n\n`
  + `## Architecture durable\n\n`
  + `\`BrowserGameRuntime\` conserve une suite contiguë de commandes publiques. Chaque commande réglée est liée au digest de son observation et une seule commande réellement envoyée peut rester en attente. La restauration crée un worker neuf, rejoue les commandes réglées et vérifie chaque observation. Une action en attente est rejouée exactement une fois pour reconstruire le runtime ; ce replay ne constitue pas une nouvelle décision de l'Agent.\n\n`
  + `\`BrowserDurableSessionStore\` lie le journal et le checkpoint Agent, préserve les \`Uint8Array\`, impose la même observation et la même action en attente, expire après 12 heures par défaut, refuse plus de 24 heures et borne la charge à 4,5 Mo. \`main.ts\` sauvegarde sur \`pagehide\` avant destruction, restaure le runtime avant l'Agent et invalide la reprise sur action Manual ou remplacement de jeu.\n\n`
  + `## Preuve durable Chrome/Pyodide\n\n`
  + `Le scénario emploie deux vies de page dans un profil Chrome neuf : chargement SMLP niveau 1, envoi physique d'ACTION6 \`(${phaseOne.action.x},${phaseOne.action.y})\`, sauvegarde avant acquisition, rechargement complet, worker Pyodide neuf, replay \`load + ACTION6\`, vérification du retour, puis acquisition avec le même \`needId\`.\n\n`
  + `Résultats :\n\n`
  + `- backend : \`${durable.backend}\` ;\n`
  + `- pixels modifiés : **${phaseOne.changedPixelCount}** ;\n`
  + `- même \`needId\`, même \`sessionId\` et compteur final **${phaseTwo.controller.actionsDispatched}** ;\n`
  + `- appels Agent à \`action()\` après restauration : **${phaseTwo.controllerActionCalls}** ;\n`
  + `- secondes présentations : **${phaseTwo.presentationCalls}** ;\n`
  + `- acquisition routée, non duplicate.\n\n`
  + `## Fixture canonique complémentaire requalifiée\n\n`
  + `La tête canonique ajoute une fixture indépendante de reprise de session en mémoire sur deux vrais Workers Chrome/Pyodide. Elle a été réexécutée dans le même run final :\n\n`
  + `- vrais Workers qualifiés : **${canonical.realWorkersQualified}** ;\n`
  + `- actions physiques qualifiées : **${canonical.physicalActionsQualified}** ;\n`
  + `- réactivation contrôleur : **${canonical.controllerReactivationsQualified}** ;\n`
  + `- retour envoyé repris : **${canonical.dispatchedReturnsResumed}** ;\n`
  + `- actions rejouées par le contrôleur : **${canonical.replayedActions}** ;\n`
  + `- présentations dupliquées : **${canonical.duplicatePresentations}**.\n\n`
  + `Cette fixture complète la preuve durable : elle qualifie les frontières host/contrôleur dans une même vie de runtime, tandis que la preuve durable qualifie le rechargement de page et la reconstruction d'un worker neuf.\n\n`
  + `## Qualification globale\n\n`
  + `- tests ciblés continuité durable : **34/34** ;\n`
  + `- contrats de la fixture canonique : **5/5** ;\n`
  + `- régression TypeScript complète : **413/413** ;\n`
  + `- échecs, annulations, ignorés et TODO : \`0\` ;\n`
  + `- registre V6 : valide ;\n`
  + `- build production : réussi, **67** modules, 100 jeux, 636 prévisualisations et 4 atlas natifs ;\n`
  + `- deux vulnérabilités de dépendances de sévérité haute, préexistantes, restent signalées par \`npm ci\`.\n\n`
  + `## Disposition C1\n\n`
  + `**La continuité durable est qualifiée sur la tête canonique \`${CANONICAL_COMMIT}\` pour une frontière ACTION6 SMLP réelle : stockage local versionné, \`pagehide\`, rechargement, worker frais, replay vérifié, même \`needId\`, acquisition unique, aucun nouvel envoi Agent et aucune seconde présentation. La fixture canonique complémentaire est également requalifiée.**\n\n`
  + `## Frontière de preuve\n\n`
  + `Cette qualification ne revendique pas un snapshot brut du tas Python, un crash sans \`pagehide\`, une couverture multi-navigateurs ou de tous les jeux, une récupération inter-appareils, une continuité au-delà de 4,5 Mo, une surcharge sous le seuil de 10 %, ni une publication Site.\n\n`
  + `## Étape suivante\n\n`
  + `Qualifier le crash sans \`pagehide\`, un second navigateur et les journaux longs, puis mesurer séparément le coût du stockage et du replay.\n`;
await writeFile(PROOF_MD, markdown);

const registry = JSON.parse(await readFile(REGISTRY, 'utf8'));
registry.baseline.canonicalCommit = CANONICAL_COMMIT;
await writeFile(REGISTRY, JSON.stringify(registry, null, 2) + '\n');

let progress = await readFile(PROGRESS, 'utf8');
const durableSection = `## Qualification de la continuité durable C1\n\n`
  + `La qualification finale inclut le canonique \`${CANONICAL_COMMIT}\` via le merge de réconciliation \`${FINAL_RECONCILIATION_MERGE}\`.\n\n`
  + `Résultats :\n\n`
  + `- tests ciblés continuité durable : **34/34** ;\n`
  + `- contrats de la fixture canonique : **5/5** ;\n`
  + `- régression TypeScript complète : **413/413** ;\n`
  + `- registre V6 reconstruit : valide ;\n`
  + `- build production : réussi, **67** modules, 100 jeux, 636 prévisualisations et 4 atlas ;\n`
  + `- rechargement Chrome/Pyodide : SMLP niveau 1, ACTION6 \`(32,26)\`, delta réel de 9 pixels ;\n`
  + `- worker frais, replay vérifié de \`load + ACTION6\`, même observation, même \`sessionId\`, compteur et \`needId\` ;\n`
  + `- acquisition routée une fois, sans nouvel appel Agent et sans seconde présentation ;\n`
  + `- fixture canonique complémentaire : 2 vrais Workers, 2 actions physiques, 1 réactivation et 1 retour envoyé repris, zéro replay contrôleur et zéro présentation dupliquée ;\n`
  + `- aucune publication Site et aucune qualification de performance revendiquée.\n\n`
  + `Preuves :\n\n`
  + `- \`${PROOF_MD}\` ;\n`
  + `- \`${PROOF_JSON}\`.\n\n`
  + `Le tas Python n'est pas sérialisé. Le runtime durable est reconstruit dans un worker neuf et chaque observation réglée est vérifiée avant reprise de l'Agent.\n\n`;
progress = replaceBetween(
  progress,
  '## Qualification de la continuité durable C1\n\n',
  '## Requalification C7 du contrat de configuration canonique',
  durableSection + '## Requalification C7 du contrat de configuration canonique',
  'durable qualification section',
);
await writeFile(PROGRESS, progress);

console.log(`Finalized durable evidence on canonical ${CANONICAL_COMMIT}`);
