# RECR · ligne 70, ordre des sujets et validité du suffixe

**Ligne 70 qualifiée sur le gel par le Banc.** Quatre préfixes, 177 tests, 16 gestes et paquets officiels concordants avec le catalogue. Harnais `01f8fd39e4f0813cdb273b4914d9d1cdc6a74b9b`, bilan auteur `ac29d4a7`. [Contrôles](sic-recr-01f8fd39/banc.json) · [Journaux](sic-recr-01f8fd39/recus.zip)

- Le vrai T1 acquiert la paire de duel 2→0. T2 ajoute 0 à la queue [2,2] et conserve son ordre. Le retour [2,2,0] confirme le contexte et garde le suffixe. Le T3 nominal joue ACTION5 et donne le passage officiel.
- Permuter deux sujets après le même T2 conserve salles, ennemis, multiensemble et paquet physique. La vue [0,2,2] invalide le suffixe. ACTION5 reste proposée. Le premier duel consomme maintenant `enemy:0` au lieu de `ally:0`, et le calcul passe d'un à trois survivants projetés. Le rejeu s'arrête avant ce ticket alternatif. Un retour T2 stationnaire retire l'ajout et rend le clic de frontière (10,63).
- Le T3 nominal confirme la progression officielle et ne fournit pas de liste finale de survivants de N1. En N2, le vrai retour T7 mesure la file [0]. Le nombre prévu pour un trajet et le membre réellement observé à un retour ont ainsi des preuves distinctes.

Node 24, Pyodide local, départ N1, graine implicite 0, 600 gestes par niveau et 16 au total. Depuis le harnais, `$b` désigne le Banc et `$out` un nouveau reçu.

```powershell
node experiments/sic-agenda-offres/recr-70/verifier.mjs --pyodide "$b/public/vendor/pyodide" --recu $out
node --test tests/v6-ordered-recruitment-reference.test.ts tests/v6-ordered-recruitment-kernel.test.ts
```
