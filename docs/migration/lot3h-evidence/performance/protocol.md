# Lot 3H : protocole de coût 0.49 sous le critère global autorisé

Préparé le **2026-11-10T13:12:39.751688-03:00**. Finalisé le **2026-11-10T13:18:16.454358-03:00** après le gel candidat et avant toute mesure officielle. La [déclaration](declaration.json) lie les identités et empreintes. Le reçu [preparation.json](preparation.json) conserve le premier état daté. La préparation et la finalisation ne lancent aucun benchmark.

## Sources et périmètre

Comparer **native 0.49.0**, qui transfère la couche générique CrossedPrefix et ses contrats consommés, à **Site 76 / native 0.48.0 remesurée dans cette fenêtre**. Les temps historiques de 0.48 ne fournissent aucun échantillon au nouveau bilan. Les sources V5/V6 originales et les preuves historiques sont conservées.

| Rôle | Identité | Inventaire |
| --- | --- | --- |
| A : référence publiée | Site 76 / native 0.48.0 ; commit `fbbc3fb6b796c0ba359654da7234008767090e1f` ; digest `fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26` | 266 fichiers natifs |
| B : candidat | Native **0.49.0**, digest `d6cb9abdf48a9062936d4647dbd809dc4cee1d1528f85e973fda83c7af8e6054` ; **268 fichiers natifs**, archive de **279 fichiers** | [Inventaire B](../final/source-manifest.json), [archive B](../final/source-archive.json) |

A s’exécute dans `/workspace/sites/sra-published-048`, B dans `/workspace/sites/sra-playground-step3d/.sites-checkout`. L’[inventaire A](../baseline/source-manifest.json) est vérifié sur le véritable checkout publié. Aucun digest provisoire n’est assimilé à un gel.

Les [cas](cases.json) et la [politique de phases](comparison-policy.json) sont des copies exactes de `lot3g-evidence/performance`. SHA-256 : `487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d` et `5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`. Leur texte historique conserve sa provenance ; les identités A/B courantes sont celles du présent protocole et de la politique globale.

Les retours publics restent inchangés :

- STCK : dix actions par session, `docs/migration/native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`.
- SMLP : quinze actions par session, `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`.

Le moteur recalcule chaque commande avant de recevoir son retour enregistré. Ni état appris ni trajet ne préinitialisent les décisions. Ces deux parcours mesurent la boucle commune et ne démontrent pas une contribution propre de CrossedPrefix.

## Effectifs, ordre et conservation

| Ordre | Série | Version | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | 0.48.0 publiée | 4 |
| 2 | B1, cohorte 1 | 0.49.0 gelée | 4 |
| 3 | B2, cohorte 2 | Même 0.49.0 gelée | 4 |
| 4 | A2, cohorte 2 | Même 0.48.0 publiée | 4 |

Chaque série exécute STCK puis SMLP. Chaque cas/série commence par une chauffe distincte de trois actions et utilise un worker distinct. Les quatre sessions mesurées ont chacune un runtime neuf à mémoire froide ; le processus et le JIT restent présents au sein du cas/série. Le paramètre `targetLevels: 3` ne signifie pas que STCK résout trois niveaux en dix actions.

Total : **huit sessions par jeu/version, 32 sessions mesurées et 400 actions**. Seules **huit chauffes, soit 24 actions**, sont exclues. Aucune session mesurée, cohorte ni valeur extrême n’est supprimée. Les deux cohortes sont terminées indépendamment du premier verdict. Aucun résultat favorable n’est sélectionné après coup et aucune tolérance de bruit n’est ajoutée. Une nouvelle fenêtre ne remplace pas les résultats du même gel ; tout incident et ses sorties restent conservés. Une correction matérielle impose un nouveau gel et un protocole distinct.

## Critère global et diagnostics

L’autorisation courante est : « si le global reste en dessous de 10% d'augmentation alors une phase qui dépasse 10% peut être accepté. » Elle est fixée avant mesure dans la [politique globale](global-budget-policy.json).

**Global** désigne `session_elapsed`, la durée complète du rejeu par le contrôleur. Pour chaque jeu séparément, réunir les huit durées A et les huit durées B, puis calculer `médiane(B) / médiane(A) − 1`. Le coût est accepté si **les deux augmentations sont strictement inférieures à +10 %**. Une valeur exactement égale à +10 % échoue. Aucune compensation entre jeux ; aucune somme de phases imbriquées ; aucune moyenne des ratios de cohorte.

Un dépassement de phase est acceptable sous ce critère global, tout en restant visible avec effectif, dispersion et p95 disponible. Le comparateur historique conserve son statut diagnostic, y compris `budget_review_required`, et son nombre de critères conformes sur seize. La décision globale est un reçu séparé qui ne réécrit aucune comparaison.

| Mesure | Définition | Rôle |
| --- | --- | --- |
| `session_elapsed` | Durée complète du rejeu par le contrôleur | Critère global par jeu |
| `new_decision` | Appel natif `plan` | Diagnostic |
| `known_prefix_service` | Service `advance` retournant une action du préfixe | Diagnostic |
| `known_prefix_request` | Même requête, transport worker et ordonnancement inclus | Diagnostic |
| `known_prefix_guard` | Appel `authorize` pour un index supérieur à zéro | Diagnostic |
| `acquisition_and_persistence` | Appel `seal` | Diagnostic |
| `persistence` | Appel `persistFamilies` | Diagnostic |
| `restoration` | Appel `restoreFamilies` | Diagnostic |

La médiane est la valeur centrale, ou la moyenne des deux valeurs centrales. Le p95 est le rang empirique `ceil(0.95 × n)` pour `n ≥ 20` uniquement. Les huit sessions par version ne permettent pas de p95 de session. Les observations d’une même session sont corrélées : la dispersion est descriptive, sans intervalle de confiance ni marge de bruit ajoutée.

## Outils, intégrité et isolation

Les cinq outils historiques restent byte-identiques : `run-native-cost-window.py`, `measure-native-loop-costs.mjs`, `compare-native-loop-costs.mjs`, `compare-native-cost-cohorts.mjs` et `review-native-cost-consolidation.py`. Les deux outils globaux conservés relisent les quatre rapports, les comparaisons de cohorte, l’agrégat et la revue arithmétique indépendante ; ils recalculent les médianes depuis chaque session et vérifient l’antériorité de la déclaration.

| Engagement | SHA-256 |
| --- | --- |
| Politique globale actuelle | `cd36bc36abde70765edbb6dc0c78165c889a7c5fed1c88f8b7c72d650a4652f7` |
| `review-native-global-cost-window.py` | `9ab2ecd9d6ddf234e96332421a6e55937a766495c1a20dd223f4441d6b516940` |
| `review-native-global-cost-budget.py` | `b4312bcdae058ba58c16b4e5e24cb53626496b38f8a154834e0452a43e97d341` |

Les lignes du registre sont comparées dans un ordre canonique avec multiplicité préservée ; l’ordre A1/B1/B2/A2 est vérifié séparément. Le wrapper contrôle les inventaires, traces, déclarations source et outils avant chaque série et à la fin. Il recopie les cas, la politique de phases et ce protocole vers A sans altérer leurs octets. Il refuse de remplacer une sortie existante.

Avant lancement, le responsable lie au gel exact les contrats et tests, contrôles du projet, compilation, régressions CATR/RSWP, boucle intégrée, contribution, vérification d’interface et intégrité. Pour 3H, la boucle et la contribution seront qualifiées par leurs reçus réellement obtenus. Une preuve synthétique ne sera pas présentée comme une contribution dans un jeu ; tout nouveau cas choisi aura un objectif et une horloge cumulée déclarés avant sa campagne. Il conserve tout objectif non atteint et toute limitation de parité. Le coût STCK/SMLP ne clôture aucune réserve fonctionnelle.

**Tous les tests, builds, exports, campagnes, rejeux, profils et contrôles navigateur sont terminés avant la fenêtre ; le preview est arrêté.** Aucun calcul concurrent de ces catégories n’est exécuté durant les quatre séries. Seules des lectures légères et la documentation continuent. Aucun outil, source, test, cas ou politique ne change pendant la fenêtre. La [trame de readiness](readiness-template.json) est préparatoire ; seul un reçu final renseigné à partir d’éléments réellement achevés pourra autoriser le lancement.

CWSE, SK48, FOGW et VOIS gardent leurs limites et budgets cumulés antérieurs. Aucune tentative sur ces cas n’appartient à la préparation de cette fenêtre. Les fixtures et preuves de composant ne démontrent pas la réussite d’un jeu ni la parité de l’appelant original complet.

## Commandes prêtes

Après le gel candidat, finaliser la déclaration sans lancer de mesure :

```bash
python -B docs/migration/lot3h-evidence/prepare-cost-protocol.py --finalize
```

Après readiness et isolation réelles, le responsable peut lancer :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-published-048 docs/migration/lot3h-evidence/performance docs/migration/lot3h-evidence/baseline/source-manifest.json docs/migration/lot3h-evidence/final/source-manifest.json
```

Après les quatre séries, produire les deux comparaisons de cohorte puis l’agrégat avec les outils conservés. Garder leurs statuts diagnostiques, puis exécuter :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3h-evidence/performance
python -B scripts/review-native-global-cost-window.py docs/migration/lot3h-evidence/performance/combined-comparison.json docs/migration/lot3h-evidence/performance/declaration.json docs/migration/lot3h-evidence/performance/global-budget-decision.json --lot 3H --native-version 0.49.0
```

Aucun résultat de coût n’est anticipé. Cette fenêtre exclut le moteur du jeu, le réseau de production et le rendu navigateur ; elle ne démontre ni une vitesse de jeu en direct ni une stabilité de plusieurs heures.
