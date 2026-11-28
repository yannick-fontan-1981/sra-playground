# SP80 · préparer les branches et sonder un champ de cellules

## Critères avant intervention

Le code historique `8ce7ee35` et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` retrouvent la même session de 16 libérations et retours. Options de `strategy-inventory&actions=16`, départ N1, sans `curious` ni graine explicite, six niveaux cibles, 600 actions par niveau. Le premier geste de 4 porte `branch_routing / parallel_branch_routing`. Le premier de 41 porte `public_occurrence_recall / cell_patch_composition / cell_patch_placement`. [Catalogue de 4](sic-v8-strategies-observees.md?plain=1#L30) · [Catalogue de 41](sic-v8-strategies-observees.md?plain=1#L67)

| Ligne | Point du catalogue | Variation discriminante et limite |
|---|---|---|
| 4 | N1/T1, `ACTION1` mesure le déplacement du contributeur actif, sans prédiction. Suivre l’acquisition des directions, la préparation par déplacement, la propagation et la reprise en N2. | Changer uniquement l’offre de commande de calibrage, mesurer la nouvelle pose puis la question suivante. Un déplacement déjà établi ou un essai consigné pour cette pose doit être distingué d’un premier essai. |
| 41 | N2/T12, `ACTION6(13,25)`. L’offre voit un champ 2 × 2. Le retour T12 change deux pixels à y=63, hors du champ. Les quatre tickets suivants sur ce préfixe répètent le même point. | Tester le retrait de cette offre à T12, le choix de l’autre case vide et le cas construit où toute l’image reste identique. Rechercher une acquisition locale datée dans le retour réel. Une répétition sans motif appris ne suffit pas à qualifier une stratégie de placement efficace. |

Les 11 gestes de 4 et 5 des 45 gestes catalogue de 41 sont présents sur ce départ. Les verdicts devront dire si l’une des familles est effectivement consommatrice du reçu de l’autre, et distinguer un changement d’ordonnancement d’une preuve de transmission. Les commandes, les gardes de pose et la mesure du motif restent propres à chaque propriétaire. [Branches](../../src/logos-engine/v6-branch-routing.ts) · [Cellules](../../src/logos-engine/v6-cell-placement.ts)
