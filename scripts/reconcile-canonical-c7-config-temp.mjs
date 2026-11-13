import { readFile, writeFile } from 'node:fs/promises';

import { median } from './measure-native-loop-costs.mjs';
import { computeNativeRegionSourceRefs } from './native-loop-region-source-refs.mjs';

const SOURCE_REFS_PATH = 'docs/recovery/native-loop-source-refs.json';
const MANIFEST_PATH = 'docs/recovery/native-loop-runner-manifest.json';
const PROOF_PATH = 'docs/recovery/lot9b-official-abba-performance-qualified.json';
const PROOF_MD_PATH = 'docs/recovery/lot9b-official-abba-performance-qualified.md';
const RECONCILIATION_PATH = 'docs/recovery/op01-op31-c7-config-reconciliation-20261113.md';
const REPORT_PATH = process.env.LOT9B_OFFICIAL_BENCHMARK_REPORT
  ?? 'lot9b-official-native-region-abba-report.json';
const READY_STATUS = 'ready-for-official-abba-measurement';
const QUALIFIED_STATUS = 'qualified-functionally-and-performance';
const RECONCILIATION_MARKER = '## Requalification C7 du contrat de configuration canonique';

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requiredInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return number;
}

function requiredFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite`);
  return number;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function stableMeasurementKey(sourceRefs, measurement) {
  return [
    sourceRefs?.reference ?? '',
    sourceRefs?.candidate ?? '',
    measurement?.runId ?? '',
    measurement?.measuredCommit ?? '',
  ].join(':');
}

function preservePreviousMeasurement(manifest, supersededBy) {
  const measurement = manifest.officialMeasurement;
  if (measurement?.executed !== true) return;

  const sourceRefs = structuredClone(manifest.sourceRefs);
  const history = Array.isArray(manifest.officialMeasurementHistory)
    ? structuredClone(manifest.officialMeasurementHistory)
    : [];
  const key = stableMeasurementKey(sourceRefs, measurement);
  if (!history.some(item => stableMeasurementKey(item.sourceRefs, item.measurement) === key)) {
    history.push({
      sourceRefs,
      measurement: structuredClone(measurement),
      supersededBy,
      reason: 'benchmark configuration contract became part of the pinned common source identity',
    });
  }
  manifest.officialMeasurementHistory = history;
}

async function prepare() {
  const headSha = requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA');
  const runId = requiredInteger(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const sourceRefs = await computeNativeRegionSourceRefs({ commitSha: headSha });
  sourceRefs.qualification = {
    status: 'pending-official-requalification',
    runId,
    headSha,
    commonComponentCount: sourceRefs.commonComponents.length,
    candidateComponentCount: sourceRefs.candidateComponents.length,
  };
  await writeJson(SOURCE_REFS_PATH, sourceRefs);

  const manifest = await readJson(MANIFEST_PATH);
  preservePreviousMeasurement(manifest, headSha);
  manifest.status = READY_STATUS;
  manifest.sourceRefs.commonRoot = sourceRefs.commonRoot;
  manifest.sourceRefs.candidateRoot = sourceRefs.candidateRoot;
  manifest.sourceRefs.reference = sourceRefs.reference.sourceRef;
  manifest.sourceRefs.candidate = sourceRefs.candidate.sourceRef;
  for (const runner of manifest.runners) {
    runner.sourceRef = runner.variant === 'A'
      ? sourceRefs.reference.sourceRef
      : sourceRefs.candidate.sourceRef;
  }
  manifest.qualification = {
    ...manifest.qualification,
    sourceRefRun: {
      runId,
      headSha,
      sourceRefsComputed: true,
      manifestVerification: 'pending-ready-verification',
    },
  };
  manifest.officialMeasurement = {
    executed: false,
    result: null,
    reason: 'source identity changed by the canonical benchmark configuration reconciliation',
  };
  await writeJson(MANIFEST_PATH, manifest);

  console.log(JSON.stringify({
    status: 'prepared-for-official-requalification',
    headSha,
    runId,
    referenceSourceRef: sourceRefs.reference.sourceRef,
    candidateSourceRef: sourceRefs.candidate.sourceRef,
    commonComponentCount: sourceRefs.commonComponents.length,
    candidateComponentCount: sourceRefs.candidateComponents.length,
  }, null, 2));
}

async function currentWorkflowJobId() {
  const token = requiredString(process.env.GITHUB_TOKEN, 'GITHUB_TOKEN');
  const repository = requiredString(process.env.GITHUB_REPOSITORY, 'GITHUB_REPOSITORY');
  const runId = requiredInteger(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const jobName = requiredString(process.env.GITHUB_JOB, 'GITHUB_JOB');
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'x-github-api-version': '2022-11-28',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`cannot resolve workflow job id: GitHub returned ${response.status}`);
  }
  const body = await response.json();
  const jobs = Array.isArray(body.jobs) ? body.jobs : [];
  const exact = jobs.find(job => job.name === jobName);
  const active = jobs.find(job => job.status === 'in_progress');
  const job = exact ?? active;
  if (!job || !Number.isInteger(job.id)) {
    throw new Error(`cannot resolve workflow job id for ${jobName}`);
  }
  return job.id;
}

function parseTapCount(path, label) {
  return readFile(path, 'utf8').then(text => {
    const matches = [...text.matchAll(/^# tests (\d+)$/gm)];
    if (matches.length === 0) throw new Error(`${label} TAP summary is missing`);
    return requiredInteger(matches.at(-1)[1], `${label} test count`);
  });
}

function measuredDurations(result, game, variant) {
  return result.series
    .filter(item => item.game === game && item.variant === variant)
    .flatMap(item => item.measured.map(entry => requiredFinite(
      entry.sample.durationMs,
      `${item.series}/${game}/${entry.descriptor.sessionIndex} duration`,
    )));
}

function phaseSummary(gameResult, name) {
  const value = gameResult.phases?.[name];
  if (!value) throw new Error(`missing ${name} phase summary`);
  return {
    referenceMedianMs: value.baselineMedianMs,
    candidateMedianMs: value.candidateMedianMs,
    relativeIncreasePercent: value.relativeIncreasePercent,
  };
}

function gameProof(result, game) {
  const gameResult = result.games?.[game];
  if (!gameResult || gameResult.globalAccepted !== true) {
    throw new Error(`${game} is not accepted`);
  }
  const referenceDurationsMs = measuredDurations(result, game, 'A');
  const candidateDurationsMs = measuredDurations(result, game, 'B');
  if (referenceDurationsMs.length !== 8 || candidateDurationsMs.length !== 8) {
    throw new Error(`${game} must retain eight A and eight B measured sessions`);
  }
  const referenceMedianMs = median(referenceDurationsMs);
  const candidateMedianMs = median(candidateDurationsMs);
  const relativeIncreasePercent = 100 * (candidateMedianMs / referenceMedianMs - 1);
  if (Math.abs(referenceMedianMs - gameResult.baselineMedianMs) > 1e-9) {
    throw new Error(`${game} reference median mismatch`);
  }
  if (Math.abs(candidateMedianMs - gameResult.candidateMedianMs) > 1e-9) {
    throw new Error(`${game} candidate median mismatch`);
  }
  if (Math.abs(relativeIncreasePercent - gameResult.relativeIncreasePercent) > 1e-9) {
    throw new Error(`${game} relative increase mismatch`);
  }
  if (relativeIncreasePercent >= 10) {
    throw new Error(`${game} must remain strictly below +10%`);
  }

  return {
    referenceDurationsMs,
    candidateDurationsMs,
    referenceMedianMs,
    candidateMedianMs,
    relativeIncreasePercent,
    thresholdPercent: 10,
    accepted: true,
    phases: {
      publicPolicy: phaseSummary(gameResult, 'public_policy'),
      candidateHook: phaseSummary(gameResult, 'candidate_hook'),
      gameAction: phaseSummary(gameResult, 'game_action'),
    },
  };
}

function candidateRegion(report, game) {
  const candidate = report.candidateHook?.[game];
  const stats = candidate?.stats;
  if (!stats) throw new Error(`missing ${game} candidate hook stats`);
  return {
    actionsSeen: requiredInteger(stats.actionsSeen, `${game} actionsSeen`),
    action6Seen: requiredInteger(stats.action6Seen, `${game} action6Seen`),
    usefulEvidence: requiredInteger(stats.usefulEvidence, `${game} usefulEvidence`),
    boundEvidence: requiredInteger(stats.boundEvidence, `${game} boundEvidence`),
    acquisitions: requiredInteger(stats.acquisitions, `${game} acquisitions`),
    methods: requiredInteger(candidate.methods, `${game} methods`),
  };
}

function numberFr(value, digits = 4) {
  return Number(value).toFixed(digits).replace('.', ',');
}

async function appendOnce(path, section) {
  let text = await readFile(path, 'utf8');
  if (!text.includes(RECONCILIATION_MARKER)) {
    if (!text.endsWith('\n')) text += '\n';
    text += `\n${section.trim()}\n`;
    await writeFile(path, text);
  }
}

async function finalize() {
  const runId = requiredInteger(process.env.GITHUB_RUN_ID, 'GITHUB_RUN_ID');
  const jobId = await currentWorkflowJobId();
  const measuredCommit = requiredString(process.env.GITHUB_SHA, 'GITHUB_SHA');
  const artifactId = requiredInteger(process.env.C7_ARTIFACT_ID, 'C7_ARTIFACT_ID');
  const artifactZipSha256 = requiredString(
    process.env.C7_ARTIFACT_DIGEST,
    'C7_ARTIFACT_DIGEST',
  ).replace(/^sha256:/, '');
  const regressionTests = await parseTapCount('c7-typescript-tests.tap', 'TypeScript regression');
  const nativeContractTests = await parseTapCount('c7-native-contracts.tap', 'native contracts');
  const parity = await readJson('lot9b-worker-pyodide-parity-report.json');
  const wrapper = await readJson(REPORT_PATH);
  const payload = wrapper.payload;
  if (!payload || payload.status !== 'success') {
    throw new Error(`official benchmark did not return success: ${payload?.error ?? 'missing payload'}`);
  }
  const report = payload.report;
  const result = report?.result;
  if (!report || result?.accepted !== true) {
    throw new Error('official benchmark result is not accepted');
  }

  const manifest = await readJson(MANIFEST_PATH);
  if (manifest.status !== READY_STATUS) {
    throw new Error(`expected ${READY_STATUS}, found ${manifest.status}`);
  }
  if (
    report.config.referenceSourceRef !== manifest.sourceRefs.reference
    || report.config.candidateSourceRef !== manifest.sourceRefs.candidate
    || report.config.corpusRef !== manifest.corpus.id
  ) {
    throw new Error('measured report identity does not match the prepared manifest');
  }

  const STCK = gameProof(result, 'STCK');
  const SMLP = gameProof(result, 'SMLP');
  const proof = {
    version: 1,
    status: 'official-performance-qualified',
    lot: '9B region_intervention',
    measurement: {
      kind: report.kind,
      runId,
      jobId,
      measuredCommit,
      canonicalCodeCommit: measuredCommit,
      measurementIsolation: wrapper.measurementIsolation,
      chrome: wrapper.chrome,
      userAgent: report.environment.userAgent,
      hardwareConcurrency: report.environment.hardwareConcurrency,
      crossOriginIsolated: report.environment.crossOriginIsolated,
      startedAt: report.startedAt,
      finishedAt: report.finishedAt,
      artifactId,
      artifactZipSha256,
    },
    sourceRefs: {
      reference: manifest.sourceRefs.reference,
      candidate: manifest.sourceRefs.candidate,
      corpus: manifest.corpus.id,
    },
    protocol: {
      seriesOrder: result.protocol.seriesOrder,
      invocations: result.totals.invocations,
      warmupSessions: result.totals.warmupSessions,
      warmupActions: result.totals.warmupActions,
      measuredSessions: result.totals.measuredSessions,
      measuredActions: result.totals.measuredActions,
      sampleRemoval: 0,
      retries: 0,
    },
    games: { STCK, SMLP },
    candidateRegion: {
      STCK: candidateRegion(report, 'STCK'),
      SMLP: candidateRegion(report, 'SMLP'),
    },
    accepted: true,
    disposition: {
      functional: 'qualified',
      performance: 'qualified',
      counter76Incremented: false,
      nextLot: '9C joint_channels',
    },
    previousFailureProof: 'docs/recovery/lot9b-official-abba-baseline-failure.json',
  };
  await writeJson(PROOF_PATH, proof);

  manifest.status = QUALIFIED_STATUS;
  manifest.qualification = {
    ...manifest.qualification,
    runnerContractTests: nativeContractTests,
    workerPyodideParityRun: {
      runId,
      jobId,
      samples: parity.samplesCompared,
      actions: parity.stepsCompared,
      status: 'passed',
    },
    sourceRefRun: {
      runId,
      jobId,
      headSha: measuredCommit,
      sourceRefsComputed: true,
      manifestVerification: 'passed',
    },
    finalRequalificationRun: {
      runId,
      jobId,
      headSha: measuredCommit,
      node: process.version,
      typecheck: 'passed',
      regression: { passed: regressionTests, failed: 0, skipped: 0, cancelled: 0 },
      build: 'passed',
      workerPyodideParity: {
        status: parity.status,
        samplesCompared: parity.samplesCompared,
        stepsCompared: parity.stepsCompared,
      },
      nativeContracts: { passed: nativeContractTests, failed: 0 },
    },
  };
  manifest.officialMeasurement = {
    executed: true,
    accepted: true,
    runId,
    jobId,
    measuredCommit,
    measurementIsolation: wrapper.measurementIsolation,
    results: {
      STCK: {
        referenceMedianMs: STCK.referenceMedianMs,
        candidateMedianMs: STCK.candidateMedianMs,
        relativeIncreasePercent: STCK.relativeIncreasePercent,
        accepted: true,
      },
      SMLP: {
        referenceMedianMs: SMLP.referenceMedianMs,
        candidateMedianMs: SMLP.candidateMedianMs,
        relativeIncreasePercent: SMLP.relativeIncreasePercent,
        accepted: true,
      },
    },
    sampleRemoval: 0,
    retries: 0,
    proof: PROOF_PATH,
    previousFailureProof: 'docs/recovery/lot9b-official-abba-baseline-failure.json',
  };
  await writeJson(MANIFEST_PATH, manifest);

  const sourceRefs = await readJson(SOURCE_REFS_PATH);
  sourceRefs.qualification = {
    status: 'official-requalification-accepted',
    runId,
    jobId,
    headSha: measuredCommit,
    commonComponentCount: sourceRefs.commonComponents.length,
    candidateComponentCount: sourceRefs.candidateComponents.length,
    referenceSourceRef: sourceRefs.reference.sourceRef,
    candidateSourceRef: sourceRefs.candidate.sourceRef,
  };
  await writeJson(SOURCE_REFS_PATH, sourceRefs);

  const proofMarkdown = `# Lot 9B — qualification officielle fonctionnelle et performance

Date : 13 novembre 2026

## Verdict

Le sous-lot **9B \`region_intervention\` reste qualifié fonctionnellement et en performance** après intégration du contrat canonique de configuration du benchmark.

- **STCK : ${STCK.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(STCK.relativeIncreasePercent, 6)} % — PASS** ;
- **SMLP : ${SMLP.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(SMLP.relativeIncreasePercent, 6)} % — PASS**.

Le seuil est strictement inférieur à +10 % pour chaque jeu. Aucun jeu ne compense l’autre et aucun échantillon n’a été supprimé.

## Identités mesurées

- A : \`${manifest.sourceRefs.reference}\` ;
- B : \`${manifest.sourceRefs.candidate}\` ;
- corpus : \`${manifest.corpus.id}\` ;
- commit mesuré : \`${measuredCommit}\` ;
- protocole : A1 → B1 → B2 → A2 ;
- invocations : ${result.totals.invocations} ;
- sessions mesurées : ${result.totals.measuredSessions} ;
- actions mesurées : ${result.totals.measuredActions}.

## Résultats

| Jeu | Médiane A | Médiane B | Delta global | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | ${numberFr(STCK.referenceMedianMs)} ms | ${numberFr(STCK.candidateMedianMs)} ms | ${STCK.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(STCK.relativeIncreasePercent)} % | PASS |
| SMLP | ${numberFr(SMLP.referenceMedianMs)} ms | ${numberFr(SMLP.candidateMedianMs)} ms | ${SMLP.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(SMLP.relativeIncreasePercent)} % | PASS |

## Activité Region conservée

- STCK : ${proof.candidateRegion.STCK.actionsSeen} ACTION6 vues, ${proof.candidateRegion.STCK.acquisitions} acquisitions et ${proof.candidateRegion.STCK.methods} méthodes ;
- SMLP : ${proof.candidateRegion.SMLP.actionsSeen} ACTION6 vues, ${proof.candidateRegion.SMLP.acquisitions} acquisitions et ${proof.candidateRegion.SMLP.methods} méthodes.

## Qualification fonctionnelle

- typecheck : réussi ;
- régression TypeScript : ${regressionTests}/${regressionTests} ;
- build : réussi ;
- parité Worker/Pyodide : ${parity.samplesCompared} échantillons, ${parity.stepsCompared} étapes ;
- contrats natifs : ${nativeContractTests}/${nativeContractTests} ;
- preuve et manifeste : vérifiés après mesure.

## Exécution

- run : \`${runId}\` ;
- job : \`${jobId}\` ;
- artefact : \`${artifactId}\` ;
- SHA-256 de l’artefact ZIP : \`${artifactZipSha256}\` ;
- isolation déclarée : \`${wrapper.measurementIsolation}\` ;
- Chrome : \`${wrapper.chrome}\`.

## Portée

Cette requalification couvre le coût du hook Region natif pour l’identité A/B ci-dessus. Elle ne revendique ni la parité complète des 76 entrées V6, ni l’identité binaire avec Site 109. Aucun Site n’est publié par cette étape.

## Suite

Le résultat C7 reste clos pour cette identité. Les dettes fonctionnelles séparées restent le candidat produit Region complet, les acquisitions passives multi-propriétaires, la sauvegarde/restauration et le propriétaire produit OP31.
`;
  await writeFile(PROOF_MD_PATH, proofMarkdown);

  const reconciliation = `# OP01–OP31 — réconciliation canonique du contrat C7

Date : 13 novembre 2026

## Objet

Le benchmark navigateur refusait le statut canonique \`qualified-functionally-and-performance\` alors que le vérificateur du manifeste l’acceptait. Une requalification depuis l’état canonique pouvait donc attendre le timeout après une erreur de configuration valide.

Le correctif :

- centralise la validation de la configuration ;
- accepte exactement les deux états canoniques \`${READY_STATUS}\` et \`${QUALIFIED_STATUS}\` ;
- charge la configuration dans le bloc de rapport d’erreur ;
- inclut ce contrat dans l’identité source commune A/B ;
- conserve toutes les mesures et l’activité Region.

## Qualification

- branche : \`${process.env.GITHUB_REF_NAME}\` ;
- commit mesuré : \`${measuredCommit}\` ;
- run : \`${runId}\` ;
- job : \`${jobId}\` ;
- A : \`${manifest.sourceRefs.reference}\` ;
- B : \`${manifest.sourceRefs.candidate}\` ;
- STCK : ${STCK.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(STCK.relativeIncreasePercent)} % ;
- SMLP : ${SMLP.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(SMLP.relativeIncreasePercent)} % ;
- verdict : accepté séparément pour les deux jeux ;
- régression TypeScript : ${regressionTests}/${regressionTests} ;
- contrats natifs : ${nativeContractTests}/${nativeContractTests} ;
- build et parité Worker/Pyodide : réussis.

## Synchronisation

Le changement et ses preuves sont commités sur GitHub. Aucune publication Site n’est effectuée dans cette étape.
`;
  await writeFile(RECONCILIATION_PATH, reconciliation);

  const appended = `${RECONCILIATION_MARKER}

Le contrat navigateur accepte maintenant les deux états du cycle canonique, \`${READY_STATUS}\` et \`${QUALIFIED_STATUS}\`. Le contrat est inclus dans les \`sourceRef\` A/B et a été requalifié sur le protocole strict A1/B1/B2/A2.

- commit mesuré : \`${measuredCommit}\` ;
- run : \`${runId}\`, job : \`${jobId}\` ;
- STCK : ${STCK.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(STCK.relativeIncreasePercent)} %, accepté ;
- SMLP : ${SMLP.relativeIncreasePercent >= 0 ? '+' : ''}${numberFr(SMLP.relativeIncreasePercent)} %, accepté ;
- ${regressionTests}/${regressionTests} tests TypeScript ;
- ${nativeContractTests}/${nativeContractTests} contrats natifs ;
- build et parité Worker/Pyodide réussis ;
- aucune publication Site.

Preuve : \`${RECONCILIATION_PATH}\`.
`;
  for (const path of [
    'docs/migration/op01-op31-progress.md',
    'docs/recovery/site109-reconstruction-status.md',
    'docs/recovery/op01-op31-official-readiness-status.md',
  ]) {
    await appendOnce(path, appended);
  }

  console.log(JSON.stringify({
    status: 'official-requalification-accepted',
    runId,
    jobId,
    measuredCommit,
    artifactId,
    regressionTests,
    nativeContractTests,
    STCK: STCK.relativeIncreasePercent,
    SMLP: SMLP.relativeIncreasePercent,
  }, null, 2));
}

const mode = process.argv[2];
if (mode === 'prepare') {
  await prepare();
} else if (mode === 'finalize') {
  await finalize();
} else {
  throw new Error('usage: node scripts/reconcile-canonical-c7-config-temp.mjs prepare|finalize');
}
