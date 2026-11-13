# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline de cette étape : `b093f406c07b5e3e14124a4e99dfcd5ea9f34ffd`
- Branche de travail : `op01-op31-c1-c2-public-observation-op28-20261112`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur à cette consolidation :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`

Le présent fichier est l’état courant consolidé. L’historique complet a été
conservé avec son blob Git original afin de ne perdre aucune preuve, mesure ou
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

Le benchmark officiel historique n’est pas restauré sous une forme permettant
de qualifier les quatre runners natifs A/STCK, A/SMLP, B/STCK et B/SMLP. Les
diagnostics synthétiques ou ciblés restent informatifs uniquement.

Statut performance global :

**fonctionnellement qualifié, performance officielle à confirmer**.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **raccord partiel au worker reconstruit** | besoin présent/absent, appel, non-appel et consommation OP28 distingués sur un contrat public borné | raccorder l’hôte navigateur, le retour et le transport borné des traces |
| C2 | **OP28 raccordée sous condition stricte** | observation publique contractuelle → bundle OP28 → garde → action worker | corréler le retour, puis qualifier OP29/OP30/OP31 jusqu’à la décision suivante |
| C3 | **calculs et recouvrements qualifiés** | OP03/08/12/14/26 couvertes au niveau noyau ; spécialisations donneuses identifiées | appeler uniquement lorsqu’un producteur runtime réel établit le besoin |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur réels |
| C5 | **audit complet, Region spécialisé disponible** | équivalents spécialisés OP06/OP29/OP30 avec effet futur démontré dans Region | préserver cette spécialisation sans duplication générique |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccordement sans preuve de blocage/reprise/variante |
| C7 | **ouvert** | garde-fous, diagnostics ciblés et corpus candidat disponibles | runners natifs qualifiés, manifeste complet et STCK/SMLP séparés < +10 % |

## Première tranche publique OP28

Détail :
`docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`.

### Composants ajoutés

- `src/runtime/v6-browser-agent-observation.ts`
  - transforme le contrat public `GameObservation` en `AgentObservation` ;
  - copie uniquement la frame visible 64×64, les actions disponibles et la
    progression publique ;
  - valide palette, dimensions, identité et séquence ;
  - ne transporte ni engine, ni masque, ni fixture, ni donnée cachée.
- `src/logos-engine/v6-public-single-action-port.ts`
  - produit un bundle OP28 uniquement lorsqu’il existe exactement une action
    publique non-RESET et qu’elle ne requiert aucune donnée manquante ;
  - accepte ACTION1, ACTION2, ACTION3, ACTION4, ACTION5 ou ACTION7 ;
  - refuse ACTION6 sans coordonnées au lieu d’en inventer ;
  - appelle `releaseBundle()` et ne retourne l’action qu’après consommation du
    résultat par `operationAdmission()`.
- `src/runtime/v6-agent-worker.ts`
  - utilise ce port borné par défaut ;
  - annonce `reconstruction-public-single-action-op28` ;
  - conserve `PendingPerceptionDecisionPort` pour les preuves explicites
    d’absence de producteur.

### Chaîne qualifiée

Pour le contrat « une seule action simple est publiquement disponible » :

1. **besoin identifié** : réaliser le seul choix public complet ;
2. **données produites** : identité session/niveau/observation, action,
   composition, objectif borné et bundle admis ;
3. **appel justifié** : `releaseBundle()` émet `realize-bundle` puis appelle OP28 ;
4. **résultat** : OP28 sélectionne le bundle admis non vide lié au focus ;
5. **consommateur** : `operationAdmission()` vérifie l’outcome guard ;
6. **effet** : `AgentWorkerCore` retourne l’action uniquement si la release est
   autorisée.

Cette preuve porte sur le runtime Worker reconstruit et le contrat public. Le
navigateur principal `main.ts` n’instancie pas encore ce worker et le bouton SRA
reste honnêtement indisponible. La qualification n’est donc pas encore une
campagne live dans le produit/browser.

### Cas négatifs qualifiés

- plusieurs actions disponibles : aucun bundle et aucun appel OP ;
- ACTION6 seule sans coordonnées : statut inconnu conservé, aucun appel OP ;
- observation terminale : aucune décision ;
- décision annulée : aucune action ;
- observation publique malformée : rejet explicite ;
- révision modifiée : nouvelle identité de bundle et aucune réutilisation
  implicite de l’ancien résultat.

## Statut des opérations prioritaires

| OP | Statut exact | Producteur | Consommateur | Effet démontré |
| --- | --- | --- | --- | --- |
| OP18 | **bloqué par runtime manquant** | aucune question ouverte générale produite depuis la perception publique actuelle | garde disponible dans le noyau/test-only | non en produit |
| OP28 | **raccordable maintenant** pour l’action publique simple unique | `preparePublicSingleActionDecision()` | `operationAdmission()` puis `AgentWorkerCore` | action worker autorisée/refusée |
| OP29 | **appel existant sans consommateur produit démontré** | postAnalysis générique disponible, retour produit non corrélé | rapport informationnel générique | non |
| OP30 | **appel existant sans consommateur produit démontré** | postAnalysis générique disponible | `KnowledgeStore` écrit, aucun lecteur futur produit | persistance seulement |
| OP31 | **appel existant sans consommateur produit démontré** | postAnalysis générique disponible | aucun propriétaire d’objectif produit | non |
| OP03 | **bloqué par runtime manquant** | aucun producteur tri-état générique depuis la perception produit | admission/plan potentiel | non |
| OP08 | **bloqué par runtime manquant** | aucun graphe générique effect→requires produit | stratégie potentielle | non |
| OP12 | **bloqué par runtime manquant** | aucune chaîne générique dépendances/inconnues produite | acquisition potentielle | non |
| OP26 | **bloqué par runtime manquant** | aucun domaine réel multi-accès produit | admission potentielle | non |
| OP06/29/30 Region | **déjà assuré par fonction spécialisée** | retour ACTION6 explicitement lié à une méthode | modèle Region et propositions futures | oui, dans Region |
| OP14 | **bloqué par runtime manquant** | admission bridge présente, aucun besoin/routage natif produit | garde bridge | non en produit |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin runtime établi dans cette tranche | selon audit C3–C6 | non revendiqué |

## Tests de cette étape

Nouveaux tests :

- `tests/v6-browser-agent-observation.test.ts` ;
- `tests/v6-public-single-action-port.test.ts` ;
- `tests/v6-public-observation-op28-chain.test.ts` ;
- extension de `tests/v6-agent-worker.test.ts`.

Validation ciblée sur les contrats touchés :

- typecheck strict : **PASS** ;
- tests ciblés : **13/13 PASS**.

La suite complète du dépôt n’a pas été relancée : le checkout GitHub complet ne
peut pas être cloné depuis l’environnement d’exécution courant. Les tests ciblés
ont été exécutés sur une matérialisation minimale des mêmes contrats et du même
chemin OP28. Ils ne sont pas présentés comme une campagne navigateur live.

## Performance

Micro-diagnostic ciblé, trace désactivée, 21 rounds :

- besoin absent `[ACTION1, ACTION2]` : environ `0,080 µs/décision` ;
- action unique avec OP28 : environ `3,294 µs/décision`.

Ce diagnostic ne remplace pas le benchmark officiel. Les règles de clôture C7
restent :

- STCK global strictement inférieur à +10 % ;
- SMLP global strictement inférieur à +10 % ;
- jeux séparés ;
- aucune compensation ;
- phases internes informatives si le global du jeu reste conforme.

## Besoins encore sans traitement

- hôte navigateur créant et initialisant le worker agent ;
- dispatch de l’action worker vers `BrowserGameRuntime` ;
- corrélateur action/retour conservant le bundle et le même `needId` ;
- production d’attentes explicites avant OP29 ;
- production et lecture future d’une connaissance OP30 ;
- propriétaire d’objectif consommant OP31 ;
- snapshot/restauration du port et de la mémoire ;
- transport borné des traces/compteurs vers le produit ou le harness ;
- perception et planification générales pour les situations à plusieurs actions.

## Prochaine étape concrète

Ajouter un corrélateur de retour au port ou au contrôleur Worker :

1. conserver l’observation, l’action, le bundle et le `needId` libérés ;
2. recevoir l’observation publique suivante ;
3. comparer avant/après ;
4. appeler OP29 seulement si une attente explicite existe ;
5. produire une mise à jour OP30 étayée et révisée ;
6. faire relire cette connaissance par la décision suivante ;
7. remettre OP31 à un propriétaire d’objectif réel ;
8. démontrer qu’un retour sans effet suspend ou invalide la répétition du même
   choix sans bloquer les autres décisions.

Aucun Site ne doit être publié avant intégration durable du code correspondant
sur GitHub et vérification GitHub ↔ Site.
