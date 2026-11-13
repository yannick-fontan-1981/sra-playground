# OP01–OP31 — propriétaire commun de campagne et retours corrélés

Date : 12 novembre 2026

Baseline canonique finale de départ :
`edb19e247c409941af35165cdf37a0440cbe6adf`

Documents spécialisés :

- noyau du propriétaire commun : ce document ;
- hôte produit/browser :
  `docs/recovery/op01-op31-browser-campaign-host-20261112.md` ;
- hôte Worker :
  `docs/recovery/op01-op31-worker-common-campaign-20261112.md` ;
- plan stable : `docs/migration/op01-op31-verification-plan.md`.

## Objectif

Conserver une chaîne commune sans inventer de perception, de classement ou
d’autorité :

**observation publique → propositions propriétaires → ambiguïté ou sélection
unique → bundle Logos → action → retour public corrélé → consommateur exact →
effet sur la décision suivante.**

Le propriétaire commun ne fusionne pas les états internes des familles. Il
fournit uniquement :

- collecte bornée ;
- sélection structurelle si une seule proposition existe ;
- ambiguïté explicite si plusieurs propositions existent ;
- release physique par le Logos Engine ;
- corrélation `sessionId` / proposition / bundle / action / `needId` ;
- retour routé au propriétaire exact ;
- déduplication du même retour physique.

## Noyau `v6-common-campaign-owner.ts`

Le propriétaire commun :

- accepte des owners conformes à `CommonCallerOwner` ;
- n’appelle aucune OP en l’absence de proposition ;
- conserve plusieurs propositions sous `ambiguous` ;
- ne soumet à `releaseBundle()` qu’une proposition unique ;
- valide session, observation, révision, action publique et appartenance de
  l’action au bundle ;
- conserve au plus une action en attente par session ;
- refuse une nouvelle décision tant que le retour précédent n’est pas acquis ;
- exige le même `needId` au retour ;
- route le retour au seul owner sélectionné ;
- déduplique un retour exact ;
- rejette un retour contradictoire ;
- borne les sessions en attente et les besoins réglés conservés.

## Owners qualifiés

### OP28 public strict

`v6-public-single-action-caller-adapter.ts` expose le fallback public :

- exactement une action simple distincte de RESET ;
- aucune ACTION6 sans coordonnées ;
- aucune décision lorsque plusieurs choix existent ;
- aucun apprentissage artificiel au retour.

### OP18 FieldStock

`v6-field-stock-caller-adapter.ts` raccorde le producteur spécialisé :

- `proposeStock()` produit une proposition bornée ;
- `beforeStock()` revalide stock, scène et préfixe ;
- l’action ACTION6 mesurée devient une `AgentAction` ;
- le bundle OP18 est construit à la révision courante ;
- le retour conserve le même `needId` ;
- `afterStock()` compare ;
- `recordStock()` confirme, apprend, enregistre un échec ou réfute.

Aucun OP29/OP30 générique n’est ajouté en double : les consommateurs spécialisés
restent l’autorité de cette famille.

## Transport propriétaire

Le caller neutre expose :

- `collect()/select()` pour une sémantique détachée ;
- `collectOwned()/selectOwned()` pour le transfert explicite d’une proposition
  neuve au propriétaire commun.

Le second garde le payload privé et évite de recopier plusieurs fois bundle,
état symbolique et corrélation.

Diagnostic du noyau :

- aucun besoin direct : `0,233 µs/cycle` ;
- aucun besoin via campagne : `0,349 µs/cycle` ;
- OP28 direct : `2,337 µs/cycle` ;
- campagne avec retour : `6,894 µs/cycle` ;
- surcoût absolu : `4,557 µs/cycle` ;
- réduction face à la première version détachée : environ `88,9 %`.

Ce micro-diagnostic ne remplace pas une mesure native STCK/SMLP.

## Chaîne OP18

Scénario démontré :

1. FieldStock propose ACTION6 vers `(3,1)` ;
2. OP18 sélectionne la composition ouverte ;
3. `operationAdmission()` autorise l’action ;
4. le même `needId` traverse `need → operation → consumption` ;
5. le retour montre le matériau en `(3,1)` ;
6. `afterStock()` confirme ;
7. `recordStock()` enregistre le déplacement ;
8. la proposition suivante produit ACTION6 vers `(4,1)`.

La chaîne atteint donc le consommateur spécialisé et la décision suivante.

## Chaîne OP28

Sous la condition publique stricte :

1. l’owner prépare le bundle OP28 ;
2. le propriétaire commun vérifie session, révision et disponibilité ;
3. `releaseBundle()` appelle OP28 ;
4. `operationAdmission()` consomme le résultat ;
5. l’action reste en attente ;
6. le retour portant le même `needId` est acquis par l’owner exact.

ACTION6 seule ne déclenche rien, car ses coordonnées restent inconnues.

## Deux hôtes complémentaires

### Hôte browser/product

`src/runtime/v6-browser-common-campaign-host.ts` possède la couture directe :

**GameObservation → AgentObservation → contextes owners → CommonCampaignOwner →
Logos → AgentProductDispatch → BrowserGameRuntime → acquisition avant
présentation.**

Il qualifie :

- identité exacte de l’observation produit ;
- ACTION6 avec coordonnées intactes ;
- annulation sur transport, génération obsolète ou session remplacée ;
- acquisition du même `needId` avant présentation ;
- correspondance exacte owner/transport.

Qualification : run `43348635198`, job `131633987557`, commit
`8a73045e594bac9892f8846564b76c367c5fcccd`, **300/300 tests**.

### Hôte Worker

`src/runtime/v6-common-campaign-decision-port.ts` possède la couture
`initialize/observe/decide/cancel` du Worker.

Il qualifie :

- mesure publique 64×64 ;
- acquisition du retour avant la décision suivante ;
- frontière et revalidation FieldStock ;
- OP18/OP28 sans classement ;
- consommation d’une observation `WIN` ou à budget nul avant arrêt ;
- aucune nouvelle décision après ce retour terminal ;
- propagation des erreurs d’observation.

Qualification antérieure : run `43348904523`, job `131634904435`, commit
`08a04a9da59b0f385d080acf6091d4acdcf800c6`, **304/304 tests**.

Les deux hôtes restent inactifs dans `main.ts`. Ils ne doivent pas être exécutés
simultanément sur la même session sans contrôleur produit explicite.

## Ambiguïté et cas négatifs

- 0 proposition → `none`, aucune OP ;
- plus d’une proposition → `ambiguous`, aucune OP ;
- bundle refusé → `blocked`, aucune action en attente ;
- ACTION6 sans connaissance revalidée → aucune action ;
- autre `needId` au retour → rejet ;
- doublon exact → dédupliqué ;
- observation terminale Worker → retour acquis, aucune proposition suivante ;
- produit non prêt ou observation périmée → aucun dispatch browser.

## Region

Region possède un owner spécialisé, un adaptateur, une acquisition
sélectionnée/passive, une déduplication, un snapshot et un effet futur.

Il n’est pas inscrit dans les hôtes communs tant qu’il ne produit pas un candidat
public complet
`AgentAction + CompositionBundle + état symbolique + identity` qualifié.

Aucun bundle ou `methodRef` artificiel n’est ajouté.

## Dispositions OP

- **OP18** : chaîne complète démontrée en bibliothèque et raccordée au Worker
  lorsqu’un prior explicite est revalidé ; constructeur de contexte browser
  FieldStock encore absent.
- **OP28** : chaîne complète démontrée dans l’hôte browser et dans le Worker,
  avec retour corrélé au même `needId`.
- **OP29/OP30** : consommation spécialisée FieldStock/Region conservée ; aucun
  doublon générique.
- **OP31** : toujours sans propriétaire d’objectif produit.
- **Autres OP** : aucune activation artificielle.

## Limites restantes

- aucun hôte n’est activé dans `main.ts` ;
- aucun contrôleur Agent ne choisit encore explicitement l’unique seam de
  campagne à exécuter ;
- acquisition initiale du prior FieldStock depuis une vraie campagne absente ;
- constructeur de contexte browser FieldStock absent ;
- Region sans contrat public complet ;
- acquisition passive non orchestrée par le propriétaire commun ;
- snapshot/restauration complet des campagnes en attente absent ;
- OP31 sans owner produit ;
- coût officiel A/B × STCK/SMLP non qualifié ;
- aucune parité exacte Site 109 / native 0.68 revendiquée.

## Statut

**Le noyau commun, l’hôte browser/product OP28 et l’hôte Worker OP18/OP28 sont
fonctionnellement qualifiés dans leurs périmètres. Activation produit, choix
d’un contrôleur unique, acquisition FieldStock initiale, Region commun,
restauration et performance officielle restent ouverts.**
