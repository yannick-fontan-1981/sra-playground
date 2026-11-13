# Lot 6A — Index des preuves de la reconstruction PreviewPacking

## État de cet index

**Moteur native 0.60.0 publié dans Site 96, coût global accepté ; 4 795/4 795 tests réussis dans les 126 fichiers déclarés, cinq contrôles finaux réussis, validations ciblées, campagne KATA, lecture originale et contrôle navigateur terminés. La synthèse finale des rejeux a réussi : 11/11 résultats et 187/187 comparaisons selon la sélection 9 + 1 + 1. Les preuves de présence et d’intégrité ainsi que la readiness sont acquises. Le temps complet augmente de +6,094357 % pour STCK et de +3,262812 % pour SMLP ; chaque jeu reste strictement sous +10 %.** Le [reçu réel de publication du moteur](publication/native-publication.json) porte le statut terminal `succeeded`. La [fiche du lot](../lot6a-preview-packing.md) décrit le comportement, la clôture et les limites ; la [filiation](../lot6a-preview-packing-lineage.md) détaille les contrats effectivement consommés.

Le gel de livraison est **`integrated-final-02`**, digest natif `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229`, avec **306 fichiers natifs et 322 fichiers archivés**. Le [prédécesseur publié vérifié](publication/published-baseline-site95.json) est Site 95 / native 0.58.0, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`. Cette référence demeure celle des comparaisons de coût.

La [constatation de reprise](recovery/recovery-observation.json) garde la perte de l'ancien candidat local. Les anciens 5 080 tests et anciens résultats de coût ne sont pas réutilisés. Les preuves de cette reconstruction ont leurs propres sources, entrées et dates.

## 1. Identités et archives

| Pièce | Utilisation |
| --- | --- |
| [Référence publiée Site 95](publication/published-baseline-site95.json) | Identité, commit, native 0.58.0 et audience réellement constatés |
| [Inventaire de la référence](baseline/source-manifest.json) | 302 fichiers natifs ; digest `099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4` |
| [Manifeste du gel de livraison](integrated-final-02/source-manifest.json) | Identité des 306 fichiers natifs du nouveau candidat |
| [Inventaire d'archive du gel de livraison](integrated-final-02/source-archive.json) | 322 fichiers, sources et adaptateurs passifs exacts |
| [Manifeste des parties d'archive](integrated-final-02/source-archive-parts.json) | Transport et reconstruction des octets archivés |
| [Première archive `integrated-final`](integrated-final/source-archive.json) | Tentative préliminaire conservée, harnais moins instrumenté ; même digest natif, autre identité d'archive |
| [Revue indépendante native/source](recovery/native-source-review.json) | Empreintes des quatre modules et du runtime, critères lus, absence de défaut concret trouvé dans ce périmètre, limites explicites |

Le commit source original est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Les validations originales vérifient l'inventaire immuable avant et après leurs calculs. Les noms historiques de certains schémas de scripts hérités ne changent pas le gel identifié par leurs reçus.

## 2. Composant, capture et validations

| Pièce | Résultat retenu |
| --- | --- |
| [Comparaison originale indépendante finale](recovery/oracle/source-reference-comparison-05.json) | **1 288 contrôles réussis**, 15 cas initiaux, 10 sessions, 32 étapes source ; aucun jeu exécuté |
| [Exécution des quatre fichiers Preview](integrated-final-02/validation/preview-verification-execution.json) et [journal TAP](integrated-final-02/validation/preview-verification-execution.log.gz) | **58 tests ciblés réussis**, code retour nul |
| [Suite complète finale](integrated-final-02/validation-final/validation/delta-tests-run.json) | **4 795/4 795 dans 126 fichiers** ; zéro échec, annulation, test ignoré ou TODO ; sources et entrées inchangées |
| [Cinq contrôles finaux de livraison](integrated-final-02/validation-final/validation/checks-run.json) | **5/5** : types, entrées, migration, diff et compilation ; natif inchangé |
| [Premier passage complet conservé](integrated-final-02/validation/delta-tests-run.json) | **4 793/4 795, deux échecs**, statut `failed` ; deux attentes de registre obsolètes corrigées avant la reprise complète |
| [Première observation d'intégration](recovery/integration-attempt-01.json) | Échec de développement conservé : attente `undefined` corrigée en `null` selon le contrat du runtime ; aucun succès final déduit de cette tentative |
| [Qualification négative du lecteur original](recovery/oracle/reader-runtime-negative-qualification-02.json) | **23 mutations refusées** sur une capture synthétique de la boucle réelle |
| [Présence synthétique — capture 03](recovery/native-presence-synthetic-03-02.json) | **Échec conservé**, `missing_source_facts` ; le rapport n'exposait pas encore les faits mémoire requis |
| [Capture synthétique 04 inchangée](recovery/oracle/runtime-synthetic-capture-04.json.gz) | Nouveau harnais capturant aussi `acquired` et `retainedSourceFact` depuis la mémoire réelle |
| [Présence synthétique — capture 04](recovery/native-presence-synthetic-04-02.json) | **Réussite** : 3 préfixes, 4 retours propres, 10 restaurations et **22/22 mutations refusées** |

Le [vérificateur de présence](../../../scripts/verify-preview-packing-presence.py) ne lit que les fichiers de preuve. Il n'importe aucun fournisseur natif, helper de jeu ou oracle Python. Son reçu `synthetic_qualification` qualifie le lecteur ; seul son mode `recorded_public_regressions`, lié aux onze rapports réels, peut établir la présence sur cette population.

Les reçus d'essai portant le suffixe `-01` restent conservés. Les qualifications de présence indiquées ici sont celles des reçus `-02`, qui lient le vérificateur final. Les captures et résultats anciens n'ont pas été réécrits.

## 3. Campagne froide KATA et comparaison originale

| Pièce | Contenu et portée |
| --- | --- |
| [Exécution de la campagne](integrated-final-02/execution-kata.json) | Session commune froide, code retour nul, gel et entrées inchangés |
| [Rapport de campagne](integrated-final-02/kata-campaign.json.gz) | **33 actions, 14 préfixes et 3 niveaux terminés** avec progression naturelle |
| [Trace publique](integrated-final-02/kata-public-trace.json.gz) | Commandes et paquets publics complets, conservés pour le contrôle de répétabilité |
| [Journal public réel](integrated-final-02/kata-actual-public-journal.jsonl.gz) | Observation passive des commandes et retours, sans fourniture de plan à l'agent |
| [Exécution du lecteur original à froid](integrated-final-02/kata-source-parity-execution.json) | **174 événements = 113 appels + 61 restaurations**, **zéro différence**, sans état ou plan natif utilisé pour amorcer la source |
| [Comparaison originale complète](integrated-final-02/kata-preview-source-parity.json.gz) | Gardes, acquisitions, restaurations et **56 ablations**, dont **17 changent les actions**, sans erreur d'ablation |

Les appels comparés comprennent 14 propositions, 33 gardes avant, 33 gardes après et 33 acquisitions. La campagne comporte 14 préfixes Preview sélectionnés et aucun préfixe étranger. La preuve porte sur le composant original consommé dans ces appels publics ; elle n'exécute pas l'appelant Python complet et ne revendique pas une équivalence générale de tout le jeu.

## 4. Navigateur et build réellement servi

| Pièce | Résultat |
| --- | --- |
| [Contrôle navigateur](integrated-final-02/browser/browser-qa.json) | Session froide distincte : **33 actions, 14 plans, 3 niveaux terminés**, arrivée au niveau 4 |
| [Observations de l'interface](integrated-final-02/browser/observations.json) | Une action initiale ; Pause confirmée à **9 actions** ; reprise d'une action jusqu'à **10** ; frontières naturelles conservées |
| [Capture finale](integrated-final-02/browser/kata-three-levels.png) | État visible à la fin du parcours |
| [Identité du preview statique](integrated-final-02/browser/static-preview-inputs.json) | Copie exacte du build validé, servie à l'intérieur du checkout |
| [Inventaire des entrées du build](integrated-final-02/validation/preview-inputs-manifest.json) | Sources, entrées et artefacts liés au contrôle de publication |

La tentative de Pause sur une frontière de niveau est conservée séparément du succès `Paused.`. Les temps d'observation ne constituent ni une mesure de latence de Pause ni une fenêtre de coût. Aucune réussite de la totalité du jeu n'est inférée des trois niveaux observés.

## 5. Périmètre final et onze rejeux déclarés

Le [plan final](planning/final-test-scope.json) liste **126 fichiers** : 122 hérités conservés et quatre fichiers Preview. L'[ancien plan de 129 fichiers](planning/initial-test-scope-129.json) reste consultable. La [notice LKEY conservée](planning/lkey-budget-closure-observation.json) motive l'exclusion avant exécution des modules `tests/v6-ranked-workshop-reference.test.ts`, `tests/v6-ranked-workshop-kernel.test.ts` et `tests/v6-symbol-transactions-kernel.test.ts`, qui décodent la fixture LKEY dès leur chargement. Ces exclusions ne sont pas des tests ignorés ou réussis.

Le [manifeste des rejeux](integrated-final-02/regression-cases.json) contient **dix cas historiques** — CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV, TRIA, CRAF et ISOS — et **un cas de cohérence du candidat avec lui-même**, `kata-060-self-consistency`. Ce onzième cas réutilise la nouvelle trace KATA du candidat ; il ne prouve pas une parité KATA avec native 0.58.

La validation des 126 fichiers est terminée : **4 795/4 795**, avec **5/5 contrôles finaux**, sous `integrated-final-02/validation-final/validation`. Le premier résultat **4 793/4 795** reste échoué et disponible sous `integrated-final-02/validation`.

| Rejeu conservé | Résultat réel et suite |
| --- | --- |
| [Premier bilan des onze cas](integrated-final-02/regressions/regression-summary.json) | `failed` ; **9/11 résultats réussis, 153/187 contrôles** ; WEAV et CRAF terminés par `-9` |
| [Première reprise de WEAV et CRAF](integrated-final-02/released-recovery/regressions/regression-summary.json) | `failed` ; **CRAF réussi, 17/17 contrôles** ; nouvel arrêt `-9` de WEAV |
| [Exécution WEAV avec tas V8 limité à 1 024 Mio](integrated-final-02/released-weav-1024/regressions/weav-051-execution.json) | **Échec réel `-6` après 73 actions**, avec diagnostic explicite d’épuisement du tas JavaScript |
| [Diagnostic mémoire conservé](recovery/weav-memory/diagnostic.json) | Distingue cet échec V8 des trois SIGKILL précédents, dont la cause reste inconnue |
| [Reprise finale WEAV à 1 536 Mio sous verrou exclusif](integrated-final-02/released-weav-exclusive-1536/regressions/regression-summary.json) et [reçu englobant](integrated-final-02/released-weav-exclusive-1536-execution.json) | **Réussite réelle : 81 actions, 17/17 contrôles**, code retour nul ; gel, harnais et outils centraux inchangés |
| [Première tentative de consolidation](recovery/consolidation-attempt-01.json) | **Échec `KeyError: inputs`** sur le reçu englobant final ; aucun résumé réussi écrit, aucun rapport de rejeu perdu |
| [Bilan final des régressions](integrated-final-02/regressions-final/regression-summary.json), produit par le [consolidateur](consolidate-regression-recovery.py) | **`passed` : 11/11 résultats et 187/187 contrôles**, sélection 9 + 1 + 1 liée aux empreintes et aux invocations réelles ; quatre échecs de rejeu conservés |

Les **trois sorties `-9` (SIGKILL)** restent conservées avec une cause inconnue. Le quatrième échec, à 1 024 Mio, possède un diagnostic V8 d’épuisement du tas ; ce diagnostic ne requalifie pas les trois signaux précédents. La reprise finale à 1 536 Mio est une exécution distincte réellement réussie. Cette limite de tas ne s’applique pas à la fenêtre officielle de coût.

Les **onze succès individuels totalisent 187 comparaisons réussies** : neuf résultats du premier passage, la reprise CRAF et la reprise finale WEAV. Leur synthèse est acquise dans `integrated-final-02/regressions-final/regression-summary.json`. La liaison `actual_retained_child_execution_inputs` rattache explicitement le reçu englobant final, dépourvu de liste `inputs`, aux empreintes complètes avant et après conservées par le driver enfant ; aucun inventaire parent antérieur au lancement n’a été inventé. **Aucun rapport n’a été perdu et cette correction de provenance n’a nécessité aucun nouveau rejeu.** Les rejeux gardent leur portée de comparaisons de retours enregistrés et ne constituent pas onze nouvelles réussites en jeu.

| Preuve de clôture fonctionnelle | Résultat réel |
| --- | --- |
| [Présence sur les onze rapports](integrated-final-02/regressions-final/preview-owner-presence.json) | **`passed`, 11/11 cas** ; 289 préfixes, dont 14 sélectionnés et 275 étrangers ; 390 retours, dont 33 sélectionnés et 357 étrangers ; **33 acquisitions sélectionnées, zéro acquisition passive** |
| Même contrôle de présence | **611 restaurations observées** : 578 natives et 33 source ; rapports, provenance et digest natif liés |
| [Intégrité finale](integrated-final-02/delivery-integrity.json) | **`passed`** ; 703 fichiers source/tests, 371 entrées de build, 13 entrées d’exécution des régressions, 12 rapports restitués à l’identique ; 1 786 originaux inchangés |
| [Readiness avant mesure](performance-integrated/readiness.json) | **`ready`**, mesure autorisée ; preuves et conditions préalables liées avant la fenêtre |
| [Horloge cumulative KATA](case-clock.json) | **Clôturée dans le budget : 2 256,934540 / 2 400 s**, 143,065460 s non consommées ; charge antérieure et tentatives conservées |

Le contrôle de présence est une vérification de cohérence en lecture seule ; il ne revendique aucune nouvelle parité Python ni exécution de jeu. L’intégrité vérifie les fichiers enregistrés et le transport sans perte. La publication reste distincte de ces validations.

## 6. Coût : fenêtre terminée et budget global accepté

| Pièce existante | Fonction |
| --- | --- |
| [Protocole de la nouvelle fenêtre](performance-integrated/protocol.md) | Référence Site 95 / native 0.58.0 remesurée face au gel 0.60.0 ; ordre A1/B1/B2/A2 |
| [Déclaration](performance-integrated/declaration.json) et [préparation](performance-integrated/preparation.json) | Identités, outils, sources et conditions préalables ; aucune mesure déduite de la préparation |
| [Politique globale](performance-integrated/global-budget-policy.json) | Médiane groupée du temps complet, strictement sous **+10 % pour chaque jeu** |
| [Cas fixes](performance-integrated/cases.json) et [diagnostics de phases](performance-integrated/comparison-policy.json) | Populations STCK/SMLP et seuils centraux conservés |
| [Provenance des dix outils adaptés](recovery/cost-tools-adaptation.json) | Différences et empreintes par rapport aux outils 5B ; aucune réutilisation d'une ancienne mesure |
| [Inventaire réel des propriétaires/programmes](performance-integrated/owner-source-inventory.json) | **55 → 56 propriétaires**, **25 → 25 programmes** ; seul ajout `preview_packing` |
| [Qualification des formes fonctionnelles](performance-integrated/owner-structural-attribution.json) | **64 contrôles**, attribution des structures réelles et zéro acquisition Preview dans ces retours étrangers |
| [Contrat structurel préalable](performance-integrated/owner-growth-contract.json) | Champs et formes admissibles fixés avant la mesure |
| [Précontrôle statique](performance-integrated/static-preflight.json) | **68 contrôles**, sans mesure ; readiness fonctionnelle et isolation vérifiées séparément |
| [Séquence de coordination](coordination/cost-command-sequence.md) | Conditions de lancement, commandes et reçus attendus |
| [Fenêtre officielle](performance-integrated/window.json) | A1/B1/B2/A2 terminé ; **32 sessions mesurées, 400 actions**, intégrité finale validée |
| [Revue indépendante du coût](performance-integrated/owner-growth-review.json) | **`qualified_owner_cost_review_passed`**, 17 890 contrôles ; `globalAccepted: true` pour **2/2 jeux** |
| [Rapport complet de coût](performance-integrated/results.md) | Tous les diagnostics, cohortes, dispersions, p95 disponibles, observations d’inspection et de Pause, échantillons mémoire |
| [Refus historique strict conservé](performance-integrated/aggregation-failure.json) | Échec réel sur les métadonnées de travail ; l’analyse structurelle distincte ne réécrit pas ce refus |

La règle utilisateur autorise une phase au-delà de +10 % lorsque le temps complet de **chacun** des deux jeux reste strictement sous +10 %. Les dépassements et p95 disponibles demeurent visibles ; aucun jeu ne compense l’autre. La fenêtre conserve les 32 sessions mesurées et 400 actions, avec huit chauffes et leurs 24 actions séparées, sans retrait d’échantillon mesuré.

| Jeu | Médiane de session Site 95 / 0.58.0, ms | Médiane 0.60.0, ms | Augmentation globale | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 10 953,832914 | 11 621,398595 | **+6,094357 %** | Accepté |
| SMLP | 16 915,812682 | 17 467,743862 | **+3,262812 %** | Accepté |

Les huit mesures par jeu, dont `session_elapsed`, forment **16 diagnostics chronométriques agrégés : 11/16 dans le budget observé**. Les cinq dépassements de médiane de phase restent acceptés au titre de la règle globale et visibles dans le rapport : STCK `new_decision` **+14,980671 %**, STCK `acquisition_and_persistence` **+12,324410 %**, SMLP `new_decision` **+12,443161 %**, SMLP `known_prefix_service` **+11,550136 %** et SMLP `known_prefix_request` **+12,686196 %**. Les cohortes et p95 conservent leurs propres diagnostics, sans substitution au critère global.

Le coût accepté porte sur les chemins communs STCK/SMLP sans acquisition Preview. Il ne mesure pas directement une recherche positive de partition et ne prouve pas une stabilité sur plusieurs heures.

## 7. Publication et suite

Le [contrôle des entrées de publication](integrated-final-02/publication-inputs.json) a réussi : `status: passed`, `costAccepted: true`, `publicationExecuted: false`. Ce contrôle préalable lie les preuves terminées et les octets validés ; la publication effective possède son reçu distinct.

Le [reçu terminal de publication du moteur](publication/native-publication.json) confirme **Site 96 / native 0.60.0**, commit `cdaceea1c8918430a70b95fa427b31fcd22d290c`, statut **`succeeded`**, le 11 novembre 2026. L’[application](https://sra-playground.yannick-fontan.chatgpt.site) conserve son URL et son audience limitée au propriétaire. Site 96 désigne ce jalon moteur, distinct des versions documentaires.

| Preuve de transport et de publication | Résultat conservé |
| --- | --- |
| [Vérification finale du transport source et du build](publication/final-source-build-verification.json) | **`passed`** ; cinq reçus de poussée source, **375 comparaisons des 75 fichiers applicatifs de chacune des cinq archives**, tous identiques octet pour octet au build validé |
| [Première préparation](publication/worktree-preparation-attempt-01.json) | **`failed`**, refus conservé de restaurer des preuves supplémentaires hors du périmètre 6A du helper |
| [Restauration préalable des preuves](publication/preparation-prerequisite-restoration.json) | **158 fichiers de preuve restaurés à l’identique**, sources, tests et build inchangés |
| [Préparation terminée](publication/worktree-preparation.json) | **`passed`**, inventaires et octets validés conservés, sans recompilation |

La prochaine capacité est **6B — `selected_rigid`**. L’ordre des lots et les autres reprises restent dans la [feuille de route générale](../v6-delivery-roadmap.md). Les limites fonctionnelles, de restauration, de couverture et de latence demeurent dans la [fiche du lot](../lot6a-preview-packing.md) et son [contrat de filiation](../lot6a-preview-packing-lineage.md).
