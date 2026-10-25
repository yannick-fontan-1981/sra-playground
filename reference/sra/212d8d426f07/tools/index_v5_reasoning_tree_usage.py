"""Build exact static, expected, and runtime-use indexes for V1.5 tree nodes.

The generated files are creator-side evidence only.  They are never runtime
inputs and never infer a node visit from a successful game or an atlas link.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable, Mapping


REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "docs" / "v5" / "principle_usage"
RUN_EVIDENCE_PATH = OUTPUT_DIR / "reasoning_tree_run_evidence.jsonl"
TREE_PATH = REPO_ROOT / "docs" / "reasoning-tree" / "reasoning-tree_v-1.5.txt"
LEDGER_PATH = (
    REPO_ROOT
    / "docs"
    / "reasoning-tree"
    / "reasoning-tree_v-1.3"
    / "reconciliation_v-1.3.json"
)
TODO_PROGRESS_PATH = (
    REPO_ROOT
    / "docs"
    / "reasoning-tree"
    / "reasoning-tree_v-0.9"
    / "todo_implementation_progress.json"
)
ATLAS_PATH = (
    REPO_ROOT
    / "docs"
    / "reasoning-tree"
    / "reasoning-tree_v-1.1"
    / "reasoning-tree_v-1.0_source"
    / "reasoning-tree_v-1.0_parcours_25_jeux.json"
)
GENERATED_FILENAMES = (
    "reasoning_tree_static_registry.json",
    "reasoning_tree_activation_index.jsonl",
    "reasoning_tree_game_index.json",
    "reasoning_tree_impact_matrix.md",
)
NODE_LINE = re.compile(r"^(\S+) \[([^\]]+)\](?:\s+(.*))?$", re.MULTILINE)
NODE_TOKEN = re.compile(
    r"(?<![A-Za-z0-9_.-])([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_-]+)+)"
    r"(?![A-Za-z0-9_.-])"
)
NODE_ID_FIELD = re.compile(r'"reasoning_tree_node_id"\s*:\s*"([^"]+)"')


def _sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _relative(path: Path, repo_root: Path) -> str:
    return path.resolve().relative_to(repo_root.resolve()).as_posix()


def _tree_rows(repo_root: Path) -> list[dict[str, str]]:
    text = (repo_root / TREE_PATH.relative_to(REPO_ROOT)).read_text(
        encoding="utf-8-sig"
    )
    rows = [
        {"address": match.group(1), "node_id": match.group(2), "text": match.group(3) or ""}
        for match in NODE_LINE.finditer(text)
    ]
    addresses = tuple(row["address"] for row in rows)
    node_by_address = {row["address"]: row["node_id"] for row in rows}
    for row in rows:
        address = row["address"]
        ancestors = [
            candidate
            for candidate in addresses
            if len(candidate) < len(address)
            and address.startswith(candidate)
            and address[len(candidate)] in ".-,"
        ]
        parent_address = max(ancestors, key=len) if ancestors else ""
        row["parent_address"] = parent_address
        row["parent_node_id"] = node_by_address.get(parent_address, "")
    return rows


def _todo_by_node(repo_root: Path) -> dict[str, Mapping[str, Any]]:
    payload = json.loads(
        (repo_root / LEDGER_PATH.relative_to(REPO_ROOT)).read_text(encoding="utf-8")
    )
    inherited = {str(item["key"]): item for item in payload["entries"]}
    additions = json.loads((repo_root / "docs/reasoning-tree/reasoning-tree_v-1.5/reconciliation_v-1.5.json").read_text(encoding="utf-8"))
    for item in additions["entries"]:
        key = str(item["key"])
        if key in inherited:
            raise ValueError(f"V1.5 TODO collides with inherited identity: {key}")
        inherited[key] = item
    return inherited


def _implementation_progress_by_node(
    repo_root: Path,
) -> dict[str, Mapping[str, Any]]:
    path = repo_root / TODO_PROGRESS_PATH.relative_to(REPO_ROOT)
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("runtime_input") is not False:
        raise ValueError("TODO implementation progress must remain creator-side")
    entries = payload.get("entries")
    if not isinstance(entries, list):
        raise ValueError("TODO implementation progress entries must be a list")
    result = {str(item["node_id"]): item for item in entries}
    if len(result) != len(entries):
        raise ValueError("TODO implementation progress node identities must be unique")
    return result


def _static_references(
    repo_root: Path, node_ids: set[str]
) -> dict[str, dict[str, list[str]]]:
    result = {
        node_id: {"production": [], "tools": [], "tests": []}
        for node_id in node_ids
    }
    groups = (
        ("production", repo_root / "agents" / "yf_arc3_v5", {".drm", ".json", ".logos", ".py", ".src"}),
        ("tools", repo_root / "tools", {".py", ".json"}),
        ("tests", repo_root / "tests", {".py", ".json"}),
    )
    for kind, root, suffixes in groups:
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path.suffix not in suffixes:
                continue
            relative = _relative(path, repo_root)
            for line_number, line in enumerate(
                path.read_text(encoding="utf-8", errors="replace").splitlines(),
                start=1,
            ):
                candidates = set(NODE_TOKEN.findall(line))
                candidates.update(NODE_ID_FIELD.findall(line))
                for node_id in sorted(candidates & node_ids):
                    result[node_id][kind].append(f"{relative}:{line_number}")
    return result


def _expected_atlas_uses(
    repo_root: Path, node_by_address: Mapping[str, str]
) -> dict[str, list[dict[str, Any]]]:
    uses: dict[str, dict[tuple[str, int, str], dict[str, Any]]] = defaultdict(dict)
    atlas = json.loads(
        (repo_root / ATLAS_PATH.relative_to(REPO_ROOT)).read_text(encoding="utf-8")
    )
    for game_entry in atlas.get("games", ()):
        for level_entry in game_entry.get("levels", ()):
            for group in level_entry.get("groups", ()):
                game = str(group["game"])
                level = int(group["level"])
                group_ref = str(group["id"])
                for address in group.get("all_specific_nodes", ()):
                    node_id = node_by_address.get(str(address))
                    if node_id is None:
                        continue
                    key = (game, level, group_ref)
                    uses[node_id][key] = {
                        "game": game,
                        "level": level,
                        "group_ref": group_ref,
                        "evidence_kind": "atlas_expected_use",
                    }
    return {
        node_id: [items[key] for key in sorted(items)]
        for node_id, items in uses.items()
    }


def build_static_registry(repo_root: Path = REPO_ROOT) -> dict[str, Any]:
    rows = _tree_rows(repo_root)
    node_ids = {row["node_id"] for row in rows}
    if len(rows) != len(node_ids):
        raise ValueError("V1.5 tree node identities must be unique")
    todos = _todo_by_node(repo_root)
    progress = _implementation_progress_by_node(repo_root)
    unknown_progress = sorted(set(progress) - set(todos))
    if unknown_progress:
        raise ValueError(
            f"implementation progress references non-TODO nodes: {unknown_progress[:8]}"
        )
    references = _static_references(repo_root, node_ids)
    expected = _expected_atlas_uses(
        repo_root, {row["address"]: row["node_id"] for row in rows}
    )
    entries: list[dict[str, Any]] = []
    for order, row in enumerate(rows):
        node_id = row["node_id"]
        todo = todos.get(node_id)
        node_progress = progress.get(node_id)
        static = references[node_id]
        expected_uses = expected.get(node_id, [])
        entries.append(
            {
                "node_id": node_id,
                "address": row["address"],
                "tree_order_index": order,
                "parent_node_id": row["parent_node_id"],
                "parent_address": row["parent_address"],
                "node_text": row["text"],
                "tree_status": "todo_skeleton" if todo is not None else "inherited_node",
                "implementation_status": (
                    str(node_progress["status"])
                    if node_progress is not None
                    else (
                        "not_implemented"
                        if todo is not None
                        else "not_asserted_by_index"
                    )
                ),
                **(
                    {"implementation_progress": node_progress}
                    if node_progress is not None
                    else {}
                ),
                "creator_alert": (
                    None
                    if todo is None
                    else {
                        "workflow_ref": todo.get(
                            "active_projection_workflow_id", todo["workflow_id"]
                        ),
                        "drm_rule_ref": todo.get("drm_rule_ref"),
                        "provisional_gate": todo.get("provisional_gate"),
                        "routing_kind": todo["routing_kind"],
                        "conditioning_work_required": bool(
                            todo.get("conditioning_work_required", True)
                        ),
                        "implementation_work_required": bool(
                            todo.get("implementation_work_required", True)
                        ),
                    }
                ),
                "static_references": static,
                "expected_atlas_uses": expected_uses,
                "static_reference_status": (
                    "explicit_reference_present"
                    if any(static.values())
                    else "no_exact_static_reference"
                ),
                "expected_use_status": (
                    "expected_use_documented"
                    if expected_uses
                    else "no_game_specific_expected_use"
                ),
            }
        )
    return {
        "schema_version": 1,
        "kind": "v5_reasoning_tree_static_registry",
        "tree_version": "1.5",
        "runtime_input": False,
        "normative_source": _relative(
            repo_root / TREE_PATH.relative_to(REPO_ROOT), repo_root
        ),
        "normative_source_sha256": _sha256_bytes(
            (repo_root / TREE_PATH.relative_to(REPO_ROOT)).read_bytes()
        ),
        "expected_use_source": _relative(
            repo_root / ATLAS_PATH.relative_to(REPO_ROOT), repo_root
        ),
        "expected_use_is_dynamic_evidence": False,
        "entries": entries,
        "summary": {
            "node_count": len(entries),
            "todo_skeleton_count": len(todos),
            "todo_with_partial_implementation_count": len(progress),
            "inherited_node_count": len(entries) - len(todos),
            "nodes_with_static_references": sum(
                entry["static_reference_status"] == "explicit_reference_present"
                for entry in entries
            ),
            "nodes_with_expected_atlas_uses": sum(
                entry["expected_use_status"] == "expected_use_documented"
                for entry in entries
            ),
        },
    }


def default_report_sources(repo_root: Path = REPO_ROOT) -> tuple[Path, ...]:
    evidence = repo_root / RUN_EVIDENCE_PATH.relative_to(REPO_ROOT)
    if evidence.is_file():
        return (evidence,)
    return tuple(
        sorted(
            (repo_root / "docs" / "env_bridge_reports" / "latest_offline").glob(
                "*/report.json"
            )
        )
    )


def snapshot_run_evidence(
    *,
    repo_root: Path = REPO_ROOT,
    output_path: Path = RUN_EVIDENCE_PATH,
) -> dict[str, Any]:
    """Freeze compact report metadata and tree projections, never raw state."""

    reports = tuple(
        sorted(
            (repo_root / "docs" / "env_bridge_reports" / "latest_offline").glob(
                "*/report.json"
            )
        )
    )
    known_nodes = {row["node_id"]: row for row in _tree_rows(repo_root)}
    rows: list[dict[str, Any]] = []
    for path in reports:
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        compact_usage = _compact_usage_evidence(report.get("reasoning_tree_usage"))
        if isinstance(compact_usage, Mapping):
            compact_usage = dict(compact_usage)
            runtime_node_ids = {
                str(item.get("node_id") or "")
                for item in compact_usage.get("entries") or ()
                if isinstance(item, Mapping)
            }
            postrun_entries = tuple(
                item
                for item in _postrun_action_contract_usage(report, known_nodes)
                if item["node_id"] not in runtime_node_ids
            )
            compact_usage["entries"] = [
                *(compact_usage.get("entries") or ()),
                *postrun_entries,
            ]
            compact_usage["unique_usage_count"] = len(
                {str(item.get("node_id") or "") for item in compact_usage["entries"]}
            )
            compact_usage["occurrence_count"] = sum(
                int(item.get("occurrence_count") or 0)
                for item in compact_usage["entries"]
            )
        rows.append(
            {
                "source_artifact": _relative(path, repo_root),
                "game_id": report.get("game_id"),
                "level": report.get("level", 1),
                "run_id": report.get("run_id"),
                "run_commit": report.get("run_commit"),
                "trace_digest": report.get("trace_digest"),
                "proof_ok": report.get("proof_ok", False),
                "outcome": report.get("outcome", "unknown"),
                "final_score": report.get("final_score", 0),
                "primitive_action_count": report.get("primitive_action_count", 0),
                "reasoning_tree_usage": compact_usage,
            }
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        "".join(json.dumps(row, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )
    return {
        "evidence_path": _relative(output_path, repo_root),
        "report_count": len(rows),
        "report_with_usage_count": sum(
            isinstance(row.get("reasoning_tree_usage"), Mapping) for row in rows
        ),
        "sha256": _sha256_bytes(output_path.read_bytes()),
    }


def _postrun_action_contract_usage(
    report: Mapping[str, Any],
    known_nodes: Mapping[str, Mapping[str, Any]],
) -> tuple[dict[str, Any], ...]:
    """Index exact tree refs already present in compact action contracts.

    This creator-side pass reads saved reports only. It adds no runtime probe,
    payload field, or decision latency.
    """

    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for step in report.get("steps") or ():
        if not isinstance(step, Mapping):
            continue
        envelope = step.get("decision_envelope")
        if not isinstance(envelope, Mapping):
            continue
        decision_ref = str(envelope.get("action_intent_ref") or "")
        frame_id = str(
            (step.get("retained_grid_interaction") or {}).get("frame_id") or ""
        )
        for link in envelope.get("reason_links") or ():
            if not isinstance(link, Mapping):
                continue
            node_id = str(link.get("reference_ref") or "")
            node = known_nodes.get(node_id)
            if node is None:
                continue
            relation_kind = str(link.get("relation_kind") or "reference")
            key = (node_id, relation_kind)
            item = grouped.setdefault(
                key,
                {
                    "node_id": node_id,
                    "node_address": str(node.get("address") or ""),
                    "parent_node_id": str(node.get("parent_node_id") or ""),
                    "parent_address": str(node.get("parent_address") or ""),
                    "declared_node_version": "1.1",
                    "usage_kind": f"postrun_action_contract_{relation_kind}",
                    "workflow_ref": "creator_side.saved_action_contract_index",
                    "workflow_step_ref": f"decision_envelope.reason_links.{relation_kind}",
                    "selected_alternative_ref": node_id,
                    "first_decision_ref": decision_ref,
                    "last_decision_ref": decision_ref,
                    "first_frame_id": frame_id,
                    "last_frame_id": frame_id,
                    "first_state_revision": int(step.get("i") or 0),
                    "last_state_revision": int(step.get("i") or 0),
                    "occurrence_count": 0,
                    "sample_frame_ids": [],
                    "sample_frame_ids_truncated": False,
                    "source_hashes": [],
                    "observed_gate": "saved_action_contract",
                    "conditioning_work_required": False,
                    "implementation_work_required": False,
                },
            )
            item["last_decision_ref"] = decision_ref
            item["last_frame_id"] = frame_id
            item["last_state_revision"] = int(step.get("i") or 0)
            item["occurrence_count"] += 1
            if frame_id and frame_id not in item["sample_frame_ids"]:
                item["sample_frame_ids"].append(frame_id)
    return tuple(grouped[key] for key in sorted(grouped))


def _compact_usage_evidence(value: object) -> object:
    if not isinstance(value, Mapping):
        return None
    compact_entries: list[dict[str, Any]] = []
    passive_fields = (
        "node_id",
        "node_address",
        "parent_node_id",
        "parent_address",
        "declared_node_version",
        "usage_kind",
        "workflow_ref",
        "workflow_step_ref",
        "selected_alternative_ref",
        "source_hashes",
        "observed_gate",
        "conditioning_work_required",
        "implementation_work_required",
        "occurrence_count",
    )
    for item in value.get("entries") or ():
        if not isinstance(item, Mapping):
            continue
        if item.get("usage_kind") == "creator_alerted":
            compact_entries.append(
                {field: item[field] for field in passive_fields if field in item}
            )
        else:
            compact_entries.append(dict(item))
    return {
        "schema_version": value.get("schema_version"),
        "tree_version": value.get("tree_version"),
        "runtime_input": False,
        "evidence_policy": value.get("evidence_policy"),
        "absence_policy": value.get("absence_policy"),
        "run_id": value.get("run_id"),
        "unique_usage_count": value.get("unique_usage_count", 0),
        "occurrence_count": value.get("occurrence_count", 0),
        "unmapped_compiled_selection_count": value.get(
            "unmapped_compiled_selection_count", 0
        ),
        "unmapped_compiled_selections": value.get(
            "unmapped_compiled_selections", ()
        ),
        "entries": compact_entries,
    }


def _report_payloads(
    path: Path, repo_root: Path
) -> list[tuple[Mapping[str, Any], str]]:
    if path.name == RUN_EVIDENCE_PATH.name:
        rows: list[tuple[Mapping[str, Any], str]] = []
        for line_number, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if not line.strip():
                continue
            payload = json.loads(line)
            source = str(payload.get("source_artifact") or "")
            rows.append(
                (
                    payload,
                    source or f"{_relative(path, repo_root)}#entry={line_number}",
                )
            )
        return rows
    payload = json.loads(path.read_text(encoding="utf-8"))
    return [(payload, _relative(path, repo_root))]


def build_activation_index(
    report_paths: Iterable[Path],
    repo_root: Path = REPO_ROOT,
    *,
    known_nodes: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[str], list[dict[str, Any]]]:
    activations: list[dict[str, Any]] = []
    sources_without_usage: list[str] = []
    report_summaries: list[dict[str, Any]] = []
    for path in sorted(set(report_paths)):
        try:
            payloads = _report_payloads(path, repo_root)
        except (OSError, json.JSONDecodeError):
            continue
        for report, source_artifact in payloads:
            usage = report.get("reasoning_tree_usage")
            if not isinstance(usage, Mapping):
                sources_without_usage.append(source_artifact)
                continue
            game = str(report.get("game_id") or "").split("-", 1)[0].upper()
            unresolved_selections: list[Mapping[str, Any]] = []
            for item in usage.get("unmapped_compiled_selections") or ():
                if not isinstance(item, Mapping):
                    continue
                alternative_ref = str(item.get("selected_alternative_ref") or "")
                node = (known_nodes or {}).get(alternative_ref)
                if node is None:
                    unresolved_selections.append(item)
                    continue
                activations.append(
                    _activation_from_unmapped_identity(
                        report=report,
                        item=item,
                        node=node,
                        game=game,
                        source_artifact=source_artifact,
                    )
                )
            report_summaries.append(
                {
                    "game": game,
                    "level": int(report.get("level") or 1),
                    "run_id": str(report.get("run_id") or ""),
                    "source_artifact": source_artifact,
                    "unique_usage_count": int(usage.get("unique_usage_count") or 0),
                    "occurrence_count": int(usage.get("occurrence_count") or 0),
                    "unmapped_compiled_selection_count": int(
                        sum(
                            int(item.get("occurrence_count") or 0)
                            for item in unresolved_selections
                        )
                    ),
                    "unmapped_compiled_selections": tuple(unresolved_selections),
                }
            )
            for item in usage.get("entries") or ():
                if not isinstance(item, Mapping) or not item.get("node_id"):
                    continue
                activations.append(
                    _activation_from_projected_node(
                        report=report,
                        item=item,
                        game=game,
                        source_artifact=source_artifact,
                    )
                )
    activations.sort(
        key=lambda item: (
            item["node_id"],
            item["game"],
            item["level"],
            item["run_id"],
            item["usage_kind"],
            item["workflow_ref"],
            item["workflow_step_ref"],
        )
    )
    report_summaries.sort(
        key=lambda item: (item["game"], item["level"], item["run_id"])
    )
    return activations, sources_without_usage, report_summaries


def _activation_from_unmapped_identity(
    *,
    report: Mapping[str, Any],
    item: Mapping[str, Any],
    node: Mapping[str, Any],
    game: str,
    source_artifact: str,
) -> dict[str, Any]:
    alternative_ref = str(item.get("selected_alternative_ref") or "")
    return {
        "node_id": alternative_ref,
        "node_address": str(node.get("address") or ""),
        "parent_node_id": str(node.get("parent_node_id") or ""),
        "usage_kind": "selected_by_exact_alternative_identity",
        "game": game,
        "level": int(report.get("level") or 1),
        "run_id": str(report.get("run_id") or ""),
        "run_commit": str(report.get("run_commit") or ""),
        "trace_digest": str(report.get("trace_digest") or ""),
        "proof_ok": bool(report.get("proof_ok")),
        "outcome": str(report.get("outcome") or "unknown"),
        "score": int(report.get("final_score") or 0),
        "primitive_action_count": int(report.get("primitive_action_count") or 0),
        "workflow_ref": str(item.get("workflow_ref") or ""),
        "workflow_step_ref": str(item.get("workflow_step_ref") or ""),
        "selected_alternative_ref": alternative_ref,
        "first_decision_ref": str(item.get("first_decision_ref") or ""),
        "last_decision_ref": str(item.get("last_decision_ref") or ""),
        "first_frame_id": str(item.get("first_frame_id") or ""),
        "last_frame_id": str(item.get("last_frame_id") or ""),
        "first_state_revision": int(item.get("first_state_revision") or 0),
        "last_state_revision": int(item.get("last_state_revision") or 0),
        "occurrence_count": int(item.get("occurrence_count") or 0),
        "sample_frame_ids": (),
        "sample_frame_ids_truncated": False,
        "source_hashes": tuple(item.get("source_hashes") or ()),
        "observed_gate": "",
        "conditioning_work_required": False,
        "implementation_work_required": False,
        "evidence_status": "exact_runtime_alternative_identity",
        "source_artifact": source_artifact,
    }


def _activation_from_projected_node(
    *,
    report: Mapping[str, Any],
    item: Mapping[str, Any],
    game: str,
    source_artifact: str,
) -> dict[str, Any]:
    usage_kind = str(item.get("usage_kind") or "")
    result = {
        "node_id": str(item["node_id"]),
        "node_address": str(item.get("node_address") or ""),
        "parent_node_id": str(item.get("parent_node_id") or ""),
        "usage_kind": usage_kind,
        "game": game,
        "level": int(report.get("level") or 1),
        "run_id": str(report.get("run_id") or ""),
        "run_commit": str(report.get("run_commit") or ""),
        "trace_digest": str(report.get("trace_digest") or ""),
        "proof_ok": bool(report.get("proof_ok")),
        "outcome": str(report.get("outcome") or "unknown"),
        "score": int(report.get("final_score") or 0),
        "primitive_action_count": int(report.get("primitive_action_count") or 0),
        "workflow_ref": str(item.get("workflow_ref") or ""),
        "workflow_step_ref": str(item.get("workflow_step_ref") or ""),
        "selected_alternative_ref": str(
            item.get("selected_alternative_ref") or ""
        ),
        "occurrence_count": int(item.get("occurrence_count") or 0),
        "source_hashes": tuple(item.get("source_hashes") or ()),
        "observed_gate": str(item.get("observed_gate") or ""),
        "conditioning_work_required": bool(
            item.get("conditioning_work_required")
        ),
        "implementation_work_required": bool(
            item.get("implementation_work_required")
        ),
        "evidence_status": "exact_runtime_projection",
        "source_artifact": source_artifact,
    }
    if usage_kind != "creator_alerted":
        result.update(
            {
                "first_decision_ref": str(item.get("first_decision_ref") or ""),
                "last_decision_ref": str(item.get("last_decision_ref") or ""),
                "first_frame_id": str(item.get("first_frame_id") or ""),
                "last_frame_id": str(item.get("last_frame_id") or ""),
                "first_state_revision": int(
                    item.get("first_state_revision") or 0
                ),
                "last_state_revision": int(item.get("last_state_revision") or 0),
                "sample_frame_ids": tuple(item.get("sample_frame_ids") or ()),
                "sample_frame_ids_truncated": bool(
                    item.get("sample_frame_ids_truncated")
                ),
            }
        )
    return result


def build_game_index(
    static_registry: Mapping[str, Any],
    activations: Iterable[Mapping[str, Any]],
    sources_without_usage: Iterable[str],
    report_summaries: Iterable[Mapping[str, Any]] = (),
) -> dict[str, Any]:
    expected: dict[tuple[str, int], set[str]] = defaultdict(set)
    for node in static_registry["entries"]:
        for use in node["expected_atlas_uses"]:
            expected[(str(use["game"]), int(use["level"]))].add(node["node_id"])
    actual_selected: dict[tuple[str, int], set[str]] = defaultdict(set)
    actual_alerted: dict[tuple[str, int], set[str]] = defaultdict(set)
    runs: dict[tuple[str, int], set[str]] = defaultdict(set)
    unmapped: dict[tuple[str, int], list[Mapping[str, Any]]] = defaultdict(list)
    for item in activations:
        key = (str(item["game"]), int(item["level"]))
        target = (
            actual_alerted
            if item["usage_kind"] == "creator_alerted"
            else actual_selected
        )
        target[key].add(str(item["node_id"]))
        runs[key].add(str(item["run_id"]))
    for summary in report_summaries:
        key = (str(summary["game"]), int(summary["level"]))
        runs[key].add(str(summary["run_id"]))
        unmapped[key].extend(summary.get("unmapped_compiled_selections") or ())
    keys = sorted(
        set(expected) | set(actual_selected) | set(actual_alerted) | set(runs)
    )
    return {
        "schema_version": 1,
        "kind": "v5_reasoning_tree_game_index",
        "tree_version": "1.5",
        "runtime_input": False,
        "expected_use_is_dynamic_evidence": False,
        "levels": [
            {
                "game": game,
                "level": level,
                "expected_node_ids": sorted(expected[(game, level)]),
                "actual_selected_node_ids": sorted(actual_selected[(game, level)]),
                "actual_creator_alert_node_ids": sorted(actual_alerted[(game, level)]),
                "unmapped_compiled_selection_occurrence_count": sum(
                    int(item.get("occurrence_count") or 0)
                    for item in unmapped[(game, level)]
                ),
                "unmapped_compiled_selections": sorted(
                    unmapped[(game, level)],
                    key=lambda item: (
                        str(item.get("workflow_ref") or ""),
                        str(item.get("workflow_step_ref") or ""),
                        str(item.get("selected_alternative_ref") or ""),
                    ),
                ),
                "run_ids": sorted(runs[(game, level)]),
                "dynamic_evidence_status": (
                    "exact_dynamic_evidence_present"
                    if runs[(game, level)]
                    else "dynamic_evidence_missing"
                ),
            }
            for game, level in keys
        ],
        "reports_without_usage": sorted(set(sources_without_usage)),
        "summary": {
            "indexed_game_level_count": len(keys),
            "game_level_with_dynamic_evidence_count": sum(bool(runs[key]) for key in keys),
            "report_without_usage_count": len(set(sources_without_usage)),
            "unmapped_compiled_selection_occurrence_count": sum(
                int(item.get("occurrence_count") or 0)
                for items in unmapped.values()
                for item in items
            ),
        },
    }


def _impact_markdown(
    static_registry: Mapping[str, Any], activations: Iterable[Mapping[str, Any]]
) -> str:
    by_node: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    for item in activations:
        by_node[str(item["node_id"])].append(item)
    lines = [
        "# V1.5 reasoning-tree usage impact matrix",
        "",
        "Creator-side evidence only. Expected atlas links are not runtime visits;",
        "absence of dynamic evidence is not evidence of non-use.",
        "",
        "| Address | Node | Status | Static refs | Expected games | Actual games | Selected | Alerts | Dynamic evidence |",
        "|---|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for node in static_registry["entries"]:
        uses = by_node[node["node_id"]]
        static_count = sum(len(items) for items in node["static_references"].values())
        expected_games = {item["game"] for item in node["expected_atlas_uses"]}
        actual_games = {item["game"] for item in uses}
        selected = sum(
            int(item["occurrence_count"])
            for item in uses
            if item["usage_kind"] != "creator_alerted"
        )
        alerts = sum(
            int(item["occurrence_count"])
            for item in uses
            if item["usage_kind"] == "creator_alerted"
        )
        lines.append(
            f"| `{node['address']}` | `{node['node_id']}` | "
            f"{node['tree_status']} | {static_count} | {len(expected_games)} | "
            f"{len(actual_games)} | {selected} | {alerts} | "
            f"{'exact' if uses else 'missing'} |"
        )
    return "\n".join(lines) + "\n"


def aggregate_activation_index(
    activations: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Collapse repeated node/workflow uses while preserving exact run evidence."""

    run_fields = {
        "game",
        "level",
        "run_id",
        "run_commit",
        "trace_digest",
        "proof_ok",
        "outcome",
        "score",
        "primitive_action_count",
        "first_decision_ref",
        "last_decision_ref",
        "first_frame_id",
        "last_frame_id",
        "first_state_revision",
        "last_state_revision",
        "occurrence_count",
        "sample_frame_ids",
        "sample_frame_ids_truncated",
        "source_artifact",
    }
    grouped: dict[str, dict[str, Any]] = {}
    for item in activations:
        shared = {key: value for key, value in item.items() if key not in run_fields}
        key = json.dumps(shared, sort_keys=True, separators=(",", ":"))
        group = grouped.get(key)
        if group is None:
            group = {
                **shared,
                "games": [],
                "levels": [],
                "run_count": 0,
                "total_occurrence_count": 0,
                "run_uses": [],
            }
            grouped[key] = group
        run_use = {field: item[field] for field in sorted(run_fields) if field in item}
        group["run_uses"].append(run_use)
        group["run_count"] += 1
        group["total_occurrence_count"] += int(item.get("occurrence_count") or 0)
        game = str(item.get("game") or "")
        level = int(item.get("level") or 1)
        if game and game not in group["games"]:
            group["games"].append(game)
        level_ref = f"{game}:L{level}"
        if game and level_ref not in group["levels"]:
            group["levels"].append(level_ref)
    result = list(grouped.values())
    for group in result:
        group["games"].sort()
        group["levels"].sort()
        group["run_uses"].sort(
            key=lambda item: (
                str(item.get("game") or ""),
                int(item.get("level") or 0),
                str(item.get("run_id") or ""),
            )
        )
    result.sort(
        key=lambda item: (
            str(item.get("node_id") or ""),
            str(item.get("usage_kind") or ""),
            str(item.get("workflow_ref") or ""),
            str(item.get("workflow_step_ref") or ""),
            str(item.get("selected_alternative_ref") or ""),
        )
    )
    return result


def build_bundle(repo_root: Path = REPO_ROOT) -> dict[str, Any]:
    static = build_static_registry(repo_root)
    known_nodes = {entry["node_id"]: entry for entry in static["entries"]}
    activations, missing, report_summaries = build_activation_index(
        default_report_sources(repo_root),
        repo_root,
        known_nodes=known_nodes,
    )
    known = set(known_nodes)
    unknown = sorted({item["node_id"] for item in activations} - known)
    if unknown:
        raise ValueError(f"runtime usage references unknown V1.5 nodes: {unknown[:8]}")
    return {
        "static": static,
        "activations": activations,
        "game_index": build_game_index(
            static, activations, missing, report_summaries
        ),
        "impact": _impact_markdown(static, activations),
    }


def render_bundle(bundle: Mapping[str, Any]) -> dict[str, str]:
    return {
        "reasoning_tree_static_registry.json": json.dumps(
            bundle["static"], indent=2, sort_keys=True
        ) + "\n",
        "reasoning_tree_activation_index.jsonl": "".join(
            json.dumps(item, sort_keys=True) + "\n"
            for item in aggregate_activation_index(bundle["activations"])
        ),
        "reasoning_tree_game_index.json": json.dumps(
            bundle["game_index"], indent=2, sort_keys=True
        ) + "\n",
        "reasoning_tree_impact_matrix.md": str(bundle["impact"]),
    }


def write_bundle(
    output_dir: Path = OUTPUT_DIR, repo_root: Path = REPO_ROOT
) -> dict[str, Any]:
    bundle = build_bundle(repo_root)
    output_dir.mkdir(parents=True, exist_ok=True)
    for filename, payload in render_bundle(bundle).items():
        (output_dir / filename).write_text(payload, encoding="utf-8")
    return {
        **bundle["static"]["summary"],
        "activation_count": len(bundle["activations"]),
        "activation_group_count": len(
            aggregate_activation_index(bundle["activations"])
        ),
        **bundle["game_index"]["summary"],
    }


def validate_freshness(
    output_dir: Path = OUTPUT_DIR, repo_root: Path = REPO_ROOT
) -> list[str]:
    expected = render_bundle(build_bundle(repo_root))
    errors: list[str] = []
    for filename in GENERATED_FILENAMES:
        path = output_dir / filename
        if not path.is_file():
            errors.append(f"missing generated artifact: {filename}")
            continue
        stored = path.read_text(encoding="utf-8")
        if stored != expected[filename]:
            errors.append(
                f"stale generated artifact: {filename} "
                f"stored_sha256={_sha256_bytes(stored.encode())} "
                f"current_sha256={_sha256_bytes(expected[filename].encode())}"
            )
    return errors


def query_node(
    node_id: str,
    output_dir: Path = OUTPUT_DIR,
) -> dict[str, Any]:
    static = json.loads(
        (output_dir / "reasoning_tree_static_registry.json").read_text(
            encoding="utf-8"
        )
    )
    node = next(
        (item for item in static["entries"] if item["node_id"] == node_id), None
    )
    activations = [
        json.loads(line)
        for line in (
            output_dir / "reasoning_tree_activation_index.jsonl"
        ).read_text(encoding="utf-8").splitlines()
        if line.strip() and json.loads(line).get("node_id") == node_id
    ]
    return {
        "node": node,
        "activations": activations,
        "dynamic_evidence_status": (
            "exact_dynamic_evidence_present"
            if activations
            else "dynamic_evidence_missing"
        ),
    }


def upsert_run_evidence(
    *,
    source_path: Path,
    target_path: Path,
    game_id: str,
    level: int,
) -> dict[str, Any]:
    """Replace exactly one creator-side game/level evidence row."""

    def game_key(value: object) -> str:
        return str(value or "").strip().lower().split("-", 1)[0]

    requested_key = game_key(game_id)
    source_rows = [
        (line, json.loads(line))
        for line in source_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    target_rows = [
        (line, json.loads(line))
        for line in target_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    source_matches = [
        line
        for line, payload in source_rows
        if game_key(payload.get("game_id")) == requested_key
        and int(payload.get("level") or 0) == level
    ]
    target_indexes = [
        index
        for index, (_line, payload) in enumerate(target_rows)
        if game_key(payload.get("game_id")) == requested_key
        and int(payload.get("level") or 0) == level
    ]
    if len(source_matches) != 1:
        raise ValueError(
            "source evidence selection must be unique: "
            f"game={game_id!r} level={level} matches={len(source_matches)}"
        )
    if len(target_indexes) != 1:
        raise ValueError(
            "target evidence selection must be unique: "
            f"game={game_id!r} level={level} matches={len(target_indexes)}"
        )
    target_index = target_indexes[0]
    previous_line, previous_payload = target_rows[target_index]
    replacement_line = source_matches[0]
    replacement_payload = json.loads(replacement_line)
    target_rows[target_index] = (replacement_line, replacement_payload)
    rendered = "\n".join(line for line, _payload in target_rows) + "\n"
    target_path.write_text(rendered, encoding="utf-8")
    return {
        "game_id": game_id,
        "level": level,
        "previous_run_commit": previous_payload.get("run_commit"),
        "replacement_run_commit": replacement_payload.get("run_commit"),
        "previous_sha256": _sha256_bytes(previous_line.encode()),
        "replacement_sha256": _sha256_bytes(replacement_line.encode()),
        "target_path": target_path.as_posix(),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command",
        choices=("snapshot", "upsert-evidence", "build", "validate", "query"),
    )
    parser.add_argument("node_id", nargs="?")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--source-evidence", type=Path)
    parser.add_argument("--game-id")
    parser.add_argument("--level", type=int)
    args = parser.parse_args(argv)
    if args.command == "snapshot":
        result = snapshot_run_evidence(
            output_path=args.output_dir / RUN_EVIDENCE_PATH.name
        )
    elif args.command == "upsert-evidence":
        if args.source_evidence is None or not args.game_id or args.level is None:
            parser.error(
                "upsert-evidence requires --source-evidence, --game-id, and --level"
            )
        result = upsert_run_evidence(
            source_path=args.source_evidence,
            target_path=args.output_dir / RUN_EVIDENCE_PATH.name,
            game_id=args.game_id,
            level=args.level,
        )
    elif args.command == "build":
        result = write_bundle(args.output_dir)
    elif args.command == "validate":
        errors = validate_freshness(args.output_dir)
        result = {"ok": not errors, "errors": errors}
    else:
        if not args.node_id:
            parser.error("query requires node_id")
        result = query_node(args.node_id, args.output_dir)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if not result.get("errors") else 1


if __name__ == "__main__":
    raise SystemExit(main())
