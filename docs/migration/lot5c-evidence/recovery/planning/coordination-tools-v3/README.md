# Bounded ordinary transport v3: no performance mutex

The user removed the global-lock obligation for ordinary development, functional tests, commits and pushes. This is the new checkpoint/source-workflow entrypoint. The v2 wrapper and its retained helpers/tests remain unchanged as historical evidence.

## Exact entrypoint

Run directly with a TTY and **without an outer flock**:

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/coordination-tools-v3/run-bounded-command.py --helper bounded-checkpoints --receipt /workspace/shared/sra-coordination/lot5c-execution-handles/NEW-RUN.json --work-timeout 300
```

Other closed helper choices are `checkpoint` and `sites-workflow`. All three modes perform **no opening, shared acquisition, exclusive acquisition or release of the performance mutex**. The wrapper has no performance-lock path or lock-setting parameter, and imports no flock API. Checkpoint modes reference the exact fingerprinted helper copies retained under `coordination-tools-v2/`; they do not execute the obsolete v2 Python wrapper. The Sites mode keeps the same absolute official helper, project argument and six script fingerprints.

The receipt must be fresh and outside the checkout. Root records the actual tool session ID before sending any hidden credential JSON; a process PID is never substituted for it. Commit the intended source before checkpoint push. These requirements and the existing JSON shapes remain unchanged.

## Official performance activity, not prospective requests

The wrapper still respects a real official performance window through the four small lane metadata files. Its exact predicate, confirmed by root, is:

1. If `official_performance_active` is present as a boolean, it is authoritative. `true` blocks/cancels the command; `false` permits ordinary work even if a historical `performance_started` remains true. The owner sets true only after actual EX acquisition and clears it on actual release.
2. If that field is omitted or null, compatibility is `performance_started is true AND quiet_released is not true`.
3. Missing activity fields do not declare an active window. Malformed authoritative/compatibility booleans or unreadable status JSON are reported rather than silently treated as verified inactivity.

A prospective `quiet_requested`, `heavy_execution_active` for ordinary tests, a publication in preparation or another lot's pending publication **does not block ordinary source transport**. A stale peer-request history is not used as proof of an active performance window. No publication ledger or publication mutex is consulted by this wrapper.

The four statuses are checked before input, after input, immediately before child launch, and every0.5seconds during work. A genuinely active window produces `official_performance_window_active`; a running child group is cleaned up. This metadata guard does not acquire the performance mutex and is not itself proof of isolation. Official-cost exclusivity remains the responsibility of the dedicated cost controller and its current coordination protocol.

## Preserved lifecycle and credential protections

Hidden TTY JSON input remains limited to45seconds and65536bytes. Child handshake and work deadlines, PTY echo/canonical-mode protections, pinned helpers, `close_fds=True`, separate process groups, Linux descendant subreaping, TERM/KILL cleanup on success/error/timeout/signals, sanitized initial/terminal receipts and no automatic retry are unchanged. Raw credentials, arbitrary child output and environments are not persisted. Git-hook overrides are still removed and hooks disabled for the retained helpers.

Seven functions are AST-identical to the validated v2 source: hidden input, receipt writer, strict JSON parser, subreaper setup, group existence check, group teardown and result sanitation. Their identities and the derivation are retained in `derivation.json`.

## Publication remains separate

Actual publication uses the dedicated `publication-coordination-v1/publication-guard.py` and its existing publication mutex. This wrapper does not replace that guardian. Root must observe the guardian's durable operation ACK and actual tool-session/deadline requirements only for phases that are part of an actual publication. Ordinary development, source work and checkpoint pushes require neither the publication guardian nor any publication prerequisite. A pending publication does not impose a new global lock on unrelated development, tests or checkpoint pushes.

The guardian and official-cost controller retain their own exclusive locks only for their respective operations. No older source, native input, cost script, publication guardian or v2 artifact was changed by this v3 derivation.

## Focused verification only

`test-bounded-command-v3.py` reuses the unchanged v2 temporary exercise and fake-helper bodies, with an adapter for the removed lock argument and the new activity metadata. It does not replay the18-case suite.

Four process cases verify ordinary success while a TEMP mutex is held EX despite prospective quiet/publication/heavy-work flags; nonzero cleanup; timeout cleanup including a descendant; and refusal of explicit actual performance activity before input. A trap rejects any attempt by the wrapper to open the temporary mutex or a performance-lock pathname. The fake child checks that no mutex FD reaches it. A small pure table verifies activity/release precedence and source checks confirm no flock call and unchanged v2 bytes.

The focused run passed4/4cases and69/69checks. It used no real Node helper, Git, credential, publication, project runtime, native replay, benchmark or production mutex acquisition. The earlier18-case v2 receipt is retained and was not rerun. The real tool result was terminal exit0/chunk847b03 without a yielded session ID.
