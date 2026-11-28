# FT09 · verdict indépendant de la ligne 94

**L’inférence par fenêtres répétées, l’adressage et la première prédiction sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et sur la révision du harnais `d0348ec1f1646259b9c95f0fa4a44dd0bb966025`. Neuf départs et **39 gestes par SHA**, mêmes décisions et retours. Quatre tickets de la ligne 94 dans le catalogue de 16 gestes. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/3b5161b1/experiments/symbolic-situations/ft09-ligne-94/CONTRAT.md)

- Les quatre fenêtres fournissent 32 contraintes, dont quatre violées. La règle à alignement unique obtient 28 accords sur 32 par fenêtre laissée de côté, contre 20 pour la référence constante. Au même raster, laisser tour à tour chacune des quatre fenêtres seule écarte l’offre dans les quatre cas. Le service émet un ticket de frontière et retrouve ensuite les contraintes.
- Le clic (38,38) exige un point courant et la cellule (36,36), qui vaut 9 pour une égalité attendue à 8. Retirer uniquement ce point conserve les contraintes et fait réellement jouer (38,46). Son retour réécrit la cellule (36,44).
- Les deux premiers retours nominaux mesurent 9→8 à deux adresses distinctes. Ils rendent possible la prédiction 8 du T3, qui est confirmée. Retirer un seul acquis conserve le clic et le paquet physique, mais réduit l’offre à une question sans prédiction. Présenter le plateau précédent après le vrai T3 réfute et scelle la prédiction. Le contrôle stationnaire au T1 n’acquiert aucune réécriture. Au nominal, le T4 valide N1.
- HPDL/75 et FT09 utilisent chacun OP18, un point lié à l’observation et un premier retour de question scellé. HPDL consomme la méthode de réglage mesurée au tour précédent. FT09 induit les contraintes à partir des fenêtres du plateau courant et apprend ensuite les réécritures. Les gardes et l’inférence restent propres à leur famille. [Qualification HPDL/75](https://github.com/yannick-fontan-1981/sra-playground/blob/fe76900b/experiments/symbolic-situations/hpdl-ligne-75/BILAN.md)

Verdict en **4 min**, au premier rejeu indépendant.

## Rejeu

Sous Node 24, depuis ce dossier. `$py` désigne le répertoire Pyodide du Banc. Utiliser des dossiers de sortie neufs.

```powershell
node ../hpdl-ligne-75/qualifier.mjs gel $py $reçusHpdl
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus "$reçusHpdl/gel.nominal.json"
```
