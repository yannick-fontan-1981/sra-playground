# OP01–OP31 — propriétaire commun de campagne et retour corrélé

Date : 12 novembre 2026

Branche de travail :
`op01-op31-common-campaign-owner-20261112`

Baseline canonique de départ :
`recovery/site109-reconstruction-20261112` au commit
`87a538a1c776fb974a1767f30fea735aac28ded9`.

Baseline canonique réconciliée avant qualification finale :
`6304bec8c99a05b0023692f8fe7f432394acaa11`.

Commit de réconciliation, baseline canonique premier parent :
`ed032442acdeb7c703e8f40917099184aa459ada`.

Plan stable :
`docs/migration/op01-op31-verification-plan.md`.

## Objectif

Cette étape construit le plus petit propriétaire commun capable de conserver la
chaîne suivante sans inventer de perception, de classement ou d’autorité :

**observation publique → propositions propriétaires → ambiguïté ou sélection
unique → bundle Logos → action → retour public corrélé → consommateur exact →
effet sur la décision suivante.**

Le propriétaire commun ne fusionne pas les états internes des familles et ne
classe pas leurs propositions. Il fournit uniquement :

- une collecte bornée ;
- une sélection structurelle lorsque le domaine contient exactement une
  proposition ;
- une ambiguïté explicite lorsqu’il en contient plusieurs ;
- une autorisation physique par le Logos Engine ;
- une corrélation `sessionId` / proposition / bundle / action / `needId` ;
- un retour routé au propriétaire exact ;
- une déduplication du même retour physique.

## Composants ajoutés

### `v6-common-campaign-owner.ts`

Le propriétaire commun :

- accepte des propriétaires conformes à `CommonCallerOwner` ;
- n’appelle aucune OP lorsqu’aucune proposition n’existe ;
- conserve plusieurs propositions sous le statut `ambiguous` ;
- ne soumet à `releaseBundle()` qu’une proposition structurellement unique ;
- valide session, observation, révision, action publique et appartenance de
  l’action au bundle ;
- conserve au plus une action en attente par session ;
- refuse une nouvelle décision tant que le retour de l’action précédente n’a
  pas été acquis ;
- exige le même `needId` au retour ;
- route le retour au seul propriétaire sélectionné ;
- ignore un doublon exact déjà acquis ;
- rejette un retour contradictoire pour un besoin déjà réglé ;
- borne les sessions en attente et les besoins réglés conservés.

### `v6-public-single-action-caller-adapter.ts`

Cet adaptateur expose le fallback OP28 existant au propriétaire commun :

- une seule action simple publique distincte hors RESET ;
- aucune ACTION6 sans coordonnées ;
- aucune décision lorsqu’il existe plusieurs choix ;
- aucun apprentissage sur le retour.

Il permet de vérifier le transport commun sans transformer ce fallback en
planificateur général.

### `v6-field-stock-caller-adapter.ts`

Cet adaptateur raccorde le premier producteur symbolique spécialisé complet :

- `ObservedAddressedMaterialRuntime.proposeStock()` produit une proposition
  bornée ;
- `beforeStock()` revalide le stock, la scène et le préfixe avant exposition ;
- la première action ACTION6 mesurée est convertie en `AgentAction` ;
- le bundle OP18 est reconstruit à la révision courante ;
- l’état symbolique conserve question, faits, objectif et éventuelles preuves
  de préservation ;
- le retour est corrélé au même `needId` ;
- `afterStock()` compare le résultat ;
- `recordStock()` confirme, apprend, enregistre un échec ou réfute la règle.

Le propriétaire commun n’appelle donc pas OP29 ou OP30 de façon redondante : les
consommateurs spécialisés FieldStock restent l’autorité du retour de cette
famille.

## Chaîne OP18 démontrée jusqu’à la décision suivante

Le scénario de régression utilise un stock de type `2` initialement en `(1,1)`
et une zone demandée en `(4,1)`.

1. FieldStock produit une première action ACTION6 vers `(3,1)`.
2. Le propriétaire commun conserve la proposition unique.
3. `releaseBundle()` produit le besoin `exploration-question`.
4. OP18 sélectionne la composition ouverte.
5. `operationAdmission()` consomme le résultat et autorise l’action.
6. Le même `needId` est conservé dans les trois événements
   `need → operation → consumption`.
7. Le retour public montre le matériau en `(3,1)`.
8. `afterStock()` confirme le résultat attendu.
9. `recordStock()` enregistre le déplacement typé observé.
10. La campagne suivante produit ACTION6 vers `(4,1)`.

La décision suivante est donc réellement différente après consommation du
retour. Cette preuve dépasse le niveau « opération appelée » :

**besoin → données → OP18 → résultat → garde → action → retour spécialisé →
prochaine action modifiée.**

## Ambiguïté et absence de besoin

Les cas négatifs sont conservés :

- zéro proposition : `none`, aucune OP ;
- plusieurs propositions : `ambiguous`, aucune OP et aucun propriétaire choisi ;
- ACTION6 indisponible : aucune proposition FieldStock ;
- garde FieldStock liée à une autre époque : aucune proposition ;
- bundle OP28 non admis : `blocked`, aucune action en attente ;
- révision publique incohérente : erreur avant appel utile ;
- retour sans besoin en attente ou avec un autre `needId` : rejet ;
- même retour exact : dédupliqué.

## Transport propriétaire et optimisation

La première version utilisait le chemin détaché du caller neutre. Chaque étape
recopiait profondément proposition, bundle, état symbolique et corrélation.

Premier diagnostic :

- release OP28 directe : environ `4,07 µs/cycle` ;
- campagne commune avec retour : environ `61,90 µs/cycle` ;
- surcoût absolu : environ `57,83 µs/cycle`.

Cette conception n’a pas été retenue.

Le caller neutre expose désormais deux contrats distincts :

- `collect()/select()` : sémantique détachée historique, avec copie ;
- `collectOwned()/selectOwned()` : transfert explicite d’une proposition neuve
  au propriétaire commun.

Dans le second contrat, le payload reste privé et n’est exposé ni dans les
résultats publics ni dans les reçus. Seule l’identité de proposition est rendue.
Le retour est acheminé au propriétaire original sans recopier à nouveau le gros
état symbolique.

Diagnostic final sur l’arbre réconcilié, 21 échantillons × 2 000 cycles :

- aucun besoin direct : `0,233 µs/cycle` ;
- aucun besoin via campagne commune : `0,349 µs/cycle` ;
- release OP28 directe : `2,337 µs/cycle` ;
- campagne commune avec retour corrélé : `6,894 µs/cycle` ;
- surcoût absolu restant : `4,557 µs/cycle` ;
- réduction du coût du chemin commun : environ `88,9 %` par rapport à la
  première version.

Le pourcentage relatif au chemin direct reste élevé parce que la référence ne
fait que préparer et libérer une action, tandis que la campagne commune assure
aussi propriété, état en attente, retour, déduplication et acheminement.

Ce diagnostic est uniquement un micro-test OP28. Il ne remplace pas une session
native STCK ou SMLP.

## Qualification finale réconciliée

GitHub Actions :

- run : `43346791891` ;
- job : `131627959298` ;
- commit qualifié : `d5fc07b9c825078c7a241d6511eb91287befbc7f` ;
- baseline canonique intégrée comme premier parent :
  `6304bec8c99a05b0023692f8fe7f432394acaa11` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **286/286 tests réussis** ;
- diagnostic de campagne : réussi.

Le workflow temporaire de qualification est supprimé avant intégration et ne
doit pas entrer dans la branche canonique.

`npm ci` signale deux vulnérabilités de dépendances de sévérité haute déjà
présentes dans l’arbre de dépendances. Elles ne sont pas provoquées ni corrigées
par ce lot fonctionnel.

## Dispositions OP actualisées

- **OP18** : chaîne complète démontrée jusqu’au retour spécialisé et à la
  décision suivante pour FieldStock.
- **OP28** : chaîne commune démontrée pour le fallback public strict, avec
  retour corrélé mais sans apprentissage.
- **OP29/OP30** : besoins déjà consommés par `FieldStock.after()/record()` dans
  cette famille ; aucun appel générique ajouté.
- **OP31** : aucun propriétaire d’objectif produit n’est encore démontré.
- **OP03/08/12/26 et autres familles** : dispositions antérieures inchangées ;
  aucun appel artificiel n’est ajouté.

## Region

Region dispose déjà d’un propriétaire spécialisé, d’un adaptateur de caller,
d’une acquisition passive/sélectionnée, d’une déduplication et d’un effet sur
les propositions futures.

Il n’est pas enregistré dans `CommonCampaignOwner` pendant cette étape parce que
son adaptateur actuel n’expose pas encore un contrat physique complet
`AgentAction + CompositionBundle + état symbolique + identity` compatible avec
`releaseBundle()`.

L’ajouter malgré cette absence créerait une autorité implicite ou un bundle
artificiel. La dette est donc conservée explicitement.

## Limites restantes

- `main.ts` n’instancie pas encore le propriétaire commun ;
- le dispatch produit réel ne conserve pas encore le `needId` de la décision
  jusqu’à son retour ;
- aucun hôte navigateur ne construit encore les contextes FieldStock/Region à
  partir de chaque observation ;
- Region doit obtenir un vrai bundle/action Logos avant enregistrement dans la
  campagne commune ;
- le propriétaire commun ne possède pas encore de snapshot/restauration de ses
  décisions en attente ;
- l’acquisition passive de retours par des propriétaires non sélectionnés n’est
  pas orchestrée par cette classe ;
- aucun propriétaire d’objectif OP31 n’est raccordé ;
- la performance officielle STCK/SMLP reste non qualifiée.

## Statut

**fonctionnellement qualifié, performance officielle à confirmer**.

## Prochaine étape

Construire l’hôte produit/browser autour de `CommonCampaignOwner` :

1. adapter chaque `GameObservation` en observation agent et observation
   spécialisée ;
2. alimenter les propriétaires réellement applicables ;
3. conserver une ambiguïté au lieu de sélectionner arbitrairement ;
4. dispatcher l’action autorisée via `AgentProductDispatch` ;
5. conserver `needId`, propriétaire et proposition pendant le dispatch ;
6. acquérir le retour avant présentation de la décision suivante ;
7. seulement ensuite demander la proposition suivante.

Aucune publication Site n’est autorisée avant intégration durable de ce chemin
sur GitHub et vérification GitHub ↔ Site.
