# Lot 9B recovery state on canonical reconstruction — 2026-11-12

## Canonical basis
- Repository: `yannick-fontan-1981/sra-playground`
- Canonical reconstruction: `recovery/site109-reconstruction-20261112`
- Lot branch: `recovery/lot9b-region-intervention-restart-20261112`
- Previous recovery source: `lot9b-github-recovery-20261112`

## Historical evidence preserved, not promoted
- Site 109 / historical native 0.68 / historical 70/76
- historical Site SHA: `d90ce5b64fffa53cca201e2a6a49450fd123f299` (unresolved)
- historical Lot 9B checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657` (unresolved)
- historical candidate 0.69 / 71/76 / 28/33 material

These values describe the lost historical line. They do not describe the current
GitHub reconstruction.

## Current canonical reconstruction
Present:
- reconstructed V6 operations/composition/authority/target-binding/cache/cycle/trace;
- focused V6 tests.

Absent for Lot 9:
- Region implementation;
- ChartNavigation implementation;
- JointChannels implementation;
- V6 public worker;
- live-game campaign helper;
- official native loop cost harness;
- V6 delivery roadmap and entry-point progress registry.

## Functional status
The reconstructed V6 core was materialized in a local Git checkout and its
focused tests were compiled then executed:
- 27 passed;
- 0 failed.

Region is absent, so Lot 9B itself is not yet functionally qualified on the
new baseline.

## Performance status
Official harness absent.

**fonctionnellement qualifié pour le noyau V6 reconstruit, performance officielle à confirmer**

The historical rule remains:
- STCK global strictly < +10%;
- SMLP global strictly < +10%;
- each game separately;
- no compensation;
- phase overrun allowed only when the same-game global passes.

## Next
Recover an exact Region source/corpus if available. If exact identity cannot be
recovered, reconstruct a new Region implementation only from explicit evidence
and requalify it as a new implementation rather than claiming historical
identity.
