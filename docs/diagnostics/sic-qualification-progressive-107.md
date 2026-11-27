# P05 · Qualification progressive sur les 107 jeux

Le candidat `3c2d6bcf` a depuis été qualifié sur les 107 jeux, avec cinq comparaisons supplémentaires au niveau des décisions. [Résultats, compteurs des appelants et reçus reproductibles](sic-qualification-3c2d6bcf.md)

Le [catalogue par jeu](sic-qualification-progressive-107.json) couvre **107 codes distincts, 692 niveaux et 24 lots**. Chaque ligne donne le score, les limites par niveau (commandes et millisecondes), les récupérations, le lot, les empreintes du reçu, la disponibilité d’A et les indices propres aux deux appelants. Les mesures du premier lot restent disponibles dans la [fiche A/A′](sic-comparaison-decisions.md).

| Ordre | Jeux | Preuve disponible et question |
|---|---|---|
| Cohorte initiale | AS66, G50T, HOLE | Trois traces A de décisions identifiées par SHA-256, produites contre A′. Les témoins historiques d’AS66 et G50T concernent le contrôle manquant. Le marqueur natif `missingControl` est absent des trois traces A. |
| Appelants | **PORT**, puis **DC22** | PORT porte une offre P05 de `sic_paired_passage` visant l’interrupteur en L4 tour 7 et L6 tour 6. Le reçu historique conserve la famille, la stratégie, la situation et le nombre de preuves. La capture A ciblée permettra de vérifier `steps[0].point == switchTest`. Pour DC22, le contrat historique cite un essai en L1 au tour 1. La présence de `evaluateMissingControl` dans son parcours du gel reste à établir. |
| Témoins | SNAR, SS01, SS04 | SNAR couvre l’autre correction du gel. SS01 et SS04 sont les deux seuls reçus avec un reset. |
| Extension | 99 autres jeux | Victoire et trajectoire archivées. Les deux sites d’appel restent non établis dans ces parcours. |

Une étiquette P05 peut être produite par plusieurs familles. Le plan n’attribue un appel à `evaluateMissingControl` que sur un témoin positif `sic_native_plan.missingControl`. Il attribue le contact à partir de la famille appariée et de la géométrie de sa proposition. Un appel qui refuse une offre peut rester invisible. Les tests de caractérisation et leurs témoins ont une provenance distincte des commandes du gel. [Cartographie des appelants](https://github.com/yannick-fontan-1981/sra-playground/blob/dd9f8212404cd476f28b6cf62faad58e6869b531/docs/architecture/sic-cartographie-p05.md)

## Vérifier le plan hors ligne

Depuis la racine de `codex/sic-comparison-bench`, utiliser Python 3.11 ou supérieur. Dans un nouveau clone, récupérer d’abord les objets Git des archives et du générateur.

```sh
git fetch origin audit/sic-107-4be368a3-20261127 audit/sic-107-workflow-tooling-20261127
python scripts/sic-qualification-progressive.py plan
python tests/sic-qualification-progressive-test.py
```

Le gel `d0e7527ca8033bd805a6d7a8bb021eff62e87021` et le commit réellement joué `4be368a365a6347fb551bb4c73dd5756413bb34e` ont l’arbre `dcaf029b1f31ae15d9a1be62b705e93ce58d4ca1`. Le programme lit les blobs de l’archive immuable `e36b550c`, vérifie le workflow, la commande, le SHA des sources et plafonds, le SHA-256 des octets de chaque lot, l’ordre et l’unicité des reçus. L’audit historique vérifie aussi le score officiel, l’autorité et la réconciliation dans les plafonds. Le manifeste de `4a546a13` fournit le catalogue et les budgets historiques. Les 107 victoires proviennent du [run 46051058377](https://github.com/yannick-fontan-1981/sra-playground/actions/runs/46051058377).

Les 107 reçus archivés comportent les effets ordonnés, les compteurs de niveau et les empreintes de trajectoire. Seuls trois disposent en plus de la trace A de décisions du banc. Sur un poste où ces fichiers manquent, `plan` indique « fichier à fournir ». Une comparaison de reçus peut localiser une différence de commande ou de situation à un tour, une différence d’empreinte de préfixe à la fin d’un niveau, ou un arrêt. Avec un simple reçu de victoire, seuls les résultats et les niveaux documentés sont comparables. Le résultat par jeu indique sa précision et réserve `decisionComparison` à une vraie comparaison de deux traces.

## Exécuter une vague pendant un créneau réservé

Attendre la fin des captures natives P05 sur la machine. Utiliser des checkouts propres du candidat et du gel. Dans PowerShell, depuis le checkout du banc :

```powershell
$p05 = (Resolve-Path ../sic-cartographie-p05).Path
$gel = (Resolve-Path ../sic-main-delivery).Path
$sha = (git -C $p05 rev-parse HEAD).Trim()
$node24 = (& npx.cmd --yes --package=node@24.22.3 -c 'node -p process.execPath').Trim()
$etat = "artifacts/qualification-$sha-appelants"
py scripts/sic-qualification-progressive.py run --candidate $sha --checkout $p05 --frozen-checkout $gel --node $node24 --state $etat --games appelants --exact --limit 1
```

**Relancer la même commande** pour le jeu suivant. `--exact` capture B puis A sur le jeu sélectionné si A manque. La référence ciblée doit reproduire le reçu historique. Pour les témoins, employer `--games temoins` et un nouvel état. Sans `--exact`, le banc compare d’abord le reçu et capture A en cas d’écart ou pour la cohorte initiale. Pour examiner un jeu remonté par la CI, utiliser son code avec `--exact`. Les traces sont locales.

Le dossier d’état lie le SHA et l’arbre candidats au protocole et aux paramètres. Chaque tentative native a son propre dossier avec commande, SHA, reçu et trace. La publication atomique de `<jeu>.json` clôt le jeu. Après interruption, la reprise conserve la tentative incomplète, repart de L1 pour ce jeu et vérifie les empreintes des jeux déjà clos. Un verrou réserve le dossier d’état à un seul processus. Une différence clôt une mesure avec `matches: false` et reste visible à la reprise.

## Campagne complète sur GitHub Actions

Le lanceur réutilise le workflow historique à 24 lots équilibrés, un worker par jeu, jeux en série sur chaque runner. La commande de préparation ci-dessous calcule l’empreinte du workflow pour le SHA voulu, sans lancer de jeu.

```powershell
py scripts/prepare-sic-107-rerun.py --source $sha
```

Au créneau retenu, créer un checkout de la branche d’audit indiquée par cette commande au SHA exact du candidat. Depuis ce checkout, appeler le même script du banc avec `--source $sha --write`, committer le workflow produit, puis pousser **la branche d’audit** pour démarrer la campagne. Le run de préparation pour `3c2d6bcfd4a7d7abf28650e2f8ffed3d3510c3b4` donne l’empreinte `b2145cca6c34b5a7b3802c0e348fe1eb4ea9af29db57bc2f885d5200f84115d6`. Le verdict de cette campagne figure dans la fiche du candidat en tête de page.

Après la campagne, télécharger les artefacts avec `gh run download <run-id> --dir <dossier>`. Fournir le commit du workflow annoncé par GitHub (`headSha`, récupéré par Git) et le SHA du moteur séparément. L’import vérifie les 24 lots de la première tentative du run, puis compare les reçus et reprend jeu par jeu dans son propre état.

```text
python scripts/sic-qualification-progressive.py import-ci --candidate <sha-moteur> --workflow <sha-workflow> --run-id <run-id> --download <dossier> --state artifacts/import-<run-id> --games all
```

## Exercice de reprise réalisé sur reçus

Les 107 reçus téléchargés du run de référence ont été importés et comparés à l’archive Git : 107 concordances au niveau du reçu. L’exercice suivant, reproductible depuis les blobs Git seuls, a traité PORT au premier appel, repris PORT et traité DC22 au deuxième, puis réutilisé les deux résultats au troisième. Le test d’interruption coupe aussi la publication de DC22 et vérifie que le reçu clos de PORT conserve exactement ses octets.

```sh
python scripts/sic-qualification-progressive.py import-ci --candidate 4be368a365a6347fb551bb4c73dd5756413bb34e --workflow abab3da60767b520ede320033e8091a0c0ee8414 --run-id 46051058377 --state artifacts/exercice-107 --games appelants --limit 1
```
