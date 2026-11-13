# Lot 10D - port de décision TemporalSelection passif

Date : 2026-11-12

Branche : `recovery/lot10d-temporal-selection-rebased-20261112`

## But

Fournir un `AgentDecisionPort` compatible avec le worker V6 qui puisse recevoir une décision TemporalSelection déjà produite et attribuée, sans analyser l'image, fabriquer le domaine, choisir un candidat ni convertir la sélection en action.

Fichiers :

- `src/runtime/v6-temporal-decision-port.ts`
- `tests/v6-temporal-decision-port.test.ts`

## Enveloppe explicitement fournie

Le port reçoit une `TemporalDecisionPortEnvelope` versionnée qui contient :

- l'identité de session publique ;
- la séquence de l'observation ;
- l'empreinte exacte de l'observation publique ;
- l'identité épisode / observation / révision TemporalSelection ;
- l'empreinte du reçu de décision ;
- le `TemporalObservationState` ;
- la `TemporalSourceAuthority` ;
- le `TemporalSourceDecisionReceipt` ;
- éventuellement une frontière de retour déjà qualifiée ;
- une raison explicite ;
- `actAuthorization: null`.

L'enveloppe ne transporte aucune action et aucune autorité ACT.

## Liaison à l'observation publique

`fingerprintAgentObservation()` calcule une empreinte FNV-1a 32 bits sur :

- les champs publics du protocole worker ;
- les actions disponibles ;
- l'état et la progression ;
- les 4096 indices de palette publics de l'image 64 x 64.

Cette empreinte sert uniquement à détecter une divergence de transport entre l'enveloppe et l'observation consommée.

Elle n'est pas :

- une analyse sémantique des pixels ;
- une signature cryptographique ;
- une preuve d'autorité ;
- une politique de perception.

## Comportement fail-closed

Le port retourne `undefined` lorsque :

- aucune enveloppe exacte n'est disponible ;
- la session ne correspond pas ;
- l'observation publique diffère ;
- le binding TemporalSelection a été altéré ;
- le reçu est périmé ou incohérent ;
- le domaine des alternatives diverge ;
- l'état restauré ou ses preuves sont invalides ;
- le budget est invalide ou le signal est interrompu ;
- la sélection externe est refusée ;
- la sélection est acceptée mais aucun contrat ACT séparé n'existe.

Même après une projection acceptée :

`decide(...) -> undefined`

Le résultat est enregistré comme `action_withheld` et `actionReleased: false`.

## File bornée et identité

- maximum : 32 enveloppes en attente ;
- une seule enveloppe par couple session / séquence ;
- les enveloppes antérieures à l'observation courante sont supprimées ;
- une enveloppe future exacte reste en attente ;
- `initialize()` réinitialise la session ;
- `cancel()` supprime les enveloppes et la dernière projection.

## Trace

Le port utilise une capability distincte :

`temporal-decision-port`

Elle reste séparée :

- des OP01-OP31 ;
- de la capability `temporal-selection` du bridge ;
- de toute future autorité ACT.

Le mode `counters` produit les compteurs sans conserver les événements détaillés.

## Worker

Le port est compatible avec `AgentWorkerCore` par injection.

Il ne remplace pas le port public par défaut :

`PendingPerceptionDecisionPort`

Le worker public conserve donc la révision :

`reconstruction-pending-perception`

et ne produit toujours aucune action par défaut.

## Qualification GitHub CI

Commit de code qualifié :

`f303174c1104d1f8aa61ade8e628e4b6636d9caa`

Run GitHub Actions :

`43345997522`

Résultat :

- **145 tests** ;
- **145 réussis** ;
- **0 échec** ;
- 0 annulé, ignoré ou todo ;
- typecheck strict réussi, y compris `v6-temporal-decision-port.ts`.

Les 15 nouveaux tests couvrent notamment :

- empreinte publique déterministe ;
- enveloppe absente ;
- sélection acceptée mais action retenue ;
- refus sans fallback ;
- observation différente ;
- binding altéré ;
- reçu périmé ;
- domaine divergent ;
- preuve restaurée invalide ;
- file bornée et nettoyage stale ;
- refus d'une autorité ACT embarquée ;
- consommation exacte d'une preuve ;
- trace `counters` ;
- intégration `AgentWorkerCore` ;
- annulation de session.

## Limites

Le port ne reconstruit pas :

- le producteur public du domaine TemporalSelection ;
- la politique historique de sélection ;
- une liaison candidat -> `AgentAction` ;
- une autorité ACT ;
- une campagne comportementale réelle ;
- les runners officiels STCK/SMLP.

## Prochaine étape

Auditer les donneurs durables V5/V6 concernant :

1. l'identité d'une autorité ACT séparée ;
2. la preuve qu'une proposition sélectionnée peut être transformée en action ;
3. la liaison exacte entre candidat, cible et `AgentAction` disponible ;
4. les règles de fraîcheur, de consommation unique et de révocation.

Si ces éléments ne sont pas récupérables, documenter explicitement le manque avant de concevoir un nouveau contrat. La seule sélection TemporalSelection ne doit jamais devenir implicitement une autorisation d'agir.

## Performance

Statut : **fonctionnellement qualifié, performance officielle à confirmer**.

Les durées GitHub CI ne constituent pas une mesure STCK/SMLP officielle.
