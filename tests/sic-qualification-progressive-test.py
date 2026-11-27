"""Offline acceptance tests. No solver, game backend or workflow is launched."""
import copy
from contextlib import redirect_stdout
import gzip
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from sic_qualification_reference import (
    AUDIT, FROZEN, RUN, SOURCE, WORKFLOW, archive_file, frozen_campaign, inventory, strict_witnesses, verified_campaign,
)

bench = runpy.run_path(str(ROOT / "scripts/sic-qualification-progressive.py"))


class ProgressiveQualification(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows, cls.counts, cls.budgets = frozen_campaign()

    def test_selection_and_missing_trace(self):
        with tempfile.TemporaryDirectory() as empty:
            catalog = inventory(self.rows, Path(empty))
        self.assertEqual(len({g["game"] for g in catalog}), 107)
        self.assertEqual(bench["pick"](catalog, "appelants"), ["PORT", "DC22"])
        port = next(g for g in catalog if g["game"] == "PORT")
        self.assertEqual(port["switchHints"], [[4, 7], [6, 6]])
        self.assertEqual(port["switchWitnesses"], [])
        self.assertIn("à fournir", catalog[0]["strictA"])
        with self.assertRaises(ValueError):
            bench["pick"](catalog, "PORT,PORT")

    def test_contact_witness_uses_only_paired_passage_geometry(self):
        point = [43, 23]
        proposals = [
            {"kind": "sic_remote_support_route", "route": [point]},
            {"kind": "sic_paired_passage", "route": {"switchTest": point, "steps": [{"point": [11, 11]}]}},
            {"kind": "sic_paired_passage", "route": {"switchTest": point, "steps": [{"point": point}]}},
        ]
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "events.jsonl"
            events = [{"kind": "decision", "level": 4, "turn": turn, "value": {"proposal": proposal}}
                      for turn, proposal in enumerate(proposals, 1)]
            path.write_text("\n".join(json.dumps(event) for event in events), encoding="utf8")
            self.assertEqual(strict_witnesses(path), ([], [[4, 3]]))

    def test_compare_at_available_resolution(self):
        port = self.rows["PORT"][0]
        changed = copy.deepcopy(port)
        changed["effects"][66][0] = 3
        self.assertEqual(bench["receipt_difference"](port, changed),
                         {"level": 4, "turn": 7, "field": "action", "before": 4, "after": 3})
        victory = {"target": 6, "levels": 6, "reason": "target_levels_completed"}
        self.assertIsNone(bench["receipt_difference"](victory, changed))
        self.assertEqual(bench["receipt_difference"](victory, {**changed, "levels": 5})["field"], "levels")
        changed = copy.deepcopy(port)
        changed["levelStats"][0]["prefixHash"] = "0" * 64
        self.assertEqual(bench["receipt_difference"](port, changed)["field"], "prefixHash")

    def test_bind_source_budget_and_receipt_bytes(self):
        def read(path):
            if path.endswith(".jsonl"):
                return gzip.decompress(archive_file(path + ".gz")) + b" "
            return archive_file(path)

        with self.assertRaisesRegex(ValueError, "exact source"):
            verified_campaign(FROZEN, RUN, WORKFLOW, read, list(self.rows), self.counts)
        with self.assertRaisesRegex(ValueError, "digest/size"):
            verified_campaign(SOURCE, RUN, WORKFLOW, read, list(self.rows), self.counts)
        row = copy.deepcopy(self.rows["PORT"][0])
        row["levelStats"][0]["budget"]["actions"] += 1
        self.assertTrue(AUDIT["audit_game"](row, 6, self.budgets["PORT"])["issues"])

    def test_interrupt_before_publication_and_resume(self):
        qualify = bench["qualify"]
        publish = bench["atomic_record"]
        with tempfile.TemporaryDirectory() as temp:
            state = Path(temp)
            catalog = inventory(self.rows, state)
            opts = SimpleNamespace(candidate=SOURCE, state=state, command="import-ci", games="appelants",
                                   download=None, run_id=RUN, workflow=WORKFLOW, limit=None)

            def interrupt(path, result):
                if path.name == "DC22.json":
                    raise KeyboardInterrupt
                publish(path, result)

            with patch.dict(qualify.__globals__, atomic_record=interrupt), self.assertRaises(KeyboardInterrupt):
                qualify(opts, catalog, self.rows, self.counts, self.budgets)
            saved = (state / "PORT.json").read_bytes()
            self.assertFalse((state / "DC22.json").exists())
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(qualify(opts, catalog, self.rows, self.counts, self.budgets), 0)
            self.assertEqual((state / "PORT.json").read_bytes(), saved)
            self.assertEqual(json.loads(out.getvalue())["reused"], ["PORT"])
            self.assertEqual(json.loads(out.getvalue())["processed"], ["DC22"])


if __name__ == "__main__":
    unittest.main()
