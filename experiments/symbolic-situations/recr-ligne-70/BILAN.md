# RECR · reprise du combat après un changement d’ordre (70)

Décision, invalidation du suffixe et reprise qualifiées sur le gel `d0e7527c` et reproduites à l’identique sur `01f8fd39` dont l’arbre `src` est identique. **4 départs et 23 gestes natifs par SHA**. Présélection `c1cd20bc`. Premier essai au verdict en 5 min 02 s, avec une correction d’assertion pour le préfixe vide.

- T2 ajoute le sujet 0 après les deux sujets 2 et laisse une étape au suffixe. À paquet physique identique, la permutation présentée `[2,2,0] → [0,2,2]` garde les couleurs, la légende, les salles et leurs liens. Elle retire le suffixe. La simulation indépendante à partir de la légende publiée donne un premier duel gagné par la droite et un survivant à gauche au nominal. Avec la permutation, le premier duel revient à la gauche et les trois sujets de gauche survivent dans la projection.
- Le T3 ACTION5 alternatif est joué sur le vrai plateau d’origine. Il produit le même paquet qu’au nominal, fait passer en N2 et ne fournit aucun comptage des survivants à l’état final du niveau. Trois survivants est la conséquence projetée dans la file permutée présentée au service. T4 reprend la commande nominale dans la nouvelle salle.
- Le retour T2 présenté stationnaire retire le suffixe et donne le clic de repli `(10,63)` sous `observed_frontier`. Le nominal de 16 gestes enregistre deux gains officiels.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et Pyodide local du Banc. Choisir un dossier de reçus vide.

```powershell
node qualifier.mjs gel <pyodide> <reçus>
node qualifier.mjs candidat <pyodide> <reçus>
node verifier.mjs <reçus>
```

Les mesures et dénominateurs sont dans le [reçu](recu.json).
