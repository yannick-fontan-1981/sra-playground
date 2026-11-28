# CATR · verdict indépendant de la ligne 42

**La composition par relations de chambre est qualifiée sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `9186a49ea207caff1fee6a1386b506739b22d4a3`. Six départs et **13 gestes par SHA**. Les deux moteurs donnent les mêmes tickets et retours. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/69b1ae8f/experiments/symbolic-situations/catr-ligne-42/CONTRAT.md)

- Sur quatre commandes et huit axes dont six cibles, l’inverse examine 16 réglages et 35 relations. Une configuration est retenue. Le clic (31,47) du T1 confirme l’édition 12→10 sur un support de cinq pixels. Le reçu n’est lié qu’au ticket T1. La même preuve est utilisée pour (27,51) puis (35,51). T2 confirme la projection. T3 valide N1 et scelle la comparaison de relations avec `matched:null`.
- Retirer l’offre du T1 donne `animated_contact` en (31,51). Le service retrouve ensuite le clic de chambre (31,47) et lui rattache sa propre acquisition. Une relation contradictoire à même observation empêche l’offre et arrête le service sur `frontier_unknown`. Présenter uniquement une référence étrangère au garde laisse l’offre proposée, puis le garde la refuse et le service s’arrête sur `no_admissible_prefix`.
- Après un retour stationnaire construit au T1, aucune édition n’est acquise. (27,51) reste proposé au T2, comme expérience. En retirant plutôt l’unique édition apprise à l’entrée du fournisseur T2, avec le vrai plateau et le reste de la mémoire inchangés, ce même clic bascule également vers l’expérience. Le jeu produit alors le même paquet physique qu’au nominal et le nouveau reçu confirme sa propre édition. T3 retrouve l’exploitation.

Verdict en 2 min 41 s. Le premier lancement s’est arrêté au montage sur des fins de ligne Windows. Le montage normalise les fins de ligne, puis les deux révisions ont rejoué tous les départs. Aucun changement du moteur. Le résultat est propre à CATR/42.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
