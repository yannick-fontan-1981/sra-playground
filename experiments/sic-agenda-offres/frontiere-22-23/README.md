# Qualification pour le Banc · rangées 22 et 23

**G50T reproduit la rangée 23 jusqu’au retour du premier ticket. REGN reproduit la commande et son retour, mais une autre famille les porte au seizième geste.** La rangée 22 a un témoin positif de service sur la fixture à deux plateaux ci-dessous. Le Banc dispose donc de deux qualifications distinctes.

## Références et décompte

| Rangée | Tuple historique famille / stratégie / plan | Premier témoin publié à `8ce7ee35` | Démarche proposée dans la matrice |
|---|---|---|---|
| 22 | `observed_frontier / reach_open_input / access` | REGN N3, geste 16, `ACTION4`, prédiction confirmée. Une occurrence dans la campagne | P01 → P06 → P07 → P10 → P11 → P05 → P11 → P12 |
| 23 | `observed_frontier / test_local_input / experiment` | G50T N1, geste 1, `ACTION1`, sans prédiction vérifiée. 405 occurrences dans la campagne | P01 → P04 → P05 → P11 → P12 |

L’inventaire compte depuis le début de la partie, avec 16 gestes au plus par jeu. Les numéros 22 et 23 désignent deux démarches parmi 98. Les identifiants P désignent la composition proposée par la matrice. L’audit `e1b31e40` classe les deux lignes en R au gel de `main`. [Témoins publiés, lignes 48 et 49](../../../docs/architecture/sic-v8-strategies-observees.md#L48) · [Matrice, lignes 62 et 63](../../../docs/architecture/sic-v8-composition-des-98-strategies.md#L62)

Le checkout expérimental part de `958c6dbc752008ca5494ce7574021ce85a96de63` pour réutiliser le prototype `Agenda`. Les sources du moteur sont identiques au gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021`. Le rejeu extrait aussi le moteur et les jeux de la campagne historique, `8ce7ee3563fa1d5eca1639c6ad03975cfc962460`, dans un répertoire temporaire. La même sonde en mémoire s’applique aux deux moteurs.

## Ce qui est connu au moment du choix

| Instant et producteur | Données disponibles | Usage dans l’expérience |
|---|---|---|
| Avant le premier fournisseur, `NativeV6Runtime.selectFamily` | Observation publique, commandes candidates, groupes configurés et ordre, mode et budget lorsqu’ils ont été calculés. Les fournisseurs du tour doivent encore produire leurs offres. | Prédiction globale **indéterminée**. Le reçu `sicFamilySelection` sert ensuite à constater la famille retenue et les groupes visités. |
| Dans `NativeCallerCoordinator.frontierOffer` puis `ObservedFrontier.propose`, juste avant `selectFrontierStrategy` | Occurrence, époque, index du plateau, version et chaîne du graphe, domaine admis, transitions antérieures d’essai, question locale après classement. Si elle existe, la recherche de trajet est omise. Sinon `ObservedFrontier.access` a déjà rendu un chemin vers une question ou épuisé sa recherche. | La sonde sérialise ces seuls champs et calcule un SHA-256. Une question porte son identifiant, son contexte et sa commande candidate. Chaque arête du chemin porte sa source, sa cible, sa commande et ses références de transitions passées. |
| Après cette coupe, `selectFrontierStrategy`, garde native, `V6AgentService.accept`, puis `advance` | Stratégie du plan, besoin et éventuel besoin d’accès, ticket délivré, commande autorisée, observation suivante, événement `actual_outcome`. | Comparaison aval par occurrence, ticket, plan et objectif. Seul le ticket délivré par le service est joué. |

Le prototype reçoit les descripteurs des deux stratégies de `frontierStrategyGraph`. La question locale positive justifie `test_local_input`. Son absence constatée **et** un chemin avec arêtes attestées et question à destination justifient `reach_open_input`. Une recherche épuisée suspend le besoin d’accès jusqu’à une nouvelle entrée admise ou un trajet observé vers une telle entrée. La recherche native parcourt les arêtes observées dans l’époque courante, traite au plus 2 048 entrées de file et exige moins de deux essais de navigation pour le triplet départ, première commande et question. Cette suspension porte sur la frontière inspectée. Le cas où la recherche a été omise conserve `unqueried`.

L’agenda hors ligne reçoit ces deux possibilités dans une seule famille, pour le même besoin. Son paramètre formel de mode vaut `exploration` et aucune préférence de mode ne participe au choix local. Le classement des commandes et la recherche de chemin appartiennent au producteur natif. L’essai qualifie l’arbitrage entre **une question déjà préparée**, **un chemin déjà trouvé** et **la suspension**. [Producteur des offres](../../../src/logos-engine/v6-observed-frontier.ts#L429) · [Résolveur natif](../../../src/sic/frontier-strategy.ts#L32) · [Sélection globale](../../../src/logos-engine/v6-native-runtime.ts#L807) · [Autorisation du service](../../../src/runtime/v6-agent-service.ts#L153)

## Résultats sur les jeux

Les deux moteurs repartent du niveau 1 dans les jeux publics locaux avec le pack et l’agenda de famille actifs du worker de l’inventaire. Le service reçoit la projection publique de sa propre révision. La limite de lecture est d’un geste pour G50T et de seize pour REGN. L’horloge de planification et celle du journal sont fixes. Il s’agit de nouveaux rejeux bornés. Le pré-événement de la session navigateur d’origine n’est pas disponible dans le tableau historique.

| Rangée et point | Attendu de la campagne | Obtenu à `8ce7ee35` et à `d0e7527c` | Verdict |
|---|---|---|---|
| 23 · G50T N1/1 | Essayer ici, `ACTION1` | Question locale présente. Accord de l’agenda et du reçu sur `test_local_input / experiment`. Ticket 1, retour `unknown_effect_observed`, même objectif observé et `matched=null`. | 1 point historique reproduit à chacune des deux révisions. |
| 22 · REGN N3/16 | Rejoindre la question, `ACTION4`, retour confirmé | Ticket 16, `ACTION4`, `access`, retour `matched_public_projection`, `matched=true`. Le reçu nomme `returned_branch_contrast` et s’arrête à ce groupe. Le fournisseur `observed_frontier` n’est pas visité à ce tour. | Écart de famille au point historique. Aucune prédiction locale comparable à ce geste, 0 reproduction positive de la rangée 22 sur REGN. |

Le reçu de REGN relie l’occurrence `epoch:3:revision:16:frame:af0bcad41eef9c48` au retour `revision:17:frame:aa7d9c16b3d8fb20`. La cause immédiate de l’absence de pré-événement est vérifiable dans le parcours global. Pour déterminer pourquoi la session d’origine avait atteint la frontière, il faudrait son préfixe public effectif, les tickets et le parcours de ses fournisseurs jusqu’à la première divergence. La seule correspondance du geste et de son résultat ne permet pas cette attribution.

## Contre-épreuves sur le moteur des 107

La fixture du service a deux plateaux unis. B admet les entrées 1, 2 et 3. Les deux premières conduisent à A, la troisième laisse B affiché. A admet uniquement 4 qui ramène à B. Ces règles déterminent les retours du banc. Le solveur reçoit le plateau courant et son domaine public à chaque tour.

| Ticket ou coupe | Pré-événement et décision attendue | Reçu obtenu |
|---|---|---|
| 1, 2, 3 | Une entrée locale inédite reste admissible. Essayer respectivement 1 sur B, 4 sur A, 2 sur B. | Trois décisions de rangée 23, trois retours d’effet initialement inconnu. Le ticket 2 atteste le trajet A → B. |
| 4 | Sur A, le domaine est épuisé. Le trajet par 4 mène à B où la question `Q_cdd50005b0e7fd09342c` est encore ouverte sur 3. Rejoindre B. | Une décision de rangée 22, plan `access`, ticket 4 sur `ACTION4`. Le retour confirme la projection vers B. |
| 5 | Reprendre la question sur B après l’accès. | Le même plan délivre son second ticket, `ACTION3`, index 1. L’objectif de la question est observé. Ce ticket ajoute zéro décision de rangée 23. |
| Après 5 | Les domaines sont épuisés, aucun trajet admissible ne mène à une question ouverte. Suspendre. | `frontier_frontier_exhausted`, besoin `find_observable_frontier_access` ouvert, aucun ticket. |
| Retrait de la question locale | Deux copies de la même mémoire ont la même observation A et l’arête A → B déjà apprise par 4. La première admet 4 et 5. La seconde retire uniquement 5 du domaine admis. | Avec 5, décision locale `test_local_input / ACTION5` et trajet non cherché. Sans 5, `reach_open_input / ACTION4` vers la question distante sur 1. Ce contrôle au niveau du fournisseur produit deux propositions, sans émission de ticket. |

Au pré-événement du ticket 4, l’arête porte `transition:30a314d67564e61f20c2c555774ee31eb3a64c02e69abc7f5591ebee2ddfe919`. Le test recalcule cet identifiant avec l’occurrence **antérieure** du ticket 2, son action et son retour. Le besoin d’accès et le besoin d’information ont deux identifiants distincts. Le besoin d’information reste le même sur les tickets 4 et 5. Le reçu JSON conserve les références entières.

**Décompte proposé au Banc.** La rangée 23 dispose de la chaîne pré-événement → choix → ticket → retour sur son témoin G50T. La rangée 22 dispose de cette chaîne sur une fixture native, avec reprise de l’objectif distant. Son raccord positif au témoin REGN reste ouvert. Le rejeu des deux révisions porte sur les deux mêmes points historiques. La fixture ajoute trois décisions locales de 23 et une de 22. L’écart REGN, le ticket de continuation et la suspension sont comptés à part. **Aucune nouvelle migration complète certifiée sur les 98 par ce lot expérimental.**

## Rejeu

Les trois suites natives ciblées (`sic-strategy-agenda`, `v6-observed-frontier`, `v6-caller-integration`) passent leurs 50 tests. Les 21 décisions manuelles du prototype parent correspondent toujours aux attentes.

Depuis la racine du checkout, avec Node 24.22.3, Git et `tar`, cette commande rejoue la fixture, le retrait de la question et les deux préfixes sur les deux moteurs. Passer un répertoire Pyodide déjà préparé contenant les dépendances locales de SRA-Playground. Le chemin ci-dessous est celui utilisé pour la qualification.

```powershell
.\experiments\sic-agenda-offres\frontiere-22-23\qualifier.ps1 --jeux ../sic-comparison-bench/public/vendor/pyodide --recu "$env:TEMP/sic-frontiere-banc.json"
```

Sans `--jeux`, le contrôle se limite aux fixtures autonomes et ne charge pas Pyodide. `--recu` est facultatif. Le fichier de témoins versionné donne le pré-événement intégral de l’accès et le reçu réduit des quatre points sur jeu. La commande les vérifie et peut aussi produire le JSON détaillé. Sur la fixture, les bras sonde inactive et active comparent l’empreinte de tous les tickets, parcours de groupes, décisions, retours et chaînes natives collectés. Les contrôles de fuite rejettent un pré-événement modifié, un champ de résultat ajouté même avec un sceau recalculé, puis détectent séparément un reçu aval attribué à la mauvaise stratégie. [Témoins à vérifier](temoins.json) · [Commande de qualification](qualifier.mjs) · [Coupe en lecture](observation.mjs) · [Adaptation au prototype](prediction.mjs) · [Intervention à un facteur](retrait.mjs)
