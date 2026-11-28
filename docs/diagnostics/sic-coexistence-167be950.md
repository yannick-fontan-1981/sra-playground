# Coexistence de 87 lignes SIC sur 167be950

**87 lignes distinctes sur `167be950334988ffbc46a04bc26de60c74fea527`.** Le seuil de 85 a été franchi par la remise commune de VOIS/62, THER/65 et SC25/21, verdict opérateur `1a45d32a`. Les 87 regroupent 55 qualifications au gel et 32 sur branches. Les ajouts au jalon précédent sont **21, 38, 43, 46, 51, 55, 59, 60, 62, 65, 82 et 89**. [Périmètre, filiations et blobs](sic-coexistence-167be950/perimetre.json) · [Jalon 75](sic-coexistence-bf1cbf24.md)

## Moteur commun et témoins

L'assemblage descend directement de `bf1cbf24`. Quatre fichiers propriétaires sont repris au blob exact des preuves WEAV/43 `b01ca9bf`, COMB/46 `24e97436`, KEYD/38 `51d983a7` et KLOT/82 `37983796`. Dans `v6-shared-series.ts`, les options WEAV et COMB sont toutes deux transmises aux chemins de proposition et d'acquisition. Dans `v6-native-runtime.ts`, les deux options sont activées et le lecteur d'inventaire KEYD est rebranché. Les options STCK du parent sont conservées. Les huit autres numéros exercent le code déjà présent.

TypeScript, **593 tests ciblés de raccord** et les 72 scénarios et préfixes des douze groupes ci-dessous passent. [Index des témoins](sic-coexistence-167be950/index.json) · [Reçus ciblés](sic-coexistence-167be950/temoins.zip)

| Ligne | Contrôle rejoué sur 167be950 |
|---|---|
| 21 · SC25 | Le seul lien motif–récepteur change le premier choix à même voie fermée. Le vrai service joue les deux variantes sur le terrain construit. Le franchissement T10 est confirmé dans la même époque. [Preuve construite](sic-qualification-sc25-88e8abe8.md) |
| 38 · KEYD et SKBN | Vrai reçu 8→9 repris. Deux fausses paires refusées au T9 avec le même ACTION4 et le même retour. SKBN conserve ses deux approches contredites. |
| 43 · WEAV | Paire authentique reprise. Première référence étrangère, journal altéré et absence de preuve donnent le même repli joué. La paire demeure conservée en N2. |
| 46 · COMB | Le contre-exemple de même portée retire le produit. Une arête mesurée au tuple complet permet un seul pas, confirmé et scellé. |
| 51 · SELE | Les images intermédiaires établissent le front du T4 et l'ordre du T18. La dernière image seule conserve le score du T18 et perd la preuve des fronts. |
| 55 · RSWP | La remesure des trois zones justifie T8 et T16. Retirer seulement le journal garde le choix. Retirer le receveur remesuré bloque. |
| 59 · COLM | Une seule trame de réception distinguée à T3. Son retrait change le statut et T4, avec le même score et le même `matched:null`. |
| 60 · PIPE | Même clic au T15. Après un pixel extérieur au T14, l'indice repasse de 1 à 0 dans un nouveau plan. |
| 62 · VOIS | Carré déplacé à pions fixes change le sujet. Retrait du carré prive l'appariement d'une destination et empêche la reprise. |
| 65 · THER | Ajout et coupe acquis et consommés. Sur V42/N5, une marque supplémentaire est comptée et les contraintes conjointes bloquent. |
| 82 · KLOT | T7 et T9 attribuent le rôle conditionnel lorsque seul un autre corps bouge. Le rejet du plan et l'arrêt sont conservés. |
| 89 · CD82 | Le modèle appris donne ACTION5 à même programme au N2/T10. Sans lui, ACTION1 de recalibrage. Le pixel de référence altéré est refusé séparément. |

Pour SC25, le catalogue officiel atteste l'activation et l'effacement T15. Le franchissement du terrain construit n'a pas été observé dans les deux captures officielles arrêtées au plafond mural de N6. La campagne complète atteste les scores et reçus de SC25 à la résolution historique. [Parcours officiel et ses bornes](sic-qualification-sc25-6172e2d3.md)

## Campagne des 107

Une seule campagne de 24 lots depuis L1, mode `sic`, un travailleur par parcours, plafonds et catalogue historiques. Le workflow ne change que le fichier de CI. **107/107 jeux, 692 niveaux et 18 560 commandes**, sans écart de reçu contre le gel et le parent `bf1cbf24`. La reprise importe 3 reçus, puis 104, et réutilise les 107 lors du contrôle suivant. Durée **11 min 48 s**. La granularité des 107 est celle des reçus du gel. Les douze groupes ciblés suivent les décisions et leurs preuves. [Campagne 46106829666](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46106829666) · [Reçus](sic-coexistence-167be950/recus.zip) · [Verdict par jeu](sic-coexistence-167be950/qualification.json)

```powershell
py -3.11 scripts/check-sic-coexistence.py docs/diagnostics/sic-coexistence-167be950/recus.zip --candidate 167be950334988ffbc46a04bc26de60c74fea527 --workflow 4a12aaea0bf6a59d155bc9cca3200ee47b9c4f89 --run 46106829666
```

Depuis le Banc, `$m` désigne le checkout du moteur avec Pyodide et `$out` un nouveau dossier. Utiliser Node 24.

```powershell
foreach ($jeu in 'WEAV-PROVENANCE','COMB-CONTRE-EXEMPLE','SELE','RSWP','COLM','PIPE','VOIS','THER') {
  py -3.11 scripts/test-sic-coexistence-recall.py $jeu $m "$out/$jeu"
}
foreach ($jeu in 'KEYD','KLOT','SC25') {
  py -3.11 scripts/test-sic-coexistence-provenance.py $jeu $m "$out/$jeu"
}
py -3.11 scripts/test-sic-coexistence-catalogue.py CD82 $m "$out/CD82"
```

Le gel officiel et `main` distant restent à `d0e7527c`.
