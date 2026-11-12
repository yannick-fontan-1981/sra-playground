# Lot 5 recovery branch

This branch is the GitHub-backed recovery workspace for Lot 5 after the original Sites-backed checkout became unavailable.

## Git authority

Recovery base:
- branch: `recovery/lot6c-product-dispatch`
- base commit: `e42adcccdedeca541a9e7988c7ec5277c5c4411a`

Current recovery branch:
- `recovery/lot5-canonical-buffer`

Historical Lot 5 checkpoints retained as provenance only:
- intermediate: `0654dcd7109e9b67b41f3d00dbc060ee6cdde79f`
- final known: `d1199006fb990d049611136ea1af9a64f388d8de`

Those historical commits are not currently resolved by the GitHub repository and this recovery branch does not claim ancestry or cryptographic equivalence with them.

## Missing from the GitHub recovery base

The current GitHub recovery base does not contain:
- `src/logos-engine/*`
- `canonical.ts`
- `scripts/measure-native-loop-costs.mjs`
- `docs/migration/v6-delivery-roadmap.md`

Therefore the historical canonical-buffer implementation cannot be benchmarked or reconstructed as an exact diff from this base yet.

## Canonical-buffer contract to recover

Historical qualification established that only `canonical.ts` changed in the native engine and that the affected function was `immutableJson`.

The recovered behavioral contract is:
- reuse a private recursive buffer to reduce intermediate allocations;
- remove at least one temporary array per JSON array traversal;
- remove the temporary entry array and temporary entry pairs for object traversal;
- preserve validation behavior and error ordering;
- preserve size and depth limits;
- preserve cycle detection;
- preserve freezing/immutability;
- never mutate caller-owned input values;
- do not add game-specific or decision-specific logic.

Historical functional evidence to reproduce before performance measurement:
- 270/270 tests;
- TypeScript build successful;
- 56 scenarios / 425 controls;
- review 31/31;
- archive parity 351/351 for A and B.

## Performance gate

Official harness name retained from the historical work:
- `scripts/measure-native-loop-costs.mjs`

Official order:
- A1 -> B1 -> B2 -> A2

Games:
- STCK
- SMLP

Acceptance rule:
- complete-session median delta for STCK must be strictly below +10%;
- complete-session median delta for SMLP must be strictly below +10%;
- +10.000% exactly fails;
- an individual phase may exceed +10% when the complete-session median for that game remains strictly below +10%;
- no compensation across games.

## Recovery checkout verification

Sparse local recovery checkout:
- path: `/mnt/data/sra-playground-lot5-recovery`
- local branch: `recovery/lot5-canonical-buffer`
- local checkpoint: `1537fe9`

The local runtime is Node 22.16.0 while the repository requires >=22.18.0. The recovered product-dispatch tests pass with Node's experimental TypeScript stripping:
- 6/6 passing

## Next Git work

Recover the missing TypeScript Logos Engine source into this branch from an authoritative Git source before implementing canonical-buffer. Do not recreate the missing engine surface from memory alone.
