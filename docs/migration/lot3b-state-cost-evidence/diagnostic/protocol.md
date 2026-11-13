# Coûts communs d'état : protocole diagnostique préalable 0.41 → 0.42

Déclaré le **2026-11-10T04:13:39.290658+00:00**, avant les quatre exécutions ci-dessous. Ce diagnostic localise le travail de persistance STCK et de restauration SMLP ; il ne décide pas du budget officiel.

## Sources et entrées

La source avant est **Site 69 / native 0.41.0**, commit `c1d5e044dce6291b3eee7320f29663ec5b80ea85`, digest natif **`3edffde9b21f4fc8af9dda9a1dbd40707c015d9f7cba8a41460021e39acb7605`**, 249 fichiers, dans `/workspace/sites/sra-published-041`. Le [manifeste publié](../published/source-manifest.json) est une copie exacte du gel 0.41. Le résultat officiel conservé reste **14/16**, avec persistance STCK **+14,269890051 %** et restauration SMLP **+11,220691835 %** face à 0.38 remesurée.

La source après sera une correction matérielle **0.42.0**, gelée avant ses profils. Son manifeste, son archive et le digest passé en argument `EXPECTED_NATIVE_DIGEST` identifieront les octets effectivement exécutés. Le présent protocole ne sera pas modifié après le premier profil pour y insérer ce digest.

Le [manifeste diagnostique](cases.json) fixe STCK10 et SMLP15, `rounds: 1`, `targetLevels: 3` et `warmupActions: 0`. Les traces publiques sont celles du budget conservé : STCK SHA-256 `4610327ca5c6b67e3a42983cc55b40eab3d5aa858a185d8e81f753ba2bcb7e6b` ; SMLP SHA-256 `325ff611d1f80d0c07ce2c4ee8af707297a918d505db607c35cf411db9753de9`. Chaque commande est recalculée avant son retour public ; aucun état appris, trajet ou solution n'initialise le raisonnement.

## Ordre et instrumentation fixes

| Ordre | Source | Cas | Actions | Chauffe |
| --- | --- | --- | ---: | --- |
| 1 | 0.41 publiée | STCK | 10 | Zéro |
| 2 | 0.41 publiée | SMLP | 15 | Zéro |
| 3 | 0.42 gelée | STCK | 10 | Zéro |
| 4 | 0.42 gelée | SMLP | 15 | Zéro |

Le générateur inchangé `scripts/profile-native-state-costs.mjs` exécute une session froide par cas/source, soit **quatre sessions et 50 actions au total**. Les mêmes fichiers de générateur, protocole, cas, traces et déclarations V5/V6 sont utilisés aux mêmes chemins relatifs des deux checkouts. Le rapport lie leurs empreintes et vérifie le digest natif avant et après chaque session. Les identités des méthodes source de projection et de restauration restent préservées par le profileur normal v2.

Chaque exécution utilise les mêmes options Node `--cpu-prof --cpu-prof-interval=1000`, soit un échantillon CPU toutes les 1 000 microsecondes. Les sorties prévues sont `before-stck.json.gz`, `before-smlp.json.gz`, `after-stck.json.gz`, `after-smlp.json.gz` et les profils `.cpuprofile` correspondants. Rapports, journaux, profils et erreurs sont conservés. La copie depuis le checkout avant garde les octets exacts ; la compression gzip des profils bruts conserve des empreintes du brut et du compressé. Les profils sont séquentiels ; aucun autre test, build, campagne ou mesure ne doit courir simultanément. L'édition et la lecture légère peuvent continuer.

## Comparaison et portée

Le comparateur inchangé `scripts/compare-native-restoration-paths.mjs` compare chaque paire du même cas une seule fois, vers `comparison-stck.json` et `comparison-smlp.json`. Ses six critères restent : générateur, entrées, cas, commandes exactes, quatre états propriétaires retenus et champs de requêtes sélectionnés. Les différences d'effectifs, de travail par méthode, les témoins et leurs résultats booléens restent visibles séparément ; une réduction du travail n'est pas masquée pour fabriquer une égalité. `strictFinalEquality` conserve sa valeur réellement calculée.

Un résultat `scoped_behavior_identical` couvre uniquement ces six critères. Il n'établit ni égalité du graphe ou de tous les états, ni parité complète V6, ni nouveau jeu résolu. Les temps imbriqués ne s'additionnent pas. Une session instrumentée par cas/source ne fournit ni p95, ni intervalle de confiance, ni budget de vitesse accepté. Toutes les variations défavorables restent au bilan. Aucune session du même code ne sera répétée pour sélectionner un meilleur résultat ; tout incident sera qualifié avec ses sorties et toute révision matérielle supplémentaire aura une nouvelle déclaration.

## Fenêtre officielle séparée

Le budget reste une comparaison distincte à **0.38 fraîchement remesurée** : STCK10/SMLP15, deux cohortes, ordre A1/B1/B2/A2, 32 sessions et 400 actions mesurées, huit chauffes de trois actions exclues, seize médianes à **+10 % maximum**, sans tolérance ajoutée pour le bruit ni exclusion de sessions mesurées. Les outils officiels restent inchangés. Tous les diagnostics, tests, builds, campagnes et previews doivent être terminés avant cette fenêtre. Le lot **3B reste ouvert**, et **3C attend**, tant que les obligations fonctionnelles et le budget ne sont pas satisfaits.

Au moment de cette déclaration, aucun rapport avant/après de cette série ni comparaison n'existe dans ce dossier. La déclaration prépare les entrées et ne lance aucune exécution.
