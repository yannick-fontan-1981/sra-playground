# Lot 10A final gate preparation: source review

This review was performed on 2026-11-10 while the renewed 5A quiet request was active. It used source text, file names and Git diffs only. No tests, Python imports, builds, replay, oracle generation, archive work, decompression or timing were performed. It does not establish a final integrated pass.

## Concrete correction

`run-regressions.py` previously performed output compression and final input fingerprinting directly in its outer `finally` block. A compression error or a missing watched file could therefore raise before the final receipt was written, leaving `regression-launch.json` at `running` even after a catchable failure.

The bounded correction separates output retention, execution-input integrity and native-source integrity into guarded stages. Each failed stage records its exception in `finalizationErrors`; the original driver error remains intact. The raw output fingerprint is recorded before compression. A terminal failed receipt is then written when the receipt destination remains writable. Existing outputs still cannot be overwritten by a new attempt. The correction changes neither the replay host nor the comparator. Its syntax and runtime validation remain pending the explicit compute release.

No shared runtime, historical proof helper, freeze tool, comparator, migration roadmap or active test-scope declaration was changed by this review.

## Receipt and freeze contracts

The release runner emits `logos-engine.native-delta-verification.v1`, the exact schema accepted by `scripts/verify-native-delivery.py`. Its test receipt contains the explicit test-file list, source/test inventory, complete TAP summary and native-source identity. Its project-check receipt uses the five names required by that verifier: `typecheck`, `entry-audit`, `migration-audit`, `diff-check`, and `build`. The production worker and build-input fields match the verifier's contract.

The runner requires the current native inventory to equal `source-manifest.json` before execution. It checks that inventory, all source/test inputs and its additional watched scripts and declarations before and after each check. The entry audit checks the actual Axial family and source entry without hard-coding the total connected count, so successor registrations can change that count. The migration audit checks both its printed JSON and stored report for an empty `failures` array; ordinary exit zero is insufficient.

The existing source freeze covers every `.ts`, `.json` and `.drm` input under `src/logos-engine` and `src/runtime`, plus its explicit campaign/build helper list. The unchanged delivery verifier recomputes this native inventory, checks every archived member and validates the exact archive parts. The new lot 10A runners and scope declarations are fingerprinted through their validation/replay receipts; they are not additional members of the historical freeze helper's explicit non-native helper list. This review does not describe that native archive as a complete archive of every delivery tool.

The regression summary remains the existing `logos-engine.recorded-public-regressions.v1` receipt consumed by the delivery verifier. The lot 10A launch receipt adds provenance and failure retention around the unchanged durable driver. Both runners use the nonblocking shared coordination lock. Explicit lane coordination is still required before invoking them.

## Regression population and action accounting

The default manifest preserves its exact Site 83 identity: seven actual native 0.52 reports retained in commit `bed48116585da864dd5c412ed11dd6990a950e8e`, with separate report and complete-public-trace SHA256 values. Later predecessor integration must not silently relabel those files as a newer baseline. An updated baseline needs its own explicit manifest.

The unchanged prevalidator checks every archived command against the trace and independently recomputes every complete public-packet hash before replay. It derives command, packet, animation, prefix, request and natural-boundary totals from the retained content. The released-baseline host verifies that the decoded historical root has been released before importing the native harness. Expected commands remain host comparison data; they do not initialize the native owner.

The unchanged comparator checks 17 contracts per case, including exact command arrays, complete packet hashes, animation lengths, primitive boundaries, selected source entries, acquired prefix lengths, coordination fields, caller counters and final results. The launcher requires all seven cases and all 119 comparisons. The declared Site 83 reports retain 292 actions and 210 prefixes; the executed preflight and comparison receipts must provide the actual accounting on the final attempt.

The manifest intentionally has an empty `passiveOwnerRequirements` array. These seven historical replays therefore do not establish exact Axial state equality or new-owner presence on every prefix. Axial's independent source fixture and common-runtime tests supply its separate state/acquisition contracts. Timing, newly added family state and full Python caller parity remain outside these historical comparisons.

The raw Node journal, complete replay report, preparation receipt, comparison and durable started/final execution receipts are retained by the existing streamlog driver. Failed attempts must remain in their original directories; a correction uses a new attempt directory. None of this source review produces a replay result.

## Proposed scope after actual predecessor integration

The active base declaration remains 31 files, including both Axial files and the modified RadialPort registry test. Its shared registration, source routing, caller, authority, checkpoint and graph tests already cover those contracts. The following additions are proposed only after the actual published 5A, 4B and 7B source is integrated. No active extra-test manifest has been created.

The proposal was derived from source diffs against Site 83 in the predecessor workspaces. It must be reconciled with their final published commits. If all listed files and changes survive, the final declaration contains 42 files: the existing 31 plus these 11.

| Predecessor | Exact additional test path | Source change or integration contract justifying it |
| --- | --- | --- |
| 5A | `tests/kernel-batch.test.ts` | `kernel.ts` adds staged transactions and `v6-knowledge-store.ts` uses them for checkpoint writes; verify ordered hashes, atomic failure, immutable graph sharing and node limits. |
| 5A | `tests/v6-frontier-native-snapshot.test.ts` | `v6-observed-frontier.ts` and `v6-native-caller.ts` add native-owned snapshots and restored branch sharing; verify ingress ownership, invalid-delta atomicity and authoritative restoration. |
| 5A | `tests/v6-crossed-prefix-access.test.ts` | `v6-crossed-prefix-access.ts` changes bounded assignment behavior and current public-point support; preserve exact completed outcomes and refusal at resource limits. |
| 5A | `tests/v6-native-mixed-path.test.ts` | The predecessor changes shared runtime execution; preserve key/click/key continuation, per-step guards, actual-return acquisition and natural-boundary sealing. |
| 5A | `tests/v6-linked-temporal-preparation.test.ts` | The new temporal owner and its shared common/contact/phase modules exercise current evidence acquisition, guards, refusal rollback, checkpoints and epoch release. |
| 5A | `tests/v6-linked-temporal-reference.test.ts` | Retain the new owner's independent original-source contract and portable checkpoint behavior after combining all owners. |
| 4B | `tests/v6-learned-preparation-priority.test.ts` | The predecessor edits this test's exact source-entry order, including `relative_arrangement`; the final registry must reconcile that expectation. |
| 4B | `tests/v6-relative-arrangements-integration.test.ts` | `v6-native-runtime.ts` registers the new owner and `v6-native-types.ts` adds `sourceGroupStop`; verify source routing, one persistent owner, measured-return consequences and graph restoration. |
| 4B | `tests/v6-relative-arrangements-reference.test.ts` | Preserve the geometry/planner/family source contract, failed-trial exclusion, epoch reset and non-aliasing after shared integration. |
| 7B | `tests/v6-symbol-transactions-kernel.test.ts` | The production registry places Symbols after Workshop; verify its one owner, actual SRC selection, ineffective-action acquisition and foreign-return behavior. |
| 7B | `tests/v6-symbol-transactions-reference.test.ts` | Preserve the new Symbols source contract after it is combined with Axial and the other published owners. |

The additional list should be supplied through the existing `--extra-tests` option after integration. That option records and fingerprints the explicit manifest and selected file list. It does not discover or expand tests during execution. The final runner records observed TAP counts; the preparation-time Axial counts of 130 reference tests and six kernel tests are not substituted for a final run.

## Remaining final-gate work

Integrate the actual published predecessors, reconcile the explicit scope and source registry expectations, restore the exact required gzip originals, then freeze the final source. Run the affected tests, five project gates and seven recorded-return regressions only after the coordination release. Preserve all outputs and compare the resulting receipts with the unchanged delivery verifier. Final game, cost and publication evidence remain separate work owned by the root task.
