# Axial : recherche du dernier reçu sans recopier l'historique

## Changement et portée

La revue de la première implémentation relevait une concaténation de toutes les
méthodes, puis une copie inversée pour chaque relation et chaque a priori.
Le changement examiné part du commit
`7a8ab7921b312548de29b66a0f83250a3fa6678d`, après intégration du Site 84 publié.
Il concerne seulement `offers` dans `src/logos-engine/v6-axial-question.ts`.

La recherche parcourt les rotations courantes en sens inverse, puis les paquets
portables du dernier au premier, et les méthodes de chaque paquet en sens inverse.
Son résultat est conservé par commande pendant cet appel synchrone à `offers`.
Le prochain appel retrouve l'historique courant, y compris après acquisition,
restauration ou changement d'époque.

## Revue d'équivalence

Le changement a été relu par son auteur, par le responsable du lot et par un
agent distinct, contre `family.py` de la référence V6 épinglée
`786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`. Aucun défaut d'équivalence n'a été
identifié dans le domaine JSON natif.

| Contrat | Conservation |
| --- | --- |
| Dernier reçu compatible | Le parcours est exactement l'inverse de l'ancienne concaténation. |
| Filtre | Action, signature, puis au moins deux références de preuve, dans le même ordre de courts-circuits. |
| Recherche paresseuse | Sélection, portée, axe déjà satisfait et disponibilité de la commande sont examinés avant la recherche. |
| Absence de reçu | `Map.has` mémorise aussi `null` ; chaque a priori garde alors son propre signe. |
| Signature | La signature de comparaison est constante dans cet appel ; la signature exposée de chaque offre reste construite séparément. |
| Références et erreurs | Le même reçu est retenu. Une valeur `methods` non-array reste le candidat unique de l'ancien `flatMap`, avec ses erreurs si elle est atteinte. |
| Connaissances | Aucun reçu ni contre-exemple n'est supprimé ou modifié. Les gardes, le choix DRM et le checkpoint natif restent inchangés. |

Les objets à accesseurs et les tableaux clairsemés sont hors du domaine retenu
par la validation JSON native. Cette revue ne leur attribue pas une nouvelle
garantie de compatibilité.

## Vérification exécutée

La [validation ciblée](diagnostic/history-lookup-validation.json) du
10 novembre 2026, de 22:23:32 à 22:23:45 UTC, passe **136/136 tests** :
130 comparaisons et contrats de composant, puis six scénarios du caller commun.
Les attentes proviennent du même fixture établi depuis le Python original.
Les sources, tests, fixture et exporteur restent inchangés pendant l'exécution.
Le digest natif effectivement testé est
`8a0465f7edf8454239fdd2bfb301c5714824f33f74a2ed7165b2bec19d237a97`.
Le reçu distingue ce changement de travail du HEAD antérieur.

Les copies d'historique disparaissent de cette recherche. Avec H reçus et A
commandes distinctes consultées, le parcours peut encore coûter O(A × H), mais
il ne se répète plus pour chaque relation. Aucun gain de durée mesuré n'est
déduit de cette lecture. La validation du checkpoint parcourt toujours
l'historique mutable ; le coût de longues sessions Axial reste à caractériser.
La validation et le coût du futur candidat après 4B et 7B restent nécessaires.
