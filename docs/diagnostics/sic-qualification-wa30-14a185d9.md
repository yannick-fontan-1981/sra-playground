# WA30 · qualification des contacts 26 et 31

**Les deux raccords sont qualifiés sur `14a185d909d3b3cb42fcc8584b841865b8ff6dd0`.** Les quatre scénarios communs donnent les mêmes reçus sur le gel et le candidat. Les trois scénarios propres à la branche retirent le raccord de 26, substituent le site de 31 ou retirent son offre entière. [Reçus et index du banc](sic-wa30-14a185d9/recus.zip)

| Ligne | Ticket et retour | Intervention et reprise |
|---|---|---|
| **26** | Au T2, la mesure inscrit l’invitation de contour. T3 libère `ACTION5`. Ses 12 pixels changés donnent une relation candidate. T4 libère le mouvement, change 44 pixels et établit la translation commune [0,−1]. | L’image stationnaire construite au T3 conserve l’essai sans recevoir d’attachement. Retirer la seule offre `frontalContactTrial` fait jouer `ACTION1` à la frontière, sans changement de trame. L’invitation reste disponible et le couplage libère `ACTION5` au T4. |
| **31** | T16 `ACTION1` vise (36,29) depuis (36,33), avec un vecteur déjà mesuré et un effet distant inconnu. Le plateau reste identique. Le reçu date l’essai. T17 de l’extension essaie (32,33), avec 44 pixels changés et un résultat encore indéterminé. | Au même état T16, substituer (32,33) et retirer l’offre entière émettent tous deux `ACTION3`. Le vrai jeu donne le même paquet dans les deux bras. Le premier appartient à `pre_score_contact` et acquiert `pre_score_effect_contact` pour son rôle et sa clé d’essai. Le couplage est propriétaire dans le second et n’acquiert aucun reçu de premier contact. T17 reprend chez le couplage. |

Au T16, le bras qui masque l’enregistrement du reçu dans la mémoire conserve le reçu produit et fait réessayer (36,29) au T17. La comparaison lie chaque reçu à son ticket, à ses observations avant et après, à son rôle et à son producteur. Les pixels et l’action commune ne suffisent pas à identifier le propriétaire. Aucune correspondance de famille distante ni progression de score n’est acquise par ces deux sondes.

Départ N1, curiosité native et 600 gestes par niveau. Le catalogue est limité à 16 gestes. L’extension en transmet 19 pour relever le second site et la reprise. Les 13 occurrences de 26 et **1 des 11** de 31 sont retrouvées dans le catalogue de WA30. Le témoin T17 provient de l’extension. Le candidat reprend deux fichiers du moteur, `v6-oriented-coupling.ts` et `v6-effect-access.ts`. Préenregistrement `3c93db1d`.

Le banc extrait la suite de la branche et active le vrai jeu pour le bras de retrait T16, qui utilisait le paquet attendu dans la suite d’origine. Les assertions d’origine et le paquet attendu restent ceux de la branche. Le contrôle de l’entrée stationnaire compare les tickets et mesures avec le bras nominal. Les empreintes des paquets restent archivées avec la métadonnée de palette propre à chaque source. Les quatre tests applicables au gel et les sept du candidat passent. [Contrôle opérateur 592be70d](https://github.com/yannick-fontan-1981/sra-playground/commit/592be70d) Depuis le banc avec Node 24 et Pyodide préparé :

```powershell
$r = 'artifacts/rejeu-wa30'
foreach ($revision in 'd0e7527c','14a185d9') {
  py -3.11 scripts/test-sic-catalogue-lines.py $revision $r --game WA30 --game-root ../sic-main-delivery
}
py -3.11 scripts/check-sic-wa30-contacts.py $r
```
