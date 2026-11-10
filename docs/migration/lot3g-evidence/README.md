# Lot 3G : index des preuves FramedWindow

Cette livraison porte le moteur **0.48.0**, gelé sous `fce8dfc3e6861742649203161b3bf55b6480462e44c77d8015453ce55b724a26` : **266 fichiers natifs**, archive de **277 fichiers**. La référence est **Site 75 / native 0.47.0**, commit `08bc35e447d17530a774c146ce4e660b1ef29d9a`, exécutée dans un checkout distinct.

Le [rapport de livraison](../lot3g-framed-window.md), la [filiation source](../lot3g-framed-window-lineage.md) et la [feuille de route](../v6-delivery-roadmap.md) distinguent transfert, intégration, contribution, non-régression et coût. **La contribution propre de FramedWindow dans un jeu reste ouverte.** L’[index final](evidence-index.json) lie les pièces conservées par taille et SHA-256.

## Contrats et validation

| Preuve | Résultat et portée |
| --- | --- |
| [Source gelée](final/source-manifest.json), [archive](final/source-archive.json), [parties](final/source-archive-parts.json) | 266 fichiers natifs et 11 intrants passifs ; octets inchangés pendant les vérifications |
| [Oracle indépendant](diagnostic/source-oracle-export.json) | 68 cas de méthode, 24 gardes, 9 exceptions, 43 cas de noyau, 5 restaurations, 2 séquences froides ; 1 786 originaux inchangés |
| [Lignée](../lot3g-framed-window-lineage.md) | Contrats propres, héritage partiel, garde isolée, préfiltre exhaustif et deux adaptations natives |
| [Revue commune](diagnostic/shared-integration-review.json) | Ordre DRM, acquisition unique, propriété, témoins, restauration atomique et anciens états |
| [Checkpoints 0.47](../../../tests/fixtures/v6-framed-window-legacy-checkpoints.json.gz) | Neuf états exportés du checkout publié, dont Population, Reception et combiné |
| [Tests finaux](final/revalidated/validation/delta-tests-run.json) | **2 566/2 566 dans 68 fichiers**, aucun échec, annulation, test ignoré ou TODO |
| [Premier passage](final/validation/delta-tests-run.json), [reprise](diagnostic/formal-validation-retry.json) | **2 564/2 566** conservé ; deux attentes de registre corrigées, code natif inchangé, tous les fichiers rejoués |
| [Contrôles et build](final/validation/checks-run.json) | **5/5** ; reçu copié à l’identique dans le dossier de validation finale, sans prétendre un second build |
| [Boucle commune](final/framed-window-common-loop.json.gz) | **15 groupes de contrôles**, deux sessions synthétiques froides ; sélection, liaison, WHY/ACT, acquisition, restauration, décision suivante et ablation séparée |
| [Portée de validation](final/framed-window-validation-scope.json) | Contribution en jeu ouverte ; aucun nouveau jeu cible, aucune horloge fictive ; horloges antérieures conservées |
| [Diagnostic géométrique](diagnostic/framed-window-geometric-diagnostic.json) | Limite de domaine distincte de la certification ; aucune garantie de latence du préfiltre |

Les journaux de développement et l’incident de préparation de l’oracle restent dans `diagnostic/`. Ils ne sont pas substitués aux reçus formels.

## Données publiques et non-régressions

Le [scan initial](diagnostic/framed-window-public-admission.json) trouve **0 admission sur 96 vues**. Le [plan complémentaire](diagnostic/retained-public-scan-plan.json) précède le [scan de 909 vues dans 30 traces](diagnostic/retained-public-admission.json), qui trouve **11 admissions**. Le [rapport des commandes](diagnostic/retained-public-command-comparison.json.gz) conserve cinq propositions différentes de la prochaine commande archivée et six vues sans action pointée disponible. **Aucun retour réel n’est acquis pour FramedWindow** ; les restaurations sur ces retours ne sont pas exercées.

Les [quatre rejeux](final/regressions/regression-summary.json) passent **68/68 contrôles** sur **159 actions, 88 préfixes et 12 frontières naturelles** : CATR 12/8, RSWP 19/11, FOGW 50/27 et VOIS 78/42, chacun conservant trois niveaux. Ce sont des non-régressions sur retours archivés, sans attribution de contribution à la nouvelle branche. Le [reçu navigateur](final/browser/browser-qa.json) confirme séparément CATR **12 actions / 3 niveaux / 8 plans** après Pause, action isolée et reprise, à partir des observations visibles conservées dans le [relevé AX](final/browser/catr-observed-ax.txt).

## Coût officiel

La [préparation](performance/preparation.json), le [protocole final](performance/protocol.md), la [déclaration](performance/declaration.json), les [48 contrôles statiques](performance/static-preflight.json) et la [readiness](performance/readiness.json) précèdent les mesures. Ils lient la référence publiée, le candidat gelé, les mêmes traces, les sept outils conservés et l’isolation réelle des calculs.

La [fenêtre complète](performance/window.json) conserve **32 sessions et 400 actions**, dans l’ordre A1/B1/B2/A2. La [décision globale](performance/global-budget-decision.json) accepte **STCK +1,654959 % et SMLP +6,641217 %**. L’[agrégat](performance/combined-comparison.json) garde **12/16 diagnostics conformes**, les cohortes 10/16 et 13/16, et la [revue indépendante](performance/consolidation-review.json) passe **231/231**. La [seconde revue depuis les sessions brutes](diagnostic/cost-result-review.json) passe **96/96 contrôles** et confirme les médianes, les cohortes et les seules exclusions prévues. Les quatre dépassements de phase et tous les p95 disponibles figurent dans les [résultats détaillés](performance/results.md). Le [transport des journaux](performance/log-transport.json) conserve leurs octets exacts sans supprimer les originaux.

L’acceptation porte sur la médiane de session complète, **strictement sous +10 % séparément pour STCK et SMLP**. Les dépassements de phase peuvent être acceptés sous cette condition ; aucune compensation entre jeux, somme de phases imbriquées, moyenne de ratios de cohorte ou exclusion d’échantillon mesuré n’est utilisée. Cette décision ne clôt aucune réserve de contribution en jeu ou de parité héritée.

## Intégrité et reconstruction

Le [reçu d’intégrité](final/delivery-integrity.json) vérifie **266 fichiers natifs, 277 fichiers archivés, 604 intrants source/tests et 331 intrants de build**. Il reconstruit exactement les quatre rapports de rejeu, conservés en **24 parties**, pour **19 467 252 octets**, et vérifie les 1 786 originaux. Les rapports volumineux restent disponibles sans modifier leurs octets.

```bash
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3g-evidence/final
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3g-evidence
python -B docs/migration/lot3g-evidence/restore-public-command-comparison.py restore
python -B docs/migration/lot3g-evidence/build-evidence-index.py --verify
```

Le [transport du diagnostic public](public-command-comparison-transport.json) et son [reçu vérifié](public-command-comparison-transport-verify.json) lient le gzip déterministe de 206 109 octets au JSON original de 4 194 954 octets. La [vérification finale de publication](publication-preflight.json) et l’index final conservent les résultats, les réserves et les documents qui seront publiés ensemble. Aucun résultat historique défavorable n’est supprimé.
