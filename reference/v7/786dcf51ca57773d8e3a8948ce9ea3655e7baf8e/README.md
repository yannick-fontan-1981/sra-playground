# Pinned V7 reference

Source repository: `yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan`.

Source commit: `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

This directory contains an executable browser bundle compiled from the original
V7 `generators.src` and `activation.src`, plus unchanged copies of these programs
and their two knowledge documents. `programs` in `bundle.json` contains the actual
`CompiledModule` output of the original V5 `compile_source` compiler, schema
`yf_arc3_v5.src_ir.v0_1`. Only absolute source-display paths become repository
relative; the Pydantic semantic-hash validator verifies the resulting modules.

The three browser scenarios come directly from the original V7 `demo.cases()`.
Their titles and event labels are presentation metadata. They are controlled
scalar examples, not ARC-AGI-3 game evaluations.

## Python oracle

`tests/fixtures/v7-reference.json` contains 26 snapshots from five real executions
of the original V7 `Runtime` and V5 `WorkflowScheduler`:

- Original discovery, support, counterexample and exact duplicate event.
- The same sequence with renamed attribute and action identifiers.
- Two isolated scopes.
- A hypothesis masked by node identity, then reactivated.
- Hypotheses masked by kind, then reactivated.

The original `demo.assess()` returns nine passing assertions. Two additional
checks confirm that masking a hypothesis blocks its dependent composition and
that reactivation removes this use restriction. These tests establish parity
for this declared subset; they do not establish performance on ARC games or
parity for the rest of V5/V6/V7.

Each fixture step includes the input operation, a normalized expected graph,
availability and receipt, and the original Python graph and receipts. Every
original delta chain is independently rehashed by the exporter. Runtime timing
fields alone are omitted from raw receipts.

## Source boundary

`python-sources.json` identifies the exact original dependency closure: 101 files,
1,415,826 bytes, with a Git blob SHA-1 and SHA-256 for every file. The exporter
copies only those verified bytes into a temporary directory and installs the
original `tools/v7_prepared_source.py` loader before importing any agent modules.

Two package export initializers are intentionally outside this closure:
`agents/yf_arc3_v5/observability/__init__.py` and
`agents/yf_arc3_v5/drm/__init__.py`. Their unrelated re-exports otherwise load many
visualization and game-capability modules. The original PreparedSource loader
supplies namespace packages for these two names. Every module actually used by
the compiler, scheduler, Runtime, kernel and selected workflows retains its exact
original source bytes. No source is patched and no primitive is substituted.
This is an explicit import boundary for a workflow oracle, not a full-application
startup test. The omitted original initializer blob hashes are recorded in the
manifest.

The Python source files themselves are not included in this Site directory.
Reproduction requires access to the pinned private source repository.

## Reproduce or verify

The recorded reference used Python 3.12.14 and Pydantic 2.13.4. The exporter uses
the standard library apart from the original project's Pydantic dependency.
From the Site repository root, using a local checkout of the private repository:

```sh
python scripts/export-v7-reference.py --python-root /path/to/ARC-AGI-3-Yannick-Fontan
python scripts/export-v7-reference.py --python-root /path/to/ARC-AGI-3-Yannick-Fontan --check
```

The source checkout is read only. Its `HEAD` may differ, but every consumed file
must match the pinned commit's hashes or export fails. `--check` runs the original
reference again, checks all normalized histories and compiled outputs, validates
the previously retained raw Python chains, and writes no outputs.

The original `PreparedSource.digest` hashes absolute source paths. Consequently,
Python's source digest and the graph chains derived from it change when the
temporary snapshot path changes. The normalization removes only those engine
provenance fields and volatile timing. It retains node IDs, revisions, kinds,
statuses, values, evidence, dependency references, ordered deltas, and the exact
workflow/step/statement causes. The raw Python histories retain the original
engine hashes separately. A TypeScript engine must identify its own code and
must not claim the Python source digest as its own provenance.

These scenarios use safe integers. Their equivalence does not imply support for
Python's integer/float distinction or arbitrary-size integers in JavaScript.
The original scheduler's `src_statements` measures its own execution machinery;
interpreters must align that counting rule or report a separate metric rather
than treating a differently counted instruction budget as identical.
