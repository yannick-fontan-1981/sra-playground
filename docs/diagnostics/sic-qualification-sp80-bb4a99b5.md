# SP80 · routage 4 et placement 41

**4 est qualifiée sur `bb4a99b5ba41531eb70f1dccb6a97a919cefec56`. 41 reste partielle sur SP80.** Les huit tests de la branche passent. Le gel passe les quatre tests communs ; les quatre interventions sur les nouveaux sélecteurs nécessitent la branche. Les trois sessions communes ont les mêmes tickets, gardes, acquisitions et retours. [Index et contrôles](sic-sp80-bb4a99b5/banc.json) · [Reçus complets du banc](sic-sp80-bb4a99b5/recus.zip)

| Ligne | Ticket et retour natifs | Substitution à état égal et portée |
|---|---|---|
| **4** · 11/11 occurrences du catalogue | `parallel_branch_routing` aux T1–11, avec calibrages, déplacements, propagation au T8 et sélection au T11. Le T1 nominal `ACTION1` déplace la pose (12,16) vers (12,12). | Au même T1, `BranchRouting.selectCalibration` admet aussi `ACTION2`. Le retour lie le déplacement (0,+4) à sa propre référence. T2 et T3 émettent `ACTION1`, puis `ACTION3`. Retirer le calibrage fait émettre la même commande nominale `ACTION1` par la frontière, qui n’acquiert aucune calibration de branche. Le routage doit la mesurer lui-même au T2 et demande `ACTION2` au T3. |
| **41** · 5 des 45 occurrences du catalogue sur SP80 | N2/T12–16, le service propose une cellule avec modèle et motif attendu nuls. Après le T12, seuls (4,63) et (5,63) changent. La grille du champ reste identique et aucun modèle de placement n’est acquis. | Au même T12, choisir l’autre cellule admissible libère (33,17) au lieu de (13,25). Le vrai retour change exactement les deux mêmes pixels de bord. T13 repropose (13,25), puis un pixel (6,63) change, toujours hors champ. Retirer toute l’offre libère `ACTION4` par le routage, dont la projection est confirmée. |

Le premier choix de 41, son retrait et sa reprise sont observables sur la branche. Pour créditer le placement, il manque un retour montrant le motif dans le champ et la décision qui utilise cette nouvelle preuve. La qualification de 4 s’appuie exclusivement sur son fichier `v6-branch-routing.ts`. L’autre fichier du candidat, `v6-cell-placement.ts`, relève de 41.

Départ catalogue N1, curiosité native, plafond global 16 et 600 par niveau. La graine du pont vaut 0. Contrat `36d5023a`. Les sept sessions sur branche comprennent la nominale, les variations contrôlées et les quatre alternatives physiques. Les variations de paquets construites sont distinctes des retours du jeu chargé depuis N1. Le banc enregistre les coordonnées changées lorsque huit pixels au plus diffèrent, et conserve le nombre exact dans tous les cas. [Tests de la branche](https://github.com/yannick-fontan-1981/sra-playground/blob/bb4a99b5/tests/sic-sp80-two-lines.test.ts)

Depuis le banc, avec Node 24.22.3, les jeux et Pyodide préparés :

```powershell
foreach ($version in 'd0e7527c','bb4a99b5') {
  py -3.11 scripts/test-sic-catalogue-lines.py $version artifacts/verification-sp80 --game SP80 --game-root ../sic-main-delivery --node node
}
```
