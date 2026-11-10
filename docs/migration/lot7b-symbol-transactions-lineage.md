# Lot 7B — contrats et filiation des transactions symboliques

## État de cette correspondance

Le candidat intégré est **native 0.55.0**, après la publication réelle 4B
**Site 87**, commit `dd355400264b50942486559b8ca56ee6dfc6a3cc`, native **0.54.0**.
La [liaison au prédécesseur publié](lot7b-evidence/coordination/published-base-binding.json)
est conservée séparément du candidat. Le [gel natif](lot7b-evidence/integrated-final/source-manifest.json)
contient **291 fichiers**, digest
`ea25603262a7473e5ab9994d2e2e86dd64a8291dd7c1dc18ede4d1f443cdc53b` ;
l'[archive figée](lot7b-evidence/integrated-final/source-archive.json) contient
**302 fichiers**. Le commit de préparation avant mesure est `ab0829f`.
Les preuves fonctionnelles intégrées ci-dessous sont terminées. Les statuts de
coût et de publication sont consignés dans leurs blocs dédiés ci-dessous.

Le jalon de développement reste distinct : le portage part de **Site 83**,
commit `bed48116585da864dd5c412ed11dd6990a950e8e`, native **0.52.0**, qui clôt 7A.
Le [bilan du lot](lot7b-symbol-transactions.md) conserve les 275 tests de
composants, quatre tests Kernel et la première campagne CRAF. Les publications
5A/Sites 84–85 et 4B/Sites 86–87 ont ensuite été intégrées dans la branche
`lot7b-symbol-transactions-delivery`. Les résultats historiques gardent leur
périmètre et ne remplacent pas les reçus du gel 0.55.

Toutes les références Python, SRC et DRM ci-dessous proviennent du commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, conservé sous
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

<!-- LOT7B_LINEAGE_RESULTS_START -->
## Preuves intégrées terminées sur le gel 0.55

| Preuve | Résultat effectivement retenu | Reçu |
| --- | --- | --- |
| Périmètre formel | **4 327/4 327 tests**, **112 fichiers** dans l'ordre déclaré ; aucun échec, skip, todo ou annulation | [Tests](lot7b-evidence/integrated-final/validation/delta-tests-run.json) |
| Vérifications de livraison | **Cinq checks passés** : types, entrées, migration, diff et build ; sources natives inchangées | [Checks et worker](lot7b-evidence/integrated-final/validation/checks-run.json) |
| Régressions publiques héritées | **8/8 cas, 136/136 contrôles**, 309 actions, 227 préfixes et 24 frontières | [Régressions](lot7b-evidence/integrated-final/regressions/regression-summary.json) |
| LKEY partiel | **157/157 contrôles** de conservation ; campagne brute **`failed`**, **2/3 niveaux**, arrêt **`frontier_unknown`** | [Qualification partielle](lot7b-evidence/integrated-final/lkey-partial/qualification.json) |
| CRAF froid intégré | **Trois niveaux officiels, 36 actions**, avec le propriétaire Symbols sélectionné | [Exécution](lot7b-evidence/integrated-final/execution-craf.json) |
| Comparaison avec le Python original | **144/144 appels**, **432/432 comparaisons** d'état avant, retour et état après ; **1 786 sources** vérifiées avant/après | [Parité de composant](lot7b-evidence/integrated-final/original/craf-public-parity.json) |
| Persistance effectivement consommée | **36/36 préfixes et restaurations**, **252/252 contrôles** ; **72 appels `restoreNative` réellement observés**, trace ordonnée | [Preuve de checkpoint](lot7b-evidence/integrated-final/original/craf-public-parity.json) |
| Navigateur sur le build intégré | CRAF froid, **trois niveaux et 36 actions** ; Pause, incrément d'une action et reprise observés | [QA navigateur](lot7b-evidence/integrated-final/browser/browser-qa.json) |

Le Python original démarre avec un propriétaire froid et reconstruit son propre
état depuis les appels publics retenus : **aucun état natif n'y est injecté**.
La preuve de persistance lie l'enveloppe effectivement reçue par la restauration,
l'état après restauration et l'état vivant au préfixe à cet état reconstruit.
Elle inclut le dernier retour ; elle ne se limite pas à comparer deux exports
ou à déduire la restauration d'une décision suivante.

Les [ablations de contribution](lot7b-evidence/integrated-final/original/craf-contribution.json.gz)
suppriment **27 propositions** lorsque les méthodes acquises sont retirées, et
**18** lorsque la liaison courante est retirée. Les **quatre cas d'ablation du
compteur** gardent la même décision avec des preuves différentes : ils ne
démontrent pas un changement de choix dû au compteur. Ces contrôles établissent
la consommation de connaissances sur ce parcours, sans établir la parité de
sélection de l'appelant original entier.

Le [checkpoint final immuable du cas CRAF](lot7b-evidence/integrated-final/craf-case-checkpoint-final.json)
conserve **1 646,100543 secondes cumulées** et **753,899457 secondes restantes**
sur les 2 400 secondes du cas, sans remise à zéro. Ce cumul inclut développement,
diagnostics, comparaison affinée, campagne intégrée et QA navigateur. La latence
de Pause n'est pas mesurée. L'[intégrité de livraison](lot7b-evidence/integrated-final/delivery-integrity.json)
relie les sources, archives et preuves sans constituer une nouvelle campagne.
<!-- LOT7B_LINEAGE_RESULTS_END -->

## Contrat source → implémentation → consommateur → preuve

| Contrat source | Implémentation native | Consommateur effectif | Preuves de composant et intégrées |
| --- | --- | --- | --- |
| `symbol_transactions/family.py` : projection, repli conditionnel, règles ordonnées, regroupement par action, proposition et garde | `v6-symbol-transactions.ts` | Propriétaire unique `public_symbol_transaction` de l'entrée `observed_symbol_transaction` | Oracle Python du propriétaire, comparaison des propositions et refus complets, tests de boucle commune |
| `transactions.src` : `symbols.measure` puis `symbols.select` | `NativeSrcProgram` et callbacks du propriétaire | Programme commun `v6.symbol_transactions.choose` | Reçus réels du workflow, compteurs de callbacks et OP18 dans la sélection normale |
| `transactions.drm` : activation, conclusions successives, hypothèses et ordre des offres d'interface | Registre DRM scellé chargé depuis la source compilée existante | Les deux chemins du même propriétaire | Attentes produites par la source Python, alternatives identiques et ambiguïtés conservées |
| `symbol_transactions/geometry.py` : cadre d'emphase, faits et propriétaire du pixel | `v6-symbol-transactions-geometry.ts` | Projection initiale et garde avant action | Oracle de géométrie : coordonnées, signatures, doublons, bornes et refus |
| V5 `symbolic_diagrams.py` : lignes ordonnées, paire de cadres, transition et multiensembles | `v5-symbolic-diagrams.ts` | Géométrie et interface | Comparaisons des mesures complètes, opérandes répétés, sorties répétées et lignes dupliquées |
| V5 `concentric_frames.py` : mesures de cadres et contexte consommés avec `additions=()` | `v5-concentric-frames.ts` | Géométrie et interface | Oracle des mesures consommées ; le journal des ajouts de cadres non appelé par 7B reste hors de ce transfert |
| `symbol_transactions/interface.py` : scènes, contrastes, méthode conditionnelle, offres et réfutations | `v6-symbol-interface.ts` | Interface interne du propriétaire | Chaîne synthétique réellement acquise par `record`, frontière, restauration, revalidation et réfutation |
| `guarded_binding/geometry.py::revalidate_frame` | Helper existant `v6-inventory-measurements.ts` | Revalidation des cadres partiellement masqués et reçus d'interface | Contrats de visibilité, coins visibles et pixels masqués inconnus |
| `strategy.drm` : position dans `factored_material_return.ordered_subquestions` | Fabrique de `v6-native-runtime.ts`, ordre lu depuis la déclaration | Stratégie SRC commune | Test d'ordre des entrées et d'unicité de l'état propriétaire |
| `common_frontier_runtime.py` : retour sélectionné et fait `observed_symbol_transactions_state` | Acquisition commune après ReactiveContact et avant l'état Workshop | Préfixe scellé, mémoire WHY/ACT et graphe | Retour unique, absence d'acquisition étrangère, restauration depuis le graphe autoritaire |

Les noms TypeScript du tableau sont relatifs à `src/logos-engine/`. Les sources
`symbol_transactions/` sont relatives à `agents/yf_arc3_v6/morphology_policy/`.
Les oracles, tests et reçus de développement sont conservés. Leurs résultats
restent distincts des contrôles terminés sur les sources intégrées finales,
référencés ci-dessus.

## Deux chemins de proposition, une seule autorité

Le guide exige une ligne de diagramme à deux opérandes et exactement un cadre
blanc espacé. La projection distingue l'entité du cadre extérieur de l'entité
qui possède le pixel cliqué. Le blanc vient du paramètre source, valeur zéro.

L'interface est consultée seulement si la projection manque ou si son activation
échoue. Une projection activée qui aboutit à une ambiguïté ou à un refus reste
une abstention : ce cas ne déclenche pas un autre chemin d'interface.

Les règles sont appliquées dans l'ordre déclaré. Une règle ultérieure peut lire
et remplacer une conclusion d'une règle antérieure. Les offres sont regroupées
par l'action entière, données incluses. L'interface conserve toutes les lignes
affichées alternatives de cette action, dans leur ordre et avec leurs doublons.
Une action distincte concurrente empêche l'élection unique.

Le choix d'interface suit `receive_selected`, `load_selected`, `activate_loaded`,
`select_direct`, puis `select_operand`, avec les cinq critères de coût déclarés.
Les opérandes restent ordonnés dans les lignes et chargements ; les comparaisons
de multiplicité emploient un multiensemble là où la source l'exige. La présence
d'une valeur dans le stock ne prouve pas sa quantité exacte.

## Retour réel et portée des connaissances

Le marqueur `symbol_transaction_plan` lie l'action, les faits mesurés, le cadre,
sa signature, l'observation, l'époque, la progression officielle et l'image.
La garde remesure la situation et le point. La proposition garde
`expected_after=null` : l'action demande une observation, sans annoncer un effet
déjà établi. Le retour scelle le préfixe avant l'acquisition.

Le propriétaire enregistre uniquement le retour de sa proposition sélectionnée.
Le raccordement commun n'appelle jamais sa méthode `record` pour une action
étrangère. L'atelier conserve son acquisition passive propre ; cette différence
entre les propriétaires est testée avec le même retour public.

Les contrastes sélection, chargement, transformation et réception alimentent
l'interface. Une méthode n'est construite qu'à une frontière officielle après
présence de ces quatre effets. Elle reste une hypothèse conditionnelle : elle
doit retrouver les supports courants et peut être réfutée dans l'époque courante.
Une absence d'effet ajoute le rejet local de l'action exacte dans cette image.
Un changement visible conserve l'inconnue sur les rôles et ne confirme aucune loi universelle.

La source ajoute certains contrastes avant son contrôle de préservation des
autres demandes. Si ce contrôle échoue, la liste de contrastes acceptés renvoyée
est vide, mais les contrastes déjà ajoutés restent dans l'état. Le port conserve
cette séquence observable, sans la remplacer par un rollback implicite.

## Mémoire, restauration et adaptations natives

Le fait source possède cinq champs : `epoch`, `rejected`, `events`,
`transition_count`, `interface_state`. L'interface possède sa propre époque,
ses échantillons, contrastes, méthodes, réfutations et liaison courante.

À la frontière, le propriétaire remet à zéro les rejets et le compteur de
transitions de l'époque. L'interface vide ses échantillons, contrastes et liaison,
mais conserve les méthodes et réfutations historiques. Les bornes source sont
24 échantillons, 32 contrastes, 8 méthodes, 32 réfutations et 8 reçus superposés.
Les événements du propriétaire gardent les 32 derniers éléments. Les rejets
sont tronqués à 32 lors de l'export de l'état, conformément à la source.

L'enveloppe native `native.public_symbol_transaction.v1` valide atomiquement
l'état restauré et se distingue du fait source. Les caches recalculables et les
variables de sélection ne constituent pas une autorisation sauvegardée.
La prochaine décision remesure ses conditions et repasse les gardes communes.
Cette validation d'entrée native est une adaptation de persistance explicite,
pas une extension des connaissances apprises par Python.

## Attribution des preuves

Une chaîne synthétique compare des contrats et le passage réel dans le Kernel ;
elle ne devient pas une réussite de jeu. La sélection des cas en jeu examine
les observations publiques déjà conservées, avec une instance Python froide
par scène, sans moteur de jeu importé, sans état acquis fourni et sans action.
La première campagne de développement utilise le moteur opaque et les commandes
du runtime commun : trois niveaux officiels, 36 actions toutes sélectionnées par
Symbols, 36 retours enregistrés une seule fois. Le rejeu original reconstruit son
propre état et compare 144 appels. La campagne intégrée et sa preuve de
restauration effectivement observée sont des exécutions distinctes, décrites
dans les résultats 0.55 ci-dessus.

Les incidents de comparaison restent conservés : le
[premier échec du validateur affiné](lot7b-evidence/diagnostic/refined-parity-validator-failure.json)
et son [rejeu qualifié](lot7b-evidence/diagnostic/refined-parity-replay-summary.json)
ne sont ni effacés ni convertis en succès historiques. Le
[diagnostic des espaces du snapshot navigateur](lot7b-evidence/diagnostic/browser-raw-whitespace.json)
conserve quatre espaces finaux du texte AX brut ; il ne décrit pas un défaut
fonctionnel du moteur. La réussite du contrôle formel du diff est celle du reçu
exécuté avant la mise en index de ces preuves brutes.

<!-- LOT7B_LINEAGE_COST_FINAL_START -->
## Coût — critère global déclaré accepté

Le [protocole](lot7b-evidence/performance-integrated/protocol.md), sa
[déclaration](lot7b-evidence/performance-integrated/declaration.json) et le
[contrat structurel](lot7b-evidence/performance-integrated/owner-growth-contract.json)
ont été fixés avant la [fenêtre officielle **A1/B1/B2/A2**](lot7b-evidence/performance-integrated/window.json),
le **10 novembre 2026, de 23:32:46 à 23:41:23 UTC**, avec Site 87/native 0.54
comme baseline et le gel 0.55 comme candidat. La fenêtre et son intégrité finale
sont **`passed`**. La [clôture d'isolation](lot7b-evidence/performance-integrated/coordinated-isolation-completion.json)
est également `passed` : les cinq statuts des autres fils sont restés identiques
octet pour octet ; le [créneau a été libéré](lot7b-evidence/performance-integrated/performance-lock-completion.json)
à **23:41:23 UTC**.

La [revue arithmétique indépendante](lot7b-evidence/performance-integrated/owner-growth-review.json)
passe **3 927/3 927 contrôles** et accepte **2/2 jeux** selon le critère global
pré-déclaré : hausse de la médiane des sessions complètes **strictement inférieure
à 10 % pour chaque jeu**, sans compensation entre jeux. Les valeurs affichées
ci-dessous sont celles du [compte rendu terminal](lot7b-evidence/performance-integrated/results.md),
arrondies pour la lecture ; les valeurs intégrales du reçu déterminent le verdict.

| Jeu | Médiane baseline, ms | Médiane candidat, ms | Variation globale | Décision |
| --- | --- | --- | --- | --- |
| STCK | 10 885,500 | 10 643,030 | **−2,227459 %** | Accepté |
| SMLP | 16 007,482 | 16 123,439 | **+0,724394 %** | Accepté |

Les **32 sessions mesurées / 400 actions** sont toutes conservées ; seules les
**huit chauffes / 24 actions** prévues sont exclues. Aucune session mesurée ni
valeur extrême n'est retirée. Aucun outil, règle, durée ou seuil n'a été corrigé
après mesure, et le [reçu de rendu](lot7b-evidence/performance-integrated/results-render.json)
conserve `inputReceiptsUnchanged: true`.

Les [diagnostics agrégés](lot7b-evidence/performance-integrated/owner-growth-comparison.json)
sont **16/16 dans le seuil**, mais chaque cohorte reste à **15/16** avec ses
dépassements conservés : **STCK `known_prefix_guard` +13,614846 %** en cohorte 1
et **SMLP `new_decision` +15,024264 %** en cohorte 2. Les p95 agrégés SMLP gardent
aussi leurs hausses de **+16,264866 %** pour `known_prefix_service`,
**+12,644657 %** pour `known_prefix_guard` et **+13,016930 %** pour
`acquisition_and_persistence`. Ces diagnostics restent distincts du verdict global
et ne suffisent pas à attribuer causalement les variations à Symbols.

L'[agrégateur strict historique a réellement refusé les métadonnées de travail](lot7b-evidence/performance-integrated/aggregation-failure.json).
Ce refus reste conservé et n'est pas transformé en succès historique. La
consolidation qualifiée distincte compare les **432 écarts structurels** aux
formes exactes fixées avant mesure ; les autres champs restent stricts et les
signatures complètes restent identiques à l'intérieur de chaque version. Aucune
normalisation des données brutes ne remplace ce contrat.

La [qualification préalable](lot7b-evidence/performance-integrated/owner-structural-attribution.json)
a passé **64/64 contrôles**, sur **58 points** et **35 deltas attribués** :
27 états Symbols et huit installations. La
[revue indépendante préalable](lot7b-evidence/diagnostic/final-cost-qualification-independent-review.json)
a passé **44/44 contrôles**. L'inventaire conserve tous les propriétaires et
programmes antérieurs et ajoute seulement `public_symbol_transaction` et
`v6.symbol_transactions.choose`.

Les captures fonctionnelles STCK/SMLP préalables ne comportent **aucun record
Symbols** et aucun fragment supplémentaire. Elles qualifient les formes
structurelles retenues ; elles ne démontrent pas le coût de l'acquisition
Symbols active sur CRAF. Cette portée reste distincte de la preuve fonctionnelle
CRAF : **le coût de cette trajectoire Symbols active reste hors de la mesure**.
<!-- LOT7B_LINEAGE_COST_FINAL_END -->

<!-- LOT7B_LINEAGE_PUBLICATION_FINAL_START -->
## Publication — en attente de preuve terminale

Le candidat 7B n'est pas encore présenté comme publié. La référence actuellement
attestée reste **Site 87**, native **0.54.0**. Le commit final livré, la version
Site et son état terminal seront inscrits ici après conservation des reçus
effectifs de publication ; les preuves de coût terminées devront être liées au
même gel natif 0.55. Aucun numéro de publication futur n'est prédit.
<!-- LOT7B_LINEAGE_PUBLICATION_FINAL_END -->
