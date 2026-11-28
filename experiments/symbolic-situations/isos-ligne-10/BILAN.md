# ISOS · verdict indépendant de la ligne 10

**Les transformations de facette et leur reprise nominale sont reproduites sur le gel. La vérification de la provenance du passage reste partielle.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f`. Six départs, **33 gestes et trois tests auteur par SHA**, mêmes décisions et retours. Douze tickets de facette parmi les 16 gestes du catalogue. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/e040ca84/experiments/symbolic-situations/isos-ligne-10/CONTRAT.md)

- Le même ACTION6 (33,23) teste deux étapes distinctes. T1 remplit la face de départ à partir de la correspondance de l’exemple, avec 76 pixels modifiés dans le cadre. T2 teste la calotte alors visible. Il déplace la calotte de (0,−6), étend deux côtés et change 89 pixels dans le cadre. T3 consomme le reçu de T2. Les couches cachées restent inférées.
- Après les gains officiels T3 et T7, les tickets T4 et T8 relient la méthode visible et le reçu de passage au nouveau motif. Les deux vrais retours confirment le rendu coloré prévu. Supprimer seulement la référence du passage laisse intact le vrai changement de niveau mais écarte l’offre de facette des deux reprises. Le service donne (10,14) sous la frontière.
- **Contre-exemple de provenance.** Remplacer au T3 la référence du retour de frontière par celle de l’observation immédiatement antérieure conserve la même offre T4, la même admission et le même retour physique. La référence substituée est inscrite dans la liste des preuves. La géométrie courante est encore remesurée. Ce contrôle établit l’exigence de présence d’une référence, avec un défaut de validation de sa provenance exacte.
- Les retours stationnaires construits au T1 et au T2 ne mesurent aucune transformation et écartent l’offre de facette suivante. Le vrai catalogue atteint N4 après le T12.

Verdict en **4 min 13 s**. Premier rejeu physique réussi. Le reçu agrégé a été corrigé pour comparer le contenu des listes d’empreintes. Aucun changement du moteur.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','5161917eebb0e7f5d2ec6010f61bae1c2eff7b3f')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
