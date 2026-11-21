# Les cinq autres L2 de Custom 4

Sur les neuf L2 essayés à froid avec la version fusionnée v31, SIC gagne SS01 en 44 commandes et SS04 en 60. SS09 reste réservé. Cette campagne complète les mesures antérieures sur SS01, SS06, SS07 et SS08. [Résultats antérieurs](bilan-trois-chantiers.md)

## Entrée directe, sans action du L1

Chaque partie démarre directement au L2 avec un agent neuf et zéro niveau accompli. Un nombre en gras indique une victoire officielle. Les autres nombres donnent les commandes réellement jouées avant l’arrêt. Le plafond est de 1 200 commandes avec le budget de temps actif habituel. Un arrêt au temps peut varier de quelques actions ou davantage selon le coût de calcul.

| L2 | Ancien main | Main v31 | V32 | V33 |
| --- | ---: | ---: | ---: | ---: |
| SS02 | 40 | 487 | 471 | 408 |
| SS03 | 100 | 443 | 353 | 386 |
| SS04 | **60** | **60** | **60** | **60** |
| SS05 | 45 | 393 | 314 | 342 |
| SS10 | 534 | 445 | 351 | 413 |

SS04 reproduit les mêmes 60 commandes et images dans les quatre versions. Le moteur y enregistre six échanges et le premier a lieu au coup 4. Sur SS02, SS03 et SS05, le témoin antérieur à la fusion s’arrête faute de proposition à sélectionner. V31 atteint son plafond de temps sur ces trois jeux et sur SS10. La comparaison porte sur les versions complètes.

## Même SIC v31 en jouant réellement le L1 avant le L2

| Jeu | L1 | L2 de la même partie |
| --- | --- | --- |
| SS02 | Victoire en 40 coups | Échec en 417 coups |
| SS03 | Victoire en 47 coups | Victoire en 73 coups |
| SS04 | Victoire en 49 coups | Victoire en 116 coups |
| SS05 | Victoire en 44 coups | Échec en 330 coups |
| SS10 | Échec en 393 coups | L2 non atteint |

Le rejeu reproduit aussi les reprises automatiques du niveau dans les parcours commencés au L1 (SS05 après la commande 12).

## Où se situe le blocage sur SS03

À froid, le moteur enregistre sept tractions, la première au coup 7. SIC visite 42 cases et produit huit dispositions distinctes des pierres. Lorsqu’il joue d’abord le L1, il le gagne en 47 commandes puis gagne le L2 en 73. L’image initiale du L2 est identique. La première commande est la même, puis les choix divergent au coup 2.

Après **20 commandes du départ froid**, SIC obtient exactement l’image observée après **44 commandes du L2 gagnant**. Depuis cette position froide, reprendre les **29 commandes restantes** de la partie gagnante donne une victoire officielle au rejeu. Dans la partie gagnante, chacune de ces 29 commandes avait été choisie par l’exploration des actions publiques. Lors de sa partie autonome à froid, SIC choisit une autre commande dès cette position.

La première prédiction fondée sur une marque de prévisualisation apparaît au coup 85 à froid et au coup 1 après le L1. Les 87 prédictions de ce type à froid et les 11 de la partie gagnante sont toutes enregistrées comme contredites. Cela permet de distinguer la traction effectivement réalisée, les prédictions du solveur et le parcours qui a fait monter le score.

Sur SS02, v31 réalise quatre poussées et visite 19 cases. Sur SS05, il déclenche 119 chants et visite 11 cases. Sur SS10, le guerrier visite 21 cases et le voleur cinq. Le guerrier reste le seul personnage sélectionné dans la partie froide de v31. Aucune destination n’est alors occupée.

## Suite proposée

Prendre SS03 L2 à froid comme test de la capacité à reprendre un plan depuis une disposition déjà atteinte. Sur les traces sources, comparer les situations où un changement matériel est confirmé tandis que sa conséquence prédite échoue. Mesurer si SIC conserve ce changement, cesse de répéter la prédiction réfutée et annonce une conséquence différente qu’il utilise réellement. KEYD et SWCH fournissent déjà des témoins pour cette comparaison. Figer le prochain candidat sur ces critères sources et sur la conservation des 100 L1 avant le retour aux cibles. La partie de SS03 sert à l’évaluation.

## Reproduction

Le moteur est pris sur le commit de main cf6069a1d05b8655a6056d2b25d971427b276a43. Les quatre solveurs proviennent des objets Git de leurs versions figées, y compris le témoin f3b4edc2. Tous les départs directs ont été rejoués image par image dans le moteur public. Un second rejeu contrôle le score, les positions, les phases physiques et les cinq parcours depuis le L1. Pour les échecs à froid, il recherche également une continuation gagnante en six commandes au plus depuis les états réellement visités. Aucune continuation de six commandes ou moins n’a gagné depuis ces états dans les seize échecs à froid. Cette recherche diagnostique est extérieure à SIC et couvre les commandes discrètes disponibles ainsi que la sélection de chaque héros dans le jeu à deux personnages.

Les [commandes et empreintes par partie](autres-l2.json) et le [vérificateur](rejouer-autres-l2.mjs) permettent de reproduire les mesures avec Node 24.

```powershell
node docs/diagnostics/sic-plan-arbitration/rejouer-autres-l2.mjs ../moteur-main docs/diagnostics/sic-plan-arbitration/autres-l2.json
```
