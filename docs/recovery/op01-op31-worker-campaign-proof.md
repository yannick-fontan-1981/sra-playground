# OP01–OP31 — preuve Worker → Logos avec producteur symbolique explicite

## Portée

Cette étape exploite le worker et le helper de campagne restaurés sans prétendre
avoir restauré la perception SRA.

Nouveaux éléments **test-only** :
- `tests/helpers/v6-logos-decision-port.ts` ;
- `tests/v6-worker-logos-campaign.test.ts`.

Aucun fichier produit n'importe le noyau Logos.

## Contrat du bridge de test

Le bridge exige qu'un producteur externe fournisse explicitement :

- un `CompositionBundle` ;
- le `SymbolicRecord` correspondant ;
- une `AgentAction` déjà liée au bundle.

Le bridge ne :
- perçoit pas les pixels ;
- n'invente pas de composition ;
- ne choisit pas d'objectif ;
- ne synthétise pas de bundle ;
- ne classe pas plusieurs propositions.

Il dérive uniquement l'identité observationnelle publique
(session, niveau, séquence), appelle `releaseBundle()`, puis retourne l'action
si la garde de release l'autorise.

## Preuves

### OP18

Chaîne testée :

**producteur symbolique explicite → bundle OP18 → AgentWorkerCore →
nativeAuthority.releaseBundle → executeOperation(OP18) →
operationAdmission → AgentAction → campagne → WIN**

La trace conserve un même `needId` sur :
- need ;
- operation ;
- consumption.

### OP28

Même chaîne avec :
- bundle déjà admis ;
- actions non vides ;
- outcome guard sur l'identité du bundle.

La consommation `guard` OP28 est observée avant dispatch.

### Absence de producteur

Si le producteur symbolique retourne `undefined` :
- aucune action n'est envoyée ;
- le worker s'arrête sur budget ;
- aucune perception n'est inventée.

### OP14

Même lorsqu'un fixture test fournit un bundle OP14 :
- l'autorité native le classe `not_required` ;
- aucune action n'est exécutée.

Cela confirme la disposition de reachability OP14.

### Cohérence action/bundle

Le bridge de test refuse une action qui n'appartient pas au bundle fourni.

## Tests

Typecheck strict :
- noyau Logos ;
- contracts worker ;
- `v6-agent-worker-core.ts` ;
- bridge Logos test-only.

Résultat : **PASS**.

Suite ciblée OP + worker campagne :
**60/60 tests passent**.

## Limite principale

Le producteur symbolique reste absent du produit.

Le worker produit par défaut :
`reconstruction-pending-perception`

et ne décide aucune action.

Le delta public et Region peuvent produire des observations structurées, mais
la production générale des compositions, objectifs, besoins et bundles Logos
n'est pas encore restaurée.

## Statut

C1/C2 disposent maintenant d'une preuve d'intégration **au niveau du contrat Worker**
lorsqu'un producteur symbolique explicite est fourni.

Cela ne constitue pas encore un raccord produit/browser réel.

Performance :
**fonctionnellement qualifié, performance officielle à confirmer**.
