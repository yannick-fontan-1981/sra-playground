"""Verify the current-signature HPDL method, unsuccessful setting and retry."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "66ce04946bccb531d5a6403ec36a5c2a90bf99a4" and r["prefixes"] == 5
t3, t4 = r["source"], r["temoin"]
t5, t6, t7, t8 = r["reprise"]
method, = t3["after"]["record"]["edits"]
assert t3["pre"]["command"] == ["ACTION3", {}]
assert method["evidence"] == [t3["pre"]["ref"], t3["after"]["ref"]]
assert t4["pre"]["plan"]["offer"]["methods"] == [method]
assert t4["pre"]["plan"]["offer"]["edit"]["desired"] == 2
assert t4["pre"]["command"] == t5["pre"]["command"] == ["ACTION6", {"x": 14, "y": 30}]
assert t4["pre"]["plan"]["offer"]["key"] in t5["pre"]["cut"]["pre"]["attempts"]
assert t4["pre"]["plan"]["offer"]["key"] != t5["pre"]["plan"]["offer"]["key"]
for row, field, old, new in ((t3, "capacity", 1, 4), (t4, "capacity", 4, 1),
                             (t5, "capacity", 1, 2), (t6, "filter", 8, 9)):
    event, = row["after"]["record"]["registered"]["events"]
    assert (event["field"], event["before"], event["after"]) == (field, old, new)
    assert event["authority"] == "observed_field_change_not_capture_law"
    assert event["evidence"] == [row["pre"]["ref"], row["after"]["ref"]]
assert t4["after"]["matched"] is None and t4["after"]["seal"] is True
assert t7["pre"]["command"] == ["ACTION5", {}] and t7["after"]["levels"] == 1
assert t7["after"]["record"]["registered"]["events"][0]["frames"] == 78
assert t8["pre"]["level"] == 2 and len(t8["pre"]["cut"]["pre"]["portable"][0]["methods"]) == 4

loss, recovered = r["retrait"]
assert loss["pre"]["cut"]["removed"] == [method]
assert loss["pre"]["cut"]["pre"]["geometry"] == t4["pre"]["cut"]["pre"]["geometry"]
assert loss["pre"]["cut"]["bound"] is None and loss["pre"]["cut"]["offers"] == []
assert loss["pre"]["command"] == ["ACTION4", {}] and recovered["pre"]["command"] == t4["pre"]["command"]
assert r["etranger"]["signature"] != method["signature"]
st = r["stationnaire"]["last"]
assert st["pre"] == t4["pre"] and st["after"]["packet"] == t4["after"]["packet"]
assert st["after"]["presented"] != st["after"]["physical"]
assert st["after"]["record"]["edits"] == [method] and r["stationnaire"]["next"]["cut"]["offers"] == []

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "method": method,
    "firstSetting": {"desired": 2, "measured": 1, "sealed": True},
    "retry": {"measured": 2, "sameCommand": t5["pre"]["command"]},
    "withdrawal": loss["pre"]["command"], "stationary": st["after"]["record"]["registered"]["status"],
    "boundary": 7,
}, indent=2))
