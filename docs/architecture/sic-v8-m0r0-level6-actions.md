# M0R0 · niveau 6 · commandes et retours

Le niveau est désormais gagné en **47 commandes SIC seul**. Le [bilan du trajet gagnant](sic-v8-validation.md#m0r0-niveau-6-tenir-une-plaque-avec-un-bloc-mobile) résume le rejeu depuis le niveau 1. La trace ci-dessous conserve l'essai antérieur de 80 commandes.

Le nouvel essai depuis la sauvegarde réutilise les quatre mesures de déplacement. Après retour à la pose initiale, un premier pas vers le haut laisse les passages fermés. Le second place les deux pièces sur les plaques et ouvre les deux passages. Un pas vers le bas referme les deux passages. Lors du rejeu gagnant, le bloc maintient ensuite la pièce gauche sur sa plaque pendant la descente de la pièce droite. Le passage gauche se referme. La plaque gauche maintient le passage droit ouvert, et la pièce droite le franchit.

Rejeu dfe34f91 en SIC seul depuis le niveau 1, 360 s de temps actif et 600 commandes par niveau.
La référence s’arrêtait après **0 commandes sur ce niveau** (contour component bound exceeded Start a new reasoning session to continue.).
Le rejeu s’arrête après **80 commandes en 54,72 s**. **Aucune proposition applicable**.
Les parcours précédant ce niveau ont les mêmes empreintes, avec 163 commandes.
Empreinte des commandes et retours à l’entrée du niveau `268518470ced21b331a1591ec79263a3b4dadf15984124d5d347049f843b70a8`.

## Lecture du relevé

- Les flèches désignent les commandes directionnelles. Le changement visible est mesuré sur le plateau entier entre deux retours.
- La zone indique le rectangle qui contient tous les pixels modifiés, en coordonnées écran `[gauche, haut, droite, bas]`.
- Une image modifiée indique un effet visible. La cause et la contribution à la victoire restent à établir quand la trace ne les confirme pas.

## Démarches exécutées

- Exploration publique · 40 commandes
- Comparaison des directions · 40 commandes

## Première mesure exploitable

Les 873 composantes du plateau incluent 13 candidates pour une mesure de contour. Les actions 1 à 4 confirment un pas de quatre pixels. En hauteur, les deux pièces cyan se déplacent ensemble. À gauche elles s’éloignent, à droite elles se rapprochent. La 4e commande ramène les deux pièces à leur pose initiale.
Les commandes 1 à 40 relèvent de l’exploration publique. Les commandes 41 à 80 comparent les entrées de nouveau. Au total, 54 retours modifient l’image finale. Aucune commande n’est ensuite proposée par la famille de trajet conjoint.
Les positions complémentaires proviennent d’un rejeu public dont l’empreinte est identique. Elles indiquent le coin supérieur gauche de chaque composante cyan carrée quand l’appariement entre deux images est unique. Un tiret indique une mesure indisponible.

## Action par action

| N° | Commande | Démarche | Motif inscrit par SIC | Retour visible | Zone affectée | Images retournées | Cyan après, x et y |
| ---: | :--- | :--- | :--- | :--- | :--- | ---: | :--- |
| 1 | ↑ | Exploration publique | Test an available command on this board | 64 px modifiés | [18, 18, 45, 25] | 1 | (18, 18) et (42, 18) |
| 2 | ← | Exploration publique | The last direction changed the board. Test another input before trying its opposite. | 66 px modifiés | [0, 0, 63, 63] | 1 | (14, 18) et (46, 18) |
| 3 | ↓ | Exploration publique | The last direction changed the board. Test another input before trying its opposite. | 64 px modifiés | [14, 18, 49, 25] | 1 | (14, 22) et (46, 22) |
| 4 | → | Exploration publique | The last direction changed the board. Test another input before trying its opposite. | 66 px modifiés | [1, 0, 62, 63] | 1 | (18, 22) et (42, 22) |
| 5 | ACTION5 | Exploration publique | The last direction changed the board. Test another input before trying its opposite. | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 6 | Clic (30, 43) | Exploration publique | Test an available command on this board | 38 px modifiés | [2, 0, 61, 63] | 1 | — |
| 7 | Clic (5, 31) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 8 | Clic (58, 31) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 9 | Clic (19, 19) | Exploration publique | Test an available command on this board | 38 px modifiés | [3, 0, 60, 63] | 1 | — |
| 10 | Clic (43, 19) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 11 | Clic (29, 0) | Exploration publique | Test an available command on this board | 2 px modifiés | [4, 0, 59, 63] | 1 | (18, 22) et (42, 22) |
| 12 | Clic (34, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 13 | Clic (19, 31) | Exploration publique | Test an available command on this board | 2 px modifiés | [5, 0, 58, 63] | 1 | (18, 22) et (42, 22) |
| 14 | Clic (28, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 15 | Clic (43, 31) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 16 | Clic (19, 15) | Exploration publique | Test an available command on this board | 2 px modifiés | [6, 0, 57, 63] | 1 | (18, 22) et (42, 22) |
| 17 | Clic (35, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 18 | Clic (43, 15) | Exploration publique | Test an available command on this board | 2 px modifiés | [7, 0, 56, 63] | 1 | (18, 22) et (42, 22) |
| 19 | Clic (27, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 20 | Clic (19, 23) | Exploration publique | Test an available command on this board | 2 px modifiés | [8, 0, 55, 63] | 1 | (18, 22) et (42, 22) |
| 21 | Clic (36, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 22 | Clic (43, 23) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 23 | Clic (19, 43) | Exploration publique | Test an available command on this board | 2 px modifiés | [9, 0, 54, 63] | 1 | (18, 22) et (42, 22) |
| 24 | Clic (26, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 25 | Clic (58, 0) | Exploration publique | Test an available command on this board | 2 px modifiés | [10, 0, 53, 63] | 1 | (18, 22) et (42, 22) |
| 26 | Clic (37, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 27 | Clic (5, 63) | Exploration publique | Test an available command on this board | 2 px modifiés | [11, 0, 52, 63] | 1 | (18, 22) et (42, 22) |
| 28 | Clic (25, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 29 | Clic (57, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | (18, 22) et (42, 22) |
| 30 | Clic (31, 43) | Exploration publique | Test an available command on this board | 38 px modifiés | [12, 0, 51, 63] | 1 | — |
| 31 | Clic (38, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 32 | Clic (6, 63) | Exploration publique | Test an available command on this board | 2 px modifiés | [13, 0, 50, 63] | 1 | — |
| 33 | Clic (24, 0) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 34 | Clic (56, 0) | Exploration publique | Test an available command on this board | 2 px modifiés | [14, 0, 49, 63] | 1 | — |
| 35 | Clic (39, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 36 | Clic (7, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 37 | ↑ | Exploration publique | Test an available command on this board | 2 px modifiés | [15, 0, 48, 63] | 1 | — |
| 38 | Clic (23, 0) | Exploration publique | The last direction changed the board. Test another input before trying its opposite. | Image finale identique | — | 1 | — |
| 39 | Clic (55, 0) | Exploration publique | Test an available command on this board | 2 px modifiés | [16, 0, 47, 63] | 1 | — |
| 40 | Clic (40, 63) | Exploration publique | Test an available command on this board | Image finale identique | — | 1 | — |
| 41 | ↑ | Comparaison des directions | Test an available control in the current interface | Image finale identique | — | 1 | — |
| 42 | ↓ | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [17, 0, 46, 63] | 1 | — |
| 43 | ← | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 32, 44] | 1 | — |
| 44 | ACTION5 | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [18, 0, 45, 63] | 1 | — |
| 45 | → | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 32, 44] | 1 | — |
| 46 | ↑ | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [19, 0, 44, 63] | 1 | — |
| 47 | ← | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 32, 44] | 1 | — |
| 48 | ↓ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 28, 48] | 1 | — |
| 49 | → | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [20, 0, 43, 63] | 1 | — |
| 50 | ACTION5 | Comparaison des directions | Test an available control in the current interface | Image finale identique | — | 1 | — |
| 51 | ↑ | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [21, 0, 42, 63] | 1 | — |
| 52 | ← | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 28, 44] | 1 | — |
| 53 | ↓ | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [22, 0, 41, 63] | 1 | — |
| 54 | → | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 47, 28, 48] | 1 | — |
| 55 | ACTION5 | Comparaison des directions | Test an available control in the current interface | Image finale identique | — | 1 | — |
| 56 | ↑ | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 40, 63] | 1 | — |
| 57 | ← | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 28, 44] | 1 | — |
| 58 | ↓ | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 39, 63] | 1 | — |
| 59 | → | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 47, 28, 48] | 1 | — |
| 60 | ACTION5 | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [25, 0, 38, 63] | 1 | — |
| 61 | ↑ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 28, 48] | 1 | — |
| 62 | ← | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 28, 44] | 1 | — |
| 63 | ↓ | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 37, 63] | 1 | — |
| 64 | → | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 47, 28, 48] | 1 | — |
| 65 | ACTION5 | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [27, 0, 36, 63] | 1 | — |
| 66 | ↑ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 28, 48] | 1 | — |
| 67 | ← | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 35, 63] | 1 | — |
| 68 | ↓ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 24, 48] | 1 | — |
| 69 | → | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 47, 28, 48] | 1 | — |
| 70 | ACTION5 | Comparaison des directions | Test an available control in the current interface | 2 px modifiés | [29, 0, 34, 63] | 1 | — |
| 71 | ↑ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 28, 48] | 1 | — |
| 72 | ← | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 33, 63] | 1 | — |
| 73 | ↓ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 24, 48] | 1 | — |
| 74 | → | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 32, 63] | 1 | — |
| 75 | ACTION5 | Comparaison des directions | Test an available control in the current interface | Image finale identique | — | 1 | — |
| 76 | ↑ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [27, 43, 28, 48] | 1 | — |
| 77 | ← | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 32, 63] | 1 | — |
| 78 | ↓ | Comparaison des directions | Test an available control in the current interface | 8 px modifiés | [23, 43, 24, 48] | 1 | — |
| 79 | → | Comparaison des directions | Test an available control in the current interface | 10 px modifiés | [23, 0, 33, 63] | 1 | — |
| 80 | ACTION5 | Comparaison des directions | Test an available control in the current interface | Image finale identique | — | 1 | — |

## Arrêt

Aucune proposition applicable. Score officiel 5 niveaux gagnés.
Empreinte du parcours jusqu’à l’arrêt `5b176b1b003404f81bcada5b2d8cf7acae6c8c0c5b2a0ce856abbb11f90f688b`.
