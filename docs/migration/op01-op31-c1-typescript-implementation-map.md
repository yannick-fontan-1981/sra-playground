# C1 — carte d'implantation TypeScript prête à appliquer

Référence stable : `docs/migration/op01-op31-verification-plan.md`

Ce document traduit le contrat C1 en points d'implantation précis pour le
checkout attendu `src/logos-engine/v6-*`. Il ne modifie pas le runtime tant
que ces fichiers ne sont pas disponibles.

## 1. Nouveau composant minimal recommandé

Fichier proposé :
`src/logos-engine/v6-operation-trace.ts`

Responsabilité :
- recevoir des événements déjà produits par le runtime ;
- ne jamais déclencher une OP ;
- ne jamais décider ;
- ne jamais lire le graphe complet ;
- conserver uniquement compteurs + petits résumés en mode normal ;
- détailler les références seulement en mode audit.

Interface minimale :

```ts
type OperationTraceMode =
  | "executed"
  | "cache_reused"
  | "not_required"
  | "blocked";

type Completeness = "complete" | "partial" | "unknown" | "not_produced";

interface OperationNeedEvent {
  kind: "need";
  needId: string;
  needKind: string;
  reason: string;
  producer: string;
  episodeId: string;
  levelEpoch: string | number;
  observationId: string;
  observationRevision: number;
  focusRef?: string;
  objectiveRef?: string;
  strategyRef?: string;
  dependencyRefs: string[];
  completeness: Completeness;
}

interface OperationCallEvent {
  kind: "operation";
  needId: string;
  op: string;
  caller: string;
  mode: OperationTraceMode;
  reason: string;
  inputRefs: string[];
  dependencyRevisions: Record<string, string | number>;
  resultStatus: Completeness;
  resultSummary?: unknown;
  prepareUs?: number;
  executeUs?: number;
  traceBytes?: number;
}

interface OperationConsumptionEvent {
  kind: "consumption";
  needId: string;
  op: string;
  consumer: string;
  decisionRef: string;
  effectKind:
    | "filter"
    | "guard"
    | "prioritize"
    | "maintain"
    | "revise"
    | "stop"
    | "information_only"
    | "persisted_only";
  semanticEffect: boolean | "unknown";
  reason: string;
}
```

Le nom exact et la forme peuvent suivre les conventions du checkout réel.
Le contrat sémantique ci-dessus doit rester inchangé.

## 2. `v6-operations.ts`

Point d'instrumentation :
`execute(op, state)`.

À faire :
- mesurer uniquement le temps du calcul pur ;
- enregistrer `executed` après l'appel si un `needId` est transmis par le
  contexte d'appel ;
- ne pas synthétiser un besoin depuis `op` ;
- ne pas sérialiser `state` complet ;
- résumer le résultat par statut, cardinalité et références principales.

À ne pas faire :
- aucun balayage des OP01..OP31 ;
- aucune émission `need` depuis `execute` ;
- aucun cache global sans dépendances explicites.

## 3. `v6-composition-engine.ts`

### `src_apply`

Avant l'appel d'OP :
- rattacher l'appel au `needId` du bundle/proposal réel ;
- enregistrer références du bundle, focus, objectif, révision.

Après l'appel :
- événement `operation`.

Pour les opérations d'analyse :
- aucune consommation ne doit être inventée ;
- si le résultat est seulement retourné au rapport, C2 attend
  `information_only`.

### `operationAdmission`

Pour OP14/18/28 :
- événement `consumption` ;
- `effectKind = guard` ;
- `semanticEffect=true` seulement si le résultat contribue réellement au
  verdict accepted/rejected.

### `persist`

Pour OP30 :
- événement `consumption` ;
- `effectKind = persisted_only` tant qu'aucun lecteur décisionnel n'est
  démontré ;
- conserver la clé/révision/preuve, pas le graphe complet.

Si un lecteur réel de la connaissance existe dans le port :
- ce lecteur émet un **deuxième** événement consumption sur la décision qui
  utilise la valeur ;
- alors seulement la contribution peut être promue au-delà de persisted_only.

## 4. `v6-native-authority.ts`

### release

Avant OP18 / OP28 :
- le signal `need` doit venir du producteur de la proposition, pas de release ;
- release ne fait que transporter l'identité.

Après admission :
- enregistrer la consommation garde ;
- enregistrer explicitement le cas rejeté.

Cas négatifs obligatoires :
- OP18 sans question ouverte : aucun appel ;
- OP28 bundle non admis : aucun release ;
- OP28 actions vides : aucun release.

### acquire

Si acquire produit une information/question :
- émettre le `need` à l'endroit où la décision d'acquisition est prise ;
- conserver question, cible, portée, révision ;
- ne pas confondre « acquisition possible » et « acquisition requise ».

## 5. `v6-target-binding.ts`

### postAnalysis

Pour OP29 :
- si aucun composant ne lit le résultat après production :
  `effectKind = information_only`.

Pour OP30 :
- si seulement persisté :
  `effectKind = persisted_only`.

Pour OP31 :
- si aucun propriétaire d'objectif ne change maintien/fin/suspension/réorientation :
  `effectKind = information_only`.

Toute promotion doit identifier :
- consommateur exact ;
- décision exacte ;
- before/after sémantique.

## 6. Cache et invalidation

Clé de cache d'un calcul pur :
- op ;
- focus exact ;
- références d'entrée ;
- révisions des dépendances ;
- époque de niveau ;
- observation/révision ;
- objectif/stratégie seulement lorsqu'ils font partie du contrat.

Invalidation obligatoire :
- observation pertinente changée ;
- époque changée ;
- modèle/faits révisés ;
- focus changé ;
- restauration vers révisions différentes.

Réutilisation :
- événement `cache_reused` ;
- la garde physique revalide quand même époque/révision/conditions courantes.

## 7. Tests C1 à ajouter

Fichier suggéré :
`tests/v6-operation-trace.test.ts`

### S-C1-1 — besoin présent
OP18 ou OP28 :
- need ;
- call ;
- consumption ;
- décision de release cohérente.

### S-C1-2 — besoin absent
- aucune exécution ;
- aucune préparation lourde ;
- `not_required` possible uniquement si le producteur connaît explicitement
  le besoin examiné.

### S-C1-3 — information insuffisante
- `blocked` ou résultat unknown/partial ;
- aucun faux false/true.

### S-C1-4 — dépendance modifiée
- première exécution ;
- cache hit à dépendances identiques ;
- invalidation après révision ;
- nouvelle exécution.

### S-C1-5 — sauvegarde/restauration
- restauration identique : cache réutilisable ;
- restauration différente : invalidation ;
- aucune double écriture OP30 du même fait/révision.

### C2 ciblé
- OP29 sans lecteur : information_only ;
- OP30 sans lecteur futur : persisted_only ;
- OP31 sans propriétaire : information_only.

## 8. Performance

Instrumentation désactivable par configuration.

Mode normal :
- aucun JSON stringify de state complet ;
- compteurs bornés ;
- petits résumés ;
- horodatage uniquement autour des points instrumentés.

Mode audit :
- références détaillées ;
- buffer borné ;
- export progressif.

Mesures :
1. baseline sans instrumentation ;
2. instrumentation légère ;
3. diagnostic détaillé.

Jeux :
- STCK séparément ;
- SMLP séparément.

Critère :
**médiane session complète strictement sous +10 % par jeu**.

## 9. Ordre d'application recommandé

1. ajouter trace sink sans l'activer ;
2. instrumenter `execute` ;
3. instrumenter `operationAdmission` ;
4. instrumenter `persist` ;
5. instrumenter producteurs de besoin OP18/28 ;
6. instrumenter postAnalysis OP29/30/31 ;
7. tests S-C1-1..5 ;
8. benchmark instrumentation ;
9. seulement ensuite poursuivre les raccordements C2-C6.

## 10. Critère de patch acceptable

Le premier patch C1 ne doit :
- modifier aucune sélection ;
- ajouter aucune OP ;
- changer aucun résultat d'OP ;
- changer aucune garde ;
- changer aucune écriture de connaissance existante ;
- modifier aucun ordre de priorité.

Il doit seulement rendre la chaîne existante observable.
