"""Audit the active and stale DC22 prefixes against the protected historical course."""
import argparse
import json
from pathlib import Path
from zipfile import ZipFile

from sic_qualification_reference import ROOT, check, git

CANDIDATE = "fb8d6913addd23f5dd1cc375f96f9a69b2410b21"
ARCHIVE = ROOT / "docs/diagnostics/sic-coexistence-703cd1c3/recus.zip"
PUBLISHED = "docs/diagnostics/sic-dc22-phase-child-receipt.json"


def read_rows(path):
    return [json.loads(line) for line in path.read_bytes().splitlines()]


def replay(folder, arm):
    (receipt,) = read_rows(folder / (arm + ".jsonl"))
    check((receipt["code"], receipt["target"], receipt["mode"], receipt["parallelWorkers"]) == ("DC22", 4, "sic", 1),
          arm + " replay conditions differ")
    check(receipt["actions"] == receipt["authority"] == len(receipt["effects"]), arm + " authority or effects differ")
    return receipt, read_rows(folder / (arm + "-phase.jsonl"))


def at(trace, event, revision):
    return next((row for row in trace if row["event"] == event and row["revision"] == revision), None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="Directory containing the active and stale receipts from the pinned candidate")
    folder = parser.parse_args().folder
    active, nominal_notes = replay(folder, "active")
    stale, stale_notes = replay(folder, "stale")
    expected = json.loads(git("show", f"{CANDIDATE}:{PUBLISHED}"))
    with ZipFile(ARCHIVE) as archive:
        historical = next(row for file in archive.namelist() if file.endswith("/results.jsonl")
                          for line in archive.read(file).splitlines()
                          if (row := json.loads(line))["code"] == "DC22")
    levels = active["levelStats"]
    check((active["levels"], active["actions"], active["reason"]) == (4, 187, "target_levels_completed"),
          "Nominal did not complete the four levels")
    check(active["effects"] == historical["effects"][:187], "Nominal historical effects differ")
    for field in ("actions", "won", "budget", "prefixHash"):
        check([level[field] for level in levels] == [level[field] for level in historical["levelStats"][:4]],
              "Nominal historical " + field + " differs")
    check([level["prefixHash"] for level in levels] == expected["nominal"]["prefixHashes"],
          "Published end-of-level fingerprints differ")

    opening = at(nominal_notes, "authorize", 112)
    first_return = at(nominal_notes, "return", 112)
    closing = at(nominal_notes, "return", 125)
    resume = at(nominal_notes, "authorize", 126)
    resumed = at(nominal_notes, "return", 126)
    check(opening["admitted"] and opening["need"]["kind"] == "measure_support_phase_cycle"
          and opening["checkpoint"]["status"] == "open" and opening["checkpoint"]["opening"] == opening["observation"]
          and opening["phaseCycle"]["actionBudget"] == 12 and first_return["checkpoint"]["status"] == "assigned"
          and opening["need"]["id"] == expected["firstChange"]["need"]
          and opening["need"]["parentObjective"] == resume["need"]["id"], "Wrong child opening or premature closure")
    proof = closing["checkpoint"]["closure"]
    check(closing["checkpoint"]["status"] == "satisfied" and closing["outcome"]["reason"] == "support_phase_measured"
          and proof["beforeRef"] == at(nominal_notes, "authorize", 125)["observation"] == expected["closing"]["beforeRef"]
          and proof["afterRef"] == closing["outcome"]["after"] == resume["observation"] == expected["closing"]["afterRef"],
          "T14 did not close on the exact native return")
    dependencies = resume["dependencies"]
    required = [closure["need"]["id"] for closure in resume["phaseCycle"]["closures"]]
    check(resume["admitted"] and resume["command"]["action_ref"] == "ACTION2" and len(required) == len(set(required)) == 2
          and required == expected["resume"]["requires"] and required[-1] == proof["need"]["id"] == resume["prerequisite"]
          and len(dependencies) == 2 and all(row["status"] == "satisfied" for row in dependencies)
          and [row["closure"] for row in dependencies] == resume["phaseCycle"]["closures"]
          and resumed["outcome"]["matched"] is True and resumed["outcome"]["reason"] == "landing_on_phase_support_confirmed",
          "T15 did not require both acquired closures")

    denied = at(stale_notes, "authorize", 126)
    replacement = at(stale_notes, "stale", 126)
    t13 = at(nominal_notes, "authorize", 124)
    t13_return = at(nominal_notes, "return", 124)
    check(stale["effects"] == active["effects"][:125] and stale["actions"] == 125 and stale["levels"] == 3,
          "Stale arm changed the common history or executed the refused ticket")
    check(replacement["original"] == proof and replacement["replacement"] ==
          {"beforeRef": t13["observation"], "afterRef": t13_return["outcome"]["after"]}
          and t13["phaseCycle"]["control"] == proof["control"]
          and t13_return["checkpoint"]["status"] == "assigned" and t13_return["outcome"]["after"] == proof["beforeRef"],
          "Substitution did not use the real prior return of the same control")
    check(denied["observation"] == resume["observation"] and denied["command"] == resume["command"]
          and not denied["admitted"] and denied["guard"] == "phase_cycle_prerequisite_unattested"
          and at(stale_notes, "return", 126) is None and stale["reason"] == "no_admissible_prefix",
          "Stale return was not rejected before the T15 ticket")

    print(json.dumps({"candidate": CANDIDATE, "historicalEffects": 187, "levelFingerprints": 4, "opening": "N4/T1",
                      "closing": "N4/T14 r125->r126", "resume": "N4/T15 ACTION2 with two satisfied dependencies",
                      "stale": {"sameCommands": 125, "replacement": "r124->r125", "guard": denied["guard"],
                                "stop": stale["reason"]}}))


if __name__ == "__main__":
    main()
