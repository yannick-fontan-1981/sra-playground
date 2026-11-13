"""Create oracle-only coordinate-set fixtures from the pinned 64-bit CPython ABI.

No interpreter introspection is shipped in the browser. The table is recorded
because PortAssembly's equal-cost tie follows the original set iteration order,
and an exact pause/restore must also retain deletion slots and the pop finger.
"""
import argparse
import ctypes
import json
import random
import sys
from pathlib import Path


class Entry(ctypes.Structure):
    _fields_ = [("key", ctypes.c_void_p), ("hash", ctypes.c_ssize_t)]


class SetHead(ctypes.Structure):
    _fields_ = [("reference_count", ctypes.c_ssize_t), ("type", ctypes.c_void_p),
                ("fill", ctypes.c_ssize_t), ("used", ctypes.c_ssize_t),
                ("mask", ctypes.c_ssize_t), ("table", ctypes.POINTER(Entry)),
                ("hash", ctypes.c_ssize_t), ("finger", ctypes.c_ssize_t)]


def set_state(value):
    if sys.implementation.name != "cpython" or sys.version_info[:2] != (3, 12) or ctypes.sizeof(ctypes.c_void_p) != 8:
        raise RuntimeError("This order oracle explicitly requires CPython 3.12 / 64-bit")
    head = SetHead.from_address(id(value))
    assert head.used == len(value) and head.mask >= 7 and head.mask & (head.mask + 1) == 0
    entries, dummies = [], []
    for index in range(head.mask + 1):
        entry = head.table[index]
        if not entry.key:
            continue
        if entry.hash == -1:
            dummies.append(index)
        else:
            point = ctypes.cast(entry.key, ctypes.py_object).value
            assert isinstance(point, tuple) and len(point) == 2 and all(isinstance(x, int) for x in point)
            entries.append([index, list(point)])
    assert [tuple(row[1]) for row in entries] == list(value)
    return {"format": "cpython-3.12-64-point-set", "capacity": head.mask + 1,
            "finger": head.finger, "entries": entries, "dummies": dummies}


def fixture():
    rng = random.Random(6847)
    sets = {}
    steps = []

    def apply(operation):
        name = operation["name"]
        kind = operation["kind"]
        result = None
        if kind == "create":
            sets[name] = set(map(tuple, operation["points"]))
        elif kind == "add":
            sets[name].add(tuple(operation["point"]))
        elif kind == "delete":
            point = tuple(operation["point"])
            result = point in sets[name]
            sets[name].discard(point)
        elif kind == "pop":
            result = list(sets[name].pop())
        elif kind == "update":
            sets[name].update(sets[operation["other"]])
        elif kind == "difference_update":
            sets[name].difference_update(sets[operation["other"]])
        elif kind == "copy":
            sets[name] = sets[operation["left"]].copy()
        else:
            first, second = sets[operation["left"]], sets[operation["right"]]
            if kind == "union": sets[name] = first | second
            elif kind == "intersection": sets[name] = first & second
            elif kind == "difference": sets[name] = first - second
            else: raise AssertionError(kind)
        steps.append({"operation": operation, "expected": result,
                      "order": list(sets[name]), "state": set_state(sets[name])})

    apply({"kind": "create", "name": "a", "points": [[rng.randrange(-30, 30), rng.randrange(-30, 30)] for _ in range(96)]})
    apply({"kind": "create", "name": "b", "points": [list(p) for p in list(sets['a'])[::3]] + [[0, i] for i in range(30)]})
    for point in list(sets["a"])[::4]: apply({"kind": "delete", "name": "a", "point": list(point)})
    for _ in range(12): apply({"kind": "pop", "name": "a"})
    for point in [[-1, -1], [0, 0], [17, 17], [9007199254740991, -9007199254740991]]:
        apply({"kind": "add", "name": "a", "point": point})
    for kind in ["union", "intersection", "difference"]:
        apply({"kind": kind, "name": kind, "left": "a", "right": "b"})
        apply({"kind": kind, "name": kind + "_reverse", "left": "b", "right": "a"})
    apply({"kind": "copy", "name": "copy", "left": "a"})
    apply({"kind": "update", "name": "copy", "other": "b"})
    apply({"kind": "difference_update", "name": "copy", "other": "b"})
    apply({"kind": "create", "name": "small", "points": [[0, 0], [-1, -1], [1, 2]]})
    apply({"kind": "difference", "name": "sparse_difference", "left": "a", "right": "small"})
    apply({"kind": "copy", "name": "small_copy", "left": "small"})
    apply({"kind": "difference_update", "name": "small_copy", "other": "small_copy"})
    apply({"kind": "delete", "name": "small", "point": [99, 99]})
    points = [[0, 0], [-1, -1], [1, 2], [9007199254740991, -9007199254740991], [-2147483648, 2147483647]]
    return {"schema": "v6.point-set-reference.v1", "python": sys.version.split()[0], "hashWidth": sys.hash_info.width,
            "hashes": [{"point": p, "hash": str(hash(tuple(p)))} for p in points], "steps": steps}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path(__file__).parents[1] / "tests/fixtures/v6-point-set-reference.json")
    args = parser.parse_args()
    args.output.write_text(json.dumps(fixture(), separators=(",", ":"), ensure_ascii=True) + "\n", encoding="utf-8")
