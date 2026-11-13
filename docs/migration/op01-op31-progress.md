# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique initiale de la tranche :
  `97e036fc6609a4822feffe0f834a120f831c1397`
- Canonique lot 9B réconciliée :
  `85d8c5e57a26ae3f02a0e89c49f5894dc571bf70`
- Merge de réconciliation :
  `70943d5715e7e44680ab307f0e8ddca27dd020aa`
- Branche de travail :
  `op01-op31-browser-field-stock-20261112`
- Commit fonctionnel FieldStock qualifié :
  `bce3e89cbfd1cfc21245edf675d27870df524607`
- Commit combiné qualifié :
  `70943d5715e7e44680ab307f0e8ddca27dd020aa`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Chaîne OP18 initiale :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun :
  `docs/recovery/op01-op31-common-campaign-owner-20261112.md`
- Hôte navigateur :
  `docs/recovery/op01-op31-browser-campaign-host-20261112.md`
- Hôte Worker :
  `docs/recovery/op01-op31-worker-common-campaign-20261112.md`
- Contrôleur Agent :
  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`
- Transport FieldStock navigateur :
  `docs/recovery/op01-op31-browser-field-stock-transport-20261112.md`

Le présent fichier décrit l’état courant. Les versions antérieures restent dans
Git et dans les rapports de recovery afin de préserver les preuves détaillées.

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

Un import, un compteur ou une trace sans consommateur ne suffisent pas. Aucune
opération n’est ajoutée pour atteindre artificiellement 31 appels.

## Statut global

La campagne commune possède maintenant :

- une autorité Logos bornée ;
- un propriétaire neutre de décision et de retour corrélé ;
- un seam Worker qualifié ;
- un seam produit/browser qualifié ;
- un contrôleur Agent explicite et unique activé dans `main.ts` ;
- deux propriétaires navigateur enregistrés, FieldStock OP18 et fallback OP28 ;
- un chemin Manual toujours séparé ;
- le manifeste et le harness ABBA Worker/Pyodide du lot 9B dans le même état
  combiné qualifié.

Le contrôleur produit utilise uniquement le seam navigateur direct. Le Worker
reste disponible pour les autres runtimes et les tests, mais n’est pas instancié
par `main.ts`.

Statut global :

**OP28 est active dans le produit ; le transport et la consommation OP18 produit
sont qualifiés avec un stock revalidé ; l’acquisition initiale du prior et le
coût officiel C7 restent ouverts.**

Cette reconstruction ne prouve ni une identité binaire avec Site 109, ni une
parité totale V5/V6/V7.

## Architecture runtime pertinente

### Produit navigateur actif

- `src/main.ts` : sélection Manual / Agent et ports produits ;
- `src/runtime/browser-games.ts` : transport jeu navigateur ;
- `src/agent-product-dispatch.ts` : disponibilité, génération, `busy`, timing,
  ACTION6 et erreurs ;
- `src/product-presentation-effects.ts` : présentation et effets DOM ;
- `src/runtime/v6-browser-agent-observation.ts` : conversion publique 64 × 64 ;
- `src/runtime/v6-browser-common-campaign-host.ts` : propriétaires OP18/OP28,
  dispatch, acquisition, observation passive et présentation ;
- `src/runtime/v6-browser-agent-controller.ts` : propriétaire unique de la
  session Agent et boucle bornée ;
- `src/runtime/observed-addressed-material-runtime.ts` : rétention et
  revalidation FieldStock.

### Seam Worker conservé

- `src/runtime/v6-public-observation-measurement.ts` ;
- `src/runtime/v6-common-campaign-decision-port.ts` ;
- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts`.

Le Worker acquiert correctement les retours OP18/OP28, y compris les retours
terminaux ou sans budget de décision. Il n’est pas utilisé par le contrôleur
produit actuel.

### Autorité et propriétaires

- `src/logos-engine/v6-native-authority.ts` ;
- `src/logos-engine/v6-neutral-common-caller.ts` ;
- `src/logos-engine/v6-common-campaign-owner.ts` ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` ;
- `src/logos-engine/field-stock.ts`.

## État C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés et dispositions explicites | maintenir les statuts par besoin |
| C1 | **contrôleur produit actif et qualifié** | campagne unique, même `needId`, transfert Manual gracieux, observation passive après acquisition | snapshot/restauration du propriétaire et du prior |
| C2 | **OP18 transportée dans Worker et navigateur ; OP28 active dans le produit** | OP18 change la proposition suivante dans le host produit avec stock revalidé ; OP28 traverse le produit réel | acquisition initiale honnête du prior et propriétaire OP31 |
| C3 | **calculs et recouvrements qualifiés** | OP03/04/08/09/11/12/14/26 auditables | appeler uniquement depuis un producteur réel |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | aucun raccord artificiel |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur | contrat physique Region complet |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccord sans preuve de blocage ou reprise |
| C7 | **ouvert** | 330 tests, typecheck, build, câblage et harness ABBA présent | exécution des quatre runners et médianes par jeu sous +10 % |

## Contrôleur Agent produit

`BrowserAgentController` est activé uniquement après sélection explicite du mode
Agent. Il utilise `BrowserCommonCampaignHost` et n’instancie pas le Worker.

Il garantit :

- une seule campagne en vol ;
- observation courante exacte avant démarrage ;
- aucun choix d’action local ;
- aucune action par défaut ;
- arrêt sur `none`, `ambiguous`, `pending`, `blocked`, terminal, obsolescence,
  erreur ou limite ;
- limite par défaut de 64 actions ;
- acquisition avant décision suivante ;
- transfert Agent vers Manual après règlement du retour en vol ;
- priorité du remplacement de jeu sur une simple demande Manual ;
- fermeture `disposed` stable pendant `pagehide`.

Le mode Manual reste direct et n’appelle aucune campagne Agent.

## Chaîne OP18 produit

### Besoin

Un stock adressé retenu et revalidé laisse une demande typée insatisfaite alors
qu’ACTION6 est disponible.

### Production

`BrowserFieldStockCampaignTransport` construit le contexte depuis :

- l’observation publique 64 × 64 ;
- les lignes de palette copiées ;
- le niveau et le score publics ;
- le runtime FieldStock exact du propriétaire ;
- un budget borné.

Les composantes visibles ne sont matérialisées que lorsqu’un prior attend une
revalidation.

### Appel et consommation

`FieldStockCallerOwnerAdapter` :

- exécute `beforeStock()` ;
- expose la proposition et son bundle OP18 ;
- conserve le même `needId` ;
- acquiert le retour physique ;
- appelle `afterStock()` puis `recordStock()` ;
- modifie la proposition suivante.

La preuve navigateur qualifiée produit ACTION6 `(3,1)`, acquiert son retour,
puis produit ACTION6 `(4,1)`.

Disposition OP18 :

**transport, release, action, retour, acquisition et effet sur la décision
suivante démontrés dans le produit lorsqu’un stock courant revalidé existe.**

Limite : le runtime produit par défaut démarre vide. L’acquisition initiale du
premier prior et sa persistance entre sessions ne sont pas encore raccordées.

## Observation passive FieldStock

Après l’acquisition du propriétaire sélectionné, le même retour public peut être
observé passivement par FieldStock avant présentation.

Cette observation permet notamment :

- de détecter une frontière atteinte par une action OP28 ;
- de convertir un stock actif en prior compact ;
- de tenter une revalidation sur la nouvelle scène publique ;
- de conserver le prior comme hypothèse non applicable si la scène ne confirme
  pas sa géométrie.

Elle ne peut pas acquérir le `needId` sélectionné, prétendre avoir choisi
l’action ou émettre une seconde action depuis le hook.

## Chaîne OP28 produit

Le fallback public strict produit une proposition uniquement lorsque
l’observation expose exactement une action simple distincte hors RESET et ne
requiert aucune coordonnée manquante.

La chaîne reste :

1. observation publique ;
2. proposition propriétaire OP28 ;
3. bundle validé ;
4. autorité Logos ;
5. dispatch produit ;
6. retour public ;
7. acquisition avec le même `needId` ;
8. observation passive éventuelle ;
9. présentation ;
10. arrêt ou décision suivante.

ACTION6 seule sans coordonnées ne produit rien. Plusieurs actions publiques
produisent `none`. Plusieurs propriétaires resteraient `ambiguous`. Aucun
fallback n’est autorisé.

## Disposition des 31 opérations

| OP | Disposition courante | Producteur/consommateur démontré ou dette précise |
| --- | --- | --- |
| OP01 | calcul qualifié, usage produit non démontré | aucun regroupement structurel consommé par le runtime actif |
| OP02 | calcul qualifié, usage produit non démontré | aucun domaine complet de chemins équivalents produit et consommé |
| OP03 | producteur générique manquant | préconditions spécialisées gardées dans leurs familles |
| OP04 | calcul qualifié, usage produit non démontré | aucun réseau commun d’ouvertures consommé |
| OP05 | calcul qualifié, usage produit non démontré | ambiguïté traitée structurellement sans appel artificiel |
| OP06 | fonction spécialisée démontrée | contradictions FieldStock/Region affectent les propositions futures |
| OP07 | producteur runtime manquant | aucune frontière liée à un objectif ouvert n’est produite |
| OP08 | manquante ou recouverte familialement | aucun graphe transversal fiable `effect → requires` consommé |
| OP09 | calcul qualifié, usage produit non démontré | aucune preuve de domaine complet d’alternatives |
| OP10 | calcul qualifié, usage produit non démontré | aucun propriétaire de buts terminaux ne consomme le résultat |
| OP11 | calcul qualifié, usage produit non démontré | aucun réseau commun de déblocages produit puis choisi |
| OP12 | manquante ou recouverte familialement | inconnues spécialisées sans chaîne générique démontrée |
| OP13 | calcul qualifié, consommateur générique absent | portée bornée dans les modèles spécialisés |
| OP14 | admission bridge présente, release native absente | aucun besoin produit ne justifie cette autorité physique |
| OP15 | calcul qualifié, usage produit non démontré | aucun sélecteur réel d’objectif intermédiaire |
| OP16 | calcul qualifié, usage produit non démontré | aucun producteur de blocage global prouvé |
| OP17 | calcul qualifié, usage produit non démontré | aucune reprise autorisée avec préservation complète |
| OP18 | **chaîne produit transportée et consommée avec stock revalidé** | bundle, action, même `needId`, acquisition et proposition suivante ; prior initial absent |
| OP19 | calcul qualifié, usage produit non démontré | aucun préfixe forcé prouvé produit |
| OP20 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’objet liée à une stratégie active |
| OP21 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’espace liée à un objectif actif |
| OP22 | calcul qualifié, usage produit non démontré | aucun effet distant attribué et consommé transversalement |
| OP23 | calcul qualifié, usage produit non démontré | aucun cycle autonome prouvé n’alimente un plan réel |
| OP24 | calcul qualifié, usage produit non démontré | aucun générateur de chemins alternatifs vérifiés |
| OP25 | calcul qualifié, usage produit non démontré | non-réfutation conservée sans fausse preuve de faisabilité |
| OP26 | manquante ou recouverte familialement | aucun domaine commun d’accès vérifiés vers une cible |
| OP27 | calcul qualifié, usage produit non démontré | aucune permutation avec préservation complète |
| OP28 | **chaîne produit active sous condition stricte** | bundle admis, action physique, même `needId`, acquisition avant suite |
| OP29 | fonction spécialisée démontrée | `afterStock()` et Region comparent les retours utiles |
| OP30 | fonction spécialisée démontrée | `recordStock()` et Region changent les propositions futures |
| OP31 | appel générique disponible, contribution absente | aucun propriétaire d’objectif produit ne maintient ou réoriente la suite |

## Qualification

### Code FieldStock avant réconciliation

- run GitHub Actions : `43354913250` ;
- job : `131654533095` ;
- commit : `bce3e89cbfd1cfc21245edf675d27870df524607` ;
- régression complète : **330/330** ;
- typecheck et build : réussis.

### État combiné après réconciliation canonique

- PR de réconciliation : `#54` ;
- merge de réconciliation : `70943d5715e7e44680ab307f0e8ddca27dd020aa` ;
- run GitHub Actions : `43355369134` ;
- job : `131656026153` ;
- commit qualifié : `70943d5715e7e44680ab307f0e8ddca27dd020aa` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression complète : **330/330** ;
- échecs, annulations, tests ignorés et TODO : `0` ;
- build de production : réussi ;
- modules transformés : `53` ;
- galerie : 100 jeux, 636 prévisualisations, 4 atlas natifs ;
- câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `23`.

Les cinq tests propres au transport navigateur FieldStock réussissent dans
l’état combiné. Deux vulnérabilités de dépendances de sévérité haute
préexistantes restent signalées par `npm ci`.

## Performance

Critère : la médiane de session complète de chaque jeu doit augmenter de
strictement moins de 10 %. STCK et SMLP restent séparés.

Le transport FieldStock ne matérialise les composantes visibles que lorsqu’un
prior attend une revalidation. Le build et les tests ne permettent cependant
pas de fermer le coût d’activation.

Le manifeste, les références A/B et le harness ABBA Worker/Pyodide sont présents
dans l’état combiné. Les quatre mesures de coût ne sont pas exécutées dans cette
tranche et aucune compensation entre jeux n’est permise.

Verdict : **fonctionnellement qualifié, coût officiel à confirmer.**

C7 exige encore A/STCK, A/SMLP, B/STCK et B/SMLP avec provenance, échantillons
et médianes publiés.

## Limites ouvertes

- aucun producteur produit du premier prior FieldStock ;
- aucune persistance FieldStock entre deux activations Agent ;
- snapshot/restauration de la campagne et de l’action en attente non raccordés au
  produit ;
- Region n’est pas encore un propriétaire physique du contrôleur produit ;
- aucun propriétaire OP31 ;
- performance C7 non close ;
- aucune publication Site dans cette tranche.

## Feuille de route actualisée

### Étape immédiate : acquisition initiale et continuité FieldStock

1. identifier un événement public suffisant pour retenir le premier prior
   adressé sans oracle ;
2. exiger plusieurs observations et réponses corrélées avant promotion ;
3. injecter le prior dans le runtime produit uniquement après preuve ;
4. ajouter snapshot/restauration du prior, du stock et du `needId` en attente ;
5. vérifier une réactivation Agent sans perte ni double consommation.

### Étape suivante : élargissement symbolique

1. compléter le contrat physique Region ;
2. enregistrer Region sans classement implicite ;
3. généraliser les observations passives avec déduplication explicite ;
4. identifier un propriétaire d’objectif réel avant OP31.

### Clôture C7 et publication

1. geler baseline et candidat intégrés ;
2. exécuter A/STCK, A/SMLP, B/STCK et B/SMLP ;
3. publier distributions et médianes par jeu ;
4. accepter ou corriger tout dépassement ;
5. publier le Site uniquement depuis un commit GitHub canonique qualifié ;
6. vérifier ensuite GitHub ↔ Site.
