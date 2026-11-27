# Deux premiers arrêts reproductibles

Les huit départs de l'[épreuve initiale](../operator/structural/BILAN.md) sont des témoins connus. F2 et F4 ont donné quatre arrêts avant toute commande. F1 et F3 ont donné quatre arrêts après l'accusé du premier geste. Le reçu historique est identifié dans le [registre de gel](GEL.md).

| Fiche publique | Départs | Premier échange sous `f296ac1c` | Critère de passage |
| --- | ---: | --- | --- |
| [A · effet conditionnel](A.json) | 2 | Fiche admise, puis `{"arret":"aucune continuation justifiée dans l’horizon 10"}`. Aucune commande ni aucun retour du jeu. | Indexer, lire après l'indexation, marquer la valeur reçue et valider. 2 succès en 4 commandes chacun. |
| [B · accusé matériel](B.json) | 1 | `indexer P` → `indexé`, puis `accusé matériel non reconnu pour la commande demandée`. | Déduire `indexed(P) = true` après l'accusé annoncé, puis valider. 1 succès en 2 commandes. [Dialogue exact](B.md) |
| [C · engagement injustifié](C.json) | 2 | `lire` → `R` ou `S`. La réponse change le marquage, puis la validation réussit. | Écarter les deux marquages initiaux. Lire puis réussir dans chaque monde en 3 commandes. |

**A.** La fiche garde une seule commande d'indexation, une case et deux valeurs possibles. Elle emploie un accusé déjà compris par le gel pour isoler la cause A. Le prérequis du geste, « P non indexé », est connu et satisfait dans les deux mondes. Le guide inconnu change uniquement la valeur du cadran *après* le geste. Dans un diagnostic séparé sur la même fiche, la projection du geste par le code gelé rend `effet conditionnel indéterminé`.

Un témoin scripté exécuté via le même opérateur a effectivement obtenu les échanges ci-dessous. Le solveur gelé s'était déjà arrêté avant le premier geste.

| Commande | Premier départ | Second départ |
| --- | --- | --- |
| `indexer P` | `poste indexé` | `poste indexé` |
| `lire` | `R` | `S` |
| Commande selon le retour | `marquer P R` → `marqué` | `marquer P S` → `marqué` |
| `valider` | `succès` | `succès` |

**B.** La réduction supprime le cadran, le guide et les récepteurs. Il reste un fait booléen et deux commandes. Avec pour seule variation le libellé de l'accusé dans la fiche et dans le retour du jeu, `poste indexé` conduit le même solveur à réussir en deux gestes.

**C.** La case n'accepte qu'une marque. Une marque choisie avant la lecture est exécutable et condamne l'un des deux mondes. L'énumération indépendante a essayé chaque premier marquage et toutes ses continuations. La lecture est le seul début de politique garantissant le succès.

## Rejeu public

Depuis `experiments/symbolic-situations/public-format`, avec Node 24 et un dépôt contenant les objets Git du consommateur :

```powershell
$env:SRA_SOLVER_REPO = 'D:/dev/ARC-AGI/SRA-Playground/sic-agenda-public-v1'
node --test reductions/test.mjs
node reductions/rejouer.mjs A
node reductions/rejouer.mjs B
node reductions/rejouer.mjs C
```

Les trois rejeux utilisent par défaut `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. Le test de témoin injecte uniquement des commandes dans l'interface publique. L'évaluateur énumère séparément les plans finis et assemble les politiques compatibles avec les mêmes retours. Pour vérifier un autre gel ayant la même entrée et les mêmes dépendances, employer `node reductions/rejouer.mjs A <SHA-complet> <dépôt> --exiger-passage`, puis B et C. Chaque écart au critère produit un code de sortie non nul.

Les JSON des trois fiches ne contiennent que le message public. La fiche débute chaque partie dans l'enveloppe `fiche`. [Contrat du dialogue](../DIALOGUE.md)
