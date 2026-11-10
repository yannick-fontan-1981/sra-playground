# Lot 3F : index des preuves ReferencePopulation

Cette livraison porte le moteur **0.47.0**, gelé sous `54d8742300a04dcdf0cb1b038bc62b947d4a1c60f70da4ee80e6971b0f021165` : **263 fichiers natifs**, archive de **274 fichiers**. La référence publiée est **Site 74 / native 0.46.0**, commit `a6edbb838670785733155262ae95f69892a236fc`.

Le [rapport de livraison](../lot3f-reference-population.md), la [filiation](../lot3f-reference-population-lineage.md) et la [feuille de route](../v6-delivery-roadmap.md) séparent les contrats, le raccordement, les campagnes, les coûts et les limites de parité. L’[index final](evidence-index.json) lie les pièces effectivement conservées par taille et SHA-256.

## Contrats et validation

| Preuve | Résultat et portée |
| --- | --- |
| [Source gelée](final/source-manifest.json), [archive](final/source-archive.json), [parties](final/source-archive-parts.json) | Octets natifs et intrants passifs du harnais, avant campagne |
| [Oracle indépendant](diagnostic/source-oracle-export.json) | 89 cas, 24 gardes, 3 exceptions, 10 appariements, 19 pas physiques, 97 projections publiques ; 1 786 originaux inchangés avant/après |
| [Revue commune](diagnostic/shared-integration-review.json) | Propriété, ordre, gardes, bornes, restauration atomique, certificat et portée des six branches |
| [Tests formels](final/validation/delta-tests-run.json) | 2 086/2 086, 60 fichiers, zéro échec/annulation/ignoré ; périmètre affecté déclaré |
| [Contrôles et build](final/validation/checks-run.json) | 5/5 ; code et intrants vérifiés |
| [Rejeux](final/regressions/regression-summary.json) | CATR/RSWP/FOGW 51/51 ; 81 actions et 84 paquets archivés, sans nouvel essai de ces jeux |

Les journaux diagnostiques conservent aussi les deux premiers échecs d’écriture du test commun : une borne de travail qui n’était pas épuisée sur ce cas froid et des références d’observation différentes entre le plan synthétique et son acquisition. La borne testée a été corrigée et l’oracle a ajouté une chaîne froide cohérente depuis le même objet source. L’intégration finale passe 15/15 ; les résultats formels portent sur cette version finale.

## VOIS : campagne et contribution

| Preuve | Résultat et portée |
| --- | --- |
| [Admission initiale](diagnostic/reference-population-public-admission.json) | Un seul cas structurellement admis parmi 97 images déjà archivées ; aucun moteur ou solution consulté |
| [Horloge](diagnostic/vois-clock-start.json) | Même cumul pour la référence, la campagne, la comparaison, la contribution et le navigateur |
| [Référence 0.46](baseline/vois-bounded-reference/execution-vois.json) | Une action, zéro niveau, arrêt `frontier_unknown` ; tous les retours restent conservés |
| [Exécution 0.47](final/vois-population-session/execution-vois.json) | Trois niveaux, 78 actions, 42 préfixes, arrivée naturelle au niveau 4 |
| [Journal public](final/vois-population-session/vois-public-trace.json.gz) | 79 paquets ; journal réel indépendant également conservé |
| [Comparaison originale](diagnostic/vois-public-parity.json) | 3 434/3 434 contrôles, zéro écart ; 42 préfixes, 78 retours, 75 événements propres, 43 restaurations ; parité de la couche propre seulement |
| [Contribution](final/vois-population-session/reference-population-contribution.json.gz) | 252 ablations, 100 changements d’action/refus, 104 projections de décision inchangées, 46 différences strictes seules ; aucun état futur injecté |
| [Transport de contribution](contribution-transport.json) | Compression déterministe et reconstruction exacte du JSON original |
| [Navigateur](final/browser/browser-qa.json), [capture](final/browser/vois-final.png) | Session froide continue, 78 actions / trois niveaux / 42 plans ; Pause, action isolée et reprise |
| [Clôture du cas](final/vois-resolution.json) | 1 017,469531 secondes cumulées ; 1 382,530469 secondes restantes, incidents inclus sans remise à zéro |

Le rapport conserve les limites source : cadre de réception pas entièrement remesuré à chaque continuation, contrôle contrarié non révoqué automatiquement, loi complète de couleur et terminaison inconnues. L’occupation préparée ne constitue jamais, à elle seule, un succès officiel. Les six branches raccordées et les 51/76 entrées du registre ne valent pas parité de l’appelant hérité complet.

## Coûts

Le [protocole](performance/protocol.md), la [déclaration préalable](performance/declaration.json), la [politique globale](performance/global-budget-policy.json) et le [contrôle statique](performance/static-preflight.json) définissent la comparaison contre **0.46 fraîche** : ordre A1/B1/B2/A2, 32 sessions et 400 actions mesurées. Pour chaque jeu STCK/SMLP, la médiane de session complète doit rester **strictement sous +10 %**. Les dépassements de phase sont acceptables sous cette condition et restent publiés, ainsi que cohortes, distributions, p95, inspection et Pause. Aucun jeu ne compense un autre.

La [readiness](performance/readiness.json) précède la [fenêtre complète](performance/window.json). La [décision globale](performance/global-budget-decision.json) accepte **2/2 jeux : STCK −0,405643 %, SMLP −1,789668 %**. Les **16/16 critères agrégés** et la [revue indépendante 231/231](performance/consolidation-review.json) passent. Les cohortes restent **16/16 puis 14/16** : restauration STCK **+19,466359 %** et SMLP **+23,450648 %** en seconde cohorte. Le [rapport complet](performance/results.md) conserve ces dépassements, les distributions et les p95 défavorables ; son [reçu de rendu](performance/results-render.json) et le [transport exact des logs](performance/log-transport.json) lient les résultats aux originaux. **3F est clôturé dans son périmètre annoncé**, sans clôture du lot 3 ou de la migration complète.

## Reconstruction et intégrité

Le [contrôle d’intégrité](final/delivery-integrity.json) vérifie les sources, tests et intrants de compilation ainsi que les quatre rapports reconstruits à l’identique depuis 24 parties. Le [contrôle préalable à publication](publication-preflight.json) relie ces preuves à la décision de coût et aux documents finaux ; l’index en conserve les empreintes.

```bash
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3f-evidence/final
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3f-evidence
python -B docs/migration/lot3f-evidence/restore-contribution.py restore
python -B docs/migration/lot3f-evidence/build-evidence-index.py --verify
```

Les gros rapports sont découpés en parties exactes. Les originaux ne sont pas recalculés. Les outils de transport refusent de remplacer un fichier présent dont l’empreinte diffère. Le dépôt publié conserve les preuves historiques et les horloges antérieures CWSE, SK48 et FOGW.
