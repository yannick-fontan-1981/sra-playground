# Lot 10A : checklist des prédécesseurs préparés 4B et 7B

Revue du 2026-11-10 UTC, en lecture seule. Aucun merge, import d’historique,
test, build, capture, décompression ou calcul natif n’a été effectué. Ce
compte rendu est le seul fichier créé par cette revue ; aucun commit n’a été
fait. Les chemins et lignes ci-dessous désignent les versions effectivement
lues, pas un futur résultat de fusion.

## Versions effectivement examinées

| Périmètre | Checkout | Commit lu et statut |
| --- | --- | --- |
| 10A de comparaison | `/workspace/sites/sra-lot10a-20261110/.sites-checkout` | `88e0cc6f0bd90f7d70d58187742d9e0b6943edae`, point demandé. HEAD de lecture `dcc69e7855180a7978b48932fcc815306037e2d7` : aucun delta `src`, `tests` ou `scripts` par rapport à 88e0cc6. |
| 4B | `/workspace/sites/sra-lot4a-20261110/.sites-checkout` | `7d44dbff8ad70c4c34845c246c77cfecf4e451db`, préparé, native 0.54.0. Aucun changement non committé dans `src`, `tests`, l’audit d’entrées ou la transfer-map à la relecture. Documents finaux et preuves de publication encore en préparation. |
| 7B | `/workspace/sites/sra-lot7b-20261110/.sites-checkout` | `b2593ddd34e547bcf28962e135433a1ccdf39d5f`, arbre propre, préparé après intégration de la clôture Site85 ; attend encore la publication réelle 4B et sa version finale. |
| Prédécesseur publié commun | Présent dans les trois historiques | `a009e1f138bb18251d697f49647bacc615ee514f`, clôture Site85 de 5A, native 0.53.0. Point commun employé pour isoler les deltas de chaque lot. |

Les statuts de coordination relus étaient datés de 22:50:37 pour 4B et
22:52:13 pour 7B. 4B annonçait la préparation privée de la source avec le
verrou de publication détenu ; 7B attendait explicitement son commit publié.
**Aucune publication réelle de ces deux HEAD préparés n’est attestée par cette
revue.** Leurs futurs commits de publication et inventaires devront être
réconciliés avant toute fusion de livraison, gel ou mesure officielle 10A.

## 1. Préserver les ajouts fonctionnels 4B

- [ ] Ajouter les trois modules `src/logos-engine/v6-relative-arrangements.ts`,
  `v6-relative-arrangements-geometry.ts` et
  `v6-relative-arrangements-planner.ts`, ainsi que leur mapping et leurs
  preuves propres. 4B ne modifie pas `v6-knowledge-store.ts` ni `src/runtime`
  par rapport au prédécesseur commun ; ne pas réintroduire un ancien noyau de
  persistence en résolvant les conflits.
- [ ] Conserver `NativeFamily.sourceGroupStop` dans
  `src/logos-engine/v6-native-types.ts:140–142`, et sa transmission par
  `subquestionFamily` dans le runtime 4B à la ligne 1636.
- [ ] Conserver le cache `planning.sourceStops` et sa création par décision
  (`v6-native-runtime.ts:212,466`). `retainSourceGroupStop`, lignes 585–601,
  valide observation, epoch, frame, groupe, entrée et absence d’autorité de
  libération ; il mémorise également les réponses nulles.
- [ ] Dans la sélection normale, conserver le stop à la ligne 519 **après**
  le retour nul d’une famille active et le traitement du refus courant. Le
  `break` ferme seulement le groupe courant. Il ne doit devenir ni un retour
  global ni une proposition bloquante autorisant une action.
- [ ] Garder ensemble `sourceGroupAllowsEntry` (lignes 604–626) et ses deux
  appels : `preferCurrentRequiredService` ligne 740 et
  `preferAcquiredContinuation` ligne 811. Le second intervient après la
  corroboration de contribution Kernel. Les deux empêchent le regard en
  avant de franchir une barrière source antérieure ; les offres sont
  consultées paresseusement avec le cache d’entrées courant.
- [ ] Conserver `relativeArrangementFamily` (lignes 1701–1729), son owner
  unique `relative_arrangements`, son programme
  `v6.relative_arrangements.choose`, et son admission limitée à
  `window_constraints/relative_arrangement`. Le fournisseur reconnaît
  l’interface courante sans inventer une action lorsqu’aucune expérience
  admissible n’est proposée.
- [ ] Conserver l’événement sélectionné `relative_arrangement_event`
  (ligne 1211) et `retainFamilyState(..., 'relative_arrangement_state', ...)`
  (ligne 1235). Relative n’est pas ajouté à l’acquisition passive de retours
  étrangers : le wrapper enregistre son expérience sélectionnée une fois.

Les tests Relative déjà inclus dans le périmètre prévu couvrent directement
ces frontières : enregistrement et ordre du fournisseur aux lignes 152–167,
fermeture locale du groupe aux lignes 237–263, regard en avant de service aux
lignes 281–322, et continuation acquise corroborée aux lignes 326–444 de
`tests/v6-relative-arrangements-integration.test.ts` dans 7d44dbf.

## 2. Fusionner les propriétaires sans perdre Axial

- [ ] Réunir les imports, créations d’instances, tableaux `families`, mappings
  d’entrées et passerelles `acquisitionFamilies`. 4B ajoute Relative ; 7B
  ajoute `symbols`; 10A conserve `axial`. Chacun doit correspondre à son
  instance enregistrée unique. Ne pas utiliser l’ordre du tableau de factory
  comme substitut à l’ordre de sélection DRM.
- [ ] Conserver toutes les vérifications d’identité des propriétaires :
  Workshop déjà présent, Symbols dans le runtime 7B aux lignes 243–245,
  Axial dans celui de 10A aux lignes 243–245. La proximité de ces insertions
  est un conflit textuel possible, sans incompatibilité sémantique.
- [ ] Réunir les trois clés d’événements dans `singleEventKeys` :
  `relative_arrangements → relative_arrangement_event`,
  `public_symbol_transaction → symbol_transaction_event`,
  `public_axial_question → axial_question_event`.
- [ ] Préserver le cycle Axial déjà présent : acquisition étrangère limitée
  aux contrastes source admis, absence de double enregistrement sélectionné,
  et publication conditionnelle de `axial_question_state` avant Recolor.
  Ne pas perdre l’extension `current_epoch_axial_packet_attribution` ni la
  recherche paresseuse locale des méthodes du commit c6ef96b.
- [ ] Préserver le cycle Symbols de 7B : aucun enregistrement passif d’un
  retour étranger ; `observed_symbol_transactions_state` publié seulement
  pour son propriétaire sélectionné, après ReactiveContact et avant la
  publication de l’état Workshop (`v6-native-runtime.ts:1330–1338` dans
  b2593dd). L’enveloppe native complète reste distincte de ces faits source.
- [ ] Conserver les huit validations communes et les API de listes/deltas
  du noyau 5A publié. Aucun des deltas 4B/7B examinés ne remplace ce fichier
  partagé. La sélection et l’acquisition sont des ordres distincts : ne pas
  réordonner l’acquisition pour imiter la liste des questions DRM.

## 3. Ordre DRM et inventaires exhaustifs attendus

La déclaration épinglée reste inchangée :
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/strategy.drm`,
lignes 39–62 pour Window et 387–422 pour le matériel.

- [ ] Dans `windowProviders`, conserver `relative_arrangement: arrangements`,
  puis laisser `windowEntries` filtrer **dans l’ordre DRM**. À la construction
  des `entryPoints`, inclure `arrangements` aux côtés de `recall` et `framed`
  (`v6-native-runtime.ts:1820–1828,1867–1870` dans 4B). La sous-séquence
  complète est `coupled_prefix_reference`, `relative_arrangement`,
  `multiscale_constraints`, `recurrent_series`. L’entrée de multiscale est
  représentée par `null` dans `entryPoints`, mais son fournisseur reste
  présent. Le fournisseur symétrique final reste ajouté après le groupe.
- [ ] Dans les attentes filtrées sur les entrées nommées des tests radial,
  coupled-pair et learned-preparation, conserver exactement cette liste :

```text
occluded_catalogue_composition
queued_field_composition
product_panel_composition
labeled_sequence_composition
linked_packet_composition
trace_field_composition
cell_patch_composition
observed_occurrence_recall
observed_program_composition
typed_material_flow
radial_port_composition
observed_framed_analogy
field_service_composition
rooted_quota_composition
framed_window_composition
coupled_prefix_reference
relative_arrangement
recurrent_series
```

Les trois emplacements 4B sont
`tests/v6-radial-port-integration.test.ts:330–335`,
`tests/v6-coupled-pair-planning.test.ts:169–174` et
`tests/v6-learned-preparation-priority.test.ts:104–105`.
Le commit 7d44dbf corrige précisément coupled-pair ; cette correction ne doit
pas être perdue en reprenant une attente exhaustive plus ancienne.

- [ ] Dans le matériel, enregistrer ensemble
  `observed_symbol_transaction: symbols.id` et `axial_question: axial.id`,
  et conserver les deux dans la liste des entrées explicites. L’union prévue
  des entrées **nommées** est :

```text
reactive_contact_continuation
observed_ranked_workshop
observed_symbol_transaction
observed_inventory_composition
observed_framed_transfer
topological_recolor
axial_question
reactive_contact
ordered_reaction
```

Symbols reste après Workshop et avant Inventory. Axial reste après Recolor
et avant ReactiveContact. Conserver la correction de
`tests/v6-topological-recolor-kernel.test.ts:44–51` dans 10A : le successeur
immédiat enregistré de Recolor est désormais Axial. Les tests Kernel Axial
et Symbols comparent aussi l’ordre nommé au DRM.

- [ ] Réunir les trois alias et les prédicats d’entrée explicite dans
  `scripts/audit-v6-entry-points.ts` et dans le test radial :
  `relative_arrangement → relative_arrangements`,
  `observed_symbol_transaction → public_symbol_transaction`,
  `axial_question → public_axial_question`.
- [ ] Ne choisir aucun des trois totaux isolés « 58/76 ». Par lecture des
  branchements, 4B+10A prévoit `[[10,12],[21,21],[9,10],[19,33]]`, soit 59/76.
  Avec 7B, l’union prévoit `[[10,12],[21,21],[9,10],[20,33]]`, soit **60/76**.
  Ces nombres restent prévisionnels jusqu’à l’audit exécuté après la fusion
  réelle. `partialEntryPoints` vide, les six branches observées connectées
  et `fullV6Parity: false` restent des assertions distinctes.
- [ ] Réunir les ajouts de `migration/v6-transfer-map.json`, puis régénérer
  les inventaires courants `docs/migration/v6-entry-point-progress.json` et
  `docs/migration/v6-coverage.json` avec les contrôles réels. Ne pas attribuer
  à l’union les reçus figés d’un seul prédécesseur.

## 4. Modifications 7B postérieures au manifeste provisoire

Le commit `4b069b3df56750ccaa50541d2f3e4c908912ac1f`, daté de
22:50:07 UTC, est postérieur au manifeste 10A du point 88e0cc6. Il ne modifie
aucun runtime natif. Il ajoute notamment :

- La correction exhaustive Symbols du test radial : alias, exigence de son
  entrée explicite, groupe matériel 19/33 et total isolé 58/76. La résolution
  finale doit conserver ces assertions avec les ajouts 4B et Axial.
- Le témoin passif de restauration dans
  `tests/helpers/v6-live-game-campaign.ts` : liste `symbolRestoreCalls`,
  observation de l’appel réel à `restoreNative` et de son résultat, état de
  l’instance après le préfixe scellé, y compris terminal. L’observateur appelle
  l’original une fois avec ses arguments d’origine ; il ne crée pas une
  restauration ni une réponse. Il conserve le retour ou la promesse d’origine.
- Les liens correspondants dans
  `scripts/compare-symbol-transactions-public-parity.py` et le finaliseur
  propre 7B. Ces outils de preuves doivent rester cohérents avec le helper
  retenu, sans importer leurs résultats comme preuves Axial.

4B modifie aussi `tests/helpers/v6-live-game-campaign.ts` pour enregistrer
`relativeArrangementSourceCalls` et le témoin de propriétaire Relative.
Le tableau initial du rapport et les blocs d’observation proches sont des
zones de conflit prévisibles. Conserver les deux ajouts, leurs captures de
préfixe et les témoins existants ; ne pas remplacer tout le helper par celui
d’un seul lot.

Les tests géométrie/interface Symbols existaient déjà dans
`66c8b646f004bc48396ba16ce2866c9e7655ab6c` ; ils ne sont pas nouveaux dans
4b069b3. Ils étaient néanmoins omis des deux seuls tests Symbols du manifeste
provisoire 10A. Ils couvrent les nouveaux modules V5 géométriques et l’état
appris/restauré de l’interface : leur ajout au périmètre est pertinent.

## 5. Les 45 fichiers prévus pour la validation intégrée

31 fichiers du manifeste de base, puis 14 extras : six 5A, quatre 4B et quatre
7B. Il s’agit du périmètre prévu, pas d’un résultat d’exécution. Le manifeste
extra passe de 11 à 14 par les ajouts explicites **coupled-pair**, **symbol
geometry** et **symbol interface**. Le driver conserve l’ordre des manifestes
avec déduplication stable.

| N° | Fichier sous `tests/` | Origine du périmètre |
| --- | --- | --- |
| 1 | `v6-axial-question-reference.test.ts` | Base 10A |
| 2 | `v6-axial-question-kernel.test.ts` | Base 10A |
| 3 | `v6-native-runtime.test.ts` | Base 10A |
| 4 | `v6-native-family-registration.test.ts` | Base 10A |
| 5 | `v6-native-caller.test.ts` | Base 10A |
| 6 | `v6-caller-integration.test.ts` | Base 10A |
| 7 | `v6-source-entry-routing.test.ts` | Base 10A |
| 8 | `v6-radial-port-integration.test.ts` | Base 10A ; résolution des trois registres |
| 9 | `v6-native-authority.test.ts` | Base 10A |
| 10 | `v6-native-transition-domain.test.ts` | Base 10A |
| 11 | `v6-native-transition-domain-integration.test.ts` | Base 10A |
| 12 | `v6-native-observer.test.ts` | Base 10A |
| 13 | `v6-native-checkpoint-integration.test.ts` | Base 10A |
| 14 | `v6-native-state-graph.test.ts` | Base 10A |
| 15 | `v6-native-persistence.test.ts` | Base 10A |
| 16 | `v6-native-hydration-cache.test.ts` | Base 10A |
| 17 | `v6-native-copy.test.ts` | Base 10A |
| 18 | `v6-native-snapshot-identity.test.ts` | Base 10A |
| 19 | `v6-native-working-witness.test.ts` | Base 10A |
| 20 | `v6-knowledge-store.test.ts` | Base 10A |
| 21 | `v6-incremental-memory.test.ts` | Base 10A |
| 22 | `v6-src-program.test.ts` | Base 10A |
| 23 | `v6-drm-projector.test.ts` | Base 10A |
| 24 | `v6-select-reference.test.ts` | Base 10A |
| 25 | `v6-topological-recolor-reference.test.ts` | Base 10A |
| 26 | `v6-topological-recolor-kernel.test.ts` | Base 10A ; conserver le voisin Axial |
| 27 | `v6-ranked-workshop-reference.test.ts` | Base 10A |
| 28 | `v6-ranked-workshop-kernel.test.ts` | Base 10A |
| 29 | `v6-feedback-sequences-reference.test.ts` | Base 10A |
| 30 | `v6-feedback-sequences-integration.test.ts` | Base 10A |
| 31 | `v6-shared-series-native.test.ts` | Base 10A |
| 32 | `kernel-batch.test.ts` | Extra 5A |
| 33 | `v6-crossed-prefix-access.test.ts` | Extra 5A |
| 34 | `v6-frontier-native-snapshot.test.ts` | Extra 5A |
| 35 | `v6-native-mixed-path.test.ts` | Extra 5A |
| 36 | `v6-linked-temporal-preparation.test.ts` | Extra 5A |
| 37 | `v6-linked-temporal-reference.test.ts` | Extra 5A |
| 38 | `v6-learned-preparation-priority.test.ts` | Extra 4B ; attente Window corrigée |
| 39 | `v6-relative-arrangements-reference.test.ts` | Extra 4B |
| 40 | `v6-relative-arrangements-integration.test.ts` | Extra 4B ; trois chemins de barrière |
| 41 | `v6-coupled-pair-planning.test.ts` | Extra 4B ajouté ; correction 7d44dbf |
| 42 | `v6-symbol-transactions-reference.test.ts` | Extra 7B |
| 43 | `v6-symbol-transactions-kernel.test.ts` | Extra 7B |
| 44 | `v6-symbol-geometry-reference.test.ts` | Extra 7B ajouté |
| 45 | `v6-symbol-interface-reference.test.ts` | Extra 7B ajouté |

4B a retenu son propre périmètre de 108 fichiers ; cette checklist ne transpose
pas automatiquement cette union historique dans 10A. Les trois chemins
nouveaux de barrière sont couverts dans le fichier Relative intégré ci-dessus.
Si le commit réellement publié ajoute d’autres deltas de sélection ou de
persistence, il faudra réexaminer le périmètre avant le gel final.

## 6. Contrôles de clôture avant le gel 10A

- [ ] Attendre et conserver les preuves de publication réelles 4B puis 7B,
  vérifier leurs commits et inventaires, puis comparer leurs deltas finaux à
  cette revue préparatoire. Aucune version finale 7B ou 10A n’est déduite ici.
- [ ] Conserver les trois nouveaux modules Relative, les cinq modules Symbols
  (`v5-concentric-frames.ts`, `v5-symbolic-diagrams.ts`, `v6-symbol-interface.ts`,
  `v6-symbol-transactions-geometry.ts`, `v6-symbol-transactions.ts`), les trois
  modules Axial et leurs fixtures. La fixture Relative est transportée en
  parties ordonnées ; ses tests utilisent `readEvidenceSync` pour ce contrat.
- [ ] Exécuter ultérieurement le périmètre effectif déclaré et les cinq gates
  sur le même gel intégré ; vérifier les nombres recomputés par l’audit, le
  worker et les reçus. Les sept régressions publiques restent un contrôle
  distinct sur le helper fusionné, sans nouvelle partie de jeu ni remise à
  zéro du budget POLA.
- [ ] Préparer les coûts contre le baseline **réellement publié après 7B**.
  L’inventaire du contrat 10A doit constater seulement le nouvel owner
  `public_axial_question` et son programme `v6.axial_question.choose`.
  Utiliser Site85 comme baseline tout en ajoutant Relative et Symbols ferait
  apparaître trois nouveaux propriétaires et violerait cette précondition.
- [ ] Refaire captures, qualification, contrat, préflight, preuves finales et
  acquittement de calme sur cette paire réelle. Les preuves préparées des
  prédécesseurs et la présente checklist ne constituent pas une qualification
  des graphes ou coûts 10A.
