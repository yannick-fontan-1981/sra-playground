# CRAF · attribution de la conversion et réemploi (73)

La conversion et son emploi au N2 sont attestés sur le gel `d0e7527c` et reproduits sur `c9737d98`, dont l’arbre `src` est identique. Les reçus sont identiques sur **6 départs et 44 gestes par SHA**. Présélection `e1a515c4`. Premier essai au verdict en 4 min 13 s.

- T1 ouvre la sélection guidée. Ouvrir un pixel du cadre tout en gardant son contenu retire ce ticket. Le vrai paquet de T1 présenté stationnaire donne le même repli `(10,11)`, sans contraste acquis.
- Les vrais chargements du T2 et T4 rendent les opérandes 11 et 9 disponibles. T5 enregistre la disparition des deux opérandes et l’apparition du produit 14. À paquet identique, substituer le produit ou rétablir l’opérande 11 retire le contraste de conversion. Les clics et paquets de T6 et T9 restent identiques, et le vrai gain T9 survient. La méthode reste absente dans les deux variantes. Si tout le retour T5 est présenté stationnaire, T6 pose une question sur un autre point et T9 ne fait pas gagner de niveau.
- Au T9 nominal, le passage crée la méthode en citant le retour de conversion. Les tickets N2/T10 `(4,31)` et T11 `(47,44)` citent cette méthode et ont deux effets physiques distincts, sélection puis réception. Sans le contraste de T5, la frontière déclenche un repli générique au N2 même après le gain officiel.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et Pyodide local du Banc. Choisir un dossier de reçus vide.

```powershell
node qualifier.mjs gel <pyodide> <reçus>
node qualifier.mjs candidat <pyodide> <reçus>
node verifier.mjs <reçus>
```

Les mesures et dénominateurs sont dans le [reçu](recu.json).
