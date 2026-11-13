import { readFile, writeFile } from 'node:fs/promises';

const PROOF_PATH = 'docs/recovery/lot9b-official-abba-performance-qualified.json';
const MANIFEST_PATH = 'docs/recovery/native-loop-runner-manifest.json';
const PROOF_MD_PATH = 'docs/recovery/lot9b-official-abba-performance-qualified.md';
const RECONCILIATION_PATH = 'docs/recovery/op01-op31-c7-config-reconciliation-20261113.md';
const MARKER = '## Mesure canonique rejetée conservée';

const rejectedAttempt = {
  runId: 43364040206,
  jobId: 131684105998,
  artifactId: 14009118543,
  artifactZipSha256: '741b011f4239ffa43dc3968933b450375943ba15b38c3891402c797208187f1f',
  measuredCommit: 'f172f1ad504742a7a84d3373d7a2da2bfb19ef77',
  measurementIsolation: 'non-isolated-shared-github-actions-runner-no-repository-concurrency',
  sourceRefs: {
    reference: 'lot9b-region-v1:A:99faf15665a8401a4b5e9867f1cfd1935d68f6171c46c839c34818f04b51f231',
    candidate: 'lot9b-region-v1:B:8e23f39ba219a43a3d5b7cc7644551dea24ca0fc0216d5b58a8c808fdc315a83',
  },
  games: {
    STCK: {
      referenceMedianMs: 40.20000000000073,
      candidateMedianMs: 41,
      relativeIncreasePercent: 1.990049751241929,
      accepted: true,
    },
    SMLP: {
      referenceMedianMs: 78.64999999999782,
      candidateMedianMs: 87.60000000000218,
      relativeIncreasePercent: 11.379529561353618,
      accepted: false,
    },
  },
  accepted: false,
  retainedSamples: true,
  retriesWithinRun: 0,
  reason: 'SMLP exceeded the strict per-game +10% threshold; no sample was removed or substituted',
};

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function appendUnique(items, value) {
  const current = Array.isArray(items) ? items : [];
  if (current.some(item => item.runId === value.runId && item.jobId === value.jobId)) {
    return current;
  }
  return [...current, value];
}

async function appendSection(path, section) {
  let text = await readFile(path, 'utf8');
  if (text.includes(MARKER)) return;
  if (!text.endsWith('\n')) text += '\n';
  await writeFile(path, `${text}\n${section.trim()}\n`);
}

const proof = await readJson(PROOF_PATH);
proof.failedRequalificationAttempts = appendUnique(
  proof.failedRequalificationAttempts,
  rejectedAttempt,
);
await writeJson(PROOF_PATH, proof);

const manifest = await readJson(MANIFEST_PATH);
manifest.qualification = manifest.qualification ?? {};
manifest.qualification.failedRequalificationRuns = appendUnique(
  manifest.qualification.failedRequalificationRuns,
  rejectedAttempt,
);
await writeJson(MANIFEST_PATH, manifest);

const section = `${MARKER}

La première mesure indépendante de l’identité courante a été rejetée et reste intégralement conservée :

- run : \`${rejectedAttempt.runId}\` ;
- job : \`${rejectedAttempt.jobId}\` ;
- commit mesuré : \`${rejectedAttempt.measuredCommit}\` ;
- STCK : +1,9900 %, accepté ;
- SMLP : +11,3795 %, rejeté ;
- seuil : strictement inférieur à +10 % par jeu ;
- suppression ou substitution d’échantillon : aucune ;
- nouvelle tentative à l’intérieur du run : aucune.

La qualification acceptée documentée ci-dessus provient d’une exécution indépendante ultérieure. Elle ne remplace ni ne masque cette mesure rejetée.
`;

await appendSection(PROOF_MD_PATH, section);
await appendSection(RECONCILIATION_PATH, section);

console.log(JSON.stringify({
  status: 'retained-rejected-c7-measurement',
  runId: rejectedAttempt.runId,
  jobId: rejectedAttempt.jobId,
  STCK: rejectedAttempt.games.STCK.relativeIncreasePercent,
  SMLP: rejectedAttempt.games.SMLP.relativeIncreasePercent,
}, null, 2));
