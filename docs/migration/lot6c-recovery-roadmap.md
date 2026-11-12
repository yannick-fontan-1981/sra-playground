# Lot 6C recovery roadmap

Authoritative original Sites checkpoint: `41f60dbedd0235ae3edbd2063a8e892141f51cfe`.

Recovery GitHub branch: `recovery/lot6c-product-dispatch`.

## Current recovery status

- Reconstructed shared product dispatch module.
- Main product action path on the GitHub recovery branch routes through the shared dispatch.
- Main presentation can retain `busy` until dispatch completion.
- Dispatch timing excludes presentation.
- ACTION6 preserves coordinates and simple actions strip them.
- Obsolete action returns are rejected.
- Generation changes during presentation do not release the newer selection's `busy` ownership.
- Local recovery validation: 9/9 tests passing.
- GitHub branch head verified before this documentation commit: `7ec7cf3736607fee202a1a2d8f999fa98944c420`.

## Boundaries

This recovery branch is not claimed to be cryptographically descended from the original Sites checkpoint. Historical 6C proofs remain historical evidence until reconciled against a recovered original checkout or independently requalified on this branch.

No official performance result has been measured on the recovery branch. The rule remains: a phase may exceed +10% only if the complete-session median increase for the same game remains strictly below +10%; games do not compensate one another.

## Next step

Reconstruct enough of the current product runtime around `main.ts` and `BrowserGameRuntime` into the local checkout to run a local TypeScript integration/typecheck against the actual product source, then qualify the dispatch path beyond static source guards. Do not reopen closed GABA or KLOT payloads for this step.
