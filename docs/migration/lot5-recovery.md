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

## Recovery progress from authoritative Git donor

Donor repository:
- `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`
- branch: `codex/v6-combined-publication`
- inspected donor commit: `a911106d318e79f498cccf302c54149d12cfbfeb`

### 5A linked temporal preparation

Donor:
- `agents/yf_arc3_v6/laya_proto/common_linked_preparation.py`

Recovery port:
- `src/logos-engine/linked-preparation.ts`
- `tests/linked-preparation.test.ts`

Ported responsibilities:
- complete neutral public observations before lifecycle checks;
- delegate proposal generation to the phase relation owner;
- mark admitted proposals with `linked_preparation_plan`;
- delegate proposal binding;
- complete before/after observations before phase reconciliation;
- accumulate phase events;
- retain official level-boundary evidence;
- delegate preservation obligations.

Local commit:
- `dbf16ff` `feat(lot5): port linked temporal preparation adapter`

GitHub commits:
- `be0a55fd2ce081dbf6be2c5a637db2cfb9996c67`
- `e4990e26d0de070bb446db1b271125d4cdbe11bf`

### 5B observed addressed material

Donors:
- `agents/yf_arc3_v6/laya_proto/common_addressed_material.py`
- `agents/yf_arc3_v6/laya_proto/common_addressed_field.py`

Recovery port currently covers the neutral observation-completion wrapper only. `AddressedField` remains a separate donor-owned behavior and is not yet claimed as fully ported.

Recovery files:
- `src/logos-engine/addressed-material.ts`
- `tests/addressed-material.test.ts`

Local commit:
- `ed261f0` `feat(lot5): port addressed material observation wrapper`

GitHub commits:
- `c630260e7a224b1b5834a699486f9dff5043d733`
- `78dcc995b5dce32341868b6443794c20fa3a5f1e`

### 5C observed object binding continuity

Donors:
- `agents/yf_arc3_v6/morphology_policy/guarded_binding/family.py`
- `agents/yf_arc3_v6/morphology_policy/guarded_binding/binding.src`
- `agents/yf_arc3_v6/morphology_policy/guarded_binding/binding.drm`

Recovery port currently covers the parent-composition continuity and persistence slice:
- stale selected frame -> `refuted` return;
- confirmed reception separation -> `achieved` return;
- official level boundary -> `boundary` return;
- selected frame remains retained while effect/refutation is pending;
- tracker remains owner of state/restore.

Geometry, offer generation, ranking and action planning are not yet claimed as fully ported.

Recovery files:
- `src/logos-engine/observed-object-binding.ts`
- `tests/observed-object-binding.test.ts`

Local commit:
- `70462c0` `feat(lot5): port object binding continuity lifecycle`

GitHub commits:
- `8dbafd4c99c52bfb49b80b50d817b1b6cf209779`
- `50fa82f0f7656f71e8e6d549e1029a7f8703c30b`

## Current recovery qualification

Local checkout:
- `/mnt/data/sra-playground-lot5-recovery`
- branch: `recovery/lot5-canonical-buffer`

Checks:
- TypeScript typecheck: pass (`tsc --noEmit`)
- Node tests with local Node 22.16.0 and `--experimental-strip-types`: **20/20 pass**

This is a recovery qualification for the newly reconstructed slices. It does not replace the historical 270/270 canonical-buffer qualification and does not yet authorize the historical STCK/SMLP performance claim.

## Next recovery work

1. Port the remaining `AddressedField` behavior needed by 5B from `common_addressed_field.py` without game-specific shortcuts.
2. Port the remaining object-binding geometry/planning path needed by 5C from the guarded-binding donor family.
3. Reconnect these slices to an actual common runtime/consumer path.
4. Only after the functional path exists, reconstruct the canonical JSON allocation optimization and the native-loop performance harness.
5. Re-run STCK and SMLP independently; accept only when each complete-session median delta remains strictly below +10%.
