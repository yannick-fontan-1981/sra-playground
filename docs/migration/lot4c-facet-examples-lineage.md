# Lot 4C : filiation des exemples de faces

## Périmètre et statut de cette note

Cette note décrit le contrat des originaux Python épinglés à `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, puis le périmètre de leur transfert 4C. Elle couvre les correspondances simples **et** les compositions activées dans la configuration source. Elle ne constitue ni un résultat de campagne, ni un verdict de coût, ni une preuve de parité de l'appelant complet. Les résultats effectivement exécutés sont consignés séparément par le responsable de livraison.

Les sources propres sont [family.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/family.py), [geometry.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/geometry.py), [compound.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/compound.py), [stencils.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/stencils.py), [facet_examples.drm](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/facet_examples.drm) et [facet_examples.src](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/facet_examples/facet_examples.src). Les repères de lignes ci-dessous concernent ces originaux.

## Propriétaire, ordre et appelant commun

`strategy.py:90` construit une instance unique `self.facets`. Le groupe `surface` délègue à `program_construction` (`strategy.py:434–444,460`). L'ordre de `strategy.drm:342–354` est :

1. `facet_example` ;
2. `surface_rewrite` ;
3. `learned_code_program` ;
4. `slot_substitution` ;
5. `typed_word_interface` ;
6. `rigid_port_assembly` ;
7. `controlled_constellation_cover` ;
8. `linked_temporal_preparation` ;
9. `configured_arrivals` ;
10. `fixed_origin`.

La première proposition non nulle reçoit `program_subquestion` et termine le groupe. Une proposition Facet nulle autorise les fournisseurs suivants. Aucun arrêt après reconnaissance, analogue à celui de RelativeArrangements, n'existe ici.

L'appelant reconnaît `facet_plan` et choisit `strategy_router.facets` (`common_frontier_runtime.py:434,438`). Il appelle `record` uniquement pour le propriétaire de la proposition sélectionnée (`:842–846`), conserve `facet_example_event:<revision>` (`:848`), puis écrit `facet_example_state` et restaure immédiatement ce même propriétaire (`:852–856`). Il n'existe pas d'acquisition Facet passive pour un retour sélectionné par une autre famille.

Le workflow existant `v6.facet_examples.choose` appelle `facet.measure`, puis `facet.bind`. `measure` réconcilie l'époque, cherche d'abord la projection simple et seulement ensuite la composition. `select` exige une projection, au moins une primitive restante, `ACTION6` disponible et un essai qui n'est pas dans `failed`. Le rappel d'un résultat de cache ne dispense d'aucune mesure courante.

## Correspondance source vers transfert et preuves

| Source et contrat | Workflow ou cycle | Implantation native prévue | État consommé ou conservé | Effet sur la décision | Preuve à exécuter |
| --- | --- | --- | --- | --- | --- |
| `geometry.py:6–78`, cadres exacts, exemple, référence et face courante | `facet.measure` | `v6-facet-examples-geometry.ts` | Projection transitoire | Une correspondance unique produit un point expérimental ; ambiguïté ou incohérence produit un refus | Positif simple, cadres incomplets, référence ambiguë, proportions incompatibles et face déplacée |
| `family.py:17–28`, portée et sélection | `facet.measure` puis `facet.bind` | `NativeFacetExamples` | `epoch`, `failed`, états locaux | Un essai sans effet est exclu pour le même triplet époque/hash/point ; la portée locale change avec l'époque | Essai sélectionné, retour sans effet, restauration et refus ultérieur ; nouveau contexte permis |
| `family.py:29–62`, proposition et gardes | Proposition, liaison, avant, après | `v6-facet-examples.ts` | `facet_plan`, preuve publique, commande exacte | Autorise une seule intervention liée puis ferme le préfixe pour mesurer | Chemin commun WHY/ACT, refus d'observation, de pixel, de commande ou d'époque périmés |
| `family.py:81–98`, correspondance, translation et extension des côtés | Acquisition sélectionnée | Même propriétaire | `method`, `portable`, `events` | Conserve une méthode locale conditionnelle ; l'acquisition du germe rend un rappel composé ultérieurement possible | Germination conforme, extension attribuable, absence de vérification latérale, changement hors région |
| `compound.py:21–34`, stencil observé | Acquisition du germe | `v6-facet-examples-compound.ts` | `portable` | Le germe doit reproduire exactement tous les pixels colorés du monde courant | Réponse conforme et réfutation sur une contribution supplémentaire |
| `family.py:66–68`, frontière officielle | Acquisition sélectionnée prioritaire | Même propriétaire | `portable.boundary_ref` si une méthode existe déjà | Ajoute le témoin officiel requis pour la composition ; ne crée pas une méthode absente | Frontière réelle, même si le rendu simple ne se requalifie plus |
| `compound.py:51–99`, rappel conditionnel et préfixe mesuré | `facet.measure` | `v6-facet-examples-compound.ts` | `portable`, cache recalculable, référence courante | Une méthode avec germe, déplacement vertical et frontière peut proposer un germe composé ou une extension unique | Méthode absente/incomplète, exemple changé, référence ambiguë, préfixe inconnu et rappel valide |
| `stencils.py:6–58`, rendu et recherche bornée | Sous-calcul de mesure | `v6-facet-examples-stencils.ts` | Cache non persistant | Seule une solution minimale unique dans le modèle peut être consommée | Solution unique, plusieurs solutions, absence de solution, borne d'états et incertitude de contour |
| `family.py:69–78`, retour composé | Acquisition sélectionnée | Même propriétaire | `compound_methods`, `refuted_compounds`, `method` | Toute différence de rendu coloré ou hors région réfute la portée ; une composition visuellement terminée sans score est également réfutée | Extension confirmée, effet contraire, modification extérieure et candidat non accepté |
| `family.py:100–102`, état source | Persistance et reprise | Propriétaire native `facet_examples` | Sept champs durables exacts | La restauration doit conserver les exclusions et conditions de rappel utiles | Comparaison des champs, vraie restauration native et prochaine décision |

Cette table annonce des obligations de preuve. Un fichier de test écrit, un callback enregistré ou une projection isolée ne démontre pas leur exécution.

## Mesures simples : ce qui est reconnu

La géométrie exige au moins deux contours rectangulaires complets, d'au moins trois pixels par dimension, vérifiés à la fois par leur aire et leur masque. Le cadre de plus grande surface encadre le monde. Le fond est la valeur la plus fréquente dans le raster ; en cas d'égalité, la première occurrence du parcours source fait foi.

Un cadre extérieur contient au moins trois contributions de valeurs distinctes. Une référence séparée fournit exactement une contribution de chaque valeur, en dehors du monde et de tous les cadres. Les rapports de largeur ont un écart maximal de `0.15` et une moyenne strictement entre zéro et un. L'hypothèse comporte exactement une face supérieure sans extension verticale importante et au moins deux côtés étendus. La face supérieure et son homologue de référence se trouvent au-dessus des côtés correspondants.

Dans un monde encore vide de cette palette, une région de fond strictement intérieure doit avoir le même masque que la face supérieure de l'exemple. L'enveloppe estimée doit garder une marge d'au moins un pixel. Le choix maximise d'abord cette marge, puis la proximité horizontale du centre du monde, puis l'origine la plus à gauche. Une seule projection candidate est admise.

Lorsque des contributions sont présentes, toutes les valeurs de la palette doivent être représentées et une unique face supérieure doit conserver le masque mesuré. Les côtés peuvent être des contributions longues ou segmentées, mais leurs bornes horizontales doivent être identiques, leurs intervalles verticaux contigus et leur départ compatible avec la face supérieure. Le manque de hauteur est mesuré dans la correspondance d'échelle. Une apparence de cube ne devient jamais une preuve d'un objet caché.

## Acquisition : priorités et distinctions

L'enregistrement exige la commande exacte de la proposition et son observation initiale. L'ordre source est significatif :

1. Une augmentation officielle de `levels_completed` produit `official_boundary`. Elle met à jour `boundary_ref` si `portable` existe, sans prétendre connaître l'occupation cachée.
2. Pour une proposition composée, le rendu coloré intégral de l'intérieur est comparé à la prédiction et tous les pixels hors de l'intérieur doivent rester identiques. Un résultat conforme acquiert éventuellement une extension locale. Si la dernière composition visible est atteinte sans frontière officielle, le statut devient `compound_visual_candidate_not_accepted` et sa portée entre dans `refuted_compounds`. Le rendu conforme ne suffit pas.
3. Pour une proposition simple, un hash inchangé produit `no_visible_effect` et ajoute l'essai à `failed`.
4. Une nouvelle face supérieure dans la même portée permet de mesurer son déplacement, les bornes des côtés et la préservation extérieure. Une translation verticale ascendante accompagnée de toutes les extensions latérales attendues acquiert `method` et ajoute `up_shift` à une méthode portable déjà présente. Une germination conforme peut acquérir le stencil portable ; elle ne prétend pas avoir déjà prouvé son déplacement vertical.
5. Une contribution extérieure modifiée efface la méthode locale et produit `outside_contribution_changed`. Un effet encore inexpliqué efface également la méthode locale.

La méthode simple n'est pas requise pour proposer à nouveau la face supérieure : elle ajoute les preuves et la méthode conditionnelle à une projection déjà mesurée. De même, `compound_methods` enrichit la preuve et le statut d'une extension actuellement revalidée, sans changer à lui seul le calcul géométrique du point. Une ablation de ces champs peut donc donner un changement de métadonnées seulement. En revanche, `portable`, `failed` et `refuted_compounds` peuvent changer l'action ou le refus. Le rapport de contribution doit garder ces catégories distinctes.

## Méthode composée, bornes et ordre

Le rappel exige une méthode `portable`, un `up_shift` non vide et un `boundary_ref`. Le stencil, les faces, la palette, le fond et le marqueur actif de l'exemple courant doivent être strictement égaux à ceux de la méthode. Il faut une seule composante connexe de référence portant toute la palette, avec voisinage à huit directions et extraction mesurée de son raster.

Le déplacement vertical vient d'un effet acquis. Les déplacements latéraux demeurent des hypothèses de partage de côtés, calculées depuis la largeur du stencil et la hauteur de la face supérieure. Le contrat source utilise une division entière vers moins l'infini, y compris pour le déplacement horizontal négatif. Une division tronquée vers zéro changerait certains exemples.

Le cache est indexé par le stencil, le raster de référence, tous les déplacements et la configuration complète. Cette dernière borne la recherche à **cinq unités et 1 024 états**, avec dénominateur d'échelle maximal **huit** et décalages d'échantillonnage **−0.5, 0, 0.5**. Les échelles rationnelles admissibles sont dédupliquées puis triées. Les pixels de contour peuvent garder plusieurs valeurs admissibles voisines : toutes les alternatives compatibles sont conservées.

La recherche conserve l'ordre des placements et des faces. Elle explore des compositions de taille croissante, déduplique par le rendu et l'ensemble des origines, puis retourne les solutions minimales trouvées dans le modèle. Dépasser la borne d'états produit `bounded_incomplete`, même si des résultats partiels existent ; ce statut n'autorise pas une proposition. Il faut le statut compatible et une unique solution. Les cas sans solution, avec plusieurs solutions ou interrompus restent distincts.

Avant chaque continuation, le rendu coloré courant doit correspondre exactement à un unique préfixe de cette solution. Le point suivant doit encore appartenir à une face de la valeur attendue. Une composition complète déjà visible sans progression officielle n'autorise pas une nouvelle extension automatique.

## État durable et caches

| Champ | Portée et consommation | Changement d'époque |
| --- | --- | --- |
| `failed` | Ensemble d'identités d'essais sans effet, consommé par `select` | Vidé |
| `events` | Historique des retours sélectionnés et de leurs preuves | Conservé |
| `method` | Translation locale conditionnelle, réutilisée avec même portée, masque et valeur | Effacé |
| `epoch` | Époque de la dernière mesure | Remplacée |
| `portable` | Germe observé, déplacement vertical et frontière officielle, soumis à revalidation courante | Conservé |
| `compound_methods` | Extensions mesurées dans l'époque et sous le même modèle | Vidé |
| `refuted_compounds` | Portées composées réfutées ou visuellement conformes mais non acceptées | Vidé |

`compound_cache`, le contexte courant, la projection, l'identité d'essai, la poignée SRC et `last` ne figurent pas dans `state()`. Le cache peut rester dans l'instance entre deux époques ; une nouvelle instance restaurée le recalcule. Une preuve de restauration doit comparer les sept champs source, sans présenter le cache comme une connaissance conservée. Les ensembles durables source sont sérialisés triés ; leur ordre de transport peut être qualifié séparément de l'ordre des hypothèses, solutions et événements.

## Candidat de campagne fondé sur les informations publiques

Le catalogue public [catalog.ts](../../src/games/catalog.ts) identifie **ISOS**, `isos-c0000001`, *Isometric Sketch*, comme un jeu de six niveaux où l'on construit un dessin en cliquant ses faces visibles pour le comparer à une légende. Cette description en fait le candidat principal de 4C ; elle n'établit ni sa reconnaissance effective, ni sa réussite.

Le corpus public préexistant `tests/fixtures/v6-linked-packet-initial-public.json.gz` contient son observation initiale et son paquet public. Sa lecture peut aider à préparer des cas ou une qualification. Elle ne remplace pas une campagne froide, et ses réponses ne doivent pas alimenter le moteur de production. L'audit documentaire initial n'a trouvé ni campagne de résolution ISOS ni horloge de cas ISOS déjà consignée. Toute nouvelle tentative doit néanmoins vérifier l'historique disponible et ouvrir ou reprendre une horloge cumulée, avec plafond de **2 400 secondes pour un cas bloqué**.

La contribution attendue doit distinguer le germe effectivement sélectionné, le retour acquis, la méthode revalidée, le prochain choix et l'acceptation officielle. Si seuls certains niveaux ou les branches simples sont observés, les branches composées doivent garder leur preuve de composant et leur réserve de contribution propre en jeu. Aucun nom de jeu, niveau, couleur fixe, coordonnée préparée ou état caché n'appartient aux règles de production.

## Comparaison indépendante et limites

Le comparateur prévu rejoue une instance Python froide depuis les appels publics capturés. Les observations, rasters, commandes, budgets et retours publics sont ses entrées ; les états et plans natifs sont uniquement des comparands. Les propositions Python produites par cette instance doivent être celles utilisées pour les gardes et acquisitions suivantes. Les vrais appels de restauration native sont observés séparément, y compris au dernier préfixe sans décision ultérieure.

Les propositions sont comparées intégralement après exclusion explicite des seules annotations de l'appelant au premier niveau. Les sept champs durables, les gardes, les événements, les décisions suivantes et les ablations de mémoire restent visibles, y compris les ablations vides ou sans effet. Les valeurs numériques JSON se comparent par valeur sans assimiler les booléens à zéro ou un. Aucune tolérance de géométrie, suppression récursive de champs ou injection d'état natif ne peut rendre concordant un résultat contraire.

Ces contrôles peuvent établir une parité du composant sur la trajectoire couverte. Ils ne prouvent pas la parité de toutes les priorités du Python commun, le rendu privé du jeu, l'occupation tridimensionnelle cachée ou la migration V5/V6 complète.
