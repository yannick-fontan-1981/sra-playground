# Spécification SS03

## Représentation

- Jeu `SS03`, 8 niveaux ; le démarrage charge le niveau 1 et ouvre son aide.
- Image de 64 × 64 pixels indexés dans la même palette de 16 couleurs que SS01 et SS02.
- Grille logique 20 × 20, cellules de 3 × 3 pixels, origine (2, 2), marge de 2 pixels.
- Les cartes rectangulaires de moins de 20 cellules de côté sont centrées sans mise à l’échelle.
- Voleur : croix verte, couleur 14 ; son pixel blanc indique le dernier sens demandé.
- Sol gris 3, mur gris foncé 4, eau bleue 9, caisse marron 13 à centre noir 5, bouton + rose 7, porte carrée rose 7, destination contour jaune 11.
- Une plateforme déjà présente conserve le motif marron avec X cyan 10. Aucun niveau n’exige la création d’une nouvelle plateforme : un tireur seul déplace la caisse vers sa propre case précédente, qui doit déjà être praticable.

## Mouvement atomique

ACTION1 = haut, ACTION2 = bas, ACTION3 = gauche, ACTION4 = droite. Toute autre action est rejetée. Il n’y a ni mode de saisie ni touche Espace.

1. La case devant le Voleur doit être praticable et sans caisse.
2. Si une caisse est immédiatement derrière lui dans l’axe du déplacement, elle entre dans la case qu’il quitte. Les autres caisses ne suivent pas.
3. Le déplacement ne pousse jamais une caisse située devant le héros. Un pas perpendiculaire permet de quitter une caisse sans l’entraîner.
4. Tous les boutons visibles d’une salle commandent ensemble ses portes. Une caisse ou le Voleur peuvent peser sur un bouton.
5. Si l’état obtenu referme une porte sur une caisse ou le héros, tout le déplacement est annulé. Cette convention conserve le comportement déterministe de la série SRA ; ce n’est pas une simulation des destructions éventuelles de la version commerciale.
6. Le niveau est résolu quand le Voleur atteint la destination jaune. Le moteur charge ensuite le premier niveau non résolu. La victoire de série exige les huit niveaux.

Un refus actualise l’orientation mais conserve toutes les positions. Undo restaure aussi cette orientation et peut annuler une transition entre deux niveaux. Reset efface la résolution et l’historique du niveau courant ; Restart efface toute la progression.

## Présentation

Une traction valide produit trois images de déplacement, avec un décalage de 1 puis 2 puis 3 pixels pour le héros et la caisse. Les durées intermédiaires sont 60 et 80 ms. La troisième image est le rendu exact de l’état final ; les images intermédiaires n’avancent pas la logique du jeu. Les sprites conservent leurs couleurs normales.

Il n’existe aucune prévisualisation de destination. Une marche ordinaire ou une action refusée produit une image. Une réussite peut ajouter l’image initiale du niveau suivant après une pause de 100 ms.

L’interface bloque les directions concurrentes pendant l’animation. Undo, Reset, Restart et sélection d’un niveau restent utilisables : une génération de présentation invalide les rappels d’animation devenus obsolètes.

## Interface avec les agents

Le moteur ne dépend ni du DOM, ni d’un réseau, ni d’un solveur. L’observation publique contient les images, la palette, les durées, les actions disponibles et la progression. Elle ne contient aucun plan, état sémantique du plateau, témoin, solution ou information réservée à l’auteur. La progression du tutoriel humain est calculée par lecture des pixels publics.
