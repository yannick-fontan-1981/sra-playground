# B · Reprendre après un accusé matériel

La [fiche publique](B.json) contient un poste, un fait et deux commandes. L'opérateur envoie la fiche dans `{"fiche":…}`. Une seule commande est en vol. Sur le gel `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`, le dialogue enregistré est le suivant.

| Émetteur | Message |
| --- | --- |
| Solveur | `{"action":"indexer P"}` |
| Opérateur | `{"retour":"indexé"}` |
| Solveur | `{"arret":"accusé matériel non reconnu pour la commande demandée"}` |

La ligne 3 de la fiche annonce le libellé exact de l'accusé et l'effet du geste. Le retour confirme l'exécution de la commande en vol. Son effet public établit `indexed(P) = true`. Le schéma v1 porte le libellé dans le texte source et l'effet dans `rules`. Un refus `Action indisponible.` ne confirme aucune exécution. La ligne 4 permet alors de choisir `valider` après l'accusé positif. Le critère de passage est un succès en deux commandes.

Rejeu depuis le dossier `public-format`, avec Node 24 et un dépôt Git contenant le gel du solveur.

```powershell
node reductions/B.mjs f296ac1c2e18f9d02b8e3045c3a225c61553c0e6 D:/dev/ARC-AGI/SRA-Playground/sic-agenda-public-v1
```

Cette réduction provient des quatre arrêts après le premier geste dans l'[épreuve structurelle](../operator/structural/BILAN.md).
