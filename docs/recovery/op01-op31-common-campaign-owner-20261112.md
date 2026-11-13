# OP01–OP31 — propriétaire commun de campagne et retour corrélé

Date : 12 novembre 2026

Branche d’origine :
`op01-op31-common-campaign-owner-20261112`

Raccord Worker :
`recovery/lot5b-worker-common-campaign-20261112`

Baseline canonique initiale :
`87a538a1c776fb974a1767f30fea735aac28ded9`

Baseline canonique réconciliée pour le raccord Worker :
`8cc510e0a0d09704eb508b3aa2216b4d63482af4`

Commit Worker qualifié :
`08a04a9da59b0f385d080acf6091d4acdcf800c6`

Plan stable :
`docs/migration/op01-op31-verification-plan.md`

Preuve détaillée du raccord Worker :
`docs/recovery/op01-op31-worker-common-campaign-20261112.md`

## Objectif

Construire puis raccorder le plus petit propriétaire commun capable de conserver
la chaîne suivante sans inventer de perception, de classement ou d’autorité :

**observation publique → propositions propriétaires → ambiguïté ou sélection
unique → bundle Logos → action → retour public corrélé → consommateur exact →
effet sur la décision suivante.**

Le propriétaire commun ne fusionne pas les états internes des familles et ne
classe pas leurs propositions. Il fournit uniquement :

- une collecte bornée ;
- une sélection structurelle lorsqu’il existe exactement une proposition ;
- une ambiguïté explicite lorsqu’il en existe plusieurs ;
- une autorisation physique par le Logos Engine ;
- une corrélation `sessionId` / proposition / bundle / action / `needId` ;
- un retour routé au propriétaire exact ;
- une déduplication du même retour physique.

## Composants du noyau commun

### `v6-common-campaign-owner.ts`

Le propriétaire commun :

- accepte des propriétaires conformes à `CommonCallerOwner` ;
- n’appelle aucune OP lorsqu’aucune proposition n’existe ;
- conserve plusieurs propositions sous le statut `ambiguous` ;
- ne soumet à `releaseBundle()` qu’une proposition structurellement unique ;
- valide session, observation, révision, action publique et appartenance de
  l’action au bundle ;
- conserve au plus une action en attente par session ;
- refuse une nouvelle décision tant que le retour précédent n’est pas acquis ;
- exige le même `needId` au retour ;
- route le retour au seul propriétaire sélectionné ;
- ignore un doublon exact déjà acquis ;
- rejette un retour contradictoire pour un besoin déjà réglé ;
- borne les sessions en attente et les besoins réglés conservés.

### `v6-public-single-action-caller-adapter.ts`

Cet adaptateur expose le fallback OP28 existant :

- une seule action simple publique distincte hors RESET ;
- aucune ACTION6 sans coordonnées ;
- aucune décision lorsqu’il existe plusieurs choix ;
- aucun apprentissage artificiel sur le retour.

### `v6-field-stock-caller-adapter.ts`

Cet adaptateur raccorde le premier producteur symbolique spécialisé complet :

- `ObservedAddressedMaterialRuntime.proposeStock()` produit une proposition
  bornée ;
- `beforeStock()` revalide le stock, la scène et le préfixe ;
- la première action ACTION6 mesurée devient une `AgentAction` ;
- le bundle OP18 est reconstruit à la révision courante ;
- l’état symbolique conserve question, faits, objectif et preuves ;
- le retour reste lié au même `needId` ;
- `afterStock()` compare le résultat ;
- `recordStock()` confirme, apprend, enregistre un échec ou réfute.

Aucun appel générique OP29 ou OP30 n’est ajouté en double : les consommateurs
spécialisés FieldStock restent l’autorité du retour de cette famille.

## Transport propriétaire et coût diagnostique

Le caller neutre expose deux contrats :

- `collect()/select()` : propositions détachées et copiées ;
- `collectOwned()/selectOwned()` : transfert explicite d’une proposition neuve
  au propriétaire commun.

Le second conserve le payload privé et évite de recopier plusieurs fois bundle,
état symbolique et corrélation.

Diagnostic final du noyau, 21 échantillons × 2 000 cycles :

- aucun besoin direct : `0,233 µs/cycle` ;
- aucun besoin via campagne commune : `0,349 µs/cycle` ;
- release OP28 directe : `2,337 µs/cycle` ;
- campagne commune avec retour : `6,894 µs/cycle` ;
- surcoût absolu : `4,557 µs/cycle` ;
- réduction par rapport à la première version détachée : environ `88,9 %`.

Ce micro-diagnostic ne remplace pas une mesure native STCK ou SMLP.

## Chaîne OP18 démontrée

Le scénario de régression initial utilise un matériau de type `2` en `(1,1)` et
une zone demandée en `(4,1)` :

1. FieldStock produit ACTION6 vers `(3,1)` ;
2. OP18 sélectionne la composition ouverte ;
3. `operationAdmission()` autorise l’action ;
4. le même `needId` traverse `need → operation → consumption` ;
5. le retour montre le matériau en `(3,1)` ;
6. `afterStock()` confirme le résultat ;
7. `recordStock()` enregistre le déplacement ;
8. la proposition suivante produit ACTION6 vers `(4,1)`.

La chaîne atteint donc réellement la décision suivante.

## Chaîne OP28 démontrée

Lorsque l’observation publique expose exactement une action simple admise :

1. l’adaptateur construit le bundle OP28 ;
2. le propriétaire commun vérifie session, révision et disponibilité ;
3. `releaseBundle()` appelle OP28 ;
4. `operationAdmission()` consomme le résultat ;
5. l’action reste en attente ;
6. le retour portant le même `needId` est routé au propriétaire OP28.

ACTION6 seule ne déclenche rien car ses coordonnées restent inconnues. Plusieurs
choix restent explicitement ambigus.

## Raccord au Worker V6 reconstruit

Le noyau commun est maintenant instancié par
`src/runtime/v6-common-campaign-decision-port.ts`, utilisé par défaut dans
`src/runtime/v6-agent-worker.ts`.

La couche `v6-public-observation-measurement.ts` :

- copie et valide l’observation publique 64×64 ;
- conserve uniquement pixels, actions, état, niveau et progression publics ;
- produit une identité déterministe ;
- matérialise les composants 4-connexes seulement lorsqu’un prior FieldStock
  doit être revalidé.

Le port Worker exécute l’ordre suivant :

1. acquérir le retour de l’action précédente avec le même `needId` ;
2. franchir une éventuelle frontière officielle ;
3. revalider le prior FieldStock dans une scène non terminale ;
4. collecter les propositions propriétaires ;
5. conserver `none` ou `ambiguous` sans appel OP ;
6. autoriser l’unique proposition ;
7. retourner l’action au cœur Worker.

Le contrat `AgentDecisionPort` possède maintenant un hook `observe()` distinct
de `decide()`. Toute observation publique validée est consommée avant :

- l’arrêt terminal `WIN` ;
- l’arrêt pour budget non positif ;
- la demande d’une nouvelle décision.

Ainsi, le dernier retour OP18 ou OP28 est acquis même lorsqu’aucune action
suivante n’est possible. Aucune nouvelle proposition n’est demandée après ce
retour terminal.

Le Worker par défaut n’injecte aucun prior FieldStock. Il ne peut donc pas
inventer ACTION6 ou ses coordonnées.

## Cas négatifs préservés

- zéro proposition : `none`, aucune OP ;
- plusieurs propositions : `ambiguous`, aucune OP ;
- ACTION6 sans connaissance revalidée : aucune décision ;
- bundle refusé : `blocked`, aucune action en attente ;
- retour avec un autre `needId` : rejet ;
- doublon exact : dédupliqué ;
- erreur du hook d’observation : erreur explicite, aucune décision ;
- `WIN` ou budget nul : retour acquis puis arrêt, sans action suivante.

## Region

Region dispose d’un propriétaire spécialisé, d’un adaptateur de caller, d’une
acquisition sélectionnée/passive, d’une déduplication et d’un effet futur.

Il n’est pas enregistré dans le port Worker commun, car son adaptateur ne produit
pas encore le contrat complet
`AgentAction + CompositionBundle + état symbolique + identity` attendu par
`releaseBundle()` dans une proposition publique qualifiée.

Aucun bundle artificiel ou `methodRef` inféré n’est ajouté pour contourner cette
absence.

## Qualifications

Qualification du noyau commun :

- run : `43346791891` ;
- job : `131627959298` ;
- commit : `d5fc07b9c825078c7a241d6511eb91287befbc7f` ;
- typecheck réussi ;
- **286/286 tests réussis** ;
- diagnostic de coût réussi.

Qualification finale du raccord Worker, après intégration du canonique
`8cc510e0` :

- run : `43348904523` ;
- job : `131634904435` ;
- commit : `08a04a9da59b0f385d080acf6091d4acdcf800c6` ;
- Node : `22.18.0` ;
- `npm ci` : réussi ;
- `npm run typecheck` : réussi ;
- régression TypeScript complète : **304/304 tests réussis** ;
- aucun échec, annulation, test ignoré ou TODO.

Les workflows temporaires sont supprimés avant intégration canonique.

## Dispositions OP actualisées

- **OP18** : chaîne complète raccordée au Worker lorsque FieldStock possède un
  prior explicite revalidé ; retour consommé avant la décision suivante.
- **OP28** : chaîne complète raccordée au Worker pour le fallback public strict,
  y compris retour terminal ou budget nul.
- **OP29/OP30** : consommation spécialisée FieldStock/Region conservée ; aucun
  doublon générique.
- **OP31** : aucun propriétaire d’objectif produit démontré.
- **OP03/08/12/26 et autres familles** : dispositions antérieures inchangées ;
  aucun appel artificiel ajouté.

## Limites restantes

- `main.ts` ne crée pas encore une campagne SRA live autour du Worker ;
- le produit ne dispatch pas encore une décision Worker vers
  `BrowserGameRuntime` puis son retour au même Worker ;
- l’acquisition initiale d’un prior FieldStock depuis une vraie campagne
  navigateur reste absente ;
- Region n’est pas encore un owner du port Worker commun ;
- l’acquisition passive des owners non sélectionnés n’est pas orchestrée ;
- le port Worker commun ne possède pas encore de snapshot/restauration complet ;
- aucun propriétaire d’objectif OP31 n’est raccordé ;
- la performance officielle A/B × STCK/SMLP reste non qualifiée ;
- aucune parité exacte avec Site 109 / native 0.68 n’est revendiquée.

## Statut

**Le propriétaire commun et son raccord Worker OP18/OP28 sont fonctionnellement
qualifiés. Le raccord produit live, l’acquisition initiale FieldStock, Region
commun, la restauration et la performance officielle restent à confirmer.**

Aucune publication Site n’est autorisée avant intégration durable du chemin
produit sur GitHub et vérification GitHub ↔ Site.
