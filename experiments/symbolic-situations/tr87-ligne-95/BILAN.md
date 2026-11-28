# TR87 · dérivation typée et édition mesurée (95)

La dérivation et la composition de l’édition sont attestées au gel `d0e7527c`. La révision de preuve `c41c028c` embarque le même arbre `src`. Les **6 départs et 31 gestes natifs par SHA** donnent les mêmes reçus. Le contrat a été préenregistré à `ee04aeef`. Premier essai au verdict en 9 min 29 s, avec une correction du vérificateur pour lire le compteur de dérivations.

- Au T1, six paires typées fondent une dérivation unique de cinq glyphes. Le premier ACTION1 est exploratoire, avec effet attendu inconnu. Le vrai retour confirme la réécriture du glyphe d’indice 0 et un curseur fixe. Le retrait de la paire nécessaire fait disparaître la dérivation et attribue le même ACTION1 à l’acquisition de contrôle. Retirer une autre paire ou inverser l’ordre de présentation conserve le chemin constaté. Le premier paquet physique est identique.
- Au T8, ACTION2 mesure l’édition inverse. Au T9, ACTION3 mesure le déplacement du curseur. De T10 à T16, les sept étapes du plan sont confirmées par le service. Le score officiel reste à zéro dans la fenêtre de catalogue.
- Présenter T1 comme stationnaire laisse une transition inconnue, suivie d’ACTION2. Au T10, le premier geste planifié est réellement joué et son paquet est inchangé. Si l’observation fournie est stationnaire, le service marque `matched:false`, clôt le préfixe et repropose ACTION2 à l’indice 0. Les sept projections confirmées appartiennent au départ nominal.

## Rejeu

Depuis ce dossier, avec Node 24, les objets Git vérifiés et le répertoire Pyodide local du Banc. Choisir un dossier de reçus vide.

```powershell
node qualifier.mjs gel <pyodide> <reçus>
node qualifier.mjs candidat <pyodide> <reçus>
node verifier.mjs <reçus>
```

Le [reçu](recu.json) contient les dénominateurs et mesures vérifiés.
