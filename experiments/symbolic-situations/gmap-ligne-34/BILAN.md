# GMAP · verdict indépendant de la ligne 34

**La navigation conditionnelle et le pas commun sont qualifiés sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et sur la révision du harnais `9c71cd820b59ef3456455b637a0a062abe1d03d0`. Huit départs, **39 gestes et un contraste construit par SHA**. Les deux moteurs concordent sur les 16 gestes de catalogue. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/92fc7b7d/experiments/symbolic-situations/gmap-ligne-34/CONTRAT.md)

- T1 part de l’ancre (23,28) sur la carte à six nœuds. ACTION4 est le premier pas vers l’annotation 10. Le retour change de scène et laisse (29,28) comme arrivée conditionnelle, avec inventaire et score inchangés. T2 réutilise les références du retour, va vers (29,22) et observe l’entrée 10.
- Le vrai retour T3 perd l’entrée 10 et ouvre l’hypothèse de permission locale (29,28)→(35,28). T4 l’utilise. Retirer seulement cette permission à même scène et inventaire donne ACTION3 de frontière. Retirer uniquement les quatre coins de l’ancre à l’entrée du producteur T1 écarte l’offre. Le retour T1 stationnaire garde deux positions compatibles, sans gain.
- Au T2, imposer les positions (23,28) et (29,28) suspend l’offre dans les deux ordres de présentation. Le service peut encore choisir ACTION1 sous la frontière. Au T5 nominal, les deux trajets partant de (29,28) et (35,28) commencent à l’est. Le service autorise ACTION4 et le jeu valide N1. Inverser l’ordre dans le fournisseur seul conserve ACTION4 dans l’offre et bloque sa libération à la garde. Inverser aussi l’ordre à la garde rétablit l’admission, avec la même commande, le même paquet et le même gain.
- Le contraste public construit réfute une arrivée par une ancre contraire. À scène et position identiques, l’inventaire [4] ouvre une offre que l’inventaire vide suspend. La perte d’inventaire et l’hypothèse de permission restent deux faits reliés, de portées différentes.

Verdict en **6 min 20 s**. Le premier rejeu a révélé le refus au T5 lorsque l’ordre différait du côté de la garde. L’opérateur a ajouté la capture de ce refus et rejoué les deux variantes d’ordre. Aucun changement du moteur.

## Rejeu

Sous Node 24, depuis ce dossier. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
