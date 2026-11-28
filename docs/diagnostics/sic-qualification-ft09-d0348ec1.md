# FT09 · ligne 94, la contrainte de plusieurs fenêtres

**Ligne 94 qualifiée sur le gel.** Les six préfixes natifs comparent `8ce7ee35` et `d0e7527c` avec le harnais `d0348ec1f1646259b9c95f0fa4a44dd0bb966025`, arbre moteur commun au gel. Critères `ae88904c`. Rejeu de 23:36:13 à 23:38:14 le 27 novembre (UTC−3). [Reçus](sic-ft09-d0348ec1/recus.zip) · [Contrôles](sic-ft09-d0348ec1/banc.json)

- **Fenêtres et adresse.** Les quatre fenêtres soutiennent la règle induite par comparaison. N’en transmettre qu’une conserve la scène et retire l’offre, puis le repli clique (12,10). Retirer seulement (38,38) laisse la règle et le champ disponibles, change le vrai ticket en (38,46) et mesure la réécriture en [36,44].
- **T3.** Deux réécritures distinctes permettent de prévoir la valeur 8. Supprimer un seul de ces acquis conserve ACTION6(38,54) et le vrai paquet, mais retire la prédiction. Le retour passe de `matched:true` à `matched:null` et le préfixe se scelle. Le vrai T4 valide N1.
- **Contrôle stationnaire.** Le vrai premier clic est conservé, avec observation antérieure présentée au moteur. Aucun effet de réécriture n’entre en mémoire et seule l’adresse essayée est fermée pour le contexte courant.
- **Lien HPDL.** Le même contrat de question à effet ouvert et de point lié à la vue est vérifié sur deux reçus distincts. FT09 exploite les échantillons des fenêtres et leurs réécritures. HPDL exploite une méthode de même signature et les réglages des boîtes. Le vérificateur contrôle l’empreinte du reçu HPDL du Banc. [Banc HPDL](sic-qualification-hpdl-66ce0494.md)

Départ N1, ouverture native, graine implicite 0, 16 gestes de session et 600 gestes par niveau. Depuis le checkout `d0348ec1` avec Node 24, extraire `qualification.json` du ZIP HPDL dans un répertoire neuf et affecter son chemin à `$hpdl`.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/ft09-94'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --hpdl $hpdl --recu qualification.json
py -3.11 "$b/scripts/check-sic-ft09-window-constraint.py" qualification.json "$b/docs/diagnostics/sic-hpdl-66ce0494/recus.zip"
```
