"""Validation indépendante des messages publics et de la projection historique, hors réseau."""
import copy
import json
from pathlib import Path
import subprocess

from jsonschema import Draft202012Validator, RefResolver

HERE = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def node(*args):
    return json.loads(subprocess.check_output(["node", *map(str, args)], cwd=HERE))


def main():
    base_path = HERE.parent / "schema.json"
    schema = read(HERE / "schema.json")
    base = read(base_path)
    Draft202012Validator.check_schema(schema)
    uri = (HERE / "schema.json").as_uri()
    resolver = RefResolver(uri, schema, store={uri: schema, base_path.as_uri(): base})
    validator = Draft202012Validator(schema, resolver=resolver)
    v1 = Draft202012Validator(base)
    for name in ["B", "B3", "A", "retours", "ressource"]:
        output = node("exemple.mjs", name)
        validator.validate(output)
        v1.validate(node("exemple.mjs", name, "base"))
        assert not v1.is_valid(output)
        del output["receipts"]
        validator.validate(output)
    count = 0
    for file in sorted((HERE.parent / "examples").glob("*.json")):
        old, new = read(file), node("export.mjs", file)
        v1.validate(old)
        validator.validate(new)
        assert all(r["status"] == "undeclared" for r in new.pop("receipts"))
        new["format"] = old["format"]
        assert new == old
        count += 1
    assert count == 12
    card = read(HERE / "exemples" / "retours.json")
    for patch in [{"kind": "refused", "coverage": "unknown"}, {"coverage": []},
                  {"kind": "unregistered"}, {"policy": "unused"}]:
        bad = copy.deepcopy(card)
        bad["receipts"][0]["replies"][0].update(patch)
        assert not validator.is_valid(bad), patch
    print("5 exemples avec et sans extension, 12 exports historiques, 4 contre-exemples de schéma rejetés")


if __name__ == "__main__":
    main()
