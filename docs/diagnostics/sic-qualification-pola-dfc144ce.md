# POLA · ligne 33, preuve de rotation transportée

**Ligne 33 qualifiée sur le gel.** Six préfixes avec le harnais `dfc144ce46139e887d0f48fff9ae3ac2d42d3c3d`, arbre moteur du gel, critères `0e24fac7`. Rejeu indépendant de 23:43:29 à 23:47:02 le 27 novembre (UTC−3). Opérateur `de85e129`. Les 136 tests de référence et de noyau passent. [Reçus](sic-pola-dfc144ce/recus.zip) · [Contrôles](sic-pola-dfc144ce/banc.json)

- **N1/T4.** Le jeu renvoie cinq trames et valide N1. Seule la première trame reste dans l’ancienne scène et permet de mesurer le quart de tour +1 de `ACTION4`. Le reçu conserve séparément cette mesure et le score. En l’absence d’attestation ou avec un axe incompatible, l’offre de rotation disparaît. Le bras stationnaire marque seulement l’essai.
- **N2/T8.** À géométrie, sélection et distances identiques, conserver la méthode choisit `ACTION4`. L’enlever seule choisit `ACTION3`. Les vrais retours mesurent respectivement +1 et −1, sans score supplémentaire au T8. Les deux trajectoires valident ensuite N2 au T9.
- **Contraste public.** Le cas `kernelCold` donne un vrai reçu de rotation de signe −1 lors d’une projection +1. Réutiliser cette preuve choisit `ACTION4` et l’enlever choisit `ACTION3`. Le retournement de l’ordre des offres ne déplace pas le choix justifié.

Départ N1, graine implicite 0, mode natif, 16 gestes de session et 600 par niveau. Depuis le checkout épinglé à `dfc144ce` avec Node 24 et Pyodide préparé :

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/pola-33'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-pola-axial.py" qualification.json
node --test tests/v6-axial-question-reference.test.ts tests/v6-axial-question-kernel.test.ts
```
