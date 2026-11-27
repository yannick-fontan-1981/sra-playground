"""Validate the exported development cards independently with JSON Schema 2020-12."""
import copy
import json
from pathlib import Path
import subprocess

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent


def main():
    schema = json.loads((HERE / "schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    folders = [HERE.parent / "exemple/public", HERE.parent / "ressource/exemple/public"]
    count = 0
    for folder in folders:
        for page in sorted(folder.glob("*.md")):
            message = json.loads(subprocess.check_output(["node", str(HERE / "export.mjs"), str(page)]))
            validator.validate(message)
            count += 1
    assert count == 12
    for name in ["dial", "resource"]:
        message = json.loads((HERE / "examples" / (name + ".json")).read_text(encoding="utf-8"))
        validator.validate(message)
        # Extra fields at top level and within semantic records are both forbidden.
        extra = copy.deepcopy(message)
        extra["policy"] = []
        assert not validator.is_valid(extra)
        extra = copy.deepcopy(message)
        extra["rules"][0]["strategy"] = "private"
        assert not validator.is_valid(extra)
        extra = copy.deepcopy(message)
        unknown = next(row for row in extra["observations"] if row["status"] == "unknown")
        unknown["value"] = "guess"
        assert not validator.is_valid(extra)
    print(f"{count} fiches, 2 exemples conformes, 6 messages altérés rejetés")


if __name__ == "__main__":
    main()
