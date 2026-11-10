# Correction 3B : protocole préalable du diagnostic normal v2

Déclaré le **10 novembre 2026 à 02:03:19 UTC**, avant les quatre exécutions de cette série.

## Pourquoi une série distincte

Les deux profils exploratoires `normal-path-before-stck.json.gz` et `normal-path-before-smlp.json.gz` utilisent le générateur `fa0af03af9b2e9ed6e299ee25c9466556ba67db616ccf4bd4a5586f16d72dc6c`. Ils conservent les projections `state` et `callerContextState`, mais enveloppent `family.restore`. La correction suivante contrôle aussi l'identité de cette méthode source : cet observateur provoquerait son repli. La production garde ce refus de personnalisation ; elle n'est pas adaptée pour admettre un profileur.

L'ancien générateur et les deux profils sont conservés, sans changement d'étiquette, avec leur [déclaration et amendement](normal-path-protocol.md). Aucun après de cette série exploratoire n'a été exécuté. La présente série utilise **le même nouveau générateur pour chacune des deux sources**, avec quatre sessions fixées avant leur résultat. Aucun profil exploratoire n'est réutilisé comme une référence v2.

## Générateur, entrées et sources gelées

Le générateur commun est **`scripts/profile-native-restoration-path.mjs`**, **18 270 octets**, SHA-256 **`9e5e03e2d66cae16060a48aaec392a5874e464738c678cb6daab089580bba570`**. Son schéma reste `logos-engine.native-restoration-profile.v1`. Une famille qui implémente `restoreNative` conserve désormais sa méthode source `restore` intacte ; seuls ses points d'entrée `nativeState` et `restoreNative` sont observés. Les identités source `state`, `callerContextState` et `restore` de l'inventaire, ainsi que les méthodes de restauration laissées intactes, sont vérifiées après le rejeu.

Le manifeste commun est **`docs/migration/lot3b-cost-evidence/performance/cases.json`**, SHA-256 **`487e4cf2be5415855af688c6b03be90ffc8b57c29ae0abfe7bef4b340af15a6d`**. Ses traces publiques et les deux déclarations source V6 restent inchangées. Le générateur v2 empreinte **le présent `normal-path-v2-protocol.md`** comme entrée. Le README 2C codé dans le générateur v1 appartient seulement aux anciens reçus ; il n'est pas présenté comme l'entrée de protocole du générateur corrigé. Les mêmes octets de toutes les entrées sont copiés aux mêmes chemins relatifs dans les deux checkouts.

| Source | Checkout | Gel natif mesuré |
| --- | --- | --- |
| Avant, premier essai officiel 0.40 | `/workspace/scratch/c4dd29871d33/lot3b-f0ba-diagnostic` | Archive exacte `final-v2`, 249 fichiers, digest `f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece` |
| Après, nouvelle correction 0.40 | `/workspace/scratch/c4dd29871d33/sra-playground-lot2a/.sites-checkout` | `final-v3`, 249 fichiers, digest `391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9` |

Le checkout isolé part du commit fonctionnel `81b937373b80e8c92c36856da0ec46b37db38956`, puis reçoit les octets de l'archive `final-v2`. Le digest natif complet doit égaler le manifeste de cette archive ; le commit de base ne suffit pas à identifier la source. Le générateur et les entrées sont copiés explicitement et vérifiés par empreintes. La source main est contrôlée contre [le manifeste final-v3](../final-v3/source-manifest.json). Les deux inventaires restent inchangés pendant les exécutions.

Le moteur calcule chaque commande avant réception du retour public archivé correspondant. Aucun code, règle, spécification, solution, oracle, checkpoint appris ou plan préparé de jeu n'est lu ou fourni au moteur. Le comparateur observe des replays publics effectivement exécutés ; les traces ne sont pas des programmes de décision.

## Quatre sessions fixes, aucune chauffe

Les exécutions sont séquentielles, dans cet ordre :

| Ordre | Source | Cas | Plafond | Sortie dans `docs/migration/lot3b-cost-evidence/diagnostic/` |
| --- | --- | --- | ---: | --- |
| 1 | Avant `f0ba` isolé | STCK | 10 actions | `normal-path-v2-before-stck.json.gz` |
| 2 | Avant `f0ba` isolé | SMLP | 15 actions | `normal-path-v2-before-smlp.json.gz` |
| 3 | Après `391a279` main | STCK | 10 actions | `normal-path-v2-after-stck.json.gz` |
| 4 | Après `391a279` main | SMLP | 15 actions | `normal-path-v2-after-smlp.json.gz` |

Chaque lancement crée un runtime et une mémoire de connaissances froids. Il n'exécute **aucune chauffe et une seule session** ; les paramètres `rounds` et `warmupActions` du manifeste ne sont utilisés que par le runner officiel. Les quatre sessions représentent 50 actions au total si elles terminent leurs plafonds. La cible de trois niveaux ne transforme pas STCK10 en trois niveaux terminés : sa trajectoire publique en termine deux. SMLP15 en termine trois.

Aucune session ni observation défavorable ne sera retirée. Aucun profil supplémentaire du même code et du même cas ne sera sélectionné d'après le résultat. Les échecs, journaux, sorties disponibles et différences resteront conservés et explicités. Une interruption ou un résultat incomplet ne devient pas une session complète.

Depuis le checkout isolé, exécuter :

```bash
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json STCK docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-before-stck.json.gz f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json SMLP docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-before-smlp.json.gz f0ba85e80fbe7543f2e2360c6b6e846ae76839cb6ede0e9c022d31b56f46cece
```

Depuis le checkout main, exécuter :

```bash
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json STCK docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-after-stck.json.gz 391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9
node scripts/profile-native-restoration-path.mjs docs/migration/lot3b-cost-evidence/performance/cases.json SMLP docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-after-smlp.json.gz 391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9
```

Les deux reçus avant et leurs journaux sont copiés **brut pour brut** du checkout isolé vers le même dossier relatif main, avec empreintes source/destination égales. Aucun champ `checkout`, horodatage, environnement, source ou résultat n'est normalisé pour la comparaison. Les sorties sont exclusives et ne remplacent aucun fichier existant.

## Six critères exacts et travail analysé séparément

Le comparateur commun est **`scripts/compare-native-restoration-paths.mjs`**, **11 263 octets**, SHA-256 **`bfa506ef075bc900ee1730f18185e49e8bfb8d248b5de81bb6e7091c6b65f5a6`**. Ses six contrôles exacts sont les suivants :

1. Même générateur, taille et empreinte comprises.
2. Toutes les entrées empreintées identiques.
3. Même cas, actions, cible et nombre de sessions compris.
4. Toutes les commandes enregistrées exactes, avec les champs de ticket et décision retenus.
5. Les quatre états propres exacts : `family_state:public_occurrence_recall`, `family_state:morphology`, `caller:counters`, `caller:lifecycle`. Leur présence complète est obligatoire.
6. Tous les champs de requête annoncés exacts : `operation`, `sequence`, `resultKind`, `actions`, `levelsCompleted`, `cycles`, `nodeCount`, `graphRevision`, `acquiredTransitions`, `family`, `proposalKind`.

Six contrôles vrais donnent seulement `scoped_behavior_identical`. Un contrôle faux donne `difference_requires_review`, code de sortie 1, avec rapport conservé. L'ancien comparateur et son critère d'effectifs exacts restent inchangés pour les anciennes séries.

La correction peut éviter explicitement des captures et validations : **les effectifs et durées ne déterminent pas ce statut de comportement**. Ils sont tous conservés et examinés séparément. Le rapport contient les distributions complètes par étape, famille et lecture de connaissance, les groupes ajoutés/retirés, toutes les différences d'effectifs agrégés et par méthode/famille/opération, les résultats des témoins avec appels/succès/refus, la durée globale et la durée de chaque requête. Les observations individuelles, parents d'appels et métadonnées complets restent dans les reçus bruts empreintés. Aucune différence n'est masquée pour satisfaire l'identité.

`strictFinalEquality` compare aussi l'objet final complet et conserve le booléen obtenu. Sa valeur n'est pas transformée en égalité ; ce contrôle limité ne revendique jamais une identité du snapshot ou du graphe privé entier. Les variations de source et d'environnement restent visibles séparément.

Depuis main, après copie des reçus avant et fin des quatre sessions :

```bash
node scripts/compare-native-restoration-paths.mjs docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-before-stck.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-after-stck.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-comparison-stck.json
node scripts/compare-native-restoration-paths.mjs docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-before-smlp.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-after-smlp.json.gz docs/migration/lot3b-cost-evidence/diagnostic/normal-path-v2-comparison-smlp.json
```

## Portée et séparation du budget

Les projections et restaurations source restent intactes ; d'autres méthodes et prototypes sont néanmoins instrumentés. Les observateurs ajoutent leur coût et les phases imbriquées ne s'additionnent pas comme du temps exclusif. Les appels directs à `V6AgentService` excluent l'acceptation et les copies de `BrowserV6Agent`, le transport et l'ordonnancement worker, Pause, le rendu navigateur et l'exécution du jeu.

Une seule session par cas et source ne fournit ni p95, intervalle de confiance, preuve causale complète, stabilité mémoire de longue durée, ni ratio de latence indépendant du matériel. Les ratios descriptifs de ce diagnostic ne remplacent aucune métrique du budget officiel.

Les quatre sessions n'appartiennent à aucune cohorte officielle. Les tests, régressions CATR/RSWP et confirmations live/navigateur restent des preuves distinctes. Tous ces travaux doivent être terminés avant la nouvelle fenêtre officielle, avec preview arrêté. **Un succès du diagnostic n'accepte pas le seuil +10 %, ne retire pas l'échec `f0ba` 14/16 et ne clôture pas 3B.**

## Amendement préalable : alignement explicite sur le schéma v2

Ajouté le **10 novembre 2026 à 02:05:15 UTC**, avant toute exécution des quatre profils. Les octets de la déclaration initiale ci-dessus sont conservés, SHA-256 `a307e662eb995998f53d111a26e10151d6e3e8b7d4c31b87b6f3db6acbc9a2bb`. Une vérification préalable a relevé une mention erronée du schéma : le générateur `9e5e03e2…`, inchangé, émet bien **`logos-engine.native-restoration-profile.v2`**, avec `sourceProjectionsUnwrapped: true` et le nombre de méthodes source de restauration laissées intactes dans `nativeSourceRestorersUnwrapped`.

Le comparateur accepte désormais **uniquement ce schéma v2**, sans modifier les six critères ni les diagnostics séparés. Son empreinte applicable remplace celle de la déclaration initiale : **`da2468b0ff39dd30a67b46357aaf4c25ea3c94b21d569604e8b95542d2b36f0b`**, 11 263 octets. Deux vérifications légères sur fixtures ont confirmé l'acceptation du schéma v2 et le refus du schéma v1 ; aucun profil ni moteur de jeu n'a été exécuté par ces contrôles. Les onze vérifications précédentes restent attachées à leur ancien hash de comparateur.

Ordre, sources, générateur, quatre sessions, plafonds, absence de chauffe, chemins de sortie, conservation intégrale et séparation du budget restent inchangés. Les deux checkouts doivent empreinter le présent protocole **avec cet amendement**, copié exactement avant lancement.
