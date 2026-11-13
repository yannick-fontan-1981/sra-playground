# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique réconciliée : `cb0006a80f3552eed9d4e5255feed94c83dc4fa0`
- Branche de travail : `op01-op31-c1-c2-public-observation-op28-20261112`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur à cette consolidation :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Lot 6 et seam Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Réconciliation Lot 5 et chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`

Le présent fichier est l’état courant consolidé. L’ancien suivi intégral a été
conservé sous son blob Git original afin de ne perdre aucune preuve, mesure ou
décision antérieure.

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

## Nouveaux composants runtime pertinents

### Transport et worker Lot 6

- `src/runtime/browser-games.ts` et `game-worker.ts` : transport jeu et retour
  public réel ;
- `src/runtime/contracts.ts` : protocole public `AgentObservation` / `AgentAction` ;
- `src/runtime/v6-agent-worker-core.ts` : budget, annulation, séquence et validation ;
- `src/runtime/v6-agent-worker.ts` : enveloppe Worker reconstruite ;
- `src/agent-product-dispatch.ts` : dispatch produit manuel et retour du jeu.

### Matériaux adressés et FieldStock Lot 5

- `src/runtime/observed-addressed-material-runtime.ts` : propriétaire de
  rétention, frontière, revalidation et stock courant ;
- `src/logos-engine/addressed-field-*.ts` : acquisition, réponse, garde,
  rétention et fit adressés ;
- `src/logos-engine/field-stock.ts` : producteur borné de question, plan,
  préservation, actions coordonnées et bundle OP18 ;
- `src/logos-engine/linked-preparation.ts` et
  `observed-object-binding.ts` : liaisons publiques et préparation.

### Tranche Worker publique ajoutée

- `src/runtime/v6-browser-agent-observation.ts` : adaptation stricte
  `GameObservation → AgentObservation` sans état caché ;
- `src/logos-engine/v6-public-single-action-port.ts` : producteur OP28 limité au
  seul cas où une action simple non-RESET est publiquement unique et complète.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **instrumenté sur deux producteurs réels de reconstruction** | FieldStock OP18 et action publique unique OP28 distinguent besoin, non-besoin, appel et consommation | raccorder l’hôte navigateur commun et le retour corrélé |
| C2 | **OP18 et OP28 consommées comme gardes** | résultat lu par `operationAdmission`, release autorisée/refusée ; retours spécialisés FieldStock/Region disponibles | démontrer la décision suivante et attribuer OP31 à un propriétaire réel |
| C3 | **calculs et recouvrements qualifiés** | OP03/08/12/14/26 couvertes au niveau noyau ; spécialisations donneuses identifiées | appeler uniquement lorsqu’un producteur runtime réel établit le besoin |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur réels |
| C5 | **audit complet, retours spécialisés disponibles** | FieldStock et Region couvrent des besoins OP06/29/30 avec effet futur | préserver ces spécialisations sans duplication générique |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccordement sans preuve de blocage/reprise/variante |
| C7 | **ouvert** | garde-fous, diagnostics ciblés et corpus candidat disponibles | runners natifs qualifiés, manifeste complet et STCK/SMLP séparés < +10 % |

## Chaîne réelle reconstruite OP18 : FieldStock

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

### Appel, résultat et consommation

`releaseBundle()` émet le besoin `exploration-question`, appelle OP18 et reçoit
la référence de la composition lorsque le contrat est cohérent.
`operationAdmission()` consomme ce résultat et autorise la release uniquement si
l’outcome guard correspond.

### Effet

Les actions du plan FieldStock ne sont libérées que lorsque le bundle est à la
révision courante et que le résultat OP18 sélectionne la composition attendue.

Disposition OP18 : **raccordable maintenant dans le runtime Lot 5 reconstruit et
consommée comme garde ; hôte Worker/browser commun encore manquant.**

### Retour spécialisé

`FieldStock.before()`, `after()` et `record()` revalident le stock avant action,
comparent le retour, scellent le préfixe en cas d’inconnu ou de divergence et
confirment, enregistrent ou réfutent les règles observées. Cette chaîne assure
des besoins équivalents à OP29/OP30 pour cette famille, sans ajouter d’appels
génériques redondants.

## Chaîne bornée OP28 : action publique unique

Pour le seul contrat où l’observation publique expose exactement une action
simple distincte hors RESET :

1. `v6-browser-agent-observation.ts` produit une observation publique validée ;
2. `preparePublicSingleActionDecision()` construit composition, objectif et
   bundle OP28 à la révision courante ;
3. `releaseBundle()` appelle OP28 ;
4. `operationAdmission()` consomme le résultat ;
5. `AgentWorkerCore` retourne l’action uniquement si la release est autorisée.

Actions admises : ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 et ACTION7.
ACTION6 seule ne déclenche rien car ses coordonnées restent inconnues. Plusieurs
choix publics ne déclenchent rien non plus : le port ne prétend pas planifier.

Disposition OP28 : **raccordable maintenant sous condition stricte dans le
worker reconstruit ; pas encore exécutée par `main.ts` dans une campagne live.**

## Statut des opérations prioritaires

| OP | Statut exact | Producteur | Consommateur | Contribution démontrée |
| --- | --- | --- | --- | --- |
| OP18 | **raccordable maintenant** | `FieldStock.propose()` après revalidation courante | `operationAdmission()` | garde la release des actions adressées |
| OP28 | **raccordable maintenant sous condition stricte** | `preparePublicSingleActionDecision()` | `operationAdmission()` puis `AgentWorkerCore` | garde l’action worker unique |
| OP29 | **déjà assuré par fonctions spécialisées** pour FieldStock/Region ; générique sans consommateur produit | retour avant/après spécialisé | modèle spécialisé | comparaison peut invalider ou sceller la suite |
| OP30 | **déjà assuré par fonctions spécialisées** pour FieldStock/Region ; générique `persisted_only` | observation de rewrite/effet | règle, échec ou réfutation spécialisée | propositions futures modifiées |
| OP31 | **appel existant sans consommateur démontré** | postAnalysis générique disponible | aucun propriétaire d’objectif produit | non démontrée |
| OP03 | **bloqué par producteur générique manquant** | aucune production tri-état générale depuis le produit | admission/plan potentiel | non |
| OP08 | **bloqué ou recouvert familialement** | pas de graphe transversal effect→requires produit | stratégie potentielle | non générique |
| OP12 | **bloqué ou recouvert familialement** | inconnues d’accès spécialisées seulement | acquisition spécialisée | non générique |
| OP26 | **bloqué ou recouvert familialement** | admissions spécialisées, pas de domaine multi-accès commun | garde spécialisée | non générique |
| OP06 | **déjà assuré par fonctions spécialisées** | retour Region/FieldStock | modèle spécialisé | contradiction change la suite |
| OP14 | **admission bridge présente, routage natif absent** | aucun besoin produit dans l’autorité actuelle | garde bridge | non en produit |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin runtime établi | selon audits C3–C6 | non revendiquée |

## Tests et qualification

Nouveaux tests de cette reprise :

- `tests/v6-browser-agent-observation.test.ts` ;
- `tests/v6-public-single-action-port.test.ts` ;
- `tests/v6-public-observation-op28-chain.test.ts` ;
- extension de `tests/v6-agent-worker.test.ts` ;
- `tests/op01-op31-field-stock-op18-trace.test.ts`.

Preuves couvertes :

- observation publique copiée sans fuite par référence ;
- besoin OP28 présent/absent ;
- ACTION6 inconnue conservée sans coordonnées inventées ;
- OP28 consommée par la garde ;
- révision modifiée → nouvelle identité ou rejet stale ;
- `GameObservation → Worker → OP28 → AgentAction` ;
- `FieldStock → besoin OP18 → opération → consommation → release` ;
- action adressée absente → aucun proposal et aucun appel OP ;
- ancien bundle FieldStock invalidé après changement de révision.

Qualification GitHub Actions sur la branche réconciliée :

- run : `43342264179` ;
- commit qualifié : `6bf46db33eb238c432ace2179af43af7c95688c9` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **269/269 tests réussis**.

Le workflow temporaire de qualification a été supprimé après le run et ne doit
pas entrer dans la branche canonique.

## Performance

Micro-diagnostic ciblé de la tranche OP28, trace désactivée, 21 rounds :

- besoin absent `[ACTION1, ACTION2]` : environ `0,080 µs/décision` ;
- action unique avec OP28 : environ `3,3–3,6 µs/décision`.

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

- hôte navigateur commun créant et initialisant le worker agent ;
- arbitrage entre propositions spécialisées sans fusion artificielle de leurs
  autorités ;
- dispatch de l’action worker vers `BrowserGameRuntime` ;
- corrélateur action/retour conservant bundle, proposition et `needId` ;
- routage du retour vers `FieldStock.after()/record()`, Region ou le consommateur
  générique exact ;
- propriétaire d’objectif consommant OP31 ;
- lecture future de la connaissance générique OP30 ;
- snapshot/restauration du propriétaire commun et de ses mémoires ;
- transport borné des traces/compteurs vers le produit ou le harness ;
- perception et planification générales pour les situations à plusieurs actions.

## Prochaine étape concrète

Construire un propriétaire commun de campagne qui :

1. reçoit l’observation publique du jeu ;
2. alimente le runtime spécialisé pertinent ;
3. collecte les propositions sans changer leur autorité ;
4. sélectionne une proposition ou conserve l’ambiguïté ;
5. transmet bundle et action au worker/dispatch ;
6. corrèle le retour à la proposition et au même `needId` ;
7. route le retour vers `after()/record()` ou le consommateur générique exact ;
8. montre l’effet sur la proposition ou décision suivante.

Aucun Site ne doit être publié avant intégration durable du code correspondant
sur GitHub et vérification GitHub ↔ Site.
