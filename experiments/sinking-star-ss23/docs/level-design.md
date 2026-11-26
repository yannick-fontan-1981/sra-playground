# SS23 — progression et conception des huit salles

## Intention et contrat

**Les Chambres de Résonance** associe le Marchand, le Guerrier, le Magicien et la Barde. Son problème commun est la préparation d’une place de travail : un échange laisse une cible à son départ, une poussée réclame le bon côté, et un chant dépend à la fois de sa portée et de ce qui bloque chaque membre du groupe. Le joueur prépare donc le geste suivant en même temps que le déplacement présent.

Chaque salle comporte les quatre rôles et quatre destinations distinctes. La victoire dépend de leur occupation simultanée par les quatre héros vivants. Les cartes font au plus 20 × 20 cases, centrées dans le terrain commun ; l’observation publique conserve le format 64 × 64 pixels et les seize couleurs. Les témoins d’auteur servent à la qualification et ne sont pas embarqués comme aide cachée dans le jeu.

| Rôle | Effet à anticiper | Question de conception |
| --- | --- | --- |
| Marchand | Pousse un seul occupant devant lui | Quel emplacement doit être dégagé sans déplacer toute la file ? |
| Guerrier | Pousse la file contiguë | Comment atteindre son autre extrémité et conserver un débouché ? |
| Magicien | Échange avec la première cible admissible de sa visée | Que deviennent les deux extrémités du sort, et quelle cible masque la suivante ? |
| Barde | Entraîne les occupants admissibles dans le carré initial de portée | Qui suit, qui reste retenu et depuis quel poste peut-on changer ce sous-groupe ? |

Un héros transporté ne déclenche pas sa capacité personnelle. Le rayon peut traverser l’eau et être dévié par les faces blanches des miroirs ; il ne construit pas un passage. Le chant peut atteindre une pièce à travers une cloison, mais cette pièce doit toujours disposer d’une arrivée possible. Un appui occupé reste ancré ; un appui chanté glisse entre cases d’eau sans porter de passager. Ces distinctions sont enseignées dans la première salle puis croisées avec des contraintes spatiales différentes.

## Vue d’ensemble

Les nombres ci-dessous décrivent des résolutions complètes, sans refus ni décès. Une entrée comprend soit une sélection, soit une commande physique ; ce ne sont pas des records d’optimalité.

| Salle | Problème spatial principal | Entrées du témoin | Sélections |
| --- | --- | ---: | ---: |
| 1 — Le conservatoire des échanges | Atelier de comparaison des pouvoirs et de leurs effets imposés | 221 | 34 |
| 2 — La grille des places libres | Faire circuler les places de travail dans une grille pleine | 91 | 12 |
| 3 — La case de trop | Libérer un croisement puis reformer une file avec une butée | 43 | 12 |
| 4 — Le poste emprunté | Envoyer la Barde dans une loge et réemployer la balise | 132 | 17 |
| 5 — Les deux côtés du sort | Sécuriser les deux réceptions d’un échange dangereux | 50 | 16 |
| 6 — Le poste derrière la file | Rejoindre l’autre côté des charges et exploiter une fermeture | 126 | 28 |
| 7 — Le pas qui laisse un appui | Choisir l’appui ancré puis organiser le départ des occupants | 172 | 33 |
| 8 — La forme et la place vide | Composer un motif à partir de fragments qui entrent progressivement dans la portée | 112 | 21 |
| **Total** | **Huit salles, quatre destinations chacune** | **947** | **173** |

Les témoins comportent donc **774 commandes physiques**. Les références précises, les éléments conservés et les règles volontairement absentes des adaptations sont détaillés dans [l’audit des sources](source-audit.md).

## 1. Le conservatoire des échanges

**Atelier original**, contextualisé par le monde [Nord](https://sinkingstarwalkthrough.com/fr/north/), sans attribution à un numéro de puzzle du guide. Le plan réunit plusieurs postes de manutention, une baie d’appuis, des gardiens, une presse, des miroirs et la commande des arrivées. Le [dossier de conception](../reference/level1-design.json) contient les étapes du témoin de 221 entrées.

Le tutoriel suit **36 découvertes** à partir des images publiques. Elles décrivent des effets observés ; leur acquisition n’ajoute aucune condition de victoire et leur ordre reste libre.

| Ensemble pédagogique | Découvertes suivies | Nombre |
| --- | --- | ---: |
| Commandes | Sélection et déplacement | 2 |
| Manutention | Poussées du Marchand et du Guerrier, file, file mixte, partenaire poussé, miroir déplacé, relève de poids | 7 |
| Échanges | Échange, première cible, partenaire, rayon coudé, visée sur l’eau, marche sans cible, retrait silencieux de la Barde | 7 |
| Chant | Chant, partenaire entraîné, sélection par une butée, coin de portée, cloison traversée, monstre entraîné | 6 |
| Eau | Immersion, glissement d’appui, ancrage, traversée à pied | 4 |
| Reflets | Activation, reflet de héros, reflet de caisse | 3 |
| Dispositifs et danger | Monstre stationnaire, bouton, porte, presse, monstre poussé par presse, rencontre de monstres, quatre arrivées | 7 |

Le départ fait pousser au Guerrier une file comprenant ses trois partenaires et une caisse. Cette comparaison montre immédiatement que transporter le Magicien ou la Barde ne lance ni échange ni chant. Plus loin, le rayon retire la Barde de la baie sans reprendre les appuis ; un chant déplace au contraire le Magicien d’une case sans sort. Le travail optique distingue le déplacement physique d’un miroir, son activation globale et la déviation d’un rayon.

La commande finale reste un problème matériel de maintien d’occupant. Les exercices supplémentaires rendent l’atelier riche en enseignement sans imposer au joueur d’exécuter chaque démonstration du témoin avant de sortir. La [revue d’introduction](../reference/intro-ss23-review.json) comporte treize contrôles ; la revue indépendante vérifie aussi les transports imposés, les appuis et les quatre destinations.

## 2. La grille des places libres

**Référence :** [Heroes of Hauling, énigme 11](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-11). **Plan :** grille sèche de neuf caisses et sas décalé. **Témoin :** 91 entrées.

Le Magicien ne crée pas un vide en traversant la grille : chaque échange renvoie la caisse à son ancienne place. Ce déplacement de la place de travail permet d’accéder à une autre face du problème. La Barde descend ensuite les colonnes proches tandis que la colonne hors de portée reste en place. Le Guerrier exploite la rangée dégagée pour ranger une charge dans une niche et libérer l’accès droit.

Les nouveaux emplacements des caisses deviennent à leur tour des cibles. Le Magicien revient par un autre axe et installe les partenaires ; le Marchand avance la Barde par six poussées simples sans faire chanter les charges voisines. Le dernier chant ouvre le sas et entraîne aussi le Marchand vers la chambre d’arrivée.

Les neuf caisses sont conservées à chaque étape. Il n’y a ni porte à alimenter ni validation cachée de leur rangement final : la contrainte porte sur les accès et les places disponibles. Les [huit contrôles propres à cette salle](../reference/level2-ss23-review.json) comparent notamment les premières cibles et les postes de travail. Ils n’établissent pas que chaque geste du témoin serait indispensable à toute solution.

## 3. La case de trop

**Référence :** [Heroes and Light, énigme 14](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/#%C3%A9nigme-14). **Plan :** croisement sec, deux files courtes et bras droit asymétrique. **Témoin :** 43 entrées.

La case supplémentaire du bras droit accueille la tête de la file poussée par le Guerrier. Celui-ci quitte ensuite le croisement : s’il reste à la réception, le groupe chanté ne peut pas y entrer. La Barde fait descendre les deux charges du bras nord, puis les décale vers la gauche. Une butée retient une caisse pendant que les autres avancent ; les quatre mêmes charges forment ainsi une nouvelle file verticale, réutilisée depuis le poste inférieur.

Trois comparaisons locales rendent cette préparation lisible : l’entrée chantée échoue sur le croisement encore occupé ; murer la seule case supplémentaire bloque la seconde poussée de cette branche ; laisser le Guerrier à la réception bloque également le dernier pas d’entrée. Ces échecs circonscrits ne prouvent pas l’impossibilité de toutes les stratégies dans une carte modifiée.

Une **variante gagnante de 37 entrées** laisse partir le Guerrier avant d’échanger le Magicien avec une caisse. Elle conserve les trois poussées de file et les quatre chants utiles, mais change la cible de sortie. Elle est conservée dans le [dossier du niveau](../reference/level3-design.json) et rejouée indépendamment. Le croisement et le réemploi des charges constituent le problème ; l’identité de la cible finale reste ouverte.

## 4. Le poste emprunté

**Références :** [Heroes and Artifacts, énigmes 4–5](https://sinkingstarwalkthrough.com/fr/heroes-and-artifacts-solutions/#%C3%A9nigme-4). **Plan :** loge au-delà d’un bassin, deux réserves et une case de service. **Témoin :** 132 entrées.

La première cible est une balise dans la loge. L’échange y place le Magicien et renvoie la caisse dans l’atelier de départ. Avant le retour du rayon, le Marchand doit retirer cette caisse de la ligne : sinon le sort reprend simplement la balise et laisse la Barde sur place. Une fois cette interception supprimée, l’échange envoie la Barde dans son poste de travail, sans déplacer les réserves.

Depuis la loge, la portée atteint la première réserve sans atteindre la seconde. Des déplacements entre postes et des butées permettent ensuite de prendre en charge chaque réserve et de conserver ce qui a déjà été livré. La balise rapatriée est elle aussi réemployée : les trois caisses initiales deviennent les trois appuis de la traversée collective. La case de service ménage un départ qui laisse ces appuis en place.

La **variante de 133 entrées** fait immerger la balise par le Marchand seul. Elle ne comporte aucune poussée du Guerrier et termine avec les mêmes ressources réemployées. La poussée mixte du témoin principal est donc une coopération possible, pas une obligation artificielle. Les contrôles de portée, d’interception et de conservation figurent dans le [dossier du niveau](../reference/level4-design.json). La transposition porte sur la position du spécialiste ; elle n’importe ni baguette ni règle d’orientation de la source.

## 5. Les deux côtés du sort

**Références :** [Heroes 2: Monsters, énigmes 26–27](https://sinkingstarwalkthrough.com/fr/heroes-2-monsters-solutions/#%C3%A9nigme-26). **Plan :** trois postes, coupure d’eau de deux cases et visée à deux coudes. **Témoin :** 50 entrées.

Le Magicien peut viser la caisse de l’autre rive dès le départ, mais son arrivée serait voisine du premier gardien. La Barde éloigne donc celui-ci. Un seul décalage suffit à cette arrivée ; le second dégage aussi le passage que doit emprunter le Marchand après son échange avec le Magicien. Cette différence entre sécurité de l’arrivée et sécurité du prochain départ est vérifiée par une contre-branche mortelle précise.

Le Marchand quitte ensuite le voisinage destiné à recevoir l’autre monstre. Le rayon dévié par les deux miroirs échange ce gardien avec le Magicien. Replacer le Marchand dans la niche voisine avant le sort provoque sa mort ; le laisser au poste de retrait rend la même réception sûre. La Barde ramène enfin le premier gardien vers le second. Leur rencontre libère le goulot, puis la caisse initiale sert de nouveau à faire revenir le Magicien.

La revue a découvert un raccourci dans une version antérieure : l’activation globale immédiate des miroirs supprimait les deux gardiens avant les préparations. La carte livrée corrige cette géométrie. Au départ, le gardien occidental serait projeté sur la case du second miroir ; l’activation est donc refusée atomiquement, sans déplacement partiel. Il s’agit d’une collision ordinaire du moteur, sans restriction spéciale sur le nombre de sorts ou de monstres.

Les autres ordres légaux restent acceptés. Une **variante de 54 entrées** échange la caisse entre les deux premiers chants. Une **variante de 51 entrées** utilise un reflet après la préparation et un poste d’évacuation intermédiaire pour le Marchand. Elle conserve un véritable échange de monstre et la sécurité des deux réceptions. Ces parcours, le refus initial et les branches dangereuses sont persistés dans le [dossier du niveau](../reference/level5-design.json). Aucun gardien ne sert de lest et aucune porte ne dépend d’un décompte de morts.

## 6. Le poste derrière la file

**Référence :** [Heroes and Stones, West, énigme 9](https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/). **Plan :** atelier de poussée, poste opposé, ligne optique et presse latérale. **Témoin :** 126 entrées.

Le Guerrier avance deux caisses jusqu’au mur de fond. Le chant depuis la bordure de portée abaisse seulement la caisse proche ; l’autre reste sur son axe. Un rayon à deux coudes échange alors le Guerrier avec le Magicien et lui donne accès à l’autre poste de poussée. Le spécialiste peut réorienter la file depuis un côté qui ne se résume pas à son trajet d’approche initial.

Le travail des charges s’effectue sur le sol sec ; l’eau sépare des postes et constitue une mauvaise destination pour les deux poids requis. Le Guerrier met la seconde caisse au niveau de la première, puis les pousse ensemble vers la gauche. En quittant la commande, il fait fermer la presse, dont l’impulsion participe effectivement au rangement final des deux caisses sur leurs boutons.

Le départ de la Barde compte autant que la livraison. Après le rangement des partenaires hors de sa portée, descendre emporterait les poids et refermerait l’accès ; le départ latéral du témoin utilise la butée pour les conserver. La revue indépendante rejoue cette mauvaise direction depuis le bon état de préparation. Une **variante gagnante de 120 entrées** prépare la caisse droite avant le chant : le transfert de poste et le rangement restent utiles, sans imposer un ordre unique. Voir le [dossier du niveau](../reference/level6-design.json) et la [revue finale](../reference/final-ss23-review.json).

## 7. Le pas qui laisse un appui

**Références :** [Heroes and Stones, West, énigmes 16–17](https://sinkingstarwalkthrough.com/fr/heroes-and-stones-west-solutions/). **Plan :** appuis, plateformes commandées, galerie nord et porte des arrivées. **Témoin :** 172 entrées.

La caisse posée sur l’appui occidental fournit une cible au Magicien. L’échange la rapatrie et place le Magicien sur cet appui. Au chant suivant, le héros se déplace séparément sur la plateforme, son appui de départ reste ancré et l’appui vide glisse. La différence vient de l’occupation au début du geste. Si le Magicien quitte volontairement l’appui avant ce chant, les deux appuis glissent et l’entrée occidentale devient de l’eau nue : la revue observe cette perte d’accès, sans prétendre qu’elle serait irréparable.

Le Magicien retire ensuite la Barde vers le poste nord. Le retrait momentané du poids ouvre la porte inverse de cette galerie et désactive les plateformes ; le témoin ménage cette fenêtre lorsque les héros concernés n’occupent plus ces plateformes. Le circuit est rétabli avant leur utilisation suivante. Plus tard, le Guerrier remplace le Marchand par la caisse avec une poussée de file qui maintient l’occupation du bouton.

Les deux premiers voyageurs franchissent le passage, puis le Guerrier installe silencieusement la Barde. Le dernier duo conserve d’abord l’appui de départ avant de le déplacer une fois son accès franchi. Aucun appui mobile ne transporte de passager. La **variante de 176 entrées** livre la caisse plus tôt, la déplace temporairement pour la fenêtre nord puis la remet sur son bouton. Les [contrôles du niveau](../reference/level7-design.json) distinguent l’ancrage, l’alternance du circuit et la relève finale.

## 8. La forme et la place vide

**Références :** [Heroes and Light, énigmes 52–53](https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/). **Plan :** deux fragments décalés, fenêtres d’échange, butées et réserve séparée. **Témoin :** 112 entrées.

Le départ comporte un fragment de cinq caisses et un fragment de trois, séparés par une rangée vide et décalés de deux colonnes. La réserve est isolée. Les composantes initiales sont donc **5 / 3 / 1**, tandis que le niveau 2 commence avec une grille pleine de neuf caisses. La comparaison ne repose pas seulement sur les murs : les deux premiers chants laissent le rang inférieur immobile parce que ses membres hors de portée retiennent le reste ; il rejoint le mouvement au troisième chant.

Le Magicien a préalablement ouvert une place de travail et envoyé la Barde au milieu des fragments. Les butées interrompent ensuite les rangs à des moments différents. Les chants vers le haut déplacent la partie supérieure tout en laissant une paire en bas. La forme obtenue couvre huit boutons ; la Barde occupe le neuvième. Ce résultat provient des collisions et de la portée, sans reconnaissance spéciale de motif.

L’échange qui retire la Barde laisse le Magicien à sa place et préserve la composition. Le Marchand amène la réserve à la fenêtre de retour. Le dernier échange dépose cette caisse à la place du Magicien : les neuf boutons sont alors occupés par les neuf charges, et le groupe peut partir. Convertir la réserve en appui retire un poids sec de cet inventaire.

La **variante de 138 entrées** gare la réserve plus bas puis la remonte avant son emploi final. L’extraction silencieuse d’un opérateur et le maintien de poids existaient déjà dans la série ; le problème propre à cette salle est la construction préalable des fragments et leur entrée progressive dans la portée. Le [dossier du niveau](../reference/level8-design.json) et la revue indépendante vérifient notamment les trois premiers chants, les neuf poids et leur conservation pendant le remplacement final.

## Variété et limites des preuves

La campagne alterne atelier, grille de circulation, croisement, loge, réceptions dangereuses, reprise de file, ancrage d’appuis et composition de fragments. Les niveaux 2 et 3 n’emploient ni eau ni porte finale. Le niveau 4 réemploie trois ressources pour une traversée ; le niveau 5 utilise ses deux cases d’eau pour séparer les postes d’échange ; le niveau 8 utilise ses fenêtres d’eau sans construire un nouveau trajet d’appuis. Les salles 6 à 8 partagent des circuits maintenus, mais leur préparation centrale diffère.

La lecture de SS14–SS22 a identifié plusieurs motifs déjà fréquents : chanter des poids puis extraire la Barde, réemployer un miroir comme lest, ouvrir une réserve avant une traversée, déplacer des appuis entre quais et livrer des gardiens sur des boutons. SS23 ne présente pas ces outils connus comme des inventions. Les rapprochements qualitatifs et les répétitions de mécanismes secondaires sont consignés dans la [revue indépendante](../reference/independent-ss23-review.json).

Le contrôle global compare les huit terrains à **72 terrains de SS14–SS22**, après suppression des marges de mur, normalisation des occupants et comparaison sous les huit symétries du plan. Aucun terrain exactement repris n’a été détecté. Cette comparaison établit une différence géométrique précise ; elle ne mesure ni la difficulté ressentie ni toute ressemblance de raisonnement.

Le même contrôle calcule `maximumIndividualWalkingGoalAssignment` : chaque héros marche individuellement avec les autres pièces fixes, ses pouvoirs désactivés, les circuits recalculés à chaque position et les cases adjacentes aux monstres exclues. Même dans la variante qui ignore les partenaires comme obstacles, cette affectation reste inférieure à quatre pour chaque salle. Dans le tutoriel, les trois partenaires peuvent atteindre les buts tant que le Magicien garde la commande, mais celui-ci ne les rejoint pas seul. Ce contrôle détecte un contournement par marche individuelle ; il ne constitue pas une preuve d’impossibilité d’un plan coopératif sans tous les pouvoirs du témoin.

Les cinq revues totalisent **85 contrôles réussis** : treize pour le tutoriel, huit pour N2, vingt et un pour N3–N5, vingt-cinq pour N6–N8 et dix-huit pour la lecture indépendante. Cette dernière exécute directement les commandes numériques avec `stepDetailed`, sans solveur ni helper de construction de route. Elle compare les cartes compilées aux dossiers, vérifie les quatre rôles vivants, les quatre destinations, la finalité de la dernière action et les causes des déplacements observés.

Un témoin gagnant prouve la résolubilité. Une contre-branche établit une conséquence depuis l’état annoncé. Aucun de ces résultats ne prouve une solution unique, une longueur optimale ou l’obligation universelle d’activer chaque capacité. Les variantes complètes restent publiées dans les dossiers et les rapports. La qualification de l’interface, de l’intégration native, de la continuité SIC et de la livraison est suivie séparément dans les rapports de validation, sans statut anticipé ici.

## Fichiers de référence

- `reference/level1-design.json` à `reference/level8-design.json` : cartes, commandes, métriques, étapes et adaptations.
- [reference/intro-ss23-review.json](../reference/intro-ss23-review.json) et [reference/level2-ss23-review.json](../reference/level2-ss23-review.json) : tutoriel et grille de places libres.
- [reference/middle-ss23-review.json](../reference/middle-ss23-review.json) : niveaux 3–5, préparations, dangers, ressources et variantes.
- [reference/final-ss23-review.json](../reference/final-ss23-review.json) : niveaux 6–8, circuits, portée, appuis et variantes.
- [reference/independent-ss23-review.json](../reference/independent-ss23-review.json) : huit rejeux directs, quatre raccourcis examinés et comparaison qualitative.
- [scripts/verify-design-constraints.mjs](../scripts/verify-design-constraints.mjs) : contrôle des terrains et de la marche individuelle à ressources fixes.
- [docs/source-audit.md](source-audit.md) : sources précises, transformations et règles non importées.
