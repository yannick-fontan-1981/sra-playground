# Coûts d'état SMLP : protocole diagnostique préalable 0.40 → 0.41

Déclaré le **2026-11-10T03:12:37.729413+00:00**, avant toute exécution de cette série. Il s'agit d'un diagnostic de travail et d'attribution, distinct de la prochaine fenêtre officielle de coût.

## Question et sources

Localiser le travail commun d'acquisition, de persistance et de restauration restant coûteux sur **SMLP**, puis observer les effets d'une correction matérielle du moteur natif. Le [résultat officiel publié 0.40](../../lot3b-cost-evidence/performance-v2/results.md) reste **`budget_review_required`, 14/16** : acquisition et persistance SMLP **+11,641662058 %**, restauration **+14,988511609 %** contre 0.38 remesurée. Ce diagnostic ne remplace pas cette fenêtre et ne peut pas clôturer le budget.

La source avant est la publication **68**, commit **`512ac2cd7270b669aca0a12dbc9c4702174f1c0f`**, moteur **0.40.0**, **249 fichiers natifs**, digest **`391a2797414c0090fa632a2fc13736c7806c1f5fceceafa34e1583dd4ef9e3a9`**. Le [manifeste publié](../published/source-manifest.json) est une copie exacte de `lot3b-cost-evidence/final-v3/source-manifest.json`, SHA-256 du fichier `01342c154132a0b5f86c59c4be6e41d48800793ba04916c05b9ff94672c61531`. Le checkout isolé avant est `/workspace/scratch/c4dd29871d33/lot3b-published-040`.

La source après sera la correction **0.41.0**, gelée avant son exécution. Son manifeste et son digest devront être conservés dans le dossier de preuve de ce nouveau gel. Le digest réel sera passé au générateur comme argument `EXPECTED_NATIVE_DIGEST`, vérifié contre les octets du checkout et enregistré dans le rapport. Le présent protocole reste inchangé entre les deux exécutions : il ne sera pas réécrit ensuite pour y insérer ce digest. Aucune validation de la correction future n'est anticipée.

## Une seule session par source, ordre fixé

| Ordre | Source | Cas | Travail annoncé | Chauffe |
| --- | --- | --- | --- | --- |
| 1 | 0.40 publiée, checkout isolé | SMLP | **15 actions**, une session à mémoire froide | **Zéro** |
| 2 | 0.41 corrigée et gelée | SMLP | **15 actions**, une session à mémoire froide | **Zéro** |

Le [manifeste diagnostique](cases.json) fixe `rounds: 1`, SMLP15 et `warmupActions: 0`. Le générateur normal exécute le cas sélectionné une seule fois ; il ne lance pas le runner officiel à plusieurs répétitions. Le nombre de niveaux réellement terminés et les frontières naturelles sont conservés tels qu'observés. Le `targetLevels: 3` est le paramètre déjà associé à la trace publique ; il ne constitue pas un résultat acquis par la correction.

Les deux exécutions utilisent la même trace publique retenue : `docs/migration/native-campaigns-v57/final/smlp-public-trace.json.gz`, SHA-256 **`325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`**. Le moteur recalcule chaque commande avant que l'hôte de rejeu ne fournisse le retour enregistré. Aucun état appris, trajet, commande attendue ou solution n'initialise le raisonnement.

Tous les rapports, journaux, erreurs et profils bruts seront conservés. Aucune nouvelle session du même code ne sera choisie d'après le résultat pour remplacer une session défavorable. Un incident technique sera qualifié avec son état d'avancement et ses sorties ; un rapport incomplet ne devient pas une exécution réussie. Une révision matérielle supplémentaire du code demandera un nouveau périmètre déclaré.

## Générateur et instrumentation

Le générateur est **`scripts/profile-native-state-costs.mjs`**, **18208 octets**, SHA-256 **`d4ebd302163ea4d96c6d7699d29a036547f0e82fec35c93c7c3a0c4ee077de55`**. Il est copié depuis `scripts/profile-native-restoration-path.mjs` avec pour seule adaptation fonctionnelle le passage du chemin de protocole comme cinquième argument. Le schéma de rapport reste **`logos-engine.native-restoration-profile.v2`**, avec les mêmes observations et contrôles. La copie historique reste inchangée.

Le générateur et le manifeste de cas, le présent protocole, la trace publique et les déclarations d'agents V5/V6 doivent être identiques dans les deux checkouts. Le générateur enregistre leurs empreintes et vérifie le digest natif avant et après chaque session. Les fichiers de moteur de jeu, spécifications et oracles ne sont pas des entrées de ce diagnostic.

Les méthodes source de projection et de restauration conservent leur identité. En particulier, `ObservedInventory.state`, `callerContextState` et `restore` ne sont pas enveloppées. Les restaurateurs source des huit familles natives restent intacts. Cette condition évite que le diagnostic désactive les chemins de réutilisation facultative qu'il observe. Les mesures de famille et de runtime restantes peuvent s'imbriquer ; leurs durées ne s'additionnent pas.

Chaque exécution reçoit aussi un **profil CPU Node**, avec intervalle d'échantillonnage fixé à **1 000 microsecondes**. Le profil brut `.cpuprofile` est conservé puis compressé sans perte en gzip avec les empreintes du brut et de sa représentation compressée. Cet échantillonnage ajoute son propre coût et donne une attribution observée, sans en faire une preuve de latence de production. Les deux sessions utilisent les mêmes options de profilage.

Les noms prévus sont `before-smlp.json.gz`, `after-smlp.json.gz`, `before-smlp.cpuprofile` et `after-smlp.cpuprofile`, sous le présent dossier diagnostique. Les journaux complets sont conservés, directement ou compressés sans perte. La copie des résultats depuis le checkout avant conserve exactement leurs octets ; un reçu en garde les empreintes.

## Comparaison de comportement et conservation du travail

Le comparateur **`scripts/compare-native-restoration-paths.mjs`** reste inchangé. Il applique ses **six critères exacts** :

1. Même générateur.
2. Mêmes entrées déclarées.
3. Même cas.
4. Commandes exactes.
5. États exacts des quatre propriétaires retenus.
6. Champs de requête déclarés exacts.

Les effectifs par méthode et opération, captures et vérifications de témoins, résultats booléens, durées et variations restent conservés séparément dans les diagnostics de travail. Une optimisation peut précisément supprimer du travail ; les différences ne sont donc pas effacées pour produire une égalité artificielle. Le champ **`strictFinalEquality` garde sa valeur réellement calculée**, favorable ou défavorable. Les résultats exacts des témoins restent également visibles.

Un éventuel statut `scoped_behavior_identical` signifie uniquement la réussite des six critères annoncés. Il ne prouve pas l'identité du graphe ou du snapshot entier, la parité du caller V6 complet, la réussite d'un nouveau jeu ni l'acceptation du budget.

## Séparation avec la fenêtre officielle

Aucun seuil de coût n'est testé par cette paire diagnostique. Une seule session par source ne permet ni p95, ni intervalle de confiance, ni comparaison officielle de vitesse. Les valeurs de restauration, acquisition, persistance ou CPU défavorables restent au bilan sans compensation par une autre métrique.

La future fenêtre officielle sera préparée après gel et validations fonctionnelles, avec une **référence 0.38 fraîchement mesurée**, les mêmes STCK10 et SMLP15, **A1/B1/B2/A2**, **32 sessions mesurées et 400 actions**, les chauffes annoncées séparément et **+10 % sur chacune des seize médianes**. Les runners, comparateurs et revue indépendants restent inchangés. Le présent profilage, tous les tests, builds, campagnes et previews devront être terminés avant cette fenêtre.

Les essais historiques de 0.39 et 0.40 restent conservés. Le lot **3B reste ouvert** tant que la correction n'a pas satisfait ses obligations fonctionnelles et le budget complet ; **3C attend cette clôture**.

## État de la déclaration

Au moment de cette déclaration, aucun profil avant/après ni résultat de comparaison n'existe dans ce nouveau dossier. Les sources 0.40 et leurs rapports de référence sont disponibles ; la correction 0.41 et ses résultats restent à produire. La déclaration ne lance aucune session. Le responsable de livraison coordonne les exécutions et leur copie, puis la comparaison après réception des deux rapports complets.
