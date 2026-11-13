# Lot 9C `joint_channels` — contextes des preuves retrouvées

Ces extraits sont des éléments de revue, pas des contrats admis.

## Code produit

Aucun hit.

## Tests

### 1. `tests/lot9b-official-performance-proof.test.mjs`:40

- arbre : `7ad34ef12d51937b77a55bcff8d9bddc7548216b` ;
- ref représentative : `origin/recovery/lot9b-official-performance-qualified-20261112` ;
- refs associées : `origin/recovery/lot9b-official-performance-qualified-20261112`.

```text
    15 |   assert.equal(proof.status, 'official-performance-qualified');
    16 |   assert.equal(proof.accepted, true);
    17 |   assert.equal(proof.protocol.measuredSessions, 32);
    18 |   assert.equal(proof.protocol.measuredActions, 400);
    19 |   assert.equal(proof.protocol.warmupActions, 24);
    20 |   assert.equal(proof.protocol.sampleRemoval, 0);
    21 |   assert.equal(proof.protocol.retries, 0);
    22 | 
    23 |   for (const game of ['STCK', 'SMLP']) {
    24 |     const value = proof.games[game];
    25 |     assert.equal(value.referenceDurationsMs.length, 8);
    26 |     assert.equal(value.candidateDurationsMs.length, 8);
    27 |     const referenceMedian = median(value.referenceDurationsMs);
    28 |     const candidateMedian = median(value.candidateDurationsMs);
    29 |     const relativeIncreasePercent = delta(candidateMedian, referenceMedian);
    30 |     assert.equal(referenceMedian, value.referenceMedianMs);
    31 |     assert.equal(candidateMedian, value.candidateMedianMs);
    32 |     assert.ok(Math.abs(relativeIncreasePercent - value.relativeIncreasePercent) < 1e-12);
    33 |     assert.ok(relativeIncreasePercent < 10, `${game} must remain strictly below +10%`);
    34 |     assert.equal(value.accepted, true);
    35 |   }
    36 | 
    37 |   assert.ok(proof.games.SMLP.candidateDurationsMs.includes(591.1));
    38 |   assert.equal(proof.games.SMLP.retainedOutlier.removed, false);
    39 |   assert.equal(proof.disposition.counter76Incremented, false);
>   40 |   assert.equal(proof.disposition.nextLot, '9C joint_channels');
    41 | });
    42 | 
    43 | test('official proof retains all Region acquisitions', async () => {
    44 |   const proof = JSON.parse(await readFile(proofPath, 'utf8'));
    45 |   assert.deepEqual(proof.candidateRegion.STCK, {
    46 |     actionsSeen: 86,
    47 |     action6Seen: 86,
    48 |     usefulEvidence: 86,
    49 |     boundEvidence: 86,
    50 |     acquisitions: 86,
    51 |     methods: 86,
    52 |   });
    53 |   assert.deepEqual(proof.candidateRegion.SMLP, {
    54 |     actionsSeen: 126,
    55 |     action6Seen: 126,
    56 |     usefulEvidence: 126,
    57 |     boundEvidence: 126,
    58 |     acquisitions: 126,
    59 |     methods: 126,
    60 |   });
    61 | });
```

### 2. `tests/lot9b-official-performance-proof.test.mjs`:52

- arbre : `bb954e8c1329270a33feab0921cc0a08577aa1c2` ;
- ref représentative : `origin/op01-op31-browser-addressed-acquisition-20261113` ;
- refs associées : `origin/op01-op31-browser-addressed-acquisition-20261113`, `origin/recovery/site109-reconstruction-20261112`.

```text
    27 |   assert.equal(proof.protocol.warmupActions, 24);
    28 |   assert.equal(proof.protocol.sampleRemoval, 0);
    29 |   assert.equal(proof.protocol.retries, 0);
    30 | 
    31 |   for (const game of ['STCK', 'SMLP']) {
    32 |     const value = proof.games[game];
    33 |     assert.equal(value.referenceDurationsMs.length, 8);
    34 |     assert.equal(value.candidateDurationsMs.length, 8);
    35 |     const referenceMedian = median(value.referenceDurationsMs);
    36 |     const candidateMedian = median(value.candidateDurationsMs);
    37 |     const relativeIncreasePercent = delta(candidateMedian, referenceMedian);
    38 |     assertApproximatelyEqual(referenceMedian, value.referenceMedianMs, `${game} reference median`);
    39 |     assertApproximatelyEqual(candidateMedian, value.candidateMedianMs, `${game} candidate median`);
    40 |     assertApproximatelyEqual(
    41 |       relativeIncreasePercent,
    42 |       value.relativeIncreasePercent,
    43 |       `${game} relative increase`,
    44 |     );
    45 |     assert.ok(relativeIncreasePercent < 10, `${game} must remain strictly below +10%`);
    46 |     assert.equal(value.accepted, true);
    47 |   }
    48 | 
    49 |   assert.ok(proof.games.SMLP.candidateDurationsMs.includes(591.1));
    50 |   assert.equal(proof.games.SMLP.retainedOutlier.removed, false);
    51 |   assert.equal(proof.disposition.counter76Incremented, false);
>   52 |   assert.equal(proof.disposition.nextLot, '9C joint_channels');
    53 | });
    54 | 
    55 | test('official proof retains all Region acquisitions', async () => {
    56 |   const proof = JSON.parse(await readFile(proofPath, 'utf8'));
    57 |   assert.deepEqual(proof.candidateRegion.STCK, {
    58 |     actionsSeen: 86,
    59 |     action6Seen: 86,
    60 |     usefulEvidence: 86,
    61 |     boundEvidence: 86,
    62 |     acquisitions: 86,
    63 |     methods: 86,
    64 |   });
    65 |   assert.deepEqual(proof.candidateRegion.SMLP, {
    66 |     actionsSeen: 126,
    67 |     action6Seen: 126,
    68 |     usefulEvidence: 126,
    69 |     boundEvidence: 126,
    70 |     acquisitions: 126,
    71 |     methods: 126,
    72 |   });
    73 | });
```

### 3. `tests/lot9c-joint-channels-audit.test.mjs`:5

- arbre : `c3581e8732def8b3c24dc77ed7b9ffe8a3ad8f93` ;
- ref représentative : `origin/recovery/lot9c-joint-channels-audit-20261112` ;
- refs associées : `origin/recovery/lot9c-joint-channels-audit-20261112`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
>    5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
     6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
    12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
```

### 4. `tests/lot9c-joint-channels-audit.test.mjs`:6

- arbre : `c3581e8732def8b3c24dc77ed7b9ffe8a3ad8f93` ;
- ref représentative : `origin/recovery/lot9c-joint-channels-audit-20261112` ;
- refs associées : `origin/recovery/lot9c-joint-channels-audit-20261112`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
     5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
>    6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
    12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
```

### 5. `tests/lot9c-joint-channels-audit.test.mjs`:12

- arbre : `c3581e8732def8b3c24dc77ed7b9ffe8a3ad8f93` ;
- ref représentative : `origin/recovery/lot9c-joint-channels-audit-20261112` ;
- refs associées : `origin/recovery/lot9c-joint-channels-audit-20261112`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
     5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
     6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
>   12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
    32 |   assert.equal(status.historicalContractAdmitted, false);
    33 | 
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
```

### 6. `tests/lot9c-joint-channels-audit.test.mjs`:45

- arbre : `c3581e8732def8b3c24dc77ed7b9ffe8a3ad8f93` ;
- ref représentative : `origin/recovery/lot9c-joint-channels-audit-20261112` ;
- refs associées : `origin/recovery/lot9c-joint-channels-audit-20261112`.

```text
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
    32 |   assert.equal(status.historicalContractAdmitted, false);
    33 | 
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
    38 |   ]);
    39 |   assert.ok(allowedStatuses.has(status.status), status.status);
    40 |   if (status.counts.productSourceHits > 0) {
    41 |     assert.equal(status.status, 'manual-source-review-required');
    42 |   }
    43 | });
    44 | 
>   45 | test('every joint_channels contract field remains explicitly unproven', async () => {
    46 |   const status = await json(statusPath);
    47 |   const entries = Object.entries(status.contractFields);
    48 |   assert.ok(entries.length >= 15);
    49 |   for (const [key, value] of entries) {
    50 |     assert.equal(value.status, 'unproven', key);
    51 |     assert.deepEqual(value.evidence, [], key);
    52 |     assert.equal(value.admittedValue, null, key);
    53 |   }
    54 | });
    55 | 
    56 | test('9C guardrails preserve Lot 9B and the 76-entry counter', async () => {
    57 |   const status = await json(statusPath);
    58 |   const text = status.guardrails.join('\n');
    59 |   assert.match(text, /No semantics inferred from the name joint_channels/);
    60 |   assert.match(text, /Lot 9B contracts and official performance qualification remain frozen/);
    61 |   assert.match(text, /76-entry counter remains unchanged/);
    62 | });
```

### 7. `tests/lot9c-joint-channels-audit.test.mjs`:59

- arbre : `c3581e8732def8b3c24dc77ed7b9ffe8a3ad8f93` ;
- ref représentative : `origin/recovery/lot9c-joint-channels-audit-20261112` ;
- refs associées : `origin/recovery/lot9c-joint-channels-audit-20261112`.

```text
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
    38 |   ]);
    39 |   assert.ok(allowedStatuses.has(status.status), status.status);
    40 |   if (status.counts.productSourceHits > 0) {
    41 |     assert.equal(status.status, 'manual-source-review-required');
    42 |   }
    43 | });
    44 | 
    45 | test('every joint_channels contract field remains explicitly unproven', async () => {
    46 |   const status = await json(statusPath);
    47 |   const entries = Object.entries(status.contractFields);
    48 |   assert.ok(entries.length >= 15);
    49 |   for (const [key, value] of entries) {
    50 |     assert.equal(value.status, 'unproven', key);
    51 |     assert.deepEqual(value.evidence, [], key);
    52 |     assert.equal(value.admittedValue, null, key);
    53 |   }
    54 | });
    55 | 
    56 | test('9C guardrails preserve Lot 9B and the 76-entry counter', async () => {
    57 |   const status = await json(statusPath);
    58 |   const text = status.guardrails.join('\n');
>   59 |   assert.match(text, /No semantics inferred from the name joint_channels/);
    60 |   assert.match(text, /Lot 9B contracts and official performance qualification remain frozen/);
    61 |   assert.match(text, /76-entry counter remains unchanged/);
    62 | });
```

### 8. `tests/lot9b-official-performance-proof.test.mjs`:52

- arbre : `cd3f706ac04d0249695933210eac8f1d829688aa` ;
- ref représentative : `origin/recovery/lot6c-c7-performance-qualification-20261113` ;
- refs associées : `origin/recovery/lot6c-c7-performance-qualification-20261113`.

```text
    27 |   assert.equal(proof.protocol.warmupActions, 24);
    28 |   assert.equal(proof.protocol.sampleRemoval, 0);
    29 |   assert.equal(proof.protocol.retries, 0);
    30 | 
    31 |   for (const game of ['STCK', 'SMLP']) {
    32 |     const value = proof.games[game];
    33 |     assert.equal(value.referenceDurationsMs.length, 8);
    34 |     assert.equal(value.candidateDurationsMs.length, 8);
    35 |     const referenceMedian = median(value.referenceDurationsMs);
    36 |     const candidateMedian = median(value.candidateDurationsMs);
    37 |     const relativeIncreasePercent = delta(candidateMedian, referenceMedian);
    38 |     assertApproximatelyEqual(referenceMedian, value.referenceMedianMs, `${game} reference median`);
    39 |     assertApproximatelyEqual(candidateMedian, value.candidateMedianMs, `${game} candidate median`);
    40 |     assertApproximatelyEqual(
    41 |       relativeIncreasePercent,
    42 |       value.relativeIncreasePercent,
    43 |       `${game} relative increase`,
    44 |     );
    45 |     assert.ok(relativeIncreasePercent < 10, `${game} must remain strictly below +10%`);
    46 |     assert.equal(value.accepted, true);
    47 |   }
    48 | 
    49 |   assert.ok(proof.games.SMLP.candidateDurationsMs.includes(591.1));
    50 |   assert.equal(proof.games.SMLP.retainedOutlier.removed, false);
    51 |   assert.equal(proof.disposition.counter76Incremented, false);
>   52 |   assert.equal(proof.disposition.nextLot, '9C joint_channels');
    53 | });
    54 | 
    55 | test('official proof retains all Region acquisitions', async () => {
    56 |   const proof = JSON.parse(await readFile(proofPath, 'utf8'));
    57 |   assert.deepEqual(proof.candidateRegion.STCK, {
    58 |     actionsSeen: 86,
    59 |     action6Seen: 86,
    60 |     usefulEvidence: 86,
    61 |     boundEvidence: 86,
    62 |     acquisitions: 86,
    63 |     methods: 86,
    64 |   });
    65 |   assert.deepEqual(proof.candidateRegion.SMLP, {
    66 |     actionsSeen: 126,
    67 |     action6Seen: 126,
    68 |     usefulEvidence: 126,
    69 |     boundEvidence: 126,
    70 |     acquisitions: 126,
    71 |     methods: 126,
    72 |   });
    73 | });
```

### 9. `tests/lot9b-official-performance-proof.test.mjs`:52

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
    27 |   assert.equal(proof.protocol.warmupActions, 24);
    28 |   assert.equal(proof.protocol.sampleRemoval, 0);
    29 |   assert.equal(proof.protocol.retries, 0);
    30 | 
    31 |   for (const game of ['STCK', 'SMLP']) {
    32 |     const value = proof.games[game];
    33 |     assert.equal(value.referenceDurationsMs.length, 8);
    34 |     assert.equal(value.candidateDurationsMs.length, 8);
    35 |     const referenceMedian = median(value.referenceDurationsMs);
    36 |     const candidateMedian = median(value.candidateDurationsMs);
    37 |     const relativeIncreasePercent = delta(candidateMedian, referenceMedian);
    38 |     assertApproximatelyEqual(referenceMedian, value.referenceMedianMs, `${game} reference median`);
    39 |     assertApproximatelyEqual(candidateMedian, value.candidateMedianMs, `${game} candidate median`);
    40 |     assertApproximatelyEqual(
    41 |       relativeIncreasePercent,
    42 |       value.relativeIncreasePercent,
    43 |       `${game} relative increase`,
    44 |     );
    45 |     assert.ok(relativeIncreasePercent < 10, `${game} must remain strictly below +10%`);
    46 |     assert.equal(value.accepted, true);
    47 |   }
    48 | 
    49 |   assert.ok(proof.games.SMLP.candidateDurationsMs.includes(591.1));
    50 |   assert.equal(proof.games.SMLP.retainedOutlier.removed, false);
    51 |   assert.equal(proof.disposition.counter76Incremented, false);
>   52 |   assert.equal(proof.disposition.nextLot, '9C joint_channels');
    53 | });
    54 | 
    55 | test('official proof retains all Region acquisitions', async () => {
    56 |   const proof = JSON.parse(await readFile(proofPath, 'utf8'));
    57 |   assert.deepEqual(proof.candidateRegion.STCK, {
    58 |     actionsSeen: 86,
    59 |     action6Seen: 86,
    60 |     usefulEvidence: 86,
    61 |     boundEvidence: 86,
    62 |     acquisitions: 86,
    63 |     methods: 86,
    64 |   });
    65 |   assert.deepEqual(proof.candidateRegion.SMLP, {
    66 |     actionsSeen: 126,
    67 |     action6Seen: 126,
    68 |     usefulEvidence: 126,
    69 |     boundEvidence: 126,
    70 |     acquisitions: 126,
    71 |     methods: 126,
    72 |   });
    73 | });
```

### 10. `tests/lot9c-joint-channels-audit.test.mjs`:5

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
>    5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
     6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
    12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
```

### 11. `tests/lot9c-joint-channels-audit.test.mjs`:6

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
     5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
>    6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
    12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
```

### 12. `tests/lot9c-joint-channels-audit.test.mjs`:12

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
     1 | import assert from 'node:assert/strict';
     2 | import { readFile } from 'node:fs/promises';
     3 | import test from 'node:test';
     4 | 
     5 | const auditPath = 'docs/recovery/lot9c-joint-channels-audit.json';
     6 | const statusPath = 'docs/recovery/lot9c-joint-channels-contract-status.json';
     7 | 
     8 | async function json(path) {
     9 |   return JSON.parse(await readFile(path, 'utf8'));
    10 | }
    11 | 
>   12 | test('Lot 9C audit counts remain internally consistent', async () => {
    13 |   const audit = await json(auditPath);
    14 |   const status = await json(statusPath);
    15 |   assert.equal(audit.version, 1);
    16 |   assert.equal(status.version, 1);
    17 | 
    18 |   const classified = audit.classifiedContentHits;
    19 |   assert.ok(classified && typeof classified === 'object');
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
    32 |   assert.equal(status.historicalContractAdmitted, false);
    33 | 
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
```

### 13. `tests/lot9c-joint-channels-audit.test.mjs`:45

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
    20 |   assert.equal(status.counts.productSourceHits, classified.product_source.length);
    21 |   assert.equal(status.counts.testHits, classified.tests.length);
    22 |   assert.equal(status.counts.docsOrMetadataHits, classified.docs_or_metadata.length);
    23 |   assert.equal(status.counts.commitMessageHits, audit.commitMessageHits.length);
    24 |   assert.equal(status.counts.historyPatchHits, audit.historyPatchHits.length);
    25 | });
    26 | 
    27 | test('automated matching never admits a historical implementation or contract', async () => {
    28 |   const audit = await json(auditPath);
    29 |   const status = await json(statusPath);
    30 |   assert.equal(audit.admission.historicalProductSourceAdmitted, false);
    31 |   assert.equal(status.historicalImplementationAdmitted, false);
    32 |   assert.equal(status.historicalContractAdmitted, false);
    33 | 
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
    38 |   ]);
    39 |   assert.ok(allowedStatuses.has(status.status), status.status);
    40 |   if (status.counts.productSourceHits > 0) {
    41 |     assert.equal(status.status, 'manual-source-review-required');
    42 |   }
    43 | });
    44 | 
>   45 | test('every joint_channels contract field remains explicitly unproven', async () => {
    46 |   const status = await json(statusPath);
    47 |   const entries = Object.entries(status.contractFields);
    48 |   assert.ok(entries.length >= 15);
    49 |   for (const [key, value] of entries) {
    50 |     assert.equal(value.status, 'unproven', key);
    51 |     assert.deepEqual(value.evidence, [], key);
    52 |     assert.equal(value.admittedValue, null, key);
    53 |   }
    54 | });
    55 | 
    56 | test('9C guardrails preserve Lot 9B and the 76-entry counter', async () => {
    57 |   const status = await json(statusPath);
    58 |   const text = status.guardrails.join('\n');
    59 |   assert.match(text, /No semantics inferred from the name joint_channels/);
    60 |   assert.match(text, /Lot 9B contracts and official performance qualification remain frozen/);
    61 |   assert.match(text, /76-entry counter remains unchanged/);
    62 | });
```

### 14. `tests/lot9c-joint-channels-audit.test.mjs`:59

- arbre : `ff0bbab9697e54ea67ceaac37d370518eaed536d` ;
- ref représentative : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113` ;
- refs associées : `origin/recovery/lot9c0-joint-channels-audit-qualified-20261113`.

```text
    34 |   const allowedStatuses = new Set([
    35 |     'manual-source-review-required',
    36 |     'trace-only-contract-reconstruction-required',
    37 |     'no-durable-evidence-found',
    38 |   ]);
    39 |   assert.ok(allowedStatuses.has(status.status), status.status);
    40 |   if (status.counts.productSourceHits > 0) {
    41 |     assert.equal(status.status, 'manual-source-review-required');
    42 |   }
    43 | });
    44 | 
    45 | test('every joint_channels contract field remains explicitly unproven', async () => {
    46 |   const status = await json(statusPath);
    47 |   const entries = Object.entries(status.contractFields);
    48 |   assert.ok(entries.length >= 15);
    49 |   for (const [key, value] of entries) {
    50 |     assert.equal(value.status, 'unproven', key);
    51 |     assert.deepEqual(value.evidence, [], key);
    52 |     assert.equal(value.admittedValue, null, key);
    53 |   }
    54 | });
    55 | 
    56 | test('9C guardrails preserve Lot 9B and the 76-entry counter', async () => {
    57 |   const status = await json(statusPath);
    58 |   const text = status.guardrails.join('\n');
>   59 |   assert.match(text, /No semantics inferred from the name joint_channels/);
    60 |   assert.match(text, /Lot 9B contracts and official performance qualification remain frozen/);
    61 |   assert.match(text, /76-entry counter remains unchanged/);
    62 | });
```

## Documentation, scripts et métadonnées

### 1. `docs/migration/v6-delivery-roadmap.md`:129

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
   104 | | generic bounded live-campaign helper | 7/7 | passed |
   105 | | ABBA cost protocol/orchestrator | 8/8 | passed |
   106 | | explicit native session adapter | 9/9 | passed |
   107 | | **Total targeted evidence** | **108/108** | **passed** |
   108 | 
   109 | Important semantic limits:
   110 | 
   111 | - no historical owner priority is invented;
   112 | - multiple owner proposals remain `ambiguous`;
   113 | - public pixel deltas do not infer a `methodRef`;
   114 | - Region method reuse requires an explicit justified `methodRef`;
   115 | - the default public worker decision port is
   116 |   `reconstruction-pending-perception` and does not invent an action;
   117 | - the generic campaign helper is not claimed to reproduce the historical
   118 |   STCK/SMLP campaign corpus;
   119 | - the cost harness reconstructs the ABBA protocol and arithmetic, not the lost
   120 |   historical CLI/checkouts/native runner;
   121 | - `scripts/native-loop-session-adapter.mjs` dispatches only to four explicit
   122 |   A/B × STCK/SMLP runners and owns neither timing nor corpus.
   123 | 
   124 | Current Lot 9B status:
   125 | 
   126 | **functionally qualified for the reconstructed component boundaries above;
   127 | native STCK/SMLP runner and official performance remain to be confirmed.**
   128 | 
>  129 | ### 4.3 9C — `joint_channels`
   130 | 
   131 | Not yet reconstructed on the canonical GitHub baseline.
   132 | 
   133 | Start only after the shared caller/perception contracts used by 9B are stable
   134 | enough to avoid duplicating incompatible infrastructure.
   135 | 
   136 | ## 5. Performance contract
   137 | 
   138 | Recovered official protocol:
   139 | 
   140 | - order: A1 → B1 → B2 → A2;
   141 | - each series runs STCK then SMLP;
   142 | - one warmup per game/series;
   143 | - warmup: 3 actions;
   144 | - four measured sessions per game/series;
   145 | - STCK measured session: 10 actions;
   146 | - SMLP measured session: 15 actions;
   147 | - total warmups: 8 sessions / 24 actions;
   148 | - total measured: 32 sessions / 400 actions;
   149 | - no measured-sample removal;
   150 | - no hidden retry;
   151 | - STCK and SMLP evaluated separately.
   152 | 
   153 | Acceptance:
   154 | 
```

### 2. `docs/migration/v6-delivery-roadmap.md`:270

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
   245 |    reevaluated;
   246 | 3. current entry-point registry rebuilt with evidence-backed counts;
   247 | 4. restoration/checkpoint contracts qualified across reconstructed owners;
   248 | 5. campaigns reproducible from durable GitHub fixtures;
   249 | 6. official STCK/SMLP cost protocol executable with a real native runner;
   250 | 7. both global performance budgets accepted independently;
   251 | 8. any Site publication linked back to a durable canonical GitHub SHA.
   252 | 
   253 | ## 9. Immediate Lot 9 roadmap
   254 | 
   255 | | Step | Status | Next proof |
   256 | | --- | --- | --- |
   257 | | historical Lot 9 recovery audit | complete | preserve unresolved identities |
   258 | | V6 core | targeted functional qualification complete | preserve regression coverage |
   259 | | Region core | reconstructed and qualified | preserve explicit evidence contract |
   260 | | Region owner | reconstructed and qualified | preserve selected/passive dedupe |
   261 | | neutral common caller | reconstructed and qualified | no implicit priority |
   262 | | worker transport boundary | reconstructed and qualified | connect justified decision port |
   263 | | public pixel delta | reconstructed and qualified | preserve no-method-inference rule |
   264 | | generic live campaign helper | reconstructed and qualified | obtain durable STCK/SMLP ports/fixtures |
   265 | | ABBA cost orchestrator | reconstructed and qualified | explicit native adapter available |
   266 | | native session adapter | reconstructed and qualified | provide four real A/B × STCK/SMLP runners |
   267 | | **native STCK/SMLP runners** | **open** | **next priority** |
   268 | | official Lot 9B cost | open | execute after runner restoration |
   269 | | current reconstruction registry | open | rebuild before count claims |
>  270 | | 9C `joint_channels` | open | after shared infrastructure stabilizes |
   271 | | Site publication | blocked | only after GitHub-qualified integrated state |
   272 | 
   273 | ## 10. Next step
   274 | 
   275 | **Recover or reconstruct the four explicit native STCK/SMLP runners from durable
   276 | evidence.**
   277 | 
   278 | If the original corpus or runner identity cannot be established, create a new
   279 | runner only when its inputs, session semantics and measured scope can be stated
   280 | explicitly and requalified. Do not substitute unrelated games for STCK/SMLP and
   281 | do not manufacture benchmark numbers.
```

### 3. `docs/recovery/lot9b-github-recovery-20261112.md`:26

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
     1 | # Lot 9B recovery state on canonical reconstruction — 2026-11-12
     2 | 
     3 | ## Canonical basis
     4 | - Repository: `yannick-fontan-1981/sra-playground`
     5 | - Canonical reconstruction: `recovery/site109-reconstruction-20261112`
     6 | - Lot branch: `recovery/lot9b-region-intervention-restart-20261112`
     7 | - Previous recovery source: `lot9b-github-recovery-20261112`
     8 | 
     9 | ## Historical evidence preserved, not promoted
    10 | - Site 109 / historical native 0.68 / historical 70/76
    11 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299` (unresolved)
    12 | - historical Lot 9B checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657` (unresolved)
    13 | - historical candidate 0.69 / 71/76 / 28/33 material
    14 | 
    15 | These values describe the lost historical line. They do not describe the current
    16 | GitHub reconstruction.
    17 | 
    18 | ## Current canonical reconstruction
    19 | Present:
    20 | - reconstructed V6 operations/composition/authority/target-binding/cache/cycle/trace;
    21 | - focused V6 tests.
    22 | 
    23 | Absent for Lot 9:
    24 | - Region implementation;
    25 | - ChartNavigation implementation;
>   26 | - JointChannels implementation;
    27 | - V6 public worker;
    28 | - live-game campaign helper;
    29 | - official native loop cost harness;
    30 | - V6 delivery roadmap and entry-point progress registry.
    31 | 
    32 | ## Functional status
    33 | The reconstructed V6 core was materialized in a local Git checkout and its
    34 | focused tests were compiled then executed:
    35 | - 27 passed;
    36 | - 0 failed.
    37 | 
    38 | Region is absent, so Lot 9B itself is not yet functionally qualified on the
    39 | new baseline.
    40 | 
    41 | ## Performance status
    42 | Official harness absent.
    43 | 
    44 | **fonctionnellement qualifié pour le noyau V6 reconstruit, performance officielle à confirmer**
    45 | 
    46 | The historical rule remains:
    47 | - STCK global strictly < +10%;
    48 | - SMLP global strictly < +10%;
    49 | - each game separately;
    50 | - no compensation;
    51 | - phase overrun allowed only when the same-game global passes.
```

### 4. `docs/recovery/lot9b-restart-assessment-20261112.md`:114

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
    89 |    pieces are absent;
    90 | 4. the recovered source-identity guards for the historical V6 baseline.
    91 | 
    92 | Historical identities preserved as evidence only:
    93 | 
    94 | - Site reference: 109;
    95 | - historical native reference: 0.68;
    96 | - historical published count: 70/76;
    97 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299`
    98 |   (not currently resolvable in GitHub);
    99 | - historical Lot 9B checkpoint:
   100 |   `70fa973c71849a16ca62ebd66132277669cc9657`
   101 |   (not currently resolvable in GitHub);
   102 | - historical candidate identity: 0.69;
   103 | - historical candidate count: 71/76, 28/33 material.
   104 | 
   105 | These values are **not** promoted to the status of the current reconstruction.
   106 | 
   107 | ## Missing from the canonical reconstruction
   108 | 
   109 | At the time of this assessment the canonical GitHub tree contains no path
   110 | matching any of:
   111 | 
   112 | - `region_intervention`;
   113 | - `chart_navigation`;
>  114 | - `joint_channels`;
   115 | - `yf_arc3_v6`;
   116 | - `scripts/measure-native-loop-costs.mjs`;
   117 | - `tests/helpers/v6-live-game-campaign.ts`;
   118 | - `src/runtime/v6-agent-worker.ts`;
   119 | - `docs/migration/v6-delivery-roadmap.md`;
   120 | - `docs/migration/v6-entry-point-progress.json`.
   121 | 
   122 | Therefore the current reconstruction cannot yet claim the historical
   123 | 70/76 runtime, nor can Lot 9B execute the historical public-worker or official
   124 | performance protocols.
   125 | 
   126 | ## Documented but not exactly reconstructible
   127 | 
   128 | Historical work recorded that Region learned a separator control only after an
   129 | observed intervention and regional effect, then could propose a continuation;
   130 | contradictions invalidated that learned continuation; selected and passive
   131 | returns had distinct acquisition paths.
   132 | 
   133 | That behavior is useful as a future reconstruction contract, but the currently
   134 | available GitHub/Library evidence does **not** contain the exact historical
   135 | TypeScript implementation or the complete original V6 Region source bodies.
   136 | 
   137 | Accordingly:
   138 | 
   139 | - do not recreate `region_intervention` by guessing the old code;
```

### 5. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
   509 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : no_explicit_native_attribution_found.
   510 |   Reste explicite : Qualification native, préservation officielle et transfert restent distincts du raccord source.
   511 | 2.1.15 [composition.family.geometric_correspondence.current_cotranslated_control_shape_completion] P/D/S Compléter une silhouette contrôlée uniquement par les pixels de membres visibles dont la translation commune est mesurée et les appuis canoniques courants ; exiger un pair exact unique de même apparence avant la comparaison. {MAC02_VOIS_CURRENT_COTRANSLATED_CONTROL_20261018}
   512 |   Source au commit : clé ajoutée après le snapshot audité ; réconciliation non établie.
   513 |   Reste explicite : Loi complète, transfert et préservation globale non qualifiés.
   514 | 2.4.3 [composition.family.contextual_operator.observed_topological_reference_pigment_write_questions] P/D/S Préparer une question composée de réglage du pigment puis d’écriture du support depuis une correspondance de poches observée, en réutilisant les points et calculs existants et leur géométrie courante. {C_HOLE_SCOPE,C_HOLE_POCKET_REFERENCE,C_HOLE_PREPARED_PIGMENT,C_HOLE_PREPARED_WRITE,C_HOLE_CURRENT_GEOMETRY}
   515 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   516 | 2.4.4 [composition.family.contextual_operator.observed_linked_selection_property_activation] D/S/P Préparer une sélection distante liée, revalider sa marque actuelle, observer le réglage de propriété puis tester l’activation explicite avec le résultat de préparation et une portée de perception compatible. {C_SELE_LINK_RECALL,C_SELE_ACTIVATION,C_SELE_SCOPE_RETURN}
   517 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   518 | 2.5.4 [composition.family.global_coupling.observed_homologous_boundary_contact_questions] P/D/S Composer plusieurs régions compactes et leurs bandes homologues dans un cadre observé ; tester une direction utile, revalider les contacts puis éprouver le complément sous le même but, sans inventer curseur, pas moteur ou loi de colle. {C_GRAV_BOUNDARY_MEASURE,C_GRAV_BOUNDARY_QUESTION,C_GRAV_BOUNDARY_RELEASE}
   519 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   520 | 2.2.1 [composition.family.rigid_assembly.prepared_ordered_protrusion_continuation] P/D/S Préparer la prochaine approche axiale selon la référence ordonnée, conserver les appuis courants et poursuivre après rétraction géométrique revalidée sous le même parent. {A_SK48_ORDERED_APPROACH,A_SK48_CURRENT_SUPPORT,A_SK48_GEOMETRIC_CLEARANCE}
   521 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   522 | 2.2.2 [composition.family.rigid_assembly.current_oriented_delivery_routes_preserve_packing_parent] P/D/S Préparer prise, transport orienté conjoint et libération dans les réceptions distinctes ; après livraison, poursuivre une route courante restante sous le même parent de rangement avant de créer une question de contact sans nécessité. {A_WA30_CURRENT_DELIVERY_ROUTE,A_WA30_PARENT_BEFORE_CONTACT}
   523 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   524 | 2.12.6 [composition.family.symbolic_constraints.connector_bound_symbol_projection_with_local_edit_navigation] P/D/S Composer la projection d’un dictionnaire de symboles avec les transitions locales acquises et la navigation du focus ; préserver les champs déjà conformes et réconcilier chaque mutation avant la suite. {A_TR87_SYMBOL_PROJECTION,A_TR87_NOMINAL_RETENTION,A_TR87_EDITOR_RELEASE}
   525 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   526 | 2.12.7 [composition.family.symbolic_constraints.straight_rooted_paths_unary_marginals_to_conditional_indexed_edits] P/D/S Sur chemins droits disjoints et marques unaires mesurés, proposer des préfixes enracinés, réutiliser les contraintes entières et le STEP existants ; transporter le vecteur complet et le compte de continuation actuel dans la question révisable, puis revalider les effets avant la suite. {D_THER_ROOTED_PREFIX_MARGINAL_CONSUMER_20261015,D_THER_CURRENT_ROUTE_COUNT_TRANSPORT_20261015,D_THER_SELECTED_CURRENT_POINT_FACTORY_20261015}
   527 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   528 | 2.12.8 [composition.family.symbolic_constraints.binary_labeled_lanes_to_current_atomic_membership_question] P/D/S Sur deux collections visuelles indépendantes de lignes d’occurrences et une instance homologue courante, composer les caractéristiques ordonnées et l’induction étiquetée existantes ; sous accord relatif à une grammaire atomique déclarée, éprouver la classe par le rectangle actuellement lié, puis conserver le même but et les racines compatibles seulement après reçu observé et revalidation du contexte, sans anticiper les questions futures. {D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016,D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016,D_LABELED_LANE_CURRENT_SOURCE_RELEASE_20261016}
   529 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   530 | 2.12.9 [composition.family.symbolic_constraints.indexed_raster_relations_to_current_panel_submission] P/D/S Conserver les indices et l’inconnu d’une suite de panneaux ; composer les relations de raster déclarées avec une option courante concordante, préparer sa soumission avec WHY et prémisses, puis réobserver la ligne suivante sans importer la règle précédente. {C_INDEXED_PANEL_CURRENT_ANSWER_20261016}
   531 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   532 | 2.12.10 [composition.family.symbolic_constraints.persistent_tuple_catalogue_to_local_historical_acquisition] P/D/S Composer valeurs des grands contrôles et mini-tuples d’un catalogue ; distinguer marque courante migrante et marque quittée persistante, puis préparer une transition locale vers un tuple non marqué sous un but historique révisable, sans résoudre une couverture cyclique générale. {C_TUPLE_CATALOGUE_CURRENT_VISIT_20261016}
   533 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
>  534 | 2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contributions, ouvrir en DRM une première question bornée sur une commande conjointe supposée. SRC conserve but direct, toutes prémisses et validations ordinaires. Le départage spatial de contrôles homologues est un ordre expérimental explicite, pas une loi de hauteur ni une route gagnante présumée ; périodes uniques, gains futurs et correction complète restent ouverts. {D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016,D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016,D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016,D_PROFILE_CURRENT_SOURCE_RELEASE_20261016}
   535 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   536 | 2.6.3 [composition.family.oriented_topology.calibrated_support_graph_terminal_continuation] P/D/S Depuis un départ soutenu et son déplacement observé, préparer la route du graphe mesuré vers un overlay terminal révisable, puis conserver un même plan et but avec prémisses courantes à chaque arête réconciliée. {A_TU93_GRAPH_MEASUREMENT,A_TU93_GRAPH_RELEASE,A_TU93_GRAPH_CONTINUATION}
   537 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   538 | 2.6.4 [composition.family.oriented_topology.axial_glyph_field_to_conditional_budgeted_landings] P/D/S Sur champ régulier de glyphes axiaux, contour unique, anneau et jauge segmentée mesurés, proposer un modèle de rayon depuis la source, réutiliser DOMAIN/BFS existants et tester le premier atterrissage utile ; revalider image, carte, époque, pose et réserve avant de reprendre le suffixe sous le même but. {D_AMZE_CONDITIONAL_GLYPH_LANDING_20261016,D_AMZE_CURRENT_POINT_FACTORY_20261016}
   539 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   540 | 2.6.5 [composition.family.oriented_topology.nested_perforated_frames_to_conditional_configuration] P/D/S Sur cadres imbriqués entièrement mesurés et identifiables, composer hiérarchie de transport, volumes pleins de collision et murs perforés à poches multiples avec K24/admission/CSP/composantes/BFS existants ; tester le contrôle sous modèle révisable, puis conserver le même but et le suffixe déjà tenté seulement après revalidation des poses, du focus, de l’époque et des reçus Source actuels. {D_REGION_CONFIGURATION_EXISTING_SERVICES_20261016,D_REGION_CONFIGURATION_CURRENT_CANDIDATE_20261016}
   541 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   542 | 2.6.6 [composition.family.oriented_topology.observed_channels_and_opposed_surface_connection_question] P/D/S Sur deux commandes homologues et deux bandes verticales opposées entièrement mesurées, composer le point homologue du corps, les affectations observées et les appuis horizontaux en questions révisables de sélection, pose, approche puis réception. Réutiliser les composants et la libération générale ; conserver le même but direct et le contexte réellement dispatché seulement après effet observé, epoch et image revalidés. Aucune loi complète de portail ou route physique sûre n’est prétendue. {D_COMPONENT_CHANNEL_SURFACE_MEASUREMENT_20261016,D_CHANNEL_SURFACE_CURRENT_QUESTION_20261016,D_CHANNEL_SURFACE_CURRENT_SOURCE_RELEASE_20261016}
   543 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   544 | 2.6.7 [composition.family.oriented_topology.scoped_contact_outcome_guides_subordinate_object_relation] P/D/S Depuis le reçu terminal exact d’un contact cellulaire refusé, conserver destinataire, face et contexte mesuré, fermer cette seule expérience et préparer une relation d’objet encore inconnue accessible ; reprendre le même principal et terminal du WHY Source avec les preuves reçues, en laissant ouverts les autres contacts et les états pertinents changés. {B_SCOPED_CONTACT_OUTCOME_SUBORDINATE_RELATION_20261016}
   545 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   546 | 2.6.7.1 [composition.family.oriented_topology.current_returned_contact_packet_preserves_boundary_stable_destinations] P/D/S Après un contact non résolu lié à l’action, la frame, l’époque et au reçu courant, comparer les bornes d’un paquet complet réconcilié ; si elles sont identiques malgré une animation intermédiaire, employer leur support pour le seul filtre de stabilité des destinations. Conserver intégralement les effets transitoires, risques, ressources, autres gardes et inconnues du monde caché. {MAC01_PORT_PACKET_BOUNDARY_DESTINATION_STABILITY_20261017}
   547 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : selected_on_historical_source_only.
   548 | 2.6.8 [composition.family.oriented_topology.filled_square_field_overlays_offer_endpoint_question] P/D/S Composer un champ de cellules pleines, un glyphe compact, un cadre de même encre et les overlays marqués en question de destination actuelle ; conserver le but et une loi de déplacement révisable. {D_CAVA_PUBLIC_FIELD_ENDPOINT_MEASUREMENT,D_CAVA_PUBLIC_MARKED_ENDPOINT_QUESTION}
   549 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   550 | 2.5.5 [composition.family.global_coupling.revalidated_partial_neighbor_reference_placement] P/D/S Acquérir une table partielle depuis la recoloration réciproque de deux membres, la rappeler avec revalidation courante, comparer la référence entière et préparer les placements par les services existants ; conserver le principal et les gardes de continuation. {C_VOIS_PARTIAL_NEIGHBOR_MEASUREMENT,C_VOIS_PARTIAL_NEIGHBOR_MODEL_SCOPE,C_VOIS_PARTIAL_NEIGHBOR_MEMORY,C_VOIS_PAIRED_REFERENCE_PLACEMENT,C_VOIS_CURRENT_PLACEMENT_READINESS,C_VOIS_PURPOSEFUL_REVISIT,C_VOIS_SAME_ORIGIN_ACCESS_COMPARISON}
   551 |   Source au commit : current_producer_consumer_anchors_verified_multiple_sites ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   552 | 2.5.6 [composition.family.global_coupling.current_bounded_edge_pair_operator_question] P/D/S Mesurer une paire de bords opposes et un locus intermediaire ; reutiliser le service axial existant, conserver la preuve courante et preparer une experience sur un operateur exterieur sous un but direct coherent, sans loi physique presume. {C_AXIAL_BOUNDED_PAIR_MEASUREMENT,C_AXIAL_EXISTING_SCENE_SERVICE,C_AXIAL_CURRENT_CANONICAL_REUSE,C_AXIAL_CURRENT_OPERATOR_QUESTION,C_AXIAL_OPERATOR_RELEASE_PRIORITY,C_AXIAL_FAST_SOURCE_ENTRY}
   553 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   554 | 2.7.5 [composition.family.causal_network.regular_port_field_to_conditional_unique_reciprocal_cover] P/D/S Sur champ régulier de ports à traits deux tons, composer domaines de rotations et réciprocité avec le CSP et le rapport de graphe existants ; sous cible complète unique, tester une rotation utile même sèche, puis revalider tous les ports, grille, époque et supports avant reprise du même but sans nouveau CSP. {D_PIPE_CONDITIONAL_RECIPROCAL_COVER_20261016,D_PIPE_CURRENT_POINT_FACTORY_20261016}
   555 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   556 | 2.7.6 [composition.family.causal_network.source_admitted_complete_component_word_series] P/D/S Lier chaque point courant du mot complet de réseau admis, puis exécuter ce mot en série conditionnelle Source avec même but, modèle, ressources et falsificateurs ; réconcilier son résultat, sans réduire le mot à son premier point. {A_TRCP_SOURCE_COMPLETE_NETWORK_WORD_R28}
   557 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   558 | 2.8.2 [composition.family.resource_transaction.observed_compartment_lifecycle_questions_with_current_witnesses] P/D/S Composer contenus encadrés appariés, activation conjointe, activité observée et nouveau contenu en questions contextuelles utiles ; conserver un modèle canonique conditionnel mais renouveler le témoin courant, ses prémisses et le contrôle avant chaque action sous le même but, sans inventer recettes ni durées. {D_SPOR_OBSERVED_CONTEXTUAL_QUESTIONS_20261016,D_SPOR_CANONICAL_METHOD_CURRENT_WITNESS_20261016}
   559 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
```

### 6. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
  3252 |   Limite : Le moteur de points et le SRC choose_information_probe.src:2025 sont réutilisés, sans geste oracle. Le contexte porte explicitement temporal_model_bound=false et native_tie_order_known=false ; WHY experimental_unknown. F03–F09, cône FIT/EVALUATE, macro temporelle complète et sûreté aux phases non qualifiés.
  3253 |   Limite : Médiane5,9065s/n6,démarrage11,406s,total45,406s ; cache86,058s séparé, aucune série. Pas de performance2s ou cadence UI attestée. Quatre fichiers good_run/EVAS/LVL1 validés, comparaison primaire complète avec inconnues préservées, aucune archive native.
  3254 |   Limite : Pas de transfert inter-jeu/L2 : triplet restant baseline, détour déplacé, négatif vraie sélection/corridor libre au centre seulement/exposition future. Aucun global25, test unitaire ou profiling ; états historiques conservés.
  3255 | D_EVAS_SHADOW_LIGHT_20261015 [CODED] domaines.question_ombre_lumiere_pair_semblable : Sous-cas à deux patches carrés rayés équivalents par rotation, surface commune achromatique et champ plus clair non frontalier. Mesures sRGB et changements ordonnés en Python ; significations, but et priorité en DRM ; SRC et producteur de points existants.
  3256 |   Producteur historique : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — annotate_initial_shadow_neighbors (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3257 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:48185 — projection.exploration.initial_shadow_neighbor_qualifies_peer_reach_goal (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3258 |   Producteur actuel : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — resolved
  3259 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67695 — resolved
  3260 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3261 |   Limite : Source644744a3, cinq contrôles PASS ; D_EVAS_SHADOW_LIGHT_NATIVE_R06_20261015.json : gestes1–5 réellement dispatchés sous principle.shadow_start_and_similar_peer_open_light_avoiding_goal, même but, mêmes supports ordinaires racine/intention, claim courant dans les deux listes, permis. Champs radiométriques transportés dans le contexte de contribution.
  3262 |   Limite : Mesure dédiée shadow_light_fields.py:28, principes shadow_light.drm, SRC réutilisé choose_information_probe.src:2025, tous attestés au même commit dans source_files. Les indices de palette ne sont pas une échelle de luminosité. Contraste fourni comme ordre entier, luminances conservées pour inspection.
  3263 |   Limite : R05 conserve l'échec d'activation lié au comparateur entier recevant des décimaux. R06 six primitives sans victoire ni erreur, aucune attente initiale ni RESET ; médiane3,9765s/n6, démarrage11,078s,total34,547s. Nouveau WHY utilisé cinq fois, sixième geste en exploration générale : pas de résolution, de trajet sûr complet ou de performance2s.
  3264 |   Limite : Suppositions révisables seulement : luminosité et changement ne prouvent ni danger ni période. Le champ achromatique doit être assez large et non coupé par le bord ; glyphes rayés, bordures fines et balayage du corps exclus. La sécurité de la commande exige l'emprise entière et tous les ticks/phasages compatibles, encore non raccordés ici.
  3265 |   Limite : Pas de transfert attesté. Triplet restant : baseline préservée, disposition/palette déplacées, contre-cas glyphes ou bordure clairs sans champ mobile. F03–F09, détours et maintien du but sans voisin progressif restent ouverts.
  3266 | D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3267 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — def measure_labeled_predicate_induction_d( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3268 |   Consommateur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3269 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — resolved
  3270 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3271 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3272 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3273 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3274 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3275 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3276 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
> 3277 | D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3278 |   Producteur historique : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — def measure_periodic_profile_preimages_d( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3279 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3280 |   Producteur actuel : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — resolved
  3281 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3282 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3283 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3284 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3285 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3286 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3287 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3288 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3289 | D_HPDL_WORD_PARAMETER_EXPERIMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3290 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3291 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:247 — WORKFLOW choose_information_probe( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3292 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:78120 — resolved
  3293 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:419 — resolved
  3294 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3295 |   Limite : Panneaux horizontaux homologues, mot unique au-dessus, marques pleines ou à un coin absent.
  3296 |   Limite : Ordre des panneaux et sens des champs restent des hypothèses DRM falsifiables ; aucune loi de capture ou de cycle acquise par la géométrie seule.
  3297 |   Limite : Services généraux de clic et de choix réutilisés ; prémisses et deux représentations de l’agenda conservées, pas de second solveur.
  3298 |   Limite : Qualification source et replay de mesures seulement ; sélection native, victoire, transfert et performance non attestés.
  3299 | D_HPDL_WORD_PARAMETER_MEASUREMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3300 |   Producteur historique : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — def append_framed_word_candidates( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3301 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3302 |   Producteur actuel : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — resolved
```

### 7. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
  3332 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3333 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3041 — resolved
  3334 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3335 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3336 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3337 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3338 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3339 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3340 | D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3341 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3342 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:72916 — "id": "projection.exploration.observed_labeled_lanes_open_current_classification_question" (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3343 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3344 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:80676 — resolved
  3345 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3346 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3347 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3348 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3349 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3350 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3351 | D_LOGI_CURRENT_CONNECTOR_QUESTION_BEFORE_INCIDENTAL_SURFACE_20261018 [CODED] current_connector_control_question_before_incidental_surface : Priorité locale de la question causale déjà admise par 2.7.7, sans nouveau solveur, contrat de contrôle ou loi de circuit.
  3352 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:88174 — projection.connector_context.current_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3353 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99618 — tier.current_connector_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3354 |   Limite : Garde sur les contrats existants de connecteur et la question actuelle ; aucun graphe ou table booléenne complète, aucune loi de destination inférée.
  3355 |   Limite : Aucun changement Python ni nouvel ordre de moteur ; les plans engagés et gardes WHY/ACT restent prioritaires.
  3356 |   Limite : Essais de non-régression, positif déplacé et négatif comportemental non exécutés selon la demande humaine ; aucun transfert ou préservation globale attestés.
> 3357 | D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3358 |   Producteur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — def measure_profile_sum_frame( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3359 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3360 |   Producteur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — resolved
  3361 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3362 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3363 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3364 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3365 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3366 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3367 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3368 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3369 | D_OTHER_CATALOGUE_20261015 [CODED] domaines.question_de_catalogue_apres_reponse_de_panneau : Expérience bornée sur une bande géométrique actuelle après mutation du seul panneau ; aucune identité, justesse de réponse ou profondeur imposée.
  3370 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:150 — annotate_patch_adjacent_color_bands -> ordinary _point_candidates (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3371 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:47004 — projection.exploration.patch_response_different_core_selector_question / Source precondition and WHY permit services (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3372 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:206 — resolved
  3373 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67479 — resolved
  3374 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3375 |   Limite : R17 source cinq PASS ; D_GRIL_SELECTOR_PRIORITY_NATIVE_R17_20261015.json joint flag, principe, prémisse ancienne conservée plus support canonique et permis du clic réellement exécuté at:r4:c36.
  3376 |   Limite : Le catalogue suivant est observé mais le solveur y reclique le cadre blanc. Score0, médiane4,359s/n7 ; aucune victoire, mémoire multi-vues, transfert ni performance cible attestés. Aucun test unitaire.
  3377 | D_PATCH_FIELD_20261015 [CODED] domaines.observation_patchs_et_occurrences : Rangées géométriques non contenues, glyphes exacts et occurrences internes ; question de correspondance via sonde non testée, sans plan ni opérateur déjà productif.
  3378 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:6 — measure_repeated_patch_rows / annotate_repeated_patch_rows (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3379 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46932 — projection.exploration.repeated_patch_field_translation_question / agenda SRC existant (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3380 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:43 — resolved
  3381 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68787 — resolved
  3382 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
```

### 8. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
  3395 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
> 3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 9. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
> 3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 10. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432

- arbre : `04356164cd2966f9ce90b1d99ee6f2d425cb1d97` ;
- ref représentative : `origin/recovery/lot9b-region-public-action6-probe-20261112` ;
- refs associées : `origin/recovery/lot9b-region-public-action6-probe-20261112`.

```text
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
> 3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3447 |   Producteur actuel : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — resolved
  3448 |   Consommateur actuel : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — resolved
  3449 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3450 |   Limite : Lecture de files plates et d’un quota local ; aucune lecture générale des files repliées.
  3451 |   Limite : Égalité, rang, quotas multiples et viabilité des longues chaînes restent distincts de ce L1.
  3452 |   Limite : Les modèles concordants restent concurrents : une entrée commune sûre ne prouve pas leur identification complète.
  3453 |   Limite : 2.14.5 compound_reference_to_remeasured_upper_port_growth et2.14.6 observed_rectangular_receipts_to_bounded_contributor_and_join_questions sont préservées ; aucun alias par numéro.
  3454 |   Limite : Acquisition, rappel pertinent et revalidation locale conservés ; transfert déplacé/positif/négatif non attesté.
  3455 |   Limite : Cycles instrumentés séparés du démarrage ; médiane complète non mesurée, aucun gain de vitesse déduit.
  3456 | D_RECR_REFERENCE_FITTING_MODEL_INPUT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3457 |   Producteur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:116 — def option_facts(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 11. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
   509 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : no_explicit_native_attribution_found.
   510 |   Reste explicite : Qualification native, préservation officielle et transfert restent distincts du raccord source.
   511 | 2.1.15 [composition.family.geometric_correspondence.current_cotranslated_control_shape_completion] P/D/S Compléter une silhouette contrôlée uniquement par les pixels de membres visibles dont la translation commune est mesurée et les appuis canoniques courants ; exiger un pair exact unique de même apparence avant la comparaison. {MAC02_VOIS_CURRENT_COTRANSLATED_CONTROL_20261018}
   512 |   Source au commit : clé ajoutée après le snapshot audité ; réconciliation non établie.
   513 |   Reste explicite : Loi complète, transfert et préservation globale non qualifiés.
   514 | 2.4.3 [composition.family.contextual_operator.observed_topological_reference_pigment_write_questions] P/D/S Préparer une question composée de réglage du pigment puis d’écriture du support depuis une correspondance de poches observée, en réutilisant les points et calculs existants et leur géométrie courante. {C_HOLE_SCOPE,C_HOLE_POCKET_REFERENCE,C_HOLE_PREPARED_PIGMENT,C_HOLE_PREPARED_WRITE,C_HOLE_CURRENT_GEOMETRY}
   515 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   516 | 2.4.4 [composition.family.contextual_operator.observed_linked_selection_property_activation] D/S/P Préparer une sélection distante liée, revalider sa marque actuelle, observer le réglage de propriété puis tester l’activation explicite avec le résultat de préparation et une portée de perception compatible. {C_SELE_LINK_RECALL,C_SELE_ACTIVATION,C_SELE_SCOPE_RETURN}
   517 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   518 | 2.5.4 [composition.family.global_coupling.observed_homologous_boundary_contact_questions] P/D/S Composer plusieurs régions compactes et leurs bandes homologues dans un cadre observé ; tester une direction utile, revalider les contacts puis éprouver le complément sous le même but, sans inventer curseur, pas moteur ou loi de colle. {C_GRAV_BOUNDARY_MEASURE,C_GRAV_BOUNDARY_QUESTION,C_GRAV_BOUNDARY_RELEASE}
   519 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   520 | 2.2.1 [composition.family.rigid_assembly.prepared_ordered_protrusion_continuation] P/D/S Préparer la prochaine approche axiale selon la référence ordonnée, conserver les appuis courants et poursuivre après rétraction géométrique revalidée sous le même parent. {A_SK48_ORDERED_APPROACH,A_SK48_CURRENT_SUPPORT,A_SK48_GEOMETRIC_CLEARANCE}
   521 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   522 | 2.2.2 [composition.family.rigid_assembly.current_oriented_delivery_routes_preserve_packing_parent] P/D/S Préparer prise, transport orienté conjoint et libération dans les réceptions distinctes ; après livraison, poursuivre une route courante restante sous le même parent de rangement avant de créer une question de contact sans nécessité. {A_WA30_CURRENT_DELIVERY_ROUTE,A_WA30_PARENT_BEFORE_CONTACT}
   523 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   524 | 2.12.6 [composition.family.symbolic_constraints.connector_bound_symbol_projection_with_local_edit_navigation] P/D/S Composer la projection d’un dictionnaire de symboles avec les transitions locales acquises et la navigation du focus ; préserver les champs déjà conformes et réconcilier chaque mutation avant la suite. {A_TR87_SYMBOL_PROJECTION,A_TR87_NOMINAL_RETENTION,A_TR87_EDITOR_RELEASE}
   525 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   526 | 2.12.7 [composition.family.symbolic_constraints.straight_rooted_paths_unary_marginals_to_conditional_indexed_edits] P/D/S Sur chemins droits disjoints et marques unaires mesurés, proposer des préfixes enracinés, réutiliser les contraintes entières et le STEP existants ; transporter le vecteur complet et le compte de continuation actuel dans la question révisable, puis revalider les effets avant la suite. {D_THER_ROOTED_PREFIX_MARGINAL_CONSUMER_20261015,D_THER_CURRENT_ROUTE_COUNT_TRANSPORT_20261015,D_THER_SELECTED_CURRENT_POINT_FACTORY_20261015}
   527 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   528 | 2.12.8 [composition.family.symbolic_constraints.binary_labeled_lanes_to_current_atomic_membership_question] P/D/S Sur deux collections visuelles indépendantes de lignes d’occurrences et une instance homologue courante, composer les caractéristiques ordonnées et l’induction étiquetée existantes ; sous accord relatif à une grammaire atomique déclarée, éprouver la classe par le rectangle actuellement lié, puis conserver le même but et les racines compatibles seulement après reçu observé et revalidation du contexte, sans anticiper les questions futures. {D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016,D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016,D_LABELED_LANE_CURRENT_SOURCE_RELEASE_20261016}
   529 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   530 | 2.12.9 [composition.family.symbolic_constraints.indexed_raster_relations_to_current_panel_submission] P/D/S Conserver les indices et l’inconnu d’une suite de panneaux ; composer les relations de raster déclarées avec une option courante concordante, préparer sa soumission avec WHY et prémisses, puis réobserver la ligne suivante sans importer la règle précédente. {C_INDEXED_PANEL_CURRENT_ANSWER_20261016}
   531 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   532 | 2.12.10 [composition.family.symbolic_constraints.persistent_tuple_catalogue_to_local_historical_acquisition] P/D/S Composer valeurs des grands contrôles et mini-tuples d’un catalogue ; distinguer marque courante migrante et marque quittée persistante, puis préparer une transition locale vers un tuple non marqué sous un but historique révisable, sans résoudre une couverture cyclique générale. {C_TUPLE_CATALOGUE_CURRENT_VISIT_20261016}
   533 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
>  534 | 2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contributions, ouvrir en DRM une première question bornée sur une commande conjointe supposée. SRC conserve but direct, toutes prémisses et validations ordinaires. Le départage spatial de contrôles homologues est un ordre expérimental explicite, pas une loi de hauteur ni une route gagnante présumée ; périodes uniques, gains futurs et correction complète restent ouverts. {D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016,D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016,D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016,D_PROFILE_CURRENT_SOURCE_RELEASE_20261016}
   535 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   536 | 2.6.3 [composition.family.oriented_topology.calibrated_support_graph_terminal_continuation] P/D/S Depuis un départ soutenu et son déplacement observé, préparer la route du graphe mesuré vers un overlay terminal révisable, puis conserver un même plan et but avec prémisses courantes à chaque arête réconciliée. {A_TU93_GRAPH_MEASUREMENT,A_TU93_GRAPH_RELEASE,A_TU93_GRAPH_CONTINUATION}
   537 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   538 | 2.6.4 [composition.family.oriented_topology.axial_glyph_field_to_conditional_budgeted_landings] P/D/S Sur champ régulier de glyphes axiaux, contour unique, anneau et jauge segmentée mesurés, proposer un modèle de rayon depuis la source, réutiliser DOMAIN/BFS existants et tester le premier atterrissage utile ; revalider image, carte, époque, pose et réserve avant de reprendre le suffixe sous le même but. {D_AMZE_CONDITIONAL_GLYPH_LANDING_20261016,D_AMZE_CURRENT_POINT_FACTORY_20261016}
   539 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   540 | 2.6.5 [composition.family.oriented_topology.nested_perforated_frames_to_conditional_configuration] P/D/S Sur cadres imbriqués entièrement mesurés et identifiables, composer hiérarchie de transport, volumes pleins de collision et murs perforés à poches multiples avec K24/admission/CSP/composantes/BFS existants ; tester le contrôle sous modèle révisable, puis conserver le même but et le suffixe déjà tenté seulement après revalidation des poses, du focus, de l’époque et des reçus Source actuels. {D_REGION_CONFIGURATION_EXISTING_SERVICES_20261016,D_REGION_CONFIGURATION_CURRENT_CANDIDATE_20261016}
   541 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   542 | 2.6.6 [composition.family.oriented_topology.observed_channels_and_opposed_surface_connection_question] P/D/S Sur deux commandes homologues et deux bandes verticales opposées entièrement mesurées, composer le point homologue du corps, les affectations observées et les appuis horizontaux en questions révisables de sélection, pose, approche puis réception. Réutiliser les composants et la libération générale ; conserver le même but direct et le contexte réellement dispatché seulement après effet observé, epoch et image revalidés. Aucune loi complète de portail ou route physique sûre n’est prétendue. {D_COMPONENT_CHANNEL_SURFACE_MEASUREMENT_20261016,D_CHANNEL_SURFACE_CURRENT_QUESTION_20261016,D_CHANNEL_SURFACE_CURRENT_SOURCE_RELEASE_20261016}
   543 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   544 | 2.6.7 [composition.family.oriented_topology.scoped_contact_outcome_guides_subordinate_object_relation] P/D/S Depuis le reçu terminal exact d’un contact cellulaire refusé, conserver destinataire, face et contexte mesuré, fermer cette seule expérience et préparer une relation d’objet encore inconnue accessible ; reprendre le même principal et terminal du WHY Source avec les preuves reçues, en laissant ouverts les autres contacts et les états pertinents changés. {B_SCOPED_CONTACT_OUTCOME_SUBORDINATE_RELATION_20261016}
   545 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   546 | 2.6.7.1 [composition.family.oriented_topology.current_returned_contact_packet_preserves_boundary_stable_destinations] P/D/S Après un contact non résolu lié à l’action, la frame, l’époque et au reçu courant, comparer les bornes d’un paquet complet réconcilié ; si elles sont identiques malgré une animation intermédiaire, employer leur support pour le seul filtre de stabilité des destinations. Conserver intégralement les effets transitoires, risques, ressources, autres gardes et inconnues du monde caché. {MAC01_PORT_PACKET_BOUNDARY_DESTINATION_STABILITY_20261017}
   547 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : selected_on_historical_source_only.
   548 | 2.6.8 [composition.family.oriented_topology.filled_square_field_overlays_offer_endpoint_question] P/D/S Composer un champ de cellules pleines, un glyphe compact, un cadre de même encre et les overlays marqués en question de destination actuelle ; conserver le but et une loi de déplacement révisable. {D_CAVA_PUBLIC_FIELD_ENDPOINT_MEASUREMENT,D_CAVA_PUBLIC_MARKED_ENDPOINT_QUESTION}
   549 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   550 | 2.5.5 [composition.family.global_coupling.revalidated_partial_neighbor_reference_placement] P/D/S Acquérir une table partielle depuis la recoloration réciproque de deux membres, la rappeler avec revalidation courante, comparer la référence entière et préparer les placements par les services existants ; conserver le principal et les gardes de continuation. {C_VOIS_PARTIAL_NEIGHBOR_MEASUREMENT,C_VOIS_PARTIAL_NEIGHBOR_MODEL_SCOPE,C_VOIS_PARTIAL_NEIGHBOR_MEMORY,C_VOIS_PAIRED_REFERENCE_PLACEMENT,C_VOIS_CURRENT_PLACEMENT_READINESS,C_VOIS_PURPOSEFUL_REVISIT,C_VOIS_SAME_ORIGIN_ACCESS_COMPARISON}
   551 |   Source au commit : current_producer_consumer_anchors_verified_multiple_sites ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   552 | 2.5.6 [composition.family.global_coupling.current_bounded_edge_pair_operator_question] P/D/S Mesurer une paire de bords opposes et un locus intermediaire ; reutiliser le service axial existant, conserver la preuve courante et preparer une experience sur un operateur exterieur sous un but direct coherent, sans loi physique presume. {C_AXIAL_BOUNDED_PAIR_MEASUREMENT,C_AXIAL_EXISTING_SCENE_SERVICE,C_AXIAL_CURRENT_CANONICAL_REUSE,C_AXIAL_CURRENT_OPERATOR_QUESTION,C_AXIAL_OPERATOR_RELEASE_PRIORITY,C_AXIAL_FAST_SOURCE_ENTRY}
   553 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   554 | 2.7.5 [composition.family.causal_network.regular_port_field_to_conditional_unique_reciprocal_cover] P/D/S Sur champ régulier de ports à traits deux tons, composer domaines de rotations et réciprocité avec le CSP et le rapport de graphe existants ; sous cible complète unique, tester une rotation utile même sèche, puis revalider tous les ports, grille, époque et supports avant reprise du même but sans nouveau CSP. {D_PIPE_CONDITIONAL_RECIPROCAL_COVER_20261016,D_PIPE_CURRENT_POINT_FACTORY_20261016}
   555 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   556 | 2.7.6 [composition.family.causal_network.source_admitted_complete_component_word_series] P/D/S Lier chaque point courant du mot complet de réseau admis, puis exécuter ce mot en série conditionnelle Source avec même but, modèle, ressources et falsificateurs ; réconcilier son résultat, sans réduire le mot à son premier point. {A_TRCP_SOURCE_COMPLETE_NETWORK_WORD_R28}
   557 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   558 | 2.8.2 [composition.family.resource_transaction.observed_compartment_lifecycle_questions_with_current_witnesses] P/D/S Composer contenus encadrés appariés, activation conjointe, activité observée et nouveau contenu en questions contextuelles utiles ; conserver un modèle canonique conditionnel mais renouveler le témoin courant, ses prémisses et le contrôle avant chaque action sous le même but, sans inventer recettes ni durées. {D_SPOR_OBSERVED_CONTEXTUAL_QUESTIONS_20261016,D_SPOR_CANONICAL_METHOD_CURRENT_WITNESS_20261016}
   559 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
```

### 12. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
  3252 |   Limite : Le moteur de points et le SRC choose_information_probe.src:2025 sont réutilisés, sans geste oracle. Le contexte porte explicitement temporal_model_bound=false et native_tie_order_known=false ; WHY experimental_unknown. F03–F09, cône FIT/EVALUATE, macro temporelle complète et sûreté aux phases non qualifiés.
  3253 |   Limite : Médiane5,9065s/n6,démarrage11,406s,total45,406s ; cache86,058s séparé, aucune série. Pas de performance2s ou cadence UI attestée. Quatre fichiers good_run/EVAS/LVL1 validés, comparaison primaire complète avec inconnues préservées, aucune archive native.
  3254 |   Limite : Pas de transfert inter-jeu/L2 : triplet restant baseline, détour déplacé, négatif vraie sélection/corridor libre au centre seulement/exposition future. Aucun global25, test unitaire ou profiling ; états historiques conservés.
  3255 | D_EVAS_SHADOW_LIGHT_20261015 [CODED] domaines.question_ombre_lumiere_pair_semblable : Sous-cas à deux patches carrés rayés équivalents par rotation, surface commune achromatique et champ plus clair non frontalier. Mesures sRGB et changements ordonnés en Python ; significations, but et priorité en DRM ; SRC et producteur de points existants.
  3256 |   Producteur historique : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — annotate_initial_shadow_neighbors (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3257 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:48185 — projection.exploration.initial_shadow_neighbor_qualifies_peer_reach_goal (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3258 |   Producteur actuel : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — resolved
  3259 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67695 — resolved
  3260 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3261 |   Limite : Source644744a3, cinq contrôles PASS ; D_EVAS_SHADOW_LIGHT_NATIVE_R06_20261015.json : gestes1–5 réellement dispatchés sous principle.shadow_start_and_similar_peer_open_light_avoiding_goal, même but, mêmes supports ordinaires racine/intention, claim courant dans les deux listes, permis. Champs radiométriques transportés dans le contexte de contribution.
  3262 |   Limite : Mesure dédiée shadow_light_fields.py:28, principes shadow_light.drm, SRC réutilisé choose_information_probe.src:2025, tous attestés au même commit dans source_files. Les indices de palette ne sont pas une échelle de luminosité. Contraste fourni comme ordre entier, luminances conservées pour inspection.
  3263 |   Limite : R05 conserve l'échec d'activation lié au comparateur entier recevant des décimaux. R06 six primitives sans victoire ni erreur, aucune attente initiale ni RESET ; médiane3,9765s/n6, démarrage11,078s,total34,547s. Nouveau WHY utilisé cinq fois, sixième geste en exploration générale : pas de résolution, de trajet sûr complet ou de performance2s.
  3264 |   Limite : Suppositions révisables seulement : luminosité et changement ne prouvent ni danger ni période. Le champ achromatique doit être assez large et non coupé par le bord ; glyphes rayés, bordures fines et balayage du corps exclus. La sécurité de la commande exige l'emprise entière et tous les ticks/phasages compatibles, encore non raccordés ici.
  3265 |   Limite : Pas de transfert attesté. Triplet restant : baseline préservée, disposition/palette déplacées, contre-cas glyphes ou bordure clairs sans champ mobile. F03–F09, détours et maintien du but sans voisin progressif restent ouverts.
  3266 | D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3267 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — def measure_labeled_predicate_induction_d( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3268 |   Consommateur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3269 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — resolved
  3270 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3271 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3272 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3273 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3274 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3275 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3276 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
> 3277 | D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3278 |   Producteur historique : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — def measure_periodic_profile_preimages_d( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3279 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3280 |   Producteur actuel : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — resolved
  3281 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3282 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3283 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3284 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3285 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3286 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3287 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3288 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3289 | D_HPDL_WORD_PARAMETER_EXPERIMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3290 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3291 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:247 — WORKFLOW choose_information_probe( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3292 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:78120 — resolved
  3293 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:419 — resolved
  3294 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3295 |   Limite : Panneaux horizontaux homologues, mot unique au-dessus, marques pleines ou à un coin absent.
  3296 |   Limite : Ordre des panneaux et sens des champs restent des hypothèses DRM falsifiables ; aucune loi de capture ou de cycle acquise par la géométrie seule.
  3297 |   Limite : Services généraux de clic et de choix réutilisés ; prémisses et deux représentations de l’agenda conservées, pas de second solveur.
  3298 |   Limite : Qualification source et replay de mesures seulement ; sélection native, victoire, transfert et performance non attestés.
  3299 | D_HPDL_WORD_PARAMETER_MEASUREMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3300 |   Producteur historique : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — def append_framed_word_candidates( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3301 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3302 |   Producteur actuel : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — resolved
```

### 13. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
  3332 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3333 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3041 — resolved
  3334 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3335 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3336 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3337 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3338 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3339 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3340 | D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3341 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3342 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:72916 — "id": "projection.exploration.observed_labeled_lanes_open_current_classification_question" (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3343 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3344 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:80676 — resolved
  3345 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3346 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3347 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3348 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3349 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3350 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3351 | D_LOGI_CURRENT_CONNECTOR_QUESTION_BEFORE_INCIDENTAL_SURFACE_20261018 [CODED] current_connector_control_question_before_incidental_surface : Priorité locale de la question causale déjà admise par 2.7.7, sans nouveau solveur, contrat de contrôle ou loi de circuit.
  3352 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:88174 — projection.connector_context.current_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3353 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99618 — tier.current_connector_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3354 |   Limite : Garde sur les contrats existants de connecteur et la question actuelle ; aucun graphe ou table booléenne complète, aucune loi de destination inférée.
  3355 |   Limite : Aucun changement Python ni nouvel ordre de moteur ; les plans engagés et gardes WHY/ACT restent prioritaires.
  3356 |   Limite : Essais de non-régression, positif déplacé et négatif comportemental non exécutés selon la demande humaine ; aucun transfert ou préservation globale attestés.
> 3357 | D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3358 |   Producteur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — def measure_profile_sum_frame( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3359 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3360 |   Producteur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — resolved
  3361 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3362 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3363 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3364 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3365 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3366 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3367 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3368 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3369 | D_OTHER_CATALOGUE_20261015 [CODED] domaines.question_de_catalogue_apres_reponse_de_panneau : Expérience bornée sur une bande géométrique actuelle après mutation du seul panneau ; aucune identité, justesse de réponse ou profondeur imposée.
  3370 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:150 — annotate_patch_adjacent_color_bands -> ordinary _point_candidates (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3371 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:47004 — projection.exploration.patch_response_different_core_selector_question / Source precondition and WHY permit services (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3372 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:206 — resolved
  3373 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67479 — resolved
  3374 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3375 |   Limite : R17 source cinq PASS ; D_GRIL_SELECTOR_PRIORITY_NATIVE_R17_20261015.json joint flag, principe, prémisse ancienne conservée plus support canonique et permis du clic réellement exécuté at:r4:c36.
  3376 |   Limite : Le catalogue suivant est observé mais le solveur y reclique le cadre blanc. Score0, médiane4,359s/n7 ; aucune victoire, mémoire multi-vues, transfert ni performance cible attestés. Aucun test unitaire.
  3377 | D_PATCH_FIELD_20261015 [CODED] domaines.observation_patchs_et_occurrences : Rangées géométriques non contenues, glyphes exacts et occurrences internes ; question de correspondance via sonde non testée, sans plan ni opérateur déjà productif.
  3378 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:6 — measure_repeated_patch_rows / annotate_repeated_patch_rows (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3379 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46932 — projection.exploration.repeated_patch_field_translation_question / agenda SRC existant (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3380 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:43 — resolved
  3381 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68787 — resolved
  3382 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
```

### 14. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
  3395 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
> 3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 15. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
> 3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 16. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432

- arbre : `09d9e9faeea9c102b94c3eed23601aa445aff049` ;
- ref représentative : `origin/op01-op31-c0-c7-audit` ;
- refs associées : `origin/op01-op31-c0-c7-audit`.

```text
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
> 3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3447 |   Producteur actuel : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — resolved
  3448 |   Consommateur actuel : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — resolved
  3449 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3450 |   Limite : Lecture de files plates et d’un quota local ; aucune lecture générale des files repliées.
  3451 |   Limite : Égalité, rang, quotas multiples et viabilité des longues chaînes restent distincts de ce L1.
  3452 |   Limite : Les modèles concordants restent concurrents : une entrée commune sûre ne prouve pas leur identification complète.
  3453 |   Limite : 2.14.5 compound_reference_to_remeasured_upper_port_growth et2.14.6 observed_rectangular_receipts_to_bounded_contributor_and_join_questions sont préservées ; aucun alias par numéro.
  3454 |   Limite : Acquisition, rappel pertinent et revalidation locale conservés ; transfert déplacé/positif/négatif non attesté.
  3455 |   Limite : Cycles instrumentés séparés du démarrage ; médiane complète non mesurée, aucun gain de vitesse déduit.
  3456 | D_RECR_REFERENCE_FITTING_MODEL_INPUT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3457 |   Producteur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:116 — def option_facts(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 17. `docs/migration/v6-delivery-roadmap.md`:129

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
   104 | | generic bounded live-campaign helper | 7/7 | passed |
   105 | | ABBA cost protocol/orchestrator | 8/8 | passed |
   106 | | explicit native session adapter | 9/9 | passed |
   107 | | **Total targeted evidence** | **108/108** | **passed** |
   108 | 
   109 | Important semantic limits:
   110 | 
   111 | - no historical owner priority is invented;
   112 | - multiple owner proposals remain `ambiguous`;
   113 | - public pixel deltas do not infer a `methodRef`;
   114 | - Region method reuse requires an explicit justified `methodRef`;
   115 | - the default public worker decision port is
   116 |   `reconstruction-pending-perception` and does not invent an action;
   117 | - the generic campaign helper is not claimed to reproduce the historical
   118 |   STCK/SMLP campaign corpus;
   119 | - the cost harness reconstructs the ABBA protocol and arithmetic, not the lost
   120 |   historical CLI/checkouts/native runner;
   121 | - `scripts/native-loop-session-adapter.mjs` dispatches only to four explicit
   122 |   A/B × STCK/SMLP runners and owns neither timing nor corpus.
   123 | 
   124 | Current Lot 9B status:
   125 | 
   126 | **functionally qualified for the reconstructed component boundaries above;
   127 | native STCK/SMLP runner and official performance remain to be confirmed.**
   128 | 
>  129 | ### 4.3 9C — `joint_channels`
   130 | 
   131 | Not yet reconstructed on the canonical GitHub baseline.
   132 | 
   133 | Start only after the shared caller/perception contracts used by 9B are stable
   134 | enough to avoid duplicating incompatible infrastructure.
   135 | 
   136 | ## 5. Performance contract
   137 | 
   138 | Recovered official protocol:
   139 | 
   140 | - order: A1 → B1 → B2 → A2;
   141 | - each series runs STCK then SMLP;
   142 | - one warmup per game/series;
   143 | - warmup: 3 actions;
   144 | - four measured sessions per game/series;
   145 | - STCK measured session: 10 actions;
   146 | - SMLP measured session: 15 actions;
   147 | - total warmups: 8 sessions / 24 actions;
   148 | - total measured: 32 sessions / 400 actions;
   149 | - no measured-sample removal;
   150 | - no hidden retry;
   151 | - STCK and SMLP evaluated separately.
   152 | 
   153 | Acceptance:
   154 | 
```

### 18. `docs/migration/v6-delivery-roadmap.md`:270

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
   245 |    reevaluated;
   246 | 3. current entry-point registry rebuilt with evidence-backed counts;
   247 | 4. restoration/checkpoint contracts qualified across reconstructed owners;
   248 | 5. campaigns reproducible from durable GitHub fixtures;
   249 | 6. official STCK/SMLP cost protocol executable with a real native runner;
   250 | 7. both global performance budgets accepted independently;
   251 | 8. any Site publication linked back to a durable canonical GitHub SHA.
   252 | 
   253 | ## 9. Immediate Lot 9 roadmap
   254 | 
   255 | | Step | Status | Next proof |
   256 | | --- | --- | --- |
   257 | | historical Lot 9 recovery audit | complete | preserve unresolved identities |
   258 | | V6 core | targeted functional qualification complete | preserve regression coverage |
   259 | | Region core | reconstructed and qualified | preserve explicit evidence contract |
   260 | | Region owner | reconstructed and qualified | preserve selected/passive dedupe |
   261 | | neutral common caller | reconstructed and qualified | no implicit priority |
   262 | | worker transport boundary | reconstructed and qualified | connect justified decision port |
   263 | | public pixel delta | reconstructed and qualified | preserve no-method-inference rule |
   264 | | generic live campaign helper | reconstructed and qualified | obtain durable STCK/SMLP ports/fixtures |
   265 | | ABBA cost orchestrator | reconstructed and qualified | explicit native adapter available |
   266 | | native session adapter | reconstructed and qualified | provide four real A/B × STCK/SMLP runners |
   267 | | **native STCK/SMLP runners** | **open** | **next priority** |
   268 | | official Lot 9B cost | open | execute after runner restoration |
   269 | | current reconstruction registry | open | rebuild before count claims |
>  270 | | 9C `joint_channels` | open | after shared infrastructure stabilizes |
   271 | | Site publication | blocked | only after GitHub-qualified integrated state |
   272 | 
   273 | ## 10. Next step
   274 | 
   275 | **Recover or reconstruct the four explicit native STCK/SMLP runners from durable
   276 | evidence.**
   277 | 
   278 | If the original corpus or runner identity cannot be established, create a new
   279 | runner only when its inputs, session semantics and measured scope can be stated
   280 | explicitly and requalified. Do not substitute unrelated games for STCK/SMLP and
   281 | do not manufacture benchmark numbers.
```

### 19. `docs/recovery/lot9b-github-recovery-20261112.md`:26

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
     1 | # Lot 9B recovery state on canonical reconstruction — 2026-11-12
     2 | 
     3 | ## Canonical basis
     4 | - Repository: `yannick-fontan-1981/sra-playground`
     5 | - Canonical reconstruction: `recovery/site109-reconstruction-20261112`
     6 | - Lot branch: `recovery/lot9b-region-intervention-restart-20261112`
     7 | - Previous recovery source: `lot9b-github-recovery-20261112`
     8 | 
     9 | ## Historical evidence preserved, not promoted
    10 | - Site 109 / historical native 0.68 / historical 70/76
    11 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299` (unresolved)
    12 | - historical Lot 9B checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657` (unresolved)
    13 | - historical candidate 0.69 / 71/76 / 28/33 material
    14 | 
    15 | These values describe the lost historical line. They do not describe the current
    16 | GitHub reconstruction.
    17 | 
    18 | ## Current canonical reconstruction
    19 | Present:
    20 | - reconstructed V6 operations/composition/authority/target-binding/cache/cycle/trace;
    21 | - focused V6 tests.
    22 | 
    23 | Absent for Lot 9:
    24 | - Region implementation;
    25 | - ChartNavigation implementation;
>   26 | - JointChannels implementation;
    27 | - V6 public worker;
    28 | - live-game campaign helper;
    29 | - official native loop cost harness;
    30 | - V6 delivery roadmap and entry-point progress registry.
    31 | 
    32 | ## Functional status
    33 | The reconstructed V6 core was materialized in a local Git checkout and its
    34 | focused tests were compiled then executed:
    35 | - 27 passed;
    36 | - 0 failed.
    37 | 
    38 | Region is absent, so Lot 9B itself is not yet functionally qualified on the
    39 | new baseline.
    40 | 
    41 | ## Performance status
    42 | Official harness absent.
    43 | 
    44 | **fonctionnellement qualifié pour le noyau V6 reconstruit, performance officielle à confirmer**
    45 | 
    46 | The historical rule remains:
    47 | - STCK global strictly < +10%;
    48 | - SMLP global strictly < +10%;
    49 | - each game separately;
    50 | - no compensation;
    51 | - phase overrun allowed only when the same-game global passes.
```

### 20. `docs/recovery/lot9b-restart-assessment-20261112.md`:114

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
    89 |    pieces are absent;
    90 | 4. the recovered source-identity guards for the historical V6 baseline.
    91 | 
    92 | Historical identities preserved as evidence only:
    93 | 
    94 | - Site reference: 109;
    95 | - historical native reference: 0.68;
    96 | - historical published count: 70/76;
    97 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299`
    98 |   (not currently resolvable in GitHub);
    99 | - historical Lot 9B checkpoint:
   100 |   `70fa973c71849a16ca62ebd66132277669cc9657`
   101 |   (not currently resolvable in GitHub);
   102 | - historical candidate identity: 0.69;
   103 | - historical candidate count: 71/76, 28/33 material.
   104 | 
   105 | These values are **not** promoted to the status of the current reconstruction.
   106 | 
   107 | ## Missing from the canonical reconstruction
   108 | 
   109 | At the time of this assessment the canonical GitHub tree contains no path
   110 | matching any of:
   111 | 
   112 | - `region_intervention`;
   113 | - `chart_navigation`;
>  114 | - `joint_channels`;
   115 | - `yf_arc3_v6`;
   116 | - `scripts/measure-native-loop-costs.mjs`;
   117 | - `tests/helpers/v6-live-game-campaign.ts`;
   118 | - `src/runtime/v6-agent-worker.ts`;
   119 | - `docs/migration/v6-delivery-roadmap.md`;
   120 | - `docs/migration/v6-entry-point-progress.json`.
   121 | 
   122 | Therefore the current reconstruction cannot yet claim the historical
   123 | 70/76 runtime, nor can Lot 9B execute the historical public-worker or official
   124 | performance protocols.
   125 | 
   126 | ## Documented but not exactly reconstructible
   127 | 
   128 | Historical work recorded that Region learned a separator control only after an
   129 | observed intervention and regional effect, then could propose a continuation;
   130 | contradictions invalidated that learned continuation; selected and passive
   131 | returns had distinct acquisition paths.
   132 | 
   133 | That behavior is useful as a future reconstruction contract, but the currently
   134 | available GitHub/Library evidence does **not** contain the exact historical
   135 | TypeScript implementation or the complete original V6 Region source bodies.
   136 | 
   137 | Accordingly:
   138 | 
   139 | - do not recreate `region_intervention` by guessing the old code;
```

### 21. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
   509 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : no_explicit_native_attribution_found.
   510 |   Reste explicite : Qualification native, préservation officielle et transfert restent distincts du raccord source.
   511 | 2.1.15 [composition.family.geometric_correspondence.current_cotranslated_control_shape_completion] P/D/S Compléter une silhouette contrôlée uniquement par les pixels de membres visibles dont la translation commune est mesurée et les appuis canoniques courants ; exiger un pair exact unique de même apparence avant la comparaison. {MAC02_VOIS_CURRENT_COTRANSLATED_CONTROL_20261018}
   512 |   Source au commit : clé ajoutée après le snapshot audité ; réconciliation non établie.
   513 |   Reste explicite : Loi complète, transfert et préservation globale non qualifiés.
   514 | 2.4.3 [composition.family.contextual_operator.observed_topological_reference_pigment_write_questions] P/D/S Préparer une question composée de réglage du pigment puis d’écriture du support depuis une correspondance de poches observée, en réutilisant les points et calculs existants et leur géométrie courante. {C_HOLE_SCOPE,C_HOLE_POCKET_REFERENCE,C_HOLE_PREPARED_PIGMENT,C_HOLE_PREPARED_WRITE,C_HOLE_CURRENT_GEOMETRY}
   515 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   516 | 2.4.4 [composition.family.contextual_operator.observed_linked_selection_property_activation] D/S/P Préparer une sélection distante liée, revalider sa marque actuelle, observer le réglage de propriété puis tester l’activation explicite avec le résultat de préparation et une portée de perception compatible. {C_SELE_LINK_RECALL,C_SELE_ACTIVATION,C_SELE_SCOPE_RETURN}
   517 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   518 | 2.5.4 [composition.family.global_coupling.observed_homologous_boundary_contact_questions] P/D/S Composer plusieurs régions compactes et leurs bandes homologues dans un cadre observé ; tester une direction utile, revalider les contacts puis éprouver le complément sous le même but, sans inventer curseur, pas moteur ou loi de colle. {C_GRAV_BOUNDARY_MEASURE,C_GRAV_BOUNDARY_QUESTION,C_GRAV_BOUNDARY_RELEASE}
   519 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   520 | 2.2.1 [composition.family.rigid_assembly.prepared_ordered_protrusion_continuation] P/D/S Préparer la prochaine approche axiale selon la référence ordonnée, conserver les appuis courants et poursuivre après rétraction géométrique revalidée sous le même parent. {A_SK48_ORDERED_APPROACH,A_SK48_CURRENT_SUPPORT,A_SK48_GEOMETRIC_CLEARANCE}
   521 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   522 | 2.2.2 [composition.family.rigid_assembly.current_oriented_delivery_routes_preserve_packing_parent] P/D/S Préparer prise, transport orienté conjoint et libération dans les réceptions distinctes ; après livraison, poursuivre une route courante restante sous le même parent de rangement avant de créer une question de contact sans nécessité. {A_WA30_CURRENT_DELIVERY_ROUTE,A_WA30_PARENT_BEFORE_CONTACT}
   523 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   524 | 2.12.6 [composition.family.symbolic_constraints.connector_bound_symbol_projection_with_local_edit_navigation] P/D/S Composer la projection d’un dictionnaire de symboles avec les transitions locales acquises et la navigation du focus ; préserver les champs déjà conformes et réconcilier chaque mutation avant la suite. {A_TR87_SYMBOL_PROJECTION,A_TR87_NOMINAL_RETENTION,A_TR87_EDITOR_RELEASE}
   525 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   526 | 2.12.7 [composition.family.symbolic_constraints.straight_rooted_paths_unary_marginals_to_conditional_indexed_edits] P/D/S Sur chemins droits disjoints et marques unaires mesurés, proposer des préfixes enracinés, réutiliser les contraintes entières et le STEP existants ; transporter le vecteur complet et le compte de continuation actuel dans la question révisable, puis revalider les effets avant la suite. {D_THER_ROOTED_PREFIX_MARGINAL_CONSUMER_20261015,D_THER_CURRENT_ROUTE_COUNT_TRANSPORT_20261015,D_THER_SELECTED_CURRENT_POINT_FACTORY_20261015}
   527 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   528 | 2.12.8 [composition.family.symbolic_constraints.binary_labeled_lanes_to_current_atomic_membership_question] P/D/S Sur deux collections visuelles indépendantes de lignes d’occurrences et une instance homologue courante, composer les caractéristiques ordonnées et l’induction étiquetée existantes ; sous accord relatif à une grammaire atomique déclarée, éprouver la classe par le rectangle actuellement lié, puis conserver le même but et les racines compatibles seulement après reçu observé et revalidation du contexte, sans anticiper les questions futures. {D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016,D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016,D_LABELED_LANE_CURRENT_SOURCE_RELEASE_20261016}
   529 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   530 | 2.12.9 [composition.family.symbolic_constraints.indexed_raster_relations_to_current_panel_submission] P/D/S Conserver les indices et l’inconnu d’une suite de panneaux ; composer les relations de raster déclarées avec une option courante concordante, préparer sa soumission avec WHY et prémisses, puis réobserver la ligne suivante sans importer la règle précédente. {C_INDEXED_PANEL_CURRENT_ANSWER_20261016}
   531 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   532 | 2.12.10 [composition.family.symbolic_constraints.persistent_tuple_catalogue_to_local_historical_acquisition] P/D/S Composer valeurs des grands contrôles et mini-tuples d’un catalogue ; distinguer marque courante migrante et marque quittée persistante, puis préparer une transition locale vers un tuple non marqué sous un but historique révisable, sans résoudre une couverture cyclique générale. {C_TUPLE_CATALOGUE_CURRENT_VISIT_20261016}
   533 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
>  534 | 2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contributions, ouvrir en DRM une première question bornée sur une commande conjointe supposée. SRC conserve but direct, toutes prémisses et validations ordinaires. Le départage spatial de contrôles homologues est un ordre expérimental explicite, pas une loi de hauteur ni une route gagnante présumée ; périodes uniques, gains futurs et correction complète restent ouverts. {D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016,D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016,D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016,D_PROFILE_CURRENT_SOURCE_RELEASE_20261016}
   535 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   536 | 2.6.3 [composition.family.oriented_topology.calibrated_support_graph_terminal_continuation] P/D/S Depuis un départ soutenu et son déplacement observé, préparer la route du graphe mesuré vers un overlay terminal révisable, puis conserver un même plan et but avec prémisses courantes à chaque arête réconciliée. {A_TU93_GRAPH_MEASUREMENT,A_TU93_GRAPH_RELEASE,A_TU93_GRAPH_CONTINUATION}
   537 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   538 | 2.6.4 [composition.family.oriented_topology.axial_glyph_field_to_conditional_budgeted_landings] P/D/S Sur champ régulier de glyphes axiaux, contour unique, anneau et jauge segmentée mesurés, proposer un modèle de rayon depuis la source, réutiliser DOMAIN/BFS existants et tester le premier atterrissage utile ; revalider image, carte, époque, pose et réserve avant de reprendre le suffixe sous le même but. {D_AMZE_CONDITIONAL_GLYPH_LANDING_20261016,D_AMZE_CURRENT_POINT_FACTORY_20261016}
   539 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   540 | 2.6.5 [composition.family.oriented_topology.nested_perforated_frames_to_conditional_configuration] P/D/S Sur cadres imbriqués entièrement mesurés et identifiables, composer hiérarchie de transport, volumes pleins de collision et murs perforés à poches multiples avec K24/admission/CSP/composantes/BFS existants ; tester le contrôle sous modèle révisable, puis conserver le même but et le suffixe déjà tenté seulement après revalidation des poses, du focus, de l’époque et des reçus Source actuels. {D_REGION_CONFIGURATION_EXISTING_SERVICES_20261016,D_REGION_CONFIGURATION_CURRENT_CANDIDATE_20261016}
   541 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   542 | 2.6.6 [composition.family.oriented_topology.observed_channels_and_opposed_surface_connection_question] P/D/S Sur deux commandes homologues et deux bandes verticales opposées entièrement mesurées, composer le point homologue du corps, les affectations observées et les appuis horizontaux en questions révisables de sélection, pose, approche puis réception. Réutiliser les composants et la libération générale ; conserver le même but direct et le contexte réellement dispatché seulement après effet observé, epoch et image revalidés. Aucune loi complète de portail ou route physique sûre n’est prétendue. {D_COMPONENT_CHANNEL_SURFACE_MEASUREMENT_20261016,D_CHANNEL_SURFACE_CURRENT_QUESTION_20261016,D_CHANNEL_SURFACE_CURRENT_SOURCE_RELEASE_20261016}
   543 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   544 | 2.6.7 [composition.family.oriented_topology.scoped_contact_outcome_guides_subordinate_object_relation] P/D/S Depuis le reçu terminal exact d’un contact cellulaire refusé, conserver destinataire, face et contexte mesuré, fermer cette seule expérience et préparer une relation d’objet encore inconnue accessible ; reprendre le même principal et terminal du WHY Source avec les preuves reçues, en laissant ouverts les autres contacts et les états pertinents changés. {B_SCOPED_CONTACT_OUTCOME_SUBORDINATE_RELATION_20261016}
   545 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   546 | 2.6.7.1 [composition.family.oriented_topology.current_returned_contact_packet_preserves_boundary_stable_destinations] P/D/S Après un contact non résolu lié à l’action, la frame, l’époque et au reçu courant, comparer les bornes d’un paquet complet réconcilié ; si elles sont identiques malgré une animation intermédiaire, employer leur support pour le seul filtre de stabilité des destinations. Conserver intégralement les effets transitoires, risques, ressources, autres gardes et inconnues du monde caché. {MAC01_PORT_PACKET_BOUNDARY_DESTINATION_STABILITY_20261017}
   547 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : selected_on_historical_source_only.
   548 | 2.6.8 [composition.family.oriented_topology.filled_square_field_overlays_offer_endpoint_question] P/D/S Composer un champ de cellules pleines, un glyphe compact, un cadre de même encre et les overlays marqués en question de destination actuelle ; conserver le but et une loi de déplacement révisable. {D_CAVA_PUBLIC_FIELD_ENDPOINT_MEASUREMENT,D_CAVA_PUBLIC_MARKED_ENDPOINT_QUESTION}
   549 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   550 | 2.5.5 [composition.family.global_coupling.revalidated_partial_neighbor_reference_placement] P/D/S Acquérir une table partielle depuis la recoloration réciproque de deux membres, la rappeler avec revalidation courante, comparer la référence entière et préparer les placements par les services existants ; conserver le principal et les gardes de continuation. {C_VOIS_PARTIAL_NEIGHBOR_MEASUREMENT,C_VOIS_PARTIAL_NEIGHBOR_MODEL_SCOPE,C_VOIS_PARTIAL_NEIGHBOR_MEMORY,C_VOIS_PAIRED_REFERENCE_PLACEMENT,C_VOIS_CURRENT_PLACEMENT_READINESS,C_VOIS_PURPOSEFUL_REVISIT,C_VOIS_SAME_ORIGIN_ACCESS_COMPARISON}
   551 |   Source au commit : current_producer_consumer_anchors_verified_multiple_sites ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   552 | 2.5.6 [composition.family.global_coupling.current_bounded_edge_pair_operator_question] P/D/S Mesurer une paire de bords opposes et un locus intermediaire ; reutiliser le service axial existant, conserver la preuve courante et preparer une experience sur un operateur exterieur sous un but direct coherent, sans loi physique presume. {C_AXIAL_BOUNDED_PAIR_MEASUREMENT,C_AXIAL_EXISTING_SCENE_SERVICE,C_AXIAL_CURRENT_CANONICAL_REUSE,C_AXIAL_CURRENT_OPERATOR_QUESTION,C_AXIAL_OPERATOR_RELEASE_PRIORITY,C_AXIAL_FAST_SOURCE_ENTRY}
   553 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   554 | 2.7.5 [composition.family.causal_network.regular_port_field_to_conditional_unique_reciprocal_cover] P/D/S Sur champ régulier de ports à traits deux tons, composer domaines de rotations et réciprocité avec le CSP et le rapport de graphe existants ; sous cible complète unique, tester une rotation utile même sèche, puis revalider tous les ports, grille, époque et supports avant reprise du même but sans nouveau CSP. {D_PIPE_CONDITIONAL_RECIPROCAL_COVER_20261016,D_PIPE_CURRENT_POINT_FACTORY_20261016}
   555 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   556 | 2.7.6 [composition.family.causal_network.source_admitted_complete_component_word_series] P/D/S Lier chaque point courant du mot complet de réseau admis, puis exécuter ce mot en série conditionnelle Source avec même but, modèle, ressources et falsificateurs ; réconcilier son résultat, sans réduire le mot à son premier point. {A_TRCP_SOURCE_COMPLETE_NETWORK_WORD_R28}
   557 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   558 | 2.8.2 [composition.family.resource_transaction.observed_compartment_lifecycle_questions_with_current_witnesses] P/D/S Composer contenus encadrés appariés, activation conjointe, activité observée et nouveau contenu en questions contextuelles utiles ; conserver un modèle canonique conditionnel mais renouveler le témoin courant, ses prémisses et le contrôle avant chaque action sous le même but, sans inventer recettes ni durées. {D_SPOR_OBSERVED_CONTEXTUAL_QUESTIONS_20261016,D_SPOR_CANONICAL_METHOD_CURRENT_WITNESS_20261016}
   559 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
```

### 22. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
  3252 |   Limite : Le moteur de points et le SRC choose_information_probe.src:2025 sont réutilisés, sans geste oracle. Le contexte porte explicitement temporal_model_bound=false et native_tie_order_known=false ; WHY experimental_unknown. F03–F09, cône FIT/EVALUATE, macro temporelle complète et sûreté aux phases non qualifiés.
  3253 |   Limite : Médiane5,9065s/n6,démarrage11,406s,total45,406s ; cache86,058s séparé, aucune série. Pas de performance2s ou cadence UI attestée. Quatre fichiers good_run/EVAS/LVL1 validés, comparaison primaire complète avec inconnues préservées, aucune archive native.
  3254 |   Limite : Pas de transfert inter-jeu/L2 : triplet restant baseline, détour déplacé, négatif vraie sélection/corridor libre au centre seulement/exposition future. Aucun global25, test unitaire ou profiling ; états historiques conservés.
  3255 | D_EVAS_SHADOW_LIGHT_20261015 [CODED] domaines.question_ombre_lumiere_pair_semblable : Sous-cas à deux patches carrés rayés équivalents par rotation, surface commune achromatique et champ plus clair non frontalier. Mesures sRGB et changements ordonnés en Python ; significations, but et priorité en DRM ; SRC et producteur de points existants.
  3256 |   Producteur historique : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — annotate_initial_shadow_neighbors (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3257 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:48185 — projection.exploration.initial_shadow_neighbor_qualifies_peer_reach_goal (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3258 |   Producteur actuel : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — resolved
  3259 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67695 — resolved
  3260 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3261 |   Limite : Source644744a3, cinq contrôles PASS ; D_EVAS_SHADOW_LIGHT_NATIVE_R06_20261015.json : gestes1–5 réellement dispatchés sous principle.shadow_start_and_similar_peer_open_light_avoiding_goal, même but, mêmes supports ordinaires racine/intention, claim courant dans les deux listes, permis. Champs radiométriques transportés dans le contexte de contribution.
  3262 |   Limite : Mesure dédiée shadow_light_fields.py:28, principes shadow_light.drm, SRC réutilisé choose_information_probe.src:2025, tous attestés au même commit dans source_files. Les indices de palette ne sont pas une échelle de luminosité. Contraste fourni comme ordre entier, luminances conservées pour inspection.
  3263 |   Limite : R05 conserve l'échec d'activation lié au comparateur entier recevant des décimaux. R06 six primitives sans victoire ni erreur, aucune attente initiale ni RESET ; médiane3,9765s/n6, démarrage11,078s,total34,547s. Nouveau WHY utilisé cinq fois, sixième geste en exploration générale : pas de résolution, de trajet sûr complet ou de performance2s.
  3264 |   Limite : Suppositions révisables seulement : luminosité et changement ne prouvent ni danger ni période. Le champ achromatique doit être assez large et non coupé par le bord ; glyphes rayés, bordures fines et balayage du corps exclus. La sécurité de la commande exige l'emprise entière et tous les ticks/phasages compatibles, encore non raccordés ici.
  3265 |   Limite : Pas de transfert attesté. Triplet restant : baseline préservée, disposition/palette déplacées, contre-cas glyphes ou bordure clairs sans champ mobile. F03–F09, détours et maintien du but sans voisin progressif restent ouverts.
  3266 | D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3267 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — def measure_labeled_predicate_induction_d( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3268 |   Consommateur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3269 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — resolved
  3270 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3271 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3272 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3273 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3274 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3275 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3276 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
> 3277 | D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3278 |   Producteur historique : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — def measure_periodic_profile_preimages_d( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3279 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3280 |   Producteur actuel : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — resolved
  3281 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3282 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3283 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3284 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3285 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3286 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3287 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3288 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3289 | D_HPDL_WORD_PARAMETER_EXPERIMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3290 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3291 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:247 — WORKFLOW choose_information_probe( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3292 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:78120 — resolved
  3293 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:419 — resolved
  3294 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3295 |   Limite : Panneaux horizontaux homologues, mot unique au-dessus, marques pleines ou à un coin absent.
  3296 |   Limite : Ordre des panneaux et sens des champs restent des hypothèses DRM falsifiables ; aucune loi de capture ou de cycle acquise par la géométrie seule.
  3297 |   Limite : Services généraux de clic et de choix réutilisés ; prémisses et deux représentations de l’agenda conservées, pas de second solveur.
  3298 |   Limite : Qualification source et replay de mesures seulement ; sélection native, victoire, transfert et performance non attestés.
  3299 | D_HPDL_WORD_PARAMETER_MEASUREMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3300 |   Producteur historique : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — def append_framed_word_candidates( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3301 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3302 |   Producteur actuel : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — resolved
```

### 23. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3357

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
  3332 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3333 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3041 — resolved
  3334 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3335 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3336 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3337 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3338 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3339 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3340 | D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3341 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3342 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:72916 — "id": "projection.exploration.observed_labeled_lanes_open_current_classification_question" (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3343 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3344 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:80676 — resolved
  3345 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3346 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3347 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3348 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3349 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3350 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
  3351 | D_LOGI_CURRENT_CONNECTOR_QUESTION_BEFORE_INCIDENTAL_SURFACE_20261018 [CODED] current_connector_control_question_before_incidental_surface : Priorité locale de la question causale déjà admise par 2.7.7, sans nouveau solveur, contrat de contrôle ou loi de circuit.
  3352 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:88174 — projection.connector_context.current_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3353 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99618 — tier.current_connector_control_question_before_incidental_surface (révision 3b21fd918d771006bb8ee7c1cc9dcdce2e389328)
  3354 |   Limite : Garde sur les contrats existants de connecteur et la question actuelle ; aucun graphe ou table booléenne complète, aucune loi de destination inférée.
  3355 |   Limite : Aucun changement Python ni nouvel ordre de moteur ; les plans engagés et gardes WHY/ACT restent prioritaires.
  3356 |   Limite : Essais de non-régression, positif déplacé et négatif comportemental non exécutés selon la demande humaine ; aucun transfert ou préservation globale attestés.
> 3357 | D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3358 |   Producteur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — def measure_profile_sum_frame( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3359 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3360 |   Producteur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:56 — resolved
  3361 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3362 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3363 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3364 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3365 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3366 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3367 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3368 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3369 | D_OTHER_CATALOGUE_20261015 [CODED] domaines.question_de_catalogue_apres_reponse_de_panneau : Expérience bornée sur une bande géométrique actuelle après mutation du seul panneau ; aucune identité, justesse de réponse ou profondeur imposée.
  3370 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:150 — annotate_patch_adjacent_color_bands -> ordinary _point_candidates (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3371 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:47004 — projection.exploration.patch_response_different_core_selector_question / Source precondition and WHY permit services (révision e3d1dc13400d6fbdc59f2a5b65a342f137a26531)
  3372 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:206 — resolved
  3373 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67479 — resolved
  3374 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3375 |   Limite : R17 source cinq PASS ; D_GRIL_SELECTOR_PRIORITY_NATIVE_R17_20261015.json joint flag, principe, prémisse ancienne conservée plus support canonique et permis du clic réellement exécuté at:r4:c36.
  3376 |   Limite : Le catalogue suivant est observé mais le solveur y reclique le cadre blanc. Score0, médiane4,359s/n7 ; aucune victoire, mémoire multi-vues, transfert ni performance cible attestés. Aucun test unitaire.
  3377 | D_PATCH_FIELD_20261015 [CODED] domaines.observation_patchs_et_occurrences : Rangées géométriques non contenues, glyphes exacts et occurrences internes ; question de correspondance via sonde non testée, sans plan ni opérateur déjà productif.
  3378 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:6 — measure_repeated_patch_rows / annotate_repeated_patch_rows (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3379 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46932 — projection.exploration.repeated_patch_field_translation_question / agenda SRC existant (révision 4ace0833232d1a6cd28b80a83f3d4e7c6ae5a45e)
  3380 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:43 — resolved
  3381 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68787 — resolved
  3382 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
```

### 24. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3420

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
  3395 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
> 3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 25. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3421

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
  3396 | D_PIPE_CURRENT_POINT_FACTORY_20261016 [CODED] Measured regular port field into existing finite CSP and reciprocal graph, exact current rotation question : Complete regular square field, two-tone face profiles, complete singleton orientation population; conditional click quarter-turn and connected acyclic terminal, same-candidate current Source release.
  3397 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3398 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2584 —     STEP inspect_selected_port_rotation_question (révision 80bea9600f79e143d67b9f3a5e5fe94ccd0dd5ad)
  3399 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3400 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:3290 — resolved
  3401 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3402 |   Limite : Click/terminal models remain revisable; keyboard controls, source localization and arbitrary morphology not established.
  3403 |   Limite : Complete singleton-only subcase, not global causal-network implementation or proof of impossibility.
  3404 |   Limite : Final L1 ports predicted and official completion observed; no independent final-L1 raster read from next-level image.
  3405 |   Limite : Scope negatives are not physical transfer; relocated positive and discriminating physical negative remain open.
  3406 |   Limite : No universal performance, two-second decision or UI cadence attestation.
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
> 3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 26. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3432

- arbre : `0b3ee4e3c0c908f0c97e3f2924981cbb64f45bed` ;
- ref représentative : `origin/op01-op31-browser-agent-controller-20261112` ;
- refs associées : `origin/op01-op31-browser-agent-controller-20261112`.

```text
  3407 | D_PIPE_REVALIDATED_PORT_CONTINUATION_20261018 [CODED] revalidated_port_rotation_continuation_before_incidental_surface : Priorité conditionnelle d'une contribution réseau existante, sans nouveau calcul de ports, loi d'alimentation ou solveur.
  3408 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:80950 — projection.exploration.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3409 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:99683 — tier.revalidated_port_rotation_continuation_before_incidental_surface (révision 7ba97e3a97ea78428b01760b1b3667f75bc144cf)
  3410 |   Limite : Le but, l'affectation et le successeur viennent des mécanismes existants ; une recoloration seule ne prouve aucun réseau.
  3411 |   Limite : Aucune loi universelle du terminal ou de rotation, aucun autre jeu ni transfert déplacé qualifié par le code.
  3412 | D_POSITIVE_PANEL_20261015 [CODED] domaines.poses_positives_contenues_et_question_de_panneau : Domaine géométrique courant et exposition neutre des panneaux via _point_candidates ; admission expérimentale locale sans plan engagé ni but dynamique sélectionné, sans adoption des absences ou de la profondeur.
  3413 |   Producteur historique : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:68 — measure_patch_ring_pose_domains / annotate_repeated_patch_rows -> ordinary _point_candidates (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3414 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:46996 — projection.exploration.repeated_patch_positive_pose_panel_question / agenda SRC existant (révision 63d6b96b67e7505029bfa635e0a2cfbe844217a1)
  3415 |   Producteur actuel : agents/yf_arc3_v5/capabilities/repeated_patch_catalogue.py:107 — resolved
  3416 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:68534 — resolved
  3417 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3418 |   Limite : R13 : cinq contrôles PASS, manifeste2e07111e ; D_GRIL_QUESTION_PROGRESS_NATIVE_R13_20261015.json joint le booléen, le but-question, la prémisse canonique non vide et le permis du panneau réellement dispatché. Aucun test unitaire.
  3419 |   Limite : Utilisateur confirme l'expérience révisable. CODED et usage local du panneau n'attestent pas identification complète, justesse individuelle, victoire, transfert, protocole entier ou performance. Les échecs antérieurs restent conservés.
  3420 | D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3421 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75163 — "id": "projection.exploration.profile_sum.open_first_joint_channel_question" (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3422 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2538 —     STEP inspect_selected_profile_sum_question (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3423 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:79120 — resolved
  3424 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2918 — resolved
  3425 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3426 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3427 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3428 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3429 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3430 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3431 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
> 3432 | D_PROFILE_CURRENT_SOURCE_RELEASE_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3433 |   Producteur historique : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — def measure_selected_probe_preconditions(owner, context): (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3434 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2549 —     STEP execute_prepare_selected_profile_sum (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3435 |   Producteur actuel : agents/yf_arc3_v5/state/selected_probe_preconditions.py:45 — resolved
  3436 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:2929 — resolved
  3437 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3438 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3439 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3440 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3441 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3442 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3443 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3444 | D_RECR_PAIRED_FORMAT_ORDERED_MEASUREMENT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3445 |   Producteur historique : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — def measure_display( (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3446 |   Consommateur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — def measure(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
  3447 |   Producteur actuel : agents/yf_arc3_v5/capabilities/observed_ordered_queues.py:84 — resolved
  3448 |   Consommateur actuel : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:16 — resolved
  3449 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3450 |   Limite : Lecture de files plates et d’un quota local ; aucune lecture générale des files repliées.
  3451 |   Limite : Égalité, rang, quotas multiples et viabilité des longues chaînes restent distincts de ce L1.
  3452 |   Limite : Les modèles concordants restent concurrents : une entrée commune sûre ne prouve pas leur identification complète.
  3453 |   Limite : 2.14.5 compound_reference_to_remeasured_upper_port_growth et2.14.6 observed_rectangular_receipts_to_bounded_contributor_and_join_questions sont préservées ; aucun alias par numéro.
  3454 |   Limite : Acquisition, rappel pertinent et revalidation locale conservés ; transfert déplacé/positif/négatif non attesté.
  3455 |   Limite : Cycles instrumentés séparés du démarrage ; médiane complète non mesurée, aucun gain de vitesse déduit.
  3456 | D_RECR_REFERENCE_FITTING_MODEL_INPUT [CODED] constructive_structure.paired_format_queues_to_supported_replenishment_question : Composer une légende de formats appariés, des fronts ordonnés et un quota courant ; comparer ajout puis engagement sous tous les modèles concordants et préparer le seul input supporté, sans remplacer la file par ses effectifs ni effacer les prémisses.
  3457 |   Producteur historique : agents/yf_arc3_v5/scheduler/observed_queue_queries.py:116 — def option_facts(owner,context): (révision 40fe5a38256caacda124fbc75e45d0b61d7938c3)
```

### 27. `docs/recovery/lot9b-github-recovery-20261112.md`:26

- arbre : `0bcb5fc8d3287d5f8b023adcb0f7b99973df997d` ;
- ref représentative : `origin/recovery/op01-op31-c3-core-proofs-20261112` ;
- refs associées : `origin/recovery/op01-op31-c3-core-proofs-20261112`.

```text
     1 | # Lot 9B recovery state on canonical reconstruction — 2026-11-12
     2 | 
     3 | ## Canonical basis
     4 | - Repository: `yannick-fontan-1981/sra-playground`
     5 | - Canonical reconstruction: `recovery/site109-reconstruction-20261112`
     6 | - Lot branch: `recovery/lot9b-region-intervention-restart-20261112`
     7 | - Previous recovery source: `lot9b-github-recovery-20261112`
     8 | 
     9 | ## Historical evidence preserved, not promoted
    10 | - Site 109 / historical native 0.68 / historical 70/76
    11 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299` (unresolved)
    12 | - historical Lot 9B checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657` (unresolved)
    13 | - historical candidate 0.69 / 71/76 / 28/33 material
    14 | 
    15 | These values describe the lost historical line. They do not describe the current
    16 | GitHub reconstruction.
    17 | 
    18 | ## Current canonical reconstruction
    19 | Present:
    20 | - reconstructed V6 operations/composition/authority/target-binding/cache/cycle/trace;
    21 | - focused V6 tests.
    22 | 
    23 | Absent for Lot 9:
    24 | - Region implementation;
    25 | - ChartNavigation implementation;
>   26 | - JointChannels implementation;
    27 | - V6 public worker;
    28 | - live-game campaign helper;
    29 | - official native loop cost harness;
    30 | - V6 delivery roadmap and entry-point progress registry.
    31 | 
    32 | ## Functional status
    33 | The reconstructed V6 core was materialized in a local Git checkout and its
    34 | focused tests were compiled then executed:
    35 | - 27 passed;
    36 | - 0 failed.
    37 | 
    38 | Region is absent, so Lot 9B itself is not yet functionally qualified on the
    39 | new baseline.
    40 | 
    41 | ## Performance status
    42 | Official harness absent.
    43 | 
    44 | **fonctionnellement qualifié pour le noyau V6 reconstruit, performance officielle à confirmer**
    45 | 
    46 | The historical rule remains:
    47 | - STCK global strictly < +10%;
    48 | - SMLP global strictly < +10%;
    49 | - each game separately;
    50 | - no compensation;
    51 | - phase overrun allowed only when the same-game global passes.
```

### 28. `docs/recovery/lot9b-restart-assessment-20261112.md`:114

- arbre : `0bcb5fc8d3287d5f8b023adcb0f7b99973df997d` ;
- ref représentative : `origin/recovery/op01-op31-c3-core-proofs-20261112` ;
- refs associées : `origin/recovery/op01-op31-c3-core-proofs-20261112`.

```text
    89 |    pieces are absent;
    90 | 4. the recovered source-identity guards for the historical V6 baseline.
    91 | 
    92 | Historical identities preserved as evidence only:
    93 | 
    94 | - Site reference: 109;
    95 | - historical native reference: 0.68;
    96 | - historical published count: 70/76;
    97 | - historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299`
    98 |   (not currently resolvable in GitHub);
    99 | - historical Lot 9B checkpoint:
   100 |   `70fa973c71849a16ca62ebd66132277669cc9657`
   101 |   (not currently resolvable in GitHub);
   102 | - historical candidate identity: 0.69;
   103 | - historical candidate count: 71/76, 28/33 material.
   104 | 
   105 | These values are **not** promoted to the status of the current reconstruction.
   106 | 
   107 | ## Missing from the canonical reconstruction
   108 | 
   109 | At the time of this assessment the canonical GitHub tree contains no path
   110 | matching any of:
   111 | 
   112 | - `region_intervention`;
   113 | - `chart_navigation`;
>  114 | - `joint_channels`;
   115 | - `yf_arc3_v6`;
   116 | - `scripts/measure-native-loop-costs.mjs`;
   117 | - `tests/helpers/v6-live-game-campaign.ts`;
   118 | - `src/runtime/v6-agent-worker.ts`;
   119 | - `docs/migration/v6-delivery-roadmap.md`;
   120 | - `docs/migration/v6-entry-point-progress.json`.
   121 | 
   122 | Therefore the current reconstruction cannot yet claim the historical
   123 | 70/76 runtime, nor can Lot 9B execute the historical public-worker or official
   124 | performance protocols.
   125 | 
   126 | ## Documented but not exactly reconstructible
   127 | 
   128 | Historical work recorded that Region learned a separator control only after an
   129 | observed intervention and regional effect, then could propose a continuation;
   130 | contradictions invalidated that learned continuation; selected and passive
   131 | returns had distinct acquisition paths.
   132 | 
   133 | That behavior is useful as a future reconstruction contract, but the currently
   134 | available GitHub/Library evidence does **not** contain the exact historical
   135 | TypeScript implementation or the complete original V6 Region source bodies.
   136 | 
   137 | Accordingly:
   138 | 
   139 | - do not recreate `region_intervention` by guessing the old code;
```

### 29. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:534

- arbre : `0bcb5fc8d3287d5f8b023adcb0f7b99973df997d` ;
- ref représentative : `origin/recovery/op01-op31-c3-core-proofs-20261112` ;
- refs associées : `origin/recovery/op01-op31-c3-core-proofs-20261112`.

```text
   509 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : no_explicit_native_attribution_found.
   510 |   Reste explicite : Qualification native, préservation officielle et transfert restent distincts du raccord source.
   511 | 2.1.15 [composition.family.geometric_correspondence.current_cotranslated_control_shape_completion] P/D/S Compléter une silhouette contrôlée uniquement par les pixels de membres visibles dont la translation commune est mesurée et les appuis canoniques courants ; exiger un pair exact unique de même apparence avant la comparaison. {MAC02_VOIS_CURRENT_COTRANSLATED_CONTROL_20261018}
   512 |   Source au commit : clé ajoutée après le snapshot audité ; réconciliation non établie.
   513 |   Reste explicite : Loi complète, transfert et préservation globale non qualifiés.
   514 | 2.4.3 [composition.family.contextual_operator.observed_topological_reference_pigment_write_questions] P/D/S Préparer une question composée de réglage du pigment puis d’écriture du support depuis une correspondance de poches observée, en réutilisant les points et calculs existants et leur géométrie courante. {C_HOLE_SCOPE,C_HOLE_POCKET_REFERENCE,C_HOLE_PREPARED_PIGMENT,C_HOLE_PREPARED_WRITE,C_HOLE_CURRENT_GEOMETRY}
   515 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   516 | 2.4.4 [composition.family.contextual_operator.observed_linked_selection_property_activation] D/S/P Préparer une sélection distante liée, revalider sa marque actuelle, observer le réglage de propriété puis tester l’activation explicite avec le résultat de préparation et une portée de perception compatible. {C_SELE_LINK_RECALL,C_SELE_ACTIVATION,C_SELE_SCOPE_RETURN}
   517 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   518 | 2.5.4 [composition.family.global_coupling.observed_homologous_boundary_contact_questions] P/D/S Composer plusieurs régions compactes et leurs bandes homologues dans un cadre observé ; tester une direction utile, revalider les contacts puis éprouver le complément sous le même but, sans inventer curseur, pas moteur ou loi de colle. {C_GRAV_BOUNDARY_MEASURE,C_GRAV_BOUNDARY_QUESTION,C_GRAV_BOUNDARY_RELEASE}
   519 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   520 | 2.2.1 [composition.family.rigid_assembly.prepared_ordered_protrusion_continuation] P/D/S Préparer la prochaine approche axiale selon la référence ordonnée, conserver les appuis courants et poursuivre après rétraction géométrique revalidée sous le même parent. {A_SK48_ORDERED_APPROACH,A_SK48_CURRENT_SUPPORT,A_SK48_GEOMETRIC_CLEARANCE}
   521 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   522 | 2.2.2 [composition.family.rigid_assembly.current_oriented_delivery_routes_preserve_packing_parent] P/D/S Préparer prise, transport orienté conjoint et libération dans les réceptions distinctes ; après livraison, poursuivre une route courante restante sous le même parent de rangement avant de créer une question de contact sans nécessité. {A_WA30_CURRENT_DELIVERY_ROUTE,A_WA30_PARENT_BEFORE_CONTACT}
   523 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   524 | 2.12.6 [composition.family.symbolic_constraints.connector_bound_symbol_projection_with_local_edit_navigation] P/D/S Composer la projection d’un dictionnaire de symboles avec les transitions locales acquises et la navigation du focus ; préserver les champs déjà conformes et réconcilier chaque mutation avant la suite. {A_TR87_SYMBOL_PROJECTION,A_TR87_NOMINAL_RETENTION,A_TR87_EDITOR_RELEASE}
   525 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   526 | 2.12.7 [composition.family.symbolic_constraints.straight_rooted_paths_unary_marginals_to_conditional_indexed_edits] P/D/S Sur chemins droits disjoints et marques unaires mesurés, proposer des préfixes enracinés, réutiliser les contraintes entières et le STEP existants ; transporter le vecteur complet et le compte de continuation actuel dans la question révisable, puis revalider les effets avant la suite. {D_THER_ROOTED_PREFIX_MARGINAL_CONSUMER_20261015,D_THER_CURRENT_ROUTE_COUNT_TRANSPORT_20261015,D_THER_SELECTED_CURRENT_POINT_FACTORY_20261015}
   527 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   528 | 2.12.8 [composition.family.symbolic_constraints.binary_labeled_lanes_to_current_atomic_membership_question] P/D/S Sur deux collections visuelles indépendantes de lignes d’occurrences et une instance homologue courante, composer les caractéristiques ordonnées et l’induction étiquetée existantes ; sous accord relatif à une grammaire atomique déclarée, éprouver la classe par le rectangle actuellement lié, puis conserver le même but et les racines compatibles seulement après reçu observé et revalidation du contexte, sans anticiper les questions futures. {D_LABELED_LANE_GEOMETRY_TO_CURRENT_QUESTION_20261016,D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016,D_LABELED_LANE_CURRENT_SOURCE_RELEASE_20261016}
   529 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   530 | 2.12.9 [composition.family.symbolic_constraints.indexed_raster_relations_to_current_panel_submission] P/D/S Conserver les indices et l’inconnu d’une suite de panneaux ; composer les relations de raster déclarées avec une option courante concordante, préparer sa soumission avec WHY et prémisses, puis réobserver la ligne suivante sans importer la règle précédente. {C_INDEXED_PANEL_CURRENT_ANSWER_20261016}
   531 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   532 | 2.12.10 [composition.family.symbolic_constraints.persistent_tuple_catalogue_to_local_historical_acquisition] P/D/S Composer valeurs des grands contrôles et mini-tuples d’un catalogue ; distinguer marque courante migrante et marque quittée persistante, puis préparer une transition locale vers un tuple non marqué sous un but historique révisable, sans résoudre une couverture cyclique générale. {C_TUPLE_CATALOGUE_CURRENT_VISIT_20261016}
   533 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
>  534 | 2.12.11 [composition.family.symbolic_constraints.observed_periodic_layers_to_initial_joint_channel_experiment] P/D/S Composer profils remplis répétés, points homologues et bandes empilées actuellement mesurés avec les services périodiques FIT/EVALUATE existants ; si la pile concorde avec les contributions, ouvrir en DRM une première question bornée sur une commande conjointe supposée. SRC conserve but direct, toutes prémisses et validations ordinaires. Le départage spatial de contrôles homologues est un ordre expérimental explicite, pas une loi de hauteur ni une route gagnante présumée ; périodes uniques, gains futurs et correction complète restent ouverts. {D_OBSERVED_PERIODIC_LAYERS_CURRENT_SAMPLES_20261016,D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016,D_PROFILE_CURRENT_JOINT_CHANNEL_QUESTION_20261016,D_PROFILE_CURRENT_SOURCE_RELEASE_20261016}
   535 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   536 | 2.6.3 [composition.family.oriented_topology.calibrated_support_graph_terminal_continuation] P/D/S Depuis un départ soutenu et son déplacement observé, préparer la route du graphe mesuré vers un overlay terminal révisable, puis conserver un même plan et but avec prémisses courantes à chaque arête réconciliée. {A_TU93_GRAPH_MEASUREMENT,A_TU93_GRAPH_RELEASE,A_TU93_GRAPH_CONTINUATION}
   537 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   538 | 2.6.4 [composition.family.oriented_topology.axial_glyph_field_to_conditional_budgeted_landings] P/D/S Sur champ régulier de glyphes axiaux, contour unique, anneau et jauge segmentée mesurés, proposer un modèle de rayon depuis la source, réutiliser DOMAIN/BFS existants et tester le premier atterrissage utile ; revalider image, carte, époque, pose et réserve avant de reprendre le suffixe sous le même but. {D_AMZE_CONDITIONAL_GLYPH_LANDING_20261016,D_AMZE_CURRENT_POINT_FACTORY_20261016}
   539 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   540 | 2.6.5 [composition.family.oriented_topology.nested_perforated_frames_to_conditional_configuration] P/D/S Sur cadres imbriqués entièrement mesurés et identifiables, composer hiérarchie de transport, volumes pleins de collision et murs perforés à poches multiples avec K24/admission/CSP/composantes/BFS existants ; tester le contrôle sous modèle révisable, puis conserver le même but et le suffixe déjà tenté seulement après revalidation des poses, du focus, de l’époque et des reçus Source actuels. {D_REGION_CONFIGURATION_EXISTING_SERVICES_20261016,D_REGION_CONFIGURATION_CURRENT_CANDIDATE_20261016}
   541 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   542 | 2.6.6 [composition.family.oriented_topology.observed_channels_and_opposed_surface_connection_question] P/D/S Sur deux commandes homologues et deux bandes verticales opposées entièrement mesurées, composer le point homologue du corps, les affectations observées et les appuis horizontaux en questions révisables de sélection, pose, approche puis réception. Réutiliser les composants et la libération générale ; conserver le même but direct et le contexte réellement dispatché seulement après effet observé, epoch et image revalidés. Aucune loi complète de portail ou route physique sûre n’est prétendue. {D_COMPONENT_CHANNEL_SURFACE_MEASUREMENT_20261016,D_CHANNEL_SURFACE_CURRENT_QUESTION_20261016,D_CHANNEL_SURFACE_CURRENT_SOURCE_RELEASE_20261016}
   543 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   544 | 2.6.7 [composition.family.oriented_topology.scoped_contact_outcome_guides_subordinate_object_relation] P/D/S Depuis le reçu terminal exact d’un contact cellulaire refusé, conserver destinataire, face et contexte mesuré, fermer cette seule expérience et préparer une relation d’objet encore inconnue accessible ; reprendre le même principal et terminal du WHY Source avec les preuves reçues, en laissant ouverts les autres contacts et les états pertinents changés. {B_SCOPED_CONTACT_OUTCOME_SUBORDINATE_RELATION_20261016}
   545 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   546 | 2.6.7.1 [composition.family.oriented_topology.current_returned_contact_packet_preserves_boundary_stable_destinations] P/D/S Après un contact non résolu lié à l’action, la frame, l’époque et au reçu courant, comparer les bornes d’un paquet complet réconcilié ; si elles sont identiques malgré une animation intermédiaire, employer leur support pour le seul filtre de stabilité des destinations. Conserver intégralement les effets transitoires, risques, ressources, autres gardes et inconnues du monde caché. {MAC01_PORT_PACKET_BOUNDARY_DESTINATION_STABILITY_20261017}
   547 |   Source au commit : current_producer_consumer_anchors_verified ; chemins statiques explicites retrouvés. Usage : selected_on_historical_source_only.
   548 | 2.6.8 [composition.family.oriented_topology.filled_square_field_overlays_offer_endpoint_question] P/D/S Composer un champ de cellules pleines, un glyphe compact, un cadre de même encre et les overlays marqués en question de destination actuelle ; conserver le but et une loi de déplacement révisable. {D_CAVA_PUBLIC_FIELD_ENDPOINT_MEASUREMENT,D_CAVA_PUBLIC_MARKED_ENDPOINT_QUESTION}
   549 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   550 | 2.5.5 [composition.family.global_coupling.revalidated_partial_neighbor_reference_placement] P/D/S Acquérir une table partielle depuis la recoloration réciproque de deux membres, la rappeler avec revalidation courante, comparer la référence entière et préparer les placements par les services existants ; conserver le principal et les gardes de continuation. {C_VOIS_PARTIAL_NEIGHBOR_MEASUREMENT,C_VOIS_PARTIAL_NEIGHBOR_MODEL_SCOPE,C_VOIS_PARTIAL_NEIGHBOR_MEMORY,C_VOIS_PAIRED_REFERENCE_PLACEMENT,C_VOIS_CURRENT_PLACEMENT_READINESS,C_VOIS_PURPOSEFUL_REVISIT,C_VOIS_SAME_ORIGIN_ACCESS_COMPARISON}
   551 |   Source au commit : current_producer_consumer_anchors_verified_multiple_sites ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   552 | 2.5.6 [composition.family.global_coupling.current_bounded_edge_pair_operator_question] P/D/S Mesurer une paire de bords opposes et un locus intermediaire ; reutiliser le service axial existant, conserver la preuve courante et preparer une experience sur un operateur exterieur sous un but direct coherent, sans loi physique presume. {C_AXIAL_BOUNDED_PAIR_MEASUREMENT,C_AXIAL_EXISTING_SCENE_SERVICE,C_AXIAL_CURRENT_CANONICAL_REUSE,C_AXIAL_CURRENT_OPERATOR_QUESTION,C_AXIAL_OPERATOR_RELEASE_PRIORITY,C_AXIAL_FAST_SOURCE_ENTRY}
   553 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   554 | 2.7.5 [composition.family.causal_network.regular_port_field_to_conditional_unique_reciprocal_cover] P/D/S Sur champ régulier de ports à traits deux tons, composer domaines de rotations et réciprocité avec le CSP et le rapport de graphe existants ; sous cible complète unique, tester une rotation utile même sèche, puis revalider tous les ports, grille, époque et supports avant reprise du même but sans nouveau CSP. {D_PIPE_CONDITIONAL_RECIPROCAL_COVER_20261016,D_PIPE_CURRENT_POINT_FACTORY_20261016}
   555 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   556 | 2.7.6 [composition.family.causal_network.source_admitted_complete_component_word_series] P/D/S Lier chaque point courant du mot complet de réseau admis, puis exécuter ce mot en série conditionnelle Source avec même but, modèle, ressources et falsificateurs ; réconcilier son résultat, sans réduire le mot à son premier point. {A_TRCP_SOURCE_COMPLETE_NETWORK_WORD_R28}
   557 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
   558 | 2.8.2 [composition.family.resource_transaction.observed_compartment_lifecycle_questions_with_current_witnesses] P/D/S Composer contenus encadrés appariés, activation conjointe, activité observée et nouveau contenu en questions contextuelles utiles ; conserver un modèle canonique conditionnel mais renouveler le témoin courant, ses prémisses et le contrôle avant chaque action sous le même but, sans inventer recettes ni durées. {D_SPOR_OBSERVED_CONTEXTUAL_QUESTIONS_20261016,D_SPOR_CANONICAL_METHOD_CURRENT_WITNESS_20261016}
   559 |   Source au commit : current_producer_consumer_anchors_verified ; chemin statique complet non établi par cet audit. Usage : no_explicit_native_attribution_found.
```

### 30. `reference/sra/212d8d426f07/docs/reasoning-tree/composition-target-tree_v-1.0.txt`:3277

- arbre : `0bcb5fc8d3287d5f8b023adcb0f7b99973df997d` ;
- ref représentative : `origin/recovery/op01-op31-c3-core-proofs-20261112` ;
- refs associées : `origin/recovery/op01-op31-c3-core-proofs-20261112`.

```text
  3252 |   Limite : Le moteur de points et le SRC choose_information_probe.src:2025 sont réutilisés, sans geste oracle. Le contexte porte explicitement temporal_model_bound=false et native_tie_order_known=false ; WHY experimental_unknown. F03–F09, cône FIT/EVALUATE, macro temporelle complète et sûreté aux phases non qualifiés.
  3253 |   Limite : Médiane5,9065s/n6,démarrage11,406s,total45,406s ; cache86,058s séparé, aucune série. Pas de performance2s ou cadence UI attestée. Quatre fichiers good_run/EVAS/LVL1 validés, comparaison primaire complète avec inconnues préservées, aucune archive native.
  3254 |   Limite : Pas de transfert inter-jeu/L2 : triplet restant baseline, détour déplacé, négatif vraie sélection/corridor libre au centre seulement/exposition future. Aucun global25, test unitaire ou profiling ; états historiques conservés.
  3255 | D_EVAS_SHADOW_LIGHT_20261015 [CODED] domaines.question_ombre_lumiere_pair_semblable : Sous-cas à deux patches carrés rayés équivalents par rotation, surface commune achromatique et champ plus clair non frontalier. Mesures sRGB et changements ordonnés en Python ; significations, but et priorité en DRM ; SRC et producteur de points existants.
  3256 |   Producteur historique : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — annotate_initial_shadow_neighbors (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3257 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:48185 — projection.exploration.initial_shadow_neighbor_qualifies_peer_reach_goal (révision a80a2979cfbd3228d072a071f5d87c05a8f33d84)
  3258 |   Producteur actuel : agents/yf_arc3_v5/capabilities/ordered_patch_motion.py:169 — resolved
  3259 |   Consommateur actuel : agents/yf_arc3_v5/drm/interaction.drm:67695 — resolved
  3260 |   Raccord statique : static_connection_not_established. Les branches dynamiques non établies restent explicites.
  3261 |   Limite : Source644744a3, cinq contrôles PASS ; D_EVAS_SHADOW_LIGHT_NATIVE_R06_20261015.json : gestes1–5 réellement dispatchés sous principle.shadow_start_and_similar_peer_open_light_avoiding_goal, même but, mêmes supports ordinaires racine/intention, claim courant dans les deux listes, permis. Champs radiométriques transportés dans le contexte de contribution.
  3262 |   Limite : Mesure dédiée shadow_light_fields.py:28, principes shadow_light.drm, SRC réutilisé choose_information_probe.src:2025, tous attestés au même commit dans source_files. Les indices de palette ne sont pas une échelle de luminosité. Contraste fourni comme ordre entier, luminances conservées pour inspection.
  3263 |   Limite : R05 conserve l'échec d'activation lié au comparateur entier recevant des décimaux. R06 six primitives sans victoire ni erreur, aucune attente initiale ni RESET ; médiane3,9765s/n6, démarrage11,078s,total34,547s. Nouveau WHY utilisé cinq fois, sixième geste en exploration générale : pas de résolution, de trajet sûr complet ou de performance2s.
  3264 |   Limite : Suppositions révisables seulement : luminosité et changement ne prouvent ni danger ni période. Le champ achromatique doit être assez large et non coupé par le bord ; glyphes rayés, bordures fines et balayage du corps exclus. La sécurité de la commande exige l'emprise entière et tous les ticks/phasages compatibles, encore non raccordés ici.
  3265 |   Limite : Pas de transfert attesté. Triplet restant : baseline préservée, disposition/palette déplacées, contre-cas glyphes ou bordure clairs sans champ mobile. F03–F09, détours et maintien du but sans voisin progressif restent ouverts.
  3266 | D_EXISTING_LABELED_PREDICATE_KERNEL_CONSUMED_20261016 [CODED] Observed binary lane collections to current conditional membership through existing ordered/predicate services : Complete closed frame pair, independent uniform occurrence lanes with partial-square anchor, homologous current instance, matched frame-tone rectangles and measured accepted-prefix strip; declared atomic grammar and exact current Source release.
  3267 |   Producteur historique : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — def measure_labeled_predicate_induction_d( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3268 |   Consommateur historique : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — def measure_labeled_sequence_loci( (révision dfb86ab258954fdc702849d7d450d677a5903caa)
  3269 |   Producteur actuel : agents/yf_arc3_v5/capabilities/labeled_predicate_induction_d.py:117 — resolved
  3270 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/labeled_sequence_observation_d.py:47 — resolved
  3271 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3272 |   Limite : Atomic agreement is relative to a declared finite grammar, not a uniquely identified generating law; compound restrictions remain unexamined.
  3273 |   Limite : No missing-card or editable-word interpretation, no eight-answer oracle word or action series.
  3274 |   Limite : Physical creator negative withdraws stale context; automatic error recovery and learning remain unqualified.
  3275 |   Limite : Recolored mechanical positive and Source-scope negatives are not an actual-use physical transfer triplet.
  3276 |   Limite : No universal morphology, broad symbolic-family closure, UI cadence or two-second performance attestation.
> 3277 | D_EXISTING_PERIODIC_FIT_AND_EVALUATE_CONSUMED_20261016 [CODED] Observed periodic layers, homologous sample points and stacked contributions open a first joint-channel experiment : Horizontal filled profiles on equally spaced dashed baselines, common sample columns, positive external paired receiver marks and mirrored framed arrows; existing FIT/EVALUATE, conditional sum and one initial unknown-channel question.
  3278 |   Producteur historique : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — def measure_periodic_profile_preimages_d( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3279 |   Consommateur historique : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — def measure_profile_sum_loci( (révision 3167b54155b9c28c0fec7cd11e1163969d262c9e)
  3280 |   Producteur actuel : agents/yf_arc3_v5/capabilities/periodic_profile_preimages_d.py:76 — resolved
  3281 |   Consommateur actuel : agents/yf_arc3_v5/capabilities/profile_sum_observation_d.py:147 — resolved
  3282 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3283 |   Limite : The leftmost homologous control is a declared deterministic experimental tie-break, not a law relating direction to height or a known winning successor.
  3284 |   Limite : Finite visible repetition does not prove a unique future period; no collective gains are invented or claimed retained after terminal.
  3285 |   Limite : The entry exposes the first unknown-channel experiment only; subsequent phase correction, full inverse-domain search and modular channel planning remain separate obligations.
  3286 |   Limite : Success markers may extend into receiver borders; the initial-layout recognizer is not a complete accepted-state comparator.
  3287 |   Limite : Mirror/recolor and Source-scope negatives do not prove a physical transfer triplet.
  3288 |   Limite : Complete first-decision measurement is 13.530s/n1, not the 1.984s post-start loop alone; no general performance or UI cadence attestation.
  3289 | D_HPDL_WORD_PARAMETER_EXPERIMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3290 |   Producteur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3291 |   Consommateur historique : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:247 — WORKFLOW choose_information_probe( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3292 |   Producteur actuel : agents/yf_arc3_v5/drm/interaction.drm:78120 — resolved
  3293 |   Consommateur actuel : agents/yf_arc3_v5/src/arc3/choose_information_probe.src:419 — resolved
  3294 |   Raccord statique : explicit_static_path_found. Les branches dynamiques non établies restent explicites.
  3295 |   Limite : Panneaux horizontaux homologues, mot unique au-dessus, marques pleines ou à un coin absent.
  3296 |   Limite : Ordre des panneaux et sens des champs restent des hypothèses DRM falsifiables ; aucune loi de capture ou de cycle acquise par la géométrie seule.
  3297 |   Limite : Services généraux de clic et de choix réutilisés ; prémisses et deux représentations de l’agenda conservées, pas de second solveur.
  3298 |   Limite : Qualification source et replay de mesures seulement ; sélection native, victoire, transfert et performance non attestés.
  3299 | D_HPDL_WORD_PARAMETER_MEASUREMENT [CODED] parameterized_program.ordered_word_framed_parameter_experiment : Entrée bornée vers une question générale de paramètres ; pas une résolution de train ou de capture.
  3300 |   Producteur historique : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — def append_framed_word_candidates( (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3301 |   Consommateur historique : agents/yf_arc3_v5/drm/interaction.drm:75402 — "id": "projection.framed_word.prefix_correspondence_experiment" (révision 647754c67590b83bcdab35a5e8f9ef3ed8e242d0)
  3302 |   Producteur actuel : agents/yf_arc3_v5/capabilities/framed_word_parameters_d.py:159 — resolved
```

Contexte limité aux 30 premiers hits uniques.

