# Lot 5A — Qualification préalable du premier créateur des fragments partagés

## État et chronologie

La première attribution fonctionnelle a échoué avant toute mesure officielle. Son reçu, la déclaration, le protocole et les deux captures restent intacts. Les huit outils de préparation initiaux et leur note de contrat sont archivés avec leurs empreintes dans `performance/initial-preparation-tools/`. Le nouveau qualificateur est un fichier distinct. Le supplément préalable lie les captures existantes, cet échec et un registre fermé de quatorze fragments ; il doit précéder son exécution, le contrat, le préflight, la readiness et la fenêtre.

Le seuil, les outils d’analyse numérique et les quatre chemins de métadonnées de travail autorisés ne changent pas. Les résultats de coût restent à produire. La revue du code et l’exécution du qualificateur constituent des preuves séparées de cette note.

## Différence observée

Le magasin adresse les fragments par leur valeur complète et conserve les métadonnées de leur premier créateur. Sur les captures retenues, le nouveau propriétaire temporel conserve des masques publics à une frontière avant que la mémoire de raisonnement commune ne les persiste au retour suivant. B réutilise ensuite le fragment existant ; A doit encore le créer. Les causes de création diffèrent donc réellement, mais les valeurs canoniques complètes et leurs adresses sont identiques.

L’inventaire indépendant contrôle 268 fragments communs sur les quatre formes (38, 91, 29 et 110), leurs chaînes de deltas et leurs adresses. Les seules différences de premier créateur concernent les quatorze identités ci-dessous. Aucun fragment n’est révisé. Ils sont terminaux, sans référence interne. Les autres champs complets de ces nœuds sont égaux ; chaque digest de source reste vérifié contre son propre runtime.

| Cas et forme | Fragment, préfixe unique | Première création B : point / delta | Création A : point / delta | Première racine commune A |
| --- | --- | --- | --- | --- |
| STCK / measured | `8cd8faa0eb62` | 5 / 457 | 7 / 496 | `reasoning:transition:4` |
| STCK / measured | `5447ef099403` | 5 / 458 | 7 / 494 | `reasoning:transition:4` |
| STCK / measured | `c681ff44ef77` | 5 / 459 | 7 / 495 | `reasoning:transition:4` |
| SMLP / measured | `3c3b0e177faa` | 5 / 461 | 7 / 506 | `reasoning:transition:4` |
| SMLP / measured | `bb2efbcbb016` | 5 / 462 | 7 / 507 | `reasoning:transition:4` |
| SMLP / measured | `87d2af597297` | 5 / 463 | 7 / 511 | `reasoning:transition:4` |
| SMLP / measured | `8b7457b9ea6f` | 5 / 464 | 7 / 510 | `reasoning:transition:4` |
| SMLP / measured | `2eedcb9ef03d` | 5 / 465 | 7 / 509 | `reasoning:transition:4` |
| SMLP / measured | `a64420f63689` | 5 / 466 | 7 / 508 | `reasoning:transition:4` |
| SMLP / measured | `281a0f098bbd` | 11 / 708 | 13 / 743 | `reasoning:transition:8` |
| SMLP / measured | `326fad310d2f` | 11 / 709 | 13 / 747 | `reasoning:transition:8` |
| SMLP / measured | `2b4becd8312b` | 11 / 710 | 13 / 744 | `reasoning:transition:8` |
| SMLP / measured | `6794e8d6141b` | 11 / 711 | 13 / 745 | `reasoning:transition:8` |
| SMLP / measured | `215babbd593b` | 11 / 712 | 13 / 746 | `reasoning:transition:8` |

Les identités complètes, valeurs, origines, causes, empreintes et chemins figurent dans [l’inventaire indépendant](performance/diagnostic/fragment-first-creator-inventory.json). Les préfixes du tableau sont uniquement une présentation compacte ; le qualificateur utilise les 64 caractères de chaque adresse, associés au cas et à la forme.

Pour les quatorze entrées, la première racine B est exactement `family_state:linked_temporal_preparation`, dans `phase.masks`, sous la cause `v6.composition_strategy.choose / sealed_prefix / outcome.acquire`. A les crée sous `prototype.laya_router.route / native_memory / transition.acquire`. Les racines communes qui les consomment au point A sont les transitions indiquées et le fait empirique associé. Le qualificateur exige que les véritables deltas B de ces racines aient les mêmes valeurs encodées intégrales, chemins, révisions et causes ; seule leur identité de source reste propre à chaque gel.

## Comptage du rattrapage

Le registre conserve deux compteurs monotones : **E**, tous les véritables deltas B attribués à l’ajout, y compris les créations anticipées ; et **C**, les créations A appariées explicitement. À chaque point, il exige `révision B − révision A = E − C`. Il ne décrémente jamais E et ne réécrit aucune chaîne, origine ou cause. Le nombre de nœuds supplémentaires provient séparément de l’ensemble réel des identités présentes uniquement dans B ; une identité en sort précisément quand A la crée.

| Événement | Fragments rattrapés A | Écart de révisions avant → après | Travail supplémentaire B au même point |
| --- | --- | --- | --- |
| STCK, point 7 | 3 | 10 → 8 | 1 delta réel du propriétaire |
| SMLP, point 7 | 6 | 11 → 6 | 1 delta réel du propriétaire |
| SMLP, point 13 | 5 | 12 → 8 | 1 delta réel du propriétaire |

Ces observations ne constituent aucune formule de croissance. Le qualificateur reconstruit les quantités à chaque point depuis les chaînes réelles. Le reste des séquences de deltas doit conserver exactement ses identités, révisions, causes et ordre, après consommation des seules créations déclarées par leur session, identité, point, séquence et empreinte.

## Fermeture de la qualification

Le supplément n’admet que ces quatorze entrées. Une identité absente, une valeur ou adresse différente, un fragment non terminal, une racine précoce non temporelle, un checkpoint non observé, une autre cause, une racine commune différente ou un écart de comptage bloque la qualification. Une différence non déclarée reste traitée par les contrôles stricts initiaux. Toutes les feuilles privées des autres racines ne sont pas déclarées identiques ; cette limite héritée du protocole reste explicite.

Le [qualificateur v1](qualify-cost-owner-graphs.mjs) et [son échec conservé](performance/owner-structural-attribution.json) ne deviennent pas réussis. Le [qualificateur v2](qualify-cost-owner-graphs-v2.mjs), le [déclarateur du supplément](declare-shared-fragment-supplement.py) et le [finaliseur du contrat](finalize-owner-cost-contract.py) produisent des pièces nouvelles. Le supplément sera lié directement au contrat et à la readiness, et parmi les entrées d’attribution vérifiées par les deux analyseurs dont les empreintes initiales restent inchangées.

La décision numérique conserve les 32 sessions mesurées et 400 actions prévus, sans retrait de session. La médiane globale B doit rester strictement sous 1,1 fois la médiane A, séparément pour STCK et SMLP. Le présent diagnostic ne renseigne aucune durée, ne prouve aucun gain et ne clôt aucun budget.
