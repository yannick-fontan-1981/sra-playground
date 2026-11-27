# Première divergence attendue pour l’accusé matériel

Attendu fixé sur la fiche publique `reductions/B.json` du lot Transfert, commit `feff88fb4bfbd242ae83dd6ffc450fdd378982c7`. Le consommateur de départ est `f296ac1c2e18f9d02b8e3045c3a225c61553c0e6`. La session comporte un seul geste en vol. Sa première commande doit rester `indexer P`.

| Retour après cette commande | Gel | Candidat attendu |
| --- | --- | --- |
| `indexé`, annoncé exactement en ligne 3 pour cette commande | Arrêt avant de mettre la mémoire à jour | Établir `indexed(P) = true` à partir de l’exécution reconnue et de l’effet public de la ligne 3. Émettre `valider` au tour 2, puis recevoir `succès`. |
| `Action indisponible.` | Arrêt | Conserver le refus et le dernier état confirmé. |
| `autre accusé` ou un accusé cité uniquement pour une autre commande | Arrêt pour absence de reconnaissance | Conserver le statut non reconnu et le dernier état confirmé. |
| Deux déclarations incompatibles pour le même geste | Aucun moyen de choisir un libellé | Traiter le retour comme ambigu. Aucun effet confirmé. |

La divergence positive intervient **à la réponse du solveur après le premier retour**, jamais au premier choix. Une variante gardera un fait indépendant explicitement inconnu avant et après ce geste. La reconnaissance devra suivre un libellé public renommé et une commande renommée. Les gestes et retours de lecture des 18 anciens départs de développement doivent continuer à se rejouer à l’identique. Aucun libellé propre à la troisième mécanique n’entre dans le vocabulaire du solveur.
