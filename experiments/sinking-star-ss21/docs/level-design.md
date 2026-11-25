# SS21 — Conception des huit niveaux

## Intention de campagne

Le quatuor réunit **poussée simple, poussée de file, extraction et échange**. La campagne fait varier la raison de changer de personnage : prendre le bon côté d’une pièce, conserver un poste, donner un nouvel accès à un partenaire, empêcher une visée de reprendre une charge ou choisir qui restera disponible pour la dernière manutention.

Les huit cartes occupent le même cadre de 20 × 20 cellules, mais présentent des organisations différentes. Elles ne répètent pas huit fois un dépôt, un pont et une porte. Les descriptions ci-dessous proviennent des cartes et des étapes présentes dans [`reference/`](../reference/) ; les références externes sont vérifiées dans [source-audit.md](source-audit.md).

## Vue d’ensemble et inventaires

Les nombres indiquent les pièces et dispositifs présents au départ. Un bouton ajouté par un circuit est compté même si son symbole n’apparaît pas dans les lignes de la carte. Un miroir dessiné dans ces lignes est également compté.

| Nº | Salle | Topologie et enseignement principal | Caisses | Miroirs | Monstres | Boutons | Presses | Plateformes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | L’école des quatre | Atelier ouvert, banc optique et quatre sorties séparées ; découverte des capacités et des relèves. | 6 | 1 | 2 | 5 | 7 | 0 |
| 2 | Trois caisses, deux chambres | Chambres opposées, dépôt étroit et cour commune ; substituer une charge à un prisonnier. | 3 | 0 | 0 | 1 | 1 | 0 |
| 3 | Les quatre balcons | Rail de manutention entouré d’eau et quatre balcons vides ; préserver le dernier manipulateur. | 0 | 1 | 0 | 0 | 0 | 0 |
| 4 | Le rectangle sans issue | Anneau optique, périphérie et cour intérieure ; interrompre une boucle avec une cible réutilisable. | 1 | 4 | 0 | 3 | 3 | 0 |
| 5 | Le dernier intercepteur | Double serrure, deux postes éloignés et alcôve finale ; organiser une relève sans reprendre le poids. | 3 | 0 | 0 | 3 | 2 | 0 |
| 6 | Le compte des îlots | Quatre îlots décalés et trois détroits ; distinguer permutation et franchissement. | 4 | 0 | 0 | 2 | 2 | 0 |
| 7 | L’écluse à deux étages | Dépôt inférieur, écluse et fronton supérieur ; rendre permanent un passage temporaire. | 3 | 0 | 1 | 3 | 2 | 1 |
| 8 | Le verrou à trois poids | Archive isolée, chantier, gardien et cour vide ; réserver chaque ressource à son emploi final. | 3 | 1 | 1 | 5 | 4 | 0 |

Tous les niveaux possèdent quatre héros et quatre destinations. Les niveaux 4 et 5 sont entièrement secs. Les niveaux 2, 3, 5 et 6 n’ont pas de monstre. Le niveau 3 supprime même les caisses et les commandes : sa difficulté repose sur les accès et les stations du miroir.

## 1. L’école des quatre

**Références :** Hauling 3, 4 et 13 ; introduction aux visées de Heroes and Mirrors. **Nature :** atelier pédagogique original, avec 31 découvertes.

Le début donne immédiatement une tâche au Marchand : placer une caisse sur la commande de l’atelier. À proximité, le Guerrier peut déplacer une file contenant deux caisses et le Voleur. Celui-ci sépare la tête de file puis transporte un partenaire sans déclencher sa capacité. Les objets restent assez proches pour comparer les effets des trois rôles.

Le banc optique propose ensuite plusieurs observations distinctes : première cible au-delà de l’eau, visée déviée du Magicien, échange à distance égale par reflet, déplacement physique du miroir puis réception d’une caisse sur un quai. Une caisse devient un appui fixe, que le Marchand traverse ; le Magicien échange avec lui avant de marcher dans une direction sans cible.

La partie basse remet les capacités au service d’un objectif commun. Trois caisses doivent occuper les trois boutons des sorties. Une presse commandée avance un monstre vers son voisin : leur rencontre libère le passage oriental. La récupération d’une caisse au quai et les relèves permettent ensuite de quitter les postes de travail.

**Enseignement :** observer une capacité, la distinguer des déplacements forcés et la réemployer dans une organisation commune. Les exercices optiques supplémentaires sont des actions légales du parcours pédagogique ; aucune jauge de découvertes n’est nécessaire pour gagner. La présence de réserves évite de réduire l’atelier à une seule séquence obligatoire.

## 2. Trois caisses, deux chambres

**Références :** Hauling 19–20. **Ressources :** trois caisses mobiles, aucune plateforme, aucun miroir.

Le Guerrier et le Voleur commencent dans des chambres décalées, à des coins opposés. Chacune est séparée du corps principal par une coupure de trois cases d’eau. Le Magicien peut remplacer un partenaire puis revenir en échangeant sa place avec une caisse alignée depuis le dépôt. Deux caisses occupent alors les logements libérés.

Les deux caisses du dépôt commencent en file. Le Guerrier les présente aux postes de reprise ; le Marchand transporte la réserve arrière vers la visée de retour. Le Voleur libéré extrait ensuite la caisse de tête d’un renfoncement et la laisse sur la commande de la cour finale.

**Enseignement :** compter les charges avant de construire un pont. Le témoin utilise deux substitutions et garde une troisième caisse sèche pour les sorties. Il ne démontre pas que chaque déplacement ou chaque capacité de ce témoin est nécessaire à toute solution. L’eau n’est pas ici un décor d’archipel : elle définit le coût d’un accès physique alternatif aux chambres.

## 3. Les quatre balcons

**Références :** Mirrors 32, avec 31 comme référence secondaire. **Ressource :** un unique miroir orienté nord-ouest.

Les quatre balcons disposent chacun de deux cases, sont initialement vides et ne sont pas reliés au rail de manutention. Une case sert à l’arrivée, l’autre au retrait hors de l’axe. Il n’existe aucune caisse avec laquelle construire un pont. Une transposition demande une cible déjà présente : le premier occupant d’un balcon doit donc être livré par reflet.

Le témoin utilise quatre stations du miroir : `(14,14)`, `(14,11)`, `(11,11)` et `(11,14)`, dans le repère de la carte. Le Voleur règle d’abord le poste de départ. Le Guerrier remonte puis décale le miroir avant son propre départ. Le Voleur reste disponible pour la dernière descente : la case de poussée au nord du poste contrôlé est dans l’eau, alors que la prise depuis le sud reste utilisable.

**Enseignement :** choisir les passagers en fonction des opérations restantes. Le Magicien participe comme passager à cette salle ; sa présence n’est pas un prétexte pour imposer un échange inutile. Le retrait immédiat du premier passager hors du rayon est une possibilité pratique du témoin, pas une obligation générale : une variante d’auteur reporte son rangement.

## 4. Le rectangle sans issue

**Références :** Mirrors 34 et 30. **Ressources :** quatre miroirs, une caisse, trois circuits.

Le Magicien commence sur un anneau optique. Une visée horizontale sans cible revient à son origine. La solution décrite dans le laboratoire conserve les quatre miroirs : le Guerrier charge une presse avec la caisse en déplaçant aussi le Voleur, puis le Marchand relâche la commande d’injection. La presse envoie la caisse dans le trajet de visée.

Cette première cible interrompt le circuit. Le Magicien échange sa place avec elle au moyen du rayon dévié, entre dans la cour et ouvre la trappe supérieure. Le Voleur peut alors extraire la caisse de l’anneau. Le Marchand la transporte à la commande qui ouvre l’accès inférieur, pour permettre au quatuor de rejoindre les quatre destinations.

**Enseignement :** une visée en boucle exige un changement de situation, puis la cible de secours doit être récupérée. L’unique caisse devient successivement charge d’injection, cible, objet à extraire et poids permanent. La salle est entièrement sèche, sans monstre ; les longues liaisons appartiennent à un chemin périphérique autour d’une cour, pas à une succession de quais.

## 5. Le dernier intercepteur

**Références :** Light 8 et 2. **Ressources :** trois caisses, deux circuits dont une double commande, aucun miroir.

Le Marchand et le Magicien maintiennent initialement deux postes éloignés. Le Guerrier ramène une file de deux caisses à travers la double serrure. Le Voleur les sépare puis présente chacune dans le bon axe. Une première transposition remplace le Magicien par une caisse ; une relève entre partenaires, suivie d’un échange avec la seconde caisse, libère le Marchand sans abandonner le poste inférieur.

La troisième caisse se trouve au fond d’une alcôve. Le Voleur l’extrait ; le Magicien s’en sert pour maintenir le bouton final, mais prend alors sa place dans l’alcôve. Une flèche de retour sans cible intermédiaire reprendrait cette caisse. Un partenaire s’interpose pour devenir la première cible : le Magicien sort, tandis que la caisse reste sur son bouton.

**Enseignement :** prévoir ce que fera la prochaine flèche du Magicien après un échange. Le Voleur intercepte dans le témoin principal, mais le Guerrier peut tenir ce rôle dans la variante documentée. La contre-branche sans intercepteur est légale et ne suffit pas à prouver une impasse irréversible : le Magicien occupe provisoirement la commande à la place de la caisse.

## 6. Le compte des îlots

**Références :** Water 7 et 11. **Ressources :** quatre caisses pour trois détroits et une commande finale.

Les rôles sont répartis entre quatre îlots décalés. Le Magicien fait d’abord venir le Guerrier par échange ; celui-ci déplace une file sur la commande de lancement. Le Voleur récupère la réserve du premier quai, que le Marchand transforme en premier appui. Les deux opérateurs traversent avant que la commande de départ soit réemployée.

La tête de file devient le second appui. Une réserve orientale, extraite de son renfoncement puis remise dans le bon axe, comble le troisième détroit. La dernière caisse reste mobile jusqu’à son installation sur le bouton d’arrivée.

**Enseignement :** les échanges réorganisent les occupants mais ne financent pas un franchissement. Les trois appuis fixes relient des régions différentes ; consommer la dernière caisse dans l’eau empêcherait son emploi prévu comme poids sec. La campagne réemploie ici un principe déjà étudié en SS17, avec un quatuor et une allocation de quatre ressources propre à cette carte.

## 7. L’écluse à deux étages

**Références :** Water 6 et 12. **Ressources :** trois caisses, un gardien, une plateforme escamotable.

Le même circuit rend la plateforme praticable tout en fermant le sas placé plus bas. Le Magicien rejoint la plateforme active et échange avec le gardien. Le Marchand relâche ensuite la commande : le gardien perd son soutien, et le sas inférieur s’ouvre.

Il reste à ouvrir un passage utilisable par tous. Le Magicien transfère le Voleur au nord. Celui-ci extrait la réserve supérieure ; le Guerrier la dépose sur la plateforme. Son retrait transforme la caisse en appui permanent et libère le Marchand de la commande. Les deux caisses du dépôt peuvent ensuite être décalées en file, séparées et livrées sur les deux boutons du fronton.

**Enseignement :** distinguer un accès temporaire d’un ouvrage permanent. Le niveau ne se termine pas avec la disparition du gardien : il faut encore déplacer les capacités et les deux poids. La plateforme peut réapparaître sans détruire l’appui acquis, conformément aux règles SRA.

## 8. Le verrou à trois poids

**Références :** Light 4 et 45. **Ressources :** trois caisses, un gardien, un miroir fixe et quatre presses.

Le gardien doit rester vivant. Le Voleur passe le couloir de traverse avant sa fermeture, puis deux presses déplacent successivement le monstre jusqu’à son bouton. Une commande déplace également la porte de traverse : commander le gardien et déplacer les héros ne sont donc pas deux opérations indépendantes.

Le Magicien extrait la caisse de l’archive et l’aligne avec le miroir. Un reflet l’envoie au quai de réception, d’où le Voleur la retire. Le Marchand la place sur une commande sèche et libère la visée nécessaire au retour du Magicien. Le Guerrier décale la file restante : une caisse devient le passage vers la cour encore vide, l’autre rejoint le dernier bouton sec.

**Enseignement :** distinguer les ennemis à éliminer des occupants à conserver. Deux caisses sèches et le gardien maintiennent ensemble le verrou ; la troisième caisse porte la traversée. La victoire ne demande donc pas de vider la carte de ses monstres. Le travail d’archive, de réception et de financement de la sortie constitue la synthèse du quatuor.

## Variations par rapport à SS16–SS20

Cette comparaison s’appuie sur les fichiers `reference/levelN-design.json` des cinq laboratoires précédents. Elle décrit les différences de composition ; elle ne prétend pas que chaque principe de SS21 apparaît pour la première fois.

| Antécédent | Motifs déjà présents | Déplacement de l’effort dans SS21 |
| --- | --- | --- |
| SS16 — Marchand / Guerrier / Voleur | Récupérer avant d’immerger, manutention des miroirs, presses, poids et chantier hydraulique. | Le Magicien ajoute les substitutions entre chambres et les relèves réciproques. Les niveaux 4–5 construisent des problèmes secs de visée et d’interception. |
| SS17 — Guerrier / Voleur / Magicien | Captifs, compte des îles, visées coudées et réemploi des miroirs. | Ces thèmes ne sont pas nouveaux. Les chambres opposées à trois charges, les quatre balcons vides et la récupération d’une caisse injectée dans un rectangle constituent les compositions distinctes de SS21. |
| SS18 — Marchand / Magicien / Barde | Chant, sorties synchronisées, miroir voyageur et appui transporté. | Le quatuor emploie des files et de l’extraction locale. Aucun chant ne réorganise les pièces ; les appuis créés restent fixes. |
| SS19 — Guerrier / Magicien / Barde | Gardiens convoyés, piège par retrait de soutien, commande optique et miroir retiré. | Le gardien hydraulique réapparaît comme exercice de relais à quatre. Le rectangle optique conserve ses miroirs ; la cible injectée puis récupérée porte le problème. |
| SS20 — Marchand / Voleur / Barde | Quais décalés, contraintes de diagonale, appui voyageur et chantier à démonter. | L’espace comprend aussi un anneau sec et une double serrure. Sans Barde, la division d’une file et le choix de la première cible remplacent les transports par chant. |

## Témoins, arguments et validation

Chaque `reference/levelN-design.json` contient la carte, une suite d’actions d’auteur et des étapes décrivant le rôle des ressources. Les outils de validation rejouent ces actions et examinent les observations. Les contrôles locaux de conception documentent en plus certaines branches alternatives et certains états intermédiaires.

Les conclusions doivent conserver leur portée :

- Un parcours complet démontre qu’une salle peut être terminée par ce parcours ; il ne mesure pas sa difficulté pour l’agent SRA.
- Un bilan de ressources ou l’isolement d’un balcon peut établir une contrainte précise, sans rendre tout l’ordre du témoin obligatoire.
- Une contre-branche refusée caractérise l’état dans lequel elle est essayée ; elle ne prouve pas que toutes les autres préparations échouent.
- Les variantes du niveau 3 et de l’intercepteur du niveau 5 doivent rester permises. Les scripts ne doivent pas transformer les choix du témoin en règles de victoire.
- Les nombres d’actions, résultats des relectures et comparaisons automatiques de géométrie appartiennent à [validation.md](validation.md) et à `validation/`. Cette conception n’annonce pas de publication Site ni de qualification automatique de l’agent.
