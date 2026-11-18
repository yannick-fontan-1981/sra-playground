# SS04 — L’Axe violet · v0.1.0

## Image et commandes

SS04 utilise une image indexée de **64 × 64 pixels**, une grille logique de **20 × 20 cellules de 3 × 3 pixels** et une marge de deux pixels. Les cartes plus petites sont centrées, sans changer la taille des cellules. La palette de seize couleurs est celle de SS01–SS03 ; le Magicien utilise le violet **15**. Sol gris 3, murs gris foncé 4, eau bleue 9, blocs marron 13, appuis marron avec X cyan 10, boutons en + rose 7, portes roses 7, destination à contour jaune 11. Un miroir comporte une diagonale blanche et un dos noir. Un monstre est noir avec un X rouge 8.

Le Magicien est une croix violette, avec un pixel blanc indiquant la dernière direction demandée. Les circuits utilisent un petit repère commun aux boutons et aux portes ; ils n’utilisent pas le violet 15 pour éviter une confusion avec le héros. Une porte superposée à la destination conserve ses bords roses et quatre coins jaunes lorsqu’elle est fermée.

**ACTION1 = haut, ACTION2 = bas, ACTION3 = gauche, ACTION4 = droite.** Il n’existe ni commande Espace, ni choix séparé du mode d’échange, ni poussée ou traction volontaire.

## Échange automatique

Chaque direction lance une visée depuis le Magicien :

1. Le premier bloc ou monstre rencontré échange sa place avec lui. Les deux positions changent simultanément ; la distance est sans limite à l’intérieur de la grille.
2. L’eau et les appuis laissent passer la visée. Les murs et les portes fermées l’arrêtent.
3. La face blanche d’un miroir renvoie la visée à angle droit ; le dos noir l’arrête. Plusieurs réflexions sont possibles.
4. Sans cible, le Magicien tente de marcher d’une case dans la direction demandée. Il ne peut pas entrer dans un mur, un miroir, une porte fermée ou une case d’eau sans appui.
5. Si le rayon revient sur le Magicien ou boucle, l’action est refusée. Une action refusée conserve les positions mais actualise l’orientation.

Les miroirs de SS04 sont **fixes**. Leur orientation est `NE`, `NW`, `SE` ou `SW`, correspondant au quadrant de leur face réfléchissante. Il n’y a ni activation globale des miroirs par X, ni duplication. Il s’agit d’une adaptation explicitement distincte du pouvoir du Marchand de SS01 et des possibilités complètes du jeu source.

## Monstres

Les monstres sont des sentinelles immobiles. Ils peuvent être échangés, peser sur les boutons et être poussés par une presse. Ils ne poursuivent pas le Magicien.

Après le déplacement volontaire et la stabilisation des portes, tout monstre attaque simultanément les êtres vulnérables sur les quatre cases cardinales voisines. Le Magicien adjacent meurt. Des monstres adjacents s’éliminent mutuellement ; un monstre éliminé pendant cette vague a néanmoins porté son attaque. Le contact diagonal est sans effet.

La disparition d’un monstre libère sa plaque. Les portes sont donc recalculées, et une nouvelle poussée peut produire une nouvelle phase avant résolution des contacts restants. Un monstre envoyé dans l’eau disparaît sans créer d’appui.

## Boutons, portes et presses latérales

Les circuits sont déclarés dans les niveaux. **Tous les boutons d’un même circuit doivent porter un poids en même temps.** Un poids peut être le Magicien vivant, une caisse, un monstre ou une porte fermée superposée au bouton. Les repères colorés rendent les liaisons visibles.

Chaque porte-presse précise son circuit, sa direction et sa polarité : fermeture quand le circuit est pressé, ou fermeture lorsqu’il est relâché. Lorsqu’elle passe de l’état ouvert à l’état fermé :

- Une case vide se ferme sans déplacer d’acteur.
- Une case occupée pousse d’une cellule toute la file contiguë de blocs, monstres et Magicien dans la direction du chevron.
- Toutes les destinations sont vérifiées, y compris celles au milieu de la file. Un mur, un miroir fixe ou une autre porte fermée bloque la poussée.
- Si la file est bloquée, seul l’occupant initial de la porte est écrasé. Les autres acteurs restent en place.
- Un bloc poussé dans l’eau devient un appui permanent, praticable, marron avec X cyan. Le Magicien poussé dans l’eau sans appui meurt.
- Un déplacement forcé du Magicien ne lance pas d’échange automatique.

Les circuits sont réévalués après chaque vague ; une poussée peut déclencher la suivante. Les états des portes sont mémorisés, notamment lorsqu’une porte pèse sur son propre bouton. Un circuit oscillant est refusé atomiquement.

Les cartes reprises sans presses conservent les portes historiques : tous leurs boutons commandent ensemble la sortie. Une fermeture sur un acteur refuse la totalité du mouvement, y compris si elle résulte d’un combat. Cette règle permet de conserver les quatre témoins originaux sans modifier les cartes.

## Animation et progression

Un échange produit trois images : trajectoire lumineuse, transfert avec contours carrés gris clair, puis positions finales. Les deux durées intermédiaires sont 70 et 90 ms. Ce contour appartient à l’animation : aucune prévisualisation n’apparaît au repos. Une presse produit trois images d’avancement de 1, 2 puis 3 pixels, aux durées 60 et 80 ms. La dernière image d’une phase dure 40 ms lorsqu’une autre phase suit. La dernière image globale a une durée nulle.

Une action peut contenir un échange, plusieurs combats, changements de portes ou poussées. Il faut présenter **toutes** les images renvoyées, sans limite de trois images par action. Les images intermédiaires n’avancent pas la logique.

Un Magicien vivant sur la destination résout le niveau. La session charge ensuite le premier niveau encore non résolu. La victoire exige les huit niveaux, même s’ils sont visités dans un autre ordre. Une transition peut ajouter l’image initiale du niveau suivant après 100 ms.

`Undo` restaure l’orientation, les acteurs, les appuis, la mémoire des portes et la progression, y compris une transition entre niveaux. `Reset` recommence le niveau courant ; `Restart` revient au tutoriel et efface la progression. La défaite produit `GAME_OVER`, bloque les directions et laisse Undo/Reset disponibles.

Pendant une animation, les directions sont bloquées. Undo, Reset, Restart et sélection de niveau restent utilisables et invalident tous les rappels d’animation devenus obsolètes.

## Tutoriel et séparation des données

Le niveau 1 est chargé au démarrage et son tutoriel est ouvert. Six apprentissages sont reconnus à partir des pixels publics et des entrées : déplacement, échange, création d’appui, réflexion, placement d’un poids et ouverture de porte. Le tutoriel n’inspecte pas l’état privé du moteur.

`WizardPuzzleSession` expose les images, la palette, les durées, les actions disponibles et la progression. Aucune carte sémantique, cible calculée, position privée, liste de circuits, trace, témoin ou solution n’entre dans l’observation. Les solveurs et parcours sont réservés à la conception et aux tests ; ils ne sont pas inclus dans la démo.

Le solveur d’auteur cherche des états complets : position du héros, blocs, monstres, appuis et mémoire des portes. L’orientation n’influence pas le prochain choix directionnel. Une limite de recherche est toujours signalée comme une limite, jamais comme une preuve d’insolubilité.
