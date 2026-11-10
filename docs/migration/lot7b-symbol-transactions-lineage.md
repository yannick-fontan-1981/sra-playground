# Lot 7B — contrats et filiation des transactions symboliques

## État de cette correspondance

Le portage part de la publication **Site 83**, commit
`bed48116585da864dd5c412ed11dd6990a950e8e`, native **0.52.0**, qui clôt 7A.
Les changements 7B sont conservés dans la branche
`lot7b-symbol-transactions-delivery`. Le [bilan de développement](lot7b-symbol-transactions.md)
relie les 275 tests de composants, quatre tests Kernel et la campagne CRAF de
trois niveaux aux reçus exécutés. La publication 5A/Site 84 est intégrée ; sa
clôture Site 85 est vérifiée. La publication réelle de 4B sera intégrée avant
le gel final, ses nouvelles preuves et le contrôle de coût. Le numéro natif
final de 7B reste à attribuer après cette intégration ; 7B n'est pas encore publié.

Toutes les références Python, SRC et DRM ci-dessous proviennent du commit
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, conservé sous
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

## Contrat source → implémentation → consommateur → preuve

| Contrat source | Implémentation native | Consommateur effectif | Preuve de développement et contrôle final attendu |
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
ne remplacent pas les contrôles à exécuter sur les sources intégrées finales.

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
La première campagne utilise le moteur opaque et les commandes du runtime
commun : trois niveaux officiels, 36 actions toutes sélectionnées par Symbols,
36 retours enregistrés une seule fois. Le rejeu original reconstruit son propre
état et compare 144 appels ; les ablations des méthodes et liaisons montrent
leur consommation dans les propositions ultérieures. La capture intégrée finale
devra aussi lier chaque état persisté au résultat de sa restauration native
effectivement observée, y compris après le dernier retour.

Le coût suivra le protocole courant, déclaré avant sa mesure, depuis le dernier
prédécesseur réellement publié. Les 32 sessions mesurées seront conservées ; la
médiane complète doit augmenter de moins de 10 % pour chacun des deux jeux de
référence. Les phases et percentiles élevés resteront visibles. Les éventuelles
différences structurelles dues au nouveau propriétaire seront qualifiées sur
des captures fonctionnelles distinctes avant la fenêtre officielle.
