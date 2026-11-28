# SC25 · ligne 21, marche sur deux terrains construits

Sur `d0e7527c` et `4dcc659183c31502edcca85f29d661426660a426`, trois contrôles passent avec le service natif. Le terrain indépendant calcule les réponses aux tickets dans deux orientations. Le propriétaire `MotifAccess` mesure les mouvements à partir de ces réponses. Critères `d4f1eec1`, complément opérateur `bb57dc99`. [Contrôles](sic-sc25-4dcc6591/banc.json) · [Reçus](sic-sc25-4dcc6591/recus.zip)

- Au T3, la branche ouverte et la branche fermée jouent le même `ACTION6 (7,24)` et effacent les mêmes bits. L'ouverture ajoute dix pixels de support. Sur cette vue, `motifRoute` utilise le vecteur acquis par ACTION4 au T1, puis `MotifAccess` libère la marche. Le T5 occupe le support ajouté et la prédiction est confirmée. Cas fermé, le vrai ticket de repli réactive l'autre bit et le corps reste immobile.
- Au T4, les deux variantes indépendantes gardent la même vue ouverte. Retirer de l'offre la citation du retour d'invocation laisse la marche et son vrai retour confirmés dans les deux axes. Retirer la mesure du vecteur ramène un ticket de calibrage. Les preuves causales de cette marche sont le support visible et la translation mesurée.
- Le réemploi de la preuve « ce motif ouvre cet accès » avant apparition du support reste à démontrer. Le parcours officiel conserve son verdict partiel. Son invocation observée efface la grille puis la famille de placement reprend. [SC25 officiel](sic-qualification-sc25-6172e2d3.md)

```powershell
$out = 'artifacts/sc25-acces-rejeu'
py -3.11 scripts/test-sic-sc25-access.py d0e7527c $out
py -3.11 scripts/test-sic-sc25-access.py 4dcc6591 $out
```
