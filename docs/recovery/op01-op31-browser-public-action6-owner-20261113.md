# OP01–OP31 — propriétaires ACTION6 publics dans le produit navigateur

Date : 13 novembre 2026

## Références

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
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Suivi consolidé : `docs/migration/op01-op31-progress.md`
- Acquisition adressée précédente :
  `docs/recovery/op01-op31-browser-addressed-acquisition-20261113.md`
- Lot 9C2 public conjoint :
  `docs/recovery/lot9c2-public-addressed-joint-channels.md`

## Objectif

La tranche précédente démontrait qu’un retour ACTION6 déjà autorisé pouvait
alimenter passivement l’acquisition, la calibration et la première rétention
d’un modèle adressé. Elle ne possédait cependant aucun propriétaire produit
capable de justifier lui-même la première ACTION6 et ses coordonnées.

La présente tranche active deux chemins publics bornés dans le contrôleur
navigateur :

1. **SMLP** : le propriétaire conjoint qualifié par le Lot 9C2, composé d’un
   canal de disponibilité ACTION6 et d’un canal de cible visible revalidée ;
2. **STCK** : un propriétaire strict qui ne propose ACTION6 que lorsqu’une seule
   carte publique est visible dans la pile gauche.

Les deux chemins restent des pairs du propriétaire FieldStock OP18 et du
fallback public simple OP28. Aucun classement implicite n’est ajouté entre
propriétaires.

## Architecture produit active

`src/runtime/v6-browser-product-campaign-host.ts` compose quatre propriétaires :

1. `FieldStockCallerOwnerAdapter` pour OP18 ;
2. `JointChannelOwner` avec les deux canaux publics SMLP ;
3. `PublicUniqueStckAction6CallerOwnerAdapter` ;
4. `PublicSingleActionCallerOwnerAdapter` pour les actions simples OP28.

`CommonCampaignOwner` conserve la règle neutre existante :

- zéro proposition → `none` ;
- une proposition → sélection possible ;
- plusieurs propositions indépendantes → `ambiguous` ;
- aucune priorité ou note locale ne départage les propriétaires.

`BrowserAgentController` instancie cette composition par défaut et reste le seul
propriétaire de la boucle Agent produit. Le Worker n’est pas instancié par
`main.ts`.

## Propriétaire conjoint SMLP

### Deux contributions causales

Le propriétaire SMLP réutilise les deux canaux qualifiés par le Lot 9C2 :

- `public_action_availability_v1` : ACTION6 est actuellement disponible ;
- `public_visible_target_v1` : une porte SMLP visible est revalidée depuis les
  seuls pixels publics et fournit ses coordonnées.

Une contribution seule ne suffit pas. Les deux doivent produire le même
`jointRef`, la même action et la même révision publique avant qu’un bundle OP28
puisse être libéré.

### Variante produit stricte

La preuve historique 9C2 conserve son producteur row-major borné sur le corpus
natif SMLP seed 0. Le produit navigateur ajoute un contexte plus prudent :

- exactement une porte visible qualifiée → les deux contextes de canal sont
  fournis ;
- plusieurs portes visibles → aucun contexte conjoint et aucune proposition ;
- aucune porte ou ACTION6 indisponible → aucune proposition.

Cette variante ne réécrit pas le contrat 9C2. Elle ajoute une politique produit
qui refuse de classer plusieurs cibles visibles.

## Propriétaire strict STCK

Le producteur STCK examine uniquement le frame public 64 × 64.

Il recherche, dans le panneau gauche de la pile :

- un corps de carte horizontal public sur huit pixels ;
- une couleur de carte admise ;
- au moins deux lignes consécutives ;
- exactement une carte qualifiée.

La coordonnée produite est le centre public de cette carte :

- `x = 4` ;
- `y = centre vertical du corps détecté`.

Deux cartes ou davantage restent non résolues. Le propriétaire ne reprend pas
la règle historique « carte la plus basse » du probe de benchmark et n’importe
aucune solution, route, état moteur ou fixture.

La proposition STCK construit un bundle OP28 avec :

- une ACTION6 complète ;
- la révision publique exacte ;
- les références d’observation et de cible ;
- une preuve de préservation du frame public ;
- un garde de résultat sur le bundle admis.

## Chaîne causale produit

Pour SMLP comme pour STCK, la chaîne active est :

**besoin public borné → données publiques produites → proposition propriétaire
→ bundle OP28 → autorité Logos → ACTION6 physique → retour public corrélé →
acquisition avec le même `needId` → observation passive FieldStock →
notification produit → présentation → décision suivante.**

Le propriétaire sélectionné acquiert son retour avant la présentation. Pour le
propriétaire conjoint SMLP, les deux canaux acquièrent le même retour sélectionné
avec le même `needId`.

FieldStock observe ensuite le retour de manière passive. Il ne peut pas :

- acquérir le `needId` du propriétaire sélectionné ;
- prétendre avoir choisi l’action ;
- produire une seconde action depuis le hook passif ;
- apprendre lorsque les conditions d’acquisition adressée restent
  insuffisantes.

La preuve produit vérifie explicitement qu’un retour SMLP synthétique insuffisant
traverse l’observation passive sans créer artificiellement de modèle, de prior
ou de stock FieldStock.

## Ambiguïté et refus

La tranche produit volontairement `none` lorsque :

- SMLP expose plusieurs portes visibles ;
- STCK expose plusieurs cartes ;
- ACTION6 n’est pas disponible ;
- l’observation est terminale ;
- le jeu n’est ni SMLP ni STCK pour ces propriétaires spécialisés ;
- le frame public n’a pas la forme 64 × 64 attendue.

Si un autre propriétaire indépendant propose simultanément une action, le
propriétaire commun retourne `ambiguous`. Aucun fallback n’est exécuté pour
masquer cette ambiguïté.

## Fichiers de la tranche

### Ajoutés

- `src/logos-engine/v6-public-unique-stck-action6-port.ts` ;
- `src/logos-engine/v6-public-unique-stck-action6-caller-adapter.ts` ;
- `src/runtime/v6-browser-product-campaign-host.ts` ;
- `tests/v6-public-product-action6-producers.test.ts` ;
- `tests/v6-browser-public-unique-action6-host.test.ts`.

### Modifiés

- `src/logos-engine/v6-public-addressed-joint-channels.ts` ;
- `src/runtime/v6-browser-agent-controller.ts`.

Les premiers fichiers génériques ACTION6 créés avant la réconciliation 9C2 ont
été supprimés. Le produit ne conserve donc pas deux détecteurs SMLP concurrents.

## Qualification combinée

Workflow temporaire de qualification :

- run : `43362500453` ;
- job : `131679075165` ;
- candidat : `e821e3221b049b59bc65fe4ea18fad9d3dc13246` ;
- Node : `22.18.0`.

Résultats :

- `npm ci` : réussi ;
- typecheck : réussi ;
- régression TypeScript complète : **363/363 réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build de production : réussi ;
- modules transformés : `62` ;
- galerie : `100` jeux, `636` prévisualisations et `4` atlas natifs ;
- rapport de câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `25`.

Deux vulnérabilités de dépendances de sévérité haute préexistantes restent
signalées par `npm ci`.

## Portée exacte de la preuve

La tranche démontre fonctionnellement :

- l’activation du propriétaire conjoint SMLP dans le produit navigateur ;
- la consommation des deux contributions causales avant ACTION6 ;
- l’acquisition du retour par les deux canaux avec le même `needId` ;
- la conservation de l’ordre acquisition sélectionnée → observation passive →
  présentation ;
- le refus produit de plusieurs portes SMLP ;
- la production STCK d’une ACTION6 uniquement avec une carte publique unique ;
- le refus de plusieurs cartes STCK et des jeux non supportés ;
- l’absence d’apprentissage FieldStock forcé lorsque le retour ne constitue pas
  une preuve adressée suffisante.

Elle ne démontre pas encore :

- une campagne navigateur complète jouée contre le transport Pyodide réel pour
  ces nouveaux propriétaires produits ;
- la qualification STCK sur un corpus natif complet ;
- une seconde contribution causale indépendante pour STCK ;
- la persistance entre activations Agent ;
- le coût ciblé des nouveaux producteurs et de la composition produit ;
- un propriétaire d’objectif OP31.

## Performance

C7 reste clos pour son périmètre officiel Region STCK/SMLP déjà mesuré :

- STCK : `+7,155963 %` — accepté ;
- SMLP : `−4,679306 %` — accepté ;
- seuil strict : augmentation médiane `< +10 %` par jeu.

La présente tranche active de nouveaux producteurs dans le navigateur. Leur coût
n’appartient pas à l’ancienne mesure Region et n’est pas encore qualifié
séparément. Cette dette ciblée ne réouvre pas rétroactivement C7 pour son
périmètre historique, mais elle doit être mesurée avant de qualifier la nouvelle
composition produit en performance.

## Dispositions OP

- **OP18** : chaîne FieldStock inchangée ; les retours ACTION6 sélectionnés
  peuvent désormais provenir de propriétaires produits publics bornés avant
  observation passive et acquisition adressée éventuelle.
- **OP28** : trois formes produit sont désormais actives sous contrats distincts :
  fallback simple, propriétaire conjoint SMLP et propriétaire strict STCK.
- **OP29/OP30** : cycle spécialisé de réponse, apprentissage et rétention
  préservé ; aucune connaissance n’est écrite sans preuve suffisante.
- **OP31** : aucun propriétaire d’objectif produit démontré.
- **Autres OP** : aucune activation artificielle.

## Limites ouvertes

- aucune persistance du modèle, du prior ou du stock entre activations Agent ;
- snapshot/restauration de la campagne, du `needId` et de l’action en attente non
  raccordés au produit ;
- aucune campagne produit réelle complète STCK/SMLP qualifiée sur Pyodide ;
- STCK ne possède pas encore deux contributions causales indépendantes ;
- Region n’est pas encore propriétaire physique du contrôleur produit ;
- aucun propriétaire OP31 ;
- registre canonique des 76 points d’entrée V6 absent ;
- coût ciblé de la nouvelle composition produit non mesuré séparément ;
- aucune publication Site.

## Prochaine étape

1. exécuter une campagne navigateur réelle et bornée sur SMLP avec le
   propriétaire conjoint actif ;
2. qualifier STCK sur son corpus natif et rechercher une seconde contribution
   réellement indépendante avant toute généralisation conjointe ;
3. ajouter snapshot et restauration atomiques de la campagne, des propriétaires,
   du modèle, du prior, du stock et du retour en attente ;
4. mesurer séparément le coût de la composition produit active ;
5. compléter ensuite le propriétaire physique Region et identifier un vrai
   propriétaire d’objectif avant OP31.

Aucune publication Site n’appartient à cette tranche. GitHub reste la source
canonique durable.
