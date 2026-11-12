# Lot 8B : contrat de transfert de BranchRouting

## Périmètre et statut de cette étape

Le lot 8B porte l’entrée originale **`parallel_branch_routing`** vers un propriétaire TypeScript distinct, **`branch_routing`**. Ce contrat fixe le comportement du composant, les preuves de référence et les adaptations de calcul borné avant son raccordement au moteur commun.

La base de travail est le commit `c87c132a0353a8c6138ad090495f98698ef7ca6f`, qui intègre la source réellement publiée **Site 107 / native 0.66.0**, `4ff7bf45286a8a19d34401988adca587253ae41e`, et les reçus de publication 8A. La [préparation source antérieure](lot8b-evidence/preparation-20261111/README.md) et la [filiation détaillée](lot8b-branch-routing-lineage.md) restent les références de provenance.

**Cette étape livre un contrat, un corpus original indépendant et un port de composant qualifié sur son domaine déclaré.** Le [bilan du jalon](lot8b-evidence/component-stage-01/README.md) relie les reçus : 37 observations, 20 cas géométriques et 12 scénarios comprenant 83 opérations originales ; 249 tests et sous-tests de référence passés dans les modes natifs exact et borné complet, 17 tests de contrat passés et typage passé. Les 83 opérations sont rejouées dans les deux modes natifs ; elles ne deviennent pas 166 opérations originales indépendantes. Les tentatives antérieures restent conservées.

Le composant n’est pas encore raccordé à `NativeV6Runtime`. La version publiée reste 0.66.0 et le registre 68/76 ; aucun compteur de transfert ni numéro de version n’est augmenté par cette preuve. Les critères ci-dessous demeurent le contrat prospectif de cette étape, et le bilan distingue les résultats acquis des obligations du prochain raccordement.

## Propriétaire et domaine

L’API native implémentée est la classe `BranchRouting`, avec `id` et `familyId` égaux à `branch_routing`. Elle reproduit les méthodes source `propose`, `bind`, `before`, `after` et `record`, puis ajoute `state`, `restore` et le diagnostic de calcul incomplet nécessaires au transport natif de l’état. Les fonctions géométriques suivent les cinq fonctions originales : `layout`, `bbox`, `read_state`, `observed_state` et `propagated`.

Les entrées sont des observations génériques mesurées : raster rectangulaire non vide, palette uint8, entités avec boîte et masque relatif, commandes disponibles, époque, référence d’observation, état officiel et compteur de niveaux. Les positions, dimensions, scores et indices appartiennent au domaine des entiers sûrs du runtime. Aucun nom de jeu, identifiant d’instance ou résultat caché n’intervient dans la décision.

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

Le préfixe `move` contient au plus `min(distance / unit, remaining, 16)` actions. Il est réduit à une action si sa clé n’a pas encore été vérifiée pendant l’époque courante. La source applique `remaining` directement à ce mode seulement : les propositions `calibrate`, `select` et `propagate` peuvent encore être construites avec `remaining == 0`. L’admission physique du caller devra les refuser lorsque le budget réel ne permet pas leur exécution. Le port de composant ne doit pas confondre ces deux responsabilités.

### Champs conservés

La proposition conserve `status`, `kind`, `branch_plan`, `actions`, `steps`, `facts`, `compositions`, `question`, `route_refs`, `binding` et `bundle_template`. L’opération de composition reste `OP18`, l’objectif `G_official_completion`, et le rôle `information_question` avec `observed: false`.

Les références sont dédupliquées dans leur ordre d’insertion : observation courante, puis références apprises de `refs`. Le focus `C_branches_...` conserve le digest SHA-256 de la sérialisation JSON Python à clés triées, séparateurs compacts et échappement ASCII. Les projections de sélection conservent le digest uint8 comprenant la forme et les octets en ordre C. Le réemploi du helper `motifRowsDigest` porte uniquement sur cette fonction pure ; il ne partage aucun état entre propriétaires. Son domaine de sélection est une projection mesurée non vide, et ne revendique pas de représenter toutes les formes de tableaux NumPy vides.

## Liaison, gardes et acquisition

`bind` lie les commandes pointées au domaine d’entrée observé pour l’époque et le premier hash d’image. Il conserve l’ancienne liaison et ajoute la boîte de projection ainsi que son digest. Le choix du point reste celui du premier élément admissible de `inputs`, sans tri additionnel.

`before` exige l’époque et le compteur de niveaux du binding, la disponibilité actuelle de la commande, la même référence d’observation pour le premier pas, et la lecture de toutes les poses avec la sélection attendue. Les pas suivants ne réutilisent pas la référence d’observation initiale comme autorité, mais leurs poses et leur sélection doivent toujours être mesurées à nouveau.

`after` ferme immédiatement le préfixe si l’époque, l’état officiel ou le compteur de niveaux change. Sinon il compare la pose attendue lorsque la prédiction existe. Un résultat autre que `True`, ou le dernier pas du préfixe, ferme le préfixe. Un mode sans prédiction n’invente pas de correspondance positive.

`record` observe le retour sélectionné une seule fois dans le futur caller. Ses branches sont conservées :

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

**Limite du domaine restaurable :** `restore()` vérifie la forme, la cohérence et les entiers sûrs, mais ne borne pas encore `unit`, `limit` ou les coordonnées aux dimensions de la frontière publique. Le présent jalon porte sur des snapshots issus d’observations publiques du domaine déclaré ; il ne qualifie pas l’import arbitraire de valeurs potentiellement immenses. L’adaptateur de restauration commun devra fermer cette limite avant le raccordement au runtime.

## Extension native de calcul borné

La source réalise deux produits cartésiens sans borne explicite : affectation des identités et recherche des placements. Le mode exact direct sert exclusivement à la parité sur le petit domaine annoncé du corpus. Le futur moteur commun utilisera un mode explicitement borné et coopératif.

| Borne native maximale proposée | Valeur |
| --- | ---: |
| Affectations d’identité examinées | 16 384 |
| Placements examinés | 65 536 |
| Intervalle de cession coopérative du chemin asynchrone de proposition | 128 éléments |

Ces valeurs peuvent être réduites explicitement pour vérifier les refus ; elles ne doivent pas être relevées silencieusement. Les compteurs et motifs de refus doivent distinguer le domaine complètement examiné, la borne de ressources, l’échéance et l’interruption. L’annulation est vérifiée aux points de coopération ; aucune exploration partielle ne peut devenir une impossibilité démontrée ou un optimum source.

**Portée des bornes :** ces plafonds limitent les produits d’affectations d’identité et de placements. Ils ne constituent pas une borne générale du temps ou de la mémoire du composant. En particulier, `layout` reste une opération synchrone non coopérative ; la construction des listes d’options, la validation des entrées, les copies et digests d’état ainsi que l’historique retenu ne sont pas bornés globalement par ces deux compteurs. Leur coût réel et les exigences de réactivité du futur caller devront être qualifiés séparément.

**Stabilité des entrées pendant une cession :** la garde coopérative contrôle que l’état du propriétaire n’a pas changé pendant un `await`. Elle ne protège pas contre une mutation externe de l’observation JSON ou des autres entrées pendant cette attente. Le futur caller doit fournir un instantané d’entrée stable pour toute la proposition et garantir que ses références d’observation correspondent à ces mêmes données. Cette étape ne revendique pas une isolation transactionnelle des objets d’entrée partagés.

Pour `propose`, un calcul incomplet ne retourne aucun meilleur préfixe partiel. Le diagnostic est transitoire et annonce une recherche incomplète. Les changements d’état autorisés par la source avant la recherche, tels que l’ouverture de l’époque ou une identité complètement relue, doivent être distingués des résultats non obtenus de la recherche interrompue.

Pour `record`, la méthode de composant reste synchrone, comme l’original ; elle utilise une limite explicite d’affectations et ne promet pas de cession asynchrone pendant cette acquisition. Une identité incomplètement explorée ne peut pas être convertie en `after: null`, ce dernier désignant un résultat source complet. Le composant borné lève **`BranchRoutingIncomplete` avant les mutations de cette acquisition**. L’exception de frontière officielle avec score accru demeure prioritaire et n’exige pas cette énumération.

**Obligation du futur raccordement :** lorsqu’une acquisition est différée, le caller doit retenir le retour physique officiel, marquer son acquisition comme non effectuée et reprendre ou terminer proprement son traitement. Il ne doit ni perdre le retour, ni l’acquérir deux fois, ni classifier une limite de calcul comme réfutation physique. Cette gestion n’est pas intégrée ni qualifiée par la présente étape de composant.

## Corpus indépendant et critères de preuve

Le plan initial est borné à vingt géométries et environ dix scénarios synthétiques, au plus cent opérations, des rasters de taille au plus 32 × 32, au plus trois barres et `limit <= 16`. Les produits de placements de ces cas restent de taille au plus `15³`. Tout élargissement doit être déclaré dans le reçu du corpus avant son exécution.

Deux catégories de preuve restent séparées :

- **Chaînes depuis l’état froid :** observation d’un raster, propositions source, retours synthétiques déclarés, acquisition source, puis nouvelle décision. Elles peuvent montrer une dépendance à une acquisition effectivement exécutée dans le composant original.
- **Contrefactuels déclarés :** états explicitement construits pour des clés manquantes ou dupliquées, quatre ou cinq vecteurs distincts, unités atypiques, égalités de coût, vérification absente ou branches de refus. Ils caractérisent la méthode source dans cet état et ne sont pas des preuves d’apprentissage depuis le froid.

Les observations et résultats de l’oracle proviennent du composant Python épinglé et de rasters indépendants. Aucun snapshot, objectif ou événement calculé par le port TypeScript ne doit être injecté dans l’original. Les sorties comparent les géométries, états, propositions complètes, liaisons, gardes, retours et restaurations dans leur périmètre déclaré. Les bornes natives sont testées séparément de la parité exacte.

La couverture doit comporter les quatre modes, une identité ambiguë, un retour contraire, une sélection non unique, une frontière officielle, une nouvelle époque et des sorties hors champ. Le label d’état officiel d’une fixture n’est pas une partie réelle ni un niveau officiel réussi. **LKEY reste définitivement fermé** ; aucun jeu, oracle ou payload de ce cas ne fait partie de ce lot.

## Suite du raccordement et règle de coût

L’intégration ultérieure devra préserver la position source dans `factored_material_return`, immédiatement après `motif_conditioned_access` et avant `conserved_band_transfer`, le propriétaire unique, l’acquisition sélectionnée `branches:<revision>`, le diagnostic `branch_routing`, les gardes courantes et la restauration du runtime. Le programme commun `v6.composition_strategy.choose` reste le point de décision existant. La preuve de composant ne suffit pas à déclarer cette entrée raccordée.

Après raccordement viennent les preuves communes, les régressions affectées, les formes de travail et graphes, puis la qualification du coût et la publication de la version réservée à ce moment. **Aucun coût officiel 8B n’est acquis par cette étape.** Le critère reste une augmentation de la médiane globale des sessions complètes strictement inférieure à 10 % pour STCK et pour SMLP séparément. Une phase peut dépasser 10 % si les deux critères globaux passent ; aucune compensation entre jeux n’est admise.

Le développement, les tests fonctionnels, les commits et les push se poursuivent sans verrou global dans le checkout et la branche propres au lot. Seules les mesures officielles et la publication utilisent l’exclusivité courte encore demandée. Aucun fichier de verrou détenu ne doit être supprimé ou remplacé.
