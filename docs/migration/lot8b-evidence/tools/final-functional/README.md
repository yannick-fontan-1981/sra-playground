# Lot 8B : renouvellement fonctionnel pour l’identité finale 0.67

Ces outils sont des dérivés prospectifs des outils de `tools/delivery`. Les fichiers historiques restent intacts. Ils vérifient le candidat final **0.67.0**, 331 fichiers natifs, digest canonique `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a`, face au publié **Site 107 / 0.66.0**, commit `4ff7bf45286a8a19d34401988adca587253ae41e`, 329 fichiers, digest `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316`.

La préparation et la vérification de syntaxe ne constituent aucune nouvelle exécution fonctionnelle. Une déclaration distincte doit figer les entrées, les commandes et les chemins de sortie avant l’exécution. Les captures et leurs lectures restent `preparedOnly: true` lorsqu’il s’agit des formes STCK/SMLP, et `officialPerformanceEligible: false` dans tous les cas. Elles ne donnent ni acceptation de coût ni autorisation implicite de publication.

## Pourquoi renouveler les graphes

Le seul changement de production attendu depuis le candidat qualifié est `NATIVE_V6_IMPLEMENTATION` dans `src/logos-engine/v6-native-runtime.ts`, de 0.66.0 à 0.67.0. Ce champ entre dans le manifeste d’implémentation calculé par `createNativeV6Runtime`. Il change donc le `sourceDigest` du runtime, les origines et chaînes des graphes, le digest d’exécution et les identités d’autorisation, y compris celles exposées par le service.

Les preuves historiques restent valides pour leurs octets et leur identité historiques. Elles ne sont pas rebaptisées comme exécutions finales. La réconciliation des algorithmes requiert la correspondance de tous les fichiers natifs et l’égalité exacte du fichier runtime après la seule substitution inverse du littéral déclaré.

| Preuve antérieure | Traitement pour la version finale |
| --- | --- |
| 524 tests et sous-tests sur 23 modules | Conserver les résultats historiques et vérifier leurs entrées. Ne pas annoncer 524 nouvelles exécutions. La seule substitution d’identité ne justifie pas une répétition générale des composants et voisins inchangés. |
| 11 régressions enregistrées, 187 projections | Réutilisation argumentée sur les algorithmes et données inchangés, avec réconciliation explicite de la seule identité. Les résultats demeurent ceux de la source 0.66 de développement. Aucun nouveau replay ni remplacement d’une référence par une comparaison avec soi-même. |
| Quatre formes STCK/SMLP du publié 0.66 | Réutiliser **exactement** la capture et le reçu historiques ; même source publiée, mêmes octets natifs, mêmes traces et mêmes formes. Le nouveau lecteur lie leurs chemins, tailles et SHA-256, ainsi que le générateur et sa dérivation d’origine. |
| Quatre formes STCK/SMLP du candidat | Nouvelle capture du candidat 0.67, puis nouvelle lecture de la paire avec le publié retenu. Le lecteur accepte le générateur historique uniquement pour la capture A précisément figée ; B doit porter le nouveau générateur. |
| Inventaire des propriétaires et programmes | Refaire l’inventaire des deux fabriques réelles ; il doit retrouver 61 propriétaires pour A, 62 pour B, avec uniquement BranchRouting ajouté et les 28 programmes de familles préservés. Aucun runtime n’est initialisé par cet inventaire. |
| Cinq chaînes BranchRouting, 26 retours synthétiques | Nouvelle capture puis nouvelle lecture sous l’identité finale. Les cinq scénarios, les données, les gardes, les interventions, les budgets et les assertions sont inchangés. |
| Compilation et audits affectés | Refaire la compilation finale, qui comprend le contrôle TypeScript, et les audits appropriés. La disponibilité des références opaques et des entrées de compilation est vérifiée séparément. |

## Fichiers et chemins convenus

Les nouveaux résultats appartiennent uniquement à `docs/migration/lot8b-evidence/final-version-067-01`. Les fichiers natifs figés sont `candidate-native.json` et `baseline-native.json` dans ce dossier.

| Opération | Outil dérivé | Résultat prévu sous le dossier final |
| --- | --- | --- |
| Inventaire des fabriques | `work-forms/record-owner-source-inventory.mjs` | `work-inventory-01/owner-source-inventory.json` |
| Capture du candidat uniquement | `work-forms/capture-cost-owner-graphs.mjs` | `work-candidate-01/candidate.json.gz` et son reçu |
| Lecture de la paire | `work-forms/qualify-cost-owner-graphs.mjs` | `work-qualify-01/graph-review.json`, différences brutes et `work-forms.json` |
| Capture BranchRouting | `branch-common-capture-v2.mjs` | `branch-capture-01/capture.jsonl.gz` et son reçu |
| Lecture BranchRouting | `branch-common-qualify-v2.mjs` | `branch-qualify-01/graph-review.json` et `work-forms.json` |

La capture du candidat doit recevoir **le manifeste de cas historique inchangé** `docs/migration/lot8b-evidence/tools/delivery/work-forms/cases.json`. Ce chemin fait partie du reçu de A ; sa copie sous un autre chemin n’est pas interchangeable. Le lecteur de la paire reçoit les deux fichiers historiques de A dans `delivery-qualification-01/work-baseline-01`, et les nouveaux fichiers de B. Les schémas de résultat existants sont conservés ; le lecteur ajoute la distinction des deux générateurs à `captureTools` et la provenance figée de A à `retainedBaseline`.

`run-functional-command.py` est le superviseur dérivé. Il utilise la même profondeur de racine, une nouvelle destination, les mêmes inventaires avant/après, journaux conservés et traitements des processus enfants. Il lie également le SHA-256 du superviseur historique. Chaque commande est préalablement bornée entre 1 et 300 secondes ; le superviseur ne lance aucun retry automatique et refuse un dossier de tentative déjà présent. Les captures conservent la limite V8 existante de 1536 Mio dans la déclaration d’exécution ; cette limite n’est pas présentée comme une borne absolue de RSS.

## Portée conservée

Les contrôles de commandes, tickets, retours, acquisition, restauration, graphes complets, ordre des deltas et attribution étroite des horloges restent en place. Les nouvelles différences brutes ne sont pas effacées. Les seuls nouveaux changements de logique des outils sont les épingles d’identité, les destinations, les filiations de générateur et la distinction explicite du générateur historique de A. Des vérifications supplémentaires imposent le littéral d’implémentation observé pour chaque rôle et chaque graphe BranchRouting.

Les formes STCK/SMLP n’établissent pas une acquisition positive de BranchRouting. Les chaînes synthétiques BranchRouting qualifient l’entrée `NativeV6Runtime`, et ne deviennent pas des preuves positives du service public 64 × 64, de tickets ou de worker. L’échec historique avant fabrication du runtime est conservé comme antécédent. Le corpus indépendant original n’est pas régénéré. LKEY reste fermé, aucune nouvelle campagne de jeu n’est lancée.

Le travail ordinaire ne prend aucun verrou global. Une mesure officielle ultérieure et la publication restent des étapes distinctes avec exclusivité courte. Le seuil de coût reste la médiane de session complète strictement inférieure à +10 % pour STCK et pour SMLP séparément ; un dépassement d’une phase est recevable si les deux globals passent, sans compensation entre jeux et avec tous les échantillons conservés.

## Filiation et état de préparation

`derivation.json` donne pour chacun des six outils le fichier d’origine, ses octets et son SHA-256, le dérivé et son SHA-256, ainsi que le diff complet dans `derivation-diffs`. `syntax-checks.json` conserve uniquement les cinq vérifications `node --check`. `runner-syntax-check.json` conserve uniquement l’analyse Python par `ast.parse`. Aucun import natif ni test fonctionnel n’est exécuté pendant ces contrôles. La revue indépendante et les reçus d’exécution sont produits séparément par l’agent responsable du jalon.
