"""Compare the real MIND sequences, evidence links and official boundaries."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()

gel, proof = [json.loads((args.receipts / (sha + ".json")).read_bytes())
              for sha in ("d0e7527c", "860835b1")]
assert gel == proof and len(gel) == 2
nominal, withdrawal = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def evidence(rows, turn, status):
    ref = at(rows, "return", turn)["ref"]
    return next(item for row in rows if row["kind"] == "return" for item in row["acquired"]
                if item["status"] == status and ref in (item.get("ref"), item.get("evidence")))


for turn in range(1, 5):
    for kind in ("ticket", "return"):
        assert at(nominal, kind, turn) == at(withdrawal, kind, turn)
assert all(row["owner"] == "feedback_sequences" for rows in gel for row in rows)
assert all(row["guard"] == "ordered_prefix_and_loci_bound" for rows in gel for row in rows if row["kind"] == "ticket")

submitted = evidence(nominal, 4, "observed_submission_feedback")
assert submitted["values"] == [8, 14, 9] and len(submitted["marks"]) == 3
n5, w5 = [at(rows, "ticket", 5) for rows in gel]
assert n5["ref"] == w5["ref"] and n5["point"] == w5["point"] == {"x": 4, "y": 54}
assert (n5["trial"], n5["candidates"], n5["laws"]) == ([8, 9, 14], 2, 4)
assert (w5["trial"], w5["candidates"], w5["laws"]) == ([8, 14, 9], 9, 1)
assert submitted["ref"] in n5["evidence"]
n6, w6 = [at(rows, "ticket", 6) for rows in gel]
assert (n6["symbol"], n6["point"]) == (9, {"x": 10, "y": 54})
assert (w6["symbol"], w6["point"]) == (14, {"x": 4, "y": 54})

ambiguous = evidence(withdrawal, 8, "feedback_ambiguous")
assert ambiguous["matches"] == 2 and ambiguous["history"] == [submitted["ref"]]
w9 = at(withdrawal, "ticket", 9)
assert w9["trial"] == n5["trial"] and submitted["ref"] in w9["evidence"]
for rows, turn in ((nominal, 8), (withdrawal, 12)):
    assert at(rows, "return", turn)["levels"] == 1
    next_ticket = at(rows, "ticket", turn + 1)
    assert next_ticket["level"] == 2 and next_ticket["methodEpoch"] == 1

n13 = at(nominal, "ticket", 13)
later_feedback = evidence(nominal, 12, "observed_submission_feedback")
assert later_feedback["values"] == [8, 14, 6] and later_feedback["ref"] in n13["evidence"]
assert (n13["trial"], n13["candidates"], n13["laws"]) == ([14, 6, 8], 4, 12)
assert at(nominal, "return", 16)["levels"] == 2
assert at(nominal, "ticket", 17)["methodEpoch"] == 2
assert evidence(nominal, 9, "observed_append")["revalidation"] == "active_rank_row_confirmed"

print(json.dumps({
    "equalScenarios": len(gel), "firstSubmission": submitted, "firstChangeOfDecision": [n5, w5],
    "firstChangeOfCommand": [n6, w6], "ambiguousReturn": ambiguous,
    "level1OfficialTurns": [8, 12], "nextLevelSelection": n13,
}, indent=2))
