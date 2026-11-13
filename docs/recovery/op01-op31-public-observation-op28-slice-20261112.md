# OP01–OP31 — première tranche observation publique → OP28 → action

Date : 12 novembre 2026

Branche de travail :
`op01-op31-c1-c2-public-observation-op28-20261112`

Baseline canonique de départ :
`recovery/site109-reconstruction-20261112` au commit
`b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd`.

Plan stable :
`docs/migration/op01-op31-verification-plan.md`.

## Portée

Cette étape construit la plus petite tranche probante possible depuis les
contrats Lot 6 déjà restaurés :

**GameObservation publique → AgentObservation → besoin borné → OP28 → garde
operationAdmission → AgentAction**.

Elle ne prétend pas restaurer l'ancien runtime V6 de Site 109 et ne constitue
pas une perception ou une planification générale.

## Nouveaux composants

### Adaptateur d'observation publique

Nouveau fichier :
`src/runtime/v6-browser-agent-observation.ts`.

Il :

- accepte uniquement une frame publique 64×64 avec indices de palette 0..15 ;
- copie les pixels dans un nouveau `Uint8Array` ;
- ne transporte aucun objet engine, masque, fixture ou coordonnée cachée ;
- valide et déduplique les actions publiques ;
- associe un `sessionId` explicite et une séquence monotone ;
- rejette les états navigateur qui ne sont pas représentables par le protocole
  agent actuel, au lieu de les convertir silencieusement.

### Producteur symbolique borné OP28

Nouveau fichier :
`src/logos-engine/v6-public-single-action-port.ts`.

Le producteur ne crée un bundle que lorsque :

1. l'observation est `NOT_FINISHED` ;
2. il existe exactement une action publique distincte hors RESET ;
3. cette action est ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 ou ACTION7 ;
4. aucune coordonnée manquante n'est nécessaire.

ACTION6 seule ne produit donc aucune décision : le port ne fabrique jamais de
coordonnées.

Le bundle OP28 est dérivé de l'observation courante : action publique,
session, niveau, séquence et preuve d'action unique. `releaseBundle()` revalide
ensuite le bundle, OP28 sélectionne son identifiant et `operationAdmission`
consomme le résultat comme garde avant que l'action soit retournée.

### Worker reconstruit

`src/runtime/v6-agent-worker.ts` utilise désormais par défaut ce port borné et
annonce la révision :

`reconstruction-public-single-action-op28`.

`PendingPerceptionDecisionPort` reste disponible pour les scénarios qui doivent
explicitement prouver l'absence de producteur.

Le worker demeure une reconstruction. Aucune identité historique avec le worker
V6 de Site 109 n'est revendiquée.

## Chaîne OP28 démontrée

### Besoin identifié

L'environnement public ne laisse qu'une action simple non-RESET et ne demande
aucune donnée supplémentaire pour la former.

### Données produites

- identité session/niveau/observation ;
- composition représentant l'action publique ;
- objectif borné d'avancement ;
- bundle admis contenant exactement cette action ;
- préconditions et preuves dérivées du domaine public d'actions.

### Appel justifié

`releaseBundle()` émet un besoin `realize-bundle`, puis appelle OP28 uniquement
pour le bundle préparé.

### Résultat

OP28 retourne l'identifiant du bundle si celui-ci est admis, lié à la
composition courante et contient une action.

### Consommateur

`operationAdmission()` lit réellement le résultat OP28 et vérifie l'outcome
guard du bundle.

### Effet sur la décision

L'action publique est retournée par `AgentWorkerCore` uniquement lorsque la
garde accepte la release.

Disposition OP28 pour ce contrat : **raccordable maintenant et raccordé dans le
worker reconstruit sous condition stricte d'action publique unique**.

## Cas négatifs

- plusieurs actions publiques : aucun bundle, aucun appel OP, aucune action ;
- ACTION6 seule sans coordonnées : aucun bundle, aucun appel OP, aucune action ;
- observation terminale : aucune décision ;
- signal annulé : aucune décision ;
- frame, palette, action ou identité invalide : rejet explicite ;
- changement de révision : nouveau bundle et nouvelle identité de dépendance.

## Statut des opérations prioritaires après cette étape

| OP | Statut produit/runtime | Justification |
| --- | --- | --- |
| OP28 | **raccordable maintenant** pour le contrat action unique | observation publique → bundle admis → OP28 → garde → action démontré |
| OP18 | **bloqué par producteur symbolique manquant** | aucune question ouverte générale n'est encore produite depuis les pixels |
| OP29 | **appel existant sans consommateur produit démontré** | aucun retour de cette action n'est encore corrélé au même besoin |
| OP30 | **appel existant sans consommateur produit démontré** | aucune connaissance générique issue du retour n'est encore relue |
| OP31 | **appel existant sans consommateur produit démontré** | aucun propriétaire d'objectif produit ne consomme encore l'assessment |
| OP03/08/12/26 | **bloqué par runtime manquant** | aucun producteur générique réel supplémentaire n'apparaît dans cette tranche |
| OP06/29/30 Region | **déjà assuré par fonction spécialisée** | chaîne Region inchangée, sans duplication générique |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin réel n'est établi ici |

## Ce qui reste non raccordé

- le navigateur principal ne crée pas encore le worker agent ;
- le bouton SRA du produit reste honnêtement indisponible ;
- aucune action worker n'est encore envoyée par `main.ts` au dispatch produit ;
- aucun corrélateur action/retour ne conserve encore le `needId` ;
- OP29/OP30/OP31 ne sont pas déclenchées depuis le retour de cette tranche ;
- aucun transport de compteurs/traces n'est exposé au produit ;
- aucune mémoire de session du port n'est sauvegardée/restaurée.

Le garde-fou de raccord produit doit donc être interprété avec précision : il
peut maintenant détecter un import Logos dans le worker runtime, mais cela ne
signifie pas encore que le navigateur principal instancie ce worker.

## Tests

Nouveaux tests déposés :

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
- chaîne GameObservation → Worker → OP28 → action ;
- comportement par défaut du worker sur ambiguïté et action unique.

Validation locale ciblée sur une matérialisation minimale des contrats touchés :

- typecheck strict des sources : **PASS** ;
- tests ciblés : **13/13 PASS**.

La suite complète du dépôt n'a pas été relancée, car le checkout GitHub complet
ne peut pas être cloné depuis l'environnement courant. Les fichiers de branche
ont été relus via l'API GitHub et les tests ont été exécutés contre les mêmes
interfaces et le chemin OP28 concerné.

## Performance

Micro-diagnostic local, trace désactivée, 21 rounds :

- cas sans besoin `[ACTION1, ACTION2]` : environ **0,080 µs/décision** ;
- cas action unique avec OP28 : environ **3,294 µs/décision**.

Ces valeurs sont informatives et propres au harness ciblé. Elles ne remplacent
pas une session native STCK ou SMLP.

Statut :

**fonctionnellement qualifié, performance officielle à confirmer**.

Les règles officielles restent : STCK et SMLP séparés, global strictement sous
+10 %, aucune compensation et runners natifs qualifiés.

## Décision

La dette « aucun producteur dans le worker » est réduite sans créer une fausse
perception générale. Le worker possède maintenant un premier producteur réel,
mais extrêmement borné, dérivé uniquement du contrat public d'actions.

Cette tranche qualifie OP28 jusqu'à une action worker. Elle ne clôt pas C2 tant
que le retour du jeu n'est pas corrélé et consommé.

## Prochaine étape

Ajouter au port ou au contrôleur worker un corrélateur de retour qui conserve le
bundle et le `needId`, puis traiter l'observation suivante :

1. comparer l'avant/après public ;
2. appeler OP29 seulement si une attente explicite existe ;
3. produire une mise à jour OP30 avec preuve et révision ;
4. faire relire cette connaissance par la décision suivante ;
5. remettre OP31 à un propriétaire d'objectif réel ;
6. démontrer qu'un retour sans effet invalide ou suspend la répétition du même
   choix, sans bloquer les autres décisions.
