"""Sealed, hand-labelled symbolic benchmark. No ARC3 run or training claim."""
from __future__ import annotations
import copy
import random
from catalog import OPERATIONS

# Each pair has different phrasing. Labels are evaluator-only; they never enter
# the model's state, memory episode or question. These are intent/routing cases.
SITUATIONS = [
 ("Plusieurs entrées désignent peut-être la même interaction. Il faut établir ce qui est réellement distinct.", "Avant toute expérience, recenser les mécanismes actionnables sans compter deux fois leurs alias."),
 ("Deux trajets arrivent à la même case, mais un troisième consomme une ressource. Il faut réduire les doublons sans perdre cette différence.", "La recherche grandit à cause de chemins qui laissent exactement le même état. Les phases différentes doivent rester séparées."),
 ("L'ouverture est nécessaire mais ses conditions de fonctionnement ne sont pas établies. Déterminer ce qu'il faut vérifier avant de la tenter.", "On suppose ce mécanisme indispensable. Certaines de ses exigences restent inconnues : quelle analyse faire d'abord ?"),
 ("Ce mécanisme fonctionne. Nous voulons connaître les nouvelles possibilités offertes par son résultat.", "Après cette transformation, quelles actions deviennent accessibles grâce à l'état produit ?"),
 ("Deux mécanismes ont changé la même propriété. L'observation ne permet pas encore de savoir lequel a causé le changement.", "Des conséquences identiques pourraient provenir de causes différentes. Conserver et départager ces explications."),
 ("La règle prévue a réussi hier et échoue aujourd'hui. Chercher les observations qui réfutent sa portée supposée.", "Nous avons une prédiction d'effet ; comparer ses échecs et les contextes où elle ne s'applique pas."),
 ("Plusieurs zones restent inexplorées ; une seule est accessible et liée à une question utile pour le but.", "Choisir un lieu encore non visité qui permettrait de progresser dans l'exploration utile."),
 ("L'opération voulue exige un état absent. Chercher les opérations pouvant produire cet état en amont.", "Nous savons ce qu'il faut effectuer ensuite, mais il faut retrouver ce qui rend cette opération possible."),
 ("Nous disposons de tous les plans possibles. Quelles étapes figurent dans chacun de ces plans ?", "Identifier les passages inévitables dans l'ensemble complet des solutions candidates."),
 ("Les contributions intermédiaires sont nombreuses. Identifier celles qui représentent directement l'achèvement du but.", "Retrouver la destination finale déclarée, plutôt qu'une simple étape préparatoire."),
 ("Il faut établir les liens d'activation entre mécanismes, et trouver ceux qui en rendent d'autres utilisables.", "Quels changements servent de prérequis à d'autres changements du système ?"),
 ("Une opération est bloquée et sa préparation dépend d'autres mécanismes. Retrouver les questions non résolues dans cette chaîne.", "Suivre les dépendances d'un blocage jusqu'aux faits manquants qui l'expliquent."),
 ("Nous avons quelques essais de cette interaction. Délimiter où et comment son résultat a été observé, sans inventer sa portée totale.", "Quelles valeurs et régions l'effet de cette interaction peut-il couvrir d'après les mesures disponibles ?"),
 ("Plusieurs opérations sont possibles en apparence. Ne conserver que celles satisfaisant les conditions connues et la préservation des ressources.", "Filtrer les choix par une contrainte donnée avant de proposer une exécution."),
 ("Le but final reste hors de portée, mais une contribution préparatoire utile est réalisable maintenant.", "Il faut avancer vers le prochain sous-but dont les conditions sont déjà satisfaites."),
 ("Certaines configurations rendent toute progression impossible. Rechercher uniquement les blocages globaux réellement prouvés.", "Distinguer une impasse globale établie d'un simple manque local d'information."),
 ("L'état actuel doit être changé pour reprendre la progression. Examiner une restauration ou une remise en ordre autorisée.", "La poursuite est bloquée : quelles possibilités de réorganisation ou de remise à zéro respectent les conditions ?"),
 ("Une interaction pertinente n'a encore jamais été essayée. Préparer une expérience pour apprendre son fonctionnement.", "Le mécanisme est inconnu ; une exploration ciblée de sa commande pourrait apporter une nouvelle règle."),
 ("La suite de coups est déjà démontrée et toutes ses contraintes ont été vérifiées. Il reste à dérouler ce préfixe.", "Il n'y a plus de décision sémantique à prendre dans cette séquence déjà prouvée obligatoire."),
 ("Plusieurs objets n'ont aucun rôle expliqué. Conserver une hypothèse d'utilité pour chacun d'eux.", "Quels éléments matériels pourraient encore avoir une fonction que nous ignorons ?"),
 ("Des emplacements restent sans fonction comprise. Ne pas les déclarer décoratifs avant investigation.", "Pour les régions inexpliquées, maintenir des questions sur leur rôle possible."),
 ("Des activations ont modifié des zones éloignées. Retrouver les liens observés entre commande et régions distantes.", "Quelles zones réagissent à une intervention qui a lieu ailleurs sur la carte ?"),
 ("Une entité se déplace seule selon un cycle mesuré. Prédire sa prochaine configuration à la phase courante.", "Avant de bouger, calculer la prochaine réaction autonome à partir de la dynamique connue."),
 ("L'action directe viole une contrainte. Retrouver une autre route produisant le même résultat complet sans cette violation.", "La destination reste la même, mais le passage direct est interdit. Rechercher une solution de contournement compatible."),
]


def routing_cases():
    result = []
    keys = list(OPERATIONS)
    for i, variants in enumerate(SITUATIONS):
        target = keys[i]
        for j, context in enumerate(variants):
            # Fixed curated alternatives, randomized presentation. No target position signal.
            candidates = [target, keys[(i + 5) % 24], keys[(i + 13) % 24]]
            random.Random(1040 + i * 13 + j).shuffle(candidates)
            result.append({"id": f"route-{i+1:02}-{j}", "kind": "semantic_routing",
                           "context": context, "candidates": candidates, "expected": target})
    for i in range(12):
        key = keys[i * 2]
        result.append({"id": f"forced-{i:02}", "kind": "formal_unique",
                       "context": "Une seule transition satisfait le contrat courant.",
                       "candidates": [key], "expected": key})
    return result


def symbolic_state():
    post = {"position": "Z", "token": 1, "phase": 0, "mode": "normal"}
    return {
      "focus": "B", "facts": {"free": True, "key": False, "token": 1}, "preserve": {"token": 1},
      "compositions": [
       {"id": "A", "kind": "acquire", "requires": {"free": True}, "effect": {"key": True}, "observed": True},
       {"id": "A_alias", "kind": "acquire", "requires": {"free": True}, "effect": {"key": True}, "observed": True},
       {"id": "B", "kind": "open", "requires": {"key": True, "power": True}, "effect": {"access": True},
        "depends_on": ["A", "D"], "observed": False, "open_question": "power"},
       {"id": "D", "kind": "energize", "requires": {"cause_U": True}, "effect": {"power": True}, "observed": True},
       {"id": "G", "kind": "reach", "requires": {"access": True}, "effect": {"goal": True}, "observed": True}],
      "observations": [{"id": "o1", "composition": "B", "after": {"access": True}, "phase": 0},
                       {"id": "o2", "composition": "B", "after": {"access": False}, "phase": 1}],
      "paths": [
       {"id": "p1", "post_state": post, "post_state_complete": True, "constraints_verified": True},
       {"id": "p2", "post_state": copy.deepcopy(post), "post_state_complete": True, "constraints_verified": True},
       {"id": "p3", "post_state": {**post, "token": 0}, "post_state_complete": True, "constraints_verified": True},
       {"id": "direct", "post_state": copy.deepcopy(post), "post_state_complete": True, "constraints_verified": False}],
      "desired_post_state": copy.deepcopy(post),
      "alternatives": [["A", "B", "G"], ["A", "D", "B", "G"]], "alternatives_complete": True,
      "goals": [{"id": "mid", "composition": "A", "requires": {"free": True}, "terminal": False},
                {"id": "final", "composition": "G", "terminal": True}],
      "frontiers": [{"id": "F_good", "reachable": True, "visited": False, "open_goal_evidence": "g1"},
                    {"id": "F_near", "reachable": True, "visited": False}],
      "deadlocks": [{"id": "D_proven", "scope": "global", "proof": "finite-domain-exhausted"},
                    {"id": "D_guess", "scope": "global"}, {"id": "D_local", "scope": "local", "proof": "p"}],
      "recovery": [{"id": "rearrange", "authorized": True, "preserve_verified": True},
                   {"id": "reset", "authorized": True, "preserve_verified": False}],
      "forced": [{"action": "RIGHT", "proof": "f1", "constraints_verified": True},
                 {"action": "UP", "proof": "f2", "constraints_verified": True}],
      "entities": [{"id": "U1", "utility": "unknown", "question": "role?"},
                   {"id": "patrol", "autonomous": True, "cycle": ["x0", "x1", "x2"], "phase": 1, "cycle_proof": "o3"}],
      "spaces": [{"id": "S1", "utility": "unknown", "question": "acceptor?"}],
      "remote_effects": [{"control": "K", "target": "R", "observation": "o4"}, {"control": "L", "target": "S"}],
    }


# Manually specified results, separate from the implementation and model inputs.
EXPECTED_VALUES = {
 "OP01": [["A", "A_alias"], ["B"], ["D"], ["G"]],
 "OP02": [["p1", "p2"], ["p3"], ["direct"]],
 "OP03": {"composition": "B", "preconditions": {"key": False, "power": "unknown"}},
 "OP04": {"composition": "B", "opens": ["G"]}, "OP05": [["A", "A_alias"]],
 "OP06": [{"id": "o2", "composition": "B", "after": {"access": False}, "phase": 1}],
 "OP07": [{"id": "F_good", "reachable": True, "visited": False, "open_goal_evidence": "g1"}],
 "OP08": ["A", "A_alias", "D"], "OP09": ["A", "B", "G"], "OP10": ["G"],
 "OP11": {"A": ["B"], "A_alias": ["B"], "B": ["G"], "D": ["B"]},
 "OP12": {"unknowns": {"B": ["power"], "D": ["cause_U"]}, "visited": ["A", "B", "D"]},
 "OP13": {"observed_effects": [{"access": True}, {"access": False}], "unobserved_extent": "unknown"},
 "OP14": ["A", "A_alias"], "OP15": ["mid"],
 "OP16": [{"id": "D_proven", "scope": "global", "proof": "finite-domain-exhausted"}],
 "OP17": [{"id": "rearrange", "authorized": True, "preserve_verified": True}],
 "OP18": ["B"], "OP19": ["RIGHT", "UP"],
 "OP20": [{"entity": "U1", "status": "utility_hypothesis", "question": "role?"}],
 "OP21": [{"space": "S1", "status": "utility_hypothesis", "question": "acceptor?"}],
 "OP22": [{"control": "K", "target": "R", "observation": "o4"}],
 "OP23": [{"entity": "patrol", "next": "x2", "evidence": "o3"}], "OP24": ["p1", "p2"],
}


def action_cases():
    # Outcome guards are evaluated after selection, not shown as target labels.
    rows = [
      ("probe", "OP03", ["OP03", "OP19", "OP17"],
       "La condition power n'est pas connue. Il faut examiner les exigences de l'ouverture avant de lancer un test.",
       {"path": ["value", "preconditions", "power"], "equals": "unknown"},
       {"type": "PROBE", "target": "power", "expected_observation": "boolean"}),
      ("detour", "OP24", ["OP24", "OP02", "OP19"],
       "Le trajet direct viole une condition. Trouver un autre trajet au même état final complet, en respectant les contraintes.",
       {"path": ["value"], "contains": "p1"}, {"type": "FOLLOW_PATH", "target": "p1"}),
      ("cycle", "OP23", ["OP23", "OP06", "OP22"],
       "Une patrouille suit un cycle prouvé. Simuler sa prochaine position avant d'autoriser l'attente contrôlée.",
       {"path": ["value", 0, "next"], "equals": "x2"}, {"type": "WAIT", "ticks": 1}),
      ("recovery", "OP17", ["OP17", "OP18", "OP19"],
       "Le blocage est établi ; comparer les réorganisations et remises à zéro qui ont une autorisation et préservent la contrainte.",
       {"path": ["value", 0, "id"], "equals": "rearrange"}, {"type": "REARRANGE", "target": "rearrange"}),
    ]
    cases = []
    for name, expected, choices, context, guard, action in rows:
        for repeat in range(3):
            candidates = list(choices)
            random.Random(820 + repeat).shuffle(candidates)
            cases.append({"id": f"action-{name}-{repeat}", "context": context, "candidates": candidates,
                          "expected": expected, "current_key": OPERATIONS["OP01"]["authority_refs"][0],
                          "outcome_guard": guard, "action": action,
                          "safety": {"authorized": True, "evidence": [f"synthetic-{name}-contract"]}})
    return cases
