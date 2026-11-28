# HPDL · verdict indépendant de la ligne 75

**Le choix de réglage à partir d’une méthode de même signature est qualifié sur le gel.** Même arbre `src` sur `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et `66ce04946bccb531d5a6403ec36a5c2a90bf99a4`. Cinq départs et **35 gestes par SHA**, mêmes tickets et retours. Dix tickets de fenêtre sur les 16 gestes du catalogue. [Présélection de l’opérateur](https://github.com/yannick-fontan-1981/sra-playground/blob/94a4bc10/experiments/symbolic-situations/hpdl-ligne-75/CONTRAT.md)

- Le T3 de frontière passe la capacité observée de 1 à 4. Le T4 consomme cette méthode datée, de même signature, pour régler une scène à deux boîtes de capacités 4 et 2. Le calcul examine huit configurations et offre un réglage de coût 4. Le service admet le clic (14,30) qui vise 2. Le vrai retour mesure 4→1 et scelle la tentative avec `matched:null`. Le même point au T5 utilise une nouvelle clé de contexte et mesure cette fois 1→2.
- Retirer seulement cette méthode laisse la scène intacte, supprime le calcul de couverture et donne la frontière ACTION4. Ce vrai retour mesure également 4→1. La fenêtre reprend au T5, avec sa propre preuve.
- Ajouter une méthode construite 1→2 avec une signature étrangère laisse l’offre et les retours intacts. La même ligne sous la signature courante rejoint les références de l’offre, sans changer sa priorité, son coût, son clic ni les retours. L’observation T3 demeure la seule mesure initiale réelle.
- Jouer le vrai clic T4 et présenter le plateau précédent enregistre la tentative sans édition supplémentaire. La fenêtre ferme cette offre dans le même état et le service délivre ACTION4 sous la frontière.
- T6 change le filtre de 8 à 9. Le paquet réel de traversée T7 contient 78 images et le jeu valide N1. Au T8, quatre méthodes de N1 sont disponibles après liaison à la signature de N2.

Verdict en 3 min 51 s. Le rejeu physique a réussi au premier lancement. Le vérificateur a été corrigé pour lire les valeurs de palette dans les objets qui portent aussi les cadres du mot. La qualification reste propre à HPDL/75.

## Rejeu

Depuis ce dossier sous Node 24. `$py` désigne le répertoire Pyodide du Banc. Utiliser un dossier de sortie neuf.

```powershell
node qualifier.mjs gel $py $reçus
node qualifier.mjs candidat $py $reçus
node verifier.mjs $reçus
```
