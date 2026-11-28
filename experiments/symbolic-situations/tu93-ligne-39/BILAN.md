# TU93 · verdict indépendant de la ligne 39

**Les deux pas d’accès alterné sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `49a971c37982154ea175294afffdf83469c1c302`. Six départs et **95 gestes par SHA**, mêmes décisions et retours. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/22213bfa/experiments/symbolic-situations/tu93-ligne-39/CONTRAT.md)

- À partir de six échantillons de l’acteur courant, le service mesure un graphe de 31 nœuds et 32 arêtes. L’unique mesure ACTION4 utile vient du T4 et vaut (0,+6). Au T15, le graphe prévoit un trajet de 18 arêtes. Le service dispose de deux gestes et joue ACTION4 de (15,15) à (15,21), puis ACTION2 vers (21,21). Les deux retours confirment leur pas, ni le reste du trajet ni l’accès terminal n’ont été exécutés. Le niveau est toujours N1.
- Au même T15, retirer l’unique mesure ACTION4 de l’acteur fait passer à `observed_frontier / ACTION3`. Retirer l’offre seule donne le même repli physique. Au T16, le service reprend avec une nouvelle ACTION4 à l’indice 0, confirmée par le jeu.
- Ajouter une mesure ACTION4 opposée avec une signature étrangère laisse les deux pas inchangés. Présenter la même contradiction sous la signature courante fait abstention au T15, puis donne le même repli que le retrait de la mesure. Le contrôle isole le rôle de la signature.
- Le vrai ticket T15 et le même paquet physique, présenté sur un plateau stationnaire, donnent `matched:false`. Le service scelle le préfixe et mémorise la clé de l’essai. Il délivre ensuite ACTION3 sous la frontière.

Verdict en 3 min 37 s au premier rejeu. L’opérateur reprend le transport du harnais figé et ajoute le contrôle de preuve contradictoire sous la signature courante. Les assertions de qualification sont indépendantes.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
