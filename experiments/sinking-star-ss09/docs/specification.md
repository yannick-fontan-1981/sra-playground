# SS09 — contrat de jeu 0.1.0

## Personnages et grille

Chaque salle comporte exactement un Marchand orange (12), un Barde magenta (6) et deux destinations jaunes. La victoire exige les deux destinations occupées par les deux héros vivants. La mort d’un héros provoque GAME_OVER. La campagne commence au niveau 1 avec son tutoriel déplié ; chaque salle est sélectionnable.

La grille logique mesure au maximum 20 × 20 cases, centrées dans un canvas de 64 × 64. Chaque case occupe 3 × 3 pixels, origine (2,2). Palette, eau bleue, sol gris, murs gris foncé, caisses marron, appuis marron avec X cyan, boutons roses, portes roses, miroirs blancs/noirs et monstres noirs/rouges reprennent la série.

## Actions et chant

ACTION1–4 : haut, bas, gauche, droite. Le Marchand pousse au plus un occupant. Une file de deux occupants bloque sa poussée volontaire ; les presses possèdent leur propre poussée en file.

Le Barde marche et chante ensemble. La sélection se fait avant le pas : caisses, monstres, appuis et Marchand à distance de Chebyshev au plus 2, diagonales comprises. Les murs ne réduisent pas cette portée. Chaque membre tente le même déplacement d’une case, simultanément. Les dépendances d’occupation sont résolues jusqu’à stabilisation. Un membre bloqué reste en place ; un Barde bloqué annule toute l’action.

Le Marchand entraîné ne pousse pas. Les miroirs ne chantent pas. Une poussée du Marchand, un reflet, une presse ou ACTION6 ne déclenche jamais de chant supplémentaire. Si le mouvement volontaire noierait un héros ou retirerait l’appui d’un miroir, l’action est refusée avant les conséquences. Cette convention de sécurité est explicite ; les attaques et les retraits hydrauliques après une action valide peuvent tuer.

ACTION6 sélectionne un héros par coordonnées de pixels entières de 0 à 63 ; son centre de cellule (x,y) est (3+3x,3+3y). La sélection seule ne fait pas avancer le monde.

## Appuis et eau

Une caisse qui entre dans l’eau sans appui devient un appui permanent. Le chant peut faire glisser cet appui d’une eau à une autre, en laissant de l’eau derrière. Un appui ne remonte pas sur le sol. Un appui sous un héros vivant et l’appui à l’arrivée du Barde restent ancrés pendant le pas. Un monstre sans support se noie. Un reflet ou une presse peut noyer un héros ou détruire un miroir.

Les plateformes hydrauliques dépendent de leur circuit. Le retrait réévalue l’eau et les occupants. Les appuis permanents survivent à ce retrait.

## Reflets

ACTION5 / Espace / X active les reflets sans chant. Un miroir relie les deux bras de sa face blanche, à distance égale. Le premier occupant de chaque bras est comparé par distance avant validation de la destination : seul le plus proche est choisi, ou les deux à égalité. Un candidat éloigné bloqué n’empêche pas le proche de passer. Les trajectoires retenues sont ensuite vérifiées globalement. Les appuis ne sont pas reflétés. Aucun dédoublement n’est ajouté.

La prévisualisation vaut + gris clair pour les héros, contour gris clair pour les caisses. Aucun fantôme de poussée directionnelle. L’aura pointillée magenta est visible lorsque le Barde est sélectionné, sous les glyphes, et suit ses images de déplacement. Les miroirs sont dessinés au-dessus des boutons.

## Circuits, presses et monstres

Tous les boutons d’un circuit doivent porter un poids. Héros, caisses, monstres, miroirs et portes fermées peuvent peser selon le contrat des dispositifs. À sa fermeture, une presse pousse la file contiguë dans son sens. Si la file est bloquée, seul l’occupant de la presse est écrasé. Les circuits et plateformes sont stabilisés après les déplacements ; une oscillation fait refuser l’action entière.

Les monstres attaquent leurs voisins cardinaux simultanément, après la stabilisation. Deux monstres adjacents meurent ensemble et attaquent encore pendant cette vague. Les diagonales sont sûres. La disparition d’un poids peut déclencher de nouvelles presses.

## Présentation et observation

Mouvements, poussées, chants, reflets, presses et plateformes : trois images. Combat : cinq images (préparation, avancée, impact, disparition, résultat). Les cascades sont concaténées avec leurs durées explicites. L’image finale n’a pas de délai. Les panneaux terminaux attendent la dernière image.

Les nouvelles actions sont bloquées pendant la lecture. Undo, Reset, Restart et changement de niveau annulent les anciens callbacks. Undo restaure l’action entière, y compris une cascade ou un changement de salle.

L’observation publique fournit uniquement pixels, palette, commandes, état, progression et durées. Plans internes, données d’auteur, solveurs et témoins restent hors du bundle jouable. Le tutoriel utilise uniquement les pixels publics. La vérification HTML automatisée emploie Happy DOM et le buffer du canvas, sans revendiquer un navigateur natif.
