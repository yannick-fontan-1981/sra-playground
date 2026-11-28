# HPDL · ligne 75, la méthode de la fenêtre courante

**Ligne 75 qualifiée sur le gel.** Cinq préfixes avec le harnais `66ce04946bccb531d5a6403ec36a5c2a90bf99a4`, arbre du gel et critères `88dcf789`. Historique `8ce7ee35` et gel concordent. Rejeu de 23:23:17 à 23:26:00 le 27 novembre (UTC−3). [Reçus](sic-hpdl-66ce0494/recus.zip) · [Contrôles](sic-hpdl-66ce0494/banc.json)

- **T3–T5.** La frontière fait passer la capacité de 1 à 4 au vrai T3. T4 lit la méthode de même signature et vise une capacité de 2. En (14,30), le jeu mesure d’abord 4→1. L’essai est scellé. La vue modifiée crée une autre clé pour le même clic et T5 mesure 1→2.
- **T6–T8.** Le passage du filtre de 8 à 9 précède la traversée. Le paquet du T7 contient 78 images et confirme N1. T8 joint les quatre méthodes portables à la nouvelle signature avant utilisation.
- **Refus et contrôle neutre.** Retirer la méthode seule à scène égale supprime l’offre de fenêtre. Le service joue le repli `ACTION4`, puis retrouve le clic. Une méthode étrangère laisse décisions et retours identiques. Présenter l’ancien plateau après le vrai T4 conserve le paquet physique et scelle la tentative sans nouvelle édition.

Départ N1, graine implicite 0, ouverture native, 16 gestes par session et 600 par niveau. Le véritable passage en N2 reste distinct de la mesure du champ de préparation.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/hpdl-75'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-hpdl-window.py" qualification.json
```
