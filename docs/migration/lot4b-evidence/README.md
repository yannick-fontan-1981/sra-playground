# Preuves du lot 4B

Référence source : `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. La preuve de composant, le contrat synthétique de l'appelant, la campagne live, le rejeu enregistré et la mesure de coût ont des portées distinctes.

## Développement conservé

| Entrée | Résultat et portée |
| --- | --- |
| `planning/validation-plan.json` | Plan initial, base publiée Site 81, finalisation conditionnée aux prédécesseurs effectivement publiés. |
| `development/relative-oracle-01*` | Échec de syntaxe du générateur avant import, conservé. |
| `development/relative-oracle-02*` | Génération depuis Python original ; 16 initiales, 28 cas planner, cinq sessions, neuf variantes de record. |
| `development/relative-reference-test-01*` | 81 tests différentiels réussis, aucun échec/skip/TODO. |
| `development/relative-reference-source-integrity.json` | 1 786 fichiers originaux exacts avant/après ; caches préexistants identifiés séparément. |
| `development/integration-attempt1*`, `2*`, `3*` | 8 + 2 + 2 tests communs réussis : acquisition, mémoire, gardes, décisions, refus et deux chemins de priorité. Ce ne sont pas trois suites globales. |
| `development/typecheck-01.log` | Typage de développement réussi ; ne remplace pas le contrôle du gel final. |
| `development/merged-site82/` | Gel `31850e3a…`, également inchangé après Site 83 : 28 tests de coexistence et typage réussis. |
| `development/priority-regression-01/` | Quatre contrats hérités ciblés, 120/120 tests réussis sur le gel intermédiaire ; sources et tests inchangés pendant la vérification. |
| `development/lkey-partial-site83/attempt-01/`, `attempt-02/` | Deux refus de préflight du nouveau lecteur, avant import/campagne ; formes de commande source/publique corrigées, octets et journaux conservés. |
| `development/lkey-partial-site83/attempt-03/` | Trajet enregistré de 25 actions, 26 paquets, deux niveaux et arrêt connu ; qualification reste `failed`, 149/150 contrôles, à cause du lecteur de frontières. |
| `development/lkey-partial-site83/attempt-03-postrun-review.json` | Lecture indépendante des données : 14 comparaisons concordantes. Le correctif du lecteur reste à exécuter sur le gel final ; aucune requalification de l’essai 03. |
| `development/freeze-01/` | Gel `852d5ff7…`, 276 fichiers natifs, archive de 287 fichiers ; identifiant de version hérité à distinguer du Site 81 publié. |
| `development/tria-live-01/` | Une session froide, trois niveaux, 17 actions et 17 préfixes par RelativeArrangements. |
| `baseline-site81/` et `development/tria-baseline-site81/` | Source publiée 0.51 vérifiée, essai borné à huit actions, zéro niveau ; borne atteinte, aucun verdict général d'impossibilité. |
| `tria-case-selection.json`, `tria-*-phase.json`, `tria-case-resolution.json` | Une horloge de cas, 374,140910 secondes cumulées à sa première clôture ; aucun reset. |
| `development/tria-live-01/tria-relative-arrangement-source-parity-01*` | Premier échec de comparaison sur l'annotation de caller `composition_target_tree`, conservé. |
| `development/tria-live-01/tria-relative-arrangement-source-parity-02*` | 68 appels, 34 gardes, 17 états et 17 restaurations exacts ; 51 ablations conservées, une décision distincte modifiée par deux interventions. |

Les fichiers `*.json.gz.parts.json` décrivent les fragments binaires de l'original inchangé. Après récupération du dépôt, reconstruire seulement les preuves nécessaires avec `python -B scripts/evidence-byte-parts.py restore DIRECTORY`. Les archives de source ont leur propre manifeste et la commande `python -B scripts/freeze-v53-native-source.py restore DIRECTORY`. Aucun jeu, oracle ou calcul de coût n'est relancé pour restaurer ces octets.

## Validation intégrée et coût

Les répertoires et reçus finaux seront ajoutés après intégration des publications concurrentes. Le plan de régression distingue huit trajectoires réussies historiques du trajet LKEY partiel : celui-ci ne peut pas devenir artificiellement une réussite de trois niveaux. Aucune nouvelle tentative live de WEAV ou LKEY n'est autorisée par un rejeu de livraison.

Les outils de coût propres à ce dossier préparent une qualification de structure avant mesure, sur les sources gelées et une référence publiée fraîche. Les outils historiques et leurs refus stricts restent conservés. Le critère autorisé est la médiane groupée de session complète strictement sous +10 % **pour chaque jeu** ; toutes les phases et observations défavorables demeurent visibles. La présence d'un outil ou d'un protocole préparé n'est pas une mesure ni une acceptation.

Le [rapport de lot](../lot4b-relative-arrangements.md) donne l'interprétation humaine, la [filiation](../lot4b-relative-arrangements-lineage.md) les contrats, et la [feuille de route](../v6-delivery-roadmap.md) les statuts de livraison.
