# Lot 10A validation and regression runners

These runners are prepared for a subsequently frozen, integrated candidate. Their presence does not mean that the formal gates or seven replays have run. The earlier Axial reference run remains a separate diagnostic: 130 passing tests, with the initial failed attempts preserved in `diagnostic/axial-reference-validation.json`.

## Declared functional scope

`validation-test-scope.json` declares 31 test files. It covers the two Axial files, the shared runtime and caller, source entry order, the modified RadialPort registry expectation, authority, public observation and transition domains, checkpoints and the state graph, immutable memory and hydration, actual SRC/DRM execution, and adjacent Recolor, RankedWorkshop and Feedback owners. This scope follows the contracts touched by 10A. It does not automatically inherit every historical migration test file.

The current two Axial files contain 130 source/native reference tests and six common-runtime tests. These are preparation-time counts. The formal runner records the actual complete TAP count on the candidate it executes, and requires zero failures, cancellations, skipped tests and TODOs.

An integrated predecessor can add a small explicit test list using `--extra-tests path/to/manifest.json`. The file must be a JSON array of repository-relative `.test.ts` paths, or an object with a `testFiles` array. The runner records and fingerprints that exact declaration before starting. It does not discover extra tests while running.

`integrated-extra-test-scope.json` now prepares 14 additions: six for 5A, four for 4B and four for 7B. The upcoming merge review adds the CoupledPair exhaustive registry assertion and the two Symbols geometry/interface source suites to the initial eleven additions. There is no overlap or duplicate against the 31-file base, giving a provisional 45-file selection. Root must reconcile this list and any subsequent relevant changes with the actually published predecessors before using `--extra-tests docs/migration/lot10a-evidence/integrated-extra-test-scope.json` on the final freeze. The manifest does not establish final source identity or an executed validation result.

The five project gates are TypeScript, the actual entry audit, the migration audit, `git diff --check`, and the Sites production build. The migration audit is checked semantically: both its parsed output and `v6-coverage.json` must have an empty `failures` array. Its ordinary zero exit code alone is insufficient. Incomplete full migration remains explicitly allowed and is not presented as completed. The entry audit must establish exactly one connected `axial_question` entry in `factored_material_return`, owned by `public_axial_question`.

## Exact retained regression baseline

`recorded-regression-cases-site83.json` names the seven actual native 0.52 replay reports retained by 7A and preserved in Site 83, commit `bed48116585da864dd5c412ed11dd6990a950e8e`. Their common source digest is `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`.

| Game | Retained actions | Retained prefixes | Baseline report in `lot7a-evidence/integrated-final/regressions/` |
| --- | ---: | ---: | --- |
| CATR | 12 | 8 | `catr-051-replay.json.gz` |
| RSWP | 19 | 11 | `rswp-051-replay.json.gz` |
| FOGW | 50 | 27 | `fogw-051-replay.json.gz` |
| VOIS | 78 | 42 | `vois-051-replay.json.gz` |
| WEAV | 81 | 81 | `weav-051-replay.json.gz` |
| CONN | 21 | 21 | `conn-050-replay.json.gz` |
| MIND | 31 | 20 | `mind-051-replay.json.gz` |

The report names describe their historical input references. Their retained results were produced by native 0.52. The manifest pins those actual results, rather than the older 0.50/0.51 reports that 7A originally compared against. Their exact complete public traces are separately pinned. The existing streamlog replay driver and 17-check comparator remain unchanged. Seven complete cases therefore require 119 successful comparisons, covering 292 retained actions and 210 prefixes.

These are recorded-public-return regressions. They do not claim fresh game success, Axial contribution in a game, complete Python caller parity, equality of newly added family state or accepted performance. The chronological identities of this baseline and later integrated predecessors remain distinct.

## Prepare stored originals

In a fresh checkout, the seven compressed baseline reports are retained as exact checked byte parts. Restore them using the existing helper:

```bash
python -B scripts/evidence-byte-parts.py restore docs/migration/lot7a-evidence/integrated-final/regressions
```

All seven public trace gzip files were present when this plan was prepared. The replay launcher checks their declared hashes and refuses missing or changed inputs. It also verifies that each retained trace and each baseline parts manifest belongs to the declared published commit. Repository membership supports source provenance; the actual Sites publication receipt remains the evidence for publication itself.

The Feedback fixture and one historical Outline fixture also have tracked parts. Before final source/test inventory and migration auditing, restore missing originals without changing their bytes:

```bash
python -B scripts/evidence-byte-parts.py restore tests/fixtures
```

The runners never create new baseline data or silently regenerate fixtures.

## Execute after integration and freeze

First preserve the concurrent published predecessors, finish source and test edits, and freeze the actual candidate using the project's existing source-freeze procedure. The chosen evidence directory must contain `source-manifest.json` matching every current native execution input. The paths below use `final` as an example; it is not an assertion that this freeze already exists.

```bash
python -B docs/migration/lot10a-evidence/run-release-checks.py docs/migration/lot10a-evidence/final --tests
```

```bash
python -B docs/migration/lot10a-evidence/run-release-checks.py docs/migration/lot10a-evidence/final --build-script /home/agent/.codex/plugins/cache/openai-curated-remote/sites/1.1.6/scripts/build-site.mjs
```

```bash
python -B docs/migration/lot10a-evidence/run-regressions.py docs/migration/lot10a-evidence/final
```

The build helper is an environment path and must be replaced with the currently installed helper if it moves. An updated regression baseline must be declared in a separate explicit manifest and supplied with `--case-manifest`; the default Site 83 manifest retains its identity.

Both runners take a nonblocking shared lock on `/workspace/shared/sra-coordination/performance.lock`. They refuse to start while another lane holds its exclusive cost lock. This mechanical check complements the active lanes' explicit coordination; it does not establish machine exclusivity or a timing protocol.

## Evidence and failed attempts

The release runner emits the existing `logos-engine.native-delta-verification.v1` schema directly, so the unchanged delivery verifier can inspect its actual receipts. It reserves outputs exclusively and writes the running receipt before execution. Every child writes its complete raw output to a durable file while running; a deterministic gzip copy is retained after exit. The receipt records commands, actual exit codes, complete TAP counts, source and test inventories, additional declared tests, semantic audit results and before/after integrity checks.

The regression launcher fingerprints its unchanged helper chain and delegates to `scripts/run-released-public-regressions-streamlog.py`. Historical reports are prevalidated in a process that exits before each replay host starts. The complete current report, public packets, raw journal, started and final receipts, original comparisons and summary remain in the evidence directory. The default 1,536 MiB Node old-space cap is only a replay-host resource bound; it does not apply to official performance measurements.

Existing output receipts are never overwritten by a new attempt. A failed check or replay requires a new evidence directory with its correctly identified source manifest. The original failure and its output remain retained. A lost connection or incomplete receipt is not converted into a passing result or attributed to an out-of-memory failure without actual evidence.

## Restore exact final validation logs

The six final raw outputs remain unchanged locally. Their deterministic gzip
counterparts and `integrated-final/validation/log-transport.json` retain every
original byte, including diagnostic whitespace. Git stores the gzip copies;
it does not normalize the raw output. Before checking readiness in a fresh
checkout, restore the raw paths declared by the two validation receipts from
the repository root:

```python
import gzip, hashlib, json
from pathlib import Path
root = Path.cwd().resolve()
folder = root / "docs/migration/lot10a-evidence/integrated-final/validation"
for name in ("delta-tests-run.json", "checks-run.json"):
    receipt = json.loads((folder / name).read_text())
    for check in receipt["checks"]:
        packed, raw = check["output"], check["rawOutput"]
        source, target = (root / packed["path"]).resolve(), (root / raw["path"]).resolve()
        assert source.is_relative_to(root) and target.is_relative_to(root)
        compressed = source.read_bytes()
        assert len(compressed) == packed["bytes"]
        assert hashlib.sha256(compressed).hexdigest() == packed["sha256"]
        data = gzip.decompress(compressed)
        assert len(data) == raw["bytes"]
        assert hashlib.sha256(data).hexdigest() == raw["sha256"]
        if target.exists():
            assert target.read_bytes() == data
        else:
            with target.open("xb") as stream:
                stream.write(data)
```

This reconstructs retained output only. It does not rerun any test, build,
audit, game or measurement, and refuses to replace differing existing bytes.
