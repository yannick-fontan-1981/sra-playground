# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 13 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique de la tranche courante :
  `e3fa1901452423a714d3a47d5a469dbf112c55b0`
- Branche de travail :
  `op01-op31-browser-addressed-acquisition-20261113`
- Commit fonctionnel qualifié :
  `99c1d23353dbfec3e98c3770fee362b757ec2701`
- Donneur OP01-OP31 : `op01-op31-c0-c7-audit`
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
- Acquisition adressée publique :
  `docs/recovery/op01-op31-browser-addressed-acquisition-20261113.md`

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
- une mesure publique différée des entités ;
- une acquisition passive du premier modèle adressé depuis un retour ACTION6
  déjà autorisé par un propriétaire explicite ;
- une calibration par réponses corrélées et une rétention prudente à la
  frontière officielle ;
- le manifeste et le harness ABBA Worker/Pyodide dans l’état intégré.

Le contrôleur produit utilise uniquement le seam navigateur direct. Le Worker
reste disponible pour les autres runtimes et les tests, mais n’est pas instancié
par `main.ts`.

Statut global :

**OP28 est active dans le produit ; OP18 est transportée et consommée avec un
stock revalidé ; l’acquisition et la rétention initiales d’un modèle adressé
sont qualifiées depuis une ACTION6 explicitement autorisée ; le propriétaire
produit de cette première ACTION6, la continuité entre activations et le coût C7
restent ouverts.**

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
- `src/runtime/v6-public-observation-measurement.ts` : mesure publique et
  identités de composantes différées ;
- `src/runtime/v6-public-addressed-field-learning.ts` : correspondances
  résiduelles strictes et dépendances de réponse ;
- `src/runtime/v6-browser-common-campaign-host.ts` : propriétaires OP18/OP28,
  dispatch, acquisition, apprentissage passif, revalidation et présentation ;
- `src/runtime/v6-browser-agent-controller.ts` : propriétaire unique de la
  session Agent et boucle bornée ;
- `src/runtime/observed-addressed-material-runtime.ts` : acquisition locale,
  calibration, rétention et revalidation FieldStock.

### Seam Worker conservé

- `src/runtime/v6-public-observation-measurement.ts` ;
- `src/runtime/v6-common-campaign-decision-port.ts` ;
- `src/runtime/v6-agent-worker-core.ts` ;
- `src/runtime/v6-agent-worker.ts`.

Le Worker acquiert correctement les retours OP18/OP28, y compris les retours
terminaux ou sans budget de décision. Il n’est pas utilisé par le contrôleur
produit actuel.

### Autorité, modèles et propriétaires

- `src/logos-engine/v6-native-authority.ts` ;
- `src/logos-engine/v6-neutral-common-caller.ts` ;
- `src/logos-engine/v6-common-campaign-owner.ts` ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` ;
- `src/logos-engine/addressed-field-fit.ts` ;
- `src/logos-engine/addressed-field-response.ts` ;
- `src/logos-engine/addressed-field-retention.ts` ;
- `src/logos-engine/field-stock.ts`.

## État C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés et dispositions explicites | maintenir les statuts par besoin |
| C1 | **contrôleur produit actif et qualifié** | campagne unique, même `needId`, acquisition sélectionnée avant observation passive, transfert Manual gracieux | snapshot/restauration de la campagne, du modèle, du prior et du retour en attente |
| C2 | **OP18 transportée ; OP28 active ; acquisition initiale passive qualifiée** | modèle acquis, calibré puis retenu depuis des retours ACTION6 publics corrélés ; OP18 change la proposition suivante avec stock revalidé | propriétaire produit justifiant la première ACTION6 et propriétaire OP31 |
| C3 | **calculs et recouvrements qualifiés** | OP03/04/08/09/11/12/14/26 auditables | appeler uniquement depuis un producteur réel |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | aucun raccord artificiel |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur | contrat physique Region complet |
| C6 | **audit complet** | inconnue, échec borné, ambiguïté et impossibilité restent distincts | aucun raccord sans preuve de blocage ou reprise |
| C7 | **ouvert** | 333 tests, typecheck, build, câblage et harness ABBA présent | exécution des quatre runners et médianes par jeu sous +10 % |

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
- acquisition par le propriétaire sélectionné avant toute observation passive ;
- acquisition avant décision suivante ;
- transfert Agent vers Manual après règlement du retour en vol ;
- priorité du remplacement de jeu sur une simple demande Manual ;
- fermeture `disposed` stable pendant `pagehide`.

Le mode Manual reste direct et n’appelle aucune campagne Agent.

## Acquisition initiale adressée

### Besoin

Le runtime FieldStock produit démarrait vide. Il pouvait transporter et consommer
OP18 avec un stock injecté ou revalidé, mais ne pouvait pas construire son
premier modèle depuis un retour produit réel.

### Source de preuve

La nouvelle chaîne ne traite qu’une ACTION6 :

- déjà autorisée par un propriétaire explicite ;
- portant deux coordonnées entières publiques ;
- revenue dans le même niveau, le même compteur de niveaux terminés et le même
  état officiel ;
- observée après l’acquisition du propriétaire sélectionné.

Elle ne produit ni l’action ni ses coordonnées.

### Entités publiques

Les composantes visibles reçoivent une signature déterministe construite depuis
la palette, la taille et le masque local. La position absolue reste séparée.

La correspondance :

1. retire les occurrences exactement stationnaires ;
2. accepte seulement un résidu ancien et un résidu nouveau pour la même
   signature ;
3. conserve tout autre changement comme `unresolved` ;
4. n’utilise aucune proximité ou classification implicite.

Les modifications du grand composant de fond restent donc explicitement
inconnues et ne sont pas attribuées au mobile.

### Acquisition et calibration

`fitAddressedField()` n’acquiert le modèle qu’avec :

- un mouvement résiduel unique ;
- un exemplaire stationnaire de même signature ;
- un mobile rectangulaire ;
- une seule cible de même silhouette et palette différente ;
- une enceinte unique centrée autour de cette cible ;
- un point ACTION6 appartenant au corps déplacé.

Le même retour devient le premier échantillon de
`recordAddressedFieldResponse()`. Les retours suivants peuvent :

- relever la borne inférieure sur déplacement aligné ;
- enregistrer une borne supérieure sur réponse stationnaire ;
- réfuter le modèle sur déplacement vers une autre ancre ;
- rester non résolus sans mutation si la correspondance est ambiguë.

Après deux témoins alignés et une borne supérieure, une frontière officielle
convertit le modèle en prior compact avec `alignment_supported: true`.

### Ordre produit

La chaîne qualifiée est :

1. action physique du propriétaire sélectionné ;
2. retour public ;
3. acquisition avec le même `needId` par ce propriétaire ;
4. apprentissage passif FieldStock ;
5. frontière ou revalidation éventuelle ;
6. notification produit ;
7. présentation ;
8. décision suivante.

FieldStock ne vole pas le retour sélectionné, ne prétend pas avoir autorisé
l’action et ne peut pas proposer depuis le hook passif.

### Preuve

La preuve qualifiée démontre :

- déplacement `(1,1) → (2,1)` et acquisition du modèle ;
- déplacement `(2,1) → (3,1)` et deuxième témoin aligné ;
- ACTION6 distante sans mouvement et borne supérieure `16` ;
- frontière officielle et rétention du premier prior ;
- conservation des bornes et du support d’alignement ;
- apprentissage dans le vrai host navigateur seulement après l’acquisition du
  propriétaire ACTION6 explicite.

Disposition :

**acquisition, calibration et première rétention adressée démontrées depuis des
retours ACTION6 publics explicites ; le propriétaire produit de la première
action reste absent.**

## Chaîne OP18 produit

### Besoin

Un stock adressé retenu et revalidé laisse une demande typée insatisfaite alors
qu’ACTION6 est disponible.

### Production et consommation

`BrowserFieldStockCampaignTransport` construit le contexte depuis l’observation
publique, les lignes de palette, le niveau, le score, le runtime exact et un
budget borné.

`FieldStockCallerOwnerAdapter` :

- exécute `beforeStock()` ;
- expose la proposition et son bundle OP18 ;
- conserve le même `needId` ;
- acquiert le retour physique ;
- appelle `afterStock()` puis `recordStock()` ;
- modifie la proposition suivante.

La preuve navigateur produit ACTION6 `(3,1)`, acquiert son retour, puis produit
ACTION6 `(4,1)`.

Disposition OP18 :

**transport, release, action, retour, acquisition et effet sur la décision
suivante démontrés dans le produit lorsqu’un stock courant revalidé existe. Le
prior peut maintenant provenir de la chaîne publique d’acquisition, mais aucune
première ACTION6 autonome n’est encore générée.**

## Chaîne OP28 produit

Le fallback public strict produit une proposition uniquement lorsque
l’observation expose exactement une action simple distincte hors RESET et ne
requiert aucune coordonnée manquante.

ACTION6 seule sans coordonnées ne produit rien. Plusieurs actions publiques
produisent `none`. Plusieurs propriétaires produisent `ambiguous`. Aucun
fallback n’est autorisé.

La mesure supplémentaire des composantes n’est pas exécutée sur le chemin OP28
simple. Elle reste limitée aux revalidations de prior et aux retours ACTION6
explicitement évalués.

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
| OP18 | **chaîne produit transportée et consommée ; chemin initial vers le prior qualifié** | modèle acquis depuis retour ACTION6 externe, calibré, retenu, revalidable puis consommable ; premier propriétaire ACTION6 absent |
| OP19 | calcul qualifié, usage produit non démontré | aucun préfixe forcé prouvé produit |
| OP20 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’objet liée à une stratégie active |
| OP21 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’espace liée à un objectif actif |
| OP22 | calcul qualifié, usage produit non démontré | aucun effet distant attribué et consommé transversalement |
| OP23 | calcul qualifié, usage produit non démontré | aucun cycle autonome prouvé n’alimente un plan réel |
| OP24 | calcul qualifié, usage produit non démontré | aucun générateur de chemins alternatifs vérifiés |
| OP25 | calcul qualifié, usage produit non démontré | non-réfutation conservée sans fausse preuve de faisabilité |
| OP26 | manquante ou recouverte familialement | aucun domaine commun d’accès vérifiés vers une cible |
| OP27 | calcul qualifié, usage produit non démontré | aucune permutation avec préservation complète |
| OP28 | **chaîne produit active sous condition stricte** | bundle admis, action physique, même `needId`, acquisition avant suite ; aucune coordonnée ACTION6 inventée |
| OP29 | fonction spécialisée démontrée | réponses adressées, `afterStock()` et Region comparent les retours utiles |
| OP30 | fonction spécialisée démontrée | rétention, `recordStock()` et Region changent les connaissances futures |
| OP31 | appel générique disponible, contribution absente | aucun propriétaire d’objectif produit ne maintient ou réoriente la suite |

## Qualification

### Tranche FieldStock précédente

- état combiné qualifié : `70943d5715e7e44680ab307f0e8ddca27dd020aa` ;
- régression complète : **330/330** ;
- typecheck et build : réussis.

### Acquisition adressée publique

- run GitHub Actions : `43357819760` ;
- job : `131663946577` ;
- commit qualifié : `99c1d23353dbfec3e98c3770fee362b757ec2701` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression complète : **333/333** ;
- échecs, annulations, tests ignorés et TODO : `0` ;
- build de production : réussi ;
- modules transformés : `56` ;
- galerie : 100 jeux, 636 prévisualisations, 4 atlas natifs ;
- câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `24`.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées par `npm ci`.

## Performance

Critère : la médiane de session complète de chaque jeu doit augmenter de
strictement moins de 10 %. STCK et SMLP restent séparés.

Le chemin OP28 simple ne matérialise pas les composantes publiques ajoutées. Le
coût nouveau est limité aux retours ACTION6 évalués pour apprentissage et aux
revalidations de prior déjà prévues.

Cette limitation structurelle, le build et les tests ne remplacent pas les
mesures de session complète. Le manifeste, les références A/B et le harness
ABBA Worker/Pyodide sont présents, mais les quatre mesures restent à exécuter.

Verdict : **fonctionnellement qualifié, coût officiel à confirmer.**

C7 exige encore A/STCK, A/SMLP, B/STCK et B/SMLP avec provenance, échantillons
et médianes publiés.

## Limites ouvertes

- aucun propriétaire produit ne justifie encore la première ACTION6 adressée ;
- aucune persistance du modèle, du prior ou du stock entre activations Agent ;
- snapshot/restauration de la campagne, du `needId` et de l’action en attente non
  raccordés au produit ;
- Region n’est pas encore un propriétaire physique du contrôleur produit ;
- aucun propriétaire OP31 ;
- performance C7 non close ;
- aucune publication Site dans cette tranche.

## Feuille de route actualisée

### Étape immédiate : propriétaire initial et continuité

1. identifier un besoin réel produisant des coordonnées ACTION6 depuis la seule
   observation publique ;
2. enregistrer ce producteur comme propriétaire neutre sans priorité implicite ;
3. démontrer que ses retours alimentent l’acquisition et la rétention ici
   qualifiées ;
4. ajouter snapshot/restauration atomiques du modèle, du prior, du stock, du
   propriétaire commun et du retour en attente ;
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
