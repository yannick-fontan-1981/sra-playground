# SS15 — Contrat du laboratoire 0.1.0

## Monde et objectif

Une salle contient exactement un Magicien et un Barde, ainsi que deux destinations. La victoire locale exige que les deux destinations soient occupées simultanément par des héros vivants. Le moteur utilise une grille logique de 20 × 20 cases ; une case occupe 3 × 3 pixels, à partir du pixel (2,2), dans une image 64 × 64 à seize couleurs. Une carte rectangulaire plus petite est centrée avant le rendu. Les coordonnées des dispositifs d’un `LevelSpec` désignent la carte source avant ce centrage.

Le Magicien violet, indice 15, est le premier héros et commence actif. Le Barde est magenta, indice 6. Un pixel blanc sur un bras de leur croix indique le héros actif et sa direction. Le sol est gris 3, le mur gris sombre 4, l’eau bleue 9, la caisse brune 13, les destinations jaunes 11. Les indices exacts et leurs couleurs sont définis par `PALETTE` dans le moteur.

## Actions publiques

| Action | Effet |
| --- | --- |
| ACTION1 | Nord |
| ACTION2 | Sud |
| ACTION3 | Ouest |
| ACTION4 | Est |
| ACTION5 | Reflets géométriques de tous les miroirs |
| ACTION6 avec `{x,y}` | Sélection du héros vivant présent au pixel indiqué |

ACTION6 demande des coordonnées entières comprises entre 0 et 63. Les pixels de bordure et les cases sans héros ne changent pas la sélection. Une sélection ne déclenche ni mouvement d’objet, ni stabilisation des dispositifs, ni combat. Les identifiants ou coordonnées invalides lèvent une erreur avant mutation.

Les commandes de session `undo`, `reset`, `restart` et `selectLevel` sont distinctes de ces six actions. Une sélection réelle est annulable. Un refus peut mettre à jour l’orientation et le signal de refus, mais ne déplace pas les occupants et ne fait pas avancer le combat. Les avertissements de conflit entre miroirs n’ajoutent pas d’entrée d’annulation.

## Magicien : échange dirigé

Une direction lance une recherche depuis le Magicien vers la première caisse, le premier monstre ou le Barde. Si une cible est atteinte, leurs positions sont échangées simultanément. Les cases d’eau ne bloquent pas la visée. Les murs et portes fermées l’arrêtent.

La face blanche d’un miroir dévie le rayon de 90 degrés. Le dos noir l’arrête. Plusieurs miroirs peuvent relayer le même rayon. Le miroir et l’appui immergé ne sont jamais des cibles d’échange. Un rayon qui revient en boucle sur le Magicien produit une animation de son trajet puis deux clignotements ; les positions restent inchangées. Ce retour ne devient pas un pas ordinaire.

Lorsqu’aucune cible n’est atteinte et qu’aucune boucle n’est détectée, le Magicien essaie de marcher d’une case dans la direction demandée. Il ne pousse aucun objet. La case doit être libre et praticable. Remplacer un héros ou une caisse sur une commande conserve immédiatement le poids à cet emplacement ; la substitution réciproque n’impose pas de relâchement intermédiaire du circuit.

L’échange avec le Barde est un déplacement forcé de celui-ci : les objets autour de son ancienne position restent en place. Un Magicien déplacé par un autre mécanisme ne relance pas de rayon.

## Barde : chant carré avant le pas

La zone de chant est le carré de 5 × 5 centré sur la position du Barde **avant** son pas, soit `max(abs(dx), abs(dy)) <= 2`. Les coins sont inclus. Les murs intermédiaires ne coupent pas cette portée. Quand le Barde est actif, son périmètre est dessiné en pointillés magenta.

Le Barde avance d’une case et essaie de transporter dans la même direction les caisses, monstres, le Magicien et les appuis immergés présents dans cette zone. Le moteur résout ensemble les dépendances : un occupant peut suivre un autre occupant qui libère sa case durant le même chant. Un membre retenu par un mur, une porte fermée ou un occupant qui ne part pas reste en place ; les autres peuvent avancer. Ces butées permettent de changer les écarts entre ressources.

Le Barde doit lui-même pouvoir avancer. S’il est bloqué, toute l’action est refusée. Une arrivée volontaire sans appui pour un des héros, ou un chant retirant l’appui d’un miroir, refuse également toute l’action. En revanche, la désactivation ultérieure d’une plateforme hydraulique peut produire une noyade après un mouvement valide.

Les miroirs ne suivent jamais le chant. Le Magicien entraîné par le Barde ne lance pas de rayon. Le Barde déplacé par échange, reflet ou presse ne chante pas. Aucun des deux héros ne dispose d’une poussée ou d’une traction volontaire supplémentaire.

## Eau, caisses et appuis

Une caisse arrivant dans une eau sans support devient un appui immergé permanent. Elle cesse alors d’être une caisse sèche : le Magicien ne peut plus l’échanger et elle ne peut plus servir de charge sèche sur une commande au sol. Son glyphe alterne brun et cyan. Une autre caisse peut la traverser sans couler.

Le Barde peut faire glisser un appui libre d’une case d’eau à une autre. Un appui ne monte jamais sur le sol sec et ne fusionne pas avec un autre appui. Les dépendances permettent de déplacer ensemble une rangée d’appuis ou une caisse au-dessus d’appuis qui se déplacent.

Un appui est ancré si un héros se tient dessus avant le chant, ou si le Barde va arriver dessus. L’appui reste alors à sa position pendant le déplacement des autres membres. L’ancrage concerne les deux héros, et ne les transporte pas automatiquement avec l’appui.

Un monstre qui finit dans l’eau sans support disparaît. Un héros sans support meurt. Une plateforme hydraulique, contrôlée par un circuit, peut temporairement rendre une case d’eau praticable. Après une poussée forcée, les circuits hydrauliques se stabilisent avant de résoudre les occupants concernés. Si un poids disparaît ensuite et retire la plateforme sous un héros, cette conséquence reste fatale.

## Miroirs : deux usages distincts

Les directions du Magicien utilisent les miroirs comme coudes du rayon d’échange. ACTION5 active un autre mécanisme : le transfert géométrique entre les deux bras blancs de chaque miroir, à distance égale du miroir.

Pour chaque miroir, le moteur cherche le premier occupant sur chacun de ses deux bras. L’occupant le plus proche est prioritaire. Si les deux distances sont égales, les deux occupants s’échangent symétriquement. Le choix de la source précède la validation de son arrivée : un occupant plus lointain qui ne bouge pas ne fait pas annuler une arrivée proche valide.

Tous les miroirs participent à la même action. Les demandes incompatibles, collisions ou trajets bloqués refusent le transfert global. Les prévisions grises montrent une croix pour un héros, un contour carré pour une caisse ou un monstre. Elles sont rendues sous les vrais occupants et les miroirs. Le dos d’un miroir impliqué dans un conflit peut clignoter en rouge ; sa diagonale blanche reste visible.

Une réflexion ne déclenche pas les capacités des héros transportés. Une caisse réfléchie dans l’eau devient un appui ; l’auteur doit distinguer cette consommation de ressource d’un échange qui la conserve sèche.

## Commandes, portes et presses latérales

Un circuit est actif lorsque tous ses boutons portent un héros vivant, une caisse, un monstre ou un miroir. Une presse fermée superposée à un bouton compte également comme poids dans le moteur ; les cartes SS15 séparent les boutons des presses pour conserver une lecture directe.

Chaque presse possède une direction et un mode `closedWhen: pressed | released`. À la transition ouverte → fermée, elle pousse l’occupant de sa case ainsi que la chaîne continue devant lui d’une case dans sa direction. Cette poussée peut déplacer un miroir. Si la chaîne ne peut pas avancer à cause du terrain ou d’une autre porte fermée, seul l’occupant de la presse est écrasé. Les portes et plateformes se recalculent jusqu’à un état stable ; un cycle instable refuse l’action.

Le bouton exposé est **opaque** : fond gris 3, plus rose 7 et centre de la couleur du circuit. Ce fond masque l’eau et le périmètre du chant. Les prévisions grises se superposent aux dispositifs, mais restent sous les occupants et les miroirs. Une presse simple présente un centre **noir 5 quand elle est fermée** et **gris 3 quand elle est ouverte**. Les accents indiquent son circuit et sa direction. Une presse ne reçoit un glyphe de bouton que si la carte prévoit explicitement un bouton sous elle. Les vrais occupants masquent les dispositifs ; des marques d’occupation restent visibles sur leurs coins. La diagonale et le dos des miroirs gardent la priorité de dessin.

## Monstres et fin d’action

Après une action de déplacement acceptée et la stabilisation des circuits, les attaques se résolvent simultanément entre voisins orthogonaux. Un monstre tue un héros voisin. Deux monstres voisins s’éliminent mutuellement, mais un monstre éliminé dans cette même vague attaque tout de même le héros adjacent. Une diagonale ou une distance de deux cases ne déclenche pas d’attaque.

La disparition de monstres peut relâcher des commandes ; les conséquences sont stabilisées dans la même action. Les sélections et refus n’offrent pas de tour de combat gratuit. La victoire est évaluée après les conséquences de l’action, jamais avant une attaque ou une perte de support.

## Animations et session

La session expose chaque image intermédiaire et sa durée. Les marches, chants et poussées montrent les translations d’un puis de deux pixels avant la case finale. Les échanges et reflets ont trois images, avec trajet lumineux et transfert. Un combat utilise cinq images. Un changement de porte sans déplacement produit une image ; le retour d’un rayon possède une durée qui dépend du nombre de segments de son circuit. La dernière durée vaut zéro. Lors d’un changement automatique de salle, l’image finale de la salle terminée précède celle de la nouvelle salle.

La session mémorise la salle, l’état et les salles terminées pour l’annulation. Le chargement d’une campagne valide toutes les cartes et leurs circuits initiaux avant de l’accepter. Terminer une salle charge la première salle non terminée ; terminer les huit donne `WIN`. Une mort donne `GAME_OVER`.

L’interface bloque les commandes de jeu pendant une animation, mais Annuler, Recommencer, Repartir et le changement de salle interrompent proprement les images en attente. Une génération d’animation empêche un ancien rappel de repeindre la nouvelle salle. La préférence de réduction des animations supprime les attentes. Les panneaux de mort ou de victoire apparaissent après la dernière image.

## Tutoriel et frontière avec l’agent

Les identifiants des vingt découvertes sont : `select`, `move`, `wizard-swap`, `wizard-partner`, `wizard-bend`, `relay-weight`, `bard-song`, `partner-song`, `selective-song`, `diagonal-song`, `wall-song`, `release-by-swap`, `platform`, `support-slide`, `support-anchor`, `mirror`, `gate`, `press`, `monster`, `goals`.

Le suivi utilise seulement la salle affichée, les images successives et le compteur public de salles terminées. Il distingue la troisième image du mouvement volontaire des cascades qui suivent ; il ne doit pas attribuer un chant à un déplacement forcé ou une presse à un combat. Une découverte reste acquise après Annuler, mais Recommencer et Repartir réinitialisent le suivi de l’atelier.

L’observation publique contient uniquement : `gameCode`, `frame`, `frames`, `frameDurationsMs` lorsqu’il existe, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. Aucun état sémantique interne, objet de planification, circuit caché, témoin, commande d’auteur ou résultat du solveur n’est transmis à SRA. Les outils de validation privés ne démontrent pas une réussite autonome de l’agent.
