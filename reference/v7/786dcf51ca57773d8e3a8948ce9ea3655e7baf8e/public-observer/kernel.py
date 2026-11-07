"""Mechanical graph operations. No goals, roles, game law or action selection.

Templates and SRC own all semantic construction and status decisions. No eval,
dynamic import, neural dependency, filesystem access or game transport here.
"""
from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.types import FrozenMap
from .availability import blockers


def json_default(value):
    """Materialize mappings only at explicit JSON/hash boundaries."""
    if isinstance(value, Mapping):
        return dict(value)
    raise TypeError(f"Unsupported JSON value: {type(value).__name__}")


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False, default=json_default)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def equal(left, right):
    # JSON booleans and numbers must not compare equal (Python's True == 1).
    return canonical(left) == canonical(right)


def distinct(left, right):
    return not equal(left, right)


def value(value):
    return value


def concatenate(left, right):
    """Finite sequence concatenation; ordering and bounds belong to SRC."""
    return tuple(left) + tuple(right)


def matching(items, selectors):
    return [item for item in items if all(key in item and equal(item[key], expected) for key, expected in selectors)]


def extreme(items, field, maximize):
    """Return every tied extremum; the caller must resolve or refuse ambiguity."""
    if not items:
        return []
    target = (max if maximize else min)(item[field] for item in items)
    return [item for item in items if equal(item[field], target)]


def unify(left, right):
    """First-order term unification, with separate variable namespaces and occurs check."""
    bindings = {}

    def term(value, namespace):
        if isinstance(value, Mapping) and set(value) == {"variable"}:
            return ("variable", namespace + "." + value["variable"])
        if isinstance(value, Mapping):
            return ("mapping", tuple((k, term(v, namespace)) for k, v in sorted(value.items())))
        if isinstance(value, (tuple, list)):
            return ("sequence", tuple(term(v, namespace) for v in value))
        return ("constant", type(value).__name__, value)

    def walk(value):
        while value[0] == "variable" and value[1] in bindings:
            value = bindings[value[1]]
        return value

    def occurs(name, value):
        value = walk(value)
        if value[0] == "variable":
            return name == value[1]
        if value[0] == "sequence":
            return any(occurs(name, v) for v in value[1])
        if value[0] == "mapping":
            return any(occurs(name, v) for _, v in value[1])
        return False

    def join(a, b):
        a, b = walk(a), walk(b)
        if a == b:
            return True
        if a[0] == "variable":
            if occurs(a[1], b):
                return False
            bindings[a[1]] = b
            return True
        if b[0] == "variable":
            return join(b, a)
        if a[0] != b[0]:
            return False
        if a[0] == "sequence":
            return len(a[1]) == len(b[1]) and all(join(x, y) for x, y in zip(a[1], b[1]))
        if a[0] == "mapping":
            return [k for k, _ in a[1]] == [k for k, _ in b[1]] and all(join(x[1], y[1]) for x, y in zip(a[1], b[1]))
        return False

    matched = join(term(left, "first"), term(right, "second"))
    return {"matched": matched, "bindings": [[key, walk(value)] for key, value in sorted(bindings.items())] if matched else []}


def get(mapping, key):
    return mapping[key]


def count_matching(items, selectors):
    return sum(all(key in item and equal(item[key], expected) for key, expected in selectors) for item in items)


def less(left, right):
    """Lexicographic order on explicitly supplied scalar tuples; no policy here."""
    if isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)):
        for a, b in zip(left, right):
            if equal(a, b):
                continue
            return less(a, b)
        return len(left) < len(right)
    if type(left) is not type(right) or type(left) not in (int, float, str):
        raise ValueError("Ordering requires compatible measured scalars")
    return left < right


def empty_argument_bindings(actions, interfaces):
    """Validate empty argument lists against a declared interface; no game meaning."""
    result = {}
    for action in actions:
        declaration = interfaces.get(action)
        missing_authority = declaration.get("required_authority", []) if declaration is not None else []
        grounded = declaration is not None and declaration["required_arguments"] == [] and not missing_authority
        reason = ("arguments_complete" if grounded else "authority_missing:" + ",".join(missing_authority) if missing_authority else "interface_undeclared" if declaration is None
                  else "missing_arguments:" + ",".join(declaration["required_arguments"]))
        result[action] = {"grounded": grounded, "reason": reason,
                          "command": {"action_ref": action, "data": {}} if grounded else None}
    return result


def difference(before, after):
    # Closed measured field domains only. Absence must never mean false.
    if set(before) != set(after):
        raise ValueError("Changing observation field domain is unsupported, not a negative fact")
    return {key: value for key, value in after.items() if not equal(before[key], value)}


def intersection(left, right):
    return {key: left[key] for key in sorted(left.keys() & right.keys()) if equal(left[key], right[key])}


def resolve(value, bindings):
    if isinstance(value, str) and value.startswith("$"):
        path = value[1:].split(".")
        result = bindings[path[0]]
        for key in path[1:]:
            result = result[key]
        return result
    if isinstance(value, (list, tuple)):
        return [resolve(item, bindings) for item in value]
    if isinstance(value, Mapping):
        return {key: resolve(item, bindings) for key, item in value.items()}
    return value


def substitute(pattern, bindings):
    return resolve(pattern, dict(bindings))


class Kernel:
    def __init__(self, logos, drm, source_digest):
        self.logos = logos
        self.drm = drm
        self.source_digest = source_digest

    def identity(self, template, bindings):
        return "node:" + digest(resolve(self.drm["templates"][template]["identity"], dict(bindings)))

    def validate_node(self, node):
        kind = node.get("kind")
        if kind not in self.logos["kinds"]:
            raise ValueError("Undeclared node kind")
        required = self.logos["node_fields"] + self.logos["kinds"][kind]
        if set(required) - node.keys() or node["status"] not in self.logos["statuses"]:
            raise ValueError("Node violates the declared Logos contract")

    def commit(self, memory, node, cause):
        self.validate_node(node)
        old = memory["nodes"].get(node["id"])
        if old is not None and equal(old, node):
            return memory
        if old is None and len(memory["nodes"]) >= self.drm["limits"]["nodes"]:
            raise ValueError("Declared node budget exhausted")
        # Freeze only the changed node. Existing immutable nodes and deltas
        # cross SRC calls by reference; the small indexes remain copy-on-write.
        updated = FrozenMap(dict(node, revision=1 if old is None else old["revision"] + 1))
        nodes = dict(memory["nodes"])
        nodes[node["id"]] = updated
        delta = {"sequence": len(memory["deltas"]) + 1, "previous": memory["chain"],
                 "node": updated, "cause": cause, "source_digest": self.source_digest}
        chain = digest(delta)
        return FrozenMap({"nodes": FrozenMap(nodes),
                          "deltas": memory["deltas"] + (FrozenMap(dict(delta, digest=chain)),),
                          "chain": chain})

    def emit(self, memory, template, bindings, cause):
        identity = self.identity(template, bindings)
        if identity in memory["nodes"]:
            return memory
        body = resolve(self.drm["templates"][template]["body"], dict(bindings))
        node = dict(body, id=identity, revision=0,
                    origin={"template": template, "source_digest": self.source_digest, **cause})
        return self.commit(memory, node, cause)

    def assign(self, memory, identity, field, value, cause):
        if field in {"id", "kind", "origin", "revision", "scope"}:
            raise ValueError("Immutable identity/provenance field")
        node = memory["nodes"][identity]
        if field not in node:
            raise ValueError("Undeclared field")
        return self.commit(memory, dict(node, **{field: value}), cause)

    def append_unique(self, memory, identity, field, value, cause):
        items = memory["nodes"][identity][field]
        if not isinstance(items, (list, tuple)):
            raise ValueError("append_unique requires a list")
        if any(equal(item, value) for item in items):
            return memory
        return self.assign(memory, identity, field, tuple(items) + (value,), cause)

    @staticmethod
    def select(memory, kind):
        return [node for node in memory["nodes"].values() if node["kind"] == kind]

    @staticmethod
    def select_active(memory, kind, selection, dependency_fields):
        return [node for node in memory["nodes"].values() if node["kind"] == kind
                and not blockers(memory, node["id"], selection, dependency_fields)]

    @staticmethod
    def absent(memory, identity):
        return identity not in memory["nodes"]

    @staticmethod
    def contains(items, value):
        return any(equal(item, value) for item in items)

    @staticmethod
    def nonempty(items):
        return len(items) > 0


def empty_memory():
    return FrozenMap({"nodes": {}, "deltas": (), "chain": None})
