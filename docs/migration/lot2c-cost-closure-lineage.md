# Lot 2C : filiation des corrections de coût

## Objet et source de référence

La version native **`logos-engine.typescript.v6.native-migration/0.36.0`** réduit des travaux de copie, de décodage et de sérialisation dans le chemin commun de Logos Engine. Elle part de la publication **63**, commit `1193377f1d574451740a7409a4102833ef868310`, moteur `0.35.0`. Ce changement est une optimisation structurelle native : il ne raccorde pas une nouvelle famille de raisonnement, ne modifie pas la politique V5/V6 et n'ajoute pas de solution de jeu.

L'inventaire gelé comprend **242 fichiers natifs**, avec le digest **`ac7225dd2e5f51551881f0c1d5eba284c64c2f019b08f00e572900319e89255b`**. Le [manifeste](lot2c-cost-evidence/final/source-manifest.json), l'[archive de source](lot2c-cost-evidence/final/source-archive.json) et ses [parties](lot2c-cost-evidence/final/source-archive-parts.json) identifient les octets concernés.

Les références originales restent celles du commit V6 `786dcf51ca57773d8e3a8948ce9ea3655e7baf8e`, avec leurs dépendances V5 effectivement consommées. La [filiation fonctionnelle de 2C](lot2c-method-continuation-lineage.md) décrit l'acquisition des méthodes, les entrées, les gardes et les capacités gérées. Le présent document décrit uniquement les frontières de représentation et de stockage optimisées autour de ces capacités.

## Producteurs, propriétaires et consommateurs

| Correction | Producteur et propriétaire | Consommateur | Invariant conservé |
| --- | --- | --- | --- |
| Valeur persistée et hydratation | État de famille ou de composant, encodé par `NativeKnowledgeStore` dans le Kernel V7 | `stateValue`, puis restauration du propriétaire existant | Encodage typé identique, métadonnées acquises, révisions et chaîne conservées ; toutes les dépendances de fragments contrôlées |
| Identité d'autorisation courante | Chaîne du store et digest d'exécution du runtime | Validation du ticket dans `V6AgentService.advance` | Deux identités lues chez leurs propriétaires actuels avant acquisition ; aucun ticket ou snapshot ancien utilisé comme autorité |
| Trace du snapshot interne | `note` copie et fige chaque entrée de trace du runtime | Snapshot interne, puis protocole de service | Nouvelle liste à chaque snapshot ; seules les entrées déjà possédées et immuables sont partagées ; copie publique conservée |
| Signature des composants mesurés | Extraction géométrique sur le raster public validé | Identité et ambiguïté des entités de l'observateur | Même description numérique, mêmes octets canoniques, même SHA-256 et mêmes refus de scalaire |

## Valeur persistée et hydratation

Le [store natif](../../src/logos-engine/v6-knowledge-store.ts) distinguait déjà l'état versionné du Kernel et ses valeurs hydratées. Cependant, une nouvelle référence de preuve créait légitimement une nouvelle révision de nœud, puis invalidait l'hydratation même si la valeur métier n'avait pas changé. La fermeture d'un préfixe peut ainsi réviser les métadonnées d'une famille passive sans modifier ses connaissances.

Après encodage, la correction compare la valeur proposée à la valeur précédente par **égalité canonique complète**. Une égalité permet de conserver l'identité de la valeur immuable précédente. Elle ne supprime ni le nœud révisé, ni la preuve, ni la relation, ni le statut, ni le delta. Les bits Float64, dont le zéro négatif, sont comparés dans leur représentation typée ; aucune tolérance numérique ou égalité partielle n'est introduite.

Le cache d'hydratation réutilise ensuite cette valeur uniquement si le type et la portée de la racine concordent et si **tous les fragments effectivement lus** sont toujours les mêmes nœuds dans le graphe courant. Un fragment remplacé ou absent oblige à repasser par la lecture ordinaire et ses contrôles de type, profil et empreinte. La comparaison de la seule racine ne suffit pas. La transaction conserve sa publication atomique : les valeurs calculées pour une transaction refusée ne remplacent pas le graphe acquis.

La boucle de restauration des familles demeure exécutée. Les remises à zéro de décisions éphémères, les contrôles de projection acquise et les copies de travail propres à chaque famille conservent leur place. Aucun second propriétaire de connaissances, raccourci global de restauration ou traitement groupé du Kernel n'est ajouté.

Les [tests de persistance](../../tests/v6-native-persistence.test.ts) conservent deux chaînes capturées sur V63 avant cette correction pour une séquence comprenant une mise à jour de métadonnées :

- `8f132ff7d6a1c13c0659153c3f95fcb9c4feade76164da9e7485f77802ab13ec` ;
- `4bb15e06ec0058cd6564941d22029b507784ff7b9c7ce33fd4e6bff90d0ec78a`.

Cette séquence garde trois deltas, deux nœuds et la seconde révision de sa racine. Les cas contraires couvrent une charge utile modifiée, des nombres fractionnaires et le zéro négatif, la mutation d'une copie de travail, le rollback et la corruption du second fragment après une révision de métadonnées. Les tests existants de [store](../../tests/v6-knowledge-store.test.ts), de [graphe d'état](../../tests/v6-native-state-graph.test.ts), de [canonicalisation](../../tests/canonical-cache.test.ts) et de [Kernel](../../tests/v7-kernel.test.ts) restent dans le périmètre de contrôle.

## Identité d'autorisation et trace interne

Avant chaque acquisition d'une réponse, le service comparait les identités du ticket à un snapshot complet du runtime. Il n'utilisait que deux champs de ce snapshot : `graphChain` et `nativeExecutionDigest`. La nouvelle méthode optionnelle `authorizationIdentity` du [contrat de backend](../../src/logos-engine/v6-native-types.ts) permet au [runtime](../../src/logos-engine/v6-native-runtime.ts) de lire directement ces deux propriétaires actuels, sans reconstruire les diagnostics.

Le [service](../../src/runtime/v6-agent-service.ts) vérifie le format des deux digests puis effectue les mêmes comparaisons avec le ticket. Les backends ne proposant pas cette méthode conservent le chemin antérieur par `snapshot`. Un changement de chaîne ou de programme est refusé avant acquisition ; une identité spécialisée malformée ferme la session. Le snapshot produit après l'action continue à subir sa validation complète. La méthode spécialisée n'autorise aucune action à elle seule et ne conserve pas une identité pour les appels suivants.

Le snapshot interne emploie également une nouvelle liste de trace contenant les entrées déjà copiées et profondément figées par `note`, au lieu de recopier une nouvelle fois leur contenu. Une nouvelle entrée ou une réduction de la liste courante ne modifie pas un snapshot antérieur. La frontière publique du service conserve sa copie indépendante et son gel profond.

Les [tests d'identité et de snapshot](../../tests/v6-native-snapshot-identity.test.ts) couvrent les deux chemins de backend, la divergence de chacune des deux identités, le ticket conservé après un refus de portée, l'impossibilité de le consommer deux fois, les identités malformées et les snapshots de sortie invalides. Un runtime réel vérifie l'identité avant et après acquisition puis édition du graphe, ainsi que l'immuabilité des snapshots précédents et l'indépendance de la copie du service.

## Signatures géométriques fermées

L'[observateur natif](../../src/logos-engine/v6-native-observer.ts) transfère les descriptions géométriques V6 et les mesures de composants V5. Son extraction construit déjà l'aire, l'échelle et les coordonnées normalisées à partir d'un raster public validé. Le nouveau helper **privé** `measuredComponentSignature` sérialise les quatre champs qu'il vient de produire dans l'ordre canonique exact : `area`, `normalized_mask`, `palette_value`, `scale`. Il calcule ensuite le même SHA-256.

Cette frontière fermée évite le parcours générique des descripteurs de chaque paire de coordonnées fraîchement construite. Elle ne devient pas une API acceptant des descriptions arbitraires. `v6Canonical`, `v6Digest`, `validateRows`, l'extraction des composants et le format des observations gardent leurs contrats. Le contrôle `assertPortableNumber` de la palette est conservé : la validation du raster admet le zéro négatif JavaScript, alors que la signature canonique historique le refuse. Il rejette aussi une substitution de scalaire non portable par un getter après la première validation.

Le [diagnostic déclaré](lot2c-cost-evidence/diagnostic/observer-protocol.md) et ses [résultats](lot2c-cost-evidence/diagnostic/observer-results.md) comparent les octets, les signatures et les observations complètes avant la modification de production. Ils portent sur quatre paquets publics STCK et quatre cas de référence source. Les [tests de l'observateur](../../tests/v6-native-observer.test.ts) ajoutent les palettes extrêmes, les composants nombreux, les blocs répétés à plusieurs échelles, les masques irréguliers et le raster unidimensionnel maximal de 65 536 pixels, ainsi que les refus pertinents.

## Validation et limites d'attribution

Le [delta formel](lot2c-cost-evidence/final/validation/delta-tests-run.json) passe **947 tests sur 947 dans 26 fichiers**, avec zéro échec, annulation ou test ignoré. Les sources natives et les entrées de source/test sont restées identiques pendant cette exécution. Le [périmètre de validation](lot2c-cost-evidence/final/release-scope.json) nomme les fichiers effectivement exécutés. Ce résultat valide les contrats retenus ; il n'est pas une nouvelle capacité de jeu ni une mesure de performance.

Le [profil du chemin commun](lot2c-cost-evidence/diagnostic/README.md), le [diagnostic de l'observateur](lot2c-cost-evidence/diagnostic/observer-results.md) et le [protocole officiel de coût](lot2c-cost-evidence/performance/README.md) ont des portées distinctes. Une suppression de travail redondant préexistant peut améliorer le service sans établir la cause exclusive des variations historiques entre V62 et V63. Les mesures imbriquées ne s'additionnent pas. Le budget reste de **+10 % sur chacune des seize médianes STCK/SMLP**, avec les résultats antérieurs conservés.

Le [contrôle sémantique distinct](lot2c-cost-evidence/diagnostic/semantic-control-protocol.md) est maintenant terminé. Sa [qualification séparée](lot2c-cost-evidence/diagnostic/semantic-qualification.json), détaillée dans les [résultats](lot2c-cost-evidence/diagnostic/results.md), porte uniquement sur le replay public **STCK de dix actions**. Les dix commandes, les quatre états de propriétaires, les 344 identités de nœuds, leurs types et leurs révisions concordent. Les **3 834 différences de feuilles** observées sont toutes qualifiées, avec **zéro différence métier non qualifiée**. Les 24 traces décodées diffèrent exclusivement sur `created` ; leurs corps métier sont identiques et les bits Float64 de leurs horloges sont vérifiés exactement.

La qualification reconstruit le `sourceDigest` depuis chaque manifeste et vérifie que seule la version d'implémentation y change. Pour **chacun des deux graphes, les 842 digests de delta, leurs liens précédents et leurs révisions sont vérifiés**, puis les nœuds finaux et l'identité d'exécution sont reconstruits. Les différences de chaîne, provenance et horloge restent conservées avec leurs chemins et valeurs. La comparaison stricte et son statut **`strict_identity_failed`** sont conservés ; la qualification sémantique ne les réécrit pas comme une identité binaire. Le premier profil, qui ne conservait pas les corps complets des traces, garde également son échec strict et sa limite de collecte.

**Ce document ne conclut pas à la clôture du budget.** Cette conclusion appartient à la comparaison officielle terminée, sur les références, effectifs et métriques annoncés. L'équivalence sémantique qualifiée de STCK10 ne revendique ni la parité binaire des graphes, ni une validation générale sur tous les jeux, ni la migration complète V5/V6.
