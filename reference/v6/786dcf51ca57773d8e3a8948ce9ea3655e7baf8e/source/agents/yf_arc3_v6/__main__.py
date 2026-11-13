"""Local V6 launcher. Never starts a model server implicitly."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request
import uuid

from .config import ROOT, load_profile
from .engine import Baseline, atomic_json, source_binding

REPO = ROOT.parents[1]


def session_lock_path():
    """A campaign can lease its real checkout while importing one shared engine."""
    scope = os.environ.get("YF_V6_WORKTREE_SCOPE")
    if scope is None:
        return REPO / ".local" / "yf_arc3_v6.session.lock"
    source = REPO.resolve(strict=True)
    lane = Path(scope)
    if not lane.is_absolute() or lane.resolve(strict=True) != Path.cwd().resolve(strict=True):
        raise RuntimeError("Campaign scope must be the absolute current worktree root")
    lane = lane.resolve(strict=True)
    git_env = {k: v for k, v in os.environ.items() if not k.upper().startswith("GIT_")}
    def git(root, *args):
        return subprocess.check_output(["git", "-C", str(root), *args], env=git_env)
    fields = git(source, "-c", "core.quotepath=false", "worktree", "list", "--porcelain").splitlines()
    registered = {Path(os.fsdecode(f[9:])) for f in fields if f.startswith(b"worktree ")}
    if lane not in registered or git(lane, "rev-parse", "HEAD") != git(source, "rev-parse", "HEAD"):
        raise RuntimeError("Campaign lane must be a registered worktree at the source HEAD")
    return lane / ".local" / "yf_arc3_v6.session.lock"


@contextmanager
def session_slot():
    path = session_lock_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch(exist_ok=True)
    with path.open("r+b") as stream:
        stream.seek(0)
        if os.name == "nt":
            import msvcrt
            if path.stat().st_size == 0:
                stream.write(b"0")
                stream.flush()
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        marker = f"{os.getpid()}:{uuid.uuid4().hex}"
        stream.seek(1)
        stream.write(marker.encode("ascii"))
        stream.truncate()
        stream.flush()
        try:
            yield marker
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def assert_parent_lease():
    marker = os.environ.get("YF_V6_PARENT_LEASE")
    path = session_lock_path()
    if not marker or not path.exists():
        raise RuntimeError("Worker has no matching parent session lease")
    with path.open("rb") as stream:
        stream.seek(1)
        recorded = stream.read().decode("ascii")
    if recorded != marker:
        raise RuntimeError("Worker has no matching parent session lease")
    try:
        with session_slot():
            raise RuntimeError("Parent session lease is no longer held")
    except OSError:
        pass


def model_inventory(profile):
    url = profile["env"]["LOCAL_ANALYZER_BASE_URL"].rstrip("/")
    with urllib.request.urlopen(url + "/models", timeout=3) as response:
        inventory = json.load(response)
    ids = [item["id"] for item in inventory.get("data", [])]
    if profile["env"]["LOCAL_ANALYZER_MODEL_ID"] not in ids:
        raise RuntimeError(f"Configured model absent from server: {ids}")
    return ids


def server_details(profile):
    url = profile["env"]["LOCAL_ANALYZER_BASE_URL"].rstrip("/").removesuffix("/v1")
    try:
        with urllib.request.urlopen(url + "/props", timeout=3) as response:
            props = json.load(response)
    except OSError:
        if profile.get("expected_model_version_id"):
            raise RuntimeError("Exact-model identity endpoint is unavailable; launch is not admitted")
        return {"status": "props unavailable; server details unknown"}
    result = {key: props.get(key) for key in ["model_path", "model_alias", "build_info", "total_slots", "modalities"]}
    result["n_ctx"] = props.get("default_generation_settings", {}).get("n_ctx", props.get("n_ctx"))
    if result["total_slots"] != 1:
        raise RuntimeError("Local baseline requires exactly one server slot")
    if result["n_ctx"] and result["n_ctx"] < int(profile["env"]["LOCAL_ANALYZER_CONTEXT_WINDOW"]):
        raise RuntimeError("Server context is smaller than the configured harness context")
    if profile.get("expected_model_version_id"):
        if not isinstance(result["n_ctx"], int) or result["n_ctx"] < int(profile["env"]["LOCAL_ANALYZER_CONTEXT_WINDOW"]):
            raise RuntimeError("Exact server context binding is missing or too small")
        if props.get("version_id") != profile["expected_model_version_id"]:
            raise RuntimeError("Server does not expose the required exact model version")
        if props.get("checkpoint_loading") != {key: 0 for key in ["missing_keys", "unexpected_keys", "mismatched_keys", "error_msgs"]}:
            raise RuntimeError("Server has not attested an exact checkpoint-to-model mapping")
        expected_root = (REPO / profile["model_directory"]).resolve()
        if Path(props["model_path"]).resolve() != expected_root:
            raise RuntimeError("Server is using another physical checkpoint directory")
        identity_path = expected_root / "physical-identity.json"
        identity = json.loads(identity_path.read_text())
        if hashlib.sha256(identity_path.read_bytes()).hexdigest() != props.get("identity_sha256"):
            raise RuntimeError("Server checkpoint identity differs from the prepared artifacts")
        stats = {}
        for name, info in identity["files"].items():
            path = (expected_root / name).resolve()
            if not path.is_relative_to(expected_root):
                raise RuntimeError("Invalid model identity artifact path")
            item = path.stat()
            if item.st_size != info["size"]:
                raise RuntimeError("Physical checkpoint size changed after preparation")
            stats[name] = {"size": item.st_size, "mtime_ns": item.st_mtime_ns}
        if hashlib.sha256(json.dumps(stats, sort_keys=True).encode()).hexdigest() != props.get("physical_file_stats_sha256"):
            raise RuntimeError("Physical model inputs changed after the server loaded them")
        result.update({key: props.get(key) for key in ["version_id", "identity_sha256", "physical_file_stats_sha256",
            "quantization_backend", "transformers", "torch", "device", "checkpoint_experts",
            "competition_k400_serving_policy_reproduced", "weight_mapping", "ple_storage", "checkpoint_loading"]})
        return result
    installation = REPO / ".local/qwen/qwen3.5-9b/installation.json"
    if installation.exists():
        identity = json.loads(installation.read_text())
        model = Path(identity["model_path"])
        if str(model) == result["model_path"]:
            with model.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            if digest != identity["model_sha256"]:
                raise RuntimeError("Physical model does not match installed model digest")
            result["model_identity"] = {key: identity[key] for key in ["model_repository", "model_revision", "quantization", "model_sha256", "model_bytes"]}
            runtime = Path(identity["server_path"])
            result["runtime_sha256"] = hashlib.sha256(runtime.read_bytes()).hexdigest()
    return result


def preflight(profile):
    import arc_agi
    import arcengine
    import numpy
    import PIL
    import requests
    from tools.yf_v5_env_bridge import sidecar_available
    ok, reason = sidecar_available()
    if not ok:
        raise RuntimeError(reason)
    from .upstream_loader import load
    load("agent.tool_agent")
    provenance = json.loads((ROOT / "upstream" / "provenance.json").read_text())
    for name, expected in provenance["files"].items():
        if hashlib.sha256((ROOT / "upstream" / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(f"Upstream file changed: {name}")
    return {"sdk_imports": "ok", "harness_import": "ok", "upstream_verified": len(provenance["files"]),
            "python": sys.executable, "profile": profile["name"], "server_started": False,
            "dependencies": {key: importlib.metadata.version(key) for key in ["arc-agi", "arcengine", "numpy", "Pillow", "requests"]}}


def start_server(profile):
    if profile.get("expected_model_version_id"):
        return start_exact_server(profile)
    settings = profile["env"]
    if settings["LOCAL_ANALYZER_BASE_URL"] != "http://127.0.0.1:8092/v1" or settings["LOCAL_ANALYZER_MODEL_ID"] != "sra-qwen3.5-9b":
        raise ValueError("Built-in server start requires the bundled local profile endpoint/model")
    runtime = REPO / ".local" / "qwen" / "runtime" / "b11716" / "llama-server.exe"
    model = REPO / ".local" / "qwen" / "qwen3.5-9b" / "models" / "Qwen3.5-9B-Q4_K_M.gguf"
    for path in [runtime, model]:
        if not path.is_file():
            raise FileNotFoundError(path)
    try:
        return {"status": "already_running", "models": model_inventory(profile)}
    except OSError:
        pass
    directory = REPO / ".local" / "yf_arc3_v6"
    directory.mkdir(parents=True, exist_ok=True)
    command = [str(runtime), "--model", str(model), "--alias", settings["LOCAL_ANALYZER_MODEL_ID"],
               "--host", "127.0.0.1", "--port", "8092", "--ctx-size", "16384", "--parallel", "1",
               "--threads", "8", "--n-gpu-layers", "99", "--jinja", "--no-webui"]
    with (directory / "server.log").open("ab") as log:
        child = subprocess.Popen(command, cwd=REPO, env=os.environ.copy(), stdin=subprocess.DEVNULL,
                                 stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    result = {"status": "starting", "pid": child.pid, "command": command,
              "log": str(directory / "server.log"), "model_bytes": model.stat().st_size}
    atomic_json(directory / "server.json", result)
    return result


def start_exact_server(profile):
    """Explicit launch only, after the immutable checkpoint has been verified."""
    settings = profile["env"]
    if (profile["expected_model_version_id"] != 1007514
            or settings["LOCAL_ANALYZER_BASE_URL"] != "http://127.0.0.1:8094/v1"
            or settings["LOCAL_ANALYZER_MODEL_ID"] != "Qwen/Qwen3.8-Flash-Next-NVFP4"):
        raise ValueError("Unexpected exact-model launch binding")
    model = (REPO / profile["model_directory"]).resolve()
    preparation = json.loads((model / "preparation-status.json").read_text())
    if preparation["status"] != "complete":
        raise RuntimeError("Exact model download is not complete; server remains NONRUN")
    python = REPO / ".local/v6-exact-env/Scripts/python.exe"
    if not python.is_file():
        raise FileNotFoundError(python)
    try:
        inventory = model_inventory(profile)
    except OSError:
        pass
    else:
        return {"status": "already_running", "models": inventory, "binding": server_details(profile)}
    root = REPO / ".local/v6-exact-server"
    directory = root / ("attempt-" + time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8])
    directory.mkdir(parents=True, exist_ok=False)
    command = [str(python), "-u", str(ROOT / "launch_exact_server.py"),
               "--model", str(model), "--output", str(directory),
               "--context", settings["LOCAL_ANALYZER_CONTEXT_WINDOW"],
               "--max-output", settings["LOCAL_ANALYZER_MAX_OUTPUT"],
               "--response-seconds", str(profile["request_seconds"])]
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(REPO) + os.pathsep + environment.get("PYTHONPATH", "")
    environment["TEMP"] = environment["TMP"] = str(REPO / ".local/v6-exact-tmp")
    environment["HF_ENABLE_PARALLEL_LOADING"] = "false"
    environment["HF_PARALLEL_LOADING_WORKERS"] = "1"
    Path(environment["TEMP"]).mkdir(parents=True, exist_ok=True)
    with (directory / "server.log").open("xb") as log:
        child = subprocess.Popen(command, cwd=REPO, env=environment, stdin=subprocess.DEVNULL,
                                 stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    result = {"status": "starting", "pid": child.pid, "command": command,
              "log": str(directory / "server.log"), "status_file": str(directory / "status.json"),
              "model_version_id": 1007514,
              "identity_sha256": hashlib.sha256((model / "physical-identity.json").read_bytes()).hexdigest(),
              "server_source_sha256": hashlib.sha256((ROOT / "exact_server.py").read_bytes()).hexdigest(),
              "entry_source_sha256": hashlib.sha256((ROOT / "launch_exact_server.py").read_bytes()).hexdigest()}
    atomic_json(root / "launch.json", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--game")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--start-server", action="store_true")
    parser.add_argument("--probe", action="store_true")
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    profile = load_profile(args.profile)
    if args.game:
        profile["game_id"] = args.game
    if args.start_server:
        print(json.dumps(start_server(profile)))
        return 0
    if args.preflight:
        print(json.dumps(preflight(profile)))
        return 0
    if args.probe:
        from .probe import probe
        model_inventory(profile)
        output = args.output or REPO / "runs/yf_arc3_v6" / ("protocol-" + time.strftime("%Y%m%d-%H%M%S"))
        with session_slot():
            summary = probe(profile, output)
        print(json.dumps(summary))
        return 1 if summary["error"] else 0
    if args.worker:
        plan_sha = hashlib.sha256(json.dumps(profile, sort_keys=True).encode()).hexdigest()
        if plan_sha != os.environ.get("YF_V6_PLAN_SHA256"):
            raise RuntimeError("Worker profile differs from admitted plan")
        if source_binding()["sha256"] != os.environ.get("YF_V6_SOURCE_SHA256"):
            raise RuntimeError("Worker Source differs from admitted physical Source")
        # Imports must pass before making even one game instance.
        environment = preflight(profile)
        inventory = model_inventory(profile)
        details = server_details(profile)
        from tools.yf_v5_env_bridge import OfficialEnvSession
        assert_parent_lease()
        session = OfficialEnvSession(profile["game_id"], instance_seed=profile["seed"])
        observation = session.reset()
        baseline = Baseline(session, profile, args.output)
        baseline.lease_check = assert_parent_lease
        baseline.trace("environment", details=environment)
        descriptor = (REPO / ".local/v6-exact-server/launch.json") if profile.get("expected_model_version_id") else (REPO / ".local/yf_arc3_v6/server.json")
        baseline.trace("server", models=inventory, actual=details,
            configuration=json.loads(descriptor.read_text())
                if descriptor.exists() else {"source": "externally_managed"})
        baseline.trace("game_source", path=observation.source_path,
            sha256=hashlib.sha256(Path(observation.source_path).read_bytes()).hexdigest())
        summary = baseline.run()
        print(json.dumps(summary))
        return 1 if summary["error"] else 0
    output = (args.output or REPO / "runs" / "yf_arc3_v6" / time.strftime("%Y%m%d-%H%M%S")).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Refusing to reuse consumed run: {output}")
    command = [sys.executable, "-m", "agents.yf_arc3_v6", "--worker", "--output", str(output)]
    if args.profile:
        command.extend(["--profile", str(args.profile.resolve())])
    if args.game:
        command.extend(["--game", args.game])
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO)
    env["PYTHONUNBUFFERED"] = "1"
    env["YF_V6_PLAN_SHA256"] = hashlib.sha256(json.dumps(profile, sort_keys=True).encode()).hexdigest()
    env["YF_V6_SOURCE_SHA256"] = source_binding()["sha256"]
    # Parent holds the real lease before spawning and until the durable report.
    with session_slot() as lease, output.with_suffix(".stdio.log").open("wb") as log:
        env["YF_V6_PARENT_LEASE"] = lease
        env["YF_V6_DEADLINE_UNIX"] = str(time.time() + profile["duration_seconds"])
        child = subprocess.Popen(command, cwd=REPO, env=env, stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        atomic_json(output.with_suffix(".launch.json"), {"pid": child.pid, "profile": profile,
            "command": command, "cwd": str(REPO), "pythonpath": env["PYTHONPATH"], "lease": lease,
            "plan_sha256": env["YF_V6_PLAN_SHA256"], "source_sha256": env["YF_V6_SOURCE_SHA256"],
            "deadline_unix": env["YF_V6_DEADLINE_UNIX"]})
        try:
            code = child.wait(timeout=profile["duration_seconds"])
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"], capture_output=True)
            else:
                child.kill()
            child.wait()
            output.mkdir(parents=True, exist_ok=True)
            atomic_json(output / "supervisor_failure.json", {"status": "timeout", "pid": child.pid})
            code = 1
        if not (output / "summary.json").exists() and not (output / "supervisor_failure.json").exists():
            output.mkdir(parents=True, exist_ok=True)
            atomic_json(output / "supervisor_failure.json", {"status": "worker_without_summary",
                "exit_code": code, "pid": child.pid, "qualification": "incomplete", "stdio": str(output.with_suffix('.stdio.log'))})
    summary_path = output / "summary.json"
    print(json.dumps({"exit_code": code, "output": str(output), "durable_summary": summary_path.exists(),
                      "summary": json.loads(summary_path.read_text()) if summary_path.exists() else None}))
    return code if summary_path.exists() else 1


if __name__ == "__main__":
    raise SystemExit(main())
