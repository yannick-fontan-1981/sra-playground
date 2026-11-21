# SS13 — Contrat 0.1.0

## Duo, commandes et objectif

**L’Ancre Verte** associe le Voleur vert (`thief`, couleur 14, symbole de carte `T`) et le Magicien violet (`wizard`, couleur 15, symbole `Z`). Le Voleur est sélectionné initialement. Chaque salle possède deux destinations ; les deux héros doivent les occuper simultanément. Un héros arrivé reste jouable.

ACTION1–4 désignent nord, sud, ouest, est. ACTION5 active les reflets géométriques. ACTION6 sélectionne à partir de coordonnées pixel entières entre 0 et 63. La sélection ne fait avancer ni les circuits, ni l’eau, ni les monstres. Les données privées du moteur ne sont pas transmises dans les observations.

## Voleur : un pas, une traction

Un pas volontaire du Voleur vers une case libre entraîne exactement l’occupant adjacent situé derrière lui. La cible entre dans la case qu’il quitte. Les caisses, miroirs, monstres et le Magicien sont tractables. Le deuxième élément d’une file reste en place. Le Voleur ne pousse aucun occupant devant lui.

Un départ perpendiculaire peut lâcher une cible. Une transposition, un reflet ou une poussée de presse déplace le Voleur sans déclencher de traction. Le Magicien entraîné ne lance aucun sort.

La traction et la marche sont refusées atomiquement si l’arrivée volontaire d’un héros ou d’un miroir n’a pas d’appui. Une commande modifiée après un pas valide peut toutefois retirer une plateforme sous un personnage : cette conséquence hydraulique reste un danger réel et annulable.

## Magicien : première cible et axes

Une flèche recherche la première caisse, le premier monstre ou le Voleur dans la direction choisie. Le Magicien échange sa place avec cette cible. Sans cible, il tente un pas normal. Il ne pousse pas et ne peut échanger avec un miroir ou un appui immergé.

Le rayon traverse l’eau ; murs et portes fermées l’arrêtent. Les faces blanches des miroirs le font tourner à angle droit, leurs dos noirs le bloquent. Plusieurs miroirs peuvent relayer la visée. Une boucle montre son parcours puis fait clignoter le Magicien sur place, sans mouvement du monde.

Le remplacement réciproque conserve le poids sur les deux cases. Il peut donc relayer une commande ou échanger un monstre à distance. Il conserve aussi le nombre d’occupants de chaque île : un échange seul ne transporte pas d’occupant supplémentaire vers une autre rive.

## Reflets et miroirs

Espace/X, ACTION5, active les miroirs quel que soit le héros sélectionné. Chaque miroir examine le premier occupant de ses deux axes. Le plus proche est choisi avant toute validation de la destination du plus éloigné. À distance égale, les occupants échangent leurs places.

L’arrivée se trouve à distance égale sur l’autre axe. Les conflits de trajectoires et arrivées effectivement bloquées refusent le reflet. Une cible éloignée dont l’arrivée serait bloquée ne doit pas annuler celle qui a réellement priorité. Le dos noir des miroirs responsables d’une obstruction diagnostiquée clignote rouge ; la diagonale reste blanche.

Les héros, caisses et monstres se reflètent. Les miroirs eux-mêmes et les appuis immergés ne sont pas des cibles d’ACTION5. Un autre miroir sur le trajet géométrique constitue un obstacle ; seul le rayon du Magicien peut relayer plusieurs faces.

Le Voleur peut tracter un miroir sans modifier son orientation. Sa nouvelle position modifie la visée du Magicien et les destinations des reflets. Les prévisualisations sont un plus gris clair pour un héros et un contour carré gris clair pour une caisse. Aucun aperçu permanent de traction ou de transposition n’est ajouté.

## Eau, poids et presses

Une caisse envoyée dans l’eau sans appui coule et devient un appui fixe marron avec un X cyan. Il porte les héros et les objets mais ne se tire plus, ne se reflète plus et n’est plus une cible de transposition. Un monstre dans l’eau disparaît ; un héros sans appui est perdu. Un miroir ne doit pas être tiré volontairement vers une case sans appui.

Un bouton accepte le poids d’un héros, d’une caisse, d’un monstre ou d’un miroir. Tous les boutons d’un même circuit doivent être occupés. Les repères colorés relient commandes et dispositifs. Selon le circuit, une pression ouvre ou ferme une porte et déploie ou retire une plateforme.

Une porte qui se ferme agit comme une presse dans la direction de son repère. Elle déplace une file d’occupants ; si la poussée est bloquée, elle peut écraser l’occupant de sa propre case. Les capacités des héros ne se déclenchent pas pendant cette poussée.

Les cascades se stabilisent avant la résolution définitive de l’eau. Une caisse poussée sur un bouton peut ainsi déployer la plateforme sous le héros poussé pendant la même action. Les appuis fixes sont conservés lors d’une réactivation hydraulique, conformément à la série SS ; la destruction d’appuis de certaines sources n’est pas importée.

## Monstres

Les monstres noirs marqués d’un X rouge attaquent leurs voisins orthogonaux après une action effective. Une diagonale ne constitue pas un contact. Tous les coups de la vague sont simultanés : un monstre qui meurt frappe encore pendant cette même vague. Deux monstres adjacents s’éliminent mutuellement, et un héros voisin peut mourir au même moment.

Les monstres peuvent servir de cibles et de poids vivants. Les éliminer n’est pas toujours utile : le niveau 5 exige de conserver son gardien sur une commande. Une sélection ou une action refusée ne déclenche aucun combat.

## Pixels, animations et annulation

Image 64 × 64, grille 20 × 20, cases 3 × 3, origine(2,2), palette de seize couleurs. L’agrandissement garde les pixels nets. Les miroirs se dessinent au-dessus des boutons pour préserver la lisibilité de leurs faces.

Marche, traction, échange, reflet, presse et plateforme utilisent trois images par phase ; les combats en utilisent cinq. Les durées font partie de l’observation. Les actions ordinaires attendent la fin de la séquence. Annuler, Recommencer, Repartir et le changement de niveau interrompent proprement une animation. Les panneaux terminaux attendent sa dernière image. La réduction des animations est respectée.

Annuler restaure l’action entière, y compris les circuits, le combat, les appuis et un éventuel changement de niveau. Les deux destinations doivent être occupées en même temps ; la dernière salle terminée affiche VICTORY.

## Tutoriel et frontière de l’agent

Le niveau 1 propose quatorze découvertes : marche, sélection, traction, traction du partenaire, échange d’objet, échange des héros, visée déviée, miroir déplacé, appui créé, reflet, circuit, presse, monstres et destinations.

Elles sont détectées dans les sprites et les images intermédiaires publics. Elles restent acquises après Annuler ; Recommencer, Repartir ou changer de niveau réinitialise le suivi. Le parcours d’auteur démontre les quatorze, mais certaines expériences pédagogiques ne sont pas imposées à toutes les solutions possibles.

Le bundle réunit seulement `core`, `levels`, `level-info`, `tutorial` et `browser`. Les observations exposent les images, durées, actions disponibles, progression et état terminal. Les cartes d’auteur, étapes sémantiques, solveurs et témoins restent dans les outils de développement ; ils ne sont ni affichés au joueur ni transmis à SRA.
