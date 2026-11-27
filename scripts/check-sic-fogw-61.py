"""Check the FOGW parent/child service captures, including the first reason and changed ticket."""
import argparse
import json
from pathlib import Path

from sic_qualification_reference import check


def compare(parent, child):
    check(len(parent) == len(child) == 4, "Expected catalogue, nominal extension, change of request, remeasurement")
    for index, name, length in ((0, "catalogue", 32), (1, "extension", 64), (3, "remeasure", 35)):
        check(len(parent[index]) == length and parent[index] == child[index], "Different " + name)
    before, after = parent[2], child[2]
    check(len(before) == 35 and len(after) == 37, "Missing constructed observation")
    first = next((i for i, (a, b) in enumerate(zip(before, after)) if a != b), None)
    check(first is not None, "Missing expected divergence")
    left, right = before[first], after[first]
    check(left.keys() == right.keys(), "Different return fields")
    fields = [k for k in left if left[k] != right[k]]
    check((left["kind"], left["turn"], left["matched"], right["matched"], fields) == ("return", 17, True, True, ["reason"]),
          "Unexpected first observable change")
    check((left["reason"], right["reason"]) == ("reception_control_projection", "reception_subject_changed"), "Wrong reason")
    a, b = before[first + 1], after[first + 1]
    check(a["id"] == b["id"] and a["id"].endswith(":native:18") and a["action"] == b["action"] == "ACTION4", "Ticket 18")
    check((a["index"], a["length"], a["confirmed"]) == (1, 8, True), "Expected old continuation")
    check((b["index"], b["length"], b["confirmed"], b["planRef"]) == (0, 1, False, right["ref"]), "Fresh test")
    check(a["subjects"] != b["subjects"] and a["planRef"] == before[first-1]["ref"], "Bound subject")
    back, renewed = after[first+2:]
    check(back["matched"] and renewed["subjects"] == b["subjects"] and renewed["planRef"] == back["ref"] and
          (renewed["index"], renewed["length"], renewed["confirmed"]) == (0, 8, True), "Freshly justified continuation")
    check([after[first-1]["waitSpent"], b["waitSpent"], renewed["waitSpent"]] == [1, 2, 3], "Wait budget")
    return {"firstEvent": first+1, "turn": left["turn"], "phase": left["kind"], "field": fields[0],
            "before": left["reason"], "after": right["reason"], "ticket18": {"parent": a, "child": b},
            "newSubjectReturn": back, "resumption": renewed, "nominalEvents": [32, 64], "remeasureEvents": 35}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("parent", type=Path)
    parser.add_argument("child", type=Path)
    args = parser.parse_args()
    print(json.dumps(compare(json.loads(args.parent.read_bytes()), json.loads(args.child.read_bytes())), indent=2))
