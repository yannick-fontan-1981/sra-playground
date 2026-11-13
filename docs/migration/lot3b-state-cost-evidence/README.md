# Preuves de la correction commune 0.42 du lot 3B

**État : validation fonctionnelle réussie, budget 14/16, lot 3B ouvert.** Les deux cibles précédentes respectent le seuil dans la nouvelle fenêtre contre 0.38 fraîche : persistance STCK −8,261037 % et restauration SMLP +6,223866 %. Les critères service/requête de préfixe connu STCK restent non résolus à +27,720363 % et +26,350748 %. La prochaine capacité, `exposed_reception_plan` (3C), attend la clôture de 3B.

Le [rapport de livraison](../lot3b-state-cost-correction.md) et la [feuille de route](../v6-delivery-roadmap.md) donnent le raisonnement, les contrats et la suite. Le [manifeste de fichiers](evidence-index.json) répertorie les pièces persistées avec leurs tailles et SHA-256 ; il distingue les fichiers directement stockés des originaux reconstruisibles. Le manifeste exclut sa propre empreinte pour éviter une dépendance circulaire.

## Sources et limites du gel

| Rôle | Source | Pièce |
| --- | --- | --- |
| Point de départ fonctionnel | Site 69, native 0.41 ; commit `c1d5e044dce6291b3eee7320f29663ec5b80ea85` | [Manifeste publié](published/source-manifest.json) |
| Référence de coût remesurée | Site 66, native 0.38 ; digest `f0d8b2b0a746f19036076010025fffa1ad532d5751caa176f7efcccff7bc4aff` | [Manifeste de référence](base/source-manifest.json) |
| Correction validée | Native 0.42, 249 fichiers ; digest `2de70025ae08845efd491929416e091e9dc9e8e4b473440b9c6a86838e0b3d19` | [Manifeste final](final/source-manifest.json) |
| Archive des sources d'exécution | 260 fichiers, deux parties, reconstruction identique | [Inventaire](final/source-archive.json), [parties](final/source-archive-parts.json) |
| Tests affectés | 42 fichiers exécutés ; 553 sources/tests empreintés séparément | [Périmètre](final/release-scope.json), [reçu](final/validation/delta-tests-run.json) |

Les sources originales V5/V6 restent inchangées. L'archive d'exécution ne contient pas l'ensemble des fichiers de test ; le reçu formel lie leurs octets séparément. Aucun compteur fonctionnel de migration n'augmente : 50/76 entrées, 26 restantes, 37 workflows compilés et 2/6 branches de composition.

## Validations achevées

| Contrôle | Résultat | Preuve |
| --- | --- | --- |
| Suite formelle sur gel | **1 396/1 396**, sans échec, annulation, omission ni TODO ; 42 fichiers | [Reçu et entrées](final/validation/delta-tests-run.json) |
| Typage, deux audits, diff et build | **5/5** | [Reçu](final/validation/checks-run.json) |
| CATR en session froide | **12 actions, trois niveaux, huit préfixes**, arrivée naturelle au niveau 4 en `NOT_FINISHED` | [Exécution](final/catr-state-cost-session/execution-catr.json), [trace publique](final/catr-state-cost-session/catr-public-trace.json.gz) |
| Rejeux CATR et RSWP contre 0.41 | **2/2 cas, 34/34 critères** ; 12/3/8 et 19/3/11 | [Déclaration](recorded-regression-cases.json), [résumé](final/regressions/regression-summary.json) |
| Interface CATR | Même **12/3/8**, actions unitaires, Pause et reprise ; preview de développement | [Reçu](final/browser/browser-qa.json), [capture](final/browser/catr-three-levels.png), [arbre accessible](final/browser/catr-final-ax.txt) |
| Intégrité après validation | **249 natifs, 260 archivés, 553 sources/tests, 314 entrées de build et 1 786 références originales** vérifiés | [Reçu final](final/delivery-integrity.json) |

La campagne confirme trois niveaux d'une capacité existante, pas la victoire complète ou une nouvelle capacité. Les rejeux couvrent les champs déclarés du comparateur ; ils n'établissent ni égalité de tous les états ni couverture des propriétaires passifs, dont la liste est vide. Le contrôle navigateur et la compilation sont des preuves distinctes.

## Mesure officielle et décision

Lire le [bilan complet](performance/results.md), puis l'[agrégat](performance/combined-comparison.json), les comparaisons [cohorte 1](performance/cohort1/comparison.json) et [cohorte 2](performance/cohort2/comparison.json), et leurs rapports bruts adjacents. La [revue indépendante](performance/consolidation-review.json) passe **231/231 contrôles**, en conservant le verdict **`budget_review_required`**.

Le [protocole](performance/protocol.md), sa [déclaration](performance/declaration.json), les [cas](performance/cases.json), la [politique](performance/comparison-policy.json), le [reçu de préparation](performance/readiness.json) et la [fenêtre](performance/window.json) sont conservés. Les quatre séries A1/B1/B2/A2 comprennent **32 sessions, 400 actions mesurées**, sans session ou extrême écarté. Les huit chauffes de trois actions sont les seules exclusions prévues. Le seuil reste **+10 % par médiane**, sans tolérance supplémentaire pour le bruit. Les cohortes restent à **14/16 et 13/16**.

Les baisses de médiane de session de 17,795781 % STCK et 13,442302 % SMLP ne compensent pas les deux critères non conformes. Les hausses de p95 restent au bilan, notamment le garde SMLP **0,756828 → 7,512366 ms**. Les phases sont imbriquées, les échantillons internes corrélés, et ces mesures sur retours enregistrés n'établissent ni cause précise ni vitesse de jeu live ni stabilité sur plusieurs heures.

## Diagnostics et revue de contrats

Les [résultats diagnostiques](diagnostic/results.md) confrontent 0.41 et 0.42 sur STCK/SMLP : six critères comportementaux bornés par cas passent, avec `strictFinalEquality: false` conservé. Les rapports, journaux et profils CPU sont conservés. Le [protocole](diagnostic/protocol.md) et sa [déclaration](diagnostic/declaration.json) précèdent les profils. La [réserve d'isolation](diagnostic/isolation-deviation.json) interdit une attribution causale des temps : de courts tests avaient été autorisés pendant la programmation des références, sans horodatage permettant d'établir ou d'exclure leur chevauchement. Aucun profil n'est remplacé pour obtenir un résultat favorable.

La [revue de code](diagnostic/code-review.json), les [tests ciblés de restauration](diagnostic/restoration-tests.json), leurs deux TAP et la [décomposition de restauration](diagnostic/restoration-breakdown.json) sont conservés. Les profils CPU sont compressés sans perte ; les originaux se récupèrent avec gzip. L'[analyse a posteriori des continuations](diagnostic/known-prefix-followup.md) réutilise les seules mesures conservées et prépare le diagnostic suivant ; elle ne prouve pas la cause des deux dépassements et ne constitue pas une nouvelle fenêtre officielle.

## Reconstruction des originaux volumineux

Les originaux locaux restent disponibles pendant la validation ; leurs parties sont la forme persistée dans le dépôt. Depuis la racine du checkout, la commande suivante restaure exclusivement les originaux absents et vérifie les empreintes :

```bash
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3b-state-cost-evidence/final
```

Les trois rapports segmentés représentent **4 920 289 octets en sept parties**. Le reçu d'intégrité les a reconstruits dans un emplacement initialement vide et comparés octet par octet. L'archive source utilise son propre manifeste et ses deux parties ; elle a également été reconstruite sans perte. Les archives, rapports et reçus historiques restent inchangés.
