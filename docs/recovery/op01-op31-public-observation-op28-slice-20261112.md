# OP01–OP31 — première tranche observation publique → OP28 → action

Date : 12 novembre 2026

Branche de travail :
`op01-op31-c1-c2-public-observation-op28-20261112`.

Baseline de création :
`b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd`.

Baseline canonique ensuite réconciliée :
`cb0006a80f3552eed9d4e5255feed94c83dc4fa0`.

Plan stable :
`docs/migration/op01-op31-verification-plan.md`.

Réconciliation OP18 / Lot 5 :
`docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`.

## Portée

Cette étape construit une tranche volontairement étroite :

**GameObservation publique → AgentObservation → besoin borné → OP28 → garde
operationAdmission → AgentAction**.

Elle ne prétend pas restaurer l’ancien runtime V6 de Site 109, ni fournir une
perception ou une planification générale. Le cas traité est seulement celui où
le protocole public laisse une action simple unique et complète.

Le Lot 5 intégré en parallèle apporte une chaîne OP18 plus riche, fondée sur
`FieldStock`. Les deux chaînes restent séparées : OP18 explore une question
symbolique adressée ; OP28 réalise un bundle public unique déjà déterminé.

## Adaptateur d’observation publique

Nouveau fichier :
`src/runtime/v6-browser-agent-observation.ts`.

Il :

- accepte uniquement une frame publique 64×64 avec indices de palette 0..15 ;
- copie les pixels dans un nouveau `Uint8Array` ;
- ne transporte aucun objet engine, masque, fixture ou coordonnée cachée ;
- valide et déduplique les actions publiques ;
- associe un `sessionId` explicite et une séquence monotone ;
- rejette les états navigateur non représentables par le protocole agent au
  lieu de les convertir silencieusement.

## Producteur symbolique borné OP28

Nouveau fichier :
`src/logos-engine/v6-public-single-action-port.ts`.

Le producteur crée un bundle uniquement lorsque :

1. l’observation est `NOT_FINISHED` ;
2. il existe exactement une action publique distincte hors RESET ;
3. cette action est ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 ou ACTION7 ;
4. aucune coordonnée manquante n’est nécessaire.

ACTION6 seule ne produit aucune décision : le port ne fabrique jamais de
coordonnées.

Le bundle est lié à la session, au niveau, à la séquence et à l’action publique.
`releaseBundle()` appelle OP28, puis `operationAdmission()` consomme le résultat
avant que l’action soit retournée.

## Worker reconstruit

`src/runtime/v6-agent-worker.ts` utilise désormais par défaut ce port borné et
annonce la révision :

`reconstruction-public-single-action-op28`.

`PendingPerceptionDecisionPort` reste disponible pour les tests qui doivent
explicitement prouver l’absence de producteur.

La présence de ce worker reste une reconstruction. Aucune identité historique
avec le worker V6 de Site 109 n’est revendiquée.

## Chaîne OP28 démontrée

### Besoin identifié

L’environnement public ne laisse qu’une action simple non-RESET et ne demande
aucune donnée supplémentaire pour la former.

### Données produites

- identité session/niveau/observation ;
- composition représentant l’action publique ;
- objectif borné d’avancement ;
- bundle admis contenant exactement cette action ;
- préconditions et preuves dérivées du contrat public d’actions.

### Appel justifié

`releaseBundle()` émet un besoin `realize-bundle`, puis appelle OP28 uniquement
pour ce bundle préparé.

### Résultat

OP28 retourne l’identifiant du bundle lorsqu’il est admis, lié à la composition
courante et contient une action.

### Consommateur

`operationAdmission()` lit le résultat OP28 et vérifie l’outcome guard.

### Effet sur la décision

`AgentWorkerCore` retourne l’action uniquement lorsque la garde accepte la
release.

Disposition OP28 pour ce contrat :

**raccordable maintenant et raccordée au Worker reconstruit sous condition
stricte d’action publique unique.**

## Cas négatifs

- plusieurs actions publiques : aucun bundle, aucun appel OP, aucune action ;
- ACTION6 seule sans coordonnées : aucun bundle, aucun appel OP, aucune action ;
- observation terminale : aucune décision ;
- signal annulé : aucune décision ;
- frame, palette, action ou identité invalide : rejet explicite ;
- changement de révision : nouveau bundle et nouvelle identité de dépendance.

## Limites produit

- `main.ts` ne crée pas encore le worker agent ;
- le bouton SRA du produit reste honnêtement indisponible ;
- aucune action worker n’est encore envoyée au dispatch produit ;
- aucun retour de jeu n’est corrélé au bundle OP28 ou au même `needId` ;
- OP29/OP30/OP31 ne sont pas déclenchées depuis le retour de cette tranche ;
- aucun transport des compteurs ou traces n’est exposé au produit ;
- aucune mémoire de session du port n’est sauvegardée/restaurée.

Le garde-fou de raccord produit peut détecter l’import Logos dans le worker
runtime, mais cela ne signifie pas encore que le navigateur principal instancie
ce worker.

## Tests

Nouveaux tests :

- `tests/v6-browser-agent-observation.test.ts` ;
- `tests/v6-public-single-action-port.test.ts` ;
- `tests/v6-public-observation-op28-chain.test.ts` ;
- extension de `tests/v6-agent-worker.test.ts`.

Preuves couvertes :

- copie de la frame publique et absence de fuite par référence ;
- séquence monotone ;
- besoin présent → OP28 appelée ;
- besoin absent → aucune OP appelée ;
- ACTION6 inconnue sans coordonnées ;
- consommation OP28 par la garde ;
- changement de révision → identité de bundle modifiée ;
- chaîne `GameObservation → Worker → OP28 → action` ;
- comportement par défaut du worker sur ambiguïté et action unique.

Après réconciliation avec le Lot 5, la qualification a été exécutée sur GitHub
Actions :

- run : `43342264179` ;
- commit qualifié : `6bf46db33eb238c432ace2179af43af7c95688c9` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck du dépôt : réussi ;
- régression TypeScript complète, incluant Lot 5, Lot 6 et OP01–OP31 :
  **269/269 tests réussis**.

Le workflow temporaire de qualification a ensuite été supprimé de la branche et
ne doit pas entrer dans la branche canonique.

## Performance

Micro-diagnostic ciblé, trace désactivée, 21 rounds :

- cas sans besoin `[ACTION1, ACTION2]` : environ `0,080 µs/décision` ;
- cas action unique avec OP28 : environ `3,3–3,6 µs/décision`.

Ces valeurs sont informatives et propres au harness ciblé. Elles ne remplacent
pas une session native STCK ou SMLP.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer**.

Les règles officielles restent : STCK et SMLP séparés, global strictement sous
+10 %, aucune compensation et runners natifs qualifiés.

## Décision

La dette « aucun producteur dans le worker » est réduite sans créer une fausse
perception générale. Le worker possède un premier producteur borné, dérivé
uniquement du contrat public d’actions.

Cette tranche qualifie OP28 jusqu’à une action Worker. Elle ne clôt pas C2 tant
que le retour du jeu n’est pas corrélé et consommé.

## Prochaine étape

Construire un propriétaire commun de campagne qui conserve proposition, bundle,
action et `needId`, puis reçoit l’observation publique suivante et route le
retour vers le consommateur spécialisé ou générique exact. La première preuve
doit montrer qu’un retour modifie la proposition ou la décision suivante sans
bloquer les autres mécanismes.
