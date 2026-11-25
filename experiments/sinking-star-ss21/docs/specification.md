# SS21 — Spécification du jeu

## Identité et objectif

**SS21 — Les Quatre Destinations** ouvre les quatuors de la série. Chaque salle contient exactement un **Marchand**, un **Guerrier**, un **Voleur**, un **Magicien** et quatre destinations jaunes. Le Barde est absent. Le Marchand est sélectionné au chargement d’une salle.

Les quatre destinations doivent être occupées simultanément par les quatre héros vivants. Elles ne sont pas attribuées à une couleur particulière. Un personnage arrivé reste sélectionnable et peut repartir. La perte d’un seul héros donne `GAME_OVER` ; l’annulation peut restaurer l’état précédent.

Les huit salles sont définies dans [`src/levels.ts`](../src/levels.ts). La liste des sources et objectifs affichés vient de [`src/level-info.ts`](../src/level-info.ts), et non de données requises pour résoudre le jeu. Le moteur est [`src/core.ts`](../src/core.ts).

## Image et commandes publiques

| Élément | Contrat |
| --- | --- |
| Image | 64 × 64 pixels, palette de 16 couleurs. |
| Grille | 20 × 20 cellules, 3 × 3 pixels par cellule, origine `(2, 2)`. |
| Marchand | Orange, indice de palette `12`. |
| Guerrier | Rouge, indice `8`. |
| Voleur | Vert, indice `14`. |
| Magicien | Violet, indice `15`. |
| Sélection | Le bras blanc du héros actif indique sa direction. |
| `ACTION1` / `ACTION2` / `ACTION3` / `ACTION4` | Nord / sud / ouest / est. |
| `ACTION5` | Reflet géométrique global des miroirs. |
| `ACTION6` | Sélection par coordonnées de pixels `{x, y}` dans le canevas 64 × 64. |

L’observation expose `frame`, `frames`, les durées des images intermédiaires, l’état officiel, les actions disponibles, le niveau courant, le nombre de niveaux terminés et les capacités d’annulation/sélection de niveau. Elle ne fournit pas la carte sémantique, les positions des objets, les circuits ou un plan de solution.

`compileLevel`, `planReflection`, `planSwap` et `traceSwap` servent au moteur et aux outils d’auteur ; leur existence n’autorise pas un agent à les utiliser comme perception. Le tutoriel et les boutons de sélection reconnaissent les personnages dans les pixels de l’observation publique.

## Les quatre capacités

| Rôle | Action volontaire | Limite à comprendre |
| --- | --- | --- |
| Marchand | Avance et pousse au plus une pièce ou un partenaire placé devant lui. | La destination de la pièce doit être libre ; une file de deux occupants le bloque. |
| Guerrier | Avance et pousse toute la file consécutive devant lui d’une case. | Le dernier déplacement doit être possible. Il ne tire pas et ne possède aucune immunité aux monstres. |
| Voleur | Avance dans une case libre et entraîne l’occupant immédiatement derrière lui dans la case quittée. | Il ne pousse pas et ne tire qu’un occupant, même devant une file. Un pas latéral permet de laisser la charge. |
| Magicien | Cherche d’abord une cible dans la direction choisie et échange sa place avec la première caisse, le premier monstre ou le premier partenaire rencontré. | S’il n’y a pas de cible, il tente un pas ordinaire. Un miroir ne constitue pas une cible échangeable. |

Une pièce manipulable peut être une caisse, un miroir, un monstre ou un partenaire. Les appuis immergés ne sont plus des pièces mobiles. Une **capacité n’est déclenchée que par le déplacement volontaire du héros actif** : être poussé, tiré, reflété, échangé ou déplacé par une presse ne provoque pas une seconde capacité du personnage transporté.

### Visée du Magicien

Le rayon traverse l’eau et les cases libres. Un mur, une porte fermée, une presse fermée ou le dos noir d’un miroir l’arrête. Une face blanche le dévie de 90 degrés ; plusieurs miroirs peuvent se succéder. La première cible rencontrée masque les suivantes.

Un rayon qui revient au Magicien ou répète un état de trajet est une boucle : le Magicien reste sur place et l’action ne fait pas avancer le monde. L’animation parcourt les segments dans leur ordre, puis fait clignoter l’origine. La boucle n’est ni un échange réussi ni une marche.

L’échange conserve un occupant à chacune de ses extrémités. Entre deux régions isolées, il réorganise les occupants mais ne permet pas à lui seul de peupler une région vide. Le niveau 6 demande précisément de construire des franchissements physiques pour modifier cette répartition.

## Eau, caisses et plateformes

Une caisse déplacée dans une case d’eau sans soutien devient un **appui fixe**, dessiné avec un X cyan et brun. La transformation est définitive pour la salle : cet appui porte héros et pièces, mais n’est plus poussé, tiré, reflété ou ciblé par le Magicien. Une autre caisse peut circuler dessus avant de combler la case d’eau suivante.

Les déplacements volontaires ordinaires qui noieraient un héros ou feraient perdre un miroir sont refusés. Les transferts et les cascades forcées demandent de vérifier l’arrivée : une chute de héros peut être fatale, un monstre sans soutien disparaît, un miroir sans soutien est perdu. Le moteur règle d’abord les circuits concernés avant de résoudre une case hydraulique dont le soutien peut changer dans la même action.

Le niveau 7 contient la seule plateforme escamotable de la campagne. Tant qu’elle est active, une caisse reste mobile dessus. Lorsqu’elle se retire, la caisse devient un appui. **Cet appui persiste même si la plateforme se réactive ensuite.** C’est le contrat SRA retenu, distinct de la destruction décrite dans certaines énigmes de la source Water ; voir [l’audit](source-audit.md).

## Boutons, circuits et presses latérales

Un bouton est maintenu par un héros vivant, une caisse, un monstre ou un miroir. Tous les boutons d’un même circuit doivent être occupés pour que ce circuit soit actif. Les repères de couleur rendent la relation visible. Une presse fermée peut également maintenir un bouton placé sur sa propre case.

Chaque dispositif déclare sa polarité : une presse peut se fermer quand le circuit est maintenu ou quand il est relâché ; une plateforme peut apparaître dans l’un ou l’autre état. La même commande peut donc ouvrir un sas tout en retirant un soutien voisin. Il faut lire l’effet concret et préparer les relèves.

Une presse pousse **l’occupant de sa propre case au moment de sa fermeture**, dans la direction dessinée. Elle transmet la poussée à la file devant cet occupant. Si la file ne peut pas avancer, l’occupant initial de la presse est écrasé. Une presse déjà fermée ne refrappe pas à chaque pas. Les déplacements provoqués peuvent changer d’autres boutons ; le moteur règle la cascade jusqu’à un état stable.

Une relève conserve une commande pendant un transfert simultané : la caisse ou le partenaire entrant remplace immédiatement celui qui quitte la case. Ce principe est visible dans les niveaux 1, 2 et 5, sans temporisation cachée.

## Miroirs : reflet global et visée déviée

La diagonale blanche d’un miroir distingue sa face du dos noir. Sa translation ne change pas son orientation. L’action `ACTION5` examine les deux bras perpendiculaires de chaque miroir et projette un occupant à la même distance sur l’autre bras.

- Le candidat le plus proche du miroir est prioritaire ; à distance égale, les deux occupants peuvent échanger leurs places.
- Un mur, une porte fermée ou un autre miroir peut bloquer le trajet. Contrairement à la visée du Magicien, cette projection ne se relaie pas à travers un second miroir.
- Tous les transferts prévus sont examinés ensemble. Une arrivée occupée par un élément qui ne part pas, deux destinations incompatibles ou des projections concurrentes d’un même occupant peuvent refuser l’ensemble.
- Un refus n’applique aucun transfert partiel. Les dos des miroirs impliqués peuvent clignoter en rouge, en conservant leur diagonale blanche.
- Les contours gris clairs sont les prévisions publiques des arrivées valides. Un personnage transporté par reflet n’exécute pas sa capacité.

SS21 ne dédouble ni ne fusionne les occupants. Le niveau 3 repose sur le déplacement d’un unique miroir ; le niveau 4 utilise les déviations de la visée magique dans un rectangle de quatre miroirs. Les deux mécanismes restent distincts dans le code et dans le tutoriel.

## Monstres et résolution d’une action

Les monstres restent immobiles lorsque le joueur marche ailleurs. Poussée, traction, échange, reflet et presse sont les seuls moyens de les déplacer. Après une action effective, chaque monstre attaque les héros orthogonalement voisins ; les diagonales ne sont pas un contact. Des monstres orthogonalement voisins s’éliminent dans la même vague, mais peuvent encore toucher un héros adjacent pendant cette vague.

Le moteur règle les changements de circuits, les soutiens et les contacts avant de déclarer la victoire. Une disparition de monstre peut libérer un bouton et provoquer une nouvelle cascade. Sélectionner un personnage ou effectuer une action refusée ne déclenche pas ce règlement physique.

Le quatuor entier est vulnérable, y compris les partenaires non sélectionnés. Le jeu ne possède ni attaque spéciale du Guerrier, ni dragon, ni feu, ni porte conditionnée par le décompte des monstres. Le gardien du niveau 8 doit au contraire rester disponible comme poids.

## Tutoriel : 31 découvertes

Le tutoriel concerne uniquement le niveau 1, **L’école des quatre**. [`src/tutorial.ts`](../src/tutorial.ts) compare les images avant l’action et celles de sa présentation. Il n’accède ni au monde interne ni à une solution. L’ordre ci-dessous sert à choisir le prochain conseil ; les découvertes peuvent être acquises dans un autre ordre.

| Nº | Identifiant | Enseignement et constat reconnu |
| --- | --- | --- |
| 1 | `select` | Changer le héros sélectionné par une sélection publique. |
| 2 | `move` | Observer un déplacement volontaire d’une cellule, distinct d’un échange. |
| 3 | `merchant-push` | Voir le Marchand déplacer l’occupant qui était devant lui. |
| 4 | `warrior-push` | Voir le Guerrier pousser au moins une pièce. |
| 5 | `chain` | Voir une file de plusieurs occupants avancer avec le Guerrier. |
| 6 | `mixed-chain` | Reconnaître un partenaire dans cette file. |
| 7 | `thief-pull` | Voir l’occupant arrière rejoindre la case quittée par le Voleur. |
| 8 | `single-pull` | Tirer la première pièce en laissant la suivante à sa place. |
| 9 | `partner-push` | Déplacer un partenaire par poussée sans activer sa capacité. |
| 10 | `partner-pull` | Déplacer un partenaire par traction. |
| 11 | `release` | Quitter latéralement une pièce voisine sans la reprendre. |
| 12 | `relay-weight` | Reconnaître une relève physique sur un bouton pendant une poussée ou une traction. |
| 13 | `mirror-motion` | Observer la translation d’un miroir pendant une manutention. |
| 14 | `water-support` | Voir apparaître un nouvel appui immergé. |
| 15 | `cross-support` | Marcher sur un appui déjà visible. |
| 16 | `wizard-swap` | Reconnaître l’échange réciproque du Magicien avec une cible. |
| 17 | `wizard-partner` | Réaliser cet échange avec un partenaire. |
| 18 | `wizard-bend` | Observer un échange dont la visée est déviée par un miroir. |
| 19 | `wizard-first` | Échanger avec la cible proche alors qu’une autre se trouve plus loin dans la même ligne libre. |
| 20 | `wizard-water` | Réaliser un échange droit traversant une case d’eau nue. |
| 21 | `wizard-walk` | Voir le Magicien marcher sans échange. |
| 22 | `mirror` | Observer un transfert après l’action globale des miroirs. |
| 23 | `hero-reflection` | Voir un héros changé de place par ce transfert. |
| 24 | `crate-reflection` | Voir une caisse changée de place par ce transfert. |
| 25 | `button` | Occuper un bouton précédemment visible et libre. |
| 26 | `gate` | Observer un changement d’état visible d’une porte-presse. |
| 27 | `press` | Observer une poussée de presse dans les images de la cascade. |
| 28 | `monster-still` | Effectuer un déplacement pendant lequel les monstres visibles restent en place. |
| 29 | `monster-press` | Reconnaître un monstre transporté par la fermeture d’une presse. |
| 30 | `monster` | Voir au moins un monstre disparaître au cours d’une action animée. |
| 31 | `goals` | Observer l’augmentation du nombre de salles terminées. |

Les textes d’aide expliquent les règles générales ; les détecteurs enregistrent les événements visibles précis du tableau. Par exemple, le conseil sur les monstres décrit le contact simultané, tandis que son acquisition reconnaît une disparition visible et ne prétend pas diagnostiquer à elle seule toutes ses causes.

La victoire ne dépend pas du compteur de découvertes. Une boucle de visée ne valide aucune découverte. L’annulation conserve les enseignements déjà observés ; recommencer une salle, changer de niveau ou recommencer la campagne réinitialise ce suivi dans la démonstration autonome.

## Session, interface et présentation

`QuartetPuzzleSession` fournit `observe`, `action`, `undo`, `reset`, `restart` et `selectLevel`. Une salle terminée ouvre automatiquement la première salle qui reste à terminer. L’état `WIN` apparaît lorsque les huit salles sont comptées comme terminées. Recommencer la salle courante ne réinitialise pas les autres ; `restart` efface toute la progression.

Les images intermédiaires montrent les manutentions, échanges, reflets et effets forcés dans leur ordre. Le navigateur bloque les nouvelles actions physiques pendant leur lecture, mais l’annulation et les commandes de réinitialisation peuvent interrompre l’animation. Le réglage système de réduction des animations est respecté. Le message **VICTORY** correspond à la victoire de campagne.

Les contrôles de la démonstration et les liens de référence sont décrits dans le [README](../README.md). La construction autonome n’incorpore pas les témoins ni le solveur. Les garanties effectivement exécutées et la qualification native du Playground sont consignées dans [validation.md](validation.md), et non déduites de cette spécification.
