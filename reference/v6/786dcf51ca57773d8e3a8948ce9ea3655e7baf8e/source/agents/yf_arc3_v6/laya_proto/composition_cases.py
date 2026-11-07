"""Hand-labelled evaluation, never used to train Laya or build real-game routes."""
import copy
import random
from catalog import OPERATIONS
from fixtures import SITUATIONS, symbolic_state, EXPECTED_VALUES

NEW_SITUATIONS = [
 ("Plusieurs configurations semblent utiles. Choisir celle à atteindre, à maintenir ou à explorer maintenant.", "Définir quelle composition devient la cible courante, sans encore calculer son trajet."),
 ("La composition cible est choisie. Chercher un accès qui satisfait toutes les conditions du trajet.", "Construire les possibilités d'accès admissibles à la configuration visée."),
 ("Une permutation est nécessaire, tout en gardant intactes les configurations protégées.", "Chercher comment permuter les éléments sans déplacer les autres assemblages à préserver."),
 ("Le groupe de mouvements intermédiaire est validé. Engager sa réalisation vers la composition cible.", "La contribution intermédiaire est prête et autorisée : exécuter son ensemble de mouvements."),
 ("Le groupe est terminé. Comparer la configuration et les effets obtenus avec les attentes.", "Distinguer ce qui a été confirmé, contredit ou reste inconnu dans le résultat observé."),
 ("Une observation nouvelle réfute une propriété de la composition. Mettre à jour sa connaissance avec la preuve.", "Enregistrer les corrections confirmées des contraintes et effets de cette composition."),
 ("La composition cible vient de devenir irréalisable. Réexaminer la poursuite de cet objectif.", "Le contexte a changé : décider si l'objectif de composition reste pertinent.")]


def state():
    s = symbolic_state()
    # Existing fixture semantics remain separate from optional physical structure.
    s.update(observation_revision=1, accesses=[{"id": "route", "target": "B", "constraints_verified": True}],
             permutations=[{"id": "swap", "target": "B", "constraints_verified": True, "preserved_refs": ["A"]}],
             preserve_refs=["A"], bundles=[{"id": "group", "composition_ref": "B", "admitted": True, "actions": ["ACTION1", "ACTION2"]}],
             expected_properties={"orientation": 1, "color": "blue", "door": "open"},
             observed_properties={"orientation": 1, "color": "red"},
             knowledge_updates=[{"composition_ref": "B", "property": "color", "value": "red", "revision": 1, "evidence": "obs1"},
                                {"composition_ref": "B", "property": "door", "value": "open", "revision": 0, "evidence": "old"}],
             objective_assessments=[{"composition_ref": "G", "satisfied": False, "feasible": "unknown", "new_evidence": ["obs1"]}])
    s["compositions"][2].update(candidate_objective=True, feasibility="unknown")
    s["compositions"][2].update(things=["door", "power_source"], properties={"access": "unknown"},
                                relations=["door requires power"], context="synthetic scene", knowledge_status="hypothesized", role="intermediate")
    s["compositions"][4].update(things=["actor", "destination"], properties={"reached": False},
                                relations=["actor in destination"], context="synthetic scene", knowledge_status="hypothesized", role="objective")
    return s


NEW_EXPECTED = {
 "OP25": ["B"], "OP26": ["route"], "OP27": ["swap"], "OP28": ["group"],
 "OP29": {"orientation": {"expected": 1, "observed": 1, "status": "confirmed"},
          "color": {"expected": "blue", "observed": "red", "status": "refuted"},
          "door": {"expected": "open", "observed": None, "status": "unknown"}},
 "OP30": [{"composition_ref": "B", "property": "color", "value": "red", "revision": 1, "evidence": "obs1"}],
 "OP31": [{"composition_ref": "G", "satisfied": False, "feasible": "unknown", "new_evidence": ["obs1"]}]}


def bundle(identity, op, kind="analysis", purpose="Comprendre la composition B pour atteindre G", composition="B"):
    return {"id": identity, "operation_key": op, "composition_ref": composition, "objective_ref": "G",
            "preserve_refs": ["A"], "observation_revision": 1, "kind": kind,
            "actions": [] if kind == "analysis" else ["ACTION1", "ACTION2"], "purpose": purpose,
            "preconditions": {"free": True}, "preservation_evidence": {"A": "synthetic-preservation-proof"},
            "evidence": ["synthetic-case-contract"], "stop_on": ["official_level_boundary", "terminal", "unavailable_action"]}


def cases():
    rows = []
    keys = list(OPERATIONS)
    for index, variants in enumerate(list(SITUATIONS) + NEW_SITUATIONS):
        for variant, question in enumerate(variants):
            ops = [keys[index], keys[(index+5) % 31], keys[(index+13) % 31]]
            random.Random(741+index*11+variant).shuffle(ops)
            bundles = {f"B{j}": bundle(f"B{j}", op) for j, op in enumerate(ops)}
            rows.append({"id": f"operation-{index+1:02}-{variant}", "kind": "composition_routing", "context": question,
                         "bundles": bundles, "candidates": list(bundles), "relevant_compositions": ["B", "G"],
                         "expected_choice": next(k for k, b in bundles.items() if b["operation_key"] == keys[index])})
    scenarios = [
      ("agreement", "Le symbole courant est accordé à la cible. Il reste à entrer dans la région cible en conservant cet accord.",
       [("OP28", "realize", "Rejoindre puis pénétrer la région cible en préservant l'orientation actuelle"),
        ("OP18", "probe", "Rejoindre puis réactiver la station de rotation pour en observer l'effet"),
        ("OP18", "probe", "Explorer une autre région et revenir vers le point de départ")]),
      ("unknown_effect", "L'effet du mécanisme est inconnu et empêche de décider. Un contact contrôlé doit apporter cette information.",
       [("OP18", "probe", "Approcher le mécanisme, entrer en contact et recueillir son effet sur la composition"),
        ("OP28", "realize", "Rejoindre directement la cible en supposant que le mécanisme fonctionne déjà"),
        ("OP17", "realize", "Revenir à la configuration initiale par réinitialisation")]),
      ("preserve", "La caisse sur la plaque maintient le passage ouvert. Atteindre la composition acteur au-delà du passage en conservant la caisse.",
       [("OP28", "realize", "Traverser le passage par un trajet qui laisse la caisse sur la plaque"),
        ("OP28", "realize", "Déplacer la caisse hors de la plaque puis rejoindre le passage"),
        ("OP18", "probe", "Retirer puis replacer la caisse pour mesurer la fermeture du passage")]),
      ("rotation_probe", "La légende et la cible ont la même forme mais des orientations différentes. L'effet de la station reste inconnu.",
       [("OP18", "probe", "Approcher puis toucher la station, comparer ensuite la légende avec son état antérieur"),
        ("OP28", "realize", "Rejoindre la cible sans modifier la configuration symbolique"),
        ("OP28", "realize", "Aller occuper la zone d'affichage de la légende")])]
    for name, question, options in scenarios:
        for repeat in range(3):
            order = list(range(3))
            random.Random(887+repeat).shuffle(order)
            bundles = {}
            for j, index in enumerate(order):
                op, kind, purpose = options[index]
                b = bundle(f"B{j}", op, kind, purpose)
                # One deliberately unpreserved proposal exercises the release guard.
                if name == "preserve" and index != 0:
                    b["preservation_evidence"] = {}
                bundles[b["id"]] = b
            rows.append({"id": name+str(repeat), "kind": "action_set_selection", "context": question,
                         "bundles": bundles, "candidates": list(bundles), "relevant_compositions": ["B", "G"],
                         "expected_choice": "B"+str(order.index(0))})
    return rows
