# SS08 — La Double Transposition : contrat du jeu

## Personnages, grille et objectifs

Une campagne de huit cartes, ordonnée depuis v0.2.0 comme les anciennes salles 2, 3, 4, 1, 5, 6, 7 et 8. Le lancement commence au nouveau niveau 1 ; l’atelier guidé complet se trouve au niveau 4. Chaque carte contient exactement un Marchand (`M`, palette 12), un Magicien (`W`, palette 15) et deux destinations. La victoire d’une salle exige les deux destinations occupées simultanément par les héros vivants. Perdre l’un des héros provoque GAME_OVER ; annuler restaure l’action entière.

Grille logique de 20 × 20 cases au maximum, centrée dans une image ARC de 64 × 64 pixels. Une case fait exactement 3 × 3 pixels ; l’origine est (2,2). L’agrandissement CSS conserve les pixels nets. La palette reste celle des précédents laboratoires : sol gris, mur gris foncé, eau bleue, caisse marron, appui marron marqué d’un X cyan, bouton + rose, porte carrée rose, destination jaune, miroir blanc à dos noir, monstre noir marqué d’un X rouge.

## Actions

| Action | Effet |
|---|---|
| ACTION1–4 | Haut, bas, gauche, droite, selon le personnage sélectionné. |
| ACTION5 | Reflet géométrique de tous les miroirs, identique à Espace/X. |
| ACTION6 | Sélection par coordonnées entières de l’image 64 × 64 ; ne déclenche aucun mouvement ni attaque. |

Le Marchand marche et pousse au maximum un occupant. Une file de deux occupants bloque sa poussée. La marche ou poussée volontaire ne noie pas un héros et ne détruit pas un miroir ; une presse ou un reflet peut le faire.

Le Magicien vise avant de marcher. Il échange sa place avec le premier bloc, monstre ou compagnon rencontré. La visée traverse l’eau et les appuis ; elle est bloquée par les murs, les portes fermées et le dos d’un miroir. La face blanche tourne la visée de 90°. Plusieurs rebonds sont possibles. Si le rayon revient au Magicien ou boucle, l’action est refusée. Sans cible et sans boucle, un pas normal est tenté. Le Magicien ne pousse pas. Une poussée forcée ne provoque pas de nouvel échange automatique.

Un échange est réciproque et conserve l’occupation des deux cases : remplacer un héros par une caisse sur un bouton le maintient donc enfoncé. Un monstre peut ensuite mourir et libérer ce poids.

## Deux mécanismes distincts pour les miroirs

La visée directionnelle du Magicien peut rebondir sur plusieurs miroirs. Le reflet géométrique ACTION5 fonctionne miroir par miroir et ne traverse pas un autre miroir.

Pour chaque miroir, les premiers occupants des deux bras de sa face sont comparés par distance **avant** de vérifier leurs arrivées. Le plus proche est choisi ; le plus éloigné reste immobile et son arrivée bloquée ne peut pas annuler celle du plus proche. À distances égales, les deux échangent leurs places. Les trajets sélectionnés sont ensuite vérifiés globalement : arrivée occupée, obstacle ou conflit de destinations refusent l’ensemble. Il n’y a ni duplication, ni fusion de copies.

Un miroir est dessiné au-dessus des repères des boutons et de leur circuit. Sa diagonale blanche et son dos noir restent entièrement visibles lorsqu’il occupe une plaque, y compris pendant une poussée.

Prévisualisation géométrique : + gris clair pour un héros, contour carré gris clair pour une caisse. Aucun aperçu de poussée ni cible directionnelle permanente.

## Eau, portes et attaques

Une caisse plongée dans l’eau devient un appui permanent et cesse d’être une cible ou un objet mobile. Une plateforme hydraulique déployée porte les occupants ; son retrait applique à nouveau les règles de l’eau. Un bouton de circuit réagit au poids d’un héros, bloc, miroir ou monstre. Plusieurs boutons d’un circuit doivent être occupés ensemble.

La fermeture d’une porte-presse pousse toute la file depuis sa case. Si un obstacle bloque cette file, seul l’occupant sur la presse est écrasé. Circuits, plateformes et flottabilité sont stabilisés avant les attaques ; les disparitions de monstres peuvent déclencher une nouvelle cascade.

Les monstres attaquent leurs voisins orthogonaux simultanément. Deux monstres adjacents s’éliminent mutuellement, tout en frappant les héros adjacents pendant cette même vague.

## Animation et observations

Les déplacements, poussées, échanges, reflets, mouvements de presse et changements de plateformes produisent trois images. Un combat en produit cinq : préparation, avancée, impact, disparition, résultat. Les séquences peuvent s’enchaîner ; chaque durée est explicite et l’image finale a une durée de 0. L’interface attend le dernier état avant d’afficher victoire ou défaite. Annuler reste possible pendant une animation et restaure toute la cascade.

`DuoPuzzleSession` expose les pixels, les actions autorisées, l’état, les compteurs et la progression. Les plans de visée, objets, circuits, parcours et solutions restent hors de l’observation publique. Les outils d’auteur ne sont pas embarqués dans le HTML.

## Sources et portée des adaptations

Le point de départ est l’index Crossovers demandé par l’utilisateur : <https://sinkingstarwalkthrough.com/fr/crossovers/>. Les références exactes figurent dans `reference/levelN-design.json` et dans l’interface. La géométrie et les parcours de SS08 sont adaptés au Marchand/Magicien et aux règles ARC de la série. Les empilements verticaux, dragons, clones et échanges directs avec un miroir du jeu source ne sont pas introduits.

La validation rejoue des parcours complets et vérifie le contrat des observations et des animations. Les preuves de nécessité documentées portent sur des mécanismes précis ; elles ne prétendent pas certifier une difficulté objective, une solution unique, une longueur optimale ou la réussite d’un agent SRA autonome.
