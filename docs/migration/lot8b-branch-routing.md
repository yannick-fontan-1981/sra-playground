# Lot 8B : contrat de transfert de BranchRouting

<!-- LOT8B_FINAL067_STATUS_START -->

**Jalon final 0.67 :** le numéro distinct est réservé et les graphes sensibles à l'identité sont renouvelés, avec audits et build final acquis. Les [preuves de version finale](lot8b-evidence/final-version-067-01/README.md) réconcilient explicitement les résultats historiques ; le seul changement de production est le littéral 0.66.0 vers 0.67.0. Le candidat compte 69/76 entrées. À ce jalon, le coût officiel et la publication restent les prochaines étapes ; le publié constaté demeure Site 107 / native 0.66. Les paragraphes suivants conservent leurs états historiques.

<!-- LOT8B_FINAL067_STATUS_END -->

## Périmètre et statut de cette étape

Le lot 8B porte l’entrée originale **`parallel_branch_routing`** vers un propriétaire TypeScript distinct, **`branch_routing`**. Ce contrat décrit le composant, ses preuves de référence et son raccordement borné au moteur commun, qualifié sur les sources et tests figés au commit **`2583d81d856c13295040db88f5df8b3a99906bdc`**.

La base de travail est le commit `c87c132a0353a8c6138ad090495f98698ef7ca6f`, qui intègre la source réellement publiée **Site 107 / native 0.66.0**, `4ff7bf45286a8a19d34401988adca587253ae41e`, et les reçus de publication 8A. La [préparation source antérieure](lot8b-evidence/preparation-20261111/README.md) et la [filiation détaillée](lot8b-branch-routing-lineage.md) restent les références de provenance.

Le [bilan de composant](lot8b-evidence/component-stage-01/README.md) conserve la première qualification : 37 observations, 20 cas géométriques et 12 scénarios comprenant 83 opérations originales ; 249 tests et sous-tests de référence passés dans les modes natifs exact et borné complet, 17 tests de contrat passés et typage passé. Les 83 opérations sont rejouées dans les deux modes natifs ; elles ne deviennent pas 166 opérations originales indépendantes. Les tentatives antérieures restent conservées.

**Le raccordement commun est maintenant qualifié sur son périmètre déclaré.** Le [bilan commun](lot8b-evidence/common-integration-01/README.md) et la [synthèse de validation](lot8b-evidence/common-integration-01/validation-summary.json) relient les sept contrôles finaux passés :

| Contrôle | Résultat acquis |
| --- | --- |
| BranchRouting | 281 tests et sous-tests sur 4 modules : 249 de référence, 17 de contrat, 7 de frontière publique et 8 de parcours/intégration communs. |
| Régressions du runtime | 160 tests et sous-tests sur 15 modules déclarés. |
| Régressions des voisins | 83 tests et sous-tests sur 4 modules déclarés. |
| Typage | Passé. |
| Audit des entrées | Candidat raccordé à 69/76, dont 26/33 pour `factored_material_return`. |
| Audit de migration, exécution `migration-audit-02` | 215 modules `component_verified`, 147 `partial_transfer`, 1 007 `pending`, 0 `verified` ; les six portes globales restent fausses. |
| Build | Passé. |

Cela représente **524 tests et sous-tests Node sur 23 modules déclarés**, sans constituer toute la suite ni une campagne générale. Les huit tests communs comprennent des chaînes froides et des contrôles de registre, de refus et d’isolation. Le candidat 69/76 n’est pas publié. **Site 107 / native 0.66.0 reste la livraison publiée, à 68/76** ; aucun nouveau numéro de version n’est réservé. Le littéral de version du candidat demeure 0.66.0 pendant ce jalon de développement ; son commit, son registre et son digest de source le distinguent du publié.

## Qualification de livraison complémentaire

Le [dossier de qualification fonctionnelle](lot8b-evidence/delivery-qualification-01/README.md) conserve les formes et régressions acquises sur les mêmes fichiers natifs : **64 contrôles de formes communes sur 58 points appariés**, avec **22 312 différences attribuées et zéro non attribuée**, puis **11 cas enregistrés et 187 projections historiques inchangées**. Les 524 tests antérieurs restent séparés et n'ont pas été relancés. STCK à dix actions conserve deux niveaux pour une cible de trois ; SMLP à quinze actions atteint trois niveaux. Aucune acquisition sélectionnée BranchRouting n'est observée dans ces formes.

Les **cinq chaînes de contribution du runtime commun sont qualifiées** : 26 retours, dont 23 acquisitions source réussies, un retour ablaté et deux retours incomplets conservés sans fait inventé. Le lecteur vérifie 64 points, 3 772 deltas et 51 restaurations observées, avec effet contraire et décision suivante. La première tentative reste conservée à zéro retour, avant factory : les rasters originaux 26 × 28 ou 28 × 26 ne satisfaisaient pas la façade publique 64 × 64 choisie par l'outil. Les outils révisés emploient la vraie API native, sans modification du corpus ni des attendus. Cette preuve n'établit pas le transport worker ni les tickets du service public.

La [réconciliation des digests](lot8b-evidence/delivery-qualification-01/source-digest-reconciliation.json) confirme l'identité des **331 fichiers natifs** entre le digest historique `76a403016d2b28287194b7498f10e14727b7e3fb3f214d2f79cb0292390d54bf` et le digest canonique des nouveaux outils `3ff1d9ad56e22aedc0fee3a0da6a3af50a1da0bc14a0ba01cb38272ba85234be`. Seul l'ordre de sérialisation des chemins diffère. Le candidat 69/76 reste non publié ; les formes ne constituent ni une parité stricte des graphes, ni un coût accepté.

## Propriétaire et domaine

L’API native implémentée est la classe `BranchRouting`, avec `id` et `familyId` égaux à `branch_routing`. Elle reproduit les méthodes source `propose`, `bind`, `before`, `after` et `record`, puis ajoute `state`, `restore` et le diagnostic de calcul incomplet nécessaires au transport natif de l’état. Les fonctions géométriques suivent les cinq fonctions originales : `layout`, `bbox`, `read_state`, `observed_state` et `propagated`.

Les entrées sont des observations génériques mesurées : raster rectangulaire non vide, palette uint8, entités avec boîte et masque relatif, commandes disponibles, époque, référence d’observation, état officiel et compteur de niveaux. La frontière native `validateRows` limite la **surface totale à 65 536 pixels**, sans imposer une forme carrée ni un budget indépendant de 65 536 par axe. Les positions, dimensions, scores et indices appartiennent au domaine des entiers sûrs du runtime ; les contraintes géométriques de restauration sont précisées ci-dessous. Aucun nom de jeu, identifiant d’instance ou résultat caché n’intervient dans la décision.

Les clés d’action du caller observé sont des noms non numériques de la famille `ACTION1` à `ACTION6`. Leur ordre doit être celui de Python lorsque la source trie les commandes ou conserve l’ordre d’insertion. La présente parité ne revendique pas l’ordre d’énumération d’objets JavaScript pour des clés arbitraires qui seraient des indices numériques. Les éventuelles entrées contrefactuelles du corpus déclarent leur domaine séparément.

## Géométrie source à conserver

| Fonction | Sémantique requise |
| --- | --- |
| `layout` | Déduire les cavités ouvertes, les sources avec capuchon, les contributeurs droits et la sélection unique depuis les seules entités et dimensions de l’image. Retourner un modèle uniquement lorsqu’un seul candidat complet subsiste. |
| `bbox` | Construire la boîte inclusive du contributeur avec son unité, sa longueur et l’axe tangent du modèle. |
| `read_state` | Lire les coupes prévues, exiger qu’elles soient non vides et uniformes, puis reconnaître exactement un contributeur de couleur `highlight`. |
| `observed_state` | Apparier toutes les entités rectangulaires de dimensions compatibles aux contributeurs, sans doublon de position, et retenir l’état unique à distance de Manhattan minimale. Une égalité entre états distincts reste ambiguë. |
| `propagated` | Propager l’ensemble des fronts dans l’ordre des contributeurs ; lorsqu’un contributeur reçoit un front, remplacer les fronts touchés par ses deux extrémités extérieures. Retirer et consigner les sorties hors champ après chaque contributeur. |

### Construction du modèle

Une cavité source est le complément rectangulaire carré d’une entité non rectangulaire suffisamment pleine. Ce complément touche exactement un bord de la boîte. Les cavités sont groupées par axe, sens, unité et couleur. Un groupe admissible possède au moins deux cavités, une coordonnée normale commune et des positions tangentes divisibles par l’unité.

Une source est un carré de côté `unit` adjacent à un capuchon rectangulaire aligné et proche du bord correspondant au sens de propagation. Les contributeurs sont des rectangles situés strictement entre les sources et les cavités sur l’axe normal, d’épaisseur `unit` et de longueur au moins `2 * unit`, divisible par `unit`. Leur position tangente doit également être divisible par l’unité. Leurs couleurs ne sont pas des identifiants fixes.

Une barre unique est active par construction. Avec plusieurs barres, il faut exactement une barre dont la couleur n’est utilisée par aucune autre barre. L’ordre de propagation est le tri stable des indices par position normale signée. Les égalités conservent l’ordre des entités observées. Aucun réordonnancement supplémentaire des entités, des groupes ou des commandes n’est autorisé.

La géométrie utilise des coordonnées absolues modulo `unit`. Une translation arbitraire n’est donc pas une invariance source. Les rotations ou translations du corpus ne sont des preuves que pour leurs observations explicitement reconstruites.

### Lecture et identité

`read_state` conserve les règles de découpage de la source. Une coupe partiellement hors image peut être acceptée si la coupe obtenue reste non vide, uniforme et satisfait la sélection unique. Le port ne doit pas ajouter silencieusement une exigence de boîte entièrement contenue dans l’image. Les indices négatifs et les bornes de coupe suivent les tranches Python/NumPy, via le helper de projection natif déjà présent.

`observed_state` considère **toutes** les entités rectangulaires de bonne largeur et hauteur. Il ne les filtre pas par leur ancienne couleur ou leur ancienne identité. La couleur sert seulement à identifier exactement une barre sélectionnée dans chaque affectation. Des affectations produisant le même état ne créent pas une ambiguïté supplémentaire ; deux états distincts ayant le même coût minimal produisent `None` dans la source et `null` dans le port exact.

Les boîtes, rayons et sorties prédites restent des hypothèses géométriques. Une correspondance entre les fronts visibles et les cavités ne constitue pas une réussite officielle.

## Décision et ordre des propositions

### Calibration

À la première proposition d’une époque, le composant reconstruit son modèle depuis l’observation actuelle. Il relit ensuite l’identité des contributeurs. Les commandes sans données sont triées dans l’ordre des chaînes Python. Une commande est inconnue si elle n’existe pas dans `motion` et n’a pas encore été essayée dans le triplet `(action_ref, positions, active)` conservé dans `seen`.

Le composant est prêt si, et seulement si, il possède **exactement quatre vecteurs de déplacement distincts**. La source ne prouve pas que ces vecteurs sont les quatre mouvements cardinaux unitaires, ni qu’il existe exactement quatre clés d’action. Le port ne doit pas renforcer ce prédicat. Avant cet état, il propose la première commande inconnue, en mode `calibrate`, avec une prédiction finale absente.

### Recherche des placements

Une fois prêt, il doit rester exactement une commande sans données qui ne figure pas dans `motion`. Elle est la commande d’essai de propagation. Le composant énumère le produit cartésien des positions tangentes autorisées pour chaque barre. Le dernier indice varie le plus vite, comme `itertools.product`.

Une affectation est admissible lorsque l’ensemble des fronts visibles propagés est exactement l’ensemble des cavités. Son coût est la somme des déplacements en unités entières, plus une sélection pour chaque barre à déplacer qui n’est pas déjà active, plus un essai de propagation. Le minimum source est lexicographique sur **`(cost, starts, displacement)`**. Un port par réduction en flux peut conserver ce minimum sans stocker toutes les solutions, mais ne peut le publier qu’après l’épuisement complet du domaine.

| Situation | Proposition source |
| --- | --- |
| Aucun contributeur ne doit bouger | Une commande `propagate`. |
| Une barre à déplacer n’est pas active | Une commande `select`, choisie comme la première commande de la liste d’entrée dont le point est dans sa boîte. |
| La barre active doit bouger | Un préfixe `move` utilisant l’unique clé connue correspondant au déplacement demandé. |
| Aucune solution, commande absente ou ambiguë | Aucune proposition dans le calcul exact complet. |

Le préfixe `move` contient au plus `min(distance / unit, remaining, 16)` actions. Il est réduit à une action si sa clé n’a pas encore été vérifiée pendant l’époque courante. La source applique `remaining` directement à ce mode seulement : les propositions `calibrate`, `select` et `propagate` peuvent encore être construites avec `remaining == 0`. L’admission physique et le budget réel restent contrôlés par le caller commun ; le composant conserve cette distinction entre proposition source et autorisation d’exécution.

### Champs conservés

La proposition conserve `status`, `kind`, `branch_plan`, `actions`, `steps`, `facts`, `compositions`, `question`, `route_refs`, `binding` et `bundle_template`. L’opération de composition reste `OP18`, l’objectif `G_official_completion`, et le rôle `information_question` avec `observed: false`.

Les références sont dédupliquées dans leur ordre d’insertion : observation courante, puis références apprises de `refs`. Le focus `C_branches_...` conserve le digest SHA-256 de la sérialisation JSON Python à clés triées, séparateurs compacts et échappement ASCII. Les projections de sélection conservent le digest uint8 comprenant la forme et les octets en ordre C. Le réemploi du helper `motifRowsDigest` porte uniquement sur cette fonction pure ; il ne partage aucun état entre propriétaires. Son domaine de sélection est une projection mesurée non vide, et ne revendique pas de représenter toutes les formes de tableaux NumPy vides.

## Liaison, gardes et acquisition

`bind` lie les commandes pointées au domaine d’entrée observé pour l’époque et le premier hash d’image. Il conserve l’ancienne liaison et ajoute la boîte de projection ainsi que son digest. Le choix du point reste celui du premier élément admissible de `inputs`, sans tri additionnel.

`before` exige l’époque et le compteur de niveaux du binding, la disponibilité actuelle de la commande, la même référence d’observation pour le premier pas, et la lecture de toutes les poses avec la sélection attendue. Les pas suivants ne réutilisent pas la référence d’observation initiale comme autorité, mais leurs poses et leur sélection doivent toujours être mesurées à nouveau.

La garde commune `ObservedInputDomain.pointGuard` vérifie séparément la liaison du point et la projection courante. Le test d’intégration utilise le domaine réellement produit par le caller : pour la sélection triple, il choisit `(6, 13)`, alors que la liste manuelle du corpus de composant proposait d’abord `(7, 13)`. Les références d’observation sont également rattachées à l’observateur commun réel. Cette preuve qualifie le domaine pointé commun ; elle ne présente pas cette sélection comme un rejeu identique de la liste manuelle ni comme une parité du caller Python complet.

`after` ferme immédiatement le préfixe si l’époque, l’état officiel ou le compteur de niveaux change. Sinon il compare la pose attendue lorsque la prédiction existe. Un résultat autre que `True`, ou le dernier pas du préfixe, ferme le préfixe. Un mode sans prédiction n’invente pas de correspondance positive.

Le caller commun appelle `record` pour le seul propriétaire sélectionné et conserve les acquisitions source réussies sous `branches:<revision>`. BranchRouting n’est pas acquis passivement sur l’action d’un autre propriétaire. Les branches du composant sont conservées :

1. Si le compteur de niveaux augmente, ajouter le témoin à `passed` et retourner `official_boundary` **avant** la lecture ordinaire, avant tout ajout à `events`, et avant une éventuelle mise à `finished`.
2. Sinon, relire l’état observé et construire `measured_response` avec l’ancien état, le nouvel état éventuel et la référence du retour.
3. En mode `propagate`, mettre `finished` à vrai, même si le retour ne permet pas de relire une identité unique. Cette décision retire l’essai courant ; elle n’est pas une victoire.
4. En modes `calibrate` ou `move`, ajouter le triplet à `seen`. Apprendre un mouvement uniquement si une seule barre a changé de position, qu’il s’agit de l’ancienne barre active et que son déplacement non nul concerne exactement un axe. Le vecteur peut être plus grand que `unit`.
5. Si une identité actuelle est disponible, mettre à jour `current`. Ajouter enfin l’événement à `events`.

## État, époques et restauration

Le format de snapshot est **`native.branch_routing.v1`**. L’état froid contient le format natif puis exactement les quatre attributs source déjà existants : `epoch: null`, `motion`, `passed` et `events`. Il ne fabrique pas de modèle ou de contexte d’époque avant la première proposition.

| Champ | Durée de vie |
| --- | --- |
| `motion`, `passed`, `events` | Conservés d’une époque à l’autre. |
| `epoch` | Remplacé par l’époque actuellement proposée. |
| `model`, `current`, `verified`, `seen`, `refs`, `finished` | Renouvelés à la première proposition de la nouvelle époque. |
| Diagnostic de calcul incomplet | Transitoire, distinct de la connaissance acquise. |

L’absence de modèle est un état valide, avec `model: null` et `current: []` une fois l’époque commencée. Les événements anciens peuvent concerner une autre quantité de barres que le modèle courant. Leur validité ne doit pas être décidée en les comparant au nombre de barres de la nouvelle époque.

`state()` retourne une copie détachée. Les ensembles Python sont représentés par des tableaux explicitement normalisés pour la comparaison, sans changer leur sens. `restore()` valide la totalité d’une copie détachée avant de remplacer le moindre champ du propriétaire. Un snapshot invalide doit laisser l’état courant inchangé. La restauration conserve les méthodes acquises mais ne constitue pas une nouvelle observation autorisant une action : `propose` et les gardes doivent relire le champ courant.

**Frontière de restauration fermée pour les conditions numériques nécessaires :** `restore()` dérive ses contrôles du budget public total de 65 536 pixels, avec vérification des quotients avant multiplication. Le modèle initial doit respecter les surfaces des barres et sources, l’étendue `unit * limit`, les indices de sources/cavités et le rectangle englobant sa géométrie. `current` doit représenter des rectangles complets mesurés dans un raster public possible, dont la forme peut différer de celle du modèle initial. Les poses prédites de `seen` et `event.before` ne requièrent que des origines compatibles avec des découpes non vides : une boîte complète débordante reste permise. Chaque état historique est vérifié indépendamment du modèle courant. Les déplacements appris restent axiaux et non nuls, sans norme imposée par `unit`, avec une amplitude compatible avec la différence de coordonnées publiques.

Les [sept tests de frontière publique](../../tests/v6-branch-routing-public-boundary.test.ts) qualifient notamment les rasters minces, les produits excessifs, le rejet atomique, les changements de forme, les coupes partielles et les histoires d’autres époques. Ces contrôles sont des conditions nécessaires de représentabilité numérique. Ils **n’authentifient pas la provenance** d’un snapshot et ne bornent pas globalement la quantité d’historique conservée.

## Extension native de calcul borné

La source réalise deux produits cartésiens sans borne explicite : affectation des identités et recherche des placements. Le mode exact direct sert exclusivement à la parité sur le petit domaine annoncé du corpus. La factory commune utilise le mode explicitement borné et coopératif.

| Borne native maximale appliquée | Valeur |
| --- | ---: |
| Affectations d’identité examinées | 16 384 |
| Placements examinés | 65 536 |
| Intervalle de cession coopérative du chemin asynchrone de proposition | 128 éléments |

Ces valeurs peuvent être réduites explicitement pour vérifier les refus ; elles ne doivent pas être relevées silencieusement. Les compteurs et motifs de refus doivent distinguer le domaine complètement examiné, la borne de ressources, l’échéance et l’interruption. L’annulation est vérifiée aux points de coopération ; aucune exploration partielle ne peut devenir une impossibilité démontrée ou un optimum source.

**Portée des bornes :** ces plafonds limitent les produits d’affectations d’identité et de placements. Ils ne constituent pas une borne générale du temps ou de la mémoire du composant. En particulier, `layout` reste une opération synchrone non coopérative ; la construction des listes d’options, la validation des entrées, les copies et digests d’état ainsi que l’historique retenu ne sont pas bornés globalement par ces deux compteurs. Leur coût réel et la réactivité globale restent à qualifier séparément.

**Stabilité des entrées pendant une cession :** l’adaptateur commun `branchRoutingFamily` clone ensemble l’observation, le raster et les commandes, puis les gèle récursivement **avant le premier `await`** du propriétaire. Les références et données de la proposition restent ainsi celles de cet instantané. La garde coopérative du composant continue de détecter une mutation de son propre état pendant une cession. Le test d’isolation qualifie ce chemin commun ; il ne transforme pas les appels directs au composant en transactions générales sur des objets partagés.

Pour `propose`, un calcul incomplet ne retourne aucun meilleur préfixe partiel. Le diagnostic est transitoire et annonce une recherche incomplète. Les changements d’état autorisés par la source avant la recherche, tels que l’ouverture de l’époque ou une identité complètement relue, doivent être distingués des résultats non obtenus de la recherche interrompue.

Pour `record`, la méthode de composant reste synchrone, comme l’original ; elle utilise une limite explicite d’affectations et ne promet pas de cession asynchrone pendant cette acquisition. Une identité incomplètement explorée ne peut pas être convertie en `after: null`, ce dernier désignant un résultat source complet. Le composant borné lève **`BranchRoutingIncomplete` avant les mutations de cette acquisition**. L’exception de frontière officielle avec score accru demeure prioritaire et n’exige pas cette énumération.

**Traitement commun d’une acquisition incomplète :** l’adaptateur attrape uniquement `BranchRoutingIncomplete`, retourne une liste d’événements vide et un refus `unknown` sans autorité, lié aux identités du retour `after`. Le caller conserve durablement la transition publique complète, incluant les observations mesurées, les packets avant/après, leurs rasters et animations, la commande, l’index et le résultat du garde après action. Le reçu porte `acquired: false`, `release_authority: false` et un lien à `prefix_evidence:<revision>`, qui conserve la proposition complète.

La première lacune suspend les acquisitions BranchRouting suivantes du même préfixe : chaque retour du suffixe reste intégralement conservé et explicitement non acquis, sans rappeler `record` au-dessus de cette lacune. Les autres acquisitions communes et passives poursuivent leur passage unique. Le runtime termine avec `native_acquisition_incomplete`, sous réserve de la priorité d’une fin officielle. `resume()` ne relance ni l’acquisition métier ni une commande physique sur cet arrêt terminal. **Aucune reprise automatique n’est implémentée.** Les compteurs communs de callbacks/retours réconciliés ne sont donc pas, à eux seuls, des compteurs d’acquisitions BranchRouting réussies.

## Corpus indépendant et critères de preuve

Le plan initial est borné à vingt géométries et environ dix scénarios synthétiques, au plus cent opérations, des rasters de taille au plus 32 × 32, au plus trois barres et `limit <= 16`. Les produits de placements de ces cas restent de taille au plus `15³`. Tout élargissement doit être déclaré dans le reçu du corpus avant son exécution.

Deux catégories de preuve restent séparées :

- **Chaînes depuis l’état froid :** observation d’un raster, propositions source, retours synthétiques déclarés, acquisition source, puis nouvelle décision. Elles peuvent montrer une dépendance à une acquisition effectivement exécutée dans le composant original.
- **Contrefactuels déclarés :** états explicitement construits pour des clés manquantes ou dupliquées, quatre ou cinq vecteurs distincts, unités atypiques, égalités de coût, vérification absente ou branches de refus. Ils caractérisent la méthode source dans cet état et ne sont pas des preuves d’apprentissage depuis le froid.

Les observations et résultats de l’oracle proviennent du composant Python épinglé et de rasters indépendants. Aucun snapshot, objectif ou événement calculé par le port TypeScript ne doit être injecté dans l’original. Les sorties comparent les géométries, états, propositions complètes, liaisons, gardes, retours et restaurations dans leur périmètre déclaré. Les bornes natives sont testées séparément de la parité exacte.

La couverture doit comporter les quatre modes, une identité ambiguë, un retour contraire, une sélection non unique, une frontière officielle, une nouvelle époque et des sorties hors champ. Le label d’état officiel d’une fixture n’est pas une partie réelle ni un niveau officiel réussi. **LKEY reste définitivement fermé** ; aucun jeu, oracle ou payload de ce cas ne fait partie de ce lot.

## Raccordement acquis, suite et règle de coût

La factory commune enregistre un seul propriétaire dans `factored_material_return`, immédiatement après `motif_conditioned_access` et avant `conserved_band_transfer`. Le slot du provider de matériau reste `null` pour cette entrée directe. L’acquisition sélectionnée utilise `branches:<revision>` et le diagnostic `branch_routing`. Les parcours communs qualifient les gardes courantes, les acquisitions froides, la restauration, l’effet contraire, les refus, l’isolation des entrées et la conservation d’un préfixe incomplet sur leur périmètre déclaré. Le programme existant `v6.composition_strategy.choose` reste le point de décision ; ce raccordement n’ajoute aucun nouveau programme compilé.

Les preuves communes et les régressions ciblées du raccordement sont passées. Ce jalon historique ne comprenait aucun jeu ni rejeu. La qualification complémentaire conserve désormais les formes appariées et les onze rejeux enregistrés ; les cinq chaînes de contribution du runtime commun sont également qualifiées. **Aucune nouvelle campagne de jeu, mesure officielle 8B ou publication n’est effectuée.** La publication éventuelle nécessitera sa propre qualification et sa réservation de version ; aucun nouveau numéro n’est réservé ici. Le critère de coût reste une augmentation de la médiane globale des sessions complètes strictement inférieure à 10 % pour STCK et pour SMLP séparément. Une phase peut dépasser 10 % si les deux critères globaux passent ; aucune compensation entre jeux n’est admise.

Le développement, les tests fonctionnels, les commits et les push se poursuivent sans verrou global dans le checkout et la branche propres au lot. Seules les mesures officielles et la publication utilisent l’exclusivité courte encore demandée. Aucun fichier de verrou détenu ne doit être supprimé ou remplacé.
