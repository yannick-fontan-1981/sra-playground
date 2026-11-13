# Lot 9A : Chart dans le caller commun, candidat 0.68

Ces outils capturent les formes natives et les graphes complets des cinq cas Chart déjà déclarés. Leur préparation ne crée aucune session et ne lance ni moteur, ni jeu, ni oracle. Le root doit figer `common-declaration.json`, ses empreintes et son superviseur avant de lancer la capture. L'analyse `node --check` lit seulement la syntaxe des deux scripts.

## Identités et entrée

Le candidat est `logos-engine.typescript.v6.native-migration/0.68.0`, avec 334 fichiers natifs et le digest `e7a94fbc7cdcb19d8704b5d4120f27a858cbcd07e455084711510ee147f4e653`. La référence immuable est `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`.

Les entrées proviennent exclusivement du corpus retenu `docs/migration/lot9a-evidence/reference-01/reference.json.gz`, SHA-256 `0770706db16249ac4ab1c7c8b9533d571f2fc2cdaeaf5dae2d990806e412cfe8`. Les rasters sont les 64 × 64 originaux et chaque retour conserve toutes ses images intermédiaires. Aucune taille, palette, observation_ref ou valeur de source n'est adaptée. Chaque instance indépendante emploie l'identité de session source `chart:synthetic`.

La vraie fabrique `createNativeV6Runtime` conserve tous ses groupes et familles. L'instance Chart enregistrée doit être la même que l'instance d'acquisition passive, à la position source 24, après `ordered_reaction`. Les racines de Chart, de son programme, de BranchRouting et des programmes communs restent présentes. Aucun état acquis n'est injecté comme entrée initiale.

## Cas et consommation physique

| Cas | Sessions | Retours physiques | Acquisitions Chart actives | Passives | Ablatées | Resets froids contrôlés | Points capturés |
|---|---:|---:|---:|---:|---:|---:|---:|
| `primary` | 1 | 3 | 3 | 0 | 0 | 2 | 14 |
| `contrary` | 1 | 1 | 1 | 0 | 0 | 0 | 6 |
| `selected-acquisition-ablation` | 1 | 1 | 0 | 0 | 1 | 0 | 8 |
| `passive-scene-equal` | 1 | 2 | 1 | 1 | 0 | 0 | 12 |
| `passive-scene-changed` | 1 | 2 | 1 | 1 | 0 | 0 | 12 |
| **Total attendu par capture** | **5** | **9** | **6** | **2** | **1** | **2** | **52** |

Chaque cas commence par `initialize`, un `resume` avec autorisation encore retenue, puis une inspection réelle. Chaque retour appelle `advance` puis une inspection. Le cas primaire appelle ensuite `resume` et inspecte après chacun de ses deux resets froids. L'ablation inspecte également la nouvelle proposition. Les deux cas passifs désactivent Chart par l'édition native supportée, inspectent, reprennent la sélection commune et inspectent avant le retour étranger. Chaque instance se ferme réellement une seule fois. Le lecteur exige cet ordre complet et les 52 points, sous un plafond de 64.

Les budgets de chaque session sont `targetLevels:3`, `levelActionCaps:[8,8,8]`, `maxActions:8`. Ils ne constituent pas des niveaux gagnés : les paquets restent à zéro niveau terminé.

L'acquisition physique est comptée sur `recordSource`. L'appel englobant `record` est observé pour l'attribution, sans doubler le compte. Le cas ablaté conserve son retour public et supprime seulement l'invocation originale de `recordSource`, qui renvoie alors `null`. Les cas passifs font une vraie acquisition positive initiale, puis une édition `set_family_enabled:false` ; la famille sélectionnée pour le second retour est étrangère à Chart. Cette désactivation ne déconnecte pas l'acquisition passive.

## Restaurations réellement observées

La capture observe les arguments, le résultat, les 14 champs source avant et après, la profondeur d'appel, l'ordre d'activité et l'identité du graphe au début des méthodes Chart. Les fonctions originales gardent leurs arguments et leur résultat ; seule l'ablation déclarée omet l'appel original. Les hooks mémoire observent les vrais `put/get` de `chart_navigation_state`, sans effectuer de lecture ou d'écriture supplémentaire.

Le lecteur relie chaque `restoreNative` à la racine historique `family_state:public_chart_navigation` de son graphe de départ, puis hydrate tous les fragments de cette racine. Il relie chaque restauration source à son `put`, à son `get` effectivement observé, et au fait source complet commis après le même retour. Les neuf retours doivent avoir neuf restaurations source par la mémoire. Les deux `restore(coldState)` du cas primaire sont des interventions distinctes ; elles ne sont jamais annoncées comme deux restaurations de faits supplémentaires. Une vraie restauration native doit ensuite reconstruire l'état acquis depuis le graphe, sans nouveau retour physique. Le nombre de restaurations natives est consigné depuis les appels réels.

Les champs conservés et comparés sont `epoch`, `chart`, `position`, `positions`, `position_status`, `visited`, `grants`, `gains`, `views`, `blocked`, `evidence`, `portable`, `last` et `method_use`.

## Conservation et lecture intégrales

`events.jsonl.gz` conserve les arguments et résultats des API, les deux snapshots natifs complets, les propositions, décisions, autorisations, paquets publics, observations, opérations de propriétaire et opérations de mémoire. Les graphes complets `{nodes,deltas,chain}` sont encodés sans perte dans des blobs JSON gzip adressés par le SHA-256 des bytes JSON exacts. Seuls les graphes identiques sont partagés ; aucun sous-graphe ni champ du graphe n'est retiré. Le reçu retient les empreintes des bytes compressés et décompressés. Le fichier JSONL brut est retiré seulement après sa compression réussie, dont l'empreinte brute est conservée.

Le lecteur ne crée ni runtime ni propriétaire. Il utilise uniquement le Kernel de validation d'un store vide, le codec d'état et les fonctions de hash. Il vérifie chaque blob, reconstruit tous les nœuds à partir de tous les deltas, valide les chaînes, révisions, origines, fragments et digests d'exécution, puis compare cette reconstruction au graphe complet retenu à chaque point. Les deux snapshots complets doivent être égaux après chaque appel natif ; `proposal`, `srcDecision`, `whyAct` et `trace` ne sont pas projetés ou masqués.

Les acquisitions sont comparées au corpus source déjà retenu : proposition Chart, commande, événement, état source complet, fait de mémoire et checkpoint natif. L'ablation vérifie la disparition de l'acquisition et la modification de l'offre suivante. Les retours étrangers vérifient la conservation ou le retrait de la localisation sans gain, permis ou preuve active inventés.

Les empreintes de tous les outils, de la déclaration gelée, du corpus, des déclarations source et des 334 fichiers natifs sont vérifiées avant et après capture. Le lecteur vérifie aussi que l'en-tête est le contenu exact du fichier de déclaration gelé, que tous les reçus antérieurs sont intacts et que les comptes des sessions, du footer et du reçu concordent. Les échecs restent dans de nouveaux répertoires ; aucune sortie existante n'est écrasée.

## Commandes proposées

Depuis le checkout candidat, sous le superviseur borné root :

```bash
node docs/migration/lot9a-evidence/tools/delivery/chart-common/capture.mjs --declaration docs/migration/lot9a-evidence/delivery-final-068-01/common-declaration.json --output docs/migration/lot9a-evidence/delivery-final-068-01/common-capture-01/capture

node docs/migration/lot9a-evidence/tools/delivery/chart-common/qualify.mjs --capture docs/migration/lot9a-evidence/delivery-final-068-01/common-capture-01/capture --output docs/migration/lot9a-evidence/delivery-final-068-01/common-qualify-01/review
```

`preparation-plan.json` fournit le schéma exact de déclaration, les variables à remplir et les commandes. Le root ajoute les empreintes `path/bytes/sha256` de tous les fichiers de ce répertoire, du manifeste candidat, du corpus, du test common existant et des deux déclarations source. `allowExecution` reste faux dans le modèle de préparation ; seul le fichier d'exécution gelé l'autorise.

## Bornes, cumul et portée

| Opération | Attendue | Maximum déclaré | Limite par lancement | Plafond cumulé |
|---|---:|---:|---:|---:|
| Capture common | 1 | 2 | 300 s, signal d'arrêt à 285 s | 600 s |
| Qualification conservée | 1 | 2 | 240 s | 480 s |

La capture est limitée à 1 Gio de bytes bruts agrégés : JSONL plus blobs de graphes uniques. Le superviseur root gère le groupe de processus, le timeout extérieur et le plafond V8 ; ce dernier ne prétend pas borner tout le RSS. Les horloges du moteur restent réelles. Aucun retry automatique n'est autorisé. Une seconde capture exige un défaut observé, sa correction déclarée et un nouveau répertoire ; les deux tentatives restent dans le cumul.

Le maximum de ce volet est **10 sessions et 18 retours nouveaux**. L'héritage fonctionnel explicite est **10 sessions et 14 retours**, d'où un maximum de **20 sessions et 32 retours** pour cet ensemble précis. Le volet séparé des formes communes prévoit **8 sessions et 62 retours** : une première capture de chaque volet donne **13 sessions et 71 retours nouveaux**, soit **23 sessions et 85 retours avec l'héritage**. Les lectures et qualifications créent zéro session. Le root tient le cumul de tous les volets et de leurs éventuelles tentatives correctives.

Cette preuve concerne le caller natif commun, les formes retenues et les graphes complets. Elle ne qualifie pas la façade worker/service, les tickets publics, un jeu officiel, un niveau gagné, un coût officiel ni la publication. LKEY reste fermé. Aucun verrou global n'est demandé pour ce travail fonctionnel. Les mesures officielles et la publication sont des étapes distinctes.

La dérivation des outils 8B est consignée dans `provenance.json` et ses différences unifiées complètes. L'auteur de ces outils est aussi l'auteur du propriétaire Chart et de ses tests de contrat natif : la comparaison au corpus ne doit pas être décrite comme une revue indépendante de ce propriétaire. La revue statique séparée de `chart_geometry` fournit l'indépendance du lecteur et du protocole.
