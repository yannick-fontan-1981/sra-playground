from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent


def load_profile(path=None):
    path = Path(path or os.environ.get("YF_V6_PROFILE", ROOT / "profiles" / "local_exact.json"))
    profile = json.loads(path.read_text(encoding="utf-8"))
    if not profile.get("runnable"):
        raise ValueError("This notebook reference profile is descriptive. For the exact Kaggle checkpoint on this PC select profiles/local_exact.json explicitly; its server refuses an incomplete download. The old 9B weights have been removed.")
    if profile["sessions"] != 1 or profile["passes"] != 1:
        raise ValueError("Local baseline supports one session and one pass")
    for key in ["max_actions", "max_turns", "max_requests", "duration_seconds", "request_seconds"]:
        if not isinstance(profile[key], int) or profile[key] <= 0:
            raise ValueError(f"Invalid positive budget: {key}")
    if profile["images"]:
        raise ValueError("This local text profile has no validated vision transport")
    # Upstream reads defaults at import. Configure only in the selected V6 process.
    for key in list(os.environ):
        if key.startswith(("ARC3_", "LOCAL_ANALYZER_")) or key in {"MULTIMODAL_CONTEXT", "MULTIMODAL_UPSCALE", "INFERENCE_ANALYZER_MODEL"}:
            os.environ.pop(key)
    env = dict(profile["env"])
    for key in ["LOCAL_ANALYZER_BASE_URL", "LOCAL_ANALYZER_MODEL_ID", "LOCAL_ANALYZER_PROVIDER"]:
        if key in _OVERRIDES:
            env[key] = _OVERRIDES[key]
    if urlparse(env["LOCAL_ANALYZER_BASE_URL"]).hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Local validation requires a loopback model server")
    os.environ.update({k: str(v) for k, v in env.items()})
    profile["env"] = env
    return profile


_OVERRIDES = {k: os.environ[k] for k in ["LOCAL_ANALYZER_BASE_URL", "LOCAL_ANALYZER_MODEL_ID", "LOCAL_ANALYZER_PROVIDER"] if k in os.environ}
