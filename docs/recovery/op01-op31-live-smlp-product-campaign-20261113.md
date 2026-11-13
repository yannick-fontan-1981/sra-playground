# OP01–OP31 : campagne produit SMLP réelle sous Pyodide

Date : 13 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Canonique Lot 9C3 de départ :
  `418a566339966513797397f0e8541b21744f8647`
- Branche de réconciliation :
  `op01-op31-live-smlp-pyodide-rebased-20261113`
- Candidat SMLP initial qualifié :
  `ef54b59ed68e75207ba77a182016b357248c6cc6`
- Candidat combiné Lot 9C3 + SMLP qualifié :
  `17257541e75c5565baa534645e9e66998f2e57d3`
- PR de réconciliation interne : `#76`
- Merge de réconciliation :
  `b2c4eac98d5c5a6d96a0c2ba2ffa4df5ed668b34`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Suivi global canonique : `docs/migration/op01-op31-progress.md`
- Preuve structurée durable :
  `docs/recovery/op01-op31-live-smlp-product-campaign-qualified.json`
- Preuve STCK Lot 9C3 :
  `docs/recovery/lot9c3-stck-joint-qualified.json`

Le suivi global OP01–OP31 a volontairement été conservé dans sa version
canonique Lot 9C3 pendant la réconciliation. Le présent rapport porte la preuve
détaillée propre à la campagne SMLP réelle et à sa coexistence avec 9C3.

## Objectif

La tranche précédente avait activé le propriétaire conjoint SMLP dans le host
produit et démontré sa causalité sur des observations contrôlées. Elle ne
prouvait pas encore que la composition complète pouvait traverser le transport
navigateur réel jusqu’au moteur Python exécuté sous Pyodide.

Cette tranche qualifie la chaîne suivante :

**observation native → `BrowserGameRuntime` → `game-worker.ts` → Pyodide →
`game_bridge.py` → `custom-games.zip` → host produit → propriétaire conjoint
SMLP → OP28 → ACTION6 → retour réel → acquisition conjointe → observation
passive FieldStock → présentation.**

La qualification est fonctionnelle. Elle ne qualifie pas le coût officiel de la
nouvelle composition produit.

## Corpus et environnements

Jeu :

- code : `SMLP` ;
- identifiant : `smlp-c3000001` ;
- seed : `0` ;
- niveau initial : `1` ;
- actions publiques : `[5, 6, 7]`.

Référence :

- CPython `3.12.16` ;
- archive `public/python/custom-games.zip` ;
- backend : `python-native-archive`.

Candidat :

- Node `22.18.0` ;
- Chrome `156.0.8078.79` ;
- Python navigateur `3.14.2` ;
- backend : `python-wasm` ;
- transport réel `BrowserGameRuntime` et Worker de jeu.

La fixture n’injecte ni frame, ni retour, ni état interne du jeu. Le moteur est
chargé depuis les mêmes assets Python que le produit navigateur.

## Protocole

### Référence CPython

Le qualificateur ouvre une session native directement depuis l’archive publique,
puis exécute trois ACTION6 successives au centre de la porte visible :

`ACTION6(x=32, y=26)`.

Pour chaque étape, il enregistre :

- le hash SHA-256 du frame 64 × 64 ;
- les actions disponibles ;
- l’état officiel ;
- le niveau et le nombre de niveaux terminés ;
- le nombre de pixels modifiés.

### Candidat navigateur

La fixture charge SMLP par `BrowserGameRuntime`, crée le host produit actif et
lance trois cycles complets.

Pour chaque cycle, elle exige :

1. le propriétaire sélectionné est `joint_channels_v1` ;
2. l’action libérée est `ACTION6(32,26)` ;
3. le dispatch est accepté et non obsolète ;
4. le même `needId` traverse préparation, acquisition et callback ;
5. le retour est acquis par les deux canaux :
   - `public_action_availability_v1` ;
   - `public_visible_target_v1` ;
6. chaque canal reçoit le même `proposalRef`, le même `jointRef` et le même
   `needId` ;
7. le `needId` est nouveau au cycle suivant ;
8. le retour réel modifie exactement neuf pixels ;
9. le hash public correspond exactement à la référence CPython ;
10. FieldStock observe le retour sans inventer de connaissance ;
11. la présentation intervient seulement après règlement de l’acquisition.

## Résultats de parité

État initial commun :

- hash :
  `0be203b6ce80ac043c30f42b08b925eeccb433d124957070d77b93903e67635c` ;
- actions : `[5,6,7]` ;
- état : `NOT_FINISHED` ;
- niveau : `1` ;
- niveaux terminés : `0`.

| Cycle | Révision | Orientation détectée | Action | Pixels modifiés | Hash obtenu | Parité CPython |
| --- | ---: | --- | --- | ---: | --- | --- |
| 1 | 0 | `open_horizontal` | `ACTION6(32,26)` | 9 | `90888a03979b86c5f515ab0e21b11512314861cd067517f5d34705a23bbac1ac` | oui |
| 2 | 1 | `closed_vertical` | `ACTION6(32,26)` | 9 | `0be203b6ce80ac043c30f42b08b925eeccb433d124957070d77b93903e67635c` | oui |
| 3 | 2 | `open_horizontal` | `ACTION6(32,26)` | 9 | `90888a03979b86c5f515ab0e21b11512314861cd067517f5d34705a23bbac1ac` | oui |

Les trois `needId` sont distincts. Leurs condensats SHA-256 sont conservés dans
la preuve JSON durable, tandis que l’artifact GitHub Actions conserve le rapport
brut complet.

## Causalité conjointe observée

Les trois cycles ont conservé les deux contributions attendues :

- disponibilité publique courante d’ACTION6 ;
- cible publique visible revalidée.

Le propriétaire conjoint transmet au retour :

- l’identité de chaque canal ;
- la référence de contribution ;
- la référence conjointe ;
- la proposition sélectionnée ;
- le `needId` physique exact.

Chaque acquisition est routée une seule fois :

- `routed: true` ;
- `duplicate: false` ;
- acquisition réussie sur les deux canaux.

L’acquisition sélectionnée interne est réglée avant l’observation passive. La
trace visible de la fixture enregistre ensuite :

```text
action:6:32:26
action-return
passive-field-stock
acquired
present
```

Le marqueur `acquired` correspond au callback produit publié après l’observation
passive, et non au moment interne où le propriétaire sélectionné reçoit son
retour.

## Observation passive FieldStock

Le basculement d’une porte SMLP ne constitue pas une preuve suffisante pour
acquérir un modèle adressé FieldStock.

À chaque cycle :

- `observeAddressedReturn()` est appelé ;
- son résultat est `field_fit_unresolved` ;
- le statut de connaissance reste `empty` ;
- aucun modèle n’est créé ;
- aucun prior n’est créé ;
- aucun stock n’est créé ;
- aucun échantillon n’est conservé.

Cela démontre simultanément que l’observation passive réelle n’est pas omise et
qu’elle ne transforme pas un retour insuffisant en connaissance inventée.

## Qualification SMLP initiale

Workflow temporaire initial :

`.github/workflows/op01-op31-live-smlp-product-campaign.yml`

Exécution :

- run : `43364453319` ;
- job : `131685442943` ;
- candidat : `ef54b59ed68e75207ba77a182016b357248c6cc6` ;
- artifact : `14010025857` ;
- digest :
  `328d3536f7bbdffef972f4870dbc8243a34b4c89198ef8cff6756fbb4bdbe7e4`.

Résultats :

- régression TypeScript : **363/363** ;
- échecs, annulations, ignorés et TODO : `0` ;
- build de production : réussi ;
- campagne SMLP réelle : réussie ;
- cycles comparés : `3` ;
- câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `25`.

## Réconciliation avec le Lot 9C3 STCK

Pendant la qualification SMLP, la branche canonique a intégré le Lot 9C3.
Celui-ci apporte deux contributions STCK publiques réellement distinctes et une
preuve native d’ablation. Son corpus utilise un prélude public borné, puis
`ACTION6(4,50)` avec un effet réel de 64 pixels.

La tranche SMLP a été reportée sur une branche fraîche issue du commit canonique
`418a566339966513797397f0e8541b21744f8647`.

La PR interne `#76` a fusionné les fichiers SMLP sur cette branche. Le suivi
global OP01–OP31 a ensuite été restauré exactement à sa version canonique Lot
9C3 afin d’éviter de réintroduire les anciennes affirmations selon lesquelles
STCK ne possédait pas deux contributions causales ou aucune preuve native.

## Qualification combinée Lot 9C3 + SMLP

Exécution :

- branche : `op01-op31-live-smlp-pyodide-rebased-20261113` ;
- candidat : `17257541e75c5565baa534645e9e66998f2e57d3` ;
- run : `43365742241` ;
- job : `131689606950` ;
- artifact : `14010406288` ;
- nom : `op01-op31-live-smlp-product-campaign-rebased` ;
- digest :
  `872a9f762b73c70cc7e07db3a30f14af6ea3aaf7d881f58f0c6284fc901cfe83`.

Résultats combinés :

- `npm ci` : réussi ;
- régression TypeScript complète : **374/374** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build de production : réussi ;
- Pyodide local préparé : réussi ;
- modules Vite transformés : `62` ;
- galerie : `100` jeux, `636` prévisualisations, `4` atlas natifs ;
- garde TypeScript STCK conjointe : **7/7** ;
- garde de preuve durable STCK : **4/4** ;
- campagne SMLP réelle : réussie ;
- cycles SMLP comparés : `3` ;
- parité CPython/Pyodide : réussie ;
- canaux SMLP acquis à chaque cycle : `2/2` ;
- pixels SMLP modifiés par cycle : `9, 9, 9` ;
- rapport de câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `26`.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant cette
tranche, restent signalées par `npm ci`.

## État produit STCK après 9C3

Le canonique contient maintenant un propriétaire conjoint STCK qualifié et sa
preuve durable. La composition produit active continue cependant d’utiliser le
propriétaire strict autonome `PublicUniqueStckAction6CallerOwnerAdapter`.

Il faut donc distinguer :

1. **STCK joint causal natif** : qualifié par le Lot 9C3 ;
2. **STCK strict dans le host produit** : actif sur observations contrôlées ;
3. **STCK joint dans le host produit réel** : pas encore raccordé.

La prochaine intégration STCK ne devra pas conserver deux propriétaires
concurrents capables de proposer la même action. Le propriétaire joint canonique
devra remplacer ou absorber le propriétaire strict autonome avec une politique
d’ambiguïté explicite.

## Disposition OP28

La chaîne SMLP OP28 est démontrée à deux niveaux complémentaires :

1. retirer l’un des deux canaux supprime l’action ;
2. les deux canaux traversent Pyodide, ACTION6, acquisition et présentation avec
   la même identité physique.

Disposition :

**OP28 SMLP conjoint est fonctionnellement qualifié dans le produit navigateur
réel sur trois retours consécutifs du corpus natif SMLP seed 0, et cette preuve
coexiste sans régression avec le Lot 9C3 STCK.**

Cette disposition ne prétend pas résoudre le jeu SMLP complet ni généraliser la
politique à plusieurs portes visibles.

## Frontière de performance

Les temps de dispatch présents dans le rapport ne sont pas utilisés pour une
acceptation de performance. Trois cycles ne constituent ni un protocole ABBA ni
une mesure officielle de surcharge.

Par conséquent :

- C7 Region reste qualifié dans son périmètre historique ;
- le coût du propriétaire conjoint SMLP dans la composition produit reste non
  qualifié ;
- le coût du propriétaire conjoint STCK reste lui aussi non qualifié dans le
  produit ;
- aucun pourcentage de surcharge produit n’est revendiqué ;
- aucune compensation entre jeux n’est appliquée.

Une mesure de coût devra utiliser des runners A/B séparés, le même corpus, un
échauffement explicite, aucun échantillon supprimé et le seuil strict de `+10 %`
par jeu.

## Limites conservées

Cette tranche ne démontre pas encore :

- une résolution complète des niveaux SMLP ;
- le propriétaire conjoint STCK raccordé au host produit ;
- la persistance entre activations Agent ;
- la restauration d’un `needId` ou d’une action en attente ;
- Region comme propriétaire physique du contrôleur produit ;
- un propriétaire d’objectif OP31 ;
- la parité des 76 points d’entrée V6 ;
- le coût officiel de la nouvelle composition produit ;
- une publication Site.

## Étape suivante

La prochaine tranche doit traiter en priorité **la continuité de session** :

1. définir un snapshot versionné de la campagne commune ;
2. inclure l’ordre et l’identité des propriétaires ;
3. inclure la déduplication des acquisitions conjointes ;
4. inclure FieldStock : modèle, prior, stock et échantillons ;
5. représenter explicitement le `needId`, la proposition et l’action physique en
   attente ;
6. restaurer atomiquement sans double acquisition ;
7. vérifier une désactivation puis réactivation Agent sur une observation réelle.

Ensuite :

1. remplacer dans le host produit le propriétaire STCK autonome par le
   propriétaire conjoint canonique, sans priorité implicite ;
2. qualifier ce raccord sur le transport réel ;
3. mesurer séparément le coût produit SMLP et STCK ;
4. poursuivre Region physique et identifier un propriétaire réel avant OP31.

Aucune publication Site n’appartient à cette tranche.
