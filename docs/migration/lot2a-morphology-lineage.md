# Lot 2A : filiation des mesures morphologiques courantes

## Périmètre du transfert

Le point de départ est la publication **60**, commit `9be3d0434f6f8ff91236d61a51eafa4017c3a082`, avec Logos Engine natif `0.32.0`. La politique morphologique SRC/DRM était déjà compilée et vérifiée sur des faits de référence. Elle n'était pas alimentée par un producteur de mesures dans le choix commun : aucun fournisseur `morphology` n'était enregistré, et les propositions recevaient systématiquement `not_evaluated / prior_family_selected`.

Cette étape raccorde les mesures au fournisseur commun et permet une proposition morphologique effectivement gardée, autorisée et acquise. Son domaine est celui de `geometry.measure_routes` **sans objet de méthode de station fourni** (`station_method = None`). Il comprend les paires actuellement visibles, les correspondances partielles strictement justifiées par une bordure occultée, les routes ordinaires, les contrastes de contrôle, les stations acquises dans l'époque courante et les effets de palette actuellement revalidés.

Un objet `station_method` non nul est un domaine distinct, qu'il provienne de l'époque courante ou d'une portée antérieure : il peut activer `managed_projection`, `managed_capacity` et les approches d'entrée mémorisées. Un appel direct fournissant une telle méthode reçoit un refus natif explicite dans les branches non transférées. Ce refus est une limite de transfert ; il ne prétend pas reproduire un refus de la source Python.

La référence reste le commit Python **`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`**, conservé sans modification. Les résultats des producteurs ne sont ni des commandes préautorisées, ni des rôles de jeu acquis. La validation commune WHY/ACT reste nécessaire pour chaque action.

## Producteurs et consommateurs

| Contrat source | Implémentation TypeScript utilisée | Consommation effective |
| --- | --- | --- |
| V5 `complementary_contours.measure_contours` et `measure_centered_enclosure_identities` | `centeredMorphologyEnclosures` dans [v6-morphology-measurements.ts](../../src/logos-engine/v6-morphology-measurements.ts) | Filtre les enceintes fermées dont un composant intérieur présente quatre marges positives égales |
| V6 `geometric_observer.components`, `framed_patterns`, `rotate` | [v6-native-observer.ts](../../src/logos-engine/v6-native-observer.ts) et [v6-geometric-scene.ts](../../src/logos-engine/v6-geometric-scene.ts), déjà transférés | Produit les motifs mesurés dans ces enceintes ; ne leur attribue aucun rôle à partir d'une couleur |
| `orthogonal_features.matched_pairs` et `residuals` | `matchedMorphologyPairs`, `morphologyPairs`, `morphologyResiduals` | Mesure séparément forme, orientations possibles, échelles et relation de palette |
| `geometry.rigid_role`, `footprint` | Fonctions exactes existantes rendues exportables dans [v6-motion-contrast.ts](../../src/logos-engine/v6-motion-contrast.ts) | Lie un ensemble de composantes à ses mouvements réellement observés et à son empreinte complète |
| `terminal_composition.motion_models`, `registered`, `Snapshot` et `identity` | [v6-composition-memory.ts](../../src/logos-engine/v6-composition-memory.ts) | Lit les transitions déjà acquises par le propriétaire commun GoalAccess ; aucune seconde histoire de mouvements n'est créée |
| `observed_meter.ObservedMeter` | [v6-inventory-caller-context.ts](../../src/logos-engine/v6-inventory-caller-context.ts), déjà transféré | Fournit une prévision courante à la politique et aux questions de capacité |
| `geometry.gauge_related_marks` | [v6-inventory-continuation.ts](../../src/logos-engine/v6-inventory-continuation.ts), déjà transféré | Relie une apparence locale à celle de la jauge mesurée, sans lui attribuer un effet de recharge |
| `geometry.measure_routes` et `missing_axis_witness` | `measureMorphologyRoutes`, `morphologyMissingAxisWitness` | Produit les routes, leur portée, les positions attendues et les alternatives d'une commande encore inconnue |
| `partial_correspondence.retain` et `interior_probe` | Mesures privées du même module | Conserve une paire uniquement lorsque les coins et tous les pixels intérieurs restent observés ; produit le contact intérieur unique actuellement accessible |
| `feature_occurrences.known_feature_sites` | `knownMorphologyFeatureSites` | Revalide les effets sélectifs acquis et exclut ces sites du transit ordinaire |
| `rearm_evidence.orientation` et `prediction` | `morphologyOrientation`, `morphologyStationPrediction` | Prévoit conditionnellement une rotation à partir d'entrées indépendantes et compare le retour réel |
| `MorphologyPolicy.evaluate` et `morphology.src` | [v6-morphology-policy.ts](../../src/logos-engine/v6-morphology-policy.ts), déjà transféré puis raccordé au registre commun | Exécute les projections de mesure, rôle, composition et accès sur les faits réellement produits |
| `CompositionTargetTree.extend_target` | [v6-target-binding.ts](../../src/logos-engine/v6-target-binding.ts), déjà transféré | Préserve la priorité des résidus et dérivations déjà pris en charge ; son résultat renseigne la politique avant sa décision |
| `MorphologyAdapter.propose`, `before`, `after`, `record` | [v6-morphology-family.ts](../../src/logos-engine/v6-morphology-family.ts) | Lie une décision à un préfixe, vérifie ses prémisses et acquiert uniquement les retours réellement exécutés |

La détection de contours conserve les bornes V5 : 4 096 pixels, 512 composantes et 32 contours. Les contours ouverts comptent aussi dans la dernière limite. Un inventaire trop abondant ne doit pas exposer seulement les premières enceintes fermées et faire disparaître une ambiguïté. Les identifiants V5 des composantes ne sont pas consommés par cette projection ; leur géométrie complète et l'ordre de parcours du raster le sont.

## Mesure d'une paire et d'un contrôle

Une paire provient de deux motifs encadrés distincts dont les masques normalisés se correspondent par rotation. Les quatre rotations sont conservées comme alternatives. Une orientation unique permet de mesurer un décalage ou un alignement ; une symétrie ne devient pas arbitrairement une orientation certaine. Les couleurs des deux motifs sont comparées sans leur donner de signification fixe.

Le chemin complet exige une paire unique dans l'inventaire courant. Plusieurs paires maintiennent l'ambiguïté. Une paire absente ne peut être récupérée que par le contrat strict de correspondance partielle : le dernier témoin complet est prioritaire, le participant contrôlé doit être lié à la même empreinte et ne peut masquer qu'une partie de la bordure. Un coin masqué, un pixel intérieur masqué, un changement visible ou une autre superposition invalide cette reprise. Une contradiction récente ne provoque pas une recherche opportuniste d'un témoin plus ancien.

Le contrôle vient de `motion_models` et de l'histoire publique acquise. Toutes les composantes du participant doivent partager les mêmes déplacements ; ceux-ci doivent attester deux axes et au moins deux positions antérieures distinctes. L'union des composantes doit remplir l'empreinte rectangulaire entière. Des objets détachés présentant une translation commune ne suffisent pas à fabriquer une surface traversée.

La méthode n'attribue donc pas une direction à `ACTION1`, `ACTION2` ou à un autre nom de commande. Les noms servent seulement à identifier des interventions observées et à départager de façon canonique des interventions encore indiscernables.

## Routes et refus conservés

Une surface traversable est soutenue par des arrivées depuis au moins deux origines distinctes et n'a pas d'exemple de blocage dans le contexte considéré. Une arrivée non locale est conservée avec ses références avant/après ; elle coupe le préfixe au premier résultat non qualifié. Les positions sont cherchées sur le plateau public fini, avec le budget d'actions courant.

Le producteur distingue six routes ordinaires : `modifier`, `peer`, `feature_probe`, `capacity_probe`, `peer_access_probe` et `capacity_access_probe`. Un contact avec un motif persistant et multicolore est une expérience, pas une loi de transformation connue. Un accès au pair utilise un contact sélectif réellement acquis. Un contraste de palette conserve forme, orientation et pair comme conditions. Un marqueur d'apparence liée à la jauge motive une question de capacité dont l'effet reste inconnu.

Le choix local conserve les refus source. Deux destinations distinctes à la même distance minimale ne sont pas départagées artificiellement. Le préfixe engagé ne dépasse pas 16 actions, tandis que `full_access_length` conserve le coût du trajet complet. Une route partielle ne devient pas un contact atteint. Le fournisseur applique ensuite le filtre source : si une étape utilise une commande actuellement indisponible, il retire la route entière des faits proposés à la politique.

Un accès conditionnel par un axe inverse manquant n'invente pas cette commande. Il conserve le déplacement hypothétique, les autres issues possibles, les interventions indiscernables et leurs témoignages. Un résultat contraire dans une exposition comparable exclut une intervention. Le préfixe s'arrête au premier essai non qualifié.

Les stations déjà acquises restent des sites susceptibles de produire un effet, même si leur surface est traversable. Elles ne deviennent pas un transit censé préserver l'orientation. Un cycle local de sortie puis de rentrée exige une sortie observée préservant la pose et une entrée observée ayant un effet ; le producteur conserve les références des deux événements. La prévision d'un effet connu exige au moins deux entrées indépendantes, un incrément unique non nul et la préservation du pair. Une telle prévision reste réfutable au retour réel.

La branche de capacité gérée ne doit pas bloquer à tort ces routes ordinaires. Dans la source, `managed_projection.project_layout` renvoie immédiatement un résultat absent lorsque `station_method` est absent. La présence simultanée d'une jauge et de marqueurs ne suffit donc pas à rendre ce calcul applicable. Le domaine courant conserve ce comportement.

## Propriétaires et acquisition

| État | Propriétaire | Condition de mise à jour |
| --- | --- | --- |
| Histoire des transitions et modèles de déplacement | `caller:goal`, instance existante de GoalAccess | Acquisition commune de chaque retour réel |
| Jauge et indices de collecte | `ObservedInventory.callerContext`, conservé dans son état natif | Acquisition commune existante ; observation de planification idempotente pour la même référence |
| Contacts sélectifs, essais, entrées, sorties et effets de palette morphologiques | `family_state:morphology` | Retour du préfixe sélectionné et observations passives de départ prévues par la source |
| Faits, routes et décision de la proposition courante | Calcul courant et proposition engagée | Recalcul à partir des propriétaires ci-dessus, sans second modèle métier |
| Autorisation physique et relations de contribution | Autorité commune et arbre de cible existants | Gardes courants, WHY/ACT et acquisition commune |

L'ordre par transition scellée reste : attention, collecte utilisant la prévision antérieure, observation de la jauge, vue, acquisition du fournisseur sélectionné, acquisitions passives et départs morphologiques, puis GoalAccess et les autres mécanismes communs. Une mesure de planification ne rejoue pas une transition.

L'état morphologique natif conserve un journal identifié. Sa restauration reconstruit les projections depuis les événements et les compare au checkpoint annoncé. Un même événement ne s'acquiert pas une seconde fois ; deux contenus contradictoires sous la même identité sont rejetés. Le journal ajoute un contrôle d'intégrité natif autour des champs métier source.

## Vérification et portée des preuves

La [preuve d'enregistrement](lot2a-evidence/ablation/registration-gap.json), produite par [prove-native-morphology-registration-gap.mjs](../../scripts/prove-native-morphology-registration-gap.mjs), instancie séparément les factories réelles de V60 et du moteur courant, puis lit leurs snapshots publics avant toute initialisation. Le groupe déclaré `morphology` passe d'une liste vide à son fournisseur homonyme ; les autres groupes et fournisseurs restent identiques. Les inventaires natifs avant/après sont comparés aux sources gelées, avec 237 fichiers dans la base et 239 dans cette étape. Cette preuve ne charge aucun jeu, ne demande aucune décision et n'acquiert aucune transition : elle établit le raccord manquant, sans attribuer à ce seul raccord une réussite de jeu.

Les cas source sont produits par [export-v6-morphology-measurements-reference.py](../../scripts/export-v6-morphology-measurements-reference.py), en important les originaux inchangés. Les entrées sont des rasters, leurs observations publiques, des transitions mesurées, les commandes disponibles et les états retenus concernés. Les résultats attendus ne sont pas injectés dans les entrées de production.

Les [tests des mesures](../../tests/v6-morphology-measurements.test.ts) comparent les faits, les plans et les décisions, en gardant le reçu natif de périmètre séparé de la projection source. La campagne intégrée et les reçus de validation sont suivis dans le dossier [lot2a-evidence](lot2a-evidence/). Une réussite d'un jeu déjà acquis démontre une non-régression ; l'attribution du progrès morphologique exige aussi une proposition consommant ces nouveaux producteurs et un retour révisant la suite.

La généralité se vérifie sur les relations conservées : changement de palette, déplacement géométrique d'une scène, changement des noms de commandes et variation des retours. La politique de production ne consulte ni le code d'un jeu, ni son nom, ni un numéro de niveau, ni une solution préparée.

### Comparaison des appels réellement exécutés sur LS20

Le [comparateur hors ligne](../../scripts/compare-native-morphology-public-evidence.py) a rejoué les appels effectivement capturés pendant la campagne LS20 à froid. Son [reçu complet](lot2a-evidence/ls20-cold/ls20-morphology-original-comparison.json.gz) est **réussi** : 291 appels morphologiques, dont 82 propositions ou abstentions, 65 acquisitions sélectionnées et 144 observations passives de départ. Les 13 propositions non nulles, les 69 abstentions, les 65 retours sélectionnés et les 82 checkpoints scellés correspondent à la source. Les acquisitions comprennent 12 événements sélectionnés et 4 départs de station. Les 1 786 fichiers Python originaux ont le même contenu avant et après cette vérification.

Les 145 paquets publics et les observations sont reconstruits indépendamment depuis le journal de transport. Les épisodes GoalAccess correspondent aux transitions publiques et à leurs vraies frontières. La jauge et la collecte partent elles aussi d'objets source vides : 678 appels du propriétaire partagé vérifient chaque contexte avant/après. Chaque référence utilisée par la morphologie doit désigner un contexte unique déjà vérifié. Le comparateur fournit une copie de ces objets source reconstruits à l'adaptateur original ; il n'invente aucune prévision et n'importe pas un état métier natif comme résultat attendu.

La comparaison inclut le condensat des faits mesurés et les champs source de décision pour les abstentions. Elle exclut explicitement les métadonnées propres aux reçus natifs et le transfert stratégique de `morph.last`. Le domaine original utilisé garde `station_method`, `entry_method` et `entry_access_return` à `None`. Il s'agit d'une parité au niveau du composant transféré, pas d'un rejeu du caller Python complet.

LS20 a effectivement terminé son premier niveau en 28 actions, puis atteint `GAME_OVER` au deuxième niveau après 144 actions au total. La nouvelle morphologie y a été sélectionnée et a acquis des effets ; cette campagne ne satisfait pas la cible de trois niveaux. L'[ablation bornée depuis V60](lot2a-evidence/ablation/v60-ls20-first-divergence.json) retrouve les 18 premières commandes publiques puis diverge à la 19e : V60 choisit `ACTION3` par `view`, contre `ACTION1` par la morphologie courante. Le test s'arrête avant de fournir le retour qui ne correspond plus à la commande V60. Il prouve une modification effective de décision, sans conclure à un échec complet de V60.

Les derniers refus du deuxième niveau ont une explication précise dans le domaine comparé : les motifs gardent un résidu d'orientation unique de `[1]`, seule une route `peer` est mesurée et aucune route `modifier` n'est liée. La règle source `projection.morph.missing_modifier_access` conserve donc `modifier_access_unbound`, pendant que la prévision de jauge passe de 4 à 0 actions. Ces faits et cette décision sont reproduits exactement par Python. Aucun écart du producteur courant ou de la politique n'a été détecté sur cette trajectoire. Cela explique l'abstention du composant ; cela ne démontre pas la cause complète de l'échec, ni qu'une branche 2B ou 2C encore absente aurait suffi à le résoudre.

### Résultat indépendant sur un autre jeu

La [campagne TR87 à froid](lot2a-evidence/tr87-cold/campaign-summary.json) atteint les trois premières frontières officielles en **22, 37 et 46 actions**, soit **105 actions**, dans une seule session conservée. Elle s'arrête au début du quatrième niveau avec le motif `target_levels_completed`. Les 105 actions proviennent de `word_interface` ; aucune proposition morphologique n'y a été sélectionnée. Ce résultat satisfait la cible pratique de trois niveaux avec le même moteur gelé, tandis que LS20 établit séparément l'usage réel des producteurs morphologiques.

## Limites qui restent explicites

Le fournisseur `morphology` est partiel au regard de l'ensemble V6. Cette étape ne crée pas l'état de décision `morph.last` utilisé par les fournisseurs suivants. Quand une autre famille est finalement retenue, ses acquisitions ne consomment pas encore les faits d'une décision morphologique précédente par ce contrat. `acquire_control_for_target` et `attention_parent_return` restent donc à traiter dans le lot 2B.

Les méthodes de station et d'entrée transférées entre époques, le calcul complet de capacité gérée qu'elles peuvent activer, `entry_rebind` et `entry_probe` ne sont pas annoncés complets. Les cycles locaux observés et les prévisions effectivement raccordées ici sont des producteurs courants ; ils ne constituent pas le transfert intégral de ces branches de continuation.

L'appel à `extend_target` réutilise une implémentation déjà transférée afin de conserver les priorités présentes dans la source. Il ne démontre pas que tous les producteurs historiques nécessaires à toutes ses dérivations existent. Le lot global 2 reste ouvert et le registre des 76 entrées garde un suivi distinct de ces fournisseurs communs.
