# DICO · ligne 87 · verdict indépendant

**Le gel sait déjà choisir un sous-ensemble informatif et réviser la population à partir du retour.** Le candidat `c0b9f402` déplace le choix vers `selectSubsetQuery`. La famille prépare les offres puis consomme le résultat du sélecteur pour construire sa question, sa garde et sa commande. L'intervention sur cette liste provoque un autre clic réellement exécuté. [Critères scellés à 966e310b](CONTRAT.md) · [Reçu comparatif](recu.json)

| Catalogue au tour 4 | Population | Question | Pire cas | Ticket | Acquisition du jeu |
| --- | --- | --- | ---: | --- | --- |
| Gel et candidat nominaux | 0, 1, 4, 5 | 0, 4 | 2 | (6,3) | LOCAL, conserve 1 et 5 |
| Candidat, première offre optimale retirée | 0, 1, 4, 5 | 1, 5 | 2 | (27,3) | GLOBAL, conserve 1 et 5 |

**Deux optima.** Six offres sont préparées sur le même préfixe de trois tickets. Les deux questions de groupe divisent les quatre candidats en 2/2. Les quatre questions individuelles donnent 1/3. Sur le gel, le tri est inclus dans `SubsetDiagnosis.propose`. Sur la branche, le sélecteur reçoit les offres et départage les deux optima par le sous-ensemble. La contre-épreuve retire sa première offre optimale avant de le rappeler. Le sélecteur, la construction du plan, le service et le jeu s'exécutent ensuite normalement. Le sous-ensemble, la question et la commande changent. Les deux issues complémentaires conduisent ici aux mêmes survivants sous l'hypothèse conditionnelle d'un unique membre fixe. Le champ de prédiction vérifiée du ticket reste nul.

**Preuve temporelle.** Le retour nominal de neuf images permet la lecture LOCAL. Conserver uniquement sa dernière image donne la même référence finale et aucune lecture de portée. Réexposer uniquement l'image antérieure ne produit pas de lecture non plus. Les quatre candidats sont conservés dans les deux cas. Le bras alternatif reçoit GLOBAL sur seize images.

**Ouverture active.** Dans sa session propre, la ligne 98 choisit (25,36) sous `observed_frontier` et termine le premier niveau. Au quatrième geste, la famille `subset_diagnosis` navigue au niveau 2. Dans le catalogue standard, le quatrième geste est la requête de portée au niveau 1.

**Dénominateurs par révision.** Deux départs réels de quatre tickets sont mesurés, catalogue et curiosité active. Deux interventions temporelles rejouent le ticket du catalogue. Quatre configurations publiques et quatre réservées comparent les partitions de huit membres, leur permutation, la dégradation du premier optimum et le retrait des deux optima. Les huit tests passent. Les coûts obtenus sont 4, 4, 4 et 5 dans chaque partition. Le contrôle de l'ancienne commande après dégradation est rejeté dans les deux partitions. Le test fini exerce la ligne de tri extraite verbatim et son comparateur natif sur le gel, puis l'API de production sur la branche. Un départ réel supplémentaire sur le candidat vérifie le raccordement de bout en bout.

Le montage réutilise le chargeur et le parcours chronologique publiés. Le calcul des deux ensembles, l'évaluation des reçus, les partitions de réserve et le retrait d'une contribution sont propres à l'opérateur. [Vérification des reçus](verifier.mjs)

## Rejeu de développement

Depuis ce répertoire avec Node 24, Git, `tar` et Pyodide local. Employer des noms de reçus neufs.

```powershell
$sha = 'c0b9f4027f1df257d7b8c96f5656f9dbb83661f0'
$pyodide = 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
node partitions.mjs $sha "$env:TEMP/87-partitions.json"
node jeu.mjs $sha catalogue $pyodide "$env:TEMP/87-catalogue.json"
node jeu.mjs $sha curieux $pyodide "$env:TEMP/87-curieux.json"
node jeu.mjs $sha catalogue $pyodide "$env:TEMP/87-autre-optimum.json" retrait
```

Le gel se rejoue avec `d0e7527ca8033bd805a6d7a8bb021eff62e87021` sur les trois premières commandes. Le quatrième appel exerce le sélecteur introduit sur branche.
