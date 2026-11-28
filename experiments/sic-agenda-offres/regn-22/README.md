# REGN · Ligne 22 · Rejoindre un état connu où subsiste une question

**Le témoin N3/T16 du catalogue est reproduit sur le gel.** Le planificateur doit recevoir le plafond de seize commandes de la campagne. Une simple coupure du relevé après seize gestes donne la même commande et la même image de retour, sous une autre famille. Le [lot 80](../regn-80/README.md) qualifie séparément le contraste de retour.

## Provenance

Le commit de publication `2a17e14b87d12c63bd76c6b3f2968050c7e80434` est enfant direct du moteur `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`. Dans sa table des 100 jeux, il attribue une occurrence à `observed_frontier / reach_open_input / access`, REGN N3 geste global 16, ACTION4 confirmée. La consigne de reproduction donne `/tests/sic-qualification.html?strategy-inventory&actions=16`. La publication contient une table de témoins. Les références par transition dans ce dossier proviennent de nouveaux parcours.

Dans le code de cette révision, `inventoryStrategies` fixe `maxActions` à 16 par défaut et appelle `run` sur le jeu chargé au niveau 1, cible complète, curiosité d'ouverture native. `run` transmet `maxSessionActions` au navigateur. `BrowserV6Agent` l'écrit dans `budgets.maxActions`, en plus des plafonds de 600 par niveau. Le worker applique l'agenda actif. L'inventaire rassemble la famille et le type à la libération, puis l'accord au retour. Le [parcours antérieur](../frontiere-22-23/parcours.mjs) à `02032a3d50ba15d7d0d7ff1c74d01165ad7e31f2` bornait sa boucle à 16 en laissant au moteur ses plafonds par niveau. Son constat négatif se reproduit à l'identique dans ces conditions. [Harnais du catalogue](../../../tests/helpers/sic-qualification.ts) · [Budgets du navigateur](../../../src/runtime/v6-agent.ts)

## Un seul changement au geste 16

Les quinze premiers tickets, leurs familles, leurs questions, leurs projections et leurs retours coïncident. Au seizième, l'observation est `frontier-qualification:epoch:3:revision:16:frame:af0bcad41eef9c48`. Au retour, la référence se termine par `revision:17:frame:aa7d9c16b3d8fb20`.

| Plafond du moteur | Coupure de lecture | Première décision qui diffère et effet |
|---|---|---|
| 16 | 15 | Le service rend une frontière après le retour 15. Dans le relevé à 16, `resume` délivre le ticket suivant. Les quinze lignes précédentes coïncident. |
| 16 | 16 | Il reste un geste. `returned_branch_contrast` est interrogée et ne propose rien. `observed_frontier / reach_open_input / access` délivre ACTION4. Projection confirmée, puis arrêt sur le budget de session. |
| Budgets par niveau seuls | 16 | La capacité du préfixe est 16. `returned_branch_contrast / access` propose ACTION4, ACTION4, ACTION4, ACTION3. Son premier ticket ACTION4 est confirmé. La frontière locale de 22 n'est jamais visitée. |
| 17 | 17 | Il reste deux gestes au choix 16. La ligne 22 délivre l'accès ACTION4 puis, au choix 17, le ticket de continuation ACTION3. La question distante reçoit `observed`. C'est une sélection et une continuation. |

`NativeCallerCoordinator.prepare` donne à la frontière une capacité de `min(16, remaining)`. Avec une place, `closedReturnContrast` s'abstient dès sa condition de capacité minimale. Avec deux places, le cycle observé de quatre transitions dépasse encore la capacité. Avec les seuls plafonds par niveau, les quatre étapes sont admissibles et l'agenda s'arrête chez le fournisseur prioritaire. Le jeu et l'épisode public sont identiques dans les deux premiers fournisseurs comparés au T16. La différence de réglage suffit sur le moteur historique et sur le gel. Le test répète le réglage du catalogue avec l'horloge de planification effective du worker et avec une horloge fixe. L'horloge du journal est fixée dans les deux essais. [Préparation du budget](../../../src/logos-engine/v6-native-caller.ts) · [Conditions du contraste et recherche d'accès](../../../src/logos-engine/v6-observed-frontier.ts)

## Preuve propre à la ligne 22

Au geste 16, ACTION3 et ACTION4 ont chacune déjà une preuve d'essai sur le plateau courant. Le pré-événement scellé indique `local:null` puis `routeStatus:found`. L'arête d'accès par ACTION4 vient du geste 12, dont la commande et le retour permettent de recalculer `transition:b4b5c2eae6c3a201220681c71d4822638372d8a008a1af28178f814adb81a86b`. Sur le plateau atteint, ACTION3 est encore ouverte sous `Q_8b45c6cdc354b85cd0a2`. Le prédicteur local lit ces seuls faits avant l'émission. Il donne `reach_open_input` et ACTION4, avec sélection globale indéterminée à ce stade. La présence effective de `observed_frontier` est vérifiée dans le reçu natif séparé.

Avec une seule place, le retour physique confirme l'accès sans exécuter la question. Avec deux places, le service vérifie la projection au geste 16 et émet le second ticket au geste 17. Le reçu de ce dernier porte `matched:null` et rattache l'observation au bon besoin et à la question distante. Le passage au niveau suivant n'intervient dans aucun de ces deux retours.

Le [témoin construit à deux plateaux](../frontiere-22-23/README.md) est rejoué à part, avec son contrôle de retrait de question et sa suspension sans trajet. Le SHA de son pré-événement et sa parité restent ceux de `02032a3d`. Le verdict du présent lot porte sur la reproduction dans le **jeu réel** et sur la cause de l'écart d'attribution antérieur. Il n'y a aucun changement de moteur sur cette branche. Les [attendus](ATTENDUS.md) sont figés à `176f054a`. Le parent `6bfb8ccf` fournit uniquement les outils d'expérience du lot 80.

## Reproduction

```powershell
$d = 'experiments/sic-agenda-offres/regn-22'
$py = '../sic-comparison-bench/public/vendor/pyodide'
& "$d/lancer.ps1" verifier --pyodide $py --recu "$env:TEMP/regn22-qualification.json"
& "$d/lancer.ps1" operateur --moteur historique --fiche "$d/public/catalogue.json" --pyodide $py --recu "$env:TEMP/regn22-catalogue.json"
```

Les fiches `sic.regn.frontiere/1` séparent `budget` (plafond reçu par le moteur), `gestes` (coupure du relevé) et `horloge` (planificateur fixe ou natif). Le contrôle `lecture.json` omet la limite globale avec `budget:null`. Le vérificateur exécute onze parcours sur les trois révisions et la qualification autonome de la fixture. Node.js 24.22.3, Git, tar et Pyodide 314.0.7 local suffisent. [Fiches](public) · [Opérateur](operateur.mjs) · [Vérificateur](verifier.mjs)
