# TRIA · ligne 79, relation et sujet réellement déplacé

**Ligne 79 qualifiée sur le gel par le Banc.** Deux scénarios par SHA, reçus identiques sur `d0e7527c` et `735b5e7d9fc3d3b426588e4d619187d925d269f0`. Critères `d04c7c6f`. [Contrôles](sic-tria-735b5e7d/banc.json) · [Reçus](sic-tria-735b5e7d/recus.zip)

- **Vue officielle.** Le T1 sélectionne le sujet en [8,6] et le T2 confirme le passage en N2. Le T3 du N2 sélectionne d'abord [0,9] au clic (4,29) pour compléter l'alignement. T8 sélectionne ensuite [14,2]. Le vrai essai T9 observe son déplacement vers [13,3] et la conservation des deux autres sujets. Le deuxième gain officiel survient au T13.
- **Relation variée à apparence locale constante.** Déplacer seulement la case de [0,9] à [12,9] à l'entrée de N2 conserve sa couleur, son masque et les autres objets. L'alignement étant déjà présenté, le T3 sélectionne [14,2] par le vrai clic (46,8). Le T4 essaie (3,57). Le jeu déplace seulement ce sujet vers [13,3], avec les mêmes objets d'appui dans la vue servie. Le score de cette variante reste à un niveau. Le déplacement de la première case dans la vue est une intervention construite.

Départ N1, 16 gestes transmis, graine implicite 0 et horloge déterministe. Avec Node 24 et Pyodide local, `$g` désigne les actifs du gel et `$out` une nouvelle sortie.

```powershell
foreach ($sha in 'd0e7527c','735b5e7d') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha $out --game TRIA --game-root $g
}
```
