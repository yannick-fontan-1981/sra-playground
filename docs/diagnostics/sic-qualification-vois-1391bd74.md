# VOIS · ligne 62, population appariée et déplacement d'un membre

**Ligne 62 qualifiée sur le gel par le Banc.** Six préfixes, 183 tests, 16 commandes et retours nominaux concordants avec le catalogue `8ce7ee35`. Harnais `1391bd741ad11addfce68370db8969cd3d37b6b0`, critères `90e41585`. Premier essai à 01:04:25 le 28 novembre (UTC−3). [Contrôles](sic-vois-1391bd74/banc.json) · [Journaux](sic-vois-1391bd74/recus.zip)

- À pions et cadres identiques, déplacer le seul carré 8 change les destinations de [5,6] et [5,7] vers [5,7] et [6,6]. Le service sélectionne l'autre pion au clic (43,23). Le vrai jeu restitue ensuite son motif et ferme ce plan construit.
- Retirer le carré 14 avant T1 laisse une place pour deux pions. Le producteur s'abstient, puis une autre famille prend la main. Dans le vrai plan en T6, présenter le retour avec ce seul carré retiré conserve l'empreinte physique et rend la revalidation bloquante.
- T2 observe un unique pion qui se déplace de [5,3] à [4,3]. Le retour stationnaire construit n'acquiert pas cette direction. En T6 l'appariement entier justifie les destinations des deux pions. Le premier les atteint en T8. Après la progression officielle T14, N2 remesure quatre pions et confirme de nouveau le contrôle au T16.

Node 24, départ N1, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais avec Pyodide local, `$b` désigne le Banc et `$out` un nouveau reçu.

```powershell
node experiments/sic-agenda-offres/vois-62/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
py -3.11 "$b/scripts/check-sic-spatial-assembly.py" VOIS $out
```
