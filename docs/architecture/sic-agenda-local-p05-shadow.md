# Agenda local en shadow pour le besoin P05

## Contrat préenregistré

Référence moteur `0aef4289e97ce094782dfd03f5a79ace6eae5fd2`. [Feuille de route](https://github.com/yannick-fontan-1981/sra-playground/blob/0448216a3e01554391c30ecc7b5b7f667bee4a3f/docs/architecture/sic-chantier-strategies-composables.md). Besoin local unique `establish_control_effect_for_current_objective`. La décision porte sur une commande d’essai déjà préparée et coûte un geste. L’unité de comparaison est la proposition locale au moment où le propriétaire dispose des faits, avant toute autorisation.

| Raccord observé | Offre et portée des preuves | Verdict de référence et abstention |
|---|---|---|
| AS66, famille native `SlidingCavity.proposeDirectionQuestion` | Commande encore inconnue pour le corps ajusté à la cavité. Le producteur fournit l’observation, la preuve de méthode récompensée et la clé d’essai de cette géométrie. | `bindMissingControlTrial → evaluateMissingControl` qualifie l’offre. Le témoin P05 exige une observation liée, les prémisses et une seule commande. Sans proposition de direction, la famille ne soumet rien. |
| G50T L1, `createSicVerifyRemoteReplay.propose` | La branche `probe` expose une commande disponible sans vecteur et sans essai au point du porteur courant. Le porteur, le contact atteignable et les références sont établis avant le choix. | `chooseLanding` reçoit les faits de la famille. Au T5, ACTION4 teste la direction. Le T6 réemploie le vecteur [6,0] du même porteur avec le même ACTION4 sous P07. La marche mesurée, la commande de rejeu préparée et le rejeu enregistré gardent leurs raccords propres. |

Le shadow reçoit la même offre, les mêmes faits et le budget. Il applique les gardes P05 sur ces faits, classe indépendamment l’offre préparée par rapport à l’abstention et compare le résultat au choix de référence. Le reçu distingue un fait inconnu d’un fait contraire et relève le premier champ divergent. Une offre unique est disponible dans les interfaces étudiées. Les autres primitives déclarées dans le graphe ne deviennent des alternatives qu’avec une offre réellement construite.

Les cas reproductibles couvrent la question de direction référencée d’AS66, le premier préfixe réel de G50T, le retour et la reprise, ainsi que les refus contrôlés pour une référence absente, une prémisse contraire et un geste hors budget. L’activation du journal doit conserver les propositions, gardes, retours et états acquis. Le shadow reçoit uniquement une projection du besoin et des preuves et possède son canal d’observation. La séance de référence conserve la décision, la mémoire et l’autorisation.

## Sélection et reçu

`rankControlTrial` applique les gardes du graphe avec `resolveStrategyGraph` en shadow. Le seul candidat inscrit est P05, avec un coût d’un geste. Le classement retient l’offre si les gardes la rendent applicable et que le budget couvre ce geste. Toute autre issue donne une abstention. Le classement utilise les faits transmis par la famille et se calcule sans planner. [Graphe et comparateur](../../src/sic/control-effect-next.ts)

Le reçu compare d’abord la sélection, puis l’applicabilité, le motif et les références que la référence expose. G50T expose le choix SRC et ses références de route. La question native de cavité expose aussi l’applicabilité et le motif des gardes. Une référence courante absente rend les faits indéterminés. Un effet déjà connu est une prémisse contraire. La contre-épreuve construite à budget nul fait diverger le champ `selected` et conserve le verdict de la référence. [Adaptateur du témoin natif](../../src/sic/missing-control-strategy.ts) · [Offre et choix SRC de G50T](../../src/sic/replay-access.ts)

L’appelant de `createNativeV6Runtime` peut fournir `observeControlTrialShadow`. L’option transmet un reçu séparé du ticket et de l’état persistant. Une erreur du destinataire est isolée du chemin actif. Le chemin `SlidingCavity` en mode natif V6 et la branche `probe` du rejeu distant sont raccordés. L’approche P07, la commande de rejeu et le graphe `learn_slide_control` de la cavité SIC conservent leur chemin actuel. [Entrée native](../../src/logos-engine/v6-native-runtime.ts) · [Question de direction](../../src/logos-engine/v6-sliding-cavity.ts)

## Contrôles sur jeux et fixtures

| Rejeu natif depuis N1 | Offres comparées | Parité à budget égal |
|---|---|---|
| AS66, mode natif V6 | Deux questions `sliding_cavity`, ACTION1 sur r6 puis ACTION4 sur r7. | 16 commandes libérées, 16 retours et 17 observations concordent avec `0aef4289`. Aucun champ divergent dans les deux comparaisons shadow. |
| G50T, mode SIC | Six sondes `sic_verify_remote_replay` aux tours 1–5 et 9. | 16 commandes libérées, 16 retours et 17 observations concordent avec `0aef4289`. Aucun champ divergent dans les six comparaisons shadow. Le retour T5 acquiert le vecteur [6,0] et le T6 emploie le même ACTION4 sous P07. |

Le rejeu A/B utilise le vrai service, les jeux officiels du dépôt, un plafond global de 16 gestes et une horloge de planification déterministe. Les assertions couvrent les commandes et leurs paramètres, les propositions et gardes capturées, les retours et les observations. Les compteurs de cette table portent sur ces préfixes.

Le test ciblé rejoue les deux questions d’AS66 à partir de la fixture native et compare le témoin, les gardes, les retours et la mémoire familiale avec et sans shadow. Pour G50T, il alimente le service avec l’observation initiale et les cinq retours enregistrés, puis vérifie le sixième ticket. La fixture G50T d’origine est reprise telle quelle. Les autres cas vérifient les références manquantes, une prémisse contraire, le budget et l’isolation du canal de diagnostic. [Tests du lot](../../tests/sic-p05-agenda-shadow.test.ts) · [Fixture d’origine](https://github.com/yannick-fontan-1981/sra-playground/blob/981b9ab9599ccb3e0f7cd12cd50fd070e2e582d7/tests/fixtures/sic-replay-control-g50t-l1.json.gz)

Avec Node 24, depuis la racine du dépôt.

```powershell
$nodeSic = (Get-Command node.exe -All)[-1].Source
& $nodeSic --test tests/sic-p05-agenda-shadow.test.ts tests/sic-native-resolution.test.ts tests/sic-paired-passage-continuity.test.ts tests/sic-recorded-pulse.test.ts
& $nodeSic --test --test-name-pattern='real public AS66|prefix' tests/v6-sliding-cavity.test.ts
& $nodeSic scripts/verify-sic-continuity.mjs
npm.cmd run typecheck
```
