# Lot 10 : travail ordinaire et exclusivités limitées

## Consigne utilisateur applicable

Le développement, les vérifications fonctionnelles, les commits et les pushs du lot 10 avancent dans son propre checkout et sa propre branche. Ils ne dépendent plus du verrou global ni des publications des autres lots. Les sauvegardes de sources doivent être régulières.

Une exclusivité courte reste réservée aux mesures officielles de performance et à l'opération effective de publication. Elle ne couvre pas leur préparation, la rédaction, les tests fonctionnels, les compilations, les commits ou les pushs de branche. Aucun verrou détenu n'est supprimé, remplacé ou libéré par un autre travailleur.

## Entrées ordinaires par défaut

Depuis le checkout du lot 10, utiliser pour les prochains travaux :

```bash
python -B docs/migration/lot10c-evidence/run-ordinary-release-checks.py DIRECTORY --tests

python -B docs/migration/lot10c-evidence/run-ordinary-release-checks.py DIRECTORY \
  --tests --extra-tests docs/migration/lot10c-evidence/integrated-extra-test-scope.json

python -B docs/migration/lot10c-evidence/run-ordinary-release-checks.py DIRECTORY \
  --tests --extra-tests docs/migration/lot10c-evidence/integrated-extra-test-scope.json \
  --batch-manifest docs/migration/lot10c-evidence/prepared-test-partition.json \
  --batch-index 1 --timeout-seconds 300

python -B docs/migration/lot10c-evidence/run-ordinary-release-checks.py DIRECTORY \
  --build-script /absolute/path/to/sites/scripts/build-site.mjs

python -B docs/migration/lot10c-evidence/run-ordinary-regressions.py DIRECTORY
```

Ces commandes ne prennent aucun verrou global, ne lisent aucun état de calme des autres lots et n'attendent aucune publication pour leur admission. L'option `--coordination-lock` est supprimée. Les reçus indiquent `mode: ordinary_unlocked`, `globalLockAcquired: false` et `timingClaim: false`.

Les gels de sources, répertoires de preuve exclusifs, contrôles d'intégrité, traces brutes, archives, erreurs et délais restent conservés. Le mode batch reste une vérification de développement : sa partition, ses bornes et sa supervision sont maintenues. Le rejeu ordinaire garde les dix cas déclarés et les 17 comparaisons historiques par cas. Un complément KATA conserve sa déclaration et ses reçus distincts.

Les vérifications courtes de ces points d'entrée se trouvent hors de la suite native :

```bash
python -B docs/migration/lot10c-evidence/test-ordinary-entrypoints.py
```

Elles compilent et comparent les helpers puis simulent uniquement l'admission de leurs modes avec `run()` remplacé. Elles n'exécutent aucun test natif, build, jeu ou rejeu réel. L'accès aux fichiers de coordination et tout `flock` sont interdits pendant ces simulations.

## Preuves conservées et qualification finale

`run-release-checks.py` et `run-regressions.py` restent inchangés uniquement pour conserver les preuves historiques qui les citent. Ils ne sont plus les entrées par défaut du travail ordinaire. Aucun ancien reçu n'est réécrit pour lui attribuer le nouveau mode.

La nouvelle politique d'admission n'accepte pas automatiquement une preuve de livraison. Les vérificateurs historiques qui nomment un ancien générateur restent inchangés ; leurs liens ne doivent pas être falsifiés pour faire passer un nouveau reçu. Les contrôles fonctionnels déjà obtenus conservent leur portée réelle.

## Performance et publication

La préparation de la mesure et du déploiement avance sans verrou global. La mesure officielle utilise sa courte fenêtre exclusive et sa coordination propre ; la publication utilise son exclusivité courte au moment d'écrire la version effectivement publiée. Un verrou ne prouve pas à lui seul l'absence de travail concurrent. Les reçus de performance doivent décrire les conditions réellement établies, sans qualifier les tests ordinaires de mesures isolées.

La référence publiée 0.65 et le candidat 0.66 doivent encore satisfaire le contrat de coût 10C : seul `public_ordered_recruitment` et son programme `v6.ordered_recruitment.choose` peuvent être ajoutés au couple comparé. Cette obligation de qualification ne bloque ni le travail ordinaire ni les pushs de sa branche.

La médiane de la durée complète doit rester strictement sous +10 % séparément pour STCK et SMLP. Un dépassement de phase reste acceptable lorsque le global du même jeu passe ; les données et réserves restent conservées. Les budgets cumulés RECR/HPDL et la fermeture de LKEY ne changent pas.
