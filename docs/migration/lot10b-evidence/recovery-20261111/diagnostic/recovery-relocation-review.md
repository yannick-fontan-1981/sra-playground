Revue consignée : 2026-11-11T15:35:42.431390+00:00

# Revue source de la relocalisation du gel 10B

## Portée

Revue des reçus `integrated-final-02/freeze-copy-provenance.json`, `source-archive.json` et `source-archive-parts.json`, ainsi que des lecteurs inchangés `scripts/verify-native-delivery.py`, `prepare-cost-protocol.py` et `finalize-cost-readiness.py`. Lecture ciblée sous verrou partagé non bloquant pendant les rejeux. Aucun lecteur exécuté, aucun import natif, aucun calcul de hash, aucune ouverture de l'archive, aucun rejeu ou test lancé par cette revue.

Verdict de lecture : **relocalisation compatible avec les contrats existants**, sous réserve du passage réel ultérieur des vérifications. Cette revue ne produit pas une intégrité de livraison et ne réattribue pas les validations historiques à une nouvelle exécution.

## Constats

- La provenance déclare le même digest natif `74143a7a8f7e1d434a9284b34665f30f9c2b0d8d68191d9405b3af7d39815d12`, 310 fichiers natifs et 768 entrées gelées. Elle conserve les empreintes de copie et limite le remappage à `source-archive.json:archive.path` et `source-archive-parts.json:original.path,parts[*].path`.
- `verify_source_archive` exige que l'archive soit confinée dans le répertoire de livraison fourni, que `parts.original` soit exactement égal au record d'archive, et que les cinq parties portent les noms ordonnés `source-archive.tar.gz.part000` à `part004` dans ce même répertoire. Les nouveaux metadata sont cohérents avec ces contraintes.
- Les reçus de tests et de build copiés byte-identiques peuvent continuer de référencer leurs journaux et leur manifeste natif d'origine dans `integrated-final-01`. `verify_check_receipt` vérifie ces records dans la racine du dépôt, et `formal_evidence` compare le contenu du manifeste natif à la source attendue. Aucun de ces contrôles n'impose de réécrire ces références historiques vers02.
- Il faut donc conserver01 et tous les artefacts référencés disponibles et inchangés. Le déplacement logique des nouveaux reçus de transport ne rend pas02 autonome vis-à-vis de ces références historiques.
- `prepare-cost-protocol.py` peut recevoir `--candidate-source-directory .../integrated-final-02`. Il liera les nouveaux metadata d'archive et le manifeste natif copié, tout en vérifiant l'archive physique, ses768sources et l'ascendance du commit d'origine. Aucun changement des helpers gelés n'est nécessaire.
- Un nouveau `delivery-integrity.json` doit être produit dans02 après le résumé réussi des dix rejeux. Il doit nommer02 et02/validation. Le reçu de récupération peut être ajouté par `--receipt freeze-copy-provenance.json` afin de relier explicitement l'opération de copie à cette nouvelle intégrité.
- La readiness exige que sa déclaration de coût lie précisément02/source-manifest.json et02/source-archive.json, que son intégrité de livraison porte les mêmes chemins02, et qu'elle contienne les reçus réellement consommés. Elle ne permet pas de réutiliser un ancien reçu d'intégrité01 en le renommant.

## Interfaces JS vérifiées par lecture

Toutes les commandes sont à lancer plus tard depuis le checkout candidat. Les sorties doivent être absentes ; les captures et leur qualification doivent précéder la readiness et toute fenêtre de coût.

```text
node docs/migration/lot10b-evidence/record-owner-source-inventory.mjs BASELINE_CHECKOUT OUTPUT.json
node docs/migration/lot10b-evidence/capture-cost-owner-graphs.mjs baseline CHECKOUT CASES.json SOURCE_MANIFEST.json OUTPUT.json.gz
node docs/migration/lot10b-evidence/capture-cost-owner-graphs.mjs candidate CHECKOUT CASES.json SOURCE_MANIFEST.json OUTPUT.json.gz
node docs/migration/lot10b-evidence/qualify-cost-owner-graphs.mjs BASELINE_CHECKOUT BASELINE.gz BASELINE.receipt.json CANDIDATE.gz CANDIDATE.receipt.json ATTRIBUTION.json FIXTURE.json
```

L'inventaire importe les vraies factories des deux checkouts et leurs KnowledgeStore, conserve les runtimes non initialisés et exécute seulement leurs installations de programmes dans des stores locaux distincts. Il n'est donc pas une simple lecture de texte et doit attendre la fin des rejeux concurrents.

Chaque capture importe le runtime et le service du checkout sélectionné et exécute quatre sessions froides : STCK chauffe3 puis forme10, SMLP chauffe3 puis forme15. Elle réalise31actions, sans métrique de coût. Les deux captures représentent8sessions et62actions. Trois inspections terminales sont conservées uniquement pour les formes complètes. `OUTPUT.json.gz` détermine automatiquement `OUTPUT.receipt.json` en retirant le suffixe `.json.gz`.

Les cas et sorties de capture doivent appartenir à `docs/migration/lot10b-evidence`. Le manifeste A peut être la copie retenue dans le checkout candidat, mais son contenu doit égaler l'inventaire réel du checkoutA. Les deux captures doivent utiliser le même fichier de cas finalisé, et les sorties d'attribution et de fixture doivent aussi appartenir à lot10b-evidence.

La qualification importe les validateurs de graphe, reconstruit les chaînes de deltas et vérifie les deux captures en lecture progressive. Elle doit attendre la fermeture réussie des deux reçus. Elle exige exactement4sessions/31actions par rôle, les mêmes cas, les sources inchangées et l'absence de readiness/window. Elle ne constitue pas une mesure de performance.

## Ordre conservé

Déclaration prospective du coût → inventaire → deux captures séquentielles → qualification → contrat de propriétaire → préflight statique → preuves fonctionnelles et intégrité de livraison terminées → nouvel ACK d'isolation → readiness → mesure officielle.

Les preuves fonctionnelles peuvent être produites avant la préparation de coût ; l'exigence finale reste que le nouvel ACK d'isolation soit postérieur à toutes les preuves effectivement consommées. Une réserve HPDL ou navigateur doit rester explicite.
