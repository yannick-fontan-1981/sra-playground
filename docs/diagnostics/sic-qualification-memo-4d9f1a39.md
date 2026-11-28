# MEMO · ligne 56, du souvenir au ticket

**Ligne 56 qualifiée sur le gel.** La preuve `4d9f1a397bd3706469f419739d077d366eb1b13c` partage l’arbre moteur de `d0e7527c`. Les quatre préfixes comprennent le nominal historique `8ce7ee35`, le nominal du gel et deux retraits sélectifs sur le gel. Critères `f9037da6`. Rejeu indépendant de 22:52:46 à 22:55:09 le 27 novembre (UTC−3). Verdict opérateur `0c08111e`. [Reçus](sic-memo-4d9f1a39/recus.zip) · [Contrôles](sic-memo-4d9f1a39/banc.json)

- **N1/T6–8.** Le retour T6 conserve une occurrence antérieure à (46,41), absente des enclos actuels. Au T7, quatre modèles rattachent cette occurrence au candidat actuel. Le service autorise `ACTION6(15,35)`, cite le cadre courant et l’exemple du pré-événement T6, puis acquiert le vrai retour `forward`. T8 rappelle ensuite (14,28) en s’appuyant sur la nouvelle observation.
- **Intervention à préfixe égal.** Écarter seulement (46,41) des comparaisons fait disparaître l’offre de rappel. Le vrai ticket vient de `animated_contact` en (37,13), puis le service s’arrête sur `frontier_unknown`. Retirer (14,37) conserve offre, commande et retour. Le contexte transmis au fournisseur reste identique dans les deux bras.
- **Témoin SPOR.** Son T3 dépend d’un enclos de la vue courante et intervient dans une mémoire de rappel vide. MEMO apporte la preuve causale propre à l’exemple acquis. Le numéro 56 compte une fois. [Banc SPOR](sic-qualification-spor-19ffd927.md)

Départ N1 en ouverture native, session 16 gestes, 600 gestes par niveau, graine implicite 0. Depuis un checkout épinglé à `4d9f1a39` avec Node 24 et Pyodide préparé :

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/memo-56'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-memo-recall.py" qualification.json "$b/docs/diagnostics/sic-spor-19ffd927/recus.zip"
```
