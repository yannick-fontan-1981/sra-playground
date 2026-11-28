# SYME · relation de miroir et ambiguïté périodique (78)

Relation de miroir et choix local attestés sur le gel `d0e7527c` et reproduits sur `85194a49` avec arbre `src` identique. **8 départs distincts et 2 recaptures des tableaux construits, 18 gestes natifs par SHA**. Présélection `bea42ed7`. Premier essai au verdict en 7 min 30 s.

- L’énumération des 36 paires de la grille mesure 27 égalités et 9 contrastes avec une valeur exceptionnelle. La cellule `(5,33)` cite le correspondant `(53,33)`. Remplacer seulement sa valeur de 9 par 8 laisse le clic `(7,35)` et change la valeur requise. Modifier la cellule centrale, hors de cette relation, préserve le clic et la contrainte 9.
- Sur le plateau natif, le vrai premier clic écrit 9. Le moteur n’avait pas annoncé de valeur d’écriture. Le même clic, avec une valeur source de 8 présentée avant la commande puis le vrai retour du plateau d’origine, ne fournit pas de réécriture locale unique selon le service. Une observation construite qui présente la valeur 0 à la cellule visée sur le même paquet est attribuée comme contre-exemple et fait suivre une question d’information.
- Sur le tableau 4×4 ambigu, deux hypothèses de période 2×2 demandent des écritures sur des ensembles disjoints. L’énumération de la classe de résidu en donne directement l’intersection vide. Le service retire l’offre symétrique. Le tableau où une seule cellule diffère admet une réparation minimale unique et l’offre revient. Le clic visible `(13,13)` est identique et relève de deux familles différentes. Ces départs s’arrêtent à la décision.
- Le parcours de 16 gestes confirme un premier passage officiel au T9. Les interventions de relation et de périodicité ne mesurent que leur décision locale.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et Pyodide local du Banc. Choisir un dossier de reçus vide.

```powershell
node qualifier.mjs gel <pyodide> <reçus>
node qualifier.mjs candidat <pyodide> <reçus>
node qualifier.mjs gel <pyodide> <reçus>/inventaire inventaire
node qualifier.mjs candidat <pyodide> <reçus>/inventaire inventaire
node verifier.mjs <reçus>
```

Les mesures et dénominateurs sont dans le [reçu](recu.json).
