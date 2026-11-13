#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / "docs/recovery/lot9c-joint-channels-audit.json"
STATUS_MD = ROOT / "docs/recovery/lot9c-joint-channels-contract-status.md"
STATUS_JSON = ROOT / "docs/recovery/lot9c-joint-channels-contract-status.json"
CONTEXT_MD = ROOT / "docs/recovery/lot9c-joint-channels-evidence-context.md"

CONTRACT_FIELDS = [
    ("channel_identity", "Identité stable d’un canal"),
    ("channel_payload", "Données portées par un canal"),
    ("join_predicate", "Condition prouvée permettant de joindre deux canaux"),
    ("joint_identity", "Identité de la liaison jointe"),
    ("cardinality", "Nombre de canaux autorisés par liaison"),
    ("temporal_scope", "Portée session/niveau/révision"),
    ("creation_rule", "Règle de création"),
    ("removal_rule", "Règle de retrait"),
    ("contradiction_rule", "Traitement des contradictions"),
    ("proposal_rule", "Condition de proposition"),
    ("selection_rule", "Interaction avec ambiguïté et caller commun"),
    ("return_acquisition", "Acquisition et déduplication du retour"),
    ("decision_consumer", "Consommateur décisionnel réel"),
    ("future_effect", "Effet sur une décision future"),
    ("bounds", "Bornes mémoire/recherche"),
    ("snapshot_restore", "Snapshot et restauration"),
    ("public_producer", "Producteur fondé sur données publiques"),
    ("performance_corpus", "Corpus qui exerce réellement le périmètre"),
]


def git_show(ref: str, path: str) -> list[str] | None:
    completed = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        return None
    return completed.stdout.splitlines()


def evidence_key(hit: dict[str, Any]) -> tuple[Any, ...]:
    return (hit.get("path"), hit.get("line"), hit.get("text"), hit.get("tree"))


def unique_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    result = []
    for hit in hits:
        key = evidence_key(hit)
        if key in seen:
            continue
        seen.add(key)
        result.append(hit)
    return result


def context_blocks(hits: list[dict[str, Any]], label: str, limit: int = 30) -> list[str]:
    lines = [f"## {label}", ""]
    if not hits:
        lines.extend(["Aucun hit.", ""])
        return lines
    for index, hit in enumerate(unique_hits(hits)[:limit], start=1):
        refs = hit.get("refs") or []
        ref = refs[0] if refs else None
        path = hit.get("path")
        line_no = int(hit.get("line") or 1)
        lines.extend([
            f"### {index}. `{path}`:{line_no}",
            "",
            f"- arbre : `{hit.get('tree', '')}` ;",
            f"- ref représentative : `{ref or 'inconnue'}` ;",
            f"- refs associées : {', '.join(f'`{item}`' for item in refs[:20]) or 'aucune'}.",
            "",
        ])
        file_lines = git_show(ref, path) if ref and path else None
        if file_lines is None:
            lines.extend(["Contexte non récupérable depuis cette ref.", ""])
            continue
        start = max(0, line_no - 26)
        end = min(len(file_lines), line_no + 25)
        lines.append("```text")
        for row in range(start, end):
            marker = ">" if row + 1 == line_no else " "
            lines.append(f"{marker}{row + 1:5d} | {file_lines[row]}")
        lines.extend(["```", ""])
    if len(unique_hits(hits)) > limit:
        lines.append(f"Contexte limité aux {limit} premiers hits uniques.")
        lines.append("")
    return lines


def main() -> None:
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    classified = audit.get("classifiedContentHits", {})
    source_hits = unique_hits(classified.get("product_source", []))
    test_hits = unique_hits(classified.get("tests", []))
    docs_hits = unique_hits(classified.get("docs_or_metadata", []))
    commit_hits = audit.get("commitMessageHits", [])
    history_hits = audit.get("historyPatchHits", [])

    if source_hits:
        status = "manual-source-review-required"
        conclusion = (
            "Des hits de code produit existent, mais aucun n’est admis automatiquement. "
            "Une revue ligne par ligne doit prouver identité, état, règles et consommateur."
        )
        next_step = "Revoir les contextes de code produit ci-joints et qualifier ou rejeter chaque candidat."
    elif test_hits or docs_hits or commit_hits or history_hits:
        status = "trace-only-contract-reconstruction-required"
        conclusion = (
            "Seules des traces de tests, documentation, scripts, métadonnées ou historique sont retrouvées. "
            "Elles ne prouvent pas une implémentation produit récupérable."
        )
        next_step = (
            "Extraire uniquement les obligations comportementales explicitement démontrées par ces traces, "
            "puis laisser tous les champs non prouvés à l’état inconnu."
        )
    else:
        status = "no-durable-evidence-found"
        conclusion = (
            "Aucune preuve durable correspondant aux termes recherchés n’est retrouvée. "
            "Le nom de la feuille de route ne définit aucun comportement."
        )
        next_step = (
            "Chercher des descriptions fonctionnelles adjacentes du Lot 9 sans supposer qu’elles désignent joint_channels."
        )

    contract = {
        key: {
            "label": label,
            "status": "unproven",
            "evidence": [],
            "admittedValue": None,
        }
        for key, label in CONTRACT_FIELDS
    }

    status_report = {
        "version": 1,
        "auditGeneratedAt": audit.get("generatedAt"),
        "status": status,
        "historicalImplementationAdmitted": False,
        "historicalContractAdmitted": False,
        "counts": {
            "productSourceHits": len(source_hits),
            "testHits": len(test_hits),
            "docsOrMetadataHits": len(docs_hits),
            "commitMessageHits": len(commit_hits),
            "historyPatchHits": len(history_hits),
        },
        "conclusion": conclusion,
        "nextStep": next_step,
        "contractFields": contract,
        "guardrails": [
            "No semantics inferred from the name joint_channels.",
            "No product source admitted by automated matching alone.",
            "No hidden ranking, priority or channel fusion may be invented.",
            "Unknown fields remain explicitly unproven.",
            "Lot 9B contracts and official performance qualification remain frozen unless a regression is demonstrated.",
            "The 76-entry counter remains unchanged.",
        ],
    }
    STATUS_JSON.write_text(
        json.dumps(status_report, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    md = [
        "# Lot 9C `joint_channels` — statut du contrat après audit",
        "",
        f"Statut automatisé : **{status}**.",
        "",
        "## Conclusion",
        "",
        conclusion,
        "",
        "Aucune implémentation historique ni aucun contrat historique n’est admis à ce stade.",
        "",
        "## Compteurs de preuves",
        "",
        f"- code produit : **{len(source_hits)}** ;",
        f"- tests : **{len(test_hits)}** ;",
        f"- documentation/scripts/métadonnées : **{len(docs_hits)}** ;",
        f"- messages de commit : **{len(commit_hits)}** ;",
        f"- patches historiques : **{len(history_hits)}**.",
        "",
        "## Grille du contrat",
        "",
        "Tous les champs restent **non prouvés** tant qu’une source précise ne démontre pas leur valeur.",
        "",
        "| Champ | Question à résoudre | Statut |",
        "|---|---|---|",
    ]
    for key, label in CONTRACT_FIELDS:
        md.append(f"| `{key}` | {label} | non prouvé |")
    md.extend([
        "",
        "## Garde-fous",
        "",
        "- ne rien déduire du seul nom `joint_channels` ;",
        "- ne pas admettre une source produit sur simple correspondance textuelle ;",
        "- ne pas inventer fusion, priorité ou classement caché ;",
        "- laisser les champs inconnus explicitement non prouvés ;",
        "- préserver les contrats et la qualification officielle 9B ;",
        "- ne pas incrémenter le compteur des 76.",
        "",
        "## Prochaine étape",
        "",
        next_step,
        "",
        "Les extraits complets utiles sont conservés dans `docs/recovery/lot9c-joint-channels-evidence-context.md`.",
    ])
    STATUS_MD.write_text("\n".join(md) + "\n", encoding="utf-8")

    context = [
        "# Lot 9C `joint_channels` — contextes des preuves retrouvées",
        "",
        "Ces extraits sont des éléments de revue, pas des contrats admis.",
        "",
    ]
    context += context_blocks(source_hits, "Code produit")
    context += context_blocks(test_hits, "Tests")
    context += context_blocks(docs_hits, "Documentation, scripts et métadonnées")
    CONTEXT_MD.write_text("\n".join(context) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
