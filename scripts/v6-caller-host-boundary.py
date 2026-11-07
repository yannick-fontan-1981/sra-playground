"""Development-only host boundary for the unchanged common V6 caller.

This file is not imported by the site or copied into its static build. It contains
no solver, model, generator bridge, source transformer, or Python agent service.
Only public packets cross from the separate engine-host process. Source files,
the common caller body, families, and decision callbacks are left unchanged.
"""
from __future__ import annotations

import contextlib
import copy
from dataclasses import dataclass
import hashlib
import importlib
import json
import math
from pathlib import Path
import sys
import time
import types

SOURCE_COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
COMMON_RELATIVE = "agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py"
COMMON_SHA256 = "bcc9bc79d04287c830efedce48b4cc2ab89b5600b8a77fe09782c35d1c05c064"
CUSTOM_SHA256 = "55e1f26c1bdf2db77aca1b8c6a6f11b26a402639b62398dec87894b7858cb943"
MAX_PACKET_CELLS = 8 * 1024 * 1024
_REAL_PERF_COUNTER = time.perf_counter
_REAL_PERF_COUNTER_NS = time.perf_counter_ns
_ACTIVE_CLOCK = None
_LEASE_OWNER = None


class BridgeError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _hash(value):
    return hashlib.sha256(_json(value).encode("utf-8")).hexdigest()


def _sha_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _integer(value, name, minimum=0, maximum=2**53 - 1):
    if type(value) is not int or not minimum <= value <= maximum:
        raise BridgeError("invalid_input", f"{name} must be an integer from {minimum} through {maximum}")
    return value


def _only_keys(value, allowed, required, name):
    if type(value) is not dict or set(value) - set(allowed) or set(required) - set(value):
        raise BridgeError("invalid_input", f"Malformed {name}; required fields: {', '.join(required)}")


def _rows(value, name):
    if type(value) is not list or not 1 <= len(value) <= 256:
        raise BridgeError("invalid_observation", f"{name} must be a nonempty public pixel matrix")
    width = len(value[0]) if type(value[0]) is list else 0
    if not 1 <= width <= 256:
        raise BridgeError("invalid_observation", f"{name} has an unsupported width")
    result = []
    for row in value:
        if type(row) is not list or len(row) != width:
            raise BridgeError("invalid_observation", f"{name} must be rectangular")
        result.append(tuple(_integer(pixel, "palette value", 0, 255) for pixel in row))
    return tuple(result)


@dataclass(frozen=True)
class PublicObservation:
    """The same public attributes consumed by the original CustomObservation."""

    game_id: str
    level: int
    levels_completed: int
    state: str
    step_index: int
    available_action_refs: tuple
    frame_rows: tuple
    frame_packet: tuple
    frame_hash: str

    @classmethod
    def from_browser(cls, value):
        fields = ("frame", "frames", "availableActionIds", "state", "levelsCompleted", "level", "stepIndex")
        _only_keys(value, fields, fields, "public observation")
        rows = _rows(value["frame"], "frame")
        packet = value["frames"]
        if type(packet) is not list or not 1 <= len(packet) <= 1024:
            raise BridgeError("invalid_observation", "A complete, bounded public animation packet is required")
        frames = tuple(_rows(frame, "animation frame") for frame in packet)
        if sum(len(frame) * len(frame[0]) for frame in frames) > MAX_PACKET_CELLS:
            raise BridgeError("invalid_observation", "Public animation packet exceeds the declared development bound")
        if frames[-1] != rows:
            raise BridgeError("invalid_observation", "Canonical public frame differs from the last animation frame")
        actions = value["availableActionIds"]
        if type(actions) is not list or len(actions) > 7 or any(type(item) is not int or item not in range(1, 8) for item in actions) or len(set(actions)) != len(actions):
            raise BridgeError("invalid_observation", "Invalid public action vocabulary")
        state = value["state"]
        if type(state) is not str or not state or len(state) > 64:
            raise BridgeError("invalid_observation", "Invalid public protocol state")
        # This is the exact CustomSession hash encoding: JSON compact rows, 16 hex.
        frame_hash = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
        return cls("browser-public", _integer(value["level"], "level", 1),
                   _integer(value["levelsCompleted"], "levelsCompleted"), state,
                   _integer(value["stepIndex"], "stepIndex"), tuple("ACTION" + str(item) for item in actions),
                   rows, frames, frame_hash)

    def to_dict(self):
        return {"backend": "browser_public_bridge", "game_id": self.game_id, "level": self.level,
                "levels_completed": self.levels_completed, "state": self.state, "step_index": self.step_index,
                "available_action_refs": list(self.available_action_refs), "frame_hash": self.frame_hash}


class PublicSession:
    """Public transport base. The exporter implements a synchronous request over a pipe."""

    def __init__(self, initial):
        self.current = initial

    def reset(self):
        return self.current

    def step(self, *_args, **_kwargs):
        raise BridgeError("hidden_game_access", "The reasoning worker cannot execute or inspect a game")

    def accept(self, observation):
        if observation.step_index != self.current.step_index + 1:
            raise BridgeError("stale_observation", "An outcome must advance the public transport counter by exactly one")
        self.current = observation


class ActiveClock:
    def __init__(self):
        self.elapsed = 0.0
        self.started = None

    def begin(self):
        if self.started is not None:
            raise BridgeError("clock_reentry", "The active clock is already running")
        self.started = _REAL_PERF_COUNTER()

    def end(self):
        if self.started is not None:
            self.elapsed += _REAL_PERF_COUNTER() - self.started
            self.started = None

    def now(self):
        return self.elapsed + (0.0 if self.started is None else _REAL_PERF_COUNTER() - self.started)

    @staticmethod
    def execution_seconds(milliseconds):
        if type(milliseconds) not in (int, float) or not math.isfinite(milliseconds) or not 0 <= milliseconds <= 3_600_000:
            raise BridgeError("invalid_execution_time", "executionMs must be a finite duration from 0 through 3600000")
        return milliseconds / 1000


def _perf_counter():
    return _ACTIVE_CLOCK.now() if _ACTIVE_CLOCK is not None else _REAL_PERF_COUNTER()


def _perf_counter_ns():
    return int(_ACTIVE_CLOCK.now() * 1_000_000_000) if _ACTIVE_CLOCK is not None else _REAL_PERF_COUNTER_NS()


def _install_clock(clock):
    global _ACTIVE_CLOCK
    _ACTIVE_CLOCK = clock
    # Installed before solver imports, so ``from time import perf_counter`` also
    # keeps this stable dispatcher for this one development process.
    time.perf_counter = _perf_counter
    time.perf_counter_ns = _perf_counter_ns


def verify_source_manifest(root, manifest):
    root = Path(root).resolve()
    if type(manifest) is not dict or manifest.get("schema") != "sra.v6.reference-source.v1" or manifest.get("commit") != SOURCE_COMMIT:
        raise BridgeError("source_manifest", "The pinned V6 source manifest is required")
    records = manifest.get("files")
    if type(records) is not dict or not records or len(records) > 10_000:
        raise BridgeError("source_manifest", "The source manifest must enumerate its physical files")
    hashes, canonical_records = {}, {}
    for relative, expected in records.items():
        path = Path(relative)
        if type(relative) is not str or path.is_absolute() or ".." in path.parts or path.as_posix() != relative or type(expected) is not dict:
            raise BridgeError("source_manifest", "Unsafe path or file record in source manifest")
        location = (root / path).resolve()
        if not location.is_relative_to(root):
            raise BridgeError("source_manifest", "A source path escapes the packaged root")
        data = location.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if expected.get("sha256") != actual or expected.get("bytes") != len(data):
            raise BridgeError("source_changed", "Pinned source bytes differ: " + relative)
        if expected.get("gitBlob") is not None:
            blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if blob != expected["gitBlob"]:
                raise BridgeError("source_changed", "Pinned Git blob differs: " + relative)
        hashes[str(location)] = actual
        canonical_records[relative] = {"sha256": actual, "bytes": len(data)}
    if canonical_records.get(COMMON_RELATIVE, {}).get("sha256") != COMMON_SHA256:
        raise BridgeError("source_changed", "The common V6 caller differs from the audited source")
    return hashes, {"schema": manifest["schema"], "commit": SOURCE_COMMIT, "files": canonical_records}


def _forbid_game_construction(_identifier):
    raise BridgeError("hidden_game_access", "Game engines are absent from the oracle process; only public observations are accepted")


def install_host_boundaries(root, source_hashes, session_id, public_session, source_plan):
    """Import the original main; bind transport, provenance and process lease.

    An import stub resolves the unused game-construction dependency without
    loading an engine. Even custom_bridge is imported from its unchanged bytes.
    There is no AST parser, transformation, action interception or family patch.
    """
    root = Path(root).resolve()
    directory = root / "agents/yf_arc3_v6/laya_proto"
    for path in (str(root), str(directory)):
        if path not in sys.path:
            sys.path.insert(0, path)
    if any(name == "custom_games" or name.startswith("custom_games.") for name in sys.modules):
        raise BridgeError("hidden_game_access", "The reference process must not import any engine module")
    package = types.ModuleType("custom_games")
    package.__path__ = []
    registry = types.ModuleType("custom_games.registry")
    registry.build_engine = _forbid_game_construction
    package.registry = registry
    sys.modules[package.__name__] = package
    sys.modules[registry.__name__] = registry
    custom_path = directory / "custom_bridge.py"
    if _sha_file(custom_path) != CUSTOM_SHA256:
        raise BridgeError("source_changed", "The custom transport differs from the pinned source")
    custom = importlib.import_module("custom_bridge")
    if Path(custom.__file__).resolve() != custom_path:
        raise BridgeError("source_alias", "A different custom transport is already imported")
    importlib.import_module("agents.yf_arc3_v6")
    entrypoint = types.ModuleType("agents.yf_arc3_v6.__main__")
    entrypoint.__file__ = str(Path(__file__).resolve())
    entrypoint.__package__ = "agents.yf_arc3_v6"

    @contextlib.contextmanager
    def session_slot():
        global _LEASE_OWNER
        if _LEASE_OWNER is not None:
            raise BridgeError("session_busy", "One V6 session is admitted per development process")
        _LEASE_OWNER = session_id
        try:
            yield "oracle-process:" + session_id
        finally:
            _LEASE_OWNER = None

    entrypoint.session_slot = session_slot
    sys.modules[entrypoint.__name__] = entrypoint
    module = importlib.import_module("common_frontier_runtime")
    if Path(module.__file__).resolve() != directory / "common_frontier_runtime.py":
        raise BridgeError("source_alias", "A different common caller is already imported")
    if _sha_file(module.__file__) != COMMON_SHA256:
        raise BridgeError("source_changed", "The common caller differs from its pinned bytes")
    boundary_path = str(Path(__file__).resolve())
    module.resolve_transport = lambda _identifier: (lambda _name: public_session, {boundary_path: _sha_file(boundary_path)})
    module.source_plan = lambda: copy.deepcopy(source_plan)
    return module, module.main, {"mainTransformed": False, "customTransportTransformed": False,
                               "engineConstructor": "forbidden public transport dependency", "lease": "single development process"}
