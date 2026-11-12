# Lot 9A : coût officiel 0.68 accepté contre 0.67

**Les deux coûts globaux passent le seuil strict de +10 %.** La [synthèse de validation](validation-summary.json), l'[analyse complète](analysis.json), la [vérification Python](independent-review.json) et la [revue indépendante de livraison](independent-delivery-cost-review.json) conservent les résultats et leur portée. La publication reste une opération distincte.

## Résultats globaux

| Jeu | Médiane native 0.67 | Médiane native 0.68 | Variation | Verdict |
| --- | ---: | ---: | ---: | --- |
| STCK | 10 009,077 ms | 10 196,859 ms | **+1.88 %** | Accepté |
| SMLP | 15 352,175 ms | 15 384,758 ms | **+0.21 %** | Accepté |

La référence est le véritable **Site 108 / native 0.67**, source `8462204043aa368faa7df280d796bb706eb53b38`. Le candidat mesuré est `95f76a959f5c8f195590f281f62914505a06be5a`, avec **334 fichiers natifs**, digest `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`. Il raccorde 70/76 entrées, dont 27/33 matérielles.

L'ordre A1, B1, B2, A2 conserve **32 sessions mesurées et 400 actions**, plus **8 chauffes et 24 actions**. Huit sessions mesurées par jeu et version entrent dans chaque médiane. Aucune session mesurée, valeur extrême ou cohorte n'est exclue ; aucune compensation entre jeux, marge de bruit ou relance n'est appliquée. Les 40 formes et 40 signatures complètes sont vérifiées, avec les seuls quatre écarts structurels préqualifiés.

## Phases supérieures à +10 %

Trois dépassements apparaissent après regroupement des deux cohortes :

| Jeu | Phase | Variation médiane |
| --- | --- | ---: |
| STCK | `new_decision` | +14.67 % |
| STCK | `known_prefix_guard` | +13.71 % |
| SMLP | `restoration` | +13.48 % |

Les cinq diagnostics par paire restent séparés :

| Paire | Jeu | Phase | Variation médiane |
| --- | --- | --- | ---: |
| 1 | STCK | `new_decision` | +16.49 % |
| 1 | STCK | `known_prefix_guard` | +12.89 % |
| 1 | SMLP | `restoration` | +36.14 % |
| 2 | STCK | `known_prefix_guard` | +14.50 % |
| 2 | SMLP | `known_prefix_guard` | +12.76 % |

**Ces phases sont acceptées conformément à la règle utilisateur, puisque les deux globaux sont strictement sous +10 %.** Les statuts historiques `budget_review_required` et `over_budget_with_noise_unresolved` restent inchangés dans les rapports. Ils ne sont pas effacés ou renommés en succès. Les phases sont imbriquées et ne s'additionnent pas. Le p95 des huit durées globales n'est pas annoncé.

## Comparaison et revue

Les deux comparateurs de paires ont été réellement exécutés avec sortie 0. Le comparateur strict de cohortes a réellement refusé la différence de métadonnées de travail avec `Within-cohort work metadata changed`, sortie 1 et absence de sortie combinée. Ce refus et son journal intégral restent conservés. Le supplément déclaré avant mesure vérifie alors toutes les formes, les signatures complètes, les 16 métriques groupées et les 32 métriques de paires. JavaScript et Python concordent ; la revue indépendante recalcule séparément les 32 durées originales et les métriques.

Les sept outils historiques n'ont pas changé. Les 806 empreintes du contrat et les 824 du plan sont vérifiées. Le premier lecteur fonctionnel refusé sur 58 durées `total_ms`, son correctif prospectif borné et les deux tentatives consommées ne sont ni réexécutés ni réécrits par cette étape.

## Clôture et portée

Le verrou de performance est resté détenu **484.669552 secondes**, avec une acquisition immédiate non bloquante. Le même inode est conservé ; le fichier n'est ni supprimé ni remplacé, le descripteur est fermé, le groupe de processus est arrêté et aucun descendant propre ne reste actif. Les 17 observations pendant la fenêtre n'ont détecté aucun processus imprévu dans les checkouts propres. Cette portée reste locale au namespace visible et ne prétend pas établir le calme de tout l'hôte. Les analyses commencent après libération.

La durée globale couvre le contrôleur natif jusqu'au dernier retour acquis, pauses et reprises incluses. Le démarrage du worker, `begin`, les inspections terminales, `close`, le moteur de jeu réel, le réseau et le rendu du navigateur en sont exclus. STCK acquiert deux niveaux sur une cible déclarée de trois ; SMLP en acquiert trois. Aucun nouveau succès de jeu n'est revendiqué.

La qualification positive Chart au travers du service public, du worker et des tickets reste distincte et ouverte. Les anciens échecs d'oracle et de lecture, la réserve de formulation `maximumSessions:8` et les limites structurelles des checkpoints restent conservés. Les six portes globales de migration restent fausses. **LKEY reste définitivement fermé.**

## Suite

Publier le gel exact 0.68 en privé après relecture du publié réel sous une courte exclusivité de publication. Les commits et push de sauvegarde restent sans verrou global ni attente de disponibilité des autres lots. Le build final peut être réutilisé après réconciliation de ses entrées et sorties ; aucune reconstruction n'est nécessaire si ces octets restent identiques.
