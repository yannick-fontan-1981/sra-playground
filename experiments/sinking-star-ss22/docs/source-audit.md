# SS22 — audit des sources et des adaptations

## Périmètre

La campagne **Les Cortèges Mécaniques** a été conçue à partir des deux index demandés :

- [Zones mixtes / Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/).
- [Monde Nord / The Hearty Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/north/).

Les pages de solutions ci-dessous ont été consultées le **26 novembre 2026**. Les numéros sont ceux du guide. Les cartes SS22, leurs trajectoires et leurs témoins sont des recompositions pour le quatuor **Marchand, Guerrier, Voleur, Barde**. Les principes de conception repris sont distingués des règles réellement implémentées.

## Correspondance exacte

| SS22 | Référence du guide | Principe retenu | Réalisation dans SS22 |
| --- | --- | --- | --- |
| N1 — L’école des cortèges | [Heroes 3: Bard, Druid, 12 et 14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) ; [Low Heroes, 11](https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/) | Chant sur les charges ; départ imposé d’un opérateur ; replacement entre deux actions | Atelier original de 33 découvertes, puis annexe et quatre destinations ; capacités comparées dans des situations concrètes |
| N2 — La marche à deux temps | [Low Heroes, 11](https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/) | Le Guerrier replace la Barde entre deux avancées du dispositif | Atelier sec : quatre courses chantées et quatre replacements dans le témoin, puis extraction et livraison d’une réserve |
| N3 — L’atelier du décrochage | [Heroes, Doubled, 5](https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/) | Un Voleur transporté n’effectue pas sa traction | Une presse commandée à distance fait sortir le Voleur d’un couloir sans reprendre le poids qu’il vient de déposer |
| N4 — La frontière du chant | [Heroes, Doubled, 8](https://sinkingstarwalkthrough.com/fr/heroes-doubled-solutions/) | La limite du chant permet d’atteindre une seule galerie | Un poste haut déplace le gardien sans immerger la réserve de la galerie basse ; cette réserve devient ensuite le passage final |
| N5 — Les entrées décalées | [Heroes and Light, 42](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | Trois livraisons différentes ; l’approche centrale doit conserver la bonne position relative | Trois itinéraires physiques, une entrée haute permettant un départ autonome et une entrée basse dont le départ peut être assisté |
| N6 — Le quartier des reprises | [Heroes 3: Bard, Druid, 18](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/) | Guider une charge depuis plusieurs coins de rue | Rue de fret inaccessible à pied, changements de galerie, déchargement par presse et placement final d’une caisse et d’un monstre |
| N7 — Les cales du bassin | [Heroes and Water, 33](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | Se servir des obstacles pour caler le dispositif et corriger sa position | Deux appuis vides passent d’une paire à une file puis redeviennent une paire, autour de trois butées |
| N8 — La dernière traverse | [Low Heroes, 19](https://sinkingstarwalkthrough.com/fr/low-heroes-solutions/) ; [Heroes and Water, 34](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | Déposer une pièce du dispositif puis réorganiser le reste ; préparer un trajet depuis son arrivée | Un appui reste dans la branche de retour du Voleur ; deux autres préparent la traverse finale ; une poussée mixte remplace le passeur par la caisse |

Les mêmes références sont inscrites dans les `source` de `reference/level1-design.json` à `reference/level8-design.json`, puis exportées dans [src/level-info.ts](../src/level-info.ts). Les pages restent accessibles par les crédits de chaque salle.

## Ce qui change lors de l’adaptation

### Heroes, Doubled

La référence 5 comporte deux Voleurs synchronisés ; la référence 8 emploie plusieurs héros synchronisés, dont des Magiciens. SS22 conserve un seul représentant de chacun de ses quatre rôles. Le déplacement imposé et la sélection par la portée remplacent ces dispositifs. Aucun clone, fusion ou contrôle synchronisé n’a été ajouté.

### Low Heroes

Les références 11 et 19 utilisent des constructions aquatiques dont les déplacements dépendent des règles d’empilement de l’original. Le niveau 2 en conserve le cycle de coopération dans une salle sèche. Le niveau 8 en conserve le choix entre une pièce utile au passage local et les éléments nécessaires à la suite du trajet.

Dans SS22, un appui occupé par un héros reste à sa place ; il ne véhicule personne. Un appui vide ne peut glisser que vers une autre case d’eau. Les déplacements restent d’une case. Il n’existe ni empilement, ni vitesse liée à la hauteur d’une pile, ni bord de salle raccordé à son opposé. Pour la référence 19, le guide précise en outre que son commentateur n’est pas certain d’employer la méthode prévue : SS22 reprend le problème observé, sans qualifier cette méthode de solution officielle.

### Heroes and Water

Les références 33 et 34 combinent leurs calages et leurs trajectoires avec des empilements et des avancées de deux cases. SS22 recalcule les déplacements avec son propre contrat. Dans N7, les voyageurs débarquent avant le déplacement des appuis. Dans N8, l’appui déposé sert au retour d’une caisse ; le passage hydraulique adjacent reste un dispositif distinct.

Ces deux sections du guide s’appuient sur la vidéo commentée de 塞德莎 et signalent l’absence de vidéo anglaise correspondante. Les témoins SRA ont donc été construits et rejoués indépendamment ; les séquences du guide ne sont pas présentées comme des parcours directement transposables.

### Heroes and Light

La référence 42 fait intervenir un faisceau orange. SS22 remplace ses effets par des galeries, les quatre capacités physiques et les positions relatives au chant. L’entrée haute du niveau 5 permet de repartir seul sans déplacer la charge centrale. La variante qualifiée par l’entrée basse emploie le Voleur pour retirer la Barde sans chant : **l’entrée haute n’est pas déclarée seule solution gagnante**.

### Heroes 3: Bard, Druid

La référence 12 confirme le réarrangement de cristaux au chant, mais des sous-titres masquent une partie de sa séquence. La référence 14 montre un départ imposé de la Barde après placement des poids. Ces lectures soutiennent les enseignements de N1, dont le plan est original.

La référence 18 fournit le principe des postes de commande aux carrefours. La nature exacte de sa créature rouge n’est pas fixée ici à partir des seules explications du guide : N6 emploie explicitement une caisse et un monstre SRA. Les transformations du Druide sont absentes. Les sections 20 et 21, dont le guide signale une faible fiabilité explicative, n’ont pas été utilisées pour introduire une règle.

## Règles SRA préservées

Les sources inspirent des situations ; [src/core.ts](../src/core.ts) définit leur résolution dans SS22 :

- Le Marchand pousse un occupant, le Guerrier une file contiguë, le Voleur tire l’occupant immédiatement derrière lui.
- Seul le déplacement volontaire du héros sélectionné déclenche sa capacité. Un partenaire transporté reste passif.
- Le chant prend les participants dans un carré de 5×5 centré sur la position initiale de la Barde. Il peut agir à travers un mur ; les obstacles contraignent l’arrivée de chaque participant.
- Les miroirs restent physiques et conservent leur orientation. L’action de reflet utilise les bras blancs, la priorité au plus proche et l’échange à distance égale ; aucun clone n’en résulte.
- Les monstres n’avancent pas automatiquement. Leurs mouvements proviennent des actions physiques ; les contacts sont résolus simultanément.
- Les presses poussent leur propre occupant à la fermeture et peuvent agir sur une file. Les circuits utilisent leurs boutons effectivement occupés.
- Une caisse dans l’eau sans appui devient un appui. La plateforme hydraulique et l’appui immergé sont deux objets de règle différents ; réactiver une plateforme ne supprime pas l’appui.
- La victoire exige quatre héros vivants sur les quatre buts. Ni le compteur de découvertes ni un parcours témoin ne participent à cette condition.

## Réemploi et variété

Les principes de poids maintenu, de départ imposé et d’appui mobile appartiennent déjà à la série. SS22 les combine avec un quatuor sans Magicien et met l’accent sur des problèmes différents : course chantée et replacement, choix d’une frontière de portée, desserte de trois entrées, rue de fret séparée du trajet de l’opérateur, transformation d’une paire d’appuis en file et dépose d’une pièce avant le retour d’une charge.

Le niveau 6 se lit comme un réseau de rues ; N7 comme une manœuvre de formation autour de butées ; N8 comme un chantier de deux accès interdépendants. La finale ne reprend pas le verrou à trois poids de SS21. Les cartes ne sont pas des copies des plans du guide.

La [revue indépendante](../reference/independent-ss22-review.json) compare les huit silhouettes à **64 salles de SS14–SS21**, en conservant la distinction eau/sol/mur et en neutralisant translation, rotation et réflexion. Aucun doublon exact n’est détecté. Cette comparaison ne constitue pas une mesure générale de nouveauté ou de difficulté.

## Portée des preuves

Les quatre revues documentent 69 contrôles et plusieurs variantes gagnantes. N3 peut se terminer sans impulsion de presse ; N4 dispose d’une livraison finale sans poussée du Guerrier ; N5 peut emprunter l’accès bas avec un départ assisté. Pour N6–N8, d’autres calendriers de préparation ont aussi été rejoués.

Les formulations de nécessité restent donc locales et étayées : retrait prématuré d’un appui qui coupe un accès précis, sortie autonome qui reprend une charge, fermeture d’une presse qui bloque le dernier coude, déplacement refusé d’un pont encore occupé. Les témoins établissent la solvabilité et ces effets ; ils ne démontrent ni unicité ni optimalité et ne valent pas démonstration de réussite autonome de SRA.
