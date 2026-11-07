"""Experimental operation catalogue; references do not claim V5 implementation."""
from __future__ import annotations
import hashlib
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
TREE = REPO / "docs/reasoning-tree/reasoning-tree_v-1.5.txt"
RECONCILIATION = REPO / "docs/reasoning-tree/reasoning-tree_v-1.5/reconciliation_v-1.5.json"

# OP identities belong to this prototype. authority_refs retain the exact normative
# identities, as related clauses, without pretending to implement the whole tree.
ROWS = [
 ("inventorier", "Lister les compositions disponibles distinctes", "frontier.enumerate.supported.stable.stops.passages"),
 ("equivalence", "Regrouper les parcours seulement si leur état causal final complet est équivalent", "solving.preserve.equivalent.alternatives.completeness.status"),
 ("preconditions", "Relever les préconditions et contraintes encore inconnues d'une composition nécessaire", "frontier.check.relational.operational.preconditions"),
 ("ouvertures", "Lister les possibilités qu'une composition rend accessibles", "solving.goal.backward_usefulness"),
 ("ambiguites", "Distinguer les mécanismes possibles lorsque leurs effets observés sont semblables", "frontier.changes.remain.causally.ambiguous"),
 ("exceptions", "Rechercher les contre-exemples et exceptions à un effet supposé", "continuation.bind.expected.effect.explicit.falsifier"),
 ("frontiere", "Rejoindre un point d'exploration accessible et utile à un objectif ouvert", "assimilation.prioritize.unvisited.goal.bearing.group"),
 ("predecesseurs", "Chercher les compositions qui peuvent satisfaire les préconditions d'une composition voulue", "frontier.constraints.backward_dependency_expansion"),
 ("obligatoires", "Identifier les compositions communes à toutes les alternatives complètes", "frontier.retain.temporary.service.obligation"),
 ("finaux", "Identifier les compositions correspondant aux objectifs terminaux déclarés", "continuation.why.goal_derivation_chain"),
 ("deblocages", "Identifier les compositions qui débloquent d'autres compositions", "solving.goal.backward_usefulness"),
 ("inconnues_blocage", "Identifier les inconnues dans les dépendances d'une composition bloquée", "frontier.keep.dependent.plans.blocked"),
 ("portee_effet", "Délimiter la portée observée et les limites inconnues de l'effet d'une composition", "frontier.plan.effect.space.controller.peer"),
 ("contraintes", "Filtrer les compositions par les contraintes et préconditions connues", "continuation.require.all.intermediate.constraints.decidable"),
 ("intermediaire", "Choisir les contributions intermédiaires actuellement réalisables vers l'objectif", "solving.constraints.backward_dependency_expansion"),
 ("deadlocks", "Lister les blocages globaux prouvés, en conservant les inconnues", "mechanics.push_only_logistics.dynamic_deadlock.compute"),
 ("recovery", "Examiner les réagencements et resets explicitement autorisés", "continuation.success.failure.reset.unavailable.input"),
 ("explorer", "Lister les compositions inconnues dont un test ferait progresser la connaissance", "frontier.expose.relevant.unexplored.outgoing.edit"),
 ("forces", "Dérouler un préfixe de coups explicitement prouvés obligatoires", "continuation.require.selection.cycle.unknown.edit"),
 ("utilite_objets", "Conserver des hypothèses d'utilité pour les objets encore inexpliqués", "frontier.experiment.mechanism_or_usefulness"),
 ("utilite_espaces", "Conserver des hypothèses d'utilité pour les espaces encore inexpliqués", "assimilation.supposition.typed_negative_space"),
 ("distance", "Lister les espaces reliés par des effets à distance observés", "principle.color_indexed_homologous_remote_reconfiguration"),
 ("autonomes", "Simuler les entités selon leurs cycles ou transitions explicitement observés", "assimilation.supposition.autonomous_route_intervention"),
 ("detours", "Chercher un détour au même résultat causal qui respecte les contraintes", "solving.reactive_graph_navigation.temporal_detour"),
 ("choisir_cible", "Choisir une composition à atteindre, maintenir ou explorer", "continuation.why.goal_derivation_chain"),
 ("acces_admissible", "Chercher les accès admissibles à une composition cible", "continuation.require.all.intermediate.constraints.decidable"),
 ("permutations_preservantes", "Chercher les permutations préservant les compositions protégées", "frontier.slot_permutation_effect"),
 ("realiser_intermediaire", "Engager un ensemble d'actions validé vers une composition intermédiaire", "continuation.execute_observation_prefix"),
 ("comparer_obtenu_attendu", "Comparer la composition obtenue et ses effets aux attentes", "continuation.compare.joint_state_and_event_sequence"),
 ("reviser_composition", "Réviser les connaissances sur une composition à partir des observations", "continuation.reconciliation.exact_before_after_cause"),
 ("reexaminer_objectif", "Réexaminer la pertinence de la composition cible après un changement", "continuation.why.goal_derivation_chain"),
]
OPERATIONS = {f"OP{i:02}": {"key": f"OP{i:02}", "name": name, "description": desc,
                           "authority_refs": [ref], "scope": "symbolic-prototype"}
              for i, (name, desc, ref) in enumerate(ROWS, 1)}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def parse_tree():
    nodes = []
    for line_no, line in enumerate(TREE.read_text(encoding="utf-8").splitlines(), 1):
        match = re.match(r"^\s*(\S+)\s+\[([^\]]+)\]\s*(.*)", line)
        if match:
            nodes.append({"address": match[1], "key": match[2], "text": match[3], "line": line_no})
    declared = json.loads(RECONCILIATION.read_text(encoding="utf-8"))["node_count"]
    if len(nodes) != declared or len({n["key"] for n in nodes}) != declared:
        raise RuntimeError("Normative tree identities differ from the declared inventory")
    names = {n["key"] for n in nodes}
    for op in OPERATIONS.values():
        if not set(op["authority_refs"]) <= names:
            raise RuntimeError("Operation refers to a missing normative identity")
    return nodes
