# Lot 6B : prochaine clôture du contrat et du préflight de coût

Statut : revue de source prospective, 11 novembre 2026. Aucun helper de coût, import natif, test, calcul d’empreinte, Git, capture, jeu ou mesure exécuté pour cette revue. Aucun payload de capture, rapport ou ledger KLOT ouvert. Les nombres déjà qualifiés ci-dessous sont transmis par les reçus antérieurement relus, sans nouvelle lecture de leur contenu.

## Conclusion et travaux possibles maintenant

La qualification structurelle retenue contre **805b provisoire / candidat fa23** a passé 64 contrôles sur 58 points avec 168 records temporels. Les 204 tests locaux des quatre consommateurs et leurs quatre vérifications sur les données réelles sont clos. Ils ne constituent pas un passage complet de leurs CLI.

Les interfaces actuelles ne proposent aucun mode `functional-only` permettant de produire un contrat officiel à partir de cette seule répétition. Le finaliseur du contrat et le préflight exigent une déclaration du prédécesseur **réellement publié 0.63** et du candidat 0.64 gelé. Le consolidateur et le lecteur indépendant exigent ensuite une fenêtre de mesure et ses résultats réels. Il ne faut donc ni attribuer un numéro de Site fictif à 805b, ni traiter HEAD/main comme une publication, ni fabriquer readiness ou rapports mesurés pour faire passer les CLI.

Sans SH, on peut maintenant terminer les revues de source, préparer les déclarations et inventaires de chemins sans les finaliser, vérifier la fermeture des dépendances des outils, préparer des essais CLI négatifs dans des sorties distinctes, ou développer un mode de validation avant mesure explicitement séparé si nécessaire. Ce dernier mode n’existe pas actuellement et demanderait une modification prospective revue et testée ; il ne doit pas affaiblir le contrat officiel. La répétition fonctionnelle 805b peut également être prolongée dans son espace provisoire, avec de nouveaux reçus, si un risque concret le justifie. Aucun de ces travaux ne nécessite d’attendre la publication d’un autre lot.

## Prérequis des commandes officielles

1. Observer et conserver le Site, le commit et la version native de la publication effective 0.63 ; le dernier état fourni au moment de cette revue reste Site 103 / native 0.62. Les helpers ne consultent pas l’hébergement : leurs vérifications locales ne remplacent pas cette observation.
2. Aligner le checkout baseline distinct sur ce commit publié, réconcilier le candidat, puis conserver les deux manifestes et l’archive candidate. Si les sources changent, conserver le gel provisoire et établir le nouveau gel et les validations pertinentes.
3. Utiliser un répertoire de performance neuf. Conserver les sept outils historiques, cas et politiques inchangés, ainsi que les dépendances comparables des deux checkouts. Fermer les empreintes après la dernière modification des helpers : déclaration et contrat lient précisément consolidateur et lecteur indépendant.
4. Établir l’inventaire réel des propriétaires et la qualification des captures liées aux gels finaux. L’ajout doit se limiter à SelectedRigid, avec ordre des propriétaires antérieurs et programmes conservés. La preuve provisoire n’est pas renommée en preuve finale ; toute identité éventuellement conservée doit être vérifiée.

## Commandes exactes et ordre

Les commandes suivantes sont préparées, **non exécutées**. Partir du checkout candidat. Les variables de publication restent volontairement non renseignées ; le chemin du gel candidat doit être remplacé si la réconciliation le change.

```bash
cd /workspace/sites/sra-lot6b-20261111/.sites-checkout
SRA6B_TOOLS=docs/migration/lot6b-evidence
SRA6B_PERF=docs/migration/lot6b-evidence/performance-integrated-01
SRA6B_CANDIDATE=docs/migration/lot6b-evidence/provisional-063-01/frozen-candidate
SRA6B_BASELINE=/workspace/sites/sra-lot6b-baseline-063-20261111/.sites-checkout
SRA6B_BASELINE_MANIFEST=docs/migration/lot6b-evidence/provisional-063-01/baseline-actual-063/source-manifest.json

python -B "$SRA6B_TOOLS/prepare-cost-protocol.py" \
  --baseline-checkout "$SRA6B_BASELINE" \
  --baseline-site-version "${SRA6B_ACTUAL_SITE:?numero du Site publie 0.63 requis}" \
  --candidate-version 0.64.0 \
  --output-directory "$SRA6B_PERF" \
  --candidate-source-directory "$SRA6B_CANDIDATE" \
  --baseline-manifest "$SRA6B_BASELINE_MANIFEST" \
  --owner-cost-qualification --finalize
```

Après l’inventaire et les captures fonctionnelles effectivement liés à cette déclaration, l’outil de qualification expose exactement six arguments :

```bash
node "$SRA6B_TOOLS/qualify-cost-owner-graphs.mjs" \
  "$SRA6B_PERF/owner-baseline.json.gz" "$SRA6B_PERF/owner-baseline.receipt.json" \
  "$SRA6B_PERF/owner-candidate.json.gz" "$SRA6B_PERF/owner-candidate.receipt.json" \
  "$SRA6B_PERF/owner-graph-attribution.json" "$SRA6B_PERF/owner-structural-fixture.json"

python -B "$SRA6B_TOOLS/finalize-owner-cost-contract.py" "$SRA6B_PERF"
python -B "$SRA6B_TOOLS/check-cost-static-inputs.py" --performance-directory "$SRA6B_PERF"
```

Le finaliseur exige notamment `declaration.json`, les manifestes, `owner-source-inventory.json`, `owner-structural-fixture.json` et toute la provenance liée de cette fixture. Il refuse un contrat, préflight, readiness, fenêtre ou résultats de cohortes préexistants. Sa sortie neuve est `owner-growth-contract.json`.

Le préflight demande notamment `declaration.json`, `protocol-check.json`, `global-budget-policy.json`, `preparation.json`, `cases.json`, `comparison-policy.json`, le contrat et leurs références exactes. Il vérifie les gels, archives, outils, politiques, versions, commits et checkouts. Son exécution inclut du Git en lecture, la version Node et un sous-processus de vérification du protocole : ce n’est pas une simple lecture de texte. Attendre `static-preflight.json` avec statut `static_inputs_checked` et tous les contrôles satisfaits ; un `ValueError` sémantique peut interrompre avant la création du JSON. Conserver donc le reçu de commande et le traceback, sans assimiler l’absence de sortie à un succès.

L’ordre imposé reste déclaration → contrat → préflight → readiness → fenêtre. Aucun des helpers considérés ne crée une readiness véridique automatiquement. Celle-ci doit être établie à partir des preuves et conditions effectivement satisfaites, avec empreintes, digest candidat, `measurementAuthorized: true` et `pendingRequirements: []` réellement justifiés.

Après une fenêtre officielle complète, intacte et liée aux deux gels, les interfaces des deux consommateurs terminaux sont :

```bash
node "$SRA6B_TOOLS/consolidate-owner-costs.mjs" \
  "$SRA6B_PERF/owner-growth-contract.json" "$SRA6B_PERF/owner-growth-comparison.json"
python -B "$SRA6B_TOOLS/review-owner-costs.py" \
  "$SRA6B_PERF/owner-growth-contract.json" "$SRA6B_PERF/owner-growth-comparison.json" \
  "$SRA6B_PERF/owner-growth-review.json"
```

Ces commandes requièrent `static-preflight.json`, `readiness.json`, `window.json`, les quatre rapports des deux cohortes, leurs comparaisons, les références de sources et la preuve du refus historique strict attendu. Le lecteur indépendant recalcule la décision. La fenêtre doit être passée, intègre, dans l’ordre A1, B1, B2, A2 ; la population déclarée reste 32 sessions mesurées / 400 actions, avec huit chauffes exclues / 24 actions. Le refus historique conservé doit correspondre à `Within-cohort work metadata changed`, sans agrégat historique artificiel. Un résultat historique différent ne se transforme pas en refus attendu.

Dans le parcours complet prévu, **ne pas doubler ces deux commandes** : le finaliseur suivant les orchestre après les comparateurs historiques, puis conserve le transport et le rendu. Il exige lui aussi des sorties neuves :

```bash
python -B "$SRA6B_TOOLS/finalize-measured-cost.py" "$SRA6B_PERF" \
  --baseline-manifest "$SRA6B_BASELINE_MANIFEST" \
  --candidate-source-directory "$SRA6B_CANDIDATE"
```

Le succès intégral de ces CLI contre 805b ne peut donc pas être revendiqué à partir des seules captures fonctionnelles existantes. La suite utile immédiate est une préparation ou un essai explicitement séparé ; le parcours officiel positif reste conditionné par la vraie publication et les mesures.

## Corrections prospectives de coordination et de description

La règle [courante de travail](../current-work-policy-20261111.md) remplace les anciens préfixes SH et les attentes de quiet pour le développement, les tests fonctionnels, commits et push. La recherche textuelle dans les cinq helpers n’a trouvé aucun couplage explicite à `flock`, `performance.lock` ou `quiet_requested` à supprimer. En revanche, le [plan historique](../provisional-063-01/cost-execution-plan.md) contient deux prescriptions périmées pour le travail ordinaire : « tout nouveau quiet […] suspend ce plan » et captures « à planifier hors quiet ». Elles doivent être interprétées prospectivement selon l’addendum, sans réécrire les reçus historiques. L’exclusivité courte reste nécessaire pour les mesures officielles et la publication ; ne jamais supprimer ni remplacer un verrou détenu. La portée exacte de la clôture de mesure sera déclarée avant lancement.

Le même plan décrit encore une comparaison commune entièrement exacte sauf `origin.source_digest`. La politique désormais qualifiée ajoute uniquement le champ `native_reasoning_trace` à `/value/root/members/created/bits`, avec schéma, rôle, session, fenêtre temporelle et stabilité strictement vérifiés. Les autres valeurs, origines, chaînes, digests, tickets et compteurs restent stricts. Cette attribution ne constitue aucune mesure de performance.

Le critère d’acceptation demeure la médiane des sessions complètes **strictement inférieure à +10 % pour chaque jeu**, sans compensation entre jeux ni retrait d’observations. Une phase au-dessus de +10 % est acceptable si ce critère global passe ; les phases restent publiées.

Sources de cette revue : les cinq helpers actifs cités ci-dessus, les arguments de `prepare-cost-protocol.py`, le plan de commandes existant et l’addendum courant. Ce mémo n’altère aucun helper, plan gelé, entrée native, test ou preuve antérieure.
