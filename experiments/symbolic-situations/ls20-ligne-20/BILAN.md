# LS20 · verdict indépendant de la ligne 20

**La voie morphologique et l’emploi de la preuve sélective sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `a0af03d0f7c1ebe722b3b7b8bc4db4ba05364025`. Six départs, **72 gestes et trois tests auteur par SHA**. Les deux révisions concordent et les dix occurrences catalogue sont rejouées. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/22213bfa/experiments/symbolic-situations/ls20-ligne-20/CONTRAT.md)

- T7 mesure une paire homologue asymétrique, de même couleur et d’orientation différente, à deux échelles. ACTION3 déplace le porteur de (24,45) à (19,45) avec 52 pixels changés. Le retour confirme le déplacement sous `morphology / morphology_probe`.
- Le vrai T10 atteint (19,30). La mesure de station relie le résidu d’orientation 3→0 à l’empreinte modifiée du sujet mobile, tandis que la pose et la couleur du pair sont conservées. La comparaison générale du déplacement rend `matched:null` au contact. T11 exploite le reçu pour accéder au pair, puis T14 le réutilise dans un second contexte. Les deux premiers déplacements de ces routes sont confirmés.
- Rendre l’orientation ambiguë, ou réutiliser la référence T5 sur la même offre T7, écarte la contribution pour deux motifs distincts. Les deux contrôles libèrent ACTION2 sous `view`, avec un vrai effet différent de la voie morphologique.
- Retirer seulement la preuve sélective à même état T14 refuse la contribution morphologique. Le repli `view` libère la même ACTION4 et obtient la même image. Le reçu appartient au repli, et le vérificateur rejette son attribution au ticket morphologique.
- Le retour T10 construit à plateau stationnaire conserve la preuve du vrai paquet joué séparément. Il n’acquiert ni station ni pair inchangé et laisse le T11 à `view / ACTION3`.

Le catalogue s’arrête après T16, sans progression officielle. La prolongation distincte confirme N2 après T17. Verdict vérifié en 3 min 42 s au premier rejeu.

## Rejeu

Sous Node 24, depuis ce dossier. `$jeu` désigne la racine du Banc et `$reçus` un dossier de sortie neuf.

```powershell
foreach ($sha in @('d0e7527ca8033bd805a6d7a8bb021eff62e87021','a0af03d0f7c1ebe722b3b7b8bc4db4ba05364025')) {
  $p = "$reçus/$($sha.Substring(0,8))"
  foreach ($g in @('nominal','contrôles')) {
    node qualifier.mjs $sha $g $jeu "$p.$g.json"
  }
  node qualifier.mjs $sha auteur $jeu "$p.auteur.txt"
}
node verifier.mjs $reçus
```
