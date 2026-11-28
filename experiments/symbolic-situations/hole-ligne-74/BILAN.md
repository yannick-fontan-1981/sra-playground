# HOLE · lecture topologique et retour du clic (74)

La sélection topologique est attestée sur le gel `d0e7527c` et retrouvée à l’identique sur `4f39c408`, dont l’arbre `src` est identique. Le vérificateur compare intégralement **7 départs et 59 gestes natifs par SHA**. Contrat préenregistré à `7266e525`. Premier essai au verdict en 11 min 19 s, avec des rejouages supplémentaires pour distinguer paquet physique et observation présentée.

- Sur l’original, T6 sélectionne le pigment et modifie les 44 pixels attendus. T7 et T8 mesurent 133 et 95 écritures de pigment 9. Le gain officiel arrive à T10. Au N2/T16, 89 pixels prennent le pigment 14.
- Avec le seul pixel `(36,11)` changé dans l’observation présentée, la région conserve son enveloppe et passe d’une poche à zéro. Sa cible calculée passe de 10 à 9. Les vrais clics et paquets de T6 et T7 coïncident avec le nominal. Le clic suivant passe de `(20,32)` à `(43,11)`.
- Le clic alternatif est exécuté sur le plateau natif d’origine. Il écrit le pigment 9 sur 92 pixels. Au regard de la région annoncée avant le clic, le retour natif comporte un changement hors région. La présentation construite qui maintient la poche ouverte donne 91 écritures, toutes dans la région. Ces deux départs partagent le même paquet physique. Le service enregistre une écriture partielle avec `matched:null` dans les deux, puis propose `(20,32)`. La poche ouverte est une intervention sur les observations. Sa progression officielle reste non mesurée.
- T6 stationnaire ou accompagné d’une modification étrangère fraîche perd la confirmation de sélection. Le pixel étranger déjà présent des deux côtés de T6 conserve la sélection et les 95 écritures de T8. Cela contrôle la portée temporelle du changement.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et le répertoire Pyodide local du Banc. Choisir un dossier de reçus vide.

```powershell
node qualifier.mjs gel <pyodide> <reçus>
node qualifier.mjs candidat <pyodide> <reçus>
node verifier.mjs <reçus>
```

Le [reçu](recu.json) contient les dénominateurs et mesures vérifiés.
