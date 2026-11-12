# V6 source identities recovered from persistent evidence — 2026-11-12

These identities are recovery guards. They do not reconstruct the missing V6 source by themselves.

## Baseline source checkout previously inspected
- Historical checkout: `/workspace/sites/sra-lot9a-baseline067-20261112`
- Historical commit: `8462204043aa368faa7df280d796bb706eb53b38`
- Historical V6 operations source provenance snapshot: `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`
- SHA-256 observed for `src/logos-engine/v6-operations.ts`: `4aad959893595a1844721b93ec8897479536f95ccfa890be045656fa1e96fa06`

## Expected V6 runtime paths from the OP01-OP31 plan
- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-target-binding.ts`
- `src/logos-engine/catalog.json`
- `tests/v6-operations.test.ts`
- `tests/fixtures/v6-operations-reference.json`
- `tests/v6-composition-engine.test.ts`
- `tests/fixtures/v6-composition-engine-reference.json`
- `docs/migration/v6-delivery-roadmap.md`

## Expected benchmark/delivery paths recovered from prior qualification evidence
- `scripts/measure-native-loop-costs.mjs`
- `tests/helpers/v6-live-game-campaign.ts`
- `src/runtime/v6-agent-worker.ts`

## Lot 9B identities to require before benchmark
- Native candidate version: `0.69.0`
- Historical 9B checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657`
- Historical work branch: `lot9b-region-intervention-20261112`
- Historical backup branch: `lot9b-region-intervention-checkpoint-20261112`
- Expected wiring count after Region integration: `71/76`, `28/33` material

## Acceptance rule
Do not treat a reconstructed tree as the historical 9B candidate merely because filenames or behavior look similar. The restored source must be reconciled against the recovered identities and then requalified if exact source identity cannot be established.
