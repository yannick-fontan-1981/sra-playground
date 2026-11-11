# Lot 10B : revue des outils de coût Window

## Statut de cette préparation

Cette note décrit l'adaptation de huit **sources d'outils** récupérées dans
`docs/migration/lot10a-evidence/`. Elle ne reconstitue aucun reçu perdu et
n'annonce aucune capture fonctionnelle, fenêtre ABBA ou acceptation de coût.
Les outils n'ont pas été exécutés pendant cette adaptation. La revue est
textuelle ; les captures et leur qualification restent à faire sur les gels
réels retenus par le responsable de livraison.

Une vérification de syntaxe seule a ensuite été exécutée sous le verrou partagé
`performance.lock` : les quatre fichiers JavaScript passent `node --check` et
les quatre fichiers Python passent `ast.parse`. Les huit vérifications ont
réussi ; aucun de ces outils n'a été importé ou lancé, aucun inventaire,
hash, gel, replay, jeu ou rapport de coût n'a été produit par ce contrôle.

Le prédécesseur prévu pour la comparaison officielle est le **vrai publié
native 0.61**, lorsqu'il sera disponible et réconcilié. Une préparation sur
Site 95 / native 0.58 ne peut servir que de diagnostic. Aucun identifiant,
numéro de Site, commit, digest ou effectif du futur prédécesseur n'est inventé
ici. Les arguments d'identité restent obligatoires ; la vérification de la
publication distante appartient au responsable, séparément des vérifications
des octets locaux.

## Fichiers adaptés

Chaque nom ci-dessous provient du fichier homonyme du lot 10A. Aucun outil
commun dans `scripts/` n'a été modifié par cette adaptation.

| Source du lot 10B | Responsabilité conservée ou adaptée |
| --- | --- |
| `prepare-cost-protocol.py` | Déclaration prospective, identités réelles, outils figés, politique globale et phases diagnostiques. |
| `prepare-owner-cost-contract.py` | Fermeture exclusive du contrat après captures, qualification et inventaire réels ; vérification ultérieure sans rafraîchir la date. |
| `record-owner-source-inventory.mjs` | Inventaire des deux vraies factories non initialisées et de leurs installations de programmes. |
| `capture-cost-owner-graphs.mjs` | Quatre formes fonctionnelles froides par version, sans métrique de coût, avec appels réels à `WindowQuestion.recordSource`. |
| `qualify-cost-owner-graphs.mjs` | Chaînes Kernel complètes, attribution causale Window et fixture prospective des seules différences structurelles autorisées. |
| `consolidate-owner-costs.mjs` | Consolidation JavaScript de toutes les durées et vérification de chaque forme mesurée contre sa fixture antérieure. |
| `review-owner-costs.py` | Recalcul indépendant en Python, sans importer le consolidateur ni rejouer le moteur. |
| `check-cost-static-inputs.py` | Contrôle statique complet des identités, dépendances, outils, archive et contrat avant readiness. |

Les nouveaux schémas utilisent `lot10b`. Le propriétaire ajouté doit être
exactement `public_window_question` et son programme installé exactement
`v6.window_question.choose`, sans retrait d'un propriétaire ou programme de
référence. La factory ne reçoit ni observation, ni checkpoint, ni session lors
de l'inventaire. Ses programmes sont réellement installés dans un store séparé ;
ils ne sont pas déduits du nombre de programmes compilés disponibles.

## Contrats source relus

Référence Python épinglée :

- `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/window_question/family.py` ;
- `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/morphology_policy/window_question/geometry.py` ;
- `reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py`, acquisition Window et publication de son état.

La preuve d'entrée native lie sept fichiers :
`v6-native-runtime.ts`, `v6-native-types.ts`, `v6-window-question.ts`,
`v6-window-question-geometry.ts`, `v6-window-question-policy.ts`,
`v5-window-processing.ts` et `v6-knowledge-store.ts`, sous `src/logos-engine/`.
L'inventaire complet des sources natives lie aussi leurs dépendances ; les
validateurs Kernel, graphes d'état, canonicalisation, programmes et service
doivent être identiques entre les deux gels.

La capture observe le propriétaire réel `acquisitionFamilies.window`, puis
enveloppe uniquement `recordSource`. L'appel original reçoit ses arguments
inchangés et son résultat original est rendu inchangé. Le reçu détaché retient
les identités des deux observations, la commande, les deux rasters, le paquet
public complet, le proposal éventuel, l'index et les états source avant/après.
Il ne clone aucun contexte d'exécution contenant un callback. Le compte impose
un appel d'acquisition par transition scellée, choisie ou étrangère, sans
doublon de l'observation avant. La commande publique effective est vérifiée
avant de fournir le retour enregistré.

Les règles propres à Window remplacent les règles Axial du lot 10A :

- L'enveloppe `native.public_window_question.v1` conserve exactement les six
  champs `epoch`, `edits`, `portable`, `launches`, `attempts`, `last`.
- Le fait source `window_question_state` n'est publié que si `edits`,
  `portable` ou `attempts` est non vide. `launches` et `last` seuls ne
  déclenchent pas ce fait ; ils restent présents dans le checkpoint natif.
- Un changement de champ conserve l'autorité
  `observed_field_change_not_capture_law` et concerne `capacity`, `filter` ou
  `second_field`. Un paquet de plus d'une image conserve l'autorité
  `observed_packet_not_complete_mechanical_model`, même si toutes ses images
  sont identiques. Son nombre d'images distinctes et son delta de score sont
  vérifiés contre le paquet effectivement transmis.
- À une frontière avec première image mesurable, les méthodes et les reçus
  de lancement sont transférés lorsque des éditions existent, avec l'autorité
  `method_only_not_current_permit`. Le nouvel epoch réinitialise `edits`,
  `launches`, `attempts` et `last`. Si la première image n'est pas mesurable,
  `record` retourne immédiatement `None` après `scope(before)` : le qualificateur
  ne force pas `scope(after)` dans cette branche.
- Le fait `window_question_event:<revision>` doit correspondre au retour réel,
  à son evidence et à sa revision. Un retour nul passif n'autorise aucun fait
  événement ; la voie sélectionnée conserve le comportement réel du caller.

Le contrôle des reçus et de leurs transitions ne constitue pas un second
oracle géométrique : il vérifie la provenance et les règles de conservation
des valeurs capturées. La fidélité des mesures, projections et décisions reste
une preuve de composant distincte. Aucune adaptation de frontière Axial ou
attribution du nouveau décor à un ancien effet mécanique n'est transférée.

## Graphes communs et coût additionnel

Les seuls champs de travail admissibles à la comparaison complémentaire sont
`observations[*].nodeCount`, `inspection[*].graphNodes`, `final.nodeCount` et
`final.graphRevision`. Leurs valeurs exactes A/B proviennent des captures
fonctionnelles antérieures à la fenêtre ; aucune constante de croissance par
cycle ou par action n'est prévue.

Chaque graphe est reconstruit à partir de ses deltas complets. Les nouveaux
nœuds et deltas doivent provenir de l'installation Window, de son état natif,
des faits source effectifs ou de fragments référencés depuis ces racines et
leur index réel. Les fragments supersédés restent attribués par leurs anciennes
racines retenues. Les identités, métadonnées, causes et ordre des deltas communs
restent exacts, hormis le digest source propre à chaque version. Une création
anticipée par Window d'un fragment commun ne reçoit aucune dispense. Les
valeurs privées communes restent dans les captures, sans prétention de parité
générale de ces valeurs entre versions.

Le contrôle historique strict est toujours exécuté et son résultat réel est
conservé. Le chemin complémentaire exige son refus précis pour différence des
métadonnées de travail. Un autre échec, une réussite ou une sortie inattendue
bloque ce chemin ; aucun refus n'est fabriqué. L'attribution structurelle
**n'enlève aucun temps ni aucune opération** aux rapports de coût.

## Budget prospectif conservé

L'ordre est A1/B1/B2/A2 : 32 sessions mesurées, 400 actions, huit chauffes et
leurs 24 actions exclues. Ces nombres sont les effectifs **prévus**, pas un
résultat de cette reprise. Toute interruption ou population incomplète bloque
la consolidation et conserve ses sorties.

Pour chaque jeu séparément, les huit durées complètes A et les huit durées B
sont réunies, puis leurs médianes comparées. L'augmentation doit rester
**strictement inférieure à 10 % dans chaque jeu** ; une égalité échoue. La
comparaison du seuil utilise des rationnels décimaux en JavaScript et Decimal
en Python. Aucun jeu ne compense un autre, aucune cohorte favorable n'est
sélectionnée, aucun échantillon extrême n'est supprimé et aucune marge de bruit
n'est ajoutée. Les phases imbriquées ne sont pas additionnées.

Une phase peut dépasser 10 % lorsque les deux critères globaux passent. Ses
valeurs, son statut diagnostique et les dispersions restent visibles ; la
décision globale demeure distincte. Le p95 reste absent en dessous de vingt
échantillons. Une revue arithmétique réussie avec `globalAccepted: false`
n'est pas une acceptation de coût.

## Travail restant avant utilisation officielle

Le responsable doit intégrer le prédécesseur réellement publié, établir les
gels et les archives neufs, exécuter les captures et leur qualification, puis
fermer le contrat et le préflight avant la readiness et l'isolation. Les huit
outils sont eux-mêmes liés prospectivement par la déclaration. Tout défaut
observé lors de ces étapes doit conserver sa tentative et provoquer une
nouvelle déclaration si les outils ou les sources changent. Cette préparation
ne revendique ni réussite HPDL, ni parité complète du caller V6, ni publication.
