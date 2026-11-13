#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DOC_PATH = ROOT / "docs/recovery/lot9c-joint-channels-audit.md"
JSON_PATH = ROOT / "docs/recovery/lot9c-joint-channels-audit.json"

TERM_PATTERN = re.compile(
    r"(?:joint[_\- ]?channels?|jointChannels|lot[_\- ]?9c|9C\s+[`'\"]?joint)",
    re.IGNORECASE,
)
SOURCE_SUFFIXES = {".ts", ".tsx", ".js", ".mjs", ".cjs", ".py", ".rs", ".go"}
TEXT_PATHS = [
    "*.ts", "*.tsx", "*.js", "*.mjs", "*.cjs", "*.py", "*.rs", "*.go",
    "*.md", "*.json", "*.yaml", "*.yml", "*.txt", "*.toml",
]
MAX_HITS = 600


def run(*args: str, check: bool = True) -> str:
    completed = subprocess.run(
        args,
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if check and completed.returncode != 0:
        raise RuntimeError(
            f"command failed ({completed.returncode}): {' '.join(args)}\n{completed.stderr}"
        )
    return completed.stdout


def git(*args: str, check: bool = True) -> str:
    return run("git", *args, check=check)


def remote_refs() -> list[str]:
    raw = git(
        "for-each-ref",
        "--format=%(refname:short)",
        "refs/remotes/origin",
    )
    return sorted(
        ref.strip()
        for ref in raw.splitlines()
        if ref.strip() and not ref.endswith("/HEAD")
    )


def relevant_branch_names(refs: list[str]) -> list[str]:
    return [
        ref for ref in refs
        if re.search(r"(?:lot[-_]?9|joint|channel|site109|op01-op31)", ref, re.I)
    ]


def group_refs_by_tree(refs: list[str]) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for ref in refs:
        tree = git("rev-parse", f"{ref}^{{tree}}").strip()
        grouped[tree].append(ref)
    return dict(sorted(grouped.items()))


def filename_hits(tree: str, refs: list[str]) -> list[dict[str, Any]]:
    names = git("ls-tree", "-r", "--name-only", tree).splitlines()
    return [
        {"tree": tree, "refs": refs, "path": path}
        for path in names
        if TERM_PATTERN.search(path)
    ]


def content_hits(tree: str, refs: list[str]) -> tuple[list[dict[str, Any]], bool]:
    args = [
        "grep", "-n", "-I", "-i", "-E",
        r"joint[_ -]?channels?|jointChannels|lot[_ -]?9c|9C[[:space:]]+.*joint",
        tree,
        "--",
        *TEXT_PATHS,
    ]
    output = git(*args, check=False)
    hits: list[dict[str, Any]] = []
    truncated = False
    for line in output.splitlines():
        # git grep with a tree emits: <tree>:<path>:<line>:<text>
        prefix = f"{tree}:"
        value = line[len(prefix):] if line.startswith(prefix) else line
        match = re.match(r"(.+?):(\d+):(.*)$", value)
        if not match:
            continue
        path, lineno, text = match.groups()
        hits.append({
            "tree": tree,
            "refs": refs,
            "path": path,
            "line": int(lineno),
            "text": text.strip(),
        })
        if len(hits) >= MAX_HITS:
            truncated = True
            break
    return hits, truncated


def commit_message_hits() -> list[dict[str, str]]:
    output = git(
        "log", "--all", "--date=iso-strict",
        "--pretty=format:%H%x09%ad%x09%s",
        "--regexp-ignore-case",
        "--extended-regexp",
        "--grep=joint[_ -]?channels?|jointChannels|lot[_ -]?9c|9C.*joint",
    )
    results = []
    for line in output.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3:
            results.append({"commit": parts[0], "date": parts[1], "subject": parts[2]})
    return results


def history_patch_hits() -> list[dict[str, Any]]:
    output = git(
        "log", "--all", "--date=iso-strict",
        "--pretty=format:@@@%H%x09%ad%x09%s",
        "--name-only",
        "-G", r"joint[_ -]?channels?|jointChannels|lot[_ -]?9c|9C.*joint",
        "--",
        *TEXT_PATHS,
        check=False,
    )
    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for line in output.splitlines():
        if line.startswith("@@@"):
            parts = line[3:].split("\t", 2)
            current = {
                "commit": parts[0],
                "date": parts[1] if len(parts) > 1 else "",
                "subject": parts[2] if len(parts) > 2 else "",
                "paths": [],
            }
            records.append(current)
        elif line.strip() and current is not None:
            current["paths"].append(line.strip())
    return records


def classify(hits: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    result = {"product_source": [], "tests": [], "docs_or_metadata": []}
    for hit in hits:
        path = hit["path"]
        suffix = Path(path).suffix.lower()
        if path.startswith("tests/") or "/tests/" in path or path.endswith(".test.ts") or path.endswith(".test.mjs"):
            result["tests"].append(hit)
        elif suffix in SOURCE_SUFFIXES and not path.startswith("scripts/"):
            result["product_source"].append(hit)
        else:
            result["docs_or_metadata"].append(hit)
    return result


def compact_refs(refs: list[str]) -> str:
    if len(refs) <= 6:
        return ", ".join(f"`{ref}`" for ref in refs)
    shown = ", ".join(f"`{ref}`" for ref in refs[:6])
    return f"{shown}, … (+{len(refs) - 6})"


def render_hits(title: str, hits: list[dict[str, Any]], limit: int = 80) -> list[str]:
    lines = [f"### {title}", ""]
    if not hits:
        lines.extend(["Aucun hit.", ""])
        return lines
    for hit in hits[:limit]:
        location = f"`{hit['path']}`"
        if "line" in hit:
            location += f":{hit['line']}"
        lines.append(f"- {location} — {compact_refs(hit['refs'])}")
        if hit.get("text"):
            lines.append(f"  - `{hit['text'][:300]}`")
    if len(hits) > limit:
        lines.append(f"- … {len(hits) - limit} autres hits conservés dans le JSON.")
    lines.append("")
    return lines


def main() -> None:
    git("fetch", "--all", "--prune")
    refs = remote_refs()
    grouped = group_refs_by_tree(refs)

    filenames: list[dict[str, Any]] = []
    contents: list[dict[str, Any]] = []
    truncated_trees: list[str] = []
    for tree, tree_refs in grouped.items():
        filenames.extend(filename_hits(tree, tree_refs))
        hits, truncated = content_hits(tree, tree_refs)
        contents.extend(hits)
        if truncated:
            truncated_trees.append(tree)

    classified = classify(contents)
    commits = commit_message_hits()
    history = history_patch_hits()
    relevant_refs = relevant_branch_names(refs)

    report = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "terms": [
            "joint_channels", "joint channels", "joint-channel",
            "joint channel", "jointChannels", "lot9c", "lot 9c", "9C … joint",
        ],
        "remoteRefCount": len(refs),
        "uniqueTreeCount": len(grouped),
        "relevantBranchNames": relevant_refs,
        "filenameHits": filenames,
        "contentHits": contents,
        "classifiedContentHits": classified,
        "commitMessageHits": commits,
        "historyPatchHits": history,
        "truncatedTrees": truncated_trees,
        "admission": {
            "historicalProductSourceAdmitted": False,
            "reason": (
                "Raw hits are discovery evidence only. A product implementation is admitted "
                "only after source identity and behavioral contract review."
            ),
        },
    }
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    source_hits = classified["product_source"]
    test_hits = classified["tests"]
    docs_hits = classified["docs_or_metadata"]

    lines = [
        "# Lot 9C `joint_channels` — audit de récupération GitHub",
        "",
        f"Généré le `{report['generatedAt']}`.",
        "",
        "## Règle d’admission",
        "",
        "Cet audit recherche des preuves durables. Un nom, une mention documentaire ou un ancien test ne suffit pas à admettre une implémentation historique. Aucun comportement n’est déduit du seul nom `joint_channels`.",
        "",
        "## Périmètre scanné",
        "",
        f"- refs distantes accessibles : **{len(refs)}** ;",
        f"- arbres Git uniques : **{len(grouped)}** ;",
        f"- branches aux noms potentiellement pertinents : **{len(relevant_refs)}** ;",
        "- historique des messages de commit ;",
        "- historique des patches avec `git log -G` ;",
        "- sources, tests, scripts, documentation et métadonnées textuelles.",
        "",
        "Termes exacts et variantes : `joint_channels`, `joint channels`, `joint-channel`, `joint channel`, `jointChannels`, `lot9c`, `lot 9c`, et mentions `9C … joint`.",
        "",
        "## Résumé brut",
        "",
        f"- noms de fichiers correspondants : **{len(filenames)}** ;",
        f"- lignes de contenu correspondantes : **{len(contents)}** ;",
        f"- hits dans du code produit : **{len(source_hits)}** ;",
        f"- hits dans des tests : **{len(test_hits)}** ;",
        f"- hits documentaires/scripts/métadonnées : **{len(docs_hits)}** ;",
        f"- messages de commit correspondants : **{len(commits)}** ;",
        f"- commits détectés par recherche de patch : **{len(history)}**.",
        "",
    ]
    lines += render_hits("Hits dans du code produit", source_hits)
    lines += render_hits("Hits dans les tests", test_hits)
    lines += render_hits("Hits documentaires, scripts ou métadonnées", docs_hits)

    lines.extend(["### Messages de commit", ""])
    if commits:
        for item in commits[:80]:
            lines.append(f"- `{item['commit']}` — {item['date']} — {item['subject']}")
    else:
        lines.append("Aucun hit.")
    lines.append("")

    lines.extend(["### Historique de patches", ""])
    if history:
        for item in history[:80]:
            paths = ", ".join(f"`{path}`" for path in item["paths"][:12]) or "aucun chemin listé"
            lines.append(f"- `{item['commit']}` — {item['date']} — {item['subject']} — {paths}")
    else:
        lines.append("Aucun hit.")
    lines.append("")

    lines.extend(["## Conclusion d’audit", ""])
    if source_hits:
        lines.extend([
            "Des hits de code produit ont été retrouvés, mais **aucune implémentation n’est encore admise comme contrat historique**. Chaque source doit maintenant être relue pour établir son identité, ses entrées, son état, ses consommateurs, ses effets décisionnels, ses bornes et sa restauration.",
            "",
            "Prochaine pièce : revue manuelle des hits de code produit et comparaison aux branches de récupération correspondantes.",
        ])
    elif test_hits or docs_hits or commits or history:
        lines.extend([
            "Aucune implémentation de code produit nommée `joint_channels` n’est admise par cet audit. Les traces retrouvées sont limitées à des tests, documents, scripts, métadonnées ou historique et doivent servir uniquement à reconstruire un contrat prouvable.",
            "",
            "Prochaine pièce : extraire de ces traces la chaîne `besoin → données → proposition → consommateur → effet`, en marquant explicitement toute partie non prouvable.",
        ])
    else:
        lines.extend([
            "Aucune preuve textuelle durable correspondant aux variantes recherchées n’a été retrouvée dans les refs accessibles. Le nom `joint_channels` provient donc seulement de la feuille de route actuelle et ne suffit pas à définir une faculté.",
            "",
            "Prochaine pièce : rechercher les contrats Lot 9 adjacents et les descriptions persistantes externes déjà sauvegardées, puis définir uniquement les questions auxquelles une reconstruction 9C devra répondre.",
        ])
    lines.extend([
        "",
        "## Statut 9C après cet audit",
        "",
        "- implémentation historique admise : **non** ;",
        "- contrat minimal : **à établir à partir des preuves relues** ;",
        "- développement : **non commencé** ;",
        "- performance : **non applicable à ce stade** ;",
        "- compteur des 76 : **inchangé**.",
        "",
        "Le détail intégral et les refs associées sont conservés dans `docs/recovery/lot9c-joint-channels-audit.json`.",
    ])
    DOC_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
