# Correction des coûts communs d'état : protocole officiel 0.42

Déclaré le **2026-11-10T04:22:29.574793+00:00**, avant toute mesure officielle de cette révision. Cette déclaration prépare une fenêtre distincte ; elle ne l'exécute pas.

## Sources, objectifs et entrées

Vérifier le budget de la correction **native 0.42.0** contre une **0.38.0 fraîchement mesurée**. La référence fonctionnelle est **Site 69 / 0.41.0**, dont le résultat officiel conservé reste **14/16** : persistance STCK **+14,269890051 %**, restauration SMLP **+11,220691835 %**. Aucun résultat historique n'est remplacé ou réutilisé comme échantillon de la nouvelle fenêtre.

| Rôle | Publication / moteur | Source exacte | Inventaire |
| --- | --- | --- | ---: |
| Coût A | Site 66 / 0.38.0 | Commit `b5d95c59bda43e5a5ee83dd067a0f28767205ab0`, digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` | 245 fichiers natifs |
| Fonctionnel publié | Site 69 / 0.41.0 | Commit `c1d5e044dce6291b3eee7320f29663ec5b80ea85`, digest `3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605` | 249 fichiers natifs |
| Correction B | 0.42.0 gelée | Digest **`2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19`** | 249 fichiers natifs ; 260 fichiers archivés |

Les manifestes [A](../base/source-manifest.json), [publié](../published/source-manifest.json) et [B](../final/source-manifest.json), ainsi que l'[archive B](../final/source-archive.json), lient les octets à leurs empreintes dans la [déclaration](declaration.json). Le checkout A est `/workspace/sites/sra-base-038` ; B est `/workspace/sites/sra-playground-step3b/.sites-checkout`. La correction modifie sept fichiers natifs : acquisition directe des descripteurs en conservant leur snapshot et leur ordre, copie détachée des seuls arbres possédés par le moteur, provenance privée des sorties de décodage, raccordements Inventory/CellProjection/contexte et numéro de version. Les sources V5/V6 originales restent inchangées.

Les [cas](cases.json) et la [politique](comparison-policy.json) sont des copies exactes de la fenêtre 0.41 : SHA-256 respectifs **`487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d`** et **`5ca681d721d510892cd957d2bde0074e5ea3410b02cfccd7ab43139c99a7af68`**. **Leur prose historique mentionne 0.40 ; elle décrit leur provenance. B est exclusivement le gel 0.42 ci-dessus.** Aucun cas, effectif, seuil, outil, placement de phase ou règle de clôture ne change.

Les traces conservées sont STCK `native-campaigns-v39/stck-public-trace.json.gz`, SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b`, et SMLP `native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`. Le moteur recalcule chaque commande avant que l'hôte ne fournisse le retour enregistré. Aucun état appris ni solution n'initialise une décision.

## Effectifs, ordre et chauffe

| Ordre | Exécution | Source | Sessions mesurées par jeu |
| --- | --- | --- | ---: |
| 1 | A1, cohorte 1 | 0.38.0 | 4 |
| 2 | B1, cohorte 1 | 0.42.0 gelée | 4 |
| 3 | B2, cohorte 2 | Même 0.42.0 gelée | 4 |
| 4 | A2, cohorte 2 | Même 0.38.0 | 4 |

Chaque série suit **STCK puis SMLP**. Une session STCK contient **10 actions** ; une session SMLP en contient **15**. `targetLevels: 3` est le paramètre du contrôleur, sans prétendre que dix actions terminent les trois niveaux STCK. Chaque cas/série commence par **une chauffe de trois actions**.

Le worker Node est distinct pour chaque cas de chaque série ; il sert la chauffe puis quatre sessions. Chaque session reçoit un runtime neuf et une mémoire froide, mais le processus et son JIT sont conservés au sein du cas/série. Les deux cohortes seront réalisées quelle que soit la première issue. Le résultat regroupe **huit sessions par jeu/version**, soit **32 sessions mesurées et 400 actions**. Les seules exclusions sont les **huit chauffes, 24 actions**.

Toutes les sessions, cohortes et valeurs extrêmes mesurées sont conservées. Il n'y aura ni exclusion pour bruit, ni sélection de cohorte favorable, ni répétition du même code choisie après lecture des résultats. Une modification ultérieure du code exige une nouvelle révision gelée et un autre protocole. Un incident ou rapport incomplet garde ses sorties et ne devient pas une cohorte complète. L'ordre ABBA limite une dérive temporelle simple sans garantir l'égalité du JIT, du GC ou de l'ordonnancement.

## Mesures et décision

Les cinq outils officiels restent **inchangés**, avec empreintes dans la déclaration : runner `measure-native-loop-costs.mjs`, comparateurs `compare-native-loop-costs.mjs` et `compare-native-cost-cohorts.mjs`, wrapper `run-native-cost-window.py`, revue `review-native-cost-consolidation.py`.

La politique conserve **huit phases pour chacun des deux jeux** :

| Phase | Mesure |
| --- | --- |
| `session_elapsed` | Rejeu complet par le contrôleur |
| `new_decision` | Appel natif `plan` |
| `known_prefix_service` | Service complet d'une requête `advance` retournant une action du préfixe |
| `known_prefix_request` | Même requête avec transport worker et ordonnancement |
| `known_prefix_guard` | Appel `authorize` pour un index de préfixe supérieur à zéro |
| `acquisition_and_persistence` | Appel `seal` |
| `persistence` | Appel `persistFamilies` |
| `restoration` | Appel `restoreFamilies` |

Les phases imbriquées ne s'additionnent pas. L'instrumentation garde les arguments, résultats et ordre des appels. Toute différence d'effectifs ou de travail reste à qualifier ; elle n'autorise pas à retirer des échantillons.

La décision porte sur les distributions réunies directement, **pas une moyenne des ratios de cohortes**. Pour chaque phase/jeu, variation = médiane B / médiane A − 1. Clôture : **16/16 médianes au plus à +10 %**, statut `passed`, `unresolved: []`. Tout dépassement, même avec forte dispersion, reste non résolu. Une amélioration d'une phase ne compense aucune autre phase hors seuil. Chaque cohorte conserve son propre résultat.

La médiane est la valeur centrale ou la moyenne des deux valeurs centrales. Le p95 est le rang empirique `ceil(0.95 × n)` seulement pour **n ≥ 20** ; les huit durées de session par version n'ont donc pas de p95 publié. Les observations intra-session sont corrélées. La dispersion des médianes de session décrit les mesures, sans intervalle de confiance ni tolérance. Les hausses de p95 restent visibles, mais ne deviennent pas des critères de clôture supplémentaires. La revue indépendante vérifie l'arithmétique, les effectifs, l'ordre et les empreintes ; son succès n'implique pas la conformité du budget.

## Validation préalable et isolation

Le [périmètre formel](../final/release-scope.json) contient **42 fichiers de tests**, soit les 41 contrats antérieurs et les nouveaux contrats de copie. Il doit réussir sur le gel final, avec ses propres nombres réellement exécutés. Typage, audits, contrôle du diff et build doivent également porter leurs reçus. La [revue du code](../diagnostic/code-review.json) ne remplace aucun de ces passages.

Les [régressions déclarées](../recorded-regression-cases.json) sont les deux rejeux froids contre 0.41 : CATR **12 actions / 3 niveaux / 8 préfixes**, RSWP **19 / 3 / 11**. CATR utilise sa campagne et sa trace réelles 0.41. Les décisions de référence RSWP sont celles rejouées par 0.41 ; les retours publics restent la trace réelle 0.38, sans réétiquetage. Le comparateur historique applique **17 critères par cas, 34 au total**. `passiveOwnerRequirements: []` n'ajoute aucune couverture propriétaire. Ces rejeux ne prouvent ni nouveau succès live, ni égalité de tous les payloads/graphes, ni gain de vitesse. Une campagne froide CATR et la vérification de l'interface restent des contrôles distincts.

La [série diagnostique](../diagnostic/protocol.md) STCK/SMLP 0.41 → 0.42 reste séparée. Sa [réserve d'isolation de référence](../diagnostic/isolation-deviation.json) est conservée ; aucune causalité de vitesse ne sera déduite de ses comparaisons instrumentées. Elle ne modifie pas ce budget.

**Tous les profils, tests, builds, exports, campagnes, rejeux et contrôles navigateur doivent être terminés avant la fenêtre officielle ; le preview doit être arrêté.** Aucun de ces travaux ne s'exécute en parallèle. Seules la lecture légère et la rédaction documentaire continuent. Le responsable de livraison donne le départ après ces prérequis ; cette déclaration ne les anticipe pas.

Les mêmes cas, politique et protocole seront copiés aux mêmes chemins relatifs dans A. Le wrapper vérifie les inventaires natifs, traces, déclarations source et outils avant chaque série et après la dernière. Les rapports A sont recopiés à l'identique dans la livraison. Toutes les sorties sont exclusives et restent conservées. Les sources, tests et outils ne sont plus modifiés durant ces mesures.

## Commandes préparées

Depuis B, après validation et arrêt des autres travaux :

```bash
python -B scripts/run-native-cost-window.py /workspace/sites/sra-base-038 docs/migration/lot3b-state-cost-evidence/performance docs/migration/lot3b-state-cost-evidence/base/source-manifest.json docs/migration/lot3b-state-cost-evidence/final/source-manifest.json
```

Après la fin des quatre séries, appliquer successivement le comparateur de coût à `cohort1/baseline.json` et `cohort1/after.json`, puis à `cohort2/baseline.json` et `cohort2/after.json`, avec la politique conservée. L'agrégateur reçoit cette même politique et les trois fichiers de chaque cohorte ; sa sortie est `combined-comparison.json`. Terminer par :

```bash
python -B scripts/review-native-cost-consolidation.py docs/migration/lot3b-state-cost-evidence/performance
```

Au moment de cette déclaration, le gel 0.42 et ses 42 fichiers de contrats sont identifiés ; les validations restent à consolider. Aucun `window.json`, dossier de cohorte ni résultat officiel n'existe dans ce nouveau dossier. Les diagnostics en cours sont distincts. **3B reste ouvert et 3C en attente** jusqu'à satisfaction de toutes les obligations déclarées. Les temps de ce budget excluent moteur de jeu, réseau de production et rendu navigateur ; ils ne démontrent pas la stabilité de sessions de plusieurs heures.
