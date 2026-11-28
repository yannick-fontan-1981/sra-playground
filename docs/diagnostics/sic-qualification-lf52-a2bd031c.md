# LF52 · ligne 76, appui mémorisé et réduction réellement observée

**Ligne 76 qualifiée sur le gel par le Banc.** Trois cas et reçus identiques par SHA sur `d0e7527c` et `a2bd031cff2fb2ce7c919b2213f0ba5a8b75a36a`, critères `df2f4813`. [Contrôles](sic-lf52-a2bd031c/banc.json) · [Reçus](sic-lf52-a2bd031c/recus.zip)

Le vrai premier clic sélectionne [2,3] et conserve les cinq pions. L'appui fixe de [4,3] est déjà mesuré. Après la sélection, la vue de contrôle masque huit de ses pixels et garde la même observation dans les deux bras. Avec l'appui mémorisé, le service libère le saut ACTION6 (30,19) vers [4,3]. Le vrai retour confirme la réduction de cinq à quatre. Retirer seulement cet appui du fournisseur rend ACTION1 de frontière, joué avec un score nul. La présence durable de l'appui est l'hypothèse éprouvée par ce retrait à même vue.

Le nominal joue huit tickets depuis L1. Les sélections ne réduisent pas la population. Les sauts sont confirmés jusqu'au passage officiel T8, dont le reçu est distinct et garde `matched:null`.

Node 24, Pyodide local, graine implicite 0 et horloge déterministe. Depuis le Banc, `$g` désigne les actifs du gel et `$out` une nouvelle sortie.

```powershell
foreach ($sha in 'd0e7527c','a2bd031c') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game LF52 --game-root $g
}
```
