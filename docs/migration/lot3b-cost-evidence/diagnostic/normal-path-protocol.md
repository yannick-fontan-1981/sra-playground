# Correction 3B : diagnostic des restaurations avec projections intactes

Déclaration du **10 novembre 2026 à 01:59:56 UTC**, avant tout profil « après » de cette série. Les deux profils « avant » sont déjà disponibles et conservés ; ce protocole ne présente pas leur sélection comme une déclaration antérieure à leur exécution.

## Objectif et sources

Le premier essai de correction, moteur **0.40.0**, gel `final-v2`, digest natif **`f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece`**, a échoué au budget officiel : **14/16**, avec restauration STCK **+66,160 %** et SMLP **+21,511 %**. Ces échecs et les deux cohortes sont conservés dans [performance/results.md](../performance/results.md).

Le présent diagnostic examine les appels et les succès/refus des témoins de restauration sans remplacer les projections source `state` et `callerContextState` de l'inventaire. Il diffère du [diagnostic historique](protocol.md), dont l'instrumentation de `state` provoque volontairement le repli de l'inventaire. Les séries ont des générateurs et des schémas distincts ; elles ne sont pas regroupées pour produire un ratio de cache.

Le générateur est `scripts/profile-native-restoration-path.mjs`, **17 301 octets**, SHA-256 **`fa0af03af9b2e9ed6e299ee25c9466556ba67db616ccf4bd4a5586f16d72dc6c`**, schéma **`logos-engine.native-restoration-profile.v1`**. Ce même script, inchangé, doit servir aux deux profils après. Il vérifie son empreinte, les entrées et le digest natif avant/après chaque rejeu ; il refuse de remplacer un reçu existant.

| Reçu avant conservé | Travail réalisé | SHA-256 du gzip |
| --- | --- | --- |
| [normal-path-before-stck.json.gz](normal-path-before-stck.json.gz) | Une session froide, 10 actions, 2 niveaux terminés, 2 074 observations de méthodes | `e17ee82cd69142361e9e6a8014431bc531461924260f73c3ed0450cc3eae4f1f` |
| [normal-path-before-smlp.json.gz](normal-path-before-smlp.json.gz) | Une session froide, 15 actions, 3 niveaux terminés, 3 152 observations de méthodes | `ab8608f7a4492a073fe02ff018041bd1453747b7e6a94a4a2aa25c5198566f72` |

Ces deux profils utilisent la source `f0ba`, restée inchangée pendant chaque exécution. La source après sera la correction concrète suivante, gelée dans **`final-v3/`** ; son digest devra être établi et fourni explicitement au générateur avant exécution. Aucun digest ni résultat futur n'est inventé dans cette déclaration.

## Entrées réellement empreintées

Le manifeste est `docs/migration/lot3b-cost-evidence/performance/cases.json`, SHA-256 **`487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d`**. Les traces publiques restent STCK10 et SMLP15, avec les empreintes du manifeste. Le paramètre de cible est trois niveaux ; STCK s'arrête à son plafond de dix actions et n'est pas revendiqué comme ayant terminé trois niveaux.

Le générateur contient encore en dur le chemin **`docs/migration/lot2c-cost-evidence/diagnostic/README.md`**, SHA-256 **`bcceb6942e48c4754995d269f48b142c91ea572962e138de5ae84c9c2aa5d0f2`**, ainsi que les deux déclarations source de l'agent V6, `common_frontier_policy.drm.json` et `morphology_policy/strategy.drm`. Ces trois entrées historiques restent strictement inchangées. L'empreinte du README 2C atteste les octets réellement lus par ce script ; elle ne transforme pas ce README en protocole actuel et ne couvre pas le présent document. Ce document précise la portée de sa réutilisation pour la correction 3B.

Aucun code, règle, spécification, état appris, plan préparé ou oracle de jeu n'est consulté ou fourni au moteur. Le moteur calcule chaque commande ; le harnais compare cette commande au journal public avant de rendre le paquet public correspondant, animations comprises. Aucun checkpoint appris d'une autre session n'est importé.

## Exécutions après prévues

Après établissement et vérification du gel `final-v3`, exécuter **une seule session froide STCK10 puis une seule session froide SMLP15**, sans chauffe. Les valeurs `rounds` et `warmupActions` du manifeste appartiennent au runner officiel et ne créent pas de répétitions dans ce profileur. Aucun second profil favorable du même code, exclusion d'échantillon ou remplacement des reçus avant/après n'est prévu. Les résultats défavorables et les échecs éventuels restent conservés et expliqués.

Les chemins de sortie sont `normal-path-after-stck.json.gz` et `normal-path-after-smlp.json.gz`, dans ce dossier. La variable de commande ci-dessous doit recevoir **le digest exact du nouveau manifeste gelé**, contrôlé avant le lancement. Une valeur absente, un digest différent ou une source modifiée doit faire échouer le lancement ; la valeur `f0ba` ne doit pas être substituée au gel suivant.

```bash
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json STCK docs/migration/lot3b-cost-evidence/diagnostic/normal-path-after-stck.json.gz "$RESTORATION_AFTER_DIGEST"
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json SMLP docs/migration/lot3b-cost-evidence/diagnostic/normal-path-after-smlp.json.gz "$RESTORATION_AFTER_DIGEST"
```

Le profileur observe notamment les engagements et lectures de connaissances, les écritures du caller, les captures et comparaisons des témoins, les restaurations et projections natives des familles. Les méthodes `state` et `callerContextState` de l'inventaire gardent leur identité source. Les observateurs d'autres méthodes ajoutent néanmoins leur coût ; les résultats restent instrumentés et les temps imbriqués ne sont pas additifs.

## Comparaison annoncée avant les résultats après

Le nouveau comparateur générique **`scripts/compare-native-restoration-paths.mjs`** accepte seulement le schéma de ce profileur. L'ancien `scripts/compare-native-profile-behavior.mjs`, son septième contrôle d'effectifs et ses résultats historiques restent inchangés.

Le statut du nouveau comparateur dépend uniquement des **six contrôles exacts** suivants :

1. Même générateur, empreinte et taille comprises.
2. Mêmes entrées empreintées, dans leur totalité.
3. Même définition du cas, actions, cible et nombre de sessions compris.
4. Toutes les commandes enregistrées exactes, avec les champs de ticket et de décision retenus par le générateur.
5. Les **quatre états propres** exacts : `family_state:public_occurrence_recall`, `family_state:morphology`, `caller:counters`, `caller:lifecycle`. Un reçu sans ces quatre propriétaires n'est pas accepté comme entrée valide.
6. Tous les champs de requête annoncés exacts : `operation`, `sequence`, `resultKind`, `actions`, `levelsCompleted`, `cycles`, `nodeCount`, `graphRevision`, `acquiredTransitions`, `family`, `proposalKind`.

Tout échec de l'un de ces six contrôles reste `difference_requires_review`, avec code de sortie 1 et rapport conservé. Six contrôles vrais donnent uniquement `scoped_behavior_identical`. Les autres dimensions ne peuvent pas convertir une différence de comportement en succès.

Les **effectifs des méthodes, résultats des témoins et durées sont analysés séparément**. La correction peut précisément éviter des validations ou captures ; l'identité de leurs effectifs n'est donc pas un septième critère de comportement de cette nouvelle série. Chaque différence reste visible, y compris lorsqu'elle est défavorable :

- Tables complètes avant/après des distributions par étape, famille et lecture de connaissance, avec effectifs, total, médiane, minimum et maximum ; groupes ajoutés ou retirés explicitement conservés.
- Liste de toutes les différences d'effectifs agrégés et des méthodes regroupées par famille et opération, avec les totaux de temps correspondants.
- Tous les résultats de témoins, appels, succès et refus, et leurs différences.
- Durée globale du rejeu et durée de chaque requête dans son ordre d'origine. Les ratios, lorsqu'ils sont définis, sont descriptifs et n'ont aucun seuil d'acceptation.

Les observations individuelles complètes restent dans les deux reçus compressés, dont le comparateur conserve les empreintes. Les variations de provenance source, d'environnement et les fichiers natifs modifiés sont affichés séparément. Le booléen **`strictFinalEquality`** compare les objets finaux complets et conserve sa vraie valeur ; une valeur fausse n'est ni effacée ni transformée en identité. L'égalité limitée ne revendique jamais l'identité du snapshot ou du graphe privé entier.

```bash
node scripts/compare-native-restoration-paths.mjs docs/migration/lot3b-cost-evidence/diagnostic/normal-path-before-stck.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-after-stck.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-comparison-stck.json
node scripts/compare-native-restoration-paths.mjs docs/migration/lot3b-cost-evidence/diagnostic/normal-path-before-smlp.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-after-smlp.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-comparison-smlp.json
```

## Limites et séparation du coût officiel

Chaque cas fournit un profil froid par source. Cela ne fournit ni p95, intervalle de confiance, preuve causale complète, stabilité mémoire de longue durée, ni latence indépendante du matériel. Les appels directs à `V6AgentService` excluent l'acceptation et les copies de `BrowserV6Agent`, le transport et l'ordonnancement worker, Pause, le rendu navigateur et l'exécution du jeu. Leurs durées ne remplacent pas celles du runner officiel.

Les régressions fonctionnelles CATR/RSWP et leurs 34 contrôles restent distinctes. **Aucun succès de ce diagnostic n'accepte le budget +10 % ou ne clôture 3B.** Le nouvel essai officiel devra disposer de son propre protocole préalable, après établissement du digest corrigé. Aucun profil, test, build ou navigateur ne doit chevaucher sa fenêtre. L'essai officiel `f0ba` échoué reste intégralement conservé.

## Amendement avant tout profil après : série normale v2 distincte

Ajouté le **10 novembre 2026 à 02:03:19 UTC**. Les octets de la déclaration ci-dessus et les deux profils avant exploratoires restent conservés. Aucun des deux profils après annoncés ci-dessus n'a été exécuté.

La nouvelle correction vérifie aussi l'identité de la méthode source `restore`. Le générateur initial enveloppe cette méthode, ce qui provoquerait un repli sur la nouvelle source et ne permettrait pas la comparaison du chemin prévu. La production conserve son garde ; l'ancien générateur est archivé avec son empreinte `fa0af03a…`, et ses deux reçus avant ne sont pas renommés ou présentés comme issus d'une instrumentation différente.

Le [protocole normal v2 distinct](normal-path-v2-protocol.md) remplace l'intention d'exécuter seulement deux profils après : il déclare **quatre nouvelles sessions**, une par cas et par source, avec un seul nouveau générateur identique dans les deux checkouts. Les anciennes sessions restent exploratoires et ne participent pas à cette paire avant/après. Ce changement est déclaré avant les quatre nouvelles exécutions ; aucun résultat après n'est connu.
