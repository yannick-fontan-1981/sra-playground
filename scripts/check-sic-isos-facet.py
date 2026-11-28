"""Verify ISOS seed/cap separation and the scope of the retained boundary."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
parser.add_argument("--stale", required=True, type=Path)
args = parser.parse_args()
gel, proof, combined = [json.loads((args.receipts / (rev + ".json")).read_bytes())
                        for rev in ("d0e7527c", "5161917e", "674b0dd1")]
assert gel == proof and len(gel) == len(combined) == 3
nominal, missing_boundary, unchanged = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def evidence(rows, turn):
    ref = at(rows, "return", turn)["ref"]
    return next(event for row in rows if row["kind"] == "return"
                for event in row["acquired"] if event["refs"][-1] == ref)


t1, t2, t3 = (at(nominal, "ticket", turn) for turn in (1, 2, 3))
assert t1["point"] == t2["point"] == {"x": 33, "y": 23}
assert t1["guard"] == t2["guard"] == "current_visible_face_bound"
assert [row["facet"]["offer"] for row in (t1, t2, t3)] == [
    "probe_congruent_empty_face", "probe_visible_cap", "probe_visible_cap"]
assert "shift" not in t2["facet"] and t3["facet"]["shift"] == [0, -6]
assert t1["facet"]["scope"] == t2["facet"]["scope"] == t3["facet"]["scope"]
e1, e2 = (evidence(nominal, turn) for turn in (1, 2))
assert e1["status"] == "filled_example_correspondence" and e1["preserved"] is True
assert e2["status"] == "observed_visible_cap_and_side_change" and e2["preserved"] is True
assert e2["shift"] == [0, -6] and e2["sides"] == [True, True] and e2["refs"][-1] in t3["refs"]

for turn, score in ((3, 1), (7, 2), (12, 3)):
    assert evidence(nominal, turn)["status"] == "official_boundary"
    assert at(nominal, "return", turn)["levels"] == score
for turn in (4, 8):
    d = at(nominal, "ticket", turn)
    assert d["facet"]["offer"] == "recall_seed_for_compound_reference"
    assert d["facet"]["port"] == "observed_seed_method_revalidated_here"
    assert d["facet"]["scope"] != t1["facet"]["scope"]
    assert at(nominal, "return", turn - 1)["ref"] in d["refs"]
    e = evidence(nominal, turn)
    assert e["status"] == "compound_seed_effect_matched" and e["preserved"] and e["rendered"]
assert at(nominal, "ticket", 7)["facet"]["offset"] == [6, 3]
assert at(nominal, "ticket", 11)["facet"]["offset"] == [0, -6]
assert at(nominal, "ticket", 12)["facet"]["offset"] == [-6, 3]

assert at(missing_boundary, "return", 3)["levels"] == 1
assert at(missing_boundary, "return", 3)["packet"] == at(nominal, "return", 3)["packet"]
assert at(missing_boundary, "ticket", 4)["ref"] == at(nominal, "ticket", 4)["ref"]
assert at(missing_boundary, "ticket", 4)["owner"] != "facet_examples"
assert at(unchanged, "ticket", 1) == t1
assert evidence(unchanged, 1)["status"] == "no_visible_effect"
assert at(unchanged, "ticket", 2)["owner"] != "facet_examples"

stale_runs = [json.loads((args.stale / (rev + ".json")).read_bytes())
              for rev in ("d0e7527c", "5161917e", "674b0dd1")]
assert all(len(rows) == 1 for rows in stale_runs)
assert stale_runs[0] == stale_runs[1]
for (rows,) in stale_runs:
    original = evidence(nominal, 3)
    altered = evidence(rows, 3)
    assert altered["substitutedBoundary"] == {"expected": original["boundary"], "supplied": original["refs"][0]}
    assert altered["boundary"] != altered["refs"][-1]
    assert at(rows, "return", 3)["packet"] == at(nominal, "return", 3)["packet"]
    assert at(rows, "return", 3)["levels"] == 1
    original_ticket, altered_ticket = [at(session, "ticket", 4) for session in (nominal, rows)]
    for key in ("owner", "action", "point", "guard", "facet", "ref"):
        assert altered_ticket[key] == original_ticket[key]
    assert at(rows, "return", 4)["packet"] == at(nominal, "return", 4)["packet"]
    assert evidence(rows, 4)["status"] == "compound_seed_effect_matched"

print(json.dumps({
    "equalScenarios": len(gel), "assembledEqual": gel == combined,
    "sameFirstClick": t1["point"], "firstEffects": [e1, e2],
    "firstBoundary": evidence(nominal, 3), "withoutBoundary": at(missing_boundary, "ticket", 4),
    "newScopes": [at(nominal, "ticket", turn)["facet"]["scope"] for turn in (4, 8)],
    "staleBoundary": evidence(stale_runs[0][0], 3)["substitutedBoundary"],
    "staleTicket": at(stale_runs[0][0], "ticket", 4),
    "strict": False,
}, indent=2))
