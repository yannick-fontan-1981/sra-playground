# WEAV · ligne 43, première contribution et paire de croisement

**Ligne 43 partielle sur le gel, hors du compteur strict.** Six préfixes natifs avec `fab19fba7cc5e5ac5cd79da53c81fb3ab23b492a`, arbre moteur du gel, critères `67012fdd`. Rejeu indépendant de 00:05:06 à 00:07:35 le 28 novembre (UTC−3), 137 tests de référence et d’intégration. Le nominal historique `8ce7ee35` concorde. [Journaux](sic-weav-fab19fba/recus.zip) · [Contrôles](sic-weav-fab19fba/banc.json)

- **T1 et T2.** Le clic (15,20) choisit le contrôleur et reste une hypothèse. T2 `ACTION1` change la cellule [0,0], acquiert l’entrée de l’axe 0 et prête son retour à la question de croisement. Un retour stationnaire construit au même T2 ne crée aucune contribution et bloque seulement l’essai dans ce contexte.
- **T5 puis T7.** À l’intersection, le vrai T5 acquiert la paire axe 0/ACTION1, axe 1/ACTION3, avec les deux références de l’observation. T7 cite ces références avant de reprendre le premier axe. À la même vue et au même préfixe T1–T6, retirer seulement la paire de l’appel d’offre fait reprendre par `information_goal`, clic (28,61).
- **Portée du refus.** La garde accepte le ticket lié. Sur les mêmes observations, une référence de croisement contraire est refusée même quand son empreinte descriptive correspond. Présenter cette référence au retour scelle la projection. Le refus vise le contexte de la paire. Dans les 16 gestes de catalogue, aucun niveau n’est marqué.

Départ N1, curiosité native, graine implicite 0, 16 gestes par session et 600 par niveau. Le reçu détaillé reste dans `artifacts/qualification-weav-fab19fba/qualification.json`. L’index conserve son empreinte.

```powershell
$b = '../sic-comparison-bench'
$d = 'experiments/sic-agenda-offres/weav-43'
node "$d/verifier.mjs" --pyodide "$b/public/vendor/pyodide" --recu qualification.json
py -3.11 "$b/scripts/check-sic-weav-crossing.py" qualification.json
node --test tests/v6-crossed-prefix-access.test.ts tests/v6-crossed-prefix-integration.test.ts
```

## Provenance de la paire

Le reçu opérateur `8187e6ca` a ajouté un contrôle du contenu exact de la paire. Le banc le reproduit sur le gel et sur `674b0dd1`. Au N1/T7, l’entrée réellement lue dans `crossQuestion` conserve la paire ACTION1/ACTION3, mais sa première référence passe de la révision 5 de l’époque 1 (observation précédant le vrai croisement T5) à la révision 3 (retour du seul pas horizontal T2). La seconde référence et l’observation courante restent identiques. La paire authentique reste dans l’entrée avant intervention. L’offre consomme la paire modifiée, la cite puis libère le même ACTION1 sous `crossed_prefix_bound`. Le vrai retour est identique. [Contre-épreuve et valeurs complètes](sic-weav-fab19fba-provenance/recus.zip)

Le refus de référence de scène documenté plus haut porte sur le contexte de la vue. La contre-épreuve T7 porte sur la provenance de la paire. L’apprentissage et la reprise du préfixe sont démontrés. La provenance exacte de la paire reste ouverte.

Depuis le banc, après avoir régénéré le reçu de référence `qualification.json` par le vérificateur ci-dessus :

```powershell
$recu = 'artifacts/qualification-weav-fab19fba/qualification.json'
py -3.11 scripts/test-sic-weav-provenance.py ../sic-main-delivery $recu artifacts/rejouer-weav-provenance-gel
py -3.11 scripts/test-sic-weav-provenance.py ../sic-banc-ls19 $recu artifacts/rejouer-weav-provenance-assemble
```
