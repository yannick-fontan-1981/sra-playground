# Bounded Lot 5 coordination transport, v2

This directory contains a new supervisor and byte-identical retained copies of the two previous checkpoint helpers. The original helpers and cost controllers are not edited here.

## Public command

Invoke the Python supervisor directly, **without an outer flock**. The public CLI accepts only these helper choices:

- `checkpoint`: the pinned 4,953-byte retained legacy helper.
- `bounded-checkpoints`: the pinned 7,201-byte retained transport helper.
- `sites-workflow`: the official Sites 1.1.6 script at its fixed absolute path, with the fixed project argument `appgprj_6adbc388d79081918581b93b919d7258`. Six script/dependency fingerprints are checked before launch. No arbitrary command-line argv is accepted.

Example (the parent directory of the fresh receipt must already exist):

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/coordination-tools-v2/run-bounded-locked-command.py --helper bounded-checkpoints --receipt /workspace/shared/sra-coordination/lot5c-execution-handles/example-live-command.json --work-timeout 300
```

The caller must allocate a TTY. After the execution tool returns its real `session_id`, the caller records that ID in a separate coordination receipt **before sending credentials**. `wrapperPid` and `childPid` are operating-system PIDs, never tool session IDs. The wrapper leaves `toolSessionId: null` and does not fabricate or infer one. The caller records the actual terminal tool result separately.

The wrapper disables terminal echo before displaying its input prompt. Send one UTF-8 JSON object followed by a newline through the existing interactive tool session; never put it in argv, a shell string, a file, a log or a persistent environment variable. The input deadline defaults to 45 seconds, cannot exceed 45 seconds, and the maximum is 65,536 bytes including the terminator. The JSON remains in memory. Python cannot guarantee erasure of every transient immutable copy; this is not a memory-isolation boundary.

## Guard sequence

1. Create an exclusive, mode-0600 sanitized metadata receipt **outside the checkout** and inspect the four named coordination states. A live receipt inside the checkout is refused because it would make the checkpoint helpers' clean-tree check fail.
2. Receive the hidden JSON with an input deadline and **without opening or holding the shared mutex**.
3. Re-read all four states after input; open the existing mutex without creation; attempt SH with `LOCK_NB` once. Mark its descriptor non-inheritable. Never recreate, replace or truncate the mutex.
4. Re-read all four states after SH acquisition. Check the exact selected helper and dependency fingerprints. A new quiet request, unreadable state, malformed JSON or changed helper fails before starting a child. The existing lane schema permits absent/null `quiet_requested`; literal `true` always refuses.
5. Start the selected helper in its own session/process group with `close_fds=True`. Its stdin is a separate PTY with echo and canonical input disabled before spawn (`VMIN=1`, `VTIME=0`), so delivery does not depend on the child changing terminal mode. Wait for the exact helper handshake before delivering JSON. The Sites mode uses its distinct official handshake and validates the supplied source project/checkout and outside-checkout archive destination.
6. Bound the entire child lifetime, including its handshake and every nested Git/preparation command, by `--work-timeout` (default 300 seconds, maximum 540). The handshake additionally defaults to 10 seconds and is capped at 15. Check the four small coordination states every 0.5 seconds during work. A newly requested quiet period cancels the child group.
7. On success, nonzero exit, timeout, caught exception or SIGINT/SIGTERM/SIGHUP, terminate/reap the owned group before unlocking. Linux subreaping also collects orphaned descendants when the leader has already exited. TERM then KILL have separate bounded grace periods. The receipt records the actual exit and cleanup result; `lockReleasedAt` is assigned after the real unlock.
8. Write the final sanitized receipt. No automatic retry, quiet-release announcement or acceptance/publication claim is performed. Copy the terminal receipt into repository evidence only afterwards if desired.

The maximum configured nominal wait budget is 45 seconds for input, 540 for the entire child including handshake, and 4 seconds for default teardown. Ordinary filesystem/kernel operations are not a hard-real-time guarantee. If group teardown cannot be confirmed, `cleanup.complete` is false and the run is failed; never treat that receipt as an idle ACK.

## Output and credential handling

The supervisor never saves raw input, raw stdout/stderr, credentials, environment dumps, arbitrary argv or exception text. Child output is bounded to 1 MiB in memory. Only structurally validated known result fields survive: fixed status/project identifiers, commit hashes, bounded counts and known booleans. For Sites, returned checkout/archive values must equal the supplied values, but these arbitrary path strings are not copied into the result receipt. The caller already knows the archive destination. Unknown output is suppressed; failures retain a reason code and process result.

The first retained helper did not disable Git hooks. The supervisor supplies an ephemeral `core.hooksPath=/dev/null` environment configuration for all helpers and removes inherited `GIT_CONFIG_PARAMETERS` and indexed configuration overrides. Credentials used internally by the official helpers can appear in their ephemeral child environment as designed; the supervisor never persists that environment.

A cancellation can occur after a remote checkpoint or source update has already completed. The receipt retains verified result rows and reports `partialOperationalSideEffectsPossible`; it never rolls back or blindly retries. The Sites helper prepares source/archive; the wrapper does not itself invoke the Site publication API.

## Independent tests

`test_bounded_locked_command.py` uses only temporary files, temporary mutexes/statuses, Python stand-ins and owned test process groups. It never executes the actual Node helpers, Git, the official Sites workflow, project runtime, games, tests of the project, replays or a benchmark. Its production-state precheck stops before the next case if a quiet request appears. During development, invoke this harness under a bounded outer OS timeout and the real SH lock, since the test uses a distinct mutex and cannot leave an unbounded production SH owner.

Tests cover success; nonzero/hostile output; partial-input timeout with no SH; handshake timeout; child+descendant work timeout; signal interruption; absent lock FD in the child; coordination changing after input and after lock; leader success with a surviving descendant; refusal behind an independent EX holder without retry; the official Sites protocol with a stand-in; quiet already present before input; a changed helper fingerprint; quiet arriving during child work; inherited Git-hook configuration removal; and complete 6,016-byte/65,536-byte input delivery even when the child does not call setraw.

The supervisor owns trusted helper process groups, not arbitrary hostile programs. A program that intentionally detaches into another session lies outside this minimal group contract; the pinned helpers inspected here preserve their inherited group for nested commands. SIGKILL of the supervisor itself cannot run Python cleanup. No holder of the historical production lock was identified or terminated by this work, and replacing an old launcher does not terminate an existing process.
