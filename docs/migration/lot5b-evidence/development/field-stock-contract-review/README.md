# Revue du stock et de l’arrêt de préservation

## Résultat établi

Le refus de `common-stock-03` reproduit le contrat source. Il ne vient pas
d’une omission de `FieldStock` ou de `bindPreservation` dans le port natif.
L’essai historique garde son statut `failed` et sa raison
`frontier_preservation_conflict`.

Le parcours a consommé 16 retours, dont deux retours sélectionnés du stock :
une fusion à la révision 15 puis un déplacement à la révision 16. À la
révision 17, le journal du propriétaire s’arrête sur
`preservation_obligations`. Il ne contient pas de nouvel appel de proposition
du stock à cette révision.

Les deux candidats refusés viennent de l’entrée antérieure
`window_constraints / field_service_composition`. Ce sont des
`nested_control_experiment`, de même identifiant
`C_nested_a38478fba71c14f7904e`, qui proposent `ACTION6(30,24)` sans
`preservation_changes`.

L’obligation `C_material_f25ed8cd5464710a` demande au moins une occurrence
du matériau 4 en dehors des éléments d’interface et réserve sa révision à
`ACTION6`. La condition est encore satisfaite : le refus porte sur la
question non justifiée, pas sur une perte déjà observée du matériau.

## Cause source

Le déplacement a placé le matériau sur le bord du premier réceptacle.
Son rectangle contient maintenant les valeurs `[0,4,6]` ; il ne satisfait
plus la condition de deux valeurs de `geometric_observer.framed_patterns`.
Le second réceptacle contient `[0,6]` et reste le seul candidat compact,
de centre `[30,24]`.

`NestedControlAccess.nested_question` construit la question courante et ne
déclare pas de révision de l’obligation. `FieldServiceConstraint.service_propose`
se fonde sur les actions publiquement disponibles. Le second passage du
routeur retire `ACTION6` des candidats d’input, mais conserve
`observation.available_action_refs`. Le même fournisseur peut donc proposer
le même point. `common_preservation.bind` original rejette les deux candidats.

## Preuve exécutée et portée

Le reçu voisin `../common-stock-03/original-preservation-diagnostic.json`
épingle le rapport, le journal, le pilote, le manifeste et la configuration.
Il rejoue les 16 transitions publiques dans la mémoire de service originale
(quatre événements de contrôle imbriqué), puis produit le même candidat avec
une liste d’inputs vide. Les deux appels originaux de préservation reproduisent
exactement leurs résultats natifs capturés. Les entrées complètes restent dans
`protectionCalls[-2:]` du rapport ; le reçu donne leurs empreintes.

Cette preuve concerne le fournisseur de service et la préservation. Elle ne
rejoue pas l’intégralité de `StrategyRouter`, ne termine pas le tableau stock,
ne constitue pas une réussite dans un jeu et ne mesure aucun coût.

## Éléments conservés dans ce répertoire

- `field-stock-tests-initial.log` : les 13 tests du composant stock ont passé,
  sous verrou partagé, après libération du créneau fonctionnel.
- `owner-cost-tools-syntax.json` : les quatre outils de coût ont passé leurs
  contrôles de syntaxe ; aucune capture ni mesure de coût n’a été exécutée.
- `copied-evidence.json` : empreintes des copies et du contrat source actualisé
  `../../addressed-source-contract.md`.

## Vérification finale préparée

`scripts/review-addressed-preservation-original.py COMMON_DIR` écrit un reçu
exclusif `original-preservation-comparison.json`. Il reconstitue ses propres
questions de service depuis les retours publics, compare les deux appels de
préservation exacts et vérifie l’inventaire original de 1 786 fichiers avant
et après l’exécution. Chaque module agent effectivement importé est épinglé.

Un statut `passed` n’est admis que pour le nouveau contrat pré-déclaré
`stock-preservation-refusal`, dont le plan est épinglé par le rapport commun
et dont `publicPath.complete` reste faux. Un ancien rapport commun en échec
peut seulement recevoir une confirmation diagnostique, sans devenir passé.

Ce nouveau relecteur n’a pas été exécuté au moment de la préparation de cette
note. Son exécution attend le gel final intégré 4C et le créneau fonctionnel
autorisé. Aucun code de production, priorité, obligation ou retour public
n’a été changé pour contourner le refus.
