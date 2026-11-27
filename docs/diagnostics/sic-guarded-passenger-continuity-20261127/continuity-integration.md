# Additive continuity integration

The owner branch supplies `scripts/sic-passenger-continuity.mjs`, `scripts/sic-passenger-continuity-contract.mjs`, its six observer tests and additive dispatch/return/acquisition hooks in `scripts/compare-source100.mjs`. Other owners add hooks in that same file; combine the imports, owner set, transient capture and respective before/after/seal calls without replacing them.

In `scripts/verify-sic-continuity.mjs`:

- Import `requirePassengerContinuity`, `passengerCeilings`, `passengerContinuity` from the new contract.
- Add `CGWL: 'move'` to sources and `CGWL: passengerContinuity.length` to campaign lengths.
- Apply the same L1, zero initial score, one-worker and `requireExecutedPrefix` requirements as PORT/LS20.
- In the generic expected-kind assertion, skip levels whose `passengerContinuity[i][1]` is zero. Level 1 still protects its existing movement series.
- Add the physical branch `code === 'CGWL' ? requirePassengerContinuity(run, issued, groups) : ...`. This single helper validates per-level ceilings, zero resets, total native continuations, every passenger binding/return/acquisition and separate loaded/approach minima.
- Add a local cohort `['guarded-passengers', 'source:CGWL', String(passengerContinuity.length), String(Math.max(...passengerCeilings))]`.
- Add the same CGWL / six levels / cap74 cohort to the workflow matrix.

The preserved reference rows are `[commands, all continuations, loaded continuations, approach continuations]`:

| Level | Commands | All continuations | Loaded | Approach | Original action cap |
|---|---:|---:|---:|---:|---:|
| 1 | 15 | 3 | 0 | 0 | 20 |
| 2 | 16 | 0 | 0 | 0 | 21 |
| 3 | 15 | 0 | 0 | 0 | 19 |
| 4 | 18 | 0 | 0 | 0 | 23 |
| 5 | 61 | 29 | 22 | 7 | 74 |
| 6 | 42 | 13 | 12 | 1 | 48 |

These counts come from actual native tickets. The initial physical collector exposed the same-ink component counterexample and is not a passing physical receipt. The final combined continuity run must collect fresh evidence using the corrected footprint observer, then pass this contract. No previous cohort or threshold is removed or reduced.
