# SS17 — contrat du trio

Version du laboratoire : **0.1.0**. Grille logique jusqu’à 20 × 20 cellules ; une cellule occupe 3 × 3 pixels dans une image de 64 × 64, origine `(2,2)`. Une carte plus petite est centrée. La palette est celle des jeux précédents.

## Personnages et objectifs

Chaque salle exige exactement un Guerrier `W` rouge 8, un Voleur `T` vert 14, un Magicien `Z` violet 15 et trois destinations `g`. L’ordre stable est Guerrier, Voleur, Magicien, indépendamment de leur ordre dans les lignes de carte. Le Guerrier est sélectionné au chargement. `mode: 'trio'` est facultatif ; les autres valeurs sont refusées.

Les trois héros doivent occuper les trois destinations simultanément. Le premier arrivé reste présent et peut être sélectionné ou déplacé. La perte d’un seul héros termine la tentative.

| Rôle | Action directionnelle | Limite |
| --- | --- | --- |
| Guerrier | Marche et pousse toute la file contiguë | Refus atomique si l’extrémité bloque ou si un héros / miroir doit être volontairement envoyé dans l’eau nue |
| Voleur | Marche vers une case libre et tire l’occupant adjacent derrière lui | Ne pousse pas ; ne tire qu’une seule entité |
| Magicien | Échange sa place avec la première cible de sa visée ; sans cible, tente un pas | Cibles : autre héros, caisse, monstre ; miroirs et appuis ne sont pas des cibles |

Caisses, monstres, miroirs et partenaires peuvent être déplacés. Les appuis immergés ne sont plus des entités mobiles. Une poussée, une traction, une transposition, une presse ou un reflet imposé à un héros n’active jamais sa propre capacité.

## Eau et ressources

Une caisse qui arrive dans l’eau sans soutien devient un **appui permanent** marron avec un X cyan. Elle cesse d’être une caisse mobile, ne se tire plus et ne se reflète plus. Un appui porte les héros et les autres pièces ; il reste fixe. Une caisse poussée sur cet appui reste mobile et peut servir à combler la case d’eau suivante.

Une marche volontaire dans l’eau nue est refusée. Une poussée volontaire qui sacrifierait un partenaire ou un miroir est également refusée en entier. Une arrivée forcée par reflet ou presse peut être fatale. Les monstres et miroirs perdus dans l’eau disparaissent ; les monstres ne créent pas d’appui.

Les plateformes hydrauliques portent les occupants lorsqu’elles sont actives. Une caisse déposée sur une plateforme active reste mobile. Au retrait, la caisse devient un appui, le héros tombe, le monstre ou le miroir disparaît. Les appuis déjà créés restent utilisables après réactivation. Cette dernière règle diffère de certaines références du guide et doit être conservée.

## Visée du Magicien

ACTION1–4 lancent la visée dans leur direction lorsque le Magicien est actif. Le rayon atteint la première caisse, le premier monstre ou le premier autre héros ; il ne saute jamais une cible plus proche. Les deux occupants échangent leurs cases simultanément. Sans cible, le Magicien tente une marche ordinaire d’une case : il ne pousse pas ce qui le bloque.

L’eau et les appuis laissent passer le rayon. Les murs et portes fermées l’arrêtent. Une face blanche de miroir dévie le rayon à angle droit ; son dos noir le bloque. Plusieurs miroirs peuvent relayer la même visée. Ces virages appartiennent à la transposition ; ACTION5 conserve ses propres règles ci-dessous.

Un échange conserve l’occupation des deux cases. Il peut maintenir sans interruption un poids sur un bouton, mais ne peut pas augmenter à lui seul le nombre d’occupants d’une île isolée. Une arrivée peut ensuite déclencher une presse, une modification hydraulique ou un combat. Le partenaire transféré ne pousse, ne tire et ne lance aucun sort de manière récursive.

Si la visée boucle, le trajet s’éclaire progressivement jusqu’aux miroirs, puis le Magicien produit deux impulsions blanches à sa place. Aucun occupant ne change de case, aucun combat ni circuit n’avance. Le premier refus peut enregistrer l’orientation du personnage ; répéter une boucle inchangée n’ajoute pas d’annulation. Une boucle par quatre miroirs utilise neuf images et les durées `90 / 90 / 90 / 90 / 100 / 100 / 80 / 100 / 0 ms`.

## Miroirs

ACTION5 active tous les miroirs. Chaque miroir a deux axes sur sa face blanche. Le premier occupant de chaque axe est candidat ; le plus proche est transféré à la même distance sur l’autre axe. À distance égale, les deux candidats échangent leurs places. La destination inutilisable d’un candidat plus éloigné ne bloque pas le transfert du plus proche.

Héros, caisses et monstres sont des cibles. Miroirs et appuis ne le sont pas. Les murs, portes fermées et autres miroirs arrêtent les trajets ; l’eau ne les arrête pas. Les propositions des miroirs se résolvent simultanément et refusent les collisions ou destinations incompatibles. Il n’existe ni duplication ni fusion.

Un plus gris clair annonce l’arrivée d’un héros et un contour carré gris clair celle d’une caisse. Ces indications sont dessinées sous les occupants. Lorsqu’un trajet de réflexion est bloqué par un mur, une porte, une presse, une autre pièce ou un conflit de transferts, les dos des miroirs concernés clignotent deux fois en rouge : rouge, normal, rouge, normal, avec des durées de 110, 70, 110 et 0 ms. La diagonale blanche reste visible. Les miroirs non concernés gardent leur aspect normal. Ce refus ne déplace aucune pièce, ne fait pas avancer le monde et n’ajoute pas d’entrée d’annulation ; la préférence de réduction des animations reste respectée.

## Commandes et portes-presses

Un circuit associe un ou plusieurs boutons à des dispositifs. Tous les boutons du même circuit doivent être occupés ensemble. Héros vivants, caisses, monstres et miroirs servent de poids. Le moteur conserve la compatibilité des circuits avec une porte fermée superposée à un bouton, mais **les cartes SS17 séparent leurs presses et leurs boutons**.

`closedWhen: 'pressed' | 'released'` définit la polarité de la presse. Lorsqu’elle se ferme, elle déplace l’occupant de sa propre case et la file devant lui dans sa direction. Une fermeture sur une case vide ne pousse pas le voisin. Si la file est bloquée, le premier occupant pris dans la presse est écrasé.

`activeWhen: 'pressed' | 'released'` règle les plateformes placées sur l’eau. Les circuits et les déplacements forcés se stabilisent pendant l’action. Les arrivées sur les cases hydrauliques attendent cette stabilisation : un poids livré par reflet peut activer le soutien reçu au même moment. Une oscillation refuse l’action ; une position initiale instable ou fatale invalide la campagne avant son chargement.

## Monstres

Après une action effective et ses premiers réglages, les monstres attaquent tous leurs voisins orthogonaux simultanément. Les diagonales ne sont pas des contacts. Deux monstres adjacents s’éliminent et frappent encore les héros adjacents pendant la même vague. Les trois personnages sont vulnérables, y compris ceux qui ne sont pas sélectionnés.

La disparition d’un monstre peut retirer un poids et provoquer une nouvelle cascade. La sélection et une action refusée ne déclenchent pas de combat. L’ordre des animations conserve ces effets visibles.

## Rendu et animation

Les boutons ont un fond gris opaque, un plus rose et le pixel du circuit au centre. Une presse pure a le centre noir quand elle est fermée, gris quand elle est ouverte. Aucun pixel bleu de l’eau ou d’une prévision ne doit traverser ces fonds. Les marques d’occupation laissent les héros et caisses reconnaissables ; la face et le dos du miroir passent au-dessus des repères.

Marche, poussée, traction et presse avancent de 1, 2, puis 3 pixels sur trois images. Reflet, transposition et plateforme utilisent également trois images. Une transposition montre le rayon, le transfert puis la position stabilisée. Le combat utilise cinq images : préparation, avancée, impact, désagrégation, résultat. Les durées par image sont publiques ; la dernière vaut zéro. Les cascades concatènent leurs phases et la transition de salle conserve une pause avant le plateau suivant.

L’hôte bloque les nouvelles actions pendant la lecture, mais permet Annuler, Recommencer et le changement de salle. Ces opérations invalident les anciens callbacks. Les panneaux de défaite et de victoire attendent la dernière image. La réduction des animations est respectée.

## Session et frontière publique

`TrioPuzzleSession(levels, gameCode = 'SS17')` expose `observe`, `action`, `nextHero`, `undo`, `reset`, `restart` et `selectLevel`. ACTION1/2/3/4 correspondent à N/S/W/E, ACTION5 au reflet, ACTION6 à la sélection par coordonnées de pixels entières de 0 à 63.

Une sélection effective entre dans l’historique sans action du monde. Un clic vide ou sur le héros déjà actif ne crée pas d’entrée. Les erreurs de coordonnées, de niveau ou de campagne sont atomiques. Undo restaure aussi la progression et traverse une fin de salle. Reset restaure la salle et efface sa complétion ; Restart remet la campagne à zéro. Après une salle terminée, la première salle encore inachevée est choisie. WIN exige les huit salles.

L’observation contient uniquement `gameCode`, `frame`, `frames`, `frameDurationsMs`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. Aucun plan de reflet, état sémantique, témoin ou solution n’est transmis à SRA.

La sélection de rôle et les vingt-trois découvertes du tutoriel sont déduites des images publiques. Le suivi ne lit aucune donnée privée de niveau ou de moteur. Aucune découverte n’intervient dans la condition de victoire.
