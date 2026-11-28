# MEMO · qualification de la ligne 56 sur un exemple acquis

**Le rappel de la ligne 56 est qualifié sur le gel.** Dans MEMO, le service tire son choix d’un exemple mémorisé. `4d9f1a39` et `d0e7527c` ont le même arbre moteur et reproduisent les mêmes parcours. [Contrat scellé](CONTRAT.md) · [Reçu indépendant](recu.json)

Les six premiers clics ont un indice courant et acquièrent chacun un reçu `forward`. Le retour de T6 conserve le contexte observé avant ce geste et ses trois occurrences. Au T7, aucun des trois candidats courants n’est marqué. Le point (46,41), non choisi à T6, est le seul exemple ancien au même masque et à la même couleur que l’occurrence courante (15,35). Les quatre modèles convergent sur ce candidat. Chacun dispose de quatre appuis, sans contre-exemple. Le service joue (15,35) en citant la coupe courante et l’exemple de T6. Son vrai retour est `forward`. T8 rappelle l’occurrence suivante en (14,28) et son retour est également `forward`.

| Intervention au même T7 | Résultat |
|---|---|
| Retirer (46,41) uniquement de l’entrée de comparaison | Les quatre comparaisons rendent zéro candidat. Le service donne (37,13) au contact animé. Son vrai retour ne crée aucun reçu d’occurrence et le service s’arrête ensuite sur `frontier_unknown`. |
| Retirer (14,37) de la même entrée | Les preuves et le choix restent identiques au nominal aux T7–T8. |
| Permuter les deux premiers exemples dans la réserve | La comparaison exploite le même ensemble d’exemples. Les tickets et leurs vrais retours restent identiques. |

Le préfixe T1–T6 est identique dans les quatre départs. Les variantes conservent le contexte porté par le fournisseur, les autres exemples, la calibration et les modèles. Le vérificateur rejette une attribution de la correspondance au point (14,37), même avec la bonne référence de contexte.

**Rattachement SPOR.** Le T3 de SPOR reste un exemple de rappel fondé sur l’enclos visible, avec une mémoire d’exemples vide. Le retrait de l’acquis T1 y conserve l’offre. Le témoin positif MEMO vérifie la dépendance à un exemple acquis sur ses propres départs. [Bilan SPOR](https://github.com/yannick-fontan-1981/sra-playground/blob/0b10cbc4/experiments/symbolic-situations/spor-ligne-9/BILAN.md)

Quatre départs et **31 gestes par SHA**. Les deux tickets MEMO fondés sur le souvenir sont suivis jusqu’à leur vrai retour dans le parcours nominal. Le verdict a été vérifié **1 min 51 s** après le premier essai. Le premier lancement s’est arrêté avant jeu sur un point d’instrumentation qui attendait des fins de ligne LF. Le harnais normalise désormais le fichier transporté avant d’y raccorder la comparaison.

### Rejeu

Sous Node 24, depuis ce dossier, `$pyodide` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf. Le fichier de sélection reste chez l’opérateur.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','4d9f1a397bd3706469f419739d077d366eb1b13c')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles','réserve')) {
    node qualifier.mjs $sha $g $pyodide "$p.$g.json" $sélection
  }
}
node verifier.mjs $reçus
```
