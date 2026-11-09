# Lot 2C cost protocol

This protocol is declared before measuring the changed implementation. The baseline is the completed lot 2B after run, whose native digest `17252e294212a1563b75037a0b0dd782c2ecbc8cc4e1997a4f2bb2103bdf4e8b` is the published Site 62 implementation `0.34.0`, commit `e56118da8b5f596b9727ca78a037e930bc333860`. `baseline-reuse.json` binds the byte-identical copy and its historical receipt. This is an explicitly reused earlier measurement on the same host and runtime, not a new baseline run. Its Git-head field records the base before that implementation was committed.

## Unchanged common comparison

The original `scripts/measure-native-loop-costs.mjs` and `scripts/compare-native-loop-costs.mjs` remain unchanged. Use the exact input manifest path `docs/migration/lot2b-evidence/performance/cases.json`, because that path is part of the immutable baseline inputs. The comparator must enforce identical generator, declarations, trace bytes, manifest, environment description, measured work and counts. Native source must remain frozen throughout each measured run.

STCK executes 10 actions per session, SMLP 15 and LIFE 49. Each case has three warmup actions and three fresh-knowledge measured sessions in the same Node worker. A version therefore performs 222 measured actions and nine warmup actions. Recorded public observations are released only after the cold native agent computes the matching command. Changed trajectories must be reported separately; no mismatched public return may be supplied.

The unchanged budget applies to eight observed medians on STCK and SMLP, with a maximum increase of 10%: complete session, new decision, service continuation, continuation request, guard, acquisition including persistence, persistence alone and family restoration. LIFE remains a separate finite longer-session diagnostic. A noisy excess remains unresolved and the noise is never added to the allowance. Counts, medians, ranges and between-round median variation are retained; p95 is withheld below 20 samples. Nested timings must not be summed.

The actual controller, service and full native runtime perform the replay. Game execution time is zero; public-return lookup/copy time is separate. Browser rendering, animation, hosting and live game time are outside this comparison. Three explicit inspections measure service serialization and worker transport, without controller acceptance or rendered inspection. Pause is tested during initial planning and the first engaged action; these fixed points do not establish arbitrary long-search preemption.

## Measurement window and limits

The after run receives a reserved project window. Other agents may read code and edit documentation, but must not deliberately run campaigns, tests, builds or fixture generation concurrently. This shared host is not an isolated machine; external CPU activity is not separately measured. Any detected project overlap remains documented. Matched-work timing is an observed cost comparison, not a hardware-independent speed guarantee, a memory-leak proof or hours-long stability evidence.

The common controls do not establish the cost or utility of new method/entry/managed branches. Any separate positive-path measurement must retain its own inputs and scope. V62 did not expose those connected branches; no fabricated zero-cost baseline or improvement ratio is assigned to their new work.

## Reproduction

Use an unused output path. All runners refuse to overwrite immutable evidence.

```bash
node scripts/measure-native-loop-costs.mjs \
  docs/migration/lot2b-evidence/performance/cases.json \
  docs/migration/lot2c-evidence/performance/after.json

node scripts/compare-native-loop-costs.mjs \
  docs/migration/lot2c-evidence/performance/comparison-policy.json \
  docs/migration/lot2c-evidence/performance/baseline.json.gz \
  docs/migration/lot2c-evidence/performance/after.json.gz \
  docs/migration/lot2c-evidence/performance/comparison.json
```

Lossless compressed receipts preserve the original JSON bytes. Native digests identify actual measured code while the changed checkout is still uncommitted.
