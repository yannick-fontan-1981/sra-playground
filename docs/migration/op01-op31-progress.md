# Progression OP01 à OP31 du Logos Engine

Dernière consolidation : 12 novembre 2026.

## Références canoniques

- Dépôt : `yannick-fontan-1981/sra-playground`
- Branche canonique cible : `recovery/site109-reconstruction-20261112`
- Baseline canonique intégrée avant qualification finale :
  `8cc510e0a0d09704eb508b3aa2216b4d63482af4`
- Branche de travail : `recovery/lot5b-worker-common-campaign-20261112`
- Commit de réconciliation avec le canonique :
  `3ad3328df6b85f4fc0e1f534fd4bf138efbca359`
- Commit fonctionnel qualifié :
  `08a04a9da59b0f385d080acf6091d4acdcf800c6`
- Donneur OP01–OP31 : `op01-op31-c0-c7-audit`
- Plan stable : `docs/migration/op01-op31-verification-plan.md`
- Historique détaillé antérieur :
  `docs/migration/op01-op31-progress-history-through-b093f406.md`
- Reprise Lot 6 et seam Worker :
  `docs/recovery/op01-op31-lot6-runtime-reconnection-20261112.md`
- Tranche publique OP28 :
  `docs/recovery/op01-op31-public-observation-op28-slice-20261112.md`
- Réconciliation Lot 5 et chaîne OP18 :
  `docs/recovery/op01-op31-lot5-op18-reconciliation-20261112.md`
- Propriétaire commun :
  `docs/recovery/op01-op31-common-campaign-owner-20261112.md`
- Raccord Worker du propriétaire commun :
  `docs/recovery/op01-op31-worker-common-campaign-20261112.md`

Le présent fichier est l’état courant consolidé. L’historique Git conserve les
preuves, mesures et décisions précédentes.

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

Un compteur, un import ou une trace sans consommateur ne suffisent pas. Aucune
OP n’est ajoutée uniquement pour atteindre 31 appels.

## Provenance et limites historiques

`src/runtime/v6-agent-worker.ts` reste une reconstruction. La source officielle
historique du Worker Site 109 et le runtime/campaign complet de native 0.68 n’ont
pas été retrouvés. Aucune identité binaire ou parité exacte n’est revendiquée.

Les composants FieldStock et matériaux adressés sont également des
reconstructions qualifiées à partir de sources donneuses et de contrats publics.

Les quatre identités de runners A/STCK, A/SMLP, B/STCK et B/SMLP sont
reconstruites au niveau du contrat. L’exécution native ACTION6 a été qualifiée
sur SMLP, mais le benchmark officiel global par jeu reste absent.

Statut performance global :

**fonctionnellement qualifié, performance officielle à confirmer.**

## Composants runtime pertinents

### Transport et Worker

- `src/runtime/browser-games.ts` et `game-worker.ts` : transport jeu public ;
- `src/runtime/contracts.ts` : contrats `AgentObservation` / `AgentAction` ;
- `src/runtime/v6-browser-agent-observation.ts` : adaptation publique stricte ;
- `src/runtime/v6-agent-worker-core.ts` : séquence, budget, annulation et hook
  d’observation avant arrêt terminal ;
- `src/runtime/v6-agent-worker.ts` : enveloppe Worker, dont le port par défaut est
  désormais la campagne commune OP18/OP28 ;
- `src/agent-product-dispatch.ts` : dispatch produit existant, non encore relié à
  une campagne SRA live.

### Matériaux adressés et FieldStock

- `src/runtime/observed-addressed-material-runtime.ts` : rétention, frontière,
  revalidation et stock courant ;
- `src/logos-engine/addressed-field-*.ts` : acquisition, réponse, garde,
  rétention et fit ;
- `src/logos-engine/field-stock.ts` : question, plan borné, préservation,
  coordonnées ACTION6 et bundle OP18 ;
- `src/logos-engine/linked-preparation.ts` et
  `observed-object-binding.ts` : liaisons et préparation publiques.

### Campagne commune et observation publique

- `src/logos-engine/v6-neutral-common-caller.ts` : collecte neutre et ambiguïté ;
- `src/logos-engine/v6-common-campaign-owner.ts` : propriété, release Logos,
  attente, retour et déduplication ;
- `src/logos-engine/v6-field-stock-caller-adapter.ts` : owner OP18 ;
- `src/logos-engine/v6-public-single-action-caller-adapter.ts` : owner OP28 ;
- `src/runtime/v6-public-observation-measurement.ts` : mesure 64×64 publique et
  composants 4-connexes différés ;
- `src/runtime/v6-common-campaign-decision-port.ts` : hôte Worker persistant,
  acquisition du retour, frontière, revalidation et proposition suivante.

## État courant C0 à C7

| Lot | État courant | Preuve acquise | Dette suivante |
| --- | --- | --- | --- |
| C0 | **terminé** | 31 calculs inventoriés, dispositions et provenance conservées | maintenir les statuts par besoin, pas par compteur |
| C1 | **propriétaire commun raccordé au Worker reconstruit** | collecte bornée, ambiguïté, release OP18/OP28, attente et retour au même `needId`, y compris terminal | créer la campagne SRA live dans le produit |
| C2 | **OP18 et OP28 consommées avec effet démontré** | FieldStock modifie l’action suivante ; OP28 règle aussi son dernier retour sur `WIN` ou budget nul | relier Worker, dispatch produit et observation post-action réelle |
| C3 | **calculs et recouvrements qualifiés** | OP03/08/12/14/26 couvertes au noyau ; spécialisations identifiées | appeler seulement lorsqu’un producteur réel établit le besoin |
| C4 | **audit complet, usages génériques non démontrés** | OP01/02/05/10/15/25 calculables | ne pas activer sans producteur et consommateur |
| C5 | **retours spécialisés préservés** | FieldStock et Region couvrent OP06/29/30 avec effet futur | donner à Region un candidat public complet avant enregistrement commun |
| C6 | **audit complet** | inconnue, échec borné et impossibilité distincts | aucun raccord sans preuve de blocage/reprise/variante |
| C7 | **ouvert** | garde-fous, ABBA, runners explicites et probe SMLP ACTION6 natif qualifié | mesurer A/B × STCK/SMLP et respecter < +10 % par jeu |

## Chaîne réelle OP18 : FieldStock

### Besoin et données

Un stock adressé retenu est revalidé dans la scène courante. Une demande typée
manque et ACTION6 est publiquement disponible.

`FieldStock.propose()` produit :

- question ouverte mesurable ;
- composition non observée ;
- plan borné à 16 pas ;
- ACTION6 avec coordonnées mesurées ;
- obligations de préservation ;
- faits et preuves ;
- `bundle_template.operation_key = OP18` avec outcome guard.

### Appel, retour et effet

1. le port Worker consomme d’abord l’observation publique ;
2. le prior est revalidé si nécessaire ;
3. l’owner FieldStock exécute `beforeStock()` ;
4. la proposition unique est remise au propriétaire commun ;
5. `releaseBundle()` appelle OP18 ;
6. `operationAdmission()` garde l’action ;
7. l’observation suivante est acquise avec le même `needId` ;
8. `afterStock()` compare ;
9. `recordStock()` confirme, apprend, enregistre un échec ou réfute ;
10. la proposition suivante tient compte de ce résultat.

Scénario démontré : ACTION6 vers `(3,1)`, déplacement observé, puis ACTION6 vers
`(4,1)`.

Disposition OP18 :

**chaîne raccordée au Worker lorsqu’un prior explicite est disponible et
revalidé ; acquisition initiale publique du prior encore absente.**

## Chaîne réelle OP28 : action publique unique

Sous le contrat public strict d’une seule action simple non RESET :

1. l’observation publique est validée ;
2. l’owner OP28 prépare le bundle ;
3. le caller confirme l’unicité ;
4. `releaseBundle()` appelle OP28 ;
5. `operationAdmission()` consomme le résultat ;
6. le Worker retourne l’action ;
7. l’observation suivante règle le retour au même `needId` avant toute nouvelle
   décision.

Le hook `AgentDecisionPort.observe()` garantit cette acquisition avant :

- une nouvelle décision ;
- l’arrêt `WIN` ;
- l’arrêt pour budget non positif.

Aucune décision supplémentaire n’est demandée après un retour terminal.

Disposition OP28 :

**chaîne raccordée au Worker sous condition publique stricte, y compris retour
terminal.**

## Neutralité et ambiguïté

- 0 proposition → `none` ;
- 1 proposition → validation puis release Logos ;
- plus d’une proposition → `ambiguous` ;
- bundle refusé → `blocked` ;
- action libérée → attente jusqu’au retour corrélé.

Aucune OP n’est appelée dans les cas `none` ou `ambiguous`. Le Worker n’injecte
aucun prior FieldStock par défaut et n’invente aucune coordonnée ACTION6.

## Region

Region possède déjà un owner spécialisé, un adaptateur, une acquisition
sélectionnée/passive, une déduplication, un snapshot et un effet futur.

Le probe natif qualifié montre :

- SMLP ACTION6 utile : **9 pixels modifiés** à `x=32,y=26` ;
- STCK ACTION6 non utile dans le probe public retenu : **0 pixel modifié** à
  `x=6,y=56` ;
- le corpus public STCK V1 conserve ACTION5 disponible, ce qui empêche le
  sélecteur public strict de choisir honnêtement ACTION6 en état non terminal.

Region n’est pas inscrit dans le port Worker commun tant qu’il ne produit pas un
candidat public complet
`AgentAction + CompositionBundle + état symbolique + identity`. Aucun
`methodRef` ou bundle artificiel n’est inventé.

## Statut des opérations prioritaires

| OP | Statut exact | Producteur | Consommateur | Contribution démontrée |
| --- | --- | --- | --- | --- |
| OP18 | **raccordée au Worker sous prior revalidé** | `FieldStock.propose()` | admission, `afterStock()` et `recordStock()` | garde l’action et modifie la suivante |
| OP28 | **raccordée au Worker sous condition stricte** | owner action publique unique | admission et acquisition corrélée | garde l’action et règle le retour, même terminal |
| OP29 | **assurée par fonctions spécialisées** FieldStock/Region | retour avant/après | modèle spécialisé | peut invalider ou sceller la suite |
| OP30 | **assurée par fonctions spécialisées** FieldStock/Region | observation de rewrite/effet | règle, échec ou réfutation | propositions futures modifiées |
| OP31 | **appel disponible, propriétaire produit absent** | postAnalyse générique | aucun propriétaire d’objectif | non démontrée en produit |
| OP03 | **bloquée par producteur générique manquant** | aucune production tri-état générale | admission/plan potentiel | non |
| OP08 | **bloquée ou recouverte familialement** | pas de graphe transversal produit | stratégie potentielle | non générique |
| OP12 | **bloquée ou recouverte familialement** | inconnues d’accès spécialisées | acquisition spécialisée | non générique |
| OP26 | **bloquée ou recouverte familialement** | admissions spécialisées | garde spécialisée | non générique |
| OP06 | **assurée par fonctions spécialisées** | retour Region/FieldStock | modèle spécialisé | contradiction change la suite |
| OP14 | **admission bridge présente, routage natif absent** | aucun besoin produit actuel | garde bridge | non en produit |
| autres OP | **hors périmètre actuel** | aucun nouveau besoin établi | selon C3–C6 | non revendiquée |

## Qualification

### Noyau du propriétaire commun

- run : `43346791891` ;
- job : `131627959298` ;
- commit : `d5fc07b9c825078c7a241d6511eb91287befbc7f` ;
- typecheck réussi ;
- **286/286 tests réussis** ;
- diagnostic de coût réussi.

### Raccord Worker final réconcilié

- run : `43348904523` ;
- job : `131634904435` ;
- commit : `08a04a9da59b0f385d080acf6091d4acdcf800c6` ;
- baseline intégrée : `8cc510e0a0d09704eb508b3aa2216b4d63482af4` ;
- Node `22.18.0` ;
- `npm ci` réussi ;
- `npm run typecheck` réussi ;
- régression TypeScript complète : **304/304 tests réussis** ;
- aucun échec, annulation, test ignoré ou TODO.

Preuves nouvelles :

- mesure publique copiée, bornée et sans fuite par référence ;
- composants visibles calculés seulement pour la revalidation FieldStock ;
- OP28 et OP18 traversent le Worker commun ;
- même `needId` de la release au retour ;
- résultat FieldStock consommé avant la proposition suivante ;
- `WIN` et budget nul règlent le retour sans nouvelle décision ;
- erreur d’observation empêche toute décision ;
- ambiguïté sans opération cachée ;
- ACTION6 inconnue sans prior explicite.

Les workflows temporaires sont supprimés avant intégration canonique.

## Performance

Diagnostic du propriétaire commun :

- aucun besoin direct : `0,233 µs/cycle` ;
- aucun besoin via campagne : `0,349 µs/cycle` ;
- OP28 direct : `2,337 µs/cycle` ;
- campagne avec retour : `6,894 µs/cycle` ;
- surcoût absolu : `4,557 µs/cycle`.

Ce diagnostic n’est pas le benchmark officiel. La clôture C7 exige toujours :

- STCK global strictement inférieur à `+10 %` ;
- SMLP global strictement inférieur à `+10 %` ;
- jeux séparés ;
- aucune compensation ;
- phases internes informatives si le global reste conforme.

## Besoins encore sans traitement

- campagne SRA live créée par le produit ;
- dispatch de la décision Worker vers `BrowserGameRuntime` puis retour réel au
  même Worker ;
- acquisition initiale d’un prior FieldStock depuis la campagne navigateur ;
- candidat Region public complet et inscription dans la campagne commune ;
- acquisition passive orchestrée pour les owners non sélectionnés ;
- snapshot/restauration du port Worker, de l’observation courante et de la
  décision en attente ;
- propriétaire d’objectif consommant OP31 ;
- lecture future générique OP30 ;
- traces/compteurs bornés vers produit ou harness ;
- perception et planification générales lorsque plusieurs actions sont
  possibles ;
- mesures officielles A/B × STCK/SMLP.

## Prochaine étape concrète

Construire l’hôte produit live qui :

1. crée et initialise une session Worker par campagne ;
2. transforme chaque `GameObservation` public en observation Worker monotone ;
3. remet la décision autorisée au dispatch partagé ;
4. conserve `none` et `ambiguous` sans fallback inventé ;
5. remet l’observation post-action réelle au même Worker ;
6. ne produit un prior FieldStock ou un candidat Region qu’après preuve publique
   suffisante ;
7. qualifie ensuite restauration et coût natif.

Aucun Site ne doit être publié avant intégration durable du chemin produit sur
GitHub et vérification GitHub ↔ Site.
