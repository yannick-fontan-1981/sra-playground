# DICO · ligne 86, choisir la portée à inspecter

**La substitution de navigation est qualifiée sur `d84d0b938904a9e10a1ab82f8b8f92a0cfec5cdc`.** Huit préfixes natifs depuis N1 couvrent l’historique, le gel et le candidat. Le nominal est identique sur ces trois révisions. Les préfixes gel et candidat du retour stationnaire concordent également. [Reçus détaillés](sic-dico-d84d0b93/recus.zip)

| Bras | Décision, retour et suite |
|---|---|
| Nominal | T1 réduit les candidats à [0,1,4,5] par un retour GLOBAL. À T2, deux offres de navigation visent cette portée. Le service joue `ACTION6(6,3)`, avec 14 images et un nouveau retour GLOBAL. Les quatre candidats et les huit membres visibles demeurent. La forme du contrôle rejoint les tests observés. T3 joue (16,3). La nouvelle vue contient six membres et contredit la portée attendue de quatre. T4 ouvre `subset_scope_query` en (6,3). |
| Permuter les deux offres | Les mêmes deux offres sont admissibles. Le tri nominal garde (6,3) et les tickets et retours concordent avec le nominal. |
| Substituer (16,3) | Même observation et même ensemble admissible au T2. La commande (16,3) reçoit sa propre clé. Le jeu produit la vue à six membres et réfute l’arrivée exacte aux quatre attendus. La requête en (6,3) avance de T4 à T3. |
| Retirer la navigation | Le T2 appartient à la frontière, qui joue (10,23). Le T3 retrouve la navigation en (6,3). |
| Présenter le plateau précédent après le même ticket T2 | Le vrai jeu a exécuté (6,3). L’empreinte de son paquet égale celle du nominal. Le service reçoit l’ancien plateau, compare la portée et échoue. La clé de (6,3) est mémorisée comme tentative. Les formes de test restent celles d’avant T2. La prochaine commande (16,3) coïncide avec celle du nominal, à partir de preuves différentes. |

Le nouveau raccord est `SubsetDiagnosis.selectNavigationOffer`. Il classe les offres de navigation admissibles. La décision de requête après le changement de vue relève du producteur de tests de partition de 87. La garde rejette l’ancienne offre sur le plateau modifié avec `subset_scope_changed`.

Départ N1, ouverture native, plafond de session 16, 600 gestes par niveau, graine 0 du pont. La mesure suit quatre gestes au plus. SHA candidat épinglé `d84d0b93`, critères `78a85c23`. L’auteur publie le reçu `03bfe9f0`. Le temps du banc est mesuré depuis le lancement du premier préfixe indépendant.

Depuis un checkout propre au SHA candidat, sous Node 24 et avec Pyodide préparé dans le banc voisin :

```powershell
$d = 'experiments/sic-agenda-offres/dico-86'
$p = '../sic-comparison-bench/public/vendor/pyodide'
node "$d/verifier.mjs" --pyodide $p --recu qualification.json
py -3.11 ../sic-comparison-bench/scripts/check-sic-dico-navigation.py qualification.json
```
