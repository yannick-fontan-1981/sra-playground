# Lot 6B — plan d’exécution du coût après publication effective 0.63

Statut : plan de commandes uniquement. Aucune commande ci-dessous n’a été exécutée pour rédiger ce document. Les onze helpers actifs sont ceux directement sous `docs/migration/lot6b-evidence/` ; les copies conservées sous `cost-review/attempt-01/` sont des archives de revue.

## 1. Identités à compléter avant toute déclaration finale

Le candidat actuellement gelé est `provisional-063-01/frozen-candidate`, annoncé avec 322 fichiers natifs et un digest commençant par `fa23bb76`. Cette indication abrégée ne remplace pas le manifeste complet. La baseline distincte `/workspace/sites/sra-lot6b-baseline-063-20261111/.sites-checkout` est encore au commit **provisoire** `805b30297dc1b715dbfd9f1197a9a8ba7b361b90` ; le repère abrégé `a33` demeure également provisoire. Le numéro du Site et le commit de la publication effective 0.63 sont inconnus à ce stade.

Avant de lancer `prepare-cost-protocol.py`, relever la véritable publication 0.63, conserver sa preuve de Site/commit, aligner la baseline sur ce commit et réconcilier le candidat avec son contenu. Le helper ne consulte pas l’hébergement : un numéro positif passé en argument ne prouve pas une publication. Si cette réconciliation change les sources natives du candidat, créer un nouveau gel et remplacer le chemin candidat ci-dessous ; conserver le gel provisoire. Créer seulement après cette réconciliation le manifeste baseline prévu ici : `provisional-063-01/baseline-actual-063/source-manifest.json`.

Entrées obligatoires : manifeste natif baseline `{fileCount, digest, files}`, manifeste natif candidat, `source-archive.json` et archive correspondante du candidat, sept outils centraux historiques inchangés, cas et politique historiques 3H intacts, dépendances équivalentes des deux checkouts, preuves fonctionnelles réellement terminées sur le candidat final. Aucun effectif historique de propriétaires ne doit être substitué à l’inventaire réel.

Toutes les commandes suivantes partent du checkout candidat :

```bash
cd /workspace/sites/sra-lot6b-20261111/.sites-checkout
SRA6B_TOOLS=docs/migration/lot6b-evidence
SRA6B_PERF=docs/migration/lot6b-evidence/performance-integrated-01
SRA6B_CANDIDATE=docs/migration/lot6b-evidence/provisional-063-01/frozen-candidate
SRA6B_BASELINE=/workspace/sites/sra-lot6b-baseline-063-20261111/.sites-checkout
SRA6B_BASELINE_MANIFEST=docs/migration/lot6b-evidence/provisional-063-01/baseline-actual-063/source-manifest.json
# Renseigner SRA6B_ACTUAL_SITE et SRA6B_ACTUAL_COMMIT depuis la publication vérifiée.
# Aucun numéro ni commit futur n’est prérempli.
test "$(git -C "$SRA6B_BASELINE" rev-parse HEAD)" = "${SRA6B_ACTUAL_COMMIT:?commit publie 0.63 requis}"
```

Ce dernier contrôle vérifie l’alignement local avec la preuve déjà recueillie ; il ne vérifie pas lui-même l’hébergement. Le futur répertoire `performance-integrated-01` doit être neuf pour les sorties finales. Aucun reçu existant ne doit être écrasé.

## 2. Déclaration du protocole, inventaire et captures fonctionnelles

Après disponibilité des deux gels réels, préparer le protocole. Cette commande vérifie les sources et copie les cas historiques dans le nouveau répertoire ; elle ne produit pas la readiness.

```bash
python -B "$SRA6B_TOOLS/prepare-cost-protocol.py" \
  --baseline-checkout "$SRA6B_BASELINE" \
  --baseline-site-version "${SRA6B_ACTUAL_SITE:?numero du Site publie 0.63 requis}" \
  --candidate-version 0.64.0 \
  --output-directory "$SRA6B_PERF" \
  --candidate-source-directory "$SRA6B_CANDIDATE" \
  --baseline-manifest "$SRA6B_BASELINE_MANIFEST" \
  --owner-cost-qualification --finalize

node "$SRA6B_TOOLS/record-owner-source-inventory.mjs" \
  "$SRA6B_BASELINE" "$SRA6B_PERF/owner-source-inventory.json"

node "$SRA6B_TOOLS/capture-cost-owner-graphs.mjs" baseline \
  "$SRA6B_BASELINE" "$SRA6B_PERF/cases.json" \
  "$SRA6B_BASELINE_MANIFEST" "$SRA6B_PERF/owner-baseline.json.gz"

node "$SRA6B_TOOLS/capture-cost-owner-graphs.mjs" candidate \
  "$PWD" "$SRA6B_PERF/cases.json" \
  "$SRA6B_CANDIDATE/source-manifest.json" "$SRA6B_PERF/owner-candidate.json.gz"

node "$SRA6B_TOOLS/qualify-cost-owner-graphs.mjs" \
  "$SRA6B_PERF/owner-baseline.json.gz" "$SRA6B_PERF/owner-baseline.receipt.json" \
  "$SRA6B_PERF/owner-candidate.json.gz" "$SRA6B_PERF/owner-candidate.receipt.json" \
  "$SRA6B_PERF/owner-graph-attribution.json" "$SRA6B_PERF/owner-structural-fixture.json"
```

Les captures sont fonctionnelles, hors fenêtre de mesure : STCK et SMLP, chacun en chauffe puis en session complète, soit quatre formes et 31 actions par rôle. Les trois inspections terminales appartiennent seulement aux formes complètes. Les reçus sont créés automatiquement en remplaçant `.json.gz` par `.receipt.json`. Ni `readiness.json` ni `window.json` ne doivent déjà exister.

L’inventaire doit ajouter uniquement `selected_rigid` et conserver les autres propriétaires et programmes. Sur ces parcours étrangers, le journal SelectedRigid doit rester exactement vide. Le qualificatif compare exactement les valeurs communes ; il accepte uniquement la différence liée et vérifiée de métadonnée `origin.source_digest`. Une identité calculée différente dans une valeur peut donc faire refuser cette étape. Conserver ce refus et, si nécessaire, dériver une adaptation précise avant toute mesure ; aucune normalisation générale ni qualification anticipée.

## 3. Contrat, préflight et readiness

```bash
python -B "$SRA6B_TOOLS/finalize-owner-cost-contract.py" "$SRA6B_PERF"
python -B "$SRA6B_TOOLS/check-cost-static-inputs.py" --performance-directory "$SRA6B_PERF"
```

Sorties attendues : `owner-growth-contract.json`, puis `static-preflight.json` avec tous les contrôles satisfaits. La qualification précédente doit avoir produit `owner-structural-fixture.json` et son attribution liée ; le contrat exige ces noms de fixture et d’inventaire.

**Aucun des onze helpers ne crée la readiness.** Le responsable doit ensuite créer le vrai `readiness.json` à partir des preuves terminées, des limites conservées et de la coordination constatée, sans nouvelle demande d’autorisation utilisateur. Les lecteurs exigent notamment `measurementAuthorized: true`, `pendingRequirements: []`, le digest natif candidat complet, `finalizedAt`, les empreintes exactes du contrat, du préflight, de la déclaration et des deux outils de consolidation/revue dans `inputs`, ainsi que `ownerCostContract` cohérent avec le préflight. Ne pas écrire ces valeurs tant que les conditions ne sont pas effectivement remplies. L’ordre temporel imposé est déclaration → contrat → préflight → readiness → fenêtre.

Terminer les autres travaux coûteux, arrêter les previews et obtenir le silence effectif des autres lots conformément à la coordination existante. Tenir la fenêtre exclusive via `performance.lock` jusqu’à la fin de la mesure et des comparaisons convenues. Tout nouveau quiet demandé par un autre lot suspend ce plan. Un simple contrôle de présence, sans revendication de validation complète :

```bash
test -s "$SRA6B_PERF/readiness.json"
```

## 4. Fenêtre officielle A1/B1/B2/A2

Seulement après readiness réelle et isolation constatée :

```bash
python -B scripts/run-native-cost-window.py \
  "$SRA6B_BASELINE" "$SRA6B_PERF" \
  "$SRA6B_BASELINE_MANIFEST" "$SRA6B_CANDIDATE/source-manifest.json"
```

Le runner impose les quatre séries dans cet ordre et vérifie les entrées. Population conservée : 32 sessions et 400 actions mesurées ; huit chauffes et 24 actions exclues prospectivement. Conserver tout échec et toute tentative ; ne pas relancer ou supprimer des échantillons pour obtenir un meilleur verdict.

## 5. Comparaison finale, revue indépendante et rendu

Après une fenêtre complète et intacte, exécuter une seule fois le finaliseur actif avec les chemins explicites :

```bash
python -B "$SRA6B_TOOLS/finalize-measured-cost.py" "$SRA6B_PERF" \
  --baseline-manifest "$SRA6B_BASELINE_MANIFEST" \
  --candidate-source-directory "$SRA6B_CANDIDATE"
```

Il appelle les comparateurs historiques des deux cohortes, puis leur comparateur strict, en conservant code retour, journaux et sorties. La branche complémentaire actuellement déclarée exige un véritable refus historique `Within-cohort work metadata changed` sans agrégat historique produit. Un succès historique inattendu est conservé et arrête cette branche ; il n’est pas converti artificiellement en refus.

Le finaliseur orchestre ensuite les commandes suivantes. Elles sont indiquées pour rendre l’ordre et les arguments vérifiables ; **ne pas les lancer séparément en plus du finaliseur**, qui exige des sorties neuves :

```bash
node "$SRA6B_TOOLS/consolidate-owner-costs.mjs" \
  "$SRA6B_PERF/owner-growth-contract.json" "$SRA6B_PERF/owner-growth-comparison.json"
python -B "$SRA6B_TOOLS/review-owner-costs.py" \
  "$SRA6B_PERF/owner-growth-contract.json" "$SRA6B_PERF/owner-growth-comparison.json" \
  "$SRA6B_PERF/owner-growth-review.json"
python -B "$SRA6B_TOOLS/record-cost-log-transport.py" "$SRA6B_PERF"
python -B "$SRA6B_TOOLS/write-cost-results.py" \
  --output-directory "$SRA6B_PERF" \
  --candidate-source-directory "$SRA6B_CANDIDATE" \
  --baseline-manifest "$SRA6B_BASELINE_MANIFEST"
```

Le résultat reste celui calculé : **session complète strictement inférieure à +10 % pour chaque jeu**, sans compensation entre jeux. Une phase au-dessus de +10 % peut être acceptée si ce critère global est satisfait ; phases, p95 disponibles, pauses et mémoire restent visibles. Un refus global reste un refus. Le coût de STCK/SMLP ne prouve ni le coût propre de la recherche SelectedRigid, ni un succès de KLOT, ni la publication future du candidat.

## 6. Préparations possibles avant la vraie publication

Un inventaire de propriétaires et des captures fonctionnelles peuvent servir de répétition contre 805b, avec les mêmes helpers, un manifeste réellement calculé sur cette baseline provisoire et des sorties neuves dans un dossier distinct tel que `provisional-063-01/functional-805b/`. Y conserver des cas historiques inchangés et une note explicite de provenance provisoire. Ces helpers ne nécessitent pas d’inventer un numéro de Site pour cette répétition ; la qualification éventuelle décrit uniquement les deux gels observés. Leurs imports natifs et captures restent de véritables travaux à planifier hors quiet et ne font pas partie de la présente rédaction.

Ne pas lancer la déclaration finale, le contrat final, la readiness ou la fenêtre officielle contre une publication supposée. Ne pas ranger cette répétition dans `performance-integrated-01`, ne pas rebaptiser ses reçus en preuve de publication, et refaire la qualification finale après réconciliation de la vraie 0.63. Une identité native éventuellement identique devra être établie par les preuves effectives ; elle n’est pas présumée.

## Sources de ce plan

Lecture du code actif uniquement : les onze helpers de `docs/migration/lot6b-evidence/`, en particulier les parseurs d’arguments, les gardes d’antériorité et l’orchestration de `finalize-measured-cost.py`, ainsi que le parseur de `scripts/run-native-cost-window.py`. Aucun helper, import natif, test, capture, mesure, calcul d’empreinte ou jeu exécuté pour produire ce plan.
