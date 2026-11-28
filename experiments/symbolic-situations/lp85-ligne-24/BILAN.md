# LP85 · verdict indépendant de la ligne 24

**L’acquisition de permutations d’emplacements et leur composition sont qualifiées sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `80d14be16d5f3d4fa1f84c0c92498902e96a5e3f`. Quatre départs, **39 gestes et deux tests auteur par SHA**. Les 16 tickets catalogue et les retours concordent. La prolongation joue aussi le T17. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/f8536634/experiments/symbolic-situations/lp85-ligne-24/CONTRAT.md)

- Au départ, le moteur mesure 20 emplacements 4×4, deux commandes et la cible de coin. Les deux premiers clics donnent chacun une permutation ajustée localement. Au T3, le même clic (5,32) qu’au T1 devient le début d’un plan de cinq gestes. Le vrai raster confirme les 20 valeurs prédites, vérifiées directement dans les cellules. Au T4, modifier une seule cellule du raster à la garde motive le refus du pas préparé.
- Retirer uniquement l’acquis rattaché au T1, à même observation T3, conserve le clic et le paquet. Le ticket devient une question d’un seul geste, sans prédiction. Son vrai retour retrouve la deuxième permutation et le service émet un nouveau plan. Présenter le plateau précédent au même vrai T3 réfute la projection, ne soutient aucune permutation pour le geste et déclenche le clic (58,32).
- Le vrai T7 ouvre N2, où le moteur remesure 42 emplacements et six commandes. Le clic (14,26) au T15 laisse deux permutations. Le même clic au T16, sur un arrangement différent, en confirme une. Le T17 dispose alors de trois opérateurs observés au total. Le score reste à un dans cette prolongation.

Verdict en **2 min 14 s**, au premier rejeu indépendant.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc. Utiliser un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','80d14be16d5f3d4fa1f84c0c92498902e96a5e3f')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
