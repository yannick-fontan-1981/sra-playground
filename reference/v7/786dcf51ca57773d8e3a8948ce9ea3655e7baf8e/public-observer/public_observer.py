"""Public pixel measurements and a strict, read-only adapter for V6 archives.

No game id, planner, oracle, entity role or recorded decision rationale enters
V7. Only raw canonical public frames, public input vocabulary, public protocol
state and witnessed commands cross this transport.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import time

from agents.yf_arc3_v6.laya_proto.geometric_observer import components
from tools.official_instance_determinism import official_frame_fingerprint

from .kernel import canonical, digest, empty_argument_bindings


class PublicArchive:
    def __init__(self, directory, steps, interface):
        self.directory = Path(directory).resolve()
        self.interface = interface
        self.steps = steps
        self.files = {}
        if not 1 <= steps <= interface["maximum_archive_steps"]:
            raise ValueError("Explicit archive step count exceeds this demonstration's admission")

    def _bytes(self, name):
        path = self.directory / name
        if path.stat().st_size > self.interface["maximum_input_file_bytes"]:
            raise ValueError(f"Archive input too large: {name}")
        data = path.read_bytes()
        fingerprint = hashlib.sha256(data).hexdigest()
        if str(path) in self.files and self.files[str(path)] != fingerprint:
            raise ValueError("Archive changed while being read")
        self.files[str(path)] = fingerprint
        return data

    def verify(self):
        for name, expected in self.files.items():
            if hashlib.sha256(Path(name).read_bytes()).hexdigest() != expected:
                raise ValueError("Bound public archive bytes changed")

    def _metadata(self, number):
        raw = json.loads(self._bytes(f"observation-{number}.json"))["observation"]
        # Deliberately ignore the stored entities, unknowns, roles and all other fields.
        fields = ("revision", "level_epoch", "frame_hash", "available_action_refs", "state", "levels_completed")
        return {key: raw[key] for key in fields}

    def _frame(self, rows, metadata):
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], list) or not rows[0]:
            raise ValueError("Empty or malformed public frame")
        width = len(rows[0])
        if len(rows) * width > self.interface["maximum_frame_cells"]:
            raise ValueError("Frame exceeds admitted pixel domain")
        if any(len(row) != width or any(type(v) is not int or not 0 <= v < 16 for v in row) for row in rows):
            raise ValueError("Public frame must be a rectangular palette-index grid")
        actual = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()
        if metadata["frame_hash"] != official_frame_fingerprint(rows):
            raise ValueError("Canonical public frame does not match its archived observation hash")
        return {"rows": rows, "metadata": metadata, "sha256": actual}

    def load(self):
        # The journal establishes witnessed inputs. It supplies no chosen-plan text.
        dispatches = {}
        for line in self._bytes("execution.jsonl").splitlines():
            raw = json.loads(line)
            revision = raw.get("decision_revision")
            if raw.get("event") == "dispatch" and type(revision) is int and 1 <= revision <= self.steps:
                dispatches.setdefault(revision, []).append({"action_ref": raw["action_ref"], "data": raw.get("data", {})})
        frames, actions = [], []
        for index in range(1, self.steps + 1):
            packet = json.loads(self._bytes(f"packet-{index}.json"))
            after_frames = packet.get("canonical_after_frames", [])
            commands = dispatches.get(index, [])
            # No silent first-frame/first-action subset of a multi-action bundle.
            if len(after_frames) != 1 or len(commands) != 1:
                raise ValueError("This adapter admits only complete one-action packets")
            before = self._frame(packet["before"], self._metadata(index))
            after = self._frame(after_frames[0], self._metadata(index + 1))
            if before["metadata"]["level_epoch"] != after["metadata"]["level_epoch"]:
                raise ValueError("Level-boundary replay requires a separate scope adapter")
            if frames and frames[-1]["sha256"] != before["sha256"]:
                raise ValueError("Archive canonical frame chain is discontinuous")
            command = commands[0]
            bindings = empty_argument_bindings(before["metadata"]["available_action_refs"], self.interface["actions"])
            binding = bindings.get(command["action_ref"])
            if binding is None or not binding["grounded"] or command != binding["command"]:
                raise ValueError("Witnessed command is not completely bound by this adapter")
            if not frames:
                frames.append(before)
            frames.append(after)
            actions.append(command)
        self.verify()
        return frames, actions


def perceive(frame, index, scope, interface):
    started = time.perf_counter()
    rows = frame["rows"]
    measured = components(rows)
    metadata = frame["metadata"]
    values = {"frame_sha256": frame["sha256"], "width": len(rows[0]), "height": len(rows),
              "monochrome_components": len(measured), "palette_count": len({p["color"] for p in measured}),
              "rectangular_components": sum(p["rectangular"] for p in measured),
              "public_state": metadata["state"], "levels_completed": metadata["levels_completed"]}
    observation = {"id": f"public-observation:{index}:{frame['sha256']}", "scope": scope,
                   "values": values, "actions": list(metadata["available_action_refs"])}
    parts = [{"occurrence_ref": f"{observation['id']}:component:{i}", "identity_scope": "this_frame_only",
              "bbox": p["bbox"], "area": p["area"], "palette_value": p["color"], "scale": p["scale"],
              "rectangular": p["rectangular"], "normalized_shape_digest": digest(sorted(p["normalized"]))}
             for i, p in enumerate(measured)]
    return {"observation": observation, "components": parts,
            "bindings": empty_argument_bindings(observation["actions"], interface["actions"]),
            "interpretation": "monochrome connected components, not acquired object roles or identities across time",
            "timing_ms": round((time.perf_counter() - started) * 1000, 3)}
