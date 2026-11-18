# Conception et validation des huit salles

La progression enseigne une combinaison de rôles et non une nouvelle puissance cachée du Marchand : **les deux héros peuvent déclencher les miroirs**. La différence est la force de poussée. Le partenaire est aussi un poids, un occupant qui peut bloquer un trajet et une deuxième destination à atteindre.

Le tutoriel ouvre huit acquis : marcher, sélectionner, pousser une pièce avec le Marchand, pousser une file avec le Guerrier, créer un appui, refléter, changer une porte et occuper les deux cibles. Les coches sont déduites des pixels publics et actions. Elles sont toutes atteintes par le témoin réel du niveau 1.

| Niveau | Actions du témoin | Décision centrale |
|---|---:|---|
| 1 | 35 | Le Marchand maintient le circuit avec une caisse ; la presse décale une caisse et le miroir ; le Guerrier construit les deux appuis en poussant une file encastrée. |
| 2 | 35 | Placer les miroirs et libérer la caisse qui masque le rayon sans abandonner les boutons croisés. |
| 3 | 119 | Fabriquer puis réutiliser l’interrupteur à distance pour deux traversées successives. |
| 4 | 35 | Alterner la poussée d’une longue file et le reflet de sa caisse de tête ; récupérer ensuite le miroir. |
| 5 | 41 | Faire écraser la caisse qui masque le reflet, rétablir le bouton, puis refléter les héros sur l’appui proche pour traverser la presse ouverte. |
| 6 | 37 | Deux positions du miroir provoquent deux combats ; les deux caisses servent ensuite à créer le passage. |
| 7 | 68 | Utiliser un nouvel appui pour se tenir derrière le miroir ; commander puis relâcher la presse. |
| 8 | 43 | Préparer les deux salles séparées et réunir caisse et héros sur les trois boutons avant le reflet commun. |

Le nombre d’actions n’est pas une mesure de difficulté et les témoins ne sont pas annoncés minimaux.

## Couverture effective

413 actions, 19 changements de personnage, 23 poussées de file, 33 mouvements de miroir, 29 activations de reflet, 17 nouveaux appuis et 8 monstres éliminés. Cinq poussées effectives de presse ; L5 ajoute une destruction de caisse par écrasement. L3 utilise ses rideaux sans pousser d’occupant dans le témoin.

Les niveaux 2 et 8 réalisent un transport simultané des deux héros. L6 montre deux vagues de combat et vérifie aussi deux routes de défaite : coup de monstre et reflet dans l’eau.

## Nécessité et limites

Les vérifications exhaustives conservées dans `reference/mechanism-checks.json` établissent :
- L2 sans déplacement de miroir : aucune solution, 2 608 états.
- L2 sans changement de personnage : aucune solution, 156 états.
- L7 sans création d’appui : aucune solution, 2 520 états.
- L7 sans poussée de file : aucune solution, 2 520 états.

D’autres recherches, arrêtées à 50 000 états, sont indéterminées. On ne prétend donc pas que chaque mécanisme observé est indispensable à toutes les solutions. Une solution alternative légale ne constitue pas une erreur de moteur.

Le validateur rejoue les huit salles, compare chaque image et durée de la session avec le moteur, vérifie les identités et l’absence de chevauchement, et contrôle la victoire après les deux cibles. Le contrôle HTML rejoue la même campagne dans l’interface, y compris la sélection, les transitions, Undo pendant les animations et l’apparition différée des panneaux terminaux.


## Révision v2 : corrections des niveaux 1 et 5

Le contournement de l’ancien L1 a été reproduit : le Marchand pouvait construire un passage via l’appui initial et déplacer verticalement la caisse de presse. Un témoin de 59 actions terminait sans poussée en file ni intervention de la presse, en laissant les deux caisses du chenal intactes.

Le nouveau L1 supprime ces accès alternatifs. Les deux caisses du chenal sont encastrées latéralement ; elles comblent deux cases d’eau. Une troisième caisse maintient le circuit, et la quatrième transmet la poussée de la presse au miroir situé devant elle. Aucun miroir ne commence sur une presse.

Les recherches exhaustives prouvent l’impossibilité sans file (784 états), sans presse (2 668), sans création d’appui (784), sans reflet (5 736), ou en retirant chacune des quatre caisses (8 076 / 2 056 / 2 840 / 5 736). Une revue indépendante a également maintenu chaque caisse immobile et confirmé l’impossibilité. Les huit acquis du tutoriel restent obtenus par le parcours pédagogique de 35 actions.

Au L5, le miroir sur la presse est remplacé par une caisse marron. La destination de reflet de cette caisse est obstruée, afin qu’un simple reflet ne remplace pas le travail de la presse. L’obstacle doit être écrasé puis le circuit rétabli ; les héros sont reflétés sur l’appui proche avant de marcher par la presse ouverte. Une exploration exhaustive sans action de presse échoue après 42 650 états. Le témoin révisé termine en 41 actions.

Les rapports des deux relectures et le contre-exemple v1 figurent dans `reference/level1-independent-review.json`, `reference/level1-necessity.json` et `reference/level5-necessity.json`. `scripts/validate-levels.mjs --mechanisms` recalcule les vérifications de suppression des mécanismes et des quatre caisses.
