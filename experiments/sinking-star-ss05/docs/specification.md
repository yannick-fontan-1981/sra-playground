# Contrat de jeu SS05 v0.1.1

## Grille et palette

Une observation contient une image de 64 × 64 pixels, une grille logique de 20 × 20 cellules, des cellules de 3 × 3 pixels et une origine à (2,2). Les cartes plus petites sont centrées. La palette conserve les seize couleurs de la série.

| Élément | Index | Dessin |
| --- | ---: | --- |
| Barde | 6 | Croix magenta, pointe blanche vers la dernière direction |
| Sol | 3 | Gris |
| Mur | 4 | Gris foncé |
| Eau | 9 | Bleu |
| Caisse | 13 | Carré marron, centre noir |
| Appui dans l’eau | 13 / 10 | Marron avec X cyan |
| Bouton | 7 | + rose, repère de circuit au centre |
| Porte / presse | 7 | Carré rose ; chevron et repère du circuit |
| Destination | 11 | Contour carré jaune |
| Miroir | 0 / 5 | Diagonale blanche et dos noir |
| Monstre | 5 / 8 | Noir avec X rouge |
| Arrivée du Barde par reflet | 1 | + gris clair |
| Arrivée d’une caisse par reflet | 1 | Contour carré gris clair |
| Aura du chant | 6 | Carré de 5 × 5 cases en pointillés magenta |

## Chant et déplacements

ACTION1, 2, 3, 4 correspondent à haut, bas, gauche, droite. Les caisses, monstres et appuis dont la distance de Chebyshev au Barde est au plus 2 sont sélectionnés au début du pas, diagonales incluses. Les murs ne bloquent pas la portée du chant. Les objets et le Barde tentent une translation d’une case dans le même sens, simultanément. Les dépendances d’occupation sont résolues avant d’appliquer le mouvement : une file peut avancer si son extrémité est libre ; un objet retenu peut en retenir d’autres.

Les objets bloqués restent sur place. Si le Barde ne peut pas avancer, le déplacement entier est refusé. Une direction refusée peut modifier son orientation visuelle, mais ne déclenche ni attaques ni presses. Il n’existe pas de poussée ou de traction séparée, ni de chant immobile.

Une caisse entrant dans de l’eau sans appui devient un appui. Un appui ne glisse que d’une case d’eau vers une autre ; il laisse de l’eau derrière lui et ne remonte jamais sur le sol. L’appui sous le Barde et celui sur lequel il pose le pied sont immobilisés pendant ce pas. Cette convention est une adaptation SS05 explicite. Un pas volontaire dans une eau qui resterait sans appui est refusé.

## Reflets

ACTION5, barre d’espace (ou X) ou bouton Reflet, active les miroirs sans chant. Les miroirs sont fixes et possèdent deux axes perpendiculaires du côté blanc. Chaque axe prend son premier Barde, sa première caisse ou son premier monstre ; l’occupant est envoyé sur l’autre axe, à distance égale du miroir. Les appuis immergés ne sont pas reflétés.

Toutes les propositions sont traitées simultanément. Un obstacle statique sur le trajet, une destination incompatible, un occupant qui ne part pas, ou plusieurs destinations pour le même acteur refuse l’ensemble. Cette version solo ne crée aucune copie du Barde. Les murs, miroirs et portes fermées arrêtent les axes. Les arrivées d’un plan valide sont dessinées en gris clair : un + pour le Barde, un contour carré pour les caisses et les monstres. L’aura est un périmètre en pointillés magenta couvrant le carré de 5 × 5 cases et suit aussi les images intermédiaires de déplacement.

Une caisse reflétée dans l’eau devient un appui. Un monstre sans appui se noie. Un Barde reflété au-dessus d’une eau sans appui perd : l’annulation reste disponible.

## Boutons, portes et presses

Les boutons d’un circuit doivent tous porter un poids. Le Barde, une caisse, un monstre ou une porte fermée peuvent peser. La polarité de chaque porte précise si elle se ferme lorsque le circuit est pressé ou relâché. Une fermeture pousse d’une case la file contiguë d’occupants dans son sens. Si le déplacement de la file est impossible, seul l’occupant sur la case de la presse est écrasé.

Après chaque vague de mouvements, tous les circuits sont réévalués. Les cascades sont conservées et animées séparément. Un circuit oscillant fait refuser atomiquement l’action. Les déplacements imposés par une presse ne lancent jamais le chant. Le niveau 7 exploite une porte qui prend le relais du Barde comme poids sur son propre bouton.

## Monstres et ordre des conséquences

Les monstres ne se déplacent que sous l’effet du chant, d’un reflet ou d’une presse. Après les mouvements et les presses, les contacts cardinaux sont résolus simultanément. Un monstre voisin tue le Barde. Deux monstres voisins se tuent mutuellement ; un monstre qui meurt attaque encore dans cette même vague. Les diagonales sont sûres. Les disparitions peuvent libérer des boutons et déclencher de nouvelles conséquences. Aucun combat n’est déclenché à la simple ouverture du niveau.

## Animation, progression et interface publique

Un pas ou une poussée représente trois images d’avancement à 1, 2 et 3 pixels ; un reflet représente trois images distinctes. Plusieurs phases peuvent se suivre pour une seule action. L’action 20 du témoin de L8 produit neuf images : chant, poussée d’une file, puis poussée dans l’eau. Les durées fournies par le moteur font partie du contrat d’observation. Les animations ne rejouent jamais la logique.

`BardPuzzleSession` fournit `observe`, `action`, `undo`, `reset`, `restart`, `selectLevel`. Les observations contiennent uniquement pixels, palette, images, durées, progression et commandes disponibles. Elles n’exposent ni positions sémantiques, ni plans de miroir, ni parcours, ni phases internes. Le tutoriel de l’HTML se fonde uniquement sur les pixels publics.

La victoire exige les huit salles, même si elles sont terminées dans un ordre différent. Le moteur revient au premier niveau inachevé. Une annulation restaure les objets, les portes, les appuis et la progression, y compris après changement de salle. Les entrées sont bloquées pendant les animations et après WIN/GAME_OVER. Les panneaux de victoire et de défaite attendent la dernière image. Annuler, recommencer ou changer de niveau invalide toutes les anciennes animations.
