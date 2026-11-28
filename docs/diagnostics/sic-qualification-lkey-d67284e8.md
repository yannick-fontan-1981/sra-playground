# LKEY · ligne 72, mode et voisin de même coupe

**Ligne 72 qualifiée sur le gel par le Banc.** Quatre scénarios par SHA sur `d0e7527c` et `d67284e820e8d1987da055096732fc257c679f3f`, critères `e318098c`. [Contrôles](sic-lkey-d67284e8/banc.json) · [Reçus](sic-lkey-d67284e8/recus.zip)

- **Mode acquis.** T10 ACTION5 vient de la frontière. Le retour de l'atelier mesure passivement 0→1 et conserve les deux références 10→11. À T11 le profil marqué et le seul voisin supérieur de même coupe justifient `adjacent_exchange_probe`, ACTION1. Le vrai retour monte le marqueur d'un rang avec changement de géométrie.
- **Deux retraits distincts.** À vue identique, inverser la liste des commandes conserve le même ticket et son vrai déplacement. Enlever le seul voisin de même coupe, ou enlever le seul contraste de mode, retire l'offre. Le service joue ACTION6 sous `public_framed_transfer`, avec le score à zéro. Les deux replis sont exécutés.
- **Reprise.** T12 change le receveur, T13 libère le mode, T14 avance le marqueur sans déplacer la géométrie, puis T15 reprend le mode et T16 donne le passage officiel. Les six tickets d'atelier relisent les profils et le mode mesurés. Leur champ d'extension portable est nul.

Départ N1, graine implicite 0, 16 gestes au total et horloge déterministe. Node 24 et Pyodide local. Depuis le Banc, `$g` désigne les actifs du gel et `$out` un nouveau dossier.

```powershell
foreach ($sha in 'd0e7527c','d67284e8') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game LKEY --game-root $g
}
```
