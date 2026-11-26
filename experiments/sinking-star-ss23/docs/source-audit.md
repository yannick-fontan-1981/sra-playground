# SS23 — audit des sources et des adaptations

## Périmètre et méthode

**Les Chambres de Résonance** réunit le Marchand, le Guerrier, le Magicien et la Barde dans huit salles. Le niveau 1 est un atelier original ; les niveaux 2 à 8 adaptent des principes précis repérés dans les deux index demandés : [Zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/).

Les pages de walkthrough ont été ouvertes et leurs descriptions et étapes textuelles consultées le **26 novembre 2026**. Elles sont utilisées comme sources sur leurs propres explications d’énigmes. Les liens vers des vidéos servent de repères fournis par le guide ; **les vidéos n’ont pas été visionnées intégralement pour cet audit**. Aucune observation supplémentaire de leur contenu n’est revendiquée.

Les cartes, commandes et états de SS23 proviennent des huit dossiers `reference/levelN-design.json` et de leurs scripts d’auteur. Le présent document décrit les salles effectivement construites, pas la liste des inspirations envisagées pendant la recherche. Les sources expliquent les principes retenus ; elles ne constituent pas une preuve de la difficulté, de l’unicité ou de la nécessité d’un pouvoir dans notre adaptation.

## Correspondance des huit salles

| Salle SS23 | Source précise | Principe de départ | Transformation réalisée |
|---|---|---|---|
| **1 — Le conservatoire des échanges** | [Nord](https://sinkingstarwalkthrough.com/fr/north/), sans attribution à une énigme particulière | Complémentarité des pouvoirs du groupe | Atelier original, 36 découvertes publiques et plusieurs postes d’expérimentation. |
| **2 — La grille des places libres** | [Heroes of Hauling, énigme 11](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-11) | Traverser une grille de cristaux par échanges | Grille pleine de neuf caisses, sas sec décalé et déplacement des postes de travail des quatre rôles. |
| **3 — La case de trop** | [Heroes and Light, énigme 14](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-14) | Une asymétrie rompt une dépendance circulaire | Croisement sec, deux files perpendiculaires, débattement supplémentaire et butée qui reforme une file. |
| **4 — Le poste emprunté** | [Heroes and Artifacts, énigmes 4–5](https://sinkingstarwalkthrough.com/fr/heroes-and-artifacts-solutions/#%C3%A9nigme-4) | Préparer la position du spécialiste et une cible intermédiaire | Une balise permet d’installer la Barde dans une loge ; les trois charges sont ensuite réemployées comme appuis. |
| **5 — Les deux côtés du sort** | [Heroes 2: Monsters, énigmes 26–27](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-26) | Préparer les positions successives d’un échange de monstres | Sécurité de la case quittée et de la case atteinte, partenaire à éloigner, visée coudée et rencontre locale. |
| **6 — Le poste derrière la file** | [Heroes and Stones, West, énigme 9](https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/) | Le Magicien déploie le Guerrier à un autre poste de poussée | Atelier sec, chant sélectif, visée par deux miroirs, reprise d’une file et rangement par une presse latérale. |
| **7 — Le pas qui laisse un appui** | [Heroes and Stones, West, énigmes 16–17](https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/) | Mouvement relatif et élément préparé comme butée | L’occupation d’un appui décide s’il reste en place pendant le chant ; deux plateformes et une porte inverse règlent les accès. |
| **8 — La forme et la place vide** | [Heroes and Light, énigmes 52–53](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/) | Remodeler un ensemble en plusieurs morceaux ou en escalier | Deux fragments décalés sont déformés par la portée et les butées ; une réserve remplit la dernière place après le retour du Magicien. |

Les numéros 9, 16 et 17 de *Stones West* et les numéros 52 et 53 de *Light* désignent les sections numérotées des pages liées. Aucun fragment d’URL non vérifié n’est ajouté à ces liens.

## Ce que les adaptations conservent et changent

### 1. Le conservatoire des échanges

Le [dossier du niveau 1](../reference/level1-design.json) attribue explicitement la carte à un atelier original. Elle assemble la poussée simple, la poussée de file, les échanges, le chant, les appuis, les monstres, les miroirs et les presses dans une géométrie propre à SS23.

Le témoin d’auteur cherche les **36 découvertes** du [tutoriel public](../src/tutorial.ts). Leur ordre n’est pas imposé au joueur et leur acquisition ne déclenche pas la victoire. Celle-ci dépend des quatre héros vivants sur les quatre destinations. Le lien vers le Nord contextualise les familles de pouvoirs ; il ne signifie pas que le plan de cette salle serait repris du guide.

### 2. La grille des places libres

Le [niveau 2](../reference/level2-design.json) conserve une grille initiale pleine de neuf caisses. Un échange change la place de travail du Magicien tout en laissant une caisse à son départ. Les neuf caisses restent présentes dans le témoin complet.

Le sas à deux accès décalés et le travail du quatuor sont propres à SS23. La Barde désaligne une partie des rangs ; le Guerrier exploite la rangée libérée ; le Marchand transporte la Barde sans faire chanter les caisses ; le Magicien réemploie des cibles déplacées. La salle n’ajoute ni bouton final de lest ni reconnaissance cachée d’un rangement. Les vérifications comparent des postes et premières cibles précis, sans prouver que chaque capacité serait indispensable dans toute solution.

### 3. La case de trop

Le [niveau 3](../reference/level3-design.json) traduit l’asymétrie de la source dans les dimensions d’un croisement. La case supplémentaire du bras droit reçoit la tête de la file ; le Guerrier doit ensuite quitter la réception avant l’entrée du groupe chanté. Une butée retient une caisse et permet aux autres de se décaler, ce qui fabrique une nouvelle file avec le même inventaire.

Il n’y a ni faisceau de pouvoir ni traversée des murs. La comparaison avec une seule case murée montre que la seconde poussée de cette branche échoue ; elle ne prouve pas l’impossibilité de toutes les stratégies sur la carte modifiée. Une variante publiée dans le dossier emploie une caisse, plutôt que le Guerrier, pour l’échange de sortie du Magicien.

### 4. Le poste emprunté

Le [niveau 4](../reference/level4-design.json) retient la préparation d’une case de travail. Le Magicien échange d’abord avec la balise de la loge ; le Marchand retire cette balise de la ligne de retour ; un nouvel échange installe la Barde dans la loge sans déplacer les réserves.

La Barde travaille ensuite depuis deux postes dont les portées et butées diffèrent. La balise rapatriée et les deux réserves deviennent trois appuis pour la traversée du groupe. La baguette, l’Explorateur et les contraintes d’orientation du jeu source sont absents. La variante où le Marchand immerge seul la balise montre que la poussée mixte du témoin est une coopération possible, sans être une obligation de cette salle.

### 5. Les deux côtés du sort

Le [niveau 5](../reference/level5-design.json) travaille les deux extrémités d’un échange. La Barde éloigne d’abord un gardien de la caisse où le Magicien doit arriver. Le Magicien libère ensuite le Marchand, qui quitte la zone destinée à recevoir l’autre monstre. Une visée à deux coudes relie les postes, et une rencontre préparée dégage le goulot.

La géométrie livrée comporte une coupure d’eau de deux cases. Elle corrige aussi le raccourci de l’activation globale immédiate : au départ, le gardien occidental serait projeté sur la case du second miroir, ce qui refuse l’ensemble du reflet sans effet partiel. Une variante complète de **51 entrées** conserve un reflet après préparation, avec un poste d’évacuation intermédiaire pour le Marchand et un véritable échange de monstre. Le témoin principal compte **50 entrées** ; une autre variante de **54 entrées** avance l’échange de caisse entre les deux premiers chants. Ces contrôles qualifient des positions et des branches précises, pas toutes les stratégies optiques possibles.

Les monstres de SS23 restent stationnaires hors transport. Les contacts orthogonaux sont résolus simultanément ; aucune héroïne invulnérable, poursuite, attaque ou porte à décompte de morts n’est ajoutée. Les branches dangereuses documentées concernent des emplacements identifiés. La rencontre observée n’est pas transformée en quota de morts ou en unique moyen autorisé de déplacer les gardiens.

### 6. Le poste derrière la file

Le [niveau 6](../reference/level6-design.json) remplace l’urgence temporelle et le ricochet de la source par une contrainte d’accès. Le mur de fond arrête la file ; la presse ferme sa reprise inférieure ; un chant depuis la bordure de portée abaisse seulement la caisse proche. Le Magicien utilise ensuite deux faces blanches pour échanger avec le Guerrier en contournant les caisses.

Depuis l’autre atelier, le Guerrier aligne les charges puis les pousse ensemble. En quittant la commande, il provoque une fermeture qui pousse effectivement les deux blocs sur leurs boutons. La Barde se retire le long de l’axe où la butée retient ce rangement.

Les miroirs fixes et la presse sont des moyens SRA ajoutés à la transposition. Aucun chronomètre, mouvement continu, feu ou bateau n’est repris. La variante gagnante prépare le bloc droit avant le chant : l’ordre du témoin n’est donc pas unique. Faire tomber un bloc dans l’eau ouvre un accès local mais retire l’un des deux poids secs nécessaires au rangement.

### 7. Le pas qui laisse un appui

Le [niveau 7](../reference/level7-design.json) repose sur une différence entre un appui occupé et un appui vide. La réserve posée sur le premier appui sert de cible au Magicien. L’échange la rapatrie et place le Magicien sur cet appui. Pendant le chant suivant, **le Magicien est entraîné sur une plateforme** ; son appui de départ reste en place, alors que l’appui vide glisse d’une case. Le héros n’est jamais porté par un appui mobile.

Le poste nord permet un échange qui retire la Barde de sa galerie de commande. Une porte inverse du circuit ne libère ce poste que pendant le retrait des plateformes. Cette alternance empêche la galerie nord de constituer un contournement permanent du passage occidental. La porte des arrivées dépend du même poids : la réserve ne peut pas simplement être abandonnée dans l’eau pour remplacer le circuit.

Le Guerrier remplace le Marchand par une poussée de file qui maintient le circuit, puis installe la Barde silencieusement pour le dernier départ. Le dernier duo laisse d’abord l’appui occidental en place, puis le déplace derrière lui une fois l’accès franchi. La variante livrant la réserve plus tôt déplace celle-ci temporairement pour ouvrir la porte nord, puis la remet sur son bouton.

Le jeu source utilise des effets de ricochet, de vitesse et de butée que SS23 n’importe pas. La transposition emploie uniquement l’occupation, la portée, les collisions et les dispositifs déjà présents dans le moteur.

### 8. La forme et la place vide

Le [niveau 8](../reference/level8-design.json) commence avec **deux fragments**, séparés par une rangée vide et décalés de deux colonnes. Il ne reprend pas la grille pleine du niveau 2. Les membres du fragment inférieur encore hors de portée retiennent d’abord ceux qui entendent le chant : ce rang reste immobile pendant les deux premiers pas vers la droite et commence à suivre au troisième.

Les butées retiennent ensuite les rangs à des moments différents. La montée conserve une paire en bas et remodèle les autres blocs dans la partie haute. La fabrication de cette composition est le problème central. L’échange qui retire ensuite la Barde préserve le travail réalisé ; cette extraction silencieuse n’est pas présentée comme une nouveauté de SS23.

Le Marchand amène la réserve à la fenêtre de retour. En échangeant avec elle, le Magicien quitte l’atelier et laisse le neuvième poids dans sa propre place. Les neuf boutons physiques commandent la porte : aucun test de forme, quota de chants ou ordre d’actions ne remplace cette règle. La variante gagne avec une réserve garée plus bas puis remontée avant son emploi final.

Les explosions, le multicolore, le prisme et l’empilement ne sont pas repris. Les neuf blocs sont conservés comme poids ; convertir la réserve en appui laisse seulement huit blocs pour neuf boutons.

## Contrat SRA commun aux adaptations

Le [moteur](../src/core.ts) reste la référence pour les effets exacts. Les descriptions de walkthrough ne permettent pas d’importer implicitement leurs règles.

- Le Marchand déplace un seul occupant ; le Guerrier peut pousser une file contiguë, y compris un partenaire.
- Le Magicien échange avec la première cible admissible de sa visée. Les faces blanches des miroirs peuvent dévier ce rayon. Une cible laissée à l’ancien emplacement du Magicien fait partie du nouvel état du problème.
- Le chant est évalué dans un carré de cinq cases, centré sur le départ de la Barde. Un membre bloqué peut rester en place ; déplacer un partenaire par une autre force ne déclenche pas son pouvoir personnel.
- Un appui occupé par un héros reste ancré. Un appui déplacé par le chant glisse entre cases d’eau et ne porte pas de passager. Les plateformes commandées sont un dispositif distinct.
- Les monstres sont des occupants transportables et dangereux au contact. Il n’y a pas de compteur de monstres pour ouvrir une porte.
- Les presses agissent lors de leur fermeture. Les miroirs, appuis et ressources ne se dupliquent pas.
- Les quatre destinations doivent être occupées par les quatre héros vivants. Les découvertes du tutoriel ne sont pas un quota de victoire.

## Variété recherchée et limites de la nouveauté

Les sept références d’adaptation choisies diffèrent des numéros utilisés dans SS22 : *Low Heroes* 11/19, *Heroes, Doubled* 5/8, *Heroes and Light* 42, *Heroes 3: Bard, Druid* 12/14/18 et *Heroes and Water* 33/34. Le [dossier SS22](../../sinking-star-ss22/docs/source-audit.md) permet de vérifier ces correspondances historiques.

La variété porte aussi sur le problème spatial : sas de grille, croisement à débattement, loge de travail, réception de danger, atelier à reprise optique, occupation d’appuis et composition de fragments. Le niveau 6 place la manutention sur terre et emploie 15 cases d’eau pour séparer les postes et contraindre certaines livraisons ; le niveau 8 utilise deux fenêtres d’eau sans trajet d’appuis mobiles. Les trois dernières salles ne forment donc pas trois variantes d’un même quai.

Les échanges silencieux, les poids maintenus sur des boutons, les miroirs et les traversées par appuis existaient dans les campagnes précédentes. La présence du Magicien et de la Barde ensemble ne suffit pas à revendiquer une mécanique nouvelle. Dans SS23, l’intérêt supplémentaire vient des postes de travail, des premières cibles, des sous-groupes sélectionnés et des effets différents des butées. Les cartes et leurs états locaux doivent soutenir ces distinctions ; changer seulement un nom de salle ne les établirait pas.

## Preuves disponibles et portée des résultats

Les huit fichiers de conception contiennent les témoins, métriques, étapes et limites propres aux salles. Les trois dernières sont complétées par la revue finale d’auteur : [review-final-ss23.mjs](../reference/author/review-final-ss23.mjs) produit [final-ss23-review.json](../reference/final-ss23-review.json).

Cette revue comprend **25 contrôles réussis** sur les témoins, les différences de portée, les accès, les poids, les fermetures et les mouvements d’appuis. Elle comporte trois variantes complètes : 120 entrées pour le niveau 6, 176 pour le niveau 7 et 138 pour le niveau 8, toutes sans refus ni décès. Les témoins principaux correspondants comptent respectivement 126, 172 et 112 entrées.

Ces résultats montrent des résolutions effectives et des contre-épreuves locales. Ils ne prouvent pas une solution unique, l’optimalité du nombre d’actions ou la nécessité exclusive de chaque rôle. Aucun budget de solveur épuisé n’est présenté comme une impossibilité démontrée. La qualification de l’interface, l’intégration native, les références GitHub et la publication relèvent des rapports de validation et de livraison ; cet audit de sources ne leur attribue aucun statut anticipé.
