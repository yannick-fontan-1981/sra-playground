# V6 common solver

The public entry point for the common symbolic caller is:

```console
python -m agents.yf_arc3_v6.common --help
python -m agents.yf_arc3_v6.common --game <versioned-id> --target-levels 3 --level-action-caps <L1>,<L2>,<L3> --output <new-output-directory>
```

Use physically qualified per-level primitive caps. Primitives inside an ensemble count toward those caps. The caller retains its source binding, WHY/ACT release, preservation checks, level boundaries and session lease; this entry point does not start a model server.

Run from the repository root with its compatible V5 compiler, scheduler, DRM and capability library, the V1.5 reasoning tree and reconciliation file, and the custom/official environment adapters. The official adapter requires a separately installed environment repository (configured through `ARC_AGI_CURRENT_ROOT`). The qualified environment used Python with `arc-agi 0.9.9`, `arcengine 0.9.3`, and `numpy 2.5.4`; retain the environment-source and version checks for a campaign.

The common caller collects its code-only source plan. It does not require Laya, Torch, Transformers, model weights, or historical model/tokenizer identity files merely to attest its source. The optional neural benchmark keeps those dependencies and its fail-closed guards when selected.

The historical `python -m agents.yf_arc3_v6` model launcher is a separate entry point. Its local model profile and upstream harness are not included in this source publication; it is not the common caller documented above. No weights, local environments, run logs or game states are shipped here.
