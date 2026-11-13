# Lot 3D : protocole de coût 0.45 sous le critère global autorisé

Préparé le **2026-11-10T08:45:52.105995+00:00**, puis finalisé le **2026-11-10T08:48:53.934167+00:00** après le gel candidat et avant toute mesure officielle de cette révision. La [déclaration finale](declaration.json) lie les engagements. Le reçu [preparation.json](preparation.json) conserve le premier état de préparation ; sa liste de prérequis est un constat daté, pas le statut final de la fenêtre. Aucun benchmark n’est lancé par la préparation ou la finalisation du protocole.

## Sources et périmètre

Comparer **native 0.45.0**, qui ajoute la couche générique RootedLine et le sous-graphe V5 de calcul conditionnel qu’elle consomme, à **Site 72 / native 0.44.0 remesurée dans cette nouvelle fenêtre**. Les durées historiques de 0.44 ne fournissent aucun échantillon à ce bilan. Les originaux V5/V6 et les preuves historiques restent inchangés.

| Rôle | Identité | Inventaire |
| --- | --- | ---: |
| A : référence publiée | Site 72 / native 0.44.0 ; commit `a39997bffdca1ce080879d967d3f5eb95a88d544` ; digest `e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255` | 251 fichiers natifs |
| B : candidat gelé | Native 0.45.0 ; digest `5b5e59e14e4d417d92cacd6e79d21b6e8e833d715c8d05df2b74806bb09b40f3` | 256 fichiers natifs ; archive de 267 fichiers |

A s’exécute dans `/workspace/sites/sra-published-044`, B dans `/workspace/sites/sra-playground-step3d/.sites-checkout`. Les inventaires sont liés par [A](../baseline/source-manifest.json), [B](../final/source-manifest.json) et l’[archive B](../final/source-archive.json), puis par la déclaration finale. Aucun digest provisoire du candidat n’est présenté comme un gel.

Les [cas](cases.json) et la [politique de phases](comparison-policy.json) sont des copies exactes de `lot3c-current-evidence/performance`. Leurs SHA-256 sont respectivement `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur prose historique mentionne d’anciennes versions : elle conserve leur provenance et ne définit pas les sources A/B de cette fenêtre.

Les retours publics sont inchangés :

- STCK, dix actions par session : `docs/migration/native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`.
- SMLP, quinze actions par session : `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`.

Le moteur recalcule chaque commande avant de recevoir le retour enregistré. Aucun état appris ni trajet n’initialise les décisions. Ces cas mesurent le coût de la boucle commune sur deux parcours conservés ; ils ne démontrent pas une contribution propre de RootedLine.

## Effectifs et ordre

| Ordre | Série | Source | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | 0.44.0 publiée | 4 |
| 2 | B1, cohorte 1 | 0.45.0 gelée | 4 |
| 3 | B2, cohorte 2 | Même 0.45.0 gelée | 4 |
| 4 | A2, cohorte 2 | Même 0.44.0 publiée | 4 |

Chaque série mesure STCK puis SMLP. Chaque cas/série commence par une chauffe de trois actions, puis quatre sessions mesurées. Un worker distinct est créé par cas et série. Chaque session reçoit un runtime neuf à mémoire froide ; le processus et son JIT restent présents au sein du cas/série. Le paramètre du contrôleur `targetLevels: 3` n’affirme pas que les dix actions STCK achèvent trois niveaux.

Le total est **huit sessions par jeu/version, 32 sessions mesurées et 400 actions**. Les seules exclusions sont **huit chauffes, soit 24 actions**. Les deux cohortes sont menées jusqu’à leur terme indépendamment de leur première issue.

Aucune session mesurée, cohorte ou valeur extrême n’est supprimée. Aucun résultat favorable n’est sélectionné après coup. Une répétition officielle du même code ne remplace pas cette fenêtre. Un incident et ses sorties restent conservés ; ils ne constituent pas une cohorte complète. Une correction matérielle ultérieure impose un nouveau gel et un nouveau protocole.

## Décision globale et diagnostics

L’utilisateur a autorisé : « si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté. » Cette règle est inscrite avant les mesures dans la [politique globale](global-budget-policy.json).

**Global** désigne `session_elapsed`, la durée complète du rejeu par le contrôleur. Pour STCK et SMLP séparément, réunir les huit durées originales A et les huit durées originales B, puis calculer :

`variation globale = médiane(B) / médiane(A) − 1`

**Le coût est accepté si les deux variations globales sont strictement inférieures à +10 %.** Une variation exactement égale à +10 % échoue. Une baisse sur un jeu ne compense pas le dépassement de l’autre. Les phases imbriquées ne sont pas additionnées ; les ratios des cohortes ne sont pas moyennés.

Un dépassement de phase peut être accepté lorsque ce critère global est satisfait pour chaque jeu. Il reste publié avec sa valeur, son effectif, sa dispersion et son p95 disponible. Les seize résultats du comparateur historique restent des diagnostics :

| Phase | Mesure | Rôle |
| --- | --- | --- |
| `session_elapsed` | Durée complète du rejeu par le contrôleur | Critère global, un par jeu |
| `new_decision` | Appel natif `plan` | Diagnostic |
| `known_prefix_service` | Service d’une requête `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête avec transport worker et ordonnancement | Diagnostic |
| `known_prefix_guard` | Appel `authorize` pour un index supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

Le statut et le nombre de phases dans le seuil du comparateur historique sont conservés, même si un statut `budget_review_required` accompagne une acceptation globale. La décision globale est un reçu distinct et ne réécrit aucun résultat. Chaque cohorte conserve également sa comparaison complète.

La médiane est la valeur centrale ou la moyenne des deux valeurs centrales. Le p95 utilise le rang empirique `ceil(0.95 × n)` uniquement pour `n ≥ 20`. Les huit durées de session par version ne permettent donc pas de publier un p95 de session. Les observations de phase d’une même session sont corrélées ; leur dispersion est descriptive, sans intervalle de confiance ni tolérance supplémentaire de bruit.

## Outils conservés et intégrité

Les cinq outils historiques sont inchangés : `run-native-cost-window.py`, `measure-native-loop-costs.mjs`, `compare-native-loop-costs.mjs`, `compare-native-cost-cohorts.mjs` et `review-native-cost-consolidation.py`. Leurs octets ont été comparés aux engagements de la fenêtre précédente dans le reçu de préparation.

`review-native-global-cost-window.py` recalcule les médianes globales à partir des rapports conservés et vérifie que la déclaration précède la fenêtre. Il utilise les fonctions numériques de `review-native-global-cost-budget.py`, également inchangées. Le reçu global exige la revue de consolidation passée, liée aux quatre rapports bruts, aux deux comparaisons de cohorte et à l’agrégat.

Les lignes du registre de sessions sont comparées dans un ordre canonique en conservant leur multiplicité : ni l’effectif, ni le type, ni les valeurs ne changent. L’ordre A1/B1/B2/A2 est contrôlé séparément.

| Engagement finalisé avant la fenêtre | SHA-256 |
| --- | --- |
| Politique globale finale | `ce49ce6af3fb2f43f9c4453fc82453e5d4047235b85115f9c5b2e254ec01176b` |
| `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

La politique contient l’identité finale de B. La [déclaration](declaration.json), finalisée le **2026-11-10T08:48:53.934167+00:00**, lie les empreintes des politiques, de ce protocole, des inventaires et des outils. Elle précède toute observation de résultat et ne certifie pas encore l’achèvement des validations ni l’isolation nécessaire au lancement.

Le wrapper de mesure exécute les séries séquentiellement. Il vérifie les inventaires, cas, traces, déclarations source et outils avant chaque série et après la dernière ; les rapports A sont recopiés sans changement de leurs octets. Il copie lui-même `cases.json`, `comparison-policy.json` et `protocol.md` vers A aux mêmes chemins relatifs. Un dossier de résultats existant n’est pas remplacé.

## Prérequis au lancement

Le responsable doit d’abord terminer et lier au gel exact les contrats et tests, les contrôles de projet, la compilation, les régressions CATR/RSWP, les preuves d’intégration et de contribution ainsi que la vérification d’interface. Le statut réel de chaque campagne, y compris un objectif non atteint, reste explicite. La mesure STCK/SMLP ne clôture pas à elle seule une campagne ou le lot fonctionnel.

**Tous les tests, builds, exports, campagnes, rejeux, profils et contrôles navigateur doivent être terminés avant la fenêtre, et le preview arrêté.** Ils ne s’exécutent pas en parallèle des quatre séries. Pendant la mesure, seuls la lecture légère et le travail documentaire continuent. Le responsable consigne cette isolation et les prérequis dans un reçu de préparation finale. Les sources, tests, outils, cas et politiques ne changent pas pendant la fenêtre.

La campagne différée reste hors du périmètre de cette préparation. Aucune réussite de jeu ni équivalence du programme original complet n’est inférée de fixtures synthétiques.

## Commandes préparées

Contrôler la déclaration finale, après le gel :

```bash
python -B scripts/review-native-global-cost-window.py --check-protocol docs/migration/lot3d-evidence/performance/declaration.json
```

Depuis B, seulement après validation et isolation :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-published-044 docs/migration/lot3d-evidence/performance docs/migration/lot3d-evidence/baseline/source-manifest.json docs/migration/lot3d-evidence/final/source-manifest.json
```

Après les quatre séries, produire les comparaisons de cohorte à partir de leurs rapports `baseline.json` et `after.json`, puis l’agrégat à partir des six entrées de cohorte. Conserver les statuts diagnostiques d’origine et exécuter :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3d-evidence/performance
python -B scripts/review-native-global-cost-window.py docs/migration/lot3d-evidence/performance/combined-comparison.json docs/migration/lot3d-evidence/performance/declaration.json docs/migration/lot3d-evidence/performance/global-budget-decision.json --lot 3D --native-version 0.45.0
```

Aucun résultat de coût n’est anticipé. Les temps de ce budget excluent le moteur du jeu, le réseau de production et le rendu navigateur ; ils ne démontrent ni une vitesse de jeu en direct ni une stabilité pendant plusieurs heures.
