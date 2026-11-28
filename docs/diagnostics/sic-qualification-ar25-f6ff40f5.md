# AR25 · calibrage 8 et couverture réfléchie 77

**La substitution du calibrage 8 est qualifiée sur la branche `f6ff40f5e6c870ab5f897eaccdd1d43873944c5c`. La ligne 77 est qualifiée sur le gel.** Dix préfixes du vrai jeu concordent avec les critères. Le rejeu nominal supplémentaire retrouve l’empreinte du catalogue, ses 16 tickets et ses 13 projections de réflexion confirmées. Il s’arrête en N1. [Reçus du banc](sic-ar25-f6ff40f5/recus.zip) · [Verdict de la branche](https://github.com/yannick-fontan-1981/sra-playground/blob/54c99566/experiments/sic-agenda-offres/ar25-8-77/VERDICT.md)

| Contrat | Offre et preuve | Retour et reprise |
|---|---|---|
| **8 · calibrer le contenant** | À état égal au T1, `Containment.chooseCalibration` permet de publier `ACTION1` en nominal ou `ACTION2` dans le bras substitué. Les deux suivent la pièce de palette 4. Le contour de palette 9 conserve ses 35 pixels. | Le jeu acquiert [0,−3] sur `ACTION1` ou [0,+3] sur `ACTION2`. T2 choisit l’autre commande encore inconnue. Un retour stationnaire présenté après le vrai T1 laisse le corps actif indéterminé. La tentative est gardée et T2 choisit `ACTION2` sans vecteur appris. |
| **77 · compléter la couverture réfléchie** | Le corps direct de palette 5 et son image de palette 4 ont leurs propres liaisons. Trois retours donnent [0,−1], [0,+1], [−1,0] en cellules de pas 3, sur deux axes. Au T4, le solveur utilise la colonne d’axe 10, avec objectif de couverture et aucune cellule cible couverte. | Les treize projections T4–T16 sont confirmées par le retour du jeu. Retirer seulement l’acquisition horizontale de la réflexion conserve le vrai paquet et la mesure du contenant. La réflexion s’abstient et le contenant libère `ACTION4`. Retirer la solution donne le même repli et la réflexion reprend au T5. |
| **77 · réfutation et reprise** | Au même ticket T4, présenter le plateau précédent scelle le plan. Le vrai paquet garde sa propre empreinte. La reprise donne `ACTION3` à l’indice 0. | En bornant la première offre, T16 ouvre un nouveau préfixe. `ACTION2` garde la cellule (17,15) déjà couverte et ajoute (17,16). Le retour physique confirme cette projection. |

Les 13 confirmations concernent les projections de masque et de contrôle de ce préfixe. Aucun niveau officiel n’est atteint dans ce budget. Les acquisitions de 8 et de 77 restent chacune liées à leur propriétaire. Le lot à 46 avait déjà été figé avec SEQN.

Départ N1, ouverture native, plafond de session 16, 600 gestes par niveau, graine implicite 0. Critères `b70a2957`. Le contrôle compare l’historique, le gel et le candidat sur le nominal. Les variantes de preuve et de plateau utilisent des interventions limitées au processus de test. L’index donne le temps écoulé depuis la première exécution indépendante.

Depuis le checkout épinglé au candidat, sous Node 24 et avec Pyodide préparé dans le banc voisin :

```powershell
$d = 'experiments/sic-agenda-offres/ar25-8-77'
$p = '../sic-comparison-bench/public/vendor/pyodide'
node "$d/verifier.mjs" --pyodide $p --recu qualification.json
node "$d/operateur.mjs" --moteur candidat --variante nominal --gestes 16 --pyodide $p --recu catalogue.json
py -3.11 ../sic-comparison-bench/scripts/check-sic-ar25-cavites.py .
```
