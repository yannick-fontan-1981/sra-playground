# Lot 6C recovery branch

This branch is a recovery workspace created after the original Sites-backed checkout became unavailable.

Authoritative original checkpoint:
- `41f60dbedd0235ae3edbd2063a8e892141f51cfe`
- original checkpoint ref: `lot6c-observed-rigid-cargo-checkpoint-20261111`

This branch does **not** claim ancestry or cryptographic equivalence with that checkpoint.

Recovered product-dispatch scope:
- readiness predicate
- terminal/unavailable action rejection
- ACTION6 coordinate preservation
- simple-action coordinate stripping
- dispatch timing excluding presentation
- operation -> measurement -> presentation -> idle ordering
- stale-generation rejection

Local reconstructed checkout:
- branch: `recovery/lot6c-product-dispatch`
- tests: 6/6 passing before GitHub synchronization

Performance rule retained:
A phase may exceed +10% provided the complete-session median increase for the same game remains strictly below +10%. No compensation across games.
