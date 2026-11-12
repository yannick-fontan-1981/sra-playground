# Lot 9B GitHub/local recovery state — 2026-11-12

## Goal
Resume lot 9B `region_intervention` strictly from GitHub plus a local Git checkout, without inventing source code or benchmark results.

## Known qualified checkpoint
- Historical checkpoint: `70fa973c71849a16ca62ebd66132277669cc9657`
- Historical work branch: `lot9b-region-intervention-20261112`
- Historical backup branch: `lot9b-region-intervention-checkpoint-20261112`
- Candidate identity: native `0.69.0`
- Candidate wiring count: `71/76` total, `28/33` material
- Official cost and publication: still pending

## GitHub repository actually reachable
- Repository: `yannick-fontan-1981/sra-playground`
- Default branch: `main`
- Other visible branch: `op01-op31-c0-c7-audit`
- Recovery branch: `lot9b-github-recovery-20261112`
- Audit branch was observed advancing to `ab4a35ca198132b615ee4eea64dd533b16ac4227`
- `main` commit observed: `8f8b179718d06a51dc8818deb68c977cd5e1e820`

## Missing from GitHub
The historical 9B branch and checkpoint SHA are not reachable from the public GitHub repository.
The visible audit branch does not contain these expected V6 delivery files:
- `scripts/measure-native-loop-costs.mjs`
- `tests/helpers/v6-live-game-campaign.ts`
- `src/runtime/v6-agent-worker.ts`
- `docs/migration/v6-delivery-roadmap.md`
- `region_intervention` native TypeScript integration

The visible branch does contain the legacy `src/runtime/game-worker.ts` and OP01–OP31 audit documentation only.

## Official benchmark contract recovered from prior evidence
- Harness: `scripts/measure-native-loop-costs.mjs`
- Workload: native Node worker/controller replay; not browser rendering and not live game execution
- Order: `A1 -> B1 -> B2 -> A2`
- Games measured separately: `STCK`, `SMLP`
- Measured sessions: `32`
- Measured actions: `400`
- Warmups: `8` sessions / `24` actions, excluded
- Acceptance: each global complete-session median increase must be strictly `< +10.000%`
- A phase may exceed `+10%` when the corresponding game global remains strictly below `+10%`
- No cross-game compensation
- No sample removal

## Automated recovery preflight
- Local preflight: `scripts/recovery/check-lot9b-prereqs.py`
- It refuses the official 0.69 benchmark until the four required V6 delivery files and a Region integration marker are present.
- Current generated status is retained in `docs/recovery/lot9b-preflight-current.json`.

## Next safe action
Recover or push the exact 9B source snapshot to GitHub. Only then reconstruct a full local checkout, rerun functional qualification if required by source identity, and execute the official benchmark.
