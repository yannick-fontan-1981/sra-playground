# CATL · ligne 50, exemples mesurés et boutons revalidés

**Ligne 50 qualifiée sur le gel par le Banc.** Sept préfixes dans le vrai service et 622 tests de séquences étiquetées sur `fad120b559f52767208ba2620dd48b5a5f530dff`, arbre `src` identique à `d0e7527c`. Le catalogue nominal concorde avec `8ce7ee35`. Critères `4ab9c99b`, reçu auteur `3335f963`. Départ N1, pack natif, graine implicite 0, 600 gestes par niveau et 16 au total. Premier essai à 00:14:49 et tests terminés à 00:18:30 le 28 novembre (UTC−3). [Contrôles](sic-catl-fad120b5/banc.json) · [Journaux](sic-catl-fad120b5/recus.zip)

- **N1/T1.** L'échange de deux symboles conserve le compte de 8 et l'étiquette 15, donc `ACTION6 (43,52)`. Le T2 réutilise les exemples mémorisés et leurs contrôles. Une réinférence avec les preuves intactes produit le même ticket. En retirant la liaison des boutons, le service reprend par `observed_frontier` à (10,11).
- **N2/T9.** Le préfixe officiel jusqu'à T8 est commun. L'échange construit conserve le compte et rend les extrémités égales. L'étiquette 12 devient 15 et le clic (56,52) devient (43,52). Les deux échanges sont contrôlés au ticket du vrai service. Les tickets alternatifs issus des images permutées ne sont pas joués dans le jeu.
- **Retour.** Le nominal joue ses 16 gestes et confirme la progression officielle à T8 et T16. Chaque retour individuel garde `matched:null` pour la loi de classification. Un retour stationnaire construit conserve la preuve du contexte inchangé, puis le service refuse sa resoumission identique.

Le reçu détaillé reste dans `artifacts/qualification-catl-fad120b5/qualification.json`. L'index conserve son empreinte canonique hors champ de transport `versions.qualification`.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/catl-50'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-catl-predicates.py" qualification.json
node --test tests/v6-labeled-sequence-parity.test.ts tests/v6-labeled-sequence-integration.test.ts tests/v6-labeled-composition-mechanics.test.ts tests/v6-labeled-composition-soundness.test.ts
```
