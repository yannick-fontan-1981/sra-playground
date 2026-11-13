# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique de la tranche hôte navigateur :
  `8cc510e0a0d09704eb508b3aa2216b4d63482af4`
- Branche de travail :
  `op01-op31-browser-campaign-host-20261112`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur à la première consolidation :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Lot 6 et seam Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Réconciliation Lot 5 et chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun et retour corrélé :
  `docs/recovery/op01-op31-common-campaign-owner-20261112.md`
- Hôte produit/browser et acquisition avant présentation :
  `docs/recovery/op01-op31-browser-campaign-host-20261112.md`

Le présent fichier est l’état courant consolidé. Les versions précédentes
restent disponibles dans Git afin de conserver toutes les preuves, mesures et
décisions antérieures.

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

Un compteur, un import ou une trace sans consommateur ne suffisent pas. Aucune
opération n’est ajoutée pour atteindre artificiellement 31 appels.

## Provenance et limites historiques

Le worker et plusieurs composants runtime présents dans la reconstruction ne
prouvent pas une identité binaire avec le Site 109 historique. La provenance et
les limites sont conservées dans les documents de recovery.

Les composants FieldStock et matériaux adressés sont des reconstructions
qualifiées à partir des sources donneuses, des contrats publics et des tests de
parité disponibles.

La campagne commune, le seam navigateur et les tests actuels démontrent des
contrats dans le runtime reconstruit. Ils ne prouvent pas une parité totale avec
V5, V6 ou V7 historiques.

Le benchmark officiel complet n’est pas encore restauré sous une forme
permettant de clore les quatre mesures A/STCK, A/SMLP, B/STCK et B/SMLP.

Statut global :

**intégration fonctionnelle qualifiée sur les seams reconstruits, coût officiel
à confirmer.**

## Architecture runtime pertinente

### Transport public et présentation

- `src/runtime/browser-games.ts` : transport jeu navigateur et retour public ;
- `src/runtime/contracts.ts` : protocole `AgentObservation` / `AgentAction` ;
- `src/runtime/v6-browser-agent-observation.ts` : conversion stricte du cadre
  public 64 × 64 et séquences monotones ;
- `src/agent-product-dispatch.ts` : disponibilité, génération, `busy`, timing,
  ACTION6 et erreur ;
- `src/product-presentation-effects.ts` : présentation et effets DOM bornés ;
- `src/runtime/v6-browser-common-campaign-host.ts` : couture entre campagne
  commune, dispatch physique, acquisition du retour et présentation.

### Autorité Logos et campagne commune

- `src/logos-engine/v6-native-authority.ts` : besoin, exécution et admission ;
- `src/logos-engine/v6-neutral-common-caller.ts` : collecte neutre,
  ambiguïté, routage et déduplication ;
- `src/logos-engine/v6-common-campaign-owner.ts` : propriété de la décision,
  release, attente et corrélation du retour ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` : fallback OP28
  strict ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` : propriétaire OP18 et
  retour spécialisé FieldStock.

### Modèles spécialisés

- `src/runtime/observed-addressed-material-runtime.ts` : rétention et
  revalidation du matériau adressé ;
- `src/logos-engine/field-stock.ts` : question, plan borné, ACTION6,
  préservation et bundle OP18 ;
- composants Region : apprentissage spécialisé, acquisition, déduplication et
  effet sur les propositions futures, sans contrat physique commun complet.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **campagne commune et seam produit/browser qualifiés** | collecte bornée, ambiguïté, release, attente, même `needId`, acquisition avant présentation | créer le contrôleur explicite du mode Agent et mesurer son activation |
| C2 | **OP18 jusqu’à la décision suivante ; OP28 jusqu’au retour physique acquis** | FieldStock modifie la proposition suivante ; OP28 traverse observation, dispatch et retour | constructeur de contexte produit FieldStock et propriétaire OP31 |
| C3 | **calculs et recouvrements qualifiés** | OP03/04/08/09/11/12/14/26 auditables ; spécialisations identifiées | appeler uniquement depuis un producteur runtime réel |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur réels |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent notamment OP06/29/30 avec effet futur | donner à Region un bundle/action Logos complet ; raccorder les autres besoins réels |
| C6 | **audit complet** | inconnue, échec borné et impossibilité restent distincts | aucun raccordement sans preuve de blocage, reprise ou variante |
| C7 | **ouvert** | régressions, diagnostics et runners candidats disponibles | manifeste complet, quatre runners et médianes par jeu strictement sous +10 % |

## Chaîne OP18 reconstruite : FieldStock

### Besoin

Un stock adressé retenu a été revalidé dans la scène courante. Une demande typée
reste insatisfaite et ACTION6 est publiquement disponible.

### Production

`FieldStock.propose()` produit :

- une question ouverte mesurable ;
- une composition non observée ;
- un plan borné ;
- des actions ACTION6 coordonnées ;
- les faits et preuves de scène ;
- des obligations de préservation ;
- un bundle OP18 avec garde de résultat.

### Appel, retour et décision suivante

`FieldStockCallerOwnerAdapter` exécute `beforeStock()` avant exposition. La
campagne commune conserve une proposition unique, produit le besoin, exécute
OP18 et consomme son résultat dans `operationAdmission()`.

Le même `needId` est conservé jusqu’au retour. Le retour est routé uniquement à
FieldStock :

- `afterStock()` compare le résultat ;
- `recordStock()` confirme, apprend, enregistre un échec ou réfute ;
- un doublon exact est ignoré ;
- une autre révision ou un autre besoin est rejeté.

Scénario démontré :

1. matériau type 2 en `(1,1)` ;
2. ACTION6 vers `(3,1)` ;
3. retour confirmé et déplacement enregistré ;
4. proposition suivante vers `(4,1)`.

Disposition OP18 : **chaîne complète démontrée en bibliothèque jusqu’au
consommateur spécialisé et à la décision suivante.**

Le nouveau seam navigateur peut transporter cette famille, mais le constructeur
qui dérive un vrai `FieldStockCampaignContext` de chaque observation produit
n’est pas encore raccordé.

## Chaîne OP28 produit/browser

Pour le contrat strict où l’observation publique expose exactement une action
simple distincte hors RESET :

1. `BrowserAgentObservationStream` produit l’observation agent ;
2. le transport OP28 fournit le contexte au propriétaire ;
3. la campagne construit et fait admettre le bundle ;
4. `dispatchProductAction()` exécute l’action par le runtime navigateur ;
5. la réponse est convertie en observation agent suivante ;
6. le retour est acquis avec le même `needId` ;
7. l’acquisition précède la présentation ;
8. la décision suivante utilise l’observation acquise.

ACTION6 seule ne produit rien dans ce fallback car ses coordonnées sont
inconnues. Plusieurs actions publiques restent sans proposition. Aucune
perception ou planification générale n’est revendiquée.

Disposition OP28 : **chaîne produit/browser complète démontrée sous condition
stricte.**

## Neutralité et autorité

`BrowserCommonCampaignHost` ne classe pas les propositions et ne fabrique aucun
bundle :

- zéro proposition → `none` ;
- une proposition → validation puis autorité Logos ;
- plusieurs propositions → `ambiguous` ;
- bundle refusé → `blocked` ;
- action autorisée → dispatch puis attente du retour ;
- retour physique → acquisition propriétaire avant présentation.

Le host exige une correspondance exacte entre propriétaires et transports. Il
refuse une observation copiée mais périmée, annule une décision non réglée sur
échec ou obsolescence et invalide une réponse d’une session remplacée.

Les clics Manual ne traversent pas ce host. `main.ts` ne l’instancie pas encore.
L’onglet Agent ne revendique donc pas prématurément une boucle SRA active.

## Disposition des 31 opérations

| OP | Disposition courante | Producteur/consommateur démontré ou dette précise |
| --- | --- | --- |
| OP01 | calcul qualifié, usage produit non démontré | aucun regroupement structurel consommé par le runtime courant |
| OP02 | calcul qualifié, usage produit non démontré | aucun domaine complet de chemins équivalents produit et consommé |
| OP03 | producteur générique manquant | les préconditions spécialisées restent dans leurs gardes familiales |
| OP04 | calcul qualifié, usage produit non démontré | aucun réseau d’ouvertures commun consommé par une stratégie réelle |
| OP05 | calcul qualifié, usage produit non démontré | l’ambiguïté de campagne est structurelle, sans appel artificiel à OP05 |
| OP06 | fonction spécialisée démontrée | contradictions FieldStock/Region révisent ou bloquent les propositions futures |
| OP07 | producteur runtime manquant | aucune frontière commune reliée à un objectif ouvert n’est produite |
| OP08 | manquante ou recouverte familialement | pas de graphe transversal fiable `effect → requires` consommé |
| OP09 | calcul qualifié, usage produit non démontré | aucune preuve de domaine complet d’alternatives dans le runtime courant |
| OP10 | calcul qualifié, usage produit non démontré | aucun propriétaire de buts terminaux ne consomme son résultat |
| OP11 | calcul qualifié, usage produit non démontré | aucun réseau commun de déblocages n’est produit puis choisi |
| OP12 | manquante ou recouverte familialement | les inconnues spécialisées sont traitées sans chaîne générique démontrée |
| OP13 | calcul qualifié, consommateur générique absent | la portée reste spécialisée et bornée par les modèles de famille |
| OP14 | admission bridge présente, release native absente | aucun besoin produit ne justifie encore son autorité physique |
| OP15 | calcul qualifié, usage produit non démontré | aucun sélecteur réel d’objectif intermédiaire ne le consomme |
| OP16 | calcul qualifié, usage produit non démontré | aucun producteur de blocage global prouvé |
| OP17 | calcul qualifié, usage produit non démontré | aucune reprise autorisée avec préservation complète n’est produite |
| OP18 | **chaîne complète FieldStock démontrée** | besoin, bundle, admission, action, retour spécialisé et décision suivante |
| OP19 | calcul qualifié, usage produit non démontré | aucun préfixe forcé prouvé n’est produit par le runtime actuel |
| OP20 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’objet liée à une stratégie active |
| OP21 | calcul qualifié, usage produit non démontré | aucune question d’utilité d’espace liée à un objectif actif |
| OP22 | calcul qualifié, usage produit non démontré | aucun effet distant attribué et consommé transversalement |
| OP23 | calcul qualifié, usage produit non démontré | aucun cycle autonome prouvé n’alimente un plan réel |
| OP24 | calcul qualifié, usage produit non démontré | aucun générateur de chemins alternatifs vérifiés n’est raccordé |
| OP25 | calcul qualifié, usage produit non démontré | non-réfutation conservée sans fausse preuve de faisabilité |
| OP26 | manquante ou recouverte familialement | aucun domaine commun de plusieurs accès vérifiés vers une cible |
| OP27 | calcul qualifié, usage produit non démontré | aucune permutation avec preuves complètes de préservation |
| OP28 | **chaîne produit/browser stricte démontrée** | bundle admis, dispatch physique, même `needId`, acquisition avant présentation |
| OP29 | fonction spécialisée démontrée | `afterStock()` et analyses Region comparent les retours utiles |
| OP30 | fonction spécialisée démontrée | `recordStock()` et Region modifient durablement les propositions futures |
| OP31 | appel générique disponible, contribution absente | aucun propriétaire d’objectif produit ne maintient, suspend ou réoriente la suite |

## Tests et qualification

Tranche hôte navigateur :

- `src/runtime/v6-browser-common-campaign-host.ts` ;
- `tests/v6-browser-common-campaign-host.test.ts`.

Preuves ajoutées :

- même `needId` de la release à l’acquisition ;
- acquisition avant présentation ;
- aucune double décision pendant une attente ;
- ACTION6 conserve aussi les coordonnées nulles en valeur ;
- absence de besoin lorsque le produit n’est pas prêt ;
- refus d’une observation périmée ;
- ambiguïté sans dispatch ;
- annulation sur obsolescence ou échec ;
- invalidation d’une réponse d’ancienne session ;
- correspondance exacte propriétaire/transport ;
- décision suivante fondée sur le retour acquis.

Qualification GitHub Actions :

- run : `43348635198` ;
- job : `131633987557` ;
- commit qualifié : `8a73045e594bac9892f8846564b76c367c5fcccd` ;
- baseline canonique : `8cc510e0a0d09704eb508b3aa2216b4d63482af4` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression complète : **300/300 tests réussis** ;
- câblage : `logos-product-wiring-present`.

Le workflow de qualification est temporaire et doit être supprimé avant
intégration canonique.

Deux vulnérabilités de dépendances de sévérité haute préexistantes sont signalées
par `npm ci`. Cette tranche ne les introduit ni ne les corrige.

## Performance

Critère conservé : pour chaque jeu de référence, la médiane de session complète
doit augmenter de strictement moins de 10 %. STCK et SMLP restent séparés ; un
jeu ne compense pas l’autre.

Le host n’est pas instancié dans `main.ts` et ne s’exécute dans aucune session
utilisateur actuelle. Cette tranche de bibliothèque n’ajoute donc pas de coût au
chemin actif. Un micro-benchmark isolé ne remplacerait pas la qualification de
session complète requise.

Verdict : **fonctionnellement qualifié, coût d’activation à confirmer**.

La qualification officielle doit suivre l’activation d’un contrôleur Agent et
des vrais contextes propriétaires, sur les quatre runners du manifeste C7.

## Limites encore ouvertes

- aucun contrôleur Agent ne possède encore la boucle produit ;
- `main.ts` ne crée pas le host ;
- FieldStock n’a pas de constructeur de contexte depuis l’observation produit ;
- Region n’a pas de contrat physique commun complet ;
- les acquisitions passives multi-propriétaires ne sont pas orchestrées par le
  host ;
- les actions communes en attente n’ont pas de snapshot/restauration ;
- aucun propriétaire OP31 n’est raccordé ;
- les états non représentables par le protocole agent restent refusés ;
- la performance officielle C7 reste ouverte ;
- aucune publication Site n’est effectuée.

## Feuille de route actualisée

### Étape immédiate : contrôleur Agent explicite

1. créer une session `BrowserCommonCampaignHost` après chargement du jeu ;
2. l’exécuter uniquement lorsque le mode Agent est explicitement actif ;
3. conserver le chemin Manual totalement séparé ;
4. exécuter au plus une campagne à la fois ;
5. arrêter sur `none`, `ambiguous`, `blocked`, terminal ou erreur ;
6. ne jamais substituer une action par défaut à l’absence de proposition.

### Étape suivante : producteurs réels

1. construire `FieldStockCampaignContext` depuis les observations publiques et
   les connaissances déjà revalidées ;
2. raccorder FieldStock au transport navigateur générique ;
3. compléter le contrat physique Region avant son enregistrement ;
4. identifier un vrai propriétaire d’objectif avant toute activation OP31.

### Qualification et publication

1. exécuter les régressions fonctionnelles ;
2. compléter le manifeste des quatre runners ;
3. mesurer A/STCK, A/SMLP, B/STCK et B/SMLP séparément ;
4. conserver strictement moins de +10 % de médiane par jeu ;
5. intégrer sur la branche canonique GitHub ;
6. publier le Site seulement lorsque le code correspondant est durablement sur
   GitHub ;
7. vérifier ensuite GitHub ↔ Site.

Aucune publication Site n’appartient à la tranche courante.
