# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique au début de cette étape :
  `87a538a1c776fb974a1767f30fea735aac28ded9`
- Baseline canonique relue avant intégration :
  `6304bec8c99a05b0023692f8fe7f432394acaa11`
- Branche de travail : `op01-op31-common-campaign-owner-20261112`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur à la première consolidation :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Lot 6 et seam Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Réconciliation Lot 5 et chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun et retour corrélé :
  `docs/recovery/op01-op31-common-campaign-owner-20261112.md`

Le présent fichier est l’état courant consolidé. L’ancien suivi intégral a été
conservé dans Git afin de ne perdre aucune preuve, mesure ou décision antérieure.

## Règle de qualification

Une utilisation réelle suit la chaîne :

**besoin identifié → données produites → appel justifié → résultat → consommateur → effet sur la décision.**

Les niveaux restent distincts :

1. calcul correct ;
2. données produites par le chemin concerné ;
3. appel observé ;
4. résultat consommé ;
5. contribution démontrée ;
6. coût qualifié.

Un compteur d’appels, un import ou une trace sans consommateur ne suffisent pas.
Aucune OP n’est ajoutée uniquement pour atteindre 31 appels.

## Provenance et limites historiques

Le fichier actuel `src/runtime/v6-agent-worker.ts` est une reconstruction. La
source officielle historique du worker Site 109 et le runtime/campaign complet
historiquement utilisé n’ont pas été retrouvés. Aucune identité ou parité avec
cet ancien worker n’est revendiquée.

Les composants Lot 5 `FieldStock` et matériaux adressés sont également une
reconstruction qualifiée à partir des sources donneuses et des contrats publics.
Ils ne prouvent pas une parité binaire avec l’ancien Site 109.

Le benchmark officiel historique n’est pas restauré sous une forme permettant
de qualifier les quatre runners natifs A/STCK, A/SMLP, B/STCK et B/SMLP. Les
diagnostics synthétiques ou ciblés restent informatifs uniquement.

Statut performance global :

**fonctionnellement qualifié, performance officielle à confirmer**.

## Composants runtime pertinents

### Transport, dispatch et Worker

- `src/runtime/browser-games.ts` et `game-worker.ts` : transport jeu et retour
  public réel ;
- `src/runtime/contracts.ts` : protocole public `AgentObservation` / `AgentAction` ;
- `src/runtime/v6-agent-worker-core.ts` : budget, annulation, séquence et validation ;
- `src/runtime/v6-agent-worker.ts` : enveloppe Worker reconstruite ;
- `src/agent-product-dispatch.ts` : dispatch produit et retour du jeu ;
- `src/runtime/v6-browser-agent-observation.ts` : adaptation stricte
  `GameObservation → AgentObservation` sans état caché.

### Matériaux adressés et FieldStock

- `src/runtime/observed-addressed-material-runtime.ts` : propriétaire de
  rétention, frontière, revalidation et stock courant ;
- `src/logos-engine/addressed-field-*.ts` : acquisition, réponse, garde,
  rétention et fit adressés ;
- `src/logos-engine/field-stock.ts` : producteur borné de question, plan,
  préservation, actions coordonnées et bundle OP18 ;
- `src/logos-engine/linked-preparation.ts` et
  `observed-object-binding.ts` : liaisons publiques et préparation.

### Appels Logos et campagne commune

- `src/logos-engine/v6-public-single-action-port.ts` : producteur OP28 limité au
  seul cas où une action simple non-RESET est publiquement unique et complète ;
- `src/logos-engine/v6-neutral-common-caller.ts` : collecte neutre,
  ambiguïté, routage et déduplication ;
- `src/logos-engine/v6-common-campaign-owner.ts` : propriété de la décision,
  autorisation Logos, attente et corrélation du retour ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` : exposition du
  fallback OP28 au caller commun ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` : exposition de FieldStock
  OP18 et retour spécialisé au caller commun.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **propriétaire commun fonctionnel dans la bibliothèque runtime** | collecte bornée, ambiguïté conservée, release OP18/OP28, action en attente, retour corrélé au même `needId` | instancier cette campagne dans l’hôte produit/browser |
| C2 | **OP18 démontrée jusqu’à la décision suivante ; OP28 jusqu’au retour corrélé** | FieldStock compare et enregistre le retour puis produit une action suivante différente | raccorder le dispatch produit réel et attribuer OP31 à un propriétaire réel |
| C3 | **calculs et recouvrements qualifiés** | OP03/08/12/14/26 couvertes au niveau noyau ; spécialisations donneuses identifiées | appeler uniquement lorsqu’un producteur runtime réel établit le besoin |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur réels |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent des besoins OP06/29/30 avec effet futur | donner à Region un vrai bundle/action Logos avant enregistrement commun |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccordement sans preuve de blocage/reprise/variante |
| C7 | **ouvert** | garde-fous, diagnostics ciblés et corpus/runners candidats disponibles | runners natifs qualifiés, manifeste complet et STCK/SMLP séparés < +10 % |

## Chaîne complète reconstruite OP18 : FieldStock

### Besoin identifié

Un stock adressé a été retenu puis revalidé dans la scène courante. Une demande
typée manque dans une zone officielle et l’action adressée ACTION6 est
publiquement disponible.

### Données produites

`FieldStock.propose()` produit :

- une question ouverte mesurable ;
- une composition non observée ;
- un plan borné à 16 pas ;
- des actions ACTION6 avec coordonnées mesurées ;
- des obligations de préservation ;
- les faits et preuves de scène ;
- un `bundle_template.operation_key = OP18` avec outcome guard.

### Appel et garde

`FieldStockCallerOwnerAdapter` revalide d’abord la scène avec `beforeStock()`.
Le propriétaire commun conserve la proposition uniquement si elle est la seule
proposition du domaine courant.

`releaseBundle()` émet le besoin `exploration-question`, appelle OP18 et reçoit
la référence de la composition lorsque le contrat est cohérent.
`operationAdmission()` consomme ce résultat et autorise la release uniquement si
l’outcome guard correspond.

### Retour et effet sur la décision suivante

Le propriétaire commun conserve session, propriétaire, proposition, bundle,
action et `needId` jusqu’au retour.

Le retour est routé uniquement à FieldStock :

- `afterStock()` compare le résultat attendu ;
- `recordStock()` confirme, apprend, enregistre un échec ou réfute ;
- un retour déjà acquis est dédupliqué ;
- un retour avec un autre besoin ou une révision non croissante est rejeté.

Scénario démontré :

1. matériau de type 2 en `(1,1)` ;
2. première action ACTION6 vers `(3,1)` ;
3. retour confirmé et déplacement enregistré ;
4. prochaine proposition ACTION6 vers `(4,1)`.

Disposition OP18 : **chaîne complète démontrée jusqu’au consommateur spécialisé
et à la décision suivante dans le runtime reconstruit.**

## Chaîne commune OP28 : action publique unique

Pour le seul contrat où l’observation publique expose exactement une action
simple distincte hors RESET :

1. l’adaptateur public produit une observation validée ;
2. l’adaptateur de caller construit le bundle OP28 ;
3. le propriétaire commun vérifie session, révision et action disponible ;
4. `releaseBundle()` appelle OP28 ;
5. `operationAdmission()` consomme le résultat ;
6. l’action reste en attente jusqu’au retour portant le même `needId` ;
7. le retour est routé au propriétaire OP28 exact.

Actions admises : ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 et ACTION7.
ACTION6 seule ne déclenche rien car ses coordonnées restent inconnues. Plusieurs
choix publics restent explicitement ambigus et ne déclenchent aucune OP.

Disposition OP28 : **chaîne commune démontrée sous condition stricte ; aucune
perception ou planification générale n’est revendiquée.**

## Neutralité et ambiguïté

`CommonCampaignOwner` ne choisit pas entre plusieurs propriétaires :

- zéro proposition → `none` ;
- une proposition → validation puis autorité Logos ;
- plusieurs propositions → `ambiguous` ;
- bundle refusé → `blocked` ;
- action libérée → `action`, puis `pending` jusqu’au retour.

Aucune OP n’est appelée dans les cas `none` ou `ambiguous`.

Le caller neutre conserve deux contrats :

- `collect()/select()` : propositions détachées et copiées ;
- `collectOwned()/selectOwned()` : transfert explicite d’une proposition neuve
  au propriétaire commun.

Le second évite de recopier plusieurs fois bundle, état symbolique et
corrélation. Les résultats publics n’exposent que l’identité de proposition.

## Region

Region possède déjà une boucle spécialisée avec acquisition passive ou
sélectionnée, déduplication, snapshot et effet sur les propositions futures.

Region n’est pas encore enregistré dans le propriétaire commun, car son
adaptateur actuel ne produit pas encore le contrat physique complet
`AgentAction + CompositionBundle + état symbolique + identity` attendu par
`releaseBundle()`.

Aucun bundle artificiel ni autorité implicite n’est ajouté pour contourner cette
absence.

## Statut des opérations prioritaires

| OP | Statut exact | Producteur | Consommateur | Contribution démontrée |
| --- | --- | --- | --- | --- |
| OP18 | **chaîne complète démontrée pour FieldStock** | `FieldStock.propose()` après revalidation courante | `operationAdmission()`, puis `afterStock()/recordStock()` | garde l’action et modifie la proposition suivante |
| OP28 | **chaîne commune démontrée sous condition stricte** | adaptateur action publique unique | `operationAdmission()`, puis propriétaire OP28 | garde l’action et corrèle son retour |
| OP29 | **assuré par fonctions spécialisées** pour FieldStock/Region ; générique sans consommateur produit | retour avant/après spécialisé | modèle spécialisé | comparaison peut invalider ou sceller la suite |
| OP30 | **assuré par fonctions spécialisées** pour FieldStock/Region ; générique `persisted_only` | observation de rewrite/effet | règle, échec ou réfutation spécialisée | propositions futures modifiées |
| OP31 | **appel existant sans consommateur démontré** | postAnalysis générique disponible | aucun propriétaire d’objectif produit | non démontrée |
| OP03 | **bloqué par producteur générique manquant** | aucune production tri-état générale depuis le produit | admission/plan potentiel | non |
| OP08 | **bloqué ou recouvert familialement** | pas de graphe transversal effect→requires produit | stratégie potentielle | non générique |
| OP12 | **bloqué ou recouvert familialement** | inconnues d’accès spécialisées seulement | acquisition spécialisée | non générique |
| OP26 | **bloqué ou recouvert familialement** | admissions spécialisées, pas de domaine multi-accès commun | garde spécialisée | non générique |
| OP06 | **déjà assuré par fonctions spécialisées** | retour Region/FieldStock | modèle spécialisé | contradiction change la suite |
| OP14 | **admission bridge présente, routage natif absent** | aucun besoin produit dans l’autorité actuelle | garde bridge | non en produit |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin runtime établi | selon audits C3–C6 | non revendiquée |

## Tests et qualification

Nouveaux tests de cette étape :

- `tests/v6-common-campaign-owner.test.ts` ;
- `tests/v6-field-stock-common-campaign.test.ts` ;
- `tests/v6-neutral-common-caller-owned.test.ts`.

Preuves couvertes :

- aucune proposition → aucune OP ;
- une proposition → besoin, opération, consommation et action ;
- plusieurs propositions → ambiguïté sans classement ni appel ;
- même `needId` de la release au retour ;
- une seule action en attente par session ;
- bundle refusé → aucune action en attente ;
- retour exact dédupliqué ;
- retour contradictoire rejeté ;
- FieldStock `before()` avant release ;
- FieldStock `after()/record()` après retour ;
- action adressée absente → aucun proposal et aucun appel ;
- époque ou révision incohérente → rejet ;
- retour FieldStock confirmé → prochaine action différente ;
- transfert propriétaire sans fuite du payload dans le résultat public.

Qualification GitHub Actions :

- run : `43346240327` ;
- job : `131626183883` ;
- commit qualifié : `4392f59907e30a1769e9f7305d3e2bfbba4c0d8c` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **282/282 tests réussis** ;
- diagnostic de coût : réussi.

Le workflow temporaire est supprimé avant intégration.

## Performance

La première version détachée du transport commun mesurait environ :

- release OP28 directe : `4,07 µs/cycle` ;
- campagne commune avec retour : `61,90 µs/cycle`.

Après transfert propriétaire unique :

- aucun besoin direct : `0,343 µs/cycle` ;
- aucun besoin via campagne : `0,289 µs/cycle` ;
- release OP28 directe : `3,467 µs/cycle` ;
- campagne commune avec retour corrélé : `9,381 µs/cycle` ;
- surcoût absolu restant : `5,914 µs/cycle` ;
- réduction du coût du chemin commun : environ `84,8 %`.

Cette mesure comprend propriété, état en attente, acheminement du retour et
déduplication, alors que la référence directe ne fait que préparer et libérer
l’action.

Ce diagnostic ne remplace pas le benchmark officiel. Les règles de clôture C7
restent :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- jeux séparés ;
- aucune compensation ;
- phases internes informatives si le global du jeu reste conforme.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer**.

## Besoins encore sans traitement

- hôte navigateur commun créant la campagne et les contextes propriétaires ;
- dispatch réel de l’action autorisée vers `BrowserGameRuntime` ;
- conservation du `needId` à travers `AgentProductDispatch` ;
- acquisition du retour avant demande de la décision suivante ;
- contrat bundle/action Logos pour Region ;
- acquisition passive orchestrée pour des propriétaires non sélectionnés ;
- snapshot/restauration des décisions communes en attente ;
- propriétaire d’objectif consommant OP31 ;
- lecture future de la connaissance générique OP30 ;
- transport borné des traces/compteurs vers le produit ou le harness ;
- perception et planification générales pour les situations à plusieurs actions ;
- quatre runners natifs qualifiés et mesures STCK/SMLP officielles.

## Prochaine étape concrète

Construire l’hôte produit/browser qui :

1. reçoit chaque `GameObservation` ;
2. construit l’observation agent et les observations spécialisées ;
3. alimente seulement les propriétaires applicables ;
4. conserve l’ambiguïté plutôt que choisir arbitrairement ;
5. dispatch l’action autorisée ;
6. conserve `needId`, propriétaire et proposition pendant le dispatch ;
7. acquiert le retour avant la prochaine demande de décision ;
8. présente ensuite la nouvelle observation.

Aucun Site ne doit être publié avant intégration durable du code correspondant
sur GitHub et vérification GitHub ↔ Site.
