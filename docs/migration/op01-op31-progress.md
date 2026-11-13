# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 13 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Canonique Lot 9C2 de référence :
  `342d14b990169e292ec1078cef3ef297302b2baa`
- Branche de travail :
  `op01-op31-browser-public-action6-owner-20261113`
- Merge de réconciliation Lot 9C2 :
  `a723eac529643374f77b58e24e8ad16120d13923`
- Candidat fonctionnel qualifié :
  `e821e3221b049b59bc65fe4ea18fad9d3dc13246`
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
- Contrôleur Agent :
  `docs/recovery/op01-op31-browser-agent-controller-20261112.md`
- Transport FieldStock navigateur :
  `docs/recovery/op01-op31-browser-field-stock-transport-20261112.md`
- Acquisition adressée publique :
  `docs/recovery/op01-op31-browser-addressed-acquisition-20261113.md`
- Propriétaires ACTION6 publics produit :
  `docs/recovery/op01-op31-browser-public-action6-owner-20261113.md`
- Lot 9C2 public conjoint :
  `docs/recovery/lot9c2-public-addressed-joint-channels.md`
- Qualification officielle C7 :
  `docs/recovery/op01-op31-official-readiness-status.md`
- Preuve officielle Region :
  `docs/recovery/lot9b-official-abba-performance-qualified.json`

Le présent fichier décrit l’état courant consolidé. Les versions antérieures
restent dans Git et dans les rapports de recovery afin de préserver les preuves
détaillées.

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
- quatre propriétaires navigateur pairs : FieldStock OP18, propriétaire conjoint
  SMLP OP28, propriétaire strict STCK OP28 et fallback simple OP28 ;
- un chemin Manual séparé ;
- une mesure publique différée des entités ;
- une acquisition passive du premier modèle adressé depuis un retour ACTION6 ;
- une calibration par réponses corrélées et une rétention prudente ;
- une qualification causale réelle du propriétaire conjoint SMLP sur le corpus
  natif seed 0 ;
- une qualification fonctionnelle produit des propriétaires ACTION6 SMLP/STCK ;
- une qualification C7 officielle du hook Region natif sur STCK et SMLP.

Le contrôleur produit utilise uniquement le seam navigateur direct. Le Worker
reste disponible pour les autres runtimes et les tests, mais n’est pas instancié
par `main.ts`.

Statut global :

**OP28 est active dans le produit pour une action simple, une décision conjointe
SMLP et une carte STCK publique unique ; OP18 est transportée et consommée avec
un stock revalidé ; les retours ACTION6 sélectionnés traversent l’acquisition du
propriétaire puis l’observation passive FieldStock ; C7 reste clos pour le
protocole Region STCK/SMLP. La continuité entre activations, une campagne produit
réelle complète, le coût ciblé de la nouvelle composition et OP31 restent
ouverts.**

Cette reconstruction ne prouve ni une identité binaire avec Site 109, ni une
parité totale V5/V6/V7, ni la présence d’un registre canonique complet des 76
points d’entrée V6.

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
- `src/runtime/v6-browser-common-campaign-host.ts` : dispatch, acquisition,
  observations passives, revalidation et présentation ;
- `src/runtime/v6-browser-product-campaign-host.ts` : composition active des
  quatre propriétaires pairs ;
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
- `src/logos-engine/v6-joint-channel-owner.ts` ;
- `src/logos-engine/v6-public-addressed-joint-channels.ts` ;
- `src/logos-engine/v6-public-unique-stck-action6-port.ts` ;
- `src/logos-engine/v6-public-unique-stck-action6-caller-adapter.ts` ;
- `src/logos-engine/addressed-field-fit.ts` ;
- `src/logos-engine/addressed-field-response.ts` ;
- `src/logos-engine/addressed-field-retention.ts` ;
- `src/logos-engine/field-stock.ts`.

## État C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés et dispositions explicites | maintenir les statuts par besoin |
| C1 | **contrôleur produit actif et qualifié** | campagne unique, même `needId`, acquisition sélectionnée avant observation passive, transfert Manual gracieux | snapshot/restauration de la campagne, des propriétaires et du retour en attente |
| C2 | **OP18 et OP28 actives ; premières ACTION6 produit qualifiées** | SMLP joint consomme deux contributions ; STCK produit une coordonnée avec une carte unique ; retour acquis avant observation passive | campagne produit réelle complète, continuité et propriétaire OP31 |
| C3 | **calculs et recouvrements qualifiés** | OP03/04/08/09/11/12/14/26 auditables | appeler uniquement depuis un producteur réel |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | aucun raccord artificiel |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur | propriétaire physique Region et seconde contribution STCK réellement indépendante |
| C6 | **audit complet** | inconnue, échec borné, ambiguïté et impossibilité restent distincts | aucun raccord sans preuve de blocage ou reprise |
| C7 | **performance officielle qualifiée pour Region STCK/SMLP** | protocole ABBA durable, quatre runners, deux jeux strictement sous +10 %, activité Region conservée | mesurer séparément la nouvelle composition produit sans réécrire la preuve Region |

## Contrôleur Agent produit

`BrowserAgentController` est activé uniquement après sélection explicite du mode
Agent. Il utilise la composition de `v6-browser-product-campaign-host.ts` et
n’instancie pas le Worker.

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

## Premières ACTION6 produit

### SMLP : propriétaire conjoint

Le propriétaire conjoint SMLP consomme deux contributions distinctes :

1. ACTION6 est disponible dans l’observation courante ;
2. une porte visible est revalidée et fournit ses coordonnées publiques.

Les deux contributions doivent partager le même `jointRef` et la même action.
Supprimer l’une d’elles supprime la proposition. Le retour sélectionné est acquis
par les deux canaux avec le même `needId`.

Le Lot 9C2 conserve sa qualification row-major sur le corpus natif SMLP seed 0.
Le produit navigateur emploie une variante plus stricte : exactement une porte
qualifiée est exigée. Plusieurs portes visibles produisent `none`, sans classement
local.

### STCK : carte publique unique

Le propriétaire STCK examine uniquement le frame public 64 × 64 et exige une
seule carte qualifiée dans la pile gauche. La coordonnée est le centre public du
corps de carte. Plusieurs cartes restent non résolues.

Il ne réutilise pas la règle de benchmark « carte la plus basse », ne lit aucun
état moteur et n’importe aucune solution préparée.

### Ordre produit

La chaîne active est :

1. besoin public borné ;
2. données publiques produites ;
3. proposition propriétaire ;
4. bundle OP28 et autorité Logos ;
5. ACTION6 physique ;
6. retour public corrélé ;
7. acquisition avec le même `needId` par le propriétaire sélectionné ;
8. observation passive FieldStock ;
9. notification produit ;
10. présentation ;
11. décision suivante.

La preuve produit vérifie que l’observation passive a lieu mais ne crée ni modèle,
ni prior, ni stock lorsque le retour reste insuffisant pour `fitAddressedField()`.

## Acquisition initiale adressée

Le runtime FieldStock peut toujours acquérir un premier modèle depuis une suite
de retours ACTION6 publics lorsque les conditions strictes sont réunies :

- mouvement résiduel unique ;
- exemplaire stationnaire de même signature ;
- mobile rectangulaire ;
- cible unique de même silhouette et palette différente ;
- enceinte centrée unique ;
- point ACTION6 appartenant au corps déplacé.

Les correspondances ambiguës restent `unresolved`. Après deux témoins alignés et
une borne supérieure, une frontière officielle peut convertir le modèle en prior
compact avec `alignment_supported: true`.

Les nouveaux propriétaires rendent désormais possible l’origine produit de
certains retours ACTION6, mais chaque retour reste soumis aux gardes historiques.
Aucune connaissance n’est créée simplement parce qu’une action a été exécutée.

## Chaîne OP18 produit

Un stock adressé retenu et revalidé laisse une demande typée insatisfaite alors
qu’ACTION6 est disponible.

`FieldStockCallerOwnerAdapter` :

- exécute `beforeStock()` ;
- expose la proposition et son bundle OP18 ;
- conserve le même `needId` ;
- acquiert le retour physique ;
- appelle `afterStock()` puis `recordStock()` ;
- modifie la proposition suivante.

La preuve navigateur historique produit ACTION6 `(3,1)`, acquiert son retour,
puis produit ACTION6 `(4,1)`.

Disposition OP18 :

**transport, release, action, retour, acquisition et effet sur la décision
suivante démontrés lorsqu’un stock courant revalidé existe. Les retours initiaux
peuvent désormais provenir de propriétaires produit publics bornés.**

## Chaîne OP28 produit

Trois formes OP28 sont actives sous des contrats distincts :

1. action publique simple unique, sans coordonnée ;
2. décision conjointe SMLP avec disponibilité et cible visible ;
3. ACTION6 STCK avec une carte publique unique.

ACTION6 sans coordonnées et sans producteur spécialisé ne produit rien. Plusieurs
cibles spécialisées produisent `none`. Plusieurs propriétaires indépendants
produisent `ambiguous`. Aucun fallback ne masque ces états.

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
| OP18 | **chaîne produit transportée et consommée** | modèle adressé acquis depuis retours corrélés, retenu, revalidable puis consommable ; nouveaux retours produit possibles mais toujours soumis aux gardes |
| OP19 | calcul qualifié, usage produit non démontré | aucun préfixe forcé prouvé produit |
| OP20 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’objet liée à une stratégie active |
| OP21 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’espace liée à un objectif actif |
| OP22 | calcul qualifié, usage produit non démontré | aucun effet distant attribué et consommé transversalement |
| OP23 | calcul qualifié, usage produit non démontré | aucun cycle autonome prouvé n’alimente un plan réel |
| OP24 | calcul qualifié, usage produit non démontré | aucun générateur de chemins alternatifs vérifiés |
| OP25 | calcul qualifié, usage produit non démontré | non-réfutation conservée sans fausse preuve de faisabilité |
| OP26 | manquante ou recouverte familialement | aucun domaine commun d’accès vérifiés vers une cible |
| OP27 | calcul qualifié, usage produit non démontré | aucune permutation avec préservation complète |
| OP28 | **chaînes produit actives sous conditions strictes** | fallback simple, SMLP conjoint et STCK unique : bundle admis, action physique, même `needId`, acquisition avant suite |
| OP29 | fonction spécialisée démontrée | réponses adressées, `afterStock()` et Region comparent les retours utiles |
| OP30 | fonction spécialisée démontrée | rétention, `recordStock()` et Region changent les connaissances futures |
| OP31 | appel générique disponible, contribution absente | aucun propriétaire d’objectif produit ne maintient ou réoriente la suite |

## Qualification combinée

### Propriétaires produit ACTION6

- run GitHub Actions : `43362500453` ;
- job : `131679075165` ;
- candidat : `e821e3221b049b59bc65fe4ea18fad9d3dc13246` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- typecheck : réussi ;
- régression TypeScript complète : **363/363** ;
- échecs, annulations, tests ignorés et TODO : `0` ;
- build de production : réussi ;
- modules transformés : `62` ;
- galerie : 100 jeux, 636 prévisualisations, 4 atlas natifs ;
- câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `25`.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées par `npm ci`.

### Portée fonctionnelle

La qualification combinée démontre :

- activation du propriétaire conjoint SMLP dans le host produit ;
- consommation des deux contributions causales avant ACTION6 ;
- acquisition du même retour et du même `needId` par les deux canaux ;
- refus produit de plusieurs portes SMLP ;
- production STCK uniquement avec une carte publique unique ;
- refus de plusieurs cartes STCK et des jeux non supportés ;
- ordre action → acquisition sélectionnée → observation passive → présentation ;
- absence d’apprentissage FieldStock forcé sur un retour insuffisant.

Elle ne constitue pas encore une campagne navigateur complète contre Pyodide ni
une qualification native complète du producteur STCK.

### C7 officiel Region

La preuve officielle durable conserve :

- protocole `A1 → B1 → B2 → A2` ;
- 40 invocations ;
- 32 sessions et 400 actions mesurées ;
- aucun échantillon supprimé ;
- aucun retry caché ;
- **STCK : A 54,5 ms, B 58,4 ms, +7,155963 % — accepté** ;
- **SMLP : A 123,95 ms, B 118,15 ms, −4,679306 % — accepté**.

Le seuil reste strictement inférieur à `+10 %` pour chaque jeu séparément.
L’activité Region reste présente dans le candidat mesuré.

Disposition C7 :

**performance officielle qualifiée pour le hook Region natif sur STCK et SMLP.**

Cette qualification ne prouve pas la parité totale des 76 points d’entrée V6 et
ne mesure pas la nouvelle composition produit.

## Performance de la nouvelle composition

Les nouveaux producteurs SMLP/STCK sont maintenant actifs dans le host produit.
Leur coût n’appartient pas à l’ancienne mesure Region C7 et n’est pas encore
qualifié séparément.

Le contexte produit SMLP s’arrête après deux portes visibles et le producteur
STCK s’arrête après deux cartes qualifiées, ce qui borne les refus d’ambiguïté.
Cette propriété structurelle ne remplace pas une mesure de session complète.

Le coût ciblé non mesuré ne réouvre pas C7 pour son périmètre Region déjà
qualifié, mais bloque une revendication de performance pour la nouvelle
composition produit.

## Limites ouvertes

- aucune campagne navigateur produit complète SMLP/STCK qualifiée contre le
  transport Pyodide réel ;
- STCK ne possède pas encore deux contributions causales indépendantes ;
- aucune persistance du modèle, du prior ou du stock entre activations Agent ;
- snapshot/restauration de la campagne, des propriétaires, du `needId` et de
  l’action en attente non raccordés au produit ;
- Region n’est pas encore un propriétaire physique du contrôleur produit ;
- aucun propriétaire OP31 ;
- registre canonique des 76 points d’entrée V6 absent ;
- coût ciblé de la nouvelle composition produit non mesuré séparément ;
- aucune publication Site dans cette tranche.

## Feuille de route actualisée

### Étape immédiate : campagne produit réelle

1. exécuter une campagne navigateur bornée sur SMLP avec le propriétaire conjoint
   réellement actif contre le transport Pyodide ;
2. vérifier le même `needId` du besoin jusqu’aux deux acquisitions de canal ;
3. confirmer l’ordre acquisition sélectionnée → observation passive →
   présentation sur les observations réelles ;
4. conserver `none` lorsque plusieurs portes publiques subsistent ;
5. publier la provenance et les résultats sans transformer cette campagne en
   preuve de performance.

### Étape suivante : STCK et continuité

1. qualifier le producteur STCK sur son corpus natif ;
2. rechercher une seconde contribution réellement indépendante avant toute
   généralisation conjointe STCK ;
3. ajouter snapshot/restauration atomiques de la campagne, des propriétaires, du
   modèle, du prior, du stock et du retour en attente ;
4. vérifier une réactivation Agent sans perte ni double consommation.

### Performance et élargissement symbolique

1. mesurer séparément le coût de la composition produit active ;
2. compléter le propriétaire physique Region ;
3. généraliser les observations passives avec déduplication explicite ;
4. identifier un propriétaire d’objectif réel avant OP31 ;
5. reconstruire séparément le registre des 76 points d’entrée si une revendication
   de compteur ou de parité devient nécessaire.

### Publication

1. intégrer chaque tranche qualifiée sur GitHub canonique ;
2. publier le Site uniquement depuis un commit GitHub canonique qualifié ;
3. vérifier ensuite GitHub ↔ Site.
