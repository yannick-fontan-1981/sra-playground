# Filiation du lot 7A : atelier à profils ordonnés

## Origine et périmètre

Le transfert de **`observed_ranked_workshop`** utilise les originaux conservés au commit **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. Le propriétaire est **`public_ranked_workshop`**. Il possède ses contrastes de mode, ses effets d'entrée, ses méthodes, ses observations d'opérateurs et ses réfutations. Le propriétaire des transactions symboliques reste distinct et relève du lot 7B.

Ce document décrit les contrats transférés et leurs consommateurs. Les résultats de campagne, les temps mesurés et l'état d'intégration ou de publication doivent être établis par leurs reçus propres. Une concordance de composant sur une observation synthétique ne constitue pas une réussite en jeu ni une preuve de parité de tout l'appelant Python.

La filiation est vérifiée sur le gel intégré **native 0.52.0**, digest `f5f4a67d68f867d3a37ef66fd7c07b9e75b9d201daceb732038f8fa71caa59eb`, après intégration du commit 4A effectivement publié **`4dafc40c53ed4406ee7cd148e3e6995a2eb4185e` / Site 81**. Le [rattachement après fusion](lot7a-evidence/coordination/published-base-binding.json) établit l'identité inchangée des sources, tests, entrées archivées et entrées de compilation ; il n'ajoute pas un rejeu fictif après cette fusion. Le [bilan fonctionnel intégré](lot7a-evidence/integrated-final/functional-findings.md) et l'[intégrité du gel](lot7a-evidence/integrated-final/delivery-integrity.json) conservent les preuves correspondantes.

## Correspondance source → TypeScript → consommateur → preuve

Tous les chemins source du tableau sont relatifs au répertoire original épinglé. L'[exporteur indépendant](../../scripts/export-v6-ranked-workshop-reference.py) produit la [fixture Python](../../tests/fixtures/v6-ranked-workshop-reference.json.gz). Les [comparaisons de composant](../../tests/v6-ranked-workshop-reference.test.ts) conservent les résultats, les abstentions, les références et les huit champs de mémoire source.

| Contrat source | Implémentation TypeScript | Consommateur effectif | Preuve et portée |
| --- | --- | --- | --- |
| `agents/yf_arc3_v5/capabilities/stem_reliefs.py` : `_runs`, `measure_stem_reliefs`, `measure_ranked_cuts` | [Reliefs et coupes](../../src/logos-engine/v5-stem-reliefs.ts) | Mesure de scène, puis projection courante de l'atelier | Géométries originales, quatre axes, bandes exclues, coupes invisibles ou ambiguës, limites et refus |
| `agents/yf_arc3_v5/capabilities/station_profile_scene.py` : marqueurs, scènes et contexte | [Scène de profils](../../src/logos-engine/v5-station-profile-scene.ts) | `project` et `comparisonContext` | Mesures de profils, paquets de référence, récepteurs, marqueurs et domaines tronqués |
| `morphology_policy/ranked_workshop/geometry.py` | [Projection de l'atelier](../../src/logos-engine/v6-ranked-workshop-geometry.ts) | Proposition, garde avant action et acquisition | Admission structurelle, correspondance pixels/composantes, filtrage des formats et contexte stable |
| `morphology_policy/ranked_workshop/methods.py` | [Méthodes et relations](../../src/logos-engine/v6-ranked-workshop-methods.ts) | Extensions proposées au workflow et analyse du retour | Signatures de mode, changements, supports courants, hypothèses de transformation et accès conditionnel |
| `agents/yf_arc3_v5/capabilities/station_profile_workbench.py` : partie de `_operator` appelée par `relations` | `rankOperator`, dans les méthodes de l'atelier | Ajustement des permutations de rangs et translations uniformes | Appels réels à `_operator` dans l'oracle ; fermeture transférée limitée au contrat décrit ci-dessous |
| `morphology_policy/ranked_workshop/preparation.py` | [Préparations conditionnelles](../../src/logos-engine/v6-ranked-workshop-preparation.ts) | `extensionOptions`, puis choix DRM | Contrôles adjacents acquis, consommation d'un modèle observé, ambiguïtés, refus et coût de préparation |
| `morphology_policy/ranked_workshop/family.py` | [Propriétaire RankedWorkshop](../../src/logos-engine/v6-ranked-workshop.ts) | Runtime commun, `proposeInSubquestion`, gardes, retour et persistance | Propositions source exactes, acquisitions, portée, refus de répétition, restauration et décisions suivantes |
| `morphology_policy/ranked_workshop/workshop.src` et `workshop.drm` | Déclarations originales du [bundle SRC](../../src/logos-engine/v6/programs.json), `NativeSrcProgram`, `NativeDrmRegistry` et callbacks du propriétaire | **`v6.ranked_workshop.choose`**, avec `workshop.measure` puis `workshop.select` | Reçu original du workflow et comparaison de la règle, de l'action et des alternatives retenues |
| `morphology_policy/strategy.drm` et branche correspondante de `strategy.py` | Fabrique et groupes du [runtime commun](../../src/logos-engine/v6-native-runtime.ts) | `factored_material_return / observed_ranked_workshop` | Enregistrement à la place déclarée ; [tests du Kernel](../../tests/v6-ranked-workshop-kernel.test.ts) pour la sélection réelle |
| `laya_proto/common_frontier_runtime.py` : enregistrement sélectionné, passage passif et état de l'atelier | `seal`, `retainSelectedAcquisition` et `acquirePassiveFamilies` | Journal commun après une action autorisée, puis mémoire `family_state:public_ranked_workshop` | Tests du Kernel pour l'acquisition unique, le chemin passif, la restauration et la consommation suivante ; pas de parité globale de l'appelant |

Les chemins `morphology_policy/...` et `laya_proto/...` du tableau appartiennent à `agents/yf_arc3_v6/`. Le raccordement d'une branche ne transfère pas automatiquement les autres familles de ces modules communs.

## Mesures publiques et paramètres hérités

L'admission structurelle de `geometry.candidates` exige au moins deux composantes monochromes non rectangulaires, d'au moins cinq pixels de largeur et deux de hauteur. Chacune doit présenter un bord horizontal complet et au moins deux groupes séparés de colonnes occupées sur plusieurs lignes. Ce préfiltre vient du Python de l'atelier ; ses nombres ne sont pas déduits d'un jeu.

La projection vérifie chaque pixel annoncé par l'observateur contre l'image publique et la palette courante. Les masques de l'observateur sont en `(x,y)` ; les primitives V5 reçoivent explicitement `(ligne,colonne)`. Les boîtes de la scène V5 gardent l'ordre `(haut,gauche,bas,droite)`. Cette conversion est locale et ne change pas le repère de l'appelant.

Les limites suivantes proviennent des sections `stem` et `scene` de **`ranked_workshop/workshop.drm`**. Elles bornent un domaine de mesure, sans affirmer une loi physique de l'environnement.

| Paramètre déclaré | Valeur source | Usage |
| --- | ---: | --- |
| Nombre de rangs | Minimum **2**, maximum **12** | Cohortes régulières de reliefs |
| Composantes | **512** | Admission du domaine de reliefs et de scène |
| Alternatives par composante | **16** | Préfixe canonique conservé, avec signalement de troncature |
| Axes des reliefs | `up`, `down`, `left`, `right` | Mesure explicite dans l'ordre déclaré |
| Quartets de marqueur | **16** | Groupes de quatre coins de même apparence |
| Enceintes de réception | **16** | Contours visibles ou masqués uniquement par un profil mesuré |
| Liaisons de réception | **64** | Coupes exactes et non ambiguës |
| Marge latérale de référence | **2** | Recherche de témoins colinéaires mesurés |
| Orientation des coupes de récepteur | `up` | Domaine déclaré de comparaison, sans généralisation aux autres orientations |
| Expansions de marqueurs | **8 192** | Recherche finie des quartets |
| Requêtes de coupe | **8 192** | Comparaisons de couches et coutures visibles |
| Paquets de référence | **32** | Témoins de la ligne de référence |
| Pixels de l'image mesurée | **16 384** | Domaine de cette projection de scène |

Un dépassement de domaine garde le signal de troncature prévu par la source et empêche la projection d'un contexte autorisant une proposition. Une coupe invisible ou possédant plusieurs coutures possibles garde ses rangs incertains. Les hauteurs ne sont pas devinées.

Un contour partiellement masqué peut rester une alternative de récepteur lorsque ses coins sont visibles et que chaque pixel manquant est couvert par un profil mesuré. Les pixels manquants restent dans `perimeter_gaps_under_ranked_mask`. La mesure ne certifie donc pas un récepteur intact ou stationnaire.

`comparisonContext` ne compare que les formats réellement instanciés par les récepteurs courants : axe déclaré, arité, largeur et pas des rangs. Les autres profils restent dans la scène, avec le statut d'utilité et de rôle inconnus. Pour distinguer un profil affiché dans une enceinte d'un profil extérieur, la source teste ses **noyaux de rangs**, et non toute sa boîte ; un manche peut dépasser du cadre. `stableContext` retire seulement les clés se terminant par `_ref`, en conservant les mesures, les nombres, les profils et la géométrie du marqueur.

## Activation, choix et préparation

La place de la famille vient de `strategy.drm` : `observed_ranked_workshop` suit `observed_rigid_cargo` et précède `observed_symbol_transaction` dans la liste `factored_material_return.ordered_subquestions`. Les branches encore absentes restent identifiées comme telles ; l'ordre du fichier Python ne sert pas à reconstruire cette priorité.

Le propriétaire commence sans contraste acquis. Il ne propose que si le contexte courant existe, si une action reste disponible et si l'une des deux activations source est satisfaite : un contraste de mode déjà observé dans l'époque courante, ou une question de revalidation d'une méthode transportable.

La revalidation transportable exige une signature correspondant au côté du récepteur, au nombre de quartets et à la présence de paquets de référence. Elle exige aussi les **deux contrastes `[0,1]` et `[1,0]`**, la commande encore disponible sans coordonnées, un état courant sans singleton, aucune preuve de mode déjà acquise dans cette portée et aucune réfutation du couple `(méthode, époque)`. La ressemblance de signature justifie seulement l'essai.

Le workflow conserve l'ordre suivant : `revalidate_mode`, `access_prepared_receiver`, `prepare_observed_receiver`, `prepare_unknown_receiver`, `probe_transform`, `legacy`, `access_transform_support`. Les deux préparations minimisent ensuite `estimated_actions_to_test`. Les offres sont regroupées par **action exacte, règle, référence du support et objectif**. Plusieurs candidats réellement distincts produisent une abstention ; un contrôle identique proposé par des preuves équivalentes ne crée pas une fausse ambiguïté.

Les préparations composées prolongent un progrès mesuré : elles exigent un nombre strictement positif de récepteurs à coupe nulle, inférieur au nombre total de récepteurs, ainsi qu'un contraste de mode acquis. Elles ne forment pas une politique de démarrage à froid. Les déplacements de focus et de profil sont tirés d'effets acquis ; le helper `control` exige notamment une variation de bande adjacente égale au signe demandé et une commande unique. Les contrôles de mode, de déplacement ou de réception déjà observés ne sont pas réinventés comme des outils inconnus.

Pour un support déjà essayé, les observations utilisables appartiennent à l'époque courante, à la même boîte et à la même apparence publique du support, avec conservation des autres profils et récepteurs. L'intersection des modèles doit être non vide, la commande d'outil unique, et toutes les prédictions doivent converger vers le consommateur demandé. Un modèle contradictoire ou une intersection vide retire cette préparation. Le coût inclut les mouvements conditionnels, la prise éventuelle, la transformation, le retour et l'essai de réception ; seule la première obligation devient une action gardée.

### Fermeture V5 réellement consommée

`methods.relations` essaie l'identité, le renversement et les rotations cycliques des rangs, dédupliqués puis triés comme dans la source. Pour chaque permutation compatible avec une translation uniforme des valeurs, il appelle la partie consommée de `_operator` avec un delta numérique, une relation de valeurs vide et le domaine **`[0, hauteur de l'image courante]`**. Le compteur source est borné à **128 appels d'opérateur**.

Cette fermeture porte sur la validation de permutation, la longueur du profil et le refus de valeurs hors domaine. Elle ne transfère pas le solveur global de `station_profile_workbench.py`, ses affectations de fournisseurs, ses lois de réutilisation, ses fermetures d'orbites, ses recettes, ses routes ni la branche d'opérateur définie par une table de correspondance de valeurs. Les branches de prérequis exclues par les arguments toujours produits par `relations` ne sont pas revendiquées comme une capacité générale supplémentaire.

## Proposition gardée et retour réel

La proposition conserve **`OP18`**, sa composition d'information et son objectif `G_official_completion`. Elle transporte la règle, le contexte stable, les références d'observation, les inconnues et les falsificateurs. La présence d'une hypothèse dans cette composition n'autorise pas seule une action.

`bind` exige une seule action, l'égalité avec les actions des pas et la présence explicite de `expected_after`. La garde source exige l'index zéro, la même observation, la même époque, la même progression officielle, le même digest d'image publique et une action disponible. Elle remesure la projection, sans se fier au cache, et compare le digest du contexte stable. Les contrôles du domaine d'entrée, de préservation et de WHY/ACT restent exécutés par le moteur commun ; la garde de famille ne prétend pas authentifier seule toute l'enveloppe.

Après l'action, le préfixe est toujours scellé avec **`matched: null`** : son effet demeure à mesurer. `recordSource` refuse un retour dont la commande diffère de l'action sélectionnée. Une différence d'époque produit un événement de frontière officielle, conserve le contraste antérieur dans cet événement puis change de portée. Ce test de frontière propre porte sur l'époque ; il ne remplace pas les contrôles de score et d'état terminal du moteur commun.

Le retour peut acquérir un contraste de singleton à géométrie stable, un effet de déplacement ou de réception, une hypothèse de mode, une paire de profils transformés ou une réfutation. Un essai de revalidation sans contraste de mode réfute la méthode pour l'époque courante. Un accès tenu qui ne déplace pas le marqueur en préservant le mode, le profil et le multiensemble de profils réfute sa méthode directionnelle. Un retour sans modification du contexte stable ajoute le couple `(règle, digest du contexte)` aux rejets : une nouvelle référence d'observation seule ne réautorise pas la même question.

Une transformation n'est modélisée que si le marqueur reste à son lieu, si les boîtes et vecteurs des autres profils restent égaux et si le nombre de coupes nulles concordant avec leur contour ne change pas. Ce dernier contrôle est exactement la mesure source `receiver_changed` ; il ne compare pas chaque pixel de tous les récepteurs. L'observation conserve `global_domain_known: false`. Un ajustement de permutation ou de delta à une paire n'établit pas une loi universelle d'outil. Une égalité avec une coupe, une coupe nulle ou un reçu visible ne prouve pas une occupation persistante ; la composition conserve explicitement `receipts_are_not_occupancy: true`.

## Acquisition active, acquisition passive et mémoire

Le chemin commun enregistre le propriétaire sélectionné une seule fois après le scellement de la transition. Lorsque la sélection appartient à une autre famille, le passage passif de l'atelier reçoit la commande et les deux observations publiques, **sans proposition d'atelier**. Ce passage est sauté lorsque l'atelier vient d'être enregistré activement. Un contraste pertinent peut ainsi rendre l'atelier admissible à une décision suivante sans injecter de connaissance préalable.

Dans le runtime intégré, le passage passif Workshop suit l'acquisition de Recall. La conservation `observed_ranked_workshop_state` intervient après Reactive et avant le propriétaire Feedback, lorsque `mode_evidence` ou `events` est non vide. Workshop et Feedback gardent chacun leur propriétaire ; chacun exclut son retour déjà enregistré activement du passage passif correspondant. Les raccordements de RecurrentSeries/Recall et de Feedback restent distincts de celui de Workshop. Les familles encore absentes de l'appelant gardent leur statut de transfert incomplet. Ces positions relatives et l'unicité du retour de Workshop ne constituent pas une preuve de fermeture de toutes les acquisitions originales.

Une frontière officielle peut produire un événement Workshop même en l'absence de géométrie admissible et sans sélection de l'atelier. Ce retour alimente les faits de frontière et d'état prévus par le contrat ; il ne prouve pas une proposition Workshop ni une contribution à la résolution. Les [captures fonctionnelles de structure](lot7a-evidence/performance-integrated/owner-structural-fixture.json) et leur [attribution](lot7a-evidence/performance-integrated/owner-structural-attribution-02.json), fixées avant mesure de coût, distinguent ces faits acquis des trois nœuds installés pour le propriétaire, l'activation et le programme.

| Donnée conservée | Portée et borne source | Consommation suivante |
| --- | --- | --- |
| `epoch`, `mode_evidence`, `rejected` | Contraste et rejets locaux ; les deux listes sont remises à zéro lors d'un changement d'époque | Activation courante et refus de répétition |
| `mode_methods` | Méthodes historiques ; les **8 derniers contrastes** de chaque méthode sont retenus à l'acquisition | Question de revalidation, puis contrôle de prise conditionnel |
| `input_effects` | **64 derniers effets** ; leur époque et leurs observations restent explicites | Contrôles de focus, de mouvement tenu et exclusion des entrées déjà caractérisées |
| `operator_observations` | **32 dernières observations** ; seuls les modèles liés à la portée et au support courants alimentent les préparations | Intersection des hypothèses et refus d'une transformation contradictoire |
| `method_refutations` | Réfutations conservées avec la méthode et l'époque | Refus de réutilisation dans la portée concernée |
| `events` | Les **32 derniers événements** figurent dans l'état exporté | Diagnostic, preuve d'acquisition et restauration |
| Cache de projection | **2 entrées**, clés `(époque, révision, digest d'image)` ; absent de la sauvegarde | Réemploi du calcul exact au sein de la décision et du retour |

La source n'impose pas de plafond global supplémentaire à `mode_methods`, `method_refutations` ou aux rejets de l'époque. Le transfert ne leur invente pas un mécanisme d'oubli qui modifierait les décisions. Les limites de mémoire historiques et l'absence de borne temporelle de préemption à l'intérieur d'une mesure restent des propriétés distinctes des bornes finies de recherche.

L'état natif `native.public_ranked_workshop.v1` enveloppe les huit champs source. La restauration vérifie la forme de l'enveloppe et les types des collections avant mutation. Le propriétaire autoritaire reste le nœud `family_state:public_ranked_workshop` ; la projection de raisonnement source ne crée pas un second propriétaire.

**Adaptation native explicite :** lors d'une restauration effective, le cache de projection, la sélection transitoire, le contexte mesuré et l'observation de travail sont vidés. Le `restore` Python ne vide pas ces attributs. Cette adaptation force leur reconstruction depuis l'observation courante tout en conservant les connaissances source. Le chemin rapide d'une restauration du même checkpoint déjà détenu ne recopie pas l'état ; la garde avant action remesure néanmoins les dépendances courantes. Une méthode restaurée n'acquiert donc pas, par sa seule sauvegarde, une autorisation valable dans une nouvelle époque.

## Portée des preuves

L'oracle exécute les fichiers Python, SRC et DRM originaux et vérifie l'intégrité de leur manifeste avant et après génération. La fixture conserve leurs empreintes et les fonctions effectivement appelées. Elle comprend une image initiale publique archivée de LKEY ; les modifications de singleton, de palette ou de profils appliquées par l'exporteur sont **des observations synthétiques déclarées**. L'exporteur n'ouvre aucun moteur de jeu et n'envoie aucune action. Cette origine évite de confondre une géométrie publique réelle avec un retour physique qui n'a pas eu lieu.

Les tests de composant confrontent les propositions complètes, les règles et supports retenus, les refus, les reçus SRC et les huit champs d'état à ces résultats originaux. Ils distinguent un retour attendu, un retour contradictoire et une absence d'effet, puis observent leurs conséquences sur la décision suivante. Les classes d'exceptions Python et TypeScript ne sont pas revendiquées comme identiques ; les cas d'exception conservés vérifient le refus dans leur domaine explicite.

Les tests du Kernel utilisent la fabrique commune, l'ordre stratégique, la mémoire autoritaire et les contrôles WHY/ACT. Leur scénario froid de référence est une action choisie par le frontier, un contraste synthétique acquis passivement, une proposition de l'atelier, puis un retour sans effet qui retire cette proposition au choix suivant. Les références d'action de ce scénario appartiennent à la preuve contrôlée et ne sont pas des règles de jeu dans le moteur. Les **155 contrôles de composant et quatre contrats Kernel** sont inclus dans les **3 745/3 745 tests des 97 fichiers** du [reçu intégré](lot7a-evidence/integrated-final/validation/delta-tests-run.json).

La [campagne réelle intégrée](lot7a-evidence/integrated-final/execution-lkey.json) apporte une preuve séparée : **25 actions, deux niveaux LKEY terminés, 14 propositions Workshop sélectionnées**. Le [rejeu original froid](lot7a-evidence/integrated-final/diagnostic/integrated-public-parity.json) conserve **49 appels et 147 comparaisons exactes des états avant/après et des résultats**, sans injection d'état natif. Les [25 retours uniques](lot7a-evidence/integrated-final/diagnostic/contribution.json.gz) se répartissent en 14 actifs et 11 passifs. Les ablations montrent l'effet décisionnel des preuves de mode, des méthodes transportables et des effets de commande ; elles ne montrent pas encore une influence des observations d'opérateurs sur les 14 propositions sélectionnées de ce parcours.

Les [sept régressions enregistrées](lot7a-evidence/integrated-final/regressions/regression-summary.json) passent **119/119 contrôles**, sans devenir de nouvelles campagnes réelles ni des preuves de contribution Workshop sur ces autres jeux. Le [navigateur 0.52](lot7a-evidence/integrated-final/browser/browser-qa.json) confirme Pause, une action unique et les deux frontières naturelles ; sa latence maximale n'est pas mesurée. La réserve **LKEY 2/3**, l'absence de consultation native de Workshop à l'époque 3 et le [temps cumulé de 1 341,623 secondes](lot7a-evidence/integrated-final/lkey-case-checkpoint.json) restent explicites dans le [bilan du lot](lot7a-ranked-workshop.md).

La réussite officielle d'un jeu, l'attribution causale de chaque décision, le coût global par jeu de référence et la publication restent des preuves séparées. **La parité complète de l'appelant Python et de l'ensemble des capacités V5/V6 demeure ouverte.**
