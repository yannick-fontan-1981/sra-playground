# Lot 8B : coût officiel final de native 0.67 contre 0.66

## Décision et population

**Le budget global est accepté pour STCK et SMLP séparément dans la fenêtre déclarée.** Le candidat 0.67 conserve le digest natif `c234bb404de43b380e5595cee8ad4ddfcae6e02d0fcc40286546fcf6838dd44a` et 331 fichiers. La référence est la source réellement publiée dans Site 107 / native 0.66, `4ff7bf45286a8a19d34401988adca587253ae41e`, digest `ab674682f3345b09bec94959174fbb5bf0f1bd06154693697e5814987b572316` et 329 fichiers. Le HEAD d'exécution est `05dcb0fbfbddeb6c3963452dc6191b2bf1b9a441`, sauvegardé avant la mesure.

Les quatre séries **A1, B1, B2, A2** ont terminé avec un code 0. Leurs **32 sessions mesurées / 400 actions**, plus **huit chauffes / 24 actions**, restent toutes conservées. Chaque jeu et chaque version contribue huit durées mesurées à sa médiane regroupée. Aucune session, valeur extrême ou cohorte n'est exclue. Aucune compensation entre jeux, marge de bruit ou relance n'est appliquée.

| Jeu | Médiane 0.66 | Médiane 0.67 | Variation globale | Critère strictement inférieur à +10 % |
| --- | ---: | ---: | ---: | --- |
| STCK, 10 actions | 9 921,9718795 ms | 9 853,0217495 ms | **−0,69492366 %** | Accepté |
| SMLP, 15 actions | 15 364,4181305 ms | 15 087,3394910 ms | **−1,80337867 %** | Accepté |

Ces variations sont des résultats observés dans cette fenêtre finie. Elles ne constituent pas une garantie de gain indépendante du matériel ou de la charge. Les valeurs exactes de toutes les sessions figurent dans [analysis.json](analysis.json), et le calcul indépendant Python dans [independent-review.json](independent-review.json). Le calculateur utilise une comparaison exacte du seuil par `BigInt`, le reviewer la refait avec `Decimal`.

## Dépassements locaux conservés

Les **16 métriques regroupées** ne présentent aucun dépassement de phase. Deux diagnostics dans les **32 métriques de paires historiques** dépassent néanmoins +10 % :

| Paire | Jeu et phase | Variation de médiane | Traitement |
| --- | --- | ---: | --- |
| A1/B1 | SMLP, `restoration` | **+30,36049366 %** | Visible et admis selon la règle globale autorisée |
| A2/B2 | STCK, `restoration` | **+29,97721032 %** | Visible et admis selon la règle globale autorisée |

Les deux fichiers historiques de comparaison gardent leur statut `budget_review_required` et leurs diagnostics `over_budget_with_noise_unresolved`. Ils ne sont pas réécrits en succès. La décision de livraison applique le contrat prospectif et la consigne de l'utilisateur : un dépassement de phase peut être accepté lorsque les deux globaux complets restent strictement sous +10 %. Le bruit ne sert ni d'excuse ni de supplément au seuil.

## Comparabilité et refus strict historique

Le comparateur strict de cohortes a réellement été exécuté : **code 1**, message `Within-cohort work metadata changed`, aucune sortie `combined-comparison.json`. Son reçu et les octets effectivement reçus sont conservés dans [strict.execution.json](strict.execution.json) et `strict.log.gz`. Le flux reçu contient 65 536 octets et se termine au milieu de l'objet diagnostique imprimé ; cette fin partielle n'est pas présentée comme un diagnostic textuel intégral. Le message d'échec exact, le code et l'absence de sortie restent vérifiables. Aucune nouvelle exécution n'a remplacé cet échec.

Le chemin de lecture complémentaire a été déclaré avant la mesure. Il vérifie les **40 formes exactes et les 40 signatures de travail complètes**, y compris chauffes, appels, pauses, reprises et compteurs. Entre A et B, seules les valeurs déjà capturées de quatre chemins structurels sont admises : `observations[*].nodeCount`, `inspection[*].graphNodes`, `final.nodeCount` et `final.graphRevision`. La preuve fonctionnelle attribue leur différence au seul propriétaire `branch_routing`, sans programme de famille supplémentaire ni différence inexpliquée. Les autres signatures doivent correspondre exactement. Les anciens indicateurs `preparedOnly`, `officialPerformanceEligible` et `strictCommonGraphParity` restent inchangés.

Les reçus [analysis.execution.json](analysis.execution.json) et [review.execution.json](review.execution.json) conservent les commandes et leurs sorties effectives. La revue de livraison et la revue du contrôleur complètent les calculs ; la [synthèse de qualification](validation-summary.json) les relie sans transformer un lecteur arithmétique en preuve universelle de parité.

## Exécution, isolation et fermeture

Le [contrôleur officiel](../final-performance-controller-067-01/controller.json) a exécuté la fenêtre du **12 novembre 2026, 12:32:57 à 12:40:58 UTC**. L'exclusivité a duré environ **481,3 secondes**. Le préflight ordinaire est hors verrou ; l'analyse et les revues sont intervenues après sa libération. Les 810 entrées du plan sont restées identiques. Le descripteur a été fermé, le groupe de processus arrêté et le même fichier de verrou conservé, sans suppression ni remplacement.

L'isolation établie porte sur les checkouts propres, la fermeture effective des calculs et workers propres, l'ordre séquentiel supervisé et le mutex partagé courant. Les observations de processus, CPU et charge sont limitées au namespace visible. L'inactivité des travaux ordinaires d'autres namespaces ou de l'hôte n'est pas prétendue. Aucune disponibilité ou approbation d'un autre lot n'a été attendue. Quelques lectures minuscules du seul statut de `window.json`, depuis scratch, ont servi aux points d'avancement ; aucun autre calcul, test, build ou worker propre n'a été lancé pendant la mesure.

## Portée et suite

`session_elapsed` couvre le contrôleur jusqu'au dernier retour acquis, pauses et reprises comprises. Le démarrage du worker, `begin`, les inspections terminales, `close`, le moteur de jeu réel, le réseau et le rendu navigateur sont hors de cette durée. Les phases sont imbriquées et ne s'additionnent pas. Huit durées globales ne donnent lieu à aucun p95. STCK conserve deux niveaux acquis pour une cible de trois ; SMLP en conserve trois. Aucune acquisition BranchRouting sélectionnée ou nouvelle réussite de jeu n'est déduite de ces formes.

La qualification fonctionnelle finale et ses limites restent dans le [jalon 0.67](../final-version-067-01/README.md). La preuve positive BranchRouting concerne le runtime natif, sans nouvelle qualification positive de la façade publique 64 × 64, des tickets ou du worker. Les réserves de coût historiques de 0.65 et 0.66 ne sont pas levées rétroactivement par cette comparaison.

**Prochaine étape à la clôture de ce jalon : publier exactement la source 0.67 qualifiée sous un bail court**, après relecture du Site, de sa source et de son audience. La [feuille de route](../../v6-delivery-roadmap.md) porte ensuite le statut de publication constaté. Le développement, les tests, les commits et les push restent sans verrou global. **LKEY reste définitivement fermé.**
