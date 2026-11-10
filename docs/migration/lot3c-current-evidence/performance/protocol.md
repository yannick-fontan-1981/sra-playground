# Lot 3C : protocole de coût 0.44 sous critère global autorisé

Déclaré le **2026-11-10T07:17:16.220373+00:00**, puis finalisé le **2026-11-10T07:19:43.023423+00:00**, avant toute mesure officielle de cette révision. Cette déclaration prépare la fenêtre ; elle ne l’exécute pas et n’anticipe aucun résultat.

## Sources et objectif

Comparer la source **native 0.44.0 gelée**, qui corrige le rattachement de l’évidence courante à `exposed_reception_plan` dans le moteur commun, à la **publication 71 / native 0.43.0 à remesurer dans cette nouvelle fenêtre**. Les mesures antérieures de 0.43 ne sont pas réutilisées comme échantillons. Les fichiers originaux V5/V6 restent inchangés.

| Rôle | Source exacte | Inventaire |
| --- | --- | ---: |
| A : référence publiée | Site 71 / 0.43.0 ; commit `e9fd144112b05a65af5c88e9f05c541f43ed8ed7` ; digest `3e88aa12214fd3d4a4feb8d63b946123b8394cb4a0cbd0a156cc059c37f7b46c` | 251 fichiers natifs |
| B : candidat gelé | Native 0.44.0 ; digest **`e914399487992c3f53b3058ee734c470d738594e7344285799203462fac6a255`** | 251 fichiers natifs ; archive de 262 fichiers |

Les manifestes [A](../baseline/source-manifest.json), [B](../final/source-manifest.json), l'[archive B](../final/source-archive.json) et la [déclaration](declaration.json) lient les entrées à leurs empreintes. A s'exécute dans `/workspace/sites/sra-published-043`, B dans `/workspace/sites/sra-playground-step3c/.sites-checkout`.

Les [cas](cases.json) et la [politique de phases](comparison-policy.json) sont des **copies exactes** de la fenêtre 0.43, SHA-256 respectifs `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur prose historique mentionne 0.38 et 0.40 : elle documente leur provenance et ne nomme pas les sources A/B de cette fenêtre. Leur seuil de phase demeure utilisé pour publier les diagnostics historiques comparables. **Le critère de clôture est désormais celui de la [politique globale](global-budget-policy.json), déclaré ci-dessous avant la mesure.**

Les retours publics sont inchangés : STCK10 depuis `native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`, et SMLP15 depuis `native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`. Le moteur recalcule chaque commande avant réception du retour public enregistré ; aucun état appris ni trajet n'initialise ses décisions.

## Effectifs, ordre et exclusions

| Ordre | Série | Source | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | 0.43.0 publiée | 4 |
| 2 | B1, cohorte 1 | 0.44.0 gelée | 4 |
| 3 | B2, cohorte 2 | Même 0.44.0 gelée | 4 |
| 4 | A2, cohorte 2 | Même 0.43.0 publiée | 4 |

Chaque série mesure **STCK puis SMLP** : dix actions par session STCK, quinze par session SMLP. Le paramètre du contrôleur `targetLevels: 3` ne signifie pas que dix actions achèvent trois niveaux STCK. Chaque jeu/série commence par **une chauffe de trois actions**.

Un worker distinct est créé par cas et série ; il sert une chauffe puis quatre sessions. Chaque session reçoit un runtime neuf à mémoire froide, tandis que le processus et son JIT sont conservés au sein du cas/série. Les deux cohortes seront achevées quelle que soit la première issue.

Le bilan réunit **huit sessions par jeu/version, 32 sessions mesurées et 400 actions**. Les seules exclusions prévues sont **huit chauffes, soit 24 actions**. Aucune session mesurée, cohorte ni valeur extrême ne sera supprimée. Aucun résultat favorable ne sera choisi après coup, et aucune répétition officielle du même code ne remplacera cette fenêtre. Un incident reste conservé et ne devient pas une cohorte complète. Une correction matérielle ultérieure exige un nouveau gel et un nouveau protocole.

## Règle globale et diagnostics de phase

L'utilisateur a autorisé : « si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté. » Cette règle s'applique ici **avant la nouvelle fenêtre**.

**Global** désigne la durée complète `session_elapsed` de chaque cas testé. Pour STCK et SMLP séparément, réunir les huit durées originales A et les huit durées originales B, puis calculer :

`variation globale = médiane(B) / médiane(A) − 1`

**Acceptation de coût : les deux variations globales sont strictement inférieures à +10 %.** Un résultat exactement égal à +10 % ne satisfait pas cette formulation. Une baisse d'un jeu ne compense pas le dépassement de l'autre. On n'additionne pas les phases imbriquées et on ne moyenne pas les ratios des cohortes.

Un dépassement de phase peut être accepté lorsque le critère global est satisfait pour chaque jeu. **Il reste publié avec sa valeur, son effectif, sa dispersion et son p95 disponible.** Les seize mesures du comparateur d'origine restent conservées :

| Phase | Mesure | Usage dans cette fenêtre |
| --- | --- | --- |
| `session_elapsed` | Durée complète du rejeu par le contrôleur | **Critère global, un par jeu** |
| `new_decision` | Appel natif `plan` | Diagnostic |
| `known_prefix_service` | Service d'une requête `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête avec transport worker et ordonnancement | Diagnostic |
| `known_prefix_guard` | Appel `authorize` pour un index de préfixe supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

Le statut de l'ancien comparateur et son nombre de phases dans le seuil seront conservés, même si `budget_review_required` accompagne une acceptation sous le critère global. La décision globale est un **reçu distinct** ; aucun ancien résultat n'est réécrit. Chaque cohorte conserve également son résultat complet. L'acceptation de coût ne remplace ni la validation fonctionnelle, ni la preuve de contribution de 3C.

La médiane est la valeur centrale ou la moyenne des deux valeurs centrales. Le p95 utilise le rang empirique `ceil(0.95 × n)` uniquement pour **n ≥ 20** ; huit durées de session par version ne permettent donc pas de publier un p95 de session. Les observations de phase au sein d'une même session sont corrélées. La dispersion est descriptive, sans intervalle de confiance ni tolérance supplémentaire de bruit.

## Outils et contrôles

Les cinq outils historiques demeurent inchangés : `run-native-cost-window.py`, `measure-native-loop-costs.mjs`, `compare-native-loop-costs.mjs`, `compare-native-cost-cohorts.mjs` et `review-native-cost-consolidation.py`. Le vérificateur conservé `review-native-global-cost-window.py` lit seulement les rapports conservés, recalcule les médianes globales et vérifie la déclaration antérieure à la fenêtre avant d'écrire sa décision distincte. Il réutilise les fonctions numériques et de lecture du générateur 3B `review-native-global-cost-budget.py`, dont les octets et les reçus restent inchangés. Cette séparation conserve l'acceptation rétrospective de 3B et la déclaration préalable de 3C avec leurs portées respectives.

Finalisation des engagements le **2026-11-10T07:19:43.023423+00:00**, toujours avant le lancement :

| Entrée engagée par ce protocole surveillé | SHA-256 |
| --- | --- |
| [Politique globale](global-budget-policy.json) | `da452c7a5378882ba08e5d4bbe4f4c8539e8711bbf54cbbc84d7e1295a63cd0f` |
| Revue préalable 3C `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| Calcul numérique 3B conservé `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

La revue exige aussi le reçu `consolidation-review.json` passé, lié exactement à cette fenêtre, à l'agrégat, aux quatre rapports bruts, aux deux comparaisons de cohorte et au reviewer historique inchangé. Elle compare les lignes complètes du registre de sessions dans un ordre canonique en conservant leur multiplicité : seule la présentation de ces lignes peut différer, jamais leur effectif, leur type ni leurs valeurs. L'ordre d'exécution A1/B1/B2/A2 reste contrôlé séparément dans la fenêtre.

La [déclaration](declaration.json) conserve les mêmes empreintes et sa date de finalisation réelle avant le lancement. Le hash de ce protocole, surveillé par la fenêtre, lie donc la politique et ses outils avant toute observation de résultat. Le contrôle préalable lit ces engagements sans lancer de mesure :

```bash
python -B scripts/review-native-global-cost-window.py --check-protocol docs/migration/lot3c-current-evidence/performance/declaration.json
```

Le wrapper mesure **A1/B1/B2/A2 séquentiellement**, vérifie les inventaires natifs, les cas, traces, déclarations source et outils avant chaque série et après la dernière, puis recopie les rapports A sans altérer leurs octets. Il prépare lui-même les copies de `cases.json`, `comparison-policy.json` et `protocol.md` dans A, aux mêmes chemins relatifs. Ses sorties sont exclusives : un dossier de résultats existant n'est pas remplacé.

Avant le départ, le responsable doit vérifier le périmètre formel et ses tests, les contrôles de projet, le build, les régressions, la campagne intégrée et sa contribution ainsi que l'interface. Les reçus doivent identifier le gel exact. La campagne CWSE, ses mesures de contribution et les retours CATR/RSWP sont des preuves distinctes de ces coûts sur STCK/SMLP ; aucun résultat de jeu n'est anticipé ici.

**Tous les profils, tests, builds, exports, campagnes, rejeux et contrôles navigateur doivent être terminés avant cette fenêtre ; le preview doit être arrêté.** Ils ne s'exécutent pas en parallèle des quatre séries. Seules la lecture légère et la rédaction documentaire continuent. Le responsable consigne cette préparation avant d'autoriser le lancement. Les sources, tests, outils, cas et politiques ne changent pas pendant les mesures.

## Commandes préparées

Depuis B, seulement après validation et isolation :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-published-043 docs/migration/lot3c-current-evidence/performance docs/migration/lot3c-current-evidence/baseline/source-manifest.json docs/migration/lot3c-current-evidence/final/source-manifest.json
```

Après les quatre séries, produire les comparaisons de cohorte à partir des rapports `baseline.json` et `after.json` de chacune, puis l'agrégat avec les six entrées de cohorte. Conserver leurs statuts diagnostiques d'origine, puis exécuter sans modifier leurs octets :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3c-current-evidence/performance
python -B scripts/review-native-global-cost-window.py docs/migration/lot3c-current-evidence/performance/combined-comparison.json docs/migration/lot3c-current-evidence/performance/declaration.json docs/migration/lot3c-current-evidence/performance/global-budget-decision.json --lot 3C --native-version 0.44.0
```

La déclaration finale lie le gel, la politique globale et les deux outils de revue distincts. Le responsable vérifie le contrat préalable, les prérequis fonctionnels et l’isolation avant le départ. Aucun outil ni protocole ne sera modifié une fois la fenêtre commencée.

Au moment de cette préparation, **aucune fenêtre ni cohorte de coût de la correction 0.44 n’existe**. La fenêtre 0.43 antérieure reste conservée dans `lot3c-evidence` et ne fournit aucun échantillon à la nouvelle fenêtre. La préparation n'affirme pas que les autres validations sont terminées. Les temps de ce budget excluent moteur du jeu, réseau de production et rendu navigateur ; ils ne démontrent ni vitesse de jeu live ni stabilité sur plusieurs heures.
