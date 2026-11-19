# SS07 — Spécification 0.1.0

## Contrat de la campagne

**La Distance Dérobée** contient huit niveaux. Chaque carte déclare exactement un Marchand, un Voleur et deux destinations. Le compilateur vérifie ce contrat ; `mode` est omis ou vaut `duo`. Une salle est terminée lorsque les deux héros vivants occupent simultanément les deux destinations.

Les cartes rectangulaires, de dimensions maximales 20 × 20, sont centrées dans la grille logique 20 × 20. Les coordonnées des objets de `LevelSpec` précèdent ce centrage. Chaque cellule occupe 3 × 3 pixels ; la grille commence au pixel `(2,2)` dans le canvas 64 × 64.

## Deux rôles complémentaires

**Marchand.** Une direction déplace le héros d’une case. Si une pièce mobile occupe l’arrivée, il pousse exactement cette pièce d’une case, à condition que la suivante l’autorise. Deux pièces contiguës bloquent la poussée. Les caisses, les miroirs, le compagnon et les monstres sont mobiles ; déplacer un monstre peut provoquer un combat immédiatement après le mouvement.

**Voleur.** Une direction demande une case d’arrivée libre. Si une pièce mobile se trouve dans la case immédiatement derrière lui, elle entre dans la case qu’il quitte. Cette traction est automatique, limitée à une pièce et sans propagation à une file. Le Voleur ne pousse pas. Un pas perpendiculaire laisse l’ancienne pièce arrière en place, mais peut tirer une autre pièce située derrière ce nouveau pas.

Il n’existe ni touche d’accrochage ni état persistant « attaché ». Les appuis immergés restent fixes. Un déplacement volontaire refusé ne déplace pas partiellement les acteurs et ne déclenche pas le combat. Marcher ou pousser volontairement ne peut pas noyer le compagnon ni détruire un miroir. Les effets forcés des reflets, des presses et des plateformes peuvent être mortels. Aucun déplacement forcé ne déclenche de traction bonus du Voleur.

## Eau, boutons et presses

Une caisse envoyée dans une case d’eau sans support devient un appui fixe. Un héros peut ensuite marcher dessus. Un miroir ou un monstre envoyé dans l’eau disparaît ; un héros qui perd son support meurt.

Un bouton est maintenu par un héros, une caisse, un miroir ou un monstre. Un circuit comportant plusieurs boutons demande que tous soient maintenus. Une porte peut se fermer lorsque le circuit est pressé ou lorsqu’il est relâché, selon `closedWhen`.

Une porte-presse agit à sa fermeture : elle pousse d’une case l’occupant et sa file contiguë dans la direction déclarée. Cette capacité appartient à la presse, pas au Marchand. Si un mur ou une porte fermée bloque la file, l’occupant de la presse est écrasé. Les déplacements peuvent changer d’autres boutons ; les circuits sont résolus jusqu’à stabilisation. Une cascade cyclique est refusée et l’action reste atomique.

Une porte-plateforme occupe une cellule d’eau et suit `activeWhen`. Déployée, elle fournit un support. Rétractée, elle laisse l’eau : une caisse posée dessus devient alors un appui permanent ; un héros sans autre support tombe. SS07 emploie ces plateformes au niveau 8.

## Miroirs et combat

Un miroir garde son orientation lorsqu’il est poussé ou tiré. Sa face blanche définit deux axes perpendiculaires. Espace / ACTION5 transfère les premiers occupants visibles de ces axes à égale distance de l’autre côté. Tous les miroirs participent à la même action. Murs, portes fermées et autres miroirs interrompent les rayons. Les destinations occupées doivent se libérer dans ce même transfert ; une collision ou un conflit invalide le reflet entier.

Un départ par reflet est particulièrement utile au Voleur : il peut laisser un miroir sur un bouton sans le tirer. Le transfert simultané de deux occupants est une propriété du reflet ; SS07 n’ajoute aucune action spéciale d’échange de personnages.

Après un mouvement accepté et la résolution des circuits, les monstres frappent leurs voisins cardinaux. Un héros adjacent meurt. Deux monstres adjacents se frappent simultanément et disparaissent. Le retrait d’un monstre peut libérer un bouton et provoquer une nouvelle résolution des portes. Une sélection seule ou une action refusée ne fait pas avancer ce cycle.

## Actions et observation publique

| Identifiant | Commande | Données |
|---|---|---|
| ACTION1 | Haut | Aucune |
| ACTION2 | Bas | Aucune |
| ACTION3 | Gauche | Aucune |
| ACTION4 | Droite | Aucune |
| ACTION5 | Reflet global | Aucune |
| ACTION6 | Sélection d’un héros | `{x,y}` : pixels entiers du canvas 64 × 64 |

ACTION6 ne reçoit pas des coordonnées de cellule ni des coordonnées CSS. Cliquer une cellule sans héros ou le héros déjà sélectionné ne change rien. Changer de héros est annulable, mais ne déclenche aucun mouvement physique, aucune presse ni aucun combat.

`DuoPuzzleSession` expose `observe()`, `action(id,data?)`, `nextHero()`, `undo()`, `reset()`, `restart()` et `selectLevel(level)`. La sélection de niveau est numérotée de 1 à 8. Une salle terminée conduit à la première salle non terminée ; la progression peut donc se faire hors ordre. Undo restaure aussi la sélection, les effets en cascade et une transition de salle. Reset recommence la salle courante ; restart efface la progression de la campagne.

L’observation contient `gameCode: 'SS07'`, `frame`, `frames`, `frameDurationsMs` lorsqu’une action est animée, `palette`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted` et `defaultFps`. Les états sont `NOT_FINISHED`, `GAME_OVER` et `WIN`. Les positions sémantiques, plans de reflet, phases internes et solutions ne sont pas des données publiques de l’agent.

## Rendu et animation

| Élément | Code visuel |
|---|---|
| Marchand / Voleur | + orange, palette 12 / + vert, palette 14 |
| Sol / mur / eau | Gris, palette 3 / gris foncé, 4 / bleu, 9 |
| Caisse / appui immergé | Marron, 13 / marron avec X cyan, 10 |
| Bouton / porte | + rose / carré rose, palette 7 ; accent du circuit |
| Destination | Contour carré jaune, palette 11 |
| Miroir | Diagonale blanche et dos noir |
| Monstre | Noir avec X rouge |
| Prévisualisation de reflet | + gris clair pour un héros ; contour carré gris clair pour une caisse, palette 1 |

Les mouvements ordinaires n’ont pas de prévisualisation. Marche, poussée, traction et presse avancent en **trois images**, à un puis deux pixels avant l’arrivée à trois pixels. Le reflet et les changements de plateforme ont également trois images. Le combat comporte **cinq images** : préparation, attaque, impact, disparition et état final. Une action peut enchaîner plusieurs phases.

Le consommateur doit jouer toutes les images et leurs durées. `defaultFps` est un repli, pas une raison d’écraser `frameDurationsMs`. La dernière image a une durée nulle ; une transition de niveau ajoute l’image de la nouvelle salle. Les entrées de jeu sont suspendues pendant l’animation, et les panneaux de victoire ou de défaite attendent sa fin. Undo et les commandes de réinitialisation invalident les animations précédentes.

Le moteur utilise uniquement des supports 2D : aucun empilement vertical, clonage, feu de dragon ou relais de rayon de miroir à miroir. Les huit niveaux respectent ce périmètre.
