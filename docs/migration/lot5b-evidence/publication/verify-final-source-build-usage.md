# Vérification finale du transport source et du build 5B

Ce contrôle reste en lecture seule sur les deux checkouts. Il écrit uniquement un nouveau reçu JSON dans le répertoire extérieur des artefacts. Il ne prépare pas le transport, ne reconstruit pas le build, ne restaure pas de fichiers ignorés, ne lance aucun test, ne pousse aucune source et ne publie aucun Site.

Le code est adapté du vérificateur publié de 4C. Il attend le vrai schéma 5B de `publication-inputs.json` : `receipts`, `costAccepted`, `costGlobalStatus` et `historicalStrictPassed`. Son statut `passed` concerne l'intégrité des sources et du build. Le verdict de coût réel est conservé séparément, même s'il est défavorable ; ce reçu n'accorde aucune autorisation de publication et ne constitue aucune preuve de déploiement.

Le refus strict historique des coûts 5B reste obligatoire : son vrai reçu `retained-tool-failure.v1`, son code 1 et son journal exact sont reliés à la consolidation et aux empreintes de publication, puis relus dans les deux checkouts. La sortie d'agrégat strict doit rester absente. Ce refus n'utilise pas l'option des échecs de transport décrite plus bas.

## Exécution après toutes les étapes réelles

Les chemins ci-dessous sont les destinations effectivement ouvertes par le responsable de livraison. Les trois variables SHA et le chemin du plan doivent être renseignés depuis les fichiers réels, après leur création et leur conservation. Aucun commit futur, numéro d'étape final ou code de sortie n'est prédéclaré ici.

```bash
flock -s /workspace/shared/sra-coordination/performance.lock python -B \
  /workspace/sites/sra-lot5b-20261110/.sites-checkout/docs/migration/lot5b-evidence/publication/verify-final-source-build.py \
  --validated-checkout /workspace/sites/sra-lot5b-20261110/.sites-checkout \
  --publication-worktree /workspace/sites/sra-lot5b-publication-20261111/.sites-checkout \
  --artifact-directory /workspace/sites/sra-lot5b-publication-artifacts-20261111 \
  --plan "${lot5b_plan:?chemin du plan réel requis}" \
  --plan-sha256 "${lot5b_plan_sha256:?empreinte réelle du plan requise}" \
  --preparation /workspace/sites/sra-lot5b-publication-artifacts-20261111/worktree-preparation.json \
  --preparation-sha256 "${lot5b_preparation_sha256:?empreinte réelle de préparation requise}" \
  --publication-inputs-sha256 "${lot5b_publication_inputs_sha256:?empreinte réelle de publication-inputs requise}" \
  --go-after-source-pushes
```

L'exécution attend le GO du responsable de livraison après l'achèvement de chaque helper déclaré dans le plan. Elle ne doit pas être démarrée pendant qu'un autre détenteur conserve le verrou de performance en exclusif. La commande n'a pas été exécutée lors de cette préparation ; seule la syntaxe Python est contrôlée.

Par défaut, le reçu nouveau est `final-source-build-verification.json` dans le répertoire extérieur. Pour une nouvelle tentative, utiliser `--output` avec un nouveau nom dans ce même répertoire. Aucun reçu existant n'est écrasé.

## Contrat des entrées

### Plan réel

Le paramètre `--plan` désigne un fichier extérieur de schéma `logos-engine.bounded-source-push-plan.v2`, avec son SHA-256 complet fourni séparément. Le vérificateur lit les champs réels `projectId`, `publishedBaseCommit`, `retainedTargetCommit`, `targetTree`, `finalCommit`, `finalTree`, `finalParents`, `finishedAt` et `steps`. Il exige `status: planned_not_pushed`, `checkoutUnchanged: true`, `finalTreeExactlyEqualToRetainedTarget: true`, `originalHeadIsFinalDirectParent: true` et `nativeTestBuildInputsEqualToTargetFromFirstStep: true`.

La liste `steps` doit être non vide et numérotée de 1 à sa longueur réelle. Chaque ligne contient `step`, `previousCommit`, `commit`, `tree` et `parents`. Les commits, arbres, parents, l'ascendance et le dernier commit sont comparés aux objets Git réellement présents, sans accès réseau ni mutation Git. Le prédécesseur de transport peut être la clôture documentaire publiée la plus récente ; il n'est pas confondu avec le commit de référence natif utilisé pour les coûts.

### Préparation réelle du worktree

`--preparation` désigne `worktree-preparation.json`, conservé dans le même répertoire extérieur et épinglé par `--preparation-sha256`. Champs consommés :

| Champ | Valeur attendue issue du travail réellement effectué |
|---|---|
| `schema` | `logos-engine.lot5b-publication-worktree-preparation.v1` |
| `status` | `passed`, uniquement après préparation vérifiée |
| `recordedAt` | Horodatage réel, postérieur à `plan.finishedAt` et antérieur aux pushes |
| `openedActualPredecessor` | `plan.publishedBaseCommit` |
| `sourceCommit` | `plan.steps[0].commit` |
| `expectedFrozenInputs` | Taille de l'union exacte des cinq inventaires ci-dessous |
| `nativeDigest` | Digest du manifeste natif intégré réel |
| `restoredIgnoredInputs` | Liste unique des chemins relatifs effectivement restaurés et encore ignorés |
| `validatedApplicationMembers` | Objet chemin relatif → SHA-256 des fichiers compilés validés et de `.openai/hosting.json` |
| `applicationMemberCount` | Taille de `validatedApplicationMembers` |
| `worker` | Objet exact `nativeAgentWorker` du reçu de build |
| `rebuildExecuted` | `false` |

Le champ `worktreeClean` peut également être conservé dans la préparation. Le vérificateur contrôle lui-même l'état Git réel du worktree final et exige sa propreté.

L'union `expectedFrozenInputs` est dérivée de `source-manifest.json.files`, `source-archive.json.files`, `validation/delta-tests-run.json.sourceAndTestInputs`, `validation/checks-run.json.buildInputs` et `regressions/regression-summary.json.executionInputs`. Les doublons doivent porter le même SHA. Le compte des fichiers de l'archive source n'est pas celui des membres de l'application compilée.

### Reçus et archives de chaque étape

Pour chaque numéro réellement présent dans le plan, les noms par défaut sont :

- `source-push-step-{step}.json` pour le reçu d'exécution du helper ;
- `site-step-{step}.tar.gz` pour l'archive effectivement créée par le helper ;
- `archive-step-{step}-verification.json` pour un éventuel contrôle antérieur d'archive déjà conservé.

Les deux premiers noms peuvent être adaptés avec `--workflow-receipt-pattern` et `--archive-pattern`. Chaque motif doit rester un chemin relatif canonique dans le répertoire extérieur et contenir exactement un marqueur `{step}`.

Chaque reçu de helper conserve `step` entier, `exitCode` réel, `startedAt`, `finishedAt`, `outputChunks` (liste de fragments de stdout bruts), et `result`. La vérification de succès exige alors `exitCode: 0` et l'objet `result` exact suivant :

```json
{
  "project_id": "identifiant réellement déclaré dans le plan",
  "checkout_path": "chemin absolu réel du worktree de publication",
  "commit_sha": "commit réel de cette étape du plan",
  "archive": "chemin absolu réel de l'archive de cette étape"
}
```

Cette forme illustre le schéma ; ce n'est pas un reçu d'exécution. La dernière ligne non vide des sorties brutes doit être le JSON exact de `result`, et une ligne brute doit être le chemin absolu de l'archive. Les étapes doivent respecter leur ordre et leurs vrais horodatages, sans chevauchement. Aucun code de retour favorable n'est fabriqué lors de la préparation de l'outil.

Toutes les archives sont lues en flux, sans extraction. Le mapping du manifeste de déploiement est conservé : `.openai/hosting.json` dans le checkout correspond à `dist/.openai/hosting.json` dans l'archive. Tous les autres membres doivent être les fichiers `dist/*` validés. Aucun fichier supplémentaire, lien, doublon ou omission n'est accepté. Le nombre final de comparaisons est calculé comme `nombre réel d'étapes × nombre réel de membres d'application`.

### Échecs de transport conservés

L'ancien échec de chemin d'archive propre à 4C n'est ni exigé ni recopié comme résultat 5B. Si un échec 5B réel survient, fournir chacun de ses reçus avec `--retained-failure CHEMIN_ABSOLU SHA256`. Ils doivent rester dans le répertoire extérieur et conserver un statut commençant par `failed` et un code de retour entier non nul. Ces entrées restent explicitement des échecs ; elles ne sont pas promues en succès.

## Portée des liaisons finales

Les répertoires de preuve 5B sont par défaut `docs/migration/lot5b-evidence/integrated-final` et `docs/migration/lot5b-evidence/performance-integrated`. Ils peuvent être fournis explicitement avec `--candidate-source-directory` et `--performance-directory`, comme chemins relatifs canoniques du checkout validé.

Les manifestes natif et archive, tests, build, rejeux, intégrité de livraison, readiness, consolidation et revue des coûts doivent tous correspondre aux empreintes du vrai reçu `publication-inputs.json`, et être identiques dans les deux checkouts. Les membres exacts des inventaires source/test/build/natif, le worker compilé, tous les octets de l'application, puis les empreintes et états Git avant/après sont contrôlés. Aucun succès de Site n'est déduit de ces contrôles.
