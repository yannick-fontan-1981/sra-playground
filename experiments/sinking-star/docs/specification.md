# Spécification SS — version 0.1.0

## 1. Intention et frontière

Créer 25 jeux originaux de raisonnement, inspirés des mécaniques discutées autour d'Order of the Sinking Star. Les cartes et sprites de ce laboratoire sont originaux. Il ne s'agit ni d'un portage fidèle certifié, ni d'une série officielle ARC-AGI-3.

La série est prévue pour le SRA Playground, avec 8 niveaux par jeu. L'état livré ici est **SS01 avec ses 8 niveaux jouables dans le laboratoire**, et non les 25 jeux terminés. L’intégration au Playground reste à faire.

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

## 3. Règles implémentées de SS01

### Actions

1 = haut ; 2 = bas ; 3 = gauche ; 4 = droite ; 5 = pouvoir du miroir.

Une direction actualise l'orientation du marchand puis tente un déplacement d'une cellule. Mur, eau, pierre, porte fermée et corps d'un miroir bloquent le déplacement. Le Marchand ne pousse pas les pierres. L'orientation change même si le déplacement échoue.

Aucune action 6 n'est disponible dans ce pilote solo. Les identifiants non entiers ou hors de 1–5 sont rejetés sans mutation de la session.

### Réflexion

Un miroir fixe a deux bras perpendiculaires définis par sa face NE, SE, SW ou NW. Le marchand doit se trouver sur l'un de ces bras, à une distance entière strictement positive.

Le pouvoir cherche la cellule de l'autre bras à la même distance. Les murs, portes fermées, le bord et le corps d'un autre miroir interrompent les rayons. Une pierre peut être l'extrémité ciblée, mais coupe le rayon au-delà de sa cellule. L'eau laisse passer un rayon mais ne peut pas recevoir le marchand. L'arrivée doit être du sol, libre ou occupé par une pierre, éventuellement sous une porte déjà ouverte. Une pierre ciblée échange sa position avec le Marchand : les deux positions changent atomiquement. Le terrain reste à sa place. Les rayons sont évalués dans l'état avant l'action, puis les contraintes de porte sont vérifiées sur le résultat.

Avec exactement une arrivée valide, l'action 5 déplace le marchand. Sa direction n'est pas une précondition de ce pouvoir. Zéro arrivée valide ou plusieurs arrivées valides : aucun déplacement, retour visuel rouge. Aucun choix caché selon l'ordre des miroirs dans un tableau.

Le retour rouge dure jusqu'à l'action suivante ; il dépend d'une action, jamais d'un chronomètre. Ce retour est présent dans l'image et restauré par Undo. L1–L3 ne comportent qu'un miroir chacun. Les cartes à plusieurs miroirs évitent d'exiger un choix ambigu.

### Boutons et portes

Tous les boutons roses du niveau forment un circuit ET : toutes les portes s'ouvrent si chaque bouton est occupé par le Marchand ou une pierre. Un circuit sans bouton reste fermé. Aucun verrouillage permanent : quitter un bouton recalcule immédiatement les portes.

Une action qui refermerait une porte sur le Marchand ou une pierre est rejetée entièrement. Pour un déplacement, seule la nouvelle orientation est conservée, comme pour un obstacle ordinaire. Pour un pouvoir, aucun échange partiel : retour d'échec rouge. Les portes ne détruisent, ne déplacent et n'éjectent jamais une entité.

Rendu : bouton = plus rose ; porte fermée = carré rose à centre noir ; porte ouverte = quatre coins roses. Un bouton occupé garde quatre coins roses visibles, même sous une pierre. Les pierres restent marron.

### Cartes déclaratives

Symboles : `#` mur, `.` sol, `~` eau, `M` Marchand, `g` destination, `1/2/3/4` miroirs NE/SE/SW/NW, `o` pierre, `b` bouton, `D` porte, `*` pierre sur bouton, `@` Marchand sur bouton. Ces deux derniers raccourcis permettent aussi d'écrire des tests de superposition. Aucun comportement n'est sélectionné selon l'identifiant du niveau.

### But et progression

Une seule destination jaune dans chacun des huit niveaux. Tout contour jaune est un vrai but : aucun faux but jaune à deviner.

Atteindre le but crédite ce niveau une fois puis ouvre le premier niveau non encore résolu. Après un saut manuel vers un niveau ultérieur, la session revient donc aux niveaux manquants. WIN n'est émis que lorsque tous les niveaux du jeu ont réellement été résolus.

Reset réinitialise le niveau courant et retire son éventuel crédit ; il conserve les crédits des autres niveaux. Restart efface toute la progression. SelectLevel réinitialise le niveau sélectionné, ne le crédite pas et efface l'historique d'Undo. Undo restaure la position, les pierres, la direction, le retour visuel, le niveau et les crédits (les boutons et portes sont recalculés depuis ces positions), y compris après une transition de niveau ou WIN.

### Huit cartes originales

| Niveau | Intention |
|---|---|
| L1 — Première réflexion | Deux îles ouvertes ; rejoindre le rayon puis explorer l'arrivée. |
| L2 — La bonne distance | Plusieurs distances possibles ; l'essai initial aboutirait dans l'eau. |
| L3 — Reflet bloqué | Un mur bloque l'arrivée initiale ; circulation autour d'un pilier. |
| L4 — L'autre face | Orientation SW utile, miroir NW non utile ; mêmes lois géométriques. |
| L5 — Une place à échanger | Une pierre occupe la seule arrivée utilisable ; l'échange est indispensable. |
| L6 — Le poids du reflet | Laisser la pierre sur le bouton pour conserver une porte ouverte. |
| L7 — Deux miroirs, trois îles | Rejoindre une île intermédiaire puis un second rayon ; les deux miroirs sont nécessaires. |
| L8 — L'archipel des échanges | Composer pierre, bouton, porte et deux miroirs. |

Demande du 15 novembre : davantage de liberté dès les premiers niveaux. L1/L2/L3 donnent maintenant accès à 25/25/24 cases avant tout pouvoir, contre 2/4/3 dans le pilote. Les quatre déplacements initiaux sont possibles, les salles contiennent des boucles et au moins trois positions de réflexion valides sont accessibles. L1 exige maintenant de marcher avant le pouvoir et n'est plus remporté par un appui immédiat.

Chaque niveau est soluble, mais pas par la marche seule. L'exploration des états pertinents pour les règles vérifie aussi qu'aucun état accessible ne bloque définitivement la résolution. Le solveur ignore la direction et le retour rouge dans sa clé : ces deux éléments n'affectent pas les règles du Marchand. Ce choix devra être revu pour les autres personnages. Un arrêt de recherche sur budget est « indéterminé », jamais « insoluble ».

Les solutions et mesures d'auteur sont dans `docs/validation.json`, généré par `npm run validate`. Ce rapport ne doit pas entrer dans le paquet navigateur ni dans les observations du SRA.

## 4. Contrat pour le futur hôte

`SinkingStarSession` expose `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel`. La fabrique/commande de chargement restera à brancher dans le worker de l'hôte.

L'observation suit les champs de `GameObservation` consulté à `cdab7463` : `gameCode`, `frame`, `frames`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps`, `palette`.

`frame` est une matrice 2D, `frames` une séquence contenant cette matrice. Pas de mélange avec le vieux contrat HTTP Python `frame[frames][y][x]`.

Ne transmettre au SRA que les images, actions et métadonnées publiques autorisées. Aucun accès aux cartes sémantiques, aux préconditions du moteur, à l'état interne ou aux solutions témoins. L'isolation réelle devra être assurée par la frontière du worker lors du raccordement ; une simple interface TypeScript n'est pas à elle seule une barrière de sécurité.

La page de laboratoire comporte des explications pour l'auteur humain. Ces explications ne font pas partie de l'observation de l'agent ni des frames du jeu.

## 5. Extensions prévues, non implémentées ici

Marchand : étendre l'échange aux autres héros et aux monstres ; l'échange avec une pierre est déjà implémenté. Guerrier : poussée adjacente. Voleur : traction avec recul libre. Magicien : échange avec la première entité alignée. Barde : translation collective des objets touchés par un rayon.

Environnement restant : pierres immergées immobiles et praticables, interactions de poussée/traction, destinations multiples. Les pierres échangeables, boutons maintenus et portes conditionnelles sont déjà implémentés. Les règles de chasse et d'élimination des monstres restent une proposition de conception, pas un comportement livré.

Avant de figer le moteur complet, traiter explicitement : sélection et orientation avec plusieurs héros, ambiguïté de miroirs à rayons croisés, cibles autorisées pour chaque pouvoir, ordre simultané des déplacements, collisions, interaction bouton/destination/objet superposés, moment exact du tour des monstres et priorité défaite/victoire.

Ces décisions doivent être prises et testées **avant** d'écrire les niveaux qui en dépendent, sans exception cachée par identifiant de jeu. Les fonctions communes seront extraites progressivement : ne pas écrire 25 moteurs ni construire un interpréteur de règles universel avant d'en avoir besoin.
