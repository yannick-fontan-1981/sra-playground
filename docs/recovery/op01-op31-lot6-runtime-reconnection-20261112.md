# OP01–OP31 — reprise C1/C2 sur le runtime Lot 6

Date : 12 novembre 2026

Branche de travail :
`op01-op31-c1-c2-runtime-reconnect-20261112`

Baseline canonique relue avant modification :
`recovery/site109-reconstruction-20261112` au commit
`e98caa0e5d939dccc962a2258aa99237e0fa7b97`.

Source de récupération OP01–OP31 conservée comme donneur/référence :
`op01-op31-c0-c7-audit`.

Plan stable :
`docs/migration/op01-op31-verification-plan.md`.

## Conclusion

La baseline canonique possède désormais un **transport worker agent réel et
réutilisable**, mais pas encore un **agent symbolique produit**.

Le premier point d’intégration propre pour Logos est identifié :

`AgentWorkerCore` → `AgentDecisionPort.decide(observation, budgetMs, signal)`.

Ce point accepte une observation publique, impose le budget, l’annulation, la
monotonie des séquences et la disponibilité des actions. Il peut donc porter une
décision Logos sans reconstruire un worker parallèle.

Il n’est toutefois pas raccordé aujourd’hui : le worker public installe
`PendingPerceptionDecisionPort`, dont `decide()` retourne `undefined`. Le chemin
réel se termine donc sans action et sans appel OP.

**C1/C2 ne peuvent pas encore être déclarés raccordés au produit/browser.**
La preuve Worker → Logos existante reste volontairement sous `tests/helpers` et
exige un producteur symbolique externe explicite. Aucun appel artificiel n’est
ajouté pour masquer ce manque.

## Précaution historique

Le fichier actuel `src/runtime/v6-agent-worker.ts` est une reconstruction de
transport explicitement marquée `reconstruction-pending-perception`.

Sa présence ne prouve pas la restauration du runtime V6 historique de Site 109.
Cette étape ne revendique ni identité de source, ni parité, ni comportement de
l’ancien worker.

## Composants runtime trouvés

### Transport du jeu et retour réel

- `src/runtime/browser-games.ts`
  - hôte navigateur du worker jeu ;
  - transport `GameRequest` / `GameObservation` ;
  - reset, action, undo, saut et fermeture ;
  - conservation des frames, de l’état, du niveau et des actions disponibles.
- `src/runtime/game-worker.ts`
  - exécution Pyodide du pont de jeu ;
  - réponse corrélée par identifiant de requête ;
  - renvoi de l’observation effective du jeu.
- `src/agent-product-dispatch.ts`
  - validation de disponibilité d’action ;
  - mapping ACTION1–ACTION7, dont ACTION6 avec coordonnées ;
  - rejet des générations obsolètes ;
  - envoi au runtime jeu puis présentation du retour.
- `src/product-presentation.ts` et `src/main.ts`
  - présentation déterministe du retour ;
  - l’interface produit conserve explicitement l’agent SRA comme non connecté.

### Transport et contrôle de l’agent

- `src/runtime/contracts.ts`
  - protocole public `AgentObservation` / `AgentAction` ;
  - pixels 64×64, actions disponibles, état, niveau et progression.
- `src/runtime/v6-agent-worker-core.ts`
  - port injectable `AgentDecisionPort` ;
  - initialisation, budget, timeout, annulation et contrôle de séquence ;
  - refus d’une action invalide ou indisponible.
- `src/runtime/v6-agent-worker.ts`
  - enveloppe Worker réelle ;
  - validation stricte des messages ;
  - port par défaut sans perception ni décision.

### Logos générique reconstruit

- `src/logos-engine/v6-native-authority.ts`
  - besoins et gardes OP18/OP28 ;
  - aucun routage OP14 depuis l’autorité actuelle.
- `src/logos-engine/v6-composition-engine.ts`
  - calcul et admission des bundles déjà produits.
- `src/logos-engine/v6-operation-cycle.ts`
  - joint une release déjà sélectionnée à un retour déjà produit ;
  - ne produit ni objectif, ni composition, ni candidat.
- `src/logos-engine/v6-target-binding.ts`
  - OP29 informationnelle ;
  - OP30 persistée ;
  - OP31 informationnelle.
- `src/logos-engine/v6-operation-trace.ts`
  - trace besoin/appel/consommation bornée dans la bibliothèque ;
  - aucun collecteur ou transport produit n’est raccordé au worker/browser.

### Retour public spécialisé Region

- `src/logos-engine/v6-public-observation-delta.ts`
  - compare deux observations publiques 64×64 et construit des deltas de régions.
- `src/logos-engine/v6-region-public-evidence.ts`
  - transforme un avant/après ACTION6 en preuve Region lorsque le retour change.
- `src/logos-engine/v6-region-intervention.ts`
  - confirme ou réfute une méthode et modifie les propositions futures.
- `src/logos-engine/v6-region-intervention-owner.ts` ;
  `v6-region-caller-adapter.ts` ; `v6-neutral-common-caller.ts`
  - portent la proposition, l’acquisition et la réconciliation spécialisées.

Ce chemin est réel pour son périmètre, mais il exige encore qu’un appelant
fournisse explicitement `methodRef`, le séparateur candidat et son lien à la
méthode. Il ne perçoit pas la géométrie et ne choisit pas un objectif général.
Il ne constitue donc pas à lui seul le producteur symbolique manquant du worker.

## Chemins réellement disponibles

### 1. Produit manuel réel

`GameObservation` → choix manuel → `dispatchProductAction()` →
`BrowserGameRuntime.action()` → worker jeu → retour `GameObservation` →
présentation.

Ce chemin exécute réellement une action, mais n’appelle pas Logos.

### 2. Worker agent réel par défaut

`AgentObservation` → `AgentWorkerCore` →
`PendingPerceptionDecisionPort.decide()` → `undefined` → arrêt `budget`.

Aucune action n’est inventée. Aucune OP n’est appelée.

### 3. Worker → Logos qualifié seulement en test

Producteur symbolique explicite de test → bundle/record/action déjà construits →
`AgentWorkerCore` → autorité Logos → OP18 ou OP28 → garde → action.

Ce chemin prouve le contrat d’injection et les gardes, pas une perception SRA
produit.

### 4. Boucle Region spécialisée

ACTION6 + observation avant/après + liaison de méthode explicite → delta public →
preuve Region → confirmation/contradiction → proposition future modifiée.

Ce chemin démontre des équivalents spécialisés OP06/OP29/OP30, sans appeler les
OP génériques uniquement pour augmenter leur compteur.

## Premier point d’intégration Logos

Point identifié :
`AgentDecisionPort.decide()`.

Statut : **raccordable maintenant au niveau transport, non raccordable encore au
niveau décision symbolique**.

Il manque avant tout branchement produit :

1. un hôte produit qui crée, initialise et alimente le worker agent ;
2. un adaptateur générique `GameObservation` → `AgentObservation`, avec identité
   de session, séquence et époque de niveau ;
3. un producteur perception → état symbolique → objectif/question → composition
   et bundle ;
4. une sélection d’action liée au bundle produit ;
5. un corrélateur action/retour qui construit l’`afterState`, conserve le même
   `needId` et appelle le postAnalysis uniquement après retour réel ;
6. un propriétaire d’objectif qui consomme OP31 ;
7. un lecteur futur de la connaissance OP30, faute de quoi la persistance reste
   sans contribution décisionnelle démontrée ;
8. un propriétaire de snapshot/restauration pour la mémoire Logos et Region ;
9. un transport borné des compteurs/traces C1 vers le produit ou le harness.

Ces contrats sont nécessaires ; recréer un faux worker ne les fournirait pas.

## Statut exact des opérations prioritaires

| OP | Appel dans le worker produit actuel | Consommation produit | Statut de reprise | Motif |
| --- | --- | --- | --- | --- |
| OP18 | non | non | **bloqué par runtime manquant** | question, composition, bundle et action ne sont pas produits depuis l’observation réelle |
| OP28 | non | non | **bloqué par runtime manquant** | aucun bundle réel admis n’arrive au port de décision produit |
| OP29 | non | non | **appel existant sans consommateur démontré** dans le noyau générique | calcul/postAnalysis disponible, mais aucun retour produit n’y est corrélé ; équivalent spécialisé Region démontré |
| OP30 | non | non | **appel existant sans consommateur démontré** dans le noyau générique | persistance disponible, mais aucune lecture décisionnelle future produit ; équivalent spécialisé Region démontré |
| OP31 | non | non | **appel existant sans consommateur démontré** | aucun propriétaire d’objectif produit ne lit l’évaluation |
| OP03 | non | non | **bloqué par runtime manquant** | pas de producteur tri-état de préconditions depuis la perception produit |
| OP08 | non | non | **bloqué par runtime manquant** | pas de graphe générique effect→requires produit |
| OP12 | non | non | **bloqué par runtime manquant** | pas de producteur générique dépendances/inconnues produit |
| OP26 | non | non | **bloqué par runtime manquant** | pas de domaine réel multi-accès produit à filtrer |
| OP06 | non comme OP générique | oui dans Region | **déjà assuré par fonction spécialisée** pour Region | contradiction du retour invalide la méthode et bloque les propositions futures |
| OP14 | non depuis l’autorité | non | **bloqué par runtime manquant** | admission disponible au bridge, mais aucun besoin/producteur produit et aucun routage natif actuel |
| autres OP | non | non | **hors périmètre actuel** | leur audit calcul/donneur reste valide ; aucun nouveau besoin produit n’est établi dans cette reprise |

## Qualification C1

La trace légère et les compteurs existent dans le noyau Logos, et les contrats du
worker rendent possible leur intégration future.

En revanche, le produit courant ne produit aucun événement de besoin OP et ne
transporte aucune consommation Logos. C1 reste donc :

**fonctionnel au niveau bibliothèque/contrat Worker, bloqué au niveau produit par
le producteur symbolique et l’hôte agent manquants.**

Aucune instrumentation artificielle n’est ajoutée au transport pour simuler un
besoin.

## Qualification C2

La chaîne générique OP18/OP28 → OP29/OP30/OP31 est couverte dans le noyau et par
le bridge de campagne test-only lorsque les données symboliques sont fournies.

Elle n’est pas déclenchée par une observation réelle dans le produit actuel.
Les distinctions restent donc :

- calcul correct : démontré dans le noyau ;
- appel observé : démontré seulement dans les tests du bridge explicite ;
- résultat consommé : OP18/OP28 comme garde dans ces tests ; OP30 comme écriture
  dans le noyau ;
- contribution démontrée en produit : aucune ;
- contribution spécialisée Region : démontrée pour OP06/OP29/OP30 équivalents.

## Tests et vérifications de cette étape

Cette étape ne modifie aucun chemin d’exécution et n’ajoute aucun test artificiel.

Vérifications réalisées :

- lecture des contrats Lot 6, worker, dispatch, présentation et runtime jeu ;
- lecture du worker public et de son test de non-invention d’action ;
- lecture du bridge Worker → Logos et de sa campagne test-only ;
- lecture du delta public et des tests de retour Region ;
- lecture du cycle OP et des consommateurs génériques OP29/OP30/OP31 ;
- comparaison de la baseline canonique après l’intégration récente du Lot 9B.

Aucune suite locale n’a été relancée : le checkout n’est pas matérialisé dans
l’environnement courant et aucun workflow GitHub n’est configuré sur le commit.
Les résultats historiques déjà consignés ne sont pas présentés comme un nouveau
run.

## Performance

Le commit canonique courant ajoute un premier runner explicite A/STCK, mais son
statut reste `reconstructed-contract-pending-real-native-execution`. Les quatre
runners A/STCK, A/SMLP, B/STCK et B/SMLP ne sont pas tous qualifiés sur exécution
native réelle et le manifeste officiel n’est pas complet.

Aucun benchmark de remplacement n’est présenté comme officiel.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer**.

Les règles restent :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- jeux séparés ;
- aucune compensation ;
- phases internes informatives si le global du jeu reste conforme.

## Décision de l’étape

- aucun faux `v6-agent-worker.ts` ajouté ;
- aucun import Logos ajouté au produit sans producteur réel ;
- aucun appel OP ajouté pour atteindre un compteur ;
- le seam réel `AgentDecisionPort` est retenu comme point d’intégration ;
- la dette exacte est déplacée du « transport worker absent » vers
  « producteur symbolique, hôte agent et consommateurs de retour absents ».

## Prochaine étape

Construire ou récupérer la plus petite tranche **probante** qui alimente
`AgentDecisionPort` depuis une observation réelle :

1. hôte agent + adaptateur d’observation ;
2. producteur symbolique borné pour un besoin déjà établi ;
3. action liée au bundle ;
4. retour réel corrélé ;
5. test complet observation → OP → consommateur → décision suivante.

La première tranche ne doit pas prétendre restaurer tout V6. Elle doit choisir un
besoin réel déjà produit par le runtime, ou rester non raccordée.