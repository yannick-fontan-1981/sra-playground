# SS22 — Spécification du jeu

## Identité et objectif

**SS22 — Les Cortèges Mécaniques**, version 0.1.0, est une campagne de huit salles pour le quatuor **Marchand / Guerrier / Voleur / Barde**, sans Magicien. Chaque salle contient exactement ces quatre héros et quatre destinations jaunes. Le Marchand est sélectionné au chargement.

Les quatre héros vivants doivent occuper simultanément les quatre destinations. Aucune destination n’est attribuée à une couleur particulière ; un héros arrivé reste sélectionnable et peut repartir. La perte d’un seul héros donne `GAME_OVER`. L’annulation restaure l’état précédent, y compris les conséquences d’une cascade. La victoire ne dépend d’aucun quota de chants, de poussées, de rôles employés ou de découvertes.

Le moteur est défini dans [`src/core.ts`](../src/core.ts), les salles dans [`src/levels.ts`](../src/levels.ts), et leurs intitulés, objectifs et références publiques dans [`src/level-info.ts`](../src/level-info.ts). Les intentions d’adaptation et leurs limites sont documentées dans [l’audit des sources](source-audit.md) et les fichiers `reference/levelN-design.json`.

## Image et commandes publiques

| Élément | Contrat |
| --- | --- |
| Image | 64 × 64 pixels, palette de 16 couleurs. |
| Grille | 20 × 20 cellules de 3 × 3 pixels, origine `(2, 2)`. Les cartes plus petites sont centrées. |
| Marchand | Orange, indice de palette `12`. |
| Guerrier | Rouge, indice `8`. |
| Voleur | Vert, indice `14`. |
| Barde | Magenta, indice `6`. |
| Sélection | Le bras blanc du héros actif indique sa direction ; le Barde sélectionné montre sa portée par un carré pointillé. |
| `ACTION1` / `ACTION2` / `ACTION3` / `ACTION4` | Nord / sud / ouest / est. |
| `ACTION5` | Activation simultanée des reflets des miroirs. |
| `ACTION6` | Sélection d’un héros par coordonnées de pixels `{x, y}` dans le canevas 64 × 64. |

L’observation contient `gameCode`, `frame`, `frames`, éventuellement `frameDurationsMs`, `state`, `availableActionIds`, `canUndo`, `canSelectLevel`, `level`, `levelCount`, `levelsCompleted`, `defaultFps` et `palette`. Les images intermédiaires et leurs durées appartiennent au contrat public. La dernière image de `frames` correspond à `frame`.

L’observation ne contient ni carte sémantique, ni positions structurées des objets, ni circuits internes, ni solution. Les fonctions d’auteur telles que `compileLevel`, `initialState`, `stepDetailed` et `planReflection` servent au moteur et à sa qualification ; elles ne constituent pas une perception accessible à SRA. Le tutoriel et la sélection des rôles déduisent les personnages des pixels publics.

## Les quatre capacités

| Rôle | Déplacement volontaire | Limite à comprendre |
| --- | --- | --- |
| Marchand | Avance et pousse au plus une pièce ou un partenaire placé devant lui. | Une deuxième pièce bloque la poussée ; il faut préparer une arrivée libre. |
| Guerrier | Avance et pousse toute la file contiguë devant lui d’une case. | La file peut mêler caisses, miroirs, monstres et partenaires. Une butée à son extrémité bloque l’ensemble. |
| Voleur | Avance dans une case libre et tire seulement l’occupant immédiatement derrière lui dans la case quittée. | Il ne pousse pas et ne tire pas une file entière. Changer d’axe permet de laisser la charge. |
| Barde | Avance d’une case et entraîne dans la même direction les occupants admissibles de son carré de chant. | La portée est mesurée avant le pas. Certaines pièces peuvent rester contre une butée tandis que les autres avancent. |

Une capacité n’est déclenchée que par le déplacement volontaire du héros actif. Un partenaire poussé, tiré, chanté, reflété ou déplacé par une presse n’exécute pas une seconde capacité : un Barde transporté reste silencieux ; un Voleur transporté ne tire rien. Le Guerrier ne possède aucune immunité ni attaque spéciale contre les monstres.

### Chant : portée, butées et replacement

Le chant couvre un **carré de 5 × 5**, centré sur la position du Barde **avant** son pas : la distance maximale est de deux cases horizontalement et de deux cases verticalement. Les coins du carré comptent. Les murs entre le Barde et une pièce n’interrompent pas cette portée ; seule l’arrivée propre à chaque occupant doit être possible.

Les partenaires, caisses, monstres et appuis immergés admissibles tentent une translation d’une case dans le sens choisi. Les miroirs ne suivent pas le chant. Une pièce bloquée reste en place, ce qui permet de modifier les écarts dans un groupe. Si sa présence empêche l’arrivée d’un autre membre, celui-ci reste également en place. Les mouvements compatibles sont ensuite appliqués ensemble. Si le Barde lui-même ne peut pas avancer, toute l’action est refusée.

Revenir volontairement par le même chemin peut ramener une charge que l’on souhaitait déposer. Pousser ou tirer le Barde permet de le replacer sans ce chant de retour. C’est notamment le principe des courses successives du niveau 2 et de certaines variantes d’accès du niveau 5. La présence d’un rôle dans le témoin n’établit pas sa nécessité dans toutes les solutions.

## Eau, caisses, appuis et plateformes

Une caisse qui arrive dans l’eau sans soutien devient un **appui immergé**, marqué d’un X cyan et brun. Elle cesse d’être une caisse mobile. Un appui porte les héros et les pièces ; une autre caisse peut donc circuler dessus sans être transformée. Il ne maintient pas un bouton et ne peut être poussé, tiré ou reflété.

Dans SS22, le chant peut toutefois **déplacer un appui d’une case d’eau vers une autre case d’eau**, sous les conditions suivantes :

- Un héros présent sur l’appui avant le pas l’ancre, même si ce héros se déplace pendant le chant.
- L’appui sur lequel le Barde va arriver est également ancré.
- Un appui ne sort pas de l’eau et ne rejoint pas la position d’un autre appui qui reste en place.
- Un héros ne voyage pas avec un appui : la translation du soutien et le déplacement d’un personnage sont des mouvements distincts.

Ces règles permettent de franchir un passage, de libérer ses appuis, puis de les réemployer ailleurs. Elles commandent les changements de disposition du bassin au niveau 7 et la séparation d’un appui de service au niveau 8. Un appui ne redevient jamais une caisse.

Une plateforme escamotable fournit un soutien selon l’état de son circuit. Une caisse reste mobile tant que la plateforme la porte ; si celle-ci se retire sans autre soutien, la caisse devient un appui. **L’appui persiste lorsque la plateforme se réactive.** Le niveau 8 emploie cette mécanique hydraulique. Ce contrat SRA est explicité dans l’audit des sources lorsque l’énigme d’origine utilise un autre comportement.

Les déplacements volontaires qui noieraient un héros ou feraient perdre un miroir sont refusés, y compris lorsqu’un partenaire participe au chant. Le contrôle du chant vérifie les soutiens avant les cascades ultérieures. Un retrait de plateforme provoqué ensuite par un changement de commande est résolu normalement et peut être fatal. Lors des transferts forcés, un monstre arrivé dans l’eau nue disparaît, un miroir peut être perdu et une caisse peut devenir un appui.

## Boutons, circuits et presses latérales

Un héros vivant, une caisse, un monstre ou un miroir peut maintenir un bouton. Tous les boutons d’un circuit doivent être occupés simultanément pour l’activer. Les repères colorés relient les commandes à leurs dispositifs. Une presse fermée peut aussi maintenir un bouton situé sur sa propre case ; un appui immergé ne fait pas poids.

Chaque porte-presse déclare si elle se ferme à l’appui ou au relâchement du circuit. Chaque plateforme déclare de même l’état qui la rend active. Une commande peut ainsi affecter plusieurs passages ou soutiens. Aucune temporisation cachée ne remplace ces relations physiques.

À l’instant où elle se ferme, une presse pousse **l’occupant de sa propre case** dans le sens de sa flèche et transmet la poussée à la file contiguë devant lui. Si cette file ne peut pas avancer, l’occupant initial de la presse est écrasé. Une presse déjà fermée ne refrappe pas à chaque action. Les déplacements peuvent modifier d’autres boutons ; le moteur règle les cascades avant de conclure l’action.

Une relève remplace simultanément l’occupant d’un bouton par un autre. Le circuit peut ainsi rester actif pendant le départ d’un héros. Le niveau 8 utilise une poussée mixte du Guerrier pour remplacer le Marchand par une caisse sans interrompre sa commande.

## Miroirs : projection globale

La diagonale blanche distingue la face du miroir de son dos noir. Déplacer un miroir ne change pas son orientation, mais déplace ses axes et ses prévisions d’arrivée. `ACTION5` examine les deux bras perpendiculaires de chaque miroir et projette un occupant à distance égale sur l’autre bras.

- Le candidat le plus proche est prioritaire ; à distances égales, les deux occupants peuvent échanger leurs places.
- Les murs, les portes fermées et les obstacles optiques peuvent empêcher le trajet. Une projection ne constitue pas une chaîne de déviations à travers plusieurs miroirs.
- Les transferts des différents miroirs sont évalués ensemble. Une arrivée occupée par un élément qui reste, des destinations incompatibles ou des projections concurrentes du même occupant peuvent refuser l’ensemble.
- Le refus ne réalise aucun transfert partiel. Les dos impliqués peuvent clignoter en rouge en conservant leur diagonale blanche.
- Les contours gris clairs donnent les prévisions publiques des arrivées valides. Un héros reflété n’active pas sa capacité.

SS22 ne dédouble ni ne fusionne les occupants. Le Magicien étant absent, aucune visée d’échange ne s’ajoute à la projection globale. Le premier atelier enseigne la manutention d’un miroir puis les reflets d’une caisse et d’un héros.

## Monstres et résolution d’une action

Les monstres restent sur leur case pendant les déplacements qui ne les transportent pas. Une poussée, une traction, un chant, un reflet ou une presse fournit la cause de leur déplacement. Ils peuvent maintenir un bouton, comme dans le quartier des reprises au niveau 6.

Après une action physique effective, chaque monstre attaque les héros voisins par un côté. Une diagonale n’est pas un contact. Deux monstres orthogonalement voisins s’éliminent simultanément ; ils peuvent également frapper un héros adjacent pendant cette même vague. Les quatre héros sont vulnérables, y compris ceux qui ne sont pas sélectionnés.

Le moteur règle les dispositifs, l’eau et les contacts avant de déclarer la victoire. La disparition d’un monstre peut libérer une commande et provoquer une nouvelle cascade. Une sélection de héros ou une action refusée ne déclenche pas ce règlement physique. Le jeu n’a pas de condition de victoire fondée sur le nombre de monstres éliminés.

## Tutoriel : 33 découvertes

Le tutoriel est réservé au niveau 1, **L’école des cortèges**. [`src/tutorial.ts`](../src/tutorial.ts) compare les images publiques précédant l’action et celles de sa présentation. Il n’accède ni au monde interne ni au témoin d’auteur. L’ordre du tableau choisit le prochain conseil ; les découvertes peuvent être acquises dans un autre ordre.

| Nº | Identifiant | Événement visible reconnu |
| --- | --- | --- |
| 1 | `select` | Changer de héros par une sélection publique. |
| 2 | `move` | Observer un déplacement volontaire d’une cellule. |
| 3 | `merchant-push` | Voir le Marchand déplacer l’occupant qui était devant lui. |
| 4 | `warrior-push` | Voir le Guerrier avancer en poussant au moins un occupant. |
| 5 | `file-push` | Faire avancer plusieurs occupants contigus avec le Guerrier. |
| 6 | `mixed-file` | Reconnaître un partenaire dans une file de plusieurs occupants poussée. |
| 7 | `thief-pull` | Voir le voisin arrière rejoindre la case quittée par le Voleur. |
| 8 | `single-pull` | Tirer la première pièce en laissant la suivante à sa place. |
| 9 | `partner-push` | Déplacer un partenaire par poussée. |
| 10 | `partner-pull` | Déplacer un partenaire par traction. |
| 11 | `mirror-motion` | Observer la translation d’un miroir pendant une manutention. |
| 12 | `relay-weight` | Reconnaître une relève physique sur un bouton pendant une poussée ou une traction. |
| 13 | `release-by-pull` | Tirer le Barde en laissant une caisse ou un monstre proche à sa place. |
| 14 | `monster-still` | Avancer pendant que les monstres visibles restent immobiles dans toutes les images de l’action. |
| 15 | `bard-song` | Voir une pièce ou un partenaire suivre le pas du Barde. |
| 16 | `partner-song` | Voir un partenaire transporté par le chant. |
| 17 | `selective-song` | Déplacer une partie des pièces proches tandis qu’une autre reste en place. |
| 18 | `diagonal-song` | Déplacer une pièce située à un coin du carré de portée, à deux cases sur chaque axe. |
| 19 | `wall-song` | Déplacer une pièce séparée du Barde par une case de mur visible. |
| 20 | `monster-song` | Voir un monstre suivre le chant. |
| 21 | `water-support` | Voir apparaître un nouvel appui sur une case d’eau. |
| 22 | `support-slide` | Voir un appui immergé se déplacer pendant le chant. |
| 23 | `support-anchor` | Voir rester un appui proche occupé par un héros ou ciblé par l’arrivée du Barde. |
| 24 | `cross-support` | Faire arriver volontairement un héros sur un appui déjà visible. |
| 25 | `mirror` | Observer un transfert après l’action globale des miroirs. |
| 26 | `hero-reflection` | Voir un héros changé de place par ce transfert. |
| 27 | `crate-reflection` | Voir une caisse quittant sa place lors d’un reflet. |
| 28 | `button` | Occuper un bouton précédemment visible et libre. |
| 29 | `gate` | Observer un changement d’état visible d’une porte-presse. |
| 30 | `press` | Reconnaître le transport d’un occupant lors d’une fermeture dans les images de la cascade. |
| 31 | `monster-press` | Reconnaître ce transport lorsqu’il concerne un monstre. |
| 32 | `monster` | Voir diminuer le nombre de monstres entre les images de départ et d’arrivée. |
| 33 | `goals` | Observer l’augmentation du nombre de salles terminées. |

Les conseils expliquent des règles générales ; les détecteurs enregistrent les événements visibles précis ci-dessus. Par exemple, la découverte `monster` constate une disparition et n’en attribue pas à elle seule la cause. `release-by-pull` est reconnue avec une caisse ou un monstre proche immobile ; l’ancrage des appuis possède son propre détecteur.

Le témoin du N1 acquiert les 33 découvertes. Le compteur ne conditionne jamais la victoire. Dans la démonstration autonome, Annuler conserve les découvertes ; Recommencer, repartir du niveau 1 ou choisir une salle réinitialise leur suivi.

## Session et présentation

`QuartetPuzzleSession` fournit `observe`, `action`, `undo`, `reset`, `restart` et `selectLevel`. Terminer une salle ouvre automatiquement la première salle qui reste à terminer. L’état officiel devient `WIN` lorsque les huit salles sont terminées. Annuler le geste de victoire restaure la salle précédente et son compteur. `reset` recommence la salle courante en conservant les autres réussites ; `restart` efface la progression de campagne. Sélectionner une salle la recommence et efface son historique d’annulation.

Dans l’interface, les touches 1, 2, 3 et 4 sélectionnent respectivement Marchand, Guerrier, Voleur et Barde ; Tab et le clic sur les pixels d’un héros offrent les mêmes sélections. Les flèches déplacent le héros actif. Espace ou X active les reflets, Z annule, R recommence la salle. Maj Tab permet de quitter la grille.

Les images intermédiaires présentent manutention, chant, reflet et effets forcés dans leur ordre. Pendant leur lecture, l’interface bloque les nouvelles actions et sélections ordinaires ; Annuler, Recommencer, repartir de N1 ou changer de salle peuvent interrompre la présentation. Le réglage de réduction des animations est respecté. Les panneaux de fin attendent la dernière image ; **VICTORY** correspond à la victoire de campagne.

La construction autonome n’incorpore ni les témoins ni le solveur. Les garanties exécutées, leurs rapports et la distinction entre laboratoire, dispatcher natif, navigateur et agent SRA sont consignés dans [validation.md](validation.md). La [feuille de route](roadmap.md) suit les étapes de livraison ; la présente spécification ne vaut pas preuve de leur exécution.
