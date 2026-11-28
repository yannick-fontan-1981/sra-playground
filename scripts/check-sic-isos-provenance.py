"""Check the first divergence when ISOS receives a false or stale boundary."""
import argparse
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()


def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())


before, after = [load(name) for name in ("5161917e", "640bd882")]
assert len(before) == len(after) == 6
for rev, passed, failed in (("5161917e", 3, 3), ("640bd882", 6, 0)):
    log = (args.receipts / (rev + ".log")).read_text(encoding="utf8")
    assert re.search(rf"(?m)^. pass {passed}$", log) and re.search(rf"(?m)^. fail {failed}$", log)
assert before[0] == after[0]


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


changes = []
for case, turn in ((3, 4), (4, 8)):
    left, right = before[case], after[case]
    assert [row for row in left if row["turn"] < turn] == [row for row in right if row["turn"] < turn]
    old = at(left, "ticket", turn)
    new = at(right, "ticket", turn)
    assert (old["level"], old["ref"], old["action"]) == (new["level"], new["ref"], new["action"])
    assert (old["owner"], new["owner"]) == ("facet_examples", "observed_frontier")
    assert old["point"] == ({"x": 27, "y": 14} if turn == 4 else {"x": 33, "y": 23})
    assert new["point"] == {"x": 10, "y": 14}
    returned = at(right, "return", turn)
    assert returned["owner"] == "observed_frontier" and returned["levels"] == new["level"] - 1
    changes.append({"level": new["level"], "turn": turn, "before": old, "after": new, "realReturn": returned})

no_method = at(after[5], "return", 3)
receipt = next(e for e in no_method["acquired"] if e["status"] == "official_boundary")
assert no_method["levels"] == 1 and "boundary" not in receipt
assert at(after[5], "ticket", 4)["owner"] == "observed_frontier"
assert [at(after[0], "return", n)["levels"] for n in (3, 7, 12)] == [1, 2, 3]

gel, candidate = [load(name) for name in ("catalogue-gel", "catalogue-correctif")]
assert gel.pop("sha") == "d0e7527ca8033bd805a6d7a8bb021eff62e87021"
assert candidate.pop("sha") == "640bd882150f8164b2e6a1a7de6b85b16c52711f"
assert gel == candidate and gel["games"][0]["count"] == 16

print(json.dumps({
    "nominalCapturedFieldsEqual": True, "catalogueEqual": True,
    "firstDifferences": changes, "gainWithoutSelectedMethod": {"return": no_method["ref"], "level": 2, "methodBoundary": None},
}, indent=2))
