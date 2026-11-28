# REGN · Ligne 80 · Revenir à une bifurcation pour essayer sa continuation

**Le moteur gelé exécute la stratégie 80 au geste 3 de REGN N1.** Après deux ACTION3, il reconnaît un retour au plateau d'entrée. Il repasse par une transition connue pour atteindre la dernière bifurcation, puis y essaie ACTION4. Le choix change si on retire le retour ou la question ouverte. Ce lot ajoute des témoins et un opérateur sur la branche expérimentale. Le code moteur est celui du gel.

## Origine et conditions de reproduction

Le rapport de catalogue a été ajouté dans `2a17e14b87d12c63bd76c6b3f2968050c7e80434`, enfant direct de la révision d'exécution `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`. Il cite `/tests/sic-qualification.html?strategy-inventory&actions=16`, 100 jeux et 1 519 commandes. Les options de sharding répartissent les jeux. La curiosité explicite concerne une autre campagne. La table consigne pour REGN N1/T3 le fournisseur `returned_branch_contrast`, le type `access`, ACTION3 et une prédiction confirmée. Elle consigne séparément N3/T16 pour la ligne 22. Le commit du rapport publie la table agrégée. La qualification produit de nouveaux préfixes natifs.

À `8ce7ee35`, `inventoryStrategies` appelle `run` depuis le niveau 1 avec `defaultRecoveryPack`, la cible complète et un plafond de 16. `BrowserV6Agent` traduit son `maxSessionActions` en `budgets.maxActions`. Le plafond de niveau est 600. Le worker utilise l'agenda actif du navigateur. Dans l'inventaire, la stratégie est lue à la libération, puis le callback du retour fournit `matched`. La borne de lecture et celle que reçoit le planificateur sont deux paramètres distincts. Ce laboratoire fixe l'horloge du journal et celle du planificateur pour comparer les branches. [Harnais du catalogue](../../../tests/helpers/sic-qualification.ts) · [Transport des budgets](../../../src/runtime/v6-agent.ts)

## Pré-événement, ticket et résultat

Au geste 3, le moteur possède deux transitions de la même époque et à score nul. ACTION3 a mené de `47aa13d6af55af3e` à `f73347ff08ba2da9`, puis de ce second plateau au premier. À la bifurcation du deuxième plateau, ACTION4 reste ouverte. `NativeCallerCoordinator.returnedBranchOffer` fournit cet épisode à `ObservedFrontier.propose`. `closedReturnContrast` vérifie le retour, l'époque, l'absence de score, les arêtes uniques et la présence d'une question à la bifurcation. Le moteur propose deux étapes. [Appelant](../../../src/logos-engine/v6-native-caller.ts) · [Contraste et gardes de la frontière](../../../src/logos-engine/v6-observed-frontier.ts)

| Geste global | Justification et décision | Effet réellement observé |
|---|---|---|
| N1/T3 | `returned_branch_contrast / access`. ACTION3 emprunte l'arête connue. Le garde valide le ticket. | La trame correspond à `f73347ff08ba2da9`. `matched:true`, score 0, suffixe encore ouvert. |
| N1/T4 | La même proposition délivre sa question ACTION4 à la bifurcation. | Effet inconnu avant le geste. `matched:null`, suffixe scellé, niveau 1 terminé. |
| N2/T8–T10 | Un nouveau retour fermé a trois arêtes. Deux ACTION3 successives rejoignent la bifurcation avant l'essai ACTION4. | Les deux projections d'accès concordent. La question est scellée au passage au N3 avec `matched:null`. |

Les [attendus](ATTENDUS.md) ont été figés à `37eb151c` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le reçu inclut le pré-événement et ses références avant tout appel au jeu, puis le ticket et le retour. Sur l'ancien moteur et sur le gel, le parcours nominal est identique. Sur le gel et sur le candidat de qualification, les cinq fiches concordent. La comparaison sonde active/inactive porte sur les décisions, tickets et retours.

| Intervention au seul geste 3 | Offre de 80 | Famille, commande et retour |
|---|---|---|
| Retirer le dernier retour de l'épisode fourni à cette famille | Absente | `observed_frontier / test_local_input` émet ACTION4 depuis le plateau **courant**, retour inconnu et score nul. |
| Retirer la question au dernier embranchement | Absente | Même essai local ACTION4. Les deux retours et leurs références restent disponibles. |
| Inverser la liste des questions à la bifurcation | Une seule question, donc même offre | ACTION3 d'accès confirmé, puis ACTION4 et niveau franchi. |
| Observer la suite après l'un des retraits | Nouveau retour acquis au geste 4 | Au geste 5, ACTION4 est cette fois un **accès prédit et confirmé** de 80. |

**Verdict de développement.** Les deux contextes et les retraits montrent que le gel consomme une question de bifurcation réutilisable dans un chemin d'accès. Le succès officiel et la confirmation de la prédiction concernent deux tickets différents. La liste à la bifurcation ne contient qu'une continuation inédite dans ces témoins. Le test d'inversion vérifie cette cardinalité. Ce lot qualifie exclusivement la ligne 80.

## Entrée native

L'opérateur peut modifier la fiche `sic.regn/1`. `gestes` arrête le relevé. `budget` fixe le plafond global natif et la valeur `null` conserve les seules bornes par niveau. Le membre optionnel `intervention` désigne le geste et l'un des trois retraits ou permutations documentés. `observer:false` rejoue le service avec la sonde désactivée. L'agent reçoit les observations publiques du jeu. L'intervention expérimentale agit seulement sur ce que lit le fournisseur désigné. [Fiches publiques](public) · [Opérateur](operateur.mjs) · [Vérification](verifier.mjs)

```powershell
$d = 'experiments/sic-agenda-offres/regn-80'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" operateur --moteur gel --fiche "$d/public/sans-retour.json" --pyodide $py --recu "$env:TEMP/regn80.json"
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/regn80-qualification.json"
```

Le rejeu utilise Git, tar, Node.js 24.22.3 et le paquet local Pyodide 314.0.7. Les trois moteurs disponibles sont `historique`, `gel` et `candidat`.
