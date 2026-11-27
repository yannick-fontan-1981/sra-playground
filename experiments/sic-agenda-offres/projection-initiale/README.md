# SK48 · Choix du premier plan après calibrage

**Le départ qui s'arrêtait avant le geste 5 reprend par un essai conditionnel.** La permutation publique 9↔14 conserve la géométrie et change les noms des pièces. Sur le gel, le noyau s'appuie pourtant sur ces noms pour départager deux pièces au même endroit le long de la tige. Le candidat conserve leur égalité dans le reçu et demande `ACTION1`. Le jeu doit encore confirmer ou réfuter chaque projection. Ce lot porte sur l'accès au premier plan depuis L1. La [révision de contact, ligne 96](../revision-96/README.md), intervient plus tard.

## Premier écart et témoin physique

Le développement indépendant à `5804fc7d73c6b7655d97bca777aed9fb6475acef` a relevé quatre arrêts avant le geste 5. Sa fiche minimale est `{"version":"sic.contact/1","couleurs":[9,14],"pack":{},"gestes":5}`. La qualification repart du candidat de témoins `08fa10a6b9986e7028551fbfc9d9e16eb83726b7`, dont `src` est identique au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Les [attendus](ATTENDUS.md), le reconstructeur des contrôles et le lecteur de la trajectoire ont été figés à `fb7bd2a5c71077dbc572be6a42c97408798deb3e` avant le correctif.

Les commandes 1 à 4 sont `ACTION1, ACTION4, ACTION3, ACTION2`. Au choix du geste 5, le support est en boîte `[11,36,16,41]`, la pointe en x=22. Les pièces sont dans la même colonne x=42…45. Le renommage inverse reproduit pixel par pixel les cinq trames du préfixe, donc les masques publics. L'ordre du bandeau, les commandes autorisées et les quatre effets mesurés se correspondent. Le contre-exemple de contact est encore absent. La fonction `RootedLineMemory.propose` cherche un accès qui pourrait ordonner les pièces sur la tige. Sur le gel, elle retourne `rooted_contact_plan_unresolved`. L'arrêt du service est `frontier_unknown`. Aucun besoin de récupération 96 n'a encore été admis. [Reconstruction](enquete.mjs)

| Présentation | Ordre demandé | Gel au choix 5 | Candidat au choix 5 |
|---|---|---|---|
| Historique | 8, 14, 9 | ACTION1 après 282 expansions | ACTION1 après 282 expansions, égalité conservée |
| Permutation 8↔14 | 14, 8, 9 | ACTION1 après 282 expansions | Même décision et même coût |
| Permutation 9↔14 | 8, 9, 14 | 1 000 expansions, 1 381 éléments de frontière comptabilisés, aucun plan | ACTION1 après 282 expansions, égalité conservée |

La borne du gel est `bound.max_nodes`. Les prémisses manquantes portées par d'autres branches, dont la sortie de domaine, apparaissent aussi sur le départ qui fonctionne. L'écart discriminant se lit en simulant les onze commandes du plan nominal sous chaque palette. Les onze projections physiques coïncident après renommage inverse. Au terme de ce trajet **simulé**, la pièce en avance touche pour la première fois la tige à la station 20. Les deux autres la touchent à la station 26, à deux hauteurs. Sous les noms historiques, leurs boîtes sont `[42,33,45,36]` et `[42,29,45,32]`. Le public permet de les distinguer en hauteur. L'objectif les ordonne le long de la tige et ne donne aucune priorité entre ces hauteurs. [Trajectoire](trajet.mjs)

Le noyau de référence trie les couples `[première station, identifiant de pièce]`. À station égale, `material:14` précède `material:9` dans l'ordre lexical. Cela suffit à faire varier `predicted_rooted_match` sous un simple renommage. La recherche accepte le même trajet sous deux présentations et le dépasse sous la troisième.

## Correction et preuve portée par le reçu

Le fournisseur `planRootedLine` demande explicitement la politique `test_compatible_stations`. Pour une projection où plusieurs types partagent une station, le noyau rassemble les pièces portées par la tige demandée selon leur première station. Il compare le multiensemble des types de chaque groupe au segment correspondant du but. Les multiplicités comptent. Une inversion entre stations est incompatible. L'ordre des membres à l'intérieur d'un groupe ne fournit aucune preuve.

Si la projection est compatible, la recherche peut retenir un trajet non vide vers cet état prédit. Elle conserve les conditions de support, de domaine et les limites de recherche. Un autre producteur qui appelle la fonction sans demander cette politique garde les mesures et les résultats V5 de référence. Les deux politiques sont exercées sur les mêmes configurations. [Noyau](../../../src/logos-engine/v5-piercing-plan.ts) · [Demande explicite du fournisseur](../../../src/logos-engine/v6-rooted-line-mechanics.ts)

Au choix 5 avec 9↔14, `rooted_line_plan.search.projected_order_trial` conserve `status: compatible_unordered`, la demande `[8,9,14]` et les stations `20 → {8}`, `26 → {9,14}`. Le résultat du noyau porte `rooted_match:false`, `predicted_rooted_match:false` et une liste de types ordonnés vide. La proposition explique que l'expérience teste un accès et que chaque retour physique sera vérifié. Le premier trajet compatible peut précéder dans la recherche un trajet plus long qui établirait un ordre strict. Le budget de 1 000 états, le domaine public et le garde d'exécution restent ceux du fournisseur historique. [Proposition native](../../../src/logos-engine/v6-rooted-line-access.ts)

## Décisions vérifiées

| Contrôle | Verdict attendu et obtenu |
|---|---|
| Géométrie inchangée, identifiants opaques `alpha, mu, zeta`, types inchangés | Le résultat de référence dépend du renommage. La nouvelle politique conserve le trajet de onze gestes, 282 expansions et le statut conditionnel. |
| Deux ordres demandés qui échangent les membres à la station 26 | Les deux sont compatibles et indéterminés. Aucun ordre total attesté. |
| Positionner un type de la station 26 avant celui de la station 20 dans la demande | Projection incompatible. Cette égalité locale ne justifie aucun essai pour ce but. |
| Trois stations physiquement distinctes | L'ordre des types est déterminé dans le modèle. Une inversion stricte le contredit. L'ordre prédit et l'ordre réellement observé ont des statuts distincts. |
| Support possible dont le modèle ne donne aucune loi | Prémisse de support manquante. Aucun accès délivré dans l'essai borné. |

| Départs publics avec 9↔14 | Gel | Candidat |
|---|---|---|
| Priorité historique | Arrêt après 4 gestes | ACTION1 au 5, réfutation au 12, ACTION3 au 13. Niveau 2 au geste 19. |
| Repositionnement prioritaire | Même arrêt | ACTION1 au 5, réfutation au 12, ACTION1 au 13. Niveau 2 au geste 21. |
| Retour étranger au geste 12, chacune des deux priorités | Même arrêt en amont | Le jeu exécute douze gestes. La preuve étrangère conserve la réfutation sans autoriser de reprise. Arrêt `frontier_unknown` avant tout geste 13. |

L'agenda de la ligne 96 continue à dépendre de la chaîne **réellement mesurée** au retour 12. Dans les deux essais positifs, le jeu confirme la projection complète du geste 13. La frontière officielle du niveau satisfait ensuite le besoin avec `matched:null`. Le gel et le candidat rejouent quatre témoins antérieurs qui couvrent le départ historique, la priorité inversée, la permutation 8↔14 et la preuve étrangère. Leurs commandes, gardes, projections et retours concordent. Le reçu du premier plan exprime désormais l'égalité sur les trajets historiques eux-mêmes. Cette différence de justification est voulue. [Contrôles de renommage](preuves.mjs) · [Tests unitaires indépendants](../../../tests/sic-rooted-station-order.test.ts)

## Rejeu et remise opérateur

Depuis la racine du checkout avec Git, tar, Node.js 24.22.3 et le paquet Pyodide 314.0.7 du Banc, exécuter les commandes suivantes.

```powershell
$d = 'experiments/sic-agenda-offres/projection-initiale'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/sk48-apres-calibrage.json"
& "$d/lancer.ps1" operateur --moteur candidat --fiche "$d/public/direct.json" --pyodide $py --recu "$env:TEMP/sk48-candidat.json"
```

Le même [point d'entrée opérateur](operateur.mjs) accepte `--moteur gel` et les fiches publiques `sic.contact/1` de [développement](public). Il relève la recherche du choix 5 avant exécution, la proposition effective, les tickets et les retours du jeu. Le [vérificateur](verifier.mjs) sépare l'accès depuis L1 du jugement local de la ligne 96. Le verdict porte sur les présentations et les interventions indiquées, dans la géométrie SK48.
