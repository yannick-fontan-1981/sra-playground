# Lot 9B restart assessment from the canonical GitHub reconstruction — 2026-11-12

## Scope

Lot: **9B — `region_intervention`**

Canonical reconstruction baseline:
`recovery/site109-reconstruction-20261112`

Previous recovery branch compared:
`lot9b-github-recovery-20261112`

This assessment follows `AGENTS.md`,
`docs/migration/git-site-sync-policy.md`,
`docs/recovery/site109-reconstruction-status.md`, and
`docs/recovery/parallel-lot-restart-protocol.md`.

The current GitHub reconstruction is **not claimed to be identical to historical
Site 109 / native 0.68**.

## Git comparison

GitHub comparison of the previous Lot 9 recovery branch against the canonical
reconstruction reported:

- status: `diverged`;
- previous recovery branch ahead by 5 commits;
- previous recovery branch behind by 30 commits;
- merge base: `2c9e8b45555fa21dbc4cb22a2cc66c7efb1383ac`;
- the old branch contributes only recovery documentation/preflight files, not
  the historical Region TypeScript implementation.

Files unique to the old recovery branch at comparison time:

- `docs/recovery/lot9b-github-recovery-20261112.md`
- `docs/recovery/lot9b-preflight-current.json`
- `docs/recovery/v6-source-identities-20261112.md`
- `scripts/recovery/check-lot9b-prereqs.py`

## Already present in the canonical reconstruction

The canonical baseline now contains a real reconstructed V6 core:

- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-target-binding.ts`
- `src/logos-engine/v6-operation-cache.ts`
- `src/logos-engine/v6-operation-cycle.ts`
- `src/logos-engine/v6-operation-trace.ts`

It also contains focused tests for these components.

### Functional test executed on the canonical V6 core

A local checkout materialized from the canonical GitHub files was compiled
because the available Node runtime is 22.16 while the repository requires
Node >=22.18 for direct TypeScript test loading.

Command shape used:

```text
tsc --noCheck --rewriteRelativeImportExtensions \
    --module nodenext --moduleResolution nodenext --target es2022 \
    --outDir .test-build src/logos-engine/*.ts tests/v6-*.test.ts
node --test .test-build/tests/v6-*.test.js
```

Result:

- 27 tests;
- 27 passed;
- 0 failed.

The first direct `node --test tests/v6-*.test.ts` attempt failed before test
execution with `ERR_UNKNOWN_FILE_EXTENSION` because the local Node version is
22.16. This is retained as an environment mismatch, not a functional V6
failure.

## Recoverable with evidence

The following material from the old recovery branch remains useful and can be
ported safely because it is documentary or protective rather than an invented
runtime implementation:

1. the historical Lot 9 identities and known checkpoint references;
2. the historical performance acceptance contract;
3. the preflight that blocks official 0.69 measurement while required runtime
   pieces are absent;
4. the recovered source-identity guards for the historical V6 baseline.

Historical identities preserved as evidence only:

- Site reference: 109;
- historical native reference: 0.68;
- historical published count: 70/76;
- historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299`
  (not currently resolvable in GitHub);
- historical Lot 9B checkpoint:
  `70fa973c71849a16ca62ebd66132277669cc9657`
  (not currently resolvable in GitHub);
- historical candidate identity: 0.69;
- historical candidate count: 71/76, 28/33 material.

These values are **not** promoted to the status of the current reconstruction.

## Missing from the canonical reconstruction

At the time of this assessment the canonical GitHub tree contains no path
matching any of:

- `region_intervention`;
- `chart_navigation`;
- `joint_channels`;
- `yf_arc3_v6`;
- `scripts/measure-native-loop-costs.mjs`;
- `tests/helpers/v6-live-game-campaign.ts`;
- `src/runtime/v6-agent-worker.ts`;
- `docs/migration/v6-delivery-roadmap.md`;
- `docs/migration/v6-entry-point-progress.json`.

Therefore the current reconstruction cannot yet claim the historical
70/76 runtime, nor can Lot 9B execute the historical public-worker or official
performance protocols.

## Documented but not exactly reconstructible

Historical work recorded that Region learned a separator control only after an
observed intervention and regional effect, then could propose a continuation;
contradictions invalidated that learned continuation; selected and passive
returns had distinct acquisition paths.

That behavior is useful as a future reconstruction contract, but the currently
available GitHub/Library evidence does **not** contain the exact historical
TypeScript implementation or the complete original V6 Region source bodies.

Accordingly:

- do not recreate `region_intervention` by guessing the old code;
- do not claim the historical 183-test Lot 9B result for the current baseline;
- do not claim 71/76 for the current reconstruction until Region is
  reconstructed and requalified;
- treat any future behavioral reconstruction as a new implementation unless
  source identity can be established.

## Performance status

The historical acceptance rule is retained:

- STCK complete-session global median increase strictly < +10%;
- SMLP complete-session global median increase strictly < +10%;
- each game evaluated independently;
- no cross-game compensation;
- an internal phase may exceed +10% when that game's global remains below
  +10%;
- no measured sample removal.

The official harness is not restored. Current status:

**fonctionnellement qualifié pour le noyau V6 reconstruit, performance officielle à confirmer**

This does not yet qualify Region itself because Region is still absent.

## Next Lot 9 step

1. preserve/port the old recovery guards onto this branch;
2. search durable GitHub evidence for the original Region Python/V6 source or
   an exact fixture/corpus;
3. if exact source is recovered, port it and establish parity;
4. otherwise define a new reconstruction contract from documented evidence,
   explicitly distinct from the historical implementation;
5. only after Region functional qualification, restore worker/campaign/harness
   paths and run the official cost protocol.
