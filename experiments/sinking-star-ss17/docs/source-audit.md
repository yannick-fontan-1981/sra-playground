# SS17 — sources, adaptations et portée des preuves

Audit des guides effectué le 22 novembre 2026. Les deux entrées demandées sont les index [Zones mixtes](https://sinkingstarwalkthrough.com/fr/crossovers/) et [Nord](https://sinkingstarwalkthrough.com/fr/north/). Les références ci-dessous désignent leurs guides détaillés et leurs énigmes numérotées ; les index seuls ne constituent pas la justification d’une adaptation.

## Contraintes retenues dans les guides

| Guide consulté | Énigmes | Contrainte retenue |
| --- | --- | --- |
| [Heroes of Hauling](https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/) | 13 | Un échange relève un héros qui maintient une plaque. |
| Même guide | 19 | Des blocs remplacent les héros emprisonnés, qui rejoignent l’espace commun. |
| Même guide | 20 | La libération des alcôves dépend de la réaffectation de leurs charges. |
| [Heroes and Water](https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/) | 10 | Préserver une ligne de récupération ; une charge mal placée masque la sortie utile. |
| Même guide | 11 | Échanger deux occupants ne change pas leur nombre sur chaque île ; un passage matériel permet un transfert. |
| Même guide | Métamonde 4 | Un gardien peut être déplacé par échanges successifs pour maintenir une commande. |
| Même guide | 12 | Le retrait d’un soutien fait tomber la créature qu’il portait. |
| [Heroes and Mirrors](https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/) | 30 | Un miroir dévie la visée du Magicien vers une charge située derrière un angle. |
| Même guide | 31 | Le placement du miroir prépare une géométrie de sortie précise. |
| Même guide | 32 | Ranger un miroir trop tôt peut condamner un accès ou un échange encore utile. |

Les passages utilisés ont été lus dans les guides textuels. Les cartes SS17, leurs coordonnées, leurs circuits et leurs sprites sont originaux. Les étapes des vidéos ne sont pas présentées comme des trajectoires reproduites à l’identique.

## Correspondance avec la campagne

| SS17 | Références précises | Construction SS17 |
| --- | --- | --- |
| 1 — Les trois cours de la forteresse | Water 10–11 ; Hauling 13 ; Mirrors 30–31 | Tutoriel du trio : chantier, première cible, réglage de miroir, transfert des héros et relève des commandes. |
| 2 — Les cellules de relève | Hauling 13 et 19 | Deux cellules séparées par l’eau ; le Magicien les remplit de blocs après avoir libéré leurs héros. Une presse dépose une charge dans un logement, puis le Voleur extrait le dernier poids. |
| 3 — Le compte des îles | Water 10 et 11 | Deux demi-ponts construits depuis les rives opposées. Le Guerrier doit être récupéré après dégagement du premier obstacle à la visée. La dernière charge devient un poids distant. |
| 4 — Le miroir, puis le lest | Mirrors 30 et 31 | Le Voleur extrait le miroir, puis quitte le rayon ; un échange coudé relève le Magicien sur son îlot. Le Guerrier et le Voleur réemploient ensuite ce miroir comme lest. |
| 5 — La relève à angle droit | Water Métamonde 4, 12 et 11 | Le gardien échangé arrive dans une presse, deux charges sortent d’une réserve, puis la clef et le miroir changent de fonction. Une autre solution vérifiée utilise une navette de reflets sans créer d’appui. |
| 6 — Les deux emplois des miroirs | Mirrors 32 ; Water 11 | Un rayon à deux coudes précède trois transports géométriques. La clef retire les soutiens, puis les deux miroirs et cette clef deviennent trois poids. |
| 7 — Les trois vies de la clef | Hauling 20 ; Water Métamonde 4 et 11 | Le parcours principal donne trois rôles à la clef et deux usages optiques au miroir. Une autre solution conserve le chantier mais affecte directement la clef au lest occidental. |
| 8 — La forteresse aux deux visées | Mirrors 31–32 ; Hauling 19 ; Water 11 | Deux stations successives accordent les miroirs. Une réception de monstre, trois projections, un appui de sortie d’alcôve et trois sas composent le parcours principal. Le dernier sas exige que l’alcôve soit vide. |

## Écarts de règles assumés

SS17 contient exactement le Guerrier, le Voleur et le Magicien. Il ne reprend ni Clerc flottant, ni dragon, ni feu, ni duplication ou fusion de héros. La composition des salles et le remplacement des créatures sont documentés dans `adaptation.changed` de chaque fichier de référence.

Le Magicien échange avec le premier héros, bloc mobile ou monstre rencontré par son rayon. Les miroirs dévient ce rayon mais n’en sont pas des cibles : le miroir spécial du guide 31 devient donc un outil à déplacer physiquement avec le Guerrier et le Voleur. Le reflet global conserve ses propres règles de distance, distinctes de la visée magique.

Dans SS17, un bloc immergé devient un appui fixe persistant. Le guide Water décrit aussi des situations où la réactivation d’un soutien détruit ce qui a coulé ; cette destruction n’est pas importée dans notre moteur. Les presses latérales, leurs directions et leurs cascades suivent la spécification SS17. Une porte-poussoir n’est pas en même temps un bouton dans cette campagne.

La conservation des occupants concerne l’échange atomique lui-même, avant d’éventuels effets de terrain ou de circuit. Elle ne signifie pas qu’un pont précis soit nécessaire dans toute solution : les reflets peuvent aussi transporter un occupant. Le niveau 5 possède justement une solution vérifiée par cette autre voie.

## Ce que prouvent les témoins et les audits

Les commandes des références sont rejouées dans le même moteur que le jeu. Chaque témoin principal gagne avec les trois héros vivants, zéro refus et zéro mort. Les comptes incluent les sélections de personnage ; ils ne mesurent ni une difficulté objective, ni un minimum de coups.

Les auteurs des niveaux 2–4 vérifient également des contre-branches précises : presse réarmée avant chargement ; retour intercepté par un bloc plus proche ; Voleur oublié dans le rayon ; confusion entre échange magique et reflet géométrique. Une contre-branche montre le résultat de cette décision dans cet état. Elle ne démontre pas l’impossibilité de toutes les autres solutions.

### Niveau 5 : trois solutions conservées

| Parcours | Entrées | Échanges | Reflets | Appuis créés | Résultat |
| --- | ---: | ---: | ---: | ---: | --- |
| Référence | 241 | 1 | 0 | 2 | WIN, zéro refus/mort |
| Extraction par poussée en chaîne | 215 | 1 | 0 | 2 | WIN, zéro refus/mort |
| Navette de reflets | 257 | 8 | 3 | 0 | WIN, zéro refus/mort |

L’alternative de 215 entrées évite les tractions des deux charges de réserve. Celle de 257 entrées extrait les deux charges avant de réaffecter la clef au bouton orange, les transporte par reflet, puis utilise l’une d’elles comme cible de retour. Il serait donc incorrect d’affirmer que le pont, ou les tractions de ces deux charges, sont obligatoires.

Les preuves complètes sont `reference/level5-chain-alternative.json` et `reference/level5-ferry-alternative.json`. L’audit indépendant rejoue ces deux solutions et la référence, vérifie leurs cartes et leurs métriques, puis vérifie trois erreurs locales mortelles : relâcher la presse avant l’échange initial, substituer un reflet au premier sort, refléter avant de dégager un héros plus proche que la charge.

### Niveau 6 : retrait hydraulique et solution de rechange

L’ancienne solution de 170 entrées utilisait des caisses comme lests et gardait les plateformes actives. Le verrou ajouté en `(18,14)` ferme désormais l’accès au but supérieur tant que la retenue reste occupée. Le témoin principal de 170 entrées reste valide ; l’ancienne variante échoue au tour 133.

Une solution plus élaborée de 214 entrées reste gagnante sans utiliser les miroirs : trois transpositions successives du gardien en font un poids, puis des échanges de partenaire et de caisse achèvent le départ. L’audit conserve les deux cartes, les deux variantes et le contrôle des six images de la dernière traction suivie de la presse du Voleur. Ces résultats excluent toute affirmation de nécessité universelle des miroirs.

### Niveau 7 : trois vies dans le parcours de référence

Le témoin principal compte 410 entrées et deux échanges. La solution `reference/level7-two-roles-alternative.json` gagne en 366 entrées avec un seul échange : la clef devient directement le lest occidental et la charge de combat le lest oriental. Elle conserve les trois appuis, la presse, les deux monstres et les transports de charges. Le second échange et les trois rôles successifs de la clef ne sont donc pas des nécessités universelles.

L’audit indépendant vérifie aussi l’approche mortelle d’un gardien et la différence entre le pas sud du Magicien après le combat et le sort intercepté par un monstre avant le combat.

### Niveau 8 : correction d’un contournement de l’alcôve

L’audit a trouvé une solution historique de 156 entrées qui évitait entièrement la clef isolée, le pont et la seconde station des miroirs. Un reflet transportait le Guerrier directement dans la salle inférieure ; les charges restantes fournissaient des poids et une cible de retour. Cette solution gagnait sans refus, sans mort et sans appui créé, mais laissait l’alcôve sans rôle.

La correction ajoute un dispositif visible : le bouton cyan en `(17,15)` ferme une porte-poussoir en `(14,18)`, dirigée vers le nord, tant que l’alcôve reste occupée. La porte s’ouvre lorsque son occupant sort. L’ancien parcours de 156 entrées échoue désormais, tandis que la référence de 205 entrées reste gagnante avec exactement les mêmes métriques : quatre échanges, trois reflets, quatre appuis et zéro refus/mort.

`reference/level8-rejected-shortcut.json` conserve la carte historique, les commandes gagnantes sur cette ancienne carte, la modification exacte et le résultat obtenu sur la carte corrigée. L’audit vérifie les deux versions et les transitions risquées : réception relâchée trop tôt, reflet utilisé à la place du premier sort, entrée du Magicien dans l’alcôve avant création de l’appui de retour. La correction impose une libération matérielle de l’alcôve ; elle n’interdit pas une autre solution par traction ou un autre agencement de ressources.

## Reproduction de ces contrôles

Depuis le laboratoire, après compilation du moteur :

```sh
node reference/author/build-level2.mjs
node reference/author/build-level3.mjs
node reference/author/build-level4.mjs
node reference/author/review-level1.mjs
node reference/author/audit-level5.mjs
node reference/author/audit-level6.mjs
node reference/author/audit-level7.mjs
node reference/author/audit-level8.mjs
```

Les fichiers sous `reference/` servent à l’auteur et aux audits. Ils ne sont pas importés par le moteur ni par l’interface jouable.
