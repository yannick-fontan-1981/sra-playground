# KATA · préparer le placement d’une pièce annoncée en aperçu

## Critères avant changement

La ligne 32 relève de `preview_packing`. Son témoin KATA N1/T1 porte `ACTION6`. Le départ N1 du catalogue demande six niveaux, 600 gestes par niveau, une limite globale de 16 gestes et aucune curiosité ciblée. Un rejeu prolongé jusqu’à T19 examine la première pièce du niveau suivant. [Catalogue](sic-v8-strategies-observees.md?plain=1#L58) · [Matrice](sic-v8-composition-des-98-strategies.md?plain=1#L72)

| Étape | Épreuve préenregistrée |
|---|---|
| Avant T1 | Identifier les pièces visibles, la première pose visée et ce qui indique une sélection en aperçu. Séparer la partition géométrique du trajet encore inconnu. |
| Premier retour | Comparer le retour physique avec la même commande suivie d’une observation stationnaire. Vérifier l’identité sélectionnée, la couleur d’aperçu et la prochaine offre. |
| Réemploi dans une autre configuration | Suivre le modèle de translation acquis dans le premier niveau, sa reprise éventuelle et les deux premières sélections d’un autre ensemble de pièces. Vérifier le moment où le plan choisit une autre pièce et pourquoi elle devient admissible. |
| Retrait de preuve | Au même aperçu courant, retirer du modèle présenté au producteur les translations déjà mesurées et distinguer le premier geste de transport du premier geste de calibration, même s’ils portent la même commande. |

Le résultat doit relier le retour au même membre, à son masque, à la pose visée et à l’époque. Une couverture géométrique conditionnelle reste distincte de la progression officielle. [Producteur](../../src/logos-engine/v6-preview-packing.ts) · [Calcul de partition](../../src/logos-engine/v6-preview-packing-calculus.ts)
