"""Negative checks for the creator-side verifier, not game-success fixtures."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "compare-v6-runs.py"
SPEC = importlib.util.spec_from_file_location("v6_comparison", SCRIPT)
assert SPEC and SPEC.loader
comparison = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(comparison)


class V6RunComparisonTests(unittest.TestCase):
    def fixture(self, root: Path):
        frame = [[0] * 64 for _ in range(64)]
        frame_hash = hashlib.sha256(json.dumps(frame, separators=(",", ":")).encode()).hexdigest()[:16]
        initial = {"level": 1, "levels_completed": 0, "state": "NOT_FINISHED", "step_index": 0,
                   "available_action_refs": ["ACTION6"], "frame_hash": frame_hash}
        after = {**initial, "step_index": 1}
        guard = {"event": "path_guard", "decision_revision": 1, "action_index": 0,
                 "point_admitted": True, "result": {"admitted": True}}
        dispatch = {"event": "dispatch", "decision_revision": 1, "action_index": 0,
                    "level": 1, "level_action_ordinal": 1, "level_action_cap": 4,
                    "action_ref": "ACTION6", "data": {"x": 7, "y": 11}}
        observation = {"event": "observation", "decision_revision": 1, "action_index": 0, **after}
        events = [guard, dispatch, observation]
        (root / "execution.jsonl").write_text("".join(json.dumps(event) + "\n" for event in events))
        report = {"initial": initial, "final": after, "actions": 1, "level_actions": {"1": 1}}
        public = {"frame": frame, "frames": [frame], "availableActionIds": [6], "state": "NOT_FINISHED",
                  "level": 1, "levelsCompleted": 0, "stepIndex": 0}
        trace = [{"event": "reset", "observation": deepcopy(public)},
                 {"event": "step", "ordinal": 1, "command": {"actionRef": "ACTION6", "data": {"x": 7, "y": 11}},
                  "observation": {**deepcopy(public), "stepIndex": 1}}]
        return report, trace, events

    def test_measurement_normalization_does_not_hide_semantic_fields(self):
        value = {"elapsed_s": 2, "decisions": [{"first_action_ms": 3, "full_set_ms": 4, "operation": "OP28"}],
                 "mechanism": {"elapsed_s": 5, "total_ms": 6}, "model_loaded": False}
        normalized = comparison.normalize(value, file_name="report.json")
        self.assertEqual(normalized, {"decisions": [{"operation": "OP28"}],
                                      "mechanism": {"elapsed_s": 5, "total_ms": 6}, "model_loaded": False})
        self.assertEqual(comparison.normalize({"game_id": "sentinel"}, file_name="proposal-1.json"), {"game_id": "sentinel"})

    def test_public_trace_binds_actions_and_pixels(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report, trace, _ = self.fixture(root)
            comparison.validate_journal(root, report)
            comparison.validate_public_trace(root, trace, report)
            changed = deepcopy(trace)
            changed[1]["command"]["data"]["x"] += 1
            with self.assertRaisesRegex(ValueError, "Public command differs"):
                comparison.validate_public_trace(root, changed, report)
            changed = deepcopy(trace)
            changed[1]["observation"]["frame"][3][9] = 1
            with self.assertRaisesRegex(ValueError, "Public transport differs"):
                comparison.validate_public_trace(root, changed, report)

    def test_report_cannot_invent_a_level_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report, _, _ = self.fixture(root)
            report["final"]["levels_completed"] = 1
            with self.assertRaisesRegex(ValueError, "Final level count differs"):
                comparison.validate_journal(root, report)

    def test_unadmitted_dispatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            report, _, events = self.fixture(root)
            events[0]["result"]["admitted"] = False
            (root / "execution.jsonl").write_text("".join(json.dumps(event) + "\n" for event in events))
            with self.assertRaisesRegex(ValueError, "Dispatch without a unique admitted guard"):
                comparison.validate_journal(root, report)


if __name__ == "__main__":
    unittest.main()
