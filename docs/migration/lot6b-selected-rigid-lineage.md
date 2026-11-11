# Lot 6B : filiation et limites de SelectedRigid

<!-- LOT6B_SITE103_INTEGRATION_START -->
## Reprise après le signalement KLOT : publication et fusion

Le [constat courant du Site](lot6b-evidence/integration-site103-01/publication-observation.json)
confirme **Site 103 / native 0.62**, commit
`4afcbfe6a25bd3a88223be543e443bc53b9c8814`, déploiement
`appgdep_6af49db69234819195c9c093cb79a7da` réussi et accès propriétaire seul,
revérifiés le 11 novembre 2026 à **14:05:12 UTC−03 (17:05:12 UTC)**.
SelectedRigid est absent du registre publié et son entrée reste en attente.
Aucun sélecteur d’un autre moteur n’est présent dans l’interface observée pour
activer le candidat local. Ce constat établit un écart de publication.
**La session exacte de l’échec utilisateur n’a pas été reproduite ; aucune
causalité certaine n’est déduite de cette seule observation.**

Les trois niveaux KLOT, les 38 actions, les 30 préfixes et la relecture originale
sans différence restent les preuves du **gel historique sur Site 97 / native
0.60**, pas celles du nouveau code fusionné. Le publié 103 et cet ancien
candidat totalisent chacun 64/76 entrées, mais WindowQuestion est présent dans
le premier et SelectedRigid dans le second. **Le jalon d’intégration exacte de Site 103 atteint 65/76 (85,5 %), selon l’audit
exécuté et lié ci-dessous.**

La source publiée exacte 103 est désormais fusionnée et vérifiée. Le
raccordement de `currentExecution`, du cinquième argument des gardes et du
quota `remainingLevelActions` conserve le délai hôte plus strict après
conversion d’origine d’horloge. Ces preuves d’intégration restent distinctes
de la nouvelle preuve KLOT fa23, dont la relecture et les qualifications sont désormais closes.
La préparation de 5C reste provisoire ; 0.63 n’est pas encore publié.
Les onze rejeux et la QA navigateur Vite sont désormais clos sur le candidat.
La réconciliation du publié 0.63, le coût global et la publication 6B restent
ouverts.
### Validation de l’intégration exacte de Site 103

La fusion avec le publié 103 est maintenant vérifiée sur le
[gel de développement intégré](lot6b-evidence/integration-site103-01/development-freeze),
qui comprend **314 fichiers natifs**, digest
`2e710bd53c5e77d2215f2a6dcb0d2aa5f206debfd793f1b43f91a2c9746d66bd`.

| Contrôle exécuté | Résultat |
| --- | --- |
| [Trois fichiers ciblés](lot6b-evidence/integration-site103-01/targeted-attempt-01/execution.json) | **33/33 tests réussis**. |
| [Runtime commun](lot6b-evidence/integration-site103-01/checks-attempt-01/runtime-tests.json) | **9/9 tests réussis**, dont les rejeux archivés HANO, SYME et DNOI. |
| [Audit des entrées](lot6b-evidence/integration-site103-01/checks-attempt-01/entry-audit.json) | **65/76 entrées, 85,5 %**, désormais effectivement auditées. |
| [Audit de migration](lot6b-evidence/integration-site103-01/checks-attempt-01/migration-audit.json) | **202 composants vérifiés, 149 transferts partiels, 1 018 modules en attente ; `failures: []`**. |
| [TypeScript](lot6b-evidence/integration-site103-01/checks-attempt-01/typecheck.json) | Réussi. |

Les entrées surveillées de ces exécutions sont inchangées. Ces résultats
qualifient l’intégration exacte 103, y compris le raccordement courant de
l’horloge et des gardes ; ils ne réattribuent pas l’ancienne campagne KLOT à
ce nouveau gel. Ces reçus d’intégration 103 n’incluent pas de nouvelle
preuve KLOT, de navigateur ou de coût ; les preuves ultérieures du candidat
fa23 sont distinguées ci-dessous.

### Candidat provisoire fa23 : suite, build et structure vérifiés

La fusion du checkpoint 5C **non publié**
`805b30297dc1b715dbfd9f1197a9a8ba7b361b90` / digest `a33a5f88…` avec 6B
est réalisée. Le [manifeste du candidat provisoire](lot6b-evidence/provisional-063-01/frozen-candidate/source-manifest.json)
retient **322 fichiers natifs**, digest
`fa23bb76ca4a01b5cfaa72ec6d1d4b4fc2e8969762e966ada8225265fc546886`.
WindowQuestion, Binding et SelectedRigid sont raccordés dans ce candidat ;
cela ne constitue pas une publication 0.63 ou 0.64.

| Contrôle effectivement acquis sur le candidat ou ses entrées déclarées | Résultat et limite |
| --- | --- |
| [Audits préalables](lot6b-evidence/provisional-063-01/preflight-attempt-01/entry-audit.json) et [migration préalable](lot6b-evidence/provisional-063-01/preflight-attempt-01/migration-audit.json) | **66/76 entrées, 86,8 % ; 208 composants vérifiés, 147 transferts partiels, 1 014 modules en attente.** Zéro module entièrement vérifié ; les six portes de migration complète restent fausses. |
| [Suite de 142 fichiers, tentative 02 conservée](lot6b-evidence/provisional-063-01/frozen-candidate/test-attempt-02/summary.json) | **ÉCHEC TERMINAL historique : 5 404/5 405**, un échec, zéro annulation, ignoré ou TODO. Les quatre lots et leurs entrées restent conservés sous cette identité. |
| [Correction ciblée du contrat d’arrêt](lot6b-evidence/provisional-063-01/stop-contract-targeted-attempt01/execution.json) et [journal](lot6b-evidence/provisional-063-01/stop-contract-targeted-attempt01/execution.log.gz) | Correction **du test seulement**, vérifiée **11/11 en 17,150 s** ; natif fa23 inchangé. |
| [Suite complète, tentative 03](lot6b-evidence/provisional-063-01/frozen-candidate/test-attempt-03/summary.json) | **5 405/5 405 réussis sur les 142 fichiers déclarés**, avec **739 entrées src/tests identiques** entre les quatre groupes et encore actuelles lors de l’agrégation ; fa23/322 inchangé. Cette tentative réussie ne réécrit pas les échecs antérieurs. |
| [Cinq contrôles de livraison et lecture sémantique](lot6b-evidence/provisional-063-01/final-functional-01/delivery-checks-semantic-summary.json), [commande conservée](lot6b-evidence/provisional-063-01/final-functional-01/delivery-checks-command.json) et [détail des contrôles](lot6b-evidence/provisional-063-01/final-functional-01/validation/checks-run.json) | **TypeScript, audit des entrées, audit de migration, diff et build réussis**, en **32,243 s**. **2 991 enregistrements surveillés inchangés** ; 66/76 entrées et migration **208/147/1 014, `failures: []`**, sans parité V6 complète. |
| [Binding/common et original indépendant](lot6b-evidence/provisional-063-01/final-functional-01/summary-binding-original.json) | Les **sept tests Binding ont été rejoués** dans la suite de 142 fichiers, tentative 03. Les **huit scénarios, quatre exports et quatre revues originaux**, soit **6 818/6 818 contrôles**, restent les preuves conservées de la tentative 02, à entrées pertinentes inchangées, sans duplication. Ce total n’est pas exclusivement comportemental. |
| Rejeux déjà clos : [CATR](lot6b-evidence/provisional-063-01/final-functional-01/replay-cases/catr-051/regressions/regression-summary.json), [RSWP](lot6b-evidence/provisional-063-01/final-functional-01/replay-cases/rswp-051/regressions/regression-summary.json), [FOGW](lot6b-evidence/provisional-063-01/final-functional-01/replay-cases/fogw-051/regressions/regression-summary.json), [CONN](lot6b-evidence/provisional-063-01/final-functional-01/replay-cases/conn-050/regressions/regression-summary.json) | **17/17 contrôles par cas**, sans réexécution des quatre réussites. |
| [Nouvelle reprise VOIS](lot6b-evidence/provisional-063-01/final-functional-01/replay-released-baseline-01/cases/vois-051/oracle-execution-observation.json) | **17/17 réussis** avec le harnais 5C exact et **1 536 Mio** ; l’ancien dépassement mémoire reste un **échec conservé**, sans comparaison réussie réattribuée. |
| [Nouvelle capture froide KLOT fa23](lot6b-evidence/provisional-063-01/klot-fa23-01/capture-readback.json) et [commande facturée](lot6b-evidence/provisional-063-01/klot-fa23-01/capture-case-command.json) | **Départ froid à zéro niveau, cible trois, trois niveaux atteints en 38 actions**, arrêt `target_levels_completed`. Sources natives et code d’exécution inchangés. La [preuve intégrée complète](lot6b-evidence/provisional-063-01/klot-fa23-01/integrated-proof-summary.json) et son [exécution facturée](lot6b-evidence/provisional-063-01/klot-fa23-01/integrated-proof-summary-execution.json) ferment désormais la relecture originale, les ablations et les deux qualifications négatives. |

L’unique échec de la tentative 02 attendait l’ancien motif
`level_active_time_budget`. Le contrat 5C conserve cette interruption dans la
preuve du préfixe puis donne priorité au motif public
`native_acquisition_incomplete` lorsqu’une acquisition Binding bornée demeure
incomplète. La correction contrôle strictement cette distinction ; la nouvelle
suite complète est désormais réussie sans modification native. Tous les essais
antérieurs, dont les résultats incomplets, restent conservés.

Le build produit **`dist/assets/v6-agent-worker-Cpjjo6tG.js`, 6 927 288 octets**,
SHA-256 `a4f366ad2103b7413a111099827bfa2ba8cf0930b9c8f1e4ebb561aada7daa84`.
Le [watch de livraison 03](lot6b-evidence/provisional-063-01/final-functional-01/build-watch-attempt03.json)
conserve les 2 965 entrées d’attempt02 et ajoute 25 entrées nécessaires :
**2 990 fichiers / 224 563 341 octets**. Le [précontrôle conservé](lot6b-evidence/provisional-063-01/final-functional-01/build-watch-attempt03-preparation.json)
explicite la fermeture insuffisante d’attempt02 pour ce nouveau groupe :
carte de transfert, contenus des générateurs, HTML statique et assets publics.
Les anciens plans et watches restent inchangés.

La [reprise déclarée des sept cas](lot6b-evidence/provisional-063-01/final-functional-01/replay-released-baseline-01/execution-declaration.json)
utilise les lignes et pins d’origine, un cas à la fois et le harnais 5C exact
à 1 536 Mio. L’[agrégat terminal des onze cas](lot6b-evidence/provisional-063-01/final-functional-01/replay-released-baseline-01/eleven-case-summary.json)
confirme **11/11 rejeux, 187/187 contrôles et 390 actions**. Les **douze tentatives**
sont conservées : les onze réussites et l’ancien **OOM VOIS**, qui reste
un échec distinct. Aucun essai défavorable n’est effacé.

Pour le coût, les [captures fonctionnelles conservées](lot6b-evidence/provisional-063-01/functional-805b/execution-summary.json)
retiennent quatre formes et 31 actions par rôle, avec passage de 58 à 59
propriétaires, le seul propriétaire ajouté étant SelectedRigid. Le refus
initial de la différence `created` et le
[diagnostic 03 complet mais non qualifiant](lot6b-evidence/provisional-063-01/functional-805b/hypothetical-common-difference-inventory-attempt03-summary.json)
restent conservés. L’adaptation prospective est maintenant vérifiée par
[24 tests locaux réussis](lot6b-evidence/provisional-063-01/cost-time-attribution-01/unit-tests-counts-02.json).
La [qualification structurelle effective](lot6b-evidence/provisional-063-01/cost-time-attribution-01/qualification-result-summary-01.json)
passe sur **58 points / 64 contrôles / 168 records temporels**, soit 84 par rôle,
avec `failures: []` et les entrées inchangées.

L’exception porte uniquement sur le float64 de
`native_reasoning_trace /value/root/members/created/bits`, lié à l’horloge
`Date.now() / 1000`, à la fenêtre de son rôle et à sa stabilité par session/trace.
Les autres champs restent exacts ; `origin.source_digest` demeure une
attribution distincte. Les quatre lecteurs aval passent
[**204 tests — 51 scénarios × quatre consommateurs — et une compatibilité réelle 4/4**](lot6b-evidence/provisional-063-01/cost-time-attribution-01/downstream-01/validation-summary-01.json)
sur l’attribution, la fixture et les reçus 805b/fa23. Il s’agit de leurs
validateurs locaux : **aucun parcours CLI complet aval, contrat finalisé,
précontrôle final ni mesure officielle de coût n’est revendiqué**.
L’exhaustivité du parcours des graphes, les autres corps, les origines,
les chaînes et les tickets restent liés au qualificatif et à ses empreintes ;
aucune formule de nombre de traces ni normalisation générale n’est introduite.

La **nouvelle capture froide KLOT fa23 est réussie**, avec une durée de driver
de **103,245 s** et une commande encadrée de **103,664 s**. Son rapport conservé
compte **11 699 122 octets**, SHA-256
`dd24c51f21bbd382f57056076da7c6af7724d4c4183f458170a77e2dfec8563d`.
Les trois niveaux historiques sur Site 97 gardent leur identité propre.
La [preuve intégrée KLOT](lot6b-evidence/provisional-063-01/klot-fa23-01/integrated-proof-summary.json),
consolidée dans son [intervalle facturé](lot6b-evidence/provisional-063-01/klot-fa23-01/integrated-proof-summary-execution.json),
est désormais **entièrement close sur fa23** : **30 préfixes**, **408 événements
originaux dont 340 racines**, **zéro différence**, **35 acquisitions et trois
retours de frontière `null`**, **98 restaurations — 60 natives et 38 source**.
Les **204 ablations** comprennent **63 effets**, **198 résultats non vides**
et **zéro erreur**. Le pin original
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` est inchangé sur **1 786 fichiers**.

Les **deux copies corrompues** sont d’abord acceptées structurellement puis
rejetées sémantiquement, avec respectivement **14 et 1 118 différences**.
Aucune interruption ne vaut rejet réussi et la référence positive n’a pas
été réexécutée. Cette clôture est propre à la capture fa23 ; elle ne modifie
pas l’identité ni la portée des reçus historiques Site 97.

### QA navigateur KLOT : parcours observé et fermeture vérifiée

La [QA navigateur 02](lot6b-evidence/provisional-063-01/klot-fa23-01/browser-qa-02/browser-functional-summary.json)
est **réellement réussie par observation CUA**, dans un nouvel onglet 7,
en départ froid au niveau 1. Elle utilise **Vite et son worker TypeScript de
développement**. Le bundle de production `dist` possède sa preuve de build
distincte ; ce parcours UI ne prétend pas avoir testé ce bundle.

Pause a été demandée pendant **Preparing agent**. Le message d’arrêt à la
frontière d’action a été suivi de **Paused, zéro action**. Les deux observations
à **20:14:54.732 UTC** et **20:15:11.006 UTC** confirment encore zéro action.
**Run to next level** a ensuite repris réellement le parcours :

| Point observé | Actions cumulées | Niveaux terminés | Plans affichés |
| --- | ---: | ---: | ---: |
| Fin du niveau 1 | 12 | 1 | 10 |
| Fin du niveau 2 | 24 | 2 | 18 |
| Fin de la cible de trois niveaux | 38 | 3 | 30 |

L’URL finale porte **`level=4`**. La
[capture d’écran réelle des trois niveaux terminés](lot6b-evidence/provisional-063-01/klot-fa23-01/browser-qa-02/cua-evidence/three-levels-completed.png)
est conservée. Cette vérification établit Pause avant le prochain envoi et
la reprise observée ; elle ne revendique aucune préemption de la recherche
interne déjà commencée dans le worker.

La fermeture est effectivement vérifiée : le premier inventaire conservait
encore l’onglet 7, le second constate son absence. Le preview a reçu son arrêt
et son état est **`stopped`** ; le superviseur **98145** est terminal avec
**exit 0**, et son groupe est récolté sans orphelin. La
[relecture finale facturée](lot6b-evidence/provisional-063-01/klot-fa23-01/browser-qa-02/root-final-review.json)
contrôle le lease réel : **`reaped: true`**, aucun signal et aucune erreur.
Le helper atteste cette exécution et cette fermeture ; le succès UI repose
sur les observations CUA, pas sur une assertion du helper.
Les **3 009 entrées surveillées restent inchangées**.

La **cible de 360 secondes a été dépassée** : **418,633882138 s** pour le wrapper
et **418,475255 s** jusqu’à la fermeture opérateur, sous son seuil de 480 s.
La borne externe de **600 s** est respectée. Les interactions et le temps de
compaction sont inclus dans le débit ; aucune correction de temps n’est
soustraite.

**QA01 reste un échec technique conservé de 60,152 s** : le CLI avait annoncé
une URL prête puis restait vivant, alors que le helper attendait à tort la
fin de sa commande. Aucune page n’avait été ouverte ; ce reçu ne décrit pas
un échec du jeu.

Après QA02 et sa **lecture finale facturée, vers 20:32 UTC le 11 novembre 2026**,
l’horloge est **inactive**, à **1 221,0363642830062 secondes cumulées sur 2 400**,
avec **1 178,9636357169938 secondes restantes**. Ce total remplace le point
intermédiaire de 20:19:50 et comprend la clôture effective du navigateur.
Le parcours final des outils de coût, la mesure officielle, la publication
effective 0.63 et sa réconciliation, puis la publication 0.64 restent ouverts.

Le [checkpoint de preuves effectivement poussé et vérifié](lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/core-checkpoint-summary.json)
est désormais **`17d6c1aa3532e4ff74a98a309e4dfb9c3bc4fb59`**, sur la branche
`lot6b-selected-rigid-checkpoint-20261111`, confirmé le **11 novembre 2026 à
20:51:49.609783 UTC**. Les **sept lots de transport sont tous poussés et
vérifiés** : **356 fichiers, 154 054 085 octets**, avec le natif
**fa23 / 322 fichiers inchangé**. Il s’agit d’une sauvegarde de source privée,
sans publication de Site.

**Les compléments QA02, l’horloge, les trois documents et les métadonnées de
clôture ne sont pas encore revendiqués comme inclus dans 17d6c1aa** : leur
petit commit complémentaire reste à terminer. `a01e6faf330d82fa220feac0c9ad4632bb75a9de`,
vérifié à 18:34:56 UTC, devient un jalon historique, comme le
[checkpoint 17bba57a](lot6b-evidence/provisional-063-01/source-checkpoint-17bba57a.json).
Le jalon antérieur 103 + 6B, **33 + 9 tests et 65/76 entrées**, conserve son
identité `7696e0c…` / `2e710bd…`.

La publication effective **5C / 0.63** demeure requise et doit être réconciliée
avec les entrées de `805b3029`. Une identité démontrée des entrées pertinentes
permettra de conserver les preuves correspondantes ; une différence exigera
la qualification des contrôles affectés. **Aucun pourcentage de coût 6B ni
publication 0.64 n’est acquis.**
La [publication effectivement revérifiée](lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/publication-observation.json)
à **20:34:24.999 UTC le 11 novembre 2026** reste **Site 103**, commit
`4afcbfe6a25bd3a88223be543e443bc53b9c8814` / **native 0.62**, en accès
propriétaire seul. **Ni 0.63 ni 0.64 ne sont publiées.** Ce constat actualisé
reste distinct du parcours local Vite qualifié.

Le créneau de coordination **`lot5c-cost-a33a5f88-recovery-02`** a été
explicitement libéré le **11 novembre 2026 à 20:30:25.610691 UTC** :
`quiet_requested: false`, `quiet_released: true`, motif déclaré
`failed_or_expired` et `performance_started: false`. Aucune mesure officielle
5C n’a démarré dans ce créneau. Cette issue ne précise pas sa cause et
n’entraîne pas de nouvel essai automatique ; elle ne clôt ni 0.63 ni le coût 6B.
L’ordre demeure **5C 0.63 → 6B 0.64 → 8A 0.65 → 10C**.

<!-- LOT6B_SITE103_INTEGRATION_END -->

## Provenance et portée

Le transfert utilise la source immuable V6/V5
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les preuves de composant
mentionnées ici sont les nouvelles exécutions de 6B, conservées sous
[lot6b-evidence](lot6b-evidence). Une campagne froide de développement atteint
trois niveaux KLOT et sa relecture Python est passée sans différence. Ces
preuves ne constituent pas une publication de native 0.64, une victoire complète
du jeu ou la parité de tout l’appelant V6.
L'état de livraison est décrit dans le [rapport 6B](lot6b-selected-rigid.md).

L'[export original, tentative 04](lot6b-evidence/oracle/attempt-04/export-execution.json)
vérifie les **1 786 fichiers** du pin avant et après son exécution. Les
**725 fichiers importés ou explicitement consommés** sont également enregistrés.
Ces nombres décrivent la provenance ; ils ne signifient pas que chaque branche
de ces fichiers a été exercée. L'export déclare l'absence d'exécution de jeu,
de lecture de niveau privé et d'import du module natif.

Le [comparateur indépendant](lot6b-evidence/oracle/attempt-04/native-comparison.json)
retient **3 593 contrôles réussis**, répartis entre **1 082 contrôles de
comportement** et **2 511 contrôles de provenance de fichiers**. Les états et
plans TypeScript ne servent pas à produire les attentes de l'oracle.

## Source → TypeScript → consommateur → preuve

Les chemins Python ci-dessous sont relatifs à
`reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/`.

| Source originale et contrat consommé | Transfert TypeScript | Consommateur réel | Preuve disponible ou qualification restante |
| --- | --- | --- | --- |
| `agents/yf_arc3_v6/morphology_policy/selected_rigid/base.py` : base neutre, abstention et retour vide | `v6-selected-rigid.ts` ; absence d'héritage d'un autre fournisseur | `NativeSelectedRigid.propose`, gardes et acquisition | Oracle de composant, cas d'abstention et retours étrangers. |
| `selected_rigid/mechanism.py` : `scene`, `point`, `input_candidates`, `poses` | [v6-selected-rigid-geometry.ts](../../src/logos-engine/v6-selected-rigid-geometry.ts) | Mesure avant proposition et nouvelle mesure dans les gardes/retours | Oracle 04 : huit scènes, douze points, quatre domaines d'entrée et quatre populations de poses. |
| `selected_rigid/mechanism.py` : `moved`, masques complets et réceptacle conditionnel | `selectedRigidMoved` dans le module géométrique | Recherche, comparaison des issues d'une sonde, élimination des modèles sur retour | Oracle 04 : 51 déplacements ; les cas synthétiques sont déclarés dans l'exporteur. |
| `selected_rigid/mechanism.py` : `route`, coûts et ordre A* | [v6-selected-rigid-search.ts](../../src/logos-engine/v6-selected-rigid-search.ts) | `NativeSelectedRigid.proposeCurrent` | Oracle 04 : quatorze routes ; tests natifs de bornes et interruption. Les horloges synthétiques ne mesurent pas la performance. |
| `selected_rigid/mechanism.py` : 24 modèles, proposition, préfixe mixte, gardes et apprentissage | [v6-selected-rigid.ts](../../src/logos-engine/v6-selected-rigid.ts) et [types](../../src/logos-engine/v6-selected-rigid-types.ts) | Propriétaire unique `NativeSelectedRigid` | Oracle 04 : propositions complètes, événements, quinze gardes avant, vingt gardes après et deux liaisons. Campagne KLOT de développement : 35 événements acquis, quatre changements de contrôle et 63 ablations modifiant une action ou un refus. |
| `agents/yf_arc3_v6/morphology_policy/selected_rigid/family.py` : signatures courantes, plafond 16, disponibilité, point public, état et restauration | `NativeSelectedRigid` puis `selectedRigidFamily` | [v6-native-runtime.ts](../../src/logos-engine/v6-native-runtime.ts), fabrique et autorisation | Dix tests d’intégration réussis en tentative 02, puis 30 propositions et 38 retours relus indépendamment dans KLOT de développement ; les échecs précédents restent conservés. |
| `agents/yf_arc3_v6/morphology_policy/strategy.py`, `strategy.drm` et `laya_proto/common_frontier.py` : sous-question, refus bloquant, acquisition et ordre des checkpoints | `selectedRigidFamily`, `createNativeV6Runtime`, autorisation et acquisition communes | Sous-question exacte `goal_access/selected_rigid` ; même instance dans l'adaptateur et le stock d'acquisition | Test de fabrique, cinq motifs bloquants, cycle WHY/ACT et retour étranger avec restauration SelectedRigid avant PreviewPacking. La parité de tout l'appelant original n'est pas revendiquée. |
| `agents/yf_arc3_v6/laya_proto/geometric_observer.py`, `neutral_observer.py` et `observed_input_domain.py` | Mesure et domaine communs de [v6-native-observer.ts](../../src/logos-engine/v6-native-observer.ts) | Entités, masques et gardes publiques des points | Observations synthétiques et 39 observations uniques de KLOT reconstruites indépendamment par le lecteur froid. |
| `agents/yf_arc3_v6/laya_proto/src_bridge.py` : `plain` ; `terminal_composition.py` : identité | Reconstruction locale sans conservation d'alias ; [v6-hash.ts](../../src/logos-engine/v6-hash.ts) | Identités des plans/poses/rasters et projection d'état | Oracle 04 compare les résultats complets, pas seulement leurs identités. |
| `agents/yf_arc3_v5/capabilities/identity_scoped_support_d.py` : seul `_rotated(offset, 0)` | Conservation inchangée des offsets dans `selectedRigidMoved` | Masques de collision de la recherche | Les déplacements comparés consomment cette branche V5. Aucune autre rotation, loi de chargement ou capacité complète de ce fichier n'est revendiquée. |

Les trois modules SelectedRigid directs peuvent être qualifiés
`component_verified` dans la carte de transfert avec leurs preuves.
Cette catégorie ne vaut pas `verified` pour toute la migration. Les
bibliothèques déjà partagées gardent leurs mappings propres, sans deuxième
attribution du même fichier Python.

## Géométrie et hypothèses

Les cellules sont exprimées en `[x, y]`. Le masque conserve les concavités ;
il n'est pas remplacé par le rectangle englobant. Les corps suivent l'ordre
numérique de leur couleur observée, utilisée comme clé locale et non comme
rôle fixé à une palette particulière. Le départage de la couleur majoritaire
suit la première occurrence en cas d'égalité finale, comme `Counter`.

Une seule géométrie et un seul réceptacle homologue doivent être mesurés.
Plusieurs candidats restent ambigus, même s'ils semblent identiques après une
éventuelle normalisation. Le point de sélection est le centre d'une cellule
réellement occupée et doit appartenir à une seule entité publique actuelle.
Cette condition et le refus d'une action indisponible sont déjà présents dans
`family.py` ; ce ne sont pas des ajouts d'autorité du port.

La scène acquise est produite par un parcours des cellules intérieures du
plateau. Les poses de recherche peuvent prévoir la sortie du corps cible vers
les cellules du réceptacle ; elles restent distinctes de cette scène mesurée.
La validation d'un checkpoint impose que ses corps mesurés restent à l'intérieur.
Cette restriction ne contredit donc pas, à elle seule, l'extension conditionnelle
utilisée pendant la recherche.

## Contrôles, propriétaire et état

Les quatre commandes cardinales commencent avec les 24 permutations possibles.
La proposition d'un clic conserve une hypothèse de récepteur. Un déplacement
observé discriminant peut établir le rôle ; une immobilité peut conserver
plusieurs modèles. Le filtre compare les populations de poses effectivement
observées aux déplacements de chacun des modèles encore compatibles. Un
ensemble vide ne réinitialise pas les hypothèses.

L'état source contient exclusivement `format` et `events`. Chaque événement
`observed_selected_rigid` contient l'état, les modèles et le détail du retour.
La restauration native valide toute l'enveloppe avant d'installer le dernier
état et les derniers modèles. Elle ajoute une enveloppe `schema` pour le
checkpoint natif, sans ajouter les budgets transitoires à l'état source.

Un retour étranger n'appelle pas l'acquisition de ce propriétaire. En revanche,
un journal déjà acquis provoque l'écriture du checkpoint source et sa
restauration après chaque transition, avant PreviewPacking. Un retour
sélectionné sans événement doit conserver le fait présent de valeur `null`.
Le contrôle de présence synthétique vérifie explicitement cette distinction.

PreviewPacking peut compléter son cache de mesure pendant une proposition.
Pour démontrer la conservation après un retour étranger, le test doit comparer
l'état réellement présent juste avant ce retour, puis vérifier son checkpoint
et l'ordre des restaurations. Le correctif de cette attente est couvert par
la [tentative d'intégration 02](lot6b-evidence/integration/attempt-02/execution.json),
**10/10 réussis**, avec les entrées de cette exécution inchangées. Les passages
précédents à **21/22** et **53/54** restent des échecs conservés.

## Recherche et limites natives

L'ordre des directions est haut, bas, gauche, droite. Le tas ordonne
l'estimation, le coût réel puis le numéro d'insertion. Une entrée périmée est
ignorée avant l'incrément du compteur de nœuds. Le coût d'un déplacement vaut
un, augmenté d'un si la sélection change. Ces choix peuvent changer la
première action et sont comparés aux sorties de la source.

Les limites source sont **150 000 nœuds** et **18 secondes**, avec un délai
plafonné par le temps actif restant du niveau. Les limites natives ajoutées
sont **250 000 états retenus** et **250 000 entrées dans la file**. Leur atteinte
produit un motif explicite et un inconnu bloquant, sans préfixe partiel.
Les contrôles coopératifs ont un intervalle de **256 opérations de travail**,
distinct du compteur source des nœuds développés.

Le délai de recherche est contrôlé à la frontière de la boucle source. Le
signal d'arrêt et le délai du niveau sont vérifiés dans le travail coopératif.
Une expansion ou une reconstruction déjà commencée peut se prolonger jusqu'au
prochain contrôle applicable. Ni une latence maximale de Pause ni un retour
garanti à exactement 18 secondes ne sont déduits de ces seules bornes.
Le caller contrôle l’exécution à l’entrée de `authorize` puis après les
gardes `before` et `pointGuard`, avant son appel asynchrone à `release`.
Le test synthétique de pause/reprise vérifie la séparation du temps inactif et
du temps actif, sans constituer une mesure navigateur. **Pause dans le
navigateur empêche les prochains envois physiques, mais ne transmet pas de
signal d’annulation à la recherche déjà lancée dans le worker.** Aucune
préemption de cette recherche par le bouton Pause n’est donc revendiquée.

Le journal source reste non borné : chaque événement conserve une nouvelle
version des listes cumulées de preuves et d'essais. Leur volume total peut
croître quadratiquement avec les acquisitions et persiste entre époques.
Les bornes de recherche ne constituent donc pas une borne de mémoire totale de
session. Aucune compaction générale n'est revendiquée dans ce transfert.

La validation des checkpoints est plus stricte que celle du restaurateur
Python. Pour les entrées malformées, la comparaison porte sur le rejet et
l'atomicité, avec les classes et messages de chaque langage conservés séparément.
Cette qualification ne présente pas les deux validateurs comme identiques.

## Preuves indépendantes et suites ouvertes

L'exporteur [export-v6-selected-rigid-reference.py](../../scripts/export-v6-selected-rigid-reference.py)
exécute le Python original sur des rasters, retours et interventions d'état
déclarés. Le [comparateur TypeScript](../../scripts/compare-v6-selected-rigid-reference.ts)
compare les sorties complètes. La tentative 04 contient 18 cas initiaux,
sept sessions synthétiques, 25 étapes source, 22 acquisitions, neuf
interventions d'état et cinq cas de restauration. Les contrôles de temps
utilisent des horloges déterministes et ne constituent pas un benchmark.

La [capture passive](../../tests/helpers/capture-selected-rigid.ts) et les
[dix tests associés](../../tests/v6-selected-rigid-capture.test.ts) conservent
les appels, budgets, résultats, erreurs, états et restaurations effectivement
observés, sans lecture d'horloge ajoutée par l'instrumentation. Le
[vérificateur de présence](../../scripts/verify-selected-rigid-presence.py)
a été qualifié sur un rapport synthétique avec **30 mutations négatives sur 30
rejetées**. Ce rapport conserve trois préfixes, trois retours, deux acquisitions
sélectionnées, zéro acquisition passive et six restaurations réelles observées
par la capture synthétique. Il ne prouve pas une partie réelle.

Le [lecteur froid Python](../../scripts/compare-selected-rigid-public-parity.py)
a été exécuté sur la capture KLOT du gel de développement `development-freeze-01`.
Son [reçu terminal](lot6b-evidence/development-freeze-01/source-parity-attempt-01/reader-execution.json)
confirme **408 événements comparés, dont 340 appels racine, zéro différence**,
sans état ou plan natif utilisé comme amorce. Il reconstruit ses propres
propositions et checkpoints depuis les observations publiques et vérifie les
1 786 originaux avant et après. La
[campagne bornée](lot6b-evidence/development-freeze-01/bounded-execution.json)
atteint **trois niveaux KLOT, 38 actions et 30 préfixes**. Les entrées
pertinentes de cette exécution restent inchangées.

Les [résultats détaillés](lot6b-evidence/development-freeze-01/source-parity-attempt-01/result.json.gz)
retiennent 30 propositions, 38 gardes avant et après, 38 retours sélectionnés,
35 événements acquis, trois retours nuls de frontière et 98 restaurations
réelles, dont 60 natives et 38 source. Quatre retours modifient les hypothèses
de contrôle. Les **204 ablations** comprennent **63 changements d’action ou
de refus**, 198 résultats non vides et zéro erreur. Ces résultats établissent
une contribution sur cette campagne ; le retour étranger reste un cas
synthétique, puisque les 30 préfixes de KLOT sont sélectionnés SelectedRigid.

Ce gel historique reste celui du développement issu de Site 97 / native 0.60, avec 0.64 réservé.
La réconciliation et la qualification après le prédécesseur effectivement
publié 0.63 restent à faire. La [qualification négative du lecteur](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/results/qualification.json)
a ensuite réussi **deux mutations sémantiques sur deux**. Le
[reçu borné](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/bounded-execution.json)
conserve l’exécution et son débit. À cette **clôture historique du
développement**, l’horloge était fermée à **350,862153633 secondes**, avec
**2 049,137846367 secondes restantes**. Ce n’est pas le solde courant.

La contribution de développement, les cas contraires, le navigateur, les
régressions finales, le coût officiel et la publication restent distincts. La règle de coût autorise un dépassement de
phase seulement si la médiane complète reste **strictement sous +10 % pour
chaque jeu** dans la fenêtre isolée retenue.

## État des portes de livraison après le développement

Les cinq premiers processus de contrôle ont rendu zéro, mais l’audit de
migration conserve trois références manquantes correspondant à deux fixtures
héritées. Ce passage reste sémantiquement incomplet. Le garde-fou de l’audit
rend désormais un échec pour des références absentes. Les fixtures ont ensuite
été restaurées exactement et le nouvel audit sémantique a réussi avec zéro
erreur ; la clôture ci-dessous conserve les reçus distincts. Aucun bilan
« cinq contrôles réussis » n’est attribué au premier passage.

Site 101 / native 0.61 et le checkpoint 5C `d54a58f2` restent des jalons
historiques. Le dernier constat publié est Site 103 / native 0.62, sans
SelectedRigid ; son intégration 6B vérifie désormais `currentExecution`, le
cinquième argument des gardes et la conversion du délai hôte plus strict.
Le candidat courant fa23/322 intègre provisoirement `805b3029`. Sa suite
complète **5 405/5 405**, ses cinq contrôles de livraison, son worker et sa
structure de coût sont désormais vérifiés comme détaillé en tête, avec les
échecs historiques conservés. La nouvelle preuve KLOT est close sur trois
niveaux, 38 actions et 30 préfixes, avec 408 événements originaux sans
différence, ablations et deux corruptions sémantiques qualifiées.
Les **onze rejeux et 187/187 contrôles**, totalisant 390 actions, sont agrégés
avec les douze tentatives conservées. La QA navigateur Vite est réussie sur
le worker TypeScript de développement : Pause à zéro action observée deux fois,
reprise, trois niveaux puis fermeture vérifiés. Elle ne qualifie pas un parcours
UI du bundle de production. La publication 0.63 et sa réconciliation, le
parcours CLI complet des outils de coût, la mesure officielle et la publication
6B restent ouverts.

La revue statique conserve deux limites distinctes : Pause ne préempte pas la
recherche du worker ; le chemin asynchrone après autorisation n’établit pas de
garde courante supplémentaire rafraîchie après sa suspension. Les surfaces de
l’[appelant natif](../../src/logos-engine/v6-native-runtime.ts) et du
[service d’agent](../../src/runtime/v6-agent-service.ts) restent à qualifier dans
leur contexte effectif. **Aucune de ces limites n’est établie comme cause du
signalement KLOT**. La capture fa23 réussie ne reproduit pas la session exacte
signalée et ne transforme pas ces réserves en diagnostic causal.

## Clôture de la restauration des preuves héritées

Les deux fixtures historiques ont été reconstruites exactement depuis leurs parties, avec les empreintes de la validation publiée 6A. Le [reçu de restauration](lot6b-evidence/fixture-restoration/attempt-01/recovery.json) lie ces identités. Après le refus réel des références absentes par le garde corrigé, le [nouvel audit sémantique](lot6b-evidence/audit-guard/restored-inventory.json) réussit : zéro erreur, 198 composants vérifiés, 148 transferts partiels et 1 023 modules en attente. Le premier passage et ses trois erreurs restent conservés. Les sources natives, les résultats fonctionnels et les entrées du build sont inchangés.
