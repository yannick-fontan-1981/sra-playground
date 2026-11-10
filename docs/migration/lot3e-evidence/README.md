# Lot 3E : preuves conservées

Le moteur natif 0.46 est gelé avant les validations et la campagne, face à la référence publiée 0.45 / Site 73. Le [rapport de livraison](../lot3e-reception-service.md), la [filiation](../lot3e-reception-service-lineage.md) et la [feuille de route](../v6-delivery-roadmap.md) séparent transfert, comportement, limites source et coût.

**3E est clôturé dans son périmètre annoncé.** FOGW atteint trois niveaux en 50 actions et 27 préfixes, avec confirmation au navigateur. La validation formelle passe 1 904/1 904 tests, cinq contrôles compilation comprise, et CATR/RSWP 34/34. Le coût global est accepté : **STCK +4,992188 %, SMLP +0,144738 %**, tout en conservant le diagnostic 13/16 et ses trois dépassements de phase STCK. Les adaptations natives, l’exception originale et la limite de continuation restent explicites.

## Lecture des preuves

- `baseline/provenance.json` et `baseline/source-manifest.json` : identité et inventaire exacts de la version publiée.
- `baseline/fogw-bounded-reference/` : diagnostic froid de seize actions, sans niveau résolu ; limite extérieure conservée.
- `diagnostic/reception-public-admission.json` : projection des 98 images publiques initiales, sans action, CWSE et SK48 exclus.
- `diagnostic/source-oracle-export.json` et les fixtures liées : originaux inchangés, contrats propres et contre-exemples source.
- `diagnostic/native-contract-review.json` : corrections natives vérifiées indépendamment, dont 128 attentes et quatre restaurations.
- `diagnostic/integration-code-review.json` : revue de propriété, ordre, restauration et plafonds.
- `diagnostic/fogw-clock-start.json` : horloge cumulative conservatrice du cas.
- `final/source-manifest.json`, `source-archive.json` et parties : code natif gelé et entrées d’exécution.
- `final/validation/` : 1 904 tests dans 56 fichiers et cinq contrôles/build.
- `recorded-regression-cases.json` et `final/regressions/` : CATR/RSWP 34/34, retours historiques recalculés depuis une mémoire froide.
- `final/fogw-reception-session/` : campagne froide, journal public complet, acquisitions et attribution.
- `final/fogw-resolution.json` : trois niveaux en 50 actions et 27 plans ; horloge cumulative close à 951,320275 secondes.
- `diagnostic/fogw-public-parity.json` : 1 112 contrôles, avec comparaison exacte arrêtée à l’exception originale et comparaison adaptée complète, explicitement séparées.
- `contribution-transport.json`, `diagnostic-log-transport.json`, `audit-transport.json` et le restaurateur : conservation sans perte du rapport de contribution, des journaux et de l’audit de préparation.
- `final/browser/` : contrôle séparé des commandes de l’interface.
- `performance/` : règle globale préalable, fenêtre A1/B1/B2/A2, cohortes et diagnostic complet des phases.
- `final/delivery-integrity.json`, `publication-preflight.json` et `evidence-index.json` : intégrité des résultats retenus et des entrées publiées.

Les essais de préparation et reçus de développement restent dans `diagnostic/` ; ils ne remplacent aucun résultat formel. Les valeurs défavorables, ablations sans effet et différences originales restent conservées.

## Reconstruction

Les rapports volumineux et archives sont conservés à l’identique en parties vérifiées. Après récupération du dépôt :

```bash
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3e-evidence
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3e-evidence/final
python -B docs/migration/lot3e-evidence/restore-contribution.py restore
gzip -dk docs/migration/lot3e-evidence/diagnostic/pre-freeze-migration-audit.json.gz
python -B docs/migration/lot3e-evidence/build-evidence-index.py --verify
```

La commande `gzip -dk` vise un clone frais où l’audit original est absent ; elle ne remplace pas un original déjà présent. Les journaux sont lisibles dans leurs copies `.log.gz`, dont les reçus donnent aussi les empreintes décompressées.

Ces opérations reconstituent et vérifient des octets ; elles ne rejouent pas un jeu et ne recalculent pas un résultat d’agent.
