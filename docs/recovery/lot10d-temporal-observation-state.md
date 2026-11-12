# Lot 10D — état TemporalSelection minimal d'observation

Date : 2026-11-12

## But

Assembler les trois contrats reconstruits précédemment dans un état descriptif, borné et restaurable, sans recréer la politique historique perdue.

Fichier :

`src/logos-engine/v6-temporal-observation-state.ts`

Tests :

`tests/v6-temporal-observation-state.test.ts`

## Contenu autorisé

L'état conserve uniquement :

- l'identité épisode / époque / observation / révision ;
- l'identité Source du workflow ;
- le domaine d'alternatives et leurs preuves ;
- les exigences et références à préserver ;
- les retours déjà qualifiés par le contrat d'identité ;
- les frontières de retour déjà consommées ;
- le contrat de réutilisation mémoire courant ;
- les références de preuves mémoire associées.

Il ne contient pas :

- de score ;
- de priorité ;
- de candidat sélectionné ;
- de proposition d'action ;
- de commande ;
- d'autorité ACT.

`actAuthorized` reste littéralement `false`.

## Règles de qualification

### Retour

Un retour ne peut être attaché que si :

- son contrat d'identité complet est qualifié ;
- le destinataire est le workflow courant ;
- la révision de comparaison correspond à l'observation courante.

La même frontière mesurée est idempotente et n'est pas dupliquée.

La capacité est bornée à 32 retours qualifiés.

### Mémoire

Une mémoire ne peut être attachée que si le contrat de réutilisation est revalidé sur l'observation courante.

La restauration contrôle structurellement :

- la même observation ;
- les domaines rappelés et courants non vides et bornés ;
- l'absence de références dupliquées ;
- la correspondance exacte entre les références de preuves de l'état et celles du contrat ;
- la présence d'une empreinte pour chaque preuve.

La restauration ne revalide pas l'activité sémantique des claims en l'absence des claims eux-mêmes. Cette revalidation reste obligatoire au moment de la réutilisation.

### Consommation

Un retour ne peut être marqué consommé que s'il appartient déjà aux retours qualifiés de l'état.

La seconde consommation de la même frontière est idempotente.

### Snapshot / restauration

Le snapshot est une copie détachée.

La restauration revalide :

- la version du schéma ;
- l'enveloppe Source ;
- les retours ;
- les doublons ;
- la mémoire structurale ;
- les identités consommées.

Une identité consommée sans frontière qualifiée correspondante est refusée.

## Tests exécutés

Qualification ciblée du nouvel état :

`node --experimental-strip-types --test tests/v6-temporal-observation-state.test.ts`

Résultat final :

- **11 tests**
- **11 réussis**
- **0 échec**

Le passage initial comptait 9 tests ; deux contrôles de restauration mémoire ont été ajoutés avant clôture.

Typecheck des quatre sources Temporal reconstruites :

`tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --allowImportingTsExtensions --strict --skipLibCheck ...`

Résultat : **réussi**.

Un premier typecheck incluant le fichier de test a échoué uniquement faute de déclarations `@types/node` pour `node:test` et `node:assert/strict` dans le checkout local minimal. Les sources elles-mêmes passent le typecheck strict.

## Qualification cumulée

Les trois contrats précédents ont été qualifiés à **23/23 tests**.

Le nouvel état ajoute **11/11 tests**.

Total des tests ciblés TemporalSelection reconstruits exécutés jusqu'à ce jalon : **34 réussis, 0 échec fonctionnel**.

Ce total n'est pas une preuve de parité avec Site 109 et ne remplace pas les campagnes runtime ou performance.

## Prochaine étape

Construire le premier **adaptateur de consommation descriptif** entre cet état et `projectTemporalSelectionDecision`.

Cet adaptateur pourra :

- exposer le domaine actuel ;
- signaler si un retour est déjà consommé ;
- fournir les preuves courantes et historiques déjà validées.

Il ne devra toujours pas inventer la politique qui choisit un `selectedRef`.

La sélection restera fournie par une autorité Source/DRM externe jusqu'à ce qu'un donneur durable de la politique historique soit retrouvé ou qu'une nouvelle politique explicitement conçue soit spécifiée.
