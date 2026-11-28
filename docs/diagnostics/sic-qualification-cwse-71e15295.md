# CWSE · ligne 45, de l’essai à la réception

**Ligne 45 qualifiée sur le gel.** Cinq préfixes joués avec `71e15295d2fd38996147a524e4b0cd63e2991cc5`, arbre du gel et critères `6db703b6`. Le nominal historique `8ce7ee35` concorde. Le rejeu a duré de 23:15:30 à 23:17:28 le 27 novembre (UTC−3). [Reçus](sic-cwse-71e15295/recus.zip) · [Contrôles](sic-cwse-71e15295/banc.json)

- **N1/T1–T4.** T1 `ACTION4` sans prévision acquiert le déplacement [1,0] sur deux références. T2 réutilise ce vecteur pour prédire un accès à [3,2]. Le vrai retour contredit l’accès et scelle la projection. Retirer le seul vecteur à état et recherche égaux conserve `ACTION4` et le paquet physique. Le ticket redevient une question de contrôle et le retour donne `matched:null`. Les deux parcours retrouvent ensuite les clics d’exposition.
- **N3/T13–T16.** Le plan partiel de huit gestes atteint la borne de 8 000 nœuds. Les quatre gestes restant au budget, `ACTION2, ACTION1, ACTION4, ACTION1`, confirment leurs déplacements. N3 reste en cours.
- **Liaison avec CATR/42.** Les offres partagent les quatre champs d’enveloppe de la vue courante. À pixels égaux, la référence étrangère est refusée par le garde propre à chaque offre. CATR reçoit un support de point et `relation_binding_changed`. CWSE reçoit `reception_binding_changed` et sa propre projection. Le vérificateur épingle l’empreinte du reçu CATR avant de rapprocher les deux contrats. [Banc CATR](sic-qualification-catr-9186a49e.md)

Départ N1, graine implicite 0, curiosité native, 16 gestes par session et 600 par niveau. Depuis un checkout à `71e15295` sous Node 24, extraire `qualification.json` du ZIP CATR dans un répertoire neuf et affecter son chemin à `$catr`.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/cwse-45'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --catr $catr --recu qualification.json
py -3.11 "$b/scripts/check-sic-cwse-reception.py" qualification.json "$b/docs/diagnostics/sic-catr-9186a49e/recus.zip"
```
