# Lot 10D : préparation de TemporalSelection

**État au 11 novembre 2026 : préparation statique seulement.** Le prochain changement cohérent consiste à établir une référence indépendante pour les mesures, les primitives effectivement consommées et le choix DRM/SRC de `temporal_selection`, avant de raccorder son propriétaire natif. Aucun port, test exécuté, jeu, coût officiel ou résultat de publication 10D n'est revendiqué par cette note.

Ce travail peut avancer dans le checkout et sur la branche propres au lot 10, avec des commits et des pushs ordinaires, sans attendre la publication des autres lots. La [politique de travail ordinaire](lot10-ordinary-work-policy.md) s'applique. Les fenêtres exclusives restent limitées aux mesures officielles et à la publication effective ; leurs conditions de qualification demeurent distinctes de l'avancement du développement.

## Référence et état du raccordement

La référence est le commit V6 `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les chemins source ci-dessous sont relatifs à `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`. Les empreintes des six fichiers principaux, de leurs dépendances directes V5/V6 et des fichiers de stratégie/caller concernés ont été comparées au [manifeste épinglé](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/manifest.json) : **13 fichiers conformes**. Cette lecture ne constitue pas une nouvelle vérification de l'intégralité des 1 786 originaux.

Le [registre actuel des entrées](v6-entry-point-progress.json), lié au [reçu de compilation du candidat 10C](lot10c-evidence/recovery-20261111/composed-functional02/validation/checks-run.json), conserve **68/76 entrées raccordées**. Les huit entrées encore en attente appartiennent à `factored_material_return` :

| Entrées restantes dans l'ordre source |
| --- |
| `observed_rigid_cargo` |
| `parallel_branch_routing` |
| `chart_navigation` |
| `region_intervention` |
| **`temporal_selection` — périmètre 10D** |
| `invited_endpoints` |
| `joint_channels` |
| `shared_settlement` |

Le raccordement complet de 10D pourra ajouter une entrée à ce décompte si les autres entrées restent inchangées ; **aucun incrément n'est appliqué à ce stade**. La qualification 10C reste attachée au gel de 329 fichiers natifs, digest `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316`. Cette note n'a modifié ni `src/`, ni `tests/`, ni une preuve historique.

## Contrats source à transférer

| Fichier original | Contrat utile au prochain changement |
| --- | --- |
| [temporal_selection/geometry.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/geometry.py) | `measured_substrate`, `supported_boundary_ring`, `sample`, `measure`, `revalidate`, `current_occurrence`, `composite_and_lateral` : trajectoire axiale unique observée, occurrences stationnaires actuellement supportées, distance à la trace, déplacement latéral expérimental et préservation des autres pixels. |
| [temporal_selection/response.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/response.py) | `poses`, `observe_deviation`, `target_question`, `played_scope_frames`, `recall_launch` : correspondance unique du corps complet, déviation locale, hypothèse de second locus, attribution des images à l'ancien niveau et rappel revalidé d'une commande. |
| [temporal_selection/policy.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/policy.py) | Minimum du couple **priorité DRM / distance**, puis abstention `equally_related_candidates` si plusieurs indices partagent ce minimum. L'indice d'énumération ne départage pas ces égalités. |
| [temporal_selection/selection.drm](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/selection.drm) | Quatre faits requis : `animation_observed`, `current_supports`, `untried_current_context`, `current_input_publicly_available`. Priorités : `launch_changed_arrangement`, `lateral_edit_experiment`, `point_control`, `recalled_launch`. Les effets, le rôle terminal et la loi orbitale restent des inconnues explicites. |
| [temporal_selection/selection.src](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/selection.src) | Workflow `v6.temporal_selection.choose`, callback `selection.select`, décision sans autorité de relâcher directement une action. |
| [temporal_selection/family.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/temporal_selection/family.py) | État, offres, proposition `public_temporal_selection` avec `temporal_selection_plan`, garde revalidant l'offre et le payload exact, acquisitions actives/passives, portée et restauration. La proposition passe par `OP18`. |

L'état source conserve exactement les douze champs `epoch`, `measurement`, `attempts`, `receipts`, `portable`, `edit`, `pending`, `launch_attempts`, `response`, `response_closed`, `launch_methods`, `boundary_reviews`. `state` et `restore` copient les valeurs. À une nouvelle portée, les reçus deviennent historiques ; les mesures, tentatives, édition, réponse et lancement courants sont effacés, tandis que `launch_methods` et `boundary_reviews` survivent. La conservation d'une méthode ne lui donne aucune permission courante.

Un lancement réutilise **la commande acquise complète** et retire `point_binding`. Les autres offres utilisent le point courant et son payload. `before` exige une seule offre actuelle égale à l'offre conservée et la commande exactement attendue ; les changements de portée ou d'index sont refusés. À une frontière officielle, seules les images compatibles avec les ancres de l'ancien niveau servent à examiner l'ancien effet. Le nouveau raster canonique n'en devient pas la preuve.

## Dépendances précises et limites de la réutilisation actuelle

| Dépendance réellement consommée | Conséquence pour le port |
| --- | --- |
| [region_intervention/geometry.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/region_intervention/geometry.py) : `components`, `digest` | Préserver `value`, `pixels`, `area`, `bbox`, l'ordre de parcours et les digests JSON source. La famille RegionIntervention entière n'est pas une dépendance préalable du port 10D. |
| [capabilities/contracts.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/contracts.py) et [capabilities/frame.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/frame.py) : `FrameGrid`, `PeriodicCellGridInput`, `enumerate_periodic_cell_grids` | Dépendance appelée dans `measured_substrate` et `composite_and_lateral`. Le premier lit les descriptions de cellules, palettes et comptes d'occurrences ; le second lit les pas de grille. Cette dépendance périodique complète la ligne 10D de la [note initiale des dépendances](lot10-source-dependencies.md), qui ne la mentionnait pas. |
| [capabilities/station_gated_cargo.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v5/capabilities/station_gated_cargo.py) : `_rotate_point` | Rotation exacte en quarts de tour autour du pivot. Le port complet StationCargo n'est pas requis pour cette primitive. |

Deux interfaces natives existantes nécessitent une attention précise :

- [v6-periodic-cell-grids.ts](../../src/logos-engine/v6-periodic-cell-grids.ts) conserve les géométries et comptages des candidats, mais ne matérialise pas leurs descriptions `cells`. `measured_substrate` consomme notamment `palette_value_count`, `palette_values` et `pattern_occurrence_count`. Il faut couvrir ces champs dans la référence puis les fournir dans un adaptateur ou une extension explicite ; remplacer l'appel source par l'API actuelle sans ce complément serait incomplet.
- [v6-topological-recolor-geometry.ts](../../src/logos-engine/v6-topological-recolor-geometry.ts) expose des `cells` triées, sans le même objet `pixels`/`area` que `region_intervention.components`. Une simple substitution changerait la représentation et potentiellement ses digests. La référence doit vérifier les objets complets, y compris les ordres de pixels consommés.

## Raccordement natif prévu

Le propriétaire prévu est **`public_temporal_selection`**, cohérent avec le `kind` source. Son module et ses auxiliaires ne sont pas encore créés. Le point d'intégration existant est [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts) : installation d'un propriétaire unique, enregistrement dans `factored_material_return`, routage explicite de la sous-question, acquisition et persistance dans le graphe commun. [audit-v6-entry-points.ts](../../scripts/audit-v6-entry-points.ts) devra reconnaître cet enregistrement réel.

L'ordre donné par [strategy.drm](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm) place TemporalSelection après `reactive_contact`, `ordered_reaction`, `chart_navigation`, `region_intervention`, et avant `invited_endpoints`. [strategy.py](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.py) appelle sa proposition à cette entrée. L'ordre de développement ne déplace pas cet emplacement.

Le [caller original](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py) conserve `temporal_selection_event:<revision>` et publie **inconditionnellement** `temporal_selection_state` après l'acquisition, puis le restaure. L'acquisition passive ne répète pas celle du propriétaire actif. Le nettoyage de portée déjà présent doit donc être confronté aux deux champs persistants `launch_methods`/`boundary_reviews`, sans effacer leur contrat. Le test [v6-native-caller.test.ts](../../tests/v6-native-caller.test.ts) cite actuellement `temporal_selection_state` parmi les écritures source non prises en charge : son oracle et sa couverture devront refléter le raccordement effectivement obtenu, sans masquer ce champ.

## Premier changement réalisable et contrôles à prévoir

**Premier commit de développement proposé : ajouter un générateur de référence indépendante et son corpus initial pour les dépendances géométriques et la sélection.** Le chemin proposé `scripts/export-v6-temporal-selection-reference.py` est un nouveau fichier à créer, pas un outil déjà livré. Il pourra suivre la conservation des originaux et des sorties de [export-v6-ordered-recruitment-reference.py](../../scripts/export-v6-ordered-recruitment-reference.py), en exécutant les fonctions Python originales sur des entrées explicites et sans utiliser de sortie native comme attendu.

Ce premier corpus doit rendre vérifiables : les composantes/digests complets ; les descriptions des cellules périodiques consommées ; la rotation ; l'absence ou l'ambiguïté de trajectoire ; les supports ou occurrences modifiés ; le minimum de distance unique et son égalité ; les quatre faits DRM ; le résultat complet du vrai workflow SRC. Les entrées synthétiques viennent de ces contrats publics de code. Aucun cas de jeu n'est choisi par cette note.

La suite ordinaire devient alors :

1. Porter les mesures et la politique confrontées à ce corpus ; compléter les réponses et les douze champs de famille avec leurs références originales.
2. Raccorder le propriétaire unique et ses acquisitions à froid, puis éprouver garde exacte, restauration, commande étrangère acquise et passage naturel de frontière. Les futurs tests dédiés de référence et du noyau commun seront de nouveaux fichiers explicitement déclarés dans le gel 10D.
3. Rejouer les contrôles existants affectés : [v6-source-entry-routing.test.ts](../../tests/v6-source-entry-routing.test.ts), [v6-native-caller.test.ts](../../tests/v6-native-caller.test.ts), [v6-native-state-graph.test.ts](../../tests/v6-native-state-graph.test.ts), [v6-caller-integration.test.ts](../../tests/v6-caller-integration.test.ts), et [v6-periodic-pattern-counts.test.ts](../../tests/v6-periodic-pattern-counts.test.ts) si l'énumération partagée change. Leur exécution reste à faire sur le futur candidat ; les résultats 10C ne sont pas transférés à des sources modifiées.
4. Déclarer les non-régressions du nouveau gel à partir des [dix cas 10C](lot10c-evidence/recorded-regression-cases.json), plus le [complément KATA distinct](lot10c-evidence/recovery-20261111/kata-supplement/recorded-regression-case-kata.json), puis exécuter les contrôles fonctionnels sans verrou global. Les réserves des cas historiques, les budgets existants et la fermeture de LKEY restent conservés.

La qualification finale, les mesures officielles sur le prédécesseur effectivement publié et la publication constituent des étapes ultérieures. Aucun numéro de version 10D n'est fixé ici. La règle de coût utilisateur reste celle documentée : un dépassement de phase peut être accepté si la médiane globale de la session du même jeu reste strictement sous +10 %, séparément pour STCK et SMLP.

**Travail réalisé pour cette note : lecture statique, vérification des treize empreintes source citées et vérification des chemins. Aucun moteur, test, oracle exécuté, jeu, coût ou publication lancé.**
