# UPST · ligne 16 · qualification indépendante

**La capacité est présente au gel `d0e7527c`.** Le candidat `0540f124` a le même arbre de production `src`. Le même harnais obtient les mêmes tickets, décisions, acquisitions et refus de prédictions sur les deux révisions. [Reçu comparatif](recu.json) · [Protocole et réserve scellés](CONTRAT.md)

| Jeu et ticket | Offres de points | Point choisi | Changement du support | Prédictions concordantes / contredites |
| --- | ---: | --- | --- | ---: |
| UPST T4 | 3 | (21,13) | oui | 1 / 2 |
| EVAS T15 | 11 | (31,30) | oui | 3 / 4 |
| EVAS T16 | 5 | (32,35) | non | 1 / 2 |

Sur UPST, les trois premiers tickets viennent de la frontière. Les deux premiers clics laissent leur support stable, le troisième le change. Au quatrième tour, les trois points proposés séparent des prédictions encore compatibles. Le service libère `information_goal / point_contrast / experiment`. Le besoin sous `G_protocol_completion` passe d'assigné à observé à réception du ticket. La mesure départage les prédictions et conserve les deux paires comparées. Au tour 5, le producteur offre zéro point et la frontière libère (12,1). Sur EVAS, le deuxième besoin est distinct et ses trois prédictions sont exactement les trois survivantes du premier retour.

**Contre-épreuves.** Deux retours construits du même ticket UPST T4 changent chacun un seul pixel. Sur le support, la mesure est positive. À côté, elle est négative. Les trois verdicts de prédiction s'inversent. L'évaluateur rejette 3/3 reçus altérés : les deux échanges de support et la réattribution du sous-objectif à celui d'EVAS. Deux restaurations construites de la mémoire sur la même observation T4 donnent chacune trois offres avant intervention et zéro après : l'une retire le seul témoin positif, l'autre marque les deux paires comme déjà comparées. Le service ouvre alors la question de frontière en (10,48). Ce choix intervient un tour plus tôt que la reprise historique.

**Réserve.** Sur le domaine public fini, puis sur le domaine réservé de coordonnées, valeurs et ordre distincts, l'oracle énumère les six paires possibles de quatre explications. Les quatre configurations donnent respectivement 3, 2, 0 et 0 offres. Après épuisement du contraste le mieux équilibré, les deux choix restants sont justifiés. Le test accepte ces deux points. Ces huit configurations portent sur le classement du producteur à partir de caractéristiques déjà mesurées.

**Dénominateurs par révision.** Deux parcours historiques (5 tickets UPST, 16 EVAS), deux interventions sur le retour physique, deux interventions sur la mémoire et huit configurations au producteur. Le double passage avec et sans sonde conserve les sorties des deux parcours. Les jeux Python du gel ont aussi exécuté les 21 commandes. Les 6 observations d'UPST et les 17 d'EVAS correspondent intégralement aux champs de la fixture. Le jeu renvoie en plus la palette, absente des entrées historiques servies au solveur.

## Rejeu

Depuis ce répertoire, avec Git, `tar` et Node 24, utiliser des fichiers de reçus neufs. Le dernier appel utilise la distribution Pyodide du projet et exécute les jeux.

```powershell
$sha = '0540f12425e9004dd63b3d701b9e4ea125c17482'
node service.mjs $sha UPST lecture "$env:TEMP/16-UPST.json"
node service.mjs $sha EVAS lecture "$env:TEMP/16-EVAS.json"
node domaine.mjs $sha "$env:TEMP/16-domaine.json"
node jeux.mjs 'D:/dev/ARC-AGI/SRA-Playground/sic-comparison-bench/public/vendor/pyodide'
```

Les modes UPST `direct`, `dedans`, `dehors`, `sans-positif` et `paires-connues` rejouent les autres conditions. [Vérification croisée des reçus opérateur](verifier.mjs).
