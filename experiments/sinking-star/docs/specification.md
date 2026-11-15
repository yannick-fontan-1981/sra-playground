# Spécification SS — version 0.0.1

## 1. Intention et frontière

Créer 25 jeux originaux de raisonnement, inspirés des mécaniques discutées autour d'Order of the Sinking Star. Les cartes et sprites de ce laboratoire sont originaux. Il ne s'agit ni d'un portage fidèle certifié, ni d'une série officielle ARC-AGI-3.

La série est prévue pour le SRA Playground, avec 8 niveaux par jeu. L'état livré ici est un **pilote réduit de SS01, 3 niveaux**, et non les 25 jeux terminés.

Choix d'architecture : autonomie d'exécution, mais sauvegarde dans le même dépôt GitHub, sur une branche de travail dédiée. Pas de nouveau dépôt et pas de deuxième moteur Python à migrer plus tard.

## 2. Géométrie et couleurs

Image indexée : 64 × 64. Grille logique : 20 × 20. Cellules : exactement 3 × 3 pixels. Origine : (2,2). Bordure : 2 pixels. Les cartes d'initiation sont centrées dans cette grille ; les cellules inutilisées sont des murs. Aucun lissage ni animation dépendant du temps.

Position pixel d'une cellule : `x = 2 + 3 * cx`, `y = 2 + 3 * cy`.

La conversion d'un clic rejette les pixels hors de [2,61], les coordonnées non entières et les valeurs non finies ; elle ne rabat pas la bordure vers une cellule jouable.

| Indice | Signification réservée dans la série |
|---|---|
| 0 | Blanc : miroir et direction du personnage actif |
| 3 | Sol gris |
| 4 | Mur gris foncé et extérieur |
| 5 | Noir : dos de miroir et base du monstre |
| 6 | Barde magenta |
| 7 | Bouton et porte roses |
| 8 | Guerrier rouge, X rouge du monstre, retour d'échec visuel |
| 9 | Eau bleue |
| 10 | Cyan : rayons du miroir et X de la pierre immergée |
| 11 | Contour de destination jaune |
| 12 | Marchand orange |
| 13 | Pierre marron |
| 14 | Voleur vert |
| 15 | Magicien violet |

Les codes hexadécimaux sont propres à la série et figurent dans `PALETTE`. En particulier, 13 est réellement marron dans ce laboratoire ; cela ne modifie pas la couleur 13 des autres jeux du Playground. Les indices 1 et 2 restent disponibles.

Le personnage est une croix de sa couleur, avec les coins transparents. Son pixel d'extrémité blanc indique sa direction. Le but reste discernable aux quatre coins sous le personnage. Le miroir possède une diagonale blanche, un triangle arrière noir et un triangle avant transparent.

## 3. Règles implémentées du pilote

### Actions

1 = haut ; 2 = bas ; 3 = gauche ; 4 = droite ; 5 = pouvoir du miroir.

Une direction actualise l'orientation du marchand puis tente un déplacement d'une cellule. Mur, eau et corps d'un miroir bloquent le déplacement. L'orientation change même si le déplacement échoue.

Aucune action 6 n'est disponible dans ce pilote solo. Les identifiants non entiers ou hors de 1–5 sont rejetés sans mutation de la session.

### Réflexion

Un miroir fixe a deux bras perpendiculaires définis par sa face NE, SE, SW ou NW. Le marchand doit se trouver sur l'un de ces bras, à une distance entière strictement positive.

Le pouvoir cherche la cellule de l'autre bras à la même distance. Les murs, le bord et le corps d'un autre miroir interrompent les rayons. L'eau laisse passer un rayon mais ne peut pas recevoir le marchand. Dans le pilote, l'arrivée doit être du sol libre.

Avec exactement une arrivée valide, l'action 5 déplace le marchand. Sa direction n'est pas une précondition de ce pouvoir. Zéro arrivée valide ou plusieurs arrivées valides : aucun déplacement, retour visuel rouge. Aucun choix caché selon l'ordre des miroirs dans un tableau.

Le retour rouge dure jusqu'à l'action suivante ; il dépend d'une action, jamais d'un chronomètre. Ce retour est présent dans l'image et restauré par Undo. Les premiers niveaux ne comportent qu'un miroir chacun.

### But et progression

Une seule destination jaune dans chacun des trois niveaux. Tout contour jaune est un vrai but : aucun faux but jaune à deviner.

Atteindre le but crédite ce niveau une fois puis ouvre le premier niveau non encore résolu. Après un saut manuel vers un niveau ultérieur, la session revient donc aux niveaux manquants. WIN n'est émis que lorsque tous les niveaux du pilote ont réellement été résolus.

Reset réinitialise le niveau courant et retire son éventuel crédit ; il conserve les crédits des autres niveaux. Restart efface toute la progression. SelectLevel réinitialise le niveau sélectionné, ne le crédite pas et efface l'historique d'Undo. Undo restaure la position, la direction, le retour visuel, le niveau et les crédits, y compris après une transition de niveau ou WIN.

### Trois cartes originales

- L1 — Première réflexion : l'arrivée à distance égale est déjà disponible.
- L2 — La bonne distance : l'arrivée initiale serait dans l'eau ; ajuster la distance.
- L3 — Reflet bloqué : un mur bloque l'arrivée initiale ; choisir une autre distance.

Le solveur d'auteur démontre une solution et l'absence de solution par la marche seule pour chaque carte. Ces trois cartes sont des exercices minimaux ; elles ne prétendent pas représenter la difficulté des niveaux 4 à 8.

## 4. Contrat pour le futur hôte

`SinkingStarSession` expose `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel`. La fabrique/commande de chargement restera à brancher dans le worker de l'hôte.

L'observation suit les champs de `GameObservation` consulté à `cdab7463` : `gameCode`, `frame`, `frames`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps`, `palette`.

`frame` est une matrice 2D, `frames` une séquence contenant cette matrice. Pas de mélange avec le vieux contrat HTTP Python `frame[frames][y][x]`.

Ne transmettre au SRA que les images, actions et métadonnées publiques autorisées. Aucun accès aux cartes sémantiques, aux préconditions du moteur, à l'état interne ou aux solutions témoins. L'isolation réelle devra être assurée par la frontière du worker lors du raccordement ; une simple interface TypeScript n'est pas à elle seule une barrière de sécurité.

La page de laboratoire comporte des explications pour l'auteur humain. Ces explications ne font pas partie de l'observation de l'agent ni des frames du jeu.

## 5. Extensions prévues, non implémentées ici

Marchand : échange avec une entité placée à la position réfléchie. Guerrier : poussée adjacente. Voleur : traction avec recul libre. Magicien : échange avec la première entité alignée. Barde : translation collective des objets touchés par un rayon.

Environnement : pierres mobiles, pierres immergées immobiles et praticables, boutons maintenus par occupation, portes conditionnelles et destinations multiples. Les règles de chasse et d'élimination des monstres restent une proposition de conception, pas un comportement livré.

Avant de figer le moteur complet, traiter explicitement : sélection et orientation avec plusieurs héros, ambiguïté de miroirs à rayons croisés, cibles autorisées pour chaque pouvoir, ordre simultané des déplacements, collisions, porte qui voudrait se fermer sur une entité, interaction bouton/destination/objet superposés, moment exact du tour des monstres et priorité défaite/victoire.

Ces décisions doivent être prises et testées **avant** d'écrire les niveaux qui en dépendent, sans exception cachée par identifiant de jeu. Les fonctions communes seront extraites progressivement : ne pas écrire 25 moteurs ni construire un interpréteur de règles universel avant d'en avoir besoin.
