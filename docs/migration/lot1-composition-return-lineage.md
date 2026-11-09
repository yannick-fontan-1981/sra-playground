# Lot 1 : filiation des contrats de cible, question et retour

## Périmètre et point de départ

Cette note accompagne la [feuille de route](v6-delivery-roadmap.md). Son audit initial a été établi **avant modification du moteur** sur la publication 59, commit `f7b9a56af5488c8d4cebd5d912262a541f4fe403`. Il conserve la base historique V58 `b946570afa44714424e2a1d67de338c4a7bd6c12`. La note distingue désormais ce comportement initial de l'extension native livrée en version **`logos-engine.typescript.v6.native-migration/0.32.0`**, inventaire SHA-256 **`8a67b57947364dab988c7081e35eb6a923beee2305eb4b8a8a89c2fc86ebea57`**. **Statut : lot 1 livré, moteur `0.32.0`.**

Le chemin retenu est `typed_pose_dependency`, sous-branche de l'entrée déjà raccordée `typed_material_flow`. Le [rapport V50](v50-typed-material-and-returned-inquiries.md) et ses contrats montrent déjà mesures, expériences de pose, acquisition, restauration et continuation conditionnelle. Le lot 1 ajoute la conservation explicite de la requête parent et la consommation de son retour. Ces ajouts ne sont pas présentés comme un nouveau transfert des capacités matérielles déjà acquises.

La référence Python de comportement est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. La correspondance source actuelle demeure `partial_transfer` dans [v6-transfer-map.json](../../migration/v6-transfer-map.json). Les différences documentées d'identités numériques Python/JavaScript et de départage lexical restent applicables.

## Chaîne de production et de consommation existante

| Étape | Contrat ou source | Implémentation et consommateur natifs | Preuve disponible avant le lot 1 |
| --- | --- | --- | --- |
| Mesurer supports, marques, descendants, requêtes et contrôles | `typed_carrier_scene.py`, `typed_material_observations.py`, `typed_pose_observations.py` | [v6-typed-material-observation.ts](../../src/logos-engine/v6-typed-material-observation.ts), consommé par `TypedMaterialMemory` | [Contrats de référence](../../tests/v6-typed-material-reference.test.ts), [fixture indépendante](../../tests/fixtures/v6-typed-material-reference.json.gz) |
| Préférer une contribution actuellement prête, sinon examiner une pose | `TypedPoseAccess.flow_question`, `pose_question` et `common_typed_material_flow.py` | `flowQuestion`, `matchingPoseTargets`, `poseQuestion` dans [v6-typed-material-access.ts](../../src/logos-engine/v6-typed-material-access.ts) ; appel `typed_material_flow` dans [v6-shared-series.ts](../../src/logos-engine/v6-shared-series.ts) | [Intégration Kernel](../../tests/v6-typed-material-kernel.test.ts), [comparaison publique V50](native-campaigns-v50/life-original-component-comparison.json) |
| Choisir la famille à sa place déclarée | `morphology_policy/strategy.drm`, `v6.composition_strategy.choose` | [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts), entre `observed_program_composition` et `radial_port_composition` | [Audit d'entrées](v6-entry-point-progress.json), contrats Kernel |
| Lier la proposition au contexte et autoriser l'expérience | Enveloppe `OP18` de `common_typed_material_flow.py` ; contrats de composition et `prototype.laya_router.route` | [v6-target-binding.ts](../../src/logos-engine/v6-target-binding.ts), [v6-native-authority.ts](../../src/logos-engine/v6-native-authority.ts), [v6-composition-engine.ts](../../src/logos-engine/v6-composition-engine.ts) ; puis WHY/ACT du Kernel | Contrats communs de libération et tests matériels Kernel |
| Mesurer le retour réel et reconstruire la connaissance | Acquisitions Carrier → MaterialFlow → TypedPose ; `typed_pose_response`, modèles et portée | `TypedMaterialMemory.record` et ses réducteurs, acquis par le propriétaire partagé `public_occurrence_recall` | États et événements comparés aux originaux ; restauration atomique des contrats matériels |
| Réutiliser l'observation | `pose_context`, `pose_rule`, `flow_context`, `pose_models`, requêtes courantes | La décision `flowQuestion` suivante choisit une expérience de contrôle, un préfixe conditionnel ou une contribution courante | Cas positifs et refus existants, trajectoire LIFE historique |
| Conserver l'analyse commune après le préfixe | `OP29`, `OP30`, `OP31` et contrats de révision | `NativeCompositionAuthority.acquire` → `postAnalysis` → `NativeSrcBridge` ; état de preuve commun | Tests de l'autorité et du caller ; rapports de campagne |

Les noms Python de ce tableau désignent les fichiers sous `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/`, sauf le DRM indiqué. La sous-branche de pose est du calcul natif appelé par le workflow de stratégie ; elle n'est pas un workflow SRC distinct compilé à elle seule.

### Ce que la proposition conserve déjà

`material_pose_plan` contient l'époque, le score, la référence d'observation et le digest de l'image, l'occurrence concernée, le contrôle, le mode, l'option de requête, la règle conditionnelle éventuelle, les commandes, les marques attendues et le digest extérieur. Les preuves comprennent observation, occurrence, contrôle et modèle retenu. La proposition déclare une composition avec une question ouverte et une relation vers `G_official_completion`.

La sélection `select_role_for_unresolved_pose`, l'essai `probe_new_control_with_selected_role` et le préfixe `conditional_typed_pose_path` sont déjà distincts. Une rotation de comparaison ne prouve pas l'effet d'une commande. Le préfixe n'est construit qu'après une règle réellement observée et demeure interruptible sur divergence.

### Propriétaire de connaissance

L'état métier reste dans **`family_state:public_occurrence_recall`**, dont `TypedMaterialMemory` est une couche. Le journal partagé retient cinq sortes d'événements : `typed_carrier_response`, `typed_material_flow`, `typed_pose_scope`, `typed_pose_model`, `typed_pose_response`. `restoreOwned` reconstruit toutes les couches et vérifie leur digest commun ; une restauration du lot 1 doit préserver les acquis des autres couches.

Un reçu d'attention peut référencer cette connaissance et l'obligation du parent. Il ne doit pas devenir un deuxième modèle de pose, une deuxième source d'événements matériels ou un permis physique. L'acquisition source, les gardes courantes et la libération commune restent responsables de leurs contrats respectifs.

## Lacune reproduite et différence bornée

Le [reçu d'ablation](lot1-evidence/ablation/parent-scope-gap.json.gz) est produit par [prove-native-parent-scope-gap.mjs](../../scripts/prove-native-parent-scope-gap.mjs). Le script exige le commit V59 indiqué ci-dessus, un code natif propre et des empreintes de sources et d'entrées inchangées avant/après. Il démarre un `SharedSeriesConstraint` sans connaissance pose, puis acquiert **34 préfixes et 34 actions** depuis les paquets publics de référence. Les commandes attendues ne sont vérifiées qu'après la proposition calculée par le composant.

Le retour ajouté ensuite est **contrefactuel et étranger à une proposition matérielle sélectionnée**. Il déplace la requête dans une zone vide mesurée du raster. Sa commande est une copie de l'`ACTION6` du contrôle actuellement proposé, disponible et admis ; le script ne prétend pas que ce déplacement soit l'effet réel de cette commande. L'acquisition passive emploie une proposition sélectionnée vide et ne fabrique aucun événement de pose.

| Observation | Composant V59 immuable | Contrat séparé du module parent natif |
| --- | --- | --- |
| Contexte fourni | 34 préfixes publics acquis à froid | Les mêmes états acquis et le même retour contrefactuel |
| Réponse pose acquise après la transition étrangère | Aucune : compteur `1 → 1`, état matériel inchangé | Aucun réducteur métier supplémentaire |
| Requête suivie | Nouvelle occurrence portant le même descripteur ; identité différente | Identité du parent et requête d'origine conservées |
| Validation suivante | Garde admis, témoin acquis accepté, liaison `independent_current_contribution`, `retained_target: null` | Suspension `parent_request_changed_or_ambiguous` et revalidation refusée |
| Portée probante | Changement de requête admis par le composant sans retour pose nouveau | Refus explicite de remplacer le parent dans ce cas |

Cette comparaison ne constitue ni une exécution complète de l'appelant commun ni un résultat de jeu live. Elle isole la lacune initiale et la différence du contrat natif. Les campagnes communes et les mesures de coût font l'objet de preuves distinctes ; une trajectoire déjà réussie en V59 ne prouve pas que son succès dépend du nouvel état parent. Le [reçu de transport](lot1-evidence/ablation/parent-scope-gap-transport.json) lie la version gzip livrée aux octets du JSON original.

Les [ablations communes V59](lot1-evidence/ablation/README.md) précisent cette limite causale. Sur le retour contrôlé de 270°, le moteur initial choisit déjà deux actions de contrôle pour la même cible, sans parent explicite. Sur le retour de 180°, il s'arrête avec `frontier_unknown`, sans proposition suivante ; l'absence de cible suivante ne signifie pas qu'une autre cible a été choisie. Le contrat du nouveau parent ajoute la demande conservée, sa référence au retour et une suspension motivée. Le cas de déplacement de requête ci-dessus démontre séparément le refus d'une substitution que la baseline admettait.

## Extension native et consommation du retour

L'extension **`retained_typed_material_request_parent`** est implémentée dans [v6-typed-material-composition.ts](../../src/logos-engine/v6-typed-material-composition.ts). Elle dépasse les appels présents dans le chemin source original et reste nommée comme telle. Elle n'ajoute aucune entrée aux quatre listes DRM : le registre demeure à **50/76, 26 restantes**.

| Étape ajoutée | Producteur | Consommateur et effet |
| --- | --- | --- |
| Conserver le manque précis | `retainTypedMaterialParent` reçoit une proposition `select` dont le témoin de connaissance et la portée sont courants | `AttentionMemory.composition`, propriétaire `native:typed_material_flow`, retient requête, occurrence, contrôle, modèle et condition `selected_pose_matches_retained_request` |
| Acquérir l'effet une fois | Le propriétaire matériel existant acquiert la transition ; le runtime termine aussi les acquisitions passives prévues | `recordTypedMaterialParent` lit les événements déjà acquis, leur identité et la paire d'observations, sans appeler un autre réducteur |
| Conserver une liaison actuellement vérifiable | Le vrai retour `select` fournit les pixels extérieurs modifiés et son événement acquis | `selection_witness` lie ces valeurs au raster courant ; une marque effacée, un contexte perdu ou une preuve absente suspend la reprise |
| Réviser la condition du parent | Réponse pose observée, règle actuelle et comparaison à la requête retenue | Phase `needs_pose`, `ready_for_delivery` ou `suspended` ; une contradiction attestée ferme le parent `refuted` et laisse le contre-exemple chez le propriétaire |
| Construire la suite pour la même requête | `SharedSeries.proposeForRetainedComposition` appelle `nativeRetainedRequestQuestion` | La nouvelle proposition courante est contrainte au parent ; une autre requête actuellement compatible ne le remplace plus silencieusement |
| Consommer le retour dans la décision | `consumeTypedMaterialParent` vérifie occurrence, requête, portée, phase et preuve du retour | Reçu `native_composition_dependency` avec `consumed_return_ref`, `returned_event_ref` et décision `select`, `resume_pose` ou `deliver` |
| Revalider chaque primitive | `typedMaterialParentGuard`, puis gardes ordinaires de famille, de point et de conservation | Le parent n'est pas une autorisation ; la libération commune reste nécessaire, y compris dans un préfixe conditionnel |
| Fermer ou suspendre | Livraison attestée, réfutation, frontière ou perte de liaison | `achieved`, `refuted`, `boundary`, ou parent pendant en phase `suspended` ; un appel de consommation rencontrant une frontière rend un refus propre |

Le raccord du [runtime](../../src/logos-engine/v6-native-runtime.ts) restaure d'abord les propriétaires, puis revalide le parent avant la sélection. Il conserve l'ordre source des familles. Lorsqu'une question matérielle est sélectionnée pour un parent actif, la façade recalcule une proposition courante pour cette requête et ajoute une trace de coordination reliant proposition source et proposition contrainte. Les contrôles de conservation, de liaison et d'autorisation s'appliquent encore à cette proposition.

À la fermeture du préfixe, l'ordre existant Attention/View → famille sélectionnée et acquisitions passives → Goal/Point/Control → analyse → Frontier est conservé. La réconciliation du parent lit le résultat après l'acquisition matérielle et avant la suite commune. Les références de transition utilisent `reasoning:transition:<revision>` ; les événements matériels gardent leur digest `typed-material-event:<digest>`. La décision suivante vérifie ces références dans la connaissance du propriétaire restauré.

Le modèle de pose, les règles, les requêtes remplies et leurs contre-exemples restent dans `SharedSeries.material`. L'attention conserve l'obligation, les digests de liaison et le témoin public courant, sans recopier les journaux `flow_events` ou `pose_events`. Le canal de mouvement `item` reste indépendant. Hors parent matériel actif, le runtime ne demande pas une copie de l'état matériel pour cette extension.

## Les deux contrats d'attention

Les deux canaux existent déjà dans [v6-attention-memory.ts](../../src/logos-engine/v6-attention-memory.ts), transféré depuis `attention_memory.py`.

| Canal | Ouverture et portée | Retour | Limite pour le lot 1 |
| --- | --- | --- | --- |
| `item`, attention de mouvement | Question avec `expected_motion`, observation exacte, paire, commande et expérience ; parent d'alignement | Mesure des mouvements avec ancres indépendantes ; `matched`, `contradicted`, `unobserved`, puis retour consommable dans la même portée ; frontière, remplacement ou expiration sinon | Ne pas forger un mouvement attendu pour conserver une composition matérielle |
| `composition`, attention de composition | `retainComposition(owner, targetRef, question, evidence, observation, binding)` ; un propriétaire et une cible pendants dans l'époque | `returnComposition` admet `achieved`, `refuted`, `boundary` avec preuves ; aucune autorité physique | Réutiliser son contrat seulement si l'identité du parent, la condition ouverte et la consommation du retour sont établies par le chemin concerné |

À la base 59, les méthodes d'attention de composition ne sont pas appelées par `typed_pose_dependency`. En version native `0.32.0`, le raccord décrit ci-dessus réutilise `retainComposition` et `returnComposition` et ajoute `reviseComposition` pour réviser la liaison du parent sans changer son identité, son propriétaire, son époque ni son autorité. Le transfert source du comportement matériel et cette extension de coordination gardent des périmètres distincts.

## OP03, OP08, OP12 et OP26 : usages examinés, pas d'appel artificiel

Les 31 opérations ont une implémentation dans [v6-operations.ts](../../src/logos-engine/v6-operations.ts). Le [catalogue](../../src/logos-engine/v6/catalog.json) reprend leurs identités et références normatives. Le `catalog.py` original indique explicitement que ces identités appartiennent au prototype symbolique ; leurs `authority_refs` sont des clauses apparentées et ne prouvent pas l'implémentation intégrale de l'arbre.

| OP | Entrées requises et calcul | Producteur / appel / consommateur sur le chemin de pose à la base 59 | Décision et limites |
| --- | --- | --- | --- |
| `OP03` | Composition cible, `requires`, faits ; donne vrai, faux ou `unknown` pour chaque précondition | Pas d'appel sur ce chemin. Les propositions matérielles ont leurs faits et gardes propres ; elles ne produisent pas un graphe générique de `requires` destiné à cette OP | Ne pas interpréter un verdict vide comme la preuve que toute condition métier est satisfaite |
| `OP08` | Effets déclarés des compositions et exigences de la cible ; cherche les prédécesseurs compatibles | Pas de producteur de cet ensemble `effect`/`requires`, pas d'appel ni de consommation dans `typed_pose_dependency` | Une relation à `G_official_completion` ne constitue pas à elle seule une dépendance d'effet mesurée |
| `OP12` | `depends_on`, `requires` et faits ; parcourt au plus 64 compositions et relève les inconnues | Pas d'appel sur ce chemin ; le choix actuel dérive des requêtes, marques et contextes matériels | Préserver la borne et le statut `incomplete` lorsqu'il reste du travail ; une mesure absente n'est pas une impossibilité |
| `OP26` | Accès déclarés pour la cible avec `constraints_verified === true` | Pas de producteur `accesses` ni d'appel pour la pose. Les gardes exactes du plan et de chaque étape font leur travail propre | Ne pas relabelliser un plan plausible comme accès vérifié pour alimenter l'OP |

L'extension native gelée du lot 1 n'ajoute aucun appel à `OP03`, `OP08`, `OP12` ou `OP26`. Les conditions et les retours matériels sont consommés par les fonctions et propriétaires nommés ci-dessus. Les lignes du tableau restent un constat de non-utilisation sur ce chemin, sans simulation d'appels symboliques ni conclusion de code mort global.

## Autorisation et analyse réellement utilisées

| OP | Producteur réel | Appel et consommateur | Contribution et limites |
| --- | --- | --- | --- |
| `OP18` | `poseQuestion` produit une composition non observée avec question ouverte, faits, preuves et commandes liées au contexte | `NativeCompositionAuthority.release` construit l'état ; `CompositionEngine.src_apply` appelle l'OP ; `operationAdmission` vérifie que sa sortie sélectionne la référence prévue avant la libération | Contribution effective à l'autorisation commune de l'expérience. La requête symbolique ne remplace ni le garde de pose ni WHY/ACT |
| `OP28` | Sur les chemins concernés, bundle courant admis et actions non vides | Même autorité commune, qui exige la référence du bundle dans la sortie de l'OP | Disponible et utilisé ailleurs ; les enveloppes de `typed_pose_dependency` emploient `OP18` à la base 59 et en version native `0.32.0`, y compris pour leur préfixe de pose conditionnel |
| `OP29` | `postAnalysis` projette les attentes connues et les résultats réels du préfixe scellé | Bundle d'analyse via `NativeSrcBridge` ; résultat retenu dans l'analyse de l'autorité | Trace de confirmation/réfutation des attentes. Un effet inconnu ne devient pas confirmé. Le résultat n'est pas à lui seul le réducteur de connaissance matérielle |
| `OP30` | Mise à jour liée à la composition de réponse, à la révision courante et à une preuve publique | `postAnalysis`, puis `CompositionEngine.persist` écrit `knowledge:<composition>:<property>` | Conservation du relevé courant. Les modèles matériels sont révisés par leur propriétaire existant, pas automatiquement par cette OP descriptive |
| `OP31` | Nombre officiel de niveaux terminés et cible déclarée ; faisabilité conservée `unknown` | `postAnalysis` conserve le réexamen de l'objectif dans l'analyse commune | Rend lisible la progression officielle ; ne prouve pas une cause terminale visuelle ni toute la pertinence d'une sous-cible |

Le cycle matériel consommant le retour doit être démontré dans les réducteurs et la proposition suivante. La présence de trois reçus d'analyse après action ne suffit pas à démontrer cette causalité.

## Références de raisonnement conservées

Les liens suivants sont des correspondances normatives bornées, issues du catalogue, vers les étapes déjà vérifiées ou à prouver dans le lot. Ils ne déclarent pas les clauses complètes comme implémentées.

| Référence de l'arbre | Contrat apparenté | Chemin natif / preuve attendue |
| --- | --- | --- |
| `frontier.check.relational.operational.preconditions` | `OP03` | Mesures et conditions de reprise du parent ; usage d'OP03 seulement s'il est réellement raccordé |
| `frontier.constraints.backward_dependency_expansion` | `OP08` | Lien du manque précis à l'expérience ; pas de déclaration d'un moteur AND/OR complet |
| `frontier.keep.dependent.plans.blocked` | `OP12` | Suspension tant que la condition courante demeure inconnue ou réfutée |
| `continuation.require.all.intermediate.constraints.decidable` | `OP26`, gardes de préfixe | Revalidation courante et refus lorsque l'identité ou la préservation ne sont pas établies |
| `frontier.expose.relevant.unexplored.outgoing.edit` | `OP18`, politique `typed_material_flow` | Expérience réellement sélectionnée et libérée, avec effet encore hypothétique |
| `continuation.execute_observation_prefix` | `OP28`, contrat commun d'exécution | Exécution des seules actions autorisées ; distinction avec l'OP18 effectivement choisie par la pose |
| `continuation.compare.joint_state_and_event_sequence` | `OP29`, retour de pose | Retours différents, gardes de marques et d'extérieur, suspension sur divergence |
| `continuation.reconciliation.exact_before_after_cause` | `OP30`, événements matériels | Une acquisition par transition chez le propriétaire, contre-exemples conservés et décision suivante révisée |
| `continuation.why.goal_derivation_chain` | `OP31`, conservation du parent | Trace cible → manque → expérience → retour → suite, sans inventer un accomplissement officiel |

Le workflow commun de stratégie est `v6.composition_strategy.choose`. Le workflow de routage des bundles est `prototype.laya_router.route`. Le calcul matériel n'est pas transformé en workflow distinct par l'ajout d'une ligne documentaire. Le bundle reste à 37 workflows à l'ouverture du lot.

## Inventaires historiques et disponibilité locale

| Élément demandé | Disponibilité dans la base 59 | Utilisation bornée |
| --- | --- | --- |
| `dynamic_workflow_components.json` | Non présent dans les snapshots locaux inspectés | Référence demandée à récupérer ou réconcilier pour l'inventaire historique ; aucune lecture ni validation prétendue |
| `production_workflow_contracts.json` | Non présent dans les snapshots locaux inspectés | Même limite ; ne pas déduire des contrats absents à partir du nombre de workflows compilés |
| `conditional_reasoning_tree.src` | Disponible dans le [snapshot SRA `212d8d426f07`](../../reference/sra/212d8d426f07/agents/yf_arc3_v5/src/arc3/conditional_reasoning_tree.src) | Source documentaire historique V5, distincte du commit de comportement V6 épinglé |
| `reasoning_tree_v15_implementations.json` | Non présent dans les snapshots locaux inspectés | Son absence empêche de prétendre à un inventaire complet de ses correspondances, pas de livrer une boucle bornée |
| Arbre V1.5 et réconciliation | [Arbre épinglé](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/docs/reasoning-tree/reasoning-tree_v-1.5.txt), [réconciliation](../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/docs/reasoning-tree/reasoning-tree_v-1.5/reconciliation_v-1.5.json) | Identités normatives reprises par le catalogue ; empreintes conservées dans `catalog.json` |
| Mappings et bundle TypeScript | [Mapping de migration](../../migration/v6-transfer-map.json), [catalogue](../../src/logos-engine/v6/catalog.json), [programmes compilés](../../src/logos-engine/v6/programs.json) | Sources consommées, modules natifs, limites, tests et workflows effectivement compilés |

L'inventaire historique complet ne doit pas retarder la correction démontrée du lot 1. Les artefacts absents gardent cependant un statut explicite et ne sont pas remplacés silencieusement par un autre snapshot.

## Preuves finales et limites de la livraison

Les [241 tests ciblés dans huit fichiers](lot1-evidence/final/validation/delta-tests-run.json) sont passés sur le digest natif indiqué, sans modification du moteur ni des entrées pendant leur exécution. Ils couvrent les [contrats de boucle parent](../../tests/v6-composition-parent-loop.test.ts), références matérielles, Kernel, attention, caller, autorité, intégration et contrôleur. Les [contrôles du projet](lot1-evidence/final/validation/checks-run.json) confirment typecheck, audits d'entrées et de migration, diff et build. Ce résultat porte sur cette sélection de tests.

| Contrat | Preuve et résultat |
| --- | --- |
| Parent conservé et retour consommé | [Runtime commun froid](lot1-evidence/final/contracts/common-positive.json) : deux parents, 49 actions, trois niveaux, restauration depuis le graphe et références du retour dans les décisions suivantes |
| Retour différent | [Retour contrôlé de 270°](lot1-evidence/final/contracts/common-alternative.json) : règle acquise, parent inchangé et deux commandes supplémentaires ; ce retour est contrefactuel, pas un résultat de jeu live |
| Reprise empêchée | [Demande inaccessible](lot1-evidence/final/contracts/unreachable-parent.json) suspendue ; [contre-exemple](lot1-evidence/final/contracts/refuted-parent.json) conservé et parent réfuté ; tests négatifs sur preuves, identités, marquage de sélection et frontières |
| Intégration réelle | [Exécution LIFE](lot1-evidence/final/execution-life.json) : une session froide, 49 actions réparties 15/15/19 sur trois niveaux naturels, 47 préfixes, 49 acquisitions et deux reprises de frontière ; la [trace](lot1-evidence/final/life-public-trace.json.gz) finit au niveau 4 en `NOT_FINISHED` |
| Interface et interruption | [Contrôle navigateur](lot1-evidence/final/life-browser-verification.json) et [capture](lot1-evidence/final/life-browser.png) : même compte final 49/3/47, Pause initiale à zéro action, arrêt de lot à 46 actions, étape à 47, puis reprise jusqu'à 49 sans réinitialisation |
| Budget des chemins non concernés | [Comparaison des coûts](lot1-evidence/performance/comparison.json) : 16 métriques STCK/SMLP dans le budget observé de +10 %, hausse maximale +6,43 %, `unresolved: []` |

La campagne LIFE termine 231,44 secondes après la [sélection horodatée du cas](lot1-evidence/campaign-selection.json), avant sa limite de 40 minutes. Elle confirme l'intégration d'un jeu déjà réussi historiquement. La réussite du jeu, la différence du parent dans le diagnostic et la consommation des retours dans les contrats gardent leurs conclusions respectives.

### Bilan de coût qualifié

Les sessions médianes avant/après sont STCK **13,721 → 12,642 s**, SMLP **30,941 → 29,066 s** et LIFE **141,865 → 138,513 s**, sur trois sessions par cas. La [méthode de mesure](lot1-evidence/performance/README.md) conserve des entrées, un harness et un environnement comparables. Le verdict budgétaire concerne les deux chemins non modifiés ; le chemin LIFE modifié reste diagnostiqué séparément.

Sur LIFE, le garde de continuation passe de **13,64 à 30,49 ms**, soit **+123,52 %** sur six échantillons. Le service de continuation complet passe de **60,03 à 67,51 ms**, soit **+12,46 %**, également sur six échantillons. Les décisions de pose sélectionnées passent de **828,98 à 873,21 ms**, soit **+5,34 %** sur douze échantillons. La restauration des familles sur l'ensemble de LIFE passe de **8,78 à 10,76 ms** en médiane, soit **+22,56 %** sur 282 échantillons, avec une dispersion élevée entre répétitions après changement ; son p95 est **110,28 → 108,64 ms**. Ces hausses ne sont pas effacées par la diminution des temps de session.

Les échantillons d'une session sont corrélés et la dispersion des trois répétitions n'est pas un intervalle de confiance. Aucun p95 n'est calculé sous 20 échantillons ; les timings imbriqués ne sont pas additionnables. Le coût d'inspection isole service et transport, sans `BrowserV6Agent.inspectKnowledge()` ni rendu de l'inspecteur. La restauration isolée est celle des familles ; caller et autorité sont inclus dans la nouvelle décision. Pause distingue accusé de réception et fin sûre aux deux points initiaux mesurés ; le navigateur vérifie aussi la reprise d'un préfixe interrompu, sans garantie de préemption d'une recherche quelconque. Une session de 49 actions ne démontre pas une stabilité sur plusieurs heures.

**Le lot 1 est livré avec le moteur `0.32.0`.** La base de comparaison confirmée reste V59. Le prochain chantier **2A est éligible et prioritaire, mais non commencé**. **2B et 2C restent planifiés**, les trois fournisseurs communs restent incomplets, et le bilan conserve **50/76 entrées, 26 restantes et 37 workflows**. La migration globale n'est pas déclarée complète ; les résultats historiques gardent leur identité.
