# Corrigé

Les mêmes observations initiales sont compatibles avec deux mondes. X4c94cf exige X82259e et X6e9ba2 exige Xa16dcd. Le premier marquage est irréversible. Quel que soit le tampon choisi maintenant, au moins un monde devient insoluble.

Commencer par `lire`. La lecture départage ces mondes.

**Cadran sur X4c94cf.** La sortie exige X82259e sur les deux cases. Chacun des ordres suivants convient.

- `marquer X022d46 X82259e` → `marquer Xfc26f3 X82259e` → `valider`
- `marquer Xfc26f3 X82259e` → `marquer X022d46 X82259e` → `valider`

**Cadran sur X6e9ba2.** La sortie exige Xa16dcd sur les deux cases. Chacun des ordres suivants convient.

- `marquer X022d46 Xa16dcd` → `marquer Xfc26f3 Xa16dcd` → `valider`
- `marquer Xfc26f3 Xa16dcd` → `marquer X022d46 Xa16dcd` → `valider`

Le minimum garanti est de 4 actions. Il faut deux marquages et une validation, ainsi qu’une lecture avant de s’engager. L’ordre des cases peut être choisi indépendamment pour chaque résultat de lecture.
