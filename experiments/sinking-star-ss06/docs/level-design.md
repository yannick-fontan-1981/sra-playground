# Conception et validation des huit salles

La progression enseigne une combinaison de rôles et non une nouvelle puissance cachée du Marchand : **les deux héros peuvent déclencher les miroirs**. La différence est la force de poussée. Le partenaire est aussi un poids, un occupant qui peut bloquer un trajet et une deuxième destination à atteindre.

Le tutoriel ouvre huit acquis : marcher, sélectionner, pousser une pièce avec le Marchand, pousser une file avec le Guerrier, créer un appui, refléter, changer une porte et occuper les deux cibles. Les coches sont déduites des pixels publics et actions. Elles sont toutes atteintes par le témoin réel du niveau 1.

| Niveau | Actions du témoin | Décision centrale |
|---|---:|---|
| 1 | 44 | Immobiliser une caisse sur le bouton, créer le pont en file, actionner la presse, puis faire traverser chacun. |
| 2 | 35 | Placer les miroirs et libérer la caisse qui masque le rayon sans abandonner les boutons croisés. |
| 3 | 119 | Fabriquer puis réutiliser l’interrupteur à distance pour deux traversées successives. |
| 4 | 35 | Alterner la poussée d’une longue file et le reflet de sa caisse de tête ; récupérer ensuite le miroir. |
| 5 | 37 | Faire disparaître un miroir, accéder au bon côté de la caisse grâce à un appui et rétablir son bouton. |
| 6 | 37 | Deux positions du miroir provoquent deux combats ; les deux caisses servent ensuite à créer le passage. |
| 7 | 68 | Utiliser un nouvel appui pour se tenir derrière le miroir ; commander puis relâcher la presse. |
| 8 | 43 | Préparer les deux salles séparées et réunir caisse et héros sur les trois boutons avant le reflet commun. |

Le nombre d’actions n’est pas une mesure de difficulté et les témoins ne sont pas annoncés minimaux.

## Couverture effective

418 actions, 19 changements de personnage, 23 poussées de file, 32 mouvements de miroir, 29 activations de reflet, 18 nouveaux appuis et 8 monstres éliminés. Cinq poussées effectives de presse ; L5 ajoute une destruction de miroir par écrasement. L3 utilise ses rideaux sans pousser d’occupant dans le témoin.

Les niveaux 2 et 8 réalisent un transport simultané des deux héros. L6 montre deux vagues de combat et vérifie aussi deux routes de défaite : coup de monstre et reflet dans l’eau.

## Nécessité et limites

Les vérifications exhaustives conservées dans `reference/mechanism-checks.json` établissent :
- L2 sans déplacement de miroir : aucune solution, 2 608 états.
- L2 sans changement de personnage : aucune solution, 156 états.
- L7 sans création d’appui : aucune solution, 2 520 états.
- L7 sans poussée de file : aucune solution, 2 520 états.

D’autres recherches, arrêtées à 50 000 états, sont indéterminées. On ne prétend donc pas que chaque mécanisme observé est indispensable à toutes les solutions. Une solution alternative légale ne constitue pas une erreur de moteur.

Le validateur rejoue les huit salles, compare chaque image et durée de la session avec le moteur, vérifie les identités et l’absence de chevauchement, et contrôle la victoire après les deux cibles. Le contrôle HTML rejoue la même campagne dans l’interface, y compris la sélection, les transitions, Undo pendant les animations et l’apparition différée des panneaux terminaux.

