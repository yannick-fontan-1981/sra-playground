# Spécification SS03 · v0.3.0

## Représentation

- Jeu `SS03`, huit niveaux ; le démarrage charge le niveau 1 et ouvre son aide.
- Image de 64 × 64 pixels indexés dans la palette de 16 couleurs de SS01 et SS02.
- Grille logique 20 × 20, cellules de 3 × 3 pixels, origine (2, 2), marge de 2 pixels.
- Les cartes rectangulaires de moins de 20 cellules de côté sont centrées sans mise à l’échelle.
- Voleur : croix verte, couleur 14 ; son pixel blanc indique le dernier sens demandé.
- Sol gris 3, mur gris foncé 4, eau bleue 9, caisse marron 13 à centre noir 5, bouton + rose 7, porte carrée rose 7, destination contour jaune 11.
- Les portes-pistons portent un chevron. Un petit repère commun distingue les circuits : blanc, cyan, puis orange. Une porte ouverte garde son armature ; une porte fermée est pleine.
- Une caisse immergée devient un appui marron avec X cyan 10, définitivement praticable. Le moteur permet aux pistons de créer cet appui ; aucune nouvelle plateforme n’est nécessaire dans les huit cartes livrées.

## Déplacement du Voleur

ACTION1 = haut, ACTION2 = bas, ACTION3 = gauche, ACTION4 = droite. Toute autre action est rejetée. Il n’y a ni mode de saisie ni touche Espace.

1. La case devant le Voleur doit être praticable et sans caisse.
2. Si une caisse est immédiatement derrière lui dans l’axe du déplacement, elle entre dans la case qu’il quitte. Les autres caisses ne suivent pas.
3. Le Voleur ne pousse jamais une caisse située devant lui. Un pas perpendiculaire permet de quitter une caisse sans l’entraîner.
4. Dans les niveaux 1, 3, 4, 5 et 6, les boutons commandent ensemble les portes historiques. Une fermeture sur un acteur annule entièrement le déplacement. Cette règle historique est conservée et vérifiée par comparaison des observations de v0.2.0.
5. Dans les niveaux 2, 7 et 8, les circuits et portes-pistons suivent les règles ci-dessous après le déplacement volontaire.
6. Le niveau est résolu quand le Voleur vivant atteint la destination jaune. Le moteur charge ensuite le premier niveau non résolu. La victoire de série exige les huit niveaux.

Un refus actualise l’orientation mais conserve toutes les positions. Undo restaure aussi cette orientation, l’état des portes, les caisses et peut annuler une transition entre niveaux. Reset efface la résolution et l’historique du niveau courant ; Restart efface toute la progression.

## Portes qui poussent

Les champs optionnels `circuits` et `gates` de `LevelSpec` utilisent des coordonnées relatives aux lignes de la carte, avant centrage. Chaque bouton appartient à un circuit ; tous les boutons d’un même circuit doivent porter un poids. Un poids peut être le Voleur, une caisse ou une porte fermée superposée au bouton.

Une porte précise son circuit, sa direction de poussée et sa polarité : fermée lorsque le circuit est pressé, ou fermée lorsqu’il est relâché. À chaque changement d’occupation, toutes les polarités sont recalculées.

Lorsqu’une porte passe de l’état ouvert à fermé :

- Si sa case est vide, elle apparaît sans pousser.
- Si elle contient un acteur, la porte pousse d’une case toute la file contiguë d’acteurs dans sa direction.
- Toutes les destinations doivent être libres de murs et de portes fermées. Une autre porte fermée au milieu de la file bloque la poussée.
- Si la poussée est bloquée, seul l’occupant initial situé sur la porte est écrasé. Les autres acteurs restent en place.
- Une caisse poussée au bout de la file dans l’eau crée un appui ; le Voleur poussé dans l’eau non soutenue meurt.
- Le Voleur déplacé par une porte ne tire pas automatiquement une caisse derrière lui.

Les circuits sont réévalués après chaque vague ; une caisse poussée sur un bouton peut déclencher une seconde porte. Le moteur conserve la mémoire des portes, notamment lorsqu’une porte pèse sur sa propre plaque. Une configuration oscillante est refusée atomiquement. Le niveau 8 utilise une cascade horizontale puis verticale au dernier déclenchement.

Un Voleur écrasé ou noyé produit `GAME_OVER`. Les commandes directionnelles sont alors bloquées ; Undo et Reset restent disponibles.

## Présentation

Chaque traction ou poussée de piston produit trois images de déplacement, avec un décalage de 1 puis 2 puis 3 pixels pour tous les acteurs concernés. Les durées intermédiaires sont 60 et 80 ms. La troisième image correspond exactement à la fin de la phase ; elle dure 40 ms lorsqu’une autre phase suit. La dernière image globale a une durée nulle. Une réussite peut ajouter la première image du niveau suivant après une pause de 100 ms.

Une action peut ainsi produire six images pour une traction suivie d’un piston, ou davantage lorsqu’une cascade intervient. Les phases de marche, changement de porte sans déplacement d’acteur et écrasement produisent une image chacune. Une action refusée produit une seule image stable. Les images intermédiaires n’avancent jamais la logique du jeu.

Il n’existe aucune prévisualisation de destination. Les sprites conservent leurs couleurs normales pendant les mouvements.

L’interface bloque les directions concurrentes pendant l’animation. Undo, Reset, Restart et sélection d’un niveau restent utilisables : une génération de présentation invalide les rappels d’animation devenus obsolètes.

## Interface avec les agents

Le moteur ne dépend ni du DOM, ni d’un réseau, ni d’un solveur. L’observation publique contient les images, la palette, les durées, les actions disponibles et la progression. Elle ne contient aucun plan, circuit sémantique, état interne de plateau, témoin ou solution. La progression du tutoriel humain est calculée par lecture des pixels publics.

`stepDetailed` expose les phases uniquement pour le moteur et les outils de conception ; elles n’entrent pas dans l’observation. Le solveur d’auteur garde une recherche historique pour les cartes sans pistons et une recherche d’états complets pour les autres. Ses clés incluent le héros, les caisses, les appuis et la mémoire des portes. Une limite de recherche n’est jamais présentée comme une preuve d’insolubilité.
