# Conception et validation des huit salles — HTML v4

Le Marchand pousse une seule pièce ; le Guerrier pousse une file. Les deux peuvent activer les miroirs. Le changement de personnage ne fait pas avancer le monde et les deux destinations doivent être occupées ensemble.

| Niveau | Actions du témoin | Décision centrale |
|---|---:|---|
| 1 | 35 | Maintenir le circuit avec une caisse, déplacer le miroir par une presse distante et construire deux appuis avec la force du Guerrier. |
| 2 | 35 | Préparer les boutons croisés et faire partir les deux héros ensemble. |
| 3 | 119 | Construire puis réutiliser un interrupteur à distance pour franchir deux rideaux de polarités opposées. |
| 4 | 35 | Pousser une longue file et refléter les caisses de tête pour construire le ponton. |
| 5 | 43 | Ancien niveau 8 : préparer deux ateliers, actionner deux presses et réunir caisse et héros sur trois boutons. |
| 6 | 37 | Régler deux alignements de monstres puis construire le passage final avec deux caisses. |
| 7 | 68 | Construire un contournement pour pousser le miroir par son dos, puis utiliser la presse et le combat. |
| 8 | 111 | Préparer deux horloges avant de quitter les ateliers, ancrer le pont vert et alterner les traversées violettes pour les deux héros. |

Les témoins prouvent la solvabilité. Ils ne sont pas annoncés minimaux ; leur longueur ne mesure pas directement la difficulté.

## Nouveau niveau 8 : Les deux horloges

Le niveau adapte Heroes and Mirrors 20 (`mirror_clocks`). Deux ateliers préparent des effets différents. Le vert doit s’activer au premier reflet et rester actif ; le violet doit rester éteint lors de ce premier reflet puis alterner. Le pont d’entrée est de polarité inverse : il disparaît quand la grande passerelle apparaît.

Dans SS06, le Marchand place le miroir gauche. Le Guerrier libère une file miroir + caisse dans un passage étroit et aligne sa caisse. Les deux héros doivent rejoindre les refuges avant l’activation. Le premier reflet déplace les caisses et déclenche deux presses qui décalent les miroirs : le miroir vert quitte l’axe de sa caisse, tandis que le miroir violet établit son va-et-vient. Ces déplacements remplacent le dédoublement et le bloqueur de la source par des mécanismes déjà visibles dans SS06.

La traversée comprend quinze portes-plateformes : onze liées au vert, dont l’entrée inverse, et quatre au violet, de polarités alternées. Les couches superposées de la source sont adaptées en segments successifs dans une grille 2D. Les deux héros doivent quitter les plateformes violettes avant chaque bascule ; être sur une plateforme qui se rétracte provoque une défaite.

Les cinq reflets du témoin donnent exactement :

| Reflet | Vert | Violet |
|---|---|---|
| 1 | Actif | Inactif |
| 2 | Actif | Actif |
| 3 | Actif | Inactif |
| 4 | Actif | Actif |
| 5 | Actif | Inactif |

La revue indépendante confirme que chaque plateforme violette est un point de coupure du chemin de marche, même si toutes les autres plateformes sont supposées présentes. Un violet fixé actif ou inactif ne donne aucun chemin complet. Un pont direct vers l’îlot final demanderait au moins trois appuis, contre deux caisses disponibles. Cela exclut les raccourcis directs par marche ou construction, sans prétendre énumérer toutes les dispositions possibles des miroirs. Les résultats et une route de noyade de 72 actions sont conservés dans `reference/level8-clock-review.json`.

## Tutoriel et nécessité

Le niveau 1 conserve ses huit acquis mesurés depuis les pixels : marcher, sélectionner, pousser avec chaque rôle, créer un appui, refléter, changer une porte et atteindre les deux cibles. Les explorations exhaustives établissent que la poussée en file, la presse, les appuis, le reflet et chacune des quatre caisses sont nécessaires dans cette carte. La revue par immobilisation de chaque caisse et le contre-exemple de la première version restent dans `reference/level1-independent-review.json`.

Les autres vérifications exhaustives conservées concernent le déplacement du miroir et la sélection dans L2, puis les appuis et la poussée en file dans L7. Le script `validate-levels.mjs --mechanisms` recalcule ces recherches et les suppressions des quatre caisses de L1. Les recherches limitées ne constituent pas des preuves d’impossibilité.

## Couverture effective

483 actions, 29 sélections, 1 480 images, 24 poussées en file, 38 mouvements de miroir, 31 activations de reflet, 15 appuis immergés permanents créés, 7 poussées de presse et 8 monstres éliminés. Le niveau 8 ajoute quinze plateformes hydrauliques contrôlées par deux circuits.

Les 51 tests du moteur couvrent notamment les polarités et circuits AND, le retrait d’un support, la transformation d’une caisse en appui, l’activation simultanée d’un pont d’arrivée, les cascades et Undo. Les 14 contrôles de l’HTML comparent les pixels et durées des huit parcours et trois routes de défaite : deux en L6, une en L8. Les terminaux apparaissent après la dernière image et Undo interrompt correctement l’animation.

La validation visuelle exécutable est réalisée sous Happy DOM avec un buffer canvas. Le navigateur Chromium natif de cet exécuteur n’a pas pu démarrer ; aucun essai navigateur natif n’est revendiqué. Les images du nouveau niveau ont été inspectées séparément.

## Historique de la réorganisation

L’ancien niveau 8 devient le niveau 5 : seul son identifiant ordinal change, avec l’image de transition automatique propre à sa nouvelle place. L’ancien niveau 5 est retiré de la campagne. Sa dernière carte et les vérifications v3 sont conservées dans `reference/history/`. Les niveaux 1, 2, 3, 4, 6 et 7 restent identiques.
