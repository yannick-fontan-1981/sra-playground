# CD82 · ligne 89, modèle d'écriture repris sur une nouvelle surface

**Ligne 89 qualifiée sur le gel par le Banc.** Deux scénarios par SHA, reçus identiques sur `d0e7527c` et `a6f7b0de19f013b132ff133b1084be86988b2dc1`. Critères `ee9574b1`. Premier essai à 01:00:14 le 28 novembre (UTC−3). [Contrôles](sic-cd82-a6f7b0de/banc.json) · [Reçus](sic-cd82-a6f7b0de/recus.zip)

- **Apprentissage en N1.** Le premier ACTION1 ramène 240 affectations possibles à 96 sans changer la zone éditable. Au T9, ACTION5 est choisi avec un seul modèle et le paquet officiel confirme le passage en N2.
- **Réemploi en N2.** Sur une nouvelle référence, les deux écritures visées sont [6,15] puis [1,12]. Avec le modèle acquis, T10 applique ACTION5. Son vrai retour change 50 pixels dans la zone éditable et zéro dans le modèle fixe. À vue et programme égaux, retirer uniquement l'affectation rouvre 240 modèles et donne ACTION1. Le vrai retour laisse la surface intacte, `matched:null`, puis le service propose ACTION2 parmi 96 modèles.
- **Garde et suite.** Au T10 nominal, une référence où un seul pixel a changé est refusée par la garde réelle. Le paquet non altéré autorise le pas. T11 choisit la nuance à (46,4). La deuxième écriture donne le passage officiel au T15.

Départ N1 avec Node 24, Pyodide local, graine implicite 0, 600 gestes par niveau et 16 au total. Le test emploie une horloge déterministe. `$g` désigne les actifs du gel et `$out` un nouveau dossier de reçus.

```powershell
foreach ($sha in 'd0e7527c','a6f7b0de') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game CD82 --game-root $g
}
```
