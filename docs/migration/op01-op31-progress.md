# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique réconciliée avant intégration :
  `6304bec8c99a05b0023692f8fe7f432394acaa11`
- Branche de travail : `recovery/lot5b-common-campaign-owner-20261112`
- Commit de code initial : `004786bda6372c1cf0189fabac7d443992e80079`
- Commit qualifié après fusion du dernier canonique :
  `4c5060f8ab3523c3ed4cb85ead8441397d985c7c`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Lot 6 et seam Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Réconciliation Lot 5 et chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun et retour corrélé :
  `docs/recovery/lot5b-common-campaign-owner-20261112.md`

Le présent fichier est l'état courant consolidé. L'ancien suivi intégral est
conservé dans l'historique Git afin de ne perdre aucune preuve, mesure ou
décision antérieure.

## Règle de qualification

Une utilisation réelle suit la chaîne :

**besoin identifié → données produites → appel justifié → résultat →
consommateur → effet sur la décision.**

Les niveaux restent distincts :

1. calcul correct ;
2. données produites par le chemin concerné ;
3. appel observé ;
4. résultat consommé ;
5. contribution démontrée ;
6. coût qualifié.

Un compteur d'appels, un import ou une trace sans consommateur ne suffisent pas.
Aucune OP n'est ajoutée uniquement pour atteindre 31 appels.

## Provenance et limites historiques

`src/runtime/v6-agent-worker.ts` reste une reconstruction. La source officielle
historique du worker Site 109 et le runtime/campaign complet historiquement
utilisé n'ont pas été retrouvés. Aucune identité ou parité avec cet ancien
worker n'est revendiquée.

Les composants Lot 5 `FieldStock` et matériaux adressés sont également une
reconstruction qualifiée à partir de sources donneuses et de contrats publics.
Ils ne prouvent pas une parité binaire avec l'ancien Site 109.

Les quatre identités de runners A/STCK, A/SMLP, B/STCK et B/SMLP sont
reconstruites au niveau du contrat, mais les exécutions natives officielles et
leurs `sourceRef` restent à qualifier.

Statut performance global :

**fonctionnellement qualifié, performance officielle à confirmer.**

## Composants runtime pertinents

### Transport, produit et worker Lot 6

- `src/runtime/browser-games.ts` et `game-worker.ts` : transport jeu et retour
  public ;
- `src/runtime/contracts.ts` : protocole public
  `AgentObservation` / `AgentAction` ;
- `src/runtime/v6-agent-worker-core.ts` : budget, annulation, séquence et
  validation ;
- `src/runtime/v6-agent-worker.ts` : enveloppe Worker reconstruite ;
- `src/agent-product-dispatch.ts` : dispatch produit et retour du jeu ;
- ports de présentation partagés : validité de génération, animation, timing,
  feedback et libération du busy state.

### Matériaux adressés et FieldStock Lot 5

- `src/runtime/observed-addressed-material-runtime.ts` : propriétaire de
  rétention, frontière, revalidation et stock courant ;
- `src/logos-engine/addressed-field-*.ts` : acquisition, réponse, garde,
  rétention et fit adressés ;
- `src/logos-engine/field-stock.ts` : producteur borné de question, plan,
  préservation, actions coordonnées et bundle OP18 ;
- `src/logos-engine/linked-preparation.ts` et
  `observed-object-binding.ts` : liaisons publiques et préparation.

### Observation publique et OP28

- `src/runtime/v6-browser-agent-observation.ts` : adaptation stricte
  `GameObservation → AgentObservation` sans état caché ;
- `src/logos-engine/v6-public-single-action-port.ts` : producteur OP28 limité au
  cas où une action simple non-RESET est publiquement unique et complète.

### Propriétaire commun de campagne

- `src/runtime/v6-public-observation-measurement.ts` : mesure publique 64×64 et
  composants monochromes 4-connexes ;
- `src/logos-engine/v6-common-campaign-contracts.ts` : contrats de proposition,
  autorisation et feedback corrélé ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` : owner OP28 ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` : owner FieldStock/OP18 ;
- `src/runtime/v6-common-campaign-decision-port.ts` : collecte neutre,
  cardinalité, autorisation différée, conservation du `needId` et routage du
  retour ;
- `src/runtime/v6-agent-worker.ts` utilise ce port par défaut.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **instrumenté sur deux producteurs réels et un owner commun** | FieldStock OP18 et action publique unique OP28 distinguent besoin, non-besoin, appel, consommation et même `needId` au retour | acquisition FieldStock initiale et candidat Region public qualifié |
| C2 | **OP18 et OP28 consommées comme gardes avec effet futur démontré** | sélection neutre avant autorisation ; FieldStock enregistre le retour et change le locus de la décision suivante | propriétaire réel pour OP31 et lecture future générique OP30 |
| C3 | **calculs et recouvrements qualifiés** | OP03/08/12/14/26 couvertes au niveau noyau ; spécialisations donneuses identifiées | appeler uniquement lorsqu'un producteur runtime établit le besoin |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur réels |
| C5 | **audit complet, retours spécialisés disponibles** | FieldStock et Region couvrent des besoins équivalents OP06/29/30 avec effet futur | préserver ces spécialisations sans duplication générique |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccordement sans preuve de blocage/reprise/variante |
| C7 | **ouvert** | garde-fous, diagnostics ciblés, protocole ABBA et quatre contrats runners disponibles | exécution native qualifiée, manifeste/sourceRef complets et STCK/SMLP séparés < +10 % |

## Chaîne réelle reconstruite OP18 : FieldStock

### Besoin identifié

Un stock adressé a été retenu puis revalidé dans la scène courante. Une demande
typée manque dans une zone officielle et ACTION6 est publiquement disponible.

### Données produites

`FieldStock.propose()` produit :

- une question ouverte mesurable ;
- une composition non observée ;
- un plan borné à 16 pas ;
- des actions ACTION6 avec coordonnées mesurées ;
- des obligations de préservation ;
- les faits et preuves de scène ;
- un `bundle_template.operation_key = OP18` avec outcome guard.

### Appel, résultat et consommation

Le nouvel owner FieldStock :

1. revalide la scène courante ;
2. produit le candidat et exécute `beforeStock()` ;
3. remet le candidat au caller commun ;
4. n'appelle `releaseBundle()` qu'après sélection unique ;
5. conserve le `needId` de l'autorité ;
6. route l'observation suivante au même owner avec ce `needId` ;
7. appelle `afterStock()` puis `recordStock()` avant la frontière.

`operationAdmission()` consomme le résultat OP18 et autorise la release
uniquement si l'outcome guard correspond.

### Effet démontré

Dans le test intégré, la première décision choisit ACTION6 au locus
`{x: 22, y: 20}`. Un retour public inchangé est enregistré comme échec de ce
locus. La proposition suivante choisit `{x: 21, y: 20}`.

Disposition OP18 :

**raccordée au worker reconstruit lorsqu'un prior explicite a été fourni et
revalidé ; acquisition initiale publique de ce prior encore manquante.**

## Chaîne réelle reconstruite OP28 : action publique unique

Pour le seul contrat où l'observation publique expose exactement une action
simple distincte de RESET :

1. l'observation publique est copiée et mesurée ;
2. l'owner OP28 prépare composition, objectif et bundle à la révision courante ;
3. le caller commun vérifie qu'il s'agit de l'unique proposition ;
4. `releaseBundle()` appelle OP28 ;
5. `operationAdmission()` consomme le résultat ;
6. le worker retourne l'action uniquement si la release est autorisée.

Actions admises : ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 et ACTION7.
ACTION6 seule ne déclenche rien sans coordonnées et connaissance adressée.
Plusieurs propositions ne déclenchent rien non plus : elles restent ambiguës.

Disposition OP28 :

**raccordée au worker reconstruit sous condition publique stricte ; campagne
produit live encore absente.**

## Arbitrage et corrélation du retour

Le `NeutralCommonCaller` garde la règle suivante :

- 0 proposition → `none` ;
- 1 proposition → `selected` ;
- plus d'une proposition → `ambiguous`.

Aucune OP n'est appelée durant la simple collecte. L'owner spécialisé autorise
OP18 ou OP28 seulement après la sélection unique.

Pour une décision libérée, le port conserve : propriétaire, proposition,
bundle, action, observation avant action et `needId`. L'observation suivante est
routée :

- une fois au propriétaire sélectionné comme retour `selected` ;
- une fois à chaque autre owner comme preuve `passive` ;
- avec le même `needId` pour le chemin sélectionné.

Cette tranche clôt les dettes C1/C2 suivantes : arbitrage commun, corrélateur
action/retour et consommation FieldStock ayant un effet observable sur la
décision suivante.

## Statut des opérations prioritaires

| OP | Statut exact | Producteur | Consommateur | Contribution démontrée |
| --- | --- | --- | --- | --- |
| OP18 | **raccordée au worker sous prior explicite revalidé** | `FieldStock.propose()` via owner commun | `operationAdmission()`, puis retour `afterStock()/recordStock()` | garde l'action adressée et modifie la décision suivante |
| OP28 | **raccordée au worker sous condition publique stricte** | owner action publique unique | `operationAdmission()` puis worker | garde l'action worker unique |
| OP29 | **assurée par fonctions spécialisées** pour FieldStock/Region ; générique sans propriétaire produit | retour avant/après spécialisé | modèle spécialisé | comparaison invalide ou scelle la suite |
| OP30 | **assurée par fonctions spécialisées** pour FieldStock/Region ; générique `persisted_only` | observation de rewrite/effet | règle, échec ou réfutation spécialisée | propositions futures modifiées |
| OP31 | **appel noyau existant, propriétaire d'objectif produit absent** | postAnalysis générique | aucun propriétaire produit démontré | non démontrée en produit |
| OP03 | **bloquée par producteur générique manquant** | aucune production tri-état générale | admission/plan potentiel | non |
| OP08 | **bloquée ou recouverte familialement** | pas de graphe transversal effect→requires produit | stratégie potentielle | non générique |
| OP12 | **bloquée ou recouverte familialement** | inconnues d'accès spécialisées seulement | acquisition spécialisée | non générique |
| OP26 | **bloquée ou recouverte familialement** | admissions spécialisées, pas de domaine multi-accès commun | garde spécialisée | non générique |
| OP06 | **assurée par fonctions spécialisées** | retour Region/FieldStock | modèle spécialisé | contradiction change la suite |
| OP14 | **admission bridge présente, routage natif absent** | aucun besoin produit dans l'autorité actuelle | garde bridge | non en produit |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin runtime établi | selon audits C3–C6 | non revendiquée |

## Tests et qualification

Tests ajoutés dans cette tranche :

- `tests/v6-public-observation-measurement.test.ts` ;
- `tests/v6-common-campaign-decision-port.test.ts`.

Preuves couvertes :

- observation publique et entités visibles copiées sans fuite par référence ;
- digest et identité déterministes ;
- chemin OP28 conservé par le propriétaire commun ;
- même `needId` à travers besoin OP18, admission et retour sélectionné ;
- retour FieldStock consommé avant la proposition suivante ;
- changement réel du locus choisi après échec observé ;
- ACTION6 sans prior explicite reste inconnue ;
- plusieurs propositions restent ambiguës ;
- aucune autorisation ni OP exécutée en cas d'ambiguïté.

Qualification initiale :

- run `43346432911` ;
- commit `004786bda6372c1cf0189fabac7d443992e80079` ;
- typecheck réussi ;
- **276/276 tests réussis**.

Qualification finale après fusion du canonique `6304bec8` :

- run `43346937074` ;
- commit `4c5060f8ab3523c3ed4cb85ead8441397d985c7c` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- régression TypeScript complète : **280/280 tests réussis** ;
- aucun échec, annulation, test ignoré ou TODO.

Le workflow de qualification est temporaire et supprimé avant intégration
canonique.

## Performance

Les micro-diagnostics précédents restent informatifs uniquement. Aucun nouveau
benchmark artificiel n'est revendiqué pour le propriétaire commun.

Les règles de clôture C7 restent :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- jeux séparés ;
- aucune compensation ;
- phases internes informatives si le global du jeu reste conforme.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer.**

## Besoins encore sans traitement

- hôte produit créant et initialisant le worker agent depuis `main.ts` ;
- campagne SRA live avec dispatch de l'action worker vers
  `BrowserGameRuntime` et retour public réel ;
- acquisition initiale d'un champ adressé produisant honnêtement un prior
  FieldStock depuis la campagne navigateur ;
- candidat Region public qualifié et inscription de Region comme owner du port
  commun sans inventer de `methodRef` ;
- propriétaire d'objectif consommant OP31 ;
- lecture future de la connaissance générique OP30 ;
- snapshot/restauration du propriétaire commun, de la décision en attente et de
  ses mémoires ;
- transport borné des traces/compteurs vers le produit ou le harness ;
- exécution native réelle A/B × STCK/SMLP et mesure officielle < +10 % ;
- perception et planification générales pour les situations à plusieurs actions.

## Prochaine étape concrète

Raccorder le propriétaire commun au produit sans court-circuit :

1. créer l'hôte agent dans `main.ts` ou dans un module produit dédié ;
2. transformer chaque `GameObservation` public en observation worker monotone ;
3. initialiser et conserver une session worker par campagne ;
4. envoyer l'action libérée au dispatch partagé existant ;
5. remettre l'observation post-action réelle au même propriétaire commun ;
6. conserver le mode SRA sans action lorsque le caller retourne `none` ou
   `ambiguous` ;
7. démontrer la boucle sur une campagne browser bornée ;
8. ne produire un prior FieldStock ou un candidat Region qu'après preuve publique
   suffisante.

Aucun Site ne doit être publié avant intégration durable du code correspondant
sur GitHub et vérification GitHub ↔ Site.
