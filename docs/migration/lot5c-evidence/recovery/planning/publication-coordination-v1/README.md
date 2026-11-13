# Publication mutex guardian v1

This is a separate noninteractive metadata guardian. It never receives a credential, reads stdin, spawns a child, calls Sites, pushes source, builds, runs tests of the project, or measures cost. The validated `coordination-tools-v2/run-bounded-locked-command.py` remains unchanged.

## Production identity and lifetime

The production CLI has no lock, inode, ledger or duration override. It opens only the existing `/workspace/shared/sra-coordination/publication.lock`, with `O_NOFOLLOW` and without `O_CREAT`, checks **device27 / inode1971855**, sets its descriptor non-inheritable and tries **EX|NB exactly once**. It never recreates, replaces or truncates the mutex.

The total deadline is **600 seconds from guardian start**, including setup. There is no heartbeat renewal or extension. The guardian writes only small external coordination metadata. Normal release, deadline, SIGTERM/SIGINT/SIGHUP and errors all go through unlock/close before terminal-journal writes. A broken journal therefore cannot strand the descriptor. SIGKILL or runtime death cannot run Python cleanup, but the process-owned lock FD closes on process termination; the pre-operation ledger remains durable.

Use a fresh directory under `/workspace/shared/sra-coordination`. No live journal belongs in the checkout. Default metadata permissions are0600, with directory creation0700. Do not replace an existing session directory. The production script path is:

`docs/migration/lot5c-evidence/recovery/planning/publication-coordination-v1/publication-guard.py`

## Start and record the real session

From the 5C checkout, start this **without an outer flock** and without a TTY requirement:

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/publication-coordination-v1/publication-guard.py hold --run-dir /workspace/shared/sra-coordination/lot5c-publication-03 --request-id lot5c-publication-03
```

An optional outer OS watchdog can use `timeout --signal=TERM --kill-after=5s 605s`; the guardian's own deadline is still600seconds. Root must retain the **real tool session_id returned by this launch** in a separate external receipt before any operation. Never substitute `pid` for that ID. A refusal can finish before an interactive execution session exists; retain its actual terminal tool result instead.

The guardian writes `guard.json`, a `progress/` directory and finally `terminal.json`. Root must verify the tool session is still running and use this fresh check before **each** source/API/poll phase:

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/publication-coordination-v1/publication-guard.py inspect --run-dir /workspace/shared/sra-coordination/lot5c-publication-03 --request-id lot5c-publication-03
```

`inspect` checks held state, matching request ID, an unexpired deadline and a heartbeat no older than2seconds. The guardian PID is diagnostic only: separate execution-tool calls can have different PID namespaces, so that PID can be invisible or identify another process. `inspect` never probes it and never claims to verify session liveness. Root must independently verify the actual tool session before every phase; the response explicitly includes `actualToolSessionCheckRequired: true`. Leave sufficient remaining time for a phase; a successful metadata check is neither proof of tool-session liveness nor an extension of the lease.

## Durable intent and ACK before an external operation

The shared register is `/workspace/shared/sra-coordination/publication-operation-state.json`. A normal guardian refuses a pre-existing unresolved operation, even after the old lease has expired. This prevents repeats by cooperating publishers; unrelated tools that ignore this shared protocol are not contained by this process.

Root submits a `begin` **before** source preparation, save or deploy, and waits for the CLI to return an accepted sequence. The helper writes one immutable numbered progress file; the guardian fsyncs the shared ledger, then fsyncs its ACK. **No ACK means no provider call.** The progress command itself waits at most3seconds for ACK.

Example for a source-preparation phase:

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/publication-coordination-v1/publication-guard.py progress --run-dir /workspace/shared/sra-coordination/lot5c-publication-03 --request-id lot5c-publication-03 --event begin --operation-id lot5c-prepare-03 --operation prepare_source
```

The other operation kinds are `save_version`, `save_and_deploy_private`, `deploy_version`, and `publish_on_push`. They require `--commit-sha`; a standalone deploy also requires `--version-id`. `--archive-sha256` binds the package when applicable. IDs and hashes must come from the actual source/archive/provider observations; never invent them.

For a publication call, use the same progress command with `--event begin`, a fresh stable operation ID, the appropriate operation kind, the actual commit and archive hashes, and any already-known saved version ID. Root then performs the native call separately, retaining its exact returned IDs. The guardian never makes or authorizes that call by itself.

## Updates, native IDs and terminal evidence

Use `progress --event update --operation-id` for the **same unresolved operation**. The `--status` values are:

| Status | Effect |
|---|---|
| `pending`, `building`, `publishing`, `unknown` | Preserve the unresolved block. |
| `saved` | Resolve a completed save-only call; requires its exact `versionId`. |
| `succeeded` | Resolve a known successful terminal operation; publication requires exact `versionId` and `deploymentId`. |
| `failed` | Resolve an explicitly terminal failure supported by retained evidence. A network/transport exception alone should remain `unknown`. |
| `not_started` | Only in `--reconcile-only` mode, with evidence that the external call was never launched. |

`--version-id` and `--deployment-id` accept the literal opaque values returned by Sites. They cannot change once attached to an operation. Do not derive one ID from another. For terminal updates, provide `--evidence-path` and `--evidence-sha256` for a sanitized regular file outside credentials. The guardian verifies its bytes/hash, up to64KiB; it does not semantically verify a provider response or fabricate one. Root supplies the observed status and its evidence.

A pending publication can be polled within the same operation. Before every poll, root rechecks session liveness/deadline. Persist returned IDs and the latest observed state through another update. Stop at a terminal response; never repeat a save because deployment is pending. If a credential confirms an active automatic publish-on-push window, use `publish_on_push` and reconcile its version/deployment; do not also call explicit save/deploy.

## Release and uncertain operations

Request release with:

```sh
python -B docs/migration/lot5c-evidence/recovery/planning/publication-coordination-v1/publication-guard.py release --run-dir /workspace/shared/sra-coordination/lot5c-publication-03 --request-id lot5c-publication-03 --reason completed
```

Use `--reason abort` when stopping. A release request is not a terminal result: root must collect the actual guardian tool completion and terminal receipt. The release file is exclusive and small. A normal clean release exits0; release with an unresolved operation exits2. Expiration exits124. Catchable signals exit128+signal. Other refusals/errors exit1.

**Local expiry/release never means provider cancellation.** An unresolved operation survives in the shared ledger, with its source/native IDs and status, and blocks a subsequent normal guardian. Do not delete that ledger to retry. Obtain actual read-only provider observations, start a fresh guardian with `--reconcile-only`, and submit an evidence-bound update for the existing operation. Reconciliation mode forbids beginning another operation. After it is terminal and the reconciliation guardian is released, a new normal guardian can be considered.

The guardian cannot stop an already-issued remote API request, enforce a provider-side fencing token, prove a credential's audience, or guarantee hard real-time filesystem behavior. If metadata persistence/terminal verification is unavailable, stop and reconcile; never treat silence as success. Root already has the prior successful private-publication evidence at access revision3 plus unchanged current metadata; no native mutation should be used as an audience probe.

## Composition with the validated source wrapper

Only start publication after the actual 5C cost is accepted, its quiet request released, and final source/build/evidence gates satisfied. Within the publication lease, source preparation still uses the unchanged bounded wrapper `--helper sites-workflow`, a separate fresh external receipt, hidden credential JSON and its own real tool-session record. Its own SH is acquired only after input. Do not place an outer flock around it.

A 300-second source-work allowance plus at most45seconds of input leaves room within the600-second publication lease for saving and deployment observation. Root should reduce/skip already-completed work when inputs are unchanged and refuse to start a new phase without enough remaining budget. Credentials and complete workflow input stay in memory and hidden stdin; this guardian's progress metadata never contains them.

## Verification scope

`test-publication-guard.py` uses only temporary mutexes, metadata and guardian processes. Its internal Config API supplies temporary identities and short test deadlines; these overrides are absent from the production CLI. Tests are externally OS-bounded and run under production SH only during authorized ordinary preparation. They cover a single EX refusal, missing mutex without creation, deadline, TERM/INT, journal failure with successful unlock, normal release, reuse refusal without overwriting old records, retained uncertainty blocking a subsequent lease, explicit metadata-only reconciliation, and wrong inode refusal.

All test provider IDs/evidence are explicitly fake TEMP protocol fixtures. The tests make **zero actual provider calls** and establish no production publication result. The earlier227-second preflight wall-clock overrun remains retained in its original preflight receipt; this guardian does not alter that history.
