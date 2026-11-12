# V6 and Lot 9 source identities preserved for reconstruction — 2026-11-12

These identities are guards and historical evidence. They do not certify that
the current reconstruction is identical to historical Site 109.

## Current canonical reconstruction
Baseline branch:
`recovery/site109-reconstruction-20261112`

Observed baseline commit during this Lot 9 restart:
`092936319b5a1baa274b3a639e42ffd0f4ce58b5`

Reconstructed V6 core currently present:
- `src/logos-engine/v6-operations.ts`
- `src/logos-engine/v6-composition-engine.ts`
- `src/logos-engine/v6-native-authority.ts`
- `src/logos-engine/v6-target-binding.ts`
- `src/logos-engine/v6-operation-cache.ts`
- `src/logos-engine/v6-operation-cycle.ts`
- `src/logos-engine/v6-operation-trace.ts`

Focused functional validation on an API-materialized local checkout:
**27/27 passed** after TypeScript compilation.

## Historical identities, evidence only
Historical Site reference:
- Site 109
- native 0.68
- 70/76 entries
- Site SHA `d90ce5b64fffa53cca201e2a6a49450fd123f299` — not currently resolved

Historical baseline checkout inspected by the OP verification plan:
- historical commit `8462204043aa368faa7df280d796bb706eb53b38`
- V6 donor/source provenance `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`
- historical SHA-256 of `src/logos-engine/v6-operations.ts`:
  `4aad959893595a1844721b93ec8897479536f95ccfa890be045656fa1e96fa06`

Historical Lot 9B:
- checkpoint `70fa973c71849a16ca62ebd66132277669cc9657` — unresolved
- old work branch `lot9b-region-intervention-20261112` — unavailable
- old backup branch `lot9b-region-intervention-checkpoint-20261112` — unavailable
- candidate identity 0.69
- historical candidate count 71/76, 28/33 material

## Missing identities/components
No exact Region implementation is currently available on the canonical branch or
old GitHub recovery branch.

The canonical tree also lacks:
- `scripts/measure-native-loop-costs.mjs`
- `tests/helpers/v6-live-game-campaign.ts`
- `src/runtime/v6-agent-worker.ts`
- `docs/migration/v6-delivery-roadmap.md`
- `docs/migration/v6-entry-point-progress.json`

Do not infer historical equivalence from matching filenames or remembered
behavior. Any Region reconstruction without exact source identity must be
requalified as a new implementation.
