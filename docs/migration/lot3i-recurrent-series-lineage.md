# Filiation du lot 3I : séries récurrentes et insertions observées

## Origine et contrat effectivement consommé

L’entrée `recurrent_series` consomme **deux couches propres** : `RepeatedLinePatterns`, définie dans `common_repeated_lines.py`, et `SupportedLineAccess`, définie dans `common_supported_lines.py`. Les originaux proviennent du commit immuable **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**. L’[exporteur indépendant](../../scripts/export-v6-recurrent-series-reference.py) vérifie les **1 786 fichiers originaux avant et après** ses appels. Ses attentes proviennent exclusivement de ces originaux et de retours synthétiques déclarés. Il ne lit ni moteur, ni spécification, ni solution de jeu ; il n’exécute aucun module natif.

La stratégie originale importe `ObservedCompositionConstraint as ProgramCompositionConstraint`, instancie cet alias dans `self.lines`, puis appelle `self.lines.propose(obs, rows, inputs, remaining, window_constraints)` à l’entrée `recurrent_series`. La résolution effective de cette méthode est **`SupportedLineConstraint.propose`**. Elle active `repeated_line_completion` et transmet `prepare_supported_lines` ainsi que `supported_line_reply_plies`, fixé à six dans la déclaration d’origine. Transférer seulement la continuation répétée laisserait donc un contrat appelé inachevé.

| Contrat original | Fonction ou classe | Consommateur natif |
| --- | --- | --- |
| Champs entre séparateurs, centres mesurés et prolongements | `fields`, `pointed_candidates`, `extensions` | [Observation RecurrentSeries](../../src/logos-engine/v6-recurrent-series-observation.ts) |
| Identité géométrique sans hypothèse de vide | `layout_key` | Même module d’observation |
| Question récurrente, premiers essais retenus et témoins scorés | `RepeatedLinePatterns` | [Mémoire RecurrentSeries](../../src/logos-engine/v6-recurrent-series-access.ts) |
| Insertions passives, ordre public, préparation conditionnelle et réfutations | `SupportedLineAccess` | Même propriétaire RecurrentSeries |
| Fenêtres, insertion et recherche finie | `insertions`, `line_windows`, `place`, `search_lines` | [Calcul SupportedLine partagé](../../src/logos-engine/v6-supported-lines.ts) |
| Transport, support courant du point, liaison et restauration | `PointedLineConstraint`, `SupportedLineConstraint` | Enveloppe RecurrentSeries et [SharedSeries](../../src/logos-engine/v6-shared-series.ts) |
| Ordre ancestral, journaux et digests publiés | Repeated → Supported → CrossedPrefix → descendants | Propriétaire unique partagé et emplacements historiques d’[OccurrenceRecall](../../src/logos-engine/v6-occurrence-recall.ts) |

La clôture de ces deux couches ne clôture pas automatiquement leurs descendants. L’adaptateur réellement utilisé possède une mémoire `CombinedObservedCompositionMemory` : `propose` y résout `CellPlacementAccess.propose`, les gardes et `record` y résolvent `ReferencePopulationAccess`, et `record_packet` y résout `CellPlacementAccess.record_packet`. Ces méthodes peuvent déléguer par héritage jusqu’aux deux couches examinées. Les résolutions, les ordres MRO et les alias sont conservés dans `sourceAliases` de la [fixture originale](../../tests/fixtures/v6-recurrent-series-reference.json.gz).

Cette distinction est observable : sur le premier retour passif de la chaîne synthétique, l’adaptateur réel émet successivement `supported_insertion_observation`, **`coupled_pair_epoch_anchor`**, puis `supported_insertion_order`. Le second retour continu conserve l’ancre acquise. La fixture conserve les événements complets de cet adaptateur, leur sous-ensemble propre et le digest du journal complet. Une égalité des seuls événements Repeated/Supported ne prouve pas la parité de toute cette mémoire héritée.

## Champs, valeurs et ordre des mesures

`fields` parcourt les composantes connexes monochromes fournies par `geometric_observer.components`. Une dimension de cellule candidate doit correspondre à au moins quatre composantes rectangulaires pleines, avec largeur et hauteur d’au moins deux pixels. Les séparateurs verticaux sont des rectangles plus étroits que cette largeur et d’une hauteur au moins égale à trois hauteurs de cellule. Une chaîne exige au moins trois séparateurs également espacés de `largeur_cellule + largeur_séparateur`, donc au moins quatre colonnes.

Des composantes rectangulaires plus courtes que la cellule, de largeur exactement égale à celle-ci, mesurent indépendamment les espacements horizontaux dans la bande. La hauteur modale de ces composantes fixe le pas vertical. **Une égalité conserve la première hauteur rencontrée**, conformément au `Counter` Python ; trier numériquement les hauteurs changerait ce contrat. Un petit fragment de cellule qui possède lui aussi ces dimensions peut participer à cette mesure : la fixture de l’égalité modale empêche explicitement ces fragments de créer un autre maximum.

La hauteur de la bande doit se diviser exactement selon le pas retenu. Le champ possède au moins trois lignes, son origine est positive ou nulle, et tout son rectangle de cellules doit rentrer dans l’image. Une cellule uniforme fournit sa valeur ; une cellule non uniforme devient `None`. Le nombre de ces cellules inconnues ne doit pas dépasser `min(nombre_colonnes, nombre_lignes)`. Au seuil exact, le champ reste admis. Au-delà, il est refusé.

L’apparence supposée vide est la valeur connue la plus fréquente. Une égalité entre les deux fréquences maximales refuse le champ. Un champ d’une seule valeur connue est admis avec cette valeur comme hypothèse de vide. Cette hypothèse est mesurée ; aucun numéro de palette ne possède un rôle fixé par le moteur.

La référence d’un champ est le digest de sa géométrie **et de son hypothèse de vide**, en excluant `grid`. Les champs sont dédupliqués par cette référence puis triés de manière stable par `(origine_y, origine_x)`. `layout_key`, utilisé pour rapprocher les insertions, ne comprend que origine, pas, taille et forme : il exclut la grille, l’hypothèse de vide et la référence du champ. Les deux identités ont donc des usages distincts.

`pointed_candidates` émet le centre entier de chaque cellule, y compris les cellules occupées ou inconnues. Pour une taille paire, le centre utilise `(taille−1)//2`. L’ordre est champ, ligne, colonne. La source ne déduplique pas deux centres issus de champs qui se recouvrent. Si `ACTION6` est indisponible, elle retourne immédiatement une liste vide, avant toute mesure de l’image.

`extensions` suit les directions droite, bas, diagonale descendante puis diagonale montante. Elle considère uniquement le début d’un segment maximal de même apparence, d’au moins deux cellules. Elle teste son extrémité précédente puis sa suivante, en conservant seulement les cellules vides dans les limites. Des prolongements distincts peuvent avoir la même cible ; leur ordre et leur multiplicité restent conservés. Une cellule inconnue interrompt le segment ou exclut son extrémité.

Le domaine commun admis est une image rectangulaire non vide de valeurs entières `uint8`, d’au plus **65 536 pixels**. Les fonctions Python ne convertissent pas spontanément leur argument en `uint8` : les tableaux contenant flottants, booléens ou valeurs hors palette peuvent être traités par l’égalité Python jusqu’à une autre opération. L’original lève une erreur pour certaines images vides ou irrégulières et refuse l’aire excédentaire. Ces résultats restent dans `sourceDivergences` ; ils ne sont pas comptés comme parité d’un domaine de pointage natif élargi. Les helpers isolés conservent également leurs règles de listes, tuples, indices et entiers Python ; la validation d’un argument artificiel ne constitue pas une nouvelle observation du monde.

## Continuation d’une série répétée

La question exige au moins deux champs et au moins une entrée pointée dont le payload est vrai selon les règles Python. Les prolongements sont regroupés par `(apparence, longueur_observée)` et par ensemble des champs où ils apparaissent. Sans essai confirmé, le classement maximise d’abord le nombre de champs indépendants, puis la longueur. Il faut un gagnant unique et au moins deux champs de support. Une égalité de rang entre deux apparences ne donne aucune préférence de palette.

Dès qu’un essai de l’époque courante a été confirmé et possède des `support_fields`, **le premier de ces essais dans l’ordre d’insertion** fixe l’apparence, la longueur et l’ensemble expérimental original. Toutes ces références doivent encore être présentes. Une répétition plus convaincante apparue ultérieurement ne remplace pas cette question en cours. L’ordre et les doublons éventuels de la liste de preuves retenue restent visibles, même si les tests d’appartenance utilisent un ensemble.

Tout essai confirmé de l’époque courante marque son champ comme accepté, même si les autres attributs de cet essai diffèrent. Une cible doit appartenir à l’ensemble original, prolonger le couple retenu, ne pas avoir été acceptée et correspondre exactement à une commande disponible. Le digest d’essai est construit à partir de l’époque, de la référence de champ, de la cible logique, de l’apparence et de la longueur observée. Une clé déjà présente n’est pas réessayée. Les candidats restants sont ordonnés par champ `(y,x)`, puis cible `(y,x)`.

La proposition contient un seul point et une hypothèse explicite : réaliser un prolongement récurrent **ne présume aucun rôle terminal**. Elle conserve le digest de toute l’image, la cellule cible, sa taille, l’apparence attendue, la longueur observée et celle proposée, les champs de preuve, les faits et le bundle `OP18`. Le composant propre ne consomme pas `max_prefix` comme refus ; l’enveloppe commune vérifie séparément que le nombre d’actions restantes est positif.

La garde avant exige l’index zéro, la même époque, le même score, la même référence d’observation, l’action stockée disponible et le digest identique de l’image entière. Après l’action, tout résultat scelle le préfixe. Une époque ou un score différent — **y compris une baisse de score** — ou `WIN`/`GAME_OVER` donne une frontière avec `matched: null`. Sinon, tous les pixels de la cellule cible doivent avoir l’apparence attendue. La garde propre n’interdit pas un autre changement ailleurs et ne compare pas de nouveau l’index après le retour.

`record` conserve un `repeated_line_trial` pour le plan effectivement présent : résultat confirmé, réfuté ou frontière ; commande réellement passée ; observations avant/après ; champ, apparence, longueur et supports. Une hausse officielle du nombre de niveaux terminés ajoute un `repeated_line_scored`. Ce témoin est une hypothèse d’apparence et de longueur transférable, accompagnée de l’obligation de redécouvrir l’applicabilité visuelle et les entrées au niveau courant.

## Acquisition passive et ordre des insertions

`SupportedLineAccess.record` appelle d’abord l’acquisition Repeated. Un témoin scoré créé par ce même retour est donc déjà disponible pour la suite. La source n’exige pas qu’une proposition Supported ait été sélectionnée pour acquérir une insertion : elle observe aussi les retours de commandes pointées d’autres familles.

L’acquisition exige une époque inchangée, exactement un champ avant et après, et la même identité `layout_key`. Parmi les changements de cellules, il faut exactement une addition depuis le vide vers l’apparence du dernier témoin scoré, une addition depuis le vide vers une autre apparence connue, et aucun troisième changement. L’apparence du dernier témoin reste celle consommée même si ce témoin provient d’une autre époque. Le point de la commande est converti en indice de grille par division entière. La méthode passive ne demande pas que ce point soit le centre de la cellule ni qu’il évite un séparateur ; une attribution physique plus forte appartient au domaine commun de livraison.

L’événement `supported_insertion_observation` conserve la grille avant action, la géométrie, les rôles conditionnels, le point demandé, le point d’arrivée et celui de la réponse. Il détermine aussi si cette réponse occupe l’extrémité d’une fenêtre dont toutes les autres cellules avaient l’apparence propre après son insertion. Il s’agit d’un blocage géométrique observé, pas d’une politique adverse universelle.

Le paquet public est traité **après** les événements de retour. `record_packet` retrouve le dernier échantillon dont `source` égale la référence avant action. Ce rapprochement est par référence de source ; la méthode ne revalide pas séparément l’époque stockée de l’échantillon. Pour chaque apparition, elle parcourt le paquet depuis sa fin et cherche le début de son suffixe persistant sur **tous les pixels de la cellule**. Une apparition transitoire suivie d’une disparition ne prouve pas un ordre antérieur. L’ordre propre-avant-réponse exige `début_propre < début_réponse < nombre_images`. Une unique image où les deux sont déjà visibles ne le prouve pas.

Les événements d’ordre sont indexés par `source`, avec remplacement de la valeur d’une clé déjà présente. Les échantillons d’observation et les témoins scorés sont des listes qui conservent les doublons. Les réfutations alimentent deux ensembles : essais rejetés et époques réfutées. L’ordre de réduction et ces différences de conteneur font partie du digest.

## Préparation conditionnelle et recherche finie

La proposition Supported ne s’examine qu’après le refus de la continuation Repeated et si la configuration l’autorise. Elle exige un champ courant unique, au moins un témoin scoré et une époque non réfutée. Les échantillons doivent appartenir à l’époque et au layout courants et avoir un ordre persistant confirmé. Il faut au moins deux points demandés distincts, deux points d’arrivée distincts, au moins un blocage de prolongement et un seul triplet de rôles `(propre, réponse, vide)`.

Les quatre lois candidates sont les deux axes et leurs deux signes. Pour chaque échantillon, l’arrivée propre doit être une insertion légale sur la grille avant, le point demandé doit garder la coordonnée de la ligne ou colonne correspondante, puis la réponse doit être légale après l’insertion propre. **Une seule loi compatible** est nécessaire. Aucune loi n’est choisie par le nom d’une action ou d’un jeu.

La recherche utilise la longueur du dernier témoin scoré et le nombre de plis configuré. Les insertions libres parcourent les cellules vides en ordre ligne/colonne. Sous un axe et un signe, chaque ligne ou colonne fournit sa première cellule vide dans le sens correspondant ; une cellule inconnue arrête cette recherche locale. Les fenêtres suivent les quatre directions de la continuation et excluent les cellules inconnues.

La source calcule un minimax alpha-bêta fini, alternant les deux apparences hypothétiques. Les scores de fenêtre emploient des puissances de quatre. Les victoires géométriques anticipées reçoivent un score terminal ajusté par la profondeur restante ; elles ne déclenchent pas une victoire officielle. Les enfants sont ordonnés par valeur heuristique puis point, en sens inverse au niveau maximisant. Seules les explorations complètes entrent dans le cache. Le classement final trie valeur décroissante, nombre de fenêtres géométriques décroissant, puis point lexicographique. La source conserve aussi le nombre exact de nœuds et la portée conditionnelle de ce calcul.

Le calcul source utilise des entiers Python sans limite de précision et **ne possède aucune borne interne de travail ou de temps**. Le noyau natif conserve l’ordre des calculs dans son domaine d’entiers exacts et refuse les bornes susceptibles d’être arrondies au-delà de l’entier sûr IEEE-754. L’enveloppe de production ajoute **250 000 nœuds** au maximum et l’échéance courante du niveau. Une interruption donne `status: unknown`, `block_unrelated_probe: true`, sans action et sans acquisition. Elle ne devient ni une réfutation physique, ni une politique acquise, ni un classement minimax achevé. Les tests de composant comparent les calculs achevés ; ils ne prétendent pas égaler le temps Python et le temps natif.

La commande du premier candidat classé doit être disponible et son essai ne doit pas avoir été rejeté. La proposition conserve tout le classement, le domaine de recherche, la loi conditionnelle et ses preuves. Après le retour, elle exige la cellule cible uniforme, un champ de même géométrie et exactement une addition propre et une réponse légale. Si une ligne propre complète de la longueur scorée apparaît sans progression officielle, la source renvoie **`scored_line_not_sufficient_in_this_context`** : la suffisance de ce but visuel est réfutée. Une telle réfutation suspend la préparation dans l’époque courante ; le contre-exemple reste retenu.

## Liaison, gardes héritées et propriété de l’état

Les gardes propres n’authentifient pas l’enveloppe complète. Elles ne recalculent pas l’identité de proposition et ne vérifient pas toutes les actions externes, le bundle ou la commande du pas. Une modification isolée du payload stocké dans le plan peut donc passer la garde avant si ses autres dépendances restent identiques. La fixture conserve ces résultats permissifs au lieu de les présenter comme une validation complète.

`SupportedLineConstraint.propose` ajoute le contexte `expected_before` et un `point_support` au niveau supérieur. Celui-ci contient la cellule mesurée complète, son centre, sa palette courante, l’époque, l’image, le digest de tout le raster, la référence géométrique et une signature. `bind` exige le couple époque/image dans le domaine, une seule action et l’égalité entre le point du support et celui de l’action. Il copie ce support dans le premier pas ; il ne remesure pas la palette à cet instant. L’autorisation commune doit donc encore protéger l’enveloppe, l’image courante, le domaine d’entrée et la livraison physique.

Pour une enveloppe portant les deux plans, Supported précède Repeated. Dans une mémoire descendante, **`record` appelle dynamiquement `self.after`** : une garde plus haute peut décider le résultat acquis par la couche Repeated. L’oracle conserve un cas mixte Supported/Repeated ; la priorité des autres plans descendants appartient aux tests de l’intégration commune et n’est pas déduite de ce seul cas.

Le propriétaire natif unique réutilise les emplacements historiques des six projections : essais, témoins scorés, échantillons, ordres, essais rejetés et époques réfutées. Le digest Repeated précède le digest Supported, lui-même placé avant CrossedPrefix et les descendants. Aucun second propriétaire des événements métier ne doit être ajouté par l’enveloppe. Le journal de persistance doit réduire chaque retour et son paquet une fois et dans l’ordre source, y compris lorsque l’action sélectionnée appartient à une autre famille.

La restauration source reconstruit une mémoire neuve, rejoue les événements, vérifie le digest, puis remplace le propriétaire. Un digest faux ou une erreur préalable laisse l’état courant intact. L’adaptateur Pointed possède l’ancienne forme `{trials, scored, digest}` ; Supported possède `{events, digest}` ; Observed reconstruit sa mémoire descendante complète. Ces trois formes sont séparées dans la fixture. La compatibilité avec des checkpoints publiés est une preuve distincte, produite depuis le natif 0.49 ; elle n’est jamais utilisée comme attente source Python.

La source conserve certaines références d’objets partagées entre le plan, l’action, le pas et le bundle. La fixture mesure ces identités séparément. La sérialisation et le stockage natif peuvent isoler ces valeurs : une égalité JSON de contrat ne revendique pas une identité d’objet Python à travers la persistance.

## Preuves indépendantes disponibles

Le [reçu d’export](lot3i-evidence/diagnostic/source-oracle-export.json) conserve les empreintes du générateur, des sources et de la fixture finale. Les collections sont distinctes ; leur somme ne constitue pas un compte de tests natifs.

| Collection | Cas |
| --- | ---: |
| Champs | 19 |
| Candidats pointés | 7 |
| Prolongements | 12 |
| Identités de layout | 4 |
| Helpers d’insertion, fenêtres, placement et recherche | 26 |
| Propositions propres et adaptateurs | 52 |
| Gardes | 50 |
| Acquisitions de retour | 19 |
| Paquets publics | 8 |
| Réduction d’événements | 13 |
| Restauration | 12 |
| Adaptateurs, liaisons et retours hérités réels | 34 |
| Chaîne froide continue | 1 |
| Domaines source qualifiés séparément | 8 |

Les **28 exceptions source** conservées concernent des refus de liaison, événements ou restaurations invalides, ainsi que les domaines artificiels. Elles sont des résultats du contrat, pas des échecs du générateur. La chaîne froide produit d’abord un témoin scoré par `record`, acquiert deux insertions et leurs paquets publics en continuité, puis calcule la préparation Supported. Aucun résultat natif ne prépare sa mémoire.

Le [scan initial public déclaré](lot3i-evidence/diagnostic/initial-public-scan-plan.json) et son [résultat conservé](lot3i-evidence/diagnostic/initial-public-scan.json.gz) examinent 95 vues historiques après exclusion de CWSE, SK48, FOGW, VOIS et WEAV. Ils ne lancent aucune action ni aucun jeu. Une seule vue, CONN, fournit une proposition froide Repeated sur quatre champs. Cette admission publique ne prouve pas une sélection par l’appelant commun, une acquisition ultérieure, une contribution ni un niveau résolu.

Les résultats d’une éventuelle campagne publique, les ablations de composant, les contrôles de CATR/RSWP et le budget global de coût restent des preuves séparées. Aucun succès de campagne ou verdict de coût n’est inféré de l’oracle synthétique.

## Reproduction

```bash
python -B scripts/export-v6-recurrent-series-reference.py
```

Le gzip utilise `mtime=0` et les attentes sont déterministes. La date du reçu reste celle de l’export. La commande n’exécute pas de jeu, de build, de test global ni de fenêtre de mesure de coût. Le générateur conserve les domaines refusés et les exceptions ; il ne les retire pas pour améliorer un taux de parité.
