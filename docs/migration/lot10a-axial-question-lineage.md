# Filiation du lot 10A : question axiale

## Référence et portée

Le transfert de `axial_question` utilise les originaux du commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, conservés sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. La base publiée constatée à l'ouverture est **Site 83**, moteur **0.52.0**, commit `bed48116585da864dd5c412ed11dd6990a950e8e`. Les modifications des lots parallèles doivent être réconciliées avant le gel de livraison ; cette base d'ouverture ne prétend pas être la future référence de coût.

Le propriétaire `public_axial_question` pose une question conditionnelle portant sur **une rotation**. Il mesure des corps à deux barres opposées, un marqueur de sélection attesté et une cible visible. Il ne possède aucun modèle complet des forces, des interactions, du passage à travers les murs ou de réussite terminale. Les entrées WindowQuestion, OrderedRecruitment, TemporalSelection et InvitedEndpoints restent hors de 10A.

**État de préparation : 130/130 vérifications de référence et six scénarios du caller commun passent dans la branche isolée.** Le [reçu source](lot10a-evidence/diagnostic/axial-reference-validation.json) et les tests communs lient les contrats exécutés ; les contrôles du gel intégré, le coût et la publication restent distincts. Le scan initial reste un rejeu géométrique archivé, sans nouvelle partie. Une comparaison avec Python de la famille seule ne démontre pas la parité de tout son appelant.

## Correspondance source → TypeScript → consommateur → preuve

Les chemins V6 abrégés ci-dessous appartiennent à `agents/yf_arc3_v6/`. Les chemins TypeScript sont relatifs à la racine du dépôt. La dernière colonne définit la preuve nécessaire ; elle n'anticipe pas son résultat.

| Contrat source | Implémentation TypeScript | Consommateur | Preuve attendue et limite |
| --- | --- | --- | --- |
| `morphology_policy/topological_recolor/geometry.py::components` | `v6-topological-recolor-geometry.ts::components`, déjà présent | Mesure axiale et décomposition des barres | Ordre des composantes, coordonnées absolues XY et ordre lexicographique des pixels ; aucune dépendance à l'achèvement de toute la famille Recolor |
| `morphology_policy/axial_question/geometry.py::bar_segments, measure` | `v6-axial-question-geometry.ts::barSegments, measure` | Offres, garde avant action, acquisition | Comparaison des corps, signatures, ancres, cible, sélection, ambiguïtés et refus depuis les résultats Python |
| `geometry.py::relations` | `v6-axial-question-geometry.ts::relations` | Construction des offres Axial | Trois relations, ordre des pairs et dépendances transverses ; la relation ne prédit aucun point d'arrivée |
| `geometry.py::projected_turns` et partie pivot de `agents/yf_arc3_v5/capabilities/axial_field_configuration.py::_state, _direct` | `v6-axial-question-geometry.ts::projectedTurns` | Orientation conditionnelle d'une offre | Cycle, deux signes de quart de tour et prérequis du domaine consommé ; aucune fermeture physique V5 supplémentaire |
| `axial.drm`, `axial.src`, `policy.py` | `v6-axial-question-policy.ts`, déclarations originales dans `v6/programs.json`, registre DRM et exécuteur SRC | `v6.axial_question.choose` → `axial.select` | Workflow réellement appelé, classement exact, refus et index source ; plusieurs offres ne constituent pas seules une ambiguïté |
| `family.py::offers, propose, bind, before, after` | `v6-axial-question.ts` | Sélection, WHY/ACT, action et scellement du préfixe commun | Proposition OP18, retour des gardes, retrait des autorisations périmées, disponibilité et consommation réelle |
| `family.py::record` | `recordSource` pour la comparaison originale ; `recordObserved` pour l'attribution native des frontières | Acquisition active ou passive du propriétaire | Attestation froide, rotation réellement observée, tentative, retour sans effet, décision suivante ; adaptation de frontière isolée ci-dessous |
| `family.py::scope, state, restore` | Six champs source et enveloppe native versionnée | Sauvegarde, restauration et changement d'époque | Identité des connaissances conservées, absence de permission courante héritée et refus des états natifs mal formés |
| `morphology_policy/strategy.drm`, `strategy.py` | Fabrique et ordre du runtime `v6-native-runtime.ts` | `factored_material_return / axial_question` | Admission à la place source, après `topological_recolor` et avant `window_question`, sans modification arbitraire des priorités |
| `laya_proto/common_frontier_runtime.py`, enregistrement sélectionné, passage passif et état Axial | Acquisition commune, propriétaire unique et mémoire de famille | Retour après une action de toute famille | Un seul enregistrement Axial par retour ; passage passif exclu lorsque l'acquisition active a déjà eu lieu |

Tous les fichiers TypeScript de ce tableau appartiennent à `src/logos-engine/`. Les sources originales restent les attentes indépendantes des tests ; une réécriture de l'algorithme natif dans un test ne constitue pas un oracle.

## Mesure et paramètres hérités

Les composantes monochromes sont parcourues selon leur première cellule en ordre ligne puis colonne. Leurs cellules sont triées en coordonnées `(x,y)`. Les barres originales sont conservées d'abord. Des segments sont ensuite recherchés dans les composantes non linéaires, en ordre composante, longueur impaire croissante, cellule lexicographique, puis direction horizontale et verticale. La borne `4 × longueur²` qui écarte une composante trop grande vient de `bar_segments`.

Deux barres de valeurs distinctes peuvent délimiter un corps carré si leurs extents et leur écart correspondent. La valeur de pôle la plus petite détermine la première barre et l'axe positif mesuré ; aucun nom de couleur ne reçoit un rôle fixé. Les autres pixels intérieurs, hors centre, doivent être non vides et uniformes ; les côtés restants doivent également être uniformes. Leur valeur ne doit égaler aucun des deux pôles. **Le noyau et le côté peuvent avoir la même valeur** : `core_side_distinct` est un élément de signature de méthode, pas une condition supplémentaire d'admission.

La scène doit posséder **2 à 16 corps**, des centres distincts et une signature commune `[pôle_1, pôle_2, noyau, côté, taille]`. Les ancres sont les composantes carrées pleines de taille `taille−2` et de valeur égale au noyau. Elles doivent fournir au moins **trois abscisses et trois ordonnées distinctes**, avec des écarts multiples de la taille du corps. Leurs centres fixent les limites de la grille.

La cible est une composante carrée dont le support égale exactement le périmètre de taille `4 × taille−4`. Son intérieur, hors centre, doit être uniforme et son centre doit partager la valeur de l'anneau. Les limites testées sont celles de la source, notamment la marge supérieure `taille//2` sur les extrémités droite et basse. **Une seule cible** est admise. Parmi les corps, un marqueur central distinct du noyau désigne la sélection géométrique ; plusieurs marqueurs rendent cette sélection ambiguë.

Le domaine natif commun reste une image rectangulaire de palette entière `uint8`, d'au plus **65 536 pixels**. Les fonctions originales ne réalisent pas toutes cette validation d'entrée ; la parité revendicable doit donc rester dans le domaine public commun. Une image vide est refusée sans mesure. Une image mal formée ne devient pas une observation partielle autorisant une action.

## Fermeture V5 réellement consommée

`projected_turns` construit des identités à partir des centres, convertit les cellules en `(ligne,colonne)`, et fournit un état courant avec réserve zéro et sans terminaison. Le modèle ne contient que les cellules des corps comme domaine de sol et le cycle d'orientation déclaré. Aucun mur, loi de force, seuil, ordre de mouvement, loi de cible ou relaxation n'est fourni.

La fermeture portée correspond à `_state` puis à la branche `pivot` de `_direct`, avec un corps sélectionné et un signe de rotation `−1` ou `+1`. `_state` vérifie l'unicité des cellules et identités, les axes cardinaux et les étiquettes de pôles distinctes. `_direct` exige un cycle non vide sans doublon, composé d'axes cardinaux et contenant l'axe courant. Le résultat consommé est uniquement `orientation_after`. Le modulo négatif est normalisé comme en Python.

Le budget source est un `DWorkBudget` construit avec un `SimpleNamespace` : **1 000 visites, 1 000 ms et 1 000 cellules de domaine**. Les deux projections partagent ce budget ; chaque corps est visité pour chaque signe. Dans le domaine mesuré de 2 à 16 corps, cela représente au plus 32 visites. Le port réutilise l'implémentation commune du même contrat de budget, déjà portée avec Recolor. La vérification de limite précède chaque incrément ; le temps est vérifié à ces visites. La source n'appelle pas `finish()` à la fin de ces deux projections, et le port n'ajoute pas cette validation finale.

**Ce budget ne borne pas toute la mesure géométrique.** La recherche des barres et des corps est finie dans le domaine raster, mais le délai de 1 000 ms ne commence que dans le projecteur V5. Les branches V5 de sélection pointée, de cycle de sélection, de relaxation, de force, de service et de route ne sont pas transférées par ce consommateur. Les prérequis de constructions artificielles hors de la scène mesurée ne sont pas une capacité générale revendiquée.

## Activation, choix et garde

Une sélection géométrique ne suffit pas. Le propriétaire exige une sélection acquise, de la même époque, dont le centre, le marqueur et la signature de méthode correspondent à la scène courante. Cette signature conserve la taille, l'opposition de barres distinctes et la distinction ou non entre noyau et côté.

Les pairs sont examinés dans l'ordre mesuré. Ils doivent partager la ligne ou la colonne de l'acteur et posséder un axe colinéaire à cette relation. La cible peut être entre les deux corps, extérieure sur le même axe, ou transverse avec une dépendance géométrique supplémentaire. Les relations restent des hypothèses qualitatives.

Le DRM déclare le cycle `[-1,0] → [0,1] → [1,0] → [0,-1]`, les a priori `ACTION3/−1` et `ACTION4/+1`, et l'ordre **between, outside, transverse_dependency**. Une méthode rappelée compatible peut remplacer le signe a priori de sa commande. Son admissibilité exige **au moins deux références de preuve**, pas deux rotations distinctes ; un seul reçu de rotation contient déjà avant, après et empreinte de l'image physique. Le rappel part de la méthode compatible la plus récente, parmi les méthodes transportables puis les rotations courantes. La commande doit rester disponible.

Le classement exact est **priorité DRM, distance en quarts de tour, contrôle rappelé d'abord, commande, indice source**. Le workflow sélectionne donc un minimum déterministe même lorsque plusieurs offres existent. La règle d'unicité des candidats d'une autre famille ne s'applique pas ici.

La clé de tentative comprend l'époque, la cible, tous les centres/axes/marqueurs des corps, la commande et le genre de relation. **Elle ne comprend pas l'identité du pair.** Deux offres du même genre peuvent ainsi partager une clé. La garde source exige exactement une correspondance de clé et de mesure complète parmi les offres recalculées. Ce refus propre est conservé : un choix déterministe n'implique pas que toutes les propositions ainsi choisies passent la garde.

La proposition conserve OP18, une action et `expected_after: null`. La garde source vérifie l'index zéro, l'observation, l'époque, le hash public, l'ensemble d'actions et la mesure actuelle. Le score figure dans la liaison, sans comparaison séparée dans cette garde source. L'autorisation commune de livraison conserve ses contrôles propres ; la famille ne prétend pas authentifier seule toute l'enveloppe. Après l'action, elle scelle toujours le préfixe avec effet et préservation encore inconnus.

## Acquisition et attribution des images

L'attestation initiale demande une sélection mesurée absente avant, unique après, **un seul pixel changé au centre du corps sélectionné**, et la conservation ordonnée des centres, axes et signatures de tous les corps. Elle peut donc provenir de l'action d'une autre famille. Une sélection déjà dessinée au démarrage ne devient pas automatiquement une connaissance acquise.

La rotation est acquise seulement lorsque le retour porte une proposition Axial, avec une sélection mesurée avant et après et une signature de méthode compatible. Le delta d'orientation doit être un quart de tour, dans un des deux signes. Le reçu conserve la commande réelle, l'époque, les références avant/après, le digest de l'image physique, son indice dans le paquet, l'éventuelle frontière et les lois encore inconnues. Le propriétaire conserve aussi les positions conjointes et le delta officiel de score. Une proposition pertinente consigne sa tentative même sans effet exploitable ; cette tentative empêche la répétition aveugle au même contexte.

Le passage passif ne déduit pas de loi de rotation : dans la source, cette acquisition nécessite la proposition Axial active. Il peut attester une sélection et rendre la famille admissible à la décision suivante. L'appelant source exclut le passage passif lorsque le même propriétaire a déjà traité activement le retour.

### Adaptation native de frontière, séparée de la parité source

L'original examine le dernier échantillon du paquet ayant les mêmes limites de grille, cible et nombre de corps. Sans échantillon compatible, une frontière empêche l'utilisation de la scène finale. Cette attribution est insuffisante lorsque l'ancien et le nouveau niveau partagent exactement ces trois ancres : la source peut alors accepter la nouvelle scène comme contraste de l'ancienne.

Le chemin `recordSource` conserve le calcul original pour les comparaisons indépendantes. Le chemin de production `recordObserved` ajoute une règle conservatrice à la frontière : l'image finale du nouveau niveau est exclue ; si ses ancres sont indistinguables de celles de l'ancienne scène, aucun contraste physique de ce paquet non étiqueté par époque n'est acquis. Les indices originaux des images ne sont pas renumérotés. Les événements de score et de changement d'époque restent distincts et observables.

Cette adaptation peut perdre une rotation réellement visible dans un paquet ambigu. Elle préserve le statut inconnu au lieu de fabriquer une attribution. Ses tests doivent être présentés séparément d'une égalité avec Python. Un score officiel positif reste une preuve de progrès ; la position sur une cible ou une animation partielle ne le remplace pas.

## Mémoire et restauration

Les six champs source sont `epoch`, `selection`, `rotations`, `portable`, `attempts` et `last`. À une nouvelle époque, les rotations acquises sont ajoutées aux méthodes transportables avec le statut **revisable_method_not_current_permit**. La sélection, les rotations courantes, les tentatives et le dernier retour sont réinitialisés. Les anciennes méthodes restent des connaissances révisables, soumises à la nouvelle signature et à une sélection nouvellement attestée.

La source appelle sa sauvegarde de raisonnement seulement si **selection, rotations ou portable** est non vide. Les tentatives ou le dernier retour seuls ne déclenchent pas cette écriture. Le mécanisme natif doit distinguer cette condition du checkpoint complet des propriétaires : une enveloppe native peut conserver l'état interne de tous les propriétaires pour restaurer une session, sans prétendre que chaque champ a déclenché une acquisition sémantique source. L'exclusion active/passive garantit un seul événement Axial par retour dans le journal commun.

La restauration des connaissances n'est jamais une restauration d'autorisation. L'observation, la scène, les marqueurs, les relations, la commande et la portée sont revalidés avant la prochaine action. Les caches recalculables, s'il en existe, ne doivent pas devenir des preuves ni supprimer les contre-exemples ou méthodes utiles.

## Preuves de jeu et coût à conserver séparément

Le [scan géométrique conservé](lot10a-evidence/diagnostic/initial-public-admission.json) examine **95 images publiques initiales archivées**, sans action ni mémoire préchargée. Il conserve les exclusions de cinq cas dont les horloges antérieures restent distinctes. **Seul POLA est admis par la mesure** : deux corps, une relation `between` et aucune sélection initialement marquée. Cette mesure ne rend pas Axial admissible à froid ; il manque encore le contraste de sélection acquis. Le scan ne compare pas Python et ne lance aucun moteur de jeu.

Le catalogue public désigne aussi **POLA / Polarity** comme candidat pertinent pour des corps sélectionnés et des rotations. Ce candidat possède déjà un historique : le [bilan V53](v53-outline-service-and-current-relations.md) conserve une tentative interrompue sur la source attempt3/native 0.25, avec **94 actions, zéro niveau et aucun reçu final**. Cela ne constitue ni une campagne achevée ni une horloge de cas remise à zéro. Toute nouvelle tentative doit conserver le temps antérieur récupérable et qualifier l'incertitude restante.

La campagne propre doit montrer la chaîne depuis une mémoire froide, son bootstrap passif, une proposition réellement sélectionnée, son acquisition et une décision suivante influencée. Un rejeu d'observations, un scénario synthétique, une partie exécutée et une vérification navigateur restent des preuves distinctes.

Le protocole courant utilise STCK et SMLP, en **A1/B1/B2/A2**, avec quatre sessions par jeu et par série : **32 sessions mesurées, 400 actions**, huit chauffes séparées de trois actions. La médiane complète par jeu doit rester **strictement sous +10 %**. Les phases et p95 disponibles restent visibles, sans addition des phases imbriquées ni compensation entre jeux. Ce texte décrit le protocole de référence ; seule une déclaration préalable liée aux véritables gels de 10A peut engager sa propre fenêtre. L'ajout du propriétaire et du workflow demande une qualification structurelle préalable, séparée d'une identité intégrale du graphe et sans retrait de son coût.
