# SS24 — audit des sources et des adaptations

## Périmètre

**Les Voies de Traverse** réunit le **Marchand, le Voleur, le Magicien et la Barde** dans huit salles. Le Guerrier est absent : le Marchand ne pousse qu’un occupant, et le Voleur ne tire que l’occupant immédiatement derrière lui. Cette différence guide la conception des accès, des places de réception et des changements de poste.

Les recherches partent des deux index demandés : [Crossovers — Zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/) et [North — Nord](https://sinkingstarwalkthrough.com/fr/north/). Les guides numérotés ont été ouverts et leurs descriptions textuelles vérifiées le **26 novembre 2026**. Les étapes et images légendées des pages ont servi à identifier les principes. **Les vidéos liées par ces guides n’ont pas été visionnées pour cet audit** ; leurs horodatages ne sont pas des observations supplémentaires de notre part.

Ce document décrit les huit cartes effectivement construites, à partir des fichiers `reference/levelN-design.json`, de leurs auteurs et du moteur. Une référence de walkthrough ne constitue pas une spécification de SRA. Les cartes et les moyens utilisés sont des adaptations, et non des copies des plans ou de l’intégralité des règles du jeu source.

## Correspondance des salles

| Salle SS24 | Source précise | Principe retenu | Transformation construite |
|---|---|---|---|
| **1 — L’atelier des départs** | [Nord](https://sinkingstarwalkthrough.com/fr/north/), atelier original | Comparer les pouvoirs et les effets d’un transport | Trois cours, deux passages, un bassin et 37 découvertes publiques. |
| **2 — L’escalier à rebours** | [Heroes of Hauling, énigme 6](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-6) | Descendre une charge, maintenir une ouverture, extraire un obstacle inférieur | Deux charges et quatre rôles : tractions, changement de poste du Magicien et chant depuis l’autre côté d’une cloison. |
| **3 — Les tiroirs décalés** | [Heroes, Doubled, énigme 4](https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/#%C3%A9nigme-4) | Deux pierres alignées arrêtent une poussée simple | Deux galeries, prises séparées, cibles à retirer du retour et dépose par portée sélective. |
| **4 — Le pas et la visée** | [Heroes and Light, Advanced, énigmes 6–7](https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/#%C3%A9nigme-6) | Modifier la position du Magicien ou d’une cible proche pour changer ce qu’il atteint | Traction latérale sans sort, visée coudée, réception à dégager et caisse conservée pour le retour. |
| **5 — Le relais interrompu** | [Heroes and Water, énigme 9](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-9) | Préparer un déclencheur puis retirer un maintien après le déplacement des opérateurs | Une relève continue est comparée à une rupture par chant ; la fermeture de la presse produit un appui. |
| **6 — Trois postes, un seul retour** | [Heroes and Light, énigme 11](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | Stationner provisoirement une pièce et restaurer le retour avant de changer le dispositif | Miroir garé puis remis, charge extraite, fenêtre commandée, monstre écarté vivant et livraison dans une niche. |
| **7 — La place qui restera sûre** | [Heroes and Water, énigme 8](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | Choisir un dépôt compatible avec les commandes du transport suivant | Trois postes de miroir exposés à des presses, un quatrième poste sûr, puis un court passage à plateforme et appui. |
| **8 — Le dernier pas sans échange** | [Heroes and Light, Advanced, énigme 8](https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/) | Rejoindre la dernière place sans déclencher l’échange habituel | Tableau réparti, approche hydraulique retirée et deux ordres possibles pour le chant et l’échange. |

Les numéros indiquent les sections numérotées des pages liées. Le niveau 1 ne s’attribue aucun numéro de niveau source.

## Lecture des sources et transformations

### 1. L’atelier des départs

Le [dossier du niveau 1](../reference/level1-design.json) décrit une carte originale. Les **37 découvertes** du [tutoriel public](../src/tutorial.ts) comparent notamment la poussée simple, la prise arrière, les déplacements forcés sans pouvoir personnel, la première cible du Magicien, les faces des miroirs, la portée du chant, les contacts de monstres, les fermetures et les appuis.

Le même quatuor est confronté à plusieurs départs : marcher, tirer un partenaire, l’échanger ou le faire suivre le chant ne laisse pas les mêmes occupants en place. Les cours distinctes et le bassin servent cette comparaison. Le témoin d’auteur rassemble les découvertes ; elles ne sont ni un ordre obligatoire ni un quota de victoire. Les quatre héros vivants sur les quatre destinations restent la condition de réussite.

### 2. L’escalier à rebours

Dans [Hauling 6](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-6), le héros descend une charge par la droite, tire un autre cristal sur une plaque puis retire l’obstacle contre le mur de la salle basse. L’enchaînement relie donc transport, maintien d’accès et extraction.

Le [niveau 2](../reference/level2-design.json) redistribue ce travail entre quatre rôles. Le Voleur extrait et descend une charge ; le Marchand la dépose sur la commande du passage inférieur. Le Magicien change de poste sans retirer ce poids. L’installation puis les tractions de la Barde préservent la configuration jusqu’au poste depuis lequel son chant atteint l’obstacle à travers la cloison. Le Voleur déplace aussi le Magicien sans le laisser déclencher l’échange qui se présenterait dans son axe.

Le plan et ces transports de partenaires sont propres à SS24. Le témoin illustre une coopération cohérente ; il ne démontre pas que chaque étape serait la seule préparation possible.

### 3. Les tiroirs décalés

[Doubled 4](https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/#%C3%A9nigme-4) emploie deux pierres comme butée d’une copie du Marchand : il ne peut pas pousser leur file. La source règle les écarts verticaux puis horizontaux entre des copies synchronisées.

Le [niveau 3](../reference/level3-design.json) conserve la résistance d’une paire à la poussée simple, mais supprime les clones et leur synchronisation. Le Voleur sépare la paire haute, ce qui rend une poussée du Marchand possible. Le Magicien traverse la paire basse par échanges et laisse des caisses à ses anciennes positions ; ces caisses doivent ensuite être retirées des lignes utiles. Le chantier supérieur et la fenêtre basse n’offrent pas le même type de passage.

La Barde travaille depuis l’autre côté, où une butée distingue la charge qui doit rester de celle qui doit descendre et se déporter. Les quatre caisses demeurent sèches dans le témoin. Une variante vérifiée en 83 entrées construit plutôt un appui dans la coupure inférieure : aucune condition artificielle de conservation ne l’interdit.

### 4. Le pas et la visée

Dans [Light Advanced 6–7](https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/), le changement de parité modifie les cibles vues par le Magicien ; la pierre proche peut devoir être déplacée pour atteindre celle située plus loin.

Le [niveau 4](../reference/level4-design.json) n’importe **ni lumière orange, ni parité, ni saut**. Le Voleur décale réellement le Magicien d’une colonne, sans lancer son pouvoir, et reste du côté utile pour reprendre la caisse reçue. Le rayon atteint alors le miroir fixe et la loge. Après réception, la caisse est extraite et présentée dans une colonne encore occupée. Le chant écarte l’obstacle sans pousser une file et transporte le Marchand sans déclencher une seconde poussée.

La caisse écartée devient une cible de retour, tandis que le poids livré reste sur sa commande. Le miroir conserve sa fonction de visée. La comparaison locale porte aussi sur la place laissée au Voleur : atteindre la même position avec un échange direct peut laisser un autre problème de réception. Une variante de 97 entrées commence par cet échange puis récupère le Voleur ; le partenaire n’est donc pas présenté comme un prisonnier irrécupérable.

### 5. Le relais interrompu

[Water 9](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-9) prépare un écran devant le feu d’un dragon. Une commande distante retire ensuite le pont sous l’écran, et le feu libère un autre bouton après le déplacement des héros.

Le [niveau 5](../reference/level5-design.json) retient **la préparation et le retrait différé**, avec une chaîne de causes différente. Le Voleur charge une presse ouverte pendant que le Magicien maintient sa commande. L’échange des deux héros conserve l’occupation. Depuis le poste resserré, le Magicien ne peut pas simplement marcher hors du bouton : ses directions disponibles rencontrent une cible. Le chant sélectif transporte ensuite le Voleur sans reprendre la réserve située hors de portée ; la commande se vide et la fermeture immerge le chargement.

Une nouvelle prise arrière réalise ensuite l’effet opposé : le Voleur quitte la commande en y laissant la réserve. Le passage reste ouvert pour la traversée. Aucun feu, dragon, temporisateur ou déclencheur caché n’est ajouté. Une variante de 123 entrées tire directement le Magicien après le chargement et gagne sans chant ; une autre de 129 entrées emploie la traction pour la première relève. Les contrôles comparent des états précis de relève et de rupture, sans transformer le chant du témoin en nécessité globale.

### 6. Trois postes, un seul retour

[Light 11](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) présente trois compartiments et une réorganisation provisoire. Une pièce doit être écartée, puis remise avant le retour du faisceau, faute de quoi le retour est perdu.

Dans le [niveau 6](../reference/level6-design.json), le Voleur gare le miroir dans le poste supérieur afin de tirer la charge hors de son passage. Il restaure ensuite le miroir à son coude. La livraison intermédiaire du Marchand ferme le couloir de service du miroir et ouvre la fenêtre distante : effectuer cette livraison trop tôt refuse la traction directe de retour. Le joueur peut encore revenir sur sa livraison ; le contrôle ne présente pas cette branche comme une impasse irréversible.

Dans la chambre droite, la Barde décale un monstre au bout de sa corniche avant de céder sa place au Magicien. Sans ce décalage, la montée testée atteint un voisinage mortel. Le monstre demeure vivant ; il n’est ni un lest final ni un compteur de morts. La Barde rejoint ensuite le poste inférieur, fait tourner la charge vers la niche et la descend. Le Marchand entraîné maintient provisoirement la commande intermédiaire.

La niche n’a pas de poste de traction inférieur ni de poste de poussée supérieur utilisable. Un départ gauche immédiat de la Barde immerge le poids ; deux pas vers le bas la font quitter sa portée en conservant le dépôt. La salle utilise donc un stationnement provisoire, un retour préparé et une livraison distante. Elle ne reproduit pas la traversée des murs offerte par la lumière verte du guide.

### 7. La place qui restera sûre

[Water 8](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) demande de choisir l’un de quatre emplacements pour un cristal immergé : les commandes du second transport condamnent trois des choix.

Le [niveau 7](../reference/level7-design.json) transpose ce choix en **postes de visée exposés à des presses**. Le Voleur tire le miroir le long du balcon. Trois stations sont ouvertes au départ, mais la livraison inférieure actionne successivement leurs commandes ; leurs fermetures écraseraient le miroir contre les murs. Le quatrième poste conserve le miroir nécessaire à la visée, laquelle reste bloquée par la fenêtre distante avant la livraison. Les trois mauvaises stations font l’objet de contre-branches exécutées.

Le Magicien rejoint ensuite la rive droite et maintient une case de plateforme. La Barde descend un appui vide dans l’autre colonne du passage. Le bord de terre et le mur inférieur empêchent l’appui de quitter le passage pendant sa première sortie ; les partenaires le réemploient. Après la dernière traversée, le groupe peut libérer la plateforme et le chant final entraîne les partenaires vers les arrivées.

**Aucun appui n’est détruit par la réactivation d’une plateforme dans SRA.** Le feu et le dragon de la source sont absents. Water 8 avait déjà été cité comme référence secondaire de [SS16 N8](../../sinking-star-ss16/docs/source-audit.md) : le numéro n’est donc pas annoncé comme inédit. La différence construite est le choix face à trois fermetures futures, au lieu d’une conservation de plusieurs lests et miroirs pour deux sas. Une variante intercale un stationnement temporaire sûr du miroir et une partie de la livraison : l’anticipation n’impose pas un ordre intégral unique.

### 8. Le dernier pas sans échange

Dans [Light Advanced 8](https://sinkingstarwalkthrough.com/fr/heroes-and-light-advanced-solutions/), le pas vers la dernière place déclenche un échange avec une pierre déjà posée. L’émetteur orange fournit un moyen d’atteindre cette place autrement.

Le témoin principal du [niveau 8](../reference/level8-design.json) emploie un **déplacement forcé du Magicien au bord du chant**. Le premier dépôt ouvre l’atelier ; le Voleur extrait deux autres blocs et ramène le miroir au coude. Cette position du miroir retire une seule case hydraulique au-dessus de la dernière commande. Elle laisse pourtant passer la visée vers le poids supérieur.

Dans l’état préparé vérifié, les quatre approches diffèrent : celle du haut manque de soutien ; celle de droite contient le miroir ; depuis le bas, le Magicien échange avec le poids supérieur ; depuis la gauche, il atteint la réserve mais la dépose une case avant sa destination. Dans le témoin principal, le chant déplace d’abord le Magicien d’une case sans sort et sans déplacer les poids, puis l’échange livre la réserve. Un poste de Barde décalé fait au contraire suivre une caisse qui devait rester.

La revue indépendante a également archivé une variante gagnante de **137 entrées**, contre **141** pour le témoin principal : elle effectue **l’échange d’abord, puis le chant de la caisse**. La réserve déposée une case avant sa destination est avancée par le chant jusqu’à la commande. Ce parcours conserve la préparation, les dépôts, le miroir, la contrainte hydraulique et le chant ; il n’emploie pas le transport passif du Magicien pour le dernier pas. Ce transport n’est donc pas une nécessité générale de la salle.

Dans les deux ordres, le miroir retient le dernier poids pendant le départ autonome de la Barde ; le Voleur peut le reprendre ensuite et réactiver la petite plateforme. Le tableau est réparti entre deux espaces, avec quatre commandes de travail et de composition plus la commande hydraulique du miroir. Il ne reprend ni le carré source 2×2 ni les neuf poids de SS23. Les contre-branches qualifient les approches de la composition préparée ; elles ne prouvent ni l’unicité de la préparation ni celle de l’ordre de résolution.

## Contrat commun à respecter

Le [moteur SS24](../src/core.ts) est la référence des effets exacts.

- **Marchand et Voleur :** un seul occupant à la fois. Il n’y a pas de poussée de file héritée du Guerrier absent. La traction d’un miroir conserve son orientation.
- **Transport de héros :** poussée, traction, échange ou chant ne déclenchent pas le pouvoir personnel du partenaire transporté.
- **Magicien :** la première cible admissible est celle de la visée effective. Les faces blanches peuvent courber ce rayon ; l’eau ne le bloque pas. La sécurité des deux destinations est vérifiée.
- **Barde :** carré de cinq cases centré sur sa position avant le pas, murs compris. Un membre bloqué peut rester immobile. Les miroirs ne suivent pas le chant.
- **Eau :** une caisse immergée devient un appui. Le chant ne déplace un appui vide que d’eau en eau ; un appui occupé ou visé par l’arrivée de la Barde reste ancré. Il ne porte pas de passager. Une plateforme commandée est un dispositif distinct.
- **Miroirs :** la visée coudée du Magicien et le reflet global sont deux opérations différentes. Aucun clone, fusion, empilement, prisme ou effet de lumière colorée n’est ajouté.
- **Monstres et presses :** contacts orthogonaux dangereux, monstres stationnaires hors transport, presses effectives à leur fermeture. Les portes ne dépendent pas d’un quota de morts ou d’actions.
- **Victoire :** quatre héros vivants sur quatre destinations ; les découvertes pédagogiques et les métriques d’auteur ne remplacent pas cette règle.

## Variété et limites de la nouveauté

Les couples guide/numéro retenus pour les adaptations diffèrent de ceux de [SS21](../../sinking-star-ss21/docs/source-audit.md), [SS22](../../sinking-star-ss22/docs/source-audit.md) et [SS23](../../sinking-star-ss23/docs/source-audit.md). Cela ne suffit pas à rendre chaque geste nouveau. Les déplacements silencieux du Magicien ou de la Barde, la conservation d’un poids et les miroirs tractés appartiennent déjà à la série. La réutilisation secondaire de Water 8 dans SS16 est explicitée ci-dessus.

La variété construite porte sur les dépendances et les formes : escalier d’extraction, galeries décalées, ligne de réception, machine de rupture, stationnement avec retour, choix entre postes exposés et composition à dernier pas contraint. Les trois dernières salles ne sont pas trois quais : N6 emploie une fenêtre d’eau sans traversée par appui ; N7 comporte le court passage matériel ; N8 ne retire qu’une case hydraulique d’approche. Le chantier évite la grille dense de Hauling 11, les fragments de neuf caisses et la navette de Guerrier des campagnes précédentes.

## Preuves disponibles

Les huit dossiers de conception contiennent les cartes, commandes, étapes et métriques. La [revue d’auteur finale](../reference/author/review-final-ss24.mjs) produit [final-ss24-review.json](../reference/final-ss24-review.json) pour N6–N8 : **29 contrôles réussis**, avec témoins principaux de **122, 92 et 141 entrées** et variantes de **118, 114 et 131 entrées**, sans refus ni décès.

La revue indépendante complète ces variantes par le parcours N8 de **137 entrées**, où l’échange précède le chant de la caisse. Ce nombre correspond au parcours archivé après retrait d’un clic redondant ; il ne remplace pas les métriques de la revue d’auteur ci-dessus.

Les contre-branches consignent les actions et états auxquels leurs conclusions s’appliquent. Les variantes montrent des stationnements ou ordres différents ; elles ne prouvent ni optimum ni unicité. Aucun budget de recherche épuisé n’est assimilé à une impossibilité. Les validations de campagne, la revue indépendante, les contrôles d’interface, l’intégration native et la publication relèvent de leurs rapports propres ; cet audit ne leur attribue aucun statut anticipé.
