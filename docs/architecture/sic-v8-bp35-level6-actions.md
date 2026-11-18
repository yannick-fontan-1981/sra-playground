# BP35 · niveau 6 · commandes et retours

Rejeu d7b66e1d avec le recalage par animation en SIC seul depuis le niveau 1, 360 s de temps actif et 600 commandes par niveau.
La référence s’arrêtait après **64 commandes sur ce niveau** (native_game_over).
Le rejeu s’arrête après **64 commandes en 52,63 s**. **Défaite officielle**.
Les parcours précédant ce niveau ont les mêmes empreintes, avec 148 commandes.
Empreinte des commandes et retours à l’entrée du niveau `1ca5ba20dc13cf51f536c6f2dbb412d8b9435e7f2f391abebe99daadb4c1bdbc`.

## Lecture du relevé

- Les flèches désignent les commandes directionnelles. Le changement visible est mesuré sur le plateau entier entre deux retours.
- La zone indique le rectangle qui contient tous les pixels modifiés, en coordonnées écran `[gauche, haut, droite, bas]`.
- Une image modifiée indique un effet visible. La cause et la contribution à la victoire restent à établir quand la trace ne les confirme pas.

## Démarches exécutées

- sic_protect_gravity_route · 17 commandes
- Exploration publique · 40 commandes
- Comparaison des directions · 7 commandes

## Premier point de divergence

La commande 6 active l'inverseur visible en `(39,33)`. Le terrain commun quitte le champ entre le départ et l'arrivée. Parmi les 44 images, 24 permettent de lire le plateau et donnent, par leurs recouvrements, un décalage final unique de dix rangées. SIC valide la nouvelle position et poursuit les commandes 7 à 9. Sans ce recalage, la famille de gravité cessait de proposer dès la commande 6.

Après la commande 9, SIC voit la sortie à gauche et un autre inverseur à proximité. Son modèle ne trouve aucun premier pas sûr qui les relie à la position actuelle. L'exploration reprend à la commande 10, avec plusieurs reprises de la famille de gravité entre les commandes 16 et 50. La partie s'achève sur une défaite à la commande 64. La préparation d'appuis avant le premier changement de gravité reste à vérifier.

## Action par action

| N° | Commande | Démarche | Motif inscrit par SIC | Retour visible | Zone affectée | Images retournées |
| ---: | :--- | :--- | :--- | :--- | :--- | ---: |
| 1 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [0, 37, 29, 63] | 5 |
| 2 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [1, 37, 35, 63] | 5 |
| 3 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [2, 37, 41, 63] | 5 |
| 4 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [3, 37, 47, 63] | 5 |
| 5 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [4, 37, 53, 63] | 5 |
| 6 | Clic (39, 33) | sic_protect_gravity_route | Reverse the fall after checking the visible and remembered path | 1961 px modifiés | [1, 0, 62, 63] | 44 |
| 7 | ← | sic_protect_gravity_route | Move sideways to the next safe landing | 53 px modifiés | [6, 26, 53, 63] | 5 |
| 8 | ← | sic_protect_gravity_route | Move sideways to the next safe landing | 53 px modifiés | [7, 26, 47, 63] | 5 |
| 9 | ← | sic_protect_gravity_route | Move sideways to the next safe landing | 53 px modifiés | [8, 26, 41, 63] | 5 |
| 10 | ← | Exploration publique | Test an available command on this board | 1 px modifié | [9, 63, 9, 63] | 3 |
| 11 | → | Exploration publique | Test an available command on this board | 53 px modifiés | [10, 26, 41, 63] | 5 |
| 12 | Clic (42, 21) | Exploration publique | Test an available command on this board | 1 px modifié | [11, 63, 11, 63] | 2 |
| 13 | Clic (15, 25) | Exploration publique | Test an available command on this board | 1 px modifié | [12, 63, 12, 63] | 2 |
| 14 | Clic (38, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [13, 63, 13, 63] | 2 |
| 15 | Clic (27, 29) | Exploration publique | Test an available command on this board | 1772 px modifiés | [1, 0, 62, 63] | 16 |
| 16 | ← | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [15, 37, 41, 63] | 5 |
| 17 | Clic (39, 9) | sic_protect_gravity_route | Build a protective ceiling before entering the next column | 40 px modifiés | [16, 6, 42, 63] | 6 |
| 18 | Clic (45, 9) | sic_protect_gravity_route | Build a protective ceiling before entering the next column | 33 px modifiés | [17, 6, 48, 63] | 6 |
| 19 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [18, 37, 41, 63] | 5 |
| 20 | → | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [19, 37, 47, 63] | 5 |
| 21 | ← | sic_protect_gravity_route | Move sideways to the next safe landing | 47 px modifiés | [20, 37, 47, 63] | 5 |
| 22 | Clic (30, 17) | Exploration publique | Test an available command on this board | 1 px modifié | [21, 63, 21, 63] | 2 |
| 23 | Clic (42, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [22, 63, 22, 63] | 2 |
| 24 | Clic (43, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [23, 63, 23, 63] | 2 |
| 25 | Clic (11, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [24, 63, 24, 63] | 2 |
| 26 | Clic (44, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [25, 63, 25, 63] | 2 |
| 27 | Clic (12, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [26, 63, 26, 63] | 2 |
| 28 | Clic (45, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [27, 63, 27, 63] | 2 |
| 29 | Clic (13, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [28, 63, 28, 63] | 2 |
| 30 | Clic (46, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [29, 63, 29, 63] | 2 |
| 31 | Clic (14, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [30, 63, 30, 63] | 2 |
| 32 | Clic (47, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [31, 63, 31, 63] | 2 |
| 33 | Clic (15, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [32, 63, 32, 63] | 2 |
| 34 | Clic (16, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [33, 63, 33, 63] | 2 |
| 35 | Clic (48, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [34, 63, 34, 63] | 2 |
| 36 | Clic (17, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [35, 63, 35, 63] | 2 |
| 37 | Clic (49, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [36, 63, 36, 63] | 2 |
| 38 | Clic (18, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [37, 63, 37, 63] | 2 |
| 39 | Clic (50, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [38, 63, 38, 63] | 2 |
| 40 | Clic (19, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [39, 63, 39, 63] | 2 |
| 41 | Clic (51, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [40, 63, 40, 63] | 2 |
| 42 | Clic (20, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [41, 63, 41, 63] | 2 |
| 43 | Clic (52, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [42, 63, 42, 63] | 2 |
| 44 | Clic (21, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [43, 63, 43, 63] | 2 |
| 45 | Clic (39, 9) | Exploration publique | Test an available command on this board | 33 px modifiés | [36, 6, 44, 63] | 6 |
| 46 | Clic (39, 9) | sic_protect_gravity_route | Build a protective ceiling before entering the next column | 33 px modifiés | [36, 6, 45, 63] | 6 |
| 47 | Clic (22, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [46, 63, 46, 63] | 2 |
| 48 | Clic (23, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [47, 63, 47, 63] | 2 |
| 49 | Clic (45, 9) | Exploration publique | Test an available command on this board | 33 px modifiés | [43, 6, 48, 63] | 6 |
| 50 | Clic (45, 9) | sic_protect_gravity_route | Build a protective ceiling before entering the next column | 33 px modifiés | [43, 6, 49, 63] | 6 |
| 51 | Clic (24, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [50, 63, 50, 63] | 2 |
| 52 | Clic (25, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [51, 63, 51, 63] | 2 |
| 53 | Clic (13, 44) | Exploration publique | Test an available command on this board | 1 px modifié | [52, 63, 52, 63] | 2 |
| 54 | Clic (26, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [53, 63, 53, 63] | 2 |
| 55 | Clic (15, 15) | Exploration publique | Test an available command on this board | 1 px modifié | [54, 63, 54, 63] | 2 |
| 56 | Clic (27, 63) | Exploration publique | Test an available command on this board | 1 px modifié | [55, 63, 55, 63] | 2 |
| 57 | Clic (21, 15) | Exploration publique | Test an available command on this board | 1 px modifié | [56, 63, 56, 63] | 2 |
| 58 | ← | Comparaison des directions | Test an available control in the current interface | 47 px modifiés | [31, 37, 57, 63] | 5 |
| 59 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [58, 63, 58, 63] | 3 |
| 60 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [59, 63, 59, 63] | 3 |
| 61 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [60, 63, 60, 63] | 3 |
| 62 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [61, 63, 61, 63] | 3 |
| 63 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [62, 63, 62, 63] | 3 |
| 64 | ← | Comparaison des directions | Test an available control in the current interface | 1 px modifié | [63, 63, 63, 63] | 3 |

## Arrêt

Défaite officielle. Score officiel 5 niveaux gagnés.
Empreinte du parcours jusqu’à l’arrêt `4b427e63c49e8faa59803aa5a10a230181fb8c615da900b16dd7adb05a40a16d`.
