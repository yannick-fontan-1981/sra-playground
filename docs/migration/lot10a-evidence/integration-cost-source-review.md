# Revue de source : intégration des prédécesseurs et preuves de coût 10A

## Nature, date et identités consultées

Revue indépendante en lecture seule, consignée le **10 novembre 2026 à
22:13:17 UTC**. Provenance 7B corrigée et recoupée dans les objets Git le même
jour à **22:16:11 UTC**. Aucun défaut d'adaptation démontré ne justifie une modification
préventive des outils 10A. Ce constat porte sur les sources consultées ; **il
ne constitue ni une capture exécutée, ni une qualification structurelle, ni une
acceptation de coût**.

Les HEAD de consignation ont été relevés **après** la lecture des checkouts et
ne suffisent pas à identifier les octets lus avant un repli. En particulier,
7B avait été lu dans sa version préparatoire intégrant 5A, puis son checkout
est revenu à `20f6a9f` avant le relevé des HEAD. Ce dernier commit n'atteste pas
la comparaison des huit validateurs. La version préparatoire est recoupée
ci-dessous directement avec `git show`, sans importer son histoire dans 10A.

| Lot | Checkout effectivement consulté | Version de source identifiée pour cette revue | HEAD relevé à la consignation |
| --- | --- | --- | --- |
| 10A | `/workspace/sites/sra-lot10a-20261110/.sites-checkout` | `96840d7f31515a15c21e71c395fba4a6e50fb135` | Identique |
| 5A | `/workspace/sites/sra-lot5-20261110/.sites-checkout` | `51e2813dedb2d71001290f94f100605e0327ead3` | Identique |
| 4B | `/workspace/sites/sra-lot4a-20261110/.sites-checkout` | `64e024f5a6c2faf42205dc39fe4b35a6cecbcc9f` | Identique |
| 7B | `/workspace/sites/sra-lot7b-20261110/.sites-checkout` | **`2c2da44f960fa01557b2d9e1fe01a62f068eb079`** | `20f6a9fc3506ce5e2862fa72cbf37fcb452ba486`, après repli |

Il n'y avait pas de relevé SHA-256 des fichiers au début de la lecture. Les
diffs textuels initiaux avaient toutefois conservé les préfixes des objets Git
de `src/logos-engine/v6-native-runtime.ts`. Leur résolution dans les commits
ci-dessus donne :

| Version | Objet Git du runtime, correspondant au préfixe du diff initial |
| --- | --- |
| 5A `51e2813` | `8c2ef261e450b953801051c3485382244183a0ad` |
| 4B `64e024f` | `709fcd80334dd53ae4d8cd65c5ad1aa2a49b2f6f` |
| 7B préparatoire `2c2da44` | `3f6b901f573d9bb5e3962fbada9ec9ca9fc50c92` |

Le runtime 7B de `20f6a9f` porte au contraire l'objet
`1529c38524e37a8c49f14db559e56538b5976364`. Le recoupement des huit validateurs
avec les objets du commit préparatoire est détaillé en section 2. Pour 10A,
un diff limité aux deux répertoires natifs et aux trois outils cités ne montre
aucun changement entre `acc550a` et `96840d7`. Ces recoupements de provenance
ne constituent pas un inventaire SHA-256 préalablement déclaré ni une
attestation de publication des prédécesseurs.

Le périmètre de lecture comprend :

- dans 5A, `src/logos-engine/kernel.ts`, `v6-knowledge-store.ts`,
  `v6-native-runtime.ts`, `v6-native-state-graph.ts`, `v6-native-authority.ts`,
  `v6-native-caller.ts`, `v6-reasoning-memory.ts`, `v6-observed-frontier.ts`,
  ainsi que les points d'inspection de `src/runtime/v6-agent-service.ts` ;
- dans 4B et 7B, les différences de `src/logos-engine/v6-native-runtime.ts`
  par rapport à 5A et les points d'extraction des deltas du caller/frontier ;
- dans les trois prédécesseurs, la comparaison textuelle des huit fichiers
  `VALIDATORS` détaillés ci-dessous ;
- dans 10A, l'acquisition et l'ordre de factory de
  `src/logos-engine/v6-native-runtime.ts`, ainsi que les contrats de
  `docs/migration/lot10a-evidence/record-owner-source-inventory.mjs`,
  `capture-cost-owner-graphs.mjs` et `qualify-cost-owner-graphs.mjs`.

Les chemins `v6-*.ts` abrégés dans la première ligne appartiennent tous à
`src/logos-engine/` du checkout indiqué. Aucune histoire Git, preuve de coût ou
exception de qualification d'un autre lot n'a été importée dans 10A.

Aucun test, import de module, lancement Node, oracle, jeu, capture, build,
décompression ou mesure n'a été effectué. Le seul fichier créé pour cette
consignation est le présent document ; aucun outil n'a été modifié et aucun
commit n'a été créé par le relecteur.

## 1. Transaction atomique et extraction des deltas

`Kernel.beginTransaction()` de 5A conserve un delta individuel par écriture
effective. Le calcul conserve la séquence, la révision du nœud, `previous`,
`cause`, `source_digest` et le digest. Les écritures sont attendues dans leur
ordre ; `finish()` publie le graphe et la liste complète des deltas après leur
réussite. Il n'existe pas de remplacement par un delta agrégé de transaction.

Le knowledge store conserve l'ordre des écritures demandé, avec les fragments
avant la racine de chaque nœud. Il ne publie `this.state` qu'après `finish()`.
L'acquittement `didCheckpoint()` de l'autorité reste postérieur au commit
réussi. Les checkpoints incrémentaux des faits conservent l'ordre des faits et
traces, puis l'index `reasoning:memory` et le bridge.

Le captureur 10A appelle `inspectKnowledge()` **après**
`await service.handle()`. Il extrait `memory.deltas.slice(revision)`, contrôle
la chaîne et reconstruit tous les nœuds avant de comparer le graphe au snapshot.
Il n'a donc pas besoin de lire les états intermédiaires d'une transaction. Les
trois inspections terminales doivent toujours produire zéro delta et restituer
le graphe effectif.

Le frontier de 5A conserve aussi sa liste ordonnée d'événements dans
`drainDeltas()`. Le caller persiste chacun d'eux sous un fait numéroté ; le
captureur lit ensuite leur représentation dans le graphe Kernel. Les nouvelles
identités immuables des snapshots ne changent pas ce contrat d'extraction.

**Conclusion de source :** aucun changement de schéma ou de mode de lecture
n'est nécessaire pour cette transaction atomique. Cela ne remplace pas la
reconstruction effective des futurs graphes capturés.

## 2. Précondition bloquante : mêmes validateurs dans A et B

Les comparaisons textuelles initiales étaient sans différence entre les sources
préparées. Le recoupement de provenance a ensuite comparé, fichier par fichier,
les sorties de `git show 51e2813:<chemin>` dans le dépôt 5A et
`git show 2c2da44:<chemin>` dans le dépôt 7B : les huit comparaisons sont sans
différence. Les objets Git de ces fichiers sont aussi identiques dans 4B
`64e024f`. **Cette égalité porte sur 7B `2c2da44`, pas sur son HEAD de
consignation `20f6a9f`.**

Les identifiants ci-dessous ont été relevés lors de ce recoupement ; ce sont
des objets Git, distincts des empreintes SHA-256 exigées pour les preuves de
coût futures.

| Chemin relatif au checkout | Rôle dans le qualificateur 10A | Objet Git commun aux trois versions identifiées |
| --- | --- | --- |
| `src/logos-engine/kernel.ts` | Contrat et validation des nœuds/deltas | `c297f5046095ee46e3986014b56a34e3036c8058` |
| `src/logos-engine/canonical.ts` | Canonicalisation et digest | `9ad1d8176f2bdb3262f522cc6528f5631b6ebd57` |
| `src/logos-engine/v6-knowledge-store.ts` | Profil du store et lecture des valeurs | `f7a18409b0e72ecd3081e647491f26aebf999911` |
| `src/logos-engine/v6-native-state-graph.ts` | Encodage et hydratation des fragments | `6154c025d1e75f4f0185208d247c4b9a3a3f2a82` |
| `src/logos-engine/v6-hash.ts` | Identités symboliques | `3c12c475dd35d3170d49ae26b53ada9a026f65b5` |
| `src/logos-engine/v6-src-program.ts` | Description et identité des programmes | `437a64c722e4c5c3897a7ec94df28665e81a6142` |
| `src/logos-engine/v6/programs.json` | Programmes transférés | `91330a7a4ff614f00a1a1556e08273d86bb693c3` |
| `src/runtime/v6-agent-service.ts` | Frontière des commandes et inspections | `c5a3b62044f3ff2b1af9734b75a8624e062fbde0` |

Le qualificateur exige que leurs empreintes correspondent aux inventaires des
**deux** captures. Le candidat 10A isolé antérieur à l'intégration de 5A ne peut
donc pas être qualifié contre un futur baseline contenant le nouveau Kernel et
store. Le baseline final et le candidat final doivent partager ces composants,
sans réintroduire l'ancienne version lors d'une résolution de conflit.

La présence d'un prédécesseur uniquement côté candidat ferait également
échouer l'inventaire : le seul propriétaire ajouté admis est
`public_axial_question`, et le seul programme ajouté admis est
`v6.axial_question.choose`. Ces contraintes restent inchangées.

## 3. Union de l'ordre d'acquisition à préserver

| Partie | Contrat à conserver lors de l'intégration |
| --- | --- |
| Acquisition sélectionnée | Enregistrer une seule fois le retour sélectionné, puis les acquisitions passives de cette même transition. |
| 5A LinkedPreparation | Après les propriétaires de support et avant SharedSeries ; ne pas réacquérir passivement un retour sélectionné ; conserver sa liste complète d'événements sélectionnés, même vide. |
| 4B RelativeArrangements | Conserver l'événement et l'état de l'expérience sélectionnée. Son arrêt de groupe demeure distinct du refus global de 5A. |
| 10A Axial | Un seul appel à `recordObserved` par retour acquis, sélectionné ou passif ; conserver l'acquisition avant l'état Recolor. |
| 7B Symbols | Conserver son état seulement lorsqu'il est sélectionné, après ReactiveContact et avant l'état Workshop ; ne pas ajouter d'acquisition de retours étrangers. |
| Persistance | Préserver l'ordre relatif des écritures et familles déjà présentes dans le baseline, puis acquitter l'autorité après réussite du commit. |

Les mêmes instances doivent rester enregistrées dans la factory et dans
`acquisitionFamilies`. Le contrat du captureur reste exactement un appel Axial
par action acquise côté candidat et aucun côté baseline. Une fusion qui oublie
le chemin passif ou le double avec le chemin sélectionné échouerait ce contrôle.

Les nouveaux refus de proposition et arrêts de groupe peuvent légitimement
affecter la sélection. Les traces de coût doivent donc encore correspondre aux
commandes réellement calculées sur les deux gels. Le captureur compare chaque
commande **avant** de fournir son retour public archivé. Une incompatibilité
ne peut pas être traitée comme une simple différence de compteurs de graphe.

## 4. Risque concret restant : premier consommateur d'un fragment commun

Les fragments de `splitNativeState` sont partagés par contenu. Leur identité ne
réserve pas un espace distinct à chaque propriétaire. Lorsqu'un fragment existe
déjà, le store conserve sa provenance initiale et ne le crée pas à nouveau.

Un fait Axial inséré avant un checkpoint commun peut donc avancer la première
création d'un fragment également utilisé par ce checkpoint. Deux refus restent
possibles :

- la provenance initiale diffère si la première création se produit sous une
  autre cause ;
- l'ordre d'un delta commun diffère, même lorsque sa cause reste identique au
  sein d'une même transaction.

Le qualificateur 10A vérifie les métadonnées des nœuds communs et l'ordre des
deltas communs après retrait des seules additions Axial attribuées. La
transaction atomique ne neutralise pas ce risque, puisqu'elle conserve l'ordre
des écritures. **Ces différences doivent rester des refus.** Aucune exception
de premier consommateur, normalisation d'origine ou formule de croissance de
graphe n'est ajoutée à la suite de cette revue.

La source seule ne permet pas d'affirmer que STCK ou SMLP rencontreront ce cas
sur les gels finaux. La qualification réelle des quatre formes doit le
déterminer avant toute mesure officielle.

## 5. Préconditions restantes, distinctes d'une qualification

1. Intégrer les prédécesseurs effectivement publiés et retenir le baseline
   distinct réel, puis figer le candidat intégré.
2. Conserver les huit validateurs partagés identiques entre les deux sources,
   l'ordre des acquisitions et l'addition exacte du seul propriétaire Axial.
3. Finaliser une nouvelle déclaration sur ces octets avant les nouveaux
   inventaires et captures. Ne pas réutiliser les identités de la validation
   fonctionnelle isolée comme preuves du futur couple A/B.
4. Exécuter les captures et obtenir la qualification stricte de leurs formes,
   puis le contrat et le préflight, avant une readiness complète et une
   nouvelle coordination explicite de la fenêtre.
5. Conserver ensuite le vrai contrôle historique strict et les deux recalculs
   de coût. Ni le passage des contrôles fonctionnels ni cette revue de source
   ne préjugent de leurs résultats.

Cette revue établit une compatibilité attendue et des conditions de refus
identifiées dans le code. Elle n'annonce aucun résultat de capture, de
qualification, de coût ou de publication.
