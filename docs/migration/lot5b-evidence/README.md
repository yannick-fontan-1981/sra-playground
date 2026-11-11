# Lot 5B — preuves du matériau adressé

État courant : candidat **native 0.58.0 gelé après intégration du Site 92** ; la clôture documentaire Site 93 a ensuite été réconciliée sans modification de ce gel. Les **4 900 tests finaux**, les cinq contrôles incluant la compilation, les **dix rejeux et leurs 170/170 contrôles**, les preuves communes finales, leurs comparaisons originales et le navigateur TRIA sont passés. La fenêtre officielle accepte le budget global des **deux jeux : STCK +3,780905 %, SMLP −1,556219 %**. **La publication 5B reste en attente de son reçu réel.** Le [rapport du lot](../lot5b-addressed-material.md) détaille les acquis et les réserves.

Le [manifeste final](integrated-final/source-manifest.json) contient **302 fichiers natifs**, digest `099444085f0579ce60e226c9dece42110c577538f5f337579305a2e5f65483c4` ; l'[archive](integrated-final/source-archive.json) épingle **313 fichiers**. Le [registre du candidat](../v6-entry-point-progress.json) compte **62/76 entrées raccordées**, soit **81,6 %**, zéro partielle et 14 ouvertes. Il décrit un raccordement, sans déclarer la parité globale de V6.

## Périmètre

Une instance `public_addressed_material` raccorde `observed_addressed_material` à sa place dans la stratégie originale. Le transfert consommé inclut `common_addressed_material.py`, `common_addressed_field.py` et `common_field_stock.py`. Le [contrat de filiation](../lot5b-addressed-material-lineage.md) décrit l'apprentissage, le stock, les refus reconnus, les obligations et les frontières. 5C `observed_object_binding` reste distinct.

Les retours sélectionnés et passifs alimentent le même propriétaire une seule fois. Chaque enveloppe originale est conservée sous `addressed_material_event:<revision>`, même quand `events` est vide. Le checkpoint natif ajoute un contrat de restauration explicite : il ne prétend pas être une méthode de checkpoint définie par le Python original.

## Preuves de développement

| Entrée | Résultat et portée |
| --- | --- |
| [Oracle canonique](diagnostic/source-oracle-export.json) et [contrat d'export](diagnostic/source-oracle-contract.md) | 14 helpers, 19 chaînes froides, 522 opérations ; 1 786 originaux vérifiés avant et après ; 35/35 tests de référence |
| [Revue du stock](development/field-stock-contract-review/README.md) | 13/13 tests du stock, contrat source et outils de coût préparés |
| [Navigation positive](development/common-positive-02/original-comparison.json) | 169/169 comparaisons de l'original sur le journal réel ; deux clics d'un même préfixe |
| [Navigation sans effet](development/common-negative-01/original-comparison.json) | 164/164 ; réfutation du modèle et changement de décision |
| [Stock partiel](development/common-stock-01/partial-original-comparison.json) | 384/384 comparaisons partielles ; parcours commun en échec, jamais requalifié en parcours terminé |
| [Cause originale du refus](development/common-stock-03/original-preservation-diagnostic.json) | Proposition du service et deux refus de préservation reproduits par le Python original |
| [Plan final des preuves communes](coordination/common-proof-plan.json) | Deux contrats de navigation et nouveau contrat borné de contribution stock suivie d'un refus ; les trois échecs historiques restent épinglés |
| [Intégration réelle de 10A](coordination/published-10a-source-verification.json) | Les 294 fichiers natifs publiés dans Site 91 correspondent à leur inventaire ; compilation du merge passée |
| [Préparation de la portée](coordination/regression-scope-preparation.json) | Union provisoire de 125 fichiers et dix cas de rejeu ; aucun résultat final anticipé |
| [Reconstruction des entrées](diagnostic/retained-input-reconstruction-01.json) | Douze fichiers reconstruits exactement depuis leurs parties ; aucun résultat recalculé |
| [Horloge WEAV conservée](coordination/weav-case-checkpoint.json) | 2 401,227841 s cumulées sur 2 400 s ; zéro temps restant, aucun nouvel essai réel 5B |

Les journaux de développement comprennent aussi les 10 tests d'extensions natives et les 4 contrats du noyau commun, les contrôles de compilation et les tentatives échouées. Le [transport des journaux](diagnostic/development-log-transport.json) conserve les sorties disponibles au moment de son enregistrement. Les résultats intégrés ci-dessous restent distincts de ces preuves de développement.

## Preuves terminées sur le gel intégré

| Entrée | Résultat et portée |
| --- | --- |
| [Intégration du Site 92](coordination/published-4c-source-verification.json) | Les 298 fichiers natifs 4C / 0.57.0 correspondent aux objets Git publiés ; successeur réel intégré |
| [Clôture documentaire Site 93](coordination/published-4c-documentation-closure-reconciliation.json) | Réconciliation passée ; sources natives, tests, scripts et entrées de build inchangés ; digest candidat conservé et référence de coût maintenue sur Site 92 |
| [Tests finaux](integrated-final/validation/delta-tests-run.json) | **4 900/4 900 tests** sur **125 fichiers**, sans échec, annulation, test ignoré ni test en attente |
| [Contrôles et compilation](integrated-final/validation/checks-run.json) | **5/5** : types, audit des entrées, audit de migration, diff et compilation ; sources natives inchangées |
| [Dix rejeux publics](integrated-final/regressions/regression-summary.json) | **170/170 contrôles** ; 357 actions, 275 préfixes, 632 requêtes, 30 frontières naturelles, 367 paquets publics complets et 1 676 images d'animation ; aucune nouvelle réussite en jeu déduite |
| [Navigation positive](integrated-final/common-positive/original-comparison.json) | **169/169** contrôles ; 54 opérations, 15 retours dont cinq propres et dix passifs ; 7/7 étapes |
| [Navigation sans effet](integrated-final/common-negative/original-comparison.json) | **164/164** ; 52 opérations, 14 retours dont quatre propres et dix passifs ; réfutation et décision suivante comparées |
| [Contribution stock bornée](integrated-final/common-stock/original-comparison.json) | **199/199** ; 63 opérations, 16 retours dont six propres ; deux actions stock, **une fusion puis un déplacement** ; **8/17 étapes** avant l'arrêt déclaré |
| [Préservation originale du stock](integrated-final/common-stock/original-preservation-comparison.json) | **835/835** ; fournisseur identique et deux refus exacts ; 16 retours reconstruits, dont quatre service sélectionnés et douze passifs ; quatre événements imbriqués |
| [Navigateur TRIA](integrated-final/browser/browser-qa.json) | **Trois niveaux, 17 actions et 17 plans**, arrivée au niveau 4 ; Pause à deux actions puis « One action » à trois, reprise sans remise à zéro de la mémoire |
| [Attribution structurelle](performance-integrated/owner-structural-attribution.json) | **64/64 contrôles** ; structures ajoutées attribuées aux installations, checkpoints et faits source réellement capturés, sans verdict de coût |
| [Précontrôle statique du coût](performance-integrated/static-preflight.json) | **68/68 contrôles** ; entrées et sources gelées vérifiées ; `measurementExecuted: false` |

Chaque répertoire commun final contient `actual-operations.json`, `original-replay.json.gz`, `original-export.json` et `original-comparison.json`. Les trois exports vérifient chacun les **1 786 originaux avant et après**, sans modification, et recalculent à froid les résultats et états source depuis les seuls arguments publics. Les sept commandes d'export et de comparaison ont toutes un code retour nul. Leurs fichiers `.execution.json`, `.execution.log` et `.execution.log.gz` conservent commandes, dates, codes retour, sorties complètes et empreintes.

Le [plan de l'oracle](oracle-plan.md) sépare ces comparaisons, les tests d'extensions natives, la sélection réelle par le caller complet et les campagnes en jeu. Le contrat stock final est exclusivement `stock-preservation-refusal` : son parcours reste incomplet, avec `complete: false` et `preservationRefusal: true`. Les trois anciens essais stock restent échoués. La comparaison du fournisseur et de la préservation ne revendique pas un rejeu complet du routeur original. TRIA reste une régression d'interface sur un jeu déjà utilisé, sans attribution d'une contribution propre 5B ni chiffre d'accélération.

## Résultats des rejeux et du coût

### Dix rejeux terminés

Le [plan intégré des tests](coordination/integrated-test-scope-plan.json) fixe les **125 fichiers** dont les 4 900 tests sont passés, issus de l'union ordonnée des reçus publiés puis des quatre contrats 5B. Les [dix cas de rejeu](integrated-final/regression-cases.json) passent leur [prévalidation](integrated-final/preflight.json), puis leurs **170/170 comparaisons finales**. Les commandes sont recalculées avant restitution des retours publics archivés. Le contrat historique compare notamment commandes, sélections, gardes, frontières, préfixes et résultat public ; il ne revendique pas l'identité de tous les contenus privés ni une parité du routeur Python entier. Les reçus et journaux complets restent dans `integrated-final/regressions/`.

### Coût global accepté ; phases et refus strict conservés

La [fenêtre officielle](performance-integrated/window.json), du **11 novembre 2026 à 02:18:39 au même jour à 02:27:33 UTC**, passe ses quatre séries A1/B1/B2/A2 et son contrôle final d'intégrité. Elle conserve **32 sessions mesurées et 400 actions** ; les **huit chauffes / 24 actions** sont séparées et aucune session mesurée n'est exclue. L'[isolation terminée](performance-integrated/coordinated-isolation-completion.json) confirme le verrou exclusif et les 12 voies connues au calme aux deux bornes.

Le [rapport des coûts](performance-integrated/results.md) et la [revue indépendante](performance-integrated/owner-growth-review.json), **11 865/11 865 contrôles**, acceptent **2/2 jeux** : médiane de session **STCK +3,780905 %**, **SMLP −1,556219 %**, chacune strictement sous +10 %. Les diagnostics agrégés restent **14/16**, avec **restauration STCK +13,032972 %** et **garde du préfixe connu SMLP +11,650805 %**. Les cohortes restent **11/16** et **14/16**. La règle utilisateur permet ces dépassements de phase lorsque le global de chaque jeu est conforme ; aucun jeu ni aucune cohorte favorable ne compense ou remplace un autre.

Le [refus du comparateur historique strict](performance-integrated/aggregation-failure.json) reste **en échec, code retour 1**, pour les métadonnées de travail. La consolidation distincte suit le [contrat pré-déclaré](performance-integrated/owner-growth-contract.json) et qualifie **432 écarts de compteurs structurels** contre les captures attendues ; il ne s'agit pas de 432 nouveaux deltas du moteur. Aucune durée n'est corrigée ou exclue. La qualification **64/64** et le précontrôle **68/68** précèdent la mesure et gardent leur portée propre. Les distributions et p95 défavorables, notamment les pointes de garde, restent visibles dans le rapport complet ; le budget accepté n'établit pas une accélération générale ou une résolution de WEAV.

### Publication 5B — en attente

Aucune publication 5B n'est déclarée par cet index. La version Site, le commit, le statut du déploiement et les réserves seront renseignés depuis le reçu réel après vérification des sources, du build et des entrées de publication. Sites 92/93 désignent le prédécesseur 4C effectivement publié.

## Coordination

Le checkout a été ouvert depuis le Site 88, native 0.55. Les Sites 89, 90, 91 et 92 sont intégrés par leur ascendance réellement publiée, puis la clôture documentaire Site 93 a été réconciliée sans changement du gel natif. Le candidat 5B porte native 0.58.0 ; sa référence de coût reste Site 92 / native 0.57.0. Les lots 4, 7 et 10 restent aux conversations qui en ont la charge. La fenêtre de coût 5B est terminée et son verrou libéré ; son exclusivité et ses populations restent documentées par les reçus conservés.

Le budget cumulatif WEAV déjà épuisé n'est pas remis à zéro. Les améliorations 5B ne sont pas une preuve que WEAV termine désormais son niveau 6. Une campagne synthétique n'est jamais comptée comme une réussite de jeu.
