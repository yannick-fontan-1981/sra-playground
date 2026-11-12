# Lot 6B : SelectedRigid

<!-- LOT6B_SITE103_INTEGRATION_START -->
## Reprise après le signalement KLOT : publication et fusion

### Règle de travail prospective du 11 novembre 2026

La nouvelle instruction utilisateur autorise **le développement, les tests
fonctionnels, les commits et les push sans verrou global**, dans un checkout
et une branche propres. Les sauvegardes doivent rester régulières, sans
attendre la publication des autres lots. Cette règle s’applique aux travaux
nouveaux ; les anciennes attentes, gardes et preuves de coordination demeurent
des faits historiques et ne sont pas réécrites.

**Seules les mesures officielles de coût et la publication nécessitent une
courte exclusivité.** Aucun verrou détenu ne doit être supprimé ni remplacé.
Le développement courant ne requiert ni verrou partagé global ni garde
d’un ancien silence préparatoire. La publication effective 0.63 reste une
condition de réconciliation pour l’acceptation finale 6B ; elle ne bloque pas
la préparation, les tests fonctionnels ou les commits et push courants.
La règle est explicitée par [addendum prospectif](lot6b-evidence/current-work-policy-20261111.md).
La [prochaine préparation du contrat de coût](lot6b-evidence/source-workflow-20261111/next-cost-preflight-plan.md)
précise les commandes et leurs prérequis réels. Les travaux préparatoires restent
libres de verrou global ; les CLI officiels positifs attendent les identités du
prédécesseur publié et les mesures réellement acquises.

### Diagnostic source du message d’arrêt signalé

Le [diagnostic de source générique](lot6b-evidence/user-stop-nested-control-01/source-diagnosis.json)
identifie précisément **`FieldServiceMemory.applyEvent`**, dans
[v6-field-service-access.ts](../../src/logos-engine/v6-field-service-access.ts).
Pour un événement `nested_control_response` dont la disposition est différente
de `local_no_visible_effect`, ce code fixe le motif
**`nested_control_effect_requires_composition`**. Le chemin générique exige
alors une composition explicite ; une composition de remplissage reconnue
peut lever ce motif. Il ne transforme pas ce refus en réussite.

**SelectedRigid est raccordé en amont dans le candidat fa23.** Le Site 103
exact, commit `4afcbfe6a25bd3a88223be543e443bc53b9c8814`, encore observé
**à 21:33 UTC**, dans le [nouveau constat d’hébergement](lot6b-evidence/source-workflow-20261111/publication-observation.json), reste en **native 0.62 sans raccordement SelectedRigid**.
Cette différence est compatible avec le message fourni par l’utilisateur.
**Le texte seul ne prouve ni la version chargée dans le navigateur, ni le
niveau, ni l’historique d’actions de sa session.** La session exacte n’a pas
été reproduite.

Ce diagnostic n’exécute **aucun nouveau jeu ni parcours navigateur** et
n’apporte **aucune modification native** : le gel demeure **fa23 / 322 fichiers**.
Les validations fonctionnelles, les rejeux et les preuves KLOT/navigateur
déjà closes restent inchangés. Après le diagnostic facturé, le compteur
est **fermé à 1 424,8841320940055 / 2 400 secondes**, avec
**975,1158679059945 secondes restantes**. Les points de clôture antérieurs,
dont celui de QA02, restent historiques.

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

Au point historique suivant QA02 et sa **lecture finale facturée, vers
20:32 UTC le 11 novembre 2026**, l’horloge était **inactive**, à
**1 221,0363642830062 secondes cumulées sur 2 400**, avec
**1 178,9636357169938 secondes restantes**. Ce point remplaçait celui de
20:19:50 et comprenait la clôture effective du navigateur. Le diagnostic
source ultérieur porte le dernier compteur fermé à **1 424,8841320940055 s**,
avec **975,1158679059945 s restantes**, comme indiqué en tête.
Le parcours final des outils de coût, la mesure officielle, la publication
effective 0.63 et sa réconciliation, puis la publication 0.64 restent ouverts.

Le [checkpoint de preuves complet, effectivement poussé et vérifié](lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/complete-checkpoint-summary.json)
est **`41cedc1f6a89b8639c19f0dc45eae24c264ad3c0`**, sur la branche
`lot6b-selected-rigid-checkpoint-20261111`, confirmé le **11 novembre 2026 à
20:55:52.559017 UTC**. Son parent est
`17d6c1aa3532e4ff74a98a309e4dfb9c3bc4fb59`. Le complément réellement poussé
comprend **78 fichiers supplémentaires / 4 433 894 octets** : QA02 complète
avec capture et fermetures, horloge finale, trois documents dans leur état
de clôture et métadonnées. Le natif reste **fa23 / 322 fichiers inchangé**.
Ce checkpoint de preuves ne constitue pas une publication de Site.

Le [checkpoint principal 17d6c1aa](lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/core-checkpoint-summary.json)
reste conservé : **sept lots poussés et vérifiés, 356 fichiers /
154 054 085 octets**, confirmation à **20:51:49.609783 UTC**.
Le [checkpoint de la règle de travail courante](lot6b-evidence/source-workflow-20261111/policy-checkpoint-summary.json)
**`2e555ec44e792c4f75d400205ead5de595e95791`** est poussé et vérifié sur la
branche propre, sans verrou global. Les **38 tests de coordination passent** ;
le transport direct est terminé, avec son groupe de processus absent.
Le checkpoint précédent `1372d2df336f9919d7b5892160936d928720c24c` et le
checkpoint de preuves `41cedc1f6a89b8639c19f0dc45eae24c264ad3c0` restent
conservés. Cette sauvegarde de source ne publie pas de Site. La clôture
documentaire qui cite ce nouveau checkpoint fait l’objet du commit suivant.

`a01e6faf330d82fa220feac0c9ad4632bb75a9de`, vérifié à 18:34:56 UTC,
reste un jalon historique, comme le
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

La [dernière observation du statut 5C](lot6b-evidence/provisional-063-01/source-checkpoint-functional-01/predecessor-final-status-observation.json)
rapporte la phase **`cost_unmeasured_publication_pending`**. La cause
explicitement rapportée pour ce créneau est **600 secondes sans accusés
d’inactivité frais de 8A et 10C** : **zéro tentative de verrou exclusif,
zéro échantillon officiel et zéro publication**, sans nouvel essai automatique.
Ce constat ne diagnostique pas un ancien détenteur de verrou.
La publication effective 0.63 et le coût officiel 6B restent donc ouverts.
L’ordre demeure **5C 0.63 → 6B 0.64 → 8A 0.65 → 10C**.

<!-- LOT6B_SITE103_INTEGRATION_END -->

## État de travail et provenance

**Transfert en cours, non publié.** Le checkout isolé a été ouvert sur le commit
publié `98336fba4e696a51c90ff7f7b37b8bdf95f34847` de Site 97 / native 0.60.0.
Le [reçu d'ouverture](lot6b-evidence/source-opening/sites-open-result.json)
conserve cette origine. La version 0.64.0 est réservée après les publications
effectives 7 follow-up / 0.61, 10B / 0.62 et 5C / 0.63. Elle ne constitue ni une
publication ni une validation anticipée du gel intégré.

Les preuves ci-dessous portent sur le composant, des scénarios synthétiques
déclarés et une première campagne froide de développement : **KLOT atteint
trois niveaux en 38 actions et 30 préfixes**, avec une relecture Python
indépendante sans différence. Les onze rejeux et la QA navigateur du candidat
fa23 sont maintenant qualifiés séparément en tête ; le coût intégré et la
publication restent ouverts. Cette campagne historique ne constitue pas
la qualification du gel intégré après le prédécesseur publié 0.63. La
[filiation source → TypeScript → appelant → preuve](lot6b-selected-rigid-lineage.md)
détaille le périmètre. Les réserves historiques de V6 restent conservées.

## Contrat transféré

La référence est le pin original
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Le périmètre direct comprend
`selected_rigid/family.py`, `mechanism.py` et `base.py`, les mesures
publiques communes, l'identité canonique et le helper V5 `_rotated(offset, 0)`.
L'alias `ConstructionPreviewAccess` de cette base désigne une base neutre.

Le composant mesure la grille, les masques complets et un réceptacle homologue
à partir des observations publiques. Les rôles du réceptacle et du domaine de
collision restent des hypothèses de bibliothèque. Les 24 permutations initiales
des commandes cardinales sont éliminées uniquement par les retours observés.
Un clic ne démontre pas le rôle causal du corps sélectionné. Un retour
stationnaire peut laisser plusieurs modèles compatibles ; un ensemble réfuté
vide reste vide, y compris entre époques.

La recherche conserve l'ordre des directions, le coût du changement de
sélection, le départage du tas par estimation/coût/numéro d'insertion et le
compteur de nœuds de la source. Le préfixe reste limité à
`min(remaining, 16)`. Une sélection scelle le préfixe ; un préfixe mixte peut
conserver des déplacements connus avant sa sonde finale.

L'état source est exactement `{format: 'selected_rigid_events.v1', events}`.
Le même propriétaire propose, acquiert et restaure. Les retours étrangers ne
lui sont pas acquis passivement. Quand son journal n'est pas vide, l'appelant
écrit et restaure néanmoins son état après chaque transition, immédiatement
avant PreviewPacking. Un retour sélectionné sans événement conserve un fait
présent de valeur `null`.

Les budgets et le motif d'arrêt sont transitoires. L'autorisation d'un préfixe
repris actualise le délai à partir du temps actif du niveau. Les cinq motifs
bloquants de la source sont préservés avant toute action d'un fournisseur de
priorité inférieure. Le contrôle de disponibilité et l'unique propriétaire
public du point ACTION6 proviennent déjà du caller Python original.

## Preuves actuellement conservées

| Preuve | Résultat et limite |
| --- | --- |
| [Export original, tentative 04](lot6b-evidence/oracle/attempt-04/export-execution.json) | Réussi. **1 786 fichiers originaux vérifiés avant et après**, 725 fichiers importés ou explicitement consommés. Aucun moteur, niveau privé ou module natif exécuté par l'export. |
| [Comparaison indépendante, tentative 04](lot6b-evidence/oracle/attempt-04/native-comparison.json) | **3 593 contrôles réussis : 1 082 comportementaux et 2 511 de provenance de fichiers**. 18 cas initiaux, sept sessions synthétiques, 25 étapes source, 22 acquisitions, neuf interventions d'état déclarées et cinq cas de restauration. Les horloges contrôlées ne mesurent pas le coût. |
| [Composant, tentative 02](lot6b-evidence/component/attempt-02/execution.json) | Passage réussi du composant : **43/43 tests**. Cette preuve ne remplace pas la validation intégrée finale. |
| [Composant et intégration, tentative 03](lot6b-evidence/component/attempt-03/execution.json) | **Échec conservé, 53/54**. L'attente de l'état Preview après un retour étranger incluait à tort l'absence d'une nouvelle entrée de cache de mesure ; la correction est vérifiée dans la tentative d’intégration 02, sans effacer cet échec. |
| [Fabrique et familles adjacentes, tentative 01](lot6b-evidence/integration/attempt-01/factory-and-adjacent.json) | **Échec conservé, 21/22** ; le scénario de transition ne satisfaisait pas les prérequis du caller. Ne constitue pas une validation positive de l'intégration. |
| [Intégration ciblée, tentative 02](lot6b-evidence/integration/attempt-02/execution.json) | **10/10 tests réussis**, zéro échec, annulation, test ignoré ou TODO. Caller réel, cinq refus source, acquisition unique, ordre des checkpoints après retour étranger, pause inactive et arrêt au délai actif. Les 319 entrées enregistrées restent inchangées. |
| [TypeScript, tentative 01](lot6b-evidence/integration/attempt-01/typecheck.json) | Contrôle réussi sur les entrées enregistrées de cette tentative. |
| [Capture passive, tentative 01](lot6b-evidence/capture/attempt-01/execution.json) | **10/10 tests** : arguments et résultats réels, budget sans lecture d'horloge ajoutée, distinction entre retour nul et appel sans résultat, erreurs et restaurations observées. |
| [Vérification de présence synthétique](lot6b-evidence/capture/attempt-01/presence-qualification.json) | Un rapport synthétique, trois préfixes et trois retours ; deux retours sélectionnés, un étranger, zéro acquisition passive. **30/30 mutations négatives rejetées avec l'erreur attendue**. Ce rapport ne prouve ni une partie réelle ni la parité Python d'un jeu. |

Les [deux premiers exports](lot6b-evidence/oracle/attempt-01/export-execution.json)
et [leur reprise](lot6b-evidence/oracle/attempt-02/export-execution.json) restent
échoués : leurs scénarios annoncés comme mixtes n'atteignaient pas réellement
un préfixe mixte de la source. La
[tentative 03](lot6b-evidence/oracle/attempt-03/native-comparison.json) a ensuite
réussi 3 439 contrôles, dont 928 comportementaux. La tentative 04 étend ce
corpus ; elle ne réécrit pas les verdicts précédents. Le premier échec de
composant reste aussi dans
[component/attempt-01](lot6b-evidence/component/attempt-01/execution.json).

Le contrôle d'un retour étranger doit comparer les checkpoints au moment réel
de ce retour. PreviewPacking peut compléter son cache de mesure pendant une
proposition sans acquérir un nouvel événement. Une attente supposant tout
l'état Preview immuable pendant `propose` ne correspond pas à son contrat.
La tentative d’intégration 02 conserve la vérification de l’ordre SelectedRigid
puis PreviewPacking et de l’absence d’acquisition passive SelectedRigid.

## Bornes, interruption et mémoire

| Borne | Valeur par défaut | Sémantique |
| --- | ---: | --- |
| Nœuds source développés | 150 000 | Arrêt de recherche sans conclusion d'impossibilité. |
| Délai de recherche source | 18 000 ms | Plafonné par le délai actif du niveau ; contrôlé à la frontière de la boucle source. |
| États retenus natifs | 250 000 | `NATIVE_RETAINED_STATE_BOUND`, inconnu bloquant. |
| Entrées de file natives | 250 000 | `NATIVE_QUEUED_STATE_BOUND`, inconnu bloquant. |
| Intervalle de travail coopératif | 256 | Vérifications et points de coopération, séparés du compteur de nœuds source. |

Les paramètres de qualification peuvent réduire ces limites, sans les
augmenter. Un calcul interrompu n'est pas une impossibilité démontrée et ne
livre pas de préfixe partiel. Les bornes natives ajoutées sont nommées.

**Les 18 secondes ne sont pas une garantie absolue de latence de retour.**
Une expansion ou une reconstruction déjà commencée peut continuer jusqu'au
prochain contrôle applicable. Les contrôles coopératifs imposent le délai du
niveau et le signal d'arrêt ; le délai source est examiné dans la boucle
principale. Le caller contrôle également l'exécution avant et après les gardes
d'autorisation. **Dans le navigateur actuel, Pause empêche les prochaines actions physiques,
mais ne préempte pas la recherche en cours dans le worker** : le signal d’arrêt
n’y est pas raccordé à cette commande. Le calcul commencé peut donc se terminer
après Pause. Une latence maximale de Pause ou une interruption immédiate du
calcul n’est pas revendiquée. Le test de longue pause inactive concerne la
conservation du préfixe et son budget de reprise.

La revue statique du chemin d’appel conserve aussi une limite de
post-autorisation asynchrone : aucune garde courante supplémentaire rafraîchie
n’est établie après cette suspension. Voir les surfaces de l’[appelant natif](../../src/logos-engine/v6-native-runtime.ts)
et du [service d’agent](../../src/runtime/v6-agent-service.ts). Cette réserve
et la non-préemption de Pause **ne constituent pas une cause établie du
signalement KLOT**. La capture fa23 réussie ne reproduit pas la session exacte
de l’utilisateur et ne diagnostique pas ces réserves.

**La recherche bornée ne rend pas le journal source borné.** Chaque événement
conserve un état complet, dont les listes cumulées de preuves et d'essais. Leur
volume cumulé peut croître quadratiquement avec les acquisitions. Le journal
persiste entre époques. Ce comportement est hérité de la source ; aucune
compaction générale ni borne en octets de la session n'est revendiquée ici.
Les plafonds de recherche comptent des états et des entrées de file, dont le
poids dépend notamment du nombre de corps et de leurs clés de poses.

La validation native des checkpoints est plus stricte que la validation des
champs racine et du type d'événement effectuée par le restaurateur Python.
Les exceptions malformées de l'oracle comparent le refus et l'atomicité, avec
les classes et textes de chaque langage conservés séparément. Les scènes
mesurées regroupent seulement les cellules intérieures du plateau ; les poses
prévues de sortie vers le réceptacle sont des résultats de recherche distincts.

## Campagne froide de développement KLOT

Le gel `development-freeze-01` reste une qualification **provisoire sur la
base Site 97 / native 0.60**, avec la version 0.64 réservée. Son digest natif
est `7f30c635ebc13cebaa3016cf72a3d051b227033bb0f43b7e7201e68d0396dde2`.
Il ne remplace pas la future intégration des prédécesseurs effectivement publiés.

| Preuve exécutée | Résultat |
| --- | --- |
| [Campagne bornée](lot6b-evidence/development-freeze-01/bounded-execution.json) | **Trois niveaux KLOT, 38 actions, 30 préfixes**, sans expiration ni interruption. Commande terminée en **100,393944 s**, intervalle débité de **100,425972 s** comprenant son encadrement ; entrées enregistrées inchangées. |
| [Lecteur Python froid](lot6b-evidence/development-freeze-01/source-parity-attempt-01/reader-execution.json) | **408 événements comparés, dont 340 appels racine, zéro différence**. Exécution de lecture en **61,344030 s**, sans moteur de jeu ni exécution native. Les 1 786 originaux sont vérifiés avant et après. |
| [Résultat détaillé de la relecture](lot6b-evidence/development-freeze-01/source-parity-attempt-01/result.json.gz) | 30 propositions ; 38 gardes avant et 38 après ; 38 retours sélectionnés ; 35 événements source acquis et trois retours nuls aux frontières d’époque. **98 restaurations**, dont 60 natives et 38 source. Quatre retours changent les hypothèses de contrôle. |
| Contribution par ablation | **204 ablations**, dont **63 changent une action ou un refus**, 198 contiennent un résultat non vide, zéro erreur d’ablation. La contribution est observée dans cette campagne de développement ; elle n’établit pas une victoire complète du jeu. |

Le lecteur reconstruit ses propres propositions et checkpoints Python depuis
les observations publiques. Son reçu déclare `nativeStateSeed: false` et
`nativePlanSeed: false`. La capture KLOT contient uniquement des préfixes
sélectionnés SelectedRigid ; le retour étranger reste couvert séparément par
l’intégration synthétique, sans lui attribuer une occurrence dans cette partie.

La campagne et sa relecture consomment la même horloge cumulée du cas. Les
[reçus d’horloge](lot6b-evidence/klot-case-clock.json) conservent les débits ;
les durées ci-dessus ne sont pas des mesures du coût global STCK/SMLP. La
[qualification négative du lecteur](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/results/qualification.json)
est désormais **réussie pour les deux mutations sémantiques sur deux**. Son
[exécution bornée](lot6b-evidence/development-freeze-01/reader-negative-attempt-01/bounded-execution.json)
termine sans interruption ; le calcul de qualification dure **162,490293 s**,
la commande encadrée **163,439944 s** et son intervalle débité **163,469855 s**.
À cette **clôture historique du développement**, l’horloge était fermée à
**350,862153633 secondes cumulées**, avec **2 049,137846367 secondes restantes**
sur 2 400. Ce point historique ne décrit pas le solde courant.

## Qualification finale restante

KLOT est le candidat tiré du catalogue public. Aucun moteur, niveau, route ou
solution de ce jeu n'a été inspecté pour préparer le port. Le débit initial conservé était de **24,942972561 secondes** avant la nouvelle
campagne. Le budget cumulatif reste de 2 400 secondes ; une reprise ne le
réinitialise pas. Tous les
essais effectifs et diagnostics du cas seront gelés, journalisés et débités ;
les cas historiques épuisés restent fermés.

La campagne froide ci-dessus a été exécutée sur le gel de développement
provisoire issu de Site 97. Sa contribution et sa relecture seront qualifiées
après réconciliation du prédécesseur effectivement publié 0.63 ; aucune
réutilisation de preuve ne sera présumée si ses entrées pertinentes changent.

La qualification finale doit consolider les contributions et acquisitions
observées, les cas contraires ou ambigus, le cycle complet du caller, les
contrôles de livraison, les rejeux déclarés et l’observation du navigateur.
La campagne historique et son lecteur restent attachés au gel de développement.
Sur fa23, la preuve froide est désormais close : trois niveaux en 38 actions,
30 préfixes, 408 événements originaux sans différence, ablations et deux
rejets sémantiques qualifiés. La suite déclarée de 142 fichiers
réussit désormais **5 405/5 405** en tentative 03, après la correction du test
seulement ; les échecs antérieurs restent conservés. Les cinq contrôles et le
worker fa23 sont clos. **Onze rejeux sur onze, 187/187 contrôles et 390 actions**
sont désormais agrégés, avec les douze tentatives conservées. La QA navigateur
est réellement réussie sur Vite et son worker TypeScript de développement,
avec Pause, reprise, trois niveaux et fermeture vérifiés. Sa portée ne comprend
pas un parcours UI du bundle de production. La réconciliation de 0.63, le
contrat final des outils de coût, la mesure et la publication restent ouverts.

## Contrôles de développement et intégration encore ouverte

Les [premiers contrôles du gel de développement](lot6b-evidence/development-freeze-01/validation)
ont cinq commandes terminées avec un code processus zéro. **Cela ne constitue
pas cinq contrôles sémantiques réussis** : le rapport d’audit de migration
conserve trois références manquantes correspondant à deux fixtures héritées.
Le garde-fou générique de l’audit a été corrigé pour rendre un code d’échec
lorsque de telles références manquent. Les deux fixtures ont ensuite été
restaurées exactement et le nouvel audit sémantique a réussi avec zéro erreur,
comme le détaille la clôture ci-dessous. Le premier résultat incomplet reste
conservé sans remplacement rétrospectif.

Le point de contrôle historique Site 101 / native 0.61 et le checkpoint 5C
`d54a58f2` restent des étapes antérieures, sans publication 0.63. Depuis,
Site 103 / native 0.62 a été effectivement observé et intégré ; le helper
`currentExecution` et le cinquième argument de garde sont vérifiés sur le
jalon 103 + 6B. Le candidat courant fa23 intègre provisoirement `805b3029`.
Les résultats et échecs de ce candidat figurent en tête ; ils ne changent pas
l’origine Site 97 des anciens reçus. La publication effective 5C / 0.63 et sa
réconciliation restent requises avant l’acceptation finale, le coût et la
publication 6B.

## Règle de performance et publication

La référence finale sera le prédécesseur effectivement publié, réconcilié
avant le gel et la mesure. La décision porte sur la médiane de session
complète, **strictement sous +10 % pour chaque jeu** de la fenêtre commune.
Une phase au-dessus de 10 % peut être acceptée lorsque ce critère global passe ;
elle restera publiée avec les diagnostics. Un jeu ne compense pas un autre,
les phases imbriquées ne sont pas additionnées et les échantillons défavorables
restent conservés.

La structure des captures 805b/fa23 est désormais qualifiée sur 58 points,
avec les contrôles temporels et locaux aval détaillés en tête. Le parcours CLI
complet des outils, leur contrat final et la réconciliation avec le prédécesseur
effectivement publié restent à fermer avant toute mesure officielle.
Une différence non attribuée ou une fenêtre non isolée ne sera pas masquée par
un résultat favorable. **Aucun coût 6B ni aucune publication 6B n'est accepté
sur la seule base des preuves synthétiques présentes.** La feuille de route et
les inventaires seront actualisés lors de la qualification réelle du gel
intégré, en conservant la distinction entre transfert de composant, raccordement,
contribution en jeu et migration complète de V6.

## Clôture de la restauration des preuves héritées

Les deux fixtures historiques ont été reconstruites exactement depuis leurs parties, avec les empreintes de la validation publiée 6A. Le [reçu de restauration](lot6b-evidence/fixture-restoration/attempt-01/recovery.json) lie ces identités. Après le refus réel des références absentes par le garde corrigé, le [nouvel audit sémantique](lot6b-evidence/audit-guard/restored-inventory.json) réussit : zéro erreur, 198 composants vérifiés, 148 transferts partiels et 1 023 modules en attente. Le premier passage et ses trois erreurs restent conservés. Les sources natives, les résultats fonctionnels et les entrées du build sont inchangés.
