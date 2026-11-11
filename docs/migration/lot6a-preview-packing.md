# Lot 6A — Prévisualisation et partition des pièces

## État avant publication

**Le candidat `preview_packing`, native 0.60.0, est validé et son coût global est accepté. La suite complète de 126 fichiers a réussi ses 4 795 tests, les cinq contrôles finaux sont réussis, et les preuves ciblées, la campagne froide KATA et le contrôle navigateur sont terminés. La synthèse finale des rejeux a réussi : 11/11 résultats et 187/187 comparaisons selon la sélection 9 + 1 + 1. La présence, l’intégrité et la readiness sont validées. La hausse du temps complet est de +6,094357 % pour STCK et +3,262812 % pour SMLP, sous le seuil strict de +10 % pour chaque jeu. La publication de native 0.60.0 reste à confirmer.** Cette version du document décrit les preuves disponibles le 11 novembre 2026 ; elle ne déclare pas le candidat publié.

Le [prédécesseur réellement publié](lot6a-evidence/publication/published-baseline-site95.json) est **Site 95 / native 0.58.0**, commit `3a70463039768f7114edae7d94d7dd33b7f36aa8`, avec une audience limitée au propriétaire. La [reprise du travail](lot6a-evidence/recovery/recovery-observation.json) a constaté la perte du précédent candidat local 6A. Ses anciens **5 080 tests** annoncés et ses anciens résultats de coût restent historiques et ne qualifient pas cette reconstruction.

| Identité | Preuve retenue | Portée |
| --- | --- | --- |
| Source originale | Commit immuable `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e` ; [contrat de filiation](lot6a-preview-packing-lineage.md) | Famille V6, donneur et calcul V5 effectivement consommé |
| Candidat de livraison | [Manifeste `integrated-final-02`](lot6a-evidence/integrated-final-02/source-manifest.json), **306 fichiers natifs** | Digest `ea2b52283409971cf6ce73b8b7970576651bfb3c78a681fc741a13f432050229` |
| Archive du candidat | [Inventaire de 322 fichiers](lot6a-evidence/integrated-final-02/source-archive.json) et [transport par parties](lot6a-evidence/integrated-final-02/source-archive-parts.json) | Sources et adaptateurs passifs exacts de ce gel |
| Première archive conservée | [Archive `integrated-final`](lot6a-evidence/integrated-final/source-archive.json) | Tentative préliminaire avant validation de livraison, avec un harnais moins instrumenté |

Les deux archives portent le même digest natif ; leurs adaptateurs de preuve ne sont pas interchangeables. Le second gel capture les enveloppes d'acquisition et le fait source réellement retenus dans la mémoire. Les preuves ci-dessous sont attribuées à leur fichier et à leur gel exacts. Le HEAD d'ascendance de Site 95 ne représente pas à lui seul les modifications du candidat.

## 1. Comportement transféré

La famille mesure un inventaire de pièces et une grille à partir du raster public. Elle construit une hypothèse de partition de l'espace intérieur, choisit une pièce et une pose cible, puis utilise les contrôles effectivement observés pour préparer une sélection ou un déplacement. Les formes, occurrences fixes, ordres de parcours et égalités de coût suivent les contrats consommés décrits dans la [filiation source](lot6a-preview-packing-lineage.md).

Le port comprend les quatre modules [`v6-preview-packing.ts`](../../src/logos-engine/v6-preview-packing.ts), [`v6-preview-packing-types.ts`](../../src/logos-engine/v6-preview-packing-types.ts), [`v6-preview-packing-geometry.ts`](../../src/logos-engine/v6-preview-packing-geometry.ts) et [`v6-preview-packing-calculus.ts`](../../src/logos-engine/v6-preview-packing-calculus.ts). Leur raccordement au moteur commun est dans [`v6-native-runtime.ts`](../../src/logos-engine/v6-native-runtime.ts). La recherche géométrique consommée ne transfère pas toutes les capacités physiques V5 présentes dans le fichier original.

L'[inventaire réel des propriétaires et programmes](lot6a-evidence/performance-integrated/owner-source-inventory.json) constate **55 → 56 propriétaires**, avec le seul ajout de `preview_packing`, et **25 → 25 programmes installés par les familles**. Aucun programme SRC supplémentaire n'est ajouté. La priorité de Preview reste celle de la stratégie source : après `subset_diagnosis` et avant `selected_rigid` dans les sous-questions concernées.

Le premier pas est lié à l'observation courante, à l'époque, au score, au raster et aux actions disponibles. Une sélection pointée doit appartenir à une seule entité actuellement mesurée. Les étapes suivantes revalident la pose de prévisualisation attendue. Un résultat inconnu, une interruption ou une frontière scelle le préfixe selon le contrat ; une recherche incomplète ne libère pas une action partielle.

## 2. Propriétaire unique, acquisition et mémoire

Le même propriétaire brut est utilisé par l'adaptateur de sélection et par les checkpoints du moteur. Son état source comporte exactement quatre champs :

| Champ | Contenu retenu |
| --- | --- |
| `packing_events` | Événements acquis depuis les retours sélectionnés |
| `packing_model` | Inventaire, grille, sélection, époque, essais et preuves du modèle courant |
| `packing_controls` | Translations unitaires ou transformations uniques apprises, avec leurs observations justificatives |
| `_packing_scene_cache` | Mesures initiales par époque, y compris les mesures nulles |

L'enveloppe native `native.preview_packing.v1` ajoute uniquement `schema`. Les snapshots sont immuables ; les restaurations valident l'enveloppe complète. Le chemin court pour une référence identique ou un état égal conserve l'appel réel de restauration. `propose` peut modifier le cache de mesure ; l'acquisition du modèle, des contrôles et des événements relève de `record`.

**Seuls les retours sélectionnés de Preview appellent son `record`.** Un retour d'une autre famille ne devient pas un essai Preview. En revanche, dès qu'un modèle est retenu, l'appelant conserve `preview_packing_state` et restaure réellement les quatre champs après chaque transition, y compris une transition étrangère. Ce checkpoint reste après Workshop et avant Axial. Chaque retour propre conserve également son enveloppe sous `preview_packing_event:<révision>`, même lorsqu'une frontière produit une liste d'événements vide. La [revue indépendante des sources et de l'intégration](lot6a-evidence/recovery/native-source-review.json) précise les chemins lus et les limites de cette conclusion.

Le [vérificateur de présence](../../scripts/verify-preview-packing-presence.py) vérifie le journal ordonné, les curseurs complets, le propriétaire exact, les propositions effectivement retournées, le lien entre chaque retour physique et son unique acquisition, les faits mémoire et les restaurations observées. Son mode de qualification synthétique ne remplace pas son contrôle des onze rapports de campagne et ne revendique aucune parité Python.

## 3. Preuves terminées

| Preuve | Résultat observé | Portée exacte |
| --- | --- | --- |
| [Comparaison originale indépendante](lot6a-evidence/recovery/oracle/source-reference-comparison-05.json) | **1 288 contrôles réussis** ; 15 cas initiaux, 10 sessions et 32 étapes source | Composant et calcul consommé sur données publiques synthétiques ; aucun jeu exécuté par cet oracle |
| [Tests Preview ciblés](lot6a-evidence/integrated-final-02/validation/preview-verification-execution.json) et [journal complet](lot6a-evidence/integrated-final-02/validation/preview-verification-execution.log.gz) | **58 tests réussis**, code retour nul | Quatre fichiers de tests : natif, référence, intégration et capture passive |
| [Suite finale complète](lot6a-evidence/integrated-final-02/validation-final/validation/delta-tests-run.json) | **4 795/4 795 tests réussis dans 126 fichiers**, code retour nul | Aucun échec, test annulé, ignoré ou TODO ; entrées et sources natives inchangées |
| [Contrôles finaux de livraison](lot6a-evidence/integrated-final-02/validation-final/validation/checks-run.json) | **5/5 réussis** | Types, audit des entrées, audit de migration, contrôle du diff et compilation ; sources natives inchangées |
| [Campagne froide KATA](lot6a-evidence/integrated-final-02/execution-kata.json) et [rapport conservé](lot6a-evidence/integrated-final-02/kata-campaign.json.gz) | **33 actions, 14 préfixes, 3 niveaux terminés** | Session commune neuve, progression naturelle et retours du jeu opaque ; aucun plan ni état appris fourni à l'agent |
| [Lecture originale à froid de cette campagne](lot6a-evidence/integrated-final-02/kata-source-parity-execution.json) | **174 événements**, soit **113 appels et 61 restaurations** ; **zéro différence** | Python original reconstruit depuis les observations publiques, sans amorçage par l'état ou le plan natif |
| Même lecture originale | **56 ablations**, dont **17 changent les actions proposées**, sans erreur d'ablation | Diagnostics déclarés de contribution sur les états reconstruits ; pas une preuve du routeur original complet |
| [Contrôle navigateur KATA](lot6a-evidence/integrated-final-02/browser/browser-qa.json) | **33 actions, 14 plans, 3 niveaux terminés** ; Pause confirmée à **9 actions**, puis une action fait passer le compteur à **10** | Session froide distincte, sur la copie exacte du build validé ; aucune mesure de latence déduite |
| [Qualification synthétique du lecteur de présence](lot6a-evidence/recovery/native-presence-synthetic-04-02.json) | 3 préfixes, 4 retours sélectionnés, 10 restaurations ; **22/22 mutations refusées** | Intégrité des preuves de présence, acquisition et restauration, sans exécution native ni oracle Python par ce lecteur |
| [Présence sur les onze rapports retenus](lot6a-evidence/integrated-final-02/regressions-final/preview-owner-presence.json) | **11/11 cas**, 289 préfixes, 390 retours, 33 acquisitions sélectionnées et **zéro acquisition passive** ; 611 restaurations | Cohérence des journaux, de la sélection, des faits retenus et des restaurations réellement observées ; aucune nouvelle parité Python revendiquée |
| [Intégrité finale](lot6a-evidence/integrated-final-02/delivery-integrity.json) | **`passed`** ; 703 fichiers source/tests, 371 entrées de build, 13 entrées d’exécution des régressions et 12 rapports restitués à l’identique | Gel, entrées enregistrées et transport sans perte ; les 1 786 originaux restent inchangés |
| [Readiness avant mesure](lot6a-evidence/performance-integrated/readiness.json) | **`ready`**, mesure autorisée | Preuves fonctionnelles et conditions préalables liées avant la fenêtre officielle |

Le [rapport complet de comparaison KATA](lot6a-evidence/integrated-final-02/kata-preview-source-parity.json.gz) conserve les différences, gardes, comparaisons, restaurations et ablations. Les 113 appels se répartissent en 14 propositions, 33 gardes avant, 33 gardes après et 33 acquisitions sélectionnées. Cette campagne ne contient pas de préfixe étranger à Preview ; ce volet relève des rejeux déclarés séparément.

L'[instrumentation du navigateur](lot6a-evidence/integrated-final-02/browser/static-preview-inputs.json) identifie la copie exacte de `dist` servie depuis le checkout. Les [observations conservées](lot6a-evidence/integrated-final-02/browser/observations.json) et la [capture finale](lot6a-evidence/integrated-final-02/browser/kata-three-levels.png) documentent la progression. Une première tentative de Pause, arrivée sur une frontière naturelle, reste enregistrée comme tentative ; le succès Pause cité dans le tableau est l'accusé `Paused.` ultérieur à neuf actions.

## 4. Tests finaux, rejeux et exclusions déclarées

Le [périmètre final](lot6a-evidence/planning/final-test-scope.json) contient **126 fichiers de tests effectivement listés** : 122 hérités conservés et quatre nouveaux fichiers Preview. L'[ancien périmètre de 129 fichiers](lot6a-evidence/planning/initial-test-scope-129.json) reste conservé. Trois modules hérités ont été exclus avant exécution, car leur chargement décode immédiatement la fixture LKEY, dont le budget cumulatif est fermé :

- `tests/v6-ranked-workshop-reference.test.ts` ;
- `tests/v6-ranked-workshop-kernel.test.ts` ;
- `tests/v6-symbol-transactions-kernel.test.ts`.

La [notice de clôture conservée](lot6a-evidence/planning/lkey-budget-closure-observation.json) motive ce périmètre. Ces exclusions ne sont pas comptées comme des tests passés ou ignorés ; elles limitent explicitement la couverture historique de cette exécution. Aucun nouveau chargement de ces trois modules n'est demandé par ce lot.

La [reprise complète](lot6a-evidence/integrated-final-02/validation-final/validation/delta-tests-run.json) est terminée : **4 795/4 795**, dans les 126 fichiers déclarés, sans échec, annulation, test ignoré ni TODO. Les [cinq contrôles finaux](lot6a-evidence/integrated-final-02/validation-final/validation/checks-run.json) sont également réussis. Les reçus de référence pour cette validation sont donc sous `lot6a-evidence/integrated-final-02/validation-final/validation`. Le [premier passage](lot6a-evidence/integrated-final-02/validation/delta-tests-run.json), **4 793/4 795 avec deux échecs**, reste conservé avec le statut `failed` ; deux attentes de registre obsolètes ont été corrigées avant la reprise complète.

Les [onze cas de rejeu déclarés](lot6a-evidence/integrated-final-02/regression-cases.json) ont deux bases de comparaison distinctes :

| Population | Cas | Nature de la preuve attendue |
| --- | --- | --- |
| **10 cas historiques** | CATR, RSWP, FOGW, VOIS, CONN, MIND, WEAV, TRIA, CRAF, ISOS | Même contrat historique de 17 comparaisons bornées sur les traces conservées ; aucune acquisition Preview attendue |
| **1 cas KATA du candidat courant** | `kata-060-self-consistency` | Répétabilité des retours publics de la nouvelle campagne, avec sélection Preview ; aucune comparaison KATA à native 0.58 n'est revendiquée |

Il s'agit donc de **dix régressions historiques et d'un contrôle de cohérence du candidat avec lui-même**. Le moteur recalcule ses commandes avant que l'hôte lui fournisse le retour public archivé. Un tel rejeu ne constitue pas une nouvelle réussite en jeu.

La synthèse finale des onze rejeux est acquise, et les tentatives antérieures restent conservées. Le [premier bilan](lot6a-evidence/integrated-final-02/regressions/regression-summary.json) conserve **neuf résultats réussis sur onze et 153/187 contrôles**, avec le statut `failed` : les exécutions WEAV et CRAF ont chacune terminé par `-9`. La [première reprise](lot6a-evidence/integrated-final-02/released-recovery/regressions/regression-summary.json) reste elle aussi `failed` : **CRAF a réussi ses 17 contrôles**, tandis que WEAV a de nouveau terminé par `-9`. Ces **trois SIGKILL** restent liés à leurs reçus et journaux ; leur cause demeure inconnue.

La [reprise WEAV avec un tas V8 limité à 1 024 Mio](lot6a-evidence/integrated-final-02/released-weav-1024/regressions/weav-051-execution.json) a effectivement échoué par **`-6`, après 73 actions**. Le [diagnostic mémoire conservé](lot6a-evidence/recovery/weav-memory/diagnostic.json) contient cette fois un message explicite de V8 signalant l’épuisement du tas JavaScript. Ce quatrième échec est documenté séparément : il ne fournit pas rétroactivement une cause aux trois SIGKILL précédents.

La [reprise finale WEAV à 1 536 Mio, sous verrou exclusif](lot6a-evidence/integrated-final-02/released-weav-exclusive-1536/regressions/regression-summary.json), a ensuite **réussi : 81 actions, 17/17 contrôles**, avec une [exécution englobante terminée](lot6a-evidence/integrated-final-02/released-weav-exclusive-1536-execution.json), code retour nul. Le gel natif, le harnais et les outils centraux restent inchangés. La limite de tas concerne ce rejeu enregistré, pas les mesures officielles de coût.

Les **onze succès individuels et leurs 187 comparaisons sont donc acquis** : neuf du premier bilan, un pour la reprise CRAF et un pour la reprise finale WEAV, soit **9 + 1 + 1**. La [première tentative de consolidation](lot6a-evidence/recovery/consolidation-attempt-01.json) a échoué sur `KeyError: inputs` en lisant le reçu englobant final, qui ne possède pas ce champ. La liaison de provenance a ensuite été corrigée : `actual_retained_child_execution_inputs` rattache explicitement le reçu englobant aux empreintes complètes avant et après conservées par le driver enfant. Aucun inventaire parent antérieur au lancement n’a été inventé. **Aucun rapport n’a été perdu et cette correction n’a nécessité aucun nouveau rejeu.**

Le [consolidateur](lot6a-evidence/consolidate-regression-recovery.py) a produit le [bilan final des régressions](lot6a-evidence/integrated-final-02/regressions-final/regression-summary.json), au statut **`passed` : 11/11 résultats et 187/187 contrôles**. La synthèse lie chaque résultat à son invocation réelle, au même gel et aux 17 contrôles inchangés par cas. Les quatre échecs de rejeu restent conservés séparément des onze résultats retenus ; la première tentative de consolidation n’est pas réécrite.

Le [contrôle de présence final](lot6a-evidence/integrated-final-02/regressions-final/preview-owner-presence.json) a lié les onze rapports sélectionnés à leur provenance d’exécution et à leur digest natif. Il couvre **289 préfixes : 14 sélectionnés et 275 étrangers**, puis **390 retours physiques : 33 sélectionnés et 357 étrangers**. Les 33 acquisitions Preview correspondent aux 33 retours sélectionnés ; aucun retour étranger n’est acquis passivement. Les **611 restaurations réelles** se répartissent en **578 restaurations natives et 33 restaurations source**.

L’[intégrité finale](lot6a-evidence/integrated-final-02/delivery-integrity.json) et la [readiness](lot6a-evidence/performance-integrated/readiness.json) sont acquises. L’[horloge cumulative KATA](lot6a-evidence/case-clock.json) est clôturée dans son budget : **2 256,934540 s sur 2 400 s**, avec **143,065460 s non consommées**. Ce total conserve la charge antérieure et les tentatives ; il n’a pas été remis à zéro.

## 5. Coût mesuré et règle d’acceptation

Le [protocole déclaré](lot6a-evidence/performance-integrated/protocol.md) compare la référence publiée **Site 95 / native 0.58.0**, remesurée, au gel **native 0.60.0 / `integrated-final-02`**. Les [outils adaptés depuis 5B](lot6a-evidence/recovery/cost-tools-adaptation.json) conservent les runners centraux, les populations, les calculs et les seuils. Les anciens résultats de coût ne fournissent aucun échantillon à cette reconstruction.

La [qualification structurelle](lot6a-evidence/performance-integrated/owner-structural-attribution.json) a effectué **64 contrôles** sur les formes fonctionnelles réelles. Les captures STCK/SMLP ne comportent aucun `record` Preview ni fait d'acquisition Preview : elles attribuent l'ajout du propriétaire, ses checkpoints et les fragments effectivement atteignables. Le [précontrôle statique](lot6a-evidence/performance-integrated/static-preflight.json) a effectué **68 contrôles**, sans mesure, et ne déclare ni l'isolation de la machine ni la readiness fonctionnelle.

La [politique globale](lot6a-evidence/performance-integrated/global-budget-policy.json) applique la consigne utilisateur au temps complet `session_elapsed`, **séparément pour STCK et SMLP**. Pour chaque jeu, elle compare la médiane groupée des huit sessions du candidat à celle des huit sessions de la référence :

`augmentation = médiane(candidat) / médiane(référence) − 1`

L'acceptation exige une augmentation **strictement inférieure à +10 % pour chacun des deux jeux**. Une égalité à +10 % échoue et un jeu ne compense pas l'autre. **Une phase dépassant +10 % peut être acceptée si ce critère global est satisfait.** Les dépassements, cohortes, dispersions et p95 disponibles restent visibles ; les phases imbriquées ne sont pas additionnées.

L'ordre déclaré est A1/B1/B2/A2, avec **32 sessions mesurées et 400 actions** ; huit chauffes et leurs 24 actions sont séparées. Aucun échantillon mesuré ni valeur extrême n'est écarté. La [séquence de commandes et de coordination](lot6a-evidence/coordination/cost-command-sequence.md) distingue la préparation, les conditions d'ouverture de la fenêtre et les revues ultérieures.

La [fenêtre officielle](lot6a-evidence/performance-integrated/window.json) est terminée. La [revue indépendante](lot6a-evidence/performance-integrated/owner-growth-review.json), au statut `qualified_owner_cost_review_passed`, a effectué **17 890 contrôles** et confirme `globalAccepted: true` pour les deux jeux. Les **32 sessions et 400 actions mesurées** sont conservées ; seules les huit chauffes et leurs 24 actions, déclarées avant mesure, sont séparées.

| Jeu | Médiane Site 95 / native 0.58.0, ms | Médiane native 0.60.0, ms | Augmentation globale | Décision |
| --- | ---: | ---: | ---: | --- |
| STCK | 10 953,832914 | 11 621,398595 | **+6,094357 %** | Accepté, strictement sous +10 % |
| SMLP | 16 915,812682 | 17 467,743862 | **+3,262812 %** | Accepté, strictement sous +10 % |

Les **16 diagnostics chronométriques agrégés** correspondent à huit mesures par jeu, dont `session_elapsed` ; **11/16** restent dans le budget observé. Les cinq dépassements de médiane de phase sont conservés et acceptés selon la règle globale de l’utilisateur :

| Jeu | Phase | Augmentation agrégée |
| --- | --- | ---: |
| STCK | `new_decision` | +14,980671 % |
| STCK | `acquisition_and_persistence` | +12,324410 % |
| SMLP | `new_decision` | +12,443161 % |
| SMLP | `known_prefix_service` | +11,550136 % |
| SMLP | `known_prefix_request` | +12,686196 % |

L’[échec réel du comparateur historique strict](lot6a-evidence/performance-integrated/aggregation-failure.json) reste conservé : les métadonnées de travail ont changé. L’analyse distincte applique le contrat structurel déclaré avant mesure, limité au propriétaire supplémentaire, à son cache négatif et aux quatre chemins de compteurs attribués aux graphes capturés. Elle ne transforme pas cet échec strict en réussite.

Le [rapport complet de coût](lot6a-evidence/performance-integrated/results.md) conserve tous les diagnostics agrégés, les deux cohortes, les dispersions, les p95 disponibles, l’inspection, la Pause et les échantillons mémoire. STCK/SMLP mesurent le chemin commun sans acquisition Preview ; leur résultat ne quantifie pas directement le coût d’une recherche positive de partition sur KATA et ne prouve pas une stabilité sur plusieurs heures.

## 6. Limites conservées et conditions de clôture

Le [contrat de filiation](lot6a-preview-packing-lineage.md) et la [revue indépendante](lot6a-evidence/recovery/native-source-review.json) conservent notamment les limites suivantes :

- La partition géométrique ne prouve ni un transport physique réalisable ni une réussite terminale officielle.
- La borne source de 2 000 ms concerne le calcul résiduel ; elle ne borne pas l'ensemble d'un appel de proposition. La mesure géométrique synchrone n'établit pas une latence maximale ni une Pause immédiate.
- À l'épuisement de la recherche bornée de contrôles, le natif bloque avant un recours possible de la source à un contrôle inconnu. Cette adaptation de sûreté reste nommée.
- Les gardes ultérieures portent sur la pose, sans nouvelle égalité intégrale de raster. Une mesure nulle peut rester en cache pour toute l'époque ; les contrôles appris ne sont pas universellement rétractés après divergence.
- Une sélection sans recoloration peut être reproposée. Le journal source et le cache ne sont pas compactés ; aucune performance constante sur plusieurs heures n'est établie.
- La comparaison du composant, la campagne KATA, le navigateur, les rejeux et le coût ont chacun leur portée. Aucun de ces reçus ne constitue une parité globale avec l'appelant V6 complet.

Les tests complets, les cinq contrôles finaux, la synthèse des onze rejeux, la présence, l’intégrité, la readiness et la décision de coût sont acquis. Le [contrôle des entrées de publication](lot6a-evidence/integrated-final-02/publication-inputs.json) a également réussi : `status: passed`, `costAccepted: true`, `publicationExecuted: false`. Il lie les preuves et les octets validés sans publier le candidat. La clôture de 6A exige encore un reçu terminal de publication. Les échecs et tentatives intermédiaires restent conservés : premier passage de tests à 4 793/4 795, trois SIGKILL de cause inconnue, quatrième échec de rejeu avec diagnostic d’épuisement du tas V8, première consolidation arrêtée sur un champ de provenance absent, échec du comparateur historique de coût et [capture synthétique 03](lot6a-evidence/recovery/native-presence-synthetic-03-02.json) échouée pour absence des faits mémoire. Les réussites ultérieures ne réécrivent aucun de ces échecs.

La capacité suivante du lot 6 reste **6B — `selected_rigid`**, après clôture effective de 6A. La [feuille de route générale](v6-delivery-roadmap.md) porte l'ordre et l'état des autres lots ; l'[index de preuves 6A](lot6a-evidence/README.md) donne les pièces déjà disponibles.
