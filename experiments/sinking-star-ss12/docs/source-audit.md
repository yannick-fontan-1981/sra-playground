# SS12 — audit des références et des adaptations

## Périmètre

Audit des six cartes de référence disponibles au démarrage de SS12, puis sélection des deux références les plus pertinentes pour compléter la campagne. Les pages consultées appartiennent aux deux index demandés : [North](https://sinkingstarwalkthrough.com/fr/north/) et [Crossovers](https://sinkingstarwalkthrough.com/fr/crossovers/).

Les cartes SS12 sont redessinées pour le duo Guerrier–Barde et la grille de 20 × 20 cellules. Une mention « adaptation » signifie que la contrainte ou l’enchaînement de mécanismes identifié ci-dessous est repris. Elle ne certifie ni la géométrie du jeu commercial ni l’équivalence de toutes ses règles.

## Correspondance des salles

| Salle | Référence contrôlée | Élément effectivement repris | Construction propre à SS12 |
| --- | --- | --- | --- |
| L1, tutoriel | [North](https://sinkingstarwalkthrough.com/fr/north/) et règles des zones mixtes | Complémentarité des personnages, manipulation de poids et coopération. | Deux ateliers séparés, réunion des rives, commande durable, miroir et deux arrivées. Ce niveau doit rester annoncé comme original. |
| L2, les rails et le convoi | [Heroes 3, énigme 14](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14) | Deux poids maintiennent une porte, puis le partenaire déplace la Barde sans son chant. | Deux caisses remplacent les monstres ; deux rails séparés guident leur placement ; un convoi mixte crée trois appuis. |
| L3, le quai | [Heroes 3, énigme 19](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-19) | Extraire un poids d’une niche, changer son axe et le livrer sur une commande. | Le Guerrier pousse aussi un miroir ; le Barde ramène un appui depuis le canal ; les deux héros empruntent séparément le reflet. |
| L4, les trois poids | [Heroes 2: Monsters, énigme 22](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-22) | Conserver deux monstres et une caisse pour occuper trois commandes. | Les déplacements par chant remplacent les échanges ; une presse livre la caisse dans une poche ; un miroir sert d’obstacle à ranger. |
| L5, le poids reste | [Heroes and Mirrors, énigme 1](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-1) | Quitter la portée d’une caisse-bouton par reflet afin de conserver l’ouverture. | Seconde île, caisse extraite d’un puits, appui à construire et deux destinations. |
| L6, les écluses | [Heroes and Light, énigme 1](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-1) | Des presses orientées atteignent des positions inaccessibles à la manipulation directe ; des monstres sont rapprochés. | Deux traversées d’eau, boutons tenus conjointement, obstacle miroir et duel provoqué au chant. |

L2 citait initialement [Heroes 3, énigme 12](https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-12), qui enseigne le déplacement des cristaux par le chant. L’audit a conduit à retenir l’énigme 14 comme référence principale, car elle explique plus précisément l’enchaînement de contraintes conservé. L’énigme 15 concerne trois poids répartis sur trois commandes et correspond moins à cette carte.

## Références retenues pour les dernières salles

- L7 — [Heroes and Water, énigme 27](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27) : faire progresser un appui dans un canal, employer les murs comme butées, modifier l’écart avec le Barde et changer de côté. Pour reprendre cette idée réellement, prévoir au moins un changement d’axe et une phase où le Barde avance tandis que l’appui est retenu.
- L8 — [Heroes and Water, énigme 28](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-28) : le Guerrier place la Barde sans son déplacement volontaire. Cette dépendance spécifique au duo convient à une synthèse finale. Sous les règles SS12, le poids conservé peut commander une porte ou un accès sûr.
- L8 — [Heroes and Mirrors, énigme 2](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/#%C3%A9nigme-2) complète la synthèse si le changement d’axe relatif entre le Barde et sa cargaison est réellement nécessaire. Deux miroirs simplement présents ne suffisent pas à établir cette parenté.

## Règles d’adaptation à annoncer

Le chant des guides est décrit par des lignes et certains niveaux utilisent des piles. SS12 retient la convention de la série : aura carrée de 5 × 5, translation simultanée d’une case, blocages individuels, appuis occupés ancrés, miroirs hors du chant. Ces choix doivent être enseignés dans le tutoriel et documentés comme règles de SS12. Aucun comportement de pile ou de déplacement double ne doit être promis.

Les monstres de SS12 suivent son contrat commun de combat orthogonal simultané. Les comportements de poursuite, dragons, feu, cristallisation et pouvoirs de faisceaux décrits dans certaines pages ne sont pas importés. Les portes de SS12 sont régies par leurs circuits déclarés ; elles ne deviennent pas automatiquement des portes conditionnées par l’élimination de tous les monstres.

## Pédagogie et vérification

Le tutoriel couvre déjà treize découvertes distinctes. Le texte doit insister sur trois différences causales : un pas volontaire du Barde déclenche le chant ; un mouvement imposé ne le déclenche pas ; un poids peut rester immobile pendant que d’autres éléments chantés avancent. La première salle à monstres doit rappeler le danger orthogonal et l’absence de danger diagonal.

Une route d’auteur démontre qu’une salle est soluble et qu’elle peut employer ses mécanismes. Elle ne démontre pas, seule, que chaque mécanisme est indispensable ni que la solution est unique. Éviter ces deux affirmations sans recherche dédiée ou démonstration géométrique.

Les métadonnées publiques doivent être générées depuis les références définitives : au début de l’audit, `src/level-info.ts` contenait encore d’anciens numéros de sources. Le parcours, la source annoncée et la carte jouable doivent être synchronisés avant livraison.

## Ajustement causal de L2

La première version arrêtait les rails sur les boutons. Une route alternative de 52 actions permettait alors de passer le Guerrier devant le Barde, de bâtir le pont, puis de faire suivre le Barde sans jamais le pousser. Ce n’était pas une panne, mais cela affaiblissait la reprise de l’énigme 14.

Les rails sont donc prolongés de deux cases après les boutons. Depuis la position de commande, un pas volontaire du Barde vers l’est retire les poids ; une poussée du Guerrier les conserve. La nouvelle route d’auteur réussit en 31 actions, avec 12 déplacements forcés du Barde, trois appuis créés, aucun refus et aucune mort. L’ancienne route alternative ne fonctionne plus.

Une recherche de passage du Barde sans poussée a atteint la limite fixée de 30 000 états. Elle n’établit pas une impossibilité globale ; l’amélioration démontrée porte sur la conséquence immédiate du chant, la validité de la nouvelle route et la fermeture du raccourci trouvé. Les autres recherches ciblées arrêtées sur une limite restent elles aussi inconclusives.
