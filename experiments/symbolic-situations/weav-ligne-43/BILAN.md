# WEAV · verdict indépendant de la ligne 43

**L’apprentissage du premier pas et la reprise par la paire sont reproduits sur le gel. La vérification de la provenance exacte de la paire reste partielle.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a`. Six départs, **36 gestes par SHA**, décisions et retours identiques. Les 16 tickets du catalogue sont rejoués sans gain officiel. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/3ac61e57/experiments/symbolic-situations/weav-ligne-43/CONTRAT.md)

- Le T1 sélectionne sous hypothèse le contrôleur horizontal en (15,20). Son retour stationnaire n’inscrit ni pas ni paire. Le vrai T2 ACTION1 change la cellule (0,0) de 0 à 14. Le reçu inscrit l’action sur l’axe et ouvre la question du contrôleur vertical. Un retour T2 construit à plateau stationnaire n’acquiert aucun pas et le service essaie ACTION2. Retirer le pas enregistré au T3 fait rejouer ACTION1 sur la même cellule, ce que le vrai retour réfute.
- Le refus d’ACTION2 au T4 porte sur le contrôleur vertical, l’indice 0 et le croisement avec ACTION1. ACTION3 reste admissible. Son vrai retour T5 acquiert la paire ACTION1/ACTION3 avec propriétaire d’axe 0 et valeur visible 14. T7 cite les deux références du T5 et confirme ACTION1 sur (1,0). Retirer la paire seule, au même raster et avec les commandes d’axe conservées, fait réellement jouer le clic d’information (28,61).
- La garde refuse une observation étrangère ou une géométrie de référence contredite, y compris quand l’empreinte de raster a été adaptée à la géométrie modifiée. En revanche, substituer à la première référence de la paire le reçu du T2, qui atteste seulement le premier pas horizontal, conserve le ticket T7, son admission et le même retour physique. La référence fausse apparaît dans l’offre. Ce contrôle porte sur la provenance du reçu de paire, distincte de la garde de contexte courant.

Verdict en **4 min 39 s**, au premier rejeu indépendant.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
