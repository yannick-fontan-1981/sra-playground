# LP85 · ligne 24, composer des permutations mesurées

**Ligne 24 qualifiée sur le gel.** Les deux scénarios donnent les mêmes champs capturés sur `d0e7527c`, `80d14be16d5f3d4fa1f84c0c92498902e96a5e3f` et `674b0dd1`. Le harnais partage le moteur du gel. Critères `0137bd82` et opérateur `7234555b`. Rejeu indépendant le 27 novembre de 23:53:59 à 23:56:20. Rejeu assemblé terminé à 23:57:33 (UTC−3). [Reçus](sic-lp85-80d14be1/recus.zip) · [Contrôles](sic-lp85-80d14be1/banc.json)

- **N1/T3.** Deux contrôles ont leur propre mesure. Avec l’acquis de T1, le clic (5,32) engage un plan de cinq gestes et prédit l’arrangement des 20 cases. Retirer cet acquis au même état conserve le clic, mais réduit le plan à un geste sans prédiction. Le jeu rend le même arrangement et le même paquet. Les comparateurs donnent respectivement `matched:true` et `matched:null`. La preuve du vrai T3 permet la reprise au T4. Un changement de contenu au même point entraîne le refus de la garde du plan déjà lié.
- **N2/T15–T17.** La grille de 42 cases donne six contrôles possibles. Le T15 est compatible avec plusieurs opérateurs. T16 change la disposition pour les départager. Le retour sélectionne un seul opérateur et T17 dispose de trois opérateurs reconnus. La discrimination repose sur la mesure, tandis que le passage officiel de N1 a déjà été constaté au T7.

Départ N1, ouverture native, graine implicite 0, six niveaux visés, 600 gestes par niveau et 19 gestes de session pour couvrir le second contexte.

```powershell
$out = 'artifacts/rejouer-lp85-24'
foreach ($sha in 'd0e7527c','80d14be1','674b0dd1') {
  py -3.11 scripts/test-sic-catalogue-lines.py $sha --game LP85 $out --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-lp85-orbit.py $out
```
