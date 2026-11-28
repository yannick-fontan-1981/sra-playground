# COMB · ligne 46

**Qualification partielle au gel.** Au T3, le service compose une hypothèse après deux mesures distinctes. Au T9, il utilise une arête déjà observée et joue le second geste au T10. Dans deux perturbations construites, le journal contient une mesure multifactorielle de la même commande dans la même portée. Elle n’écarte ni le premier plan conditionnel au T3, ni la reprise d’arête au T9. Le harnais `07e70e95d36a9c9543927fda8dc1a9193a011fdd` et le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` ont le même arbre moteur et donnent des reçus identiques sur les neuf départs, 45 gestes par SHA.

- N1/T1 `(24,20)` mesure `[4,4] → [9,4]`, puis T2 `(38,20)` mesure `[9,4] → [9,8]`. Un retour stationnaire et le vrai clic remesuré dans un retour multifactoriel construit laissent chacun zéro arête après T1. Le second cas inscrit les facteurs 0 et 1 et leurs deux références au journal. Catalogue incomplet, arête retirée et réserve d’un seul geste donnent respectivement un repli, un sondage au T3 et un repli pour trajet borné absent.
- N1/T3 prédit `[4,8]` sous l’hypothèse d’indépendance conditionnelle et fait jouer `(24,20)`. Le retour officiel donne le niveau suivant et `matched:false`. Le geste demeure expérimental. Avec le contre-exemple T1 chargé dans le journal, mêmes arêtes, même hypothèse, même garde, même ticket et même retour.
- N2/T5 construit le second contre-exemple `[9,4,4] → [4,8,4]` pour `(31,20)`. Le retour natif instrumenté garde l’arête préexistante et inscrit le contre-exemple sans ajouter d’arête. Au T9, la présence de cette preuve dans la même époque et la même géométrie laisse la relation marquée observée et le ticket `(31,20)` inchangé. Le vrai retour est `matched:true`. Au T10, le garde admet le second geste depuis `[4,8,11]` et le jeu confirme le deuxième niveau. Les deux variantes utilisent à la décision la vue nominale et les mêmes arêtes. Seules l’entrée contradictoire construite et ses références sont ajoutées.
- Le nominal couvre 13 tickets de cette famille sur les 16 gestes. Le journal des variantes est acquis par le même enregistreur natif à partir d’images construites, puis réintroduit à la coupure pour isoler son effet. Ces images ne sont pas des retours officiels du jeu.

Préenregistrement opérateur `3c314f46`, reçu auteur `7dc37fb69bbad0be778ab710e0c6778b08d41548`, attente auteur `8eec03c6`. Premier essai à 00:08:38, verdict à 00:16:50 (UTC−3, 8 min 12 s). La seconde passe a ajouté la contradiction sur la reprise N2. Voir [reçu compact](recu.json).

Depuis ce dossier, avec Node 24 et Pyodide local. Utiliser un nouveau dossier de sortie pour chaque rejeu.

```powershell
$py = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
$out = Join-Path $env:TEMP ('sic-comb-46-' + [guid]::NewGuid())
node qualifier.mjs gel $py $out
node qualifier.mjs candidat $py $out
node verifier.mjs $out
```
