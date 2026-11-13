# Preuves de livraison 3D : RootedLine, moteur 0.45.0

Le [rapport de livraison](../lot3d-rooted-line.md) distingue transfert vérifié, réserve fonctionnelle SK48 et coût. Le gel natif est `5b5e59e14e4d417d92cacd6e79d21b6e8e833d715c8d05df2b74806bb09b40f3` : 256 fichiers natifs, archive de 267 fichiers. La base est Site 72 / native 0.44, commit `a39997bffdca1ce080879d967d3f5eb95a88d544`.

**État fonctionnel :** 1 724/1 724 tests dans 50 fichiers, cinq contrôles et build, CATR/RSWP 34/34. SK48 ne termine aucun des trois niveaux visés : 12 actions, cinq préfixes et un contre-exemple acquis. Source et natif concordent sur 126 contrôles. Les deux dépassements d'attentes de métadonnées du premier passage sont conservés, puis corrigés sans modifier le natif.

**Coût accepté selon la règle globale : STCK +9,609248 %, SMLP −2,535940 %.** Le diagnostic historique reste 12/16, avec quatre dépassements de phase STCK ; la seconde cohorte STCK conserve +15,844198 % global. Les 32 sessions et 400 actions, les dispersions et p95 sont retenus. La revue arithmétique passe 231/231 contrôles.

## Lire les preuves

| Objet | Pièce principale | Portée |
| --- | --- | --- |
| Code gelé | [Manifeste](final/source-manifest.json), [archive](final/source-archive.json), [parts](final/source-archive-parts.json) | Sources natives et entrées passives de campagne avant exécution |
| Filiation | [Contrats et frontières](../lot3d-rooted-line-lineage.md), [revue du périmètre](diagnostic/transfer-scope-review.json) | Sous-graphe consommé et héritage non transféré distingués |
| Oracles | [Empreintes et export](diagnostic/source-oracle-export.json), [revue indépendante](diagnostic/component-review.json) | Original Python inchangé, 1 786 fichiers vérifiés avant/après |
| Référence SK48 | [Exécution 0.44 bornée](baseline/sk48-bounded-reference/execution-sk48.json) | Seize actions, limite externe, aucun verdict de campagne complète |
| Campagne 0.45 | [Exécution](final/sk48-rooted-session/execution-sk48.json), [bilan et horloge](final/sk48-resolution.json) | Une session froide, cible non atteinte et mémoire conservée |
| Contribution | [Reconstruction et ablations](final/sk48-rooted-session/rooted-line-contribution.json) | Cinq préfixes, douze acquisitions, six restaurations et 26 ablations ; dix actions/refus modifiés |
| Contre-exemple | [Analyse](diagnostic/sk48-public-parity.md), [126 contrôles](diagnostic/sk48-public-parity.json), [rejeu Python](diagnostic/sk48-public-source-replay.json.gz) | Même divergence physique et même refus dans les originaux et le natif |
| Tests finaux | [Relance complète](final/revalidation/validation/delta-tests-run.json), [réconciliation](final/test-expectation-reconciliation.json) | 1 724/1 724 ; premier 1 722/1 724 et journaux conservés |
| Build et audits | [Reçu original](final/validation/checks-run.json), [copie exacte utilisée par le contrôle final](final/revalidation/validation/checks-run.json) | Cinq contrôles réussis, une seule compilation revendiquée |
| Régressions | [CATR/RSWP](final/regressions/regression-summary.json) | 34/34 contrôles sur retours enregistrés ; pas de nouvelles victoires live |
| Navigateur | [Observations](final/browser/browser-qa.json), [capture](final/browser/sk48-final.png) | Pause, action unique, reprise, même arrêt 12/0/5 |
| Coûts | [Protocole](performance/protocol.md), [déclaration](performance/declaration.json), [préparation](performance/readiness.json), [résultats](performance/results.md) | Règle globale stricte par jeu ; toutes les phases et distributions restent diagnostiques |
| Intégrité | [Contrôle final](final/delivery-integrity.json), [index](evidence-index.json) | Empreintes du code, tests, build et reconstitution octet pour octet |

## Qualifications et historique conservés

Le statut `passed` des preuves de contribution et de rejeu décrit leurs contrôles. Il ne remplace pas le statut d'échec de la campagne SK48. La source prédit les mêmes déplacements contredits et conserve le même refus ; aucun correctif spécifique au jeu n'est appliqué.

L'horloge SK48 conserve **667,35444 secondes**, avec 1 732,64556 secondes restantes. CWSE reste à **2 399,683865 secondes**, sans nouvelle tentative ni nouveau diagnostic. Les fenêtres de coût et les validations de livraison ne sont pas des reprises de ces jeux.

Le premier lancement de la revue de composant avec une dépendance d'exécution absente est conservé dans `diagnostic/component-review-launch-error.tap.gz`; la relance Node passe 91/91. Le premier tirage de contribution est aussi conservé ; seule sa désignation des supports prédits a été précisée. Les originaux et tous les résultats défavorables restent disponibles.

## Reconstituer les rapports volumineux

Les fichiers supérieurs au plafond de transport sont conservés comme tranches de 900 000 octets avec manifeste d'empreintes. Leurs octets et leur identité ne changent pas.

```sh
python -B scripts/evidence-byte-parts.py restore docs/migration/lot3d-evidence
python -B scripts/freeze-v53-native-source.py restore docs/migration/lot3d-evidence/final
python -B docs/migration/lot3d-evidence/build-evidence-index.py --verify
```

L'index exclut son propre contenu et les originaux ignorés lorsqu'ils sont transportés par parts. Le commit de livraison conserve également toute l'histoire antérieure du projet.
