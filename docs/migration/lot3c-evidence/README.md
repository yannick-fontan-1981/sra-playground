# Lot 3C : preuves du transfert Exposed et de sa limite observée

Le [rapport de livraison](../lot3c-exposed-reception.md), la [filiation des contrats](../lot3c-exposed-reception-lineage.md) et la [feuille de route actualisée](../v6-delivery-roadmap.md) distinguent le port vérifié, la contribution réelle et la limite de campagne. Le moteur **0.43.0** reste gelé sous `3e88aa12214fd3d4a4feb8d63b946123b8394cb4a0cbd0a156cc059c37f7b46c` : **251 fichiers natifs**, **262 fichiers dans l'archive**.

**La cible CWSE de trois niveaux n'est pas atteinte.** Le résultat est **deux niveaux, 21 actions et 13 préfixes**, avec arrêt gardé au troisième niveau. Les composants source et natifs produisent la même proposition et le même refus après une référence d'observation devenue ancienne. La contribution de la nouvelle branche est vérifiée séparément. **3C reste ouvert sur ce suivi fonctionnel**, quel que soit son verdict de coût. [3B est clôturé selon la règle globale autorisée](../lot3b-global-budget-acceptance.md), sans réécrire son ancien 14/16.

## Parcours des preuves

| Pièce | Contenu et qualification |
| --- | --- |
| [Sélection CWSE](candidate-selection.json) | Candidat issu des 100 images initiales publiques, sans code de jeu ni solution ; horloge initialisée une seule fois |
| [Référence bornée](baseline/execution-cwse.json) et [copie](baseline-copy.json) | Publication70 / native0.42, 12 actions et aucun niveau, arrêt au plafond externe ; ne prouve pas l'impossibilité du jeu |
| [Gel natif](final/source-manifest.json) et [archive](final/source-archive.json) | Source de production et entrées passives exactes ; archive conservée en parties ordonnées |
| [Parité de projection](diagnostic/projection-parity.json) | 347 comparaisons aux originaux : rasters, scènes synthétiques, candidats, identités de plan |
| [Tests formels](final/validation/delta-tests-run.json) | 1 525/1 525 tests dans 45 fichiers, zéro échec, annulation, ignoré ou TODO ; delta déclaré, pas toute la suite historique |
| [Contrôles du projet](final/validation/checks-run.json) | Typage, audits, diff et compilation réussis, source inchangée |
| [Campagne réelle](final/cwse-session/execution-cwse.json) | Une session froide, 21 actions, deux frontières naturelles, arrêt conservé au troisième niveau |
| [Contribution réelle](final/cwse-session/exposed-contribution.json) | 12 préfixes Exposed, 20 actions, 19 événements, 12 restaurations ; 36 ablations, dont effets négatifs ou seulement d'identité conservés |
| [Diagnostic terminal](final/cwse-terminal-diagnostic/README.md) | Source et natif identiques sur scène, plan, identité et refus ; portée de composants, pas trajectoire du caller original complet |
| [Navigateur](final/browser/browser-qa.json) et [capture](final/browser/cwse-two-levels-and-stop.png) | Même 21/2/13, Pause à zéro puis sept actions, actions unitaires et reprises ; aperçu du code source gelé, pas mesure de coût |
| [Résolution et horloge](final/cwse-resolution.json) | Cible non atteinte, diagnostic retenu, 1 527,448427 secondes cumulées comptées conservativement ; aucune remise à zéro |
| [Rejeux stricts](final/regressions/regression-summary.json) | CATR et RSWP conservent leurs trajectoires ; ancien comparateur conservé `failed`, 32/34, à cause du nouveau compteur vide |
| [Compatibilité de l'extension vide](final/regressions/empty-series-diagnostic-contract.json) | 551 anciens compteurs égaux, 19 nouveaux compteurs à zéro et listes vides ; normalisation historique explicite, aucune égalité complète de digest ni couverture passive revendiquée |
| [Intégrité qualifiée](final/delivery-integrity-qualified.json) | Native, archive, tests, build, référence originale et reconstruction exacte ; résultat strict 32/34 non réécrit |
| [Protocole de coûts](performance/protocol.md), [déclaration](performance/declaration.json) et [préparation](performance/readiness.json) | A0.42 fraîche/B0.43, ordre A1/B1/B2/A2, 32 sessions/400 actions ; règle globale strictement sous +10 % par jeu déclarée avant mesure |

La [fenêtre officielle](performance/window.json) est terminée : **32 sessions, 400 actions**, aucune session mesurée exclue. La [décision globale](performance/global-budget-decision.json) accepte **2/2 jeux**, STCK **+0,199134 %** et SMLP **−0,254060 %**. L'[agrégat historique](performance/combined-comparison.json) conserve **15/16**, avec la requête STCK **+11,602583 %** ; les deux cohortes restent **13/16 et16/16**. La [revue indépendante](performance/consolidation-review.json) passe **231 contrôles**. Le [rapport complet](performance/results.md) conserve les seize mesures, les effectifs et les p95, sans clôturer la limite fonctionnelle de CWSE.

## Conservation des essais et limites

Les [journaux de développement](diagnostic/development-checks.json) sont distincts du delta formel. Ils conservent notamment un premier échec d'intégrité de fixture pendant la régénération de l'exporteur, suivi de la validation stabilisée. Le dossier de contribution conserve sa première tentative arrêtée sur la forme publique `data: {}` ; l'analyse finale normalise seulement cette représentation du contrôleur. Le diagnostic terminal documente également sa première erreur de nom de champ, corrigée dans l'outil de lecture, sans changer les données, le moteur ou la référence.

Le nouveau reviewer de coût a été corrigé **avant la fenêtre** à la suite d'une revue indépendante : les mêmes lignes de session sont comparées avec leur multiplicité, sans dépendre de leur ordre d'énumération. Il exige la revue historique de consolidation liée aux mêmes fichiers. Les anciennes politiques, comparateurs et reçus 3B restent inchangés. La règle rétrospective 3B et la règle préalable 3C sont des décisions distinctes.

Les sources V5/V6 restent inchangées. La couche Exposed propre et le seul noyau nominal V5 consommé ne clôturent pas l'héritage EphemeralMap, la transaction V5 complète, l'entrée observée entière ou la migration V5/V6 globale. Les états et modèles synthétiques des tests ne sont jamais fournis à la campagne réelle. Les temps des campagnes et des diagnostics ne remplacent pas les mesures officielles de STCK/SMLP.

## Restaurer les rapports volumineux

Les parties sont des tranches des octets gzip originaux, non une régénération de résultats. L'[index](evidence-index.json) répertorie les fichiers directement conservés, les originaux reconstruisibles et les documents liés, avec taille et SHA-256 ; il exclut son propre hash pour éviter une dépendance circulaire.

```bash
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3c-evidence
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3c-evidence/final
```

L'intégrité qualifiée reconstruit les trois rapports volumineux de la livraison finale dans un répertoire temporaire initialement vide et les compare octet par octet aux originaux. La référence bornée est conservée avec son propre manifeste de parties et son reçu de copie. Les fichiers publiés ne remplacent pas le sens des statuts : le contrôle d'intégrité peut réussir alors que la cible de campagne ou le comparateur strict conserve son échec qualifié.
