"""Verify distinct ZIPP trace and outline contributions and their coexistence."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof, combined = [json.loads((args.receipts / (rev + ".json")).read_bytes())
                        for rev in ("d0e7527c", "421dc6a5", "674b0dd1")]
assert gel == proof and len(gel) == len(combined) == 4


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def extension(rows, turn):
    ref = at(rows, "return", turn)["ref"]
    return next(event for row in rows if row["kind"] == "return"
                for event in row["edges"] if event and event["after_ref"] == ref)


trace, withdrawal, outline, no_boundary_trace = gel
for turn in range(1, 9):
    issued, returned = [at(trace, kind, turn) for kind in ("ticket", "return")]
    assert issued["owner"] == "public_occurrence_recall" and issued["subquestion"] == "trace_field_composition"
    assert issued["guard"] == "trace_current_head_and_point_bound"
    assert issued["trace"]["relation"] is (turn >= 3)
    assert returned["matched"] is (True if turn < 8 else None)
e1, e2 = [extension(trace, turn) for turn in (1, 2)]
assert (e1["source"], e1["target"], e2["source"], e2["target"]) == ([0, 0], [1, 0], [1, 0], [2, 0])
assert e1["outcome"] == e2["outcome"] == "local_extension_observed"
assert extension(trace, 8)["outcome"] == "official_boundary"
assert at(trace, "ticket", 9)["level"] == 2
t3 = at(trace, "ticket", 3)
loss = at(withdrawal, "ticket", 3)
assert t3["ref"] == loss["ref"] and t3["trace"]["prefix"] == loss["trace"]["prefix"]
assert t3["point"] == loss["point"] == {"x": 48, "y": 28}
assert t3["trace"]["successes"] == [e1["after_ref"], e2["after_ref"]]
assert loss["trace"]["successes"] == [e1["after_ref"]]
assert (t3["trace"]["commands"], loss["trace"]["commands"]) == (6, 1)
assert at(withdrawal, "return", 3)["matched"] is True and at(withdrawal, "ticket", 4)["trace"]["commands"] == 5

t14, r14 = [at(outline, kind, 14) for kind in ("ticket", "return")]
assert (t14["level"], t14["owner"], t14["action"]) == (2, "public_outline_service", "ACTION5")
assert t14["outline"]["bbox"] == [11, 43, 17, 49] and t14["outline"]["scope"] == 2
assert t14["outline"]["exact"] is True and t14["outline"]["observed"] is False and t14["outline"]["expected"] is None
assert t14["outline"]["refs"] == [at(outline, "ticket", n)["ref"] for n in range(9, 14)]
assert at(outline, "return", 12)["frame"] != at(outline, "return", 13)["frame"] == r14["frame"]
assert r14["matched"] is None and r14["reason"] == "unknown_local_operator_effect_compare_public_return"
local = next(x for x in r14["outlines"] if x["status"] == "no_visible_local_change")
assert local["pixels"] == 0 and local["scope"] == 2 and local["refs"][-1] == r14["ref"]
refused, accepted = t14["guards"]
assert not refused["admitted"] and refused["reason"] == "outline_or_command_changed" and accepted["admitted"]
assert refused["frame"] != accepted["frame"]
assert at(no_boundary_trace, "ticket", 14)["outline"] == t14["outline"]
t15 = at(outline, "ticket", 15)
assert (t15["owner"], t15["action"]) == ("acquire_control_for_target", "ACTION2")

# The closing line 1 ticket has its own evidence. Compare the measured scopes before it.
for index, (expected, actual) in enumerate(zip(gel, combined, strict=True)):
    end = (8, 4, 14, 14)[index]
    assert [row for row in actual if row["turn"] <= end] == [row for row in expected if row["turn"] <= end]
    if end == 14:
        following = at(actual, "ticket", 15)
        assert following["owner"] == t15["owner"] and following["action"] == t15["action"]

print(json.dumps({
    "equalScenarios": len(gel), "assembled": "674b0dd19d693a66687990ab2a4368d981aa8fb9",
    "firstEdges": [e1, e2], "sameT3Command": t3["point"], "T3Plans": [6, 1],
    "outlineTicket": t14, "outlineReturn": local, "nextT15": t15,
    "assembledT15": at(combined[2], "ticket", 15),
}, indent=2))
