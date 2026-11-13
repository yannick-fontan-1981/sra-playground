# OP01–OP31 — campagne produit SMLP réelle sous Pyodide

Date : 13 novembre 2026

## Références

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Canonique de départ :
  `90cb819f028aea315fdbba9774a22fb345bcfb81`
- Branche de travail :
  `op01-op31-live-smlp-pyodide-campaign-20261113`
- Candidat fonctionnel qualifié :
  `ef54b59ed68e75207ba77a182016b357248c6cc6`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Suivi consolidé : `docs/migration/op01-op31-progress.md`
- Propriétaires publics précédents :
  `docs/recovery/op01-op31-browser-public-action6-owner-20261113.md`
- Preuve structurée durable :
  `docs/recovery/op01-op31-live-smlp-product-campaign-qualified.json`

## Objectif

La tranche précédente avait activé le propriétaire conjoint SMLP dans le host
produit et démontré sa causalité avec des observations synthétiques contrôlées.
Elle ne démontrait pas encore que la composition complète pouvait traverser le
transport navigateur réel jusqu’au moteur Python exécuté sous Pyodide.

Cette tranche qualifie donc la chaîne réelle suivante :

**observation du jeu natif → `BrowserGameRuntime` → `game-worker.ts` → Pyodide →
`game_bridge.py` → `custom-games.zip` → host produit → propriétaire conjoint →
OP28 → ACTION6 → retour réel → acquisition conjointe → observation passive
FieldStock → présentation.**

La qualification est fonctionnelle. Elle ne mesure pas le coût officiel de la
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
- backend rapporté : `python-native-archive`.

Candidat :

- navigateur Chrome `156.0.8078.79` ;
- Python navigateur `3.14.2` ;
- backend rapporté : `python-wasm` ;
- transport réel `BrowserGameRuntime` et Worker produit.

Le qualificateur ne remplace pas le moteur par une fixture. La fixture navigateur
n’injecte ni frame, ni retour, ni état interne du jeu.

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
10. l’ordre d’effets est :

```text
action physique
→ retour du Worker
→ observation passive FieldStock
→ callback d’acquisition
→ présentation
```

L’ordre concret capturé est :

```text
action:6:32:26
action-return
passive-field-stock
acquired
present
```

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

Les trois `needId` sont distincts. Leur contenu complet reste dans l’artifact
GitHub Actions ; leurs condensats SHA-256 sont conservés dans la preuve JSON
durable.

## Causalité conjointe observée

Les trois cycles ont conservé les deux contributions attendues :

- disponibilité publique courante d’ACTION6 ;
- cible publique visible revalidée.

Le propriétaire conjoint n’a pas réduit les deux contributions à un simple
compteur. Il a transmis au retour :

- l’identité du canal ;
- la référence de contribution ;
- la référence conjointe ;
- la proposition sélectionnée ;
- le `needId` physique exact.

Chaque acquisition a été routée une seule fois :

- `routed: true` ;
- `duplicate: false` ;
- acquisition réussie sur les deux canaux.

## Observation passive FieldStock

Le basculement d’une porte SMLP ne constitue pas une preuve suffisante pour
acquérir un modèle adressé FieldStock.

À chaque cycle :

- `observeAddressedReturn()` est effectivement appelé ;
- son résultat est `field_fit_unresolved` ;
- le statut de connaissance reste `empty` ;
- aucun modèle n’est créé ;
- aucun prior n’est créé ;
- aucun stock n’est créé ;
- aucun échantillon n’est conservé.

Cela démontre simultanément deux propriétés :

1. l’observation passive réelle n’est pas omise ;
2. elle ne transforme pas un retour insuffisant en connaissance inventée.

## Qualification GitHub Actions

Workflow temporaire :

`.github/workflows/op01-op31-live-smlp-product-campaign.yml`

Exécution :

- run : `43364453319` ;
- job : `131685442943` ;
- candidat : `ef54b59ed68e75207ba77a182016b357248c6cc6`.

Résultats :

- `npm ci` : réussi ;
- régression TypeScript complète : **363/363 réussis** ;
- échecs : `0` ;
- annulés : `0` ;
- ignorés : `0` ;
- TODO : `0` ;
- build de production : réussi ;
- Pyodide local préparé : réussi ;
- modules Vite transformés : `62` ;
- galerie : `100` jeux, `636` prévisualisations, `4` atlas natifs ;
- campagne SMLP réelle : réussie ;
- cycles comparés : `3` ;
- rapport de câblage : `logos-product-wiring-present` ;
- fichiers source inspectés : `25`.

Artifact :

- identifiant : `14010025857` ;
- nom : `op01-op31-live-smlp-product-campaign` ;
- taille : `2026` octets ;
- digest :
  `328d3536f7bbdffef972f4870dbc8243a34b4c89198ef8cff6756fbb4bdbe7e4`.

Deux vulnérabilités de dépendances de sévérité haute, déjà présentes avant cette
tranche, restent signalées par `npm ci`.

## Disposition OP28

La chaîne SMLP OP28 est maintenant démontrée à deux niveaux complémentaires :

1. **causalité du producteur** : retirer l’un des deux canaux supprime l’action ;
2. **exécution produit réelle** : les deux canaux traversent Pyodide, ACTION6,
   acquisition et présentation avec la même identité physique.

Disposition :

**OP28 SMLP conjoint est fonctionnellement qualifié dans le produit navigateur
réel sur trois retours consécutifs du corpus natif SMLP seed 0.**

Cette disposition ne prétend pas résoudre le jeu SMLP complet ni généraliser la
politique à plusieurs portes visibles.

## Frontière de performance

Les temps de dispatch présents dans le rapport ne sont pas utilisés pour une
acceptation de performance. La campagne comporte seulement trois cycles et ne
suit pas le protocole ABBA officiel.

Par conséquent :

- C7 Region reste qualifié dans son périmètre historique ;
- le coût du propriétaire conjoint dans la composition produit reste non
  qualifié ;
- aucun pourcentage de surcharge produit n’est revendiqué ;
- aucune compensation entre jeux n’est appliquée.

Une mesure de coût devra utiliser des runners A/B séparés, le même corpus, un
échauffement explicite, aucun échantillon supprimé et le seuil strict de `+10 %`
par jeu.

## Limites conservées

Cette tranche ne démontre pas encore :

- une résolution complète des niveaux SMLP ;
- une campagne réelle STCK avec le propriétaire strict produit ;
- deux contributions causales indépendantes pour STCK ;
- la persistance entre activations Agent ;
- la restauration d’un `needId` ou d’une action en attente ;
- Region comme propriétaire physique du contrôleur produit ;
- un propriétaire d’objectif OP31 ;
- la parité des 76 points d’entrée V6 ;
- le coût officiel de la nouvelle composition produit ;
- une publication Site.

## Étape suivante

La prochaine tranche doit traiter **la continuité de session** avant d’élargir
la portée symbolique :

1. définir un snapshot versionné de la campagne commune ;
2. inclure les propriétaires, leur déduplication et leurs connaissances ;
3. inclure FieldStock : modèle, prior, stock et échantillons ;
4. représenter explicitement un retour physique en attente ;
5. restaurer sans double acquisition ni perte de `needId` ;
6. vérifier une désactivation puis réactivation Agent sur une observation réelle ;
7. conserver en parallèle la dette STCK réelle et la mesure de coût ciblée.
