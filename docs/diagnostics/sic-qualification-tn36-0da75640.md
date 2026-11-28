# TN36 · ligne 5, apprendre et réutiliser la table de code

**La ligne 5 est qualifiée sur le gel.** Les trois sessions donnent les mêmes reçus sur `d0e7527c` et `0da75640d974e9fbe3b44b78b07649344169c470`. Le catalogue de 16 gestes a été rejoué séparément sur le gel. Ses 16 tickets appartiennent à `code_program / learned_code_program`. L’extension à 19 gestes documente l’exécution du code de N2 et la décision suivante en N3. [Index de décisions](sic-tn36-0da75640/banc.json) · [Reçus du banc](sic-tn36-0da75640/recus.zip)

| Contexte | Recherche et retour réellement observés |
|---|---|
| N1/T1 et T2 | Le premier ticket `ACTION6(36,55)` exécute le code affiché [3,0,3,0,0]. La table soumise à `physicalCodePaths` est vide. Sans prédiction, le retour de sept images date deux occurrences du mot 3, chacune pour le vecteur (0,+1), avec le sujet principal revenu en (4,1). Au T2, la recherche reçoit cette table et produit [3,3,3,3,3]. Le plan cite le retour T1, édite le code, puis T8 exécute le code appris au même point (36,55) et termine N1. |
| N2/T9 et T10 | L’époque ouvre une table vide et choisit l’exemple 0 en (21,55). Son vrai retour préserve le sujet principal et mesure le mot 33 pour (0,−1). Au T10, `physicalCodePaths` reçoit cette nouvelle table de l’époque et donne [33,33,33,33]. Le plan cite le retour T9. T18 exécute le code et termine N2. |
| Dernière image seule après le même ticket T1 | Le plateau final est identique et aucun opérateur n’est mesuré. Le T2 se déplace vers (21,42) et édite [1,0,3,0,0]. L’exécution T3 mesure cette fois les mots 1 et 3. La recherche suivante synthétise le code avec cette nouvelle table. |
| Autre exemple au même état N2/T9 | Marquer uniquement le premier exemple déjà essayé fait sélectionner l’exemple 1 en (8,58), avec une table encore vide. Son retour physique préserve le monde principal sans fournir d’opérateur. Le service essaie ensuite le code affiché en (46,58), puis édite [0,0,0,1]. |

Le raccord commun aux deux niveaux est la recherche `physicalCodePaths` sur les vecteurs appris de l’époque. L’intervention alternative substitue **l’exemple admissible** au même état, en variant le journal d’essais. Elle ne fournit aucun nouvel opérateur à la table sur ce retour. La sonde du banc relève les arguments et les candidats au site d’appel existant dans le processus de mesure. Le code de production dans Git est identique au gel.

Départ N1 sans curiosité ciblée, 600 gestes par niveau. Le catalogue transmet 16 pour la session, l’extension 19, et l’épreuve « finale seule » transmet 8. La graine du pont vaut 0. Critères `29241d51`. Les trois scénarios instrumentés passent sur chaque SHA, ainsi que le catalogue indépendant sur le gel. Les heures de capture figurent dans l’index.

Depuis le banc, avec Node 24.22.3 et Pyodide préparé dans le checkout de jeu :

```powershell
$r = 'artifacts/rejeu-tn36'
foreach ($revision in 'd0e7527c','0da75640') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game TN36 --game-root ../sic-main-delivery
}
node scripts/sic-recapture-strategy-inventory.mjs ../sic-main-delivery "$r/catalogue.json" --offer code_program '*' learned_code_program TN36
py -3.11 scripts/check-sic-tn36-code.py $r
```
